// lib/sim/interpreter.js — Phase II recipe INTERPRETER (Milestone 0, Step 3, damage scope).
//
// Reads a skill RECIPE (lib/sim/recipes.js) and executes its actions in `seq` order by calling the
// engine mechanics we already have and have reality-checked (dealDamage, crit/affinity/DEF math). This is
// the data-driven replacement for engine.applySkill's damage path — same numbers, sourced from data instead
// of a hard-coded function. RNG is untouched: the same seeded streams feed the same rolls; seed=null stays
// deterministic. SCOPE: ACQUIRE_TARGETS + DEAL_DAMAGE only. Unknown operations/operands FLAG, never guess.

import {
  dealDamage, effectiveScaleStat, critMult, defMitigation, effectiveDef, affinityFactor, dmgVariance,
  chooseSingleTarget, recordEffect, flag, landChance, rollChance, rollLand, applyDebuff, upsert,
} from './engine.js';
import { RECIPES, FORMULAS, CONDITIONS } from './recipes.js';

const alive = (arr) => arr.filter((c) => c.alive);
const shieldPool = (c) => c.buffs.reduce((s, b) => s + (/Shield/.test(b.type) ? Math.max(0, b.value || 0) : 0), 0);

// Look up the recipe for a combatant's chosen slot. Allies carry SHORT names (Bambus, Ezio, …); the recipe
// key is `<FIRSTNAME UPPER>-<SLOT>`. Returns null when no recipe exists (caller falls back to the old path).
export function recipeFor(actor, slot) {
  // strip a fixture position suffix ("Lua#3" → "Lua") so wave mobs resolve to their champion recipe
  const first = String(actor.name).split(' ')[0].split('#')[0].toUpperCase();
  return RECIPES[`${first}-${String(slot).toUpperCase()}`] ?? null;
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
// Base damage from the formula's components (attacker's own stat × multiplier, or a sum of terms).
function formulaBase(actor, F, target) {
  // effectiveScaleStat folds the attacker's OWN [Increase/Decrease ATK/DEF] into the scaling stat.
  let base = (F.terms && F.terms.length)
    ? F.terms.reduce((s, tm) => s + tm.coeff * effectiveScaleStat(actor, String(tm.stat).toLowerCase()), 0)
    : (F.multiplier ?? 0) * effectiveScaleStat(actor, String(F.scalingStat).toLowerCase());
  // Per-target-debuff ADDITIVE term: "(2 + Total Debuff) ATK" adds `coeff`×stat per debuff COUNT on the
  // TARGET (Arbalester A3 "Soulbreak", multiplier_type 'formula'). Additive to the base coefficient — a
  // DIFFERENT shape from the multiplicative dynamicScaler (Pelops A2). Reads from data → NO constant.
  if (F.perTargetDebuff) base += F.perTargetDebuff.coeff * (target?.debuffs?.length ?? 0) * effectiveScaleStat(actor, String(F.perTargetDebuff.stat).toLowerCase());
  return base;
}

// A DYNAMIC SCALER multiplies the hit by a battle-state-dependent factor described in DATA on the formula
// (not hardcoded per champion). v0 source: `debuff_turns` = the SUM of remaining turns across debuffs on the
// named side(s) — Pelops A2 "Gorgoa's Bane": +pctPer per debuff-turn on self & target, bonus capped at
// capBonus (0.4×HP × (1 + min(2.0, 0.10 × Σ turnsLeft))). Turn-WEIGHTED, not a debuff count. Unknown
// source/of → FLAG and ×1 (never a silent default). Reads magnitudes from data → NO constant.
function dynamicScaleFactor(state, F, actor, target) {
  const ds = F.dynamicScaler; if (!ds) return 1;
  const debuffTurns = (c) => (c?.debuffs ?? []).reduce((s, d) => s + (d.turnsLeft ?? 0), 0);
  let count = null;
  if (ds.source === 'debuff_turns') {
    if (ds.of === 'self_and_target') count = debuffTurns(actor) + debuffTurns(target);
    else if (ds.of === 'target') count = debuffTurns(target);
    else if (ds.of === 'self') count = debuffTurns(actor);
  }
  if (count == null) { flag(state, `UNKNOWN dynamicScaler '${ds.source}/${ds.of}': ${actor.name}`); return 1; }
  return 1 + Math.min(ds.capBonus ?? Infinity, (ds.pctPer ?? 0) * count);
}

// One hit against one target. Mirrors engine.applySkill's damage math exactly, but each multiplier is
// gated by a formula FLAG so a skill can turn any of them off. Returns a STRUCTURED resolution (the doc's
// "does the target take the hit?" object) and records the FIRED/CONSUMED ledger effect.
function dealOneHit(state, actor, t, F, opponents, E) {
  if (!t.alive) return { target: t.name, skipped: 'target already dead' };
  const fl = F.flags || {};
  const critM = fl.crit ? critMult(state, actor.critRate, actor.critDmg) : 1;
  const affM  = fl.affinity ? affinityFactor(actor.affinity, t.affinity) : 1;
  const varM  = fl.variance ? dmgVariance(state) : 1;
  // ignore_def (0..1) removes that fraction of the target's effective DEF for THIS hit before mitigation.
  const defForHit = effectiveDef(t) * (1 - (fl.ignore_def || 0));
  const defM  = fl.def_mitigation ? defMitigation(defForHit) : 1;

  let raw = formulaBase(actor, F, t) * dynamicScaleFactor(state, F, actor, t) * critM * defM * affM * varM;
  // INCOMING to one of our champions → run the passive damage MODIFIERS (Aid the Feeble, Pelops −20%, Ezio nullify)
  const incoming = actor.side === 'enemy' && t.side === 'ally';
  if (incoming) raw = incomingDamage(state, t, raw);
  const before = t.hp + shieldPool(t);
  const dd = dealDamage(t, raw, 'direct', actor, opponents, !!fl.ignore_shield);
  const dealt = before - (t.hp + shieldPool(t));
  E({ kind: 'damage', target: t.name, fired: true, consumed: dealt > 0, amount: dealt });
  if (dd.reflectBuffDmg > 0) E({ kind: 'reflect', subtype: 'Reflect Damage', target: actor.name, fired: true, consumed: true, amount: dd.reflectBuffDmg });
  // REACTIVE passives on the champion that was hit (Second Wind: shield on a big hit, heal below 50%)
  if (incoming) {
    fireTriggers(state, t, 'attacked', { attacker: actor });   // on-attacked (Pelops → [HP Burn] on the mob)
    if (dd.toHp > 0) fireTriggers(state, t, 'hit_taken', { hitAmount: dd.toHp, attacker: actor });
    if (t.alive && t.hp / (t.maxHp || 1) < 0.50) fireTriggers(state, t, 'hp_below', {});
  }
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

// ── II-C: state manipulation ───────────────────────────────────────────────────
// HEAL a set of recipients by a % of the caster's MAX HP (or a flat amount). Overheal at full HP is a
// benign non-consumption. Mirrors the engine's healPct path.
function doHeal(state, actor, act, E) {
  const amt = act.effect.pctOfCasterMaxHp != null ? act.effect.pctOfCasterMaxHp * (actor.maxHp || 0) : (act.effect.amount || 0);
  for (const t of buffRecipients(state, actor, act.target, [])) {
    const before = t.hp; t.hp = Math.min(t.maxHp, t.hp + amt);
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
// STEAL_BUFF — move every buff off each enemy target onto the caster (Ezio A3 / Pelops A2). The buffs LEAVE
// the enemy and land on the actor's side (that is what makes it a steal, not a strip).
function doStealBuff(state, actor, act, intended, E) {
  for (const t of intended) {
    const stolen = t.buffs.splice(0, t.buffs.length);
    for (const b of stolen) { upsert(actor.buffs, { type: b.type, value: b.value, turns: b.turnsLeft }); E({ kind: 'buff', subtype: b.type, target: actor.name, fired: true, consumed: true, note: 'stolen' }); }
    if (!stolen.length) E({ kind: 'steal', target: t.name, fired: true, consumed: false, note: 'no buffs to steal' });
  }
}

// PLACE_DEBUFF on each enemy in the intended set. The two-stage roll (design-doc "does the debuff land?"):
//   STAGE 1 — placement chance (the skill's stated %, e.g. 75%), off the DEBUFF stream.
//   STAGE 2 — ACC vs RES via landChance(actor.acc, target.res), unless `unresistable`.
// Immunity is a hard block. Everything records FIRED/CONSUMED with a documented reason when it doesn't land.
function placeDebuffs(state, actor, act, intended, E) {
  const ef = act.effect;
  for (const t of intended) {
    if (!t.alive) continue;
    if (t.immune?.includes(ef.type)) { E({ kind: 'debuff', subtype: ef.type, target: t.name, fired: true, consumed: false, note: 'immune' }); continue; }
    if (ef.chance != null && !rollChance(state?.rng?.debuff, ef.chance)) {
      E({ kind: 'debuff', subtype: ef.type, target: t.name, fired: true, consumed: false, note: `missed placement (${Math.round(ef.chance * 100)}%)` }); continue;
    }
    if (ef.accuracy_check && !ef.unresistable) {
      const p = landChance(actor.acc, t.res);
      if (p == null) { flag(state, `UNKNOWN land chance: ${actor.name} ${ef.type}`); E({ kind: 'debuff', subtype: ef.type, target: t.name, fired: true, consumed: false, note: 'UNKNOWN land chance' }); continue; }
      if (!rollLand(state, p)) { E({ kind: 'debuff', subtype: ef.type, target: t.name, fired: true, consumed: false, note: `resisted (${Math.round(p * 100)}% land)` }); continue; }
    }
    // stacking (Poison): apply `count` copies; each upsert bumps stacks up to maxStacks.
    const copies = ef.count ?? 1;
    for (let i = 0; i < copies; i++) applyDebuff(t, { type: ef.type, value: ef.magnitude ?? null, pct: ef.pct ?? null, turns: ef.duration, stacking: ef.stacking, maxStacks: ef.maxStacks });
    E({ kind: 'debuff', subtype: ef.type, target: t.name, fired: true, consumed: t.debuffs.some((x) => x.type === ef.type) });
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
  for (const t of intended) { const before = t.turnMeter; t.turnMeter = Math.max(0, t.turnMeter - pts); E({ kind: 'turn_meter', target: t.name, fired: true, consumed: t.turnMeter < before, amount: before - t.turnMeter }); }
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
    E({ kind: 'cooldown', subtype: 'decrease', target: t.name, fired: true, consumed: any });
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
    for (const act of trig.actions) {
      if (act.op === 'PLACE_BUFF') placeBuffs(state, owner, act, [], E);
      else if (act.op === 'PLACE_DEBUFF') placeDebuffs(state, owner, act, ctx.attacker ? [ctx.attacker] : [], E);
      else if (act.op === 'HEAL') doHeal(state, owner, act, E);
      else flag(state, `UNMODELLED trigger op '${act.op}': ${owner.name} passive`);
    }
  }
}

// A passive DAMAGE MODIFIER is not a placement — it is consulted when damage is about to land on a target,
// and reduces it (Aid the Feeble −10% to low allies, Pelops −20% team, Ezio 35%-nullify). Lives in a recipe's
// `modifiers` array (on a passive recipe, or on the active recipe whose [Passive Effect] it is, e.g. Pelops A3).
function modOperand(name, entity, amount, target, arg) {
  switch (name) {
    case 'hp_frac':           return entity.hp / (entity.maxHp || 1);
    case 'not_under_debuff':  return !entity.debuffs.some((d) => d.type === arg);
    case 'hit_frac_of_maxhp': return amount / (target.maxHp || 1);
    default:                  return undefined;
  }
}
// Apply every applicable incoming-damage modifier from the target's side. Returns the MODIFIED amount.
export function incomingDamage(state, target, amount) {
  const side = target.side === 'ally' ? state.allies : state.enemies;
  let factor = 1;
  for (const owner of side.filter((c) => c.alive)) {
    const first = String(owner.name).split(' ')[0].toUpperCase();
    const mods = Object.values(RECIPES).filter((r) => r.modifiers && r.champion.split(' ')[0].toUpperCase() === first).flatMap((r) => r.modifiers);
    for (const mod of mods) {
      if (mod.kind !== 'incoming_damage') continue;
      if (mod.scope === 'self' && owner !== target) continue;                 // self-only vs team-wide
      if (mod.when) {
        const entity = mod.when.on === 'owner' ? owner : target;
        const L = modOperand(mod.when.left, entity, amount, target, mod.when.arg);
        if (L === undefined) { flag(state, `UNKNOWN modifier operand '${mod.when.left}': ${owner.name}`); continue; }
        const ok = mod.when.cmp ? cmp(L, mod.when.cmp, mod.when.right) : Boolean(L);
        if (!ok) continue;
      }
      if (mod.chance != null && !rollChance(state?.rng?.damage, mod.chance)) continue;
      factor *= mod.factor;
    }
  }
  return amount * factor;
}

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
  state.recipeAct = (s, actor, skill) => { const r = recipeFor(actor, skill.slot); if (!r) return false; applyRecipe(s, actor, r); return true; };
  state.onTurnStart = (s, actor) => { fireTriggers(s, actor, 'round_start'); fireTriggers(s, actor, 'start_of_turn'); };
  for (const a of state.allies) {
    fireTriggers(state, a, 'round_start');                                    // round 1 = battle start
    const im = passiveImmunities(a.name); if (im.length) a.immune = [...new Set([...(a.immune || []), ...im])];   // passive immunities
  }
}

// ── the interpreter ────────────────────────────────────────────────────────────
/**
 * Execute one recipe for `actor`. Walks actions in `seq` order: ACQUIRE_TARGETS builds the intended set,
 * DEAL_DAMAGE resolves `hitCount` hits per target (stopping if a target dies mid-multi-hit). Side-aware via
 * `actor.side`, exactly like the engine. Returns the list of structured hit resolutions (for tests/tracing).
 */
export function applyRecipe(state, actor, recipe) {
  const E = (rec) => recordEffect(state, { source: actor.name, slot: recipe.slot, ...rec });
  const opponents = actor.side === 'ally' ? state.enemies : state.allies;
  const avoid = actor.side === 'ally' ? ['Unkillable', 'Block Damage'] : [];
  let intended = [];
  const results = [];
  for (const act of [...recipe.actions].sort((a, b) => a.seq - b.seq)) {
    if (act.op === 'ACQUIRE_TARGETS') {
      intended = acquireTargets(state, actor, act, opponents, avoid);
    } else if (act.op === 'DEAL_DAMAGE') {
      const F = FORMULAS[act.formulaId];
      if (!F) { flag(state, `UNKNOWN formula ${act.formulaId}: ${actor.name} ${recipe.slot}`); continue; }
      for (const t of intended) {
        for (let h = 0; h < (F.hitCount ?? 1); h++) {
          if (!t.alive) break;                        // multi-hit stops when the target dies
          results.push(dealOneHit(state, actor, t, F, opponents, E));
        }
      }
    } else if (act.op === 'PLACE_DEBUFF') {
      placeDebuffs(state, actor, act, intended, E);
    } else if (act.op === 'PLACE_BUFF') {
      placeBuffs(state, actor, act, intended, E);
    } else if (act.op === 'HEAL') {
      doHeal(state, actor, act, E);
    } else if (act.op === 'REVIVE') {
      doRevive(state, actor, act, E);
    } else if (act.op === 'STEAL_BUFF') {
      doStealBuff(state, actor, act, intended, E);
    } else if (act.op === 'REDUCE_TURN_METER') {
      doReduceTurnMeter(state, actor, act, intended, E);
    } else if (act.op === 'INCREASE_COOLDOWN') {
      doIncreaseCooldown(state, actor, act, intended, E);
    } else if (act.op === 'DECREASE_COOLDOWN') {
      doDecreaseCooldown(state, actor, act, E);
    } else if (act.op === 'TRANSFER_DEBUFF') {
      doTransferDebuff(state, actor, act, intended, E);
    } else if (act.op === 'EXTEND_EFFECT') {
      doExtendEffect(state, actor, act, E);
    } else {
      flag(state, `UNMODELLED recipe op '${act.op}': ${actor.name} ${recipe.slot} (interpreter)`);
    }
  }
  return results;
}
