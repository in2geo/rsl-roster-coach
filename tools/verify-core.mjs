// tools/verify-core.mjs — shared core for the turn-by-turn OUTCOME VERIFIER.
// Used by the CLI (tools/turn-verify.mjs, one battle + per-turn ledger) and the QA rung
// (tools/model-turn-verify.mjs, many seeds, pass/fail). Keeps the contract logic in ONE place.
import { makeState, simulate, CC_SKIPS_TURN, setChanceMode } from '../lib/sim/engine.js';
import { buildDragonBattle, applyBattleLayers } from '../lib/sim/dragon-fixture.js';
import { installRecipeRun } from '../lib/sim/interpreter.js';

// DOWNSTREAM CONTRACT per placeable effect: what OBSERVABLE proves it did its job.
//   'skip'     — a turn-skipping CC must cause a 'cc' turn-lost event.
//   'tick'     — a DoT must deal damage: a 'dot' tick OR an 'activate'/'detonate' (cashed-in early).
//   'heal'     — [Continuous Heal] must tick a 'heal' at the start of the buffed unit's turns.
//   'reactive'  — [Shield]/[Magma Shield]/[Reflect Damage]/[Ally Protection] must produce an
//                 'absorb'/'reflect'/'redirect' WHEN the buffed unit is hit (opportunity = it took a hit).
//   'targeting' — [Taunt]/[Provoke] must FORCE a mob's single-target pick onto the taunter; [Perfect Veil]/
//                 [Veil] must keep the veiled ally OUT of the pick. Verified from 'target' events.
//   'placed'    — acts through the stat/damage pipeline; placement-confirmed only (NOT outcome-verified yet).
const DOT = ['Poison', 'HP Burn', 'Necrosis', 'Bomb'];
const HEAL = ['Continuous Heal'];
const REACTIVE = ['Shield', 'Magma Shield', 'Reflect Damage', 'Ally Protection'];
const TARGETING = ['Taunt', 'Provoke', 'Perfect Veil', 'Veil'];
export const contractFor = (subtype) =>
  CC_SKIPS_TURN.includes(subtype) ? 'skip' :
  DOT.includes(subtype)          ? 'tick' :
  HEAL.includes(subtype)         ? 'heal' :
  REACTIVE.includes(subtype)     ? 'reactive' :
  TARGETING.includes(subtype)    ? 'targeting' : 'placed';

// Run ONE battle with the verification hooks installed. Returns the raw ledger + turn-order audit + who-acted-when.
export async function runOne({ rest, fixture, repoRoot, seed }) {
  const built = await buildDragonBattle({ rest, fixture, repoRoot });
  if (built.skip) return { skip: built.skip };
  applyBattleLayers(built.allies);
  // VERIFY MODE (seed == null): deterministic + EVERY chance lands (CHANCE_MODE 'all'), crit = expected value.
  // So a mechanic that fails to fire/land/skip is a BUG, never an unlucky roll — the right lens for checking
  // "did the skill fire? target correctly? land? cost a turn?". Pass a numeric seed for a STOCHASTIC run.
  setChanceMode(seed == null ? 'all' : 'threshold');
  const st = makeState({ allies: built.allies, enemies: [], seed }); st.purpleBarLeft = 0; st.effects = [];
  const turnActor = {}, actedAt = {};
  installRecipeRun(st);
  const prev = st.onTurnStart;
  st.onTurnStart = (state, a) => { prev?.(state, a); turnActor[state.turn] = `${a.name}${a.side === 'enemy' ? ' (E)' : ''}`; (actedAt[a.name] ??= []).push(state.turn); };
  const orderViolations = [];
  st.onSchedule = (state, actor, pool) => {              // the acting unit must hold the highest turn meter
    const maxTM = Math.max(...pool.map(c => c.turnMeter));
    if (actor.turnMeter < maxTM - 1e-6) orderViolations.push({ turn: state.turn + 1, picked: actor.name, pickedTM: actor.turnMeter, maxTM, maxUnit: pool.find(c => c.turnMeter === maxTM)?.name });
  };
  const res = simulate(st, built.content, { turnCap: 400 });
  return { fx: res.effects || [], orderViolations, turnActor, actedAt, res };
}

// Score one battle's ledger into per-mechanic outcome rows (death-aware).
export function scoreOutcomes(fx, actedAt) {
  const actedAfter = (name, t) => (actedAt[name] || []).some(x => x > t);
  const placements = {}, conseq = {}, hitAt = {}, attackOpp = {}, firedNotConsumed = [];
  const benign = /resist|overheal|already|missed|MISSING|UNKNOWN|full|no buffs|no skills|proc missed|weak|condition not met|<4 debuffs|no Poison|no cooldowns/i;
  const bump = (m) => { conseq[m] = (conseq[m] ?? 0) + 1; };
  for (const e of fx) {
    if ((e.kind === 'debuff' || e.kind === 'buff') && e.consumed) (placements[e.subtype] ??= []).push({ turn: e.turn, target: e.target, source: e.source });
    // CONSEQUENCE events, keyed by the SUBTYPE they prove did its job:
    if (e.kind === 'cc') bump(e.subtype);                                                     // CC → turn skipped
    else if (e.kind === 'dot') bump(e.subtype);                                               // DoT → natural tick
    else if ((e.kind === 'activate' || e.kind === 'detonate') && e.consumed) bump(e.subtype); // DoT cashed in early (Ezio pops Poison)
    else if (e.kind === 'heal') bump(e.subtype);                                              // [Continuous Heal] → tick
    else if (e.kind === 'absorb' || e.kind === 'reflect' || e.kind === 'redirect') bump(e.subtype); // Shield/Magma/Reflect/Ally-Protection
    else if (e.kind === 'target') { attackOpp[e.subtype] = (attackOpp[e.subtype] ?? 0) + 1; if (e.consumed) bump(e.subtype); } // Taunt/Veil steered the pick
    if (e.kind === 'damage' && e.consumed && (e.amount ?? 0) > 0 && e.target) (hitAt[e.target] ??= []).push(e.turn);
    if (e.fired && e.consumed === false && !benign.test(String(e.note))) firedNotConsumed.push(e);
  }
  const clean = (s) => String(s).replace(/ \(E\)$/, '');
  const hitAfter = (name, t) => (hitAt[name] || []).some(x => x >= t);   // did `name` take a hit at/after t?
  // SELF-APPLIED-CC EXCEPTION (documented): a champion placing a turn-skipping CC on ITSELF is a self-combo it
  // controls, not an obligation to skip. Bambus's [Sleep] is self-applied so his passive can sponge enemy
  // debuffs "while asleep", then his wake removes the Sleep BEFORE it skips — so 0 skips is CORRECT. The
  // "CC → must skip" contract applies ONLY to CC on an OPPONENT / inflicted BY an enemy (source !== target).
  const selfApplied = (p) => p.source != null && p.source === p.target;
  const rows = [];
  for (const m of [...new Set(Object.keys(placements))].sort()) {
    const c = contractFor(m), plist = placements[m], placed = plist.length;
    // OPPORTUNITY — did a placement get the chance to produce its effect?
    //   reactive        → the buffed unit actually took a HIT (else a [Shield] legitimately expires unused).
    //   skip/tick/heal  → the (non-self) target survived to take a later TURN.
    let opps;
    if (c === 'placed') opps = null;
    else if (c === 'targeting') opps = attackOpp[m] ?? 0;                                     // mob single-target picks while buff up
    else if (c === 'reactive') opps = plist.filter(p => hitAfter(clean(p.target), p.turn)).length;
    else opps = plist.filter(p => !selfApplied(p) && actedAfter(clean(p.target), p.turn)).length;
    const selfOnly = (c === 'skip' || c === 'tick') && plist.every(selfApplied);
    const consequence = c === 'placed' ? null : (conseq[m] ?? 0);
    const inert = c !== 'placed' && opps > 0 && consequence === 0;   // had the chance, produced nothing
    rows.push({ mechanic: m, contract: c, placed, opps, consequence, inert, selfOnly });
  }
  return { rows, firedNotConsumed };
}
