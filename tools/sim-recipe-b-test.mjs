// tools/sim-recipe-b-test.mjs — Milestone II-B proof: does the PLACEMENT code produce expected results?
//
// II-B is probabilistic, so "expected" is a DISTRIBUTION: over many seeds, the land rate must match
// chance × landChance(acc,res). Plus deterministic checks: immunity blocks, duration is set, the right
// RECIPIENT gets a buff, Poison stacks. Same spirit as Step 4 — prove the CODE first; reality later.
// Run: node tools/sim-recipe-b-test.mjs

import { makeCombatant, makeState } from '../lib/sim/engine.js';
import { applyRecipe } from '../lib/sim/interpreter.js';
import { RECIPES } from '../lib/sim/recipes.js';

let pass = 0, fail = 0;
const check = (name, cond, detail = '') => { cond ? pass++ : fail++; console.log(`  ${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`); };
const near = (got, exp, tol = 0.03) => Math.abs(got - exp) <= tol;

// force a recipe to single-target so we place on exactly one enemy
const single = (rec) => ({ ...rec, actions: rec.actions.map((a) => a.op === 'ACQUIRE_TARGETS' ? { ...a, targetIf: undefined, target: 'single' } : a) });

// run N seeded trials of a champion's skill vs one enemy; return the fraction where `debuffType` landed
function landRate(recKey, { acc, enemyRes, enemyImmune = [], n = 4000 }) {
  const rec = single(RECIPES[recKey]);
  const dtype = rec.actions.find((a) => a.op === 'PLACE_DEBUFF')?.effect.type;
  let landed = 0;
  for (let s = 1; s <= n; s++) {
    const atk = makeCombatant({ name: 'Hero', side: 'ally', atk: 3000, acc, affinity: 'Void', critRate: 0 });
    const enemy = makeCombatant({ name: 'Mob', side: 'enemy', maxHp: 1e9, def: 1000, res: enemyRes, affinity: 'Void' });
    if (enemyImmune.length) enemy.immune = enemyImmune;
    const st = makeState({ allies: [atk], enemies: [enemy], seed: s });
    applyRecipe(st, atk, rec);
    if (enemy.debuffs.some((d) => d.type === dtype)) landed++;
  }
  return landed / n;
}

console.log('\n=== II-B placement — does the code produce the EXPECTED behaviour? ===\n');

// 1 — placement chance in isolation: Bambus A1 Decrease Speed @75%, acc≥res (landChance=1) → ~0.75
{
  const r = landRate('BAMBUS-A1', { acc: 200, enemyRes: 0 });
  check('placement chance — 75% skill, no resist → ~0.75 land rate', near(r, 0.75), `measured ${r.toFixed(3)}`);
}
// 2 — ACC vs RES stage: same skill, acc 100 vs res 150 → landChance 0.5, so 0.75×0.5 = ~0.375
{
  const r = landRate('BAMBUS-A1', { acc: 100, enemyRes: 150 });
  check('ACC/RES two-stage — 0.75 × landChance(0.5) → ~0.375', near(r, 0.375), `measured ${r.toFixed(3)} (expected 0.375)`);
}
// 3 — immunity is a hard block → 0 regardless of chance/acc
{
  const r = landRate('BAMBUS-A1', { acc: 200, enemyRes: 0, enemyImmune: ['Decrease Speed'], n: 500 });
  check('immunity blocks placement entirely → 0.0', r === 0, `measured ${r.toFixed(3)}`);
}
// 4 — duration is set to the effect's duration (use the first seed where placement actually lands)
{
  let dd = null;
  for (let s = 1; s <= 50 && !dd; s++) {
    const atk = makeCombatant({ name: 'Ezio', side: 'ally', atk: 3000, acc: 500, affinity: 'Void', critRate: 0 });
    const enemy = makeCombatant({ name: 'Mob', side: 'enemy', maxHp: 1e9, def: 1000, res: 0, affinity: 'Void' });
    applyRecipe(makeState({ allies: [atk], enemies: [enemy], seed: s }), atk, single(RECIPES['EZIO-A1']));
    dd = enemy.debuffs.find((d) => d.type === 'Decrease Defense');
  }
  check('duration — Decrease Defense placed with turnsLeft = 2', dd && dd.turnsLeft === 2, `turnsLeft=${dd?.turnsLeft}`);
}
// 5 — stacking: Ezio A2 places TWO 5% Poison → 2 stacks
{
  const atk = makeCombatant({ name: 'Ezio', side: 'ally', atk: 3000, acc: 500, affinity: 'Void', critRate: 0 });
  const enemy = makeCombatant({ name: 'Mob', side: 'enemy', maxHp: 1e9, def: 1000, res: 0, affinity: 'Void' });
  const st = makeState({ allies: [atk], enemies: [enemy], seed: 3 });
  applyRecipe(st, atk, single(RECIPES['EZIO-A2']));
  const pois = enemy.debuffs.find((d) => d.type === 'Poison');
  check('stacking — Ezio A2 places 2× Poison → stacks = 2', pois && pois.stacks === 2, `stacks=${pois?.stacks}`);
}

// 6 — RECIPIENT: Tagoar A1 Increase DEF lands on the LOWEST-HP ally only
{
  const tag = makeCombatant({ name: 'Tagoar', side: 'ally', atk: 3000, maxHp: 20000, acc: 200, affinity: 'Void', critRate: 0 });
  const allyA = makeCombatant({ name: 'AllyA', side: 'ally', maxHp: 20000, affinity: 'Void' }); allyA.hp = 10000;   // 50%
  const allyB = makeCombatant({ name: 'AllyB', side: 'ally', maxHp: 20000, affinity: 'Void' }); allyB.hp = 6000;    // 30% (lowest)
  const enemy = makeCombatant({ name: 'Mob', side: 'enemy', maxHp: 1e9, def: 1000, affinity: 'Void' });
  const st = makeState({ allies: [tag, allyA, allyB], enemies: [enemy], seed: null });
  applyRecipe(st, tag, single(RECIPES['TAGOAR-A1']));
  const onB = allyB.buffs.some((b) => b.type === 'Increase DEF');
  const onOthers = tag.buffs.some((b) => b.type === 'Increase DEF') || allyA.buffs.some((b) => b.type === 'Increase DEF');
  check('recipient lowest_hp_ally — Increase DEF on AllyB only', onB && !onOthers, `B=${onB} others=${onOthers}`);
}
// 7 — RECIPIENT: Tagoar A2 Increase SPD lands on ALL allies
{
  const tag = makeCombatant({ name: 'Tagoar', side: 'ally', atk: 3000, maxHp: 20000, affinity: 'Void', critRate: 0 });
  const allyA = makeCombatant({ name: 'AllyA', side: 'ally', maxHp: 20000, affinity: 'Void' });
  const enemy = makeCombatant({ name: 'Mob', side: 'enemy', maxHp: 1e9, def: 1000, affinity: 'Void' });
  const st = makeState({ allies: [tag, allyA], enemies: [enemy], seed: null });
  applyRecipe(st, tag, RECIPES['TAGOAR-A2']);
  const all = [tag, allyA].every((c) => c.buffs.some((b) => b.type === 'Increase SPD'));
  check('recipient all_allies — Increase SPD on every ally', all);
}
// 8 — Vergis A1 Reflect on a random ally @40% → ~0.40 of trials place it somewhere
{
  let placed = 0, n = 4000;
  for (let s = 1; s <= n; s++) {
    const v = makeCombatant({ name: 'Vergis', side: 'ally', atk: 600, def: 1200, maxHp: 16000, affinity: 'Void', critRate: 0 });
    const ally = makeCombatant({ name: 'AllyA', side: 'ally', maxHp: 16000, affinity: 'Void' });
    const enemy = makeCombatant({ name: 'Mob', side: 'enemy', maxHp: 1e9, def: 1000, affinity: 'Void' });
    const st = makeState({ allies: [v, ally], enemies: [enemy], seed: s });
    applyRecipe(st, v, single(RECIPES['VERGIS-A1']));
    if ([v, ally].some((c) => c.buffs.some((b) => b.type === 'Reflect Damage'))) placed++;
  }
  const r = placed / n;
  check('buff placement chance — Vergis A1 Reflect @40% → ~0.40', near(r, 0.40), `measured ${r.toFixed(3)}`);
}

console.log(`\n=== ${pass} passed, ${fail} failed ===\n`);
process.exit(fail ? 1 : 0);
