// tools/sim-mutants.mjs — QA PROTOCOL RUNG 9: mutation testing (do the rungs actually have teeth?).
//
// The teeth discipline, made into a NUMBER. Every other rung guards a behaviour with an assertion;
// a "teeth check" (baseline > 0, and the test actually ran) proves that ONE assertion can fail. This
// rung proves the SUITE can fail: it injects a known BUG into the engine, re-runs the no-DB rungs, and
// confirms at least one goes red. A mutant that survives green is a HOLE — a spec behaviour no rung is
// watching. Kill rate is the suite's defect-detection power, reported the way MODEL_AS_REIMPLEMENTATION
// demands: a number, not a belief ("we think our tests have teeth").
//
// This is the systematic form of what the project already does per-assertion. Mike, 2026-07-22:
// "a rung that cannot fail is worthless." So can the whole ladder.
//
// SAFETY: engine.js is mutated IN PLACE and restored after every mutant, with a process-exit handler
// as a backstop, so an interrupt cannot leave the source mutated. Each mutant's `find` must match the
// pristine source EXACTLY ONCE — a mutant that no longer applies (source drifted) is reported as STALE
// and fails the rung loudly, because a teeth-check that silently stopped running is the exact vacuous
// pass we are guarding against.
//
// Run: node tools/sim-mutants.mjs   (no DB; mutates + restores lib/sim/engine.js)

import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ENGINE = path.join(__dirname, '..', 'lib', 'sim', 'engine.js');

// The no-DB rungs that constitute the SUITE under test. Cheapest first so a killed mutant short-circuits
// before the slower property rung. A mutant is KILLED if ANY of these goes red.
const RUNGS = ['sim-selftest.mjs', 'sim-invariants.mjs', 'sim-sensitivity.mjs', 'sim-effects.mjs'];

// ── THE MUTANTS — each a plausible, surgical bug. `expectKill:true` means an EXISTING rung MUST catch
// it; if such a mutant survives, a guard has gone toothless and the rung FAILS (bucket 1). `false` is a
// PROBE: surviving is not a failure, it is a reported COVERAGE GAP — a behaviour no rung yet pins.
const MUTANTS = [
  { name: 'def-mitigation-noop (DEF ignored entirely)', expectKill: true,
    find: 'export const defMitigation = (def) => DEF_K / (DEF_K + (def ?? 0));',
    repl: 'export const defMitigation = (def) => DEF_K / (DEF_K + 0);' },
  { name: 'decrease-DEF does nothing (effectiveDef ignores the shred)', expectKill: true,
    find: 'return (target.def ?? 0) * (1 - pct);',
    repl: 'return (target.def ?? 0) * (1 - 0);' },
  { name: 'land-chance swaps ACC and RES', expectKill: true,
    find: 'return Math.max(0.05, Math.min(1, 1 - Math.max(0, res - acc) / 100));',
    repl: 'return Math.max(0.05, Math.min(1, 1 - Math.max(0, acc - res) / 100));' },
  { name: 'heal overheals past MAX HP (missing the Math.min cap)', expectKill: true,
    find: 'const before = t.hp; t.hp = Math.min(t.maxHp, t.hp + skill.healPct * actor.maxHp);',
    repl: 'const before = t.hp; t.hp = t.hp + skill.healPct * actor.maxHp;' },
  { name: 'nobody ever dies (death threshold unreachable)', expectKill: true,
    find: 'if (c.alive && c.hp <= 0) {',
    repl: 'if (c.alive && c.hp <= -1e30) {' },

  { name: 'affinity strong hit neutralised (1.30 -> 1.00)', expectKill: false,
    find: 'if (BEATS[attacker] === defender) return 1.30;   // strong hit',
    repl: 'if (BEATS[attacker] === defender) return 1.00;   // strong hit' },
  { name: 'affinity weak hit neutralised (0.70 -> 1.00)', expectKill: false,
    find: 'if (BEATS[defender] === attacker) return 0.70;   // weak hit',
    repl: 'if (BEATS[defender] === attacker) return 1.00;   // weak hit' },
  { name: 'crit bonus removed (critFactor always 1.0)', expectKill: false,
    find: 'export const critFactor = (cr, cd) => 1 + (Math.min(100, cr ?? 0) / 100) * ((cd ?? 0) / 100);',
    repl: 'export const critFactor = (cr, cd) => 1 + 0;' },
  { name: 'shields absorb nothing', expectKill: false,
    find: 'const absorbed = Math.min(b.value, left);',
    repl: 'const absorbed = 0;' },
  { name: 'poison ignores stack count', expectKill: false,
    find: 'const dmg = (d.pct ?? 0.05) * c.maxHp * (d.stacks ?? 1);',
    repl: 'const dmg = (d.pct ?? 0.05) * c.maxHp * 1;' },
  { name: 'targeting picks HIGHEST HP% instead of lowest', expectKill: false,
    find: 'return finalPool.reduce((a, b) => (a.hp / a.maxHp <= b.hp / b.maxHp ? a : b));',
    repl: 'return finalPool.reduce((a, b) => (a.hp / a.maxHp >= b.hp / b.maxHp ? a : b));' },
  { name: 'cooldowns never tick down (frozen on cd)', expectKill: false,
    find: 'function tickCooldowns(c) { for (const s of c.skills) if (s.cdLeft > 0) s.cdLeft -= 1; }',
    repl: 'function tickCooldowns(c) { for (const s of c.skills) if (s.cdLeft > 0) s.cdLeft -= 0; }' },
];

// ── source safety: read pristine once, restore on every exit path ────────────────
const ORIGINAL = fs.readFileSync(ENGINE, 'utf8');
const restore = () => { try { if (fs.readFileSync(ENGINE, 'utf8') !== ORIGINAL) fs.writeFileSync(ENGINE, ORIGINAL); } catch { fs.writeFileSync(ENGINE, ORIGINAL); } };
process.on('exit', restore);
process.on('SIGINT', () => { restore(); process.exit(130); });
process.on('SIGTERM', () => { restore(); process.exit(143); });

// A rung is RED if it exits non-zero, times out/errors, or self-reports fail>0.
function rungRed(script) {
  const r = spawnSync(process.execPath, [path.join(__dirname, script)],
    { encoding: 'utf8', timeout: 120000, maxBuffer: 64 * 1024 * 1024 });
  if (r.error || r.status !== 0) return true;
  const line = (r.stdout || '').split(/\r?\n/).find(l => l.startsWith('QA_JSON '));
  try { return line ? (JSON.parse(line.slice(8)).fail > 0) : false; } catch { return false; }
}

// ── BASELINE — the pristine engine MUST pass every rung, or a kill/survival means nothing ─────────
const baselineRed = RUNGS.filter(rungRed);
if (baselineRed.length) {
  console.log(`\n══ SIM MUTATION (rung 9) ══  ⛔ ABORTED — baseline is not green: ${baselineRed.join(', ')} already red on the pristine engine.`);
  console.log('  Mutation results are meaningless until the suite passes clean. Fix the failing rung(s) first.\n');
  console.log('QA_JSON ' + JSON.stringify({ rung: 'mutation', pass: 0, fail: 1, aborted: true, baselineRed }));
  process.exit(1);
}

// ── run each mutant ──────────────────────────────────────────────────────────────
const results = [];
for (const m of MUTANTS) {
  const occ = ORIGINAL.split(m.find).length - 1;
  if (occ !== 1) { results.push({ ...m, stale: true, occ }); continue; }   // drifted — cannot apply cleanly
  fs.writeFileSync(ENGINE, ORIGINAL.replace(m.find, m.repl));
  const killers = [];
  for (const rung of RUNGS) { if (rungRed(rung)) killers.push(rung.replace(/^sim-|\.mjs$/g, '')); }
  restore();
  results.push({ ...m, killed: killers.length > 0, killers });
}
restore();

// ── classify ─────────────────────────────────────────────────────────────────────
const stale = results.filter(r => r.stale);
const applied = results.filter(r => !r.stale);
const killed = applied.filter(r => r.killed);
const unexpectedSurvivors = applied.filter(r => !r.killed && r.expectKill);   // a guard went toothless → BLOCKS
const coverageGaps = applied.filter(r => !r.killed && !r.expectKill);          // probe survived → reported, backlog
const killRate = applied.length ? Math.round((killed.length / applied.length) * 100) : 0;

// ── report ─────────────────────────────────────────────────────────────────────
console.log(`\n══ SIM MUTATION (rung 9) ══  ${killed.length}/${applied.length} mutants killed  (kill rate ${killRate}%)\n`);
for (const r of results) {
  if (r.stale) { console.log(`  ⚠ STALE  ${r.name}  — find matched ${r.occ}× (expected 1); mutant needs updating`); continue; }
  const tag = r.killed ? `✓ killed by ${r.killers.join(', ')}` : (r.expectKill ? '✗ SURVIVED — expected a rung to catch this (SUITE HOLE)' : '· survived (coverage gap — no rung pins this yet)');
  console.log(`  ${r.killed ? '✓' : (r.expectKill ? '✗' : '·')} ${r.name}\n      ${tag}`);
}
if (unexpectedSurvivors.length) {
  console.log('\n  ⛔ SUITE HOLES — these bugs slipped past every rung but SHOULD be caught:');
  for (const r of unexpectedSurvivors) console.log(`      - ${r.name}`);
}
if (coverageGaps.length) {
  console.log('\n  COVERAGE GAPS (probes no rung catches yet — candidates for a new assertion):');
  for (const r of coverageGaps) console.log(`      - ${r.name}`);
}
if (stale.length) console.log('\n  ⚠ update the STALE mutants above to match the current source, or they measure nothing.');

const blocking = unexpectedSurvivors.length + stale.length;
console.log('\nQA_JSON ' + JSON.stringify({
  rung: 'mutation', pass: killed.length, fail: blocking, killRate, total: applied.length,
  unexpectedSurvivors: unexpectedSurvivors.map(r => r.name),
  coverageGaps: coverageGaps.map(r => r.name),
  stale: stale.map(r => r.name),
}));
process.exit(blocking ? 1 : 0);
