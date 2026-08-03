// masteries.js — the mastery layer: decode Gestal masteryIds → named masteries, and expose the
// per-mastery mechanic specs the sim consumes. Backed by data/masteries.json (66 masteries,
// generated from RAID_All_Masteries_and_Effects.xlsx by tools/build-masteries-data.mjs).
//
// Gestal masteryIds encode `500 <branch> <tier> <node>` where node is a FIXED grid COLUMN (1-4),
// NOT a spreadsheet row index. Decode CONFIRMED 2026-08-02 via Ninja in-game screenshots (see the
// generator header). Masteries are gated on ASCENSION (6★) — a 6★ champion can carry them at any
// level — so the manual fallback asks about 6★ champions, not level-60 ones.
//
// Two tier-6 Offense masteries add DEF-independent bonus damage scaled off the ENEMY's MAX HP
// (devastating vs boss HP pools):
//   WARMASTER_ID    500161 — CONFIRMED in-game (Pelops the Victor 2026-07-12; Ninja 2026-08-02).
//   GIANT_SLAYER_ID 500163 — CONFIRMED via the grid decode (Thor Faehammer holds it). ⚠ this was
//                            previously (wrongly) hardcoded as 500162; 500162 is HELMSMASHER, an
//                            Ignore-DEF proc, NOT a boss %maxHP mastery. The old id mis-credited
//                            500162 holders (Sun Wukong, Alice) with bonus damage they don't have.
// The Warmaster-vs-Giant-Slayer split matters when the damage model applies the per-mastery
// %-max-HP coefficient (Warmaster: 60% / 10% champ / 4% boss, once per skill; Giant Slayer:
// 30% / 7.5% champ / 3% boss, per hit).

import MASTERY_DATA from '../data/masteries.json' with { type: 'json' };

export const WARMASTER_ID = 500161;
export const GIANT_SLAYER_ID = 500163;
export const HELMSMASHER_ID = 500162;
export const BOSS_MASTERY_IDS = new Set([WARMASTER_ID, GIANT_SLAYER_ID]);

// id → mastery record, and name → record. Built once from the data file.
export const MASTERY_BY_ID = new Map(MASTERY_DATA.masteries.map(m => [m.id, m]));
export const MASTERY_BY_NAME = new Map(MASTERY_DATA.masteries.map(m => [m.name, m]));

/**
 * Decode Gestal masteryIds into mastery records. Unknown ids (a future patch adds a mastery, or a
 * malformed id) are surfaced as {id, unknown:true} rather than dropped, so a decode gap is visible.
 * @param {number[]} masteryIds
 * @returns {Array<object>} the matched mastery records (+ any {id, unknown} markers)
 */
export function decodeMasteryIds(masteryIds) {
  return (masteryIds ?? []).map(id => MASTERY_BY_ID.get(Number(id)) ?? { id: Number(id), unknown: true });
}

/** Decode to just the mastery NAMES the champion carries (unknown ids omitted). */
export function masteryNames(masteryIds) {
  return decodeMasteryIds(masteryIds).filter(m => !m.unknown).map(m => m.name);
}

/**
 * The sim-relevant mechanic specs for a champion's masteries, split by kind. Flat-stat masteries are
 * EXCLUDED here — they are already applied via Gestal bonusesV2.mastery (effective-stats.js) and
 * re-adding them would double-count. Returns { damageMods, ignoreDefProcs, bossBonus, names }.
 */
export function masteryMechanics(masteryIds) {
  const recs = decodeMasteryIds(masteryIds).filter(m => !m.unknown);
  const damageMods = [], ignoreDefProcs = [];
  let bossBonus = null;
  for (const m of recs) {
    const k = m.mech?.sim;
    if (k === 'damage_mult') damageMods.push({ name: m.name, ...m.mech });
    else if (k === 'ignore_def_proc') ignoreDefProcs.push({ name: m.name, ...m.mech });
    else if (k === 'boss_bonus_damage') bossBonus = { name: m.name, ...m.mech };
  }
  return { damageMods, ignoreDefProcs, bossBonus, names: recs.map(m => m.name) };
}

/** True if the Gestal masteryIds include Warmaster or Giant Slayer. */
export function hasBossMastery(masteryIds) {
  return (masteryIds ?? []).some(id => BOSS_MASTERY_IDS.has(Number(id)));
}

/**
 * Resolve a champion's boss-mastery flag from whichever source is available:
 *   - Gestal: authoritative from real masteryIds.
 *   - Manual: the level-60-gated boolean the player answers (has_boss_mastery), falling back to
 *     a legacy mastery_tier === 'complete'. Warmaster/Giant Slayer require level 60, so a champ
 *     below 60 is always false regardless of what was entered.
 */
export function resolveBossMastery(champ) {
  if (Array.isArray(champ?.masteryIds)) return hasBossMastery(champ.masteryIds);
  // Masteries are gated on ASCENSION (6★), not level: a 6★ champion at level 1 can already
  // carry full masteries. A champ below 6★ cannot, so its manual "full masteries" answer is void.
  if ((champ?.stars ?? 0) < 6) return false;
  if (typeof champ?.has_boss_mastery === 'boolean') return champ.has_boss_mastery;
  return String(champ?.mastery_tier ?? '').toLowerCase() === 'complete';
}

// Per-champion Clan Boss damage multiplier for carrying Warmaster / Giant Slayer. Replaces the
// old account-wide flat modifier ({none,partial,full}): the boss masteries live on SPECIFIC
// champions, not the whole team, and their %-max-HP damage is a large share of a boss-damage
// build — far more than the Offense tree's ~+15%. PLACEHOLDER magnitude; calibrate against
// captured Clan Boss damage (see tools/cb-estimator-probe.mjs + clan_boss_stats.damage_calibration).
export const BOSS_MASTERY_CB_MULTIPLIER = 1.5;

export function bossMasteryDamageModifier(hasBoss) {
  return hasBoss ? BOSS_MASTERY_CB_MULTIPLIER : 1.0;
}
