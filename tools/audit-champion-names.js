#!/usr/bin/env node
// ── tools/audit-champion-names.js ────────────────────────────────────────────
// REPORT-ONLY name audit (writes nothing to the DB). Two outputs:
//   (1) Truncations — DB champions.name that disagrees with the game's full name
//       (from the Gestal export, matched by type_id = baseTypeId). These are the
//       mis-seeds (Narma/Yoshi pattern) to correct to the full in-game name.
//   (2) Alias candidates — short/community forms (drop the "X the Y" epithet, or a
//       leading adjective) that resolve to exactly ONE champion (CLEAN, safe to
//       seed) vs. those that map to several (AMBIGUOUS, need typeId context).
//
//   node --env-file=.env.local tools/audit-champion-names.js
// Output: output/name-audit-<date>.txt (gitignored).
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const OUT_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'output');
const GESTAL_DIR = path.join(os.homedir(), 'AppData', 'Local', 'Gestal', 'accounts');

const norm = (s) => String(s ?? '').trim().toLowerCase();

// Community/game short forms of a full name: the pre-"the" part, and — for a
// multi-word name — the last word (drops a leading adjective) and the first word.
function shortForms(name) {
  const forms = new Set();
  const m = name.match(/^(.+?)\s+the\s+/i);
  if (m) forms.add(m[1].trim());
  // last word drops a leading adjective (Glorious Pallas -> Pallas, Longsword Torrux
  // -> Torrux). We do NOT alias the first word — leading adjectives (Dark, Crimson,
  // Steel) are shared and pure noise.
  const words = name.trim().split(/\s+/);
  if (words.length > 1) forms.add(words[words.length - 1]);
  return [...forms].filter((f) => f && norm(f) !== norm(name) && f.length >= 3);
}

// ── Gestal game names (owned champions only) keyed by baseTypeId ──────────────
function gestalGameNames() {
  const byBase = new Map(); // baseTypeId -> full game name
  if (!fs.existsSync(GESTAL_DIR)) return byBase;
  for (const acct of fs.readdirSync(GESTAL_DIR)) {
    const f = path.join(GESTAL_DIR, acct, 'champions.json');
    if (!fs.existsSync(f)) continue;
    try {
      for (const c of JSON.parse(fs.readFileSync(f, 'utf8'))?.payload?.champions ?? [])
        if (c.baseTypeId != null && c.name && !byBase.has(c.baseTypeId)) byBase.set(c.baseTypeId, c.name);
    } catch { /* skip */ }
  }
  return byBase;
}

const client = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
await client.connect();
try {
  const { rows: champs } = await client.query("select id, name, type_id from champions where game_id = 'raid_shadow_legends'");
  const byType = new Map(champs.filter((c) => c.type_id != null).map((c) => [c.type_id, c]));
  const gameNames = gestalGameNames();

  // (1) truncations: game full name != DB name (owned+linked champions)
  const truncations = [];
  for (const [base, gameName] of gameNames) {
    const db = byType.get(base);
    if (db && norm(db.name) !== norm(gameName)) truncations.push({ base, dbName: db.name, gameName });
  }

  // (2) alias candidates: build candidate -> set of owning champion names
  const owners = new Map();       // normalized short form -> Set(canonical name)
  const fullByNorm = new Map(champs.map((c) => [norm(c.name), c.name]));
  for (const c of champs) for (const sf of shortForms(c.name)) {
    const k = norm(sf);
    if (!owners.has(k)) owners.set(k, new Set());
    owners.get(k).add(c.name);
  }
  const clean = [], ambiguous = [];
  for (const [k, set] of owners) {
    const collidesFullName = fullByNorm.has(k) && !set.has(fullByNorm.get(k)); // short form IS another real champion
    const ownersList = [...set];
    if (ownersList.length === 1 && !collidesFullName) clean.push({ alias: [...set][0] === undefined ? k : k, canonical: ownersList[0] });
    else ambiguous.push({ alias: k, maps_to: ownersList, also_a_full_champion: fullByNorm.get(k) ?? null });
  }

  // ── report ──────────────────────────────────────────────────────────────────
  const date = new Date().toISOString().slice(0, 10);
  const out = [];
  out.push(`Champion name audit — ${date} (REPORT ONLY, no writes)`);
  out.push('');
  out.push(`(1) TRUNCATIONS — DB name != game full name (${truncations.length}); correct DB to the game name:`);
  for (const t of truncations.sort((a, b) => a.dbName.localeCompare(b.dbName)))
    out.push(`  - "${t.dbName}"  ->  "${t.gameName}"  (baseTypeId ${t.base})`);
  if (!truncations.length) out.push('  (none among owned+linked champions)');
  out.push('');
  out.push(`(2a) CLEAN ALIAS CANDIDATES — resolve to exactly one champion, safe to seed (${clean.length}):`);
  for (const a of clean.sort((x, y) => x.canonical.localeCompare(y.canonical)).slice(0, 200))
    out.push(`  - "${a.alias}"  ->  ${a.canonical}`);
  if (clean.length > 200) out.push(`  … +${clean.length - 200} more`);
  out.push('');
  out.push(`(2b) AMBIGUOUS SHORT FORMS — map to multiple champions, DO NOT auto-seed (${ambiguous.length}):`);
  for (const a of ambiguous.sort((x, y) => x.alias.localeCompare(y.alias)).slice(0, 60))
    out.push(`  - "${a.alias}" -> [${a.maps_to.join(' | ')}]${a.also_a_full_champion ? ` (also a real champion: ${a.also_a_full_champion})` : ''}`);
  if (ambiguous.length > 60) out.push(`  … +${ambiguous.length - 60} more`);

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const outPath = path.join(OUT_DIR, `name-audit-${date}.txt`);
  fs.writeFileSync(outPath, out.join('\n') + '\n');
  // console: summary + truncations + a sample of each alias bucket
  console.log(out.slice(0, 3).join('\n'));
  console.log(`\nTruncations: ${truncations.length} | clean aliases: ${clean.length} | ambiguous: ${ambiguous.length}`);
  console.log(`\n(1) TRUNCATIONS:`); truncations.forEach((t) => console.log(`  "${t.dbName}" -> "${t.gameName}"`));
  console.log(`\n(2b) AMBIGUOUS (sample):`); ambiguous.slice(0, 12).forEach((a) => console.log(`  "${a.alias}" -> [${a.maps_to.join(' | ')}]${a.also_a_full_champion ? ` (+real champ ${a.also_a_full_champion})` : ''}`));
  console.log(`\n→ full report: ${outPath}`);
} finally {
  await client.end();
}
