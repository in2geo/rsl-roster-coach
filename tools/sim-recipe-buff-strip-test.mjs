// tools/sim-recipe-buff-strip-test.mjs — BUFF_STRIP ("Buff Strip") op proof.
//
// Deletes buffs from enemy targets — NOT stolen (they do not land on the caster; that's STEAL_BUFF) and NOT a
// cleanse (that's ally debuffs). Default removes ALL; optional types[] / count. Also proves Hilvi A2 strips the
// whole enemy buff bar. Deterministic (seed=null). Run: node tools/sim-recipe-buff-strip-test.mjs
import { makeCombatant, makeState } from '../lib/sim/engine.js';
import { applyRecipe } from '../lib/sim/interpreter.js';
import { RECIPES } from '../lib/sim/recipes.js';

let pass = 0, fail = 0;
const ck = (n, c, d = '') => { c ? pass++ : fail++; console.log(`  ${c ? 'PASS' : 'FAIL'}  ${n}${d ? ' — ' + d : ''}`); };
const withBuffs = (name, buffs) => { const e = makeCombatant({ name, side: 'enemy', role: 'boss', maxHp: 5e8, def: 1500, affinity: 'Void' }); e.buffs = buffs.map((t) => ({ type: t, value: 50, turnsLeft: 2 })); return e; };

console.log('\n=== BUFF_STRIP — delete enemy buffs (not steal, not cleanse) ===\n');

// default: strip ALL buffs from the target set; caster gains nothing.
{
  const cap = makeCombatant({ name: 'Caster', side: 'ally', maxHp: 20000, affinity: 'Void' });
  const e1 = withBuffs('E1', ['Increase DEF', 'Shield', 'Strengthen']);
  const e2 = withBuffs('E2', ['Increase ATK']);
  const recipe = { slot: 'X', type: 'active', actions: [
    { seq: 10, op: 'ACQUIRE_TARGETS', target: 'all_enemies' },
    { seq: 20, op: 'BUFF_STRIP', target: 'intended_set' },
  ] };
  applyRecipe(makeState({ allies: [cap], enemies: [e1, e2], seed: null }), cap, recipe);
  ck('strips ALL buffs off every enemy', e1.buffs.length === 0 && e2.buffs.length === 0, `e1=${e1.buffs.length} e2=${e2.buffs.length}`);
  ck('caster does NOT gain the buffs (delete, not steal)', cap.buffs.length === 0, `caster buffs ${cap.buffs.length}`);
}

// types[]: strip only named buffs, leave the rest.
{
  const cap = makeCombatant({ name: 'Caster', side: 'ally', maxHp: 20000, affinity: 'Void' });
  const e = withBuffs('E', ['Increase DEF', 'Ally Protection', 'Strengthen', 'Shield']);
  const recipe = { slot: 'X', type: 'active', actions: [
    { seq: 10, op: 'ACQUIRE_TARGETS', target: 'all_enemies' },
    { seq: 20, op: 'BUFF_STRIP', target: 'intended_set', types: ['Increase DEF', 'Ally Protection', 'Strengthen'] },
  ] };
  applyRecipe(makeState({ allies: [cap], enemies: [e], seed: null }), cap, recipe);
  ck('types[]: strips only the named buffs (Shield survives)', e.buffs.length === 1 && e.buffs[0].type === 'Shield', `left ${e.buffs.map((b) => b.type)}`);
}

// count: remove only N (oldest first).
{
  const cap = makeCombatant({ name: 'Caster', side: 'ally', maxHp: 20000, affinity: 'Void' });
  const e = withBuffs('E', ['Increase DEF', 'Increase ATK', 'Increase SPD']);
  const recipe = { slot: 'X', type: 'active', actions: [
    { seq: 10, op: 'ACQUIRE_TARGETS', target: 'all_enemies' },
    { seq: 20, op: 'BUFF_STRIP', target: 'intended_set', count: 1 },
  ] };
  applyRecipe(makeState({ allies: [cap], enemies: [e], seed: null }), cap, recipe);
  ck('count:1 removes exactly one buff', e.buffs.length === 2, `left ${e.buffs.length}`);
}

// no buffs → benign no-op.
{
  const cap = makeCombatant({ name: 'Caster', side: 'ally', maxHp: 20000, affinity: 'Void' });
  const e = withBuffs('E', []);
  const recipe = { slot: 'X', type: 'active', actions: [{ seq: 10, op: 'ACQUIRE_TARGETS', target: 'all_enemies' }, { seq: 20, op: 'BUFF_STRIP', target: 'intended_set' }] };
  let threw = false;
  try { applyRecipe(makeState({ allies: [cap], enemies: [e], seed: null }), cap, recipe); } catch { threw = true; }
  ck('no buffs → no crash', !threw, `threw ${threw}`);
}

// Hilvi A2 "Embittering Cold": strips the whole enemy buff bar, then Freezes.
{
  const hilvi = makeCombatant({ name: 'Hilvi', side: 'ally', atk: 2000, maxHp: 30000, acc: 500, affinity: 'Void', critRate: 0 });
  const boss = withBuffs('Dragon', ['Increase DEF', 'Increase ATK']); boss.res = 0;
  applyRecipe(makeState({ allies: [hilvi], enemies: [boss], seed: null }), hilvi, RECIPES['HILVI-A2']);
  ck('Hilvi A2 stripped all boss buffs', boss.buffs.length === 0, `boss buffs ${boss.buffs.map((b) => b.type)}`);
  ck('Hilvi A2 then Froze the boss', boss.debuffs.some((d) => d.type === 'Freeze'), `debuffs ${boss.debuffs.map((d) => d.type)}`);
}

console.log(`\n${fail ? '✗' : '✓'} BUFF_STRIP: ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
