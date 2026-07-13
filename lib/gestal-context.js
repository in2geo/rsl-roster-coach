// ── lib/gestal-context.js ────────────────────────────────────────────────────
// Bridges the two local data sources (Gestal roster + RslBattleReader battle log)
// into the shapes the recommendation engine and the Claude prompt expect.
//
// DECISION (current): the local dev server reads these files directly via fs.
// The Gestal export identifies champions by name/typeId but carries NO RSL-Coach
// tags or DB ids — so buildUserChampions() must be given the DB `champions` rows
// (with champion_tags + base stats) and joins them by name. The Gestal record
// supplies the real per-champion STATE (level, stars, ascension, gear).
//
// Gear: Gestal has real per-artifact data; the engine uses a coarse gear_tier.
// gearTierFromArtifacts() derives that coarse tier heuristically (PLACEHOLDER —
// calibrate against real accounts, same caveat as estimate-stats.js).

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { effectiveStats } from './effective-stats.js';
import { hasBossMastery } from './masteries.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, '..');

export const GESTAL_OUTPUT_DIR = path.join(REPO_ROOT, 'gestal-sync', 'output');
export const BATTLE_LOG_PATH = path.join(
  REPO_ROOT, 'gestal-sync', 'RslBattleReader', 'output', 'battle-log.json'
);

// ── Source readers ─────────────────────────────────────────────────────────────

// Gestal's own snapshot time (when the player last hit Refresh) for one export file.
// This — not the file mtime — identifies the account the player is actively using:
// a single `sync.js` run rewrites every account's file with the same mtime, so mtime
// only reflects sync order, whereas lastSnapshotAt reflects which account was refreshed.
function gestalSnapshotMs(filePath) {
  try { return Date.parse(JSON.parse(fs.readFileSync(filePath, 'utf8')).lastSnapshotAt) || 0; }
  catch { return 0; }
}

/**
 * Reads a normalized Gestal account export. With no accountId, picks the account
 * with the most RECENT Gestal snapshot (the one the player last refreshed), falling
 * back to file mtime on a tie. Returns null if none exists.
 */
export function readGestalRoster(accountId = null, dir = GESTAL_OUTPUT_DIR) {
  if (!fs.existsSync(dir)) return null;

  let file;
  if (accountId) {
    // Files are named "<accountId>.json" or "<displayName>_<accountId>.json".
    // A stale "<accountId>.json" may linger next to the newer named file, so pick
    // the most recently modified match rather than the first by name.
    const matches = fs.existsSync(dir)
      ? fs.readdirSync(dir)
          .filter(f => f === `${accountId}.json` || f.endsWith(`_${accountId}.json`))
          .map(f => ({ f, snap: gestalSnapshotMs(path.join(dir, f)), mtime: fs.statSync(path.join(dir, f)).mtimeMs }))
          .sort((a, b) => (b.snap - a.snap) || (b.mtime - a.mtime))
      : [];
    if (!matches.length) return null;
    file = path.join(dir, matches[0].f);
  } else {
    const candidates = fs.readdirSync(dir)
      .filter(f => f.endsWith('.json'))
      .map(f => ({ f, snap: gestalSnapshotMs(path.join(dir, f)), mtime: fs.statSync(path.join(dir, f)).mtimeMs }))
      .sort((a, b) => (b.snap - a.snap) || (b.mtime - a.mtime));
    if (!candidates.length) return null;
    file = path.join(dir, candidates[0].f);
  }

  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

// Champion ascension level (0-6). Gestal's `ascensionLevel` field is always 0 — the
// game encodes ascension in the typeId: typeId = baseTypeId + ascension. Verified by a
// live ascend (Skeletor's Hero.TypeId 9330 -> 9331 at ascension 1) and a roster-wide
// check (every typeId-baseTypeId in 0-6, matching known state: Pelops 6, Narma/Gnut/
// Tagoar 3). Falls back to ascensionLevel only if baseTypeId is missing.
function ascensionFromGestal(g) {
  if (g?.typeId != null && g?.baseTypeId != null) {
    const a = g.typeId - g.baseTypeId;
    if (a >= 0 && a <= 6) return a;
  }
  return g?.ascensionLevel ?? 0;
}

/** Reads the RslBattleReader battle log. Returns [] if missing/unreadable. */
export function readBattleHistory(logPath = BATTLE_LOG_PATH) {
  try {
    const raw = fs.readFileSync(logPath, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// ── Gear heuristic ──────────────────────────────────────────────────────────────

// PLACEHOLDER heuristic — maps a champion's equipped artifacts to the coarse
// gear_tier the engine uses. Based on average artifact rank (stars, 1-6) and
// upgrade level (0-16) across equipped pieces. Calibrate against real accounts.
export function gearTierFromArtifacts(equippedArtifacts = []) {
  const pieces = equippedArtifacts.filter(a => a && (a.rank != null || a.level != null));
  if (pieces.length < 2) return 'Starter';

  const avgRank  = pieces.reduce((s, a) => s + (a.rank  ?? 0), 0) / pieces.length;
  const avgLevel = pieces.reduce((s, a) => s + (a.level ?? 0), 0) / pieces.length;

  if (avgRank >= 5 && avgLevel >= 12) return 'God Tier';
  if (avgRank >= 4 && avgLevel >= 8)  return 'Strong';
  if (avgRank >= 3 || avgLevel >= 4)  return 'Dungeon';
  return 'Starter';
}

// ── Join: Gestal roster → match-engine userChampions ────────────────────────────

function normName(s) {
  return String(s ?? '').trim().toLowerCase();
}

// The app only advises on Rare+ champions — Common/Uncommon are excluded by design,
// even when they happen to exist in the champions table.
const INCLUDED_RARITIES = new Set(['Rare', 'Epic', 'Legendary', 'Mythical']);

/**
 * Produces the `userChampions` array the match-engine consumes, joining the
 * player's Gestal roster to DB champion rows (which carry tags + canonical base
 * stats) by name.
 *
 * @param {object[]} gestalChampions - output[].champions from the Gestal export
 * @param {object[]} dbChampions     - DB `champions` rows incl. champion_tags +
 *                                     base_* fields (see /api/user-champions select)
 * @returns {{ userChampions: object[], unmatched: string[] }}
 *   unmatched = unique Gestal champions with no DB row (zero-tag / not-yet-seeded
 *   — must be surfaced, never silently dropped, per project rules).
 *
 * Duplicates: a player can own several copies of the same champion. We keep only
 * the BEST copy (highest stars, then level) per DB champion so the engine isn't
 * fed duplicate rows and counts stay accurate.
 */
export function buildUserChampions(gestalChampions = [], dbChampions = []) {
  // Match on the game-global typeId first (stable across display-name variants
  // like "Glorious Pallas" vs "Pallas"), falling back to name for DB rows whose
  // type_id isn't seeded yet.
  const dbByName   = new Map();
  const dbByTypeId = new Map();
  for (const c of dbChampions) {
    dbByName.set(normName(c.name), c);
    if (c.type_id != null) dbByTypeId.set(c.type_id, c);
  }

  const bestById     = new Map(); // db champion id → { gestal, db } (best copy)
  const unmatchedSet = new Set(); // unique unmatched names

  const isBetter = (a, b) =>
    (a.stars ?? 0) !== (b.stars ?? 0)
      ? (a.stars ?? 0) > (b.stars ?? 0)
      : (a.level ?? 0) > (b.level ?? 0);

  for (const g of gestalChampions) {
    if (g.inStorage) continue; // vault champions aren't battle-ready

    // baseTypeId is the stable champion id; the per-copy typeId = baseTypeId +
    // ASCENSION level (0-6). Match on baseTypeId, then name.
    const db = dbByTypeId.get(g.baseTypeId ?? g.typeId) ?? dbByName.get(normName(g.name));
    if (!db) { unmatchedSet.add(g.name); continue; }
    if (!INCLUDED_RARITIES.has(db.rarity)) continue; // Common/Uncommon excluded by design

    const existing = bestById.get(db.id);
    if (!existing || isBetter(g, existing.gestal)) bestById.set(db.id, { gestal: g, db });
  }

  const userChampions = [...bestById.values()].map(({ gestal: g, db }) => ({
    // user_champions-equivalent state, sourced from the real account:
    level:           g.level ?? 1,
    stars:           g.stars ?? 1,
    // Ascension is encoded as typeId = baseTypeId + ascension (0-6); Gestal's
    // ascensionLevel field is always 0. Verified by a live ascend (Skeletor's
    // Hero.TypeId 9330->9331 at ascension 1) + roster-wide check (all values 0-6,
    // matching known state: Pelops 6, Narma/Gnut/Tagoar 3, Skeletor 0).
    ascension_level: ascensionFromGestal(g),
    awakening_level: g.awakenLevel ?? 0,
    gear_tier:       gearTierFromArtifacts(g.equippedArtifacts),
    mastery_tier:    (g.masteryIds?.length ?? 0) > 0 ? 'Complete' : 'None',
    // Boss-fight damage only cares whether the champ has Warmaster/Giant Slayer — read it
    // authoritatively from the real masteryIds (no per-champion question needed for Gestal).
    has_boss_mastery: hasBossMastery(g.masteryIds),
    is_booked:       false, // Gestal does not expose skill-book status directly
    // Identity keys for downstream battle-hero → champion mapping (baseTypeId is
    // the stable key; display_name is the in-game name the battle log records).
    type_id:         db.type_id ?? g.baseTypeId ?? g.typeId ?? null,
    display_name:    g.name,
    // Real gear-derived stats for threshold checks (base + gear main/subs + set/
    // mastery bonusesV2). Present only on the Gestal path (needs g.baseStats); the
    // engine uses it when set and falls back to estimateStats otherwise.
    effective_stats: g.baseStats ? effectiveStats(g).effective : null,
    // DB champion row (tags + base stats) drives the deterministic engine:
    champion:        db,
  }));

  return { userChampions, unmatched: [...unmatchedSet] };
}

// ── Battle history summarisation ────────────────────────────────────────────────

/**
 * Condenses the raw battle log into a per-stage summary the prompt can reason
 * over: recent attempts, win/loss counts, best (fewest) turns, retreats.
 * Skips "unknown stage" entries (Arena / unfingerprinted content).
 *
 * The log is now multi-account (each entry carries accountId/displayName), so
 * pass `accountId` to scope the summary to the active account.
 */
export function summarizeBattleHistory(battleLog = [], { maxStages = 12, accountId = null } = {}) {
  const byStage = new Map();

  for (const b of battleLog) {
    if (accountId && b.accountId && b.accountId !== accountId) continue; // other account
    const label = b.stage;
    if (!label) continue; // unknown stage — not useful for stage-specific advice

    if (!byStage.has(label)) {
      byStage.set(label, {
        stage: label,
        dungeon: b.dungeon ?? null,
        stageNumber: b.stageNumber ?? null,
        difficulty: b.difficulty ?? null,
        attempts: 0, victories: 0, defeats: 0, retreats: 0,
        bestTurns: null, lastResult: null, lastAt: null,
      });
    }
    const s = byStage.get(label);
    s.attempts++;
    if (b.result === 'Victory') s.victories++;
    else if (b.result === 'Defeat') s.defeats++;
    if (b.finishCause === 'Retreat') s.retreats++;
    if (typeof b.turns === 'number') {
      s.bestTurns = s.bestTurns == null ? b.turns : Math.min(s.bestTurns, b.turns);
    }
    if (!s.lastAt || (b.capturedAt && b.capturedAt > s.lastAt)) {
      s.lastAt = b.capturedAt ?? s.lastAt;
      s.lastResult = b.result ?? s.lastResult;
    }
  }

  return [...byStage.values()]
    .sort((a, b) => (b.lastAt ?? '').localeCompare(a.lastAt ?? ''))
    .slice(0, maxStages);
}

// ── Top-level context object (for the recommendation prompt) ─────────────────────

/**
 * Packages roster + battle history into a single structured object the
 * recommendation prompt consumes. This is the real-account half of the prompt;
 * the deterministic match result supplies the tag-knowledge half.
 */
// Common/Uncommon champions are intentionally excluded from the DB (out of scope
// for the dungeons this tool advises on). Only a missing Rare+ champion is a real
// coverage gap worth surfacing.
const SURFACED_RARITIES = new Set(['Rare', 'Epic', 'Legendary', 'Mythical']);

export function buildContext({ gestalRoster, userChampions, unmatched, battleLog }) {
  const champs = gestalRoster?.champions ?? [];
  const owned = champs.filter(c => !c.inStorage);

  const rarityCounts = {};
  for (const c of owned) rarityCounts[c.rarity] = (rarityCounts[c.rarity] ?? 0) + 1;

  // Only flag unmatched champions that are Rare+ — Common/Uncommon are excluded by
  // design, so reporting them as "not in database" would be misleading noise.
  const rarityByName = new Map(owned.map(c => [c.name.toLowerCase(), c.rarity]));
  const untaggedRarePlus = (unmatched ?? [])
    .filter(n => SURFACED_RARITIES.has(rarityByName.get(n.toLowerCase())));

  return {
    account: {
      displayName: gestalRoster?.displayName ?? null,
      raidPlayerId: gestalRoster?.raidPlayerId ?? null,
      lastSnapshotAt: gestalRoster?.lastSnapshotAt ?? null,
    },
    roster: {
      total: owned.length,
      tagged: userChampions?.length ?? 0,
      // Rare+ champions owned but not in the DB — a genuine gap. Common/Uncommon
      // unmatched are intentionally excluded and not reported here.
      untagged: untaggedRarePlus,
      rarityCounts,
      // compact champion list — what the player actually owns and at what investment
      champions: owned.map(c => ({
        name: c.name,
        rarity: c.rarity,
        affinity: c.affinity,
        level: c.level,
        stars: c.stars,
        ascension: c.ascensionLevel ?? 0,
        gearTier: gearTierFromArtifacts(c.equippedArtifacts),
      })),
    },
    // Scope battle history to this account (the log is now multi-account).
    battleHistory: summarizeBattleHistory(battleLog ?? [], { accountId: gestalRoster?.accountId ?? null }),
  };
}
