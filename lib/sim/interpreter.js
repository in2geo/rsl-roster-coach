// lib/sim/interpreter.js — Phase II recipe INTERPRETER (Milestone 0, Step 3, damage scope).
//
// Reads a skill RECIPE (lib/sim/recipes.js) and executes its actions in `seq` order by calling the
// engine mechanics we already have and have reality-checked (dealDamage, crit/affinity/DEF math). This is
// the data-driven replacement for engine.applySkill's damage path — same numbers, sourced from data instead
// of a hard-coded function. RNG is untouched: the same seeded streams feed the same rolls; seed=null stays
// deterministic. SCOPE: ACQUIRE_TARGETS + DEAL_DAMAGE only. Unknown operations/operands FLAG, never guess.

import {
  dealDamage, effectiveScaleStat, critMult, effectiveCritRate, defMitigation, effectiveDef, effectiveAcc, affinityFactor, affinityMult, dmgVariance,
  chooseSingleTarget, recordEffect, flag, landChance, rollChance, rollLand, applyDebuff, upsert,
  computeRawHit, incomingDamage, fillTurnMeter, dealMaxHpDamage, fireGearProcs, applyWarmaster,
  fireOnAttacked, healReduction, activatePoisons, activateHpBurns, debuffSlots, rollEvade,
  syncStackDerived, ensureStackList,
} from './engine.js';
import { registerRecipeEngine } from './recipe-registry.js';
import { RECIPES, FORMULAS, CONDITIONS, champKey, combatantKey } from './recipes.js';
// incomingDamage moved to engine.js (so applySkill can share it too); re-export so existing importers
// (model-snapshot / model-sensitivity / model-invariants) keep resolving it from interpreter.js.
export { incomingDamage };

const alive = (arr) => arr.filter((c) => c.alive);
const shieldPool = (c) => c.buffs.reduce((s, b) => s + (/Shield/.test(b.type) ? Math.max(0, b.value || 0) : 0), 0);

// Look up the recipe for a combatant's chosen slot. Allies carry SHORT names (Bambus, Ezio, …); the recipe
// key is `<FIRSTNAME UPPER>-<SLOT>`. Returns null when no recipe exists (caller falls back to the old path).
export function recipeFor(actor, slot) {
  // combatantKey = the identity stamped at build (champId → canonical name → key); falls back to champKey(name)
  // for un-resolved combatants. This is why an aliased name ('Artor' for 'Iudex Artor') still finds its recipe.
  const first = combatantKey(actor);
  return RECIPES[`${first}-${String(slot).toUpperCase()}`] ?? null;
}

// KIT→RECIPE — synthesize a recipe from a parsed (readSkillKit) skill, so an UN-authored combatant runs the
// SAME interpreter as authored ones instead of the separate applySkill engine. This is the last piece of
// retiring the second engine: `recipeFor(actor,slot) || kitToRecipe(skill)` gives every combatant ONE path.
// Each parsed field maps to the op that reproduces applySkill's behaviour; a raw kit has no formula gates, so
// every damage multiplier flag is ON. Fields: parsed side uses value/turns, the recipe ops use magnitude/duration.
export function kitToRecipe(skill) {
  if (!skill || skill.isPassive) return null;
  const actions = [];
  let seq = 0; const S = () => (seq += 10);
  if (skill.hitsEnemies) {
    actions.push({ seq: S(), op: 'ACQUIRE_TARGETS', target: skill.aoe ? 'all_enemies' : 'single' });
    if (skill.maxHpPct != null || skill.coeff != null || (skill.coeffTerms?.length)) {
      actions.push({ seq: S(), op: 'DEAL_DAMAGE', target: 'current_target', formula: {
        scalingStat: skill.coeffStat, multiplier: skill.coeff, terms: skill.coeffTerms,
        perTargetDebuff: skill.perTargetDebuff ? { coeff: skill.perTargetDebuff, stat: 'ATK' } : undefined,
        maxHpPct: skill.maxHpPct,
        flags: { crit: true, def_mitigation: true, affinity: true, variance: true }, hitCount: 1,
      } });
    } else if (skill.coeff == null && skill.maxHpPct == null) {
      // MISSING damage_multiplier — an authored gap; keep it visible exactly like applySkill's flag path.
      actions.push({ seq: S(), op: 'DEAL_DAMAGE', target: 'current_target', formula: { scalingStat: skill.coeffStat, multiplier: null, flags: { crit: true, def_mitigation: true, affinity: true, variance: true }, hitCount: 1 } });
    }
    for (const d of skill.debuffs ?? []) actions.push({ seq: S(), op: 'PLACE_DEBUFF', target: 'intended_set',
      effect: { type: d.type, magnitude: d.value, pct: d.pct, duration: d.turns, chance: d.chance ?? null, accuracy_check: true, count: d.count, stacking: d.stacking, maxStacks: d.maxStacks } });
    if (skill.turnMeterEnemy) actions.push({ seq: S(), op: 'REDUCE_TURN_METER', target: 'intended_set', effect: { pct: skill.turnMeterEnemy / 100, accuracy_check: true } });
    for (const cd of skill.conditionalDebuffs ?? []) actions.push({ seq: S(), op: 'PLACE_DEBUFF', target: 'intended_set', condition: cd.condition,
      effect: { type: cd.type, duration: cd.turns, chance: null, accuracy_check: true } });
  }
  for (const b of skill.buffs ?? []) actions.push({ seq: S(), op: 'PLACE_BUFF', target: b.self ? 'self' : 'all_allies',
    effect: { type: b.type, magnitude: b.value, pctOfCasterMaxHp: b.pctOfCasterMaxHp, duration: b.turns, chance: b.chance ?? null } });
  if (skill.turnMeterAlly) actions.push({ seq: S(), op: 'FILL_TURN_METER', target: skill.turnMeterAllySelf ? 'self' : 'all_allies', effect: { pct: skill.turnMeterAlly / 100 } });
  if (skill.healPct) actions.push({ seq: S(), op: 'HEAL', target: 'all_allies', effect: { pctOfCasterMaxHp: skill.healPct } });
  if (skill.revives) actions.push({ seq: S(), op: 'REVIVE', target: 'all_dead_allies', effect: { hpPct: 0.30 } });
  if (skill.cleanses) actions.push({ seq: S(), op: 'CLEANSE', target: 'all_allies' });
  if (skill.extraTurn || skill.extraTurnOnKill) actions.push({ seq: S(), op: 'EXTRA_TURN', onKill: !skill.extraTurn && !!skill.extraTurnOnKill });
  return { slot: skill.slot, name: skill.skill_name ?? skill.slot, type: 'active', actions, synthesized: true };
}

// ── condition evaluation (structured, not prose) ───────────────────────────────
function resolveOperand(name, ctx) {
  switch (name) {
    case 'target_debuff_count': return ctx.target?.debuffs?.length ?? 0;
    case 'target_hp_pct':       return ctx.target ? ctx.target.hp / (ctx.target.maxHp || 1) : 1;
    case 'hit_was_critical':    return !!ctx.critical;
    default:                    return undefined;   // unknown -> caller FLAGs
  }
}
function evalCondition(cond, ctx) {
  const L = resolveOperand(cond.left, ctx);
  if (L === undefined) return undefined;            // unknown operand
  const R = cond.right;
  switch (cond.comparator) {
    case '>=': return L >= R; case '>': return L > R;
    case '<=': return L <= R; case '<': return L < R;
    case '=': case '==': return L === R; case '!=': return L !== R;
    default: return undefined;
  }
}

// ── ACQUIRE_TARGETS ────────────────────────────────────────────────────────────
// Build the intended target set. `target: 'all_enemies' | 'single'`, or a conditional `targetIf`
// (the Bambus case: pick the single target by the normal rule, then flip to all-enemies if it qualifies).
function acquireTargets(state, actor, act, opponents, avoid) {
  const live = alive(opponents);
  // The "easiest to kill" rule is the hardcoded RSL enemy AI (Mike first-party 2026-07-30) — pass the ENEMY
  // attacker so chooseSingleTarget scores mitigation-aware killability. Our own champs keep raw-effHP targeting
  // (attacker omitted) for now; the enemy-AI path is the one this rule governs across every dungeon.
  const atkr = actor.side === 'enemy' ? actor : null;
  // SPIDER'S DEN: Spiderlings are UNTARGETABLE by DIRECT single-target attacks (Mike first-party 2026-07-31 —
  // "nobody attacks spiderlings directly"). The team's single-target skills can only pick the boss; adds are hit
  // ONLY by AoE. This is load-bearing: it keeps the team's debuffs on the BOSS (which carries 2+ debuffs 94% of
  // the time), so Bambus A1's conditional AoE ("all enemies if target has 2+ debuffs") fires on nearly every
  // cast and BLANKETS the swarm with [Decrease SPD] — the swarm-slow uptime reality shows (>50%) and the sim
  // lacked (~16%). AoE selectors still return `live` (all enemies incl. adds), so AoE damage is unchanged.
  const singlePool = (state.addsUntargetableBySingle && actor.side === 'ally')
    ? opponents.filter((o) => o.role !== 'add') : opponents;
  if (act.targetIf) {
    const selected = chooseSingleTarget(singlePool, avoid, atkr, state);
    if (!selected) return [];
    const cond = CONDITIONS[act.targetIf.conditionId];
    if (!cond) { flag(state, `UNKNOWN condition ${act.targetIf.conditionId}: ${actor.name} ${act.op}`); return [selected]; }
    const pass = evalCondition(cond, { target: selected });
    if (pass === undefined) { flag(state, `UNKNOWN condition operand '${cond.left}': ${actor.name}`); return [selected]; }
    const branch = pass ? act.targetIf.then : act.targetIf.else;
    return branch === 'all_enemies' ? live : [selected];
  }
  // boss-conditional single-vs-AoE (Ninja A3 "Cyan Slash": vs a Boss, attack ONLY the Boss; otherwise AoE all).
  if (act.target === 'boss_else_all_enemies') { const boss = live.find((o) => o.role === 'boss'); return boss ? [boss] : live; }
  if (act.target === 'all_enemies') return live;
  if (act.target === 'single') { const s = chooseSingleTarget(singlePool, avoid, atkr, state); if (s && actor.side === 'enemy') recordTargeting(state, opponents, s); return s ? [s] : []; }
  flag(state, `UNKNOWN target selector '${act.target}': ${actor.name} ${act.op}`);
  return [];
}
// TARGETING outcome ledger (defensive): when a MOB picks a single ally to hit, record whether [Taunt]/[Provoke]
// forced the pick onto the taunter (consumed=true) and whether [Perfect Veil] kept a veiled ally OUT of the
// pick (consumed=true). Lets turn-verify prove these targeting buffs actually steer fire, not just get placed.
export function recordTargeting(state, pool, picked) {
  const live = pool.filter((a) => a.alive);
  const taunters = live.filter((a) => a.buffs?.some((b) => b.type === 'Taunt' || b.type === 'Provoke'));
  if (taunters.length) recordEffect(state, { kind: 'target', subtype: 'Taunt', target: picked.name, fired: true, consumed: taunters.includes(picked), note: taunters.includes(picked) ? undefined : 'taunt NOT respected' });
  const veiled = live.filter((a) => a.buffs?.some((b) => b.type === 'Perfect Veil'));
  if (veiled.length) recordEffect(state, { kind: 'target', subtype: 'Perfect Veil', target: picked.name, fired: true, consumed: !veiled.includes(picked), note: veiled.includes(picked) ? 'veiled ally targeted' : undefined });
}

// ── DEAL_DAMAGE ────────────────────────────────────────────────────────────────
// One hit against one target. The raw-damage NUMBER (multiplier stack + incoming modifiers) comes from the
// SHARED engine.computeRawHit — the same function applySkill uses, so the two engines cannot drift on the
// math. This function keeps only the APPLICATION (dealDamage / lifesteal / reflect / reactions) + the
// structured resolution object + the FIRED/CONSUMED ledger effect.
function dealOneHit(state, actor, t, F, opponents, E, bookMult = 1) {
  if (!t.alive) return { target: t.name, skipped: 'target already dead' };
  // EVADE: a defender with an evade passive (Michelangelo A4) fully negates an incoming ENEMY hit + its damage.
  // Gated (no-op for defenders without the field → Dragon byte-identical). Recipe-path enemies with an evader
  // defender are the general case; the accompanying-effect debuffs from separate PLACE_DEBUFF actions are NOT
  // negated here (no recipe-driven enemy has an evader today — Spider's scripted paths handle full negation).
  if (actor.side === 'enemy' && t.side === 'ally' && rollEvade(state, t, actor, E)) {
    return { target: t.name, evaded: true, raw_damage: 0, hp_damage: 0, survived: t.hp > 0 };
  }
  const fl = F.flags || {};
  const _h = computeRawHit(state, actor, t, F);
  const { critM, affM, crit, critEv } = _h;
  const raw = _h.raw * bookMult;   // SKILL-BOOK DAMAGE: a flat ×(1+B) on the skill's damage, SEPARATE from the coefficient. bookMult is 1 unless the caller (DEAL_DAMAGE) resolves F.bookDamage against the actor's real booked state.
  const incoming = actor.side === 'enemy' && t.side === 'ally';
  const before = t.hp + shieldPool(t);
  const dd = dealDamage(t, raw, 'direct', actor, opponents, !!fl.ignore_shield, !!fl.ignore_block_damage);
  const dealt = before - (t.hp + shieldPool(t));
  // A 0-HP-and-shield delta is not a "represented-but-not-consumed" defect — it is the target's DEFENCE
  // working: the hit was nullified before landing (Ezio Perfect-Veil / incoming-damage modifier drove raw→0)
  // or fully blocked ([Block Damage]/[Unkillable] absorb with no shield to chip). Record WHY, so the ledger
  // reads as benign instead of a silent drop (mirrors the overheal / already-full notes elsewhere).
  const zeroNote = dealt > 0 ? undefined : (raw <= 0 ? 'nullified (incoming→0: Veil/modifier)' : 'fully absorbed (Block Damage/Unkillable)');
  E({ kind: 'damage', target: t.name, fired: true, consumed: dealt > 0, amount: dealt, note: zeroNote });
  if (dd.reflected > 0) E({ kind: 'reflect', subtype: 'Magma Shield', target: actor.name, fired: true, consumed: true, amount: dd.reflected });
  if (dd.reflectBuffDmg > 0) E({ kind: 'reflect', subtype: 'Reflect Damage', target: actor.name, fired: true, consumed: true, amount: dd.reflectBuffDmg });
  // SHIELD ABSORB ledger (dd.absorbed = total shield soak, dd.magmaAbsorbed = the Magma portion). Records that
  // a placed [Shield]/[Magma Shield] actually EATS incoming damage — the downstream consequence turn-verify
  // checks so a shield can't be placed-but-inert (the exact bug class that once made Pelops's 8.5k Magma do 0).
  if (dd.magmaAbsorbed > 0) E({ kind: 'absorb', subtype: 'Magma Shield', target: t.name, fired: true, consumed: true, amount: dd.magmaAbsorbed });
  if ((dd.absorbed ?? 0) - (dd.magmaAbsorbed ?? 0) > 0) E({ kind: 'absorb', subtype: 'Shield', target: t.name, fired: true, consumed: true, amount: dd.absorbed - dd.magmaAbsorbed });
  // [ALLY PROTECTION] redirect: a share of the hit on a protected ally was spread to the OTHER protected
  // allies. Records that the keystone focus-fire-spreader actually fired — else it could be placed-but-inert.
  if (dd.apRedirected > 0) E({ kind: 'redirect', subtype: 'Ally Protection', target: t.name, fired: true, consumed: true, amount: dd.apRedirected });
  // LIFESTEAL (gear 4-set): self-heal a fraction of the damage dealt — the recipe-path mirror of the
  // engine.applySkill consumer (line ~643). It was consumed on the OLD path but NOT here, so every
  // recipe-driven tool (sim-trace/run/suite) showed a Lifesteal tank's healing as 0 — the sim's PRIMARY
  // sustain source (Pelops 30%, a reality anchor) silently absent. "Represented but not consumed", sustain side.
  if (actor.lifesteal > 0 && dealt > 0) {
    // state.lifestealFactor: Spider cuts lifesteal to 35% vs Skavag/Spiderlings (default 1 → Dragon unchanged).
    // Lifesteal only fires ally→enemy, so a battle-wide factor is equivalent to a per-target one here.
    // FULL lifesteal incl. OVERHEAL — mirrors the in-game 'healing' stat (Mike 2026-08-02: count overhealing).
    // `hp` still clamps at maxHp below (survival unchanged); `healed`/ledger amount are records-only.
    const heal = actor.lifesteal * dealt * (1 - healReduction(actor)) * (state.lifestealFactor ?? 1);   // [Heal Reduction] on the attacker cuts its lifesteal
    if (heal > 0) { actor.hp = Math.min(actor.maxHp ?? 0, actor.hp + heal); actor.healed += heal; E({ kind: 'heal', subtype: 'Lifesteal', target: actor.name, fired: true, consumed: true, amount: heal }); }
  }
  // SKILL SELF-HEAL: "heals this Champion by X% of the damage dealt" (Gnut A3 30%, Hordin A2 10%). A
  // skill-specific direct-damage self-heal on the formula, DISTINCT from gear Lifesteal (actor.lifesteal) —
  // it fires from the skill regardless of gear. Per hit, [Heal Reduction]-gated, FULL incl. overheal (records).
  if (F.selfHealPctOfDamage > 0 && dealt > 0) {
    const heal = F.selfHealPctOfDamage * dealt * (1 - healReduction(actor));
    if (heal > 0) { actor.hp = Math.min(actor.maxHp ?? 0, actor.hp + heal); actor.healed += heal; E({ kind: 'heal', subtype: 'skill-lifesteal', target: actor.name, fired: true, consumed: true, amount: heal }); }
  }
  // [LEECH] debuff on the TARGET: "Any Champion attacking a Leeched target heals for 18% of the damage
  // inflicted" (keyword glossary). Team-wide sustain — every ally hit on a Leeched enemy heals THAT attacker.
  // Michelangelo A3 places [Leech] on all enemies (75%, 2t), so the whole team leeches off the wave. Direct
  // attacks only (this hit path); DoT ticks are not "attacking". Full incl. overheal, [Heal Reduction]-gated.
  if (dealt > 0 && (t.debuffs ?? []).some((d) => d.type === 'Leech')) {
    const heal = 0.18 * dealt * (1 - healReduction(actor));
    if (heal > 0) { actor.hp = Math.min(actor.maxHp ?? 0, actor.hp + heal); actor.healed += heal; E({ kind: 'heal', subtype: 'Leech', target: actor.name, fired: true, consumed: true, amount: heal }); }
  }
  // CRIT-CONDITIONAL RIDERS (Lua A1 splash / A2 heal). Seeded → fire on the ACTUAL crit; EV (seed=null) →
  // scale by the crit rate — the rider mirror of how the DAMAGE multiplier already folds crit as EV. The
  // effect % is read from the formula (no constant). critP is the per-hit weight: 1 on a rolled crit, cr% in EV.
  const critP = crit ? 1 : (critEv ? effectiveCritRate(actor) / 100 : 0);
  if (F.critHealPct && critP > 0) {   // Lua A2: "each critical hit heals this Champion by 2.5% HP"
    const heal = critP * F.critHealPct * (actor.maxHp ?? 0) * (1 - healReduction(actor));   // FULL incl. overheal (mirrors in-game healing stat)
    if (heal > 0) { actor.hp = Math.min(actor.maxHp ?? 0, actor.hp + heal); actor.healed += heal; E({ kind: 'heal', subtype: 'crit-heal', target: actor.name, fired: true, consumed: true, amount: heal }); }
  }
  if (F.critSplashPct && critP > 0 && raw > 0) {   // Lua A1: "deals 50% of the inflicted damage to all enemies if critical"
    const splash = critP * F.critSplashPct * raw;   // % of the INFLICTED (pre-shield) hit damage; splashed as plain direct damage (no reaction cascade)
    for (const o of (opponents ?? []).filter((x) => x !== t && x.alive)) {
      dealDamage(o, splash, 'direct', actor);
      E({ kind: 'damage', subtype: 'crit-splash', target: o.name, fired: true, consumed: splash > 0, amount: Math.round(splash) });
    }
  }
  // REACTIVE passives on the champion that was hit. Fire the defender's on-attacked EXACTLY once: recipe
  // reactions (Second Wind shield, Pelops Master-of-Games [HP Burn]) if the defender is authored, else the
  // parsed fireOnAttacked — never both (an authored champ carries parsed .skills too, so firing both would
  // double it). This is the passive half of retiring applySkill: on-attacked now lives on the one hit path.
  if (incoming) { if (isRecipeDriven(t)) fireDamageReactions(state, t, actor, dd.toHp); else fireOnAttacked(state, t, actor); }
  return {
    target: t.name, weak_hit: affM < 1, strong_hit: affM > 1, crit_mult: +critM.toFixed(3),
    crit, critEv,   // exposed so DEAL_DAMAGE can set the skill-level on-crit flag (ifCrit / ignoreResIfCrit)
    raw_damage: Math.round(raw), shield_damage: Math.round(dd.absorbed), hp_damage: Math.round(dd.toHp),
    survived: t.hp > 0,
  };
}

// ── II-B: buff/debuff PLACEMENT ────────────────────────────────────────────────
// Resolve the recipient set for a PLACE_BUFF (the design-doc "effect recipient"). `random_ally` draws from
// the TARGET stream so it is seeded/reproducible and doesn't perturb damage/debuff rolls.
function buffRecipients(state, actor, sel, intended) {
  const side = actor.side === 'ally' ? state.allies : state.enemies;
  const own = side.filter((c) => c.alive);
  switch (sel) {
    case 'self': return [actor];
    case 'all_allies': return own;
    case 'all_allies_except_self': return own.filter((c) => c !== actor);
    case 'all_dead_allies': return side.filter((c) => !c.alive);
    case 'lowest_hp_ally': return own.length ? [own.reduce((a, b) => (a.hp / a.maxHp <= b.hp / b.maxHp ? a : b))] : [];
    case 'random_ally': { if (!own.length) return []; const s = state?.rng?.target; return [own[s ? Math.floor(s() * own.length) : 0]]; }
    case 'intended_set': return intended;      // (rare — a buff on the units just targeted)
    default: flag(state, `UNKNOWN buff recipient '${sel}': ${actor.name}`); return [];
  }
}

// A buff's value: a % of the CASTER's MAX HP (most shields) or a % of the CASTER's ATK (Michelangelo A4
// [Shield] = 300% ATK) resolves here; else a flat magnitude. pctOfCasterAtk is a general field any champion
// can use for an ATK-scaled shield/buff.
const buffValue = (actor, ef) => ef.pctOfCasterMaxHp != null ? Math.round(ef.pctOfCasterMaxHp * (actor.maxHp || 0))
  : (ef.pctOfCasterAtk != null ? Math.round(ef.pctOfCasterAtk * (actor.atk || 0)) : (ef.magnitude ?? null));

// "Attacks N times at random" (Renegade A2 / Apothecary A1): pick ONE random living opponent for a single hit,
// drawing from the TARGET stream — the SAME convention as random_ally (seed=null → index 0, deterministic v0).
function pickRandomLiving(state, pool) {
  const live = alive(pool);
  if (!live.length) return null;
  const s = state?.rng?.target;
  return live[s ? Math.floor(s() * live.length) : 0];
}

// ── II-C: state manipulation ───────────────────────────────────────────────────
// HEAL a set of recipients by a % of the caster's MAX HP (or a flat amount). Overheal at full HP is a
// benign non-consumption. Mirrors the engine's healPct path.
function doHeal(state, actor, act, E) {
  const amt = act.effect.pctOfCasterMaxHp != null ? act.effect.pctOfCasterMaxHp * (actor.maxHp || 0) : (act.effect.amount || 0);
  for (const t of buffRecipients(state, actor, act.target, [])) {
    const before = t.hp; const full = amt * (1 - healReduction(t));   // [Heal Reduction] on the recipient cuts the heal. FULL incl. overheal (mirrors in-game healing stat)
    t.hp = Math.min(t.maxHp, t.hp + full);
    t.healed += full;
    E({ kind: 'heal', target: t.name, fired: true, consumed: full > 0, amount: full, note: (t.hp - before) < full ? `incl. overheal ${Math.round(full - (t.hp - before))}` : undefined });
  }
}
// REVIVE dead allies at a % of their MAX HP (default 30%). Mirrors the engine's revive path + log entry.
function doRevive(state, actor, act, E) {
  const side = actor.side === 'ally' ? state.allies : state.enemies;
  // `count` (default: ALL) — Tagoar/Hilvi revive ALL dead; Iudex Artor revives ONE. `tmPct` (default 0) — the
  // revived ally's Turn Meter fill (Artor +50%, Hilvi +30%); 0 keeps the prior TM-0 behavior for callers that
  // don't set it. Revive the LOWEST-MAX-HP dead first when count-limited (the squishy the AI prioritizes).
  const dead = side.filter((c) => !c.alive).sort((a, b) => (a.maxHp ?? 0) - (b.maxHp ?? 0));
  const n = act.effect?.count ?? dead.length;
  const revived = dead.slice(0, n);
  for (const t of revived) {
    t.alive = true; t.hp = (act.effect?.hpPct ?? 0.30) * t.maxHp; t.turnMeter = (act.effect?.tmPct ?? 0) * 100;
    state.log.push({ turn: state.turn, phase: state.phase, event: 'revive', who: t.name, by: actor.name });
    E({ kind: 'revive', target: t.name, fired: true, consumed: true, amount: t.hp });
  }
  return revived;   // the revived combatants — callers use .length (REVIVE handler: a same-skill FILL_TURN_METER
                    // gates on "no revive"), and REVIVE_AND_CAST re-casts each revived ally's default skill.
}

// Iudex Artor A3 "Revival Mandate" + A4 "Sentenced to Life" [P] as ONE synchronous chain (the card resolves them
// together): revive ONE dead ally (50% HP + 50% TM, via doRevive), place a 50% [Increase ATK] 1t on it, then
// immediately ACTIVATE the revived ally's DEFAULT (A1) skill against the lowest-HP enemy. If that cast kills an
// enemy, the passive resets Artor's OWN Revival Mandate cooldown (act.selfSlot). The reset carries the passive's
// 4-turn internal cooldown (act.resetCd, stamped on the actor as _revMandateResetAt) so a multi-dead-ally chain
// can't reset every turn — the A4 card reads "Cooldown: 4 Turns"; state.turn is a coarse (global-action) proxy
// for it, and the AI revive-lock already prevents a real loop by only choosing A3 when an ally is dead. Reuses
// the ally-attack re-entrancy guard (state._inAllyAttack) so the extra cast never cascades into join-attacks or
// nested revive-casts. Mirrors doAllyAttack's supplemental-cast pattern (an EXTRA cast, no turn/cooldown of its own).
function doReviveAndCast(state, actor, act, E) {
  const revived = doRevive(state, actor, act, E);
  if (!revived.length) { E({ kind: 'revive', target: '-', fired: true, consumed: false, note: 'no dead ally to revive' }); return; }
  const bef = act.effect?.reviveBuff;                                  // 50% [Increase ATK] 1t on the revived ally
  if (bef) placeBuffs(state, actor, { target: 'intended_set', effect: bef }, revived, E);
  if (state._inAllyAttack) return;                                     // supplemental cast already running → don't cascade
  const slot = act.castSlot ?? 'A1';
  const foesSide = actor.side === 'ally' ? state.enemies : state.allies;
  const livingCount = () => foesSide.filter((e) => e.hp > 0).length;   // hp>0: DEAL_DAMAGE zeroes hp before checkDeaths flips .alive
  let killed = false;
  state._inAllyAttack = true;
  try {
    for (const ally of revived) {
      if (!ally.alive) continue;
      const foes = foesSide.filter((e) => e.hp > 0);
      if (!foes.length) break;
      const target = foes.reduce((a, b) => (a.hp <= b.hp ? a : b));    // "targeting the enemy with the lowest HP"
      const rec = recipeFor(ally, slot) || kitToRecipe(skillBySlot(ally, slot));
      if (!rec) { E({ kind: 'revive_cast', source: ally.name, target: target.name, fired: true, consumed: false, note: `no ${slot} to cast` }); continue; }
      const before = livingCount();
      E({ kind: 'revive_cast', subtype: slot, source: ally.name, target: target.name, fired: true, consumed: true, note: `${ally.name} casts ${slot} vs ${target.name} (lowest HP)` });
      applyRecipe(state, ally, rec, { forceTarget: target });
      if (livingCount() < before) killed = true;                      // an enemy dropped to 0 HP during the cast
    }
  } finally { state._inAllyAttack = false; }
  if (killed && act.selfSlot) {                                        // A4: revived ally's default skill killed → reset Revival Mandate
    const self = (actor.skills ?? []).find((s) => String(s.slot).toUpperCase() === String(act.selfSlot).toUpperCase());
    const readyAt = actor._revMandateResetAt ?? -Infinity;
    if (self && state.turn >= readyAt) {
      self.cdLeft = 0;
      actor._revMandateResetAt = state.turn + (act.resetCd ?? 0);
      E({ kind: 'cooldown_reset', source: actor.name, target: self.slot, fired: true, consumed: true, note: 'Sentenced to Life: revived ally killed → reset Revival Mandate' });
    } else {
      E({ kind: 'cooldown_reset', source: actor.name, target: act.selfSlot, fired: true, consumed: false, note: self ? 'passive on internal cooldown' : 'no Revival Mandate skill' });
    }
  }
}
// DEBUFF_ACTIVATION — "instantly activates all [Poison] on enemies under N+ debuffs" (Ezio A2). For each
// target whose debuff SLOT count (Poison stacks count individually) ≥ minDebuffs, deal the Poison damage NOW
// and remove it. Damage acceleration + slot relief (tag policy #12), NOT a placement. Poison-only for now.
function doActivateDebuff(state, actor, act, intended, E) {
  const type = act.effect?.type ?? 'Poison';
  const minDebuffs = act.effect?.minDebuffs ?? 0;
  for (const t of intended) {
    if (!t.alive) continue;
    if (act.effect?.bossOnly && t.role !== 'boss') { E({ kind: 'activate', subtype: type, target: t.name, fired: true, consumed: false, note: 'boss-only' }); continue; }   // Ninja A2: activate HP Burn only when used against a Boss
    if (debuffSlots(t) < minDebuffs) { E({ kind: 'activate', subtype: type, target: t.name, fired: true, consumed: false, note: `<${minDebuffs} debuffs` }); continue; }
    let dealt;
    if (type === 'Poison') dealt = activatePoisons(state, t);
    else if (type === 'HP Burn') dealt = activateHpBurns(state, t);   // Artak A2 — the burn-splash detonator (activates one tick, does NOT remove the burn)
    else { flag(state, `ACTIVATE_DEBUFF unsupported type '${type}': ${actor.name}`); continue; }
    E({ kind: 'activate', subtype: type, target: t.name, fired: true, consumed: dealt > 0, amount: dealt, note: dealt > 0 ? undefined : `no ${type} to activate` });
  }
}
// PLACE_BOMB — place `count` [Bomb] debuffs on the intended targets (Ezio A2, on [Stone Skin] enemies). Each
// Bomb stores its detonation damage (multiplier × caster ATK, verified 6×ATK) + a countdown; detonation is
// engine.tickBombs. "If ALL enemies are under [Stone Skin], decrease each [Bomb]'s countdown by 1." 75%
// placement off the debuff proc stream; unresistable under [Veil]/[Perfect Veil], else ACC/RES-gated. Each Bomb
// is a SEPARATE entry (not upsert-merged) so 2 bombs → 2 independent detonations.
function doPlaceBomb(state, actor, act, intended, E) {
  const ef = act.effect;
  const opps = (actor.side === 'ally' ? state.enemies : state.allies).filter((c) => c.alive);
  const allStoneSkin = opps.length > 0 && opps.every((e) => (e.buffs ?? []).some((b) => b.type === 'Stone Skin'));
  const countdown = Math.max(1, (ef.countdown ?? 2) - (allStoneSkin ? 1 : 0));
  const dmg = Math.round((ef.multiplier ?? 0) * (actor.atk ?? 0));
  for (const t of intended) {
    if (!t.alive) continue;
    if (t.immune?.includes('Bomb')) { E({ kind: 'debuff', subtype: 'Bomb', target: t.name, fired: true, consumed: false, note: 'immune' }); continue; }
    if (ef.chance != null && !rollChance(state?.rng?.debuff, ef.chance)) { E({ kind: 'debuff', subtype: 'Bomb', target: t.name, fired: true, consumed: false, note: `missed placement (${Math.round(ef.chance * 100)}%)` }); continue; }
    if (ef.accuracy_check && !isUnresistable(ef, t, actor)) {
      const p = landChance(effectiveAcc(actor), t.res);
      if (p == null || !rollLand(state, p)) { E({ kind: 'debuff', subtype: 'Bomb', target: t.name, fired: true, consumed: false, note: `resisted (${p == null ? '?' : Math.round(p * 100)}% land)` }); continue; }
    }
    for (let i = 0; i < (ef.count ?? 1); i++) t.debuffs.push({ type: 'Bomb', value: dmg, countdown, turnsLeft: 999, stacks: 1 });
    E({ kind: 'debuff', subtype: 'Bomb', target: t.name, fired: true, consumed: true, amount: dmg, note: `×${ef.count ?? 1}, countdown ${countdown}` });
  }
}
// SELF_DAMAGE — the caster takes a FIXED % of its OWN max HP, bypassing DEF/shields, and it can be LETHAL
// (Renegade A3: "receive damage equal to 30% of MAX HP... even if it kills this Champion"). Applied straight to
// HP (not an attack — no mitigation, no reflect, no lifesteal); checkDeaths (post-action) flips .alive at hp≤0.
function doSelfDamage(state, actor, act, E) {
  const dmg = Math.round((act.effect?.pctOfCasterMaxHp ?? 0) * (actor.maxHp ?? 0));
  const before = actor.hp;
  actor.hp = Math.max(0, actor.hp - dmg); actor.taken += before - actor.hp;
  E({ kind: 'self_damage', target: actor.name, fired: true, consumed: actor.hp < before, amount: before - actor.hp });
}
// STEAL_BUFF — move every buff off each enemy target onto the caster (Ezio A3 / Pelops A2). The buffs LEAVE
// the enemy and land on the actor's side (that is what makes it a steal, not a strip).
function doStealBuff(state, actor, act, intended, E) {
  for (const t of intended) {
    const stolen = t.buffs.splice(0, t.buffs.length);
    for (const b of stolen) { upsert(actor.buffs, { type: b.type, value: b.value, turns: b.turnsLeft }); E({ kind: 'buff', subtype: b.type, target: actor.name, fired: true, consumed: true, note: 'stolen' }); }
    if (!stolen.length) E({ kind: 'steal', target: t.name, fired: true, consumed: false, note: 'no buffs to steal' });
  }
}
// BUFF_STRIP — the in-game "Buff Strip": DELETE buffs from each enemy target. Distinct from STEAL_BUFF (which
// moves them onto the caster's side) and from CLEANSE (which removes DEBUFFS from allies) — tag policy #19. Buff
// removal is not accuracy-checked (it is guaranteed, not a debuff placement). `act.types` (optional) limits the
// strip to named buff types ("removes all [Increase DEF], [Ally Protection], [Strengthen]"); `act.count`
// (optional) caps how many are removed, oldest first ("removes 1 random buff"); default = ALL buffs.
function doBuffStrip(state, actor, act, intended, E) {
  const types = act.types ?? null;
  const count = act.count ?? act.effect?.count ?? null;                 // count may be top-level or in effect{}
  const chance = act.chance ?? act.effect?.chance;                      // optional per-cast placement chance
  if (chance != null && !rollChance(state?.rng?.debuff, chance)) { E({ kind: 'buff_strip', target: '(enemies)', fired: true, consumed: false, note: `missed (${Math.round(chance * 100)}%)` }); return; }
  for (const t of intended) {
    if (!t.alive) continue;
    let removable = t.buffs.filter((b) => !types || types.includes(b.type));
    if (count != null) removable = removable.slice(0, count);
    const removeSet = new Set(removable);
    const before = t.buffs.length;
    t.buffs = t.buffs.filter((b) => !removeSet.has(b));
    if (removeSet.size) for (const b of removable) E({ kind: 'buff_strip', subtype: b.type, target: t.name, fired: true, consumed: true, note: 'stripped' });
    else E({ kind: 'buff_strip', target: t.name, fired: true, consumed: false, note: before ? 'no matching buff to strip' : 'no buffs to strip' });
  }
}
// EQUALIZE_HP — "equalizes the HP levels of all allies, brought up to the level of the ally with the highest HP"
// (Mavara A2). Raises every ally to the highest ally's CURRENT HP FRACTION (percentage, so a low-max-HP support
// reaches the same %, not the tank's absolute HP) — it only RAISES ("brought UP to"), never lowers those above.
// It sets the HP level directly (not a heal), so [Heal Reduction] does not gate it. Own-side only.
function doEqualizeHp(state, actor, act, E) {
  const own = (actor.side === 'ally' ? state.allies : state.enemies).filter((c) => c.alive && (c.maxHp || 0) > 0);
  if (own.length < 2) { E({ kind: 'heal', subtype: 'Equalize HP', target: '-', fired: true, consumed: false, note: 'nothing to equalize' }); return; }
  const targetFrac = Math.max(...own.map((c) => c.hp / c.maxHp));
  for (const c of own) {
    const target = Math.round(targetFrac * c.maxHp);
    if (target > c.hp) {
      const before = c.hp; c.hp = Math.min(c.maxHp, target); const healed = c.hp - before;
      c.healed += healed;
      E({ kind: 'heal', subtype: 'Equalize HP', target: c.name, fired: true, consumed: true, amount: healed });
    }
  }
}
// STEAL_TURN_METER — drain each enemy target's Turn Meter by a % AND fill the CASTER's TM by the amount actually
// removed (Fabian A1 10%/hit, Fayne A1 5%/hit). REDUCE_TURN_METER is the drain-only half; the steal adds the
// beneficial self-fill. [Decrease Turn Meter] immunity + ACC/RES (accuracy_check) + optional chance are honored,
// exactly like REDUCE_TURN_METER — only the self-gain is added.
function doStealTurnMeter(state, actor, act, intended, E) {
  const pts = (act.effect?.pct ?? 0) * 100;
  if (act.effect?.chance != null && !rollChance(state?.rng?.debuff, act.effect.chance)) { E({ kind: 'turn_meter', target: '(enemies)', fired: true, consumed: false, note: `missed (${Math.round(act.effect.chance * 100)}%)` }); return; }
  let stolen = 0;
  for (const t of intended) {
    if (!t.alive) continue;
    if (t.immune?.includes('Decrease Turn Meter')) { E({ kind: 'turn_meter', target: t.name, fired: true, consumed: false, note: 'immune (Decrease Turn Meter)' }); continue; }
    if (act.effect?.accuracy_check) {
      const p = landChance(effectiveAcc(actor), t.res);
      if (p == null || !rollLand(state, p)) { E({ kind: 'turn_meter', target: t.name, fired: true, consumed: false, note: `resisted (${p == null ? '?' : Math.round(p * 100)}% land)` }); continue; }
    }
    const before = t.turnMeter; t.turnMeter = Math.max(0, t.turnMeter - pts); const removed = before - t.turnMeter;
    stolen += removed;
    E({ kind: 'turn_meter', target: t.name, fired: true, consumed: removed > 0, amount: removed, note: 'stolen' });
  }
  if (stolen > 0) { const d = fillTurnMeter(actor, stolen); E({ kind: 'turn_meter', subtype: 'steal-gain', target: actor.name, fired: true, consumed: d > 0, amount: d, note: 'gained stolen TM' }); }
}
// SWAP_HP — exchange the caster's and the target's HP FRACTIONS (Vallaryn A3 "swaps HP with the target"). Each
// side is set to the OTHER's HP%, scaled by its own MAX HP (so a low-HP Vallaryn takes the boss's high %, and the
// boss drops to Vallaryn's low %). Direct HP set — not an attack (no mitigation/reflect/lifesteal); checkDeaths
// resolves any resulting death. His signature boss-melt.
function doSwapHp(state, actor, act, intended, E) {
  const t = (intended ?? []).find((x) => x.alive) ?? null;
  if (!t) { E({ kind: 'swap_hp', target: '-', fired: true, consumed: false, note: 'no target' }); return; }
  const casterFrac = actor.hp / (actor.maxHp || 1), targetFrac = t.hp / (t.maxHp || 1);
  const cBefore = actor.hp, tBefore = t.hp;
  actor.hp = Math.min(actor.maxHp, Math.round(targetFrac * (actor.maxHp || 0)));
  t.hp = Math.round(casterFrac * (t.maxHp || 0));
  if (actor.hp > cBefore) actor.healed += actor.hp - cBefore; else actor.taken += cBefore - actor.hp;
  if (t.hp < tBefore) t.taken += tBefore - t.hp;
  E({ kind: 'swap_hp', target: t.name, fired: true, consumed: true, amount: Math.abs(tBefore - t.hp), note: `caster ${Math.round(casterFrac * 100)}% ⇄ target ${Math.round(targetFrac * 100)}%` });
}
// BUFF_ACTIVATION — force an existing ALLY buff ([Continuous Heal]) to TICK now (Donatello A1). The buff-side
// mirror of DEBUFF_ACTIVATION (which activates enemy DoTs); tag policy #12 "Buff Activation" = sustain
// acceleration, NOT a placement. Heals by the [Continuous Heal] tick value (value% of the ally's MAX HP), and the
// buff PERSISTS (an early extra tick, not a consume). [Heal Reduction] gates it, like the normal HoT tick.
function doBuffActivation(state, actor, act, E) {
  const type = act.effect?.type ?? 'Continuous Heal';
  for (const t of buffRecipients(state, actor, act.target, [])) {
    const b = (t.buffs ?? []).find((x) => x.type === type);
    if (!b) { E({ kind: 'activate', subtype: type, target: t.name, fired: true, consumed: false, note: `no ${type}` }); continue; }
    const heal = ((b.value ?? 15) / 100) * (t.maxHp ?? 0) * (1 - healReduction(t));
    const before = t.hp; t.hp = Math.min(t.maxHp, t.hp + heal); t.healed += heal;
    E({ kind: 'heal', subtype: 'Buff Activation', target: t.name, fired: true, consumed: heal > 0, amount: heal, note: `activated ${type}${(t.hp - before) < heal ? ' (incl. overheal)' : ''}` });
  }
}

// ALLY_ATTACK — the in-game "Ally Attack" / join-attack / beatdown. The caster directs a set of allies to EACH
// perform an attack against the acquired target with their DEFAULT skill (A1). Reuses the full damage path via
// applyRecipe (the ally's authored A1, else a kit-synthesized one), exactly like COUNTERATTACK — so a joiner's
// A1 debuffs/procs all resolve faithfully. An ally hitting an enemy has incoming=false in dealOneHit, so the
// joins fire NO counter cascade; a re-entrancy guard (state._inAllyAttack) also stops a join from triggering a
// second round of joins. This is an EXTRA attack: it resolves the attack only and never touches the joiners'
// cooldowns/turn meter (the turn loop owns those), matching how a real ally-attack does not consume a turn.
//   act.who: 'all_allies_except_self' (default; Fahrakin A3 Beatdown) | 'random_ally_except_self' (one random
//            ally joins) | 'random_faction_ally' (Pallas A1 — one random ally OF act.faction joins) | 'all_allies'.
//   act.slot: the joining skill (default 'A1'). act.faction: the required faction for 'random_faction_ally'.
//   The faction gate is REAL: combatants now carry `faction` (plumbed 2026-08-12), so a Pallas with no Argonites
//   ally fires NO join — matching the game, where "1 random Argonites ally" needs an eligible ally to exist.
function allyAttackJoiners(state, actor, act) {
  const who = act.who ?? 'all_allies_except_self';
  const side = actor.side === 'ally' ? state.allies : state.enemies;
  const own = side.filter((c) => c.alive && c !== actor);
  const pickRandom = (pool) => { if (!pool.length) return []; const s = state?.rng?.target; return [pool[s ? Math.floor(s() * pool.length) : 0]]; };
  switch (who) {
    case 'all_allies': return side.filter((c) => c.alive);
    case 'random_ally_except_self': return pickRandom(own);
    case 'random_faction_ally': return pickRandom(act.faction ? own.filter((c) => c.faction === act.faction) : own);
    case 'all_allies_except_self':
    default: return own;
  }
}
const skillBySlot = (ally, slot) => (ally.skills ?? []).find((s) => !s.isPassive && String(s.slot).toUpperCase() === String(slot).toUpperCase()) ?? null;
function doAllyAttack(state, actor, act, intended, E) {
  if (state._inAllyAttack) return;                                   // no nested join cascades
  const enemy = (intended ?? []).find((t) => t.alive) ?? null;
  if (!enemy) { E({ kind: 'ally_attack', target: '-', fired: true, consumed: false, note: 'no living target' }); return; }
  const slot = act.slot ?? 'A1';
  const joiners = allyAttackJoiners(state, actor, act);
  if (!joiners.length) { E({ kind: 'ally_attack', target: enemy.name, fired: true, consumed: false, note: act.who === 'random_faction_ally' ? `no ${act.faction} ally to join` : 'no allies to join' }); return; }
  state._inAllyAttack = true;
  try {
    for (const ally of joiners) {
      if (!enemy.alive) break;                                       // a prior joiner already killed the target
      const rec = recipeFor(ally, slot) || kitToRecipe(skillBySlot(ally, slot));
      if (!rec) { E({ kind: 'ally_attack', target: ally.name, fired: true, consumed: false, note: `no ${slot} to join with` }); continue; }
      E({ kind: 'ally_attack', subtype: slot, source: ally.name, target: enemy.name, fired: true, consumed: true, note: `${ally.name} joins the attack vs ${enemy.name}` });
      applyRecipe(state, ally, rec, { forceTarget: enemy });
    }
  } finally { state._inAllyAttack = false; }
}

// ── Sleeping Sage (Bambus) — debuff sponge + wake/dump ─────────────────────────
// While Bambus is asleep, a debuff landing on an ally transfers to him (75%, except a hard-CC list). At the
// start of his turn a start_of_turn trigger removes [Sleep] BEFORE the engine's CC-skip check (so he NEVER
// loses a turn) and dumps every debuff he holds onto the highest-RES enemy. Card-verified 2026-07-24.
const SPONGE_EXCLUDE = ['Block Revive', 'Stun', 'Freeze', 'Fear', 'True Fear', 'Provoke', 'Petrification', 'Sheep'];
// The living, asleep sponge owner (its passive recipe declares sponge:true), or null.
function spongeOwner(state) {
  return state.allies.find((a) => a.alive && (a.debuffs ?? []).some((d) => d.type === 'Sleep')
    && Object.values(RECIPES).some((r) => r.type === 'passive' && r.sponge && champKey(r.champion) === combatantKey(a))) || null;
}
// After a debuff lands on an ALLY, transfer it to an asleep sponge owner (75%) — not the excluded hard-CC, not
// the owner's own. Pure redirect (reads no magnitude, introduces no constant beyond the card's 75%). Called
// from BOTH placement paths: the recipe path (placeDebuffs) and the scripted boss (dragon.js, via the
// state.onAllyDebuffed hook installRecipeRun wires) — so the boss's Poison/Weaken/Decrease-Attack are sponged too.
// Move a debuff onto `dest` PRESERVING its stack count (Sleeping Sage sponge + dump). `upsert` is built for
// placeDebuffs' one-application-at-a-time model (increment by 1), so it collapses a pre-stacked [Poison] to 1
// stack — which silently gutted Bambus's whole poison-redirect (5%×MaxHP×stacks on Hellrazor). Here the stacks
// carry through both the absorb and the dump, capped at the debuff's maxStacks (Poison 10).
function transferDebuff(dest, d) {
  const cap = d.maxStacks ?? (d.type === 'Poison' ? 10 : 1);
  const cur = dest.find((x) => x.type === d.type);
  if (d.stackList) {   // STACKING (Poison): carry each stack's {turnsLeft, source} through the transfer, capped
    if (cur) {
      ensureStackList(cur, d.turnsLeft);
      for (const s of d.stackList) { if (cur.stackList.length >= cap) break; cur.stackList.push({ ...s }); }
      cur.maxStacks = cap;
      if (d.value != null) cur.value = d.value;
      if (d.pct != null) cur.pct = d.pct;
      syncStackDerived(cur);
    } else {
      const nd = { type: d.type, value: d.value ?? null, pct: d.pct ?? null, maxStacks: cap, stackList: d.stackList.slice(0, cap).map((s) => ({ ...s })) };
      syncStackDerived(nd);
      dest.push(nd);
    }
    return;
  }
  // NON-STACKING (legacy path, unchanged)
  if (cur) {
    const before = cur.stacks ?? 1;
    cur.stacks = Math.min(before + (d.stacks ?? 1), cap);
    cur.turnsLeft = Math.max(cur.turnsLeft ?? 0, d.turnsLeft ?? 0);
    if (d.value != null) cur.value = d.value;
    if (d.pct != null) cur.pct = d.pct;
    cur.maxStacks = cap;
    const added = cur.stacks - before;
    if (d.sources && added > 0) { cur.sources ??= {}; const s = Object.values(d.sources).reduce((a, b) => a + b, 0) || 1; for (const [k, n] of Object.entries(d.sources)) cur.sources[k] = (cur.sources[k] ?? 0) + n * added / s; }
  } else {
    dest.push({ type: d.type, value: d.value ?? null, pct: d.pct ?? null, turnsLeft: d.turnsLeft ?? 2, stacks: d.stacks ?? 1, maxStacks: cap, sources: d.sources });
  }
}
export function maybeSponge(state, ally, type) {
  if (process.env.SIM_NO_SPONGE) return;   // sensitivity knob (like SIM_WARMASTER): measure the sponge's leverage
  if (ally.side !== 'ally' || SPONGE_EXCLUDE.includes(type)) return;
  const bambus = spongeOwner(state);
  if (!bambus || bambus === ally || !ally.debuffs.some((d) => d.type === type)) return;
  if (!rollChance(state?.rng?.debuff, 0.75)) return;
  const moved = ally.debuffs.filter((d) => d.type === type);
  ally.debuffs = ally.debuffs.filter((d) => d.type !== type);
  for (const d of moved) transferDebuff(bambus.debuffs, d);   // preserve stacks (was upsert → collapsed to 1)
  recordEffect(state, { source: `${bambus.name} [P]`, kind: 'debuff', subtype: type, target: bambus.name, fired: true, consumed: true, note: 'sponged from ' + ally.name });
}
// Glorious Pallas — Shield of the Argolades [P]: whenever an ally receives a debuff, a living Pallas places a
// [Shield] on THAT ally equal to a % of the ally's OWN max HP (1 turn). Reactive mitigation — load-bearing on
// Spider, where the swarm lands a debuff (Poison) every round, so the shield is continually refreshed and eats
// the incoming before it reaches HP. Declared by the passive recipe field `shieldOnAllyDebuffPct`; refreshes to
// the larger value (shieldPool sums [Shield] values; dealDamage absorbs from them). Fires off the same
// state.onAllyDebuffed hook as the sponge (the scripted-boss ally-debuff route).
export function maybeShieldOnDebuff(state, ally) {
  if (!ally?.alive || ally.side !== 'ally') return;
  for (const a of state.allies) {
    if (!a.alive) continue;
    const rec = Object.values(RECIPES).find((r) => r.type === 'passive' && r.shieldOnAllyDebuffPct && champKey(r.champion) === combatantKey(a));
    if (!rec) continue;
    const val = rec.shieldOnAllyDebuffPct * (ally.maxHp || 0);
    const ex = (ally.buffs ?? []).find((b) => b.type === 'Shield');
    if (ex) { ex.value = Math.max(ex.value || 0, val); ex.turns = Math.max(ex.turns || 0, 1); }
    else { (ally.buffs ??= []).push({ type: 'Shield', value: val, turns: 1 }); }
    recordEffect(state, { source: `${a.name} [P]`, kind: 'buff', subtype: 'Shield', target: ally.name, fired: true, consumed: true, amount: Math.round(val), note: 'shield-on-debuff' });
    return;   // one Pallas
  }
}
// start_of_turn: remove [Sleep] (before the CC check → no turn lost); if it was present, dump ALL remaining
// debuffs onto the highest-RES enemy (unresistable).
function doWakeFromSleep(state, owner, E) {
  if (!(owner.debuffs ?? []).some((d) => d.type === 'Sleep')) return;
  owner.debuffs = owner.debuffs.filter((d) => d.type !== 'Sleep');
  E({ kind: 'cleanse', subtype: 'Sleep', target: owner.name, fired: true, consumed: true, note: 'woke (no turn lost)' });
  const enemies = (owner.side === 'ally' ? state.enemies : state.allies).filter((c) => c.alive);
  if (!enemies.length || !owner.debuffs.length) return;
  const tgt = enemies.reduce((a, b) => ((b.res ?? 0) > (a.res ?? 0) ? b : a));
  const moved = owner.debuffs.splice(0, owner.debuffs.length);
  for (const d of moved) {
    // unresistable/unblockable, but IMMUNITY still blocks (Hellrazor is immune to Stun/Freeze/etc. — immunity ≠ resistance)
    if (tgt.immune?.includes(d.type)) { E({ kind: 'debuff', subtype: d.type, target: tgt.name, fired: true, consumed: false, note: 'dump blocked (immune)' }); continue; }
    // REDIRECT ATTRIBUTION: the sponge owner (Bambus) transfers the debuff onto the boss and OWNS the resulting
    // damage — Raid credits his ~368k redirect to him, not to the enemy that originally placed the Wall-of-Fire
    // poison. Re-stamp DoT ownership to the owner before the transfer.
    if (d.type === 'Poison') { ensureStackList(d); d.stackList = d.stackList.map((s) => ({ ...s, source: owner.name })); syncStackDerived(d); }   // re-stamp EVERY stack's owner to Bambus
    transferDebuff(tgt.debuffs, d);   // preserve stacks onto the boss (was upsert → collapsed to 1)
    E({ kind: 'debuff', subtype: d.type, target: tgt.name, fired: true, consumed: true, note: 'dumped from ' + owner.name });
  }
}

// PLACE_DEBUFF on each enemy in the intended set. The two-stage roll (design-doc "does the debuff land?"):
//   STAGE 1 — placement chance (the skill's stated %, e.g. 75%), off the DEBUFF stream.
//   STAGE 2 — ACC vs RES via landChance(actor.acc, target.res), unless `unresistable`.
// Immunity is a hard block. Everything records FIRED/CONSUMED with a documented reason when it doesn't land.
// A placement chance can DROP when the CASTER is under a named debuff (Pelops passive: HP Burn 100%→50%,
// Petrification 50%→25% while he is under [Decrease DEF]). Reads the effect's own numbers → NO constant.
const effectiveChance = (ef, actor) =>
  (ef.chanceIfCasterUnder && (actor.debuffs ?? []).some((d) => d.type === ef.chanceIfCasterUnder.debuff))
    ? ef.chanceIfCasterUnder.chance : ef.chance;
// Resistance can be BYPASSED when the TARGET is under a named debuff (Pelops A1: [Decrease ATK] cannot be
// resisted/blocked if the target is under [HP Burn]). Placement chance is UNCHANGED — only stage-2 ACC/RES is
// skipped (CLAUDE.md tag policy #17: resistance bypass ≠ conditional placement).
// Resistance can also be BYPASSED when the CASTER is under a named buff (Ezio's debuffs cannot be resisted
// while he is under [Veil]/[Perfect Veil]). `unresistableIfCasterUnder` is a buff type or list of them —
// conditional, so it applies only on the turns the caster is actually veiled (a fast Ezio outruns his veil).
const isUnresistable = (ef, t, actor) =>
  ef.unresistable
  || (ef.unresistableIfTargetUnder && (t.debuffs ?? []).some((d) => d.type === ef.unresistableIfTargetUnder))
  || (ef.unresistableIfCasterUnder && (actor?.buffs ?? []).some((b) => [].concat(ef.unresistableIfCasterUnder).includes(b.type)));
function placeDebuffs(state, actor, act, intended, E, critActive = false) {
  const ef = act.effect;
  const tally = { landed: 0, resisted: 0 };   // "blocked or resisted" ATTEMPTS (chance succeeded, then immune/RES) vs landed — for Artak A3 self-heal
  for (const t of intended) {
    if (!t.alive) continue;
    if (t.immune?.includes(ef.type)) { tally.resisted++; E({ kind: 'debuff', subtype: ef.type, target: t.name, fired: true, consumed: false, note: 'immune' }); continue; }
    const chance = effectiveChance(ef, actor);
    if (chance != null && !rollChance(state?.rng?.debuff, chance)) {
      E({ kind: 'debuff', subtype: ef.type, target: t.name, fired: true, consumed: false, note: `missed placement (${Math.round(chance * 100)}%)` }); continue;
    }
    if (ef.accuracy_check && !isUnresistable(ef, t, actor)) {
      // on-crit RES-ignore (Michelangelo A2/A3: "ignore 25% of the target's RES if the attack was critical") —
      // strips that fraction of the target's RES for THIS placement's land roll when the skill's hit critted.
      const effRes = (ef.ignoreResIfCrit && critActive) ? (t.res ?? 0) * (1 - ef.ignoreResIfCrit) : t.res;
      const p = landChance(effectiveAcc(actor), effRes);
      if (p == null) { flag(state, `UNKNOWN land chance: ${actor.name} ${ef.type}`); E({ kind: 'debuff', subtype: ef.type, target: t.name, fired: true, consumed: false, note: 'UNKNOWN land chance' }); continue; }
      if (!rollLand(state, p)) { tally.resisted++; E({ kind: 'debuff', subtype: ef.type, target: t.name, fired: true, consumed: false, note: `resisted (${Math.round(p * 100)}% land)` }); continue; }
    }
    // stacking (Poison): apply `count` copies; each upsert bumps stacks up to maxStacks.
    const copies = ef.count ?? 1;
    for (let i = 0; i < copies; i++) applyDebuff(t, { type: ef.type, value: ef.magnitude ?? null, pct: ef.pct ?? null, turns: ef.duration, stacking: ef.stacking, maxStacks: ef.maxStacks, source: actor.name });
    tally.landed++;
    E({ kind: 'debuff', subtype: ef.type, target: t.name, source: actor.name, fired: true, consumed: t.debuffs.some((x) => x.type === ef.type) });
    maybeSponge(state, t, ef.type);   // Sleeping Sage: a debuff on an ally transfers to an asleep Bambus
    // ON-FREEZE reaction (Hilvi Divine Mission): fires whenever an enemy RECEIVES [Freeze] — including a REFRESH
    // of an already-frozen enemy. Mike first-party 2026-08-03 (screenshot): Ninja re-freezing an already-frozen
    // target still triggers Hilvi's −TM (the "Decrease Turn Meter" pop is on his re-freeze turn). This REVERSES
    // the earlier !wasFrozen gate — the "no TM drop on refresh" reading was wrong. Any ally carrying the
    // enemy_frozen passive reacts on THAT enemy (HP Burn + steal buff + −TM); no-op for teams without it.
    if (ef.type === 'Freeze' && t.side === 'enemy' && t.debuffs.some((x) => x.type === 'Freeze')) {
      for (const ally of alive(state.allies)) fireTriggers(state, ally, 'enemy_frozen', { attacker: t });
    }
  }
  return tally;
}

// PLACE_BUFF on the resolved recipients. Optional placement chance (e.g. Vergis A1 40%) off the debuff
// (proc) stream. `upsert` is the engine's own buff/debuff applier, so buffs behave identically to the old path.
function placeBuffs(state, actor, act, intended, E) {
  const ef = act.effect;
  for (const t of buffRecipients(state, actor, act.target, intended)) {
    if (ef.chance != null && !rollChance(state?.rng?.debuff, ef.chance)) {
      E({ kind: 'buff', subtype: ef.type, target: t.name, fired: true, consumed: false, note: `missed placement (${Math.round(ef.chance * 100)}%)` }); continue;
    }
    // [Ally Protection]: tag the buff with its PLACER so dealDamage can redirect the protected ally's damage
    // to the champion who placed it (the Raid rule), not spread it among co-protected allies. Only AP carries
    // this field, so no other buff's fingerprint changes.
    upsert(t.buffs, { type: ef.type, value: buffValue(actor, ef), turns: ef.duration, ...(ef.type === 'Ally Protection' ? { placedBy: actor.name } : {}) });
    E({ kind: 'buff', subtype: ef.type, target: t.name, fired: true, consumed: t.buffs.some((x) => x.type === ef.type) });
  }
}

// ── enemy utility ops: turn meter · cooldowns · debuff transfer ─────────────────
// REDUCE_TURN_METER — drain a % of the target's turn meter (Lua A3 −100%). Meter is 0..100 in the engine.
function doReduceTurnMeter(state, actor, act, intended, E) {
  const pts = (act.effect?.pct ?? 0) * 100;
  if (act.effect?.chance != null && !rollChance(state?.rng?.debuff, act.effect.chance)) { E({ kind: 'turn_meter', target: '(enemies)', fired: true, consumed: false, note: `missed (${Math.round(act.effect.chance * 100)}%)` }); return; }
  for (const t of intended) {
    // [Decrease Turn Meter] IMMUNITY (Hellrazor's Almighty Immunity: "you cannot slow him"). The immune list is
    // enforced for debuff PLACEMENT in placeDebuffs, but a TM strip is a REDUCE_TURN_METER op, so it must be
    // gated here too — otherwise an immune boss still gets drained, under-acts, and the whole team over-performs
    // (over-credited damage + too-fast clear). DRAGON_REVIEW.md §boss: immune to Decrease Turn Meter + Decrease SPD.
    if (t.immune?.includes('Decrease Turn Meter')) { E({ kind: 'turn_meter', target: t.name, fired: true, consumed: false, note: 'immune (Decrease Turn Meter)' }); continue; }
    // TM decrease is a HARMFUL instant effect → ACC/RES-gated when the effect asks (RNG doc §6); authored
    // recipes that omit accuracy_check stay ungated (unchanged). This matches applySkill's turnMeterEnemy gate.
    if (act.effect?.accuracy_check) {
      const p = landChance(effectiveAcc(actor), t.res);
      if (p == null) { flag(state, `UNKNOWN land chance (TM decrease): ${actor.name}`); E({ kind: 'turn_meter', target: t.name, fired: true, consumed: false, note: 'UNKNOWN land chance' }); continue; }
      if (!rollLand(state, p)) { E({ kind: 'turn_meter', target: t.name, fired: true, consumed: false, note: `resisted (${Math.round(p * 100)}% land)` }); continue; }
    }
    const before = t.turnMeter; t.turnMeter = Math.max(0, t.turnMeter - pts);
    E({ kind: 'turn_meter', target: t.name, fired: true, consumed: t.turnMeter < before, amount: before - t.turnMeter, note: t.turnMeter < before ? undefined : 'already empty' });
  }
}
// INCREASE_COOLDOWN — put the target's skills on cooldown (Arbalester A2, 60% chance). Sets each active
// skill's cdLeft to its full cooldown.
function doIncreaseCooldown(state, actor, act, intended, E) {
  for (const t of intended) {
    if (act.effect?.chance != null && !rollChance(state?.rng?.debuff, act.effect.chance)) { E({ kind: 'cooldown', subtype: 'increase', target: t.name, fired: true, consumed: false, note: `missed (${Math.round(act.effect.chance * 100)}%)` }); continue; }
    let any = false; for (const s of t.skills || []) if (!s.isPassive && (s.cooldown ?? 0) > 0) { s.cdLeft = s.cooldown; any = true; }
    E({ kind: 'cooldown', subtype: 'increase', target: t.name, fired: true, consumed: any, note: any ? undefined : 'no skills with a cooldown' });
  }
}
// DECREASE_COOLDOWN — reduce cooldowns. Two modes:
//   • ALLY-WIDE (Renegade A3, −2t): every living ally EXCEPT self (and same-skill dupes when excludeDupes).
//   • SELF (Ninja A3: "decrease the cooldown of the Hailburn skill by 1 turn"): the ACTOR's OWN skill(s),
//     optionally just the one named in effect.slot. The ally-wide loop skips the actor, so a champion reducing
//     its own cooldown needs this explicit self path (effect.self or target:'self').
function doDecreaseCooldown(state, actor, act, E) {
  const turns = act.effect?.turns ?? 1;
  if (act.effect?.self || act.target === 'self') {
    const slot = act.effect?.slot ? String(act.effect.slot).toUpperCase() : null;
    let any = false;
    for (const s of actor.skills || []) {
      if (slot && String(s.slot).toUpperCase() !== slot) continue;
      if ((s.cdLeft ?? 0) > 0) { s.cdLeft = Math.max(0, s.cdLeft - turns); any = true; }
    }
    E({ kind: 'cooldown', subtype: 'decrease', target: actor.name, fired: true, consumed: any,
        note: any ? (slot ? `own ${slot} −${turns}t` : `own −${turns}t`) : (slot ? `own ${slot} not on cooldown` : 'no own cooldowns') });
    return;
  }
  const own = (actor.side === 'ally' ? state.allies : state.enemies).filter((c) => c.alive);
  const selfBase = act.effect?.excludeDupes ? String(actor.name).split('#')[0] : null;
  for (const t of own) {
    if (t === actor) continue;
    if (selfBase && String(t.name).split('#')[0] === selfBase) continue;
    let any = false; for (const s of t.skills || []) if ((s.cdLeft ?? 0) > 0) { s.cdLeft = Math.max(0, s.cdLeft - turns); any = true; }
    E({ kind: 'cooldown', subtype: 'decrease', target: t.name, fired: true, consumed: any, note: any ? undefined : 'no cooldowns to decrease' });
  }
}
// EXTEND_EFFECT — add `turns` to the remaining duration of every buff on the recipients (Bambus A2:
// "increases the duration of all buffs on all allies by 1 turn"). Sustains duration-based buffs
// (Ally Protection, Increase X, Continuous Heal) that would otherwise time out.
function doExtendEffect(state, actor, act, E) {
  const turns = act.effect?.turns ?? 1;
  for (const t of buffRecipients(state, actor, act.target, [])) {
    let n = 0;
    for (const b of t.buffs) { b.turnsLeft += turns; n++; }
    E({ kind: 'extend', target: t.name, fired: true, consumed: n > 0, amount: n, note: n > 0 ? undefined : 'no buffs to extend' });
  }
}
// REDUCE_EFFECT_DURATION — decrease every buff's remaining duration on the recipients by `turns` (Bambus A2:
// all enemy buffs, −1t). A buff reduced to ≤0 drops off now. Optional `chance` gates the whole effect off the
// DEBUFF proc stream (SKILL_PROC, RNG_REGISTRY #5); "even if a weak hit" means it is NOT gated on hit strength,
// which this handler already isn't. Acts on the acquired set (`intended_set`) for enemies, or `self`.
// Returns the TOTAL number of buffs whose duration was decreased (0 on a missed chance) — Bambus A2's shield
// boost keys off this count (via ctx.buffsDecreased).
function doReduceEffectDuration(state, actor, act, intended, E) {
  if (act.effect?.chance != null && !rollChance(state?.rng?.debuff, act.effect.chance)) {
    E({ kind: 'reduce_duration', target: '(enemies)', fired: true, consumed: false, note: `missed (${Math.round(act.effect.chance * 100)}%)` });
    return 0;
  }
  const turns = act.effect?.turns ?? 1;
  let total = 0;
  for (const t of (act.target === 'self' ? [actor] : intended)) {
    let n = 0;
    for (const b of t.buffs) { b.turnsLeft -= turns; n++; }
    total += n;
    t.buffs = t.buffs.filter((b) => b.turnsLeft > 0);   // a buff reduced to 0 drops off (matches expireDurations)
    E({ kind: 'reduce_duration', target: t.name, fired: true, consumed: n > 0, amount: n, note: n > 0 ? undefined : 'no buffs to reduce' });
  }
  return total;
}
// BOOST_SHIELD — increase the value of every [Shield] buff on the recipients by (pctOfCasterMaxHp × count) of
// the CASTER's MAX HP. Bambus A2: +3% of MAX HP per enemy buff whose duration this skill decreased (base
// Mike-confirmed 2026-07-26). `count` comes from the preceding REDUCE_EFFECT_DURATION (ctx.buffsDecreased).
// [Magma Shield] is a distinct buff and is NOT boosted ("any [Shield] buffs").
function doBoostShield(state, actor, act, count, E) {
  const add = (act.effect?.pctOfCasterMaxHp ?? 0) * (count ?? 0) * (actor.maxHp ?? 0);
  for (const t of buffRecipients(state, actor, act.target, [])) {
    let boosted = 0;
    for (const b of t.buffs) { if (b.type === 'Shield') { b.value = (b.value ?? 0) + add; boosted++; } }
    E({ kind: 'buff', subtype: 'Shield boost', target: t.name, fired: true, consumed: boosted > 0 && add > 0, amount: boosted ? Math.round(add) : 0, note: (boosted && add > 0) ? undefined : (boosted ? 'no buffs decreased (0 boost)' : 'no [Shield] to boost') });
  }
}
// TRANSFER_DEBUFF — move `count` debuffs FROM the caster onto the target (Arbalester A1, 50%).
// [Debuff Spread] (Michelangelo A2 "Express Delivery!"): copy ALL debuffs on the primary target onto every
// OTHER live enemy. GUARANTEED — it propagates already-landed debuffs, so no ACC/RES re-roll. Uses
// applyDebuff directly (not placeDebuffs), so a spread [Freeze] does NOT re-fire the on-freeze reaction
// (it is a refresh on already-frozen mobs). Copies preserve DoT `sources` so spread Poison/HP Burn stays
// credited to the original placer. THE consumer that matters: Decrease DEF reaches the un-focused mobs, so
// the whole wave's ATTACK damage is DEF-shredded — not just the single target the A1 finishers pile onto.
function doSpreadDebuffs(state, actor, act, intended, E) {
  if (process.env.SIM_NO_SPREAD === '1') return;   // A/B toggle: no-op the spread to measure its aggregate benefit (Mikey A2 Debuff Spread validation)
  const src = intended && intended[0];
  if (!src) return;
  const enemies = alive(actor.side === 'ally' ? state.enemies : state.allies);
  const toSpread = (src.debuffs ?? []).map((d) => ({ ...d }));   // SNAPSHOT before mutating others
  for (const t of enemies) {
    if (t === src) continue;   // the source already carries them
    for (const d of toSpread) {
      if (t.immune?.includes(d.type)) { E({ kind: 'debuff', subtype: d.type, target: t.name, fired: true, consumed: false, note: 'Debuff Spread — immune' }); continue; }
      applyDebuff(t, { type: d.type, value: d.value, pct: d.pct, turns: d.turnsLeft ?? d.turns, stacking: d.stacking, maxStacks: d.maxStacks, sources: d.sources, source: d.source });
      E({ kind: 'debuff', subtype: d.type, target: t.name, source: actor.name, fired: true, consumed: true, note: 'Debuff Spread' });
    }
  }
}
function doTransferDebuff(state, actor, act, intended, E) {
  const count = act.effect?.count ?? 1;
  for (const t of intended) {
    if (act.effect?.chance != null && !rollChance(state?.rng?.debuff, act.effect.chance)) { E({ kind: 'transfer', target: t.name, fired: true, consumed: false, note: `missed (${Math.round(act.effect.chance * 100)}%)` }); continue; }
    for (let i = 0; i < count; i++) {
      const d = actor.debuffs.shift();
      if (!d) { E({ kind: 'transfer', target: t.name, fired: true, consumed: false, note: 'no debuff to transfer' }); break; }
      upsert(t.debuffs, { type: d.type, value: d.value, pct: d.pct, turns: d.turnsLeft });
      E({ kind: 'debuff', subtype: d.type, target: t.name, fired: true, consumed: true, note: 'transferred from caster' });
    }
  }
}

// FILL_TURN_METER — beneficial own-side TM fill (Apothecary A3: all allies +15%; self via target 'self').
// Filling to 100 = act next. NOT resisted (own side). Mirror of REDUCE_TURN_METER on the friendly side.
function doFillTurnMeter(state, actor, act, E) {
  const pts = (act.effect?.pct ?? 0) * 100;
  for (const a of buffRecipients(state, actor, act.target, [])) {
    const d = fillTurnMeter(a, pts);
    E({ kind: 'turn_meter', subtype: 'fill', target: a.name, fired: true, consumed: d > 0, amount: d, note: d > 0 ? undefined : 'already full' });
  }
}
// CLEANSE — remove debuffs from own-side recipients (count = all by default; a numeric count removes the
// oldest N). Beneficial, never resisted.
function doCleanse(state, actor, act, E) {
  if (act.effect?.chance != null && !rollChance(state?.rng?.debuff, act.effect.chance)) { E({ kind: 'cleanse', target: '(allies)', fired: true, consumed: false, note: `missed (${Math.round(act.effect.chance * 100)}%)` }); return; }
  const n = act.effect?.count;
  for (const t of buffRecipients(state, actor, act.target, [])) {
    const had = t.debuffs.length;
    if (n == null) t.debuffs.length = 0; else t.debuffs.splice(0, n);
    E({ kind: 'cleanse', target: t.name, fired: true, consumed: had > t.debuffs.length, note: had ? undefined : 'no debuffs to cleanse' });
  }
}
// EXTRA_TURN — flag the turn loop to re-pick this actor (Hordin A3 / Crossbowman A2 unconditional; Hordin A1
// grants only on a kill via act.onKill + the applyRecipe kill flag). The loop's chain cap prevents runaway.
function doExtraTurn(state, actor, act, E, killedSomething) {
  const grant = act.onKill ? !!killedSomething : true;
  if (grant) { state.grantExtraTurn = true; E({ kind: 'extra_turn', target: actor.name, fired: true, consumed: true, note: act.onKill ? 'on kill' : undefined }); }
  else E({ kind: 'extra_turn', target: actor.name, fired: true, consumed: false, note: 'no kill' });
}
// CONDITIONAL split of an intended set for a conditional PLACE_DEBUFF ("if the target is under [X]…" /
// "if the attack depleted the TM"). Returns the subset that MEETS the condition; the rest get a benign
// "condition not met" ledger note so nothing looks like a silent drop.
// POST-DAMAGE GATE: keep only the targets on whom THIS skill's inflicted damage was < pct × their MAX HP
// (Pelops A2: steal + [Stun] only if the hit dealt <50% of the target's MAX HP). "Inflicted damage" = the sum
// of this recipe's hit raw_damage on that target (read from ctx.results). A pure filter — no ledger effect, so
// a gated-out target simply gets no steal/stun (nothing fired). act.ifDamageBelowPctTargetMaxHp is the pct.
function damageGate(ctx, act, set) {
  if (act.ifDamageBelowPctTargetMaxHp == null) return set;
  const pct = act.ifDamageBelowPctTargetMaxHp;
  const dmgOn = (t) => (ctx.results ?? []).filter((r) => r.target === t.name).reduce((s, r) => s + (r.raw_damage ?? 0), 0);
  return set.filter((t) => dmgOn(t) < pct * (t.maxHp || Infinity));
}
function conditionMet(t, cond) {
  if (!cond) return true;
  if (cond.kind === 'under_debuff') return (t.debuffs ?? []).some((d) => d.type === cond.debuff);
  if (cond.kind === 'tm_depleted')  return (t.turnMeter ?? 0) <= 0;
  if (cond.kind === 'is_boss')      return t.role === 'boss';   // per-target boss branch (e.g. Bambus A3: Enfeeble on mobs, Decrease ATK on the boss instead)
  if (cond.kind === 'target_has_buffs') return (t.buffs ?? []).length > 0;   // Renegade A2: Decrease ACC only if the target has any active buff
  if (cond.kind === 'under_buff')       return (t.buffs ?? []).some((b) => b.type === cond.buff);       // Ezio A2: Bomb branch only on [Stone Skin] targets
  if (cond.kind === 'not_under_buff')   return !(t.buffs ?? []).some((b) => b.type === cond.buff);       // Ezio A2: Poison branch only on NON-[Stone Skin] targets
  return false;
}

// ── II-D: reactive passives (trigger system) ───────────────────────────────────
// A passive is not cast — it SUBSCRIBES to an event and fires a response when the card's condition holds.
// `fireTriggers` is called with an event name + context (e.g. hit_taken with the hit amount); it finds the
// owner's passive triggers for that event, checks the condition, and runs the response actions through the
// same interpreter ops. Verified in isolation by constructing the event directly — no battle loop needed.
function triggerOperand(name, owner, ctx) {
  switch (name) {
    case 'hit_frac_of_maxhp': return (ctx.hitAmount ?? 0) / (owner.maxHp || 1);
    case 'hp_frac':           return owner.hp / (owner.maxHp || 1);
    case 'living_allies_besides_self': return ctx.livingAlliesBesidesSelf;   // ally_death: count of the reactor's still-living allies (0 = it is now the sole survivor, Uugo Final Spite)
    default:                  return undefined;   // unknown -> FLAG, never silently fire
  }
}
const cmp = (L, op, R) => op === '>=' ? L >= R : op === '>' ? L > R : op === '<=' ? L <= R : op === '<' ? L < R : op === '==' || op === '=' ? L === R : op === '!=' ? L !== R : false;

// Decrement a combatant's passive-trigger cooldowns by 1 (floor 0). Called at the owner's start_of_turn, so
// a passive gated at cooldown N is unavailable for ~N of the owner's turns after it fires — matching how the
// game counts passive cooldowns on the owner's turns (not the attacker's).
export function tickPassiveCooldowns(owner) {
  if (!owner?.passiveCd) return;
  for (const k of Object.keys(owner.passiveCd)) owner.passiveCd[k] = Math.max(0, (owner.passiveCd[k] ?? 0) - 1);
}

// The PASSIVE-TRIGGER op dispatch — a SECOND dispatch surface (passives run a subset of ops in response to an
// event, with a different recipient shape: `owner` is the reactor, ctx.attacker is the incoming attacker). Kept
// as its own table so IMPLEMENTED_OPS below can union BOTH surfaces — otherwise a trigger-only op (WAKE_FROM_SLEEP)
// is invisible to the ops-consistency rung. Behaviour identical to the prior if/else.
const TRIGGER_OP_HANDLERS = {
  PLACE_BUFF(state, owner, act, ctx, E)      { placeBuffs(state, owner, act, [], E); },
  PLACE_DEBUFF(state, owner, act, ctx, E)    { placeDebuffs(state, owner, act, ctx.attacker ? [ctx.attacker] : [], E); },
  HEAL(state, owner, act, ctx, E)            { doHeal(state, owner, act, E); },
  WAKE_FROM_SLEEP(state, owner, act, ctx, E) { doWakeFromSleep(state, owner, E); },
  // COUNTERATTACK — re-run a skill (default A1) AT the attacker. An ally hitting an enemy has incoming=false in
  // dealOneHit, so the counter fires NO further reactions → no counter-of-counter cascade (guaranteed, not a guard).
  COUNTERATTACK(state, owner, act, ctx, E) {
    const attacker = ctx.attacker;
    if (!attacker || !attacker.alive) return;
    const slot = act.slot ?? 'A1';
    const rec = recipeFor(owner, slot);
    if (!rec) { flag(state, `COUNTERATTACK: no ${slot} recipe for ${owner.name}`); return; }
    E({ kind: 'counterattack', subtype: slot, target: attacker.name, fired: true, consumed: true, note: `${owner.name} counters ${attacker.name}` });
    applyRecipe(state, owner, rec, { forceTarget: attacker });
  },
  // Passive-reaction versions targeting the EVENT unit carried in ctx.attacker (Hilvi Divine Mission: on an
  // enemy [Freeze] → HP Burn + steal a buff + −10% TM on THAT enemy). ctx.attacker is the reaction's subject.
  STEAL_BUFF(state, owner, act, ctx, E)        { if (ctx.attacker) doStealBuff(state, owner, act, [ctx.attacker], E); },
  REDUCE_TURN_METER(state, owner, act, ctx, E) { if (ctx.attacker) doReduceTurnMeter(state, owner, act, [ctx.attacker], E); },
};

export function fireTriggers(state, owner, eventName, ctx = {}) {
  const first = combatantKey(owner);
  const passives = Object.values(RECIPES).filter((r) => r.type === 'passive' && r.triggers && champKey(r.champion) === first);
  const E = (rec) => recordEffect(state, { source: `${owner.name} [P]`, ...rec });
  for (const p of passives) for (const trig of p.triggers) {
    if (trig.on !== eventName) continue;
    if (trig.when) {
      const L = triggerOperand(trig.when.left, owner, ctx);
      if (L === undefined) { flag(state, `UNKNOWN trigger operand '${trig.when.left}': ${owner.name}`); continue; }
      if (!cmp(L, trig.when.cmp, trig.when.right)) continue;
    }
    // CHANCE-gated reaction (Ezio P2 counterattack 35%): roll off the PROC stream (RNG_REGISTRY #14). seed=null
    // → threshold (0.35 < 0.5 → does NOT fire in the deterministic golden). A missed roll is a benign non-fire.
    if (trig.chance != null && !rollChance(state?.rng?.proc, trig.chance)) {
      E({ kind: 'trigger', subtype: trig.on, target: owner.name, fired: false, consumed: false, note: `proc missed (${Math.round(trig.chance * 100)}%)` });
      continue;
    }
    // PASSIVE-TRIGGER COOLDOWN: a trigger with `cooldown` may fire at most once per that many OWNER-turns
    // (Vergis Second Wind [Shield]: base 3). Without it the shield re-procs on every hit → the champion is
    // unkillable (the sim's boss-phase over-survival). Grouped per passive skill so multiple gated triggers
    // share one timer; decremented at the owner's start_of_turn (tickPassiveCooldowns).
    if (trig.cooldown) {
      const key = `${p.champion}:${p.name}`;
      owner.passiveCd ??= {};
      if ((owner.passiveCd[key] ?? 0) > 0) {
        E({ kind: 'passive-cd', subtype: p.name, target: owner.name, fired: false, consumed: false, note: `on cooldown (${owner.passiveCd[key]}t left)` });
        continue;
      }
      owner.passiveCd[key] = trig.cooldown;
      E({ kind: 'passive-cd', subtype: p.name, target: owner.name, fired: true, consumed: true, note: `fired → cd ${trig.cooldown}` });
    }
    for (const act of trig.actions) {
      const h = TRIGGER_OP_HANDLERS[act.op];
      if (h) h(state, owner, act, ctx, E);
      else flag(state, `UNMODELLED trigger op '${act.op}': ${owner.name} passive`);
    }
  }
}

// Fire the reactive events a combatant gets when it TAKES a direct hit — on-attacked, hit_taken (a single hit
// ≥ the passive's threshold), hp_below. Extracted so EVERY damage path fires them identically: the recipe path
// (dealOneHit) calls it directly; the engine/boss paths (engine.applySkill, dragon.js) call it via the
// state.onDamageTaken hook set in installRecipeRun — otherwise on-hit passives (Vergis Second Wind [Shield],
// Pelops Master-of-Games) proc only vs recipe-driven wave mobs and NEVER on the boss (where the losses are).
// hpDamage = HP actually lost (post-shield), so a hit fully absorbed by a shield does not count as a "hit".
export function fireDamageReactions(state, target, attacker, hpDamage) {
  if (!target?.alive && (hpDamage ?? 0) <= 0) return;
  fireTriggers(state, target, 'attacked', { attacker });
  if ((hpDamage ?? 0) > 0) fireTriggers(state, target, 'hit_taken', { hitAmount: hpDamage, attacker });
  if (target.alive && target.hp / (target.maxHp || 1) < 0.50) fireTriggers(state, target, 'hp_below', {});
}

// incomingDamage() + its modOperand helper moved to engine.js (shared with applySkill); re-exported at the
// top of this file so importers that reference it from interpreter.js keep resolving.

// Wire a state for a recipe-driven run: route actions through recipes, fire start-of-turn/round triggers
// each turn (Ezio's Perfect Veil renews here), and place any battle-start round buffs so they're up from t0.
// The incoming-event triggers (hit_taken / hp_below / attacked) fire automatically from dealOneHit; only the
// turn-loop events need this hook. Injected on state to avoid a circular engine↔interpreter import.
// A champion's passive-declared immunities (Pelops: [Stun]/[HP Burn]/[Petrification]). Static, always-on.
export function passiveImmunities(owner) {
  const first = combatantKey(owner);
  const out = [];
  for (const r of Object.values(RECIPES)) if (r.type === 'passive' && r.immune && champKey(r.champion) === first) out.push(...r.immune);
  return out;
}
// ── BURNING BLOOD (Artak passive) — self MAX-HP destruction → self stat-scaling ──────────────────────
// "Whenever a [HP Burn] debuff is activated, destroys this Champion's MAX HP by 5% (stacks to 50%). +1%
//  DMG/C.DMG/DEF and +2 SPD/RES for each 1% of destroyed MAX HP." Fired by engine's state.onHpBurnActivate
// hook at BOTH activation sites (tickDots HP-Burn branch + activateHpBurns). GATED by the passive's
// `burningBlood` field → no-op for any champion/team without it (Dragon untouched). Built 2026-08-01.
const BURNING_BLOOD = new Map(
  Object.values(RECIPES).filter((r) => r.type === 'passive' && r.burningBlood).map((r) => [champKey(r.champion), r.burningBlood]));
// Re-apply Artak's stats from his CURRENT destroyed% (used by both the activation-increment and the A3 restore).
function applyBurningBloodReapply(a, state) {
  const bb = a._burningBlood; if (!bb) return;
  const cfg = bb.cfg, d = bb.destroyed, pct = d * 100;          // d = fraction (0..cap); pct = percentage points destroyed
  a.maxHp = Math.max(1, Math.round(bb.baseMaxHp * (1 - d)));    // destroy MAX HP → lower EHP (off-Taunt target) + lower HP-scaled damage base
  if (a.hp > a.maxHp) a.hp = a.maxHp;
  a.critDmg = bb.baseCritDmg + pct * cfg.cdmgPer;              // +1% C.DMG per 1% destroyed (critDmg in percent units)
  a.def = Math.round(bb.baseDef * (1 + d * cfg.defPer));       // +1% DEF per 1% destroyed
  a.spd = Math.round(bb.baseSpd + pct * cfg.spdPer);           // +2 SPD per 1% destroyed
  a.res = Math.round(bb.baseRes + pct * cfg.resPer);           // +2 RES per 1% destroyed
  a.dmgMult = 1 + d * cfg.dmgPer;                              // +1% DMG per 1% destroyed (consumed in computeRawHit)
}
function applyBurningBlood(state) {
  for (const a of state.allies) {
    const cfg = a.alive ? BURNING_BLOOD.get(combatantKey(a)) : null;
    if (!cfg) continue;
    const bb = a._burningBlood ??= { destroyed: 0, cfg, baseMaxHp: a.maxHp, baseCritDmg: a.critDmg, baseDef: a.def, baseSpd: a.spd, baseRes: a.res };
    if (bb.destroyed >= cfg.cap) continue;                       // MAX HP destruction capped
    bb.destroyed = Math.min(cfg.cap, bb.destroyed + cfg.destroyPct);
    applyBurningBloodReapply(a, state);
    recordEffect(state, { kind: 'buff', subtype: 'Burning Blood', target: a.name, fired: true, consumed: true, note: `destroyed ${Math.round(bb.destroyed * 100)}% MaxHP` });
  }
}

export function installRecipeRun(state) {
  state.recipeAct = recipeDispatch;   // recipeFor(authored) || kitToRecipe(auto-parse) → applyRecipe (the ONE engine)
  state.onHpBurnActivate = applyBurningBlood;   // engine fires this at every [HP Burn] activation → Artak Burning Blood (gated; no-op without a burningBlood ally)
  state.onTurnStart = (s, actor) => { tickPassiveCooldowns(actor); fireTriggers(s, actor, 'start_of_turn'); };   // per TURN (the actor): tick passive cds, Bambus wake
  state.onRoundStart = (s) => { for (const a of s.allies) if (a.alive) fireTriggers(s, a, 'round_start'); };   // per ROUND (all allies): Ezio [Perfect Veil]
  state.onAllyDebuffed = (s, ally, type) => { maybeSponge(s, ally, type); maybeShieldOnDebuff(s, ally); };   // scripted boss routes its ally-debuffs through the sponge (Bambus) + the on-debuff shield (Glorious Pallas)
  state.onDeath = (s, dead) => {   // a combatant died → fire 'ally_death' on its surviving same-side allies (Uugo Final Spite)
    const side = dead.side === 'ally' ? s.allies : s.enemies;
    for (const c of side) {
      if (!c.alive || c === dead) continue;
      const livingAlliesBesidesSelf = side.filter((x) => x.alive && x !== c).length;   // 0 ⇒ c is the sole survivor
      fireTriggers(s, c, 'ally_death', { deadAlly: dead, livingAlliesBesidesSelf });
    }
  };
  state.onDamageTaken = (s, t, atk, hp) => fireDamageReactions(s, t, atk, hp);   // engine.applySkill + dragon.js boss → on-hit passives proc on EVERY path, not just recipe mobs

  for (const a of state.allies) {
    fireTriggers(state, a, 'round_start');                                    // round 1 = battle start
    const im = passiveImmunities(a); if (im.length) a.immune = [...new Set([...(a.immune || []), ...im])];   // passive immunities
  }
}

// ── the interpreter ────────────────────────────────────────────────────────────
// THE OP DISPATCH TABLE — the ONE authoritative list of operations the interpreter can execute (P0). Each
// handler takes (ctx, act); ctx carries the per-recipe mutable state (intended set, results, killedSomething)
// so ACQUIRE_TARGETS can set the target set and EXTRA_TURN can read the kill flag, exactly as the previous
// if/else did. `IMPLEMENTED_OPS` (the keys) is the SINGLE SOURCE OF TRUTH for "what runs" — operations.js's
// `implemented` flags and the recipes' `deferred[]` notes are reconciled against it by tools/model-ops-
// consistency.mjs, so the three can never silently drift again. Behaviour is byte-identical to the old chain:
// same functions, same argument shapes, same order within the seq-sorted loop.
const OP_HANDLERS = {
  ACQUIRE_TARGETS(ctx, act) { ctx.intended = ctx.forceTarget ? (ctx.forceTarget.alive ? [ctx.forceTarget] : []) : acquireTargets(ctx.state, ctx.actor, act, ctx.opponents, ctx.avoid); },
  DEAL_DAMAGE(ctx, act) {
    const { state, actor, opponents, E } = ctx;
    const F = act.formulaId ? FORMULAS[act.formulaId] : act.formula;   // named authored formula OR an inline kit-synthesized one
    if (!F) { flag(state, `UNKNOWN formula ${act.formulaId}: ${actor.name} ${ctx.recipe.slot}`); return; }
    // SKILL-BOOK DAMAGE: F.bookDamage = the skill's cumulative Damage +% books (e.g. Michelangelo A1 = 4× +5% = 0.20).
    // Applied ONLY when THIS champion has this slot booked (actor.bookedSlots — real per-account state); ×1 otherwise,
    // so an unbooked champion is unchanged. A flat multiplier on the skill's damage, separate from the coefficient.
    const bookMult = (F.bookDamage && actor.bookedSlots?.has(ctx.recipe.slot)) ? (1 + F.bookDamage) : 1;
    for (const t of ctx.intended) {
      if (F.maxHpPct != null) {                       // DEF-independent %-of-target-MAX-HP nuke (capped on stage 21+/Hard)
        if (t.alive) dealMaxHpDamage(state, t, F.maxHpPct, E, actor);
      } else {
        for (let h = 0; h < (F.hitCount ?? 1); h++) {
          let ht;                                       // the TARGET this hit actually landed on
          if (F.randomTargetPerHit) {                 // "attacks N times at random": each hit re-picks a random living target
            const rt = pickRandomLiving(state, opponents);
            if (!rt) break;                            // no living target left
            ctx.results.push(dealOneHit(state, actor, rt, F, opponents, E, bookMult));
            if (rt.hp <= 0) ctx.killedSomething = true;
            ht = rt;
          } else {
            if (!t.alive) break;                       // fixed-target multi-hit stops when the target dies
            ctx.results.push(dealOneHit(state, actor, t, F, opponents, E, bookMult));
            ht = t;
          }
          // PER-HIT debuff placement (Ninja A2 Hailburn: EACH of the 3 random hits independently rolls its
          // [HP Burn] 75% on the target THAT hit struck). Reuses the full placement path (chance + ACC/RES +
          // immune + events) on a single-target set, so 3 hits = 3 independent rolls, not one.
          if (F.onHitPlaceDebuff && ht && ht.hp > 0) {
            const _placed = placeDebuffs(state, actor, { effect: F.onHitPlaceDebuff }, [ht], E);
            // Ninja A2 vs Boss: each swing that LANDS an [HP Burn] instantly detonates it ("instantly activates
            // any [HP Burn], including those placed by this Skill"). PER-HIT, not per-cast → ~3×0.75≈2.25 ticks
            // beyond the standing-burn detonation (recipe seq 15). First-party CB video 2026-08-08.
            if (F.activatePlacedBurnVsBoss && ht.role === 'boss' && (_placed?.landed ?? 0) > 0) {
              const _d = activateHpBurns(state, ht);
              E({ kind: 'activate', subtype: 'HP Burn', source: actor.name, target: ht.name, fired: true, consumed: _d > 0, amount: _d, note: 'per-hit instant activation' });
            }
          }
        }
        // "15% chance of placing an extra hit" (Faceless/Crossbowman A1): ONE extra hit of the same formula,
        // rolled once per activation off the PROC stream (RNG_REGISTRY #12). It is a real added attack, not an
        // EV damage bump. seed=null resolves via the chance-mode policy — 15% is below the 0.5 threshold, so the
        // deterministic golden fires no extra hit (no snapshot drift); a seeded run rolls it honestly.
        if (F.extraHitChance && t.alive && rollChance(state?.rng?.proc, F.extraHitChance)) {
          ctx.results.push(dealOneHit(state, actor, t, F, opponents, E));
        }
        fireGearProcs(state, actor, t);               // ATTACKER's on-attack gear procs (Toxic/Stun/…), one roll per target
      }
      if (t.alive && t.hp <= 0) ctx.killedSomething = true;   // checkDeaths flips .alive later
    }
    // SKILL-LEVEL crit flag for on-crit conditionals (ifCrit buff placement / ignoreResIfCrit debuff land).
    // Seeded → any of this skill's hits rolled a crit ("if EITHER hit was critical"). Deterministic (EV) →
    // treat as crit when the effective crit rate ≥ 50% (the extraHitChance 0.5-threshold convention), so the
    // golden stays discrete + byte-identical (its Bambus teams carry no on-crit recipe). Later same-skill
    // actions (after_hit debuffs, the on-crit self buff) read ctx.attackCrit.
    const critHits = ctx.results.filter((r) => r && ('crit' in r));
    if (critHits.length) ctx.attackCrit = critHits.some((r) => r.crit) || (critHits.some((r) => r.critEv) && effectiveCritRate(actor) >= 50);
    applyWarmaster(state, actor, ctx.intended[0], opponents, E);   // once-per-skill mastery bonus on the primary target (no-op unless actor.bossMastery)
  },
  PLACE_DEBUFF(ctx, act) {
    const { state, actor, E } = ctx;
    // on-crit-ONLY placement (Xeno A1: "Places three 5% [Poison] debuffs IF this attack is critical" — the extra
    // 2 copies are gated by the skill's crit flag). Mirror of PLACE_BUFF's ifCrit gate. Reads ctx.attackCrit set
    // by DEAL_DAMAGE. No-op for effects without the flag (the common case).
    if (act.effect?.ifCrit && !ctx.attackCrit) { E({ kind: 'debuff', subtype: act.effect.type, target: (ctx.intended[0]?.name ?? '?'), fired: true, consumed: false, note: 'no crit' }); return; }
    const set = damageGate(ctx, act, act.target === 'self' ? [actor] : ctx.intended);   // Pelops A2: [Stun] only on a <50%-MaxHP hit
    if (act.condition) {                              // conditional placement ("if the target is under [X]" / "if TM depleted")
      for (const t of set) if (!conditionMet(t, act.condition)) E({ kind: 'debuff', subtype: act.effect?.type, target: t.name, fired: true, consumed: false, note: 'condition not met' });
      ctx.placeResult = placeDebuffs(state, actor, act, set.filter((t) => conditionMet(t, act.condition)), E, ctx.attackCrit);
    } else ctx.placeResult = placeDebuffs(state, actor, act, set, E, ctx.attackCrit);
  },
  // Artak A3 self-recovery — reads the PLACE_DEBUFF tally: restore destroyed MAX HP 10% per burn PLACED,
  // heal 5% MAX HP per burn attempt BLOCKED/RESISTED. On Spider his ACC (10) vs spiderling RES (100) makes
  // most burns resist → the heal path dominates (his ~30k reality healing). Gated on his Burning Blood state.
  SELF_RECOVER_ON_BURN(ctx, act) {
    const { state, actor, E } = ctx;
    const r = ctx.placeResult ?? { landed: 0, resisted: 0 };
    const bb = actor._burningBlood;
    // RESTORE destroyed MAX HP (10% per burn PLACED): un-destroys MAX HP → current HP rises with it = healing.
    if (bb && r.landed && bb.destroyed > 0) {
      const maxBefore = actor.maxHp;
      bb.destroyed = Math.max(0, bb.destroyed - (act.effect?.restorePerPlaced ?? 0.10) * r.landed);
      applyBurningBloodReapply(actor, state);
      const restored = actor.maxHp - maxBefore;   // MAX HP recovered → heal current HP by the same amount (Raid MAX-HP-up behaviour)
      if (restored > 0) { actor.hp = Math.min(actor.maxHp, actor.hp + restored); E({ kind: 'heal', source: actor.name, target: actor.name, amount: restored, fired: true, consumed: true, note: `restored ${r.landed}×10% destroyed MAX HP` }); }
    }
    // HEAL 5% MAX HP per burn BLOCKED/RESISTED (dominant when ACC < enemy RES).
    if (r.resisted) {
      const heal = (act.effect?.healPerResist ?? 0.05) * r.resisted * (actor.maxHp ?? 0);
      actor.hp = Math.min(actor.maxHp, actor.hp + heal);   // hp clamps; ledger records FULL incl. overheal (mirrors in-game healing stat)
      E({ kind: 'heal', source: actor.name, target: actor.name, amount: heal, fired: true, consumed: heal > 0, note: `${r.resisted} burn(s) resisted → 5% MaxHP each` });
    }
  },
  PLACE_BUFF(ctx, act)         { if (act.effect?.ifCrit && !ctx.attackCrit) { ctx.E({ kind: 'buff', subtype: act.effect.type, target: ctx.actor.name, fired: true, consumed: false, note: 'no crit' }); return; } placeBuffs(ctx.state, ctx.actor, act, ctx.intended, ctx.E); },
  HEAL(ctx, act)               { doHeal(ctx.state, ctx.actor, act, ctx.E); },
  REVIVE(ctx, act)             { ctx.revivedCount = (ctx.revivedCount ?? 0) + doRevive(ctx.state, ctx.actor, act, ctx.E).length; },
  REVIVE_AND_CAST(ctx, act)    { doReviveAndCast(ctx.state, ctx.actor, act, ctx.E); },   // Iudex Artor A3+A4: revive → buff → cast revived ally's default skill → reset-on-kill
  SELF_DAMAGE(ctx, act)        { doSelfDamage(ctx.state, ctx.actor, act, ctx.E); },
  DEBUFF_ACTIVATION(ctx, act)  { doActivateDebuff(ctx.state, ctx.actor, act, ctx.intended, ctx.E); },
  PLACE_BOMB(ctx, act)         { doPlaceBomb(ctx.state, ctx.actor, act, act.condition ? ctx.intended.filter((t) => conditionMet(t, act.condition)) : ctx.intended, ctx.E); },
  STEAL_BUFF(ctx, act)         { doStealBuff(ctx.state, ctx.actor, act, damageGate(ctx, act, ctx.intended), ctx.E); },   // Pelops A2: steal only on a <50%-MaxHP hit (gate no-op for Ezio A3)
  REDUCE_TURN_METER(ctx, act)  { doReduceTurnMeter(ctx.state, ctx.actor, act, ctx.intended, ctx.E); },
  INCREASE_COOLDOWN(ctx, act)  { doIncreaseCooldown(ctx.state, ctx.actor, act, ctx.intended, ctx.E); },
  DECREASE_COOLDOWN(ctx, act)  { doDecreaseCooldown(ctx.state, ctx.actor, act, ctx.E); },
  TRANSFER_DEBUFF(ctx, act)    { doTransferDebuff(ctx.state, ctx.actor, act, ctx.intended, ctx.E); },
  SPREAD_DEBUFFS(ctx, act)     { doSpreadDebuffs(ctx.state, ctx.actor, act, ctx.intended, ctx.E); },
  EXTEND_EFFECT(ctx, act)      { doExtendEffect(ctx.state, ctx.actor, act, ctx.E); },
  REDUCE_EFFECT_DURATION(ctx, act) { ctx.buffsDecreased = doReduceEffectDuration(ctx.state, ctx.actor, act, ctx.intended, ctx.E); },
  BOOST_SHIELD(ctx, act)       { doBoostShield(ctx.state, ctx.actor, act, ctx.buffsDecreased ?? 0, ctx.E); },
  FILL_TURN_METER(ctx, act)    { if (act.skipIfRevived && (ctx.revivedCount ?? 0) > 0) return; if (act.onlyVsBoss && !ctx.intended?.some((t) => t.role === 'boss')) return; doFillTurnMeter(ctx.state, ctx.actor, act, ctx.E); },   // Hilvi A3: TM fill only if revived nobody. Ninja A1: self +15% ONLY when used against a Boss (skill text) — gated on the acquired target set.
  CLEANSE(ctx, act)            { doCleanse(ctx.state, ctx.actor, act, ctx.E); },
  EXTRA_TURN(ctx, act)         { doExtraTurn(ctx.state, ctx.actor, act, ctx.E, ctx.killedSomething); },
  ALLY_ATTACK(ctx, act)        { doAllyAttack(ctx.state, ctx.actor, act, ctx.intended, ctx.E); },   // "Ally Attack" / join-attack: allies each attack the acquired target with their A1
  BUFF_STRIP(ctx, act)         { doBuffStrip(ctx.state, ctx.actor, act, ctx.intended, ctx.E); },    // "Buff Strip": delete buffs from enemy targets (not steal, not cleanse)
  EQUALIZE_HP(ctx, act)        { doEqualizeHp(ctx.state, ctx.actor, act, ctx.E); },                 // raise all allies to the highest ally's HP% (Mavara A2)
  STEAL_TURN_METER(ctx, act)   { doStealTurnMeter(ctx.state, ctx.actor, act, ctx.intended, ctx.E); },  // drain enemy TM + fill caster (Fabian A1, Fayne A1)
  SWAP_HP(ctx, act)            { doSwapHp(ctx.state, ctx.actor, act, ctx.intended, ctx.E); },          // exchange caster/target HP% (Vallaryn A3)
  BUFF_ACTIVATION(ctx, act)    { doBuffActivation(ctx.state, ctx.actor, act, ctx.E); },                // force ally [Continuous Heal] to tick now (Donatello A1)
};
// The authoritative list of executable ops — the UNION of both dispatch surfaces (active-recipe OP_HANDLERS +
// passive-trigger TRIGGER_OP_HANDLERS). Consumed by tools/model-ops-consistency.mjs to keep operations.js and
// the recipes' deferred[] notes honest.
export const IMPLEMENTED_OPS = [...new Set([...Object.keys(OP_HANDLERS), ...Object.keys(TRIGGER_OP_HANDLERS)])];

// ── ESCALATION (Ninja [Escalation] passive) ─────────────────────────────────────────────────────────
// "+10% ATK (cap +100%) and +5% C.DMG (cap +25%) each time a single enemy is hit by ALL THREE of Ninja's
// active skills in a single Round. Multiplicative, can stack, repeatable. vs Bosses: +20% ATK / +10% C.DMG."
// GENERAL + GATED via the passive's `escalation` field (no-op for any champion without it → Dragon untouched).
// PER-ROUND TRIGGER, PERSISTENT STACKS: the hit-set that must reach {A1,A2,A3} resets each Round (state.round),
// but the accumulated ATK/C.DMG multiplier persists for the battle. On Spider a Round is LONG (spiderlings keep
// respawning, so the round doesn't complete until they've all acted), giving Ninja the multiple turns needed to
// land A1+A2+A3 on the boss within one round — so the strict "single Round" reading actually fires here.
// The stat gain is applied by scaling the actor's ATK / C.DMG from a captured base (idempotent, no double-compound);
// effectiveScaleStat then folds any [Increase/Decrease ATK] on top, exactly as a base-stat increase should.
const ESCALATION_SPECS = Object.fromEntries(
  Object.values(RECIPES).filter((r) => r.type === 'passive' && r.escalation).map((r) => [champKey(r.champion), r.escalation]));
function maybeEscalate(state, actor, recipe, results, E) {
  const spec = ESCALATION_SPECS[combatantKey(actor)];
  if (!spec) return;
  const slot = String(recipe.slot || '').toUpperCase();
  if (!['A1', 'A2', 'A3'].includes(slot)) return;                       // only the three ACTIVE skills count
  const round = state.round ?? 0;
  const esc = actor._escalation ??= { round, hits: {}, atkMult: 1, cdmgMult: 1, baseAtk: actor.atk, baseCdmg: actor.critDmg, stacks: 0 };
  // PER-ROUND RESET REMOVED (first-party CB video, 2026-08-08): wiping the hit-set each Round made Escalation
  // UNREACHABLE on single-target CB, where Ninja gets only 1-2 turns/round and can never land all 3 skills inside
  // one round — yet the video shows it stacking steadily. The set now accumulates until the trio {A1,A2,A3}
  // completes (reset-on-completion below), so Ninja stacks once per full skill cycle → the observed gradual ramp.
  // ⚠ Also affects Spider's Ninja (rounds already long there) — re-measure that golden.
  esc.round = round;
  const oppByName = new Map((actor.side === 'ally' ? state.enemies : state.allies).map((o) => [o.name, o]));
  const hitNames = new Set(results.filter((r) => r && !r.skipped && !r.evaded && r.target != null && (r.raw_damage ?? -1) >= 0).map((r) => r.target));
  for (const name of hitNames) {
    (esc.hits[name] ??= new Set()).add(slot);
    if (esc.hits[name].size < 3) continue;
    esc.hits[name] = new Set();                                          // repeatable: reset this enemy's set after a completion
    const boss = oppByName.get(name)?.role === 'boss';
    esc.atkMult = Math.min(1 + spec.atkCap, esc.atkMult * (1 + (boss ? spec.bossAtkPer : spec.atkPer)));
    esc.cdmgMult = Math.min(1 + spec.cdmgCap, esc.cdmgMult * (1 + (boss ? spec.bossCdmgPer : spec.cdmgPer)));
    esc.stacks++;
    actor.atk = Math.round(esc.baseAtk * esc.atkMult);                   // scale from the captured base (idempotent)
    actor.critDmg = esc.baseCdmg * esc.cdmgMult;
    E({ kind: 'buff', subtype: 'Escalation', target: actor.name, fired: true, consumed: true,
      note: `${boss ? 'boss ' : ''}stack ${esc.stacks} → ATK ×${esc.atkMult.toFixed(2)} C.DMG ×${esc.cdmgMult.toFixed(2)} (all 3 hit ${name})` });
  }
}

/**
 * Execute one recipe for `actor`. Walks actions in `seq` order: ACQUIRE_TARGETS builds the intended set,
 * DEAL_DAMAGE resolves `hitCount` hits per target (stopping if a target dies mid-multi-hit). Side-aware via
 * `actor.side`, exactly like the engine. Returns the list of structured hit resolutions (for tests/tracing).
 */
export function applyRecipe(state, actor, recipe, opts = {}) {
  const E = (rec) => recordEffect(state, { source: actor.name, slot: recipe.slot, ...rec });
  const ctx = {
    state, actor, recipe,
    opponents: actor.side === 'ally' ? state.enemies : state.allies,
    avoid: actor.side === 'ally' ? ['Unkillable', 'Block Damage'] : [],
    forceTarget: opts.forceTarget ?? null,   // COUNTERATTACK forces the single target to the attacker (bypasses ACQUIRE selection)
    E, intended: [], results: [], killedSomething: false,   // killedSomething → EXTRA_TURN onKill (Hordin A1)
  };
  for (const act of [...recipe.actions].sort((a, b) => a.seq - b.seq)) {
    // ACTION GATE — `ifAllAlliesDead` runs this action only when the caster's OTHER allies are all dead (true) or
    // at least one is alive (false). Uugo A3 "Uugo's Brew": cleanse+heal in the normal case, but "If all allies
    // are dead, revives them … then fills their Turn Meters by 50% INSTEAD" — the revive/TM branch is gated true,
    // the cleanse/heal branch false, so the two are mutually exclusive exactly as the card reads. Reusable for any
    // revive-if-wiped clutch skill. Absent field → always runs (unchanged for every other recipe).
    if (act.ifAllAlliesDead != null) {
      const others = (actor.side === 'ally' ? state.allies : state.enemies).filter((c) => c !== actor);
      const allDead = others.length > 0 && others.every((c) => !c.alive);
      if (!!act.ifAllAlliesDead !== allDead) continue;
    }
    const handler = OP_HANDLERS[act.op];
    if (handler) handler(ctx, act);
    else flag(state, `UNMODELLED recipe op '${act.op}': ${actor.name} ${recipe.slot} (interpreter)`);
  }
  maybeEscalate(state, actor, recipe, ctx.results, E);   // Ninja [Escalation]: all-3-skills-hit-one-enemy-in-a-Round → +ATK/+C.DMG (gated; no-op otherwise)
  return ctx.results;
}

// ── THE ONE DISPATCH (registered on engine.js so it is available on every path) ─────────────────────
// Authored recipe first, else a kit-synthesized one — a single combat engine, no separate applySkill. Records
// kit-synth usage on the state so the coverage rung can assert authored content never falls to auto-parse (the
// old fallback tripwire, now on the recipeFor/kitToRecipe seam instead of the deleted applySkill seam).
function recipeDispatch(state, actor, skill) {
  let r = recipeFor(actor, skill.slot);
  if (!r) {
    r = kitToRecipe(skill);
    if (r) (state._kitSynth ??= {})[`${actor.name} ${skill.slot}`] = (state._kitSynth[`${actor.name} ${skill.slot}`] ?? 0) + 1;
  }
  if (!r) return false;
  applyRecipe(state, actor, r);
  return true;
}
registerRecipeEngine(recipeDispatch);

// A combatant is RECIPE-DRIVEN if its champion has any authored recipe. Used by dealOneHit to fire the
// defender's on-attacked exactly ONCE: recipe reactions for authored champs, else the parsed fireOnAttacked.
const RECIPE_CHAMPS = new Set(Object.values(RECIPES).map((r) => champKey(r.champion)));
function isRecipeDriven(c) { return RECIPE_CHAMPS.has(combatantKey(c)); }
