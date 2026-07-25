// tools/sim-fixture-volume.mjs — VOLUME run of ONE golden fixture: N seeded battles, recipes installed, RNG
// live → a win rate to set against reality. The Model's turn engine is deterministic per seed (mulberry32);
// this is how we judge the sim by VOLUME (never a single battle — see memory dragon16-reality-winrate).
//
// The single-fixture complement to sim-suite.mjs (which scores the whole captured Dragon corpus with N=25).
// Here we crank N high on ONE fixture — the DonBambus Dragon-16 cell, the only first-party-validated fight —
// to read the sim's win-rate to a fraction of a point and compare it to reality's ~88.5% (23/26 captured).
//
// Stat layers match sim-run/model-golden: Ezio SPD leader aura (x1.19) + Bronze III arena (x1.03 HP/ATK/DEF)
// on top of the fixture's ROSTER-screen stats. Default fixture = the CURRENT-gear runtime fixture.
// Run: node --env-file=.env.local tools/sim-fixture-volume.mjs [N] [fixtureBasename]

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { makeState, simulate } from '../lib/sim/engine.js';
import { buildDragonBattle } from '../lib/sim/dragon-fixture.js';
import { installRecipeRun } from '../lib/sim/interpreter.js';

const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const N = Number(process.argv[2] || 300);
const FIXTURE = process.argv[3] || 'dragon16-donbambus-current.json';
const FIX = path.join(REPO, 'test', 'golden', FIXTURE);
const AURA_SPD = 1.19, ARENA = 1.03;

if (!process.env.SUPABASE_URL) { console.log('needs the DB. Run with --env-file=.env.local'); process.exit(2); }
const BASE = process.env.SUPABASE_URL.replace(/\/rest\/v1\/?$/, '');
const H = { apikey: process.env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}` };
const rest = async (p) => (await fetch(`${BASE}/rest/v1/${p}`, { headers: H })).json();

const fixture = JSON.parse(fs.readFileSync(FIX, 'utf8'));
const probe = await buildDragonBattle({ rest, fixture, repoRoot: REPO });
if (probe.skip) { console.log('skipped:', probe.skip); process.exit(0); }

let wins = 0; const turnsArr = []; const survArr = []; const wipePhase = {};
for (let seed = 1; seed <= N; seed++) {
  const built = await buildDragonBattle({ rest, fixture, repoRoot: REPO });
  for (const a of built.allies) {
    a.spd = Math.round(a.spd * AURA_SPD);
    a.maxHp = Math.round(a.maxHp * ARENA); a.hp = a.maxHp;
    a.atk = Math.round(a.atk * ARENA); a.def = Math.round(a.def * ARENA);
  }
  const st = makeState({ allies: built.allies, enemies: [], seed }); st.purpleBarLeft = 0;
  installRecipeRun(st);
  const res = simulate(st, built.content, { turnCap: 400 });
  if (res.won) wins++; else { const ph = res.failedPhase ?? '?'; wipePhase[ph] = (wipePhase[ph] || 0) + 1; }
  turnsArr.push(res.turns ?? 0);
  survArr.push(res.survivors?.length ?? 0);
}
const med = (a) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const pct = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length * p)]; };
console.log(`\n=== ${fixture.id ?? FIXTURE} — ${N} seeded battles (recipes on, RNG live) ===`);
console.log(`  SIM WIN RATE : ${(100 * wins / N).toFixed(1)}%  (${wins}/${N})`);
console.log(`  survivors    : median ${med(survArr)}/${probe.allies.length}  (p10 ${pct(survArr, 0.1)} / p90 ${pct(survArr, 0.9)})`);
console.log(`  turns        : p10 ${pct(turnsArr, 0.1)} / med ${med(turnsArr)} / p90 ${pct(turnsArr, 0.9)}`);
console.log(`  LOSS phase   : ${JSON.stringify(wipePhase)}`);
console.log(`\n  (Dragon-16 reality baseline: 88.5% = 23/26 captured — memory dragon16-reality-winrate-2026-07-25)`);
