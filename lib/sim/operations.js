// lib/sim/operations.js — the OPERATION REGISTRY (the design-doc vocabulary).
//
// Enumerates ALL primitive operations up front (so a validator knows what a COMPLETE skill can contain and
// an unknown op fails), while EXECUTION stays incremental (`implemented:false` ops are valid vocabulary the
// interpreter can't run yet — a recipe using one is "Review Required", not an error).
//
// Each op carries `validate(action, ctx)` → array of MISSING required params (empty = ok). This is pipeline
// step 3 ("validate required parameters by operation type"). ctx = { FORMULAS, CONDITIONS }.

const miss = (cond, name) => (cond ? [] : [name]);

export const OPERATIONS = {
  // ── implemented (interpreter can execute) ──
  ACQUIRE_TARGETS: { implemented: true, cat: 'targeting',
    validate: (a, ctx) => {
      const m = [];
      if (!a.target && !a.targetIf) m.push('target | targetIf');
      if (a.targetIf) {
        if (!a.targetIf.then || !a.targetIf.else) m.push('targetIf.then/else');
        if (!a.targetIf.conditionId) m.push('targetIf.conditionId');
        else if (ctx?.CONDITIONS && !ctx.CONDITIONS[a.targetIf.conditionId]) m.push(`condition:${a.targetIf.conditionId}`);
      }
      return m;
    } },
  DEAL_DAMAGE: { implemented: true, cat: 'damage',
    validate: (a, ctx) => {
      const m = miss(a.formulaId, 'formulaId');
      const F = ctx?.FORMULAS?.[a.formulaId];
      if (a.formulaId && !F) return [`formula:${a.formulaId}`];
      if (F) { if (F.multiplier == null && !(F.terms && F.terms.length)) m.push('formula.multiplier|terms');
               if (!F.scalingStat) m.push('formula.scalingStat'); if (F.hitCount == null) m.push('formula.hitCount'); }
      return m;
    } },
  PLACE_DEBUFF: { implemented: true, cat: 'debuff',
    validate: (a) => {
      const e = a.effect || {}; const m = [];
      if (!e.type) m.push('effect.type');
      if (e.duration == null) m.push('effect.duration');
      if (e.chance == null && e.guaranteed !== true) m.push('effect.chance | guaranteed');
      if (e.accuracy_check == null) m.push('effect.accuracy_check');   // ACC/RES behaviour must be stated
      if (!a.target) m.push('target (recipient)');
      return m;
    } },
  PLACE_BUFF: { implemented: true, cat: 'buff',
    validate: (a) => {
      const e = a.effect || {}; const m = [];
      if (!e.type) m.push('effect.type');
      if (e.duration == null) m.push('effect.duration');
      if (!a.target) m.push('target (recipient)');
      return m;
    } },

  // ── II-C state manipulation (implemented) ──
  // NOTE: SHIELD/TAUNT/ALLY-PROTECTION are granted via PLACE_BUFF (they are buffs); a shield's value uses
  // effect.pctOfCasterMaxHp. HEAL/REVIVE/STEAL_BUFF are their own operations.
  HEAL: { implemented: true, cat: 'state',
    validate: (a) => { const m = []; const e = a.effect || {}; if (e.pctOfCasterMaxHp == null && e.amount == null) m.push('effect.pctOfCasterMaxHp | amount'); if (!a.target) m.push('target (recipient)'); return m; } },
  REVIVE: { implemented: true, cat: 'state',
    validate: (a) => (a.effect?.hpPct == null ? ['effect.hpPct'] : []) },
  SELF_DAMAGE: { implemented: true, cat: 'state',   // caster takes a fixed % of its OWN max HP, can be lethal (Renegade A3)
    validate: (a) => (a.effect?.pctOfCasterMaxHp == null ? ['effect.pctOfCasterMaxHp'] : []) },
  DEBUFF_ACTIVATION: { implemented: true, cat: 'debuff',   // force existing enemy [Poison] to tick now + remove it (Ezio A2)
    validate: (a) => (a.effect?.type == null ? ['effect.type'] : []) },
  STEAL_BUFF: { implemented: true, cat: 'buff', validate: () => [] },   // acts on the acquired enemy set

  // ── registered vocabulary, execution NOT yet built (implemented:false) ──
  // A recipe may reference these; the validator marks such a skill "Review Required (unimplemented op)".
  REDUCE_TURN_METER: { implemented: true, cat: 'turn-meter', validate: (a) => (a.effect?.pct == null ? ['effect.pct'] : []) },
  INCREASE_COOLDOWN: { implemented: true, cat: 'cooldown', validate: () => [] },   // puts the target's skills on cooldown
  DECREASE_COOLDOWN: { implemented: true, cat: 'cooldown', validate: (a) => (a.effect?.turns == null ? ['effect.turns'] : []) },
  TRANSFER_DEBUFF:   { implemented: true, cat: 'debuff', validate: () => [] },     // caster -> target
  WAKE_FROM_SLEEP:   { implemented: true, cat: 'debuff', validate: () => [] },     // Bambus: remove self [Sleep] pre-CC + dump debuffs to highest-RES enemy
  // FILL_TURN_METER / EXTRA_TURN / CLEANSE were built in the two-engine merge (interpreter.OP_HANDLERS); the
  // flags here were stale (this rung — model-ops-consistency.mjs — now fails if they ever drift again).
  FILL_TURN_METER:   { implemented: true, cat: 'turn-meter', validate: (a) => (a.effect?.pct == null ? ['effect.pct'] : []) },   // beneficial own-side TM fill
  EXTRA_TURN:        { implemented: true, cat: 'turn', validate: () => [] },        // re-pick the same actor (onKill optional)
  CLEANSE:           { implemented: true, cat: 'debuff', validate: (a) => (!a.target ? ['target (recipient)'] : []) },   // remove debuffs from own-side recipients

  REMOVE_BUFF:          { implemented: false, cat: 'buff' },
  REMOVE_DEBUFF:        { implemented: false, cat: 'debuff' },
  DESTROY_MAX_HP:       { implemented: false, cat: 'state' },
  DAMAGE_SHIELD:        { implemented: false, cat: 'state' },
  STEAL_TURN_METER:     { implemented: false, cat: 'turn-meter' },
  RESET_COOLDOWN:       { implemented: false, cat: 'cooldown' },
  KILL:                 { implemented: false, cat: 'state' },
  ALLY_ATTACK:          { implemented: false, cat: 'trigger' },
  COUNTERATTACK:        { implemented: false, cat: 'trigger' },
  REDIRECT_DAMAGE:      { implemented: false, cat: 'mitigation' },
  SPREAD_DEBUFF:        { implemented: false, cat: 'debuff' },
  EXTEND_EFFECT: { implemented: true, cat: 'duration', validate: (a) => (a.effect?.turns == null ? ['effect.turns'] : []) },
  REDUCE_EFFECT_DURATION: { implemented: true, cat: 'duration', validate: (a) => (a.effect?.turns == null ? ['effect.turns'] : []) },   // decrease buff durations (Bambus A2)
  SWAP_HP:              { implemented: false, cat: 'state' },
  TRANSFORM:            { implemented: false, cat: 'exception' },
};

// Reusable modifiers (the doc's second list). Documented here as the registry's modifier vocabulary; each
// maps to where it lives on an action/formula. ✓ = wired, ○ = registered but not yet honoured.
export const MODIFIERS = {
  per_hit:               { where: 'action.repeat', status: '○' },
  per_target:            { where: 'action.repeat', status: '○' },
  once_per_skill:        { where: 'action.repeat = once', status: '✓' },
  conditional:           { where: 'action.targetIf / condition', status: '✓' },
  cannot_be_resisted:    { where: 'effect.unresistable', status: '✓' },
  cannot_be_blocked:     { where: 'effect.unblockable', status: '○' },
  ignores_def:           { where: 'formula.flags.ignore_def', status: '✓' },
  ignores_shield:        { where: 'formula.flags.ignore_shield', status: '○' },
  ignores_unkillable:    { where: 'formula.flags.ignore_unkillable', status: '○' },
  damage_capped:         { where: 'formula.flags.damage_cap', status: '○' },
  chance_booked:         { where: 'effect.chance (booked value)', status: '○' },
  duration_booked:       { where: 'effect.duration (booked value)', status: '○' },
  repeat_if_target_dies: { where: 'action.repeat_if', status: '○' },
  repeat_if_debuff_lands:{ where: 'action.repeat_if', status: '○' },
};

export const isImplemented = (op) => OPERATIONS[op]?.implemented === true;
export const knownOp = (op) => op in OPERATIONS;
// step-3 validate one action against its op's schema. Unknown op → flagged.
export function validateAction(action, ctx) {
  const spec = OPERATIONS[action.op];
  if (!spec) return { ok: false, missing: [`UNKNOWN op '${action.op}'`], implemented: false };
  const missing = spec.validate ? spec.validate(action, ctx) : [];
  return { ok: missing.length === 0, missing, implemented: spec.implemented };
}
