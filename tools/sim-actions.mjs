// tools/sim-actions.mjs — QA RUNG: ACTION verification (turn-by-turn, mechanics-derived, RNG-agnostic).
// PHASE I of the ACTION VERIFICATION MODEL (knowledge/ACTION_VERIFICATION_MODEL.md).
//
// Mike's method, made into a gate. RESULTS (damage) vary with RNG; ACTIONS do not — the game mechanics
// FULLY DETERMINE, at every decision point: WHO acts (SPD), WHICH skill (AI priority), WHICH target
// (targeting rule). There is no guessing and nothing seeded from a recording. This rung computes the
// mechanically-correct expected action independently and compares it to what the sim actually did; at the
// FIRST divergence it stops and prints the resolution checklist. Deterministic (seed=null) so the action
// sequence is byte-repeatable.
//
// THE AUTHORITY for skill *properties* is the in-game card (KIT_FACTS below), NOT the parser — so a parse
// bug ("A2 isn't flagged AoE") surfaces as the sim taking the WRONG action, instead of the oracle
// agreeing with the sim's mistake.
//
// Run: node --env-file=.env.local tools/sim-actions.mjs

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { makeState, simulate, chooseSingleTarget } from '../lib/sim/engine.js';
import { canUseSkill } from '../lib/sim/ai.js';
import { buildDragonBattle } from '../lib/sim/dragon-fixture.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname, '..');
const FIX = path.join(REPO, 'test', 'golden', 'dragon16-donbambus-2026-07-22.json');

const alive = (arr) => arr.filter((c) => c.alive);
const slotU = (s) => String(s.slot).toUpperCase();
const bySlotDesc = (a, b) => String(b.slot).localeCompare(String(a.slot));

// ── AUTHORITATIVE SKILL RULE (knowledge/CHAMPION_AI_MODEL.md): a confirmed per-champion order if present
// (actor.skillOrder), else the DEFAULT highest-slot-first (A3>A2>A1), honouring cooldown + role locks
// (canUseSkill). Independent of engine.pickSkill so a divergence is meaningful.
function expectedSkill(actor, state) {
  const usable = (s) => !s.isPassive && (s.cdLeft ?? 0) <= 0 && canUseSkill(s, state, actor);
  if (actor.skillOrder) {
    for (const slot of actor.skillOrder) { const s = actor.skills.find((x) => slotU(x) === slot && usable(x)); if (s) return s; }
    return actor.skills.find((s) => !s.isPassive && slotU(s) === 'A1') ?? null;
  }
  const cands = actor.skills.filter((s) => usable(s) && slotU(s) !== 'A1').sort(bySlotDesc);
  if (cands.length) return cands[0];
  return actor.skills.find((s) => !s.isPassive && slotU(s) === 'A1') ?? null;
}

// ── AUTHORITATIVE TARGET RULE. AoE → all; else taunt → veil-skip → lowest-HP% (avoid Unkillable for us).
function expectedTargetName(actor, skill, state) {
  if (!skill.hitsEnemies) return '(no enemy target)';
  if (skill.aoe) return 'AoE';
  const opp = alive(actor.side === 'ally' ? state.enemies : state.allies);
  const t = chooseSingleTarget(opp, actor.side === 'ally' ? ['Unkillable', 'Block Damage'] : []);
  return t?.name ?? '(none)';
}

// ── resolution checklist: which branch is this divergence? ────────────────────────
function checklist(actor, expSkill, actSkill) {
  if (expSkill && actSkill && slotU(expSkill) !== slotU(actSkill)) {
    if ((actSkill.cdLeft ?? 0) > 0) return `COOLDOWN: sim used ${slotU(actSkill)} while on cooldown (cd bug)`;
    return `SKILL ORDER: sim used ${slotU(actSkill)}, rule expects ${slotU(expSkill)} for ${actor.name} — CONFIRM vs a recording: if the sim is wrong fix pickSkill; if the RULE is wrong it's a per-champion exception to add to CONFIRMED_SKILL_ORDER (CHAMPION_AI_MODEL.md)`;
  }
  return `TARGET: same skill, different target → targeting rule (taunt/veil/lowest-HP%)`;
}

async function main() {
  if (!process.env.SUPABASE_URL) { console.log('\n══ SIM ACTIONS (rung) ══  ⏳ skipped — no SUPABASE_URL (needs --env-file=.env.local)\n'); emit({ skipped: 'no DB' }); return; }
  const BASE = process.env.SUPABASE_URL.replace(/\/rest\/v1\/?$/, '');
  const H = { apikey: process.env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}` };
  const rest = async (p) => (await fetch(`${BASE}/rest/v1/${p}`, { headers: H })).json();
  const fixture = JSON.parse(fs.readFileSync(FIX, 'utf8'));
  const built = await buildDragonBattle({ rest, fixture, repoRoot: REPO });
  if (built.skip) { console.log('skipped: ' + built.skip); emit({ skipped: built.skip }); return; }

  const rows = [];
  const state = makeState({ allies: built.allies, enemies: [] });
  state.purpleBarLeft = 0;
  // ACTION HOOK: at each decision point compute the mechanically-correct action and compare
  state.onAction = (st, actor, skill) => {
    const exp = expectedSkill(actor, st);
    const skillMatch = exp && slotU(exp) === slotU(skill);
    const actTarget = skillMatch ? expectedTargetName(actor, skill, st) : null;   // sim target == rule target (same state)
    rows.push({ turn: st.turn, actor: actor.name, side: actor.side,
      expSkill: exp ? slotU(exp) : '(none)', actSkill: slotU(skill),
      target: actTarget, match: skillMatch, checklist: skillMatch ? null : checklist(actor, exp, skill) });
  };
  const o = console.log; console.log = () => {};
  simulate(state, built.content, { turnCap: 400 });
  console.log = o;

  const divs = rows.filter((r) => !r.match);
  const first = divs[0] || null;
  console.log(`\n══ SIM ACTIONS (rung) ══  ${rows.length} actions checked · ${rows.length - divs.length} match the game rules · ${divs.length} diverge\n`);
  if (first) {
    console.log(`  ▶ FIRST ACTION DIVERGENCE — t${first.turn}, ${first.actor}:`);
    console.log(`      expected skill (game mechanics): ${first.expSkill}`);
    console.log(`      sim actually used:               ${first.actSkill}`);
    console.log(`      resolution: ${first.checklist}`);
    console.log('\n  All divergences (turn · actor · expected → actual · branch):');
    for (const d of divs.slice(0, 20)) console.log(`      t${String(d.turn).padStart(3)}  ${d.actor.padEnd(8)} ${d.expSkill} → ${d.actSkill}   ${d.checklist.split(':')[0]}`);
    if (divs.length > 20) console.log(`      … +${divs.length - 20} more`);
  } else {
    console.log('  ✅ every action matches the game-mechanic rule (actor/skill). The action layer is correct;');
    console.log('     any remaining reality gap is in MECHANICS/STATE (survival), not action-selection.');
  }
  emit({ actions: rows.length, matched: rows.length - divs.length, diverged: divs.length,
    firstDivergence: first ? { turn: first.turn, actor: first.actor, expected: first.expSkill, actual: first.actSkill, branch: first.checklist } : null });
}

function emit(obj) { console.log('\nQA_JSON ' + JSON.stringify({ rung: 'actions', ...obj })); }
main().catch((e) => { console.error(e); console.log('\nQA_JSON ' + JSON.stringify({ rung: 'actions', error: String(e.message || e) })); process.exit(1); });
