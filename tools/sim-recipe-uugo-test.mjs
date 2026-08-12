// tools/sim-recipe-uugo-test.mjs — Uugo authoring proof + the `ifAllAlliesDead` action gate.
//
// Uugo A3 "Uugo's Brew" is mutually-exclusive by team state: cleanse+heal when an ally is alive, but revive+TM
// "instead" when ALL allies are dead. The gate must fire the right branch and never revive a lone dead ally
// mid-fight. Also checks A2's AoE Decrease DEF. Deterministic (seed=null). Run: node tools/sim-recipe-uugo-test.mjs
import { makeCombatant, makeState } from '../lib/sim/engine.js';
import { applyRecipe } from '../lib/sim/interpreter.js';
import { RECIPES } from '../lib/sim/recipes.js';

let pass = 0, fail = 0;
const ck = (n, c, d = '') => { c ? pass++ : fail++; console.log(`  ${c ? 'PASS' : 'FAIL'}  ${n}${d ? ' — ' + d : ''}`); };
const enemy = (name = 'Boss') => makeCombatant({ name, side: 'enemy', role: 'boss', maxHp: 5e8, def: 1500, affinity: 'Void', critRate: 0 });

console.log('\n=== UUGO — cleanse/heal vs clutch-revive (ifAllAlliesDead gate) + AoE Decrease DEF ===\n');

// A3 NORMAL (≥1 ally alive): cleanse + heal, NO revive of a lone dead ally.
{
  const uugo = makeCombatant({ name: 'Uugo', side: 'ally', maxHp: 30000, affinity: 'Void' });
  const ally = makeCombatant({ name: 'Kael', side: 'ally', maxHp: 20000, affinity: 'Void' }); ally.hp = 8000;
  ally.debuffs = [{ type: 'Heal Reduction', value: 100, turnsLeft: 2 }, { type: 'Poison', turnsLeft: 2, stacks: 1 }];
  const dead = makeCombatant({ name: 'Gnut', side: 'ally', maxHp: 24000, affinity: 'Void' }); dead.alive = false; dead.hp = 0;
  applyRecipe(makeState({ allies: [uugo, ally, dead], enemies: [enemy()], seed: null }), uugo, RECIPES['UUGO-A3']);
  ck('normal (an ally alive): heals 20% caster MAX HP (0.2×30000=6000)', ally.hp === 14000, `ally hp ${ally.hp}`);
  ck('normal: does NOT revive the single dead ally (revive gated to all-dead)', dead.alive === false, `dead alive ${dead.alive}`);
  ck('normal: cleansed the debuffs (Heal Reduction gone → heal was full)', ally.debuffs.length === 0, `debuffs left ${ally.debuffs.length}`);
}

// A3 CLUTCH (all other allies dead): revive 50% HP + 50% TM instead; heal branch skipped.
{
  const uugo = makeCombatant({ name: 'Uugo', side: 'ally', maxHp: 30000, affinity: 'Void' });
  const d1 = makeCombatant({ name: 'Kael', side: 'ally', maxHp: 20000, affinity: 'Void' }); d1.alive = false; d1.hp = 0;
  const d2 = makeCombatant({ name: 'Gnut', side: 'ally', maxHp: 24000, affinity: 'Void' }); d2.alive = false; d2.hp = 0;
  applyRecipe(makeState({ allies: [uugo, d1, d2], enemies: [enemy()], seed: null }), uugo, RECIPES['UUGO-A3']);
  ck('clutch (all others dead): revives at 50% HP (10000) + 50% TM', d1.alive && d1.hp === 10000 && d1.turnMeter === 50, `alive=${d1.alive} hp=${d1.hp} tm=${d1.turnMeter}`);
  ck('clutch: revives ALL dead allies', d2.alive && d2.hp === 12000, `alive=${d2.alive} hp=${d2.hp}`);
}

// A2 AoE: Decrease DEF lands on every enemy.
{
  const uugo = makeCombatant({ name: 'Uugo', side: 'ally', atk: 2000, maxHp: 30000, acc: 300, affinity: 'Void', critRate: 0 });
  const e1 = enemy(); e1.res = 0; const e2 = enemy('Boss2'); e2.res = 0;
  applyRecipe(makeState({ allies: [uugo], enemies: [e1, e2], seed: null }), uugo, RECIPES['UUGO-A2']);
  ck('A2: Decrease DEF landed on BOTH enemies (AoE)',
    e1.debuffs.some((d) => /Decrease/.test(d.type)) && e2.debuffs.some((d) => /Decrease/.test(d.type)),
    `e1=[${e1.debuffs.map((d) => d.type)}] e2=[${e2.debuffs.map((d) => d.type)}]`);
}

console.log(`\n${fail ? '✗' : '✓'} Uugo: ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
