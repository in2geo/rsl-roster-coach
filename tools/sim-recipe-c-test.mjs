// tools/sim-recipe-c-test.mjs — Milestone II-C proof: state manipulation produces expected results.
//
// Two things per mechanic: the recipe PLACES the right value, AND the engine CONSUMER fires (a shield
// absorbs, a taunt pulls the hit, ally-protection redistributes). Deterministic. Run: node tools/sim-recipe-c-test.mjs
import { makeCombatant, makeState, dealDamage, chooseAllyTarget, defMitigation } from '../lib/sim/engine.js';
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
  check('IGNORE_SHIELD: Faceless A3 bypasses [Shield] (HP damage, shield intact)', r1.hp_damage > 0 && r1.shield_damage === 0 && (t1.buffs.find(b => b.type === 'Shield')?.value ?? 0) === 5000, `hp ${r1.hp_damage}, shieldDmg ${r1.shield_damage}, shield ${t1.buffs.find(b => b.type === 'Shield')?.value}`);
  check('IGNORE_SHIELD control: a normal skill IS absorbed by the shield', r2.shield_damage > 0 && r2.hp_damage === 0, `shieldDmg ${r2.shield_damage}, hp ${r2.hp_damage}`);
  // "ignore [Shield]" is a DIFFERENT buff from [Magma Shield] — it must NOT bypass Magma Shield (Pelops's tank
  // identity). Card text: Lua/Faceless A3 "ignore [Shield] and [Block Damage]", NOT Magma Shield.
  const magma = () => { const t = makeCombatant({ name: 'Mob', side: 'enemy', maxHp: 1e9, def: 1000, affinity: 'Void' }); t.buffs.push({ type: 'Magma Shield', value: 10000, turnsLeft: 2 }); return t; };
  const t3 = magma(); const r3 = applyRecipe(makeState({ allies: [atk], enemies: [t3], seed: null }), atk, RECIPES['FACELESS-A3'])[0];   // ignore_shield must NOT bypass Magma Shield
  check('IGNORE_SHIELD does NOT bypass [Magma Shield] (absorbed, not straight to HP)', r3.shield_damage > 0 && r3.hp_damage === 0, `shieldDmg ${r3.shield_damage}, hp ${r3.hp_damage}`);
}

// 8b — BLOCK DAMAGE consumer + IGNORE_BLOCK_DAMAGE: a [Block Damage] buff negates a normal hit entirely;
// Faceless/Lua A3 (ignore_block_damage) bypass it and land on HP. [Block Damage] is NOT a pool — a normal hit
// is fully blocked with the buff still present afterward.
{
  const atk = makeCombatant({ name: 'Faceless', side: 'ally', atk: 2000, affinity: 'Void', critRate: 0 });
  const blocked = () => { const t = makeCombatant({ name: 'Mob', side: 'enemy', maxHp: 1e9, def: 1000, affinity: 'Void' }); t.buffs.push({ type: 'Block Damage', turnsLeft: 2 }); return t; };
  const t1 = blocked(); const r1 = applyRecipe(makeState({ allies: [atk], enemies: [t1], seed: null }), atk, RECIPES['BAMBUS-A1'])[0];    // normal — fully blocked
  const t2 = blocked(); const r2 = applyRecipe(makeState({ allies: [atk], enemies: [t2], seed: null }), atk, RECIPES['FACELESS-A3'])[0]; // ignore_block_damage — lands
  const t3 = blocked(); const r3 = applyRecipe(makeState({ allies: [atk], enemies: [t3], seed: null }), atk, RECIPES['LUA-A3'])[0];      // ignore_block_damage — lands
  check('BLOCK DAMAGE: a normal hit is fully blocked (0 to HP, 0 to shield, buff intact)',
    r1.hp_damage === 0 && r1.shield_damage === 0 && t1.buffs.some((b) => b.type === 'Block Damage'), `hp ${r1.hp_damage}, shieldDmg ${r1.shield_damage}`);
  check('IGNORE_BLOCK_DAMAGE: Faceless A3 bypasses [Block Damage] (lands on HP)', r2.hp_damage > 0, `hp ${r2.hp_damage}`);
  check('IGNORE_BLOCK_DAMAGE: Lua A3 bypasses [Block Damage] (lands on HP)', r3.hp_damage > 0, `hp ${r3.hp_damage}`);
}

// N — LIFESTEAL (gear 4-set): a champion heals 30% of the damage it deals, on the RECIPE path (dealOneHit).
// The primary sustain source for a Lifesteal tank; it was consumed on the old engine path but not here.
{
  const pel = makeCombatant({ name: 'Pelops', side: 'ally', atk: 0, maxHp: 100000, affinity: 'Void', critRate: 0, critDmg: 0, lifesteal: 0.30 });
  pel.hp = 50000;   // damaged, so the heal is visible (not capped at MAX)
  const t = makeCombatant({ name: 'Mob', side: 'enemy', maxHp: 1e9, def: 1000, affinity: 'Void' });
  const r = applyRecipe(makeState({ allies: [pel], enemies: [t], seed: null }), pel, RECIPES['PELOPS-A1'])[0];
  // Pelops A1 = 0.25×100,000 × defMitigation(1000,60) → dealt; lifesteal heals 30% of the (unrounded) damage.
  // Mitigation computed from the verified formula; heal pinned to 0.30×dealt within a rounding unit.
  const expDealt = Math.round(0.25 * 100000 * defMitigation(1000, 60));
  const healed = pel.hp - 50000;
  check(`LIFESTEAL: recipe-path attacker heals 30% of damage dealt (0.30×${expDealt})`, r.hp_damage === expDealt && Math.abs(healed - 0.30 * r.hp_damage) < 1, `dealt=${r.hp_damage} healed=${healed.toFixed(1)}`);
}

// N — SELF_DAMAGE: Renegade A3 costs 30% of its OWN max HP, bypassing DEF/shields, and is lethal below 30%.
{
  const ren = () => makeCombatant({ name: 'Renegade', side: 'enemy', maxHp: 20000, atk: 1000, def: 1000, affinity: 'Void' });
  const foe = makeCombatant({ name: 'Hero', side: 'ally', maxHp: 1e9, affinity: 'Void' });
  const r1 = ren();   // full HP → loses exactly 30% of max (6000)
  applyRecipe(makeState({ allies: [foe], enemies: [r1], seed: null }), r1, RECIPES['RENEGADE-A3']);
  check('SELF_DAMAGE: Renegade A3 costs 30% of MAX HP (20000 → 14000)', r1.hp === 14000, `hp ${r1.hp}`);
  const r2 = ren(); r2.hp = 4000;   // 20% < 30% → the self-damage is LETHAL (floors at 0)
  applyRecipe(makeState({ allies: [foe], enemies: [r2], seed: null }), r2, RECIPES['RENEGADE-A3']);
  check('SELF_DAMAGE: lethal below 30% HP (4000 → 0)', r2.hp === 0, `hp ${r2.hp}`);
}

// N — REDUCE_EFFECT_DURATION: Bambus A2 decreases all enemy buff durations by 1t (75% → fires at seed=null
// threshold). A buff reduced to 0 drops off.
{
  const bam = makeCombatant({ name: 'Bambus', side: 'ally', atk: 1000, maxHp: 20000, affinity: 'Void', critRate: 0 });
  const e1 = makeCombatant({ name: 'Mob1', side: 'enemy', maxHp: 1e9, def: 1000, affinity: 'Void' }); e1.buffs.push({ type: 'Increase C.RATE', value: 30, turnsLeft: 2 });
  const e2 = makeCombatant({ name: 'Mob2', side: 'enemy', maxHp: 1e9, def: 1000, affinity: 'Void' }); e2.buffs.push({ type: 'Increase DEF', value: 60, turnsLeft: 1 });
  applyRecipe(makeState({ allies: [bam], enemies: [e1, e2], seed: null }), bam, RECIPES['BAMBUS-A2']);
  check('REDUCE_EFFECT_DURATION: enemy buff 2t → 1t', e1.buffs.find(b => b.type === 'Increase C.RATE')?.turnsLeft === 1, `t=${e1.buffs.find(b => b.type === 'Increase C.RATE')?.turnsLeft}`);
  check('REDUCE_EFFECT_DURATION: enemy buff 1t → dropped off (reduced to 0)', !e2.buffs.some(b => b.type === 'Increase DEF'), `has=${e2.buffs.some(b => b.type === 'Increase DEF')}`);
}

console.log(`\n=== ${pass} passed, ${fail} failed ===\n`);
process.exit(fail ? 1 : 0);
