// ── api/sync.js ──────────────────────────────────────────────────────────────
// DEV-ONLY endpoint that runs `node gestal-sync/sync.js` — the step that
// normalizes Gestal's local account exports into gestal-sync/output/*.json (the
// files /api/gestal-context reads). Lets the running app trigger a re-sync from
// the browser instead of a terminal, so a testing session can Refresh in Gestal
// then re-pull without leaving the app.
//
// POST /api/sync → { ok, accounts:[{accountId,displayName,champions,artifacts}],
//                    skipped:[...], warnings:[...], durationMs }
//
// LOCALHOST ONLY. This shells out to node against the local filesystem — it makes
// no sense on a serverless host (no Gestal folder there) and must never be
// remotely triggerable, so it hard-rejects any non-loopback caller.

import { execFile } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const REPO_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SYNC_SCRIPT = 'gestal-sync/sync.js';

function json(res, status, body) { res.status(status).json(body); }

// Loopback check: Node sets remoteAddress to 127.0.0.1 / ::1 / ::ffff:127.0.0.1
// for local connections. Anything else is a remote caller and is refused.
function isLoopback(req) {
  const a = (req.socket?.remoteAddress ?? '').replace(/^::ffff:/, '');
  return a === '127.0.0.1' || a === '::1' || a === 'localhost';
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });
  if (!isLoopback(req)) return json(res, 403, { error: 'Re-sync is available on the local dev box only.' });

  const startedAt = Date.now();
  const run = () => new Promise((resolve) => {
    execFile(
      process.execPath, [SYNC_SCRIPT],
      { cwd: REPO_ROOT, timeout: 120_000, maxBuffer: 16 * 1024 * 1024, windowsHide: true },
      (err, stdout, stderr) => resolve({ err, stdout: stdout ?? '', stderr: stderr ?? '' }),
    );
  });

  const { err, stdout, stderr } = await run();
  const out = `${stdout}\n${stderr}`;

  // Parse the human log sync.js prints. "[ok] <id> (<name>) — N champions, M artifacts → file"
  const accounts = [];
  for (const m of out.matchAll(/\[ok\]\s+(\S+)\s+\(([^)]*)\)\s+—\s+(\d+)\s+champions?,\s+(\d+)\s+artifacts?/g)) {
    accounts.push({ accountId: m[1], displayName: m[2], champions: +m[3], artifacts: +m[4] });
  }
  const skipped  = [...out.matchAll(/\[skip\]\s+(\S+)\s+—\s+(.*)/g)].map(m => ({ accountId: m[1], reason: m[2].trim() }));
  const warnings = [...out.matchAll(/⚠\s+(STALE GESTAL DATA[^\n]*)/g)].map(m => m[1].trim());

  if (err && !accounts.length) {
    return json(res, 500, {
      error: 'sync.js failed',
      detail: (err.message || '').slice(0, 500),
      output: out.slice(-2000),
    });
  }

  return json(res, 200, {
    ok: true,
    accounts,
    skipped,
    warnings,
    durationMs: Date.now() - startedAt,
  });
}
