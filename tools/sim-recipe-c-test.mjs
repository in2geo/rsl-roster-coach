// tools/sim-recipe-c-test.mjs — Milestone II-C proof: state manipulation produces expected results.
//
// Two things per mechanic: the recipe PLACES the right value, AND the engine CONSUMER fires (a shield
// absorbs, a taunt pulls the hit, ally-protection redistributes). Deterministic. Run: node tools/sim-recipe-c-test.mjs
import { makeCombatant, makeState, dealDamage, chooseAllyTarget } from '../lib/sim/engine.js';
import { applyRecipe } from '../lib/sim/interpreter.js';
import { RECIPES } from '../lib/sim/recipes.js';

let pass = 0, fail = 0;
const check = (n, c, d = '') => { c ? pass++ : fail++; console.log(`  ${c ? 'PASS' : 'FAIL'}  ${n}${d ? ' — ' + d : ''}`); };
const enemy = () => makeCombatant({ name: 'Mob', side: 'enemy', maxHp: 1e9, def: 1000, affinity: 'Void' });

console.log('\n=== II-C state manipulation — code produces expected results? ===\n');

// 1 — HEAL: Tagoar A2 heals all allies by 15% of Tagoar's MAX HP
{
  const tag = makeCombatant({ name: 'Tagoar', side: 'ally', atk: 3000, maxHp: 20000, affinity: 'Void', critRate: 0 });
  const ally = makeCombatant({ name: 'AllyA', side: 'ally', maxHp: 20000, affinity: 'Void' }); ally.hp = 10000;
  applyRecipe(makeState({ allies: [tag, ally], enemies: [enemy()], seed: null }), tag, RECIPES['TAGOAR-A2']);
  check('HEAL = 15% caster MAX HP (0.15×20000=3000)', ally.hp === 13000, `ally hp ${ally.hp}`);
}
// 2 — REVIVE: Tagoar A3 revives a dead ally at 30% MAX HP
{
  const tag = makeCombatant({ name: 'Tagoar', side: 'ally', maxHp: 24000, affinity: 'Void' });
  const dead = makeCombatant({ name: 'Dead', side: 'ally', maxHp: 20000, affinity: 'Void' }); dead.alive = false; dead.hp = 0;
  applyRecipe(makeState({ allies: [tag, dead], enemies: [enemy()], seed: null }), tag, RECIPES['TAGOAR-A3']);
  check('REVIVE brings dead ally back at 30% HP (6000)', dead.alive && dead.hp === 6000, `alive=${dead.alive} hp=${dead.hp}`);
}
// 3 — SHIELD VALUE: Pelops A3 Magma Shield = 30% of Pelops MAX HP
{
  const pel = makeCombatant({ name: 'Pelops', side: 'ally', maxHp: 28000, affinity: 'Void' });
  const ally = makeCombatant({ name: 'AllyA', side: 'ally', maxHp: 20000, affinity: 'Void' });
  applyRecipe(makeState({ allies: [pel, ally], enemies: [enemy()], seed: null }), pel, RECIPES['PELOPS-A3']);
  const sh = ally.buffs.find((b) => b.type === 'Magma Shield');
  check('SHIELD value = 30% caster MAX HP (0.30×28000=8400)', sh && sh.value === 8400, `value ${sh?.value}`);
}
// 4 — SHIELD CONSUMER: the placed shield absorbs an incoming hit (HP unchanged, shield drained)
{
  const pel = makeCombatant({ name: 'Pelops', side: 'ally', maxHp: 28000, affinity: 'Void' });
  const ally = makeCombatant({ name: 'AllyA', side: 'ally', maxHp: 20000, affinity: 'Void' });
  const atkr = makeCombatant({ name: 'Mob', side: 'enemy', maxHp: 1e9, affinity: 'Void' });
  applyRecipe(makeState({ allies: [pel, ally], enemies: [atkr], seed: null }), pel, RECIPES['PELOPS-A3']);
  const before = ally.hp; const dd = dealDamage(ally, 5000, 'direct', atkr);
  check('SHIELD absorbs the hit (5000 absorbed, HP unchanged)', ally.hp === before && dd.absorbed === 5000, `absorbed ${dd.absorbed}, hp ${ally.hp}`);
}
// 5 — TAUNT: Pelops A3 taunts self, and the enemy targeting is forced onto him
{
  const pel = makeCombatant({ name: 'Pelops', side: 'ally', maxHp: 28000, affinity: 'Void' });
  const low = makeCombatant({ name: 'Squishy', side: 'ally', maxHp: 20000, affinity: 'Void' }); low.hp = 2000;   // lowest HP%
  applyRecipe(makeState({ allies: [pel, low], enemies: [enemy()], seed: null }), pel, RECIPES['PELOPS-A3']);
  const target = chooseAllyTarget([pel, low]);
  check('TAUNT forces the hit onto Pelops (over the lower-HP ally)', pel.buffs.some((b) => b.type === 'Taunt') && target === pel, `target ${target?.name}`);
}
// 6 — ALLY PROTECTION: Vergis A2 protects all allies except self; a hit on one redistributes to the others
{
  const v = makeCombatant({ name: 'Vergis', side: 'ally', def: 1200, maxHp: 16000, affinity: 'Void', critRate: 0 });
  const a1 = makeCombatant({ name: 'A1', side: 'ally', maxHp: 20000, affinity: 'Void' });
  const a2 = makeCombatant({ name: 'A2', side: 'ally', maxHp: 20000, affinity: 'Void' });
  const team = [v, a1, a2];
  applyRecipe(makeState({ allies: team, enemies: [enemy()], seed: null }), v, RECIPES['VERGIS-A2']);
  const placedRight = !v.buffs.some((b) => b.type === 'Ally Protection') && a1.buffs.some((b) => b.type === 'Ally Protection') && a2.buffs.some((b) => b.type === 'Ally Protection');
  const b1 = a1.hp, b2 = a2.hp;
  dealDamage(a1, 10000, 'direct', makeCombatant({ name: 'Mob', side: 'enemy' }), team);   // 50% of 10000 redirects off a1
  const redistributed = (b2 - a2.hp) > 0 && (b1 - a1.hp) < 10000;
  check('ALLY PROTECTION on all-except-self, and it redistributes a hit', placedRight && redistributed, `a1 took ${b1 - a1.hp}, a2 took ${b2 - a2.hp}`);
}
// 7 — STEAL_BUFF: Ezio A3 steals the target's buffs onto himself
{
  const ez = makeCombatant({ name: 'Ezio', side: 'ally', atk: 1800, affinity: 'Void', critRate: 0 });
  const foe = enemy(); foe.buffs.push({ type: 'Increase DEF', value: 60, turnsLeft: 2 });
  applyRecipe(makeState({ allies: [ez], enemies: [foe], seed: null }), ez, RECIPES['EZIO-A3']);
  check('STEAL_BUFF moves enemy buff to caster', !foe.buffs.some((b) => b.type === 'Increase DEF') && ez.buffs.some((b) => b.type === 'Increase DEF'), `foe=${foe.buffs.length} ezio=${ez.buffs.length}`);
}

// 8 — IGNORE_SHIELD: Faceless A3 bypasses a [Shield] straight to HP; a normal skill is absorbed.
// (Ezio A3 also ignores shields but STEALS buffs first, so there's no shield left — use Faceless, which
// ignores the shield without stealing it.)
{
  const atk = makeCombatant({ name: 'Faceless', side: 'ally', atk: 2000, affinity: 'Void', critRate: 0 });
  const shielded = () => { const t = makeCombatant({ name: 'Mob', side: 'enemy', maxHp: 1e9, def: 1000, affinity: 'Void' }); t.buffs.push({ type: 'Shield', value: 5000, turnsLeft: 2 }); return t; };
  const t1 = shielded(); const r1 = applyRecipe(makeState({ allies: [atk], enemies: [t1], seed: null }), atk, RECIPES['FACELESS-A3'])[0];   // ignore_shield
  const t2 = shielded(); const r2 = applyRecipe(makeState({ allies: [atk], enemies: [t2], seed: null }), atk, RECIPES['BAMBUS-A1'])[0];   // normal — absorbed
  check('IGNORE_SHIELD: Faceless A3 bypasses the shield (HP damage, shield intact)', r1.hp_damage > 0 && r1.shield_damage === 0 && (t1.buffs.find(b => b.type === 'Shield')?.value ?? 0) === 5000, `hp ${r1.hp_damage}, shieldDmg ${r1.shield_damage}, shield ${t1.buffs.find(b => b.type === 'Shield')?.value}`);
  check('IGNORE_SHIELD control: a normal skill IS absorbed by the shield', r2.shield_damage > 0 && r2.hp_damage === 0, `shieldDmg ${r2.shield_damage}, hp ${r2.hp_damage}`);
}

console.log(`\n=== ${pass} passed, ${fail} failed ===\n`);
process.exit(fail ? 1 : 0);
