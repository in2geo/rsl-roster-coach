// tools/turn-order-check.mjs — TURN-ORDER anchor checker for the turn-model calibration.
//
// Traces the actor(:skill) sequence at the start of each wave phase in the Dragon-16 DonaHilvi pool fight and
// diffs it against the reality-confirmed anchor (test/turn-order/dragon-pool-wave-order.json). This is the
// DRIVER for the OPEN turn-counting/turn-order work: wave 1 should PASS (the confirmed opening — don't regress
// it), wave 2 should FAIL today (the sim floods ally actions instead of "5 allies then Faceless 6th"). Make
// wave 2 pass by fixing the wave-transition turn economy (ally TM carry-over + boost-skill cooldown recharge),
// NOT by tuning damage. See knowledge/HANDOFF_2026-08-03_turn-model-root-cause.md.
//
// Run: node --env-file=.env.local tools/turn-order-check.mjs

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { makeState, simulate } from '../lib/sim/engine.js';
import { installRecipeRun } from '../lib/sim/interpreter.js';
import { buildDragonBattle } from '../lib/sim/dragon-fixture.js';

const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const anchor = JSON.parse(fs.readFileSync(path.join(REPO, 'test/turn-order/dragon-pool-wave-order.json'), 'utf8'));

const BASE = (process.env.SUPABASE_URL || '').replace(/\/rest\/v1\/?$/, '');
const KEY = process.env.SUPABASE_SERVICE_KEY;
if (!BASE || !KEY) { console.error('turn-order-check needs the DB — run with --env-file=.env.local'); process.exit(1); }
const H = { apikey: KEY, Authorization: `Bearer ${KEY}` };
const rest = (p) => fetch(`${BASE}/rest/v1/${p}`, { headers: H }).then((r) => r.json());

const fixture = JSON.parse(fs.readFileSync(path.join(REPO, anchor.fixture), 'utf8'));
const built = await buildDragonBattle({ rest, fixture, repoRoot: REPO });
if (built.skip) { console.error('build failed:', built.skip); process.exit(1); }

// Capture the actor:skill sequence per phase (short champion name, no #position suffix).
const seqByPhase = {};
const st = makeState({ allies: built.allies, enemies: [], seed: anchor.seed ?? null });
st.purpleBarLeft = 0;
installRecipeRun(st);
st.onAction = (state, actor, skill) => {
  (seqByPhase[state.phase] ??= []).push({ actor: String(actor.name).replace(/#.*/, ''), side: actor.side, skill: skill.slot || skill.name || '?' });
};
simulate(st, built.content, { turnCap: 400 });

let anyFail = false;
const failures = [];
for (const [phase, spec] of Object.entries(anchor.phases)) {
  const actual = seqByPhase[phase] || [];
  const exp = spec.expected;
  let firstDiverge = -1;
  const rows = [];
  for (let i = 0; i < exp.length; i++) {
    const e = exp[i], a = actual[i];
    const actorOk = a && a.actor === e.actor;
    const skillOk = !spec.assertSkills || !e.skill || (a && a.skill === e.skill);
    const ok = actorOk && skillOk;
    if (!ok && firstDiverge < 0) firstDiverge = i;
    rows.push(`  ${String(e.n).padStart(2)}  want ${e.actor}${spec.assertSkills && e.skill ? ':' + e.skill : ''}`.padEnd(34)
      + `got ${a ? a.actor + ':' + a.skill : '—'}   ${ok ? '✓' : '✗'}`);
  }
  const pass = firstDiverge < 0;
  if (!pass) { anyFail = true; failures.push(`${phase}: diverges at position ${firstDiverge + 1}`); }
  console.log(`\n── ${phase} ── ${pass ? '✅ PASS' : '❌ FAIL (first divergence at position ' + (firstDiverge + 1) + ')'}`);
  console.log(`   ${spec._status.slice(0, 100)}...`);
  for (const r of rows) console.log(r);
}

console.log('\nQA_JSON ' + JSON.stringify({ rung: 'turn-order', pass: anyFail ? 0 : 1, fail: failures.length, failures }));
console.log(anyFail
  ? '\n❌ turn-order anchor: wave 2 does not match reality (5 allies then Faceless 6th). This is the turn-model target — fix the wave-transition turn economy, then re-run.'
  : '\n✅ turn-order anchor: all wave openings match reality.');
process.exit(0);   // report-only: this is a calibration target, not a blocking gate (wave 2 is expected red until the turn model is fixed)
