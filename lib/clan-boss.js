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
//   4019001 → Easy     (DonCobb07, confirmed 2026-07-01)
//   4019013 → Brutal   (Don$Gnut,  confirmed 2026-07-01)
const CLAN_BOSS_STAGEID_DIFFICULTY = {
  4019001: 'Easy',
  4019013: 'Brutal',
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
