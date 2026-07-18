// ── lib/clan-boss.js ─────────────────────────────────────────────────────────
// Clan Boss recognition for captured battles.
//
// The battle reader fingerprints dungeon runs (result + stage) but does not yet
// classify Clan Boss: CB fights arrive with battleKindId=3, a stageId in the
// 4019xxx range, dungeon=null (or a mis-fingerprinted dungeon), and no difficulty.
// This module maps those raw fields to the DB's "Clan Boss" dungeon + difficulty
// tier so they can resolve to a dungeon_stage_id like any other content.
//
// Passive decode only: we interpret the BattleKindId / stageId the game already
// writes — no process modification. See the passive-read boundary in CLAUDE.md.

// BattleKindId enum value for Clan Boss (observed: the only kind=3 captures are CB,
// every dungeon run is kind=1).
export const CLAN_BOSS_KIND = 3;

// The Clan Boss content id prefix: stageId is 4019xxx across all observed CB fights.
const CLAN_BOSS_STAGEID_PREFIX = 4019;

// Difficulty tier → DB dungeon_stages.stage_number (Clan Boss is seeded 1..6).
export const CLAN_BOSS_TIER_STAGE_NUMBER = {
  Easy: 1, Normal: 2, Hard: 3, Brutal: 4, Nightmare: 5, 'Ultra Nightmare': 6,
};

// Confirmed stageId → difficulty mappings. Keyed on the exact stageId because the
// low digits are a content id, not a linear tier index, so we do NOT extrapolate
// from a formula. Add tiers here only once a real capture confirms them.
//   4019001 → Easy      (DonCobb07, confirmed 2026-07-01)
//   4019013 → Brutal    (Don$Gnut,  confirmed 2026-07-01)
//   4019017 → Nightmare (Don$Gnut,  confirmed 2026-07-02 — live capture + "Demon Lord.
//                        Nightmare" result screen, team Ezio/Pelops/Narma/Pallas/Tagoar)
const CLAN_BOSS_STAGEID_DIFFICULTY = {
  4019001: 'Easy',
  4019013: 'Brutal',
  4019017: 'Nightmare',
};

/** True if a battle-log entry is a Clan Boss fight. */
export function isClanBoss(b) {
  return b?.battleKindId === CLAN_BOSS_KIND ||
    (typeof b?.stageId === 'number' && Math.floor(b.stageId / 1000) === CLAN_BOSS_STAGEID_PREFIX);
}

/**
 * Classify a Clan Boss battle → { dungeon:'Clan Boss', difficulty, stageNumber }.
 * difficulty/stageNumber are null when the stageId isn't a confirmed tier yet
 * (surfaced, never guessed). Returns null for non-CB battles.
 */
export function classifyClanBoss(b) {
  if (!isClanBoss(b)) return null;
  const difficulty = CLAN_BOSS_STAGEID_DIFFICULTY[b.stageId] ?? null;
  return {
    dungeon: 'Clan Boss',
    difficulty,
    stageNumber: difficulty ? CLAN_BOSS_TIER_STAGE_NUMBER[difficulty] : null,
  };
}

/**
 * Normalize a battle-log entry so downstream code (grouping, resolveDungeonStage,
 * upload) sees Clan Boss as a first-class dungeon. Non-CB entries pass through
 * unchanged. Returns a shallow copy — does not mutate the input.
 */
export function normalizeBattle(b) {
  const cb = classifyClanBoss(b);
  if (!cb) return b;
  return { ...b, dungeon: cb.dungeon, difficulty: cb.difficulty, stageNumber: cb.stageNumber };
}

/**
 * Resolve a total-damage figure to the earned chest tier for a Clan Boss stage.
 * Clan Boss success is the chest/damage tier reached, not kill-or-die — see the
 * clan_boss_chest_tiers table (seed 26). Pure: pass the tier rows for one stage
 * (`{ chest_name, damage_min, damage_max }`, damage_max null = top tier) plus the
 * run's total damage. Returns the chest name lowercased (e.g. 'guardian'), or null
 * when damage is missing, below the lowest tier, or no tiers are seeded — the caller
 * holds those rather than guessing. Boundaries are min-inclusive / max-exclusive, so
 * a value exactly on a boundary counts toward the higher tier.
 */
export function chestTierFor(tiers, damage) {
  if (damage == null || !Array.isArray(tiers) || !tiers.length) return null;
  const d = Number(damage);
  const hit = tiers.find(t =>
    d >= Number(t.damage_min) && (t.damage_max == null || d < Number(t.damage_max)));
  return hit ? String(hit.chest_name).toLowerCase() : null;
}

// Difficulty progression order (ascending). The scan walks this to find the top one-keyable.
export const CLAN_BOSS_DIFFICULTY_ORDER = ['Easy', 'Normal', 'Hard', 'Brutal', 'Nightmare', 'Ultra Nightmare'];

// The complete-capture total for a battle-log entry: the reader's captured total, else Σ per-hero.
// null when neither is present (an incomplete capture — a dropped hero → do NOT grade it).
function totalDamageOf(b) {
  return b?.totalDamageDealt ?? ((b?.heroes ?? []).reduce((s, h) => s + (Number(h?.damage) || 0), 0) || null);
}

/**
 * Extract ONE account's Clan Boss runs from a parsed battle-log array →
 * [{ difficulty, totalDamage, capturedAt }]. Only runs with a MAPPED difficulty AND a real
 * total (complete capture) are returned; difficulty-unmapped or incomplete captures (dropped
 * hero → null total) are dropped here so they can never be graded (see the capture-completeness
 * trap in the handoff). Pure — caller reads/filters the log (the engine never touches disk).
 */
export function clanBossRunsFromLog(log, { account = null } = {}) {
  return (Array.isArray(log) ? log : [])
    .filter(isClanBoss)
    .filter(b => !account || b.displayName === account || b.accountId === account)
    .map(b => ({ difficulty: classifyClanBoss(b)?.difficulty ?? null, totalDamage: totalDamageOf(b), capturedAt: b.capturedAt ?? null }))
    .filter(r => r.difficulty && r.totalDamage != null);
}

/**
 * THE Clan Boss recommendation for one account, from its REAL captured runs (the trustworthy
 * axis — no damage estimate, no calibration). The analogue of scanDungeonStages on the 6-difficulty
 * CHEST axis: which is the top difficulty whose TOP chest this account has PROVEN it one-keys, and
 * what's the gap to the next one. Downward inference is safe (a proven one-key at difficulty D also
 * clears every easier top chest); upward is NOT (higher difficulty = harder survival), so
 * `top_one_keyable` requires a DIRECT run at that difficulty clearing its top threshold.
 *
 * @param runs               [{ difficulty, totalDamage }] for ONE account (from clanBossRunsFromLog).
 * @param tiersByDifficulty  { [difficulty]: clan_boss_chest_tiers rows } — the chest thresholds.
 * @returns {
 *   has_data, per_difficulty:[{ difficulty, best_damage, ...verdict }],
 *   top_one_keyable:difficulty|null,        // highest difficulty whose top chest is proven one-keyed
 *   focus:{ difficulty, tried, best_damage?, earned_chest?, top_chest, top_threshold, margin?, shortfall? }|null
 *                                           // the difficulty to advise on (push the gap, or try next)
 * } | { has_data:false }
 */
export function clanBossRecommendation(runs, tiersByDifficulty) {
  const complete = (runs ?? []).filter(r => r?.difficulty && r.totalDamage != null);
  if (!complete.length) return { has_data: false };

  const bestByDiff = {};
  for (const r of complete) {
    if (bestByDiff[r.difficulty] == null || r.totalDamage > bestByDiff[r.difficulty]) bestByDiff[r.difficulty] = r.totalDamage;
  }

  const per_difficulty = [];
  let top_one_keyable = null;
  for (const d of CLAN_BOSS_DIFFICULTY_ORDER) {           // ascending → last earned_top wins = highest
    if (bestByDiff[d] == null) continue;
    const v = tiersByDifficulty?.[d] ? clanBossVerdict(tiersByDifficulty[d], bestByDiff[d]) : null;
    per_difficulty.push({ difficulty: d, best_damage: bestByDiff[d], ...(v ?? {}) });
    if (v?.earned_top) top_one_keyable = d;
  }

  const highest_ran = per_difficulty.length ? per_difficulty[per_difficulty.length - 1].difficulty : null;
  const nextUp = (d) => CLAN_BOSS_DIFFICULTY_ORDER[CLAN_BOSS_DIFFICULTY_ORDER.indexOf(d) + 1] ?? null;

  // Focus = the difficulty to talk about. If they already one-key their HIGHEST-run difficulty,
  // point them at the next tier up (untried). Otherwise point at the highest they run and the gap
  // to one-keying ITS top chest.
  let focus = null;
  if (top_one_keyable && top_one_keyable === highest_ran) {
    const up = nextUp(top_one_keyable);
    if (up) {
      const top = tiersByDifficulty?.[up]
        ? [...tiersByDifficulty[up]].sort((a, b) => Number(b.sort_order) - Number(a.sort_order))[0] : null;
      focus = { difficulty: up, tried: false, top_chest: top ? String(top.chest_name).toLowerCase() : null,
                top_threshold: top ? Number(top.damage_min) : null };
    }
  } else if (highest_ran) {
    const p = per_difficulty.find(x => x.difficulty === highest_ran);
    focus = { difficulty: highest_ran, tried: true, best_damage: p.best_damage, earned_chest: p.earned_chest,
              top_chest: p.top_chest, top_threshold: p.top_threshold, margin: p.margin, shortfall: p.shortfall };
  }

  return { has_data: true, per_difficulty, top_one_keyable, focus };
}

/**
 * THE Clan Boss verdict for one key. CB is never a kill — success is a per-key TOTAL-DAMAGE
 * threshold: did the run's damage reach the TOP chest of the difficulty it ran? (See the CB
 * feedback model — `knowledge/HANDOFF_2026-07-16.md`.) Pure; no engine, no DB.
 *
 * @param tiers        clan_boss_chest_tiers rows for ONE difficulty (chest_name, sort_order,
 *                     damage_min, damage_max). The top chest is the highest sort_order
 *                     (its damage_max is null).
 * @param totalDamage  the key's total damage (Σ per-hero, or the captured total).
 * @returns { damage, earned_chest, top_chest, top_threshold, earned_top, margin, shortfall }
 *          — earned_top is the pass/fail (one-keyed the top chest); margin = damage/threshold
 *          (≥1 pass); shortfall = damage still needed (0 when passed). null if inputs missing.
 */
export function clanBossVerdict(tiers, totalDamage) {
  if (totalDamage == null || !Array.isArray(tiers) || !tiers.length) return null;
  const dmg = Number(totalDamage);
  const top = [...tiers].sort((a, b) => Number(b.sort_order) - Number(a.sort_order))[0];
  const topThreshold = Number(top.damage_min);
  return {
    damage: dmg,
    earned_chest: chestTierFor(tiers, dmg),           // chest actually earned (or null if below lowest)
    top_chest: String(top.chest_name).toLowerCase(),  // the one-key target
    top_threshold: topThreshold,
    earned_top: dmg >= topThreshold,                  // PASS/FAIL: did this key take the top chest?
    margin: topThreshold > 0 ? dmg / topThreshold : null,
    shortfall: Math.max(0, topThreshold - dmg),       // damage still needed for the top chest
  };
}
