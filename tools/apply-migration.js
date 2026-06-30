// ── tools/apply-migration.js ─────────────────────────────────────────────────
// Applies a .sql migration file to the Supabase Postgres database in a single
// transaction (rolls back on any error).
//
// Requires a direct Postgres connection string — the Supabase SERVICE_KEY is a
// PostgREST JWT and cannot run DDL. Get the string from:
//   Supabase dashboard → Project Settings → Database → Connection string (URI),
//   "Session" pooler (port 5432). Put it in .env.local as SUPABASE_DB_URL.
//
// Usage:
//   node --env-file=.env.local tools/apply-migration.js migrations/<file>.sql
//   node --env-file=.env.local tools/apply-migration.js --dry-run migrations/<file>.sql

import fs from 'fs';
import path from 'path';
import pg from 'pg';

const args    = process.argv.slice(2);
const dryRun  = args.includes('--dry-run');
const file    = args.find(a => a.endsWith('.sql'));

if (!file) {
  console.error('Usage: node --env-file=.env.local tools/apply-migration.js [--dry-run] <file.sql>');
  process.exit(1);
}

const connectionString = process.env.SUPABASE_DB_URL;
if (!connectionString) {
  console.error('SUPABASE_DB_URL is not set. Add the Postgres connection string (Session pooler, :5432) to .env.local.');
  process.exit(1);
}

const sql = fs.readFileSync(path.resolve(file), 'utf8');

if (dryRun) {
  console.log(`[dry-run] would apply ${file} (${sql.length} chars). No connection made.`);
  process.exit(0);
}

const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });

try {
  await client.connect();
  console.log(`[apply] connected — running ${file} in a transaction…`);
  await client.query('begin');
  await client.query(sql);
  await client.query('commit');
  console.log('[apply] committed successfully.');
} catch (err) {
  try { await client.query('rollback'); } catch {}
  console.error('[apply] FAILED — rolled back:', err.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
