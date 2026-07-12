#!/usr/bin/env node
// ── tools/dev-import.js — DEV BOX ONLY ───────────────────────────────────────
// One command to get every Gestal game account into the signed-in app user:
//   1. runs gestal-sync/sync.js (normalizes every account under ~/AppData/Local/Gestal)
//   2. uploads EACH synced account to the app user, creating/refreshing a 'gestal'
//      profile per account (upsert on user_id+account_id — re-runs refresh in place).
//
// Mirrors /api/import server-side using the SERVICE key, so no upload token is
// needed. Because it writes to any user by email with the service role, it is a
// LOCAL DEV convenience only — never expose or deploy it. The real client path
// stays tools/import-upload.js (token-scoped).
//
// Usage:
//   node tools/dev-import.js --email you@example.com   [--no-sync]
//   (email falls back to DEV_IMPORT_EMAIL, or the only auth user if there is one)

import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO       = path.join(__dirname, '..');
const OUTPUT_DIR = path.join(REPO, 'gestal-sync', 'output');
const SYNC_JS    = path.join(REPO, 'gestal-sync', 'sync.js');

const env = {};
for (const l of fs.readFileSync(path.join(REPO, '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const BASE = (env.SUPABASE_URL ?? '').replace(/\/rest\/v1\/?$/, '');
const KEY  = env.SUPABASE_SERVICE_KEY;
if (!BASE || !KEY) { console.error('SUPABASE_URL / SUPABASE_SERVICE_KEY missing in .env.local'); process.exit(1); }
const service = createClient(BASE, KEY, { global: { fetch } });

const args = process.argv.slice(2);
const flag = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
const has  = (k) => args.includes(k);

// 1. Sync every Gestal account (unless skipped).
if (!has('--no-sync')) {
  console.log('→ syncing Gestal accounts…');
  const r = spawnSync('node', [SYNC_JS], { stdio: 'inherit' });
  if (r.status !== 0) { console.error('sync.js failed — aborting.'); process.exit(1); }
}

// 2. Resolve the target app user (by email, or the only user).
async function resolveUser() {
  const email = (flag('--email') ?? env.DEV_IMPORT_EMAIL ?? '').toLowerCase();
  const r = await fetch(`${BASE}/auth/v1/admin/users?per_page=1000`, {
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
  });
  const users = (await r.json()).users ?? [];
  if (email) {
    const u = users.find((x) => (x.email || '').toLowerCase() === email);
    if (!u) { console.error(`No auth user for ${email}. Known: ${users.map((x) => x.email).join(', ')}`); process.exit(1); }
    return u;
  }
  if (users.length === 1) return users[0];
  console.error(`Multiple users — pass --email. Known: ${users.map((x) => x.email).join(', ')}`);
  process.exit(1);
}
const user = await resolveUser();
console.log(`→ importing for ${user.email} (${user.id})`);

// 3. Upload every synced account file → one 'gestal' profile each.
const files = fs.existsSync(OUTPUT_DIR) ? fs.readdirSync(OUTPUT_DIR).filter((f) => f.endsWith('.json')) : [];
let ok = 0;
for (const f of files) {
  let roster;
  try { roster = JSON.parse(fs.readFileSync(path.join(OUTPUT_DIR, f), 'utf8')); } catch { continue; }
  if (!roster?.accountId || !Array.isArray(roster.champions) || !roster.champions.length) {
    console.log(`  · skip ${f} (no champions)`);
    continue;
  }
  const account = {
    accountId: roster.accountId, displayName: roster.displayName,
    raidPlayerId: roster.raidPlayerId, gameVersion: roster.gameVersion,
    extractedAt: roster.lastSnapshotAt ?? null,
  };

  // find-or-create the gestal profile for this (user, account)
  const { data: existing } = await service
    .from('rsl_accounts').select('id, profile_id')
    .eq('user_id', user.id).eq('account_id', account.accountId).maybeSingle();
  let profileId = existing?.profile_id ?? null;
  if (!profileId) {
    const { count } = await service
      .from('profiles').select('id', { count: 'exact', head: true })
      .eq('user_id', user.id).eq('game_id', 'raid_shadow_legends');
    const { data: prof, error } = await service
      .from('profiles')
      .insert({
        user_id: user.id, game_id: 'raid_shadow_legends',
        name: account.displayName ?? account.accountId,
        population_method: 'gestal', is_default: (count ?? 0) === 0,
      })
      .select('id').single();
    if (error) { console.error(`  ✗ ${account.displayName}: profile create failed — ${error.message}`); continue; }
    profileId = prof.id;
  }

  const row = {
    user_id: user.id, account_id: account.accountId, profile_id: profileId,
    display_name: account.displayName ?? null, raid_player_id: account.raidPlayerId ?? null,
    game_version: account.gameVersion ?? null,
    last_synced_at: account.extractedAt ?? new Date().toISOString(),
    extracted_at: account.extractedAt ?? null, imported_at: new Date().toISOString(),
    roster_json: { champions: roster.champions, artifacts: roster.artifacts ?? [] },
  };
  const { error } = await service
    .from('rsl_accounts').upsert(row, { onConflict: 'user_id,account_id' }).select('id').single();
  if (error) { console.error(`  ✗ ${account.displayName}: import failed — ${error.message}`); continue; }

  const ageMin = account.extractedAt ? Math.round((Date.now() - new Date(account.extractedAt)) / 60000) : null;
  console.log(`  ✓ ${account.displayName} — ${roster.champions.length} champions${ageMin != null ? ` (snapshot ${ageMin} min old${ageMin > 30 ? ' — Refresh in Gestal for current gear' : ''})` : ''}`);
  ok++;
}
console.log(`\n[done] imported ${ok}/${files.length} account(s) for ${user.email}. Reload the app and pick a profile in the switcher.`);
