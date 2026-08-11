// ── tools/generate-type-id-from-catalog.mjs ──────────────────────────────────
// DURABLE FIX (complete-coverage successor to generate-type-id-backfill.mjs).
//
// buildUserChampions() keys on champions.type_id (the stable game baseTypeId) FIRST,
// then falls back to display-name matching. Only ~25% of champions had type_id, so the
// direct game-memory roster reader (Option B) — which knows baseTypeId but not the name
// — dropped ~half the roster on the name-fallback path (measured 36 vs 73 matched).
// Backfilling type_id makes baseTypeId sufficient and removes that dependency.
//
// SOURCE: the committed data/champion-basetype-names.json (baseTypeId -> name; a factual
// game-data snapshot, see tools/gen-champion-names.mjs). Fully self-contained — reads
// committed data + the live DB, no Gestal file at generate time. Resolves each catalog
// name to a DB champion via the ONE registry (buildNameResolver: champions + aliases),
// never a raw-name compare (CLAUDE.md hard rule).
//
// SAFETY (same posture as the Gestal-export generator it supersedes):
//   • fills type_id ONLY where currently NULL — never overwrites a verified value;
//   • VALIDATES: where type_id is already set it must AGREE with the catalog baseTypeId
//     (this both audits existing seeds and proves gameId == type_id) — disagreements are
//     reported and NOT touched;
//   • excludes collisions (a baseTypeId already owned by another champion, or one that
//     maps to >1 champion) — the champions.(game_id,type_id) unique index makes a bad
//     write fatal;
//   • emits an idempotent seed (`where ... type_id is null`). Writes are seed-gated.
//
// Usage:  node tools/generate-type-id-from-catalog.mjs
// Apply:  node tools/apply-seed-pooler.mjs seeds/2026-08-11_backfill_champion_type_id_from_catalog.sql

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildNameResolver } from '../lib/champion-names.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname, '..');
const CATALOG = path.join(REPO, 'data', 'champion-basetype-names.json');
const SEED_PATH = path.join(REPO, 'seeds', '2026-08-11_backfill_champion_type_id_from_catalog.sql');

const env = {};
for (const l of fs.readFileSync(path.join(REPO, '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const BASE = (env.SUPABASE_URL ?? '').replace(/\/rest\/v1\/?$/, '');
const KEY = env.SUPABASE_SERVICE_KEY;
if (!BASE || !KEY) { console.error('SUPABASE_URL / SUPABASE_SERVICE_KEY missing'); process.exit(1); }
const H = { apikey: KEY, Authorization: `Bearer ${KEY}` };

async function fetchAll(pathAndQuery) {
  let all = [], from = 0, step = 1000;
  for (;;) {
    const r = await fetch(`${BASE}/rest/v1/${pathAndQuery}&limit=${step}&offset=${from}`, { headers: H });
    const d = await r.json();
    if (!Array.isArray(d) || !d.length) break;
    all = all.concat(d); from += step; if (d.length < step) break;
  }
  return all;
}

// ── 1. Inputs ────────────────────────────────────────────────────────────────
const catalog = JSON.parse(fs.readFileSync(CATALOG, 'utf8')); // { baseTypeId(str): name }
const champions = await fetchAll('champions?select=id,name,type_id,rarity&game_id=eq.raid_shadow_legends');
const aliases   = await fetchAll('champion_aliases?select=alias,champion_id&game_id=eq.raid_shadow_legends');
const champById = new Map(champions.map((c) => [c.id, c]));
const resolver = buildNameResolver(champions, aliases);

const existingTypeIdOwner = new Map(); // type_id -> champion_id (verified rows)
for (const c of champions) if (c.type_id != null) existingTypeIdOwner.set(c.type_id, c.id);

// ── 2. Resolve catalog name -> DB champion; collect learned baseTypeIds ────────
const learned = new Map();          // champion_id -> Map(baseTypeId -> Set(catalogName))
const unresolvedNames = [];         // catalog names bridging to no DB champion
for (const [baseStr, name] of Object.entries(catalog)) {
  const base = Number(baseStr);
  const hit = resolver.resolve(name);
  if (!hit) { unresolvedNames.push(`${name} (${base})`); continue; }
  if (!learned.has(hit.id)) learned.set(hit.id, new Map());
  const m = learned.get(hit.id);
  if (!m.has(base)) m.set(base, new Set());
  m.get(base).add(name);
}

// ── 3. Split into assignments / already-set(validation) / ambiguous ───────────
const assignments = [];        // { id, name, type_id, via, rarity }
const skipAmbiguous = [];      // champion mapped to >1 baseTypeId
const alreadySet = [];         // { name, existing, catalog, agree }
const baseToChamps = new Map(); // baseTypeId -> Set(champion_id)

for (const [cid, m] of learned) {
  const champ = champById.get(cid);
  if (!champ) continue;
  const bases = [...m.keys()];
  if (bases.length > 1) { skipAmbiguous.push({ name: champ.name, bases }); continue; }
  const base = bases[0];
  const via = [...m.get(base)][0];

  if (champ.type_id != null) {
    alreadySet.push({ name: champ.name, existing: champ.type_id, catalog: base, agree: champ.type_id === base });
    continue;
  }
  if (!baseToChamps.has(base)) baseToChamps.set(base, new Set());
  baseToChamps.get(base).add(cid);
  assignments.push({ id: cid, name: champ.name, type_id: base, via, rarity: champ.rarity });
}

// ── 4. Exclude cross-collisions ───────────────────────────────────────────────
const collisions = [];
const clean = assignments.filter((a) => {
  if (baseToChamps.get(a.type_id).size > 1) { collisions.push({ ...a, reason: 'baseTypeId maps to multiple champions' }); return false; }
  const owner = existingTypeIdOwner.get(a.type_id);
  if (owner && owner !== a.id) { collisions.push({ ...a, reason: `type_id already held by ${champById.get(owner)?.name}` }); return false; }
  return true;
});

// ── 5. Report ─────────────────────────────────────────────────────────────────
const rarityRank = { Mythical: 5, Legendary: 4, Epic: 3, Rare: 2, Uncommon: 1, Common: 0 };
clean.sort((a, b) => (rarityRank[b.rarity] ?? 0) - (rarityRank[a.rarity] ?? 0) || a.name.localeCompare(b.name));
const disagreements = alreadySet.filter((s) => !s.agree);

console.log(`catalog entries: ${Object.keys(catalog).length}`);
console.log(`DB champions: ${champions.length} | already had type_id: ${champions.filter((c) => c.type_id != null).length}`);
console.log(`\n── VALIDATION (existing type_id vs catalog) ──`);
console.log(`  already-set & AGREE (proves gameId == type_id): ${alreadySet.length - disagreements.length}/${alreadySet.length}`);
if (disagreements.length) { console.log(`  ⚠ DISAGREEMENTS (NOT touched — investigate before applying):`); for (const d of disagreements) console.log(`      ${d.name}: DB=${d.existing} catalog=${d.catalog}`); }
console.log(`\n── BACKFILL (type_id was NULL) ──`);
console.log(`  rows to write: ${clean.length}`);
console.log(`  by rarity: ` + ['Mythical', 'Legendary', 'Epic', 'Rare', 'Uncommon', 'Common'].map((r) => `${r} ${clean.filter((c) => c.rarity === r).length}`).join(' · '));
console.log(`  excluded — collisions: ${collisions.length}`); for (const c of collisions) console.log(`      ⚠ ${c.name} (${c.type_id}) — ${c.reason}`);
console.log(`  skipped — ambiguous (champion -> multiple baseTypeIds): ${skipAmbiguous.length}`); for (const s of skipAmbiguous) console.log(`      · ${s.name}: ${s.bases.join(', ')}`);
console.log(`\ncatalog names bridging to NO DB champion (out-of-scope Commons / not-yet-seeded): ${unresolvedNames.length}`);

// ── 6. Emit seed ──────────────────────────────────────────────────────────────
const esc = (s) => String(s).replace(/'/g, "''");
const lines = [];
lines.push('-- ============================================================================');
lines.push('-- Backfill champions.type_id (stable game baseTypeId) from the committed catalog');
lines.push('-- snapshot data/champion-basetype-names.json. Generated by');
lines.push('-- tools/generate-type-id-from-catalog.mjs — complete-coverage successor to the');
lines.push('-- Gestal-export backfill (seed 127). Names resolved via buildNameResolver');
lines.push('-- (champions + champion_aliases), never a raw-name compare.');
lines.push('--');
lines.push('-- Fills type_id ONLY where currently NULL (never overwrites a verified row).');
lines.push('-- One baseTypeId per champion, one champion per baseTypeId, no collision with an');
lines.push('-- existing type_id. Idempotent.');
lines.push(`-- Rows: ${clean.length}. Validation: ${alreadySet.length - disagreements.length}/${alreadySet.length} existing type_ids AGREE with the catalog`);
lines.push(`-- (${disagreements.length} disagreements NOT touched). Excluded ${collisions.length} collisions, ${skipAmbiguous.length} ambiguous. See tool output.`);
lines.push('-- ============================================================================');
lines.push('');
lines.push('begin;');
lines.push('');
for (const a of clean) {
  lines.push(`update champions set type_id = ${a.type_id}, updated_at = now()`);
  lines.push(`  where id = '${a.id}' and game_id = 'raid_shadow_legends' and type_id is null;  -- ${esc(a.name)}`);
}
lines.push('');
lines.push('commit;');
fs.writeFileSync(SEED_PATH, lines.join('\n') + '\n');
console.log(`\n→ wrote ${path.relative(REPO, SEED_PATH)} (${clean.length} updates)`);
