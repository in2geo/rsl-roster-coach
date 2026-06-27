/**
 * formulas.js — RSL Roster Coach
 *
 * All RSL game math lives here as named exports.
 * The matching engine and estimation engine import from this file.
 * When Plarium patches the math, only this file changes.
 *
 * Source: RSL SME formula document June 2026 + community consensus.
 */

// ── DEF diminishing returns ───────────────────────────────────────────────────

// Damage absorbed per hit: DEF / (DEF + 1500)
// Reference points:
//   1500 DEF → 50.0% DR
//   2500 DEF → 62.5% DR
//   3000 DEF → 66.7% DR
//   3500 DEF → 70.0% DR
//   4200 DEF → 73.7% DR  ← redirect substats to HP beyond this
//   4500 DEF → 75.0% DR
export function defToDamageReduction(def) {
  return def / (def + 1500);
}

// Beyond this point, additional DEF substats yield less EHP than HP substats.
export const DEF_DIMINISHING_RETURNS_FLOOR = 4200;

// ── True Speed ────────────────────────────────────────────────────────────────

export const LORE_OF_STEEL_MULTIPLIER = 1.15;

/**
 * Compute True Speed (float precision, not the rounded display value).
 *
 * Speed aura scales off base_spd only — never total gear speed.
 * Lore of Steel multiplies basic set bonuses by 1.15.
 * Lore of Steel does NOT apply to Mythical / 9-piece sets (Slayer, Stoneskin).
 *
 * @param {number} base_spd           - Champion's base speed stat
 * @param {number} set_bonus_pct      - From speed_set_bonuses.bonus_pct (e.g. 0.12)
 * @param {boolean} lore_applies      - From speed_set_bonuses.lore_applies
 * @param {boolean} has_lore_of_steel - From user_champions.has_lore_of_steel
 * @param {number} flat_spd_from_gear - Estimated flat speed from substats
 * @param {number} [aura_pct=0]       - Speed aura % (e.g. 0.15 for High Khatun)
 */
export function trueSpeed(
  base_spd,
  set_bonus_pct,
  lore_applies,
  has_lore_of_steel,
  flat_spd_from_gear,
  aura_pct = 0
) {
  const lore_mult = (has_lore_of_steel && lore_applies) ? LORE_OF_STEEL_MULTIPLIER : 1.0;
  const set_contribution   = base_spd * set_bonus_pct * lore_mult;
  const aura_contribution  = base_spd * aura_pct;
  return base_spd + set_contribution + flat_spd_from_gear + aura_contribution;
}

// ── Turn meter ────────────────────────────────────────────────────────────────

export const TM_PER_TICK_MULTIPLIER = 0.07;
export const TM_THRESHOLD = 100.0;

// TM gained per engine tick
export function tmPerTick(true_spd) {
  return true_spd * TM_PER_TICK_MULTIPLIER;
}

// Ticks until next turn (ignores TM overflow from previous turn)
export function ticksUntilTurn(true_spd, current_tm = 0) {
  return Math.ceil((TM_THRESHOLD - current_tm) / tmPerTick(true_spd));
}

// Ratio of turns between two champions (e.g. 2.0 = 2:1 tune)
export function turnRatio(speed_a, speed_b) {
  return speed_a / speed_b;
}

// ── Clan Boss stun target score ───────────────────────────────────────────────

// Affinity triangle: Magic > Spirit > Force > Magic. Void is neutral.
const AFFINITY_BEATS = { Magic: 'Spirit', Spirit: 'Force', Force: 'Magic' };

export function isCounterAffinity(champion_affinity, boss_affinity) {
  return AFFINITY_BEATS[boss_affinity] === champion_affinity;
}

/**
 * Score how likely a champion is to receive the Clan Boss stun.
 * Higher score = more likely to be targeted.
 * Source: boss_stun_priority table / RSL SME formula document June 2026.
 *
 * @param {object} champion           - { affinity, has_unkillable, has_block_damage, has_shield, current_hp_pct }
 * @param {string} boss_affinity      - Boss affinity string
 * @param {number} team_slot_index    - 0-based slot (0 = leader = leftmost)
 */
export function clanBossStunScore(champion, boss_affinity, team_slot_index) {
  let score = 0;

  // Priority 1: affinity (highest weight)
  if (isCounterAffinity(champion.affinity, boss_affinity)) score += 1000;
  if (champion.affinity === 'Void') score -= 500;

  // Priority 2: buff protection (boss actively avoids these)
  if (champion.has_unkillable || champion.has_block_damage || champion.has_shield) {
    score -= 800;
  }

  // Priority 3: lowest current HP% (lower HP = higher stun score)
  score -= (champion.current_hp_pct ?? 100) * 10;

  // Priority 4: slot index tiebreaker (leftmost = higher stun score)
  score -= team_slot_index;

  return score;
}

// ── Debuff cap guard ──────────────────────────────────────────────────────────

export const MAX_DEBUFFS_ON_ENEMY  = 10;
export const MAX_BUFFS_ON_CHAMPION = 10;

// Debuffs whose loss has the biggest impact on a run — guard these first.
export const CRITICAL_DEBUFFS = ['Decrease ATK', 'Weaken', 'Decrease DEF'];

/**
 * Validate that a team's debuff spread doesn't exceed the 10-slot cap
 * in a way that overwrites critical debuffs.
 *
 * @param {Array<{type: string}>} team_debuffs - All debuffs the team can place
 */
export function validateDebuffCap(team_debuffs) {
  if (team_debuffs.length <= MAX_DEBUFFS_ON_ENEMY) {
    return { warning: false };
  }

  const critical_at_risk = team_debuffs
    .filter(d => CRITICAL_DEBUFFS.includes(d.type))
    .filter((_, i) => i >= MAX_DEBUFFS_ON_ENEMY);

  return {
    warning: true,
    over_cap_by: team_debuffs.length - MAX_DEBUFFS_ON_ENEMY,
    critical_at_risk,
    message: critical_at_risk.length > 0
      ? `Critical debuffs (${critical_at_risk.map(d => d.type).join(', ')}) may be overwritten by DoT effects.`
      : 'Team exceeds 10 debuff cap — some debuffs will not land.',
  };
}

// ── Accuracy check ────────────────────────────────────────────────────────────

// Debuff landing probability, clamped to [3%, 100%].
// bypasses_accuracy_check = true means the debuff always lands (e.g. instant DTM).
export function debuffLandChance(acc, enemy_res) {
  const raw = (acc - enemy_res) / 100 + 1;
  return Math.max(0.03, Math.min(1.0, raw));
}

// ── Canonical faction list ────────────────────────────────────────────────────

export const FACTIONS = [
  // Telerian League
  'Banner Lords', 'High Elves', 'Sacred Order', 'Barbarians',
  // Gaellen Pact
  'Ogryn Tribes', 'Lizardmen', 'Skinwalkers', 'Orcs',
  // The Corrupted
  'Demonspawn', 'Undead Hordes', 'Dark Elves', 'Knights Revenant',
  // Nyresan Union
  'Dwarves', 'Shadowkin', 'Sylvan Watchers', 'Argonites',
  // Special
  'Watcher',
];
