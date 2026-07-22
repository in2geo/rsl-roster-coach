// tools/watch-reconcile.mjs — AUTO-reconcile. Watches the battle log and runs reconcile-runs
// (incremental) on each new capture, so every complete run lands graded in run_reconciliations
// without a manual step. This is the "grading, automatic" piece of the Deep Blue loop.
//
// Run alongside the RslBattleReader:  node --env-file=.env.local tools/watch-reconcile.mjs
// (Ctrl-C to stop.) It only ADDS reconciliations — reconcile-runs is incremental + idempotent.
//
// AND THEN IT PRINTS THE SCORE. After each reconcile it runs tools/battle-suite.mjs --brief, so the
// one falsifiable scalar (balanced accuracy) lands in front of a human on every capture, with its
// delta. This project's chronic failure mode is BUILT-BUT-UNWIRED artifacts — a metric you have to
// remember to run is a metric that stops getting run. `--no-suite` skips it.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname, '..');
const LOG = path.join(REPO, 'gestal-sync/RslBattleReader/output/battle-log.json');
const DEBOUNCE_MS = 4000; // captures land in bursts; let the reader's writes settle before reconciling

const RUN_SUITE = !process.argv.includes('--no-suite');
const RUN_GAPS  = !process.argv.includes('--no-gaps');
const GAP_MS    = 15 * 60 * 1000;   // the gap pass re-evaluates ~560 battles across 7 accounts (~3 min)

// The gap pass runs DETACHED from the reconcile chain: it is slow, and grading a capture must never
// wait on a backlog refresh. Throttled, and skipped while one is already in flight.
let gapsAt = 0, gapsRunning = false;
function maybeRunGaps() {
  if (!RUN_GAPS || gapsRunning || Date.now() - gapsAt < GAP_MS) return;
  gapsRunning = true; gapsAt = Date.now();
  const g = spawn(process.execPath,
    ['--env-file=.env.local', 'tools/whats-missing.mjs', '--all', '--out', 'knowledge/gap-backlog.md', '--quiet'],
    { cwd: REPO, stdio: 'inherit' });
  g.on('error', () => { gapsRunning = false; });
  g.on('exit',  () => { gapsRunning = false; });
}

let timer = null, running = false, pending = false;
function runReconcile() {
  if (running) { pending = true; return; }         // coalesce triggers that arrive mid-run
  running = true;
  const done = () => { running = false; maybeRunGaps(); if (pending) { pending = false; schedule(); } };
  const p = spawn(process.execPath, ['--env-file=.env.local', 'tools/reconcile-runs.mjs'], { cwd: REPO, stdio: 'inherit' });
  p.on('exit', (code) => {
    // Score AFTER grading, so the suite sees the run that just landed. A suite failure must never
    // take the watcher down — grading is the load-bearing job here, scoring is the readout.
    if (!RUN_SUITE || code !== 0) return done();
    const q = spawn(process.execPath, ['--env-file=.env.local', 'tools/battle-suite.mjs', '--brief'], { cwd: REPO, stdio: 'inherit' });
    q.on('error', () => done());
    q.on('exit', () => done());
  });
}
function schedule() { clearTimeout(timer); timer = setTimeout(runReconcile, DEBOUNCE_MS); }

if (!fs.existsSync(LOG)) { console.error(`[watch-reconcile] battle log not found: ${LOG}`); process.exit(1); }
console.log(`[watch-reconcile] watching ${LOG}\n  → runs reconcile-runs (incremental) on each new capture. Ctrl-C to stop.`);
// fs.watchFile (polling) is used deliberately — fs.watch is unreliable on OneDrive/synced dirs.
fs.watchFile(LOG, { interval: 2000 }, (cur, prev) => {
  if (cur.mtimeMs !== prev.mtimeMs) { console.log(`[watch-reconcile] capture at ${new Date().toISOString()} — reconciling…`); schedule(); }
});
schedule(); // initial pass: reconcile anything captured while the watcher was off
