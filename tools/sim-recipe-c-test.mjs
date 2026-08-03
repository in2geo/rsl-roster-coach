// tools/sim-recipe-c-test.mjs — Milestone II-C proof: state manipulation produces expected results.
//
// Two things per mechanic: the recipe PLACES the right value, AND the engine CONSUMER fires (a shield
// absorbs, a taunt pulls the hit, ally-protection redistributes). Deterministic. Run: node tools/sim-recipe-c-test.mjs
import { makeCombatant, makeState, dealDamage, chooseAllyTarget, defMitigation, tickBombs } from '../lib/sim/engine.js';
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
// 6 — ALLY PROTECTION: Vergis A2 protects all allies except self; a hit on a protected ally redirects to
// VERGIS (the placer), NOT to the other protected allies. Card: "on all allies except this Champion" — the
// protector absorbs the redirected share (verified 2026-07-30; see engine.dealDamage + sim-selftest #23).
{
  const v = makeCombatant({ name: 'Vergis', side: 'ally', def: 1200, maxHp: 16000, affinity: 'Void', critRate: 0 });
  const a1 = makeCombatant({ name: 'A1', side: 'ally', maxHp: 20000, affinity: 'Void' });
  const a2 = makeCombatant({ name: 'A2', side: 'ally', maxHp: 20000, affinity: 'Void' });
  const team = [v, a1, a2];
  applyRecipe(makeState({ allies: team, enemies: [enemy()], seed: null }), v, RECIPES['VERGIS-A2']);
  const placedRight = !v.buffs.some((b) => b.type === 'Ally Protection') && a1.buffs.some((b) => b.type === 'Ally Protection') && a2.buffs.some((b) => b.type === 'Ally Protection');
  const bv = v.hp, b1 = a1.hp, b2 = a2.hp;
  dealDamage(a1, 10000, 'direct', makeCombatant({ name: 'Mob', side: 'enemy' }), team);   // 50% of 10000 redirects onto Vergis (placer)
  const redirectedToPlacer = (bv - v.hp) > 0 && (b1 - a1.hp) < 10000 && (b2 - a2.hp) === 0;
  check('ALLY PROTECTION on all-except-self, redirect lands on the placer (Vergis)', placedRight && redirectedToPlacer, `vergis took ${bv - v.hp}, a1 took ${b1 - a1.hp}, a2 took ${b2 - a2.hp}`);
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

// N — CRIT-HEAL rider (Lua A2): "each critical hit heals this Champion by 2.5% HP". EV path (seed=null): at
// 100% crit every hit heals; 3 hits × 2.5% × 20000 = +1500. At 0% crit, no heal.
{
  const lua = makeCombatant({ name: 'Lua', side: 'ally', atk: 1000, maxHp: 20000, critRate: 100, critDmg: 0, affinity: 'Void' }); lua.hp = 10000;
  const e = makeCombatant({ name: 'Mob', side: 'enemy', maxHp: 1e9, def: 1000, affinity: 'Void' });
  applyRecipe(makeState({ allies: [lua], enemies: [e], seed: null }), lua, RECIPES['LUA-A2']);
  check('crit-heal (Lua A2): 3 hits at 100% crit heal 2.5% each (10000 → 11500)', lua.hp === 11500, `hp ${lua.hp}`);
  const lua0 = makeCombatant({ name: 'Lua', side: 'ally', atk: 1000, maxHp: 20000, critRate: 0, critDmg: 0, affinity: 'Void' }); lua0.hp = 10000;
  const e0 = makeCombatant({ name: 'Mob', side: 'enemy', maxHp: 1e9, def: 1000, affinity: 'Void' });
  applyRecipe(makeState({ allies: [lua0], enemies: [e0], seed: null }), lua0, RECIPES['LUA-A2']);
  check('crit-heal control: 0% crit → no heal (stays 10000)', lua0.hp === 10000, `hp ${lua0.hp}`);
}
// N — CRIT-SPLASH rider (Lua A1): "deals 50% of the inflicted damage to all enemies if critical". EV path:
// at 100% crit the OTHER enemy takes splash; at 0% crit it is untouched.
{
  const mk = (cr) => {
    const lua = makeCombatant({ name: 'Lua', side: 'ally', atk: 2000, maxHp: 20000, critRate: cr, critDmg: 0, affinity: 'Void' });
    const e1 = makeCombatant({ name: 'Primary', side: 'enemy', maxHp: 1e9, def: 1000, affinity: 'Void' });
    const e2 = makeCombatant({ name: 'Other', side: 'enemy', maxHp: 1e9, def: 1000, affinity: 'Void' });
    applyRecipe(makeState({ allies: [lua], enemies: [e1, e2], seed: null }), lua, RECIPES['LUA-A1']);
    return { e1, e2 };
  };
  const hot = mk(100), cold = mk(0);
  check('crit-splash (Lua A1): 100% crit splashes 50% to the OTHER enemy', hot.e2.hp < 1e9 && hot.e1.hp < 1e9, `other took ${1e9 - hot.e2.hp}`);
  check('crit-splash control: 0% crit → OTHER enemy untouched (primary still hit)', cold.e2.hp === 1e9 && cold.e1.hp < 1e9, `other took ${1e9 - cold.e2.hp}`);
}

// N — DEBUFF_ACTIVATION (Ezio A2): "instantly activates all [Poison] on enemies under 4+ debuffs" — Poison
// STACKS count individually toward the threshold; activated Poison deals damage and is REMOVED (Poison
// Sensitivity is left in place). seed=null: Ezio's 75% placements land (threshold + high ACC vs res 0).
{
  const ezio = () => makeCombatant({ name: 'Ezio Auditore', side: 'ally', atk: 2000, acc: 500, affinity: 'Void', critRate: 0 });
  // 4+ slots: 1 pre-existing + 2 Poison stacks + 1 Poison Sensitivity → activated & removed
  const e1 = makeCombatant({ name: 'Mob', side: 'enemy', maxHp: 1e7, def: 1000, res: 0, affinity: 'Void' });
  e1.debuffs.push({ type: 'Decrease Defense', value: 60, turnsLeft: 2 });
  const a1 = ezio(); applyRecipe(makeState({ allies: [a1], enemies: [e1], seed: null }), a1, RECIPES['EZIO-A2']);
  check('DEBUFF_ACTIVATION: ≥4 debuff slots → Poison activated & removed (Poison Sensitivity stays)',
    !e1.debuffs.some(d => d.type === 'Poison') && e1.debuffs.some(d => d.type === 'Poison Sensitivity'), `debuffs=${e1.debuffs.map(d => d.type)}`);
  // <4 slots: 2 Poison stacks + 1 Poison Sensitivity = 3 → NOT activated → Poison remains
  const e2 = makeCombatant({ name: 'Mob', side: 'enemy', maxHp: 1e7, def: 1000, res: 0, affinity: 'Void' });
  const a2 = ezio(); applyRecipe(makeState({ allies: [a2], enemies: [e2], seed: null }), a2, RECIPES['EZIO-A2']);
  check('DEBUFF_ACTIVATION control: <4 debuff slots → Poison remains (not activated)',
    e2.debuffs.some(d => d.type === 'Poison'), `debuffs=${e2.debuffs.map(d => d.type)}`);
}

// N — BOOST_SHIELD (Bambus A2): after decreasing enemy buff durations, ally [Shield] value rises by 3% of
// Bambus's MAX HP per enemy buff decreased. Base shield 30%×20000 = 6000; 2 enemy buffs decreased →
// +3%×20000×2 = +1200 → 7200.
{
  const bam = makeCombatant({ name: 'Bambus', side: 'ally', atk: 1000, maxHp: 20000, affinity: 'Void', critRate: 0 });
  const e1 = makeCombatant({ name: 'Mob1', side: 'enemy', maxHp: 1e9, def: 1000, affinity: 'Void' }); e1.buffs.push({ type: 'Increase DEF', value: 60, turnsLeft: 2 });
  const e2 = makeCombatant({ name: 'Mob2', side: 'enemy', maxHp: 1e9, def: 1000, affinity: 'Void' }); e2.buffs.push({ type: 'Increase C.RATE', value: 30, turnsLeft: 2 });
  applyRecipe(makeState({ allies: [bam], enemies: [e1, e2], seed: null }), bam, RECIPES['BAMBUS-A2']);
  const sh = bam.buffs.find(b => b.type === 'Shield');
  check('BOOST_SHIELD: shield 6000 + 3%MaxHP × 2 buffs decreased = 7200', sh?.value === 7200, `shield ${sh?.value}`);
}

// N — Pelops A2 post-damage gate: steal all buffs + [Stun] 2t ONLY if the hit dealt <50% of target MAX HP;
// both effects unresistable if the target is under [HP Burn].
{
  const mkPel = (acc = 200) => makeCombatant({ name: 'Pelops the Victor', side: 'ally', atk: 0, maxHp: 100000, acc, affinity: 'Void', critRate: 0, critDmg: 0 });
  // A — big target (raw << 50% MaxHP) → steal + stun
  const pelA = mkPel(); const tA = makeCombatant({ name: 'Mob', side: 'enemy', maxHp: 1e7, def: 1000, res: 0, affinity: 'Void' });
  tA.buffs.push({ type: 'Increase ATK', value: 50, turnsLeft: 2 });
  applyRecipe(makeState({ allies: [pelA], enemies: [tA], seed: null }), pelA, RECIPES['PELOPS-A2']);
  check('Pelops A2 (<50% MaxHP hit): steals buffs + places [Stun]',
    !tA.buffs.some(b => b.type === 'Increase ATK') && tA.debuffs.some(d => d.type === 'Stun') && pelA.buffs.some(b => b.type === 'Increase ATK'),
    `tBuffs=${tA.buffs.map(b => b.type)} tDeb=${tA.debuffs.map(d => d.type)}`);
  // B — small target (raw >= 50% MaxHP) → no steal, no stun
  const pelB = mkPel(); const tB = makeCombatant({ name: 'Mob', side: 'enemy', maxHp: 40000, def: 0, res: 0, affinity: 'Void' });
  tB.buffs.push({ type: 'Increase ATK', value: 50, turnsLeft: 2 });
  applyRecipe(makeState({ allies: [pelB], enemies: [tB], seed: null }), pelB, RECIPES['PELOPS-A2']);
  check('Pelops A2 (>=50% MaxHP hit): NO steal, NO [Stun]',
    tB.buffs.some(b => b.type === 'Increase ATK') && !tB.debuffs.some(d => d.type === 'Stun'), `tBuffs=${tB.buffs.map(b => b.type)}`);
  // C — [Stun] unresistable only under [HP Burn] (high-RES target, Pelops acc 0)
  const stunLands = (hpBurn) => {
    const pel = mkPel(0); const t = makeCombatant({ name: 'Mob', side: 'enemy', maxHp: 1e7, def: 1000, res: 300, affinity: 'Void' });
    if (hpBurn) t.debuffs.push({ type: 'HP Burn', turnsLeft: 2 });
    applyRecipe(makeState({ allies: [pel], enemies: [t], seed: null }), pel, RECIPES['PELOPS-A2']);
    return t.debuffs.some(d => d.type === 'Stun');
  };
  check('Pelops A2 [Stun]: RESISTED vs high-RES target (acc 0, res 300)', stunLands(false) === false);
  check('Pelops A2 [Stun]: UNRESISTABLE when the target is under [HP Burn]', stunLands(true) === true);
}

// N — Ezio A2 [Stone Skin]→[Bomb] branch: [Stone Skin] enemies get 2 [Bomb] (6×ATK, detonate after 2t) INSTEAD
// of Poison; non-[Stone Skin] enemies get Poison. If ALL enemies are Stone-Skin, the countdown drops to 1.
{
  const ez = () => makeCombatant({ name: 'Ezio Auditore', side: 'ally', atk: 1000, acc: 500, affinity: 'Void', critRate: 0 });
  const stone = (n) => { const c = makeCombatant({ name: n, side: 'enemy', maxHp: 1e7, def: 1000, res: 0, affinity: 'Void' }); c.buffs.push({ type: 'Stone Skin', turnsLeft: 3 }); return c; };
  // mixed: one Stone-Skin, one plain
  const s1 = stone('Stone'); const plain = makeCombatant({ name: 'Plain', side: 'enemy', maxHp: 1e7, def: 1000, res: 0, affinity: 'Void' });
  const ezA = ez(); applyRecipe(makeState({ allies: [ezA], enemies: [s1, plain], seed: null }), ezA, RECIPES['EZIO-A2']);
  const bombs = s1.debuffs.filter(d => d.type === 'Bomb');
  check('Ezio A2 [Stone Skin] branch: 2 [Bomb] on the Stone-Skin enemy, no Poison', bombs.length === 2 && !s1.debuffs.some(d => d.type === 'Poison'), `stone=${s1.debuffs.map(d => d.type)}`);
  check('Ezio A2: the non-Stone-Skin enemy gets Poison, no [Bomb]', plain.debuffs.some(d => d.type === 'Poison') && !plain.debuffs.some(d => d.type === 'Bomb'), `plain=${plain.debuffs.map(d => d.type)}`);
  check('Ezio A2 [Bomb]: value 6×ATK (6000), countdown 2 (not all enemies Stone-Skin)', bombs[0]?.value === 6000 && bombs[0]?.countdown === 2, `value=${bombs[0]?.value} cd=${bombs[0]?.countdown}`);
  // all enemies Stone-Skin → countdown reduced to 1
  const a1 = stone('S1'), a2 = stone('S2'); const ezB = ez();
  applyRecipe(makeState({ allies: [ezB], enemies: [a1, a2], seed: null }), ezB, RECIPES['EZIO-A2']);
  check('Ezio A2: ALL enemies Stone-Skin → [Bomb] countdown reduced to 1', a1.debuffs.find(d => d.type === 'Bomb')?.countdown === 1, `cd=${a1.debuffs.find(d => d.type === 'Bomb')?.countdown}`);
}
// N — [Bomb] detonation (engine.tickBombs): countdown drops at the start of the bearer's turn; at 0 it detonates
// for its stored value and is removed.
{
  const c = makeCombatant({ name: 'Victim', side: 'enemy', maxHp: 1e7, affinity: 'Void' });
  c.debuffs.push({ type: 'Bomb', value: 6000, countdown: 2, turnsLeft: 999, stacks: 1 });
  const st = makeState({ allies: [], enemies: [c], seed: null });
  tickBombs(st, c);
  check('[Bomb]: countdown 2→1, no detonation yet (HP unchanged)', c.debuffs.find(d => d.type === 'Bomb')?.countdown === 1 && c.hp === 1e7, `cd=${c.debuffs.find(d => d.type === 'Bomb')?.countdown} hp=${c.hp}`);
  tickBombs(st, c);
  check('[Bomb]: countdown 1→0 detonates for 6000 and is removed', !c.debuffs.some(d => d.type === 'Bomb') && c.hp === 1e7 - 6000, `hp=${c.hp}`);
}

console.log(`\n=== ${pass} passed, ${fail} failed ===\n`);
process.exit(fail ? 1 : 0);
