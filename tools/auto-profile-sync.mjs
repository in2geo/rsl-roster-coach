// tools/auto-profile-sync.mjs — DEV-BOX DAEMON: Gestal → normalized output → Supabase profiles.
//
// The one background process that makes "switch account in-game → it shows up in my profile"
// true, without per-account terminal work. It:
//   1. spawns `node gestal-sync/sync.js --watch` (Gestal export → gestal-sync/output/*.json), and
//   2. watches gestal-sync/output/ and upserts each CHANGED account into Supabase as a 'gestal'
//      profile scoped to YOUR user (resolved from email via the service key — no expiring token).
//
// So the only per-account action left is the Gestal Refresh (a third-party app we can't automate).
// After that, the account appears in the signed-in profile switcher within a few seconds.
//
// Run:  node --env-file=.env.local tools/auto-profile-sync.mjs
//       IMPORT_EMAIL overrides the target user (default b52surfer@gmail.com).
//
// Idempotent: uploads an account only when its lastSnapshotAt actually changes, so sync.js
// rewriting every output file on each Gestal change does NOT re-upload untouched accounts.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import { createClient } from '@supabase/supabase-js';
import { upsertGestalProfile } from '../lib/roster-import.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO      = path.join(__dirname, '..');
const OUTPUT    = path.join(REPO, 'gestal-sync', 'output');
const EMAIL     = (process.env.IMPORT_EMAIL ?? 'b52surfer@gmail.com').toLowerCase();
const DEBOUNCE  = 1200;   // let sync.js finish rewriting all files before we read them

const BASE_URL    = (process.env.SUPABASE_URL ?? '').replace(/\/rest\/v1\/?$/, '');
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
if (!BASE_URL || !SERVICE_KEY) {
  console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_KEY. Run with --env-file=.env.local');
  process.exit(1);
}
const service = createClient(BASE_URL, SERVICE_KEY, { global: { fetch } });

const isSnapshot = f => f.endsWith('.json') && !/gear-corpus/.test(f);
const lastUploaded = new Map();   // accountId -> lastSnapshotAt already pushed

async function resolveUserId(email) {
  // Paginate the auth users (service role) and match by email.
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await service.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error('listUsers failed: ' + error.message);
    const me = (data.users ?? []).find(u => (u.email ?? '').toLowerCase() === email);
    if (me) return me.id;
    if ((data.users ?? []).length < 200) break;
  }
  return null;
}

async function uploadFile(userId, file) {
  let snap;
  try { snap = JSON.parse(fs.readFileSync(path.join(OUTPUT, file), 'utf8')); }
  catch { return; }   // mid-write; the next debounced pass will catch it
  if (!snap?.accountId || !Array.isArray(snap.champions)) return;

  // Skip if this exact snapshot was already pushed (sync.js touches every file each run).
  if (lastUploaded.get(snap.accountId) === snap.lastSnapshotAt) return;

  try {
    const r = await upsertGestalProfile(service, {
      userId,
      account: {
        accountId:    snap.accountId,
        displayName:  snap.displayName,
        raidPlayerId: snap.raidPlayerId,
        gameVersion:  snap.gameVersion,
        extractedAt:  snap.lastSnapshotAt,
      },
      roster: { champions: snap.champions, artifacts: snap.artifacts ?? [] },
    });
    lastUploaded.set(snap.accountId, snap.lastSnapshotAt);
    const tag = r.createdProfile ? 'NEW PROFILE' : 'updated';
    console.log(`  [${new Date().toLocaleTimeString()}] ${tag}: ${r.displayName} — ${r.champions} champions (${snap.accountId})`);
  } catch (e) {
    console.error(`  [upload failed] ${snap.displayName ?? file}: ${e.message}`);
  }
}

async function uploadAll(userId) {
  if (!fs.existsSync(OUTPUT)) return;
  for (const f of fs.readdirSync(OUTPUT).filter(isSnapshot)) await uploadFile(userId, f);
}

const userId = await resolveUserId(EMAIL);
if (!userId) {
  console.error(`No Supabase user for ${EMAIL}. Sign in once at http://localhost:3000 so the account exists, then re-run.`);
  process.exit(1);
}
console.log(`[auto-profile-sync] target user ${EMAIL} (${userId})`);
console.log(`[auto-profile-sync] watching ${OUTPUT}`);

// Keep the normalized exports fresh: sync.js --watch does an initial full sync, then re-syncs
// on every Gestal change. Inherit stdio so its logs interleave here.
const syncer = spawn(process.execPath, ['gestal-sync/sync.js', '--watch'], { cwd: REPO, stdio: 'inherit' });
syncer.on('exit', code => { console.error(`[sync.js --watch exited: ${code}] restarting in 3s`); setTimeout(() => process.exit(1), 3000); });

// Initial catch-up: push whatever is already on disk (creates any not-yet-imported accounts).
await uploadAll(userId);
console.log('[auto-profile-sync] initial pass done — now live.');

let timer = null;
fs.watch(OUTPUT, (_event, filename) => {
  if (!filename || !isSnapshot(filename)) return;
  clearTimeout(timer);
  timer = setTimeout(() => uploadAll(userId).catch(e => console.error('[pass error]', e.message)), DEBOUNCE);
});

process.on('SIGINT', () => { console.log('\n[auto-profile-sync] stopping'); syncer.kill(); process.exit(0); });
