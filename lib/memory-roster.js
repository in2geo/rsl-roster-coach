// ── lib/memory-roster.js ─────────────────────────────────────────────────────
// Direct game-memory roster source (Option B) — the Gestal-free replacement for
// readGestalRoster(). Runs the RslBattleReader companion (--whoami/--roster/--gear),
// which reads the live Raid client's memory via the durable class-name + field-name
// resolver (see gestal-sync/RslBattleReader/Il2Cpp/Il2CppFieldResolver.cs), then
// assembles the same roster shape readGestalRoster returns so tools/import-upload.js
// and the downstream engine (buildUserChampions) consume it unchanged.
//
// GEAR is fully validated (2571/2571 exact vs Gestal incl. equippedOnHeroId).
// CHAMPIONS carry heroId/typeId/baseTypeId/stars/level/empowerLevel/inStorage + real
// equipped gear + NAME (committed baseTypeId->name snapshot) + masteryIds + skills.
//   • masteryIds  — HeroMasteryData.Masteries (validated vs Gestal, live is fresher)
//   • skills      — Hero.Skills {skillId,level,maxLevel} (0 mismatches vs Gestal)
// The name is still load-bearing where champions.type_id is unset (backfilled to 99% by
// seed 2026-08-11, so mostly cosmetic now). STILL not extracted (graceful degrade):
//   • baseStats   → absent (effective_stats null → engine uses estimateStats). Base stats
//     are static per 6★ champion and available from the DB; wiring effectiveStats fully
//     also needs bonusesV2 (set/mastery/blessing) which Gestal pre-resolves — deferred.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execFileSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, '..');
const READER_DIR = path.join(REPO_ROOT, 'gestal-sync', 'RslBattleReader');
const DEFAULT_OUTPUT_DIR = path.join(READER_DIR, 'output');

// Committed baseTypeId -> champion-name snapshot (factual game data). Fills the name the
// DB join needs when champions.type_id is unpopulated. Regenerate with tools/gen-champion-names.mjs
// when new champions ship. Absent/stale entries just fall back to a null name (baseTypeId join only).
const NAME_BY_BASETYPE = (() => {
  try { return JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'data', 'champion-basetype-names.json'), 'utf8')); }
  catch { return {}; }
})();

// Locate the built reader exe (Debug by default; override with RSL_READER_EXE).
function defaultExePath() {
  if (process.env.RSL_READER_EXE) return process.env.RSL_READER_EXE;
  const candidates = [
    path.join(READER_DIR, 'bin', 'Release', 'net10.0-windows', 'win-x64', 'RslBattleReader.exe'),
    path.join(READER_DIR, 'bin', 'Debug',   'net10.0-windows', 'win-x64', 'RslBattleReader.exe'),
  ];
  return candidates.find(fs.existsSync) ?? candidates[candidates.length - 1];
}

function runReader(exePath, arg, timeoutMs) {
  return execFileSync(exePath, [arg], { encoding: 'utf8', timeout: timeoutMs, maxBuffer: 64 * 1024 * 1024 });
}

// Parse `--whoami` ("accountId   = X" / "displayName = Y"); "(none)" → null.
function parseWhoami(text) {
  const grab = (k) => {
    const m = text.match(new RegExp(`^${k}\\s*=\\s*(.+)$`, 'm'));
    const v = m?.[1]?.trim();
    return !v || v === '(none)' ? null : v;
  };
  return { accountId: grab('accountId'), displayName: grab('displayName') };
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

/**
 * Reads the live roster+gear from game memory and returns it in readGestalRoster's shape.
 *
 * @param {object}  [opts]
 * @param {boolean} [opts.run=true]     run the reader (false = use existing output JSON — dev/tests)
 * @param {string}  [opts.exePath]      RslBattleReader.exe path (default: built Debug/Release exe)
 * @param {string}  [opts.outputDir]    reader output dir (default: gestal-sync/RslBattleReader/output)
 * @param {number}  [opts.timeoutMs]    per-reader-invocation timeout (default 180000; --gear is slow)
 * @returns {object|null} roster in the readGestalRoster shape, or null if the reader produced nothing.
 */
export function readMemoryRoster({ run = true, exePath, outputDir, timeoutMs = 180_000 } = {}) {
  exePath  ??= defaultExePath();
  outputDir ??= DEFAULT_OUTPUT_DIR;

  let account = { accountId: null, displayName: null };
  if (run) {
    if (!fs.existsSync(exePath)) throw new Error(`RslBattleReader.exe not found at ${exePath} — build it (dotnet build) or set RSL_READER_EXE.`);
    account = parseWhoami(runReader(exePath, '--whoami', 30_000));
    runReader(exePath, '--roster', timeoutMs);
    runReader(exePath, '--gear',   timeoutMs);
  } else {
    // Best-effort identity when not running the reader.
    try { account = parseWhoami(runReader(exePath, '--whoami', 30_000)); } catch { /* keep nulls */ }
  }

  const rosterFile = path.join(outputDir, 'roster-memory.json');
  const gearFile   = path.join(outputDir, 'artifacts-memory.json');
  if (!fs.existsSync(rosterFile) || !fs.existsSync(gearFile)) return null;

  const heroes    = readJson(rosterFile);   // [{ heroId, typeId, baseTypeId, stars, level, empowerLevel, inStorage }]
  const artifacts = readJson(gearFile);     // [{ id, slotId, gearSetId, rarityId, rank, level, ascensionLevel, mainStatId, mainStatValue, substats, equippedOnHeroId }]
  if (!Array.isArray(heroes) || !Array.isArray(artifacts)) return null;

  // Attach equipped gear per champion (gearTierFromArtifacts reads rank + level).
  const equippedByHero = new Map();
  for (const a of artifacts) {
    if (a.equippedOnHeroId == null) continue;
    if (!equippedByHero.has(a.equippedOnHeroId)) equippedByHero.set(a.equippedOnHeroId, []);
    equippedByHero.get(a.equippedOnHeroId).push(a);
  }

  const now = new Date().toISOString();
  const champions = heroes.map((h) => ({
    heroId:         h.heroId,
    typeId:         h.typeId,
    baseTypeId:     h.baseTypeId,           // stable DB-join key; ascension = typeId - baseTypeId
    name:           NAME_BY_BASETYPE[h.baseTypeId] ?? null, // from committed snapshot (DB type_id is ~25%)
    level:          h.level,
    stars:          h.stars,
    ascensionLevel: 0,                      // Gestal convention: 0 (ascension lives in typeId)
    awakenLevel:    0,
    empowerLevel:   h.empowerLevel ?? 0,
    inStorage:      h.inStorage,
    masteryIds:     h.masteryIds ?? [],     // real → mastery_tier + hasBossMastery
    skills:         h.skills ?? [],         // real {skillId,level,maxLevel} → is_booked / book_fraction
    equippedArtifacts: equippedByHero.get(h.heroId) ?? [],
  }));

  return {
    accountId:      account.accountId,
    displayName:    account.displayName,
    raidPlayerId:   null,
    gameVersion:    null,
    source:         'memory',
    lastSnapshotAt: now,                    // live read — "now" is the snapshot time
    syncedAt:       now,
    champions,
    artifacts,
  };
}
