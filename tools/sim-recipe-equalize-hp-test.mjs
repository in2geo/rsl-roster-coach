// tools/sim-recipe-equalize-hp-test.mjs — EQUALIZE_HP op proof (Mavara A2 "Nexus Of Silk").
//
// Raises every ally to the HIGHEST ally's CURRENT HP FRACTION (percentage, not absolute — a low-max-HP support
// reaches the same %, not the tank's raw HP), only ever raising, never lowering those above. Deterministic.
// Run: node tools/sim-recipe-equalize-hp-test.mjs
import { makeCombatant, makeState } from '../lib/sim/engine.js';
import { applyRecipe } from '../lib/sim/interpreter.js';
import { RECIPES } from '../lib/sim/recipes.js';

let pass = 0, fail = 0;
const ck = (n, c, d = '') => { c ? pass++ : fail++; console.log(`  ${c ? 'PASS' : 'FAIL'}  ${n}${d ? ' — ' + d : ''}`); };
const enemy = () => makeCombatant({ name: 'Boss', side: 'enemy', role: 'boss', maxHp: 5e8, def: 1500, affinity: 'Void' });
const pct = (c) => Math.round(100 * c.hp / c.maxHp);

console.log('\n=== EQUALIZE_HP — raise all allies to the highest ally HP% (Mavara A2) ===\n');

// Mavara (100%), a hurt tank (30% of a big pool), a hurt support (10% of a small pool) → all up to 100%.
{
  const mav = makeCombatant({ name: 'Mavara the Web Diviner', side: 'ally', maxHp: 25000, affinity: 'Void' });   // 100%
  const tank = makeCombatant({ name: 'Gnut', side: 'ally', maxHp: 40000, affinity: 'Void' }); tank.hp = 12000;    // 30%
  const supp = makeCombatant({ name: 'Uugo', side: 'ally', maxHp: 15000, affinity: 'Void' }); supp.hp = 1500;     // 10%
  applyRecipe(makeState({ allies: [mav, tank, supp], enemies: [enemy()], seed: null }), mav, RECIPES['MAVARA-A2']);
  ck('tank raised to the highest HP% (100%) — by PERCENTAGE not absolute', pct(tank) === 100 && tank.hp === 40000, `tank ${pct(tank)}% (${tank.hp})`);
  ck('support raised to the same 100% (own max, not the tank\'s raw HP)', pct(supp) === 100 && supp.hp === 15000, `supp ${pct(supp)}% (${supp.hp})`);
  ck('the highest ally (Mavara) is unchanged', mav.hp === 25000, `mavara ${pct(mav)}%`);
}

// Only RAISES: an ally already above the max-fraction target is never lowered (here everyone equalizes to 60%).
{
  const mav = makeCombatant({ name: 'Mavara the Web Diviner', side: 'ally', maxHp: 25000, affinity: 'Void' }); mav.hp = 15000;  // 60% (highest)
  const a = makeCombatant({ name: 'A', side: 'ally', maxHp: 20000, affinity: 'Void' }); a.hp = 4000;   // 20%
  applyRecipe(makeState({ allies: [mav, a], enemies: [enemy()], seed: null }), mav, RECIPES['MAVARA-A2']);
  ck('lower ally rises to 60%', pct(a) === 60, `a ${pct(a)}%`);
  ck('highest ally (60%) is NOT lowered', mav.hp === 15000, `mavara ${pct(mav)}%`);
}

console.log(`\n${fail ? '✗' : '✓'} EQUALIZE_HP: ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
