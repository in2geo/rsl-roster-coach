// tools/sim-clan-boss.mjs — run a Clan Boss (Demon Lord) key in the sim and report the CONFIRMED DoT damage
// banked into the boss -> the MINIMUM chest it clears. CB is a DAMAGE RACE, not a kill: the boss can't die,
// so the key is TRUNCATED after the Demon Lord's DEMON_LORD_WALL_TURNS-th activation (his OWN turns, NOT
// global actions — reviewer #1) or a team wipe.
//
// Reviewer #2/#10: the chest uses ONLY the confirmed DoT (poison/HP-burn absolute caps), which is exact
// UNDER the selected survival + turn-order assumptions. Direct-hit (boss DEF=0 upper bound) and mastery
// (excluded) are reported SEPARATELY and never folded into the chest. Read the FLAGS.
//
// Usage: node --env-file=.env.local tools/sim-clan-boss.mjs [fixture]
//   env: SIM_CB_SURVIVE=optimistic|none · SIM_CB_TURNCAP=<globalActionSafetyCap, default 600> · SIM_SEED=<n> · TRACE=1
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { makeState, simulate } from '../lib/sim/engine.js';
import { buildBattle, applyBattleLayers } from '../lib/sim/dragon-fixture.js';
import { installRecipeRun } from '../lib/sim/interpreter.js';
import { chestTierFor, CLAN_BOSS_TIER_STAGE_NUMBER } from '../lib/clan-boss.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname, '..');
const fmt = (n) => Math.round(Number(n) || 0).toLocaleString();

if (!process.env.SUPABASE_URL) { console.log('no DB — run with --env-file=.env.local'); process.exit(0); }
const BASE = process.env.SUPABASE_URL.replace(/\/rest\/v1\/?$/, '');
const H = { apikey: process.env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}` };
const _c = new Map();
const rest = async (p) => { if (!_c.has(p)) _c.set(p, await (await fetch(`${BASE}/rest/v1/${p}`, { headers: H })).json()); return _c.get(p); };

const fixturePath = process.argv[2] || 'test/fixtures/clan-boss-demon-lord.json';
const fixture = JSON.parse(fs.readFileSync(path.join(REPO, fixturePath), 'utf8'));
if (process.env.SIM_CB_DIFF) fixture.content.difficulty = process.env.SIM_CB_DIFF;   // override the fixture difficulty (same team, different tier)
const TURN_CAP = Number(process.env.SIM_CB_TURNCAP ?? 600);   // GLOBAL-action safety bound only; the real clock is the boss-turn wall (content.endBattle)
const SEEDS = Number(process.env.SIM_CB_SEEDS ?? (process.argv[3] || 1));
const diffWanted = fixture.content.difficulty || 'Hard';

// chest tiers for the difficulty (fetched once) — CONFIRMED DoT maps to the MINIMUM chest it clears
async function fetchTiers(diff) {
  try {
    const dun = (await rest('dungeons?select=id,name&game_id=eq.raid_shadow_legends')).find(d => d.name === 'Clan Boss');
    if (!dun) return [];
    const ds = (await rest(`dungeon_stages?select=id,stage_number&dungeon_id=eq.${dun.id}`)).find(s => Number(s.stage_number) === CLAN_BOSS_TIER_STAGE_NUMBER[diff]);
    return ds ? await rest(`clan_boss_chest_tiers?select=chest_name,damage_min,damage_max&dungeon_stage_id=eq.${ds.id}`) : [];
  } catch { return []; }
}
const tiers = await fetchTiers(diffWanted);

// one key = build fresh (allies/boss/content all mutate), layer auras, sim to the boss-turn wall
async function runOnce(seed) {
  const built = await buildBattle({ rest, fixture, repoRoot: REPO });
  if (built.skip) return { skip: built.skip };
  applyBattleLayers(built.allies, fixture.battle_layers);
  const st = makeState({ allies: built.allies, enemies: [], seed });
  installRecipeRun(st);
  const res = simulate(st, built.content, { turnCap: TURN_CAP, trace: process.env.TRACE === '1' });
  const led = st.cbLedger || { poisonExact: 0, hpBurnExact: 0 };
  const confirmedDoT = Math.round(led.poisonExact + led.hpBurnExact);
  const total = Math.round(st.cbDamageToBoss ?? 0);
  return {
    confirmedDoT, poison: Math.round(led.poisonExact), burn: Math.round(led.hpBurnExact),
    direct: Math.max(0, total - confirmedDoT), survivors: res.survivors.length,
    bossTurns: st.cbBossTurns ?? 0, truncated: !!res.phases?.some(p => p.outcome === 'truncated'),
    globalTurns: res.turns, flags: res.flags, boss: built.boss, diff: built.difficulty,
    teamNames: built.allies.map(a => a.name),
  };
}
const median = (a) => { const s = [...a].sort((x, y) => x - y); return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2; };
const chestOf = (dot) => chestTierFor(tiers, dot);

if (SEEDS <= 1) {
  const seed = process.env.SIM_SEED != null ? Number(process.env.SIM_SEED) : null;
  const r = await runOnce(seed);
  if (r.skip) { console.log('SKIP:', r.skip); process.exit(1); }
  const chest = chestOf(r.confirmedDoT);
  const ended = r.truncated ? `truncated after Demon Lord turn ${r.bossTurns}` : (r.survivors === 0 ? `WIPED at Demon Lord turn ${r.bossTurns}` : 'ended');
  console.log(`\n══ CLAN BOSS SIM — Demon Lord ${r.diff} (${r.boss?.affinity} key) ══`);
  console.log(`team: ${r.teamNames.join(', ')}`);
  console.log(`boss maxHP ${fmt(r.boss?.maxHp)} · SPD ${r.boss?.spd} · RES ${r.boss?.res}`);
  console.log(`ended: ${ended}  (${r.bossTurns} Demon Lord turns / ${r.globalTurns} global actions) · survivors ${r.survivors}/5`);
  console.log(`\nCONFIRMED DoT (exact UNDER the survival/turn assumptions): ${fmt(r.confirmedDoT)}  (poison ${fmt(r.poison)} + HP burn ${fmt(r.burn)})`);
  console.log(`  ->  MINIMUM chest (DoT only): ${chest ? chest.toUpperCase() : (tiers.length ? 'below lowest tier' : 'n/a')}`);
  console.log(`\nNOT in the chest figure: direct-hit (boss DEF=0, upper bound) ${fmt(r.direct)} · mastery EXCLUDED (per-proc cap unknown)`);
  if (r.flags?.length) { console.log('\n⚠ FLAGS:'); for (const f of r.flags) console.log('  • ' + f); }
  console.log('');
} else {
  const runs = [];
  for (let s = 1; s <= SEEDS; s++) { const r = await runOnce(s); if (r.skip) { console.log('SKIP:', r.skip); process.exit(1); } runs.push(r); if (s % 20 === 0) process.stderr.write(`  ${s}/${SEEDS}\r`); }
  const dot = runs.map(r => r.confirmedDoT);
  const b0 = runs[0].boss;
  const chestDist = {}; for (const r of runs) { const c = chestOf(r.confirmedDoT) || 'below lowest'; chestDist[c] = (chestDist[c] || 0) + 1; }
  const survDist = {}; for (const r of runs) survDist[r.survivors] = (survDist[r.survivors] || 0) + 1;
  const wiped = runs.filter(r => !r.truncated && r.survivors === 0).length;
  console.log(`\n══ CLAN BOSS SIM — Demon Lord ${diffWanted} (${b0?.affinity} key) — ${SEEDS} seeds ══`);
  console.log(`team: ${runs[0].teamNames.join(', ')}`);
  console.log(`boss maxHP ${fmt(b0?.maxHp)} · SPD ${b0?.spd} · RES ${b0?.res} · wall = Demon Lord turn 50`);
  console.log(`\nCONFIRMED DoT (poison+HP-burn caps; exact under the survival/turn assumptions):`);
  console.log(`  median ${fmt(median(dot))} · mean ${fmt(dot.reduce((a, x) => a + x, 0) / dot.length)} · min ${fmt(Math.min(...dot))} · max ${fmt(Math.max(...dot))}`);
  console.log(`  median split: poison ${fmt(median(runs.map(r => r.poison)))} + HP burn ${fmt(median(runs.map(r => r.burn)))}`);
  console.log(`\nMINIMUM chest from confirmed DoT (distribution over ${SEEDS} seeds):`);
  for (const [c, n] of Object.entries(chestDist).sort((a, b) => b[1] - a[1])) console.log(`  ${String(c).toUpperCase().padEnd(14)} ${n}  (${Math.round(100 * n / SEEDS)}%)`);
  console.log(`\nsurvivors to the wall: ${Object.entries(survDist).sort((a, b) => b[0] - a[0]).map(([k, v]) => `${k}/5×${v}`).join('  ')}${wiped ? `  · WIPED before wall: ${wiped}` : ''}`);
  console.log(`direct-hit (uncalibrated, DEF=0 upper bound) median: ${fmt(median(runs.map(r => r.direct)))} · mastery EXCLUDED`);
  if (runs[0].flags?.length) { console.log('\n⚠ FLAGS (same every seed): ' + runs[0].flags.length + ' — run 1 seed for the full list'); }
  console.log('');
}
