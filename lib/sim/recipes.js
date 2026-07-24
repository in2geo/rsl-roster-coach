// lib/sim/recipes.js — Phase II executable skill recipes (Milestone 0 slice, DAMAGE scope only).
//
// A skill is DATA, not code: an ordered list of standard operations. The engine (Step 3, the interpreter)
// implements each operation once and walks these actions in `seq` order. Format spec:
// knowledge/PHASE_II_RECIPE_FORMAT.md. Verified source text: knowledge/PHASE_II_SLICE_SKILLS.md.
//
// DISCIPLINE: every value here is transcribed from the LIVE DB `champion_skills` (verified 2026-07-23),
// NOT from memory or the handoff. `scalingStat` comes from `multiplier_type` and is NOT always ATK.
// SCOPE: damage only. Buffs / debuffs / shields / heals / self-Sleep / passives are DEFERRED (listed per
// skill) and land in later milestones — they are NOT silently dropped, they are named.
//
// Normalized like the design doc's tables: CONDITIONS + FORMULAS are separate maps referenced by id, so
// this mirrors the eventual workbook/DB shape rather than one wide row.

// ── CONDITIONS ────────────────────────────────────────────────────────────────
// Structured, not prose. Evaluated against the SELECTED single target unless noted.
export const CONDITIONS = {
  // Bambus A1: "Will attack all enemies instead if the initial target is under 2 or more debuffs."
  C_BAMBUS_AOE: { left: 'target_debuff_count', comparator: '>=', right: 2 },
};

// ── FORMULAS ──────────────────────────────────────────────────────────────────
// Damage components. Required: scalingStat + (multiplier OR terms) + hitCount. `flags` toggles the
// resolution multipliers; defaults match the format spec (crit/affinity/def_mitigation on, variance off).
const DMG_FLAGS = { crit: true, affinity: true, def_mitigation: true, variance: false, ignore_def: 0, damage_cap: false };
export const FORMULAS = {
  // Bambus A1 Bamboo Splinter — damage_multiplier "3.8", multiplier_type "ATK"
  F_BAMBUS_A1: { scalingStat: 'ATK', multiplier: 3.8, terms: null, flags: { ...DMG_FLAGS }, hitCount: 1 },
  // Bambus A2 Grovetender — damage_multiplier "5.6", multiplier_type "ATK"
  F_BAMBUS_A2: { scalingStat: 'ATK', multiplier: 5.6, terms: null, flags: { ...DMG_FLAGS }, hitCount: 1 },

  // Ezio Auditore — all ATK
  F_EZIO_A1: { scalingStat: 'ATK', multiplier: 4, terms: null, flags: { ...DMG_FLAGS }, hitCount: 1 },
  F_EZIO_A2: { scalingStat: 'ATK', multiplier: 4, terms: null, flags: { ...DMG_FLAGS }, hitCount: 1 },
  // A3 "will ignore 35% of the target's DEF" — a fixed ignore-DEF flag on the hit.
  F_EZIO_A3: { scalingStat: 'ATK', multiplier: 5, terms: null, flags: { ...DMG_FLAGS, ignore_def: 0.35 }, hitCount: 1 },

  // Pelops the Victor — scales off HP (multiplier_type "HP")
  F_PELOPS_A1: { scalingStat: 'HP', multiplier: 0.25, terms: null, flags: { ...DMG_FLAGS }, hitCount: 1 },
  // A2 base only; its conditional ignore-DEF and the +10%/debuff-turn scaler are DAMAGE-affecting and DEFERRED (see skill).
  F_PELOPS_A2: { scalingStat: 'HP', multiplier: 0.4, terms: null, flags: { ...DMG_FLAGS }, hitCount: 1 },

  // Tagoar — ATK. A1 hits the same target TWICE.
  F_TAGOAR_A1: { scalingStat: 'ATK', multiplier: 1.8, terms: null, flags: { ...DMG_FLAGS }, hitCount: 2 },
  F_TAGOAR_A2: { scalingStat: 'ATK', multiplier: 3.7, terms: null, flags: { ...DMG_FLAGS }, hitCount: 1 },

  // Vergis A1 — scales off DEF (multiplier_type "DEF")
  F_VERGIS_A1: { scalingStat: 'DEF', multiplier: 3.9, terms: null, flags: { ...DMG_FLAGS }, hitCount: 1 },

  // ── WAVE MOBS (Dragon-16 waves; all ATK unless noted) ──
  F_LUA_A1: { scalingStat: 'ATK', multiplier: 2.7, terms: null, flags: { ...DMG_FLAGS }, hitCount: 1 },
  F_LUA_A2: { scalingStat: 'ATK', multiplier: 1.4, terms: null, flags: { ...DMG_FLAGS }, hitCount: 3 },   // AoE ×3
  F_LUA_A3: { scalingStat: 'ATK', multiplier: 6, terms: null, flags: { ...DMG_FLAGS }, hitCount: 1 },
  F_FACELESS_A1: { scalingStat: 'ATK', multiplier: 3, terms: null, flags: { ...DMG_FLAGS }, hitCount: 1 },
  F_FACELESS_A2: { scalingStat: 'ATK', multiplier: 5.5, terms: null, flags: { ...DMG_FLAGS }, hitCount: 1 },
  F_FACELESS_A3: { scalingStat: 'ATK', multiplier: 3, terms: null, flags: { ...DMG_FLAGS, ignore_def: 1.0 }, hitCount: 1 },   // "as well as DEF"
  F_ARBALESTER_A1: { scalingStat: 'ATK', multiplier: 3.3, terms: null, flags: { ...DMG_FLAGS }, hitCount: 1 },
  F_ARBALESTER_A2: { scalingStat: 'ATK', multiplier: 5.8, terms: null, flags: { ...DMG_FLAGS }, hitCount: 1 },
  // "(2 + Total Debuff) ATK" — static base 2×ATK modelled; +1×ATK per debuff on target is the dynamic part (deferred).
  F_ARBALESTER_A3: { scalingStat: 'ATK', multiplier: null, terms: [{ coeff: 2, stat: 'atk' }], flags: { ...DMG_FLAGS }, hitCount: 1 },
  // "1.2 ATK + SPD" — genuine multi-term (both stats sum).
  F_RENEGADE_A1: { scalingStat: 'ATK', multiplier: null, terms: [{ coeff: 1.2, stat: 'atk' }, { coeff: 1, stat: 'spd' }], flags: { ...DMG_FLAGS }, hitCount: 1 },
  F_RENEGADE_A2: { scalingStat: 'ATK', multiplier: 1.8, terms: null, flags: { ...DMG_FLAGS }, hitCount: 3 },   // "at random 3 times"
};

// ── SKILLS ────────────────────────────────────────────────────────────────────
// Keyed `<CHAMPION>-<SLOT>`. `actions` run in `seq` order. `target`/`targetIf` name a RECIPIENT
// (spec §2). `deferred` lists every non-damage clause in the real card so the holes stay visible.
export const RECIPES = {
  // ── BAMBUS (DB name "Bambus"; alias "Bambus Fourleaf"), Magic ──────────────────
  // A1 — Bamboo Splinter (3.8 ATK, no cooldown). The conditional-AoE pilot.
  'BAMBUS-A1': {
    champion: 'Bambus', slot: 'A1', name: 'Bamboo Splinter', type: 'active', cooldown: 0,
    actions: [
      // Pick the single target by the normal rule, then flip to all-enemies if it has >=2 debuffs.
      { seq: 10, phase: 'skill_start', op: 'ACQUIRE_TARGETS', repeat: 'once',
        targetIf: { conditionId: 'C_BAMBUS_AOE', then: 'all_enemies', else: 'single' } },
      { seq: 20, phase: 'per_target', op: 'DEAL_DAMAGE', target: 'current_target', repeat: 'once',
        formulaId: 'F_BAMBUS_A1' },
      { seq: 30, phase: 'after_hit', op: 'PLACE_DEBUFF', target: 'intended_set', repeat: 'per_target',
        effect: { type: 'Decrease Speed', magnitude: 30, duration: 2, chance: 0.75, accuracy_check: true } },
    ],
    deferred: [
      'self [Sleep] 1t, cannot be blocked/resisted (II-D — feeds the Sleeping Sage debuff-sponge passive)',
    ],
  },

  // A2 — Grovetender (5.6 ATK, cd 4). Always-AoE support nuke.
  'BAMBUS-A2': {
    champion: 'Bambus', slot: 'A2', name: 'Grovetender', type: 'active', cooldown: 4,
    actions: [
      { seq: 5, phase: 'before_attack', op: 'PLACE_BUFF', target: 'all_allies', repeat: 'once',
        effect: { type: 'Shield', pctOfCasterMaxHp: 0.30, duration: 2 } },
      { seq: 6, phase: 'before_attack', op: 'EXTEND_EFFECT', target: 'all_allies', repeat: 'once', effect: { turns: 1 } },
      { seq: 10, phase: 'skill_start', op: 'ACQUIRE_TARGETS', repeat: 'once', target: 'all_enemies' },
      { seq: 20, phase: 'per_target', op: 'DEAL_DAMAGE', target: 'current_target', repeat: 'once',
        formulaId: 'F_BAMBUS_A2' },
    ],
    deferred: [
      'after attacking: 75% decrease all enemy buff durations by 1t — REDUCE_EFFECT_DURATION (II-C, op not built)',
      'after: +3% to ally [Shield] value per enemy buff decreased (II-C)',
      'self [Sleep] 1t, cannot be blocked/resisted (II-D)',
    ],
  },

  // A3 — Dream Sight (cd 4): no damage — team buffs + enemy debuffs (II-B).
  'BAMBUS-A3': {
    champion: 'Bambus', slot: 'A3', name: 'Dream Sight', type: 'active', cooldown: 4,
    actions: [
      { seq: 10, phase: 'skill_start', op: 'ACQUIRE_TARGETS', repeat: 'once', target: 'all_enemies' },
      { seq: 20, phase: 'skill_start', op: 'PLACE_BUFF', target: 'all_allies', repeat: 'once', effect: { type: 'Increase ACC', magnitude: 50, duration: 2 } },
      { seq: 30, phase: 'skill_start', op: 'PLACE_BUFF', target: 'all_allies', repeat: 'once', effect: { type: 'Increase ATK', magnitude: 50, duration: 2 } },
      { seq: 40, phase: 'after_skill', op: 'PLACE_DEBUFF', target: 'intended_set', repeat: 'per_target', effect: { type: 'Enfeeble', duration: 2, chance: 0.75, accuracy_check: true } },
      { seq: 50, phase: 'after_skill', op: 'PLACE_DEBUFF', target: 'intended_set', repeat: 'per_target', effect: { type: 'Decrease ACC', magnitude: 50, duration: 2, chance: 0.75, accuracy_check: true } },
    ],
    deferred: [
      '[Enfeeble] cannot be placed on Bosses; 50% [Decrease ATK] on Bosses instead — conditional per-target branch (II-D)',
      'self [Sleep] 1t, unresistable (II-D)',
    ],
  },
  // Passive — Sleeping Sage: debuff-sponge + redirect identity → II-D/E, not damage.

  // ── EZIO (DB "Ezio Auditore"), Spirit ──────────────────────────────────────────
  // A1 — Eagle Dive (4 ATK, no cd). Single target.
  'EZIO-A1': {
    champion: 'Ezio Auditore', slot: 'A1', name: 'Eagle Dive', type: 'active', cooldown: 0,
    actions: [
      { seq: 10, phase: 'skill_start', op: 'ACQUIRE_TARGETS', repeat: 'once', target: 'single' },
      { seq: 20, phase: 'per_target', op: 'DEAL_DAMAGE', target: 'current_target', repeat: 'once', formulaId: 'F_EZIO_A1' },
      { seq: 30, phase: 'after_hit', op: 'PLACE_DEBUFF', target: 'intended_set', repeat: 'per_target',
        effect: { type: 'Decrease Defense', magnitude: 60, duration: 2, chance: 0.75, accuracy_check: true } },
    ],
    deferred: ['unresistable while under [Veil]/[Perfect Veil] — conditional, coupled to the veil passive (II-D)'],
  },
  // A2 — Da Vinci's Design (4 ATK, cd 4). The AoE opener (Phase I: Ezio opens with A2).
  'EZIO-A2': {
    champion: 'Ezio Auditore', slot: 'A2', name: "Da Vinci's Design", type: 'active', cooldown: 4,
    actions: [
      { seq: 10, phase: 'skill_start', op: 'ACQUIRE_TARGETS', repeat: 'once', target: 'all_enemies' },
      { seq: 20, phase: 'per_target', op: 'DEAL_DAMAGE', target: 'current_target', repeat: 'once', formulaId: 'F_EZIO_A2' },
      // two 5% [Poison] (stacks) + one 25% [Poison Sensitivity], all @75%, on every enemy hit
      { seq: 30, phase: 'after_hit', op: 'PLACE_DEBUFF', target: 'intended_set', repeat: 'per_target',
        effect: { type: 'Poison', pct: 0.05, count: 2, duration: 2, chance: 0.75, accuracy_check: true, stacking: true, maxStacks: 10 } },
      { seq: 40, phase: 'after_hit', op: 'PLACE_DEBUFF', target: 'intended_set', repeat: 'per_target',
        effect: { type: 'Poison Sensitivity', magnitude: 25, duration: 2, chance: 0.75, accuracy_check: true } },
    ],
    deferred: [
      'unresistable under [Veil] or [Perfect Veil] — conditional, coupled to the veil passive (II-D)',
      'instantly activate all [Poison] on enemies under 4+ debuffs (II-D)',
      '[Stone Skin]→[Bomb] branch (II-E named exception)',
      '[Poison Sensitivity] amplifies DoT — placed here, CONSUMER not yet built (II-A DoT layer)',
    ],
  },
  // A3 — Hidden Gun (5 ATK, cd 4). Single target, ignores 35% DEF.
  'EZIO-A3': {
    champion: 'Ezio Auditore', slot: 'A3', name: 'Hidden Gun', type: 'active', cooldown: 4,
    actions: [
      { seq: 10, phase: 'skill_start', op: 'ACQUIRE_TARGETS', repeat: 'once', target: 'single' },
      { seq: 15, phase: 'before_attack', op: 'STEAL_BUFF', target: 'intended_set', repeat: 'once' },
      { seq: 20, phase: 'per_target', op: 'DEAL_DAMAGE', target: 'current_target', repeat: 'once', formulaId: 'F_EZIO_A3' },
    ],
    deferred: ['buff-steal unresistable under [Veil]/[Perfect Veil] — conditional (II-D)', 'also ignores [Shield]/[Strengthen] buffs (II-A later: ignore_shield flag)'],
  },
  // Passive — Everything Is Permitted (2 ATK, execute bonus below 25% HP, ignore 100% DEF, no crit) → II-D trigger.
  // Passive 2 — Full Synchronization: the 35%-nullify is a self incoming-damage MODIFIER; veil + counter are event triggers (deferred).
  'EZIO-PASSIVE2': {
    champion: 'Ezio Auditore', slot: 'PASSIVE2', name: 'Full Synchronization', type: 'passive',
    // "…has a 35% chance of decreasing the damage received to 0 whenever this Champion is about to receive damage that would exceed 50% of their MAX HP"
    modifiers: [
      { kind: 'incoming_damage', scope: 'self', chance: 0.35, when: { on: 'hit', left: 'hit_frac_of_maxhp', cmp: '>', right: 0.50 }, factor: 0 },
    ],
    deferred: [
      '[Perfect Veil] on self at the start of each Round — event trigger (II-D)',
      '35% counterattack when attacked — event trigger (II-D)',
    ],
  },

  // ── PELOPS (DB "Pelops the Victor"), Spirit — scales off HP ─────────────────────
  // A1 — Triumphant Blow (0.25 HP, no cd). Single target.
  'PELOPS-A1': {
    champion: 'Pelops the Victor', slot: 'A1', name: 'Triumphant Blow', type: 'active', cooldown: 0,
    actions: [
      { seq: 10, phase: 'skill_start', op: 'ACQUIRE_TARGETS', repeat: 'once', target: 'single' },
      { seq: 20, phase: 'per_target', op: 'DEAL_DAMAGE', target: 'current_target', repeat: 'once', formulaId: 'F_PELOPS_A1' },
      { seq: 30, phase: 'after_hit', op: 'PLACE_DEBUFF', target: 'intended_set', repeat: 'per_target',
        effect: { type: 'Decrease Attack', magnitude: 50, duration: 2, chance: 0.75, accuracy_check: true } },
    ],
    deferred: ['unresistable/unblockable if target under [HP Burn] — conditional, HP Burn from his passive (II-D)'],
  },
  // A2 — Gorgoa's Bane (0.4 HP, cd 4). Single target; base damage only for now.
  'PELOPS-A2': {
    champion: 'Pelops the Victor', slot: 'A2', name: "Gorgoa's Bane", type: 'active', cooldown: 4,
    actions: [
      { seq: 10, phase: 'skill_start', op: 'ACQUIRE_TARGETS', repeat: 'once', target: 'single' },
      { seq: 20, phase: 'per_target', op: 'DEAL_DAMAGE', target: 'current_target', repeat: 'once', formulaId: 'F_PELOPS_A2' },
    ],
    deferred: [
      'DAMAGE-AFFECTING: ignore 50% DEF if target under [HP Burn] (II-A later, conditional flag)',
      'DAMAGE-AFFECTING: +10% dmg per turn remaining on debuffs on self & target, ≤200% (II-A later, dynamic scaler)',
      'if dmg < 50% target MAX HP: steal all buffs + [Stun] 2t (II-C)',
    ],
  },
  // A3 — Victor's Bounty (cd 4): no damage — Increase ATK (II-B); the survival keystone parts are II-C/D.
  'PELOPS-A3': {
    champion: 'Pelops the Victor', slot: 'A3', name: "Victor's Bounty", type: 'active', cooldown: 4,
    actions: [
      { seq: 10, phase: 'skill_start', op: 'PLACE_BUFF', target: 'all_allies', repeat: 'once', effect: { type: 'Increase ATK', magnitude: 50, duration: 2 } },
      { seq: 20, phase: 'skill_start', op: 'PLACE_BUFF', target: 'all_allies', repeat: 'once', effect: { type: 'Magma Shield', pctOfCasterMaxHp: 0.30, duration: 2 } },
      { seq: 30, phase: 'skill_start', op: 'PLACE_BUFF', target: 'self', repeat: 'once', effect: { type: 'Taunt', duration: 2 } },
    ],
    // [Passive Effect] — a continuous team damage reduction, active while Pelops is NOT under [Decrease DEF].
    modifiers: [
      { kind: 'incoming_damage', scope: 'allies', when: { on: 'owner', left: 'not_under_debuff', arg: 'Decrease Defense' }, factor: 0.80 },
    ],
    deferred: [
      'one-copy-only / not on dead duplicate (II-E)',
    ],
  },
  // Passive — Master of Games: on-attacked → [HP Burn] on the attacker (the wave-kill engine).
  'PELOPS-PASSIVE': {
    champion: 'Pelops the Victor', slot: 'PASSIVE', name: 'Master of Games', type: 'passive',
    triggers: [
      { on: 'attacked', actions: [{ op: 'PLACE_DEBUFF', target: 'attacker', effect: { type: 'HP Burn', duration: 2, chance: 1.0, accuracy_check: false } }] },
    ],
    deferred: ['immune to [Stun]/[HP Burn]/[Petrification]', '50% [Petrification] on attacker', 'chances drop to 50%/25% while under [Decrease DEF]'],
  },

  // ── TAGOAR (DB "Tagoar"), Magic ────────────────────────────────────────────────
  // A1 — Da Magic Stick (1.8 ATK ×2 hits, no cd). Single target, hit twice.
  'TAGOAR-A1': {
    champion: 'Tagoar', slot: 'A1', name: 'Da Magic Stick', type: 'active', cooldown: 0,
    actions: [
      { seq: 10, phase: 'skill_start', op: 'ACQUIRE_TARGETS', repeat: 'once', target: 'single' },
      { seq: 20, phase: 'per_target', op: 'DEAL_DAMAGE', target: 'current_target', repeat: 'once', formulaId: 'F_TAGOAR_A1' },
      { seq: 30, phase: 'after_skill', op: 'PLACE_BUFF', target: 'lowest_hp_ally', repeat: 'once',
        effect: { type: 'Increase DEF', magnitude: 60, duration: 2 } },
    ],
    deferred: ['[Increase DEF] buff placed; stat-effect CONSUMER not yet built (needs a buff→stat layer)'],
  },
  // A2 — Charge Cant (3.7 ATK, cd 5). AoE.
  'TAGOAR-A2': {
    champion: 'Tagoar', slot: 'A2', name: 'Charge Cant', type: 'active', cooldown: 5,
    actions: [
      { seq: 10, phase: 'skill_start', op: 'ACQUIRE_TARGETS', repeat: 'once', target: 'all_enemies' },
      { seq: 20, phase: 'per_target', op: 'DEAL_DAMAGE', target: 'current_target', repeat: 'once', formulaId: 'F_TAGOAR_A2' },
      { seq: 30, phase: 'after_skill', op: 'PLACE_BUFF', target: 'all_allies', repeat: 'once',
        effect: { type: 'Increase SPD', magnitude: 30, duration: 2 } },
      { seq: 40, phase: 'after_skill', op: 'HEAL', target: 'all_allies', repeat: 'once',
        effect: { pctOfCasterMaxHp: 0.15 } },
    ],
    deferred: ['[Increase SPD] buff placed; stat-effect CONSUMER not yet built'],
  },
  // A3 — Rise And Fight (cd 7): no damage, no II-B — all II-C. Recipe exists for accounting; nothing executes yet.
  'TAGOAR-A3': {
    champion: 'Tagoar', slot: 'A3', name: 'Rise And Fight', type: 'active', cooldown: 7,
    actions: [
      { seq: 10, phase: 'skill_start', op: 'REVIVE', target: 'all_dead_allies', repeat: 'once', effect: { hpPct: 0.30 } },
      { seq: 20, phase: 'after_skill', op: 'PLACE_BUFF', target: 'all_allies', repeat: 'once', effect: { type: 'Shield', pctOfCasterMaxHp: 0.20, duration: 2 } },
    ],
    deferred: [],
  },
  // A4 — Aid the Feeble [P]: a continuous incoming-damage MODIFIER (−10% to allies at ≤50% HP).
  'TAGOAR-A4': {
    champion: 'Tagoar', slot: 'A4', name: 'Aid the Feeble', type: 'passive',
    modifiers: [
      { kind: 'incoming_damage', scope: 'allies', when: { on: 'target', left: 'hp_frac', cmp: '<=', right: 0.50 }, factor: 0.90 },
    ],
  },

  // ── VERGIS (DB "Vergis"), Spirit — A1 scales off DEF ───────────────────────────
  // A1 — Pierce (3.9 DEF, cd 0). Single target.
  'VERGIS-A1': {
    champion: 'Vergis', slot: 'A1', name: 'Pierce', type: 'active', cooldown: 0,
    actions: [
      { seq: 10, phase: 'skill_start', op: 'ACQUIRE_TARGETS', repeat: 'once', target: 'single' },
      { seq: 20, phase: 'per_target', op: 'DEAL_DAMAGE', target: 'current_target', repeat: 'once', formulaId: 'F_VERGIS_A1' },
      { seq: 30, phase: 'after_skill', op: 'PLACE_BUFF', target: 'random_ally', repeat: 'once',
        effect: { type: 'Reflect Damage', magnitude: 30, duration: 2, chance: 0.40 } },
    ],
    deferred: ['[Reflect Damage] buff placed; its reflect EFFECT consumer is II-D'],
  },
  // A2 — Aegis (cd 4): no damage — Increase DEF (self) is clean II-B; the target-ally buffs + Ally Protection are II-C/D.
  'VERGIS-A2': {
    champion: 'Vergis', slot: 'A2', name: 'Aegis', type: 'active', cooldown: 4,
    actions: [
      { seq: 10, phase: 'skill_start', op: 'PLACE_BUFF', target: 'self', repeat: 'once', effect: { type: 'Increase DEF', magnitude: 60, duration: 2 } },
      { seq: 20, phase: 'skill_start', op: 'PLACE_BUFF', target: 'all_allies_except_self', repeat: 'once', effect: { type: 'Ally Protection', magnitude: 50, duration: 2 } },
      // "a target ally" resolved to the lowest-HP ally (auto approximation of the single-ally target)
      { seq: 30, phase: 'skill_start', op: 'PLACE_BUFF', target: 'lowest_hp_ally', repeat: 'once', effect: { type: 'Continuous Heal', magnitude: 15, duration: 3 } },
    ],
    deferred: [
      '30% [Increase SPD] 3t + 30% [Reflect Damage] 3t on the same target ally (recipient = lowest-HP approx)',
    ],
  },
  // Passive — Second Wind (cd 3): REACTIVE. A passive is not cast — it subscribes to EVENTS and fires a
  // response when its condition holds. `triggers[].on` = the event; `when` = the card's condition; `actions`
  // = the response (run through the same interpreter ops). See interpreter.fireTriggers.
  'VERGIS-PASSIVE': {
    champion: 'Vergis', slot: 'PASSIVE', name: 'Second Wind', type: 'passive',
    triggers: [
      // "…places a [Shield] = 10% of MAX HP for 2t whenever this Champion loses 10%+ of MAX HP from a single hit"
      { on: 'hit_taken', when: { left: 'hit_frac_of_maxhp', cmp: '>=', right: 0.10 },
        actions: [{ op: 'PLACE_BUFF', target: 'self', effect: { type: 'Shield', pctOfCasterMaxHp: 0.10, duration: 2 } }] },
      // "…places a 15% [Continuous Heal] for 2t every time their HP drops below 50%"
      { on: 'hp_below', when: { left: 'hp_frac', cmp: '<', right: 0.50 },
        actions: [{ op: 'PLACE_BUFF', target: 'self', effect: { type: 'Continuous Heal', magnitude: 15, duration: 2 } }] },
    ],
    deferred: ['cooldown 3 — which effect it gates (II-D refinement)'],
  },

  // ══ WAVE MOBS ══ enemies; their recipes target OUR team. 'single' = our lowest-HP ally, 'all_enemies' =
  // all our allies (the interpreter resolves side from actor.side). Damage-scope; utility clauses deferred.
  'LUA-A1': {
    champion: 'Lua', slot: 'A1', name: 'Splinter Arrow', type: 'active', cooldown: 0,
    actions: [
      { seq: 10, phase: 'skill_start', op: 'ACQUIRE_TARGETS', repeat: 'once', target: 'single' },
      { seq: 20, phase: 'per_target', op: 'DEAL_DAMAGE', target: 'current_target', repeat: 'once', formulaId: 'F_LUA_A1' },
    ],
    deferred: ['on crit: deal 50% of the damage to ALL enemies (crit-conditional AoE splash) (II-A later)'],
  },
  'LUA-A2': {
    champion: 'Lua', slot: 'A2', name: 'Hail of Arrows', type: 'active', cooldown: 4,
    actions: [
      { seq: 10, phase: 'skill_start', op: 'ACQUIRE_TARGETS', repeat: 'once', target: 'all_enemies' },
      { seq: 20, phase: 'per_target', op: 'DEAL_DAMAGE', target: 'current_target', repeat: 'once', formulaId: 'F_LUA_A2' },
    ],
    deferred: ['each crit heals Lua by 2.5% of her HP (lifesteal-on-crit) (II-C/D)'],
  },
  'LUA-A3': {
    champion: 'Lua', slot: 'A3', name: 'Lucky Shot', type: 'active', cooldown: 5,
    actions: [
      { seq: 10, phase: 'skill_start', op: 'ACQUIRE_TARGETS', repeat: 'once', target: 'single' },
      { seq: 20, phase: 'per_target', op: 'DEAL_DAMAGE', target: 'current_target', repeat: 'once', formulaId: 'F_LUA_A3' },
      { seq: 30, phase: 'after_hit', op: 'REDUCE_TURN_METER', target: 'intended_set', repeat: 'once', effect: { pct: 1.0 } },
    ],
    deferred: ['ignores [Shield]/[Block Damage] buffs'],
  },
  'FACELESS-A1': {
    champion: 'Faceless', slot: 'A1', name: 'Fireball', type: 'active', cooldown: 0,
    actions: [
      { seq: 10, phase: 'skill_start', op: 'ACQUIRE_TARGETS', repeat: 'once', target: 'single' },
      { seq: 20, phase: 'per_target', op: 'DEAL_DAMAGE', target: 'current_target', repeat: 'once', formulaId: 'F_FACELESS_A1' },
    ],
    deferred: ['15% chance of an extra hit — repeat-if modifier (not built)'],
  },
  'FACELESS-A2': {
    champion: 'Faceless', slot: 'A2', name: 'Lightning', type: 'active', cooldown: 3,
    actions: [
      { seq: 10, phase: 'skill_start', op: 'ACQUIRE_TARGETS', repeat: 'once', target: 'single' },
      { seq: 20, phase: 'per_target', op: 'DEAL_DAMAGE', target: 'current_target', repeat: 'once', formulaId: 'F_FACELESS_A2' },
    ],
    deferred: ['before attacking: 30% [Increase C. RATE] on self 2t (II-B)'],
  },
  'FACELESS-A3': {
    champion: 'Faceless', slot: 'A3', name: 'Ice Bolt', type: 'active', cooldown: 3,
    actions: [
      { seq: 10, phase: 'skill_start', op: 'ACQUIRE_TARGETS', repeat: 'once', target: 'single' },
      { seq: 20, phase: 'per_target', op: 'DEAL_DAMAGE', target: 'current_target', repeat: 'once', formulaId: 'F_FACELESS_A3' },
    ],
    deferred: ['ignores [Shield]/[Block Damage] buffs (DEF ignore IS modelled via ignore_def)'],
  },
  'ARBALESTER-A1': {
    champion: 'Arbalester', slot: 'A1', name: 'Spread Misery', type: 'active', cooldown: 0,
    actions: [
      { seq: 10, phase: 'skill_start', op: 'ACQUIRE_TARGETS', repeat: 'once', target: 'single' },
      { seq: 20, phase: 'per_target', op: 'DEAL_DAMAGE', target: 'current_target', repeat: 'once', formulaId: 'F_ARBALESTER_A1' },
      { seq: 30, phase: 'after_hit', op: 'TRANSFER_DEBUFF', target: 'intended_set', repeat: 'once', effect: { count: 1, chance: 0.50 } },
    ],
    deferred: [],
  },
  'ARBALESTER-A2': {
    champion: 'Arbalester', slot: 'A2', name: 'Lethargy', type: 'active', cooldown: 4,
    actions: [
      { seq: 10, phase: 'skill_start', op: 'ACQUIRE_TARGETS', repeat: 'once', target: 'single' },
      { seq: 20, phase: 'per_target', op: 'DEAL_DAMAGE', target: 'current_target', repeat: 'once', formulaId: 'F_ARBALESTER_A2' },
      { seq: 30, phase: 'after_hit', op: 'INCREASE_COOLDOWN', target: 'intended_set', repeat: 'once', effect: { chance: 0.60 } },
    ],
    deferred: [],
  },
  'ARBALESTER-A3': {
    champion: 'Arbalester', slot: 'A3', name: 'Soulbreak', type: 'active', cooldown: 6,
    actions: [
      { seq: 10, phase: 'skill_start', op: 'ACQUIRE_TARGETS', repeat: 'once', target: 'single' },
      { seq: 20, phase: 'per_target', op: 'DEAL_DAMAGE', target: 'current_target', repeat: 'once', formulaId: 'F_ARBALESTER_A3' },
    ],
    deferred: ['+1×ATK per debuff on the target (the dynamic "Total Debuff" part) (II-A later)'],
  },
  'RENEGADE-A1': {
    champion: 'Renegade', slot: 'A1', name: 'Lingering Pain', type: 'active', cooldown: 0,
    actions: [
      { seq: 10, phase: 'skill_start', op: 'ACQUIRE_TARGETS', repeat: 'once', target: 'single' },
      { seq: 20, phase: 'per_target', op: 'DEAL_DAMAGE', target: 'current_target', repeat: 'once', formulaId: 'F_RENEGADE_A1' },
    ],
    deferred: ['25% chance 100% [Heal Reduction] 1t (II-B)'],
  },
  'RENEGADE-A2': {
    champion: 'Renegade', slot: 'A2', name: 'Lash Out', type: 'active', cooldown: 3,
    actions: [
      { seq: 10, phase: 'skill_start', op: 'ACQUIRE_TARGETS', repeat: 'once', target: 'single' },
      { seq: 20, phase: 'per_target', op: 'DEAL_DAMAGE', target: 'current_target', repeat: 'once', formulaId: 'F_RENEGADE_A2' },
    ],
    deferred: ['"at random 3 times" — random target per hit (targeting nuance)', '50% 15% [Decrease SPD] 2t; 25% [Decrease ACC] 2t if target has buffs (II-B)'],
  },
  // A3 — Sacrificial Ritual: deals NO damage to our team (decreases ally cooldowns + self-damage). No DEAL_DAMAGE.
  'RENEGADE-A3': {
    champion: 'Renegade', slot: 'A3', name: 'Sacrificial Ritual', type: 'active', cooldown: 7,
    actions: [
      { seq: 10, phase: 'skill_start', op: 'DECREASE_COOLDOWN', target: 'allies', repeat: 'once', effect: { turns: 2, excludeDupes: true } },
    ],
    deferred: ['self-damage = 30% of own MAX HP, even if lethal (self SWAP/DESTROY-style)'],
  },
};
