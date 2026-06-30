/**
 * PC companion uploader (Option A). Reads the local Gestal export that sync.js
 * produces and POSTs it to /api/import as the signed-in user, so the deployed app
 * can show a synced roster.
 *
 * One-time setup for the user:
 *   1. Sign in on the website, open the (hidden) PC-import page, copy the upload token.
 *   2. Make the account active in Gestal and click Refresh (so the export is current).
 *   3. Run sync.js, then this uploader.
 *
 * Usage:
 *   node tools/import-upload.js --token <accessToken> [--url https://app/api/import] [--account <id>]
 *   (or set IMPORT_TOKEN and IMPORT_URL in the environment)
 */
import { readGestalRoster } from '../lib/gestal-context.js';

const args = process.argv.slice(2);
const flag = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };

const token   = flag('--token')   ?? process.env.IMPORT_TOKEN;
const url     = flag('--url')     ?? process.env.IMPORT_URL ?? 'http://localhost:3000/api/import';
const account = flag('--account') ?? null;

if (!token) {
  console.error('Missing upload token. Pass --token <accessToken> or set IMPORT_TOKEN.');
  console.error('Get it from the website PC-import page after signing in.');
  process.exit(1);
}

const roster = readGestalRoster(account);
if (!roster) {
  console.error('No Gestal export found. Run sync.js first (and Refresh Gestal so it\'s current).');
  process.exit(1);
}

// Staleness hint: lastSnapshotAt is the Gestal extraction time.
const extractedAt = roster.lastSnapshotAt ?? null;
const ageMin = extractedAt ? Math.round((Date.now() - new Date(extractedAt)) / 60000) : null;
if (ageMin != null && ageMin > 30)
  console.warn(`⚠ Gestal snapshot is ${ageMin} min old — Refresh Gestal + re-run sync.js for current gear.`);

const body = {
  account: {
    accountId:    roster.accountId,
    displayName:  roster.displayName,
    raidPlayerId: roster.raidPlayerId,
    gameVersion:  roster.gameVersion,
    extractedAt,
  },
  roster: { champions: roster.champions ?? [], artifacts: roster.artifacts ?? [] },
};

console.log(`Uploading ${body.roster.champions.length} champions / ${body.roster.artifacts.length} artifacts`);
console.log(`  account: ${roster.displayName} (${roster.accountId})  →  ${url}`);

const res = await fetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  body: JSON.stringify(body),
});

const out = await res.json().catch(() => ({}));
if (!res.ok) {
  console.error(`✗ Import failed (${res.status}): ${out.error ?? res.statusText}`);
  process.exit(1);
}
console.log(`✓ Imported: ${out.champions} champions, ${out.artifacts} artifacts for ${out.displayName}.`);
