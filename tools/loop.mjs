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
const { deriveNeeds, constructTeam, potentialBuilds } = await import('../lib/team-constructor.js');

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
// ALIASES ARE REQUIRED (2026-07-19) — omitting them silently drops champions whose Gestal display
// name differs from champions.name (e.g. "Thor Faehammer" -> "Thor"). See gestal-context.js.
// Paged via the shared helper: a plain select is capped at 1000 rows.
const aliasRows = await gc.fetchAliasRows(rest);
const aliasToId = new Map((Array.isArray(aliasRows) ? aliasRows : []).map(a => [norm(a.alias), a.champion_id]));
// tag metadata (ACC-gating) for the phase-aware constructor's reliability weighting.
const tagRows = await rest('tags?select=name,is_debuff,bypasses_accuracy_check');
const tagMeta = Object.fromEntries((Array.isArray(tagRows) ? tagRows : []).map(t => [t.name, { is_debuff: t.is_debuff, bypasses_accuracy_check: t.bypasses_accuracy_check }]));
const evalFloor = (formula, stage) => { try { return Function('"use strict";return (' + String(formula).replace(/stage/gi, stage) + ')')(); } catch { return null; } };

// Phase-aware NEEDS per (dungeon, stage) — cached (depends only on content, not the battle).
const needsCache = {};
async function needsFor(dungeonName, stageNumber) {
  const k = `${dungeonName}|${stageNumber}`;
  if (k in needsCache) return needsCache[k];
  let result = null;
  try {
    const dun = await rest(`dungeons?select=id&game_id=eq.raid_shadow_legends&name=eq.${encodeURIComponent(dungeonName)}`);
    const stages = await rest(`dungeon_stages?select=id,label,stage_number&dungeon_id=eq.${dun[0].id}`);
    let st = stages.find(s => s.stage_number === stageNumber)
      ?? stages.find(s => { const m = (s.label || '').match(/Stages?\s+(\d+)\s*-\s*(\d+)/i); return m && stageNumber >= +m[1] && stageNumber <= +m[2]; })
      ?? stages.find(s => { const m = (s.label || '').match(/Stage\s+(\d+)/i); return m && +m[1] === stageNumber; });
    if (st) {
      const ph = await rest(`phases?select=id,phase_type&dungeon_stage_id=eq.${st.id}`);
      const phaseGoals = []; let accFloor = null;
      for (const p of ph) {
        phaseGoals.push({ phase_type: p.phase_type, goals: await rest(`goals?select=description,is_informational,goal_solutions(status,goal_solution_tags(tags(name)))&phase_id=eq.${p.id}`) });
        for (const t of (await rest(`stat_threshold_checks?select=formula&phase_id=eq.${p.id}&stat=eq.acc`) || [])) { const f = evalFloor(t.formula, stageNumber); if (f != null) accFloor = Math.max(accFloor ?? 0, f); }
      }
      const needs = deriveNeeds(phaseGoals);
      if (needs.length) result = { needs, accFloor };
    }
  } catch {}
  return (needsCache[k] = result);
}

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
      verdict: r.verdict ?? null, recNames: new Set((r.team ?? []).map(c => norm(c.name))),
      recTeam: (r.team ?? []).map(c => c.name) };
  } catch {}
  return (recCache[k] = rec);
}

const mappedCache = {};
async function mappedRosterFor(accountId) {
  if (mappedCache[accountId]) return mappedCache[accountId];
  const j = rosters[accountId]; if (!j) return null;
  const { userChampions } = gc.buildUserChampions(j.champions, dbChampions, aliasRows);
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
const measure = []; // per-capture model-prediction-vs-reality records (accumulated over ALL captures)
// Model picking errors vs WINNING teams (INS-0012): the winning fielded team = expert ground truth.
// false-bench = a champ the winner FIELDED that the model BENCHED (undervalued); false-field = a champ
// the model would FIELD that the winner BENCHED (overvalued). Aggregated per model per champ.
const diffs = { coverage: { bench: {}, field: {} }, constructor: { bench: {}, field: {} } };
const diffAdd = (m, k, champ) => { diffs[m][k][champ] = (diffs[m][k][champ] ?? 0) + 1; };
let processed = 0, skipped = 0;

for (const b of (Array.isArray(log) ? log : [])) {
  const contentKey = CONTENT_KEY[b.dungeon];
  if (!contentKey) { skipped++; continue; }
  if (!(b.heroes ?? []).length) { skipped++; continue; } // nothing to evaluate (old/empty capture)
  const acc = await mappedRosterFor(b.accountId);
  if (!acc) { skipped++; continue; }
  const isNew = ALL || !seen.has(keyOf(b)); // MEASUREMENT runs on ALL captures; review-detection only on NEW

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

  // EVALUATE — phase-aware constructor's "build next" answer (dungeons only, needs a stage number).
  let topBuild = null, constructorTeam = null;
  const needsInfo = (contentKey !== 'clan_boss' && b.stageNumber != null) ? await needsFor(b.dungeon, b.stageNumber) : null;
  if (needsInfo) {
    try {
      const eligible = (c) => me.usabilityTier(c) >= 2;
      const built = constructTeam(acc.mapped, needsInfo.needs, { contentKey, eligible, tagMeta, accFloor: needsInfo.accFloor });
      constructorTeam = built.team;
      topBuild = potentialBuilds(acc.mapped, needsInfo.needs, built.team, { isBuilt: eligible, contentKey, tagMeta, accFloor: needsInfo.accFloor })[0] ?? null;
    } catch {}
  }

  const classification = !won ? (allDied ? 'loss_wipe' : 'loss')
    : (dur > 0 && dur > BUDGET_SEC) ? 'slow_win' : 'win';

  // ── MEASUREMENT — each model's PREDICTION vs REALITY, over ALL captures (self-populating
  //    scoreboard). This is the evidence that either promotes the models to "trusted" or shows
  //    exactly where they're wrong — the Layer 3 gate instrument. ────────────────────────────
  const isCB = contentKey === 'clan_boss';
  const constrOverlap = constructorTeam ? constructorTeam.filter(c => fielded.some(f => f.name === c.name)).length : null;
  measure.push({ account: b.displayName ?? b.accountId, content: contentKey, stage: b.stageNumber ?? null, floor: rec?.floor ?? null, isCB, won, classification,
    cov_conf: rec?.confidence ?? null, cov_match: rec?.team_match ?? null, constr_overlap: constrOverlap });

  // Diff each model's recommendation vs the WINNING fielded team (winning non-CB runs only).
  if (won && !isCB) {
    const fieldedNames = new Set(fielded.map(c => norm(c.name)));
    for (const [model, teamNames] of [['coverage', recBase?.recTeam], ['constructor', constructorTeam?.map(c => c.name)]]) {
      if (!teamNames || !teamNames.length) continue;
      const teamSet = new Set(teamNames.map(norm));
      for (const c of fielded) if (!teamSet.has(norm(c.name))) diffAdd(model, 'bench', c.name);      // winner fielded, model benched
      for (const nm of teamNames) if (!fieldedNames.has(norm(nm))) diffAdd(model, 'field', nm);       // model fielded, winner benched
    }
  }

  // Review-detection + queue only for NEW captures (measurement already accumulated above).
  if (!isNew) { seen.add(keyOf(b)); continue; }

  // DETECT — only signals worth a human's eye. Philosophy: a WIN that matched expectations
  // needs no review; surface LOSSES, model BLINDNESS, CALIBRATION divergence, and data gaps.
  const signals = [];
  for (const nm of unresolved) signals.push({ kind: 'unresolved_hero', subject: nm, detail: `capture name "${nm}" did not resolve to a DB champ (missing alias / not in roster snapshot)` });
  // Blindness (the Apothecary signal): a FIELDED champ the model scores ~0 — a likely tag/model
  // gap. High-value and rare; always surface. Keyed by champ+content so repeats aggregate.
  for (const s of (wd?.scores ?? []).filter(s => s.fielded && s.composite <= 0.02))
    signals.push({ kind: 'possible_blindness', subject: `${s.name} @ ${contentKey}`, detail: `${s.name} scored ~0 contribution (dmg=${s.damage} sus=${s.sustain} grant=${s.grant} ctrl=${s.control ?? 0}) but was fielded on ${contentKey} — model may be undervaluing its kit (tag gap?)` });
  // Clan Boss is chest-tier scored — a "Defeat" (team wipes) is the NORMAL end of a key, not a
  // failure, so win/loss-based signals are meaningless for CB (isCB computed above).
  // Mispick ONLY explains a LOSS — on a win the fielded team worked, so "a better bench option
  // exists" is player choice, not a model bug (this was the noise source). One line, top flag.
  if (!won && !isCB && wd?.flags?.length)
    signals.push({ kind: 'mispick_may_explain_loss', subject: contentKey, detail: wd.flags[0].detail });
  // Calibration divergence: model confidence vs actual outcome (non-CB only).
  if (!isCB && rec?.confidence != null) {
    if (rec.confidence >= 80 && !won) signals.push({ kind: 'confident_but_lost', subject: `${contentKey} ${b.stageNumber ?? ''}`.trim(), detail: `engine was ${rec.confidence}% confident but the run was a Defeat — calibration or missing-threat signal` });
    if (rec.confidence < 60 && won && !allDied) signals.push({ kind: 'unsure_but_won', subject: `${contentKey} ${b.stageNumber ?? ''}`.trim(), detail: `engine was only ${rec.confidence}% confident but the run WON cleanly — engine may be too conservative` });
  }
  // The phase-aware constructor's "BUILD NEXT" answer (INS-0007 potential layer) — surfaced from a
  // REAL capture. Show it when it fills an UNCOVERED need or the run was a loss (e.g. "build Criodan
  // for your Dragon-20 wave gap"). Aggregates per (champ, content) across captures.
  if (topBuild && (!won || topBuild.fills.some(f => f.kind === 'uncovered'))) {
    const f = topBuild.fills[0];
    signals.push({ kind: 'potential_build', subject: `${topBuild.name} @ ${contentKey}`,
      detail: `BUILD ${topBuild.name} — fills ${topBuild.fills.map(x => `[${x.phase}] ${x.description.slice(0, 42)}`).join('; ')}`
        + ` (${f.kind}${f.kind === 'upgrade' ? `: str ${f.strength} vs built ${f.builtBest}` : ''})` });
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
const SEVERITY = { potential_build: 0, unresolved_hero: 1, possible_blindness: 2, confident_but_lost: 3, mispick_may_explain_loss: 4, unsure_but_won: 5 };
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

// ── MODEL ACCURACY — the self-populating evidence scoreboard (over ALL captures) ─────────────
const nonCB = measure.filter(m => !m.isCB), cb = measure.filter(m => m.isCB);
const dungeons = new Set(nonCB.map(m => m.content));
const wins = nonCB.filter(m => m.won), losses = nonCB.filter(m => !m.won);
const avg = (arr, f) => { const v = arr.map(f).filter(x => x != null); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
const f2 = (x) => x == null ? 'n/a' : (Math.round(x * 100) / 100).toFixed(2);
const topN = (obj, n = 6) => { const e = Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, n); return e.length ? e.map(([c, k]) => `${c} ×${k}`).join(', ') : '—'; };
const calRows = [[0, 60], [60, 80], [80, 95], [95, 101]].map(([lo, hi]) => {
  const inB = nonCB.filter(m => m.cov_conf != null && m.cov_conf >= lo && m.cov_conf < hi);
  const w = inB.filter(m => m.won).length;
  return `| ${lo}–${hi === 101 ? 100 : hi - 1}% | ${inB.length} | ${inB.length ? Math.round(w / inB.length * 100) + '%' : 'n/a'} |`;
}).join('\n');
const gateMet = nonCB.length >= 20 && dungeons.size >= 2;
const accounts = [...new Set(measure.map(m => m.account))];
const perAcct = accounts.map(a => {
  const ms = nonCB.filter(m => m.account === a);
  const w = ms.filter(m => m.won).length;
  return `| ${a} | ${ms.length} | ${ms.length ? Math.round(w / ms.length * 100) + '%' : 'n/a'} | ${new Set(ms.map(m => m.content)).size} | ${f2(avg(ms.filter(m => m.won), m => m.cov_match))} |`;
}).join('\n');
const accuracy = `# Model Accuracy — self-populating (generated by tools/loop.mjs)\n\n`
  + `Generated ${new Date().toISOString()} over ALL ${measure.length} evaluable captures (${nonCB.length} non-CB, ${cb.length} CB).\n`
  + `The EVIDENCE spine: measures each model's prediction vs captured reality, so the shadow models can\n`
  + `eventually be PROMOTED to "trusted" or refuted. Recomputed from scratch each run (no state drift).\n\n`
  + `## Layer 3 gate progress\n`
  + `**${nonCB.length}** non-CB reconciled runs across **${dungeons.size}** dungeon(s) (${[...dungeons].join(', ') || 'none'}) `
  + `and **${accounts.length}** account(s). Gate = ≥20 runs / ≥2 dungeons → **${gateMet ? 'MET' : 'NOT MET'}**.\n`
  + `(Only the 5 modelled dungeons count here — Keeps / Minotaur / Event captures exist but aren't scanned yet.)\n\n`
  + `## Coverage across accounts (generalization test)\n`
  + `Different accounts = different rosters/maturity → where "does it generalize?" is actually tested.\n\n`
  + `| account | non-CB runs | win rate | dungeons | coverage agreement on wins (/5) |\n|---|---|---|---|---|\n${perAcct}\n\n`
  + `## Coverage-engine confidence calibration\n`
  + `Is the engine's confidence honest? Ideal: higher predicted confidence → higher actual win rate.\n\n`
  + `| predicted confidence | runs | actual win rate |\n|---|---|---|\n${calRows}\n\n`
  + `## Model agreement with outcomes\n`
  + `How many of each model's recommended 5 the player actually FIELDED, split by win/loss. A model that\n`
  + `agrees with WINNING teams more than LOSING ones is tracking what works.\n\n`
  + `| model | avg on WINS (/5) | avg on LOSSES (/5) |\n|---|---|---|\n`
  + `| coverage rec | ${f2(avg(wins, m => m.cov_match))} | ${f2(avg(losses, m => m.cov_match))} |\n`
  + `| constructor  | ${f2(avg(wins, m => m.constr_overlap))} | ${f2(avg(losses, m => m.constr_overlap))} |\n\n`
  + `## Model picking errors — vs your WINNING teams (${wins.length} winning non-CB runs) [INS-0012]\n`
  + `The winning fielded team is EXPERT GROUND TRUTH. **false-BENCH** = a champ you WON with that the model\n`
  + `benched (undervalued it); **false-FIELD** = a champ the model would field that you benched (overvalued it).\n`
  + `These are the model's SYSTEMATIC picking errors, from existing captures — the debugger for team selection.\n\n`
  + `**Coverage engine**\n- benched your winners (undervalued): ${topN(diffs.coverage.bench)}\n- over-fielded (overvalued): ${topN(diffs.coverage.field)}\n\n`
  + `**Constructor**\n- benched your winners (undervalued): ${topN(diffs.constructor.bench)}\n- over-fielded (overvalued): ${topN(diffs.constructor.field)}\n\n`
  + `_The most-benched winners are the model's biggest undervaluation bugs (e.g. the Brogni bench). Fix those,\n`
  + `re-run, watch the counts drop + agreement rise. Then on-spec runs confirm the fixed picks actually win._\n`;

// ── CALIBRATION PROPOSALS — measured mis-calibration → PROPOSED adjustments (REPORT-ONLY). Guardrails
//    from calibrate-engine.mjs: ON-SPEC runs only (fielded ≥3 of the recommended 5 AND attempted the
//    recommended stage), ≥CAL_MIN per band, and STRUCTURAL-FIRST — a band clearing FAR ABOVE its displayed
//    confidence is a coverage/tag bug to FIX in logic, not a number to calibrate. Never auto-applies. ──
const CAL_MIN = 20;
const onSpec = nonCB.filter(m => m.cov_conf != null && (m.cov_match ?? 0) >= 3 && m.stage != null && m.floor != null && m.stage === m.floor);
const calProps = [];
for (const [lo, hi, mid] of [[95, 101, 97], [80, 95, 87], [60, 80, 70], [0, 60, 40]]) {
  const ms = onSpec.filter(m => m.cov_conf >= lo && m.cov_conf < hi);
  const band = `${lo}-${hi === 101 ? 100 : hi - 1}%`;
  if (ms.length < CAL_MIN) { calProps.push({ band, n: ms.length, hold: true }); continue; }
  const rate = ms.filter(m => m.won).length / ms.length * 100, gap = rate - mid;
  const v = gap > 15 ? { kind: 'STRUCTURAL — do NOT calibrate', note: `on-spec clears ${rate.toFixed(0)}% but displays ~${mid}% — clearing far ABOVE its band is a coverage/tag bug (goals falsely unmet). Fix structure first.` }
    : gap < -10 ? { kind: 'OVER-CONFIDENT — propose lowering', note: `on-spec win rate ${rate.toFixed(0)}% vs displayed ~${mid}% — PROPOSE mapping this band toward ~${Math.round(rate)}%.` }
    : { kind: 'well-calibrated', note: `on-spec ${rate.toFixed(0)}% ≈ displayed ~${mid}% — no change.` };
  calProps.push({ band, n: ms.length, rate, ...v });
}
const actionable = calProps.filter(p => p.kind && p.kind.startsWith('OVER'));
const calibration = `# Calibration Proposals — machine-drafted, REPORT-ONLY (never auto-applied)\n\n`
  + `Generated ${new Date().toISOString()}. Measured mis-calibration → PROPOSED confidence changes, on ON-SPEC\n`
  + `runs only (fielded ≥3 of the recommended 5 AND attempted the recommended stage — **${onSpec.length}** of ${nonCB.length}\n`
  + `non-CB runs qualify). Guardrails: ≥${CAL_MIN} runs/band; STRUCTURAL-FIRST (a band clearing far ABOVE its\n`
  + `confidence is a coverage bug to FIX, not calibrate). Legacy calibrate-engine.mjs reads a stale table — this\n`
  + `is the live path off the 3-account capture data.\n\n`
  + `| displayed band | on-spec runs | actual win rate | verdict |\n|---|---|---|---|\n`
  + calProps.map(p => `| ${p.band} | ${p.n} | ${p.rate != null ? p.rate.toFixed(0) + '%' : '—'} | ${p.hold ? `hold (need ${CAL_MIN})` : p.kind} |`).join('\n') + '\n\n'
  + (actionable.length ? `## Proposed (needs human approval before encoding)\n${actionable.map(p => `- **${p.band}:** ${p.note}`).join('\n')}\n`
     : `_No actionable proposal yet — not enough on-spec runs per band, or the mis-calibration is STRUCTURAL (fix logic first, per the table)._\n`);

if (!DRY) {
  fs.mkdirSync(KNOW, { recursive: true });
  fs.writeFileSync(path.join(KNOW, 'pending-review.md'), summary);
  fs.writeFileSync(path.join(KNOW, 'model-accuracy.md'), accuracy);
  fs.writeFileSync(path.join(KNOW, 'calibration-proposals.md'), calibration);
  fs.writeFileSync(STATE_FILE, JSON.stringify({ processed: [...seen], updated_at: new Date().toISOString() }, null, 2));
}

console.log(`loop: ${measure.length} measured (${processed} new reviewed), ${queue.length} review items, ${skipped} skipped${DRY ? ' (dry)' : ''}`);
console.log(`gate: ${nonCB.length}/20 non-CB runs, ${dungeons.size}/2 dungeons → ${gateMet ? 'MET' : 'not met'}`);
for (const it of queue) console.log(`  ⚑ [${it.kind}] ${it.subject} ×${it.count}`);
