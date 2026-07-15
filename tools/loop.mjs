// ── tools/loop.mjs ───────────────────────────────────────────────────────────
// THE MOTION — one command that runs the evaluator-improvement loop over NEW captures.
//
// For each battle capture not yet processed, it: (1) EVALUATES — runs the fielded team
// through the watchdog/contribution model and (where scannable) the engine's own
// recommendation; (2) RECONCILES that against captured REALITY; (3) DETECTS divergence
// signals (a fielded champ the model scores ~0 = blindness; a benched champ out-scoring a
// fielded one = mispick; model-confident-but-lost / unsure-but-won); (4) DRAFTS a
// structured entry into knowledge/pending-review.md, flagged `needs_review`.
//
// It STOPS at the human-approval gate — it never encodes a rule or edits the ledger. The
// discipline holds: the machine proposes, a human approves, then a rule is encoded. State
// (which captures are processed) lives in knowledge/loop-state.json so re-runs only handle
// new battles. Usage: node tools/loop.mjs [--all] [--dry]
//   --all  reprocess every capture (ignore state)   --dry  don't write files/state

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname, '..');
const KNOW = path.join(REPO, 'knowledge');
const args = new Set(process.argv.slice(2));
const ALL = args.has('--all'), DRY = args.has('--dry');

// ── env + clients ────────────────────────────────────────────────────────────
const env = {};
for (const l of fs.readFileSync(path.join(REPO, '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
process.env.SUPABASE_URL = env.SUPABASE_URL;
process.env.SUPABASE_ANON_KEY = env.SUPABASE_ANON_KEY;
process.env.SUPABASE_SERVICE_KEY = env.SUPABASE_SERVICE_KEY;
process.env.SUPABASE_SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_KEY;
const BASE = (env.SUPABASE_URL || '').replace(/\/rest\/v1\/?$/, '');
const H = { apikey: env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}` };
const rest = async (p) => (await fetch(`${BASE}/rest/v1/${p}`, { headers: H })).json();
const supabase = createClient(BASE, env.SUPABASE_SERVICE_KEY);

const gc = await import('../lib/gestal-context.js');
const me = await import('../lib/match-engine.js');
const mr = await import('../lib/multiplier-rank.js');
const { runWatchdog } = await import('../lib/watchdog.js');

const CONTENT_KEY = {
  "Ice Golem's Peak": 'ice_golem', "Fire Knight's Castle": 'fire_knight',
  "Spider's Den": 'spider', "Dragon's Lair": 'dragon', 'Clan Boss': 'clan_boss',
};
const norm = (s) => String(s ?? '').trim().toLowerCase();
const BUDGET_SEC = 300; // ~5-min auto budget

// ── catalog (tags + base stats), aliases, per-account rosters ────────────────
const SEL = 'id,name,type_id,rarity,role,affinity,faction,base_hp,base_atk,base_def,base_spd,base_acc,base_res,base_crit_rate,base_crit_dmg,champion_tags(tag_id,status,ascension_required,tags(name,is_debuff,bypasses_accuracy_check))';
let dbChampions = [];
for (let from = 0; ; from += 1000) {
  const d = await rest(`champions?select=${encodeURIComponent(SEL)}&game_id=eq.raid_shadow_legends&limit=1000&offset=${from}`);
  if (!Array.isArray(d) || !d.length) break; dbChampions = dbChampions.concat(d); if (d.length < 1000) break;
}
// alias → canonical DB champion id (so capture short-names like "Deacon" resolve).
const aliasRows = await rest('champion_aliases?select=alias,champion_id');
const aliasToId = new Map((Array.isArray(aliasRows) ? aliasRows : []).map(a => [norm(a.alias), a.champion_id]));

const OUT_DIR = path.join(REPO, 'gestal-sync', 'output');
const rosters = {};
for (const f of fs.readdirSync(OUT_DIR).filter(f => f.endsWith('.json') && !f.startsWith('gear-corpus'))) {
  let j; try { j = JSON.parse(fs.readFileSync(path.join(OUT_DIR, f), 'utf8')); } catch { continue; }
  if (j.accountId) rosters[j.accountId] = j;
}
// Engine recommendation depends only on (roster, content) — NOT the specific battle — so
// cache it per account+content (turns 300 matchRoster calls into a handful).
const recCache = {};
async function recFor(accountId, userChampions, contentKey) {
  const k = `${accountId}|${contentKey}`;
  if (k in recCache) return recCache[k];
  let rec = null;
  try {
    const r = await me.matchRoster(userChampions, contentKey, { account_development: 'fair' });
    rec = { floor: r.stage_number_attempted ?? null, confidence: r.confidence_pct ?? null,
      verdict: r.verdict ?? null, recNames: new Set((r.team ?? []).map(c => norm(c.name))) };
  } catch {}
  return (recCache[k] = rec);
}

const mappedCache = {};
async function mappedRosterFor(accountId) {
  if (mappedCache[accountId]) return mappedCache[accountId];
  const j = rosters[accountId]; if (!j) return null;
  const { userChampions } = gc.buildUserChampions(j.champions, dbChampions);
  const mapped = me.mapRoster(userChampions, { accountDev: 'fair' }).mapped;
  try { await mr.attachDamageScores(mapped, supabase); } catch { /* damage proxy degrades gracefully */ }
  return (mappedCache[accountId] = { userChampions, mapped, snap: j });
}

// Resolve a captured hero name → the mapped roster champ (direct name, then alias).
function resolveFielded(mapped, heroes) {
  const byName = new Map(mapped.map(c => [norm(c.name), c]));
  const byId = new Map(mapped.map(c => [c.id, c]));
  const team = [], unresolved = [];
  for (const h of heroes ?? []) {
    let c = byName.get(norm(h.name));
    if (!c) { const id = aliasToId.get(norm(h.name)); if (id) c = byId.get(id); }
    if (c) team.push(c); else unresolved.push(h.name);
  }
  return { team, unresolved };
}

// ── state ────────────────────────────────────────────────────────────────────
const STATE_FILE = path.join(KNOW, 'loop-state.json');
let state = { processed: [] };
if (!ALL && fs.existsSync(STATE_FILE)) { try { state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); } catch {} }
const seen = new Set(state.processed);
const keyOf = (b) => `${b.accountId}|${b.capturedAt}`;

// ── the loop over new captures ───────────────────────────────────────────────
const log = JSON.parse(fs.readFileSync(path.join(REPO, 'gestal-sync/RslBattleReader/output/battle-log.json'), 'utf8'));
const reports = [];
let processed = 0, skipped = 0;

for (const b of (Array.isArray(log) ? log : [])) {
  if (!ALL && seen.has(keyOf(b))) continue;
  const contentKey = CONTENT_KEY[b.dungeon];
  if (!contentKey) { skipped++; continue; }
  if (!(b.heroes ?? []).length) { skipped++; continue; } // nothing to evaluate (old/empty capture)
  const acc = await mappedRosterFor(b.accountId);
  if (!acc) { skipped++; continue; }

  const won = b.result === 'Victory';
  const dur = b.durationSeconds ?? 0, turns = b.turns ?? null;
  const { team: fielded, unresolved } = resolveFielded(acc.mapped, b.heroes);
  const allDied = (b.heroes ?? []).length > 0 && (b.heroes ?? []).every(h => h.survived === false);

  // EVALUATE — fielded-team watchdog (the signal that caught Apothecary/Bladerider).
  let wd = null;
  if (fielded.length >= 2) {
    try { wd = runWatchdog({ roster: acc.mapped, team: fielded, contentKey, usabilityTier: me.usabilityTier }); } catch {}
  }
  // EVALUATE — engine's own recommendation (cached per account+content; best-effort).
  const recBase = await recFor(b.accountId, acc.userChampions, contentKey);
  const rec = recBase ? { floor: recBase.floor, confidence: recBase.confidence, verdict: recBase.verdict,
    team_match: (b.heroes ?? []).filter(h => recBase.recNames.has(norm(h.name))).length } : null;

  const classification = !won ? (allDied ? 'loss_wipe' : 'loss')
    : (dur > 0 && dur > BUDGET_SEC) ? 'slow_win' : 'win';

  // DETECT — only signals worth a human's eye. Philosophy: a WIN that matched expectations
  // needs no review; surface LOSSES, model BLINDNESS, CALIBRATION divergence, and data gaps.
  const signals = [];
  for (const nm of unresolved) signals.push({ kind: 'unresolved_hero', subject: nm, detail: `capture name "${nm}" did not resolve to a DB champ (missing alias / not in roster snapshot)` });
  // Blindness (the Apothecary signal): a FIELDED champ the model scores ~0 — a likely tag/model
  // gap. High-value and rare; always surface. Keyed by champ+content so repeats aggregate.
  for (const s of (wd?.scores ?? []).filter(s => s.fielded && s.composite <= 0.02))
    signals.push({ kind: 'possible_blindness', subject: `${s.name} @ ${contentKey}`, detail: `${s.name} scored ~0 contribution (dmg=${s.damage} sus=${s.sustain} grant=${s.grant} ctrl=${s.control ?? 0}) but was fielded on ${contentKey} — model may be undervaluing its kit (tag gap?)` });
  // Clan Boss is chest-tier scored — a "Defeat" (team wipes) is the NORMAL end of a key, not a
  // failure, so win/loss-based signals are meaningless for CB (its real reconciliation is
  // damage-vs-chest, a separate TODO). Only non-CB content gets loss/calibration signals.
  const isCB = contentKey === 'clan_boss';
  // Mispick ONLY explains a LOSS — on a win the fielded team worked, so "a better bench option
  // exists" is player choice, not a model bug (this was the noise source). One line, top flag.
  if (!won && !isCB && wd?.flags?.length)
    signals.push({ kind: 'mispick_may_explain_loss', subject: contentKey, detail: wd.flags[0].detail });
  // Calibration divergence: model confidence vs actual outcome (non-CB only).
  if (!isCB && rec?.confidence != null) {
    if (rec.confidence >= 80 && !won) signals.push({ kind: 'confident_but_lost', subject: `${contentKey} ${b.stageNumber ?? ''}`.trim(), detail: `engine was ${rec.confidence}% confident but the run was a Defeat — calibration or missing-threat signal` });
    if (rec.confidence < 60 && won && !allDied) signals.push({ kind: 'unsure_but_won', subject: `${contentKey} ${b.stageNumber ?? ''}`.trim(), detail: `engine was only ${rec.confidence}% confident but the run WON cleanly — engine may be too conservative` });
  }

  reports.push({
    key: keyOf(b), when: b.capturedAt, account: b.displayName, content: b.stage,
    result: b.result, turns, duration: dur || null, classification,
    fielded: (b.heroes ?? []).map(h => `${h.name}${h.survived === false ? '†' : ''}`),
    rec, signals, needs_review: signals.length > 0,
  });
  seen.add(keyOf(b)); processed++;
}

// ── AGGREGATE signals into DISTINCT review items (not one row per capture) ────
// A useful queue is a short list of unique issues with occurrence counts + examples — not a
// log. Key by (kind + subject); repeats across identical teams collapse into one item.
const SEVERITY = { unresolved_hero: 0, possible_blindness: 1, confident_but_lost: 2, mispick_may_explain_loss: 3, unsure_but_won: 4 };
const items = new Map();
for (const r of reports) for (const s of r.signals) {
  const k = `${s.kind}::${s.subject}`;
  if (!items.has(k)) items.set(k, { kind: s.kind, subject: s.subject, detail: s.detail, count: 0, examples: [] });
  const it = items.get(k); it.count++;
  if (it.examples.length < 3) it.examples.push(`${r.content} ${r.when?.slice(0, 16)} (${r.classification})`);
}
const queue = [...items.values()].sort((a, b) => (SEVERITY[a.kind] ?? 9) - (SEVERITY[b.kind] ?? 9) || b.count - a.count);

const renderItem = (it, i) => `### ${i + 1}. [${it.kind}] ${it.subject}  ×${it.count}\n`
  + `- ${it.detail}\n`
  + `- seen in: ${it.examples.join('; ')}${it.count > it.examples.length ? ` … (+${it.count - it.examples.length} more)` : ''}\n`
  + `- status: **needs_review** — if this is a real gap, record it in insights-ledger.md, approve, then encode.\n`;

const summary = `# Pending Review — loop output (machine-drafted; NOT yet encoded)\n\n`
  + `Generated ${new Date().toISOString()} by tools/loop.mjs. Each item is a DISTINCT machine-detected\n`
  + `divergence between the model's evaluation and captured reality, aggregated across captures.\n`
  + `**A human reviews these; if an insight is real, record it in insights-ledger.md → approve → encode.**\n`
  + `The loop never auto-encodes — the machine proposes, you dispose.\n\n`
  + `**This run:** ${processed} capture(s) evaluated, ${skipped} skipped (unseeded/CB-note/empty), `
  + `**${queue.length} distinct items** need review.\n\n`
  + `Signal types: \`possible_blindness\` (a fielded champ scored ~0 — likely a tag/model gap) · `
  + `\`confident_but_lost\` / \`unsure_but_won\` (calibration) · \`mispick_may_explain_loss\` · `
  + `\`unresolved_hero\` (capture name → no DB champ). Clan Boss loss-signals suppressed (chest-scored).\n\n`
  + (queue.length ? queue.map(renderItem).join('\n') : '_No divergence signals — model and reality agree on all new captures._\n');

if (!DRY) {
  fs.mkdirSync(KNOW, { recursive: true });
  fs.writeFileSync(path.join(KNOW, 'pending-review.md'), summary);
  fs.writeFileSync(STATE_FILE, JSON.stringify({ processed: [...seen], updated_at: new Date().toISOString() }, null, 2));
}

console.log(`loop: ${processed} evaluated, ${queue.length} distinct review items, ${skipped} skipped${DRY ? ' (dry — nothing written)' : ''}`);
for (const it of queue) console.log(`  ⚑ [${it.kind}] ${it.subject} ×${it.count}`);
