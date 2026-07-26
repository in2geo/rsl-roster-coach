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
  F_EZIO_A3: { scalingStat: 'ATK', multiplier: 5, terms: null, flags: { ...DMG_FLAGS, ignore_def: 0.35, ignore_shield: true }, hitCount: 1 },

  // Pelops the Victor — scales off HP (multiplier_type "HP")
  F_PELOPS_A1: { scalingStat: 'HP', multiplier: 0.25, terms: null, flags: { ...DMG_FLAGS }, hitCount: 1 },
  // A2: +10% dmg per turn remaining on debuffs on self & target, bonus ≤ +200% (dynamic scaler, turn-weighted).
  // Its conditional ignore-DEF (if target [HP Burn]) is still DAMAGE-affecting and DEFERRED (see skill).
  F_PELOPS_A2: { scalingStat: 'HP', multiplier: 0.4, terms: null, flags: { ...DMG_FLAGS }, hitCount: 1,
    dynamicScaler: { source: 'debuff_turns', of: 'self_and_target', pctPer: 0.10, capBonus: 2.0 },
    ignoreDefIfTargetUnder: { debuff: 'HP Burn', ignore: 0.5 } },   // ignore 50% DEF if the target is under [HP Burn]

  // Tagoar — ATK. A1 hits the same target TWICE.
  F_TAGOAR_A1: { scalingStat: 'ATK', multiplier: 1.8, terms: null, flags: { ...DMG_FLAGS }, hitCount: 2 },
  F_TAGOAR_A2: { scalingStat: 'ATK', multiplier: 3.7, terms: null, flags: { ...DMG_FLAGS }, hitCount: 1 },

  // Vergis A1 — scales off DEF (multiplier_type "DEF")
  F_VERGIS_A1: { scalingStat: 'DEF', multiplier: 3.9, terms: null, flags: { ...DMG_FLAGS }, hitCount: 1 },

  // ── WAVE MOBS (Dragon-16 waves; all ATK unless noted) ──
  F_LUA_A1: { scalingStat: 'ATK', multiplier: 2.7, terms: null, flags: { ...DMG_FLAGS }, hitCount: 1 },
  F_LUA_A2: { scalingStat: 'ATK', multiplier: 1.4, terms: null, flags: { ...DMG_FLAGS }, hitCount: 3 },   // AoE ×3
  F_LUA_A3: { scalingStat: 'ATK', multiplier: 6, terms: null, flags: { ...DMG_FLAGS, ignore_shield: true }, hitCount: 1 },
  F_FACELESS_A1: { scalingStat: 'ATK', multiplier: 3, terms: null, flags: { ...DMG_FLAGS }, hitCount: 1 },
  F_FACELESS_A2: { scalingStat: 'ATK', multiplier: 5.5, terms: null, flags: { ...DMG_FLAGS }, hitCount: 1 },
  F_FACELESS_A3: { scalingStat: 'ATK', multiplier: 3, terms: null, flags: { ...DMG_FLAGS, ignore_def: 1.0, ignore_shield: true }, hitCount: 1 },   // ignores [Shield]/[Block Damage] as well as DEF
  F_ARBALESTER_A1: { scalingStat: 'ATK', multiplier: 3.3, terms: null, flags: { ...DMG_FLAGS }, hitCount: 1 },
  F_ARBALESTER_A2: { scalingStat: 'ATK', multiplier: 5.8, terms: null, flags: { ...DMG_FLAGS }, hitCount: 1 },
  // "(2 + Total Debuff) ATK" (DB damage_multiplier, multiplier_type 'formula'): static base 2×ATK + 1×ATK per
  // debuff COUNT on the target (perTargetDebuff — additive, distinct from the multiplicative dynamicScaler).
  F_ARBALESTER_A3: { scalingStat: 'ATK', multiplier: null, terms: [{ coeff: 2, stat: 'atk' }], flags: { ...DMG_FLAGS }, hitCount: 1,
    perTargetDebuff: { coeff: 1, stat: 'atk' } },
  // "1.2 ATK + SPD" — genuine multi-term (both stats sum).
  F_RENEGADE_A1: { scalingStat: 'ATK', multiplier: null, terms: [{ coeff: 1.2, stat: 'atk' }, { coeff: 1, stat: 'spd' }], flags: { ...DMG_FLAGS }, hitCount: 1 },
  F_RENEGADE_A2: { scalingStat: 'ATK', multiplier: 1.8, terms: null, flags: { ...DMG_FLAGS }, hitCount: 3 },   // "at random 3 times"

  // ── WAVE MOBS (Dragon-17 / Magic waves: Tayrel/Hordin/Crossbowman/Apothecary). Coeffs verbatim from
  //    champion_skills.damage_multiplier + multiplier_type. Tayrel scales off DEF; the rest off ATK. ──
  F_TAYREL_A1: { scalingStat: 'DEF', multiplier: 1.7, terms: null, flags: { ...DMG_FLAGS }, hitCount: 2 },   // "2 times"
  F_TAYREL_A2: { scalingStat: 'DEF', multiplier: 3.5, terms: null, flags: { ...DMG_FLAGS }, hitCount: 1 },   // AoE
  F_TAYREL_A3: { scalingStat: 'DEF', multiplier: 5.3, terms: null, flags: { ...DMG_FLAGS }, hitCount: 1 },
  F_HORDIN_A1: { scalingStat: 'ATK', multiplier: 1.9, terms: null, flags: { ...DMG_FLAGS }, hitCount: 2 },   // "2 times"
  F_HORDIN_A2: { scalingStat: 'ATK', multiplier: 6.5, terms: null, flags: { ...DMG_FLAGS }, hitCount: 1 },
  F_CROSSBOWMAN_A1: { scalingStat: 'ATK', multiplier: 3.5, terms: null, flags: { ...DMG_FLAGS }, hitCount: 1 },
  F_CROSSBOWMAN_A3: { scalingStat: 'ATK', multiplier: 5.5, terms: null, flags: { ...DMG_FLAGS }, hitCount: 1 },
  F_APOTHECARY_A1: { scalingStat: 'ATK', multiplier: 1.4, terms: null, flags: { ...DMG_FLAGS }, hitCount: 3 },   // "3 times at random"
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
      { seq: 40, phase: 'after_skill', op: 'PLACE_DEBUFF', target: 'self', repeat: 'once',
        effect: { type: 'Sleep', duration: 2, chance: 1.0, accuracy_check: false } },   // Sleeping Sage self-Sleep (card=1t, but HELD until his next turn: duration 2 survives the end-of-placement-turn expireDurations tick so the sponge window exists; the passive removes it at his turn, before natural expiry)
    ],
    deferred: [],
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
      { seq: 40, phase: 'after_skill', op: 'PLACE_DEBUFF', target: 'self', repeat: 'once',
        effect: { type: 'Sleep', duration: 2, chance: 1.0, accuracy_check: false } },   // Sleeping Sage self-Sleep (card=1t, but HELD until his next turn: duration 2 survives the end-of-placement-turn expireDurations tick so the sponge window exists; the passive removes it at his turn, before natural expiry)
    ],
    deferred: [
      'after attacking: 75% decrease all enemy buff durations by 1t — REDUCE_EFFECT_DURATION (II-C, op not built)',
      'after: +3% to ally [Shield] value per enemy buff decreased (II-C)',
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
      { seq: 60, phase: 'after_skill', op: 'PLACE_DEBUFF', target: 'self', repeat: 'once',
        effect: { type: 'Sleep', duration: 2, chance: 1.0, accuracy_check: false } },   // Sleeping Sage self-Sleep (card=1t, but HELD until his next turn: duration 2 survives the end-of-placement-turn expireDurations tick so the sponge window exists; the passive removes it at his turn, before natural expiry)
    ],
    deferred: [
      '[Enfeeble] cannot be placed on Bosses; 50% [Decrease ATK] on Bosses instead — conditional per-target branch (II-D)',
    ],
  },
  // Passive — Sleeping Sage: while Bambus is asleep, debuffs placed on allies transfer to him (75%, except a
  // hard-CC list); at the start of his turn the [Sleep] is removed (so he does NOT skip) and all his debuffs
  // are dumped onto the highest-RES enemy. `sponge:true` marks him as the sponge owner for placeDebuffs.
  'BAMBUS-PASSIVE': {
    champion: 'Bambus', slot: 'PASSIVE', name: 'Sleeping Sage', type: 'passive', sponge: true,
    triggers: [
      { on: 'start_of_turn', actions: [{ op: 'WAKE_FROM_SLEEP' }] },   // remove [Sleep] before the CC check + dump debuffs to highest-RES enemy
    ],
    // the sponge (transfer) + its exclusion list are implemented in interpreter.maybeSponge / SPONGE_EXCLUDE,
    // so declare the source terms they account for (else the card's exclusion brackets read as unaccounted).
    covers: ['transfer', 'revive', 'Block Revive', 'Stun', 'Freeze', 'Fear', 'True Fear', 'Provoke', 'Petrification', 'Sheep'],
    deferred: ['[Sleep] also removed by an enemy attack (Sleep-break-on-hit not modelled) — the dump still fires on the start-of-turn wake'],
  },

  // ── EZIO (DB "Ezio Auditore"), Spirit ──────────────────────────────────────────
  // A1 — Eagle Dive (4 ATK, no cd). Single target.
  'EZIO-A1': {
    champion: 'Ezio Auditore', slot: 'A1', name: 'Eagle Dive', type: 'active', cooldown: 0,
    actions: [
      { seq: 10, phase: 'skill_start', op: 'ACQUIRE_TARGETS', repeat: 'once', target: 'single' },
      { seq: 20, phase: 'per_target', op: 'DEAL_DAMAGE', target: 'current_target', repeat: 'once', formulaId: 'F_EZIO_A1' },
      { seq: 30, phase: 'after_hit', op: 'PLACE_DEBUFF', target: 'intended_set', repeat: 'per_target',
        effect: { type: 'Decrease Defense', magnitude: 60, duration: 2, chance: 0.75, accuracy_check: true,
          unresistableIfCasterUnder: ['Veil', 'Perfect Veil'] } },   // unresistable while Ezio is veiled (conditional on the round-start veil)
    ],
    covers: ['Veil', 'Perfect Veil'],   // the [Veil]/[Perfect Veil] condition is consumed by unresistableIfCasterUnder
    deferred: [],
  },
  // A2 — Da Vinci's Design (4 ATK, cd 4). The AoE opener (Phase I: Ezio opens with A2).
  'EZIO-A2': {
    champion: 'Ezio Auditore', slot: 'A2', name: "Da Vinci's Design", type: 'active', cooldown: 4,
    actions: [
      { seq: 10, phase: 'skill_start', op: 'ACQUIRE_TARGETS', repeat: 'once', target: 'all_enemies' },
      { seq: 20, phase: 'per_target', op: 'DEAL_DAMAGE', target: 'current_target', repeat: 'once', formulaId: 'F_EZIO_A2' },
      // two 5% [Poison] (stacks) + one 25% [Poison Sensitivity], all @75%, on every enemy hit
      { seq: 30, phase: 'after_hit', op: 'PLACE_DEBUFF', target: 'intended_set', repeat: 'per_target',
        effect: { type: 'Poison', pct: 0.05, count: 2, duration: 2, chance: 0.75, accuracy_check: true, stacking: true, maxStacks: 10,
          unresistableIfCasterUnder: ['Veil', 'Perfect Veil'] } },
      { seq: 40, phase: 'after_hit', op: 'PLACE_DEBUFF', target: 'intended_set', repeat: 'per_target',
        effect: { type: 'Poison Sensitivity', magnitude: 25, duration: 2, chance: 0.75, accuracy_check: true,
          unresistableIfCasterUnder: ['Veil', 'Perfect Veil'] } },
    ],
    covers: ['Veil', 'Perfect Veil'],   // the [Veil]/[Perfect Veil] condition is consumed by unresistableIfCasterUnder
    deferred: [
      'instantly activate all [Poison] on enemies under 4+ debuffs (II-D)',
      '[Stone Skin]→[Bomb] branch (II-E named exception)',
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
    covers: ['Veil', 'Perfect Veil'],   // buff-steal is UNCONDITIONAL in the engine (no resist), so "unresistable while veiled" is already satisfied
    // ACCEPTED deferral (by design): also ignores [Strengthen] — niche, and stage-17 mobs place no [Strengthen].
    deferred: ['also ignores [Strengthen] buffs ([Shield] ignore now built; [Strengthen] not modelled) — ACCEPTED (no [Strengthen] in the stage-17 mob kits)'],
  },
  // Passive — Everything Is Permitted (2 ATK, execute bonus below 25% HP, ignore 100% DEF, no crit) → II-D trigger.
  // Passive 2 — Full Synchronization: the 35%-nullify is a self incoming-damage MODIFIER; veil + counter are event triggers (deferred).
  'EZIO-PASSIVE2': {
    champion: 'Ezio Auditore', slot: 'PASSIVE2', name: 'Full Synchronization', type: 'passive',
    // "…has a 35% chance of decreasing the damage received to 0 whenever this Champion is about to receive damage that would exceed 50% of their MAX HP"
    modifiers: [
      { kind: 'incoming_damage', scope: 'self', chance: 0.35, when: { on: 'hit', left: 'hit_frac_of_maxhp', cmp: '>', right: 0.50 }, factor: 0 },
    ],
    // "Places a [Perfect Veil] buff on this Champion for 2 turns at the start of each Round." → untargetable
    // by single-target (the consumer lives in engine.chooseSingleTarget).
    triggers: [
      { on: 'round_start', actions: [{ op: 'PLACE_BUFF', target: 'self', effect: { type: 'Perfect Veil', duration: 2 } }] },
    ],
    deferred: [
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
        effect: { type: 'Decrease Attack', magnitude: 50, duration: 2, chance: 0.75, accuracy_check: true,
          unresistableIfTargetUnder: 'HP Burn' } },   // cannot be resisted/blocked if target under [HP Burn] (from his passive)
    ],
    deferred: [],
  },
  // A2 — Gorgoa's Bane (0.4 HP, cd 4). Single target; base damage only for now.
  'PELOPS-A2': {
    champion: 'Pelops the Victor', slot: 'A2', name: "Gorgoa's Bane", type: 'active', cooldown: 4,
    actions: [
      { seq: 10, phase: 'skill_start', op: 'ACQUIRE_TARGETS', repeat: 'once', target: 'single' },
      { seq: 20, phase: 'per_target', op: 'DEAL_DAMAGE', target: 'current_target', repeat: 'once', formulaId: 'F_PELOPS_A2' },
    ],
    deferred: [
      'if dmg < 50% target MAX HP: steal all buffs + [Stun] 2t — cannot be resisted if target [HP Burn] (II-C)',
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
      'one-copy-only / not on dead duplicate (II-E) — ACCEPTED (single copy on the team; the duplicate rule is a no-op)',
    ],
  },
  // Passive — Master of Games: on-attacked → [HP Burn] on the attacker (the wave-kill engine).
  'PELOPS-PASSIVE': {
    champion: 'Pelops the Victor', slot: 'PASSIVE', name: 'Master of Games', type: 'passive',
    immune: ['Stun', 'HP Burn', 'Petrification'],   // "immune to [Stun], [HP Burn], and [Petrification]" — applied by installRecipeRun
    triggers: [
      { on: 'attacked', actions: [
        // 100% [HP Burn] on the attacker (→ 50% while Pelops is under [Decrease DEF]).
        { op: 'PLACE_DEBUFF', target: 'attacker', effect: { type: 'HP Burn', duration: 2, chance: 1.0, accuracy_check: false,
            chanceIfCasterUnder: { debuff: 'Decrease Defense', chance: 0.5 } } },
        // 50% [Petrification] 1t on the attacker (→ 25% while Pelops is under [Decrease DEF]).
        { op: 'PLACE_DEBUFF', target: 'attacker', effect: { type: 'Petrification', duration: 1, chance: 0.5, accuracy_check: false,
            chanceIfCasterUnder: { debuff: 'Decrease Defense', chance: 0.25 } } },
      ] },
    ],
    // "Occurs once per enemy skill": a multi-hit enemy skill re-fires this per hit. Immaterial for these
    // NON-STACKING debuffs (upsert just refreshes), so the deterministic outcome matches; only the RNG
    // land-rate over multi-hit skills is slightly overstated. Left as a fidelity nuance.
    deferred: ['"once per enemy skill" — re-fires per hit on a multi-hit skill (non-stacking, so outcome-immaterial; RNG land-rate nuance) — ACCEPTED'],
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
    deferred: [],   // [Increase SPD] turn-order consumer now built (engine.effectiveSpeed in nextActor)
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
    deferred: [],   // [Reflect Damage] consumer now built (engine.reflectDamage in dealDamage)
  },
  // A2 — Aegis (cd 4): no damage — Increase DEF (self) is clean II-B; the target-ally buffs + Ally Protection are II-C/D.
  'VERGIS-A2': {
    champion: 'Vergis', slot: 'A2', name: 'Aegis', type: 'active', cooldown: 4,
    actions: [
      { seq: 10, phase: 'skill_start', op: 'PLACE_BUFF', target: 'self', repeat: 'once', effect: { type: 'Increase DEF', magnitude: 60, duration: 2 } },
      { seq: 20, phase: 'skill_start', op: 'PLACE_BUFF', target: 'all_allies_except_self', repeat: 'once', effect: { type: 'Ally Protection', magnitude: 50, duration: 2 } },
      // "a target ally" resolved to the lowest-HP ally (auto approximation of the single-ally target).
      // All three land on that same ally: Continuous Heal (sustain) + Increase SPD (turn economy) + Reflect
      // Damage — the SPD and Reflect consumers already exist (engine.effectiveSpeed / engine.reflectDamage).
      { seq: 30, phase: 'skill_start', op: 'PLACE_BUFF', target: 'lowest_hp_ally', repeat: 'once', effect: { type: 'Continuous Heal', magnitude: 15, duration: 3 } },
      { seq: 40, phase: 'skill_start', op: 'PLACE_BUFF', target: 'lowest_hp_ally', repeat: 'once', effect: { type: 'Increase SPD', magnitude: 30, duration: 3 } },
      { seq: 50, phase: 'skill_start', op: 'PLACE_BUFF', target: 'lowest_hp_ally', repeat: 'once', effect: { type: 'Reflect Damage', magnitude: 30, duration: 3 } },
    ],
    deferred: [],
  },
  // Passive — Second Wind (cd 3): REACTIVE. A passive is not cast — it subscribes to EVENTS and fires a
  // response when its condition holds. `triggers[].on` = the event; `when` = the card's condition; `actions`
  // = the response (run through the same interpreter ops). See interpreter.fireTriggers.
  'VERGIS-PASSIVE': {
    champion: 'Vergis', slot: 'PASSIVE', name: 'Second Wind', type: 'passive',
    triggers: [
      // "…places a [Shield] = 10% of MAX HP for 2t whenever this Champion loses 10%+ of MAX HP from a single hit"
      // COOLDOWN 3 (base, per DB cooldown_base — the Model uses base cds throughout, cf. readSkillKit). This
      // gates the [Passive Effect] Shield: without it the shield re-procs on EVERY big hit and Vergis is
      // unkillable (the sim's boss-phase over-survival vs reality's 88.5% win rate).
      { on: 'hit_taken', when: { left: 'hit_frac_of_maxhp', cmp: '>=', right: 0.10 }, cooldown: 3,
        actions: [{ op: 'PLACE_BUFF', target: 'self', effect: { type: 'Shield', pctOfCasterMaxHp: 0.10, duration: 2 } }] },
      // "…places a 15% [Continuous Heal] for 2t every time their HP drops below 50%" — [Active Effect], left
      // UNGATED for now (modest heal; gate only the dominant Shield until volume says otherwise).
      { on: 'hp_below', when: { left: 'hp_frac', cmp: '<', right: 0.50 },
        actions: [{ op: 'PLACE_BUFF', target: 'self', effect: { type: 'Continuous Heal', magnitude: 15, duration: 2 } }] },
    ],
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
    deferred: ['ignores [Block Damage] buffs ([Shield] ignore now built)'],
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
    deferred: ['ignores [Block Damage] buffs ([Shield] + DEF ignore now modelled)'],
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
    deferred: [],   // +1×ATK per debuff on the target now built (F.perTargetDebuff in interpreter.formulaBase)
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

  // ══ DRAGON-17 (Magic) WAVE MOBS — Tayrel / Hordin / Crossbowman / Apothecary ══════════════════
  // Authored so every stage-17 combatant is IN the Model (interpreter path), not the readSkillKit fallback.
  // Core damage + main effects use existing ops; exotic mechanics (Extra Turn, conditional CC, Fill Turn
  // Meter, damage-based self-heal, random-target) are DEFERRED until their interpreter ops exist.
  'TAYREL-A1': {
    champion: 'Tayrel', slot: 'A1', name: 'Humble', type: 'active', cooldown: 0,
    actions: [
      { seq: 10, phase: 'skill_start', op: 'ACQUIRE_TARGETS', repeat: 'once', target: 'single' },
      { seq: 20, phase: 'per_target', op: 'DEAL_DAMAGE', target: 'current_target', repeat: 'once', formulaId: 'F_TAYREL_A1' },
      { seq: 30, phase: 'after_hit', op: 'PLACE_DEBUFF', target: 'intended_set', repeat: 'per_target', effect: { type: 'Decrease Attack', magnitude: 50, duration: 2, chance: 0.40, accuracy_check: true } },
    ],
    deferred: [],
  },
  'TAYREL-A2': {
    champion: 'Tayrel', slot: 'A2', name: 'Singing Steel', type: 'active', cooldown: 4,
    actions: [
      { seq: 10, phase: 'skill_start', op: 'ACQUIRE_TARGETS', repeat: 'once', target: 'all_enemies' },
      { seq: 20, phase: 'per_target', op: 'DEAL_DAMAGE', target: 'current_target', repeat: 'once', formulaId: 'F_TAYREL_A2' },
      { seq: 30, phase: 'after_hit', op: 'PLACE_DEBUFF', target: 'intended_set', repeat: 'per_target', effect: { type: 'Decrease Defense', magnitude: 60, duration: 2, chance: 0.75, accuracy_check: true } },
    ],
    deferred: ['if the target is under [Decrease ATK]: also place [Sleep] 1t — conditional PLACE_DEBUFF exists; recipe not yet wired (P4)'],
  },
  'TAYREL-A3': {
    champion: 'Tayrel', slot: 'A3', name: 'Preemptive Strike', type: 'active', cooldown: 5,
    actions: [
      { seq: 10, phase: 'skill_start', op: 'ACQUIRE_TARGETS', repeat: 'once', target: 'single' },
      { seq: 20, phase: 'per_target', op: 'DEAL_DAMAGE', target: 'current_target', repeat: 'once', formulaId: 'F_TAYREL_A3' },
      { seq: 30, phase: 'after_hit', op: 'REDUCE_TURN_METER', target: 'intended_set', repeat: 'once', effect: { pct: 0.5 } },
    ],
    deferred: ['if the attack fully depletes the Turn Meter: place [Stun] 2t — conditional PLACE_DEBUFF exists; recipe not yet wired (P4)'],
  },
  'HORDIN-A1': {
    champion: 'Hordin', slot: 'A1', name: 'Relentless Strike', type: 'active', cooldown: 0,
    actions: [
      { seq: 10, phase: 'skill_start', op: 'ACQUIRE_TARGETS', repeat: 'once', target: 'single' },
      { seq: 20, phase: 'per_target', op: 'DEAL_DAMAGE', target: 'current_target', repeat: 'once', formulaId: 'F_HORDIN_A1' },
    ],
    deferred: ['grants an Extra Turn if the target is killed — EXTRA_TURN op exists; recipe not yet wired (P4)'],
  },
  'HORDIN-A2': {
    champion: 'Hordin', slot: 'A2', name: 'Bloodletter', type: 'active', cooldown: 4,
    actions: [
      { seq: 10, phase: 'skill_start', op: 'ACQUIRE_TARGETS', repeat: 'once', target: 'single' },
      { seq: 20, phase: 'per_target', op: 'DEAL_DAMAGE', target: 'current_target', repeat: 'once', formulaId: 'F_HORDIN_A2' },
      { seq: 30, phase: 'after_hit', op: 'PLACE_DEBUFF', target: 'intended_set', repeat: 'per_target', effect: { type: 'Decrease Attack', magnitude: 50, duration: 2, chance: 0.60, accuracy_check: true } },
    ],
    deferred: ['heals self by 10% of the damage inflicted — damage-based self-heal (op not built)'],
  },
  'HORDIN-A3': {
    champion: 'Hordin', slot: 'A3', name: 'Burning Hatred', type: 'active', cooldown: 6,
    actions: [
      { seq: 10, phase: 'skill_start', op: 'PLACE_BUFF', target: 'self', repeat: 'once', effect: { type: 'Increase ATK', magnitude: 50, duration: 2 } },
      { seq: 20, phase: 'skill_start', op: 'PLACE_BUFF', target: 'self', repeat: 'once', effect: { type: 'Increase C.RATE', magnitude: 30, duration: 2 } },
      { seq: 30, phase: 'skill_start', op: 'PLACE_BUFF', target: 'self', repeat: 'once', effect: { type: 'Increase SPD', magnitude: 30, duration: 2 } },
    ],
    deferred: ['grants an Extra Turn — EXTRA_TURN op exists; recipe not yet wired (P4)'],
  },
  'CROSSBOWMAN-A1': {
    champion: 'Crossbowman', slot: 'A1', name: 'Snap Shot', type: 'active', cooldown: 0,
    actions: [
      { seq: 10, phase: 'skill_start', op: 'ACQUIRE_TARGETS', repeat: 'once', target: 'single' },
      { seq: 20, phase: 'per_target', op: 'DEAL_DAMAGE', target: 'current_target', repeat: 'once', formulaId: 'F_CROSSBOWMAN_A1' },
    ],
    deferred: ['15% chance of an extra hit — repeat-if modifier (not built)'],
  },
  'CROSSBOWMAN-A2': {
    champion: 'Crossbowman', slot: 'A2', name: 'Sharp Eye', type: 'active', cooldown: 4,
    actions: [
      { seq: 10, phase: 'skill_start', op: 'PLACE_BUFF', target: 'lowest_hp_ally', repeat: 'once', effect: { type: 'Increase C.RATE', magnitude: 30, duration: 2 } },
    ],
    deferred: ['grants an Extra Turn — EXTRA_TURN op exists; recipe not yet wired (P4)'],
  },
  'CROSSBOWMAN-A3': {
    champion: 'Crossbowman', slot: 'A3', name: 'Blunted Arrow', type: 'active', cooldown: 5,
    actions: [
      { seq: 10, phase: 'skill_start', op: 'ACQUIRE_TARGETS', repeat: 'once', target: 'single' },
      { seq: 20, phase: 'per_target', op: 'DEAL_DAMAGE', target: 'current_target', repeat: 'once', formulaId: 'F_CROSSBOWMAN_A3' },
      { seq: 30, phase: 'after_hit', op: 'PLACE_DEBUFF', target: 'intended_set', repeat: 'per_target', effect: { type: 'Stun', duration: 1, chance: 0.50, accuracy_check: true } },
      { seq: 40, phase: 'after_hit', op: 'PLACE_DEBUFF', target: 'intended_set', repeat: 'per_target', effect: { type: 'Decrease Speed', magnitude: 30, duration: 2, chance: 0.50, accuracy_check: true } },
    ],
    deferred: [],
  },
  'APOTHECARY-A1': {
    champion: 'Apothecary', slot: 'A1', name: 'Scatterbolt', type: 'active', cooldown: 0,
    actions: [
      { seq: 10, phase: 'skill_start', op: 'ACQUIRE_TARGETS', repeat: 'once', target: 'single' },
      { seq: 20, phase: 'per_target', op: 'DEAL_DAMAGE', target: 'current_target', repeat: 'once', formulaId: 'F_APOTHECARY_A1' },
    ],
    deferred: ['"attacks 3 times at random" — random target per hit (modelled as 3 hits on one target)'],
  },
  'APOTHECARY-A2': {
    champion: 'Apothecary', slot: 'A2', name: 'Soothing Chant', type: 'active', cooldown: 3,
    actions: [
      { seq: 10, phase: 'skill_start', op: 'HEAL', target: 'lowest_hp_ally', repeat: 'once', effect: { pctOfCasterMaxHp: 0.35 } },
    ],
    deferred: ['the heal can crit — heal-crit (not modelled)'],
  },
  'APOTHECARY-A3': {
    champion: 'Apothecary', slot: 'A3', name: 'Boon of Speed', type: 'active', cooldown: 5,
    actions: [
      { seq: 10, phase: 'skill_start', op: 'PLACE_BUFF', target: 'all_allies', repeat: 'once', effect: { type: 'Increase SPD', magnitude: 30, duration: 2 } },
    ],
    deferred: ['fills the Turn Meter of all allies by 15% — FILL_TURN_METER op exists; recipe not yet wired (P4)'],
  },
};
