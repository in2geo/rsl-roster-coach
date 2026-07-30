// tools/sim-spider-burn-ab.mjs — A/B for the reactive-HP-Burn duration fix (Spider-13).
//
// Mike (2026-07-29): the fix restores the SECOND tick; it cannot make the FIRST tick happen sooner, so it must
// NOT change first-tick incidence — only total ticks + burns-ticking-twice. This runs the 40-seed spread with
// the fix OFF (SIM_REACTIVE_BURN_FIX=0) then ON (default) in one process and prints the decisive table.
//
// Metrics separated per Mike's spec (a burn can tick up to twice, so "ticks/placed" is NOT an activation %):
//   burns_placed              — HP Burn placements on Spiderlings (refresh resets the tick ordinal → a fresh unit)
//   unique_ticking≥1×         — placements whose FIRST tick fired (burn_tick tickNo==1) = the FIRST-TICK RATE numerator
//   consumed_before_first_tick— placements that never ticked (eaten/expired first) = placed − unique_ticking≥1×
//   total_burn_ticks          — all activations (tickNo 1 and 2)
//   burns_ticking_twice       — placements whose SECOND tick fired (tickNo==2)
//   burn_splash (≈Skavag)     — Σ splash damage from ticks (boss-dominated: other adds' 3% MaxHP is negligible)
//
// Run: node --env-file=.env.local tools/sim-spider-burn-ab.mjs [N] [stage]

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { makeState, simulate } from '../lib/sim/engine.js';
import { buildBattle, applyBattleLayers } from '../lib/sim/dragon-fixture.js';
import { installRecipeRun } from '../lib/sim/interpreter.js';

const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const N = Number(process.argv[2] || 40);
const STAGE = Number(process.argv[3] || 13);
const FIXTURE = 'spider13-donbambus-current.json';
const isSpiderling = (n) => /Spiderling/i.test(String(n));

if (!process.env.SUPABASE_URL) { console.log('needs the DB. Run with --env-file=.env.local'); process.exit(2); }
const BASE = process.env.SUPABASE_URL.replace(/\/rest\/v1\/?$/, '');
const H = { apikey: process.env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}` };
const _cache = new Map();
const rest = async (p) => { if (!_cache.has(p)) _cache.set(p, await (await fetch(`${BASE}/rest/v1/${p}`, { headers: H })).json()); return _cache.get(p); };

const fixture = JSON.parse(fs.readFileSync(path.join(REPO, 'test', 'golden', FIXTURE), 'utf8'));
const probe = await buildBattle({ rest, fixture, repoRoot: REPO });
if (probe.skip) { console.log('skipped:', probe.skip); process.exit(0); }

async function runSpread(mode) {
  process.env.SIM_REACTIVE_BURN_FIX = mode;   // '0' = fix OFF, '1' = fix ON (read at call time in expireDurations)
  const a = { wins: 0, turns: 0, placed: 0, first: 0, second: 0, ticks: 0, splash: 0 };
  for (let seed = 1; seed <= N; seed++) {
    const built = await buildBattle({ rest, fixture, repoRoot: REPO });
    applyBattleLayers(built.allies);
    const st = makeState({ allies: built.allies, enemies: [], seed });
    installRecipeRun(st);
    const res = simulate(st, built.content, { turnCap: 400 });
    if (res.won) a.wins++;
    a.turns += res.turns || 0;
    for (const e of res.effects || []) {
      if (e.kind === 'debuff' && e.subtype === 'HP Burn' && isSpiderling(e.target) && e.consumed !== false) a.placed++;
      if (e.kind === 'burn_tick' && isSpiderling(e.target)) {
        a.ticks++; a.splash += e.splash || 0;
        if (e.tickNo === 1) a.first++; else if (e.tickNo === 2) a.second++;
      }
    }
  }
  return a;
}

const before = await runSpread('0');
const after = await runSpread('1');
const per = (a, x) => (x / N).toFixed(1);
const rate = (num, den) => den ? (100 * num / den).toFixed(0) + '%' : '—';

const rows = [
  ['burns placed',                 per(before, before.placed), per(after, after.placed)],
  ['unique burns ticking ≥1×',     per(before, before.first),  per(after, after.first)],
  ['   → first-tick rate',         rate(before.first, before.placed), rate(after.first, after.placed)],
  ['consumed before first tick',   per(before, before.placed - before.first), per(after, after.placed - after.first)],
  ['total burn ticks',             per(before, before.ticks),  per(after, after.ticks)],
  ['burns ticking twice',          per(before, before.second), per(after, after.second)],
  ['burn splash ≈ Skavag HP lost', Math.round(before.splash / N).toLocaleString(), Math.round(after.splash / N).toLocaleString()],
  ['win rate',                     rate(before.wins, N),       rate(after.wins, N)],
];

console.log(`\n═══ REACTIVE-HP-BURN DURATION FIX — A/B (Spider ${STAGE}, ${N} seeds, per-fight avg) ═══\n`);
console.log(`  ${'metric'.padEnd(32)} ${'BEFORE'.padStart(9)}   ${'AFTER'.padStart(9)}`);
console.log(`  ${'-'.repeat(32)} ${'-'.repeat(9)}   ${'-'.repeat(9)}`);
for (const [k, b, a] of rows) console.log(`  ${k.padEnd(32)} ${String(b).padStart(9)}   ${String(a).padStart(9)}`);

console.log(`\n  Expected signature (Mike): first-tick rate ~unchanged; total ticks + twice-ticking UP.`);
console.log(`  If first-tick rate moved substantially, there is ANOTHER lifecycle interaction beyond the decrement.`);
console.log(`\nQA_JSON ${JSON.stringify({ rung: 'spider-burn-ab', stage: STAGE, seeds: N,
  before: { winRate: +rate(before.wins, N).replace('%',''), placed: +per(before, before.placed), first: +per(before, before.first), firstTickRate: +rate(before.first, before.placed).replace('%',''), ticks: +per(before, before.ticks), twice: +per(before, before.second), splash: Math.round(before.splash / N) },
  after:  { winRate: +rate(after.wins, N).replace('%',''),  placed: +per(after, after.placed),  first: +per(after, after.first),  firstTickRate: +rate(after.first, after.placed).replace('%',''),   ticks: +per(after, after.ticks),  twice: +per(after, after.second),  splash: Math.round(after.splash / N) } })}`);
