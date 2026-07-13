import { defToDamageReduction, DEF_DIMINISHING_RETURNS_FLOOR, levelStatScale } from './formulas.js';
export { defToDamageReduction, DEF_DIMINISHING_RETURNS_FLOOR };

// ============================================================================
// Updated gear-tier system (2026-07-11). ADDITIVE model:
//   effective = base * (1 + gear_pct + account_pct)   for HP/ATK/DEF
//   effective = base + gear_flat + account_flat        for SPD/ACC/RES
// Two independent inputs:
//   • gear_tier         (starter/fair/good/endgame) — per champion
//   • account_development(poor/fair/good)            — Great Hall + Arena bundle,
//                                                      account-wide (profile field)
// Masteries (none/partial/full) are a CLAN-BOSS DAMAGE modifier, not a stat change
// — see masteryDamageModifier(). PLACEHOLDER numbers; calibrate against 10-15 real
// accounts before shipping. gear_tier_config holds the DB copy of GEAR_TIERS.
//
// NOTE: applied ONLY to manual rosters. Gestal rosters carry real effective_stats
// (actual gear, which already includes Great Hall/Arena), so mapRoster prefers those
// and never calls this — account_development must not be double-counted there.
// ============================================================================

// HP/ATK/DEF are percentage bonuses; SPD/ACC/RES are flat; CRATE/CDMG are fractions.
const GEAR_TIERS = {
  starter: { hp: 0.30, atk: 0.30, def: 0.30, spd: 15,  acc: 30,  res: 20,  crate: 0.20, cdmg: 0.20 },
  fair:    { hp: 0.60, atk: 0.60, def: 0.60, spd: 35,  acc: 80,  res: 50,  crate: 0.45, cdmg: 0.50 },
  good:    { hp: 1.00, atk: 1.00, def: 1.00, spd: 60,  acc: 150, res: 80,  crate: 0.70, cdmg: 0.80 },
  endgame: { hp: 2.00, atk: 2.00, def: 2.00, spd: 100, acc: 220, res: 120, crate: 0.90, cdmg: 1.30 },
};

const ACCOUNT_DEV = {
  poor: { hp: 0.05, atk: 0.05, def: 0.05, acc: 5,  res: 5,  cdmg: 0.02 },
  fair: { hp: 0.14, atk: 0.14, def: 0.14, acc: 20, res: 15, cdmg: 0.06 },
  good: { hp: 0.28, atk: 0.28, def: 0.28, acc: 40, res: 30, cdmg: 0.15 },
};

// DEPRECATED (2026-07-12): the account-wide flat masteries modifier. Superseded by the
// per-champion boss-mastery model in lib/masteries.js (bossMasteryDamageModifier) — the boss
// masteries (Warmaster/Giant Slayer) live on SPECIFIC champions, not the whole account, and a
// flat +15% badly under-counts a Warmaster carrier's %-max-HP damage. Kept only so any legacy
// caller still resolves; no longer used by the match engine.
const MASTERY_DAMAGE = { none: 1.00, partial: 1.075, full: 1.15 };

// Base C.Rate 15% / C.DMG 50% are universal RSL defaults (percent units, matching
// the rest of the engine). Gear/account fractions are converted to percent here.
const BASE_CRIT_RATE = 15;
const BASE_CRIT_DMG  = 50;

const DEFAULT_GEAR_TIER = 'starter';
const DEFAULT_ACCOUNT_DEV = 'poor';

// Gear tier is ACCOUNT-level: prefer opts.gearTier (from the profile), fall back to a
// per-champion value only for legacy callers, then the conservative default.
function tierOf(userChampion, opts) {
  const t = String(opts?.gearTier ?? userChampion?.gear_tier ?? '').toLowerCase();
  return GEAR_TIERS[t] ? t : DEFAULT_GEAR_TIER;
}
function devOf(opts) {
  const d = String(opts?.accountDev ?? '').toLowerCase();
  return ACCOUNT_DEV[d] ? d : DEFAULT_ACCOUNT_DEV;
}

export function masteryDamageModifier(masteries) {
  return MASTERY_DAMAGE[String(masteries ?? '').toLowerCase()] ?? MASTERY_DAMAGE.none;
}

export function estimatedDamageReduction(champion, userChampion, opts = {}) {
  const gear = GEAR_TIERS[tierOf(userChampion, opts)];
  const acct = ACCOUNT_DEV[devOf(opts)];
  const estimatedDef = Math.round((champion.base_def ?? 0) * (1 + gear.def + acct.def));
  return defToDamageReduction(estimatedDef);
}

/**
 * Estimate a champion's effective stats from base stats + gear tier + account dev.
 * @param {object} champion     - DB champions row (base_hp, base_atk, ...).
 * @param {object} userChampion - user_champions row (legacy per-champion fields).
 * @param {object} [opts]       - account-level gear context from the profile:
 *   { gearTier: 'starter'|'fair'|'good'|'endgame', accountDev: 'poor'|'fair'|'good' }.
 * @returns {{ hp, atk, def, spd, acc, res, crit_rate, crit_dmg }} (crit in percent).
 */
export function estimateStats(champion, userChampion, opts = {}) {
  const gear = GEAR_TIERS[tierOf(userChampion, opts)];
  const acct = ACCOUNT_DEV[devOf(opts)];
  // HP/ATK/DEF scale with the champion's level (base stats are the 6★/60 max); SPD/ACC/RES/crit
  // are level-independent. Without this, under-leveled manual champs were over-estimated ~3×.
  const lvl = levelStatScale(userChampion?.level, userChampion?.stars);
  return {
    hp:  Math.round((champion.base_hp  ?? 0) * lvl * (1 + gear.hp  + acct.hp)),
    atk: Math.round((champion.base_atk ?? 0) * lvl * (1 + gear.atk + acct.atk)),
    def: Math.round((champion.base_def ?? 0) * lvl * (1 + gear.def + acct.def)),
    spd: (champion.base_spd ?? 0) + gear.spd,
    acc: (champion.base_acc ?? 0) + gear.acc + acct.acc,
    res: (champion.base_res ?? 0) + gear.res + acct.res,
    crit_rate: Math.min(100, (champion.base_crit_rate ?? BASE_CRIT_RATE) + gear.crate * 100),
    crit_dmg:  (champion.base_crit_dmg ?? BASE_CRIT_DMG) + (gear.cdmg + acct.cdmg) * 100,
  };
}

// Exported for the gear_tier_config reseed + tests to stay in sync with the DB copy.
export const GEAR_TIER_TABLE = GEAR_TIERS;
export const ACCOUNT_DEV_TABLE = ACCOUNT_DEV;
