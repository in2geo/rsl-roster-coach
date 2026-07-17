// masteries.js — for damage modelling, "masteries" reduces to ONE per-champion question:
// does this champion have Warmaster or Giant Slayer? Those two tier-6 Offense masteries are
// the only ones that meaningfully affect boss-fight damage, because both add bonus damage
// scaled off the ENEMY's MAX HP — devastating against boss HP pools. Every other mastery is a
// modest flat/utility effect, negligible next to a %-of-boss-HP source. Masteries are gated on
// ASCENSION (6★) — a 6★ champion can carry them even at level 1 — so the manual input asks about
// 6★ champions, not level-60 ones.
//
// Gestal masteryIds encode: 500 <tree> <tier> <node>. Offense = tree 1; tier 6 = {Warmaster,
// Giant Slayer}. Confirmed by inspecting real level-60 rosters:
//   WARMASTER_ID    500161 — CONFIRMED: Pelops the Victor carries it (in-game screenshot,
//                            2026-07-12); 500161 is his sole tier-6 Offense node.
//   GIANT_SLAYER_ID 500162 — the sibling tier-6 Offense node (structurally inferred; confirm
//                            against a champion known to run Giant Slayer when one appears).
// Both count as a "boss mastery"; the Warmaster-vs-Giant-Slayer split only matters later when
// the CB damage model applies the per-mastery %-max-HP coefficient (Warmaster favours multi-
// hit/DoT, Giant Slayer single-hit) — inferred from the champion's kit, never asked.

export const WARMASTER_ID = 500161;
export const GIANT_SLAYER_ID = 500162;
export const BOSS_MASTERY_IDS = new Set([WARMASTER_ID, GIANT_SLAYER_ID]);

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
