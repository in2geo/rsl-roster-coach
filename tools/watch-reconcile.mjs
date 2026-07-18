// tools/watch-reconcile.mjs — AUTO-reconcile. Watches the battle log and runs reconcile-runs
// (incremental) on each new capture, so every complete run lands graded in run_reconciliations
// without a manual step. This is the "grading, automatic" piece of the Deep Blue loop.
//
// Run alongside the RslBattleReader:  node --env-file=.env.local tools/watch-reconcile.mjs
// (Ctrl-C to stop.) It only ADDS reconciliations — reconcile-runs is incremental + idempotent.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname, '..');
const LOG = path.join(REPO, 'gestal-sync/RslBattleReader/output/battle-log.json');
const DEBOUNCE_MS = 4000; // captures land in bursts; let the reader's writes settle before reconciling

let timer = null, running = false, pending = false;
function runReconcile() {
  if (running) { pending = true; return; }         // coalesce triggers that arrive mid-run
  running = true;
  const p = spawn(process.execPath, ['--env-file=.env.local', 'tools/reconcile-runs.mjs'], { cwd: REPO, stdio: 'inherit' });
  p.on('exit', () => { running = false; if (pending) { pending = false; schedule(); } });
}
function schedule() { clearTimeout(timer); timer = setTimeout(runReconcile, DEBOUNCE_MS); }

if (!fs.existsSync(LOG)) { console.error(`[watch-reconcile] battle log not found: ${LOG}`); process.exit(1); }
console.log(`[watch-reconcile] watching ${LOG}\n  → runs reconcile-runs (incremental) on each new capture. Ctrl-C to stop.`);
// fs.watchFile (polling) is used deliberately — fs.watch is unreliable on OneDrive/synced dirs.
fs.watchFile(LOG, { interval: 2000 }, (cur, prev) => {
  if (cur.mtimeMs !== prev.mtimeMs) { console.log(`[watch-reconcile] capture at ${new Date().toISOString()} — reconciling…`); schedule(); }
});
schedule(); // initial pass: reconcile anything captured while the watcher was off
