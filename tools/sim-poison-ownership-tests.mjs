// tools/sim-poison-ownership-tests.mjs — regression tests for the per-stack poison OWNERSHIP model.
//
// The stale-source bug (2026-08-16): stackTurns[] (timers) and sources{} (owners) were parallel arrays with no
// link, so expiry aged a timer but could not know which owner to drop → sources over-counted (stale credit).
// Fix: canonical d.stackList = [{turnsLeft, source}], derive stacks/sources/turnsLeft. These assert the reviewer's
// required invariants. Deterministic, no I/O. Run: node tools/sim-poison-ownership-tests.mjs
import { makeCombatant, makeState, applyDebuff, expireDurations, activatePoisons, tickDots, syncStackDerived } from '../lib/sim/engine.js';

let pass = 0, fail = 0; const failures = [];
const ok = (name, cond, detail = '') => { if (cond) pass++; else { fail++; failures.push(`${name}${detail ? ' — ' + detail : ''}`); } };
const srcSum = (d) => Object.values(d.sources ?? {}).reduce((a, b) => a + b, 0);
const poison = (t) => (t.debuffs ?? []).find((d) => d.type === 'Poison');
const place = (t, source, turns = 2) => applyDebuff(t, { type: 'Poison', pct: 0.05, turns, stacking: true, maxStacks: 10, source });
const boss = (o = {}) => makeCombatant({ name: 'Boss', side: 'enemy', role: 'boss', maxHp: 2_000_000, def: 3982, ...o });

const INVARIANT = (name, d) => ok(`invariant sourcesSum===stacks===stackList.length [${name}]`,
  d == null || (srcSum(d) === (d.stacks ?? 0) && d.stacks === (d.stackList?.length ?? 0)));

// 8: invariant holds after PLACEMENT
{ const t = boss(); place(t, 'Xenomorph'); place(t, 'Xenomorph'); place(t, 'Ezio Auditore');
  const d = poison(t); INVARIANT('after placement', d);
  ok('placement: 3 stacks', d.stacks === 3); ok('placement: sources Xeno:2 Ezio:1', d.sources.Xenomorph === 2 && d.sources['Ezio Auditore'] === 1); }

// 1 + 2: expiring a stack removes THAT owner (not an arbitrary one)
{ const t = boss();
  place(t, 'Xenomorph', 2);        // Xeno stack, 2 turns
  place(t, 'Ezio Auditore', 1);    // Ezio stack, 1 turn → expires first
  expireDurations(t);              // Ezio's 1-turn stack ages 1→0 and is removed WITH its owner
  const d = poison(t);
  ok('expiry: Ezio stack (turns=1) removed', d.stacks === 1);
  ok('expiry removes EZIO ownership', !d.sources['Ezio Auditore']);
  ok('expiry KEEPS Xenomorph ownership', d.sources.Xenomorph === 1);
  INVARIANT('after expiry', d); }

// symmetric: expiring a Xeno stack removes Xeno ownership
{ const t = boss();
  place(t, 'Ezio Auditore', 2);
  place(t, 'Xenomorph', 1);        // Xeno stack expires first
  expireDurations(t);
  const d = poison(t);
  ok('expiry removes XENOMORPH ownership', !d.sources.Xenomorph);
  ok('expiry KEEPS Ezio ownership', d.sources['Ezio Auditore'] === 1);
  INVARIANT('after Xeno expiry', d); }

// 3: adding a stack does NOT refresh existing timers
{ const t = boss();
  place(t, 'Xenomorph', 2);        // stack A, 2 turns
  expireDurations(t);              // A ages 2→1
  place(t, 'Ezio Auditore', 2);    // stack B, fresh 2 turns — must NOT refresh A
  const d = poison(t);
  const turns = d.stackList.map((s) => s.turnsLeft).sort();
  ok('add does not refresh existing timers (turns [1,2])', JSON.stringify(turns) === JSON.stringify([1, 2]));
  INVARIANT('after add-no-refresh', d); }

// 4: rejecting a stack at the cap adds NEITHER timer NOR ownership
{ const t = boss();
  for (let i = 0; i < 10; i++) place(t, 'Xenomorph');   // fill to maxStacks 10
  place(t, 'Ezio Auditore');                            // rejected at cap
  const d = poison(t);
  ok('cap: still 10 stacks', d.stacks === 10);
  ok('cap: rejected stack added NO ownership (no Ezio)', !d.sources['Ezio Auditore']);
  ok('cap: sources Xeno still 10', d.sources.Xenomorph === 10);
  INVARIANT('after cap-reject', d); }

// 5: activation removes EVERY poison stack (and the invariant holds trivially after)
{ const t = boss();
  place(t, 'Xenomorph'); place(t, 'Xenomorph'); place(t, 'Ezio Auditore');
  const st = makeState({ allies: [], enemies: [t], seed: 1 });
  activatePoisons(st, t);
  ok('activation removes all poison stacks', !poison(t));
  INVARIANT('after activation', poison(t)); }

// 8 (continued): invariant holds after a natural TICK (stacks/sources unchanged by a tick, but re-derive is safe)
{ const t = boss();
  place(t, 'Xenomorph'); place(t, 'Ezio Auditore');
  const st = makeState({ allies: [], enemies: [t], seed: 1 });
  tickDots(st, t);
  INVARIANT('after natural tick', poison(t)); }

// 9 (Mike 2026-08-16): Ezio explosion cashes in FULL REMAINING DURATION, not one tick. Dragon st20 anchor —
// 5 fresh 5% Poisons, 2 turns each, 25% [Poison Sensitivity], boss factor 0.40 → 578,666 (boss 100%→75%).
// The old one-tick model produced exactly half (289,333 / 12.5%).
{ const HP = 2_314_665;
  const t = boss({ maxHp: HP });
  const st = makeState({ allies: [], enemies: [t], seed: 1 });
  st.poisonDamageFactorVsBoss = 0.40;
  for (let i = 0; i < 5; i++) place(t, 'Xenomorph', 2);       // 5 fresh 5% Poisons, 2 turns remaining each
  applyDebuff(t, { type: 'Poison Sensitivity', value: 25, turns: 2 });
  const dealt = activatePoisons(st, t);
  ok('Ezio explosion = full duration: 5×2t×2%×1.25×0.40 = 578,666', Math.round(dealt) === 578_666, `dealt ${Math.round(dealt)}`);
  ok('boss left at 75% after the explosion', Math.abs(t.hp / HP - 0.75) < 1e-6, `hp% ${(100 * t.hp / HP).toFixed(2)}`);
  ok('explosion attributed to the placer (Xenomorph)', st.effects.some((e) => e.kind === 'dot' && e.source === 'Xenomorph' && e.amount > 0)); }

console.log(`\n══ POISON OWNERSHIP TESTS ══  ${pass} passed, ${fail} failed`);
for (const f of failures) console.log('   ❌ ' + f);
console.log('\nQA_JSON ' + JSON.stringify({ rung: 'poison-ownership', pass: fail === 0 ? 1 : 0, tests: pass + fail, fail }));
process.exit(fail ? 1 : 0);
