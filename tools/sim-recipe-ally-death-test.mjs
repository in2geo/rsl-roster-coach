// tools/sim-recipe-ally-death-test.mjs — 'ally_death' reactive trigger (Uugo Final Spite) + Hordin A2 self-heal.
//
// Final Spite fires only when Uugo's LAST ally dies (she becomes the sole survivor). Also proves Hordin A2's
// "heals self by 10% of the damage inflicted" via the existing F.selfHealPctOfDamage mechanism (the burndown
// mislabelled it a missing op). Deterministic (seed=null). Run: node tools/sim-recipe-ally-death-test.mjs
import { makeCombatant, makeState } from '../lib/sim/engine.js';
import { applyRecipe, installRecipeRun } from '../lib/sim/interpreter.js';
import { RECIPES } from '../lib/sim/recipes.js';

let pass = 0, fail = 0;
const ck = (n, c, d = '') => { c ? pass++ : fail++; console.log(`  ${c ? 'PASS' : 'FAIL'}  ${n}${d ? ' — ' + d : ''}`); };
const enemy = () => makeCombatant({ name: 'Boss', side: 'enemy', role: 'boss', maxHp: 5e8, def: 1500, affinity: 'Void' });
const hasBuff = (c, t) => c.buffs.some((b) => b.type === t);

console.log('\n=== ally_death trigger (Uugo Final Spite) + Hordin A2 self-heal ===\n');

// Final Spite fires when the LAST ally dies → Uugo (sole survivor) gets [Increase SPD] + [Block Damage].
{
  const uugo = makeCombatant({ name: 'Uugo', side: 'ally', maxHp: 30000, spd: 93, affinity: 'Void' });
  const ally = makeCombatant({ name: 'Kael', side: 'ally', maxHp: 20000, affinity: 'Void' });
  const st = makeState({ allies: [uugo, ally], enemies: [enemy()], seed: null });
  installRecipeRun(st);
  ally.alive = false; ally.hp = 0; st.onDeath(st, ally);   // Uugo's last ally dies
  ck('last ally dies → Uugo gains [Increase SPD]', hasBuff(uugo, 'Increase SPD'), `buffs ${uugo.buffs.map((b) => b.type)}`);
  ck('last ally dies → Uugo gains [Block Damage]', hasBuff(uugo, 'Block Damage'));
}

// Does NOT fire when a NON-last ally dies (another ally still alive).
{
  const uugo = makeCombatant({ name: 'Uugo', side: 'ally', maxHp: 30000, affinity: 'Void' });
  const a1 = makeCombatant({ name: 'Kael', side: 'ally', maxHp: 20000, affinity: 'Void' });
  const a2 = makeCombatant({ name: 'Gnut', side: 'ally', maxHp: 24000, affinity: 'Void' });
  const st = makeState({ allies: [uugo, a1, a2], enemies: [enemy()], seed: null });
  installRecipeRun(st);
  a1.alive = false; a1.hp = 0; st.onDeath(st, a1);   // a2 still alive → not Uugo's last ally
  ck('a NON-last ally dies → Final Spite does NOT fire', !hasBuff(uugo, 'Increase SPD') && !hasBuff(uugo, 'Block Damage'), `buffs ${uugo.buffs.map((b) => b.type)}`);
}

// Hordin A2 heals self by 10% of the damage inflicted (F_HORDIN_A2.selfHealPctOfDamage).
{
  const hordin = makeCombatant({ name: 'Hordin', side: 'ally', atk: 3000, maxHp: 30000, acc: 300, affinity: 'Void', critRate: 0 });
  hordin.hp = 5000;   // hurt, so the self-heal is visible (not overheal-capped)
  const boss = enemy(); boss.res = 0;
  const st = makeState({ allies: [hordin], enemies: [boss], seed: null });
  const before = hordin.hp;
  const res = applyRecipe(st, hordin, RECIPES['HORDIN-A2']);
  const dmg = res.reduce((s, r) => s + (r.hp_damage ?? 0), 0);
  ck('Hordin A2 self-heals ~10% of damage dealt', hordin.hp > before && Math.abs((hordin.hp - before) - 0.10 * dmg) < 2, `healed ${hordin.hp - before} vs 10%×${dmg}=${Math.round(0.1 * dmg)}`);
}

console.log(`\n${fail ? '✗' : '✓'} ally_death + self-heal: ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
