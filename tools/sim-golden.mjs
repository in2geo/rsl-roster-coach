// tools/sim-golden.mjs — QA PROTOCOL RUNG 4: golden battles.
//
// A golden battle is a hand-verified real fight (from a recording + note session): exact INPUTS
// (per-champion builds) and exact OUTPUT (result, per-hero totals, a turn-by-turn timeline with
// confidence). The sim is scored against it at the levels it's complete enough to attempt.
//
// This v1 does two honest things without needing the sim or a DB:
//   1. VALIDATES each fixture's internal consistency — a malformed golden is a broken TEST (bucket 1).
//   2. Reports each fixture's READINESS — RUNNABLE (all builds captured + content modelled) vs
//      PENDING-INPUTS (bucket 3) vs CONTENT-NOT-MODELLED. Running the sim against a RUNNABLE fixture
//      and scoring outcome/failure-location is the next step, once a complete capture exists.
//
// Run: node tools/sim-golden.mjs   (reads test/golden/*.json, no DB)

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIR = path.join(__dirname, '..', 'test', 'golden');
const MODELLED = new Set(["Dragon's Lair"]);   // dungeons lib/sim can currently run

let pass = 0, fail = 0; const failures = [];
const ok = (name, cond, detail = '') => { if (cond) pass++; else { fail++; failures.push(`${name}${detail ? ' — ' + detail : ''}`); } };

const files = fs.existsSync(DIR) ? fs.readdirSync(DIR).filter(f => f.endsWith('.json')) : [];
const report = [];

for (const f of files) {
  let g; try { g = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')); } catch (e) { ok(`${f}: valid JSON`, false, e.message); continue; }
  const id = g.id || f;

  // ── 1. FIXTURE INTERNAL CONSISTENCY (a malformed golden can't be a valid test) ──
  ok(`${id}: has content+result+team`, !!(g.content && g.result && Array.isArray(g.team) && g.team.length));
  if (g.result) ok(`${id}: outcome is WIN|LOSS`, ['WIN', 'LOSS'].includes(g.result.outcome), `got ${g.result?.outcome}`);
  if (g.result && g.team) ok(`${id}: survivors within 0..team`, g.result.survivors >= 0 && g.result.survivors <= g.team.length, `survivors ${g.result.survivors}/${g.team.length}`);
  if (g.expected?.per_hero && g.expected?.damage_rank) {
    const byDmg = Object.entries(g.expected.per_hero).sort((a, b) => b[1].damage - a[1].damage).map(([n]) => n);
    ok(`${id}: damage_rank matches per-hero damage`, JSON.stringify(byDmg) === JSON.stringify(g.expected.damage_rank), `derived ${byDmg.join('>')}`);
    for (const n of Object.keys(g.expected.per_hero)) ok(`${id}: per-hero '${n}' is on the team`, g.team.includes(n));
  }
  if (Array.isArray(g.timeline)) {
    let mono = true, within = true;
    for (let i = 0; i < g.timeline.length; i++) {
      if (i && g.timeline[i].turn <= g.timeline[i - 1].turn) mono = false;
      if (g.result && g.timeline[i].turn > g.result.turns) within = false;
    }
    ok(`${id}: timeline turns strictly increasing`, mono);
    ok(`${id}: timeline turns <= total turns`, within);
  }

  // ── 2. READINESS (not a pass/fail — a data-tier report) ──
  const inputs = g.inputs || {};
  const heroes = g.team || [];
  const captured = heroes.filter(h => inputs[h] && inputs[h].build);
  const pending = heroes.filter(h => !(inputs[h] && inputs[h].build));
  const modelled = MODELLED.has(g.content?.dungeon);
  const runnable = modelled && pending.length === 0;
  report.push({ id, modelled, captured: captured.length, total: heroes.length, pending, runnable });
}

// ── report ───────────────────────────────────────────────────────────────────
console.log(`\n══ SIM GOLDEN BATTLES (rung 4) ══  ${files.length} fixture(s); ${pass} consistency checks passed, ${fail} failed\n`);
for (const f of failures) console.log(`  ✗ ${f}`);
for (const r of report) {
  const state = r.runnable ? '✅ RUNNABLE' : !r.modelled ? '⃠ content not modelled by lib/sim' : `⏳ PENDING inputs (${r.captured}/${r.total} builds; missing ${r.pending.join(', ')})`;
  console.log(`  · ${r.id}: ${state}`);
}
if (!files.length) console.log('  no golden fixtures yet — add test/golden/*.json from a recording + note session');
console.log('\n  Next: capture ALL FIVE builds of a team on a MODELLED dungeon (Dragon), stably, so a fixture');
console.log('  becomes RUNNABLE — then rung 4 runs the sim on the exact stats and scores outcome + failure-location.');

console.log('QA_JSON ' + JSON.stringify({ rung: 'golden', fixtures: files.length, pass, fail, failures,
  pendingInputs: report.filter(r => r.modelled && !r.runnable).map(r => `${r.id}: missing builds ${r.pending.join('/')}`) }));
if (fail) process.exit(1);
