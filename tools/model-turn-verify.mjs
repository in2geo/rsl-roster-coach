// tools/model-turn-verify.mjs — MODEL QA rung: TURN-ORDER + NO-INERT-MECHANIC (outcome verification).
//
// Runs the turn-by-turn outcome verifier (tools/verify-core.mjs) across many seeds and BLOCKS if:
//   (a) the scheduler ever picks a unit that did NOT hold the highest turn meter (turn order broken), or
//   (b) a mechanic is systematically INERT — placed with a live target able to receive its effect, yet it
//       NEVER produced its downstream consequence (CC→skip, DoT→tick) in ANY battle.
//
// This is the guard that would have caught the [Petrification] bug (placed, 0 skips) on day one, and it
// currently catches [Poison] (placed, 0 ticks) and [Sleep] (placed, 0 skips). Cross-seed aggregation avoids
// single-battle flukes: a mechanic passes if it works in ANY battle where it had the opportunity.
//
// Run: node --env-file=.env.local tools/model-turn-verify.mjs
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
import { runOne, scoreOutcomes } from './verify-core.mjs';

const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const N = Number(process.env.TURN_VERIFY_SEEDS || 20);
const FIXTURE = process.env.TURN_VERIFY_FIXTURE || 'dragon16-donbambus-current.json';
const fixture = JSON.parse(fs.readFileSync(path.join(REPO, 'test/golden', FIXTURE), 'utf8'));

if (!process.env.SUPABASE_URL) { console.log('QA_JSON ' + JSON.stringify({ rung: 'turn-verify', pass: 0, fail: 0, skipped: 'no DB' })); process.exit(0); }
const BASE = process.env.SUPABASE_URL.replace(/\/rest\/v1\/?$/, '');
const H = { apikey: process.env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}` };
const _c = new Map();
const rest = async (p) => { if (_c.has(p)) return _c.get(p); const r = await (await fetch(`${BASE}/rest/v1/${p}`, { headers: H })).json(); _c.set(p, r); return r; };

// aggregate across seeds: per mechanic, total opportunities and total consequences; any-battle-works wins.
const agg = {};            // mechanic → { contract, placed, opps, consequence }
let orderViolations = 0; const orderExamples = [];
for (let seed = 1; seed <= N; seed++) {
  const one = await runOne({ rest, fixture, repoRoot: REPO, seed });
  if (one.skip) { console.log('QA_JSON ' + JSON.stringify({ rung: 'turn-verify', pass: 0, fail: 0, skipped: one.skip })); process.exit(0); }
  orderViolations += one.orderViolations.length;
  if (one.orderViolations.length && orderExamples.length < 3) orderExamples.push(one.orderViolations[0]);
  const { rows } = scoreOutcomes(one.fx, one.actedAt);
  for (const r of rows) {
    const a = (agg[r.mechanic] ??= { contract: r.contract, placed: 0, opps: 0, consequence: 0 });
    a.placed += r.placed; a.opps += (r.opps || 0); a.consequence += (r.consequence || 0);
  }
}

// INERT (blocking): a skip/tick mechanic that had a live target across the run but never once did its job.
const inert = Object.entries(agg)
  .filter(([, a]) => a.contract !== 'placed' && a.opps > 0 && a.consequence === 0)
  .map(([m, a]) => `${m} INERT — ${a.opps} chance(s) across ${N} battles, 0 ${{ skip: 'skips', tick: 'damage events', heal: 'heal ticks', reactive: 'soak/reflect' }[a.contract] || 'consequences'}`);

const failures = [];
if (orderViolations > 0) failures.push(`turn order broken: ${orderViolations} pick(s) were not the max-turn-meter unit (e.g. t${orderExamples[0]?.turn} picked ${orderExamples[0]?.picked} over ${orderExamples[0]?.maxUnit})`);
failures.push(...inert);

// report card (human)
const outcomeVerified = Object.entries(agg).filter(([, a]) => a.contract !== 'placed' && a.consequence > 0).map(([m]) => m);
const placementOnly = Object.entries(agg).filter(([, a]) => a.contract === 'placed').map(([m]) => m);
console.log(`\n══ TURN-VERIFY rung — ${N} battles, ${FIXTURE} ══`);
console.log(`  turn order:        ${orderViolations === 0 ? '✅ 0 violations' : '❌ ' + orderViolations + ' violations'}`);
console.log(`  inert mechanics:   ${inert.length === 0 ? '✅ none' : '❌ ' + inert.length}`);
for (const s of inert) console.log(`     ❌ ${s}`);
console.log(`  outcome-verified:  ${outcomeVerified.join(', ') || '(none)'}`);
console.log(`  placement-only:    ${placementOnly.length} mechanic(s) not yet outcome-verified (coverage gap, non-blocking)`);

console.log('\nQA_JSON ' + JSON.stringify({ rung: 'turn-verify', pass: failures.length === 0 ? 1 : 0, fail: failures.length, failures, turnOrderViolations: orderViolations, inert, seeds: N, outcomeVerified, placementOnly: placementOnly.length }));
process.exit(failures.length ? 1 : 0);
