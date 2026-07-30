// tools/sim-spider-cycle.mjs — CONSUME-TO-CONSUME EVENT LEDGER (Spider-13 HP-Burn accumulation).
//
// Mike (2026-07-29): the whole-fight totals (28.6 placed vs ~1 burning) cannot be read without TIME WINDOWS,
// and boss damage is BURN ACTIVATIONS, not peak burn count. Burn counts must be compared at IDENTICAL
// lifecycle points (before vs after a consume). So this instruments ONE fight and prints a per-consume-cycle
// ledger — the "decisive trace" — so a reality cycle (from footage) can be laid beside a sim cycle and we
// STOP AT THE FIRST DIVERGENT ROW rather than re-running a 150-turn comparison.
//
// Per Skavag consume it records, for the window since the previous consume:
//   spider_turns_reached · attacks_on_Pelops · burns_placed · petrifs_placed · burn_activations(ticks)
//   burning_before_consume (the number that matters) · consumed · living_after(+respawn) · boss HP%
//
// It changes NO engine behaviour: a wrapped state.onTurn snapshot + the existing log/effect ledger.
//
// Run: node --env-file=.env.local tools/sim-spider-cycle.mjs [seed] [stage]

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { makeState, simulate } from '../lib/sim/engine.js';
import { buildBattle, applyBattleLayers } from '../lib/sim/dragon-fixture.js';
import { installRecipeRun } from '../lib/sim/interpreter.js';
import { champKey } from '../lib/sim/recipes.js';

const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SEED = Number(process.argv[2] || 1);
const STAGE = Number(process.argv[3] || 13);
const FIXTURE = 'spider13-donbambus-current.json';
const isSpiderling = (n) => /Spiderling/i.test(String(n));
const isPelops = (n) => champKey(n) === champKey('Pelops the Victor');

if (!process.env.SUPABASE_URL) { console.log('needs the DB. Run with --env-file=.env.local'); process.exit(2); }
const BASE = process.env.SUPABASE_URL.replace(/\/rest\/v1\/?$/, '');
const H = { apikey: process.env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}` };
const _cache = new Map();
const rest = async (p) => { if (!_cache.has(p)) _cache.set(p, await (await fetch(`${BASE}/rest/v1/${p}`, { headers: H })).json()); return _cache.get(p); };

const fixture = JSON.parse(fs.readFileSync(path.join(REPO, 'test', 'golden', FIXTURE), 'utf8'));
const probe = await buildBattle({ rest, fixture, repoRoot: REPO });
if (probe.skip) { console.log('skipped:', probe.skip); process.exit(0); }

const built = await buildBattle({ rest, fixture, repoRoot: REPO });
applyBattleLayers(built.allies);
const st = makeState({ allies: built.allies, enemies: [], seed: SEED });
installRecipeRun(st);

// per-turn snapshot (END of turn — after the actor's action, consume, respawn, expiry). Non-invasive: wrap any
// hook installRecipeRun already set. `burning` counts LIVE adds carrying an active [HP Burn].
const snaps = [];
const prevOnTurn = st.onTurn;
st.onTurn = (state, actor) => {
  prevOnTurn?.(state, actor);
  const boss = state.enemies.find((e) => e.role === 'boss');
  const adds = state.enemies.filter((e) => e.role === 'add');
  const liveAdds = adds.filter((a) => a.alive);
  snaps.push({
    turn: state.turn,
    actor: actor?.name, role: actor?.role, side: actor?.side,
    bossHpPct: boss ? Math.round((100 * boss.hp) / (boss.maxHp || 1)) : null,
    bossAtk: boss ? boss.atk : null,
    living: liveAdds.length,
    burning: liveAdds.filter((a) => (a.debuffs ?? []).some((d) => d.type === 'HP Burn')).length,
    tms: liveAdds.map((a) => Math.round(a.turnMeter ?? 0)),
  });
};

const res = simulate(st, built.content, { turnCap: 400 });
const log = res.log || [], fx = res.effects || [];
const snapAt = (t) => snaps.filter((s) => s.turn <= t).slice(-1)[0] || null;   // last snapshot at/ before turn t

// consume events (turn + count) from the content log, in order
const consumes = [];
for (const l of log) { const m = /CONSUME (\d+)/.exec(String(l.event)); if (m) consumes.push({ turn: l.turn, n: Number(m[1]) }); }
// spawns keyed by turn (for per-window "new spiders")
const spawnAt = (a, b) => log.filter((l) => l.turn > a && l.turn <= b).reduce((s, l) => { const m = /spawn (\d+)/.exec(String(l.event)); return s + (m ? Number(m[1]) : 0); }, 0);

// tally window (a, b] from the effect ledger
const win = (a, b) => {
  let spTurns = 0, atkPel = 0, burnPlaced = 0, petrPlaced = 0, ticks = 0;
  for (const s of snaps) if (s.turn > a && s.turn <= b && s.role === 'add') spTurns++;
  for (const e of fx) {
    if (!(e.turn > a && e.turn <= b)) continue;
    // Spiderling attacks steered onto Pelops = 'target' events forced by his [Taunt] (spider.js recordTargeting;
    // emitted only while a taunter is up — which is exactly when a Spiderling can pick Pelops, since off-Taunt
    // he is highest-MAX-HP and never chosen). Scripted enemy hits emit NO 'damage' effect, so count targeting.
    if (e.kind === 'target' && e.subtype === 'Taunt' && isPelops(e.target) && e.consumed !== false) atkPel++;
    if (e.kind === 'debuff' && e.subtype === 'HP Burn' && isSpiderling(e.target) && e.consumed !== false) burnPlaced++;
    if (e.kind === 'debuff' && e.subtype === 'Petrification' && isSpiderling(e.target) && e.consumed !== false) petrPlaced++;
    if (e.kind === 'dot' && e.subtype === 'HP Burn' && isSpiderling(e.target)) ticks++;
  }
  return { spTurns, atkPel, burnPlaced, petrPlaced, ticks };
};

console.log(`\n═══ CONSUME-TO-CONSUME LEDGER — Spider's Den ${STAGE}, seed ${SEED} ═══`);
console.log(`  result: ${res.won ? 'WIN' : 'LOSS'} in ${res.turns}t   ·   ${consumes.length} consumes\n`);
const pad = (x, w) => String(x).padStart(w);
console.log('  cyc  turns      Skvturn  burn@  consumed  living   spTurns  atk→Pel  burns  petr  activ   boss%   bossATK');
console.log('                             pre    (eaten)   after                              placed placed (ticks)');
let prevTurn = 0;
consumes.forEach((c, i) => {
  const w = win(prevTurn, c.turn);
  const pre = snapAt(c.turn - 1);       // burning just BEFORE this consume (end of the prior turn)
  const post = snapAt(c.turn);          // living just AFTER consume+respawn (Skavag's own end-of-turn snap)
  console.log('  ' + pad(i + 1, 2) + '  ' + pad(`${prevTurn + 1}-${c.turn}`, 8)
    + '   ' + pad(c.turn, 5)
    + '   ' + pad(pre?.burning ?? '—', 4)
    + '   ' + pad(c.n, 6)
    + '   ' + pad(post?.living ?? '—', 5)
    + '   ' + pad(w.spTurns, 6)
    + '   ' + pad(w.atkPel, 6)
    + '   ' + pad(w.burnPlaced, 5)
    + '  ' + pad(w.petrPlaced, 4)
    + '  ' + pad(w.ticks, 5)
    + '   ' + pad((pre?.bossHpPct ?? '—') + '%', 5)
    + '   ' + pad((post?.bossAtk ?? '—').toLocaleString(), 8));
  prevTurn = c.turn;
});

// fight-level sanity totals (the numbers whose ratio is meaningless WITHOUT the per-cycle view above)
const tot = win(0, res.turns);
const peakBurn = Math.max(0, ...snaps.map((s) => s.burning));
const avgBurn = snaps.length ? (snaps.reduce((s, x) => s + x.burning, 0) / snaps.length) : 0;
console.log(`\n  fight totals: burns_placed ${tot.burnPlaced} · burn_activations(ticks) ${tot.ticks} · attacks_on_Pelops ${tot.atkPel}`);
console.log(`  burning population: peak ${peakBurn} · time-avg ${avgBurn.toFixed(2)}   ← reality's "5–10" is a PRE-CONSUME peak; compare to the burn@pre column, not this average`);
console.log(`\n  ▶ Lay a reality cycle beside any row and STOP at the first column that differs:`);
console.log(`     spTurns differ → scheduler/spawn-TM/speeds · same spTurns fewer atk→Pel → Taunt/targeting`);
console.log(`     same atk fewer burns → passive/Decrease-DEF · same burns fewer activ → duration/consume-race\n`);

console.log(`QA_JSON ${JSON.stringify({ rung: 'spider-cycle', stage: STAGE, seed: SEED, won: res.won, turns: res.turns,
  consumes: consumes.length, peakBurn, avgBurn: +avgBurn.toFixed(2),
  totals: { burnPlaced: tot.burnPlaced, ticks: tot.ticks, atkPel: tot.atkPel },
  cycles: consumes.map((c, i) => { const w = win(i === 0 ? 0 : consumes[i - 1].turn, c.turn); const pre = snapAt(c.turn - 1);
    return { turn: c.turn, burnPre: pre?.burning ?? null, consumed: c.n, spTurns: w.spTurns, atkPel: w.atkPel, burnPlaced: w.burnPlaced, ticks: w.ticks, bossHpPct: pre?.bossHpPct ?? null }; }) })}`);
