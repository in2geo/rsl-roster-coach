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
  fireOnAttacked, healReduction, activatePoisons, debuffSlots,
} from './engine.js';
import { registerRecipeEngine } from './recipe-registry.js';
import { RECIPES, FORMULAS, CONDITIONS } from './recipes.js';
// incomingDamage moved to engine.js (so applySkill can share it too); re-export so existing importers
// (model-snapshot / model-sensitivity / model-invariants) keep resolving it from interpreter.js.
export { incomingDamage };

const alive = (arr) => arr.filter((c) => c.alive);
const shieldPool = (c) => c.buffs.reduce((s, b) => s + (/Shield/.test(b.type) ? Math.max(0, b.value || 0) : 0), 0);

// Look up the recipe for a combatant's chosen slot. Allies carry SHORT names (Bambus, Ezio, …); the recipe
// key is `<FIRSTNAME UPPER>-<SLOT>`. Returns null when no recipe exists (caller falls back to the old path).
export function recipeFor(actor, slot) {
  // strip a fixture position suffix ("Lua#3" → "Lua") so wave mobs resolve to their champion recipe
  const first = String(actor.name).split(' ')[0].split('#')[0].toUpperCase();
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
  if (act.targetIf) {
    const selected = chooseSingleTarget(opponents, avoid);
    if (!selected) return [];
    const cond = CONDITIONS[act.targetIf.conditionId];
    if (!cond) { flag(state, `UNKNOWN condition ${act.targetIf.conditionId}: ${actor.name} ${act.op}`); return [selected]; }
    const pass = evalCondition(cond, { target: selected });
    if (pass === undefined) { flag(state, `UNKNOWN condition operand '${cond.left}': ${actor.name}`); return [selected]; }
    const branch = pass ? act.targetIf.then : act.targetIf.else;
    return branch === 'all_enemies' ? live : [selected];
  }
  if (act.target === 'all_enemies') return live;
  if (act.target === 'single') { const s = chooseSingleTarget(opponents, avoid); return s ? [s] : []; }
  flag(state, `UNKNOWN target selector '${act.target}': ${actor.name} ${act.op}`);
  return [];
}

// ── DEAL_DAMAGE ────────────────────────────────────────────────────────────────
// One hit against one target. The raw-damage NUMBER (multiplier stack + incoming modifiers) comes from the
// SHARED engine.computeRawHit — the same function applySkill uses, so the two engines cannot drift on the
// math. This function keeps only the APPLICATION (dealDamage / lifesteal / reflect / reactions) + the
// structured resolution object + the FIRED/CONSUMED ledger effect.
function dealOneHit(state, actor, t, F, opponents, E) {
  if (!t.alive) return { target: t.name, skipped: 'target already dead' };
  const fl = F.flags || {};
  const { raw, critM, affM, crit, critEv } = computeRawHit(state, actor, t, F);
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
  // LIFESTEAL (gear 4-set): self-heal a fraction of the damage dealt — the recipe-path mirror of the
  // engine.applySkill consumer (line ~643). It was consumed on the OLD path but NOT here, so every
  // recipe-driven tool (sim-trace/run/suite) showed a Lifesteal tank's healing as 0 — the sim's PRIMARY
  // sustain source (Pelops 30%, a reality anchor) silently absent. "Represented but not consumed", sustain side.
  if (actor.lifesteal > 0 && dealt > 0) {
    const heal = Math.min((actor.maxHp ?? 0) - actor.hp, actor.lifesteal * dealt * (1 - healReduction(actor)));   // [Heal Reduction] on the attacker cuts its lifesteal
    if (heal > 0) { actor.hp += heal; E({ kind: 'heal', subtype: 'Lifesteal', target: actor.name, fired: true, consumed: true, amount: heal }); }
  }
  // CRIT-CONDITIONAL RIDERS (Lua A1 splash / A2 heal). Seeded → fire on the ACTUAL crit; EV (seed=null) →
  // scale by the crit rate — the rider mirror of how the DAMAGE multiplier already folds crit as EV. The
  // effect % is read from the formula (no constant). critP is the per-hit weight: 1 on a rolled crit, cr% in EV.
  const critP = crit ? 1 : (critEv ? effectiveCritRate(actor) / 100 : 0);
  if (F.critHealPct && critP > 0) {   // Lua A2: "each critical hit heals this Champion by 2.5% HP"
    const heal = Math.min((actor.maxHp ?? 0) - actor.hp, critP * F.critHealPct * (actor.maxHp ?? 0) * (1 - healReduction(actor)));
    if (heal > 0) { actor.hp += heal; E({ kind: 'heal', subtype: 'crit-heal', target: actor.name, fired: true, consumed: true, amount: heal }); }
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

// A buff's value: a % of the CASTER's MAX HP (shields) resolves here; else a flat magnitude.
const buffValue = (actor, ef) => ef.pctOfCasterMaxHp != null ? Math.round(ef.pctOfCasterMaxHp * (actor.maxHp || 0)) : (ef.magnitude ?? null);

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
    const before = t.hp; t.hp = Math.min(t.maxHp, t.hp + amt * (1 - healReduction(t)));   // [Heal Reduction] on the recipient cuts the heal
    E({ kind: 'heal', target: t.name, fired: true, consumed: t.hp > before, amount: t.hp - before, note: t.hp > before ? undefined : 'overheal (target at full)' });
  }
}
// REVIVE dead allies at a % of their MAX HP (default 30%). Mirrors the engine's revive path + log entry.
function doRevive(state, actor, act, E) {
  const side = actor.side === 'ally' ? state.allies : state.enemies;
  for (const t of side.filter((c) => !c.alive)) {
    t.alive = true; t.hp = (act.effect?.hpPct ?? 0.30) * t.maxHp; t.turnMeter = 0;
    state.log.push({ turn: state.turn, phase: state.phase, event: 'revive', who: t.name, by: actor.name });
    E({ kind: 'revive', target: t.name, fired: true, consumed: true, amount: t.hp });
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
    if (debuffSlots(t) < minDebuffs) { E({ kind: 'activate', subtype: type, target: t.name, fired: true, consumed: false, note: `<${minDebuffs} debuffs` }); continue; }
    if (type !== 'Poison') { flag(state, `ACTIVATE_DEBUFF unsupported type '${type}': ${actor.name}`); continue; }
    const dealt = activatePoisons(state, t);
    E({ kind: 'activate', subtype: type, target: t.name, fired: true, consumed: dealt > 0, amount: dealt, note: dealt > 0 ? undefined : `no ${type} to activate` });
  }
}
// SELF_DAMAGE — the caster takes a FIXED % of its OWN max HP, bypassing DEF/shields, and it can be LETHAL
// (Renegade A3: "receive damage equal to 30% of MAX HP... even if it kills this Champion"). Applied straight to
// HP (not an attack — no mitigation, no reflect, no lifesteal); checkDeaths (post-action) flips .alive at hp≤0.
function doSelfDamage(state, actor, act, E) {
  const dmg = Math.round((act.effect?.pctOfCasterMaxHp ?? 0) * (actor.maxHp ?? 0));
  const before = actor.hp;
  actor.hp = Math.max(0, actor.hp - dmg);
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

// ── Sleeping Sage (Bambus) — debuff sponge + wake/dump ─────────────────────────
// While Bambus is asleep, a debuff landing on an ally transfers to him (75%, except a hard-CC list). At the
// start of his turn a start_of_turn trigger removes [Sleep] BEFORE the engine's CC-skip check (so he NEVER
// loses a turn) and dumps every debuff he holds onto the highest-RES enemy. Card-verified 2026-07-24.
const SPONGE_EXCLUDE = ['Block Revive', 'Stun', 'Freeze', 'Fear', 'True Fear', 'Provoke', 'Petrification', 'Sheep'];
// The living, asleep sponge owner (its passive recipe declares sponge:true), or null.
function spongeOwner(state) {
  return state.allies.find((a) => a.alive && (a.debuffs ?? []).some((d) => d.type === 'Sleep')
    && Object.values(RECIPES).some((r) => r.type === 'passive' && r.sponge && r.champion.split(' ')[0].toUpperCase() === String(a.name).split(' ')[0].toUpperCase())) || null;
}
// After a debuff lands on an ALLY, transfer it to an asleep sponge owner (75%) — not the excluded hard-CC, not
// the owner's own. Pure redirect (reads no magnitude, introduces no constant beyond the card's 75%). Called
// from BOTH placement paths: the recipe path (placeDebuffs) and the scripted boss (dragon.js, via the
// state.onAllyDebuffed hook installRecipeRun wires) — so the boss's Poison/Weaken/Decrease-Attack are sponged too.
export function maybeSponge(state, ally, type) {
  if (ally.side !== 'ally' || SPONGE_EXCLUDE.includes(type)) return;
  const bambus = spongeOwner(state);
  if (!bambus || bambus === ally || !ally.debuffs.some((d) => d.type === type)) return;
  if (!rollChance(state?.rng?.debuff, 0.75)) return;
  const moved = ally.debuffs.filter((d) => d.type === type);
  ally.debuffs = ally.debuffs.filter((d) => d.type !== type);
  for (const d of moved) upsert(bambus.debuffs, { type: d.type, value: d.value, pct: d.pct, turns: d.turnsLeft });
  recordEffect(state, { source: `${bambus.name} [P]`, kind: 'debuff', subtype: type, target: bambus.name, fired: true, consumed: true, note: 'sponged from ' + ally.name });
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
    upsert(tgt.debuffs, { type: d.type, value: d.value, pct: d.pct, turns: d.turnsLeft });
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
function placeDebuffs(state, actor, act, intended, E) {
  const ef = act.effect;
  for (const t of intended) {
    if (!t.alive) continue;
    if (t.immune?.includes(ef.type)) { E({ kind: 'debuff', subtype: ef.type, target: t.name, fired: true, consumed: false, note: 'immune' }); continue; }
    const chance = effectiveChance(ef, actor);
    if (chance != null && !rollChance(state?.rng?.debuff, chance)) {
      E({ kind: 'debuff', subtype: ef.type, target: t.name, fired: true, consumed: false, note: `missed placement (${Math.round(chance * 100)}%)` }); continue;
    }
    if (ef.accuracy_check && !isUnresistable(ef, t, actor)) {
      const p = landChance(effectiveAcc(actor), t.res);
      if (p == null) { flag(state, `UNKNOWN land chance: ${actor.name} ${ef.type}`); E({ kind: 'debuff', subtype: ef.type, target: t.name, fired: true, consumed: false, note: 'UNKNOWN land chance' }); continue; }
      if (!rollLand(state, p)) { E({ kind: 'debuff', subtype: ef.type, target: t.name, fired: true, consumed: false, note: `resisted (${Math.round(p * 100)}% land)` }); continue; }
    }
    // stacking (Poison): apply `count` copies; each upsert bumps stacks up to maxStacks.
    const copies = ef.count ?? 1;
    for (let i = 0; i < copies; i++) applyDebuff(t, { type: ef.type, value: ef.magnitude ?? null, pct: ef.pct ?? null, turns: ef.duration, stacking: ef.stacking, maxStacks: ef.maxStacks });
    E({ kind: 'debuff', subtype: ef.type, target: t.name, fired: true, consumed: t.debuffs.some((x) => x.type === ef.type) });
    maybeSponge(state, t, ef.type);   // Sleeping Sage: a debuff on an ally transfers to an asleep Bambus
  }
}

// PLACE_BUFF on the resolved recipients. Optional placement chance (e.g. Vergis A1 40%) off the debuff
// (proc) stream. `upsert` is the engine's own buff/debuff applier, so buffs behave identically to the old path.
function placeBuffs(state, actor, act, intended, E) {
  const ef = act.effect;
  for (const t of buffRecipients(state, actor, act.target, intended)) {
    if (ef.chance != null && !rollChance(state?.rng?.debuff, ef.chance)) {
      E({ kind: 'buff', subtype: ef.type, target: t.name, fired: true, consumed: false, note: `missed placement (${Math.round(ef.chance * 100)}%)` }); continue;
    }
    upsert(t.buffs, { type: ef.type, value: buffValue(actor, ef), turns: ef.duration });
    E({ kind: 'buff', subtype: ef.type, target: t.name, fired: true, consumed: t.buffs.some((x) => x.type === ef.type) });
  }
}

// ── enemy utility ops: turn meter · cooldowns · debuff transfer ─────────────────
// REDUCE_TURN_METER — drain a % of the target's turn meter (Lua A3 −100%). Meter is 0..100 in the engine.
function doReduceTurnMeter(state, actor, act, intended, E) {
  const pts = (act.effect?.pct ?? 0) * 100;
  for (const t of intended) {
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
// DECREASE_COOLDOWN — reduce own-side allies' cooldowns (Renegade A3, −2t, excluding self + same-skill dupes).
function doDecreaseCooldown(state, actor, act, E) {
  const own = (actor.side === 'ally' ? state.allies : state.enemies).filter((c) => c.alive);
  const turns = act.effect?.turns ?? 1;
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
function conditionMet(t, cond) {
  if (!cond) return true;
  if (cond.kind === 'under_debuff') return (t.debuffs ?? []).some((d) => d.type === cond.debuff);
  if (cond.kind === 'tm_depleted')  return (t.turnMeter ?? 0) <= 0;
  if (cond.kind === 'is_boss')      return t.role === 'boss';   // per-target boss branch (e.g. Bambus A3: Enfeeble on mobs, Decrease ATK on the boss instead)
  if (cond.kind === 'target_has_buffs') return (t.buffs ?? []).length > 0;   // Renegade A2: Decrease ACC only if the target has any active buff
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
};

export function fireTriggers(state, owner, eventName, ctx = {}) {
  const first = String(owner.name).split(' ')[0].toUpperCase();
  const passives = Object.values(RECIPES).filter((r) => r.type === 'passive' && r.triggers && r.champion.split(' ')[0].toUpperCase() === first);
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
export function passiveImmunities(ownerName) {
  const first = String(ownerName).split(' ')[0].split('#')[0].toUpperCase();
  const out = [];
  for (const r of Object.values(RECIPES)) if (r.type === 'passive' && r.immune && r.champion.split(' ')[0].toUpperCase() === first) out.push(...r.immune);
  return out;
}
export function installRecipeRun(state) {
  state.recipeAct = recipeDispatch;   // recipeFor(authored) || kitToRecipe(auto-parse) → applyRecipe (the ONE engine)
  state.onTurnStart = (s, actor) => { tickPassiveCooldowns(actor); fireTriggers(s, actor, 'start_of_turn'); };   // per TURN (the actor): tick passive cds, Bambus wake
  state.onRoundStart = (s) => { for (const a of s.allies) if (a.alive) fireTriggers(s, a, 'round_start'); };   // per ROUND (all allies): Ezio [Perfect Veil]
  state.onAllyDebuffed = (s, ally, type) => maybeSponge(s, ally, type);   // scripted boss (dragon.js) routes its ally-debuffs through the sponge
  state.onDamageTaken = (s, t, atk, hp) => fireDamageReactions(s, t, atk, hp);   // engine.applySkill + dragon.js boss → on-hit passives proc on EVERY path, not just recipe mobs

  for (const a of state.allies) {
    fireTriggers(state, a, 'round_start');                                    // round 1 = battle start
    const im = passiveImmunities(a.name); if (im.length) a.immune = [...new Set([...(a.immune || []), ...im])];   // passive immunities
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
    for (const t of ctx.intended) {
      if (F.maxHpPct != null) {                       // DEF-independent %-of-target-MAX-HP nuke (capped on stage 21+/Hard)
        if (t.alive) dealMaxHpDamage(state, t, F.maxHpPct, E, actor);
      } else {
        for (let h = 0; h < (F.hitCount ?? 1); h++) {
          if (F.randomTargetPerHit) {                 // "attacks N times at random": each hit re-picks a random living target
            const rt = pickRandomLiving(state, opponents);
            if (!rt) break;                            // no living target left
            ctx.results.push(dealOneHit(state, actor, rt, F, opponents, E));
            if (rt.hp <= 0) ctx.killedSomething = true;
          } else {
            if (!t.alive) break;                       // fixed-target multi-hit stops when the target dies
            ctx.results.push(dealOneHit(state, actor, t, F, opponents, E));
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
    applyWarmaster(state, actor, ctx.intended[0], opponents, E);   // once-per-skill mastery bonus on the primary target (no-op unless actor.bossMastery)
  },
  PLACE_DEBUFF(ctx, act) {
    const { state, actor, E } = ctx;
    const set = act.target === 'self' ? [actor] : ctx.intended;
    if (act.condition) {                              // conditional placement ("if the target is under [X]" / "if TM depleted")
      for (const t of set) if (!conditionMet(t, act.condition)) E({ kind: 'debuff', subtype: act.effect?.type, target: t.name, fired: true, consumed: false, note: 'condition not met' });
      placeDebuffs(state, actor, act, set.filter((t) => conditionMet(t, act.condition)), E);
    } else placeDebuffs(state, actor, act, set, E);
  },
  PLACE_BUFF(ctx, act)         { placeBuffs(ctx.state, ctx.actor, act, ctx.intended, ctx.E); },
  HEAL(ctx, act)               { doHeal(ctx.state, ctx.actor, act, ctx.E); },
  REVIVE(ctx, act)             { doRevive(ctx.state, ctx.actor, act, ctx.E); },
  SELF_DAMAGE(ctx, act)        { doSelfDamage(ctx.state, ctx.actor, act, ctx.E); },
  DEBUFF_ACTIVATION(ctx, act)  { doActivateDebuff(ctx.state, ctx.actor, act, ctx.intended, ctx.E); },
  STEAL_BUFF(ctx, act)         { doStealBuff(ctx.state, ctx.actor, act, ctx.intended, ctx.E); },
  REDUCE_TURN_METER(ctx, act)  { doReduceTurnMeter(ctx.state, ctx.actor, act, ctx.intended, ctx.E); },
  INCREASE_COOLDOWN(ctx, act)  { doIncreaseCooldown(ctx.state, ctx.actor, act, ctx.intended, ctx.E); },
  DECREASE_COOLDOWN(ctx, act)  { doDecreaseCooldown(ctx.state, ctx.actor, act, ctx.E); },
  TRANSFER_DEBUFF(ctx, act)    { doTransferDebuff(ctx.state, ctx.actor, act, ctx.intended, ctx.E); },
  EXTEND_EFFECT(ctx, act)      { doExtendEffect(ctx.state, ctx.actor, act, ctx.E); },
  REDUCE_EFFECT_DURATION(ctx, act) { ctx.buffsDecreased = doReduceEffectDuration(ctx.state, ctx.actor, act, ctx.intended, ctx.E); },
  BOOST_SHIELD(ctx, act)       { doBoostShield(ctx.state, ctx.actor, act, ctx.buffsDecreased ?? 0, ctx.E); },
  FILL_TURN_METER(ctx, act)    { doFillTurnMeter(ctx.state, ctx.actor, act, ctx.E); },
  CLEANSE(ctx, act)            { doCleanse(ctx.state, ctx.actor, act, ctx.E); },
  EXTRA_TURN(ctx, act)         { doExtraTurn(ctx.state, ctx.actor, act, ctx.E, ctx.killedSomething); },
};
// The authoritative list of executable ops — the UNION of both dispatch surfaces (active-recipe OP_HANDLERS +
// passive-trigger TRIGGER_OP_HANDLERS). Consumed by tools/model-ops-consistency.mjs to keep operations.js and
// the recipes' deferred[] notes honest.
export const IMPLEMENTED_OPS = [...new Set([...Object.keys(OP_HANDLERS), ...Object.keys(TRIGGER_OP_HANDLERS)])];

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
    const handler = OP_HANDLERS[act.op];
    if (handler) handler(ctx, act);
    else flag(state, `UNMODELLED recipe op '${act.op}': ${actor.name} ${recipe.slot} (interpreter)`);
  }
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
const RECIPE_CHAMPS = new Set(Object.values(RECIPES).map((r) => r.champion.split(' ')[0].toUpperCase()));
function isRecipeDriven(c) { return RECIPE_CHAMPS.has(String(c.name).split(' ')[0].split('#')[0].toUpperCase()); }
