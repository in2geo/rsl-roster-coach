// tools/sim-recipe-decrease-cooldown-test.mjs — DECREASE_COOLDOWN op proof (both modes).
//
// SELF mode (new): Ninja A3 "Cyan Slash" — "Will also decrease the cooldown of the Hailburn skill by 1 turn."
// The actor reduces its OWN named skill's cooldown. ALLY-WIDE mode (Renegade A3): reduce every ally EXCEPT self.
// Deterministic (seed=null). Run: node tools/sim-recipe-decrease-cooldown-test.mjs
import { makeCombatant, makeState } from '../lib/sim/engine.js';
import { applyRecipe } from '../lib/sim/interpreter.js';
import { RECIPES } from '../lib/sim/recipes.js';

let pass = 0, fail = 0;
const check = (n, c, d = '') => { c ? pass++ : fail++; console.log(`  ${c ? 'PASS' : 'FAIL'}  ${n}${d ? ' — ' + d : ''}`); };
const cd = (c, slot) => c.skills.find((s) => s.slot === slot)?.cdLeft;
const boss = () => makeCombatant({ name: 'Boss', side: 'enemy', role: 'boss', maxHp: 5e8, def: 1200, affinity: 'Magic', critRate: 0 });

console.log('\n=== DECREASE_COOLDOWN — self (own named skill) + ally-wide modes ===\n');

// 1 — SELF + slot: only the named own skill drops; other own skills untouched.
{
  const c = makeCombatant({ name: 'Probe', side: 'ally', atk: 2000, maxHp: 20000, affinity: 'Magic', critRate: 0 });
  c.skills = [{ slot: 'A1', cdLeft: 0 }, { slot: 'A2', cdLeft: 3 }, { slot: 'A3', cdLeft: 2 }];
  const state = makeState({ allies: [c], enemies: [boss()], seed: null });
  applyRecipe(state, c, { slot: 'X', name: 'probe', type: 'active', actions: [
    { seq: 10, op: 'DECREASE_COOLDOWN', target: 'self', effect: { self: true, slot: 'A2', turns: 1 } },
  ] });
  check('own A2 reduced by 1', cd(c, 'A2') === 2, `A2=${cd(c, 'A2')}`);
  check('own A3 (not named) untouched', cd(c, 'A3') === 2, `A3=${cd(c, 'A3')}`);
}

// 2 — SELF, no slot: every own skill on cooldown drops by turns; skills at 0 stay 0 (clamp).
{
  const c = makeCombatant({ name: 'Probe', side: 'ally', atk: 2000, maxHp: 20000, affinity: 'Magic', critRate: 0 });
  c.skills = [{ slot: 'A1', cdLeft: 0 }, { slot: 'A2', cdLeft: 3 }, { slot: 'A3', cdLeft: 1 }];
  const state = makeState({ allies: [c], enemies: [boss()], seed: null });
  applyRecipe(state, c, { slot: 'X', name: 'probe', type: 'active', actions: [
    { seq: 10, op: 'DECREASE_COOLDOWN', target: 'self', effect: { self: true, turns: 1 } },
  ] });
  check('A2 3→2, A3 1→0, A1 stays 0', cd(c, 'A2') === 2 && cd(c, 'A3') === 0 && cd(c, 'A1') === 0, `A2=${cd(c, 'A2')} A3=${cd(c, 'A3')} A1=${cd(c, 'A1')}`);
}

// 3 — real wiring: Ninja A3 shaves 1 off his own Hailburn (A2) cooldown.
{
  const ninja = makeCombatant({ name: 'Ninja', side: 'ally', atk: 3000, maxHp: 20000, acc: 200, affinity: 'Magic', critRate: 0 });
  ninja.skills = [{ slot: 'A1', cdLeft: 0 }, { slot: 'A2', cdLeft: 3 }, { slot: 'A3', cdLeft: 4 }];
  const b = boss();
  const state = makeState({ allies: [ninja], enemies: [b], seed: null });
  const hp0 = b.hp;
  applyRecipe(state, ninja, RECIPES['NINJA-A3']);
  check('Ninja A3 cast hit the boss', b.hp < hp0, `boss took ${Math.round(hp0 - b.hp)}`);
  check('Hailburn (own A2) cooldown 3→2', cd(ninja, 'A2') === 2, `A2=${cd(ninja, 'A2')}`);
  const cds = state.effects.filter((e) => e.kind === 'cooldown' && e.subtype === 'decrease' && e.consumed);
  check('a consumed cooldown-decrease effect was recorded', cds.length === 1 && cds[0].target === 'Ninja', `${cds.length} effect(s)`);
}

// 4 — ally-wide mode unchanged: reduces the OTHER ally, never the caster (regression guard).
{
  const cap = makeCombatant({ name: 'Cap', side: 'ally', atk: 2000, maxHp: 20000, affinity: 'Magic', critRate: 0 });
  cap.skills = [{ slot: 'A1', cdLeft: 0 }, { slot: 'A3', cdLeft: 3 }];
  const mate = makeCombatant({ name: 'Mate', side: 'ally', atk: 2000, maxHp: 20000, affinity: 'Magic', critRate: 0 });
  mate.skills = [{ slot: 'A2', cdLeft: 4 }, { slot: 'A3', cdLeft: 2 }];
  const state = makeState({ allies: [cap, mate], enemies: [boss()], seed: null });
  applyRecipe(state, cap, { slot: 'X', name: 'probe', type: 'active', actions: [
    { seq: 10, op: 'DECREASE_COOLDOWN', effect: { turns: 2 } },
  ] });
  check('ally-wide: the mate\'s cooldowns dropped by 2', cd(mate, 'A2') === 2 && cd(mate, 'A3') === 0, `A2=${cd(mate, 'A2')} A3=${cd(mate, 'A3')}`);
  check('ally-wide: the caster\'s own cooldown is NOT reduced', cd(cap, 'A3') === 3, `cap A3=${cd(cap, 'A3')}`);
}

console.log(`\n${fail ? '✗' : '✓'} DECREASE_COOLDOWN: ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
