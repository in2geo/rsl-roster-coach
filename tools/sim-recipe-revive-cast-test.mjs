// tools/sim-recipe-revive-cast-test.mjs — REVIVE_AND_CAST (Iudex Artor A3 "Revival Mandate" + A4 "Sentenced to
// Life") op proof.
//
// The op revives ONE dead ally (50% HP + 50% TM), places a 50% [Increase ATK] 1t on it, then immediately casts
// the revived ally's DEFAULT (A1) skill at the lowest-HP enemy — reusing the full damage path. If that cast
// kills an enemy, Artor's own Revival Mandate (A3) cooldown resets, gated by the passive's 4-turn internal cd.
// Deterministic (seed=null). Run: node tools/sim-recipe-revive-cast-test.mjs
import { makeCombatant, makeState } from '../lib/sim/engine.js';
import { applyRecipe } from '../lib/sim/interpreter.js';
import { RECIPES } from '../lib/sim/recipes.js';

let pass = 0, fail = 0;
const check = (n, c, d = '') => { c ? pass++ : fail++; console.log(`  ${c ? 'PASS' : 'FAIL'}  ${n}${d ? ' — ' + d : ''}`); };

// Artor with an A3 skill object so the reset has something to zero (executeTurn would set cdLeft=6 before the
// cast; we set it directly since the test drives applyRecipe, not the turn loop).
const makeArtor = () => { const a = makeCombatant({ name: 'Iudex Artor', side: 'ally', atk: 1800, maxHp: 30000, affinity: 'Spirit', critRate: 0 }); a.skills = [{ slot: 'A3', cooldown: 6, cdLeft: 6, isPassive: false }]; return a; };
// A dead ally whose champKey maps to an authored A1 (Ninja → NINJA-A1 Shatterbolt, single-target, no cd).
const makeDeadNinja = (atk = 4000) => { const n = makeCombatant({ name: 'Ninja', side: 'ally', atk, maxHp: 20000, affinity: 'Magic', critRate: 0 }); n.alive = false; n.hp = 0; n.turnMeter = 0; return n; };
const enemy = (hp, def = 200) => makeCombatant({ name: 'Boss', side: 'enemy', role: 'boss', maxHp: hp, def, affinity: 'Void', critRate: 0 });
const eff = (state, kind) => state.effects.filter((e) => e.kind === kind);

console.log('\n=== REVIVE_AND_CAST — Iudex Artor A3 revives, buffs, and casts the revived ally\'s default skill ===\n');

// 1 — the full chain: revive (50% HP + 50% TM) + [Increase ATK] + the revived ally casts its A1 (deals damage).
{
  const artor = makeArtor();
  const ninja = makeDeadNinja();
  const boss = enemy(5e7);   // big enough to survive → no kill, no reset
  const state = makeState({ allies: [artor, ninja], enemies: [boss], seed: null });
  const hp0 = boss.hp;
  applyRecipe(state, artor, RECIPES['IUDEX-A3']);
  check('revived ally is alive again', ninja.alive === true);
  check('revived at 50% HP', Math.abs(ninja.hp - 0.50 * ninja.maxHp) < 1, `hp=${Math.round(ninja.hp)} of ${ninja.maxHp}`);
  // 50 from the revive + 15 from Ninja's OWN A1 "+15% TM vs Boss" self-fill → proves the revived ally ran its
  // FULL default skill (not just a bare hit), and that the revive granted 50% TM.
  check('revived with 50% TM, then its A1 self-filled +15% vs boss', ninja.turnMeter === 65, `tm=${ninja.turnMeter}`);
  check('50% [Increase ATK] on the revived ally', ninja.buffs.some((b) => b.type === 'Increase ATK'), `buffs: ${ninja.buffs.map((b) => b.type).join(',') || 'none'}`);
  check('revived ally cast its A1 (enemy took damage)', boss.hp < hp0, `boss took ${Math.round(hp0 - boss.hp)}`);
  check('revive_cast effect recorded (consumed)', eff(state, 'revive_cast').some((e) => e.consumed), `${eff(state, 'revive_cast').length} cast effect(s)`);
}

// 2 — reset-on-kill: the revived ally's A1 kills the enemy → Artor's Revival Mandate cooldown resets to 0.
{
  const artor = makeArtor();
  const ninja = makeDeadNinja();
  const boss = enemy(100, 0);   // trivially killable by the A1 hit
  const state = makeState({ allies: [artor, ninja], enemies: [boss], seed: null });
  applyRecipe(state, artor, RECIPES['IUDEX-A3']);
  check('enemy was killed by the revived ally\'s cast', boss.hp <= 0, `boss hp=${Math.round(boss.hp)}`);
  check('Revival Mandate cooldown reset to 0 (Sentenced to Life)', artor.skills.find((s) => s.slot === 'A3').cdLeft === 0, `cdLeft=${artor.skills.find((s) => s.slot === 'A3').cdLeft}`);
  check('cooldown_reset effect recorded (consumed)', eff(state, 'cooldown_reset').some((e) => e.consumed), `${eff(state, 'cooldown_reset').length} reset effect(s)`);
}

// 3 — no kill → no reset: the cooldown is left as the turn loop set it (6).
{
  const artor = makeArtor();
  const ninja = makeDeadNinja(500);   // too weak to kill
  const boss = enemy(5e7);
  const state = makeState({ allies: [artor, ninja], enemies: [boss], seed: null });
  applyRecipe(state, artor, RECIPES['IUDEX-A3']);
  check('no kill → Revival Mandate cooldown NOT reset (stays 6)', artor.skills.find((s) => s.slot === 'A3').cdLeft === 6, `cdLeft=${artor.skills.find((s) => s.slot === 'A3').cdLeft}`);
  check('no consumed cooldown_reset', !eff(state, 'cooldown_reset').some((e) => e.consumed));
}

// 4 — the passive's 4-turn internal cooldown gates the reset: a kill while the passive is on cd does NOT reset.
{
  const artor = makeArtor();
  artor._revMandateResetAt = 10;   // as if it reset recently; state.turn (0) is inside the 4-turn window
  const ninja = makeDeadNinja();
  const boss = enemy(100, 0);
  const state = makeState({ allies: [artor, ninja], enemies: [boss], seed: null });
  applyRecipe(state, artor, RECIPES['IUDEX-A3']);
  check('kill lands but reset is gated by the passive cd', boss.hp <= 0 && artor.skills.find((s) => s.slot === 'A3').cdLeft === 6,
    `boss hp=${Math.round(boss.hp)}, cdLeft=${artor.skills.find((s) => s.slot === 'A3').cdLeft}`);
  check('cooldown_reset logged as non-consumed (internal cooldown)', eff(state, 'cooldown_reset').some((e) => !e.consumed));
}

// 5 — no dead ally → benign no-op, no crash, no cast.
{
  const artor = makeArtor();
  const ally = makeCombatant({ name: 'Ninja', side: 'ally', atk: 4000, maxHp: 20000, affinity: 'Magic', critRate: 0 });   // alive
  const boss = enemy(5e7);
  const state = makeState({ allies: [artor, ally], enemies: [boss], seed: null });
  const hp0 = boss.hp;
  let threw = false;
  try { applyRecipe(state, artor, RECIPES['IUDEX-A3']); } catch { threw = true; }
  check('no dead ally → no crash, no cast, enemy untouched', !threw && boss.hp === hp0 && eff(state, 'revive_cast').length === 0, `threw=${threw}, casts=${eff(state, 'revive_cast').length}`);
}

console.log(`\n${fail ? '✗' : '✓'} REVIVE_AND_CAST: ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
