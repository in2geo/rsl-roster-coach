// ── tools/reconcile-cb-runs.mjs ──────────────────────────────────────────────
// The Clan Boss feedback loop (the analogue of reconcile-runs on the 6-difficulty
// CHEST axis — reconcile-runs skips CB because CB is scored by damage, not floor).
//
// For every captured CB key: difficulty (from the stageId, via lib/clan-boss.js),
// TOTAL damage (captured total or Σ per-hero), and the top-chest threshold of that
// difficulty (clan_boss_chest_tiers) → the VERDICT (clanBossVerdict): which chest it
// earned and whether it one-keyed the TOP chest. Then per account: the TOP DIFFICULTY
// whose top chest the account can one-key (the deliverable). Read-only report.
//
// Usage: node tools/reconcile-cb-runs.mjs [--account <displayName>]
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { isClanBoss, classifyClanBoss, clanBossVerdict } from '../lib/clan-boss.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname, '..');
const env = {};
for (const l of fs.readFileSync(path.join(REPO, '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const BASE = (env.SUPABASE_URL || '').replace(/\/rest\/v1\/?$/, '');
const H = { apikey: env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}` };
const get = async (p) => { const r = await fetch(`${BASE}/rest/v1/${p}`, { headers: H }); if (!r.ok) throw new Error(`${r.status} ${await r.text()}`); return r.json(); };
const acctArg = (() => { const i = process.argv.indexOf('--account'); return i >= 0 ? process.argv[i + 1] : null; })();

const DIFF_ORDER = ['Easy', 'Normal', 'Hard', 'Brutal', 'Nightmare', 'Ultra Nightmare'];

// chest tiers grouped by CB difficulty label (via the CB dungeon_stages)
const cbDungeon = (await get(`dungeons?game_id=eq.raid_shadow_legends&name=eq.Clan%20Boss&select=id`))[0];
const stages = await get(`dungeon_stages?dungeon_id=eq.${cbDungeon.id}&select=id,label`);
const stageIdByLabel = Object.fromEntries(stages.map(s => [s.label, s.id]));
const tiersRows = await get(`clan_boss_chest_tiers?select=dungeon_stage_id,chest_name,sort_order,damage_min,damage_max`);
const tiersByStageId = {};
for (const t of tiersRows) (tiersByStageId[t.dungeon_stage_id] ??= []).push(t);
const tiersFor = (difficulty) => tiersByStageId[stageIdByLabel[difficulty]] ?? null;

const totalDamageOf = (b) => b.totalDamageDealt ?? ((b.heroes ?? []).reduce((s, h) => s + (Number(h.damage) || 0), 0) || null);
const fmtM = (n) => n == null ? '?' : (n / 1e6).toFixed(2) + 'M';

const log = JSON.parse(fs.readFileSync(path.join(REPO, 'gestal-sync/RslBattleReader/output/battle-log.json'), 'utf8'));
const cbRuns = (Array.isArray(log) ? log : []).filter(isClanBoss)
  .filter(b => !acctArg || b.displayName === acctArg);

// per account: verdict per run + the best one-keyed difficulty
const byAcct = {};
for (const b of cbRuns) {
  const cls = classifyClanBoss(b);
  const acc = (byAcct[b.displayName || b.accountId] ??= { runs: [], topOneKey: null });
  const tiers = cls.difficulty ? tiersFor(cls.difficulty) : null;
  const total = totalDamageOf(b);
  const verdict = tiers ? clanBossVerdict(tiers, total) : null;
  acc.runs.push({ at: b.capturedAt, difficulty: cls.difficulty, stageId: b.stageId, total, verdict });
  if (verdict?.earned_top && (acc.topOneKey == null || DIFF_ORDER.indexOf(cls.difficulty) > DIFF_ORDER.indexOf(acc.topOneKey)))
    acc.topOneKey = cls.difficulty;
}

for (const [name, a] of Object.entries(byAcct)) {
  console.log(`\n══ ${name} — ${a.runs.length} CB key(s) ══`);
  for (const r of a.runs) {
    if (!r.verdict) { console.log(`  ${r.difficulty ?? `stageId ${r.stageId} (tier UNCONFIRMED)`}: total ${fmtM(r.total)} — no verdict (${r.difficulty ? 'no tiers' : 'difficulty unmapped'})`); continue; }
    const v = r.verdict;
    const tag = v.earned_top ? `✅ TOP CHEST (${v.top_chest})` : `❌ ${v.earned_chest ?? 'below lowest'} — top is ${v.top_chest}, need +${fmtM(v.shortfall)}`;
    console.log(`  ${r.difficulty.padEnd(15)} total ${fmtM(v.damage).padStart(7)}  vs top ${fmtM(v.top_threshold).padStart(7)}  (${(v.margin * 100).toFixed(0)}%)  ${tag}`);
  }
  console.log(`  ▶ RECOMMENDATION: top difficulty one-keyed = ${a.topOneKey ?? '(none yet)'}` +
    (a.topOneKey && DIFF_ORDER.indexOf(a.topOneKey) < 5 ? `  — next target: ${DIFF_ORDER[DIFF_ORDER.indexOf(a.topOneKey) + 1]}` : ''));
}
if (!cbRuns.length) console.log('No Clan Boss captures found.');
