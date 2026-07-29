// tools/sim-survival-oracle.mjs — THE SURVIVAL ORACLE (reality gate on the RECEIVING side).
//
// Every other rung validates what the team DEALS or whether a mechanic FIRES. None checks what the team
// TAKES, or the MAGNITUDE of an effect against reality. That blind spot let two poison bugs (immortal
// stacks; no ACC/RES roll) through the whole ladder: the Poison still "fired", still "dealt damage", still
// matched a golden blessed WHILE broken. This rung closes it — it asserts each hero's DAMAGE-TAKEN and
// HEALING (the in-game blue/green bars) land within a REALITY band from the captures. Over-hot DoT, missing
// mitigation, absent sustain — anything on the survival axis — trips it.
//
// Reality source: data/manual-captures.json (hand-transcribed victory/defeat screens; per-hero taken+healed).
// Sim source: engine `taken`/`healed` per-combatant accounting (golden-safe recording; see makeCombatant).
// Metric: taken-per-ALIVE-turn (taken / turns the hero was alive) — turn-count- and death-invariant, so a
// sim that kills a hero fast is measured on RATE, not truncated total. Blocks when any hero's sim rate is
// outside [1/BAND, BAND]× the reality-median rate (BAND=3 → a 3× over/under-take is a red gate).
//
// Run: node --env-file=.env.local tools/sim-survival-oracle.mjs [N] [dungeon] [stage]

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { makeState, simulate } from '../lib/sim/engine.js';
import { buildBattle, applyBattleLayers } from '../lib/sim/dragon-fixture.js';
import { installRecipeRun } from '../lib/sim/interpreter.js';

const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const N = Number(process.argv[2] || 60);
const DUNGEON = process.argv[3] || "Spider's Den";
const STAGE = Number(process.argv[4] || 13);
const BAND = Number(process.env.ORACLE_BAND || 3);   // sim rate must be within [1/BAND, BAND]× reality median
const FIXTURE = { "Spider's Den": 'spider13-donbambus-current.json', "Dragon's Lair": 'dragon16-donbambus-current.json' }[DUNGEON];

if (!process.env.SUPABASE_URL) { console.log('needs the DB. Run with --env-file=.env.local'); process.exit(2); }
const BASE = process.env.SUPABASE_URL.replace(/\/rest\/v1\/?$/, '');
const H = { apikey: process.env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}` };
const _cache = new Map();   // memoize DB reads: buildBattle is called once per seed but the rows never change
const rest = async (p) => { if (!_cache.has(p)) _cache.set(p, (await fetch(`${BASE}/rest/v1/${p}`, { headers: H })).json()); return _cache.get(p); };
const med = (a) => { if (!a.length) return NaN; const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const mean = (a) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN;

// ── REALITY: per-hero taken/turn + healed/turn. Two sources, in priority order:
//   1. data/manual-captures.json — MANY hand-transcribed screens → a real median band → GATES (blocks).
//   2. the golden fixture's expected.per_hero — a SINGLE reader capture → report-only (one anchor, and the
//      Dragon taken values are flagged suspect: reality-anchors-single-run-trap). Shows the number, no block.
const realityByHero = {};
const addRealityRow = (name, taken, healing, turns) => {
  (realityByHero[name] ??= { takenRate: [], healRate: [], taken: [], healed: [] });
  realityByHero[name].takenRate.push((taken ?? 0) / turns);
  realityByHero[name].healRate.push((healing ?? 0) / turns);
  realityByHero[name].taken.push(taken ?? 0);
  realityByHero[name].healed.push(healing ?? 0);
};
const caps = JSON.parse(fs.readFileSync(path.join(REPO, 'data', 'manual-captures.json'), 'utf8')).captures
  .filter(c => c.dungeon === DUNGEON && c.stageNumber === STAGE && c.turns);
for (const c of caps) for (const h of c.heroes) addRealityRow(h.displayName || h.name, h.taken, h.healing, c.turns);
const fixtureForReality = JSON.parse(fs.readFileSync(path.join(REPO, 'test', 'golden', FIXTURE), 'utf8'));
let gating = caps.length >= 3;   // a real band needs ≥3 captures; a lone reader anchor is report-only
if (!gating) {   // fall back to the fixture's single reader capture (report-only)
  const ph = fixtureForReality.expected?.per_hero, turns = fixtureForReality.result?.turns;
  if (ph && turns) for (const [name, v] of Object.entries(ph)) addRealityRow(name, v.taken, v.healing, turns);
}
if (!Object.keys(realityByHero).length) { console.log(`SURVIVAL ORACLE: no reality per-hero data for ${DUNGEON} ${STAGE} — cannot show.`); process.exit(0); }

// ── SIM: N seeds, per-hero taken/healed and alive-turns
const fixture = JSON.parse(fs.readFileSync(path.join(REPO, 'test', 'golden', FIXTURE), 'utf8'));
const probe = await buildBattle({ rest, fixture, repoRoot: REPO });
if (probe.skip) { console.log('skipped:', probe.skip); process.exit(0); }
const simByHero = {}; let wins = 0;
for (let seed = 1; seed <= N; seed++) {
  const built = await buildBattle({ rest, fixture, repoRoot: REPO });
  applyBattleLayers(built.allies);
  const st = makeState({ allies: built.allies, enemies: [], seed });
  installRecipeRun(st);
  const res = simulate(st, built.content, { turnCap: 400 });
  if (res.won) wins++;
  const T = res.turns || 1;
  for (const a of built.allies) {
    const aliveTurns = a.diedOnTurn ?? T;
    (simByHero[a.name] ??= { takenRate: [], healRate: [], taken: [], healed: [], survived: [] });
    simByHero[a.name].takenRate.push((a.taken ?? 0) / Math.max(1, aliveTurns));
    simByHero[a.name].healRate.push((a.healed ?? 0) / Math.max(1, aliveTurns));
    simByHero[a.name].taken.push(a.taken ?? 0);
    simByHero[a.name].healed.push(a.healed ?? 0);
    simByHero[a.name].survived.push(a.alive ? 1 : 0);
  }
}

console.log(`\n═══ SURVIVAL ORACLE — ${DUNGEON} ${STAGE} (${N} seeds; band ±${BAND}×) ═══`);
console.log(`  sim win rate ${(100 * wins / N).toFixed(0)}%  ·  reality: ${gating ? `${caps.length} captures → GATING (blocks on fail)` : 'single reader anchor → REPORT-ONLY (informational, does not block)'}`);
console.log(`\n  hero      | realTaken/t  simTaken/t   ratio | simSurv% | realHeal/t simHeal/t`);
console.log(`  ----------+-------------------------------------+----------+---------------------`);
const failures = [];
for (const name of Object.keys(simByHero)) {
  const rk = Object.keys(realityByHero).find(k => k.toLowerCase().startsWith(name.toLowerCase()) || name.toLowerCase().startsWith(k.toLowerCase()));
  const R = rk ? realityByHero[rk] : null;
  const simTR = med(simByHero[name].takenRate), simHR = med(simByHero[name].healRate);
  const surv = 100 * mean(simByHero[name].survived);
  if (!R) { console.log(`  ${name.padEnd(9)} | (no reality row)`); continue; }
  const realTR = med(R.takenRate), realHR = med(R.healRate);
  const ratio = realTR > 0 ? simTR / realTR : (simTR > 0 ? Infinity : 1);
  const bad = ratio > BAND || ratio < 1 / BAND;
  const mark = bad ? ' ✗' : '';
  console.log(`  ${name.padEnd(9)} | ${String(Math.round(realTR)).padStart(9)}  ${String(Math.round(simTR)).padStart(9)}   ${ratio.toFixed(1).padStart(5)}×${mark} | ${surv.toFixed(0).padStart(6)}% | ${String(Math.round(realHR)).padStart(9)} ${String(Math.round(simHR)).padStart(9)}`);
  if (bad) failures.push({ hero: name, realTakenPerTurn: Math.round(realTR), simTakenPerTurn: Math.round(simTR), ratio: +ratio.toFixed(2) });
}
const clean = failures.length === 0;
const pass = clean || !gating;   // report-only sources never fail the gate — they only show the number
console.log(`\n  ${clean ? '✅ PASS' : (gating ? '❌ FAIL' : '⚠ OUT-OF-BAND (report-only)')} — ${failures.length} hero(es) outside the reality damage-taken band`);
if (failures.length) for (const f of failures) console.log(`     ✗ ${f.hero}: sim takes ${f.simTakenPerTurn}/turn vs reality ${f.realTakenPerTurn}/turn (${f.ratio}×)`);
console.log(`QA_JSON ${JSON.stringify({ rung: 'survival-oracle', dungeon: DUNGEON, stage: STAGE, seeds: N, band: BAND, gating, pass, fail: failures.length, failures })}`);
process.exit(pass ? 0 : 1);
