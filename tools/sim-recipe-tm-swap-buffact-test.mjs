// tools/sim-recipe-tm-swap-buffact-test.mjs — STEAL_TURN_METER + SWAP_HP + BUFF_ACTIVATION op proofs.
// Deterministic (seed=null). Run: node tools/sim-recipe-tm-swap-buffact-test.mjs
import { makeCombatant, makeState } from '../lib/sim/engine.js';
import { applyRecipe } from '../lib/sim/interpreter.js';

let pass = 0, fail = 0;
const ck = (n, c, d = '') => { c ? pass++ : fail++; console.log(`  ${c ? 'PASS' : 'FAIL'}  ${n}${d ? ' — ' + d : ''}`); };
const R = (actions) => ({ slot: 'X', type: 'active', actions });

console.log('\n=== STEAL_TURN_METER / SWAP_HP / BUFF_ACTIVATION ===\n');

// STEAL_TURN_METER: drain 50% of the enemy TM and fill the caster by the removed amount.
{
  const cap = makeCombatant({ name: 'Fabian', side: 'ally', acc: 500, maxHp: 20000, affinity: 'Void' }); cap.turnMeter = 0;
  const boss = makeCombatant({ name: 'Boss', side: 'enemy', role: 'boss', maxHp: 5e8, res: 0, affinity: 'Void' }); boss.turnMeter = 100;
  applyRecipe(makeState({ allies: [cap], enemies: [boss], seed: null }), cap,
    R([{ seq: 10, op: 'ACQUIRE_TARGETS', target: 'single' }, { seq: 20, op: 'STEAL_TURN_METER', effect: { pct: 0.50 } }]));
  ck('enemy TM drained 50 (100→50)', boss.turnMeter === 50, `boss TM ${boss.turnMeter}`);
  ck('caster gains the stolen 50 TM (0→50)', cap.turnMeter === 50, `caster TM ${cap.turnMeter}`);
}
// STEAL_TURN_METER: immune enemy → no drain, no self-gain.
{
  const cap = makeCombatant({ name: 'Fabian', side: 'ally', acc: 500, maxHp: 20000, affinity: 'Void' }); cap.turnMeter = 0;
  const boss = makeCombatant({ name: 'Boss', side: 'enemy', role: 'boss', maxHp: 5e8, res: 0, affinity: 'Void' }); boss.turnMeter = 100; boss.immune = ['Decrease Turn Meter'];
  applyRecipe(makeState({ allies: [cap], enemies: [boss], seed: null }), cap,
    R([{ seq: 10, op: 'ACQUIRE_TARGETS', target: 'single' }, { seq: 20, op: 'STEAL_TURN_METER', effect: { pct: 0.50 } }]));
  ck('TM-immune enemy → no drain + no self-gain', boss.turnMeter === 100 && cap.turnMeter === 0, `boss ${boss.turnMeter}, caster ${cap.turnMeter}`);
}

// SWAP_HP: caster at 30%, boss at 100% → each takes the other's fraction (of its own MAX HP).
{
  const val = makeCombatant({ name: 'Vallaryn', side: 'ally', maxHp: 20000, affinity: 'Void' }); val.hp = 6000;   // 30%
  const boss = makeCombatant({ name: 'Boss', side: 'enemy', role: 'boss', maxHp: 400000, res: 0, affinity: 'Void' }); boss.hp = 400000;   // 100%
  applyRecipe(makeState({ allies: [val], enemies: [boss], seed: null }), val,
    R([{ seq: 10, op: 'ACQUIRE_TARGETS', target: 'single' }, { seq: 20, op: 'SWAP_HP', target: 'current_target' }]));
  ck('caster rises to the boss\'s 100% (of own max = 20000)', val.hp === 20000, `caster hp ${val.hp}`);
  ck('boss drops to the caster\'s 30% (of own max = 120000)', boss.hp === 120000, `boss hp ${boss.hp}`);
}

// BUFF_ACTIVATION: a hurt ally with [Continuous Heal] 15% ticks now; an ally without it is a no-op.
{
  const don = makeCombatant({ name: 'Donatello', side: 'ally', maxHp: 20000, affinity: 'Void' });
  const a = makeCombatant({ name: 'Kael', side: 'ally', maxHp: 20000, affinity: 'Void' }); a.hp = 5000;
  a.buffs = [{ type: 'Continuous Heal', value: 15, turnsLeft: 2 }];
  const b = makeCombatant({ name: 'Bambus', side: 'ally', maxHp: 20000, affinity: 'Void' }); b.hp = 5000;   // no HoT
  const st = makeState({ allies: [don, a, b], enemies: [makeCombatant({ name: 'E', side: 'enemy', maxHp: 1e6, affinity: 'Void' })], seed: null });
  applyRecipe(st, don, R([{ seq: 10, op: 'BUFF_ACTIVATION', target: 'all_allies', effect: { type: 'Continuous Heal' } }]));
  ck('ally with [Continuous Heal] healed 15% MAX HP (3000)', a.hp === 8000, `hp ${a.hp}`);
  ck('the [Continuous Heal] buff PERSISTS (extra tick, not consumed)', a.buffs.some((x) => x.type === 'Continuous Heal'), `buffs ${a.buffs.map((x) => x.type)}`);
  ck('ally without the buff is untouched', b.hp === 5000, `hp ${b.hp}`);
}

console.log(`\n${fail ? '✗' : '✓'} TM/swap/buff-act: ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
