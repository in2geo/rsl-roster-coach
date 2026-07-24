// tools/sim-qa.mjs — THE QA PROTOCOL ORCHESTRATOR.
//
// Runs the rungs and prints ONE completeness-aware SCORECARD plus a classified DEFECT LEDGER. The
// point (Mike, 2026-07-22): the QA tool tests the simulator AT ITS CURRENT COMPLETENESS and does not
// require it to be finished. A rung is a test HARNESS, not a passing result — the sim failing a rung
// is a FINDING, not a reason to stop. Findings sort into four buckets and ONLY spec violations block:
//
//   1. spec_violation  — the sim disagrees with its OWN design (gate-1 self-test fails). FIX before
//                        trusting any reality comparison. This is the ONLY bucket that fails the gate.
//   2. unimplemented   — a mechanic we know is missing/stubbed. Backlog. Does NOT block.
//   3. missing_data    — inputs absent/estimated (coeffs, mob lists, waves). Sourcing backlog. Does NOT block.
//   4. reality_gap     — a scoring LEVEL the sim isn't complete enough to attempt (clear-rate, run time).
//                        Labelled "not scored", never counted as a failure.
//
// The simulator is NOT touched here. This tool only observes it.
// Run: node --env-file=.env.local tools/sim-qa.mjs

import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function runRung(script) {
  const r = spawnSync(process.execPath, [path.join(__dirname, script)], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const line = (r.stdout || '').split(/\r?\n/).find(l => l.startsWith('QA_JSON '));
  return { json: line ? JSON.parse(line.slice(8)) : null, code: r.status, stderr: r.stderr };
}

// ── THE SIM'S MECHANIC MANIFEST — hand-declared, honest. This is the completeness view: what the
// simulator claims to model and at what fidelity. `unimplemented`/`stub` entries become bucket-2
// defects automatically. Keep this HONEST — it is the tool's statement of what the sim is.
const MANIFEST = [
  ['turn order + exact turn-meter advance', 'implemented'],
  ['affinity strong/weak/neutral hits', 'implemented'],
  ['ACC-vs-RES debuff land chance', 'implemented'],
  ['cooldowns + cross-phase carry-over', 'implemented'],
  ['shields (absorb direct, ignore DoT)', 'implemented'],
  ['CC skips the turn', 'implemented'],
  ['DoT ticks (Poison / HP-Burn ally splash)', 'implemented'],
  ['revive locked until a death', 'implemented'],
  ['heal taxonomy (hoard vs fire-at-full)', 'implemented'],
  ['target lowest HP%, avoid Unkillable', 'implemented'],
  ['purple bar = 20% MaxHP, drained by team dmg', 'implemented'],
  ['wave-mob combat (generic, opt-in pilot)', 'implemented'],
  ['damage: skill coeff x ATK', 'partial'],            // only 38% of skills carry a coeff
  ['DEF diminishing-returns curve', 'stub'],           // DEF_K=1500 nominal, uncalibrated
  ['multiplier_type (ATK/HP/DEF-scaling skills)', 'implemented'],  // parseCoeff reads the stat, calc scales off it; DATA must carry "N HP"/"N DEF" (bare = ATK)
  ['passive triggers (start-of-turn / start-of-battle)', 'partial'],  // firePassives places passive buffs/debuffs; on-hit/on-death/on-crit/each-round triggers still unmodelled (flagged)
  ['Decrease DEF consumed in the damage calc', 'implemented'], // effectiveDef() lowers DEF on ATK-vs-DEF hits only (DoT untouched); reads the debuff's own magnitude, no constant
  ['[Perfect Veil] = untargetable', 'implemented'],  // single-target selection hard-skips a veiled ally/enemy; AoE hits through (was: video Ezio took ~3.5k all fight; sim one-shot him)
  ['%MaxHP damage skills + stage 21+/Hard 10% cap', 'partial'],  // pure %maxHP nuke (DEF-independent) + the 10%/hit cap done; compound "%maxHP or ATK" left to ATK term + flagged
  ['execute skills (fire only in kill range)', 'unimplemented'],
  ['enemy-side buffs / heals / revives on waves', 'unimplemented'],
];

// ── RUNG-8 SCORING LEVELS (the doc's ordered scoring). `supported` = the sim is complete enough to
// attempt it; `unsupported` levels are NOT scored against reality (bucket 4), never marked "failed".
const LEVELS = [
  ['mechanic classification (strategy / missing mechanic)', 'partial'],
  ['failure location (which wave / boss)', 'supported'],
  ['outcome classification (win / loss)', 'supported'],
  ['directional recommendation helped', 'unsupported'],   // no recommendation layer wired
  ['clear-rate band', 'unsupported'],                     // needs damage complete
  ['run time', 'unsupported'],                            // needs damage + animation + AI delays
];

// ── run the rungs ──────────────────────────────────────────────────────────────
console.log('\n╔══════════════════════════════════════════════════════════════════════╗');
console.log('║  SIM QA — completeness-aware scorecard  (tests the sim AS-IS)          ║');
console.log('╚══════════════════════════════════════════════════════════════════════╝');

const spec = runRung('sim-selftest.mjs');        // rung 2 — no DB
const inv = runRung('sim-invariants.mjs');       // rung 5 — no DB, property-based
const sens = runRung('sim-sensitivity.mjs');     // rung 6 — no DB, metamorphic
const effects = runRung('sim-effects.mjs');      // fired-vs-consumed — no DB, catches represented-but-not-consumed
const golden = runRung('sim-golden.mjs');        // rung 4 — no DB, golden-battle fixtures
const trace = runRung('sim-trace.mjs');          // rung 3b — DB, reality oracle: sim trace vs the recording
const actions = runRung('sim-actions.mjs');      // action verification — DB, mechanics-derived per-turn ACTION check
const snapshot = runRung('sim-snapshot.mjs');    // rung 10 — no DB, regression snapshot (runs on pristine engine, before mutation)
const data = runRung('sim-validate-data.mjs');   // rung 1 — needs DB (inherits env from --env-file)
const mut = runRung('sim-mutants.mjs');          // rung 9 — no DB, mutation testing: does the suite have teeth?

// ── classify every finding into the four buckets ────────────────────────────────
const ledger = { spec_violation: [], unimplemented: [], missing_data: [], reality_gap: [] };

if (spec.json) for (const f of spec.json.failures) ledger.spec_violation.push(`spec: ${f}`);
else ledger.spec_violation.push('rung 2 (spec self-test) did not report — cannot confirm conformance');
if (inv.json) for (const f of inv.json.failures) ledger.spec_violation.push(`invariant: ${f}`);
else ledger.spec_violation.push('rung 5 (invariants) did not report — cannot confirm invariants hold');
if (sens.json) for (const f of sens.json.failures) ledger.spec_violation.push(`sensitivity: ${f}`);
else ledger.spec_violation.push('rung 6 (sensitivity) did not report — cannot confirm directions');
// FIRED-vs-CONSUMED: a fired effect that never lands (no documented reason) is the sim disagreeing
// with its own design — the "represented but not consumed" species — so it BLOCKS (bucket 1). A
// DEMONSTRATED BLANK (a passive that never fires because there is no trigger system) is a known-
// missing mechanic → bucket 2, does not block.
if (effects.json) { for (const f of effects.json.failures) ledger.spec_violation.push(`effect not consumed: ${f}`);
                    for (const b of effects.json.blanks) ledger.unimplemented.push(`${b}  [demonstrated by sim-effects, not hand-declared]`); }
else ledger.spec_violation.push('fired-vs-consumed rung did not report — cannot confirm effects land');
if (golden.json) { for (const f of golden.json.failures) ledger.spec_violation.push(`golden fixture malformed: ${f}`);
                   for (const p of golden.json.pendingInputs) ledger.missing_data.push(`golden ${p}`);
                   // A golden OUTCOME mismatch is a reality gap (bucket 4), NOT a spec failure: the sim is
                   // known-incomplete, so it labels "sim can't yet reproduce this real fight" — never blocks.
                   for (const r of golden.json.runs ?? []) if (r.outcomeMatch === false)
                     ledger.reality_gap.push(`golden ${r.id}: sim ${r.predOutcome} vs real ${r.actualOutcome} (survivors ${r.predSurvivors}/${r.actualSurvivors}; 0-dmg: ${(r.zeroDmg||[]).join(', ') || 'none'})`); }

for (const [m, st] of MANIFEST) if (st === 'unimplemented' || st === 'stub') ledger.unimplemented.push(`${m}  [${st}]`);

// SNAPSHOT (rung 10): a drift means the engine no longer matches its LAST-BLESSED behaviour. That is an
// unintended regression until a human re-blesses (SNAPSHOT_BLESS=1) — the one blocker that is NOT a
// reality question. It BLOCKS because an unacknowledged behaviour change is exactly the "did we get
// worse and not notice" failure that reality-comparison can't catch in the known-wrong region. A freshly
// (re)created baseline (`blessed`) is informational, never a block.
if (snapshot.json) {
  if (!snapshot.json.blessed) for (const d of (snapshot.json.drifts || [])) ledger.spec_violation.push(`regression vs baseline: ${d}  — re-bless if intended (SNAPSHOT_BLESS=1)`);
} else ledger.spec_violation.push('rung 10 (snapshot) did not report — cannot confirm the sim matches its baseline');

if (data.json) {
  for (const w of data.json.warns) ledger.missing_data.push(w);
  for (const c of data.json.coeffBacklog) ledger.missing_data.push(`0-damage champ: ${c.name} — ${c.battles} battles, skills ${c.slots.join('/')}`);
} else {
  ledger.missing_data.push('rung 1 (data validator) did not report — run with --env-file=.env.local for DB access');
}

for (const [lv, st] of LEVELS) if (st === 'unsupported') ledger.reality_gap.push(`level NOT scored: ${lv}`);

// TRACE ORACLE (rung 3b): where the sim's turn-by-turn diverges from the recorded fight. A REALITY GAP
// (bucket 4), never a blocker — the sim is known-incomplete. The value is the LOCALISED first-divergence
// turn + the unmodelled systems it points at.
if (trace.json && Array.isArray(trace.json.runs)) {
  for (const r of trace.json.runs) {
    if (r.skipped) { ledger.reality_gap.push(`trace ${r.id}: skipped — ${r.skipped}`); continue; }
    if (r.firstDivergence) ledger.reality_gap.push(`trace ${r.id}: sim & reality first diverge at "${r.firstDivergence}" (sim ${r.simOutcome}/${r.simSurvivors} surv vs real ${r.realOutcome}/${r.realSurvivors})`);
    else ledger.reality_gap.push(`trace ${r.id}: sim reproduces the recorded fight at the checked checkpoints`);
    if (r.perHeroHeadline) ledger.reality_gap.push(`trace ${r.id} per-hero: ${r.perHeroHeadline}`);
  }
} else if (trace.json?.skipped) ledger.reality_gap.push(`trace oracle skipped — ${trace.json.skipped} (run with --env-file=.env.local)`);

// ACTION VERIFICATION (sim vs the encoded game-mechanic action rules). NON-BLOCKING: it checks
// sim-vs-RULE, not sim-vs-reality — a divergence means the sim doesn't follow the encoded rule, which
// must be CONFIRMED against a recording before we know if the sim or the rule is wrong (see
// knowledge/action-verification-review-request.md). So it's a flagged reality gap, not a spec block.
if (actions.json && !actions.json.skipped) {
  if (actions.json.diverged > 0) { const f = actions.json.firstDivergence; ledger.reality_gap.push(`action divergence (t${f.turn} ${f.actor}): rule expects ${f.expected}, sim used ${f.actual} — confirm vs a recording (sim-vs-rule, not reality)`); }
} else if (actions.json?.skipped) ledger.reality_gap.push(`action verification skipped — ${actions.json.skipped}`);

// MUTATION (rung 9): a mutant the suite SHOULD catch but didn't = a toothless guard, so the block gate
// can no longer be trusted for that behaviour → bucket 1. A stale mutant (source drifted, no longer
// applies) is the same failure — a teeth-check that silently stopped running. A surviving PROBE is a
// coverage gap: a real behaviour no rung pins yet → backlog (bucket 2), does not block.
if (mut.json) {
  for (const h of mut.json.unexpectedSurvivors) ledger.spec_violation.push(`mutation: suite blind to a bug it should catch — ${h}`);
  for (const s of mut.json.stale) ledger.spec_violation.push(`mutation: stale mutant no longer applies (source drifted) — ${s}`);
  for (const g of mut.json.coverageGaps) ledger.unimplemented.push(`mutation coverage gap: no rung catches "${g}"  [demonstrated by sim-mutants]`);
  if (mut.json.aborted) ledger.spec_violation.push(`mutation: ABORTED — baseline not green (${(mut.json.baselineRed || []).join(', ')}); the suite itself is red`);
} else ledger.spec_violation.push('rung 9 (mutation) did not report — cannot confirm the suite has teeth');

// ── SCORECARD ───────────────────────────────────────────────────────────────────
const mark = { implemented: '✅', partial: '◐ ', stub: '◔ ', unimplemented: '○ ' };
const specOk = spec.json && spec.json.fail === 0;

console.log('\n▶ SPEC CONFORMANCE (rung 2 — does the sim obey its own design?)');
console.log(spec.json ? `    ${specOk ? '✅ PASS' : '✗ FAIL'} — ${spec.json.pass} passed, ${spec.json.fail} failed`
                      : '    ⚠ no report');

console.log('\n▶ BEHAVIOURAL INVARIANTS (rung 5 — property-based over random battles)');
console.log(inv.json ? `    ${inv.json.fail === 0 ? '✅ PASS' : '✗ FAIL'} — ${inv.json.pass} checks passed, ${inv.json.fail} failed`
                     : '    ⚠ no report');

console.log('\n▶ SENSITIVITY (rung 6 — one-input perturbations move the right way)');
console.log(sens.json ? `    ${sens.json.fail === 0 ? '✅ PASS' : '✗ FAIL'} — ${sens.json.pass} directions held, ${sens.json.fail} violated`
                      : '    ⚠ no report');

console.log('\n▶ FIRED vs CONSUMED (does every effect that fires actually land in world state?)');
console.log(effects.json ? `    ${effects.json.fail === 0 ? '✅ PASS' : '✗ FAIL'} — ${effects.json.pass} checks passed, ${effects.json.fail} unexplained non-consumption(s) · ${effects.json.blanks.length} demonstrated blank(s)`
                         : '    ⚠ no report');

console.log('\n▶ GOLDEN BATTLES (rung 4 — real recorded fights, fixture-validated + sim replayed on exact builds)');
console.log(golden.json ? `    ${golden.json.fail === 0 ? '✅' : '✗'} ${golden.json.fixtures} fixture(s), ${golden.json.pass} consistency checks passed, ${golden.json.fail} failed · ${golden.json.pendingInputs.length} pending exact builds`
                        : '    ⚠ no report');
if (golden.json) for (const r of golden.json.runs ?? []) {
  if (r.skipped) { console.log(`    · exact-stat run ${r.id}: skipped — ${r.skipped}`); continue; }
  console.log(`    · exact-stat run ${r.id}: sim ${r.predOutcome} / real ${r.actualOutcome} ${r.outcomeMatch ? '✅ reproduced' : '✗ mismatch → bucket 4'} (survivors ${r.predSurvivors}/${r.actualSurvivors})`);
}

console.log('\n▶ TRACE ORACLE (rung 3b — does the sim reproduce the RECORDED fight, turn by turn?)');
if (trace.json && Array.isArray(trace.json.runs) && trace.json.runs.length) {
  for (const r of trace.json.runs) {
    if (r.skipped) { console.log(`    · ${r.id}: skipped — ${r.skipped}`); continue; }
    console.log(`    ${r.firstDivergence ? '✗' : '✅'} ${r.id}: ${r.firstDivergence ? `first diverges at "${r.firstDivergence}"  (sim ${r.simOutcome} ${r.simSurvivors} surv / real ${r.realOutcome} ${r.realSurvivors} surv)` : 'reproduces the fight at checked checkpoints'}`);
    if (r.perHeroHeadline) console.log(`        per-hero: ${r.perHeroHeadline}`);
  }
} else if (trace.json?.skipped) console.log(`    ⏳ skipped — ${trace.json.skipped} (needs --env-file=.env.local)`);
else console.log('    ⚠ no report');

console.log('\n▶ ACTION VERIFICATION (sim vs the encoded game-mechanic action rules — predictor, not reality)');
if (actions.json && !actions.json.skipped) console.log(`    ${actions.json.diverged === 0 ? '✅' : '✗'} ${actions.json.matched}/${actions.json.actions} actions follow the rules${actions.json.diverged ? `  ·  first: t${actions.json.firstDivergence.turn} ${actions.json.firstDivergence.actor} — rule ${actions.json.firstDivergence.expected} vs sim ${actions.json.firstDivergence.actual} (confirm vs recording)` : ''}`);
else if (actions.json?.skipped) console.log(`    ⏳ skipped — ${actions.json.skipped}`);
else console.log('    ⚠ no report');

console.log('\n▶ REGRESSION SNAPSHOT (rung 10 — does the engine still do what it did at the last blessing?)');
if (snapshot.json && snapshot.json.blessed) console.log(`    · baseline (re)created — ${snapshot.json.scenarios} scenario(s) frozen`);
else if (snapshot.json) console.log(`    ${snapshot.json.fail === 0 ? '✅ MATCHES' : '✗ DRIFT'} — ${snapshot.json.scenarios - snapshot.json.driftScenarios.length}/${snapshot.json.scenarios} scenarios match baseline${snapshot.json.fail ? `  ·  moved: ${snapshot.json.driftScenarios.join(', ')}  (re-bless if intended: SNAPSHOT_BLESS=1)` : ''}`);
else console.log('    ⚠ no report');

console.log('\n▶ INPUT DATA (rung 1 — gate 0)');
if (data.json) {
  console.log(`    structural integrity: ${data.json.gate0}`);
  console.log(`    completeness: ${data.json.complete ? '✅ COMPLETE' : '⛔ INCOMPLETE'}   ·   coeff coverage: ${data.json.coeffCoverage}%   ·   0-damage champs: ${data.json.zeroCoeffChamps}`);
} else console.log('    ⚠ no report (needs --env-file=.env.local)');

console.log('\n▶ MUTATION (rung 9 — do the rungs actually catch injected engine bugs?)');
if (mut.json && !mut.json.aborted) {
  console.log(`    kill rate ${mut.json.killRate}% (${mut.json.pass}/${mut.json.total} mutants caught)   ·   ${mut.json.unexpectedSurvivors.length} suite hole(s)   ·   ${mut.json.coverageGaps.length} coverage gap(s)`);
  if (mut.json.coverageGaps.length) for (const g of mut.json.coverageGaps) console.log(`    · gap: no rung catches "${g}"`);
} else if (mut.json && mut.json.aborted) console.log(`    ⛔ ABORTED — baseline not green (${(mut.json.baselineRed || []).join(', ')})`);
else console.log('    ⚠ no report');

console.log('\n▶ MECHANIC MANIFEST (what the sim models, and at what fidelity)');
const counts = MANIFEST.reduce((a, [, s]) => (a[s] = (a[s] || 0) + 1, a), {});
for (const [m, st] of MANIFEST) console.log(`    ${mark[st] || '? '} ${m}`);
console.log(`    → ${counts.implemented || 0} implemented · ${counts.partial || 0} partial · ${counts.stub || 0} stub · ${counts.unimplemented || 0} unimplemented`);

console.log('\n▶ REALITY SCORING LEVELS (graded only where the sim is complete enough)');
for (const [lv, st] of LEVELS) console.log(`    ${st === 'supported' ? '✅' : st === 'partial' ? '◐ ' : '⃠ '} ${lv}  [${st}]`);
console.log('    (supported levels are scored by gate 2: node --env-file=.env.local tools/sim-dragon.mjs)');

// ── DEFECT LEDGER ────────────────────────────────────────────────────────────────
console.log('\n╔══════════════════════════════════════════════════════════════════════╗');
console.log('║  DEFECT LEDGER  (classified; only bucket 1 blocks)                     ║');
console.log('╚══════════════════════════════════════════════════════════════════════╝');
const bucket = (title, items, blocks) => {
  console.log(`\n  ${blocks ? '⛔' : '·'} ${title} — ${items.length}${blocks ? '  (BLOCKS THE GATE)' : ''}`);
  for (const it of items.slice(0, 25)) console.log(`      - ${it}`);
  if (items.length > 25) console.log(`      … +${items.length - 25} more`);
};
bucket('1. SPEC VIOLATIONS — fix before any reality comparison', ledger.spec_violation, true);
bucket('2. UNIMPLEMENTED / STUB mechanics — sim backlog', ledger.unimplemented, false);
bucket('3. MISSING / ESTIMATED data — sourcing backlog', ledger.missing_data, false);
bucket('4. REALITY LEVELS not yet scoreable — labelled, not failures', ledger.reality_gap, false);

// ── VERDICT ─────────────────────────────────────────────────────────────────────
const blocked = ledger.spec_violation.length > 0;
console.log('\n══ QA VERDICT ══');
if (blocked) {
  console.log(`  ⛔ BLOCKED — ${ledger.spec_violation.length} spec violation(s). The sim disagrees with its own design;`);
  console.log('     reality comparison is meaningless until these are fixed. This is the ONLY blocker.');
} else {
  console.log('  ✅ SPEC-CONFORMANT — the sim does what we designed. It is INCOMPLETE (see buckets 2-4),');
  console.log('     but that is recorded, not a failure. Keep climbing the ladder; work the backlog deliberately.');
}
console.log('');
process.exit(blocked ? 1 : 0);
