// tools/model-qa.mjs — THE MODEL QA ORCHESTRATOR (the Action Verification Model's QA ladder).
//
// Runs the LOCAL half of the Simulator QA Protocol (layers 1,2,3, state-5, impl-6 + teeth) against the
// Model (recipes + interpreter), and prints ONE completeness-aware scorecard + a 4-bucket defect ledger.
// The Model is a PIECE, so layers 7–10 (reality/outcome/adversarial/calibration) are NOT here — they stay
// with the Simulator's sim-qa.mjs. Only bucket 1 (spec_violation) blocks. See knowledge/MODEL_QA_LADDER.md.
//
// Run: node tools/model-qa.mjs            (no-DB rungs only)
//      node --env-file=.env.local tools/model-qa.mjs   (also the DB layer-1 coverage rung)

import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { RECIPES } from '../lib/sim/recipes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HAS_DB = !!process.env.SUPABASE_URL;

// rung: { file, name, layer, db } — teeth FIRST (it validates that the rest have teeth)
const RUNGS = [
  { file: 'model-mutants.mjs',      name: 'teeth (mutation)',        layer: 'meta', db: false },
  { file: 'model-ops-consistency.mjs', name: 'op registry↔interpreter', layer: '1', db: false },
  { file: 'sim-recipe-test.mjs',    name: 'II-A damage toy battles', layer: '2/3',  db: false },
  { file: 'sim-recipe-b-test.mjs',  name: 'II-B placement toy',      layer: '2/3',  db: false },
  { file: 'sim-recipe-c-test.mjs',  name: 'II-C state toy',          layer: '2/3',  db: false },
  { file: 'sim-recipe-d-test.mjs',  name: 'II-D passives toy',       layer: '2/3',  db: false },
  { file: 'model-boss.mjs',         name: 'boss sequence (Hellrazor)', layer: '2/3', db: false },
  { file: 'model-invariants.mjs',   name: 'invariants (property)',   layer: '5',    db: false },
  { file: 'model-sensitivity.mjs',  name: 'sensitivity (metamorphic)', layer: '6',  db: false },
  { file: 'model-snapshot.mjs',     name: 'regression snapshot',     layer: 'meta', db: false },
  { file: 'sim-rolls.mjs',          name: 'roll census (RNG)',       layer: 'meta', db: false },
  { file: 'sim-validate-recipes.mjs', name: 'card→recipe coverage',  layer: '1',    db: true },
  { file: 'model-fidelity.mjs',     name: 'DB→recipe fidelity',      layer: '1',    db: true },
  { file: 'model-golden.mjs',       name: 'hand-calc golden (turns 1–8)', layer: '4', db: true },
  { file: 'mob-coverage.mjs',       name: `wave coverage L1/2/3 (stage ${process.env.MODEL_QA_STAGE ?? 17})`, layer: '1', db: true },
];

function run(file) {
  const r = spawnSync(process.execPath, [path.join(__dirname, file)], { encoding: 'utf8', timeout: 180000, maxBuffer: 64 * 1024 * 1024,
    env: process.env });
  const line = (r.stdout || '').split(/\r?\n/).find(l => l.startsWith('QA_JSON '));
  const json = line ? (() => { try { return JSON.parse(line.slice(8)); } catch { return null; } })() : null;
  return { code: r.status, json, red: !!(r.error || r.status !== 0), stdout: r.stdout };
}

const ledger = { spec_violation: [], unimplemented: [], missing_data: [], not_scored: [] };
const scorecard = [];

for (const rg of RUNGS) {
  if (rg.db && !HAS_DB) { scorecard.push({ ...rg, status: 'SKIPPED (no DB)' }); ledger.not_scored.push(`${rg.name}: skipped — needs --env-file=.env.local`); continue; }
  const res = run(rg.file);
  const failN = res.json?.fail ?? (res.red ? 1 : 0);
  scorecard.push({ ...rg, status: res.red ? `RED (${failN})` : 'green', extra: res.json });
  if (res.red) {
    // model-mutants: suite holes are spec violations; coverage gaps are backlog (unimplemented-ish)
    if (res.json?.suiteHoles?.length) for (const h of res.json.suiteHoles) ledger.spec_violation.push(`teeth SUITE HOLE: ${h}`);
    else ledger.spec_violation.push(`${rg.name} (layer ${rg.layer}) reported ${failN} failure(s)` + (res.json?.failures?.length ? ` — e.g. ${res.json.failures[0]}` : ''));
  }
  if (res.json?.coverageGaps?.length) for (const g of res.json.coverageGaps) ledger.not_scored.push(`teeth coverage gap (no rung pins yet): ${g}`);
  // wave coverage: hardFails already block via exit code (spec); the unimplemented catalog is the mob-mechanic to-do
  if (res.json?.rung === 'mob-coverage' && res.json?.unimplemented) ledger.unimplemented.push(`${res.json.unimplemented} mob mechanic(s) unmodelled at Dragon stage ${res.json.stage} (see tools/mob-coverage.mjs)`);
  // card→recipe coverage: REVIEW = spec (a dropped/fabricated clause), Partial = deferred backlog
  if (res.json?.review) for (const r of res.json.review) ledger.spec_violation.push(`coverage REVIEW: ${r}`);
}

// unimplemented catalog = every deferred card clause across the authored recipes (the known-missing list)
let deferredCount = 0;
for (const r of Object.values(RECIPES)) for (const d of (r.deferred || [])) { deferredCount++; }
ledger.unimplemented.push(`${deferredCount} deferred card clauses across ${Object.keys(RECIPES).length} recipes (see PHASE_II_EFFECT_INVENTORY.md / each recipe's deferred[])`);
ledger.not_scored.push('protocol layers 7–10 (reality / outcome / adversarial / calibration) — Simulator-side, not the Model');

// ── report ───────────────────────────────────────────────────────────────────
console.log('\n╔════════════════════════════════════════════════════════════════╗');
console.log('║  MODEL QA — Action Verification Model, local half of the protocol ║');
console.log('╚════════════════════════════════════════════════════════════════╝\n');
for (const s of scorecard) {
  const mark = s.status.startsWith('green') ? '✓' : s.status.startsWith('SKIP') ? '·' : '✗';
  console.log(`  ${mark} [L${s.layer}] ${s.name.padEnd(28)} ${s.status}${s.extra?.killRate != null ? `  (kill rate ${s.extra.killRate}%)` : ''}`);
}
const blocks = ledger.spec_violation.length;
console.log(`\n  VERDICT: ${blocks ? '⛔ BLOCKED — ' + blocks + ' spec violation(s)' : '✅ SPEC-CONFORMANT (only spec_violations block; Model is incomplete-by-design)'}`);
for (const [bucket, items] of Object.entries(ledger)) {
  if (!items.length) continue;
  console.log(`\n  ${bucket}${bucket === 'spec_violation' ? ' — BLOCKS' : ''}:`);
  for (const it of items.slice(0, 8)) console.log(`    - ${it}`);
  if (items.length > 8) console.log(`    … +${items.length - 8} more`);
}
console.log('\nQA_JSON ' + JSON.stringify({ rung: 'model-qa', pass: scorecard.filter(s => s.status === 'green').length, fail: blocks,
  scorecard: scorecard.map(s => ({ name: s.name, status: s.status })), ledger }));
process.exit(blocks ? 1 : 0);
