// tools/sim-recipe-ally-attack-test.mjs — ALLY_ATTACK ("Ally Attack" / join-attack / beatdown) op proof.
//
// The op directs a set of allies to EACH attack the caster's acquired target with their default (A1) skill,
// reusing the full damage path. Two shapes are proven: Fahrakin A3 Beatdown (ALL allies except self) and
// Glorious Pallas A1 (ONE random ally). Deterministic (seed=null). Run: node tools/sim-recipe-ally-attack-test.mjs
import { makeCombatant, makeState } from '../lib/sim/engine.js';
import { applyRecipe } from '../lib/sim/interpreter.js';
import { RECIPES } from '../lib/sim/recipes.js';

let pass = 0, fail = 0;
const check = (n, c, d = '') => { c ? pass++ : fail++; console.log(`  ${c ? 'PASS' : 'FAIL'}  ${n}${d ? ' — ' + d : ''}`); };
const bigEnemy = () => makeCombatant({ name: 'Boss', side: 'enemy', role: 'boss', maxHp: 5e8, def: 1500, affinity: 'Void', critRate: 0 });
const joins = (state) => state.effects.filter((e) => e.kind === 'ally_attack' && e.consumed);

console.log('\n=== ALLY_ATTACK — the join-attack op fires allies onto the acquired target ===\n');

// 1 — FAHRAKIN A3 Beatdown: buff all allies except self, then ALL allies except self attack one enemy.
{
  const fah = makeCombatant({ name: 'Fahrakin', side: 'ally', atk: 2500, maxHp: 15000, affinity: 'Void', critRate: 0 });
  const kael = makeCombatant({ name: 'Kael', side: 'ally', atk: 2200, maxHp: 14000, affinity: 'Void', critRate: 0 });
  const bam = makeCombatant({ name: 'Bambus', side: 'ally', atk: 2000, maxHp: 16000, affinity: 'Void', critRate: 0 });
  const boss = bigEnemy();
  const state = makeState({ allies: [fah, kael, bam], enemies: [boss], seed: null });
  const hp0 = boss.hp;
  applyRecipe(state, fah, RECIPES['FAHRAKIN-A3']);
  const crate = (c) => c.buffs.some((b) => b.type === 'Increase C.RATE');
  check('both allies (except caster) joined the attack', joins(state).length === 2, `${joins(state).length} join(s)`);
  check('the join dealt damage to the target (Fahrakin A3 has no caster hit)', boss.hp < hp0, `boss took ${Math.round(hp0 - boss.hp)}`);
  check('[Increase C.RATE] on both allies, NOT the caster', crate(kael) && crate(bam) && !crate(fah), `kael=${crate(kael)} bam=${crate(bam)} fah=${crate(fah)}`);
}

// 2 — the joining ally uses its DEFAULT (A1) skill, so its A1 rider debuff lands too (Bambus A1 → [Decrease SPD]).
{
  const fah = makeCombatant({ name: 'Fahrakin', side: 'ally', atk: 2500, maxHp: 15000, affinity: 'Void', critRate: 0 });
  const bam = makeCombatant({ name: 'Bambus', side: 'ally', atk: 2000, maxHp: 16000, acc: 300, affinity: 'Void', critRate: 0 });
  const boss = bigEnemy(); boss.res = 0;
  const state = makeState({ allies: [fah, bam], enemies: [boss], seed: null });
  applyRecipe(state, fah, RECIPES['FAHRAKIN-A3']);
  check('joiner ran its full A1 (Bambus A1 [Decrease SPD] landed on the target)',
    boss.debuffs.some((d) => /Decrease Sp/i.test(d.type)), `debuffs: ${boss.debuffs.map((d) => d.type).join(',') || 'none'}`);
}

// 3 — random_ally_except_self shape: exactly ONE ally joins (synthetic caster carrying the op directly).
//   (Glorious Pallas A1 would use this, but her Argonites faction gate isn't modelled yet — see recipes.js —
//    so we prove the op shape here rather than via her live recipe.)
{
  const cap = makeCombatant({ name: 'Fahrakin', side: 'ally', atk: 2400, maxHp: 30000, affinity: 'Void', critRate: 0 });
  const kael = makeCombatant({ name: 'Kael', side: 'ally', atk: 2200, maxHp: 14000, affinity: 'Void', critRate: 0 });
  const bam = makeCombatant({ name: 'Bambus', side: 'ally', atk: 2000, maxHp: 16000, affinity: 'Void', critRate: 0 });
  const boss = bigEnemy();
  const state = makeState({ allies: [cap, kael, bam], enemies: [boss], seed: null });
  const hp0 = boss.hp;
  const recipe = { slot: 'X', name: 'probe', type: 'active', actions: [
    { seq: 10, op: 'ACQUIRE_TARGETS', target: 'single' },
    { seq: 20, op: 'ALLY_ATTACK', who: 'random_ally_except_self', slot: 'A1' },
  ] };
  applyRecipe(state, cap, recipe);
  check('random_ally_except_self → exactly ONE ally joins', joins(state).length === 1, `${joins(state).length} join(s)`);
  check('the single joiner hit the target', boss.hp < hp0, `boss took ${Math.round(hp0 - boss.hp)}`);
}

// 3b — random_faction_ally: only allies OF THE NAMED FACTION join; no eligible ally → no join (Pallas A1 gate).
{
  const cap = makeCombatant({ name: 'Glorious Pallas', side: 'ally', faction: 'Argonites', atk: 2400, maxHp: 30000, affinity: 'Void', critRate: 0 });
  const argo = makeCombatant({ name: 'Pelops', side: 'ally', faction: 'Argonites', atk: 2200, maxHp: 20000, affinity: 'Void', critRate: 0 });
  const other = makeCombatant({ name: 'Kael', side: 'ally', faction: 'Knights Revenant', atk: 5000, maxHp: 14000, affinity: 'Void', critRate: 0 });
  const boss = bigEnemy();
  const facRecipe = { slot: 'X', name: 'probe', type: 'active', actions: [
    { seq: 10, op: 'ACQUIRE_TARGETS', target: 'single' },
    { seq: 20, op: 'ALLY_ATTACK', who: 'random_faction_ally', faction: 'Argonites', slot: 'A1' },
  ] };
  // (a) with an eligible Argonites ally present, exactly it joins (never the non-Argonites, higher-ATK Kael)
  const s1 = makeState({ allies: [cap, argo, other], enemies: [boss], seed: null });
  applyRecipe(s1, cap, facRecipe);
  check('random_faction_ally → the Argonites ally joins (not the off-faction one)',
    joins(s1).length === 1 && joins(s1)[0].source === 'Pelops', `${joins(s1).length} join(s), source ${joins(s1)[0]?.source}`);
  // (b) no eligible faction ally on the team → NO join fires (the real Pallas gate)
  const boss2 = bigEnemy();
  const s2 = makeState({ allies: [cap, other], enemies: [boss2], seed: null });
  const hp0 = boss2.hp;
  applyRecipe(s2, cap, facRecipe);
  check('no eligible faction ally → no join fires', joins(s2).length === 0 && boss2.hp === hp0, `${joins(s2).length} join(s)`);
}

// 4 — edge: no living target → op is a benign non-consumption, no crash.
{
  const fah = makeCombatant({ name: 'Fahrakin', side: 'ally', atk: 2500, maxHp: 15000, affinity: 'Void', critRate: 0 });
  const kael = makeCombatant({ name: 'Kael', side: 'ally', atk: 2200, maxHp: 14000, affinity: 'Void', critRate: 0 });
  const boss = bigEnemy(); boss.alive = false; boss.hp = 0;
  const state = makeState({ allies: [fah, kael], enemies: [boss], seed: null });
  let threw = false;
  try { applyRecipe(state, fah, RECIPES['FAHRAKIN-A3']); } catch { threw = true; }
  check('no living target → no join, no crash', !threw && joins(state).length === 0, `threw=${threw}, joins=${joins(state).length}`);
}

console.log(`\n${fail ? '✗' : '✓'} ALLY_ATTACK: ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
