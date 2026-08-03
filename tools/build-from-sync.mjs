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
import { hasBossMastery, masteryNames } from '../lib/masteries.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname, '..');
const OUT_DIR = path.join(REPO, 'gestal-sync', 'output');

const ACCOUNT = process.argv[2] || '9d30ab7d99fdf3c3';   // DonBambus
const TEAM = (process.argv[3] || 'Ezio Auditore,Pelops the Victor,Bambus Fourleaf,Tagoar,Vergis').split(',').map(s => s.trim());

// Lifesteal is a 4-piece set (stable game fact) — the ONE set effect the sim consumes (30% of dmg dealt).
const LIFESTEAL_PIECES_REQUIRED = 4;

// Map a Gestal champion's per-skill levels to {A1,A2,A3} by the skillId's last digit (…1=A1, …2=A2,
// …3=A3; higher digits are passives/A4 — ignored). `maxed` = the skill is fully upgraded (level>=maxLevel),
// which is the signal the fixture uses to apply the BOOKED cooldown instead of BASE.
function skillLevels(skills) {
  const out = {};
  for (const s of skills ?? []) {
    const slot = `A${Number(s.skillId) % 10}`;
    if (!['A1', 'A2', 'A3'].includes(slot)) continue;
    out[slot] = { level: s.level, maxLevel: s.maxLevel, maxed: (s.level ?? 0) >= (s.maxLevel ?? 0) };
  }
  return out;
}

const files = fs.readdirSync(OUT_DIR).filter(f => f === `${ACCOUNT}.json` || f.endsWith(`_${ACCOUNT}.json`));
if (!files.length) { console.error(`no Gestal export for account ${ACCOUNT} in ${OUT_DIR}`); process.exit(1); }
const sync = JSON.parse(fs.readFileSync(path.join(OUT_DIR, files[0]), 'utf8'));

// CHAMPION IDENTITY — resolve every name (both the TEAM argument and the Gestal sync's display name) to
// champions.id via the ONE registry, then match on the id. An operator can type any alias ('Artor', 'Iudex',
// 'Iudex Artor') and a Gestal display-name variant still lines up, because both sides collapse to the same id.
// Requires the DB (run with --env-file=.env.local, as the documented invocations do); a name the registry
// does not know errors LOUDLY naming the offender — that gap belongs in champion_aliases, never in a local map.
const BASE = (process.env.SUPABASE_URL || '').replace(/\/rest\/v1\/?$/, '');
const KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!BASE || !KEY) { console.error('build-from-sync resolves champions via the DB registry — run with --env-file=.env.local (SUPABASE_URL + SUPABASE_SERVICE_KEY required)'); process.exit(1); }
const H = { apikey: KEY, Authorization: `Bearer ${KEY}` };
const rest = (p) => fetch(`${BASE}/rest/v1/${p}`, { headers: H }).then(r => r.json());
const { loadNameResolverRest } = await import('../lib/champion-names.js');
const resolver = await loadNameResolverRest(rest);
// index the sync champions by resolved champions.id (skip any the registry doesn't know — surfaced on demand below)
const syncById = new Map();
for (const c of sync.champions || []) { const hit = resolver.resolve(c.name); if (hit) syncById.set(hit.id, c); }

const champions = [];
for (const nm of TEAM) {
  const teamHit = resolver.resolveOrThrow(nm, 'build-from-sync TEAM');   // throws, naming nm, if the registry doesn't know it
  const g = syncById.get(teamHit.id);
  if (!g) { console.error(`champion resolved (${nm} → ${teamHit.name} / ${teamHit.id}) but not present in this account's Gestal sync`); process.exit(1); }
  const e = effectiveStats(g).effective;
  // set piece counts (factual) + complete-set flag for Lifesteal only
  const counts = {};
  for (const a of g.equippedArtifacts || []) counts[a.set] = (counts[a.set] || 0) + 1;
  const lsCount = counts['Lifesteal'] || 0;
  const lifesteal = lsCount >= LIFESTEAL_PIECES_REQUIRED ? 0.30 : 0;
  const gear_sets = Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([s, n]) => `${s}×${n}`);
  champions.push({
    name: teamHit.name, level: g.level, stars: g.stars, rarity: g.rarity, affinity: g.affinity,   // CANONICAL champions.name (resolved by id), so the fixture's builds[dbName] lookup always matches
    gear_sets,
    lifesteal,
    has_boss_mastery: hasBossMastery(g.masteryIds),   // REAL Warmaster (500161) / Giant Slayer (500163) from Gestal masteryIds — the per-account truth, not the 'assume all damage-dealers' generalization
    mastery_count: (g.masteryIds ?? []).length,       // 0 = champ has NO masteries at all (undeveloped) — useful for calibrating the app's generalization
    masteries: masteryNames(g.masteryIds),            // DECODED mastery names (data/masteries.json). Flat-stat masteries are already in total_stats via bonusesV2.mastery; the sim consumes only the conditional/proc DAMAGE masteries + boss %maxHP bonus from this list.
    base_spd: g.baseStats?.spd ?? null,   // ACTUAL base SPD at current level+ascension — the leader SPD aura scales BASE only (True Speed §4); NOT the DB max-ascension value
    base_hp: g.baseStats?.hp ?? null, base_atk: g.baseStats?.atk ?? null, base_def: g.baseStats?.def ?? null,   // ACTUAL base HP/ATK/DEF at current level+ascension — the arena bonus scales BASE only (not the geared total)
    skill_levels: skillLevels(g.skills),   // REAL per-skill upgrade level (Gestal). A maxed skill uses its BOOKED cooldown; an unbooked (level 1) skill uses BASE. Consumed by the fixture builder to pick base vs booked cooldown per skill (a fully-booked A2/A3 recharges 1 turn faster).
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
