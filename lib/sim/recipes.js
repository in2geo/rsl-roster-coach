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

  // Iudex Artor (DB "Iudex Artor"), Spirit / Support — the sustain seat (DonaHilvi Spider team). A1 AoE ATK.
  F_IUDEX_A1: { scalingStat: 'ATK', multiplier: 3.4, terms: null, flags: { ...DMG_FLAGS }, hitCount: 1 },

  // ── WAVE MOBS (Dragon-16 waves; all ATK unless noted) ──
  F_LUA_A1: { scalingStat: 'ATK', multiplier: 2.7, terms: null, flags: { ...DMG_FLAGS }, hitCount: 1, critSplashPct: 0.5 },   // "deals 50% of the inflicted damage to all enemies if critical" (verified)
  F_LUA_A2: { scalingStat: 'ATK', multiplier: 1.4, terms: null, flags: { ...DMG_FLAGS }, hitCount: 3, critHealPct: 0.025 },   // AoE ×3; "each critical hit heals this Champion by 2.5% HP" (verified)
  F_LUA_A3: { scalingStat: 'ATK', multiplier: 6, terms: null, flags: { ...DMG_FLAGS, ignore_shield: true, ignore_block_damage: true }, hitCount: 1 },
  F_FACELESS_A1: { scalingStat: 'ATK', multiplier: 3, terms: null, flags: { ...DMG_FLAGS }, hitCount: 1, extraHitChance: 0.15 },   // "15% chance of an extra hit" (verified) — proc-stream roll, engine DEAL_DAMAGE
  F_FACELESS_A2: { scalingStat: 'ATK', multiplier: 5.5, terms: null, flags: { ...DMG_FLAGS }, hitCount: 1 },
  F_FACELESS_A3: { scalingStat: 'ATK', multiplier: 3, terms: null, flags: { ...DMG_FLAGS, ignore_def: 1.0, ignore_shield: true, ignore_block_damage: true }, hitCount: 1 },   // ignores [Shield]/[Block Damage] as well as DEF
  F_ARBALESTER_A1: { scalingStat: 'ATK', multiplier: 3.3, terms: null, flags: { ...DMG_FLAGS }, hitCount: 1 },
  F_ARBALESTER_A2: { scalingStat: 'ATK', multiplier: 5.8, terms: null, flags: { ...DMG_FLAGS }, hitCount: 1 },
  // "(2 + Total Debuff) ATK" (DB damage_multiplier, multiplier_type 'formula'): static base 2×ATK + 1×ATK per
  // debuff COUNT on the target (perTargetDebuff — additive, distinct from the multiplicative dynamicScaler).
  F_ARBALESTER_A3: { scalingStat: 'ATK', multiplier: null, terms: [{ coeff: 2, stat: 'atk' }], flags: { ...DMG_FLAGS }, hitCount: 1,
    perTargetDebuff: { coeff: 1, stat: 'atk' } },
  // "1.2 ATK + SPD" — genuine multi-term (both stats sum).
  F_RENEGADE_A1: { scalingStat: 'ATK', multiplier: null, terms: [{ coeff: 1.2, stat: 'atk' }, { coeff: 1, stat: 'spd' }], flags: { ...DMG_FLAGS }, hitCount: 1 },
  F_RENEGADE_A2: { scalingStat: 'ATK', multiplier: 1.8, terms: null, flags: { ...DMG_FLAGS }, hitCount: 3, randomTargetPerHit: true },   // "attacks at random 3 times" — each hit re-picks a random target

  // ── WAVE MOBS (Dragon-17 / Magic waves: Tayrel/Hordin/Crossbowman/Apothecary). Coeffs verbatim from
  //    champion_skills.damage_multiplier + multiplier_type. Tayrel scales off DEF; the rest off ATK. ──
  F_TAYREL_A1: { scalingStat: 'DEF', multiplier: 1.7, terms: null, flags: { ...DMG_FLAGS }, hitCount: 2 },   // "2 times"
  F_TAYREL_A2: { scalingStat: 'DEF', multiplier: 3.5, terms: null, flags: { ...DMG_FLAGS }, hitCount: 1 },   // AoE
  F_TAYREL_A3: { scalingStat: 'DEF', multiplier: 5.3, terms: null, flags: { ...DMG_FLAGS }, hitCount: 1 },
  F_HORDIN_A1: { scalingStat: 'ATK', multiplier: 1.9, terms: null, flags: { ...DMG_FLAGS }, hitCount: 2 },   // "2 times"
  F_HORDIN_A2: { scalingStat: 'ATK', multiplier: 6.5, terms: null, flags: { ...DMG_FLAGS }, hitCount: 1 },
  F_CROSSBOWMAN_A1: { scalingStat: 'ATK', multiplier: 3.5, terms: null, flags: { ...DMG_FLAGS }, hitCount: 1, extraHitChance: 0.15 },   // "15% chance of an extra hit" (verified) — proc-stream roll, engine DEAL_DAMAGE
  F_CROSSBOWMAN_A3: { scalingStat: 'ATK', multiplier: 5.5, terms: null, flags: { ...DMG_FLAGS }, hitCount: 1 },
  F_APOTHECARY_A1: { scalingStat: 'ATK', multiplier: 1.4, terms: null, flags: { ...DMG_FLAGS }, hitCount: 3, randomTargetPerHit: true },   // "attacks 3 times at random" — each hit re-picks a random target

  // ── FUSION / EVENT CHAMPIONS (5-champ recipe slice, 2026-07-31). Coeffs + cd verbatim from
  //    champion_skills.damage_multiplier / multiplier_type / cooldown_base (DB-confirmed this session). ──
  // Michelangelo (Spirit/Attack) — all ATK.
  F_MICHELANGELO_A1: { scalingStat: 'ATK', multiplier: 2, terms: null, flags: { ...DMG_FLAGS }, hitCount: 2 },   // "Attacks 1 enemy 2 times"
  F_MICHELANGELO_A2: { scalingStat: 'ATK', multiplier: 6, terms: null, flags: { ...DMG_FLAGS }, hitCount: 1 },
  F_MICHELANGELO_A3: { scalingStat: 'ATK', multiplier: 5, terms: null, flags: { ...DMG_FLAGS }, hitCount: 1 },   // AoE
  // Coldheart (Void/Attack) — ATK. A1 = 4 random hits; A3 has a NON-EXPRESSIBLE +0.1×enemy-MAX-HP term (deferred).
  F_COLDHEART_A1: { scalingStat: 'ATK', multiplier: 0.7, terms: null, flags: { ...DMG_FLAGS }, hitCount: 4, randomTargetPerHit: true,
    onHitPlaceDebuff: { type: 'Heal Reduction', magnitude: 100, duration: 2, chance: 0.25, accuracy_check: true } },   // each of the 4 random hits rolls its own [Heal Reduction] 25% (per-hit rider)
  F_COLDHEART_A2: { scalingStat: 'ATK', multiplier: 3.3, terms: null, flags: { ...DMG_FLAGS }, hitCount: 1 },   // AoE
  // A3 damage_multiplier "1.7 ATK + 0.1 ENEMY MAX HP" (multiplier_type 'formula'). The WHOLE hit (ATK term +
  // 0.1×TARGET MAX HP) crits and is DEF-mitigated — confirmed by TWO captured crit anchors on the Dragon-16 boss
  // (Mike): 76,162 under Decrease DEF + Increase ATK, and 68,930 under Decrease DEF only. Both fit
  // (0.1·MaxHP + 1.7·ATK) × critM × defM at defM ≈ 0.55 (effective boss DEF ≈ 1,130). ⚠ The SIM's defM is ~0.452
  // (effective boss DEF ~1,551 = base 3,879 under only 60% Decrease DEF), so the sim UNDER-computes each hit by
  // ~16-22% — the residual is DEF reduction / amplification on the boss (Weaken? deeper DEF shred?), NOT the crit
  // model. `perTargetMaxHp` folds the MaxHP term into the crit+DEF base (formulaBase); the computeRawHit cap
  // covers it on 21-25/Hard.
  F_COLDHEART_A3: { scalingStat: 'ATK', multiplier: null, terms: [{ coeff: 1.7, stat: 'atk' }], perTargetMaxHp: 0.1, critRateBonus: 30, flags: { ...DMG_FLAGS }, hitCount: 1 },
  // ARTAK (Orcs, role HP) — HP-SCALING AoE attacker. Multipliers are ×CASTER MAX HP (in-game card, Mike
  // verbatim 2026-08-01): A1 0.1*HP, A2 0.25*HP, A3 0.14*HP (×2 hits). His real output is the HP-Burn splash
  // (A3 places the burn, A2 detonates it) — see the recipes. NB: Burning Blood destroys his own MAX HP as he
  // activates burns, which LOWERS this HP-scaled damage but raises his DMG% (both deferred in A3/PASSIVE).
  F_ARTAK_A1: { scalingStat: 'HP', multiplier: 0.10, terms: null, flags: { ...DMG_FLAGS }, hitCount: 1 },   // "0.1*HP", AoE
  F_ARTAK_A2: { scalingStat: 'HP', multiplier: 0.25, terms: null, flags: { ...DMG_FLAGS }, hitCount: 1 },   // "0.25*HP", AoE
  F_ARTAK_A3: { scalingStat: 'HP', multiplier: 0.14, terms: null, flags: { ...DMG_FLAGS }, hitCount: 2 },   // "0.14*HP", "Attacks all enemies 2 times"
  // Hilvi (Force/Support) — A1 ATK ×2; A2/A3 deal no damage.
  F_HILVI_A1: { scalingStat: 'ATK', multiplier: 2.6, terms: null, flags: { ...DMG_FLAGS }, hitCount: 2 },   // "Attacks 1 enemy 2 times"
  // Ninja (Magic/Attack) — all ATK. A2 = 3 random hits.
  F_NINJA_A1: { scalingStat: 'ATK', multiplier: 3.7, terms: null, flags: { ...DMG_FLAGS }, hitCount: 1 },
  F_NINJA_A2: { scalingStat: 'ATK', multiplier: 2, terms: null, flags: { ...DMG_FLAGS }, hitCount: 3, randomTargetPerHit: true,
    onHitPlaceDebuff: { type: 'HP Burn', duration: 3, chance: 0.75, accuracy_check: true } },   // each of the 3 random hits rolls its own [HP Burn] 75% (interpreter DEAL_DAMAGE per-hit rider)
  F_NINJA_A3: { scalingStat: 'ATK', multiplier: 3, terms: null, flags: { ...DMG_FLAGS }, hitCount: 1, ignoreDefIfBoss: 0.5 },   // vs a Boss: single-target (recipe) + ignore 50% DEF (engine.computeRawHit)
  // Alice (Magic/Attack) — all ATK. A3 ignores 20% of the target's DEF (fixed flag).
  F_ALICE_A1: { scalingStat: 'ATK', multiplier: 1.7, terms: null, flags: { ...DMG_FLAGS }, hitCount: 2 },   // "Attacks 1 enemy 2 times"
  F_ALICE_A2: { scalingStat: 'ATK', multiplier: 4.2, terms: null, flags: { ...DMG_FLAGS }, hitCount: 1 },   // AoE
  F_ALICE_A3: { scalingStat: 'ATK', multiplier: 5, terms: null, flags: { ...DMG_FLAGS, ignore_def: 0.2 }, hitCount: 1 },   // "Will ignore 20% of the target's DEF"
};

// champKey — the ONE chokepoint that maps a combatant/recipe-champion name to its recipe key prefix
// (P3: previously re-implemented inline in ~8 sites across engine.js/interpreter.js, inconsistently —
// some stripped the fixture `#`-suffix, some did not; that scatter is the name-string collision risk R4
// named). Strips a leading name to its first token, drops a fixture position suffix ("Lua#3" → "LUA"),
// uppercases. Every recipe lookup (recipeFor, spongeOwner, passive triggers/immunities, modifiers,
// isRecipeDriven) routes through THIS, so the derivation lives in exactly one place.
export const champKey = (name) => String(name).split(' ')[0].split('#')[0].toUpperCase();

// combatantKey — THE identity a COMBATANT is matched to authored data by. Prefers `recipeKey`, the key stamped
// at the fixture-build boundary from the resolved champion ID (via the champion-names registry → canonical
// name → champKey), so an ALIAS combatant name resolves correctly: 'Artor' (alias of 'Iudex Artor') keeps its
// recipeKey 'IUDEX' and finds IUDEX-* recipes instead of silently dropping to the legacy parsed-kit path. Falls
// back to champKey(name) ONLY for combatants built without a resolved id (ad-hoc unit-test fixtures; a real
// wave mob is stamped from its champion_id at build). The recipe/authored SIDE stays champKey(r.champion) —
// r.champion is always the canonical champions.name, so champKey(r.champion) === the stamped recipeKey.
export const combatantKey = (c) => (c && c.recipeKey) || champKey(c && c.name);

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
      { seq: 30, phase: 'after_skill', op: 'REDUCE_EFFECT_DURATION', target: 'intended_set', repeat: 'once', effect: { turns: 1, chance: 0.75 } },   // "75% chance of decreasing the duration of all enemy buffs by 1t, even if a weak hit" (verified)
      { seq: 35, phase: 'after_skill', op: 'BOOST_SHIELD', target: 'all_allies', repeat: 'once', effect: { pctOfCasterMaxHp: 0.03 } },   // "+3% of MAX HP to ally [Shield] value per enemy buff decreased" (base Mike-confirmed 2026-07-26); count from the REDUCE above
      { seq: 40, phase: 'after_skill', op: 'PLACE_DEBUFF', target: 'self', repeat: 'once',
        effect: { type: 'Sleep', duration: 2, chance: 1.0, accuracy_check: false } },   // Sleeping Sage self-Sleep (card=1t, but HELD until his next turn: duration 2 survives the end-of-placement-turn expireDurations tick so the sponge window exists; the passive removes it at his turn, before natural expiry)
    ],
    deferred: [],
  },

  // A3 — Dream Sight (cd 4): no damage — team buffs + enemy debuffs (II-B).
  'BAMBUS-A3': {
    champion: 'Bambus', slot: 'A3', name: 'Dream Sight', type: 'active', cooldown: 4,
    actions: [
      { seq: 10, phase: 'skill_start', op: 'ACQUIRE_TARGETS', repeat: 'once', target: 'all_enemies' },
      { seq: 20, phase: 'skill_start', op: 'PLACE_BUFF', target: 'all_allies', repeat: 'once', effect: { type: 'Increase ACC', magnitude: 50, duration: 2 } },
      { seq: 30, phase: 'skill_start', op: 'PLACE_BUFF', target: 'all_allies', repeat: 'once', effect: { type: 'Increase ATK', magnitude: 50, duration: 2 } },
      { seq: 40, phase: 'after_skill', op: 'PLACE_DEBUFF', target: 'intended_set', repeat: 'per_target', effect: { type: 'Enfeeble', duration: 2, chance: 0.75, accuracy_check: true } },   // blocked on the boss by Almighty Immunity (dragon.HELLRAZOR_IMMUNE) → the boss gets the Decrease ATK branch below instead
      { seq: 45, phase: 'after_skill', op: 'PLACE_DEBUFF', target: 'intended_set', repeat: 'per_target', condition: { kind: 'is_boss' },
        effect: { type: 'Decrease Attack', magnitude: 50, duration: 2, chance: 0.75, accuracy_check: true } },   // "[Enfeeble] cannot be placed on Bosses. 75% chance of 50% [Decrease ATK] on Bosses for 2t instead" (card-verified 2026-07-26)
      { seq: 50, phase: 'after_skill', op: 'PLACE_DEBUFF', target: 'intended_set', repeat: 'per_target', effect: { type: 'Decrease ACC', magnitude: 50, duration: 2, chance: 0.75, accuracy_check: true } },
      { seq: 60, phase: 'after_skill', op: 'PLACE_DEBUFF', target: 'self', repeat: 'once',
        effect: { type: 'Sleep', duration: 2, chance: 1.0, accuracy_check: false } },   // Sleeping Sage self-Sleep (card=1t, but HELD until his next turn: duration 2 survives the end-of-placement-turn expireDurations tick so the sponge window exists; the passive removes it at his turn, before natural expiry)
    ],
    deferred: [],
  },
  // Passive — Sleeping Sage: while Bambus is asleep, debuffs placed on allies transfer to him (75%, except a
  // hard-CC list); at the start of his turn the [Sleep] is removed (so he does NOT skip) and all his debuffs
  // are dumped onto the highest-RES enemy. `sponge:true` marks him as the sponge owner for placeDebuffs.
  'BAMBUS-PASSIVE': {
    champion: 'Bambus', slot: 'PASSIVE', name: 'Sleeping Sage', type: 'passive', sponge: true,
    triggers: [
      { on: 'start_of_turn', actions: [{ op: 'WAKE_FROM_SLEEP' }] },   // remove [Sleep] before the CC check + dump debuffs to highest-RES enemy
      { on: 'attacked', actions: [{ op: 'WAKE_FROM_SLEEP' }] },         // "…or by an enemy attack": a hit also wakes him + fires the dump (no-op if not asleep; wake ends the sponge)
    ],
    // the sponge (transfer) + its exclusion list are implemented in interpreter.maybeSponge / SPONGE_EXCLUDE,
    // so declare the source terms they account for (else the card's exclusion brackets read as unaccounted).
    covers: ['transfer', 'revive', 'Block Revive', 'Stun', 'Freeze', 'Fear', 'True Fear', 'Provoke', 'Petrification', 'Sheep'],
    deferred: [],
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
      // Poison + Poison Sensitivity land on NON-[Stone Skin] enemies; [Stone Skin] enemies get [Bomb] INSTEAD (seq 45).
      { seq: 30, phase: 'after_hit', op: 'PLACE_DEBUFF', target: 'intended_set', repeat: 'per_target', condition: { kind: 'not_under_buff', buff: 'Stone Skin' },
        effect: { type: 'Poison', pct: 0.05, count: 2, duration: 2, chance: 0.75, accuracy_check: true, stacking: true, maxStacks: 10,
          unresistableIfCasterUnder: ['Veil', 'Perfect Veil'] } },
      { seq: 40, phase: 'after_hit', op: 'PLACE_DEBUFF', target: 'intended_set', repeat: 'per_target', condition: { kind: 'not_under_buff', buff: 'Stone Skin' },
        effect: { type: 'Poison Sensitivity', magnitude: 25, duration: 2, chance: 0.75, accuracy_check: true,
          unresistableIfCasterUnder: ['Veil', 'Perfect Veil'] } },
      // "If any enemies are under a [Stone Skin] buff, has a 75% chance of placing 2 [Bomb] debuffs that detonate
      // after 2 turns on them INSTEAD... If ALL enemies are under [Stone Skin], decreases each [Bomb]'s countdown
      // by 1." (verified) — Bomb damage 6×ATK (DB review_notes). Unresistable while Ezio is veiled.
      { seq: 45, phase: 'after_hit', op: 'PLACE_BOMB', target: 'intended_set', repeat: 'once', condition: { kind: 'under_buff', buff: 'Stone Skin' },
        effect: { multiplier: 6, count: 2, countdown: 2, chance: 0.75, accuracy_check: true, unresistableIfCasterUnder: ['Veil', 'Perfect Veil'] } },
      // "Instantly activates all [Poison] debuffs on enemies under 4 or more debuffs." (verified) — counts the
      // just-placed poisons; Poison STACKS count as individual debuffs (debuffSlots). Poisons deal one tick and
      // are REMOVED (Mike-confirmed 2026-07-26). Runs AFTER placement (seq 50).
      { seq: 50, phase: 'after_skill', op: 'DEBUFF_ACTIVATION', target: 'intended_set', repeat: 'once',
        effect: { type: 'Poison', minDebuffs: 4 } },
    ],
    covers: ['Veil', 'Perfect Veil', 'Stone Skin'],   // [Veil]/[Perfect Veil] via unresistableIfCasterUnder; [Stone Skin] via the PLACE_BOMB/Poison branch conditions
    deferred: [],
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
      // "Whenever this Champion is attacked, also has a 35% chance of counterattacking." (verified) — re-runs A1
      // at the attacker; 35% off the PROC stream (seed=null threshold → does not fire in the golden).
      { on: 'attacked', chance: 0.35, actions: [{ op: 'COUNTERATTACK', slot: 'A1' }] },
    ],
    deferred: [],
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
      // "If the damage inflicted by this skill is < 50% of the target's MAX HP, steals all buffs and places a
      // [Stun] for 2t. These effects cannot be resisted if the target is under [HP Burn]." (verified) — the
      // damage gate reads this skill's inflicted damage; STEAL_BUFF is already unconditional (no resist), the
      // [Stun] is unresistable only under [HP Burn] (else ACC/RES-gated).
      { seq: 30, phase: 'after_skill', op: 'STEAL_BUFF', target: 'intended_set', repeat: 'once', ifDamageBelowPctTargetMaxHp: 0.5 },
      { seq: 40, phase: 'after_skill', op: 'PLACE_DEBUFF', target: 'intended_set', repeat: 'once', ifDamageBelowPctTargetMaxHp: 0.5,
        effect: { type: 'Stun', duration: 2, guaranteed: true, accuracy_check: true, unresistableIfTargetUnder: 'HP Burn' } },
    ],
    deferred: [],
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
      // ⚠ 2026-07-30: the card states NO cooldown (DB-verified) — this cd3 is a FIT compensating for the
      // shield-BLIND targeting + weak/untyped shield model. Remove it TOGETHER with the shield-type model +
      // shield-aware targeting, not before (removing it alone regressed Dragon 70→63). See memory
      // enemy-targeting-easiest-to-kill-2026-07-30 + the SHIELD-OVERLAP audit (same-type no-stack, diff-type stack).
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
    deferred: [],   // crit-AoE splash modelled via F_LUA_A1.critSplashPct (dealOneHit crit rider)
  },
  'LUA-A2': {
    champion: 'Lua', slot: 'A2', name: 'Hail of Arrows', type: 'active', cooldown: 4,
    actions: [
      { seq: 10, phase: 'skill_start', op: 'ACQUIRE_TARGETS', repeat: 'once', target: 'all_enemies' },
      { seq: 20, phase: 'per_target', op: 'DEAL_DAMAGE', target: 'current_target', repeat: 'once', formulaId: 'F_LUA_A2' },
    ],
    covers: ['crit-heal 2.5% (F_LUA_A2.critHealPct)'],   // accounts for the "each critical hit heals" clause (dealOneHit rider)
    deferred: [],   // crit-heal modelled via F_LUA_A2.critHealPct (dealOneHit crit rider)
  },
  'LUA-A3': {
    champion: 'Lua', slot: 'A3', name: 'Lucky Shot', type: 'active', cooldown: 5,
    actions: [
      { seq: 10, phase: 'skill_start', op: 'ACQUIRE_TARGETS', repeat: 'once', target: 'single' },
      { seq: 20, phase: 'per_target', op: 'DEAL_DAMAGE', target: 'current_target', repeat: 'once', formulaId: 'F_LUA_A3' },
      { seq: 30, phase: 'after_hit', op: 'REDUCE_TURN_METER', target: 'intended_set', repeat: 'once', effect: { pct: 1.0 } },
    ],
    covers: ['Shield', 'Block Damage'],   // F_LUA_A3 ignore_shield + ignore_block_damage bypass both buffs (engine.dealDamage)
    deferred: [],
  },
  'FACELESS-A1': {
    champion: 'Faceless', slot: 'A1', name: 'Fireball', type: 'active', cooldown: 0,
    actions: [
      { seq: 10, phase: 'skill_start', op: 'ACQUIRE_TARGETS', repeat: 'once', target: 'single' },
      { seq: 20, phase: 'per_target', op: 'DEAL_DAMAGE', target: 'current_target', repeat: 'once', formulaId: 'F_FACELESS_A1' },
    ],
    deferred: [],   // 15% extra hit modelled via F_FACELESS_A1.extraHitChance (proc stream)
  },
  'FACELESS-A2': {
    champion: 'Faceless', slot: 'A2', name: 'Lightning', type: 'active', cooldown: 3,
    actions: [
      { seq: 5, phase: 'before_attack', op: 'PLACE_BUFF', target: 'self', repeat: 'once',
        effect: { type: 'Increase C.RATE', magnitude: 30, duration: 2 } },   // "places a 30% [Increase C.RATE] on this Champion for 2t, then attacks" (verified) — consumed by engine.effectiveCritRate
      { seq: 10, phase: 'skill_start', op: 'ACQUIRE_TARGETS', repeat: 'once', target: 'single' },
      { seq: 20, phase: 'per_target', op: 'DEAL_DAMAGE', target: 'current_target', repeat: 'once', formulaId: 'F_FACELESS_A2' },
    ],
    deferred: [],
  },
  'FACELESS-A3': {
    champion: 'Faceless', slot: 'A3', name: 'Ice Bolt', type: 'active', cooldown: 3,
    actions: [
      { seq: 10, phase: 'skill_start', op: 'ACQUIRE_TARGETS', repeat: 'once', target: 'single' },
      { seq: 20, phase: 'per_target', op: 'DEAL_DAMAGE', target: 'current_target', repeat: 'once', formulaId: 'F_FACELESS_A3' },
    ],
    covers: ['Shield', 'Block Damage'],   // F_FACELESS_A3 ignore_shield + ignore_block_damage bypass both buffs (engine.dealDamage); DEF via ignore_def:1.0
    deferred: [],
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
      { seq: 30, phase: 'after_hit', op: 'PLACE_DEBUFF', target: 'intended_set', repeat: 'per_target',
        effect: { type: 'Heal Reduction', magnitude: 100, duration: 1, chance: 0.25, accuracy_check: true } },   // "25% chance of 100% [Heal Reduction] for 1t" (verified skill_summary) — consumed by engine.healReduction
    ],
    deferred: [],
  },
  'RENEGADE-A2': {
    champion: 'Renegade', slot: 'A2', name: 'Lash Out', type: 'active', cooldown: 3,
    actions: [
      { seq: 10, phase: 'skill_start', op: 'ACQUIRE_TARGETS', repeat: 'once', target: 'single' },
      { seq: 20, phase: 'per_target', op: 'DEAL_DAMAGE', target: 'current_target', repeat: 'once', formulaId: 'F_RENEGADE_A2' },
      // "Has a 50% chance of placing a 15% [Decrease SPD] debuff for 2 turns." (verified skill_summary) — folds
      // into effectiveSpeed via engine.statFactor('spd'), the turn-order consumer.
      { seq: 30, phase: 'after_hit', op: 'PLACE_DEBUFF', target: 'intended_set', repeat: 'per_target',
        effect: { type: 'Decrease Speed', magnitude: 15, duration: 2, chance: 0.5, accuracy_check: true } },
      // "Places a 25% [Decrease ACC] debuff for 2 turns if the target has any active buffs." (verified skill_summary)
      // — no % chance → guaranteed placement subject to accuracy; conditioned on the target carrying a buff.
      // Folds into effectiveAcc via engine.statFactor('acc'), the landChance consumer.
      { seq: 40, phase: 'after_hit', op: 'PLACE_DEBUFF', target: 'intended_set', repeat: 'per_target', condition: { kind: 'target_has_buffs' },
        effect: { type: 'Decrease ACC', magnitude: 25, duration: 2, guaranteed: true, accuracy_check: true } },
    ],
    // DAMAGE now scatters across random targets (F_RENEGADE_A2.randomTargetPerHit); the debuff placement stays on
    // the ACQUIRE (primary) target per the already-cleared 5/18 clause — a separate, unchanged decision.
    deferred: [],
  },
  // A3 — Sacrificial Ritual: deals NO damage to our team (decreases ally cooldowns + self-damage). No DEAL_DAMAGE.
  'RENEGADE-A3': {
    champion: 'Renegade', slot: 'A3', name: 'Sacrificial Ritual', type: 'active', cooldown: 7,
    actions: [
      { seq: 10, phase: 'skill_start', op: 'DECREASE_COOLDOWN', target: 'allies', repeat: 'once', effect: { turns: 2, excludeDupes: true } },
      { seq: 20, phase: 'after_skill', op: 'SELF_DAMAGE', target: 'self', repeat: 'once', effect: { pctOfCasterMaxHp: 0.30 } },   // "receive damage = 30% of MAX HP, even if lethal" (verified skill_summary)
    ],
    deferred: [],
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
    deferred: [],   // 15% extra hit modelled via F_CROSSBOWMAN_A1.extraHitChance (proc stream)
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
    deferred: [],   // "attacks 3 times at random" modelled via F_APOTHECARY_A1.randomTargetPerHit (each hit re-picks)
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

  // ══ FUSION / EVENT CHAMPIONS (5-champ recipe slice, 2026-07-31) ═══════════════════════════════
  // Authored from DB-verbatim skill_summary (this session). Core damage + effects use existing ops; every
  // non-expressible clause is named in `deferred[]`. These are OUR-team recipes (single = enemy lowest-eHP).

  // ── MICHELANGELO (DB "Michelangelo"), Spirit / Attack ──────────────────────────
  // A1 — Boo-Yah! (2 ATK ×2, no cd). Single target, hit twice.
  'MICHELANGELO-A1': {
    champion: 'Michelangelo', slot: 'A1', name: 'Boo-Yah!', type: 'active', cooldown: 0,
    actions: [
      { seq: 10, phase: 'skill_start', op: 'ACQUIRE_TARGETS', repeat: 'once', target: 'single' },
      { seq: 20, phase: 'per_target', op: 'DEAL_DAMAGE', target: 'current_target', repeat: 'once', formulaId: 'F_MICHELANGELO_A1' },
      // "if EITHER hit was critical: 50% [Increase ATK] on self 2t" — ifCrit reads the skill-level crit flag
      // (ctx.attackCrit, set by DEAL_DAMAGE). No placement chance in the card, so the crit IS the gate.
      { seq: 30, phase: 'after_hit', op: 'PLACE_BUFF', target: 'self', repeat: 'once', effect: { type: 'Increase ATK', magnitude: 50, duration: 2, ifCrit: true } },
    ],
    deferred: [],
  },
  // A2 — Express Delivery! (6 ATK, cd 4). Single; debuffs placed BEFORE the hit so Decrease DEF boosts it.
  'MICHELANGELO-A2': {
    champion: 'Michelangelo', slot: 'A2', name: 'Express Delivery!', type: 'active', cooldown: 4,
    actions: [
      { seq: 10, phase: 'skill_start', op: 'ACQUIRE_TARGETS', repeat: 'once', target: 'single' },
      { seq: 40, phase: 'per_target', op: 'DEAL_DAMAGE', target: 'current_target', repeat: 'once', formulaId: 'F_MICHELANGELO_A2' },
      // Decrease DEF + Stun placed AFTER the hit so the on-crit RES-ignore can read the attack's crit
      // (ctx.attackCrit) — "ignore 25% of the target's RES if the initial attack was critical". (A skill's own
      // hit does not benefit from a Decrease DEF it applies in the same cast, so after_hit is also more faithful.)
      { seq: 42, phase: 'after_hit', op: 'PLACE_DEBUFF', target: 'intended_set', repeat: 'per_target',
        effect: { type: 'Decrease Defense', magnitude: 60, duration: 2, chance: 0.75, accuracy_check: true, ignoreResIfCrit: 0.25 } },
      { seq: 44, phase: 'after_hit', op: 'PLACE_DEBUFF', target: 'intended_set', repeat: 'per_target',
        effect: { type: 'Stun', duration: 1, chance: 0.75, accuracy_check: true, ignoreResIfCrit: 0.25 } },
      // [Debuff Spread]: after the hit, copy ALL of the target's debuffs (Decrease DEF + Stun + any HP Burn /
      // Decrease ATK it carries) onto every enemy. This is Mikey's "AoE Decrease DEF" (Mike first-party 2026-08-03).
      { seq: 50, phase: 'after_hit', op: 'SPREAD_DEBUFFS', target: 'intended_set', repeat: 'once' },
    ],
    deferred: [],
  },
  // A3 — Shell Cyclone (5 ATK, cd 5). AoE; Decrease ATK on all, self Taunt.
  'MICHELANGELO-A3': {
    champion: 'Michelangelo', slot: 'A3', name: 'Shell Cyclone', type: 'active', cooldown: 5,
    actions: [
      { seq: 10, phase: 'skill_start', op: 'ACQUIRE_TARGETS', repeat: 'once', target: 'all_enemies' },
      { seq: 20, phase: 'per_target', op: 'DEAL_DAMAGE', target: 'current_target', repeat: 'once', formulaId: 'F_MICHELANGELO_A3' },
      { seq: 30, phase: 'after_hit', op: 'PLACE_DEBUFF', target: 'intended_set', repeat: 'per_target',
        effect: { type: 'Decrease Attack', magnitude: 50, duration: 2, chance: 0.75, accuracy_check: true, ignoreResIfCrit: 0.25 } },   // on-crit: ignore 25% of the target's RES for this land
      { seq: 40, phase: 'after_skill', op: 'PLACE_BUFF', target: 'self', repeat: 'once', effect: { type: 'Taunt', duration: 2 } },
    ],
    deferred: [
      '[Leech] debuff (75%, 2t) — no [Leech] consumer/op',
    ],
  },
  // A4 — Party Dude [P]: Evade passive + Shield-on-hit (both wired) + TMNT join-attack (no Turtles → deferred).
  // `evade` is the general recipe-declared field engine.rollEvade reads (15%, 30% under [Taunt]). The on-hit
  // [Shield] = 300% ATK is his tank engine: A3 self-Taunts, he soaks the swarm, and re-shields on every hit —
  // no cooldown (card states none); the upsert duration-replacement (same-1t reapply doesn't stack) naturally
  // caps it, so it tops up when depleted rather than becoming unkillable. pctOfCasterAtk is general (buffValue).
  'MICHELANGELO-A4': {
    champion: 'Michelangelo', slot: 'A4', name: 'Party Dude', type: 'passive',
    evade: { base: 0.15, underTaunt: 0.30 },
    triggers: [
      { on: 'attacked', actions: [{ op: 'PLACE_BUFF', target: 'self', effect: { type: 'Shield', pctOfCasterAtk: 3.0, duration: 1 } }] },
    ],
    covers: ['Taunt'],   // his A3 self-[Taunt] raises the evade to 30% (evade.underTaunt) — the buff is consumed by evadeChanceFor
    deferred: [
      'ally Leonardos/Donatellos/Michelangelos/Raphaels join this Champion\'s attacks — join-attack unsupported (and no Turtles on the team)',
    ],
  },

  // ── COLDHEART (DB "Coldheart"), Void / Attack ──────────────────────────────────
  // A1 — Flurry of Arrows (0.7 ATK ×4 random, no cd). Each hit 25% [Heal Reduction] 100% 2t.
  'COLDHEART-A1': {
    champion: 'Coldheart', slot: 'A1', name: 'Flurry of Arrows', type: 'active', cooldown: 0,
    actions: [
      { seq: 10, phase: 'skill_start', op: 'ACQUIRE_TARGETS', repeat: 'once', target: 'single' },
      // Each of the 4 random hits rolls its own [Heal Reduction] 25% on the target it struck
      // (F_COLDHEART_A1.onHitPlaceDebuff) — replaces the old single-placement approximation.
      { seq: 20, phase: 'per_target', op: 'DEAL_DAMAGE', target: 'current_target', repeat: 'once', formulaId: 'F_COLDHEART_A1' },
    ],
    deferred: [],
  },
  // A2 — Art of Pain (3.3 ATK, cd 4). AoE; Decrease ACC + conditional Poison (self-combo with A1's Heal Reduction).
  'COLDHEART-A2': {
    champion: 'Coldheart', slot: 'A2', name: 'Art of Pain', type: 'active', cooldown: 4,
    actions: [
      { seq: 10, phase: 'skill_start', op: 'ACQUIRE_TARGETS', repeat: 'once', target: 'all_enemies' },
      { seq: 20, phase: 'per_target', op: 'DEAL_DAMAGE', target: 'current_target', repeat: 'once', formulaId: 'F_COLDHEART_A2' },
      { seq: 30, phase: 'after_hit', op: 'PLACE_DEBUFF', target: 'intended_set', repeat: 'per_target',
        effect: { type: 'Decrease ACC', magnitude: 50, duration: 1, chance: 0.30, accuracy_check: true } },
      // "Places a 5% [Poison] for 2t if the target is under a [Heal Reduction] debuff." No % chance → guaranteed,
      // gated by the under_debuff condition (conditionMet 'under_debuff'). Coldheart self-provides Heal Reduction via A1.
      { seq: 40, phase: 'after_hit', op: 'PLACE_DEBUFF', target: 'intended_set', repeat: 'per_target',
        condition: { kind: 'under_debuff', debuff: 'Heal Reduction' },
        effect: { type: 'Poison', pct: 0.05, duration: 2, guaranteed: true, accuracy_check: true, stacking: true, maxStacks: 10 } },
    ],
    deferred: [],
  },
  // A3 — Heartseeker (cd 5). Single; 1.7 ATK term only, full TM strip.
  'COLDHEART-A3': {
    champion: 'Coldheart', slot: 'A3', name: 'Heartseeker', type: 'active', cooldown: 4,   // card: base 5, "Lvl 5 Cooldown -1" → 4 booked (Mike screenshot 2026-08-01)
    actions: [
      { seq: 10, phase: 'skill_start', op: 'ACQUIRE_TARGETS', repeat: 'once', target: 'single' },
      { seq: 20, phase: 'per_target', op: 'DEAL_DAMAGE', target: 'current_target', repeat: 'once', formulaId: 'F_COLDHEART_A3' },   // 1.7×ATK + 0.1×MaxHP, crit + DEF-mitigated (+30% crit chance)
      { seq: 30, phase: 'after_hit', op: 'REDUCE_TURN_METER', target: 'intended_set', repeat: 'once', effect: { pct: 1.0 } },   // "Decreases the target's Turn Meter by 100%"
    ],
    deferred: [],   // +0.1×enemy-MAX-HP term (perTargetMaxHp) + extra 30% crit chance (F.critRateBonus) both wired
  },

  // ── HILVI (DB "Hilvi"), Force / Support ────────────────────────────────────────
  // A1 — Frostflame Torch (2.6 ATK ×2, no cd). Each hit 50% 60% [Decrease DEF] 2t.
  'HILVI-A1': {
    champion: 'Hilvi', slot: 'A1', name: 'Frostflame Torch', type: 'active', cooldown: 0,
    actions: [
      { seq: 10, phase: 'skill_start', op: 'ACQUIRE_TARGETS', repeat: 'once', target: 'single' },
      { seq: 20, phase: 'per_target', op: 'DEAL_DAMAGE', target: 'current_target', repeat: 'once', formulaId: 'F_HILVI_A1' },
      { seq: 30, phase: 'after_hit', op: 'PLACE_DEBUFF', target: 'intended_set', repeat: 'per_target',
        effect: { type: 'Decrease Defense', magnitude: 60, duration: 2, chance: 0.50, accuracy_check: true } },
    ],
    deferred: ['Tormin the Cold synergy: 25% chance to instantly activate his Rimefire skill — cross-champion ally-synergy trigger unsupported'],
  },
  // A2 — Embittering Cold (no dmg, cd 5). [Freeze] all enemies + buff-strip all enemies.
  'HILVI-A2': {
    champion: 'Hilvi', slot: 'A2', name: 'Embittering Cold', type: 'active', cooldown: 5,
    actions: [
      { seq: 10, phase: 'skill_start', op: 'ACQUIRE_TARGETS', repeat: 'once', target: 'all_enemies' },
      { seq: 20, phase: 'after_skill', op: 'PLACE_DEBUFF', target: 'intended_set', repeat: 'per_target',
        effect: { type: 'Freeze', duration: 1, guaranteed: true, accuracy_check: true } },   // "places a [Freeze] debuff on all enemies for 1 turn"
    ],
    deferred: [
      'removes all buffs from all enemies (buff strip) — no strip/remove-enemy-buff op (STEAL_BUFF takes them for the caster, a different mechanic)',
      'Tormin the Cold synergy: instantly activates his Blizzard Rage skill — cross-champion ally-synergy trigger unsupported',
      'this skill\'s cooldown cannot be decreased or reset — cooldown-lock flag not modelled',
    ],
  },
  // A3 — Ward Of The Glacier (no dmg, cd 6). Mass revive + team [Block Damage] + [Increase SPD].
  'HILVI-A3': {
    champion: 'Hilvi', slot: 'A3', name: 'Ward Of The Glacier', type: 'active', cooldown: 6,
    actions: [
      { seq: 10, phase: 'skill_start', op: 'REVIVE', target: 'all_dead_allies', repeat: 'once', effect: { hpPct: 0.50 } },
      { seq: 20, phase: 'after_skill', op: 'PLACE_BUFF', target: 'all_allies', repeat: 'once', effect: { type: 'Block Damage', duration: 1 } },
      { seq: 30, phase: 'after_skill', op: 'PLACE_BUFF', target: 'all_allies', repeat: 'once', effect: { type: 'Increase SPD', magnitude: 30, duration: 2 } },
    ],
    deferred: [
      'revive also grants +30% Turn Meter to revived allies — doRevive sets TM to 0 (no revive-TM param)',
      'if no allies were revived: fill all allies\' Turn Meter by 25% — conditional-on-no-revive TM fill not expressible (FILL_TURN_METER has no condition gate)',
      'this skill\'s cooldown cannot be decreased or reset — cooldown-lock flag not modelled',
    ],
  },
  // Passive — Divine Mission [P]: on enemy [Freeze] → steal buff + [HP Burn] 2t + −10% TM. Freeze-triggered.
  // Divine Mission [P]: whenever an ENEMY receives [Freeze] → steal 1 buff + [HP Burn] 2t + −10% TM on that enemy.
  // Fired by the interpreter's on-Freeze hook (placeDebuffs) as event 'enemy_frozen', ctx.attacker = the frozen
  // enemy. On Spider this is Hilvi's damage engine: her A2 (+ Ninja A3) freeze the whole swarm every cycle, so she
  // blankets every frozen Spiderling in [HP Burn], which splashes 3%-maxHP onto Skavag each tick (her ~423k in
  // reality). Skavag is Freeze/HP-Burn-immune, so the burn lands on the Spiderlings and reaches the boss via splash.
  'HILVI-PASSIVE': {
    champion: 'Hilvi', slot: 'PASSIVE', name: 'Divine Mission', type: 'passive',
    triggers: [
      { on: 'enemy_frozen', actions: [
        { op: 'PLACE_DEBUFF', target: 'attacker', effect: { type: 'HP Burn', duration: 2, chance: 1.0, accuracy_check: false } },
        { op: 'STEAL_BUFF', target: 'attacker' },
        { op: 'REDUCE_TURN_METER', target: 'attacker', effect: { pct: 0.10 } },   // "decreases their Turn Meter by 10%" — 0.10 fraction (doReduceTurnMeter ×100 = 10 pts). WAS `pct: 10` (wrong field + scale) → drained 0 → the frozen enemy pack never got pushed back, so the sim clumped enemy turns instead of letting champions interleave.
      ] },
    ],
    deferred: [
      'Tormin synergy: fill his TM by the amount decreased — cross-champion ally-synergy trigger unsupported',
      '"only one copy activates" / not-on-dead-duplicate — single Hilvi on the team, no-op',
    ],
  },

  // ── NINJA (DB "Ninja"), Magic / Attack ─────────────────────────────────────────
  // A1 — Shatterbolt (3.7 ATK, no cd). Single; 45% 60% [Decrease DEF] 2t.
  'NINJA-A1': {
    champion: 'Ninja', slot: 'A1', name: 'Shatterbolt', type: 'active', cooldown: 0,
    actions: [
      { seq: 10, phase: 'skill_start', op: 'ACQUIRE_TARGETS', repeat: 'once', target: 'single' },
      { seq: 20, phase: 'per_target', op: 'DEAL_DAMAGE', target: 'current_target', repeat: 'once', formulaId: 'F_NINJA_A1' },
      { seq: 30, phase: 'after_hit', op: 'PLACE_DEBUFF', target: 'intended_set', repeat: 'per_target',
        effect: { type: 'Decrease Defense', magnitude: 60, duration: 2, chance: 0.45, accuracy_check: true } },
    ],
    deferred: ['fills this Champion\'s Turn Meter by 15% when used against Bosses — boss-conditional self TM fill (FILL_TURN_METER has no condition gate)'],
  },
  // A2 — Hailburn (2 ATK ×3 random, cd 4). Each hit 75% [HP Burn] 3t; self [Perfect Veil]; vs Boss activate HP Burn.
  'NINJA-A2': {
    champion: 'Ninja', slot: 'A2', name: 'Hailburn', type: 'active', cooldown: 4,
    actions: [
      { seq: 10, phase: 'skill_start', op: 'ACQUIRE_TARGETS', repeat: 'once', target: 'single' },
      // 3 random hits; EACH rolls its own [HP Burn] 75% on the target it struck (F_NINJA_A2.onHitPlaceDebuff,
      // the DEAL_DAMAGE per-hit rider) — replaces the old single-placement approximation.
      { seq: 20, phase: 'per_target', op: 'DEAL_DAMAGE', target: 'current_target', repeat: 'once', formulaId: 'F_NINJA_A2' },
      { seq: 40, phase: 'after_skill', op: 'PLACE_BUFF', target: 'self', repeat: 'once', effect: { type: 'Perfect Veil', duration: 2 } },
      // "When used against Bosses, will instantly activate any [HP Burn]" — DEBUFF_ACTIVATION (Ezio-A2 pattern,
      // activateHpBurns). bossOnly gates it to a boss target so a wave-phase cast does not activate on a mob.
      { seq: 50, phase: 'after_skill', op: 'DEBUFF_ACTIVATION', target: 'intended_set', repeat: 'once',
        effect: { type: 'HP Burn', bossOnly: true } },
    ],
    deferred: [],
  },
  // A3 — Cyan Slash (3 ATK, cd 5). AoE; 75% [Freeze] 1t.
  'NINJA-A3': {
    champion: 'Ninja', slot: 'A3', name: 'Cyan Slash', type: 'active', cooldown: 5,
    actions: [
      // vs a Boss: attack ONLY the Boss (boss_else_all_enemies) — the Freeze/damage then land on the boss alone,
      // and F_NINJA_A3.ignoreDefIfBoss strips 50% of its DEF. No boss present → AoE all enemies, as before.
      { seq: 10, phase: 'skill_start', op: 'ACQUIRE_TARGETS', repeat: 'once', target: 'boss_else_all_enemies' },
      { seq: 20, phase: 'per_target', op: 'DEAL_DAMAGE', target: 'current_target', repeat: 'once', formulaId: 'F_NINJA_A3' },
      { seq: 30, phase: 'after_hit', op: 'PLACE_DEBUFF', target: 'intended_set', repeat: 'per_target',
        effect: { type: 'Freeze', duration: 1, chance: 0.75, accuracy_check: true } },
    ],
    deferred: [
      'decrease the cooldown of Hailburn (own A2) by 1 — DECREASE_COOLDOWN skips the actor (own-skill cooldown reduction unsupported)',
    ],
  },
  // Passive — Escalation [P]: ATK/C.DMG stacking when all 3 active skills hit one enemy in a Round (interpreter
  // maybeEscalate). Per-Round trigger window (state.round), PERSISTENT multiplicative stacks capped at +100% ATK
  // / +25% C.DMG; +20%/+10% per completion vs Bosses, +10%/+5% otherwise. On Spider a Round is long enough
  // (constant spiderling respawns delay round completion) for Ninja to land A1+A2+A3 on the boss within it.
  'NINJA-PASSIVE': {
    champion: 'Ninja', slot: 'PASSIVE', name: 'Escalation', type: 'passive',
    escalation: { atkPer: 0.10, atkCap: 1.00, cdmgPer: 0.05, cdmgCap: 0.25, bossAtkPer: 0.20, bossCdmgPer: 0.10 },
    deferred: ['"multiplicative" reading: each completion scales Ninja\'s ATK/C.DMG stat by (1+per) up to the +100%/+25% cap — an interpretation of the card\'s "multiplicative, can stack" (percentage-point-additive is the alternative reading)'],
  },

  // ── ALICE (DB "Alice"), Magic / Attack ─────────────────────────────────────────
  // A1 — Vorpal Sword (1.7 ATK ×2, no cd). Each hit 80% decreases duration of a random buff on the target by 1.
  'ALICE-A1': {
    champion: 'Alice', slot: 'A1', name: 'Vorpal Sword', type: 'active', cooldown: 0,
    actions: [
      { seq: 10, phase: 'skill_start', op: 'ACQUIRE_TARGETS', repeat: 'once', target: 'single' },
      { seq: 20, phase: 'per_target', op: 'DEAL_DAMAGE', target: 'current_target', repeat: 'once', formulaId: 'F_ALICE_A1' },
      // REDUCE_EFFECT_DURATION decreases EVERY buff on the target by 1 (gated at 80%); the card decreases ONE
      // RANDOM buff per hit — approximated as an all-buffs single decrease (see deferred).
      { seq: 30, phase: 'after_hit', op: 'REDUCE_EFFECT_DURATION', target: 'intended_set', repeat: 'once', effect: { turns: 1, chance: 0.80 } },
    ],
    deferred: [
      'extra hit if the target has any active skills on cooldown — conditional extra hit (no target-cooldown condition for hitCount)',
      'the card decreases ONE RANDOM buff per hit (80% each ×2 hits); modelled as a single 80% decrease of ALL buffs on the target (REDUCE_EFFECT_DURATION acts on every buff)',
    ],
  },
  // A2 — Clockwork Cyclone (4.2 ATK, cd 4). AoE; 75% increase enemy cooldowns +2; TM decrease.
  'ALICE-A2': {
    champion: 'Alice', slot: 'A2', name: 'Clockwork Cyclone', type: 'active', cooldown: 4,
    actions: [
      { seq: 10, phase: 'skill_start', op: 'ACQUIRE_TARGETS', repeat: 'once', target: 'all_enemies' },
      { seq: 20, phase: 'per_target', op: 'DEAL_DAMAGE', target: 'current_target', repeat: 'once', formulaId: 'F_ALICE_A2' },
      { seq: 30, phase: 'after_hit', op: 'INCREASE_COOLDOWN', target: 'intended_set', repeat: 'per_target', effect: { chance: 0.75 } },
      // Base 15% TM decrease; the 75% placement-chance is approximated by the ACC/RES land gate (accuracy_check).
      { seq: 40, phase: 'after_hit', op: 'REDUCE_TURN_METER', target: 'intended_set', repeat: 'once', effect: { pct: 0.15, accuracy_check: true } },
    ],
    deferred: [
      '75% placement chance on the TM decrease is modelled as the ACC/RES land gate (REDUCE_TURN_METER has no flat-chance field)',
      'if a target\'s skill cooldown is increased to MAX: decrease its TM by 30% instead of 15% — escalation-on-max-cd not expressible',
      'INCREASE_COOLDOWN sets each enemy skill to its FULL cooldown; the card adds +2 turns (op sets cdLeft = cooldown, not +2)',
    ],
  },
  // A3 — Queenslayer (5 ATK, cd 4). Single; ignores 20% DEF.
  'ALICE-A3': {
    champion: 'Alice', slot: 'A3', name: 'Queenslayer', type: 'active', cooldown: 4,
    actions: [
      { seq: 10, phase: 'skill_start', op: 'ACQUIRE_TARGETS', repeat: 'once', target: 'single' },
      { seq: 20, phase: 'per_target', op: 'DEAL_DAMAGE', target: 'current_target', repeat: 'once', formulaId: 'F_ALICE_A3' },
    ],
    deferred: ['if the initial target is killed: also attack the lowest-HP enemy (also ignoring 20% DEF) — on-kill follow-up attack unsupported'],
  },
  // A4 — Tick Tock [P]: bonus damage per enemy cooldown-turn + reset own cd on kill.
  'ALICE-A4': {
    champion: 'Alice', slot: 'A4', name: 'Tick Tock', type: 'passive',
    deferred: [
      '[Passive Effect] +3% damage to each target per turn remaining on all their skills\' cooldowns — cooldown-scaled bonus damage unsupported',
      '[Active Effect] reset one of this Champion\'s skill cooldowns on each kill (once per skill) — on-kill own-cd reset unsupported',
    ],
  },

  // ── IUDEX ARTOR (DB "Iudex Artor"), Spirit / Support — the SUSTAIN seat swapped in for Alice on Spider ──
  // A1 — Censer Whirl (3.4 ATK, no cd): AoE attack + AoE heal 5% of Artor's MAX HP (every-turn team sustain).
  'IUDEX-A1': {
    champion: 'Iudex Artor', slot: 'A1', name: 'Censer Whirl', type: 'active', cooldown: 0,
    actions: [
      { seq: 10, phase: 'skill_start', op: 'ACQUIRE_TARGETS', repeat: 'once', target: 'all_enemies' },
      { seq: 20, phase: 'per_target', op: 'DEAL_DAMAGE', target: 'current_target', repeat: 'once', formulaId: 'F_IUDEX_A1' },
      { seq: 30, phase: 'after_skill', op: 'HEAL', target: 'all_allies', repeat: 'once', effect: { pctOfCasterMaxHp: 0.05 } },
    ],
  },
  // A2 — Incense of Inspiration (cd 5): team Increase ATK + Strengthen + fill all allies' TM 15%.
  'IUDEX-A2': {
    champion: 'Iudex Artor', slot: 'A2', name: 'Incense of Inspiration', type: 'active', cooldown: 5,
    actions: [
      { seq: 10, phase: 'skill_start', op: 'PLACE_BUFF', target: 'all_allies', repeat: 'once', effect: { type: 'Increase ATK', magnitude: 50, duration: 2 } },
      { seq: 20, phase: 'skill_start', op: 'PLACE_BUFF', target: 'all_allies', repeat: 'once', effect: { type: 'Strengthen', magnitude: 25, duration: 2 } },
      { seq: 30, phase: 'after_skill', op: 'FILL_TURN_METER', target: 'all_allies', repeat: 'once', effect: { pct: 15 } },
    ],
    deferred: [],   // [Strengthen] −25% incoming damage now consumed (engine.strengthenFactor in incomingDamage)
  },
  // A3 — Revival Mandate (cd 6): revive ONE dead ally (50% HP + 50% TM) + Increase ATK on them.
  'IUDEX-A3': {
    champion: 'Iudex Artor', slot: 'A3', name: 'Revival Mandate', type: 'active', cooldown: 6,
    actions: [
      { seq: 10, phase: 'skill_start', op: 'REVIVE', target: 'dead_ally', repeat: 'once', effect: { hpPct: 0.50, tmPct: 0.50, count: 1 } },
    ],
    deferred: [
      'places 50% [Increase ATK] on the revived ally 1t + then ACTIVATES the revived ally\'s default skill targeting lowest-HP enemy — revive-then-cast-ally-skill unsupported',
    ],
  },
  // A4 — Sentenced to Life [P]: if the revived ally\'s default skill kills, reset Revival Mandate cd. Deferred stub.
  'IUDEX-PASSIVE': {
    champion: 'Iudex Artor', slot: 'A4', name: 'Sentenced to Life', type: 'passive',
    deferred: ['on-kill-by-revived-ally → reset [Revival Mandate] cd — depends on the deferred revive-then-cast chain'],
  },

  // ── ARTAK (DB "Artak"), Orcs — the HP-Burn DETONATOR (built 2026-08-01) ────────────────────────
  // A1 Chaosrazor: AoE attack + 35% extend [HP Burn] duration (extend-duration op absent → deferred).
  'ARTAK-A1': {
    champion: 'Artak', slot: 'A1', name: 'Chaosrazor', type: 'active', cooldown: 0,
    actions: [
      { seq: 10, phase: 'skill_start', op: 'ACQUIRE_TARGETS', repeat: 'once', target: 'all_enemies' },
      { seq: 20, phase: 'per_target', op: 'DEAL_DAMAGE', target: 'current_target', repeat: 'once', formulaId: 'F_ARTAK_A1' },
    ],
    deferred: ['35% chance to extend any [HP Burn] duration by 1 turn on each target — no EXTEND_DURATION op'],
  },
  // A2 Dogs of War (cd4): "Before attacking, instantly activates one tick of all [HP Burn] on all enemies"
  // — the burn-splash DETONATOR (anti-consume: forces the swarm's burns to splash Skavag NOW) — then the AoE
  // attack + 75% 50% [Decrease ATK] 2t (Spider survival).
  'ARTAK-A2': {
    champion: 'Artak', slot: 'A2', name: 'Dogs of War', type: 'active', cooldown: 4,
    actions: [
      { seq: 10, phase: 'skill_start', op: 'ACQUIRE_TARGETS', repeat: 'once', target: 'all_enemies' },
      { seq: 15, phase: 'before_attack', op: 'DEBUFF_ACTIVATION', target: 'intended_set', repeat: 'once', effect: { type: 'HP Burn', minDebuffs: 0 } },
      { seq: 20, phase: 'per_target', op: 'DEAL_DAMAGE', target: 'current_target', repeat: 'once', formulaId: 'F_ARTAK_A2' },
      { seq: 30, phase: 'after_hit', op: 'PLACE_DEBUFF', target: 'intended_set', repeat: 'per_target',
        effect: { type: 'Decrease Attack', magnitude: 50, duration: 2, chance: 0.75, accuracy_check: true } },
    ],
    deferred: [],
  },
  // A3 Purifyre (cd4): AoE 2 hits + first hit 75% [HP Burn] on all enemies 2t (feeds the swarm burn engine).
  'ARTAK-A3': {
    champion: 'Artak', slot: 'A3', name: 'Purifyre', type: 'active', cooldown: 4,
    actions: [
      { seq: 10, phase: 'skill_start', op: 'ACQUIRE_TARGETS', repeat: 'once', target: 'all_enemies' },
      { seq: 20, phase: 'per_target', op: 'DEAL_DAMAGE', target: 'current_target', repeat: 'once', formulaId: 'F_ARTAK_A3' },
      { seq: 30, phase: 'after_hit', op: 'PLACE_DEBUFF', target: 'intended_set', repeat: 'per_target',
        effect: { type: 'HP Burn', duration: 2, chance: 0.75, accuracy_check: true } },
      // Self-recovery reads the PLACE_DEBUFF tally: restore destroyed MAX HP 10% per burn PLACED + heal 5%
      // MaxHP per burn BLOCKED/RESISTED. Artak's ACC 10 vs spiderling RES 100 → most resist → heal dominates.
      { seq: 40, phase: 'after_skill', op: 'SELF_RECOVER_ON_BURN', repeat: 'once', effect: { restorePerPlaced: 0.10, healPerResist: 0.05 } },
    ],
    deferred: [],
  },
  // Passive Burning Blood [P] — MODELLED 2026-08-01 (engine hook state.onHpBurnActivate → applyBurningBlood in
  // interpreter.js). Each [HP Burn] activation destroys 5% of Artak's MAX HP (cap 50%); destroyed% d scales
  // +1% DMG/C.DMG/DEF and +2 SPD/RES per 1% (via a.dmgMult, a.critDmg, a.def, a.spd, a.res, a.maxHp mutation).
  // Self-lowering MAX HP makes him lowest-EHP → the off-Taunt swarm target → dies first (Mike first-party).
  'ARTAK-PASSIVE': {
    champion: 'Artak', slot: 'PASSIVE', name: 'Burning Blood', type: 'passive',
    burningBlood: { destroyPct: 0.05, cap: 0.50, dmgPer: 1, cdmgPer: 1, defPer: 1, spdPer: 2, resPer: 2 },
    deferred: [],
  },
};

// DEFERRED-MECHANICS report — collect the UNMODELLED mechanics for a set of champion names, so assembling a
// team CALLS OUT what the sim is NOT simulating up front (Mike 2026-08-03: a deferred mechanic must be
// surfaced whenever a champ enters a team, not rediscovered by grinding a reality mismatch — that is exactly
// how the whole Michelangelo A2 [Debuff Spread] hunt happened). Matches recipes by champKey, with a
// full-name-substring fallback so team-short-name 'Artor' still finds recipe champion 'Iudex Artor'.
export function deferredMechanicsFor(names) {
  const matches = (recipeChamp, name) => {
    if (champKey(recipeChamp) === champKey(name)) return true;
    const rl = String(recipeChamp).toLowerCase(), nl = String(name).toLowerCase();
    return rl.includes(nl) || nl.includes(rl);
  };
  const out = [];
  for (const nm of names ?? []) {
    const items = Object.values(RECIPES).filter((r) => matches(r.champion, nm))
      .flatMap((r) => (r.deferred ?? []).map((d) => ({ slot: r.slot, note: d })));
    if (items.length) out.push({ champion: nm, count: items.length, items });
  }
  return out;
}
