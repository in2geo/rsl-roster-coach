// tools/sim-recipe-fear-test.mjs — [Fear] / [True Fear] turn-denial CC proof.
//
// [True Fear] = guaranteed skill misfire (the unit forfeits its turn); [Fear] = 50% chance. Before this these
// debuffs were placed-but-inert — a Feared enemy acted normally, so every Fear-locker did nothing. Proven
// end-to-end via the turn loop (a Feared attacker cannot land its hit). Run: node tools/sim-recipe-fear-test.mjs
import { makeCombatant, makeState, simulate, actEnemyMob } from '../lib/sim/engine.js';

let pass = 0, fail = 0;
const ck = (n, c, d = '') => { c ? pass++ : fail++; console.log(`  ${c ? 'PASS' : 'FAIL'}  ${n}${d ? ' — ' + d : ''}`); };
const hero = (debuffs = []) => {
  const h = makeCombatant({ name: 'Hero', side: 'ally', spd: 100, atk: 2000, maxHp: 30000, affinity: 'Void', critRate: 0,
    skills: [{ slot: 'A1', cooldown: 0, cdLeft: 0, hitsEnemies: true, coeff: 5, coeffStat: 'ATK' }] });
  h.debuffs = debuffs; return h;
};
const dummy = () => makeCombatant({ name: 'Target', side: 'enemy', role: 'boss', maxHp: 1e9, def: 1000, spd: 1, affinity: 'Void' });
// Run `turns` of the hero acting on a passive dummy; return HP damage dealt to the dummy.
const runDamage = (heroC, seed = null, turnCap = 20) => {
  const tgt = dummy();
  const st = makeState({ allies: [heroC], enemies: [], seed });
  simulate(st, { phases: [{ name: 'boss', enemies: [tgt], actEnemy(s, a) { actEnemyMob(s, a); } }] }, { turnCap });
  return 1e9 - tgt.hp;
};

console.log('\n=== [Fear] / [True Fear] — turn-denial CC (was placed-but-inert) ===\n');

// baseline: no fear → the hero deals damage every turn.
const base = runDamage(hero([]), 123, 20);
ck('baseline (no Fear): hero deals damage', base > 0, `dealt ${Math.round(base)}`);

// True Fear: guaranteed misfire → the hero never lands a hit → zero damage.
const tf = runDamage(hero([{ type: 'True Fear', turnsLeft: 999, stacks: 1 }]), 123, 20);
ck('[True Fear]: hero forfeits EVERY turn → zero damage', tf === 0, `dealt ${Math.round(tf)}`);

// Fear: 50% misfire → materially less than baseline, but not zero (some turns land). Seeded for determinism.
const fear = runDamage(hero([{ type: 'Fear', turnsLeft: 999, stacks: 1 }]), 123, 40);
const baseLong = runDamage(hero([]), 123, 40);
ck('[Fear]: ~half the turns misfire (0 < dmg < baseline)', fear > 0 && fear < baseLong, `fear ${Math.round(fear)} vs base ${Math.round(baseLong)}`);
ck('[Fear]: roughly half (within 30–70% of baseline)', fear > 0.3 * baseLong && fear < 0.7 * baseLong, `${Math.round(100 * fear / baseLong)}% of baseline`);

console.log(`\n${fail ? '✗' : '✓'} Fear CC: ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
