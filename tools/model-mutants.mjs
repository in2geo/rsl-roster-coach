// tools/model-mutants.mjs — MODEL QA · TEETH (mutation testing for the Action Verification Model).
//
// The Model (recipes + interpreter) is a PIECE of the eventual Simulator, so it gets the LOCAL half of
// the QA protocol (unit / toy / invariants / sensitivity) — and this rung proves those checks have teeth.
// It injects a known BUG into lib/sim/interpreter.js, re-runs the Model's no-DB toy-battle rungs, and
// confirms at least one goes red. A mutant that survives green is a HOLE (expectKill) or a not-yet-pinned
// mechanic (probe). Kill rate = the Model suite's defect-detection power, as a NUMBER (MODEL_AS_REIMPL).
//
// Same discipline as the Simulator's sim-mutants.mjs, pointed at the Model's core + the Model's rungs.
// Source is mutated IN PLACE and restored on every exit path; a `find` matching ≠1× is STALE and fails.
// Run: node tools/model-mutants.mjs   (no DB)

import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const INTERP = path.join(__dirname, '..', 'lib', 'sim', 'interpreter.js');

// The Model's no-DB toy-battle rungs = the suite under test. A mutant is KILLED if ANY goes red.
const RUNGS = ['sim-recipe-test.mjs', 'sim-recipe-b-test.mjs', 'sim-recipe-c-test.mjs', 'sim-recipe-d-test.mjs', 'model-invariants.mjs', 'model-sensitivity.mjs'];

// expectKill:true — a Model rung MUST catch this; surviving = a SUITE HOLE (blocks).
// expectKill:false — a PROBE; surviving is a reported COVERAGE GAP (a Model mechanic no rung pins yet).
const MUTANTS = [
  { name: 'shield value zeroed (pctOfCasterMaxHp ignored)', expectKill: true,
    find: 'ef.pctOfCasterMaxHp != null ? Math.round(ef.pctOfCasterMaxHp * (actor.maxHp || 0))',
    repl: 'ef.pctOfCasterMaxHp != null ? Math.round(0 * (actor.maxHp || 0))' },
  { name: 'debuff immunity ignored (immune target still gets it)', expectKill: true,
    find: 'if (t.immune?.includes(ef.type)) { E({ kind: \'debuff\'',
    repl: 'if (false) { E({ kind: \'debuff\'' },
  { name: 'revive HP wrong (30% -> 60% of MAX HP)', expectKill: true,
    find: 't.hp = (act.effect?.hpPct ?? 0.30) * t.maxHp;',
    repl: 't.hp = (act.effect?.hpPct ?? 0.30) * t.maxHp * 2;' },
  { name: 'multi-hit collapsed (hitCount forced to 1)', expectKill: true,
    find: 'for (let h = 0; h < (F.hitCount ?? 1); h++) {',
    repl: 'for (let h = 0; h < 1; h++) {' },
  { name: 'conditional AoE broken (always takes the else branch)', expectKill: true,
    find: 'const branch = pass ? act.targetIf.then : act.targetIf.else;',
    repl: 'const branch = act.targetIf.else;' },
  { name: 'heal zeroed (pctOfCasterMaxHp ignored)', expectKill: true,
    find: 'act.effect.pctOfCasterMaxHp != null ? act.effect.pctOfCasterMaxHp * (actor.maxHp || 0)',
    repl: 'act.effect.pctOfCasterMaxHp != null ? 0 * (actor.maxHp || 0)' },
  { name: 'buff-steal moves nothing (splice 0 buffs)', expectKill: true,
    find: 'const stolen = t.buffs.splice(0, t.buffs.length);',
    repl: 'const stolen = t.buffs.splice(0, 0);' },
  { name: 'lowest_hp_ally recipient becomes HIGHEST-HP', expectKill: true,
    find: '(a.hp / a.maxHp <= b.hp / b.maxHp ? a : b))] : [];',
    repl: '(a.hp / a.maxHp >= b.hp / b.maxHp ? a : b))] : [];' },

  // ── formerly coverage gaps — now pinned by sim-recipe-d-test / the exact-damage assertion ──
  { name: 'incoming-damage modifiers neutralised (Aid the Feeble / Pelops -20% / nullify)', expectKill: true,
    find: 'factor *= mod.factor;', repl: 'factor *= 1;' },
  { name: 'EXTEND_EFFECT no-op (buff durations not extended)', expectKill: true,
    find: 'for (const b of t.buffs) { b.turnsLeft += turns; n++; }',
    repl: 'for (const b of t.buffs) { b.turnsLeft += 0; n++; }' },
  { name: 'crit removed from DEAL_DAMAGE (exact-damage math)', expectKill: true,
    find: 'const critM = fl.crit ? critMult(state, actor.critRate, actor.critDmg) : 1;',
    repl: 'const critM = fl.crit ? 1 : 1;' },
  { name: 'heal uncapped — HP can exceed MAX (only the invariants rung sees this)', expectKill: true,
    find: 'const before = t.hp; t.hp = Math.min(t.maxHp, t.hp + amt);',
    repl: 'const before = t.hp; t.hp = t.hp + amt;' },
];

const ORIGINAL = fs.readFileSync(INTERP, 'utf8');
const restore = () => { try { if (fs.readFileSync(INTERP, 'utf8') !== ORIGINAL) fs.writeFileSync(INTERP, ORIGINAL); } catch { fs.writeFileSync(INTERP, ORIGINAL); } };
process.on('exit', restore);
process.on('SIGINT', () => { restore(); process.exit(130); });
process.on('SIGTERM', () => { restore(); process.exit(143); });

// A rung is RED if it exits non-zero or errors (the recipe rungs exit(fail?1:0)).
function rungRed(script) {
  const r = spawnSync(process.execPath, [path.join(__dirname, script)], { encoding: 'utf8', timeout: 120000, maxBuffer: 64 * 1024 * 1024 });
  return !!(r.error || r.status !== 0);
}

// BASELINE — pristine Model must pass every rung or nothing below means anything.
const baselineRed = RUNGS.filter(rungRed);
if (baselineRed.length) {
  console.log(`\n══ MODEL MUTATION (teeth) ══  ⛔ ABORTED — baseline not green: ${baselineRed.join(', ')} red on pristine interpreter.\n`);
  console.log('QA_JSON ' + JSON.stringify({ rung: 'model-mutation', pass: 0, fail: 1, aborted: true, baselineRed }));
  process.exit(1);
}

const results = [];
for (const m of MUTANTS) {
  const occ = ORIGINAL.split(m.find).length - 1;
  if (occ !== 1) { results.push({ ...m, stale: true, occ }); continue; }
  fs.writeFileSync(INTERP, ORIGINAL.replace(m.find, m.repl));
  const killers = RUNGS.filter(rungRed).map(s => s.replace(/^sim-|\.mjs$/g, ''));
  restore();
  results.push({ ...m, killed: killers.length > 0, killers });
}
restore();

const stale = results.filter(r => r.stale);
const applied = results.filter(r => !r.stale);
const killed = applied.filter(r => r.killed);
const holes = applied.filter(r => !r.killed && r.expectKill);
const gaps = applied.filter(r => !r.killed && !r.expectKill);
const killRate = applied.length ? Math.round((killed.length / applied.length) * 100) : 0;

console.log(`\n══ MODEL MUTATION (teeth) ══  ${killed.length}/${applied.length} mutants killed  (kill rate ${killRate}%)\n`);
for (const r of results) {
  if (r.stale) { console.log(`  ⚠ STALE  ${r.name} — find matched ${r.occ}× (need 1)`); continue; }
  const tag = r.killed ? `✓ killed by ${r.killers.join(', ')}` : (r.expectKill ? '✗ SURVIVED — a rung SHOULD catch this (SUITE HOLE)' : '· survived (coverage gap — no Model rung pins this yet)');
  console.log(`  ${r.killed ? '✓' : (r.expectKill ? '✗' : '·')} ${r.name}\n      ${tag}`);
}
if (holes.length) { console.log('\n  ⛔ SUITE HOLES (bugs that slipped past every rung but must be caught):'); for (const r of holes) console.log(`      - ${r.name}`); }
if (gaps.length) { console.log('\n  COVERAGE GAPS (Model mechanics no toy rung pins yet — candidates for a new assertion):'); for (const r of gaps) console.log(`      - ${r.name}`); }

const blocking = holes.length + stale.length;
console.log('\nQA_JSON ' + JSON.stringify({ rung: 'model-mutation', pass: killed.length, fail: blocking, killRate, total: applied.length,
  suiteHoles: holes.map(r => r.name), coverageGaps: gaps.map(r => r.name), stale: stale.map(r => r.name) }));
process.exit(blocking ? 1 : 0);
