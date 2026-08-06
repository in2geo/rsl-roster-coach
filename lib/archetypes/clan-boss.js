// lib/archetypes/clan-boss.js — DATA registry of Clan Boss archetype specs (Archetype Selector Stage 4).
//
// An archetype is a named team composition defined by its FUNCTION SET (hardRequirements), NOT rigid
// seat counts — multi-role champs cover multiple functions and free seats. Feasibility (selection/
// feasibility.js) asks "can the roster complete every hardRequirement?"; candidate generation then
// fits the functions into 5 seats. See knowledge/ARCHETYPE_SELECTOR_SPEC.md.
//
// Requirement `anyOf` values are CAPABILITY keys from lib/capability-profile.js. `minScore` is the
// coverage floor for that function. Thresholds are the §11.1 DEFAULTS — CALIBRATION-NEEDED placeholders
// (same class as CLAUDE.md's dungeon stat floors); recalibrate against the sim, do NOT tune before the
// pipeline can score.
//
// `requiresSpeedTune` phases archetypes: the app only recommends `false` ones (it collects gear TIER,
// not exact SPD, so it cannot validate a rotation tune — CLAUDE.md). Rotation archetypes (unkillable,
// shield-infinity) are sim-only and added later, once a rotation validator exists.

export const CLAN_BOSS_ARCHETYPES = [
  {
    id: 'poison_sustain',
    label: 'Poison Sustain',
    strategy: 'conventional',
    requiresSpeedTune: false,
    // The functions every valid poison-sustain team must cover (§11.1/§11.2).
    hardRequirements: [
      // Defining function — the poison DoT engine (placers, activators, duration-extenders).
      { key: 'poisonEngine',          anyOf: ['poison', 'poisonActivation', 'poisonExtension'], minScore: 0.65 },
      // Primary survival lever vs the Demon Lord's hits. DEF-independent poison does NOT want Decrease DEF here.
      // 0.45 (recalibrated 2026-08-06): a 2-turn Decrease ATK on a ~4-turn cd is ~0.5 uptime — the realistic
      // ceiling for a single cd-gated source. 0.65 required an A1-sourced Decrease ATK and wrongly rejected
      // known-working poison rosters (DonThor/GuapoDonni/DonBrogni). Confirm against the sim.
      { key: 'bossDamageSuppression', anyOf: ['decreaseAtk'],                                   minScore: 0.45 },
      // Keeps the team alive → more DoT ticks (sustain is multiplicative, damage-mechanics §3).
      { key: 'recovery',              anyOf: ['leech', 'healing', 'continuousHeal'],            minScore: 0.55 },
      { key: 'protection',            anyOf: ['allyProtection', 'increaseDefense', 'strengthen', 'shield'], minScore: 0.55 },
      // A plan for the boss's Stun: block it, cleanse it, or control who takes it (taunt draws it).
      { key: 'stunPlan',              anyOf: ['blockDebuffs', 'cleanse', 'taunt'],              minScore: 0 }, // presence-only
    ],
    // FREED-SEAT PREFERENCE (candidate generation): after the functions are covered, spend spare seats on
    // a 2nd poison carrier — CB is a DoT race, so stacking keeps paying up to the 10-debuff-bar ceiling
    // (redundancy rule, §11.4). `stacking` names the capabilities that pay when duplicated.
    fillPreference: ['poison', 'hpBurn'],
    stacking: ['poison', 'hpBurn', 'poisonCloud', 'necrosis'],
  },
  // TODO (§11.2): direct_sustain, hybrid_sustain (app-shippable); unkillable, shield_infinity
  // (requiresSpeedTune:true, sim-only) once team-validator.js has a rotation validator.
];

export function archetypeById(id) {
  return CLAN_BOSS_ARCHETYPES.find(a => a.id === id) || null;
}
