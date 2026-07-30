// tools/model-turn-verify.mjs — MODEL QA rung: TURN-ORDER + NO-INERT-MECHANIC (outcome verification).
//
// Runs the turn-by-turn outcome verifier (tools/verify-core.mjs) across many seeds AND across EVERY BUILT
// CONTENT, and BLOCKS if in any content:
//   (a) the scheduler ever picks a unit that did NOT hold the highest turn meter (turn order broken), or
//   (b) a mechanic is systematically INERT — placed with a live target able to receive its effect, yet it
//       NEVER produced its downstream consequence (CC→skip, DoT→tick, heal, shield/reflect, taunt-steer) in
//       ANY battle. This is the opps-aware check: inert = (opportunities > 0 && consequences === 0), so a
//       mechanic that simply had NO opportunity (e.g. a revive with 0 deaths) is NOT falsely flagged.
//
// WHY IT RUNS ACROSS CONTENTS (2026-07-29): this rung used to default to the Dragon fixture only, so it never
// checked the Spider team — that is how Pelops's [Stun] placed-but-0-skips and other Spider-side inert
// mechanics went unseen. The guard existed; it just wasn't aimed at every content. Now it is.
//
// COVERAGE HONESTY: verify-core's contract taxonomy covers CC-skip / DoT-tick / heal / reactive
// (shield/reflect/ally-protection) / targeting (taunt/veil). It does NOT yet model 'revive' or the Sleeping
// Sage 'sponge' as contracts, nor card→recipe COVERAGE (that is sim-capability-matrix's report). Adding
// revive + sponge contracts to verify-core is the tracked next step — see MODEL_QA_LADDER.md.
//
// Run: node --env-file=.env.local tools/model-turn-verify.mjs
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
import { runOne, scoreOutcomes } from './verify-core.mjs';

const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const N = Number(process.env.TURN_VERIFY_SEEDS || 20);
// Every BUILT content gets checked. Override with a single fixture via TURN_VERIFY_FIXTURE (back-compat).
const FIXTURES = process.env.TURN_VERIFY_FIXTURE
  ? [process.env.TURN_VERIFY_FIXTURE]
  : ['spider13-donbambus-current.json', 'dragon16-donbambus-current.json'];

if (!process.env.SUPABASE_URL) { console.log('QA_JSON ' + JSON.stringify({ rung: 'turn-verify', pass: 0, fail: 0, skipped: 'no DB' })); process.exit(0); }
const BASE = process.env.SUPABASE_URL.replace(/\/rest\/v1\/?$/, '');
const H = { apikey: process.env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}` };
const _c = new Map();
const rest = async (p) => { if (_c.has(p)) return _c.get(p); const r = await (await fetch(`${BASE}/rest/v1/${p}`, { headers: H })).json(); _c.set(p, r); return r; };

// Verify ONE content across N seeds → { failures[], orderViolations, inert[], outcomeVerified[], placementOnly, skipped? }
async function verifyContent(fixtureFile) {
  const fixture = JSON.parse(fs.readFileSync(path.join(REPO, 'test/golden', fixtureFile), 'utf8'));
  const agg = {};                                   // mechanic → { contract, placed, opps, consequence }
  let orderViolations = 0; const orderExamples = [];
  for (let seed = 1; seed <= N; seed++) {
    const one = await runOne({ rest, fixture, repoRoot: REPO, seed });
    if (one.skip) return { skipped: one.skip };
    orderViolations += one.orderViolations.length;
    if (one.orderViolations.length && orderExamples.length < 3) orderExamples.push(one.orderViolations[0]);
    const { rows } = scoreOutcomes(one.fx, one.actedAt);
    for (const r of rows) {
      const a = (agg[r.mechanic] ??= { contract: r.contract, placed: 0, opps: 0, consequence: 0 });
      a.placed += r.placed; a.opps += (r.opps || 0); a.consequence += (r.consequence || 0);
    }
  }
  const inert = Object.entries(agg)
    .filter(([, a]) => a.contract !== 'placed' && a.opps > 0 && a.consequence === 0)
    .map(([m, a]) => `${m} INERT — ${a.opps} chance(s) across ${N} battles, 0 ${{ skip: 'skips', tick: 'damage events', heal: 'heal ticks', reactive: 'soak/reflect', targeting: 'steered picks' }[a.contract] || 'consequences'}`);
  const failures = [];
  if (orderViolations > 0) failures.push(`turn order broken: ${orderViolations} pick(s) were not the max-turn-meter unit (e.g. t${orderExamples[0]?.turn} picked ${orderExamples[0]?.picked} over ${orderExamples[0]?.maxUnit})`);
  failures.push(...inert);
  const outcomeVerified = Object.entries(agg).filter(([, a]) => a.contract !== 'placed' && a.consequence > 0).map(([m]) => m);
  const placementOnly = Object.entries(agg).filter(([, a]) => a.contract === 'placed').map(([m]) => m);
  return { failures, orderViolations, inert, outcomeVerified, placementOnly };
}

const perContent = [];
const allFailures = [];
for (const fx of FIXTURES) {
  const r = await verifyContent(fx);
  if (r.skipped) { console.log(`  · ${fx} — skipped: ${r.skipped}`); perContent.push({ fixture: fx, skipped: r.skipped }); continue; }
  console.log(`\n══ TURN-VERIFY — ${N} battles · ${fx} ══`);
  console.log(`  turn order:        ${r.orderViolations === 0 ? '✅ 0 violations' : '❌ ' + r.orderViolations + ' violations'}`);
  console.log(`  inert mechanics:   ${r.inert.length === 0 ? '✅ none' : '❌ ' + r.inert.length}`);
  for (const s of r.inert) console.log(`     ❌ ${s}`);
  console.log(`  outcome-verified:  ${r.outcomeVerified.join(', ') || '(none)'}`);
  console.log(`  placement-only:    ${r.placementOnly.length} mechanic(s) not yet outcome-verified (coverage gap, non-blocking)`);
  perContent.push({ fixture: fx, orderViolations: r.orderViolations, inert: r.inert, outcomeVerified: r.outcomeVerified, placementOnly: r.placementOnly.length });
  allFailures.push(...r.failures.map((f) => `[${fx}] ${f}`));
}

console.log(`\n${'═'.repeat(60)}`);
console.log(`  ${allFailures.length === 0 ? '✅ all built contents pass' : '❌ ' + allFailures.length + ' failure(s) across contents'}`);
for (const f of allFailures) console.log(`     ❌ ${f}`);

console.log('\nQA_JSON ' + JSON.stringify({ rung: 'turn-verify', pass: allFailures.length === 0 ? 1 : 0, fail: allFailures.length, failures: allFailures, seeds: N, contents: perContent }));
process.exit(allFailures.length ? 1 : 0);
