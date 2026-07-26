// tools/sim-rolls.mjs — QA PROTOCOL RUNG: THE ROLL CENSUS (FIRED / ROLLED / CONSUMED).
//
// SIBLING of sim-effects.mjs. That rung answers "did a fired effect CHANGE world state." This one
// answers the RNG-edition of the same recurring bug: "is a mechanic that Raid ROLLS actually being
// ROLLED here — from the right stream, at its stated probability — or is it silently resolved to a
// fixed/expected value?" The canonical enumeration of what Raid rolls lives in knowledge/RNG_REGISTRY.md
// (derived from RNG Engine Info.docx, Plarium-cited). This rung EXECUTES that registry against the engine
// so a deterministic-should-be-stochastic mechanic fails a test instead of hiding inside a constant — the
// exact failure the handoff blames for the 100%-sim-vs-88.5%-reality gap (buffs/procs that never lapse).
//
// HOW IT OBSERVES: instead of threading a `rolled` flag through every engine site, it INSTRUMENTS the RNG
// stream bundle — each stream is wrapped to count and record its draws — and injects it via
// makeState({rng}). makeState accepts a prebuilt bundle (engine.js), so this needs NO engine change and,
// unlike a ledger flag, it also censuses crit and damage-variance, which emit no ledger row of their own.
//
// FIVE PARTS, teeth-first (a rung that cannot fail is worthless):
//   A. INSTRUMENT TEETH — the wrapper counts draws and replays scripted values. Proves the probe works.
//   B. STREAM COVERAGE — each LIVE mechanic must draw its stream (count>0); the RESERVED streams
//      (affinity, ai, and target on the base path) must stay UNDRAWN, matching the registry. If someone
//      wires affinity rolls later, this flips RED and forces a registry update — the audit self-enforces.
//   C. THRESHOLD FIDELITY — deterministic boundary probes prove each mechanic rolls at its STATED p
//      (Warmaster 60%, crit at C.Rate, debuff at ACC/RES land chance), catching wrong-probability /
//      wrong-comparison-direction / wrong-stream bugs.
//   D. CONSUMPTION — forcing the roll pass vs fail must FLIP world state (the roll actually MATTERS;
//      a rolled-but-inert mechanic is the RNG form of represented-but-not-consumed).
//   E. STREAM ISOLATION — the separate-streams design CLAIMS a change in one mechanic's rolls does not
//      perturb another stream's sequence. That claim was never tested. Here it is.
//
// Run: node tools/sim-rolls.mjs   (no DB, deterministic)

import { makeCombatant, makeState, simulate, makeRngStreams, RNG_STREAMS, WARMASTER_PROC, STRONG_HIT_CHANCE } from '../lib/sim/engine.js';

let pass = 0, fail = 0; const failures = [];
const ok = (name, cond, detail = '') => { if (cond) pass++; else { fail++; failures.push(`${name}${detail ? ' — ' + detail : ''}`); } };

// ── the instrumented stream bundle ─────────────────────────────────────────────
// spec[stream] = number (constant) | array (sequence, clamps to the last value) | undefined (real,
// seeded). Every draw is counted and its value recorded, so a scenario can assert both THAT a stream was
// drawn and WHAT it returned. Underlying randomness is a real seeded mulberry32 so runs stay reproducible.
function bundle(spec = {}, seed = 12345) {
  const real = makeRngStreams(seed);
  const counts = {}, values = {}, rng = {};
  for (const k of RNG_STREAMS) {
    counts[k] = 0; values[k] = [];
    const s = spec[k];
    let src;
    if (Array.isArray(s)) { let i = 0; src = () => s[Math.min(i++, s.length - 1)]; }
    else if (typeof s === 'number') { src = () => s; }
    else { src = real[k]; }
    rng[k] = () => { counts[k]++; const v = src(); values[k].push(v); return v; };
  }
  return { rng, counts, values };
}

// ── fixtures (mirror sim-effects.mjs) ──────────────────────────────────────────
const champ = (o = {}) => makeCombatant({
  name: o.name ?? 'C', side: 'ally', maxHp: o.maxHp ?? 10000, atk: o.atk ?? 1000,
  def: o.def ?? 1000, spd: o.spd ?? 100, acc: o.acc ?? 100, res: o.res ?? 50,
  critRate: o.critRate ?? 0, critDmg: o.critDmg ?? 0, affinity: o.affinity ?? 'Void', skills: o.skills ?? [], ...o,
});
const dummyEnemy = (o = {}) => makeCombatant({
  name: o.name ?? 'E', side: 'enemy', role: 'boss', maxHp: o.maxHp ?? 1e9,
  atk: o.atk ?? 0, def: o.def ?? 0, spd: o.spd ?? 1, res: o.res ?? 0, affinity: o.affinity ?? 'Void', ...o,
});
const atk = (slot, coeff, extra = {}) => ({ slot, cooldown: 0, cdLeft: 0, hitsEnemies: true, coeff, ...extra });
const bossContent = (enemies) => ({ phases: [{ name: 'boss', enemies, actEnemy() {} }] });
const runQuiet = (st, content, opts) => { const l = console.log; console.log = () => {}; const r = simulate(st, content, opts); console.log = l; return r; };

const drawnSomewhere = new Set();   // union of streams drawn across all coverage scenarios (for the summary)
const cover = (b) => { for (const k of RNG_STREAMS) if (b.counts[k] > 0) drawnSomewhere.add(k); };

// ══ PART A — INSTRUMENT TEETH ══════════════════════════════════════════════════
{
  const b = bundle({ crit: [0.3, 0.7] });
  b.rng.crit(); b.rng.crit();
  ok('instrument counts each draw', b.counts.crit === 2 && b.values.crit.length === 2, `count=${b.counts.crit}`);
  const b2 = bundle({ damage: [0.1, 0.2] });
  ok('instrument replays a scripted sequence then clamps to the last value',
     b2.rng.damage() === 0.1 && b2.rng.damage() === 0.2 && b2.rng.damage() === 0.2);
}

// ══ PART B — STREAM COVERAGE (the registry, executed) ══════════════════════════
// crit stream — drawn by any attack that can crit
{
  const b = bundle();
  const st = makeState({ allies: [champ({ critRate: 50, critDmg: 100, skills: [atk('A1', 2)] })], enemies: [], rng: b.rng });
  runQuiet(st, bossContent([dummyEnemy({ maxHp: 1e9, spd: 1 })]), { turnCap: 1 }); cover(b);
  ok('COVERAGE crit: the crit stream is drawn on an attack', b.counts.crit > 0, `draws=${b.counts.crit}`);
}
// debuff stream — drawn by an ACC/RES land roll
{
  const b = bundle();
  const st = makeState({ allies: [champ({ acc: 100, skills: [atk('A2', 1, { debuffs: [{ type: 'Decrease Defense', value: 60, turns: 2 }] })] })], enemies: [], rng: b.rng });
  runQuiet(st, bossContent([dummyEnemy({ maxHp: 1e9, res: 150, spd: 1 })]), { turnCap: 1 }); cover(b);
  ok('COVERAGE debuff: the debuff stream is drawn on a placement/land roll', b.counts.debuff > 0, `draws=${b.counts.debuff}`);
}
// mastery stream — drawn by a boss-mastery champ's attack (Warmaster proc)
{
  const b = bundle();
  const st = makeState({ allies: [champ({ bossMastery: true, skills: [atk('A1', 2)] })], enemies: [], rng: b.rng });
  runQuiet(st, bossContent([dummyEnemy({ maxHp: 1e9, spd: 1 })]), { turnCap: 1 }); cover(b);
  ok('COVERAGE mastery: the mastery stream is drawn when a Warmaster champ attacks', b.counts.mastery > 0, `draws=${b.counts.mastery}`);
}
// gear stream — drawn by a COMPLETE on-attack proc set (Toxic) when the wearer attacks
{
  const b = bundle();
  const st = makeState({ allies: [champ({ gearProcs: [{ set: 'Toxic', trigger: 'on_attack', chance: 0.75, effect: 'Poison', value: 0.025, turns: 2 }], skills: [atk('A1', 2)] })], enemies: [], rng: b.rng });
  runQuiet(st, bossContent([dummyEnemy({ maxHp: 1e9, spd: 1 })]), { turnCap: 1 }); cover(b);
  ok('COVERAGE gear: the gear stream is drawn on an attack with a complete proc set', b.counts.gear > 0, `draws=${b.counts.gear}`);
}
// affinity stream — drawn on an ADVANTAGE/DISADVANTAGE matchup (Magic > Spirit), NOT on a neutral/Void one
{
  const b = bundle();
  const st = makeState({ allies: [champ({ affinity: 'Magic', skills: [atk('A1', 2)] })], enemies: [], rng: b.rng });
  runQuiet(st, bossContent([dummyEnemy({ affinity: 'Spirit', maxHp: 1e9, spd: 1 })]), { turnCap: 1 }); cover(b);
  ok('COVERAGE affinity: the affinity stream is drawn on an advantage matchup (Magic>Spirit)', b.counts.affinity > 0, `draws=${b.counts.affinity}`);
}
// RESERVED streams stay UNDRAWN; affinity draws NOTHING on a neutral/Void matchup; seed=null builds no streams
{
  const b = bundle();
  const st = makeState({ allies: [champ({ affinity: 'Void', critRate: 50, acc: 100, bossMastery: true, skills: [atk('A1', 2, { debuffs: [{ type: 'Poison', pct: 0.05, turns: 3 }] })] })], enemies: [], rng: b.rng });
  runQuiet(st, bossContent([dummyEnemy({ affinity: 'Void', maxHp: 1e12, res: 150, spd: 1 })]), { turnCap: 6 });
  ok('COVERAGE affinity: NO draw on a neutral/Void matchup (no roll needed)', b.counts.affinity === 0, `draws=${b.counts.affinity}`);
  ok('COVERAGE ai: the ai stream stays UNDRAWN (registry: reserved)', b.counts.ai === 0, `draws=${b.counts.ai}`);
  ok('COVERAGE target: the target stream stays UNDRAWN on the base path (recipe-only random_ally)', b.counts.target === 0, `draws=${b.counts.target}`);
}
{
  const st = makeState({ allies: [champ({ critRate: 50 })], enemies: [], seed: null });
  ok('DETERMINISM: seed=null builds NO streams (Model boundary — nothing can roll)', st.rng === null);
}

// ══ PART C+D — THRESHOLD FIDELITY & CONSUMPTION (rolls at its STATED p, and it MATTERS) ══
// Warmaster proc = WARMASTER_PROC (0.60): draw < 0.60 applies, >= misses. Boundary probe.
function warmasterConsumed(procVal) {
  const b = bundle({ mastery: [procVal] });
  const st = makeState({ allies: [champ({ bossMastery: true, skills: [atk('A1', 2)] })], enemies: [], rng: b.rng });
  const r = runQuiet(st, bossContent([dummyEnemy({ maxHp: 1e9, spd: 1 })]), { turnCap: 1 });
  return r.effects.some(e => e.subtype === 'Warmaster' && e.consumed);
}
ok(`FIDELITY Warmaster: APPLIES just below its ${Math.round(WARMASTER_PROC * 100)}% proc (0.59)`, warmasterConsumed(0.59));
ok(`FIDELITY Warmaster: MISSES just above its ${Math.round(WARMASTER_PROC * 100)}% proc (0.61)`, !warmasterConsumed(0.61));

// crit at C.Rate=50%: draw 0.49 crits (more damage), 0.51 does not
function critDamage(critVal) {
  const enemy = dummyEnemy({ maxHp: 1e9, def: 0, spd: 1 });
  const b = bundle({ crit: [critVal] });
  const st = makeState({ allies: [champ({ critRate: 50, critDmg: 100, skills: [atk('A1', 2)] })], enemies: [], rng: b.rng });
  runQuiet(st, bossContent([enemy]), { turnCap: 1 });
  return 1e9 - enemy.hp;
}
{
  const dCrit = critDamage(0.49), dNo = critDamage(0.51);
  ok('FIDELITY crit: 0.49 < 0.50 crits, 0.51 does not — the crit deals more', dCrit > dNo, `crit=${dCrit} nocrit=${dNo}`);
}

// debuff land at ACC 100 vs RES 150 under Raid's REAL two-branch curve: x=(RES−ACC)/100=0.50 (≥0.30 branch),
// P_resist = 0.30 + 0.67·(1−e^(3(0.30−x))) = 0.6023 → landChance ≈ 0.3977. Draw 0.35 lands, 0.45 resists.
// (Was written for the OLD linear 1−50/100=0.50 threshold; updated to the source-verified formula.)
function debuffLanded(landVal) {
  const b = bundle({ debuff: [landVal] });
  const st = makeState({ allies: [champ({ acc: 100, skills: [atk('A2', 1, { debuffs: [{ type: 'Decrease Defense', value: 60, turns: 2 }] })] })], enemies: [], rng: b.rng });
  const r = runQuiet(st, bossContent([dummyEnemy({ maxHp: 1e9, res: 150, spd: 1 })]), { turnCap: 1 });
  return r.effects.some(e => e.kind === 'debuff' && e.subtype === 'Decrease Defense' && e.consumed);
}
ok('FIDELITY debuff: LANDS below its ~0.3977 ACC/RES land chance (draw 0.35)', debuffLanded(0.35));
ok('FIDELITY debuff: RESISTS above its land chance (draw 0.45)', !debuffLanded(0.45));

// affinity advantage Strong-hit at STRONG_HIT_CHANCE (0.50): roll below → Strong (×1.30), above → Normal.
// crit suppressed (0.99) so the delta is purely the affinity hit-type. Magic>Spirit = advantage.
function advantageDamage(affVal) {
  const enemy = dummyEnemy({ name: 'Spirit', affinity: 'Spirit', maxHp: 1e9, def: 0, spd: 1 });
  const b = bundle({ affinity: [affVal], crit: [0.99] });
  const st = makeState({ allies: [champ({ affinity: 'Magic', critRate: 50, critDmg: 100, skills: [atk('A1', 2)] })], enemies: [], rng: b.rng });
  runQuiet(st, bossContent([enemy]), { turnCap: 1 });
  return 1e9 - enemy.hp;
}
{
  const t = STRONG_HIT_CHANCE;
  const dStrong = advantageDamage(t - 0.01), dNormal = advantageDamage(t + 0.01);
  ok(`FIDELITY affinity: advantage rolls Strong below its ${Math.round(t * 100)}% chance (+30% dmg), Normal above`,
     dStrong > dNormal, `strong=${dStrong} normal=${dNormal}`);
}

// gear proc at the SET chance (Toxic 0.75, ignores ACC/RES): roll 0.74 places Poison, 0.76 misses
function toxicPlaced(gearVal) {
  const b = bundle({ gear: [gearVal] });
  const st = makeState({ allies: [champ({ gearProcs: [{ set: 'Toxic', trigger: 'on_attack', chance: 0.75, effect: 'Poison', value: 0.025, turns: 2 }], skills: [atk('A1', 2)] })], enemies: [], rng: b.rng });
  const r = runQuiet(st, bossContent([dummyEnemy({ maxHp: 1e9, res: 300, spd: 1 })]), { turnCap: 1 });
  return r.effects.some(e => e.kind === 'gear' && e.subtype === 'Poison' && e.consumed);
}
ok('FIDELITY gear: Toxic PLACES below its 75% chance (0.74), ignoring the RES-300 target (gear ignores ACC/RES)', toxicPlaced(0.74));
ok('FIDELITY gear: Toxic MISSES above its 75% chance (0.76)', !toxicPlaced(0.76));

// ══ PART E — STREAM ISOLATION (the decorrelation the design claims but never tested) ══
// Forcing the CRIT stream to a constant must NOT change the DEBUFF stream's draw sequence. Confounder
// controlled: an immortal enemy + fixed turnCap keep the fight length identical, so any difference in the
// debuff sequence would be genuine cross-stream perturbation, not a shorter/longer fight.
function debuffSequence(critSpec, seed) {
  const b = bundle({ crit: critSpec }, seed);
  const st = makeState({ allies: [champ({ acc: 100, critRate: 50, critDmg: 100,
    skills: [atk('A2', 1, { debuffs: [{ type: 'Poison', pct: 0.05, turns: 5 }] })] })], enemies: [], rng: b.rng });
  runQuiet(st, bossContent([dummyEnemy({ maxHp: 1e15, res: 150, spd: 1 })]), { turnCap: 8 });
  return b.values.debuff.slice();
}
{
  const seqReal = debuffSequence(undefined, 777);   // real crit stream
  const seqForced = debuffSequence(0.0, 777);        // crit forced to always-crit
  ok('ISOLATION: forcing the crit stream does not perturb the debuff stream sequence',
     seqReal.length > 0 && JSON.stringify(seqReal) === JSON.stringify(seqForced),
     `realLen=${seqReal.length} forcedLen=${seqForced.length} match=${JSON.stringify(seqReal) === JSON.stringify(seqForced)}`);
}

// ── report ─────────────────────────────────────────────────────────────────────
console.log(`\n══ SIM ROLLS — the roll census (rung) ══  ${pass} passed, ${fail} failed\n`);
for (const f of failures) console.log(`  ✗ ${f}`);
if (!fail) console.log('  ✅ every LIVE RNG mechanic draws its stream at its stated probability, streams stay decorrelated, and the reserved streams are still dead');
// WHY a stream is undrawn here (per RNG_REGISTRY.md) — so "undrawn" isn't read as "broken":
//   damage   — DORMANT: only drawn when SIM_DMG_VAR>0 (a flagged bracket) or the recipe damage-mod path fires
//   target   — RECIPE-ONLY: drawn by the interpreter's random_ally, not the base-engine path exercised here
//   affinity — RESERVED: WEAK/STRONG hit is not yet rolled (flat 1.30/0.70) — needs the strong/weak magnitude
//   ai       — RESERVED: AI-choice RNG not modelled (tie-breaks are deterministic on purpose)
const UNDRAWN_REASON = { damage: 'dormant (SIM_DMG_VAR off)', target: 'recipe-only (random_ally)', ai: 'reserved (AI RNG unmodelled)' };
const live = RNG_STREAMS.filter(k => drawnSomewhere.has(k));
const dead = RNG_STREAMS.filter(k => !drawnSomewhere.has(k));
console.log(`\n  streams DRAWN (live):    ${live.join(', ') || '(none)'}`);
console.log('  streams UNDRAWN:');
for (const k of dead) console.log(`      - ${k.padEnd(9)} ${UNDRAWN_REASON[k] ?? 'unclassified — check RNG_REGISTRY.md'}`);

console.log('QA_JSON ' + JSON.stringify({ rung: 'rolls', pass, fail, failures, streamsDrawn: live, streamsUndrawn: dead }));
if (fail) process.exit(1);
