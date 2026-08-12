// ── lib/gear-labels.js ───────────────────────────────────────────────────────
// Shared artifact id→label maps. The direct memory reader emits NUMERIC ids
// (mainStatId/statId in the Gestal statId scheme, gearSetId as the game
// ArtifactSetKindId); effectiveStats() and build-from-sync consume STRING labels
// (mainStat/stat/set). These maps bridge the two.
//
// Source of truth: gestal-sync/sync.js (STAT_KIND / GEAR_SET / SLOT). Kept here so
// the memory path can reuse them without importing sync.js (which runs syncAll()
// on import). GEAR_SET is the game's ArtifactSetKindId enum (stable across patches;
// new sets append) mapped to in-game names.

export const STAT_KIND = {
  1: 'HP',    2: 'DEF',   3: 'ATK',  4: 'HP%',
  5: 'DEF%',  6: 'ATK%',  7: 'SPD',  8: 'CRATE',
  9: 'CDMG', 10: 'ACC',  11: 'RES',
};

export const SLOT = {
  0: 'Weapon', 1: 'Helmet', 2: 'Shield',
  3: 'Gauntlets', 4: 'Chestplate', 5: 'Boots',
  6: 'Ring', 7: 'Amulet', 8: 'Banner',
};

export const GEAR_SET = {
  1:  'Life',            2:  'Offense',              3:  'Defense',
  4:  'Speed',           5:  'Critical Rate',        6:  'Critical Damage',
  7:  'Accuracy',        8:  'Resistance',           9:  'Lifesteal',
  10: 'Fury',            11: 'Daze',                 12: 'Cursed',
  13: 'Frost',           14: 'Frenzy',               15: 'Curing',
  16: 'Immunity',        17: 'Shield',               18: 'Relentless',
  19: 'Savage',          20: 'Destroy',              21: 'Stun',
  22: 'Toxic',           23: 'Taunting',             24: 'Retaliation',
  25: 'Avenging',        26: 'Stalwart',             27: 'Reflex',
  28: 'CriticalHeal',    29: 'Cruel',                30: 'Immortal',
  31: 'Divine Offense',  32: 'Divine Critical Rate', 33: 'Divine Life',
  34: 'Divine Speed',    35: 'Swift Parry',          36: 'Deflection',
  37: 'Resilience',      38: 'Perception',           39: 'Affinitybreaker',
  40: 'Untouchable',     41: 'Fatal',                42: 'Frostbite',
  43: 'Bloodthirst',     44: 'Guardian',             45: 'Fortitude',
  46: 'Lethal',          48: 'Stoneskin',            49: 'Killstroke',
  50: 'Instinct',        51: 'Bolster',              52: 'Defiant',
  53: 'Impulse',         54: 'Zeal',                 57: 'Righteous',
  58: 'Supersonic',      61: 'Feral',                62: 'Pinpoint',
  64: 'Rebirth',         65: 'Chronophage',
  1000: 'Refresh',       1001: 'Cleansing',          1002: 'Bloodshield',
  1003: 'Reaction',      1004: 'Revenge',
};

export const label = (map, id, fallback = null) =>
  id != null ? (map[id] ?? fallback) : null;
