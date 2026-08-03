// tools/sim-montecarlo.mjs — QA PROTOCOL RUNG 7: the STOCHASTIC reality check.
//
// WHY THIS EXISTS. Raid is a probabilistic game: debuffs land on an ACC-vs-RES roll, crits roll,
// procs roll. A single deterministic pass of the engine can only show ONE point of a distribution —
// it literally cannot reproduce a fight that "nearly wiped this run because Ezio's veil proc'd less."
// Mike watched exactly that: the real Dragon-16 team WINS, but nearly wipes on wave 2, and the win/
// loss margin swings on a proc. So the honest comparison to reality is not "did the one sim run win"
// but "what FRACTION of runs win, and what's the TURN distribution" — because that is what reality is.
//
// This runs the SAME fixture the golden rung runs (test/golden/*.json + data/observed-builds/*), but
// N times with a fresh seed each (engine gains a seeded mulberry32 rng => real land/crit rolls). It
// reports WIN-RATE, a turn distribution (p10/median/p90), and PER-CHAMPION death rate + median death
// turn — then holds them against the golden's recorded reality anchors.
//
// Run: node --env-file=.env.local tools/sim-montecarlo.mjs [fixtureId] [N]     (default N=100)
//   SIM_MASTERY=off|offense   bracket for the UNCAPTURED boss masteries (Warmaster/Giant Slayer):
//                             'off' (default, lower bound) vs 'offense' (all damage-dealers carry it).
//   Masteries are confirmed present in the real team but not in the captured build — so it is a
//   BRACKET, reported as a bound, never a fitted constant (same posture as SIM_SCORCH in dragon.js).

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { makeCombatant, makeState, simulate, actEnemyMob } from '../lib/sim/engine.js';
import { readSkillKit, gearLifesteal } from '../lib/sim/ai.js';
import { makeDragonContent, HELLRAZOR_IMMUNE } from '../lib/sim/dragon.js';
import { loadNameResolverRest } from '../lib/champion-names.js';
// Non-Dragon content (Spider) is built through the shared dispatcher — the SAME build+run path as
// sim-per-hero-bands (buildBattle → makeSpiderContent, recipe interpreter), so montecarlo's Spider
// death-rates are consistent with the per-hero-bands gate. Dragon keeps its own path below, unchanged.
import { buildBattle, applyBattleLayers } from '../lib/sim/dragon-fixture.js';
import { installRecipeRun } from '../lib/sim/interpreter.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname, '..');
const DIR = path.join(REPO, 'test', 'golden');

const argFixture = process.argv[2] && !/^\d+$/.test(process.argv[2]) ? process.argv[2] : null;
const N = Number(process.argv.find((a, i) => i >= 2 && /^\d+$/.test(a)) ?? 100);
const MASTERY = (process.env.SIM_MASTERY ?? 'off').toLowerCase();   // 'off' | 'offense'

if (!process.env.SUPABASE_URL) {
  console.log('sim-montecarlo needs the DB (champion kits + boss + waves). Run with --env-file=.env.local');
  process.exit(2);
}

const BASE = process.env.SUPABASE_URL.replace(/\/rest\/v1\/?$/, '');
const H = { apikey: process.env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}` };
const _restCache = new Map();   // buildBattle re-fetches per seed; cache so a Spider run doesn't make N× the REST calls
const rest = async p => { if (!_restCache.has(p)) _restCache.set(p, await (await fetch(`${BASE}/rest/v1/${p}`, { headers: H })).json()); return _restCache.get(p); };

// ── load the fixture ──────────────────────────────────────────────────────────
const files = fs.existsSync(DIR) ? fs.readdirSync(DIR).filter(f => f.endsWith('.json')) : [];
let fixtureFile = argFixture
  ? files.find(f => f === argFixture || JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')).id === argFixture)
  : files.find(f => JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')).content?.dungeon === "Dragon's Lair");
if (!fixtureFile) { console.log(`no runnable Dragon fixture found${argFixture ? ` for '${argFixture}'` : ''}`); process.exit(2); }
const g = JSON.parse(fs.readFileSync(path.join(DIR, fixtureFile), 'utf8'));
const stage = g.content.stage;
const dungeonName = g.content?.dungeon ?? "Dragon's Lair";
const isDragon = dungeonName === "Dragon's Lair";   // Dragon uses the bespoke path below; every other dungeon goes through buildBattle

// ── DB: champion kits, boss, waves (mirrors sim-golden's build path) ───────────
const SEL = 'id,name,affinity,champion_skills(slot,skill_name,skill_summary,cooldown_base,cooldown_booked,damage_multiplier,multiplier_type)';
let db = [];
for (let off = 0; ; off += 1000) {
  const d = await rest(`champions?select=${encodeURIComponent(SEL)}&game_id=eq.raid_shadow_legends&limit=1000&offset=${off}`);
  if (!Array.isArray(d) || !d.length) break; db = db.concat(d); if (d.length < 1000) break;
}
const byId = Object.fromEntries(db.map(c => [c.id, c]));
const resolver = await loadNameResolverRest(rest);

const dun = (await rest('dungeons?select=id,name&game_id=eq.raid_shadow_legends')).find(x => x.name === "Dragon's Lair");
const enemyRows = await rest('dungeon_stage_enemies?select=stage_number,enemy_role,enemy_name,wave_number,position,champion_id,hp,atk,def,spd,res,acc,crit_rate,crit_dmg&dungeon_id=eq.' + dun.id);
const bossRow = enemyRows.find(e => e.stage_number === stage && e.enemy_role === 'boss');

const builds = Object.fromEntries((JSON.parse(fs.readFileSync(path.join(REPO,
  Object.values(g.inputs || {}).map(v => v.build).find(Boolean)), 'utf8')).champions || []).map(c => [c.name, c]));

// A boss-mastery carrier is a damage-dealer under the 'offense' bracket — has an enemy-hitting coeff skill.
const isDamageDealer = (cat) => (cat?.champion_skills ?? []).some(s => {
  const k = readSkillKit([s])[0]; return k?.hitsEnemies && k?.coeff != null;
});

// Build a FRESH set of combatants each run (combat mutates hp/buffs/cooldowns). rng is per-run.
async function buildFight(seed) {
  // NON-DRAGON (Spider …): build + run exactly like sim-per-hero-bands so the two agree. buildBattle
  // dispatches to makeSpiderContent (spawn template, consume snowball) and installRecipeRun runs the
  // authored champion recipes — NOT the Dragon-only Hellrazor path below.
  if (!isDragon) {
    const built = await buildBattle({ rest, fixture: g, repoRoot: REPO });
    if (built.skip) throw new Error(`buildBattle skipped: ${built.skip}`);
    applyBattleLayers(built.allies);
    const state = makeState({ allies: built.allies, enemies: [], seed });
    installRecipeRun(state);
    return { state, content: built.content, allies: built.allies };
  }
  const boss = makeCombatant({ name: bossRow.enemy_name, side: 'enemy', role: 'boss',
    maxHp: +bossRow.hp, atk: +bossRow.atk, def: +bossRow.def, spd: +bossRow.spd,
    acc: +bossRow.acc, res: +bossRow.res, critRate: +bossRow.crit_rate, critDmg: +bossRow.crit_dmg,
    affinity: g.content.boss_affinity ?? 'Void' });
  boss.immune = HELLRAZOR_IMMUNE;

  const waveRows = enemyRows.filter(e => e.enemy_role === 'wave' && e.stage_number === stage);
  const waves = [...new Set(waveRows.map(e => e.wave_number))].sort((a, b) => a - b).map(wn => ({
    enemies: waveRows.filter(e => e.wave_number === wn).sort((a, b) => a.position - b.position).map(r => {
      const cat = byId[r.champion_id];
      return makeCombatant({ name: `${r.enemy_name}#${r.position}`, side: 'enemy', role: 'wave',
        maxHp: +r.hp, atk: +r.atk, def: +r.def, spd: +r.spd, acc: +r.acc, res: +r.res,
        critRate: +r.crit_rate, critDmg: +r.crit_dmg, affinity: cat?.affinity,
        skills: readSkillKit(cat?.champion_skills ?? []) });
    }),
    actEnemy: actEnemyMob,
  }));

  const allies = g.team.map(name => {
    const canon = g.roster?.[name] ?? name;
    const hit = resolver.resolveOrThrow(canon, 'montecarlo team hero');
    const cat = byId[hit.id];
    const b = builds[cat?.name] ?? builds[canon] ?? builds[name];
    if (!b) throw new Error(`no build for ${name}`);
    const s = b.total_stats;
    return makeCombatant({ name: canon, side: 'ally',
      maxHp: s.hp, atk: s.atk, def: s.def, spd: s.spd, acc: s.acc, res: s.res,
      critRate: s.crit_rate, critDmg: s.crit_dmg, affinity: b.affinity ?? cat?.affinity,
      lifesteal: gearLifesteal(b.gear_sets),
      // 'off' = nobody; 'offense' = GENERALIZATION (assume every damage-dealer carries a boss mastery);
      // 'real' = the per-account TRUTH from Gestal masteryIds (build.has_boss_mastery, via build-from-sync).
      bossMastery: MASTERY === 'offense' ? isDamageDealer(cat)
        : MASTERY === 'real' ? !!b.has_boss_mastery
        : false,
      skills: readSkillKit(cat?.champion_skills ?? []) });
  });

  // Account-level battle layers (leader aura + Arena), applied only when the fixture declares them so
  // existing Dragon fixtures (e.g. DonBambus, no battle_layers) are unchanged. The Spider path above
  // already calls applyBattleLayers with defaults; the Dragon path historically did not.
  if (g.battle_layers) applyBattleLayers(allies, g.battle_layers);

  const content = makeDragonContent({ stageNumber: stage, purpleBarHp: 0.20 * boss.maxHp, waves, boss });
  const state = makeState({ allies, enemies: [], seed });
  state.purpleBarLeft = 0;
  return { state, content, allies };
}

// ── run N seeded battles ───────────────────────────────────────────────────────
// death turns keyed by the ACTUAL built ally names (Dragon and Spider name their allies differently —
// buildBattle may use canonical DB names; the Dragon path uses roster names), seeded on the first build.
const deaths = {};
const turns = [], survivorsArr = []; let wins = 0;
const reviveTotals = [], reviveWin = [], reviveLoss = []; const reviveBy = {};   // revive census

for (let seed = 1; seed <= N; seed++) {
  const { state, content, allies } = await buildFight(seed);
  for (const a of allies) if (!(a.name in deaths)) deaths[a.name] = [];
  const l = console.log; console.log = () => {};
  const res = simulate(state, content, { turnCap: 400 });
  console.log = l;
  if (res.won) wins++;
  turns.push(res.turns);
  survivorsArr.push(res.survivors.length);
  for (const a of allies) if (!a.alive) deaths[a.name].push(a.diedOnTurn ?? res.turns);
  const revs = res.revives ?? [];
  reviveTotals.push(revs.length);
  (res.won ? reviveWin : reviveLoss).push(revs.length);
  for (const r of revs) reviveBy[r.by] = (reviveBy[r.by] || 0) + 1;
}
const teamNames = Object.keys(deaths);
const mean = arr => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

// ── stats ──────────────────────────────────────────────────────────────────────
const pct = (arr, q) => { if (!arr.length) return null; const s = [...arr].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; };
const median = arr => pct(arr, 0.5);
const winRate = wins / N;

console.log(`\n══ SIM MONTE-CARLO (rung 7) ══  ${fixtureFile}  ·  stage ${stage}  ·  N=${N}  ·  masteries=${MASTERY}\n`);
console.log(`  WIN RATE: ${(winRate * 100).toFixed(0)}%  (${wins}/${N})`);
console.log(`  TURNS   : p10 ${pct(turns, 0.1)}  ·  median ${median(turns)}  ·  p90 ${pct(turns, 0.9)}  (min ${Math.min(...turns)} / max ${Math.max(...turns)})`);
console.log(`  SURVIVORS: median ${median(survivorsArr)}/${g.team.length}  (p10 ${pct(survivorsArr, 0.1)} / p90 ${pct(survivorsArr, 0.9)})`);
console.log(`\n  PER-CHAMPION death rate (how often each falls, and when):`);
for (const n of teamNames) {
  const d = deaths[n]; const rate = d.length / N;
  console.log(`    ${n.padEnd(20)} dies ${(rate * 100).toFixed(0).padStart(3)}% of runs` + (d.length ? `  ·  median death turn ${median(d)}` : ''));
}

console.log(`\n  REVIVE census (how many revives fire per fight):`);
console.log(`    avg ${mean(reviveTotals).toFixed(2)}/fight  ·  median ${median(reviveTotals)}  ·  max ${Math.max(0, ...reviveTotals)}  ·  in WINS ${mean(reviveWin).toFixed(2)} / in LOSSES ${mean(reviveLoss).toFixed(2)}`);
for (const [who, n] of Object.entries(reviveBy).sort((a, b) => b[1] - a[1])) console.log(`    ${who.padEnd(20)} cast ${(n / N).toFixed(2)} revives/fight (${n} over ${N})`);
if (!Object.keys(reviveBy).length) console.log(`    (no revives fired)`);

// ── reality anchors from the golden record ──────────────────────────────────────
console.log(`\n  REALITY (golden ${g.id}): ${g.result.outcome} in ${g.result.turns}t, ${g.result.survivors}/${g.team.length} survived.`);
if (g.reality_notes) console.log(`    notes: ${g.reality_notes}`);
console.log(`    A single WIN in reality is one draw from this distribution — compare the RATE, not one run.`);

console.log('QA_JSON ' + JSON.stringify({ rung: 'montecarlo', fixture: g.id, stage, N, mastery: MASTERY,
  winRate, turns: { p10: pct(turns, 0.1), median: median(turns), p90: pct(turns, 0.9) },
  survivorsMedian: median(survivorsArr),
  deathRates: Object.fromEntries(teamNames.map(n => [n, deaths[n].length / N])),
  realityOutcome: g.result.outcome, realityTurns: g.result.turns }));
