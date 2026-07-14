// ── tools/generate-type-id-backfill.mjs ──────────────────────────────────────
// DURABLE FIX for champion identity resolution.
//
// buildUserChampions() keys on champions.type_id (the stable game baseTypeId)
// FIRST, then falls back to display-name matching. Only ~52 champions had
// type_id seeded (seed 11, from 2 small accounts), so ~95% of resolution ran on
// the unstable name key — which breaks whenever Gestal's name differs from the
// DB name ("Hellborn Sprite" vs DB "Hellborn"), i.e. exactly the champions that
// need aliases.
//
// This tool LEARNS baseTypeId for as many champions as possible from the local
// Gestal exports, bridging Gestal name -> DB champion via (a) exact normalized
// name and (b) the curated champion_aliases table, then EMITS a reviewable seed
// that fills type_id ONLY where it is currently NULL. It never overwrites the
// human-verified existing values, and it excludes every ambiguous/colliding case
// (the champions.(game_id,type_id) unique index makes a bad write fatal).
//
// Writes are seed-gated per project rules: this only GENERATES SQL. Apply via
//   node tools/apply-seed-pooler.mjs seeds/127_*.sql
//
// Usage: node tools/generate-type-id-backfill.mjs
// Re-run any time new accounts are synced; the seed is idempotent.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname, '..');
const OUTPUT_DIR = path.join(REPO, 'gestal-sync', 'output');
const SEED_PATH = path.join(REPO, 'seeds', '127_backfill_champion_type_id_from_gestal.sql');

const env = {};
for (const l of fs.readFileSync(path.join(REPO, '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const BASE = (env.SUPABASE_URL ?? '').replace(/\/rest\/v1\/?$/, '');
const KEY = env.SUPABASE_SERVICE_KEY;
if (!BASE || !KEY) { console.error('SUPABASE_URL / SUPABASE_SERVICE_KEY missing'); process.exit(1); }
const H = { apikey: KEY, Authorization: `Bearer ${KEY}` };
const norm = (s) => String(s ?? '').trim().toLowerCase();

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

// ── 1. DB state ──────────────────────────────────────────────────────────────
const champions = await fetchAll('champions?select=id,name,type_id,rarity&game_id=eq.raid_shadow_legends');
const aliases   = await fetchAll('champion_aliases?select=alias,champion_id&game_id=eq.raid_shadow_legends');
const champById = new Map(champions.map((c) => [c.id, c]));

// name/alias -> champion_id bridge. On a name collision between a real name and
// an alias, the real champions.name wins (set it last).
const idByName = new Map();
for (const a of aliases)   idByName.set(norm(a.alias), a.champion_id);
for (const c of champions) idByName.set(norm(c.name), c.id);

// type_id already in use (by the verified seed-11 rows) — a learned value that
// hits one of these on a DIFFERENT champion would violate the unique index.
const existingTypeIdOwner = new Map(); // type_id -> champion_id
for (const c of champions) if (c.type_id != null) existingTypeIdOwner.set(c.type_id, c.id);

// ── 2. Learn (champion_id -> baseTypeId) from every Gestal export ─────────────
const files = fs.existsSync(OUTPUT_DIR) ? fs.readdirSync(OUTPUT_DIR).filter((f) => f.endsWith('.json')) : [];
const learned = new Map(); // champion_id -> Map(baseTypeId -> Set(sourceName))
const unresolvedNames = new Set(); // gestal names bridging to no DB champion

for (const f of files) {
  let roster;
  try { roster = JSON.parse(fs.readFileSync(path.join(OUTPUT_DIR, f), 'utf8')); } catch { continue; }
  for (const g of roster.champions ?? []) {
    const base = g.baseTypeId ?? g.typeId;
    if (base == null || !g.name) continue;
    const cid = idByName.get(norm(g.name));
    if (!cid) { unresolvedNames.add(g.name); continue; }
    if (!learned.has(cid)) learned.set(cid, new Map());
    const m = learned.get(cid);
    if (!m.has(base)) m.set(base, new Set());
    m.get(base).add(g.name);
  }
}

// ── 3. Resolve to clean assignments + collect conflicts ──────────────────────
const assignments = [];        // { id, name, type_id, via }
const skipAmbiguousChamp = []; // champion mapped to >1 baseTypeId
const skipAlreadySet = [];     // champion already has type_id (agree/disagree)
const baseToChamps = new Map(); // baseTypeId -> Set(champion_id) for cross-collision

for (const [cid, m] of learned) {
  const champ = champById.get(cid);
  if (!champ) continue;
  const bases = [...m.keys()];
  if (bases.length > 1) { skipAmbiguousChamp.push({ name: champ.name, bases }); continue; }
  const base = bases[0];
  const via = [...m.get(base)][0];

  if (champ.type_id != null) {
    skipAlreadySet.push({ name: champ.name, existing: champ.type_id, learned: base, agree: champ.type_id === base });
    continue;
  }
  if (!baseToChamps.has(base)) baseToChamps.set(base, new Set());
  baseToChamps.get(base).add(cid);
  assignments.push({ id: cid, name: champ.name, type_id: base, via, rarity: champ.rarity });
}

// cross-collisions: same baseTypeId learned for two different champions, OR the
// baseTypeId is already owned by a verified row on a different champion.
const collisions = [];
const clean = assignments.filter((a) => {
  if (baseToChamps.get(a.type_id).size > 1) {
    collisions.push({ ...a, reason: 'baseTypeId maps to multiple champions' });
    return false;
  }
  const owner = existingTypeIdOwner.get(a.type_id);
  if (owner && owner !== a.id) {
    collisions.push({ ...a, reason: `type_id already held by ${champById.get(owner)?.name}` });
    return false;
  }
  return true;
});

// ── 4. Report ────────────────────────────────────────────────────────────────
const rarityRank = { Mythical: 5, Legendary: 4, Epic: 3, Rare: 2, Uncommon: 1, Common: 0 };
clean.sort((a, b) => (rarityRank[b.rarity] ?? 0) - (rarityRank[a.rarity] ?? 0) || a.name.localeCompare(b.name));

const disagreements = skipAlreadySet.filter((s) => !s.agree);
console.log(`Gestal exports read: ${files.length}`);
console.log(`champions: ${champions.length} | already had type_id: ${champions.filter((c) => c.type_id != null).length}`);
console.log(`\nLEARNED assignments to write (type_id was NULL): ${clean.length}`);
console.log(`  by rarity: ` + ['Mythical', 'Legendary', 'Epic', 'Rare', 'Uncommon', 'Common']
  .map((r) => `${r} ${clean.filter((c) => c.rarity === r).length}`).join(' · '));
console.log(`\nskipped — already set & AGREE (validates seed 11): ${skipAlreadySet.length - disagreements.length}`);
console.log(`skipped — ambiguous (champion -> multiple baseTypeIds): ${skipAmbiguousChamp.length}`);
if (skipAmbiguousChamp.length) for (const s of skipAmbiguousChamp) console.log(`    · ${s.name}: ${s.bases.join(', ')}`);
console.log(`EXCLUDED — collisions (would break unique index): ${collisions.length}`);
if (collisions.length) for (const c of collisions) console.log(`    ⚠ ${c.name} (${c.type_id}) — ${c.reason}`);
console.log(`\n⚠ DISAGREEMENTS with existing verified type_id: ${disagreements.length}`);
if (disagreements.length) for (const d of disagreements) console.log(`    ⚠ ${d.name}: DB=${d.existing} learned=${d.learned}  (NOT touched — review)`);
console.log(`\nGestal names that bridged to NO champion (still name-gapped): ${unresolvedNames.size}`);

// ── 5. Emit seed ─────────────────────────────────────────────────────────────
const esc = (s) => String(s).replace(/'/g, "''");
const lines = [];
lines.push('-- ============================================================================');
lines.push('-- Backfill champions.type_id (stable game baseTypeId) from Gestal exports.');
lines.push('-- Generated by tools/generate-type-id-backfill.mjs. Extends seed 11 using the');
lines.push('-- DonBrogni/DonGnut/DonCobb07 exports + the champion_aliases bridge.');
lines.push('--');
lines.push('-- Fills type_id ONLY where currently NULL (never overwrites the verified rows).');
lines.push('-- Every value below is unambiguous: one baseTypeId per champion, one champion');
lines.push('-- per baseTypeId, and no collision with an existing type_id. Idempotent.');
lines.push(`-- Rows: ${clean.length}. Excluded ${collisions.length} collisions, ${skipAmbiguousChamp.length} ambiguous, ${disagreements.length} disagreements (see tool output).`);
lines.push('-- ============================================================================');
lines.push('');
lines.push('begin;');
lines.push('');
for (const a of clean) {
  lines.push(`update champions set type_id = ${a.type_id}, updated_at = now()`);
  lines.push(`  where id = '${a.id}' and game_id = 'raid_shadow_legends' and type_id is null;  -- ${esc(a.name)} (via ${esc(a.via)})`);
}
lines.push('');
lines.push('commit;');
fs.writeFileSync(SEED_PATH, lines.join('\n') + '\n');
console.log(`\n→ wrote ${path.relative(REPO, SEED_PATH)} (${clean.length} updates)`);
