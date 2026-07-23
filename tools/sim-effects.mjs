// tools/sim-effects.mjs — QA PROTOCOL RUNG: FIRED vs CONSUMED (the two metrics).
//
// The turn loop was supposed to make omissions impossible, but only at the granularity it has steps
// for. The recurring bug in this engine is NOT "the sim disobeys a decision" (rung 2 catches that) —
// it is "a mechanic is REPRESENTED but never CONSUMED": the buff is in the list, the code path looks
// like it ran, and nothing actually changed in world state. That has happened five times (passives
// cast as actions, shields never absorbing, CC never costing a turn, the purple bar never draining,
// onDamageToBoss never called). Each was found by a human tracing a fight. This rung finds the class
// automatically.
//
// TWO METRICS per effect (recorded by the engine's ledger, engine.recordEffect):
//   fired    — the ability activated (skill selected / passive triggered / DoT ticked).
//   consumed — the intended change actually LANDED in world state, measured as a real state delta.
// `fired=yes, consumed=no` with NO documented reason is the defect. A documented reason (resisted,
// immune, overheal at full HP, nothing to cleanse, or a DATA gap like a missing coefficient) is
// benign — the effect correctly did nothing.
//
// THREE PARTS, each teeth-checked (a rung that cannot fail is worthless — Simulator QA Protocol):
//   A. DETECTOR TEETH — feed the classifier hand-built ledgers; a known-bad MUST flag, a known-good
//      MUST pass. Proves the CHECK discriminates, independent of the engine.
//   B. LIVE INVARIANT — run synthetic single-mechanic fights through the real engine and assert every
//      fired effect is consumed (or benign). This is GREEN today because those five bugs are fixed;
//      it FAILS the moment any of them regresses.
//   C. DEMONSTRATED BLANKS — a mechanic that the design silently forgot. A champion whose PASSIVE
//      grants a buff enters combat and the buff never appears: there is no passive-trigger system.
//      This is reported as a bucket-2 finding — DEMONSTRATED by a running test, not hand-declared in
//      a manifest. It does NOT block (it is a known-missing mechanic, not a broken one).
//
// Run: node tools/sim-effects.mjs   (no DB, deterministic)

import { makeCombatant, makeState, simulate, actEnemyMob as import_actEnemyMob } from '../lib/sim/engine.js';
import { readSkillKit } from '../lib/sim/ai.js';

let pass = 0, fail = 0; const failures = [];
const ok = (name, cond, detail = '') => { if (cond) pass++; else { fail++; failures.push(`${name}${detail ? ' — ' + detail : ''}`); } };

// ── the classifier under test: which fired effects are UNEXPLAINED (the real defect)? ──
// A fired-but-not-consumed effect is benign ONLY with a documented reason. Everything else is a
// represented-but-not-consumed bug. `MISSING coeff` / `UNKNOWN land chance` are DATA gaps (bucket 3),
// benign for THIS rung (the mechanic works; the input is absent) and surfaced separately.
const BENIGN = [/^immune$/, /^resisted /, /^overheal/, /^no debuffs to cleanse$/, /^turn lost$/];
const DATA_GAP = [/^MISSING coeff$/, /^UNKNOWN land chance$/];
const explained = (re) => (e) => re.some(r => r.test(e.note ?? ''));
const isBenign = explained(BENIGN);
const isDataGap = explained(DATA_GAP);
export function unexplainedDrops(effects) {
  return effects.filter(e => e.fired && !e.consumed && !isBenign(e) && !isDataGap(e));
}

// ── fixtures (mirror sim-selftest.mjs) ─────────────────────────────────────────
const champ = (o = {}) => makeCombatant({
  name: o.name ?? 'C', side: 'ally', maxHp: o.maxHp ?? 10000, atk: o.atk ?? 1000,
  def: o.def ?? 1000, spd: o.spd ?? 100, acc: o.acc ?? 200, res: o.res ?? 50,
  critRate: 0, critDmg: 0, affinity: o.affinity ?? 'Void', skills: o.skills ?? [], ...o,
});
const dummyEnemy = (o = {}) => makeCombatant({
  name: o.name ?? 'E', side: 'enemy', role: 'boss', maxHp: o.maxHp ?? 1e9,
  atk: o.atk ?? 0, def: o.def ?? 0, spd: o.spd ?? 1, res: o.res ?? 0, affinity: o.affinity ?? 'Void', ...o,
});
const bossContent = (enemies) => ({ phases: [{ name: 'boss', enemies, actEnemy() {} }] });
const runQuiet = (st, content, opts) => { const l = console.log; console.log = () => {}; const r = simulate(st, content, opts); console.log = l; return r; };

// ══ PART A — DETECTOR TEETH (the check must discriminate) ══════════════════════
{
  const knownBad = [
    { fired: true, consumed: false, kind: 'buff', subtype: 'Shield' },          // shield placed, absorbed nothing
    { fired: true, consumed: false, kind: 'cc', subtype: 'Stun' },              // stun applied, turn not lost
  ];
  const knownGood = [
    { fired: true, consumed: true, kind: 'damage' },
    { fired: true, consumed: false, kind: 'debuff', note: 'resisted 30%' },     // legitimately did not land
    { fired: true, consumed: false, kind: 'heal', note: 'overheal (target at full)' },
    { fired: true, consumed: false, kind: 'damage', note: 'MISSING coeff' },    // data gap, not a bug
  ];
  ok('detector FLAGS a represented-but-not-consumed ledger (teeth)', unexplainedDrops(knownBad).length === 2,
     `flagged ${unexplainedDrops(knownBad).length}/2`);
  ok('detector PASSES a clean ledger with documented non-consumption', unexplainedDrops(knownGood).length === 0,
     `flagged ${unexplainedDrops(knownGood).length}`);
}

// ══ PART B — LIVE INVARIANT (every fired effect is consumed, on the real engine) ══
const scenarios = [];

// damage lands
scenarios.push(['direct damage', () => {
  const st = makeState({ allies: [champ({ spd: 100, atk: 1000, skills: [{ slot: 'A1', cooldown: 0, cdLeft: 0, hitsEnemies: true, coeff: 2 }] })], enemies: [] });
  return runQuiet(st, bossContent([dummyEnemy({ maxHp: 1e6, def: 0, spd: 1 })]), { turnCap: 1 });
}]);

// shield buff placed AND absorbs an incoming hit (fired + consumed on BOTH the place and the absorb)
scenarios.push(['shield placed and absorbs', () => {
  const shielder = champ({ name: 'Shielder', spd: 120, maxHp: 20000,
    skills: [{ slot: 'A3', cooldown: 0, cdLeft: 0, hitsEnemies: false,
               buffs: [{ type: 'Magma Shield', pctOfCasterMaxHp: 0.3, self: false, turns: 3 }] }] });
  const boss = dummyEnemy({ name: 'Hitter', maxHp: 1e9, atk: 2000, def: 0, spd: 60,
    skills: [{ slot: 'A1', cooldown: 0, cdLeft: 0, hitsEnemies: true, coeff: 1 }] });
  const st = makeState({ allies: [shielder], enemies: [] });
  // boss uses the generic mob action so it actually attacks (exercises the shield absorb path)
  const content = { phases: [{ name: 'boss', enemies: [boss], actEnemy(s, a) { import_actEnemyMob(s, a); } }] };
  return runQuiet(st, content, { turnCap: 4 });
}]);

// debuff lands (ACC 200 clears RES 0)
scenarios.push(['debuff lands', () => {
  const st = makeState({ allies: [champ({ spd: 100, acc: 200, skills: [{ slot: 'A2', cooldown: 0, cdLeft: 0, hitsEnemies: true, coeff: 1, debuffs: [{ type: 'Decrease Defense', value: 60, turns: 2 }] }] })], enemies: [] });
  return runQuiet(st, bossContent([dummyEnemy({ maxHp: 1e6, def: 0, res: 0, spd: 1 })]), { turnCap: 1 });
}]);

// heal lands on a hurt ally
scenarios.push(['heal lands', () => {
  const healer = champ({ name: 'Healer', spd: 120, maxHp: 20000, skills: [{ slot: 'A3', cooldown: 0, cdLeft: 0, hitsEnemies: false, healPct: 0.2, aoeHeal: true }] });
  const hurt = champ({ name: 'Hurt', spd: 1, maxHp: 20000 }); hurt.hp = 5000;
  const st = makeState({ allies: [healer, hurt], enemies: [] });
  return runQuiet(st, bossContent([dummyEnemy({ spd: 1 })]), { turnCap: 1 });
}]);

// revive brings back a dead ally
scenarios.push(['revive lands', () => {
  const reviver = champ({ name: 'Reviver', spd: 120, skills: [{ slot: 'A3', cooldown: 0, cdLeft: 0, hitsEnemies: false, revives: true }] });
  const dead = champ({ name: 'Fallen', spd: 1 }); dead.alive = false; dead.hp = 0;
  const st = makeState({ allies: [reviver, dead], enemies: [] });
  return runQuiet(st, bossContent([dummyEnemy({ spd: 1 })]), { turnCap: 1 });
}]);

// DoT ticks
scenarios.push(['DoT ticks', () => {
  const victim = champ({ name: 'Victim', spd: 100, maxHp: 10000 });
  victim.debuffs.push({ type: 'Poison', pct: 0.05, stacks: 2, turnsLeft: 9 });
  const st = makeState({ allies: [victim], enemies: [] });
  return runQuiet(st, bossContent([dummyEnemy({ spd: 1 })]), { turnCap: 1 });
}]);

// CC costs a turn
scenarios.push(['CC costs a turn', () => {
  const stunned = champ({ name: 'Stunned', spd: 100, skills: [{ slot: 'A1', cooldown: 0, cdLeft: 0, hitsEnemies: true, coeff: 1 }] });
  stunned.debuffs.push({ type: 'Stun', turnsLeft: 5 });
  const st = makeState({ allies: [stunned], enemies: [] });
  return runQuiet(st, bossContent([dummyEnemy({ spd: 1 })]), { turnCap: 2 });
}]);

const allEffects = [];
for (const [name, run] of scenarios) {
  const r = run();
  allEffects.push(...r.effects);
  const drops = unexplainedDrops(r.effects);
  const fired = r.effects.filter(e => e.fired).length;
  ok(`live: '${name}' — all ${fired} fired effect(s) consumed (or benign)`, drops.length === 0,
     drops.map(d => `${d.source} ${d.kind}${d.subtype ? '/' + d.subtype : ''}→${d.target}`).join(', '));
}

// ══ PART C — DEMONSTRATED BLANK: passive effects never fire (no trigger system) ══
const blanks = [];
{
  // A champion whose ONLY effect-bearing skill is a passive that grants [Perfect Veil]. On a real
  // engine the veil would be on her within a turn. Here we assert it NEVER appears — the demonstration
  // that there is no passive-trigger system. (This is the Ezio one-shot, reduced to one assertion.)
  const kit = readSkillKit([
    { slot: 'A1', skill_name: 'Poke', skill_summary: 'Attacks 1 enemy.', cooldown_base: '0', damage_multiplier: '1' },
    { slot: 'Passive', skill_name: 'Ghostwalk [P]', skill_summary: 'Places a [Perfect Veil] buff on this Champion at the start of each turn.', cooldown_base: null, damage_multiplier: null },
  ]);
  const veiled = makeCombatant({ name: 'Veiled', side: 'ally', maxHp: 10000, atk: 1000, def: 1000, spd: 100, acc: 100, res: 50, affinity: 'Void', skills: kit });
  const st = makeState({ allies: [veiled], enemies: [] });
  const r = runQuiet(st, bossContent([dummyEnemy({ maxHp: 1e9, spd: 1 })]), { turnCap: 6 });
  const veilEverPresent = veiled.buffs.some(b => b.type === 'Perfect Veil');
  const passiveEverFired = r.effects.some(e => /Perfect Veil/.test(e.subtype ?? '') || /Ghostwalk/.test(e.source ?? ''));
  if (!veilEverPresent && !passiveEverFired) {
    blanks.push('passive effects never fire — no passive-trigger system (demonstrated: a passive [Perfect Veil] never lands; this is the Ezio-one-shot root cause)');
  } else {
    // If this branch is ever hit, a passive-trigger system exists — flip the blank into a normal
    // invariant check so the rung keeps testing it.
    ok('passive-sourced [Perfect Veil] actually lands on its champion', veilEverPresent);
  }
}

// ══ PART D — CONSUMER-SIDE BLANK: a buff PRESENT in the list but IGNORED at the point of use ══
// The producer-side detector above measures whether an effect changed state WHEN APPLIED. A
// PERSISTENT buff has a SECOND consumption site: it must be HONORED by whoever reads it later —
// targeting, the damage calc. That is why "consumed = the buff entered the list" is only half the
// story: a shield in the list that never absorbs, or a [Perfect Veil] in the list that targeting
// ignores, is REPRESENTED-but-not-CONSUMED at the point of use. Here we place the veil DIRECTLY
// (bypassing the missing passive-trigger system from Part C) so this isolates the TARGETING half of
// the Ezio one-shot: [Perfect Veil] is [untargetable], so an enemy MUST skip a veiled ally.
{
  const veiled = champ({ name: 'Veiled', maxHp: 10000, def: 0 }); veiled.hp = 1000;    // 10% — the lowest HP%, so absent veil-logic it IS the pick
  veiled.buffs.push({ type: 'Perfect Veil', turnsLeft: 3 });
  const exposed = champ({ name: 'Exposed', maxHp: 10000, def: 0 }); exposed.hp = 9000;  // 90% — the correct target once veil is honored
  const mob = makeCombatant({ name: 'Mob', side: 'enemy', role: 'wave', maxHp: 5000, atk: 1000,
    acc: 100, affinity: 'Void', critRate: 0, critDmg: 0,
    skills: [{ slot: 'A1', cooldown: 0, cdLeft: 0, hitsEnemies: true, coeff: 2 }] });
  const st = makeState({ allies: [veiled, exposed], enemies: [mob] });
  import_actEnemyMob(st, mob);
  const veiledHit = veiled.hp < 1000, exposedHit = exposed.hp < 9000;
  if (veiledHit && !exposedHit) {
    blanks.push('[Perfect Veil] ignored by enemy targeting — an untargetable ally is still hit (demonstrated: the mob targets the veiled 10%-HP ally over the exposed 90% ally; the TARGETING half of the Ezio one-shot, distinct from the passive half in Part C)');
  } else {
    // If targeting ever honors veil, flip the blank into a live invariant so it keeps being tested.
    ok('enemy targeting SKIPS a [Perfect Veil] ally when another target exists', exposedHit && !veiledHit,
       `veiledHit=${veiledHit} exposedHit=${exposedHit}`);
  }
}

// ── report ─────────────────────────────────────────────────────────────────────
const dataGaps = allEffects.filter(e => e.fired && !e.consumed && isDataGap(e));
console.log(`\n══ SIM EFFECTS — fired vs consumed (rung) ══  ${pass} passed, ${fail} failed\n`);
for (const f of failures) console.log(`  ✗ ${f}`);
if (!fail) console.log('  ✅ every fired effect is consumed (or benign) — no represented-but-not-consumed defect');
if (blanks.length) {
  console.log('\n  ◻ DEMONSTRATED BLANKS (unimplemented mechanic — does NOT block):');
  for (const b of blanks) console.log(`      - ${b}`);
}
if (dataGaps.length) {
  console.log(`\n  · DATA GAPS surfaced in passing (bucket 3): ${dataGaps.length} fired effect(s) with absent inputs`);
  for (const g of [...new Set(dataGaps.map(d => `${d.source} ${d.kind} — ${d.note}`))].slice(0, 10)) console.log(`      - ${g}`);
}

console.log('QA_JSON ' + JSON.stringify({ rung: 'effects', pass, fail, failures, blanks,
  dataGaps: dataGaps.length }));
if (fail) process.exit(1);
