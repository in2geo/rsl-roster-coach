import { defToDamageReduction, DEF_DIMINISHING_RETURNS_FLOOR } from './formulas.js';
export { defToDamageReduction, DEF_DIMINISHING_RETURNS_FLOOR };

// PLACEHOLDER VALUES — calibrate against real accounts before shipping.
// Stored here, not hardcoded in the matching engine, so they can be updated
// without touching matching logic. See gear_tier_config table for the DB copy.

// HP/ATK/DEF/SPD scale multiplicatively from base stats.
const GEAR_TIER_MODIFIERS = {
  'Starter':  { hp: 1.08, atk: 1.08, def: 1.08, spd: 1.05 },
  'Dungeon':  { hp: 1.30, atk: 1.30, def: 1.30, spd: 1.15 },
  'Strong':   { hp: 1.55, atk: 1.55, def: 1.55, spd: 1.30 },
  'God Tier': { hp: 1.85, atk: 1.85, def: 1.85, spd: 1.50 },
};

// ACC, RES, Crit Rate, and Crit DMG come almost entirely from gear, not base
// stats — modelled as flat additions per tier rather than multipliers.
const GEAR_TIER_ACC_BONUS = {
  'Starter':  15,
  'Dungeon':  45,
  'Strong':   80,
  'God Tier': 120,
};

const GEAR_TIER_RES_BONUS = {
  'Starter':  15,
  'Dungeon':  40,
  'Strong':   70,
  'God Tier': 100,
};

// PLACEHOLDER VALUES — calibrate against real accounts before shipping.
// Base C.Rate is 15% and base C.DMG is 50% for all RSL champions (universal
// defaults, not champion-specific). Gear adds on top additively.
const BASE_CRIT_RATE = 15;
const BASE_CRIT_DMG  = 50;

const GEAR_TIER_CRIT_RATE_BONUS = {
  'Starter':   5,
  'Dungeon':  15,
  'Strong':   25,
  'God Tier': 35,
};

const GEAR_TIER_CRIT_DMG_BONUS = {
  'Starter':  10,
  'Dungeon':  25,
  'Strong':   40,
  'God Tier': 60,
};

export function estimatedDamageReduction(champion, userChampion) {
  const tier = userChampion?.gear_tier ?? 'Starter';
  const mods = GEAR_TIER_MODIFIERS[tier] ?? GEAR_TIER_MODIFIERS['Starter'];
  const estimatedDef = Math.round((champion.base_def ?? 0) * mods.def);
  return defToDamageReduction(estimatedDef);
}

/**
 * Estimate a champion's stats from base stats + gear tier modifier.
 * @param {object} champion     - DB champions row (base_hp, base_atk, etc.)
 * @param {object} userChampion - user_champions row (gear_tier)
 * @returns {{ hp, atk, def, spd, acc, res, crit_rate, crit_dmg }}
 */
export function estimateStats(champion, userChampion) {
  const tier = userChampion.gear_tier ?? 'Starter';
  const mods = GEAR_TIER_MODIFIERS[tier] ?? GEAR_TIER_MODIFIERS['Starter'];
  return {
    hp:        Math.round((champion.base_hp  ?? 0) * mods.hp),
    atk:       Math.round((champion.base_atk ?? 0) * mods.atk),
    def:       Math.round((champion.base_def ?? 0) * mods.def),
    spd:       Math.round((champion.base_spd ?? 0) * mods.spd),
    acc:       (champion.base_acc       ?? 0)             + (GEAR_TIER_ACC_BONUS[tier]       ?? 15),
    res:       (champion.base_res       ?? 0)             + (GEAR_TIER_RES_BONUS[tier]       ?? 15),
    crit_rate: (champion.base_crit_rate ?? BASE_CRIT_RATE) + (GEAR_TIER_CRIT_RATE_BONUS[tier] ?? 5),
    crit_dmg:  (champion.base_crit_dmg  ?? BASE_CRIT_DMG)  + (GEAR_TIER_CRIT_DMG_BONUS[tier]  ?? 10),
  };
}
