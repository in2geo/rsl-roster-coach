// tools/sim-recipe-spider-test.mjs — MODEL QA · durable toy-battle rung for the 5-champ Spider recipe slice
// mechanics added 2026-07-31: Michelangelo A4 Shield-on-hit + Evade, Coldheart A3 enemy-MAX-HP term + 30% crit,
// Ninja [Escalation]. Deterministic (seed=null / setChanceMode). No DB. Run: node tools/sim-recipe-spider-test.mjs
import { makeCombatant, makeState, setChanceMode, computeRawHit, defMitigation, rollEvade, evadeChanceFor } from '../lib/sim/engine.js';
import { applyRecipe, fireTriggers } from '../lib/sim/interpreter.js';
import { RECIPES, FORMULAS } from '../lib/sim/recipes.js';

let pass = 0, fail = 0; const failures = [];
const check = (n, c, d = '') => { c ? pass++ : (fail++, failures.push(`${n}${d ? ' — ' + d : ''}`)); console.log(`  ${c ? 'PASS' : 'FAIL'}  ${n}${d ? ' — ' + d : ''}`); };

console.log('\n=== Spider 5-champ recipe mechanics (toy battles) ===\n');

// ── 1. Michelangelo A4 [Party Dude]: on-hit [Shield] = 300% ATK on self ──
{
  const mike = makeCombatant({ name: 'Michelangelo', side: 'ally', maxHp: 21000, atk: 2500, affinity: 'Void' });
  const mob = makeCombatant({ name: 'Mob', side: 'enemy', maxHp: 1e6, affinity: 'Void' });
  fireTriggers(makeState({ allies: [mike], enemies: [mob], seed: null }), mike, 'attacked', { attacker: mob });
  const sh = mike.buffs.find(b => b.type === 'Shield');
  check('Michelangelo A4: being hit places a [Shield] = 300% ATK (2500→7500)', sh && sh.value === 7500, `shield ${sh?.value}`);
}
{ // gated: a champion WITHOUT the trigger gets no shield
  const other = makeCombatant({ name: 'Coldheart', side: 'ally', maxHp: 19000, atk: 2200, affinity: 'Void' });
  fireTriggers(makeState({ allies: [other], enemies: [], seed: null }), other, 'attacked', { attacker: null });
  check('gated: a non-Michelangelo champ gets NO on-hit shield', !other.buffs.some(b => b.type === 'Shield'));
}

// ── 2. Evade (Michelangelo A4): 15% base, 30% under [Taunt]; general/gated ──
{
  const mike = makeCombatant({ name: 'Michelangelo', side: 'ally', maxHp: 21000, atk: 2500, affinity: 'Void' });
  check('evadeChanceFor: Michelangelo base = 0.15', evadeChanceFor(mike) === 0.15, `${evadeChanceFor(mike)}`);
  mike.buffs.push({ type: 'Taunt', turnsLeft: 2 });
  check('evadeChanceFor: under [Taunt] = 0.30', evadeChanceFor(mike) === 0.30, `${evadeChanceFor(mike)}`);
  const nobody = makeCombatant({ name: 'Alice', side: 'ally', maxHp: 17000, affinity: 'Void' });
  check('gated: a non-evader has evade chance 0', evadeChanceFor(nobody) === 0);
}
{ // rollEvade fires under all-land, never under none; a non-evader never evades (no RNG draw)
  setChanceMode('all');
  const mike = makeCombatant({ name: 'Michelangelo', side: 'ally', maxHp: 21000, atk: 2500, affinity: 'Void' });
  const evAll = rollEvade(makeState({ allies: [mike], enemies: [], seed: null }), mike, null);
  setChanceMode('none');
  const evNone = rollEvade(makeState({ allies: [mike], enemies: [], seed: null }), mike, null);
  setChanceMode('threshold');
  const nobody = makeCombatant({ name: 'Alice', side: 'ally', maxHp: 17000, affinity: 'Void' });
  const evNobody = rollEvade(makeState({ allies: [nobody], enemies: [], seed: null }), nobody, null);
  check('rollEvade: evader evades under all-land, not under none; non-evader never evades', evAll && !evNone && !evNobody, `all=${evAll} none=${evNone} nobody=${evNobody}`);
}

// ── 3. Coldheart A3: +0.1 × enemy MAX HP formula term (crit off via 0 C.DMG) ──
{
  const cold = makeCombatant({ name: 'Coldheart', side: 'ally', atk: 2000, critRate: 0, critDmg: 0, affinity: 'Void' });
  const boss = makeCombatant({ name: 'Skavag', side: 'enemy', role: 'boss', maxHp: 1_000_000, def: 1000, res: 0, affinity: 'Void' });
  const r = applyRecipe(makeState({ allies: [cold], enemies: [boss], seed: null }), cold, RECIPES['COLDHEART-A3'])[0];
  // base = 1.7×2000 + 0.1×1,000,000 = 3400 + 100000 = 103,400 ; ×defMitigation(1000,60) ; crit factor 1 (cd 0)
  const exp = Math.round(103400 * defMitigation(1000, 60));
  check('Coldheart A3: damage includes +0.1×enemy MAX HP (1.7 ATK + 0.1 MaxHP)', r.raw_damage === exp, `got ${r.raw_damage} want ${exp}`);
}
{ // the maxHp term dominates: with a huge-HP boss the hit is far larger than the ATK-only term alone
  const cold = makeCombatant({ name: 'Coldheart', side: 'ally', atk: 2000, critRate: 0, critDmg: 0, affinity: 'Void' });
  const F_noMaxHp = { ...FORMULAS.F_COLDHEART_A3, perTargetMaxHp: undefined, critRateBonus: undefined };
  const boss = makeCombatant({ name: 'Skavag', side: 'enemy', role: 'boss', maxHp: 1_000_000, def: 1000, res: 0, affinity: 'Void' });
  const st = makeState({ allies: [cold], enemies: [boss], seed: null });
  const withMax = computeRawHit(st, cold, boss, FORMULAS.F_COLDHEART_A3).raw;
  const without = computeRawHit(st, cold, boss, F_noMaxHp).raw;
  check('Coldheart A3: enemy-MAX-HP term makes the hit ~30× the ATK-only term vs a 1M-HP boss', withMax > without * 25, `with ${Math.round(withMax)} without ${Math.round(without)}`);
}
{ // critRateBonus: the +30 crit chance raises deterministic-EV damage when the caster has C.DMG
  const cold = makeCombatant({ name: 'Coldheart', side: 'ally', atk: 2000, critRate: 0, critDmg: 100, affinity: 'Void' });
  const boss = makeCombatant({ name: 'Skavag', side: 'enemy', role: 'boss', maxHp: 1_000_000, def: 1000, res: 0, affinity: 'Void' });
  const st = makeState({ allies: [cold], enemies: [boss], seed: null });
  const F_noCrit = { ...FORMULAS.F_COLDHEART_A3, critRateBonus: undefined };
  const withBonus = computeRawHit(st, cold, boss, FORMULAS.F_COLDHEART_A3).raw;
  const without = computeRawHit(st, cold, boss, F_noCrit).raw;
  check('Coldheart A3: +30% crit-chance flag raises EV damage (caster has C.DMG)', withBonus > without, `with ${Math.round(withBonus)} without ${Math.round(without)}`);
}

// ── 4. Ninja [Escalation]: all 3 active skills hit ONE enemy in a Round → +ATK/+C.DMG (boss rate) ──
{
  const ninja = makeCombatant({ name: 'Ninja', side: 'ally', atk: 2400, critRate: 50, critDmg: 150, affinity: 'Void' });
  const baseAtk = ninja.atk, baseCdmg = ninja.critDmg;
  const boss = makeCombatant({ name: 'Skavag', side: 'enemy', role: 'boss', maxHp: 5e6, def: 1000, res: 0, affinity: 'Void' });
  const st = makeState({ allies: [ninja], enemies: [boss], seed: null });   // one enemy → A2's random hits all land on the boss
  applyRecipe(st, ninja, RECIPES['NINJA-A1']);
  check('Escalation: after A1 only (1/3 skills) — no bump', ninja.atk === baseAtk, `atk ${ninja.atk}`);
  applyRecipe(st, ninja, RECIPES['NINJA-A2']);
  check('Escalation: after A1+A2 (2/3) — still no bump', ninja.atk === baseAtk, `atk ${ninja.atk}`);
  applyRecipe(st, ninja, RECIPES['NINJA-A3']);
  // vs a Boss: +20% ATK, +10% C.DMG on the completion
  check('Escalation: A1+A2+A3 on the boss → +20% ATK (×1.20)', ninja.atk === Math.round(baseAtk * 1.20), `atk ${ninja.atk} want ${Math.round(baseAtk * 1.20)}`);
  check('Escalation: …and +10% C.DMG (×1.10)', Math.abs(ninja.critDmg - baseCdmg * 1.10) < 1e-6, `cdmg ${ninja.critDmg} want ${baseCdmg * 1.10}`);
}
{ // gated: a non-Ninja champ never escalates
  const cold = makeCombatant({ name: 'Coldheart', side: 'ally', atk: 2200, critRate: 0, critDmg: 0, affinity: 'Void' });
  const baseAtk = cold.atk;
  const boss = makeCombatant({ name: 'Skavag', side: 'enemy', role: 'boss', maxHp: 5e6, def: 500, res: 0, affinity: 'Void' });
  const st = makeState({ allies: [cold], enemies: [boss], seed: null });
  applyRecipe(st, cold, RECIPES['COLDHEART-A1']); applyRecipe(st, cold, RECIPES['COLDHEART-A2']); applyRecipe(st, cold, RECIPES['COLDHEART-A3']);
  check('gated: a non-Ninja champ never escalates (ATK unchanged)', cold.atk === baseAtk, `atk ${cold.atk}`);
}
{ // non-boss enemy uses the +10%/+5% rate
  const ninja = makeCombatant({ name: 'Ninja', side: 'ally', atk: 2400, critRate: 50, critDmg: 150, affinity: 'Void' });
  const baseAtk = ninja.atk;
  const add = makeCombatant({ name: 'Spiderling#1', side: 'enemy', role: 'add', maxHp: 5e6, def: 500, res: 0, affinity: 'Void' });
  const st = makeState({ allies: [ninja], enemies: [add], seed: null });
  applyRecipe(st, ninja, RECIPES['NINJA-A1']); applyRecipe(st, ninja, RECIPES['NINJA-A2']); applyRecipe(st, ninja, RECIPES['NINJA-A3']);
  check('Escalation: vs a NON-boss enemy → +10% ATK (×1.10)', ninja.atk === Math.round(baseAtk * 1.10), `atk ${ninja.atk} want ${Math.round(baseAtk * 1.10)}`);
}

console.log(`\n══ SPIDER RECIPE MECHANICS ══  ${pass} passed, ${fail} failed\n`);
for (const f of failures) console.log(`  ✗ ${f}`);
console.log('QA_JSON ' + JSON.stringify({ rung: 'recipe-spider', pass, fail, failures }));
process.exit(fail ? 1 : 0);
