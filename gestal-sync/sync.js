/**
 * gestal-sync/sync.js
 *
 * Reads Gestal's local account exports and outputs normalized JSON
 * ready for import into RSL Roster Coach.
 *
 * Usage:
 *   node sync.js           — one-shot sync
 *   node sync.js --watch   — re-sync whenever Gestal updates a file
 */

import fs   from 'fs';
import path from 'path';
import os   from 'os';

// ── Paths ─────────────────────────────────────────────────────────────────────

const GESTAL_ROOT = path.join(
  os.homedir(),
  'AppData', 'Local', 'Gestal', 'accounts'
);

const OUTPUT_DIR = path.join(import.meta.dirname, 'output');

// ── ID → label maps ───────────────────────────────────────────────────────────

const AFFINITY = { 1: 'Magic', 2: 'Force', 3: 'Spirit', 4: 'Void' };

const RARITY = {
  1: 'Common', 2: 'Uncommon', 3: 'Rare', 4: 'Epic', 5: 'Legendary',
};

const ROLE = {
  0: 'Attack', 1: 'Defense', 2: 'HP', 3: 'Support',
};

// Plarium artifact stat-kind IDs. CORRECTED against in-game ground truth (Kael's
// Chestplate popup: statId 6=ATK%, 8=C.RATE, 10=ACC) and the fixed-main slot rules
// (Weapon main = ATK → statId 3=ATK; Shield main = DEF → statId 2=DEF). The previous
// table mislabeled 2,3,5,6,8,10,11, which corrupted every champion's gear on import.
// statId 11=DEF% is confirmed (makes Kael's DEF land exactly on the in-game 637).
const STAT_KIND = {
  1: 'HP',    2: 'DEF',   3: 'ATK',  4: 'SPD',
  5: 'CDMG',  6: 'ATK%',  7: 'RES',  8: 'CRATE',
  9: 'HP%',  10: 'ACC',  11: 'DEF%',
};

const SLOT = {
  0: 'Weapon', 1: 'Helmet', 2: 'Shield',
  3: 'Gauntlets', 4: 'Chestplate', 5: 'Boots',
  6: 'Ring', 7: 'Amulet', 8: 'Banner',
};

// Gear set IDs sourced from the RSL in-game index
const GEAR_SET = {
  1:  'Life',          2:  'Offense',        3:  'Defense',
  4:  'Speed',         5:  'Critical Rate',  6:  'Critical Damage',
  7:  'Accuracy',      8:  'Resistance',     9:  'Perception',
  10: 'Immortal',      11: 'Regeneration',   12: 'Savage',
  13: 'Cruel',         15: 'Daze',           17: 'Retaliation',
  18: 'Stun',          20: 'Stoneskin',      21: 'Destroy',
  22: 'Divine Offense',23: 'Divine Defense', 24: 'Divine Speed',
  26: 'Frostbite',     27: 'Stalwart',       28: 'Reflex',
  29: 'Cursed',        30: 'Deflection',     31: 'Avenging',
  33: 'Lethal',        36: 'Immunity',       62: 'Phantom Touch',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function label(map, id, fallback = `unknown(${id})`) {
  return id != null ? (map[id] ?? fallback) : null;
}

function readJson(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw);
}

function safeReadJson(filePath) {
  try { return readJson(filePath); } catch { return null; }
}

// ── Normalizers ───────────────────────────────────────────────────────────────

function normalizeChampion(c) {
  return {
    heroId:         c.heroId,
    typeId:         c.typeId,
    baseTypeId:     c.baseTypeId ?? null,
    name:           c.name ?? null,
    level:          c.level,
    stars:          c.grade,               // grade = star count
    ascensionLevel: c.ascensionLevel ?? 0,
    awakenLevel:    c.awakenLevel   ?? 0,
    empowerLevel:   c.empowerLevel  ?? 0,
    affinity:       label(AFFINITY, c.affinityId),
    affinityId:     c.affinityId,
    rarity:         label(RARITY, c.rarityId),
    rarityId:       c.rarityId,
    role:           label(ROLE, c.roleId),
    roleId:         c.roleId,
    factionId:      c.factionId,
    inStorage:      c.storageLocation !== 0,
    isFactionGuardian: c.isFactionGuardian ?? false,
    blessingId:     c.blessingId ?? null,
    baseStats:      c.baseStats ?? null,
    masteryIds:     c.masteryIds ?? [],
    // Gestal's pre-resolved stat bonuses (sets/mastery/blessing/relic/empower/
    // factionGuardian), keyed by statKindId. The effective-stat calculator applies
    // these on top of base + gear, rather than recomputing set thresholds itself.
    bonusesV2:      c.bonusesV2 ?? null,
    skills: (c.skills ?? []).map(s => ({
      skillId:  s.skillId,
      level:    s.level,
      maxLevel: s.maxLevel,
    })),
  };
}

function normalizeSubstat(s) {
  return {
    statId:   s.statId,
    stat:     label(STAT_KIND, s.statId),
    value:    s.value,
    rolls:    s.rolls ?? 0,
    glyph:    s.glyphBonusValue ?? null,
  };
}

function normalizeArtifact(a) {
  return {
    id:              a.id,
    slot:            label(SLOT, a.slot),
    slotId:          a.slot,
    set:             label(GEAR_SET, a.gearSetId),
    gearSetId:       a.gearSetId,
    factionId:       a.factionId ?? null,
    rarity:          label(RARITY, a.rarityId),
    rarityId:        a.rarityId,
    rank:            a.rank,       // number of stars on the artifact piece itself
    level:           a.level,
    ascensionLevel:  a.ascensionLevel ?? 0,
    mainStat:        label(STAT_KIND, a.mainStatId),
    mainStatId:      a.mainStatId,
    mainStatValue:   a.mainStatValue,
    substats:        (a.substats ?? []).map(normalizeSubstat),
    ascensionStat:   a.ascensionStat
      ? { stat: label(STAT_KIND, a.ascensionStat.statId), ...a.ascensionStat }
      : null,
    equippedOnHeroId: a.equippedOnHeroId ?? null,
  };
}

// ── Per-account sync ──────────────────────────────────────────────────────────

function syncAccount(accountDir, accountId) {
  const metaFile      = path.join(accountDir, 'metadata.json');
  const champFile     = path.join(accountDir, 'champions.json');
  const artifactFile  = path.join(accountDir, 'artifacts.json');

  const meta      = safeReadJson(metaFile);
  const champData = safeReadJson(champFile);
  const artData   = safeReadJson(artifactFile);

  if (!champData && !artData) {
    console.warn(`  [skip] ${accountId} — no champions.json or artifacts.json`);
    return;
  }

  const champions = (champData?.payload?.champions ?? []).map(normalizeChampion);
  const artifacts = (artData?.payload?.artifacts   ?? []).map(normalizeArtifact);

  // Build a quick lookup: heroId → equipped artifacts
  const equippedByHero = {};
  for (const art of artifacts) {
    if (art.equippedOnHeroId != null) {
      (equippedByHero[art.equippedOnHeroId] ??= []).push(art);
    }
  }

  // Attach equipped artifacts to champions for a single-lookup convenience
  const championsWithGear = champions.map(c => ({
    ...c,
    equippedArtifacts: equippedByHero[c.heroId] ?? [],
  }));

  const output = {
    accountId,
    displayName:     meta?.payload?.displayName ?? null,
    raidPlayerId:    meta?.payload?.raidPlayerId ?? null,
    lastSnapshotAt:  champData?.payload?.extractedAt ?? null,
    gameVersion:     champData?.payload?.gameVersion ?? null,
    syncedAt:        new Date().toISOString(),
    champions:       championsWithGear,
    artifacts,
  };

  // Filename includes the display name so multi-account output is human-readable,
  // e.g. DonCobb07_9d7ce1cb4cd18276.json. accountId stays the stable key suffix.
  const safeName = (output.displayName ?? '').replace(/[^a-zA-Z0-9._-]/g, '');
  const fileName = safeName ? `${safeName}_${accountId}.json` : `${accountId}.json`;
  const outPath  = path.join(OUTPUT_DIR, fileName);
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2), 'utf8');
  console.log(
    `  [ok] ${accountId} (${output.displayName ?? 'unnamed'}) — ` +
    `${champions.length} champions, ${artifacts.length} artifacts → ${path.basename(outPath)}`
  );

  // Staleness check. Gestal is a snapshot, not live — it only re-extracts when you
  // click Refresh. If this export predates ~5 min, recent in-game gear changes are
  // almost certainly NOT in it, so the stats will be wrong. Warn loudly.
  const STALE_AFTER_MIN = 5;
  const extractedAt = output.lastSnapshotAt;
  if (extractedAt) {
    const ageMin = Math.floor((Date.now() - new Date(extractedAt).getTime()) / 60000);
    if (ageMin > STALE_AFTER_MIN) {
      const at = new Date(extractedAt).toLocaleTimeString();
      console.warn('');
      console.warn('  ' + '═'.repeat(64));
      console.warn(`  ⚠  STALE GESTAL DATA — this snapshot is ${ageMin} minutes old (extracted ${at}).`);
      console.warn('  ⚠  Gestal only updates when you click REFRESH. Any gear changes since');
      console.warn('  ⚠  then are NOT in this export, and the imported stats will be wrong.');
      console.warn('  ⚠  → Open Gestal, make this account active, click Refresh, then re-run sync.');
      console.warn('  ' + '═'.repeat(64));
      console.warn('');
    }
  } else {
    console.warn(`  ⚠  No extraction timestamp on ${accountId} — cannot verify freshness; Refresh Gestal to be safe.`);
  }
}

// ── Main sync pass ────────────────────────────────────────────────────────────

function syncAll() {
  console.log(`[${new Date().toLocaleTimeString()}] syncing from ${GESTAL_ROOT}`);

  if (!fs.existsSync(GESTAL_ROOT)) {
    console.error(`Gestal accounts folder not found: ${GESTAL_ROOT}`);
    console.error('Make sure Gestal is installed and has synced at least once.');
    process.exit(1);
  }

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const entries = fs.readdirSync(GESTAL_ROOT, { withFileTypes: true });
  const accountDirs = entries.filter(e => e.isDirectory() && e.name !== 'local');

  if (!accountDirs.length) {
    console.warn('No account folders found. Open Gestal and sync your account first.');
    return;
  }

  for (const entry of accountDirs) {
    syncAccount(path.join(GESTAL_ROOT, entry.name), entry.name);
  }

  console.log('[done]');
}

// ── Watch mode ────────────────────────────────────────────────────────────────

const WATCH_MODE = process.argv.includes('--watch');

syncAll();

if (WATCH_MODE) {
  console.log(`\nWatching ${GESTAL_ROOT} for changes… (Ctrl+C to stop)\n`);

  let debounceTimer = null;

  fs.watch(GESTAL_ROOT, { recursive: true }, (event, filename) => {
    if (!filename?.endsWith('.json')) return;
    clearTimeout(debounceTimer);
    // Debounce — Gestal often writes several files in quick succession
    debounceTimer = setTimeout(() => {
      console.log(`\n[change detected: ${filename}]`);
      syncAll();
    }, 800);
  });
}
