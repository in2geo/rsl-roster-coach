// tools/qa-history.mjs — the QA MEASUREMENT BACKBONE.
//
// Appends one result record per QA-gate run to data/qa-history.json so every fix has a before/after record
// and we can see over time whether the simulator is improving. Used by tools/model-qa.mjs (the Model
// scorecard) and tools/sim-per-hero-bands.mjs (per-hero DEALT/TAKEN/HEALING vs reality bands).
//
// FILE FORMAT: a JSON ARRAY of records, newest LAST (append-only). Created if absent. Each record carries
// { ts, commit, rung, ... }. This is a pure side-effect log — it never influences a QA verdict, so it is
// golden/snapshot-safe.

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = path.join(REPO, 'data', 'qa-history.json');

/** Short git commit hash of the repo, or 'unknown' if unavailable. The "sim version" stamp for each record. */
export function gitCommit() {
  try { return execSync('git rev-parse --short HEAD', { cwd: REPO, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() || 'unknown'; }
  catch { return 'unknown'; }
}

/** ISO-8601 UTC timestamp for the record. */
export function nowIso() { return new Date().toISOString(); }

/**
 * Append one record to data/qa-history.json (a bare array, newest last). Creates the file if absent.
 * Stamps ts + commit if the caller didn't. Never throws on a missing/corrupt file — it starts a fresh array.
 * Returns the file path written.
 */
export function appendQaHistory(record) {
  let arr = [];
  try {
    if (fs.existsSync(FILE)) {
      const parsed = JSON.parse(fs.readFileSync(FILE, 'utf8'));
      if (Array.isArray(parsed)) arr = parsed;
      else if (parsed && Array.isArray(parsed.runs)) arr = parsed.runs;   // migrate any legacy {runs:[]} → bare array
    }
  } catch { /* corrupt/partial file — start fresh rather than lose this run */ }
  arr.push({ ts: record.ts || nowIso(), commit: record.commit || gitCommit(), ...record });
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(arr, null, 2) + '\n');
  return FILE;
}
