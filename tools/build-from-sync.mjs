// tools/build-from-sync.mjs — regenerate an observed-build file for a team from the CURRENT Gestal sync.
//
// The hand-captured observed-builds (data/observed-builds/*-demon-lord.json etc.) are frozen, PARTIAL
// (only one gear set per champ was legible off a video frame) and drift stale as the player re-gears.
// The Gestal sync (gestal-sync/output/<name>_<accountId>.json) carries COMPLETE per-artifact data, so
// effectiveStats() reconstructs the exact battle-start stats + full set composition. This tool emits a
// build file in the SAME schema the fixture builder reads (dragon-fixture.js: champions[].total_stats +
// .lifesteal + .gear_sets), so a runtime fixture can point at CURRENT gear with no capture artifacts.
//
// Stats here are ROSTER-screen (base + gear); the fixture harness layers leader aura + arena on top,
// exactly as before. Lifesteal is credited ONLY when the 4-set is COMPLETE (a loose Lifesteal piece is
// not the set) — the one set EFFECT the sim consumes; other set effects (e.g. Shield 2-set) are listed
// for documentation but not yet modelled.
//
// Run: node tools/build-from-sync.mjs [accountId] [Name1,Name2,...] > data/observed-builds/<out>.json
//   default: DonBambus's Dragon team.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { effectiveStats } from '../lib/effective-stats.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname, '..');
const OUT_DIR = path.join(REPO, 'gestal-sync', 'output');

const ACCOUNT = process.argv[2] || '9d30ab7d99fdf3c3';   // DonBambus
const TEAM = (process.argv[3] || 'Ezio Auditore,Pelops the Victor,Bambus Fourleaf,Tagoar,Vergis').split(',').map(s => s.trim());

// Lifesteal is a 4-piece set (stable game fact) — the ONE set effect the sim consumes (30% of dmg dealt).
const LIFESTEAL_PIECES_REQUIRED = 4;

const files = fs.readdirSync(OUT_DIR).filter(f => f === `${ACCOUNT}.json` || f.endsWith(`_${ACCOUNT}.json`));
if (!files.length) { console.error(`no Gestal export for account ${ACCOUNT} in ${OUT_DIR}`); process.exit(1); }
const sync = JSON.parse(fs.readFileSync(path.join(OUT_DIR, files[0]), 'utf8'));

const champions = [];
for (const nm of TEAM) {
  const g = (sync.champions || []).find(c => c.name === nm);
  if (!g) { console.error(`champion not found in sync: ${nm}`); process.exit(1); }
  const e = effectiveStats(g).effective;
  // set piece counts (factual) + complete-set flag for Lifesteal only
  const counts = {};
  for (const a of g.equippedArtifacts || []) counts[a.set] = (counts[a.set] || 0) + 1;
  const lsCount = counts['Lifesteal'] || 0;
  const lifesteal = lsCount >= LIFESTEAL_PIECES_REQUIRED ? 0.30 : 0;
  const gear_sets = Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([s, n]) => `${s}×${n}`);
  champions.push({
    name: g.name, level: g.level, stars: g.stars, rarity: g.rarity, affinity: g.affinity,
    gear_sets,
    lifesteal,
    base_spd: g.baseStats?.spd ?? null,   // ACTUAL base SPD at current level+ascension — the leader SPD aura scales BASE only (True Speed §4); NOT the DB max-ascension value
    total_stats: { hp: e.hp, atk: e.atk, def: e.def, spd: e.spd, crit_rate: e.crate, crit_dmg: e.cdmg, res: e.res, acc: e.acc },
  });
}

const out = {
  _source: `regenerated from Gestal sync ${files[0]} (syncedAt ${sync.syncedAt ?? sync.lastSnapshotAt ?? '?'})`,
  _note: 'total_stats = effectiveStats(base+gear), ROSTER screen (no aura/arena — the fixture harness layers those). lifesteal = 0.30 iff the Lifesteal 4-set is COMPLETE. gear_sets = piece counts (factual); only the Lifesteal set effect is consumed by the sim.',
  _generator: 'tools/build-from-sync.mjs',
  champions,
};
process.stdout.write(JSON.stringify(out, null, 1) + '\n');
