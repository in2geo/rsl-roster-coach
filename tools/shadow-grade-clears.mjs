// tools/shadow-grade-clears.mjs — THE PRIMARY MODEL TEST. Shadow, read-only.
//
// THE QUESTION: given teams the player ACTUALLY FIELDED, does the model rate the ones that CLEARED
// above the ones that WIPED? That is the product question ("will this team clear?"), and it is
// calibration-free — no damage model, no stat floors, no difficulty axis needed.
//
// WHY THIS AND NOT THE SPEED TESTS (shadow-grade.mjs / shadow-grade-dragon.mjs):
// those rank teams by how FAST they clear, and Mike caught that this is the wrong question —
// "are we trying to get the fastest farming team?" CLAUDE.md judges dungeons on clearing WITHIN a
// time budget (~5 min), and every captured Dragon 20 team clears in 184-235s. So the speed tests
// rank teams on a difference the product does not care about, return ~coin-flip, and get read as the
// model failing. They are kept for reference; THIS is the one to trust.
//
// TWO EXCLUSIONS THAT MATTER:
//  1. Pairs where the SAME TEAM both won and lost. Mike: "the floors with wins and losses are the
//     edge of where the team can win. it's not a guaranteed win." Those stages are the account's
//     FRONTIER (TicoTholin Dragon 11: identical five, 3W/5L) — the most valuable data in the log,
//     but the model cannot distinguish a team from itself and must not be scored as if it could.
//  2. Groups without both a win and a loss — nothing to compare.
//
// BASELINE TO BEAT (2026-07-18, Dragon rubric): 14/15 distinct-team pairs = 93%.
// On DonBrogni Dragon 20 the seven clears scored 104.3-105.6 and the two wipes 89.2/89.7 — a
// 15-point gap with nothing in between, both failures flagged without seeing the result.
//
// Run: node --env-file=.env.local tools/shadow-grade-clears.mjs [content]
//      content: dragon (default) | cb

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildUserChampions, fetchAliasRows } from '../lib/gestal-context.js';
import { mapRoster } from '../lib/match-engine.js';
import { scoreTeam, scoreBestStrategy, ALLOCATION, BUCKETS, DEAD_ON_CB } from './bucket-score.mjs';
import { DRAGON_ALLOCATION, DRAGON_BUCKETS, DEAD_ON_DRAGON } from '../lib/dragon-rubric.js';
import { IG_STRATEGIES } from '../lib/ice-golem-rubric.js';
import { FK_STRATEGIES } from '../lib/fire-knight-rubric.js';
import { spiderStrategiesForStage } from '../lib/spider-rubric.js';

// Multi-strategy content passes `strategies`; single-allocation content passes `cfg`. Both go through
// the same harness — scoreBestStrategy over a one-element list reduces exactly to scoreTeam, which is
// the regression guarantee that Dragon/CB baselines cannot move.
const CONTENT = (process.argv[2] || 'dragon').toLowerCase();
const CFG = {
  dragon:      { dungeon: "Dragon's Lair",         cfg: { allocation: DRAGON_ALLOCATION, buckets: DRAGON_BUCKETS, dead: DEAD_ON_DRAGON, accFloor: 130 } },
  cb:          { dungeon: 'Clan Boss',             cfg: { allocation: ALLOCATION,        buckets: BUCKETS,        dead: DEAD_ON_CB,     accFloor: 150 } },
  ice_golem:   { dungeon: "Ice Golem's Peak",      strategies: IG_STRATEGIES },
  fire_knight: { dungeon: "Fire Knight's Castle",  strategies: FK_STRATEGIES },
  // Spider is STAGE-GATED: the stage decides which strategies are viable, then the model picks the
  // best fit among them. `strategiesFor` is consulted per capture rather than a fixed list.
  spider:      { dungeon: "Spider's Den",          strategiesFor: spiderStrategiesForStage },
}[CONTENT];
if (!CFG) { console.error(`Unknown content "${CONTENT}". Use: dragon | cb | ice_golem | fire_knight`); process.exit(1); }

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname, '..');
const BASE = (process.env.SUPABASE_URL || '').replace(/\/rest\/v1\/?$/, '');
const H = { apikey: process.env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}` };
const rest = async p => (await fetch(`${BASE}/rest/v1/${p}`, { headers: H })).json();
// ALIASES ARE REQUIRED (2026-07-19) — omitting them silently drops champions whose Gestal
// display name differs from champions.name (e.g. "Thor Faehammer" -> "Thor"). See gestal-context.js.
const aliasRows = await fetchAliasRows(rest);
const SEL = 'id,name,type_id,rarity,role,affinity,faction,base_hp,base_atk,base_def,base_spd,base_acc,base_res,base_crit_rate,base_crit_dmg,champion_tags(tag_id,status,tags(name,is_debuff,bypasses_accuracy_check))';
let db = [];
for (let f = 0; ; f += 1000) { const d = await rest(`champions?select=${encodeURIComponent(SEL)}&game_id=eq.raid_shadow_legends&limit=1000&offset=${f}`); if (!Array.isArray(d) || !d.length) break; db = db.concat(d); if (d.length < 1000) break; }
let sk = [];
for (let f = 0; ; f += 1000) { const d = await rest(`champion_skills?select=slot,skill_summary,cooldown_base,cooldown_booked,champions(name)&limit=1000&offset=${f}`); if (!Array.isArray(d) || !d.length) break; sk = sk.concat(d); if (d.length < 1000) break; }
const skillsByName = {};
for (const r of sk) { const n = r.champions?.name; if (n) (skillsByName[n] ??= []).push(r); }
const tagRows = await rest('tags?select=name,is_debuff,bypasses_accuracy_check');
const tagMeta = Object.fromEntries((tagRows || []).map(t => [t.name, { is_debuff: t.is_debuff, bypasses_accuracy_check: t.bypasses_accuracy_check }]));

/* ── BOSS AFFINITY (2026-07-20) ───────────────────────────────────────────────────────────────
 * The TEST OF RECORD was blind to affinity even after the term landed in the scorer, so a
 * before/after on this harness was not measuring the change at all. Keyed by stage_number: the
 * affinity belongs to the STAGE being graded, not to the account or the strategy.
 * `--no-affinity` is the A/B control — same battles, same rubric, one term varied. */
const NO_AFFINITY = process.argv.includes('--no-affinity');
const affinityByStage = {};
if (!NO_AFFINITY) {
  const dRow = (await rest(`dungeons?select=id&name=eq.${encodeURIComponent(CFG.dungeon)}&game_id=eq.raid_shadow_legends`))?.[0];
  if (dRow)
    for (const r of await rest(`dungeon_stage_affinities?select=stage_number,affinity&dungeon_id=eq.${dRow.id}&limit=100`))
      affinityByStage[r.stage_number] = r.affinity;
}

const rosters = {};
for (const f of fs.readdirSync(path.join(REPO, 'gestal-sync/output')).filter(x => x.endsWith('.json') && !/^gear-corpus/.test(x))) {
  const s = JSON.parse(fs.readFileSync(path.join(REPO, 'gestal-sync/output', f), 'utf8'));
  if (!s.accountId) continue;
  const { userChampions } = buildUserChampions(s.champions ?? [], db, aliasRows);
  rosters[s.accountId] = Object.fromEntries(mapRoster(userChampions, {}).mapped.map(c => [c.name, c]));
}

const log = JSON.parse(fs.readFileSync(path.join(REPO, 'gestal-sync/RslBattleReader/output/battle-log.json'), 'utf8'));
const arr = Array.isArray(log) ? log : (log.battles ?? log.entries ?? []);
const groups = {};
for (const b of arr) {
  if (b.dungeon !== CFG.dungeon || (b.heroes ?? []).length !== 5) continue;
  (groups[`${b.displayName} · stage ${b.stageNumber}`] ??= []).push(b);
}

console.log(`══ CLEAR-vs-WIPE — does the model rate winning teams above losing ones? (${CFG.dungeon}) ══\n`);
let ok = 0, tot = 0, excl = 0;
for (const [key, rs] of Object.entries(groups)) {
  const roster = rosters[rs[0].accountId]; if (!roster) continue;
  const teamKey = r => r.heroes.map(h => h.name).sort().join(', ');
  const score = r => {
    const t = r.heroes.map(h => roster[h.name]).filter(Boolean);
    if (t.length < 5) return null;
    const strategies = CFG.strategiesFor ? CFG.strategiesFor(r.stageNumber) : CFG.strategies;
    // Clan Boss stays null by design — its affinity rotates DAILY and is not captured (battle-gaps).
    const bossAffinity = affinityByStage[r.stageNumber] ?? null;
    if (strategies) {
      if (!strategies.length) return null;          // no strategy viable at this stage
      return scoreBestStrategy(t, tagMeta, skillsByName, strategies, { bossAffinity }).grade;
    }
    return scoreTeam(t, tagMeta, skillsByName, { ...CFG.cfg, bossAffinity }).grade;
  };
  const W = new Map(), L = new Map();
  for (const r of rs) { const g = score(r); if (g == null) continue; (r.result === 'Victory' ? W : L).set(teamKey(r), g); }
  if (!W.size || !L.size) continue;
  console.log(`── ${key}`);
  for (const [n, g] of [...W].sort((a, b) => b[1] - a[1])) console.log(`   CLEAR  ${g.toFixed(1)}   ${n}`);
  for (const [n, g] of [...L].sort((a, b) => b[1] - a[1])) console.log(`   WIPE   ${g.toFixed(1)}   ${n}`);
  let a = 0, t = 0;
  for (const [wn, wg] of W) for (const [ln, lg] of L) {
    if (wn === ln) { excl++; continue; }        // same team won AND lost — the frontier, unrankable
    t++; if (wg > lg) a++;
  }
  ok += a; tot += t;
  console.log(`   → ${a}/${t}\n`);
}
console.log(`══ OVERALL: ${ok}/${tot}` + (tot ? ` (${((ok / tot) * 100).toFixed(0)}%)` : '') +
  `  ·  ${excl} pair(s) excluded where the SAME team both won and lost (the frontier — run variance, not a model error)`);
