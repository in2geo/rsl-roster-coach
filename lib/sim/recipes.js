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
  // BATCH 2 (agent-authored)
  F_UNDERPRIEST_A1: { scalingStat: "ATK", multiplier: 6.5, hitCount: 1, terms: null, flags: { ...DMG_FLAGS } },
  F_UNDERPRIEST_A2: { scalingStat: "ATK", multiplier: 6.6, hitCount: 1, terms: null, flags: { ...DMG_FLAGS } },
  F_THOR_A1: { scalingStat: "ATK", multiplier: 1.9, terms: null, hitCount: 2, flags: { ...DMG_FLAGS } },
  F_THOR_A2: { scalingStat: "ATK", multiplier: 5, terms: null, hitCount: 1, flags: { ...DMG_FLAGS } },
  F_THOR_A3: { scalingStat: "ATK", multiplier: 4, terms: null, hitCount: 1, flags: { ...DMG_FLAGS } },
  F_DONATELLO_A1: { scalingStat: "HP", multiplier: 0.2, terms: null, hitCount: 1, flags: { ...DMG_FLAGS } },
  F_DONATELLO_A2: { scalingStat: "HP", multiplier: 0.24, terms: null, hitCount: 1, flags: { ...DMG_FLAGS } },
  F_DEACON_A1: { scalingStat: "ATK", multiplier: 1.8, terms: null, hitCount: 2, flags: { ...DMG_FLAGS } },
  F_DEACON_A2: { scalingStat: "ATK", multiplier: 4, terms: null, hitCount: 1, flags: { ...DMG_FLAGS } },
  F_DUCHESS_A1: { scalingStat: "DEF", multiplier: 1.7, terms: null, hitCount: 2, flags: { ...DMG_FLAGS } },
  F_VALLARYN_A1: { scalingStat: "ATK", multiplier: 1.9, terms: null, hitCount: 2, selfHealPctOfDamage: 0.2, onHitPlaceDebuff: {"type":"Heal Reduction","magnitude":100,"duration":2,"chance":0.5,"accuracy_check":true}, flags: { ...DMG_FLAGS } },
  F_VALLARYN_A2: { scalingStat: "ATK", multiplier: 3.9, terms: null, hitCount: 1, flags: { ...DMG_FLAGS } },
  F_VALLARYN_A3: { scalingStat: "ATK", multiplier: 2.8, terms: null, hitCount: 2, flags: { ...DMG_FLAGS } },
  F_SUN_A1: { scalingStat: "ATK", multiplier: 3.5, terms: null, hitCount: 1, flags: { ...DMG_FLAGS } },
  F_SUN_A2: { scalingStat: "ATK", multiplier: 5, terms: null, hitCount: 1, flags: { ...DMG_FLAGS } },
  F_SUN_A3: { scalingStat: "ATK", multiplier: 3.8, terms: null, hitCount: 1, flags: { ...DMG_FLAGS } },
  F_TUHANARAK_A1: { scalingStat: "DEF", multiplier: 4.1, terms: null, hitCount: 1, flags: { ...DMG_FLAGS } },
  F_TUHANARAK_A2: { scalingStat: "DEF", multiplier: 5.6, terms: null, hitCount: 1, flags: { ...DMG_FLAGS } },
  F_THOLIN_A1: { scalingStat: "ATK", multiplier: 2.5, terms: null, hitCount: 1, flags: { ...DMG_FLAGS } },
  F_THOLIN_A2: { scalingStat: "ATK", multiplier: 2.4, terms: null, hitCount: 2, ignoreDefIfBoss: 0.5, flags: { ...DMG_FLAGS } },
  F_THOLIN_A3: { scalingStat: "ATK", multiplier: 2, terms: null, hitCount: 2, flags: { ...DMG_FLAGS } },
  F_FAYNE_A1: { scalingStat: "ATK", multiplier: 1.55, terms: null, hitCount: 2, flags: { ...DMG_FLAGS } },
  F_FAYNE_A2: { scalingStat: "ATK", multiplier: 4.8, terms: null, hitCount: 1, flags: { ...DMG_FLAGS } },
  F_FAYNE_A3: { scalingStat: "ATK", multiplier: 1.8, terms: null, hitCount: 3, flags: { ...DMG_FLAGS } },
  // Bambus A1 Bamboo Splinter — damage_multiplier "3.8", multiplier_type "ATK"
  F_BAMBUS_A1: { scalingStat: 'ATK', multiplier: 3.8, terms: null, flags: { ...DMG_FLAGS }, hitCount: 1 },
  // Bambus A2 Grovetender — damage_multiplier "5.6", multiplier_type "ATK"
  F_BAMBUS_A2: { scalingStat: 'ATK', multiplier: 5.6, terms: null, flags: { ...DMG_FLAGS }, hitCount: 1 },

  // Ezio Auditore — all ATK
  F_EZIO_A1: { scalingStat: 'ATK', multiplier: 4, terms: null, flags: { ...DMG_FLAGS }, hitCount: 1 },
  F_EZIO_A2: { scalingStat: 'ATK', multiplier: 4, terms: null, flags: { ...DMG_FLAGS }, hitCount: 1 },
  // A3 "will ignore 35% of the target's DEF" — a fixed ignore-DEF flag on the hit.
  F_EZIO_A3: { scalingStat: 'ATK', multiplier: 5, terms: null, flags: { ...DMG_FLAGS, ignore_def: 0.35, ignore_shield: true }, hitCount: 1 },

  // Xenomorph — A1 3.9 ATK (DB damage_multiplier). A2/A3 stay on the auto-parser (A3's multiplier is not stored
  // in the DB — do NOT fabricate one). A1 carries his crit→3-Poison branch, which the auto-parser misses.
  F_XENO_A1: { scalingStat: 'ATK', multiplier: 3.9, terms: null, flags: { ...DMG_FLAGS }, hitCount: 1 },

  // Gnut (Legendary, Spirit, Defense) — DEF-SCALING tank (multiplier_type 'DEF', like Vergis). Target DEF-shred
  // still boosts these hits (ATK-vs-DEF attacks). A3 self-heals 30% of damage dealt (selfHealPctOfDamage) — his
  // only sustain, load-bearing for a tank seat.
  F_GNUT_A1: { scalingStat: 'DEF', multiplier: 1.1, terms: null, flags: { ...DMG_FLAGS }, hitCount: 3 },
  F_GNUT_A2: { scalingStat: 'DEF', multiplier: 3.5, terms: null, flags: { ...DMG_FLAGS }, hitCount: 1 },
  F_GNUT_A3: { scalingStat: 'DEF', multiplier: 1.5, terms: null, flags: { ...DMG_FLAGS }, hitCount: 3, selfHealPctOfDamage: 0.30 },

  // Mavara the Web Diviner (Legendary, Magic, Support) — revive/veil/strengthen sustain. Only A1 attacks.
  F_MAVARA_A1: { scalingStat: 'ATK', multiplier: 5, terms: null, flags: { ...DMG_FLAGS }, hitCount: 1 },

  // Glorious Pallas (Legendary, Magic, Support) — A1 attack + AoE heal 10% caster MaxHP (her main sustain, cd 0).
  F_GLORIOUS_A1: { scalingStat: 'ATK', multiplier: 6, terms: null, flags: { ...DMG_FLAGS }, hitCount: 1 },
  // Fahrakin the Fat (Epic, Spirit, Attack) — DoT + team-beatdown. A1 4.3 ATK + Decrease DEF; A2 7.3 ATK +
  // HP Burn + 2×Poison. A3 Beatdown has NO caster hit — it buffs then directs the ALLY_ATTACK (join).
  F_FAHRAKIN_A1: { scalingStat: 'ATK', multiplier: 4.3, terms: null, flags: { ...DMG_FLAGS }, hitCount: 1 },
  F_FAHRAKIN_A2: { scalingStat: 'ATK', multiplier: 7.3, terms: null, flags: { ...DMG_FLAGS }, hitCount: 1 },
  // Uugo (Epic, Magic, Support) — AoE Decrease-DEF debuffer + team heal/revive. A1 5.2 ATK single + Leech;
  // A2 4.8 ATK AoE + Decrease DEF; A3 no attack (cleanse/heal/clutch-revive).
  F_UUGO_A1: { scalingStat: 'ATK', multiplier: 5.2, terms: null, flags: { ...DMG_FLAGS }, hitCount: 1 },
  F_UUGO_A2: { scalingStat: 'ATK', multiplier: 4.8, terms: null, flags: { ...DMG_FLAGS }, hitCount: 1 },
  // Narma the Returned (Legendary, Magic, Support) — A2 attack + AoE heal 15% caster MaxHP; A1/A3 poison-nuke.
  F_NARMA_A1: { scalingStat: 'ATK', multiplier: 4.9, terms: null, flags: { ...DMG_FLAGS }, hitCount: 1 },
  F_NARMA_A2: { scalingStat: 'ATK', multiplier: 6.5, terms: null, flags: { ...DMG_FLAGS }, hitCount: 1 },
  F_NARMA_A3: { scalingStat: 'ATK', multiplier: 6.8, terms: null, flags: { ...DMG_FLAGS }, hitCount: 1 },

  // Stag Knight (Epic, Spirit, Support) — Decrease-DEF debuffer. A1 per-hit 30% [Decrease SPD] rides the formula
  // (each of 2 hits rolls independently, like F_NINJA_A2 / F_COLDHEART_A1). A2 AoE (hitCount 1 + all_enemies).
  F_STAG_A1: { scalingStat: 'ATK', multiplier: 4, terms: null, flags: { ...DMG_FLAGS }, hitCount: 2,
    onHitPlaceDebuff: { type: 'Decrease Speed', magnitude: 30, duration: 2, chance: 0.30, accuracy_check: true } },
  F_STAG_A2: { scalingStat: 'ATK', multiplier: 3.5, terms: null, flags: { ...DMG_FLAGS }, hitCount: 1 },

  // Kael (Rare, Magic, Attack) — starter Poison nuker. A1/A2/A3 ATK-scaled (DB damage_multiplier).
  // A2 "extra 15% chance of inflicting a critical hit" → critRateBonus (same field as F_COLDHEART_A3).
  // A3 "attacks 4 times at random" → hitCount 4 + randomTargetPerHit (each hit re-picks a random living target).
  F_KAEL_A1: { scalingStat: 'ATK', multiplier: 3.5, terms: null, flags: { ...DMG_FLAGS }, hitCount: 1 },
  F_KAEL_A2: { scalingStat: 'ATK', multiplier: 4.65, terms: null, critRateBonus: 15, flags: { ...DMG_FLAGS }, hitCount: 1 },
  F_KAEL_A3: { scalingStat: 'ATK', multiplier: 1.5, terms: null, flags: { ...DMG_FLAGS }, hitCount: 4, randomTargetPerHit: true },

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
  F_HORDIN_A2: { scalingStat: 'ATK', multiplier: 6.5, terms: null, flags: { ...DMG_FLAGS }, hitCount: 1, selfHealPctOfDamage: 0.10 },   // "heals this Champion by 10% of the damage inflicted" (interpreter dealOneHit)
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
    onHitPlaceDebuff: { type: 'HP Burn', duration: 3, chance: 0.75, accuracy_check: true },   // each of the 3 random hits rolls its own [HP Burn] 75% (interpreter DEAL_DAMAGE per-hit rider)
    activatePlacedBurnVsBoss: true },   // "vs Bosses, instantly activate any [HP Burn], INCLUDING those placed by this Skill" — PER HIT: each landed burn detonates → ~3×0.75≈2.25 ticks/cast, not one (first-party CB video 2026-08-08)
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
  // BATCH 2 (agent-authored; keys via champKey; damageless/unsupported-trigger deferred)
  "UNDERPRIEST-A1": {"champion":"Underpriest Brogni","slot":"A1","name":"Deepcrystal Scourge","type":"active","cooldown":0,"actions":[{"seq":10,"phase":"skill_start","op":"ACQUIRE_TARGETS","repeat":"once","target":"single"},{"seq":20,"phase":"per_target","op":"DEAL_DAMAGE","target":"current_target","repeat":"once","formulaId":"F_UNDERPRIEST_A1"},{"seq":30,"phase":"after_hit","op":"PLACE_DEBUFF","target":"intended_set","repeat":"per_target","effect":{"type":"HP Burn","duration":2,"chance":0.45,"accuracy_check":true}}],"covers":["HP Burn (45% 2t)"],"deferred":[]},
  "UNDERPRIEST-A2": {"champion":"Underpriest Brogni","slot":"A2","name":"Cavern's Grasp","type":"active","cooldown":4,"actions":[{"seq":10,"phase":"skill_start","op":"ACQUIRE_TARGETS","repeat":"once","target":"all_enemies"},{"seq":20,"phase":"per_target","op":"DEAL_DAMAGE","target":"current_target","repeat":"once","formulaId":"F_UNDERPRIEST_A2"},{"seq":30,"phase":"after_skill","op":"BUFF_STRIP","target":"intended_set","repeat":"once","effect":{"count":1,"chance":0.75}},{"seq":40,"phase":"after_skill","op":"CLEANSE","target":"all_allies","repeat":"once","effect":{"count":1,"chance":0.75}}],"covers":["removes 1 random buff from all enemies @75% (BUFF_STRIP)","removes 1 random debuff from all allies @75% (CLEANSE)"],"deferred":["increases the value of [Shield] buffs on all allies by 30% of the damage inflicted — BOOST_SHIELD only scales off caster MAX HP (pctOfCasterMaxHp), not a %-of-damage-inflicted source, so this cannot be modelled faithfully (self-combo with his own A3 Shield); deferred pending a damage-scaled BOOST_SHIELD input","BUFF_STRIP/CLEANSE 75% chance passed in effect.chance but the ops may treat the removal as guaranteed — chance-gating of strip/cleanse not confirmed in the interpreter"]},
  "UNDERPRIEST-A3": {"champion":"Underpriest Brogni","slot":"A3","name":"Resilient Glow","type":"active","cooldown":5,"actions":[{"seq":10,"phase":"skill_start","op":"PLACE_BUFF","target":"all_allies","repeat":"once","effect":{"type":"Increase ATK","magnitude":50,"duration":2}},{"seq":20,"phase":"after_skill","op":"PLACE_BUFF","target":"all_allies","repeat":"once","effect":{"type":"Shield","pctOfCasterMaxHp":0.3,"duration":2}}],"covers":["50% Increase ATK on all allies 2t","Shield = 30% of caster MAX HP on all allies 2t"],"deferred":["[Block Debuffs] buff on all allies 2t — [Block Debuffs] has no engine consumer (not in CONSUMED_EFFECTS/consumer registry); placing it would be inert","the [Shield] buff cannot be removed — 'unremovable' flag not modelled (Shield still placed normally; only its immunity-to-strip is dropped)"]},
  "UNDERPRIEST-PASSIVE": {"champion":"Underpriest Brogni","slot":"Passive","name":"Redoubt","type":"passive","cooldown":null,"covers":[],"deferred":["whenever an ally under a [Shield] buff is attacked, reflects 25% of the damage inflicted on the [Shield] back to the attacker AND heals that ally by 25% of the damage inflicted on the [Shield] — needs op: REFLECT_SHIELD_DAMAGE (reactive reflect-of-shield-absorbed-damage + ally self-heal) fired on a new 'ally_under_shield_attacked' trigger event; neither the op nor the event exists (REDIRECT_DAMAGE/reflect is implemented:false)","'if multiple Champions have this Skill, only one activates' — single-copy dedup not modelled (single Brogni on a team → no-op)"]},
  "THOR-A1": {"champion":"Thor","slot":"A1","name":"Wrath of Mjolnir","type":"active","cooldown":0,"actions":[{"seq":10,"phase":"skill_start","op":"ACQUIRE_TARGETS","repeat":"once","target":"single"},{"seq":20,"phase":"per_target","op":"DEAL_DAMAGE","target":"current_target","repeat":"once","formulaId":"F_THOR_A1"},{"seq":30,"phase":"after_hit","op":"REDUCE_TURN_METER","target":"intended_set","repeat":"once","effect":{"pct":0.2}}],"covers":["decreases target Turn Meter by 10% per hit (2 hits → −20%, REDUCE_TURN_METER)"],"deferred":["20% chance of repeating the whole 2-hit attack — no full-attack repeat op (extraHitChance is a per-hit proc, not a repeat of the multi-hit sequence); when it procs it would add 2 more hits and 2 more −10% TM decreases, not modelled"]},
  "THOR-A2": {"champion":"Thor","slot":"A2","name":"Fulminous Ricochet","type":"active","cooldown":4,"actions":[{"seq":10,"phase":"skill_start","op":"ACQUIRE_TARGETS","repeat":"once","target":"all_enemies"},{"seq":20,"phase":"per_target","op":"DEAL_DAMAGE","target":"current_target","repeat":"once","formulaId":"F_THOR_A2"}],"covers":["AoE 5×ATK; ignores [Block Damage] (interpreter honours ignore_block_damage) and [Unkillable] (ignore_unkillable flag set)"],"deferred":["each subsequent enemy hit after the initial one increases damage inflicted by 25%, stacks up to +100% — sequential AoE damage ramp has no op/field (flat 5×ATK per enemy used)","enemies after the initial target are hit in a random order — hit-ordering not modelled (no damage impact under the flat model)","the [Block Damage]/[Unkillable] ignore does not work against Bosses — per-target boss exception on the ignore flags not modelled","ignore_unkillable is a registered-but-not-yet-honoured formula flag (operations.MODIFIERS status ○) — ignore_block_damage IS honoured"]},
  "THOR-A3": {"champion":"Thor","slot":"A3","name":"Hammer of Heaven","type":"active","cooldown":4,"actions":[{"seq":10,"phase":"skill_start","op":"PLACE_BUFF","target":"self","repeat":"once","effect":{"type":"Increase ATK","magnitude":50,"duration":2}},{"seq":15,"phase":"skill_start","op":"ACQUIRE_TARGETS","repeat":"once","target":"all_enemies"},{"seq":20,"phase":"per_target","op":"DEAL_DAMAGE","target":"current_target","repeat":"once","formulaId":"F_THOR_A3"},{"seq":30,"phase":"after_hit","op":"PLACE_DEBUFF","target":"intended_set","repeat":"per_target","effect":{"type":"Decrease Speed","magnitude":30,"duration":2,"chance":0.75,"accuracy_check":true}}],"covers":["self [Increase ATK] 50% 2t placed before the attack (boosts this hit; consumed by engine statFactor)","75% chance of 30% [Decrease SPD] 2t on all enemies"],"deferred":["self [Increase C.DMG] 30% 2t — C.DMG has no engine consumer (not in STAT_MODS/CONSUMED_EFFECTS); placing it would be inert","75% chance to PERMANENTLY decrease each enemy's RES by 10% (stacks up to 50%) — Decrease RES has no engine consumer (no res in STAT_MODS) and permanent-stacking stat-shred has no op; inert"]},
  "THOR-A4": {"champion":"Thor","slot":"A4","name":"Sky Rupture [P]","type":"passive","cooldown":null,"covers":[],"deferred":["[Thunder] counter +1 every time this Champion deals damage (stacks up to 10) — on-damage-dealt self counter has no op (trigger event 'damage_dealt' not supported)","each [Thunder] stack increases this Champion's DMG by 3% (stacks up to +30%) — self DMG% ramp tied to the counter has no consumer/op","once [Thunder] reaches 10: attacks all enemies and places [Stun] 1t, then resets the counter to 0 — threshold-triggered AoE + Stun has no damage-dealt-counter trigger op AND no DB damage multiplier for the attack (null; cannot fabricate)"]},
  "DONATELLO-A1": {"champion":"Donatello","slot":"A1","name":"Bo-dacious Bash","type":"active","cooldown":0,"actions":[{"seq":10,"phase":"skill_start","op":"ACQUIRE_TARGETS","repeat":"once","target":"single"},{"seq":20,"phase":"per_target","op":"DEAL_DAMAGE","target":"current_target","repeat":"once","formulaId":"F_DONATELLO_A1"},{"seq":30,"phase":"after_skill","op":"HEAL","target":"all_allies","repeat":"once","effect":{"pctOfCasterMaxHp":0.05}}],"covers":["heals all allies 5% of caster MAX HP"],"deferred":["\"Instantly activates one random [Continuous Heal] buff on all allies\" -- buff ACTIVATION (force an existing ally [Continuous Heal] to tick now), not a placement (policy #12). No BUFF_ACTIVATION op (DEBUFF_ACTIVATION is enemy-DoT only) -- needs op: BUFF_ACTIVATION"]},
  "DONATELLO-A2": {"champion":"Donatello","slot":"A2","name":"Shellshocker","type":"active","cooldown":6,"actions":[{"seq":10,"phase":"skill_start","op":"ACQUIRE_TARGETS","repeat":"once","target":"all_enemies"},{"seq":20,"phase":"per_target","op":"DEAL_DAMAGE","target":"current_target","repeat":"once","formulaId":"F_DONATELLO_A2"},{"seq":30,"phase":"after_skill","op":"DECREASE_COOLDOWN","target":"allies","repeat":"once","effect":{"turns":2}},{"seq":40,"phase":"after_skill","op":"PLACE_BUFF","target":"all_allies","repeat":"once","effect":{"type":"Increase SPD","magnitude":30,"duration":2}}],"covers":["decreases the cooldowns of all allies' skills except self by 2 turns (DECREASE_COOLDOWN skips the actor)","30% [Increase SPD] on all allies 2t (consumed by engine speed mods)"],"deferred":["\"This skill's cooldown cannot be decreased or reset\" -- self-restriction on cooldown manipulation, not an action; no negative effect to model"]},
  "DONATELLO-A3": {"champion":"Donatello","slot":"A3","name":"Secret of the Ooze","type":"active","cooldown":6,"actions":[{"seq":10,"phase":"skill_start","op":"CLEANSE","target":"all_allies","repeat":"once"},{"seq":20,"phase":"after_skill","op":"PLACE_BUFF","target":"all_allies","repeat":"once","effect":{"type":"Continuous Heal","magnitude":15,"duration":2}},{"seq":30,"phase":"after_skill","op":"PLACE_BUFF","target":"all_allies","repeat":"once","effect":{"type":"Strengthen","magnitude":25,"duration":2}},{"seq":40,"phase":"after_skill","op":"FILL_TURN_METER","target":"all_allies","repeat":"once","effect":{"pct":0.2}}],"covers":["removes all debuffs from all allies (CLEANSE)","15% [Continuous Heal] on all allies 2t (sustain, consumed)","25% [Strengthen] on all allies 2t (consumed)","fills all allies' Turn Meters by 20% (FILL_TURN_METER; pct is a fraction -> x100 = 20 pts)"],"deferred":[]},
  "DONATELLO-A4": {"champion":"Donatello","slot":"A4","name":"I Got You Bro! [P]","type":"passive","cooldown":6,"covers":[],"deferred":["[Passive] TMNT join-attack: fires on THIS Champion's own attacks and only specific NAMED allies join -- the 'self_attack' trigger event is not in the engine trigger set, and there is no named-ally recipient. Left inert (no over-credit): needs op: self_attack trigger event + name-gated ALLY_ATTACK recipient","[Active, cd6] on an ally's fatal hit, prevent death (keep at 1 HP) then raise that ally to the team's AVERAGE HP -- no fatal-hit reactive-save trigger, and EQUALIZE_HP raises to the HIGHEST ally (not the average). needs op: fatal-hit prevention trigger + equalize-to-average","\"only one activates if multiple copies have this skill\" / \"will not activate on duplicate copies if this Champion is dead\" -- de-dupe/self-death restrictions on the active effect; not modellable until the save op exists","reactive trigger on \"self_attack\" — event not built"]},
  "MORAG-A1": {"champion":"Morag Bronzelock","slot":"A1","name":"Raw Iron Slab","type":"active","cooldown":0,"actions":[{"seq":10,"phase":"skill_start","op":"ACQUIRE_TARGETS","repeat":"once","target":"single"}],"covers":["attacks 1 enemy 2 times; each hit ignores [Shield] buffs (formula flag ignore_shield)"],"deferred":["damage multiplier not in DB (multiplier + multiplierType both null) — F_MORAG_A1 multiplier:null, scalingStat defaulted to ATK; no damage computed until a real multiplier is captured","damage multiplier not in DB — DEAL_DAMAGE omitted"]},
  "MORAG-A2": {"champion":"Morag Bronzelock","slot":"A2","name":"Outrage","type":"active","cooldown":4,"actions":[{"seq":10,"phase":"skill_start","op":"ACQUIRE_TARGETS","repeat":"once","target":"all_enemies"},{"seq":30,"phase":"after_skill","op":"PLACE_BUFF","target":"all_allies","repeat":"once","effect":{"type":"Strengthen","magnitude":25,"duration":2}}],"covers":["25% [Strengthen] on all allies 2t (consumed by engine.strengthenFactor — −25% incoming damage)"],"deferred":["damage multiplier not in DB (multiplier + multiplierType both null) — F_MORAG_A2 multiplier:null, scalingStat defaulted to ATK; no damage computed until a real multiplier is captured","damage multiplier not in DB — DEAL_DAMAGE omitted"]},
  "MORAG-A3": {"champion":"Morag Bronzelock","slot":"A3","name":"Raider Captain","type":"active","cooldown":6,"actions":[{"seq":10,"phase":"skill_start","op":"ACQUIRE_TARGETS","repeat":"once","target":"single"},{"seq":25,"phase":"per_target","op":"ALLY_ATTACK","who":"random_ally_except_self","slot":"A1","repeat":"once"},{"seq":30,"phase":"after_skill","op":"EXTRA_TURN","onKill":true,"repeat":"once"}],"covers":["Morag + random ally join-attack a single enemy with default skills (ALLY_ATTACK)","grants an Extra Turn if any enemy is killed (EXTRA_TURN onKill)"],"deferred":["damage multiplier not in DB (multiplier + multiplierType both null) — F_MORAG_A3 multiplier:null, scalingStat defaulted to ATK; no damage computed until a real multiplier is captured","skill teams with TWO random allies but ALLY_ATTACK 'who' only supports a single random_ally_except_self — the SECOND joiner is not fired (count>1 unsupported by the op)","damage multiplier not in DB — DEAL_DAMAGE omitted"]},
  "MORAG-A4": {"champion":"Morag Bronzelock","slot":"A4","name":"Test This Might","type":"passive","cooldown":null,"triggers":[{"on":"attacked","when":{"left":"self_has_buff","cmp":"==","right":"Strengthen"},"actions":[{"op":"COUNTERATTACK","slot":"A1"}]}],"covers":["counterattacks (re-runs A1 at the attacker) when hit while under a self-[Strengthen] buff (attacked trigger → COUNTERATTACK)"],"deferred":["gate 'under a [Strengthen] buff placed by THIS Champion' is approximated as self-has-[Strengthen] — the placed-by-self provenance of the buff is not tracked, so the counterattack may fire under a [Strengthen] granted by an ally; if the 'self_has_buff' condition key is not honoured by the interpreter the counterattack would fire unconditionally (over-credit risk)"]},
  "DEACON-A1": {"champion":"Deacon Armstrong","slot":"A1","name":"Mace of Contempt","type":"active","cooldown":0,"actions":[{"seq":10,"phase":"skill_start","op":"ACQUIRE_TARGETS","repeat":"once","target":"single"},{"seq":20,"phase":"per_target","op":"DEAL_DAMAGE","target":"current_target","repeat":"once","formulaId":"F_DEACON_A1"},{"seq":30,"phase":"after_hit","op":"PLACE_DEBUFF","target":"intended_set","repeat":"per_target","effect":{"type":"Leech","duration":2,"chance":0.3,"accuracy_check":true}}],"covers":["Leech"],"deferred":["each of the 2 hits rolls [Leech] independently at 30% — modelled as one 30% placement roll (Hilvi-A1 pattern); slightly understates net land chance"]},
  "DEACON-A2": {"champion":"Deacon Armstrong","slot":"A2","name":"Sweeping Retribution","type":"active","cooldown":4,"actions":[{"seq":10,"phase":"skill_start","op":"ACQUIRE_TARGETS","repeat":"once","target":"all_enemies"},{"seq":20,"phase":"per_target","op":"DEAL_DAMAGE","target":"current_target","repeat":"once","formulaId":"F_DEACON_A2"},{"seq":30,"phase":"after_hit","op":"PLACE_DEBUFF","target":"intended_set","repeat":"per_target","effect":{"type":"Decrease Defense","magnitude":60,"duration":2,"chance":0.8,"accuracy_check":true}}],"covers":["Decrease DEF (AoE)"],"deferred":[]},
  "DEACON-A3": {"champion":"Deacon Armstrong","slot":"A3","name":"Time Compression","type":"active","cooldown":5,"actions":[{"seq":10,"phase":"skill_start","op":"ACQUIRE_TARGETS","repeat":"once","target":"all_enemies"},{"seq":20,"phase":"skill_start","op":"FILL_TURN_METER","target":"all_allies","repeat":"once","effect":{"pct":0.15}},{"seq":30,"phase":"after_skill","op":"REDUCE_TURN_METER","target":"intended_set","repeat":"once","effect":{"pct":0.15,"accuracy_check":true}},{"seq":40,"phase":"after_skill","op":"EXTRA_TURN","repeat":"once"}],"covers":["fills all allies Turn Meter 15% (FILL_TURN_METER)","decreases all enemies Turn Meter 15% (REDUCE_TURN_METER over acquired all_enemies)","grants self an Extra Turn (EXTRA_TURN)"],"deferred":[]},
  "DUCHESS-A1": {"champion":"Duchess Lilitu","slot":"A1","name":"Abyssal Invocation","type":"active","cooldown":0,"actions":[{"seq":10,"phase":"skill_start","op":"ACQUIRE_TARGETS","repeat":"once","target":"single"},{"seq":20,"phase":"per_target","op":"DEAL_DAMAGE","target":"current_target","repeat":"once","formulaId":"F_DUCHESS_A1"},{"seq":30,"phase":"after_skill","op":"PLACE_BUFF","target":"self","repeat":"once","effect":{"type":"Shield","pctOfCasterMaxHp":0.1,"duration":2}},{"seq":40,"phase":"after_skill","op":"PLACE_BUFF","target":"lowest_hp_ally","repeat":"once","effect":{"type":"Shield","pctOfCasterMaxHp":0.1,"duration":2}}],"covers":["attacks 1 enemy 2 times (DEF-scaling)","[Shield] 10% caster MAX HP 2t on self","[Shield] 10% caster MAX HP 2t on lowest-HP ally"],"deferred":[]},
  "DUCHESS-A2": {"champion":"Duchess Lilitu","slot":"A2","name":"Shroud of Souls","type":"active","cooldown":5,"actions":[{"seq":10,"phase":"skill_start","op":"PLACE_BUFF","target":"all_allies","repeat":"once","effect":{"type":"Increase ATK","magnitude":50,"duration":2}},{"seq":20,"phase":"after_skill","op":"PLACE_BUFF","target":"all_allies_except_self","repeat":"once","effect":{"type":"Perfect Veil","duration":2}}],"covers":["50% [Increase ATK] on all allies 2t","[Perfect Veil] on all allies except self 2t"],"deferred":["[Block Debuffs] buff on all allies 2t — [Block Debuffs] has no engine consumer (not in CONSUMED_EFFECTS); placing it would be inert"]},
  "DUCHESS-A3": {"champion":"Duchess Lilitu","slot":"A3","name":"Spectral Rebirth","type":"active","cooldown":6,"actions":[{"seq":10,"phase":"skill_start","op":"REVIVE","target":"all_dead_allies","repeat":"once","effect":{"hpPct":0.7}},{"seq":20,"phase":"after_skill","op":"PLACE_BUFF","target":"all_allies_except_self","repeat":"once","effect":{"type":"Veil","duration":1}},{"seq":30,"phase":"after_skill","op":"PLACE_BUFF","target":"all_allies","repeat":"once","effect":{"type":"Continuous Heal","magnitude":15,"duration":2}}],"covers":["revives all dead allies at 70% HP","[Veil] on all allies except self 1t","15% [Continuous Heal] on all allies 2t"],"deferred":[]},
  "DUCHESS-PASSIVE": {"champion":"Duchess Lilitu","slot":"Passive","name":"Ethereal Ways [P]","type":"passive","cooldown":null,"covers":[],"deferred":["Decreases damage taken by all allies from AoE attacks by 25% (15% from Bosses) — static always-on damage-reduction aura scoped to AoE hits; no op/flag for a party-wide conditional incoming-damage multiplier — needs op: AOE_DAMAGE_REDUCTION_AURA"]},
  "LORD-A1": {"champion":"Lord Entertainer Fabian","slot":"A1","name":"Service In Death","type":"active","cooldown":0,"actions":[{"seq":10,"phase":"skill_start","op":"ACQUIRE_TARGETS","repeat":"once","target":"single"},{"seq":30,"phase":"after_hit","op":"REDUCE_TURN_METER","target":"intended_set","repeat":"once","effect":{"pct":0.1}},{"seq":32,"phase":"after_hit","op":"REDUCE_TURN_METER","target":"intended_set","repeat":"once","effect":{"pct":0.1}},{"seq":40,"phase":"after_skill","op":"PLACE_DEBUFF","target":"intended_set","repeat":"per_target","condition":{"kind":"tm_depleted"},"effect":{"type":"True Fear","duration":2,"guaranteed":true,"accuracy_check":true}}],"covers":["steals 10% Turn Meter per hit (REDUCE_TURN_METER x2 hits)","[True Fear] 2t if target Turn Meter fully depleted (consumer: CC guaranteed-misfire; condition tm_depleted)"],"deferred":["damage multiplier not in DB (multiplier=null) — 'Attacks 1 enemy 2 times' modelled with no DEAL_DAMAGE (no multiplier to fabricate)","each hit STEALS the drained Turn Meter to Fabian (self-fill) — STEAL_TURN_METER is implemented:false; modelled as an enemy drain only (REDUCE_TURN_METER), the self-fill half is omitted"]},
  "LORD-A2": {"champion":"Lord Entertainer Fabian","slot":"A2","name":"Unwelcome Guest","type":"active","cooldown":null,"actions":[{"seq":10,"phase":"skill_start","op":"ACQUIRE_TARGETS","repeat":"once","target":"single"},{"seq":30,"phase":"after_hit","op":"PLACE_DEBUFF","target":"intended_set","repeat":"per_target","effect":{"type":"Petrification","duration":1,"guaranteed":true,"accuracy_check":true}},{"seq":40,"phase":"after_skill","op":"ACQUIRE_TARGETS","repeat":"once","target":"all_enemies"},{"seq":50,"phase":"after_skill","op":"PLACE_DEBUFF","target":"intended_set","repeat":"per_target","effect":{"type":"True Fear","duration":2,"chance":0.75,"accuracy_check":true}}],"covers":["[Petrification] 1t on the primary target (consumer: hard CC)","75% [True Fear] 2t on the other enemies (consumer: CC guaranteed-misfire)"],"deferred":["damage multiplier not in DB (multiplier=null) — 'Attacks 1 enemy' modelled with no DEAL_DAMAGE","cooldown not in DB (cooldown=null) — left null rather than fabricated; a null cd risks the engine firing this every turn (over-CC) until captured","the 75% [True Fear] should hit all OTHER enemies (exclude the primary [Petrification] target) AND skip enemies already under [Fear]/[True Fear] — modelled on all_enemies via a mid-skill re-ACQUIRE (no other_enemies recipient enum, no compound not-under-[Fear]/[True Fear] condition); minor over-credit re-Fearing the already-Petrified primary","[Passive Effect] re-activates this skill whenever an enemy under a [Fear]/[True Fear] debuff successfully uses a skill; 'only one copy activates' if multiple champions share it — needs op: 'enemy_skill_used_under_fear' reactive trigger event"]},
  "LORD-A3": {"champion":"Lord Entertainer Fabian","slot":"A3","name":"Spectral Flourish","type":"active","cooldown":null,"actions":[{"seq":10,"phase":"skill_start","op":"ACQUIRE_TARGETS","repeat":"once","target":"all_enemies"},{"seq":15,"phase":"before_attack","op":"REDUCE_EFFECT_DURATION","target":"intended_set","repeat":"once","effect":{"turns":3,"chance":0.75}},{"seq":30,"phase":"after_hit","op":"INCREASE_COOLDOWN","target":"intended_set","repeat":"once","effect":{"chance":0.75}}],"covers":["75% decrease duration of all enemy buffs by 3t (REDUCE_EFFECT_DURATION — buff-strip-by-duration)","75% increase cooldowns of all enemy skills (INCREASE_COOLDOWN)"],"deferred":["damage multiplier not in DB (multiplier=null) — 'Attacks all enemies' modelled with no DEAL_DAMAGE","cooldown not in DB (cooldown=null) — left null rather than fabricated","INCREASE_COOLDOWN sets each enemy skill to its FULL cooldown; the card adds +3 turns specifically (op sets cdLeft = cooldown, not +3)","grants an Extra Turn if there are NO buffs on the enemy team after this attack — EXTRA_TURN exists but has no 'if no enemy buffs remain' conditional gate (only onKill/unconditional) — needs op: conditional extra-turn gate"]},
  "LORD-PASSIVE": {"champion":"Lord Entertainer Fabian","slot":"PASSIVE","name":"Ghost With The Most","type":"passive","cooldown":null,"covers":[],"deferred":["whenever an enemy is REVIVED → place [True Fear] 2t on that enemy; 'only one copy activates' if multiple champions share it — needs op: 'enemy_revived' reactive trigger event (no such event exists)","before the start of his turn, removes [Stun]/[Freeze]/[Provoke]/[Fear]/[True Fear]/[Petrification] from HIMSELF (self-cleanse of hard CC) — CLEANSE is not in the passive TRIGGER_OP_HANDLERS surface (only PLACE_BUFF/PLACE_DEBUFF/HEAL/WAKE_FROM_SLEEP/COUNTERATTACK/STEAL_BUFF/REDUCE_TURN_METER), so a start_of_turn self-cleanse cannot dispatch — needs op: CLEANSE (or a WAKE_FROM_SLEEP-style self-deCC) on the trigger surface"]},
  "VALLARYN-A1": {"champion":"Vallaryn the Equalizer","slot":"A1","name":"Violent Harmony","type":"active","cooldown":0,"actions":[{"seq":10,"phase":"skill_start","op":"ACQUIRE_TARGETS","repeat":"once","target":"single"},{"seq":20,"phase":"per_target","op":"DEAL_DAMAGE","target":"current_target","repeat":"once","formulaId":"F_VALLARYN_A1"}],"covers":["attacks 1 enemy 2 times (F_VALLARYN_A1)","self-heal 20% of damage inflicted per hit via F_VALLARYN_A1.selfHealPctOfDamage","per-hit 50% chance of 100% [Heal Reduction] 2t via F_VALLARYN_A1.onHitPlaceDebuff (Heal Reduction consumed by engine)"],"deferred":[]},
  "VALLARYN-A2": {"champion":"Vallaryn the Equalizer","slot":"A2","name":"Precise Intervention","type":"active","cooldown":4,"actions":[{"seq":10,"phase":"skill_start","op":"ACQUIRE_TARGETS","repeat":"once","target":"all_enemies"},{"seq":20,"phase":"per_target","op":"DEAL_DAMAGE","target":"current_target","repeat":"once","formulaId":"F_VALLARYN_A2"},{"seq":30,"phase":"after_hit","op":"PLACE_DEBUFF","target":"intended_set","repeat":"per_target","effect":{"type":"Leech","duration":2,"chance":0.75,"accuracy_check":true}}],"covers":["attacks all enemies (F_VALLARYN_A2)","[Leech] 2t @75% on all enemies (Leech consumed by engine)"],"deferred":["25% [Weaken] 2t on all enemies — [Weaken] has no engine consumer (not in CONSUMED_EFFECTS); placing it would be inert","in-game the [Weaken] + [Leech] share ONE 75% placement roll; modelled as an independent 75% Leech roll (identical in EV)"]},
  "VALLARYN-A3": {"champion":"Vallaryn the Equalizer","slot":"A3","name":"Outcome Assured","type":"active","cooldown":5,"actions":[{"seq":10,"phase":"skill_start","op":"CLEANSE","target":"self","repeat":"once","effect":{"count":99}},{"seq":20,"phase":"skill_start","op":"ACQUIRE_TARGETS","repeat":"once","target":"single"},{"seq":30,"phase":"per_target","op":"DEAL_DAMAGE","target":"current_target","repeat":"once","formulaId":"F_VALLARYN_A3"}],"covers":["before attacking, removes all debuffs from this Champion (CLEANSE self)","attacks 1 enemy 2 times, ignoring 15% of the target's DEF (F_VALLARYN_A3 flags.ignore_def 0.15)"],"deferred":["'swaps HP with the target' before attacking — needs op: SWAP_HP (implemented:false); EQUALIZE_HP is an ally-side raise-to-highest, not a caster<->enemy HP exchange, so it does not apply","conditional upgrade: ignore 30% of the target's DEF AND any [Shield] buffs INSTEAD, if this Champion's current HP > the target's — dynamic HP comparison / ignore-DEF+ignore-shield swap not modelled (base 15% ignore_def applied)"]},
  "VALLARYN-PASSIVE": {"champion":"Vallaryn the Equalizer","slot":"Passive","name":"My True Purpose [P]","type":"passive","cooldown":3,"covers":["[Active Effect] decreases the cooldown of one of this Champion's skills by 2 turns when she loses >=30% HP from an enemy skill in a single turn (DECREASE_COOLDOWN self, gated by the new hp_loss_threshold trigger)","[Passive Effect] counterattacks with default skill each time an enemy is healed by a skill, once per turn (COUNTERATTACK, gated by the new enemy_healed trigger)"],"deferred":["reactive trigger on \"hp_loss_threshold\" — event not built","reactive trigger on \"enemy_healed\" — event not built"]},
  "SUN-A1": {"champion":"Sun Wukong","slot":"A1","name":"Gotcha!","type":"active","cooldown":0,"actions":[{"seq":10,"phase":"skill_start","op":"ACQUIRE_TARGETS","repeat":"once","target":"single"},{"seq":20,"phase":"per_target","op":"DEAL_DAMAGE","target":"current_target","repeat":"once","formulaId":"F_SUN_A1"},{"seq":30,"phase":"after_hit","op":"PLACE_DEBUFF","target":"intended_set","repeat":"per_target","effect":{"type":"Stun","duration":1,"chance":0.25,"accuracy_check":true}}],"covers":["Stun 1t @25%"],"deferred":["Stun chance rises to 50% if the target has any buffs — dynamic conditional chance not modelled (base 25% used)"]},
  "SUN-A2": {"champion":"Sun Wukong","slot":"A2","name":"Staff of Wonder","type":"active","cooldown":4,"actions":[{"seq":10,"phase":"skill_start","op":"ACQUIRE_TARGETS","repeat":"once","target":"single"},{"seq":20,"phase":"per_target","op":"DEAL_DAMAGE","target":"current_target","repeat":"once","formulaId":"F_SUN_A2"}],"covers":["ignore 50% of target DEF (F_SUN_A2 flags.ignore_def 0.5)"],"deferred":["on killing the target, attacks all remaining enemies with any surplus/overkill damage (also ignoring 50% DEF; this splash cannot be critical) — needs op: SURPLUS_DAMAGE_SPLASH (overkill carry-over), not built","if the initial target SURVIVES, places a [Sheep] debuff 1t (cannot be blocked) — [Sheep] has no engine consumer (not in the consumer registry); placing it would be inert. Functionally turn-denial CC but no consumer exists"]},
  "SUN-A3": {"champion":"Sun Wukong","slot":"A3","name":"Now You See Us","type":"active","cooldown":4,"actions":[{"seq":10,"phase":"skill_start","op":"ACQUIRE_TARGETS","repeat":"once","target":"all_enemies"},{"seq":15,"phase":"before_attack","op":"STEAL_BUFF","target":"intended_set","repeat":"once"},{"seq":20,"phase":"per_target","op":"DEAL_DAMAGE","target":"current_target","repeat":"once","formulaId":"F_SUN_A3"}],"covers":["steals all buffs from all enemies before attacking (STEAL_BUFF)"],"deferred":["places [Block Buffs] 2t on all enemies (after the steal, before the attack) — [Block Buffs] has no engine consumer (not in CONSUMED_EFFECTS); placing it would be inert"]},
  "SUN-A4": {"champion":"Sun Wukong","slot":"A4","name":"Unbeatable Wukong [P]","type":"passive","cooldown":null,"covers":[],"deferred":["revives THIS Champion at 100% HP + 100% Turn Meter exactly 3 turns after being killed (timed self-revive) — needs op: TIMED_SELF_REVIVE (on_death trigger + turn-countdown self-revive). The REVIVE op targets dead ALLIES with no delay and is not a self-revive (Tag policy #21: self-revive is personal durability, not team recovery), so it cannot express this"]},
  "TUHANARAK-A1": {"champion":"Tuhanarak","slot":"A1","name":"Sun's Kiss","type":"active","cooldown":0,"actions":[{"seq":10,"phase":"skill_start","op":"ACQUIRE_TARGETS","repeat":"once","target":"single"},{"seq":20,"phase":"per_target","op":"DEAL_DAMAGE","target":"current_target","repeat":"once","formulaId":"F_TUHANARAK_A1"},{"seq":30,"phase":"after_hit","op":"PLACE_DEBUFF","target":"intended_set","repeat":"per_target","effect":{"type":"Decrease Speed","magnitude":30,"duration":2,"chance":0.3,"accuracy_check":true}},{"seq":40,"phase":"after_skill","op":"PLACE_BUFF","target":"self","repeat":"once","effect":{"type":"Continuous Heal","magnitude":15,"duration":1}},{"seq":50,"phase":"after_skill","op":"PLACE_BUFF","target":"lowest_hp_ally","repeat":"once","effect":{"type":"Continuous Heal","magnitude":15,"duration":1}}],"covers":["30% Decrease SPD 2t @30%","15% Continuous Heal on self 1t","15% Continuous Heal on lowest-HP ally 1t"],"deferred":[]},
  "TUHANARAK-A2": {"champion":"Tuhanarak","slot":"A2","name":"Radiant Suffering","type":"active","cooldown":4,"actions":[{"seq":10,"phase":"skill_start","op":"ACQUIRE_TARGETS","repeat":"once","target":"single"},{"seq":20,"phase":"per_target","op":"DEAL_DAMAGE","target":"current_target","repeat":"once","formulaId":"F_TUHANARAK_A2"},{"seq":30,"phase":"after_hit","op":"PLACE_DEBUFF","target":"intended_set","repeat":"per_target","effect":{"type":"Decrease Attack","magnitude":50,"duration":2,"chance":0.75,"accuracy_check":true}},{"seq":50,"phase":"after_hit","op":"SPREAD_DEBUFFS","target":"intended_set","repeat":"once"}],"covers":["50% Decrease ATK 2t @75%","Debuff Spread: copy debuffs from the target onto all enemies (SPREAD_DEBUFFS)"],"deferred":["[Block Buffs] debuff 2t @75% — no engine consumer (not in CONSUMED_EFFECTS); placing it would be inert","Debuff Spread takes 2 RANDOM debuffs from the target; engine SPREAD_DEBUFFS copies ALL of the target's debuffs onto every other enemy (superset when the target has >2 debuffs)"]},
  "TUHANARAK-A3": {"champion":"Tuhanarak","slot":"A3","name":"Desert Fitness","type":"active","cooldown":5,"actions":[{"seq":10,"phase":"skill_start","op":"PLACE_BUFF","target":"all_allies","repeat":"once","effect":{"type":"Increase DEF","magnitude":60,"duration":2}},{"seq":20,"phase":"skill_start","op":"PLACE_BUFF","target":"all_allies","repeat":"once","effect":{"type":"Increase SPD","magnitude":30,"duration":2}}],"covers":["60% Increase DEF on all allies 2t","30% Increase SPD on all allies 2t"],"deferred":[]},
  "TUHANARAK-PASSIVE": {"champion":"Tuhanarak","slot":"Passive","name":"Inviolable [P]","type":"passive","cooldown":null,"triggers":[{"on":"start_of_turn","actions":[{"op":"CLEANSE","target":"all_allies","effect":{"count":1}}]}],"covers":["removes 1 random debuff from all allies at the start of each turn (start_of_turn CLEANSE count 1)"],"deferred":["removes 2 random debuffs INSTEAD from allies currently under a [Continuous Heal] buff — per-ally conditional cleanse count not expressible (engine CLEANSE is untyped + one count across all recipients); modelled as flat count 1"]},
  "THOLIN-A1": {"champion":"Tholin Foulbeard","slot":"A1","name":"Demonbreaker","type":"active","cooldown":0,"actions":[{"seq":10,"phase":"skill_start","op":"ACQUIRE_TARGETS","repeat":"once","target":"all_enemies"},{"seq":20,"phase":"per_target","op":"DEAL_DAMAGE","target":"current_target","repeat":"once","formulaId":"F_THOLIN_A1"}],"covers":["AoE ATK attack (all enemies)"],"deferred":["before attacking, 25% chance of a 25% [Weaken] 2t on all enemies — [Weaken] has no engine consumer (not in consumer registry); placing it would be inert","50% chance of a 25% [Weaken] 2t if target is Corrupted Alliance/Boss/minion, unresistable by them — [Weaken] inert (no consumer); resistance-bypass moot","grants an Extra Turn if a [Weaken] was placed on ALL enemies — EXTRA_TURN op exists but the gate depends on [Weaken] (unmodelled), so it is not wired"]},
  "THOLIN-A2": {"champion":"Tholin Foulbeard","slot":"A2","name":"Back to the Abyss","type":"active","cooldown":4,"actions":[{"seq":10,"phase":"skill_start","op":"ACQUIRE_TARGETS","repeat":"once","target":"single"},{"seq":20,"phase":"per_target","op":"DEAL_DAMAGE","target":"current_target","repeat":"once","formulaId":"F_THOLIN_A2"}],"covers":["single-target 2-hit attack; each hit ignores 25% of the target's DEF (50% vs a Boss via ignoreDefIfBoss)"],"deferred":["each hit −5% [Decrease Attack] stacking up to 25% — per-hit small-magnitude stacking; the statFactor consumer takes the MAX magnitude, not a stack-sum (identical to the Kael-line ~621 per-hit Decrease DEF precedent) → deferred rather than placing a max-5% debuff","each hit +5% [Increase ATK] on self stacking up to 50% — dynamic accumulating self-buff with no stated duration; per-hit stack-sum magnitude unsupported → deferred","50% DEF-ignore also applies vs Corrupted Alliance & minions; modelled as Boss-only (ignoreDefIfBoss:0.5) — the faction/minion branch is not available to the formula"]},
  "THOLIN-A3": {"champion":"Tholin Foulbeard","slot":"A3","name":"Rabid Fury","type":"active","cooldown":4,"actions":[{"seq":10,"phase":"skill_start","op":"ACQUIRE_TARGETS","repeat":"once","target":"all_enemies"},{"seq":20,"phase":"before_attack","op":"PLACE_BUFF","target":"self","repeat":"once","effect":{"type":"Increase ATK","magnitude":50,"duration":2}},{"seq":30,"phase":"per_target","op":"DEAL_DAMAGE","target":"current_target","repeat":"once","formulaId":"F_THOLIN_A3"}],"covers":["AoE 2-hit attack that ignores [Unkillable] and [Shield] (formula ignore_unkillable + ignore_shield)","self 50% [Increase ATK] 2t placed before attacking"],"deferred":["for each critical hit landed on the FIRST hit, increases the damage dealt on the SECOND hit by 10% — dynamic inter-hit crit-count damage scaler, no op"]},
  "THOLIN-PASSIVE": {"champion":"Tholin Foulbeard","slot":"Passive","name":"Evil's Nightmare","type":"passive","cooldown":0,"covers":[],"deferred":["activates the Demonbreaker (A1) skill every fifth turn this Champion takes — periodic self-skill activation (every_nth_own_turn trigger / ACTIVATE_SKILL op) not built","enemies from the Corrupted Alliance, Bosses and minions cannot land critical hits on this Champion — static conditional crit-immunity, no engine expression"]},
  "FAYNE-A1": {"champion":"Fayne","slot":"A1","name":"Exotic Blades","type":"active","cooldown":0,"actions":[{"seq":10,"phase":"skill_start","op":"ACQUIRE_TARGETS","repeat":"once","target":"single"},{"seq":20,"phase":"per_target","op":"DEAL_DAMAGE","target":"current_target","repeat":"once","formulaId":"F_FAYNE_A1"},{"seq":30,"phase":"after_hit","op":"REDUCE_TURN_METER","target":"current_target","repeat":"once","effect":{"pct":0.05,"chance":0.35,"accuracy_check":false}}],"covers":["drains 5% of target current Turn Meter (REDUCE_TURN_METER)"],"deferred":["Turn Meter steal is per-HIT (2 hits, each an independent 35% roll of 5% of the target's CURRENT TM) — modelled as a single once-per-skill 35% x 5% drain; per-hit cadence not honoured (MODIFIERS.per_hit is ○) and drain uses a flat 5% rather than 5% of live current TM","the STOLEN 5% is added to Fayne's OWN Turn Meter — needs op: STEAL_TURN_METER (drain half modelled via REDUCE_TURN_METER; the self-gain half is dropped)"]},
  "FAYNE-A2": {"champion":"Fayne","slot":"A2","name":"Flower's Tears","type":"active","cooldown":4,"actions":[{"seq":10,"phase":"skill_start","op":"ACQUIRE_TARGETS","repeat":"once","target":"single"},{"seq":20,"phase":"per_target","op":"DEAL_DAMAGE","target":"current_target","repeat":"once","formulaId":"F_FAYNE_A2"},{"seq":30,"phase":"after_hit","op":"PLACE_DEBUFF","target":"intended_set","repeat":"per_target","effect":{"type":"Poison","pct":0.05,"count":2,"duration":2,"chance":0.75,"accuracy_check":true,"stacking":true,"maxStacks":10}},{"seq":40,"phase":"after_hit","op":"PLACE_DEBUFF","target":"intended_set","repeat":"per_target","effect":{"type":"Decrease Attack","magnitude":50,"duration":2,"chance":0.75,"accuracy_check":true}}],"covers":["Poison (two 5% stacks)","Decrease Attack 50%"],"deferred":["in-game the two [Poison] + the [Decrease ATK] share ONE 75% placement roll; modelled as two independent 75% rolls (identical in EV). [Decrease ATK] is ascension-gated (ar=3) — recipe assumes fully-ascended/booked"]},
  "FAYNE-A3": {"champion":"Fayne","slot":"A3","name":"Flowing Style","type":"active","cooldown":5,"actions":[{"seq":10,"phase":"skill_start","op":"ACQUIRE_TARGETS","repeat":"once","target":"single"},{"seq":20,"phase":"per_target","op":"DEAL_DAMAGE","target":"current_target","repeat":"once","formulaId":"F_FAYNE_A3"},{"seq":30,"phase":"after_hit","op":"PLACE_DEBUFF","target":"intended_set","repeat":"once","effect":{"type":"Decrease DEF","magnitude":60,"duration":3,"chance":0.75,"accuracy_check":true}},{"seq":40,"phase":"after_skill","op":"HEAL","target":"self","repeat":"once","effect":{"pctOfCasterMaxHp":0.04}}],"covers":["Decrease DEF 60% 3t (first hit)","self-heal 4% caster MAX HP (per debuff on target — floor only)"],"deferred":["second hit: 75% 25% [Weaken] 3t — [Weaken] has no engine consumer (not in CONSUMED_EFFECTS); placing it would be inert","third-hit heal scales x(number of debuffs on the target); the engine HEAL takes a fixed pctOfCasterMaxHp, so only a single-debuff 4% floor is applied — the per-debuff multiplier is not modelled (undercredit) — needs op: HEAL_PER_DEBUFF (dynamic heal = 4% MaxHP x target debuff count)","per-hit placement cadence (which of the 3 hits carries each debuff) not honoured — modelled once-per-skill; irrelevant to EV since all land on the same single target"]},
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

  // ── GLORIOUS PALLAS (DB "Glorious Pallas", key GLORIOUS), Legendary / Magic / Support — AoE HEALER ──
  // Source (verbatim): A1 "Attacks 1 enemy with 1 random Argonites ally (uses default skill). Heals all allies by
  // 10% of this Champion's MAX HP." A2 (cd5) "Removes all debuffs from all allies; [Block Debuffs] + [Fervor] 2t."
  // A3 (cd7) "Revives all dead allies 50% HP + 50% TM; 25% [Strengthen] + 30% [Increase SPD] all allies 2t."
  'GLORIOUS-A1': {
    champion: 'Glorious Pallas', slot: 'A1', name: 'Spear of Serenity', type: 'active', cooldown: 0,
    actions: [
      { seq: 10, phase: 'skill_start', op: 'ACQUIRE_TARGETS', repeat: 'once', target: 'single' },
      { seq: 20, phase: 'per_target', op: 'DEAL_DAMAGE', target: 'current_target', repeat: 'once', formulaId: 'F_GLORIOUS_A1' },
      // "…with 1 random ARGONITES ally (uses default skill)": one random ally OF THE ARGONITES FACTION joins the
      // attack against the same target with its A1. Faction is now plumbed onto combatants (2026-08-12), so the
      // gate is REAL — a team with no other Argonites ally fires NO join (matching the game). Pallas herself is
      // Argonites but is the caster, so she is excluded from the joiner pool (random_faction_ally excludes self).
      { seq: 25, phase: 'per_target', op: 'ALLY_ATTACK', who: 'random_faction_ally', faction: 'Argonites', slot: 'A1', repeat: 'once' },
      // her main sustain: AoE heal 10% of HER MAX HP, every cast (cd 0). doHeal reads pctOfCasterMaxHp × Pallas.maxHp.
      { seq: 30, phase: 'after_skill', op: 'HEAL', target: 'all_allies', repeat: 'once', effect: { pctOfCasterMaxHp: 0.10 } },
    ],
    covers: ['heals all allies 10% of caster MAX HP', 'a random Argonites ally joins the attack with its default skill (ALLY_ATTACK, faction-gated)'],
    deferred: [],
  },
  'GLORIOUS-A2': {
    champion: 'Glorious Pallas', slot: 'A2', name: 'Gift of Thalass', type: 'active', cooldown: 5,
    actions: [
      { seq: 10, phase: 'skill_start', op: 'CLEANSE', target: 'all_allies', repeat: 'once', effect: { count: 99 } },
    ],
    covers: [],
    deferred: [
      '[Block Debuffs] buff on all allies 2t — no engine consumer (not in CONSUMED_EFFECTS); placing it would be inert',
      '[Fervor] buff on all allies 2t — no engine consumer; placing it would be inert',
    ],
  },
  'GLORIOUS-A3': {
    champion: 'Glorious Pallas', slot: 'A3', name: 'Glorious Revival', type: 'active', cooldown: 7,
    actions: [
      { seq: 10, phase: 'skill_start', op: 'REVIVE', target: 'all_dead_allies', repeat: 'once', effect: { hpPct: 0.50, tmPct: 0.50 } },
      { seq: 20, phase: 'after_skill', op: 'PLACE_BUFF', target: 'all_allies', repeat: 'once', effect: { type: 'Strengthen', magnitude: 25, duration: 2 } },
      { seq: 30, phase: 'after_skill', op: 'PLACE_BUFF', target: 'all_allies', repeat: 'once', effect: { type: 'Increase SPD', magnitude: 30, duration: 2 } },
    ],
    covers: ['revives all dead allies at 50% HP + 50% Turn Meter'],
    deferred: [],
  },

  // Passive — Shield of the Argolades [P]: on ANY ally receiving a debuff, shield that ally 20% of THEIR max HP
  // (1t). The load-bearing Spider mitigation (the swarm debuffs every round → the shield is continually up).
  // Consumed by maybeShieldOnDebuff via state.onAllyDebuffed.
  'GLORIOUS-PASSIVE': {
    champion: 'Glorious Pallas', slot: 'Passive', name: 'Shield of the Argolades', type: 'passive',
    shieldOnAllyDebuffPct: 0.20,
    deferred: ['fills all allies\' Turn Meters by 15% at the end of this Champion\'s turn — end-of-turn TM fill not modelled'],
  },

  // ── FAHRAKIN THE FAT (DB "Fahrakin the Fat", key FAHRAKIN), Epic / Spirit / Attack — DoT + team beatdown ──
  // Source (verbatim): A1 "Attacks 1 enemy. 40% chance of a 60% [Decrease DEF] 2t." A2 (cd4) "Attacks 1 enemy.
  // 75% chance of a [HP Burn] + two 5% [Poison] 2t." A3 Beatdown (cd6) "Places a 30% [Increase C. RATE] and a 30%
  // [Increase C. DMG] on all allies except this Champion 3t. Then, all allies except this Champion attack 1 target
  // enemy" — a pure buff+beatdown, NO caster hit. Passive Body Block — 20% incoming-damage deflect onto allies.
  'FAHRAKIN-A1': {
    champion: 'Fahrakin the Fat', slot: 'A1', name: 'Sizzling Strike', type: 'active', cooldown: 0,
    actions: [
      { seq: 10, phase: 'skill_start', op: 'ACQUIRE_TARGETS', repeat: 'once', target: 'single' },
      { seq: 20, phase: 'per_target', op: 'DEAL_DAMAGE', target: 'current_target', repeat: 'once', formulaId: 'F_FAHRAKIN_A1' },
      { seq: 30, phase: 'after_hit', op: 'PLACE_DEBUFF', target: 'intended_set', repeat: 'per_target',
        effect: { type: 'Decrease DEF', magnitude: 60, duration: 2, chance: 0.40, accuracy_check: true } },
    ],
    covers: ['Decrease DEF'],
    deferred: [],
  },
  'FAHRAKIN-A2': {
    champion: 'Fahrakin the Fat', slot: 'A2', name: 'Brand of Shame', type: 'active', cooldown: 4,
    actions: [
      { seq: 10, phase: 'skill_start', op: 'ACQUIRE_TARGETS', repeat: 'once', target: 'single' },
      { seq: 20, phase: 'per_target', op: 'DEAL_DAMAGE', target: 'current_target', repeat: 'once', formulaId: 'F_FAHRAKIN_A2' },
      { seq: 30, phase: 'after_hit', op: 'PLACE_DEBUFF', target: 'intended_set', repeat: 'per_target',
        effect: { type: 'HP Burn', duration: 2, chance: 0.75, accuracy_check: true } },
      { seq: 40, phase: 'after_hit', op: 'PLACE_DEBUFF', target: 'intended_set', repeat: 'per_target',
        effect: { type: 'Poison', pct: 0.05, count: 2, duration: 2, chance: 0.75, accuracy_check: true, stacking: true, maxStacks: 10 } },
    ],
    covers: ['HP Burn', 'Poison'],
    deferred: ['in-game the [HP Burn] + two [Poison] share ONE 75% placement roll; modelled as independent 75% rolls (identical in EV)'],
  },
  'FAHRAKIN-A3': {
    champion: 'Fahrakin the Fat', slot: 'A3', name: 'Beatdown', type: 'active', cooldown: 6,
    actions: [
      // pick the single enemy the whole team piles onto ("1 target enemy"); Fahrakin himself does NOT attack.
      { seq: 10, phase: 'skill_start', op: 'ACQUIRE_TARGETS', repeat: 'once', target: 'single' },
      { seq: 20, phase: 'skill_start', op: 'PLACE_BUFF', target: 'all_allies_except_self', repeat: 'once',
        effect: { type: 'Increase C.RATE', magnitude: 30, duration: 3 } },   // consumed by engine.effectiveCritRate
      { seq: 30, phase: 'after_skill', op: 'ALLY_ATTACK', who: 'all_allies_except_self', slot: 'A1', repeat: 'once' },
    ],
    covers: ['Increase C.RATE on all allies except self', 'all allies except self join-attack the target (ALLY_ATTACK)'],
    // ⚠ MEASURED (sim-suite A/B, 2026-08-12): authoring this beatdown (Fahrakin is in 17 Spider runs) fires real
    // team damage on the boss that the prose-blind auto-parser previously dropped → Dragon unchanged, Spider
    // −1.1pp (one reality-LOSS Spider stage flips to a FALSE-CLEAR). This is a FAITHFUL mechanic exposing a
    // pre-existing Spider survival over-optimism (Spider walls are mechanical/survival, not damage — see
    // spider-false-walls memory), NOT an over-credit. Do NOT revert the beatdown to protect the metric.
    deferred: ['[Increase C.DMG] 30% on all allies except self — C.DMG has no engine consumer (not in STAT_MODS/CONSUMED_EFFECTS); placing it would be inert'],
  },
  'FAHRAKIN-PASSIVE': {
    champion: 'Fahrakin the Fat', slot: 'Passive', name: 'Body Block', type: 'passive',
    deferred: ['deflects 20% of all incoming damage on this Champion onto all allies, spread equally — DAMAGE_DEFLECT (incoming-damage redistribution) op not built'],
  },

  // ── UUGO (DB "Uugo", key UUGO), Epic / Magic / Support — AoE Decrease-DEF debuffer + team heal/clutch-revive ──
  // Source (verbatim): A1 "Attacks 1 enemy. 35% chance of [Leech] 2t (+5% per alive enemy)." A2 (cd4) "Attacks all
  // enemies. 75% chance of 60% [Decrease DEF] 2t. 50% chance of [Block Buffs] 2t (+5%/alive enemy)." A3 (cd6)
  // "Removes all [Heal Reduction] from all allies, then removes 1 random debuff from all allies, then heals all
  // allies by 20% of THIS Champion's MAX HP. If all allies are dead, revives them with 50% HP, then fills their
  // Turn Meters by 50% instead." Passive Final Spite — self [Increase SPD]+[Block Damage] when her last ally dies.
  'UUGO-A1': {
    champion: 'Uugo', slot: 'A1', name: 'Black Hand', type: 'active', cooldown: 0,
    actions: [
      { seq: 10, phase: 'skill_start', op: 'ACQUIRE_TARGETS', repeat: 'once', target: 'single' },
      { seq: 20, phase: 'per_target', op: 'DEAL_DAMAGE', target: 'current_target', repeat: 'once', formulaId: 'F_UUGO_A1' },
      { seq: 30, phase: 'after_hit', op: 'PLACE_DEBUFF', target: 'intended_set', repeat: 'per_target',
        effect: { type: 'Leech', duration: 2, chance: 0.35, accuracy_check: true } },   // Leech: team heals 18% off a Leeched enemy (interpreter.dealOneHit)
    ],
    covers: ['Leech'],
    deferred: ['[Leech] placement chance rises +5% per alive enemy — dynamic chance not modelled (base 35% used)'],
  },
  'UUGO-A2': {
    champion: 'Uugo', slot: 'A2', name: 'Maelstrom Wrack', type: 'active', cooldown: 4,
    actions: [
      { seq: 10, phase: 'skill_start', op: 'ACQUIRE_TARGETS', repeat: 'once', target: 'all_enemies' },
      { seq: 20, phase: 'per_target', op: 'DEAL_DAMAGE', target: 'current_target', repeat: 'once', formulaId: 'F_UUGO_A2' },
      { seq: 30, phase: 'after_hit', op: 'PLACE_DEBUFF', target: 'intended_set', repeat: 'per_target',
        effect: { type: 'Decrease DEF', magnitude: 60, duration: 2, chance: 0.75, accuracy_check: true } },
    ],
    covers: ['Decrease DEF (AoE)'],
    deferred: ['50% [Block Buffs] (+5%/alive enemy) — [Block Buffs] has no engine consumer (not in CONSUMED_EFFECTS); placing it would be inert'],
  },
  // ⚠ MEASURED (sim-suite A/B, 2026-08-12): authoring Uugo REMOVES an over-credit — the auto-parser revived on
  // EVERY A3 (unconditional), but the card revives ONLY when all allies are dead. Gating it faithfully (below)
  // costs Dragon −0.2pp (one true-win → predicted loss, false-CLEAR count unchanged): the phantom revive had been
  // masking a real survival source the sim still lacks. Faithful correction, not a regression — do NOT ungate it.
  'UUGO-A3': {
    champion: 'Uugo', slot: 'A3', name: "Uugo's Brew", type: 'active', cooldown: 6,
    actions: [
      // NORMAL case (≥1 ally alive): cleanse then heal 20% of HER MAX HP. Cleanse-before-heal so the removed
      // [Heal Reduction] can't cut the heal (doHeal reads healReduction at heal time).
      { seq: 10, phase: 'skill_start', op: 'CLEANSE', target: 'all_allies', repeat: 'once', ifAllAlliesDead: false, effect: { count: 2 } },
      { seq: 20, phase: 'after_skill', op: 'HEAL', target: 'all_allies', repeat: 'once', ifAllAlliesDead: false, effect: { pctOfCasterMaxHp: 0.20 } },
      // CLUTCH branch (all other allies dead): revive them 50% HP + 50% TM INSTEAD of the heal (ifAllAlliesDead).
      { seq: 30, phase: 'skill_start', op: 'REVIVE', target: 'all_dead_allies', repeat: 'once', ifAllAlliesDead: true, effect: { hpPct: 0.50, tmPct: 0.50 } },
    ],
    covers: ['cleanses allies + heals 20% caster MAX HP; if all allies dead, revives them at 50% HP then fills their Turn Meter by 50% instead (REVIVE tmPct)'],
    deferred: ['cleanse modelled as up-to-2 debuffs (all [Heal Reduction] + 1 random) — the engine CLEANSE is untyped, so it removes the oldest 2 rather than [Heal Reduction] specifically'],
  },
  'UUGO-PASSIVE': {
    champion: 'Uugo', slot: 'Passive', name: 'Final Spite', type: 'passive',
    // "Places a 30% [Increase SPD] + a [Block Damage] buff on self for 1 turn whenever her LAST living ally is
    // killed" → an 'ally_death' trigger gated on her becoming the sole survivor (living_allies_besides_self == 0).
    triggers: [
      { on: 'ally_death', when: { left: 'living_allies_besides_self', cmp: '==', right: 0 }, actions: [
        { op: 'PLACE_BUFF', target: 'self', effect: { type: 'Increase SPD', magnitude: 30, duration: 1 } },
        { op: 'PLACE_BUFF', target: 'self', effect: { type: 'Block Damage', duration: 1 } },
      ] },
    ],
    covers: ['self [Increase SPD] + [Block Damage] when her last ally dies (ally_death trigger)'],
  },

  // ── NARMA THE RETURNED (DB "Narma the Returned", key NARMA), Legendary / Magic / Support — heal + poison ──
  // Source (verbatim): A1 attack + extend 3 debuffs. A2 (cd5) attack + 75% 50% [Decrease ATK] 3t + "heals all
  // allies by 15% of this Champion's MAX HP (+2% per [Poison] on target)". A3 (cd6) attack + 3×5% [Poison] + 25%
  // [Poison Sensitivity]. Passive: counter-poison + poison-based damage reduction (deferred — triggers).
  'NARMA-A1': {
    champion: 'Narma the Returned', slot: 'A1', name: 'Hell Crescent', type: 'active', cooldown: 0,
    actions: [
      { seq: 10, phase: 'skill_start', op: 'ACQUIRE_TARGETS', repeat: 'once', target: 'single' },
      { seq: 20, phase: 'per_target', op: 'DEAL_DAMAGE', target: 'current_target', repeat: 'once', formulaId: 'F_NARMA_A1' },
    ],
    covers: [],
    deferred: ['40% chance to increase the duration of 3 random debuffs on the target by 1 turn — extend-duration on random debuffs not modelled'],
  },
  'NARMA-A2': {
    champion: 'Narma the Returned', slot: 'A2', name: 'Weirding Dance', type: 'active', cooldown: 5,
    actions: [
      { seq: 10, phase: 'skill_start', op: 'ACQUIRE_TARGETS', repeat: 'once', target: 'single' },
      { seq: 20, phase: 'per_target', op: 'DEAL_DAMAGE', target: 'current_target', repeat: 'once', formulaId: 'F_NARMA_A2' },
      { seq: 30, phase: 'after_hit', op: 'PLACE_DEBUFF', target: 'intended_set', repeat: 'per_target',
        effect: { type: 'Decrease Attack', magnitude: 50, duration: 3, chance: 0.75, accuracy_check: true } },
      // AoE heal 15% of HER MAX HP (her sustain). The +2%/[Poison]-on-target bonus is deferred (dynamic).
      { seq: 40, phase: 'after_skill', op: 'HEAL', target: 'all_allies', repeat: 'once', effect: { pctOfCasterMaxHp: 0.15 } },
    ],
    covers: ['heals all allies 15% of caster MAX HP'],
    deferred: ['heal increases by 2% for each [Poison] on the target — dynamic heal bonus not modelled (base 15% applied)'],
  },
  'NARMA-A3': {
    champion: 'Narma the Returned', slot: 'A3', name: 'Toxin Trance', type: 'active', cooldown: 6,
    actions: [
      { seq: 10, phase: 'skill_start', op: 'ACQUIRE_TARGETS', repeat: 'once', target: 'single' },
      { seq: 20, phase: 'per_target', op: 'DEAL_DAMAGE', target: 'current_target', repeat: 'once', formulaId: 'F_NARMA_A3' },
      { seq: 30, phase: 'after_hit', op: 'PLACE_DEBUFF', target: 'intended_set', repeat: 'per_target',
        effect: { type: 'Poison', pct: 0.05, count: 3, duration: 3, chance: 0.75, accuracy_check: true, stacking: true, maxStacks: 10 } },
      { seq: 40, phase: 'after_hit', op: 'PLACE_DEBUFF', target: 'intended_set', repeat: 'per_target',
        effect: { type: 'Poison Sensitivity', magnitude: 25, duration: 3, chance: 0.75, accuracy_check: true } },
    ],
    covers: ['Poison', 'Poison Sensitivity'],
    deferred: [],
  },

  // ── MAVARA THE WEB DIVINER (DB "Mavara the Web Diviner"), Legendary / Magic / Support — revive/veil sustain ──
  // Source (verbatim): A1 "Attacks 1 enemy. Places [Fervor] on a random ally except this Champion…" A2 "Places a
  // 25% [Strengthen] and a 50% [Increase RES] on all allies 2t. Equalizes ally HP up to the highest." A3
  // "Revives an ally with 50% HP and 50% TM. Then [Perfect Veil] on all allies except self 2t. [Unkillable] on
  // self 2t. These buffs placed even if no allies revived." A4 [P] buff-counting TM/heal.
  'MAVARA-A1': {
    champion: 'Mavara the Web Diviner', slot: 'A1', name: 'Strike On My Mark', type: 'active', cooldown: 0,
    actions: [
      { seq: 10, phase: 'skill_start', op: 'ACQUIRE_TARGETS', repeat: 'once', target: 'single' },
      { seq: 20, phase: 'per_target', op: 'DEAL_DAMAGE', target: 'current_target', repeat: 'once', formulaId: 'F_MAVARA_A1' },
    ],
    covers: [],
    deferred: [
      'places [Fervor] on a random ally except self — [Fervor] has no engine consumer and no random_ally_except_self recipient; placing it would be inert/mis-targeted',
      '[Passive Effect] [Fervor] allies 50% chance to join other [Fervor] allies\' attacks — no join-attack op',
    ],
  },
  'MAVARA-A2': {
    champion: 'Mavara the Web Diviner', slot: 'A2', name: 'Nexus Of Silk', type: 'active', cooldown: 5,
    actions: [
      { seq: 10, phase: 'skill_start', op: 'PLACE_BUFF', target: 'all_allies', repeat: 'once', effect: { type: 'Strengthen', magnitude: 25, duration: 2 } },
      { seq: 20, phase: 'after_skill', op: 'EQUALIZE_HP', repeat: 'once' },   // "brings the HP of all allies up to the level of the ally with the highest HP" (raises to the highest HP%)
    ],
    // ⚠ MEASURED (sim-suite A/B, 2026-08-12): this faithful equalize (Mavara in 24 Dragon runs, cd5) is strong
    // sustain → Dragon −2.7pp, fp 21→23 (two reality-LOSS teams flip to false-CLEAR). The sim DOES damage all
    // allies (Scorch is team-wide, dragon.js), so the equalize is not over-modelled — it EXPOSES that the sim's
    // Dragon survival is already ~2 teams too generous (loss-recall is the sim's core weakness). Residual to fix
    // is the Dragon survival model, NOT this verified mechanic — do NOT revert to protect the metric.
    covers: ['equalizes all allies up to the highest ally\'s HP% (EQUALIZE_HP)'],
    deferred: [
      '50% [Increase RES] on all allies — [Increase RES] has no engine consumer (no res in STAT_MODS); placing it would be inert',
    ],
  },
  'MAVARA-A3': {
    champion: 'Mavara the Web Diviner', slot: 'A3', name: 'The Webs Whisper', type: 'active', cooldown: 5,
    actions: [
      // Revive ONE dead ally (50% HP + 50% TM) — IUDEX-A3 shape. No-op if none dead; buffs still placed below.
      { seq: 10, phase: 'skill_start', op: 'REVIVE', target: 'dead_ally', repeat: 'once', effect: { hpPct: 0.50, tmPct: 0.50, count: 1 } },
      // The designed pair: [Perfect Veil] on all allies EXCEPT self makes the dealers untargetable-by-single;
      // [Unkillable] on self makes HER the single-target soak that can't die for the 2-turn window (checkDeaths
      // floors her at 1 HP). Modeling the veil WITHOUT the unkillable was unfaithful (redirected fire onto a
      // mortal Mavara → she died) — both halves now landed together (2026-08-09).
      { seq: 20, phase: 'after_skill', op: 'PLACE_BUFF', target: 'all_allies_except_self', repeat: 'once', effect: { type: 'Perfect Veil', duration: 2 } },
      { seq: 30, phase: 'after_skill', op: 'PLACE_BUFF', target: 'self', repeat: 'once', effect: { type: 'Unkillable', duration: 2 } },
    ],
    covers: ['revives an ally at 50% HP + 50% Turn Meter (REVIVE tmPct)'],
    deferred: [],
  },
  'MAVARA-A4': {
    champion: 'Mavara the Web Diviner', slot: 'A4', name: 'Theridine Visions', type: 'passive',
    deferred: [
      'per 8 enemy-team buffs → +20% ally Turn Meter; per 16 own-team buffs → heal all allies 20% MAX HP — buff-received COUNTER trigger does not exist',
    ],
  },

  // ── GNUT (DB "Gnut"), Legendary / Spirit / Defense — DEF-scaling tank ───
  // Source (verbatim): A1 "Attacks 1 enemy 3 times. Each hit 80% [Decrease TM] 15%; if TM not decreased, 80%
  // [Freeze] 1t instead." A2 "Attacks all enemies. 75% chance of a 50% [Decrease ATK] and a 25% [Weaken] 2t.
  // Places [Counterattack] on self 2t." A3 "Attacks 1 enemy 3 times. Each hit −3% DEF (stacks to 30%); heals
  // self 30% of damage dealt." A4 [P] "When counterattacking, deals 100% instead of 75%."
  'GNUT-A1': {
    champion: 'Gnut', slot: 'A1', name: 'Dwarven Might', type: 'active', cooldown: 0,
    actions: [
      { seq: 10, phase: 'skill_start', op: 'ACQUIRE_TARGETS', repeat: 'once', target: 'single' },
      { seq: 20, phase: 'per_target', op: 'DEAL_DAMAGE', target: 'current_target', repeat: 'once', formulaId: 'F_GNUT_A1' },
    ],
    covers: [],
    // per-hit branch: each hit 80% [Decrease Turn Meter] 15%, ELSE 80% [Freeze] 1t. No per-hit REDUCE_TURN_METER
    // rider with a flat chance, and no else-branch — needs a new op; deferred rather than half-modeled.
    deferred: ['per-hit 80% Decrease Turn Meter 15%, else 80% [Freeze] 1t — per-hit branch rider (no op)'],
  },
  'GNUT-A2': {
    champion: 'Gnut', slot: 'A2', name: 'Fury of the King', type: 'active', cooldown: 4,
    actions: [
      { seq: 10, phase: 'skill_start', op: 'ACQUIRE_TARGETS', repeat: 'once', target: 'all_enemies' },
      { seq: 20, phase: 'per_target', op: 'DEAL_DAMAGE', target: 'current_target', repeat: 'once', formulaId: 'F_GNUT_A2' },
      { seq: 30, phase: 'after_hit', op: 'PLACE_DEBUFF', target: 'intended_set', repeat: 'per_target',
        effect: { type: 'Decrease Attack', magnitude: 50, duration: 2, chance: 0.75, accuracy_check: true } },
    ],
    covers: [],
    deferred: [
      '25% [Weaken] 2t — [Weaken] has no engine consumer (not in CONSUMED_EFFECTS); placing it would be inert',
      'self [Counterattack] buff 2t — no generic [Counterattack] consumer (nothing counters while holding the buff)',
    ],
  },
  'GNUT-A3': {
    champion: 'Gnut', slot: 'A3', name: 'Blessed Bash', type: 'active', cooldown: 5,
    actions: [
      { seq: 10, phase: 'skill_start', op: 'ACQUIRE_TARGETS', repeat: 'once', target: 'single' },
      // 3 hits, each self-heals 30% of damage dealt (F_GNUT_A3.selfHealPctOfDamage) — his sustain.
      { seq: 20, phase: 'per_target', op: 'DEAL_DAMAGE', target: 'current_target', repeat: 'once', formulaId: 'F_GNUT_A3' },
    ],
    covers: ['self-heal 30% of damage dealt via F_GNUT_A3.selfHealPctOfDamage'],
    deferred: [
      'per-hit −3% [Decrease Defense] stacking to 30% — the statFactor consumer takes the MAX magnitude, not a stack-sum, so per-hit 3% stacks do not accumulate to 30% (would under-model); deferred pending stacking-magnitude support',
    ],
  },
  'GNUT-A4': {
    champion: 'Gnut', slot: 'A4', name: 'No Holding Back', type: 'passive',
    deferred: ['counterattacks deal 100% instead of 75% — depends on a [Counterattack]-buff consumer that does not exist'],
  },

  // ── STAG KNIGHT (DB "Stag Knight"), Epic / Spirit / Support — Decrease-DEF debuffer ───
  // Source (verbatim): A1 "Attacks 1 enemy 2 times. Each hit has a 30% chance of placing a 30% [Decrease SPD]
  // for 2t." A2 "Attacks all enemies. Has a 70% chance of placing a 60% [Decrease DEF] and a 50% [Decrease ATK]
  // for 2t." A3 "Places a 50% [Increase ACC] buff on an ally for 1t each time the ally has a debuff resisted."
  // A3 is a no-cooldown REACTIVE passive mis-slotted as an active in the DB (no "[P]" suffix); authored as
  // type:'passive' so makeCombatant skips it (else pickSkill casts it every turn and he never attacks).
  'STAG-A1': {
    champion: 'Stag Knight', slot: 'A1', name: 'Spot Quarry', type: 'active', cooldown: 0,
    actions: [
      { seq: 10, phase: 'skill_start', op: 'ACQUIRE_TARGETS', repeat: 'once', target: 'single' },
      // per-hit: each of the 2 hits rolls its own 30% [Decrease SPD] (F_STAG_A1.onHitPlaceDebuff rider).
      { seq: 20, phase: 'per_target', op: 'DEAL_DAMAGE', target: 'current_target', repeat: 'once', formulaId: 'F_STAG_A1' },
    ],
    covers: ['Decrease Speed'],
    deferred: [],
  },
  'STAG-A2': {
    champion: 'Stag Knight', slot: 'A2', name: 'Huntmaster', type: 'active', cooldown: 4,
    actions: [
      { seq: 10, phase: 'skill_start', op: 'ACQUIRE_TARGETS', repeat: 'once', target: 'all_enemies' },
      { seq: 20, phase: 'per_target', op: 'DEAL_DAMAGE', target: 'current_target', repeat: 'once', formulaId: 'F_STAG_A2' },
      // his primary value: 60% [Decrease DEF] multiplies ALLIES' attack damage. Placed after the hit.
      { seq: 30, phase: 'after_hit', op: 'PLACE_DEBUFF', target: 'intended_set', repeat: 'per_target',
        effect: { type: 'Decrease Defense', magnitude: 60, duration: 2, chance: 0.70, accuracy_check: true } },
      { seq: 40, phase: 'after_hit', op: 'PLACE_DEBUFF', target: 'intended_set', repeat: 'per_target',
        effect: { type: 'Decrease Attack', magnitude: 50, duration: 2, chance: 0.70, accuracy_check: true } },
    ],
    covers: ['Decrease Defense', 'Decrease Attack'],
    deferred: [],
  },
  'STAG-A3': {
    champion: 'Stag Knight', slot: 'A3', name: 'Lead the Pack', type: 'passive',
    // Reactive: places 50% [Increase ACC] on an ally each time that ally's debuff is resisted. No
    // `ally_debuff_resisted` trigger event exists → not fired (flagged, not guessed). Authored passive so the
    // AI does not cast it. Low graded value.
    deferred: ['places 50% [Increase ACC] on an ally each time the ally has a debuff resisted — on-resist reactive trigger (no event)'],
  },

  // ── KAEL (DB "Kael"), Rare / Magic / Attack — starter Poison nuker ───
  // Source (verbatim skill_summary): A1 "Attacks 1 enemy. Has an 80% chance of placing a 2.5% [Poison] for 2t."
  // A2 "Attacks all enemies. Has an extra 15% chance of a critical hit. Fill this Champion's Turn Meter by 25%
  // for each enemy killed." A3 "Attacks 4 times at random. Has a 40% chance of placing a 5% [Poison] for 2t."
  'KAEL-A1': {
    champion: 'Kael', slot: 'A1', name: 'Dark Bolt', type: 'active', cooldown: 0,
    actions: [
      { seq: 10, phase: 'skill_start', op: 'ACQUIRE_TARGETS', repeat: 'once', target: 'single' },
      { seq: 20, phase: 'per_target', op: 'DEAL_DAMAGE', target: 'current_target', repeat: 'once', formulaId: 'F_KAEL_A1' },
      // 80% chance (STAGE-1) of a 2.5% [Poison], 2t. DEF-independent %maxHP DoT; ticks once per stack.
      { seq: 30, phase: 'after_hit', op: 'PLACE_DEBUFF', target: 'intended_set', repeat: 'per_target',
        effect: { type: 'Poison', pct: 0.025, count: 1, duration: 2, chance: 0.80, accuracy_check: true, stacking: true, maxStacks: 10 } },
    ],
    covers: ['Poison'],
    deferred: [],
  },
  'KAEL-A2': {
    champion: 'Kael', slot: 'A2', name: 'Acid Rain', type: 'active', cooldown: 3,
    actions: [
      { seq: 10, phase: 'skill_start', op: 'ACQUIRE_TARGETS', repeat: 'once', target: 'all_enemies' },
      // "extra 15% chance of a critical hit" rides F_KAEL_A2.critRateBonus (engine.computeRawHit).
      { seq: 20, phase: 'per_target', op: 'DEAL_DAMAGE', target: 'current_target', repeat: 'once', formulaId: 'F_KAEL_A2' },
    ],
    covers: [],
    // "Fill the Turn Meter of this Champion by 25% for each enemy killed" — per-KILL-COUNT self TM fill. The
    // interpreter tracks a kill BOOLEAN (ctx.killedSomething), not a kill count, and FILL_TURN_METER has no
    // per-kill/onKill gate → not expressible today. Low impact on single-boss Dragon/Spider. NEEDS NEW OP.
    deferred: ['fill this Champion\'s Turn Meter by 25% per enemy killed — per-kill-count self TM fill (no op)'],
  },
  'KAEL-A3': {
    champion: 'Kael', slot: 'A3', name: 'Disintegrate', type: 'active', cooldown: 5,
    actions: [
      { seq: 10, phase: 'skill_start', op: 'ACQUIRE_TARGETS', repeat: 'once', target: 'single' },
      // 4 random hits (F_KAEL_A3.randomTargetPerHit re-picks per hit).
      { seq: 20, phase: 'per_target', op: 'DEAL_DAMAGE', target: 'current_target', repeat: 'once', formulaId: 'F_KAEL_A3' },
      // MODELING NOTE: verbatim reads "Has a 40% chance" (singular) → modeled as ONE 40% 5% [Poison] placement,
      // NOT a per-hit rider. If a first-party read shows per-hit ("each hit"), move to F_KAEL_A3.onHitPlaceDebuff.
      { seq: 30, phase: 'after_skill', op: 'PLACE_DEBUFF', target: 'intended_set', repeat: 'per_target',
        effect: { type: 'Poison', pct: 0.05, count: 1, duration: 2, chance: 0.40, accuracy_check: true, stacking: true, maxStacks: 10 } },
    ],
    covers: ['Poison'],
    deferred: [],
  },

  // ── XENOMORPH (DB "Xenomorph"), Magic / Attack — the CB/Spider POISON CARRIER ───
  // Only A1 + the passive are authored (the crit-Poison branch + reactive Poison the auto-parser can't read).
  // A2 (Infestation: Stun/Infest/True Fear + revive-on-infest-death) and A3 (Rip and Claw: 2-hit, +15%/Poison)
  // fall through to kitToRecipe — A2 places no Poison and A3's DB multiplier is null (not fabricated).
  // A1 — Tail Stab (3.9 ATK, no cd). Single target. Places ONE 5% [Poison] 2t — or THREE on a critical hit.
  'XENOMORPH-A1': {
    champion: 'Xenomorph', slot: 'A1', name: 'Tail Stab', type: 'active', cooldown: 0,
    actions: [
      { seq: 10, phase: 'skill_start', op: 'ACQUIRE_TARGETS', repeat: 'once', target: 'single' },
      { seq: 20, phase: 'per_target', op: 'DEAL_DAMAGE', target: 'current_target', repeat: 'once', formulaId: 'F_XENO_A1' },
      // "Places a 5% [Poison] debuff for 2 turns." — the guaranteed base Poison (no % chance in the card).
      { seq: 30, phase: 'after_hit', op: 'PLACE_DEBUFF', target: 'intended_set', repeat: 'per_target',
        effect: { type: 'Poison', pct: 0.05, count: 1, duration: 2, guaranteed: true, accuracy_check: true, stacking: true, maxStacks: 10 } },
      // "Places THREE 5% [Poison] debuffs if this attack is critical." — the crit branch places 2 MORE (1 base + 2
      // = 3 on crit). ifCrit reads ctx.attackCrit (set by DEAL_DAMAGE); this is his primary poison-stacking engine.
      { seq: 32, phase: 'after_hit', op: 'PLACE_DEBUFF', target: 'intended_set', repeat: 'per_target',
        effect: { type: 'Poison', pct: 0.05, count: 2, duration: 2, ifCrit: true, guaranteed: true, accuracy_check: true, stacking: true, maxStacks: 10 } },
      // "Also places a [Perfect Veil] buff on this Champion for 2 turns." — untargetable-by-single + unresist gate.
      { seq: 40, phase: 'after_skill', op: 'PLACE_BUFF', target: 'self', repeat: 'once', effect: { type: 'Perfect Veil', duration: 2 } },
    ],
    covers: ['Poison', 'Perfect Veil'],
    deferred: [],
  },
  // Passive — Caustic Blood: reactive 25% [Poison] on the ATTACKER when Xeno is attacked (boss AoEs → poisons the
  // boss). The "−20% DEF on enemies under his Poison" clause boosts ATTACK damage only (DEF-independent DoT is
  // unaffected) → ACCEPTED deferral for the DoT-throughput model. Crit-unresist clause folded into `guaranteed`.
  'XENOMORPH-PASSIVE': {
    champion: 'Xenomorph', slot: 'PASSIVE', name: 'Caustic Blood', type: 'passive',
    triggers: [
      { on: 'attacked', chance: 0.25, actions: [{ op: 'PLACE_DEBUFF', target: 'attacker',
        effect: { type: 'Poison', pct: 0.05, count: 1, duration: 2, guaranteed: true, accuracy_check: true, stacking: true, maxStacks: 10 } }] },
    ],
    deferred: ['−20% DEF on enemies under his Poison (boosts ATTACK dmg only; DEF-independent DoT unaffected)'],
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
    covers: ['self-heal 10% of damage dealt via F_HORDIN_A2.selfHealPctOfDamage'],
    deferred: [],
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
      // [Leech] on all enemies (same 75% roll, 2t). Consumer in interpreter.dealOneHit: any ally hitting a
      // Leeched enemy heals 18% of the damage inflicted (glossary standard) — team-wide sustain off the wave.
      { seq: 35, phase: 'after_hit', op: 'PLACE_DEBUFF', target: 'intended_set', repeat: 'per_target',
        effect: { type: 'Leech', duration: 2, chance: 0.75, accuracy_check: true, ignoreResIfCrit: 0.25 } },
      { seq: 40, phase: 'after_skill', op: 'PLACE_BUFF', target: 'self', repeat: 'once', effect: { type: 'Taunt', duration: 2 } },
    ],
    deferred: [],
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
      { seq: 15, phase: 'skill_start', op: 'BUFF_STRIP', target: 'intended_set', repeat: 'once' },   // "Removes all buffs from all enemies" (BEFORE the Freeze, per skill text)
      { seq: 20, phase: 'after_skill', op: 'PLACE_DEBUFF', target: 'intended_set', repeat: 'per_target',
        effect: { type: 'Freeze', duration: 1, guaranteed: true, accuracy_check: true } },   // "places a [Freeze] debuff on all enemies for 1 turn"
    ],
    covers: ['removes all buffs from all enemies (BUFF_STRIP)'],
    deferred: [
      'Tormin the Cold synergy: instantly activates his Blizzard Rage skill — cross-champion ally-synergy trigger unsupported',
      'this skill\'s cooldown cannot be decreased or reset — cooldown-lock flag not modelled',
    ],
  },
  // A3 — Ward Of The Glacier (no dmg, cd 6). Mass revive + team [Block Damage] + [Increase SPD].
  'HILVI-A3': {
    champion: 'Hilvi', slot: 'A3', name: 'Ward Of The Glacier', type: 'active', cooldown: 6,
    actions: [
      // Revives all dead allies with 50% HP AND 30% Turn Meter (tmPct → doRevive; verbatim card 2026-08-04).
      { seq: 10, phase: 'skill_start', op: 'REVIVE', target: 'all_dead_allies', repeat: 'once', effect: { hpPct: 0.50, tmPct: 0.30 } },
      { seq: 20, phase: 'after_skill', op: 'PLACE_BUFF', target: 'all_allies', repeat: 'once', effect: { type: 'Block Damage', duration: 1 } },
      { seq: 30, phase: 'after_skill', op: 'PLACE_BUFF', target: 'all_allies', repeat: 'once', effect: { type: 'Increase SPD', magnitude: 30, duration: 2 } },
      // "If no allies were revived by this skill, also fills the Turn Meters of all allies by 25%." skipIfRevived
      // gates on ctx.revivedCount (set by the seq-10 REVIVE this same cast). Feeds the late-fight tempo reality shows.
      { seq: 40, phase: 'after_skill', op: 'FILL_TURN_METER', target: 'all_allies', repeat: 'once', effect: { pct: 0.25 }, skipIfRevived: true },
    ],
    deferred: [
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
      // "fills this Champion's Turn Meter by 15% when used against Bosses." A1 has no cd, so this is Ninja's
      // continuous self-acceleration engine: more turns → fits A1+A2+A3 into one Round → the [Escalation]
      // passive fires (maybeEscalate). onlyVsBoss gates it on the acquired-target set (interpreter FILL_TURN_METER).
      { seq: 40, phase: 'after_skill', op: 'FILL_TURN_METER', target: 'self', repeat: 'once', effect: { pct: 0.15 }, onlyVsBoss: true },
    ],
    deferred: [],
  },
  // A2 — Hailburn (2 ATK ×3 random, cd 4). Each hit 75% [HP Burn] 3t; self [Perfect Veil]; vs Boss activate HP Burn.
  'NINJA-A2': {
    champion: 'Ninja', slot: 'A2', name: 'Hailburn', type: 'active', cooldown: 4,
    actions: [
      { seq: 10, phase: 'skill_start', op: 'ACQUIRE_TARGETS', repeat: 'once', target: 'single' },
      // PHASE 1 (first-party CB video 2026-08-08): "instantly activate any [HP Burn]" detonates the EXISTING
      // standing burn FIRST, before the swings — bossOnly, once. (Returns 0 if none is standing.)
      { seq: 15, phase: 'skill_start', op: 'DEBUFF_ACTIVATION', target: 'intended_set', repeat: 'once',
        effect: { type: 'HP Burn', bossOnly: true } },
      // PHASE 2: 3 random hits; EACH rolls its own [HP Burn] 75% (F_NINJA_A2.onHitPlaceDebuff) AND — vs a Boss —
      // instantly activates the burn it just placed (F_NINJA_A2.activatePlacedBurnVsBoss, per-hit rider in
      // DEAL_DAMAGE). So one Hailburn = up to 1 (existing) + 3 (placed) detonations, ~3.25 expected. Not one.
      { seq: 20, phase: 'per_target', op: 'DEAL_DAMAGE', target: 'current_target', repeat: 'once', formulaId: 'F_NINJA_A2' },
      { seq: 40, phase: 'after_skill', op: 'PLACE_BUFF', target: 'self', repeat: 'once', effect: { type: 'Perfect Veil', duration: 2 } },
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
      { seq: 30, phase: 'after_skill', op: 'FILL_TURN_METER', target: 'all_allies', repeat: 'once', effect: { pct: 0.15 } },   // +15% team TM. pct is a FRACTION (doFillTurnMeter ×100 = 15 pts). WAS `pct: 15` → ×100 = 1500 → filled every ally to 100% at wave-2 opening, lapping an ally into a 6th action before Faceless. Same bug class as Hilvi Divine Mission `pct:10` and Bambus's `pct:10` TM strip.
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
