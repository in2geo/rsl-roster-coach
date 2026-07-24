// tools/model-sensitivity.mjs — MODEL QA · sensitivity tests (metamorphic, protocol layer 6).
//
// The Model's outputs must move in SENSIBLE DIRECTIONS when one input changes — and must NOT move where the
// game says they don't (carve-outs: heals/shields scale off the caster's HP, not ATK). Each test is
// baseline vs one-input-perturbed, with a non-vacuous guard (baseline > 0) so a vacuous "0 vs 0" can't pass.
// A wrong direction is a spec violation → blocks. No DB, deterministic. Run: node tools/model-sensitivity.mjs

import { makeCombatant, makeState, nextActor, tickDots } from '../lib/sim/engine.js';
import { applyRecipe, incomingDamage } from '../lib/sim/interpreter.js';
import { RECIPES } from '../lib/sim/recipes.js';

let pass = 0, fail = 0;
const T = (name, ok, detail = '') => { ok ? pass++ : fail++; console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`); };

const enemy = (def = 1000, res = 100) => makeCombatant({ name: 'Mob', side: 'enemy', maxHp: 1e9, def, res, affinity: 'Void' });
// one DEAL_DAMAGE hit of a given recipe by an attacker with given stats, vs a target of given DEF
function hit(recipeKey, { atk = 3000, hp = 20000, def = 1000, cr = 0, cd = 50, ignoreScaling = 'ATK' } = {}, targetDef = 1000) {
  const a = makeCombatant({ name: 'Hero', side: 'ally', atk, maxHp: hp, def, critRate: cr, critDmg: cd, affinity: 'Void' });
  const t = enemy(targetDef);
  const st = makeState({ allies: [a], enemies: [t], seed: null });
  const r = applyRecipe(st, a, { ...RECIPES[recipeKey], actions: RECIPES[recipeKey].actions.map(x => x.op === 'ACQUIRE_TARGETS' ? { ...x, targetIf: undefined, target: 'single' } : x) });
  return r[0]?.raw_damage ?? 0;
}
// land rate of a debuff over N seeds
function landRate(recipeKey, { acc, res }, n = 3000) {
  const rec = { ...RECIPES[recipeKey], actions: RECIPES[recipeKey].actions.map(x => x.op === 'ACQUIRE_TARGETS' ? { ...x, targetIf: undefined, target: 'single' } : x) };
  const dtype = rec.actions.find(x => x.op === 'PLACE_DEBUFF')?.effect.type;
  let landed = 0;
  for (let s = 1; s <= n; s++) {
    const a = makeCombatant({ name: 'Hero', side: 'ally', atk: 3000, acc, affinity: 'Void', critRate: 0 });
    const t = enemy(1000, res);
    applyRecipe(makeState({ allies: [a], enemies: [t], seed: s }), a, rec);
    if (t.debuffs.some(d => d.type === dtype)) landed++;
  }
  return landed / n;
}

console.log('\n══ MODEL SENSITIVITY (layer 6) — directions + game-fact carve-outs ══\n');

// ── directions ──
{ const lo = hit('BAMBUS-A1', { atk: 2000 }), hi = hit('BAMBUS-A1', { atk: 3000 }); T('+ATK → +damage (ATK-scaling)', lo > 0 && hi > lo, `${lo}→${hi}`); }
{ const lo = hit('BAMBUS-A1', { cr: 0 }), hi = hit('BAMBUS-A1', { cr: 60 }); T('+crit rate → +damage', lo > 0 && hi > lo, `${lo}→${hi}`); }
{ const lo = hit('BAMBUS-A1', {}, 1000), hi = hit('BAMBUS-A1', {}, 2500); T('+target DEF → −damage', lo > 0 && hi < lo, `def1000=${lo}, def2500=${hi}`); }
{ const lo = hit('PELOPS-A1', { atk: 0, hp: 20000 }), hi = hit('PELOPS-A1', { atk: 0, hp: 30000 }); T('+caster HP → +damage (HP-scaling skill)', lo > 0 && hi > lo, `hp20k=${lo}, hp30k=${hi}`); }
{ const lo = landRate('BAMBUS-A1', { acc: 60, res: 120 }), hi = landRate('BAMBUS-A1', { acc: 160, res: 120 }); T('+ACC → +debuff land rate', lo > 0 && hi > lo, `${lo.toFixed(2)}→${hi.toFixed(2)}`); }
{ const lo = landRate('BAMBUS-A1', { acc: 120, res: 40 }), hi = landRate('BAMBUS-A1', { acc: 120, res: 200 }); T('+target RES → −debuff land rate', lo > 0 && hi < lo, `res40=${lo.toFixed(2)}, res200=${hi.toFixed(2)}`); }
// Pelops −20% modifier present vs absent
{ const withP = incomingDamage(makeState({ allies: [makeCombatant({ name: 'Pelops', side: 'ally', maxHp: 28000 }), makeCombatant({ name: 'A', side: 'ally', maxHp: 20000 })], enemies: [], seed: null }), makeCombatant({ name: 'A', side: 'ally', maxHp: 20000 }), 1000);
  // (rebuild the target reference inside the state)
  const st = makeState({ allies: [makeCombatant({ name: 'Pelops', side: 'ally', maxHp: 28000 })], enemies: [], seed: null }); const tgt = makeCombatant({ name: 'A', side: 'ally', maxHp: 20000 }); st.allies.push(tgt);
  const withMod = incomingDamage(st, tgt, 1000);
  const st2 = makeState({ allies: [], enemies: [], seed: null }); const tgt2 = makeCombatant({ name: 'A', side: 'ally', maxHp: 20000 }); st2.allies.push(tgt2);
  const without = incomingDamage(st2, tgt2, 1000);
  T('Pelops −20% present → less incoming than without it', without === 1000 && withMod < without, `with=${withMod} without=${without}`); void withP; }

// ── SPD turn-order consumer: the scheduler must honour [Increase SPD]/[Decrease Speed] ──
// Two identical combatants; modify A's speed via a buff/debuff; run the REAL scheduler K steps and count
// turns. If nextActor ignored the modifier (raw c.spd), A and B would tie — so these directions have teeth
// on the scheduler, not just on statFactor.
function turnCounts(aBuffs = [], aDebuffs = [], baseSpd = 100, steps = 40) {
  const A = makeCombatant({ name: 'A', side: 'ally', spd: baseSpd, maxHp: 1e6, affinity: 'Void' });
  const B = makeCombatant({ name: 'B', side: 'ally', spd: baseSpd, maxHp: 1e6, affinity: 'Void' });
  A.buffs = aBuffs; A.debuffs = aDebuffs;
  const st = makeState({ allies: [A, B], enemies: [], seed: null });
  const c = { A: 0, B: 0 };
  for (let i = 0; i < steps; i++) { const act = nextActor(st); if (act) c[act.name]++; }
  return c;
}
{ const c = turnCounts(); T('SPD baseline: equal SPD → equal turns', c.A > 0 && c.A === c.B, `A=${c.A} B=${c.B}`); }
{ const c = turnCounts([{ type: 'Increase SPD', value: 30 }]); T('+[Increase SPD] → more turns than an equal-SPD ally', c.A > 0 && c.A > c.B, `buffed=${c.A} plain=${c.B}`); }
{ const c = turnCounts([], [{ type: 'Decrease Speed', value: 30 }]); T('+[Decrease Speed] → fewer turns than an equal-SPD ally', c.B > 0 && c.A < c.B, `slowed=${c.A} plain=${c.B}`); }

// ── Poison Sensitivity consumer: [Poison Sensitivity] amplifies each [Poison] tick ──
// tickDots the same Poison on a target WITH vs WITHOUT [Poison Sensitivity 25%]; the sensitised tick must be
// exactly ×1.25. Exercises the real tickDots, so a mutant dropping the amplifier fails here (teeth).
function poisonTick(sensitivityValue) {
  const c = makeCombatant({ name: 'Mob', side: 'enemy', maxHp: 100000, affinity: 'Void' });
  c.debuffs.push({ type: 'Poison', pct: 0.05, stacks: 1, turnsLeft: 2 });
  if (sensitivityValue != null) c.debuffs.push({ type: 'Poison Sensitivity', value: sensitivityValue, turnsLeft: 2 });
  const before = c.hp;
  tickDots(makeState({ allies: [], enemies: [c], seed: null }), c);
  return before - c.hp;
}
{ const base = poisonTick(null), amp = poisonTick(25);
  T('+[Poison Sensitivity] → more Poison tick damage', base > 0 && amp > base, `base=${base} sens25=${amp}`); }
{ const base = poisonTick(null), amp = poisonTick(25);   // 5000 → 6250, exact
  T('[Poison Sensitivity] 25% amplifies the tick by exactly ×1.25', base > 0 && amp === base * 1.25, `base=${base} sens25=${amp}`); }

// ── carve-outs (directions the game does NOT have) ──
{ // HEAL scales off caster MAX HP, not ATK → changing ATK must NOT change the heal
  const heal = (atk) => { const tag = makeCombatant({ name: 'Tagoar', side: 'ally', atk, maxHp: 20000, affinity: 'Void' }); const ally = makeCombatant({ name: 'A', side: 'ally', maxHp: 20000, affinity: 'Void' }); ally.hp = 5000;
    applyRecipe(makeState({ allies: [tag, ally], enemies: [enemy()], seed: null }), tag, RECIPES['TAGOAR-A2']); return ally.hp; };
  const a = heal(500), b = heal(5000); T('carve-out: HEAL unchanged when ATK changes (scales off HP)', a > 5000 && a === b, `atk500=${a}, atk5000=${b}`); }
{ // SHIELD value scales off caster MAX HP, not ATK
  const shield = (atk) => { const pel = makeCombatant({ name: 'Pelops', side: 'ally', atk, maxHp: 28000, affinity: 'Void' }); const ally = makeCombatant({ name: 'A', side: 'ally', maxHp: 20000, affinity: 'Void' });
    applyRecipe(makeState({ allies: [pel, ally], enemies: [enemy()], seed: null }), pel, RECIPES['PELOPS-A3']); return ally.buffs.find(x => x.type === 'Magma Shield')?.value ?? 0; };
  const a = shield(500), b = shield(5000); T('carve-out: SHIELD value unchanged when ATK changes (scales off HP)', a > 0 && a === b, `atk500=${a}, atk5000=${b}`); }

console.log(`\n══ ${pass} passed, ${fail} failed ══`);
console.log('QA_JSON ' + JSON.stringify({ rung: 'model-sensitivity', pass, fail }));
process.exit(fail ? 1 : 0);
