// tools/model-petrification-test.mjs — MODEL QA · regression rung for [Petrification] turn-skip behavior.
// Guards the wave-2 survival fix: a reactive 1-turn [Petrification] (Pelops's on-attacked passive lands it on
// the attacking mob mid-turn) must survive the placement turn's end-expiration and cause exactly ONE skip at
// the mob's NEXT turn. Before the fix the fresh 1-turn petrif was ticked 1→0 the same turn and removed, so it
// landed but skipped nothing (0 mob turns lost). Deterministic, no DB.  Run: node tools/model-petrification-test.mjs
//
// Required behavior (per spec):
//   petrified unit reaches its turn → performs no skill/attack → the turn still occurs → turn-based effects and
//   cooldown/duration rules resolve → [Petrification] duration is processed → scheduler proceeds to next unit.
import { makeCombatant, makeState, setChanceMode, simulate } from '../lib/sim/engine.js';
import { installRecipeRun, fireDamageReactions } from '../lib/sim/interpreter.js';

let pass = 0, fail = 0;
const check = (n, c, d = '') => { c ? pass++ : fail++; console.log(`  ${c ? 'PASS' : 'FAIL'}  ${n}${d ? ' — ' + d : ''}`); };

// ── controlled harness ──────────────────────────────────────────────────────
// A tanky do-nothing ally (no skills → passes its turn) keeps the battle alive to turnCap without killing the
// enemies. Enemies act via a per-phase spy that RECORDS each action, so a skipped turn = no spy entry.
const dummyAlly = (name = 'Hero') => makeCombatant({ name, side: 'ally', maxHp: 1e9, atk: 0, spd: 100, affinity: 'Void' });
const mob = (name, extra = {}) => Object.assign(makeCombatant({ name, side: 'enemy', maxHp: 1e8, atk: 100, def: 0, spd: 100, affinity: 'Void' }), extra);
const petrif = (turnsLeft = 1, placedTurn = -999) => ({ type: 'Petrification', turnsLeft, stacks: 1, placedTurn });

function run({ allies, phases, turnCap = 16, useRecipes = false, chance = null }) {
  if (chance) setChanceMode(chance);
  const st = makeState({ allies, enemies: [], seed: null });
  st.effects = [];
  const turns = {}, acts = {};
  if (useRecipes) installRecipeRun(st);
  const prev = st.onTurnStart;
  st.onTurnStart = (state, a) => { prev?.(state, a); turns[a.name] = (turns[a.name] || 0) + 1; };
  const res = simulate(st, { name: 'test', phases, onDamageToBoss: null }, { turnCap });
  if (chance) setChanceMode('threshold');
  const cc = (name, phaseRe = /./) => st.effects.filter(e => e.kind === 'cc' && /Petrif/.test(String(e.subtype)) && String(e.target) === name && phaseRe.test(String(e.phase))).length;
  return { st, res, turns, acts, cc };
}
// spy that records every actual enemy action into `acts`
const spy = (acts) => (state, e) => { acts[e.name] = (acts[e.name] || 0) + 1; };

console.log('\n=== [Petrification] turn-skip regression (7 behaviors) ===\n');

// 1 + 2 + 4 + 5 — one petrified mob: no action, but the turn still occurs, no AI selection, TM resets so the
// pack keeps cycling. Petrif 1t (already "lived", placedTurn old) → skips its very next turn.
{
  const acts = {}; const E = mob('Mob'); E.debuffs.push(petrif(1));
  const r = run({ allies: [dummyAlly()], phases: [{ name: 'wave 1', enemies: [E], actEnemy: spy(acts) }], turnCap: 16 });
  const eTurns = r.turns['Mob'] || 0, eActs = acts['Mob'] || 0, skips = r.cc('Mob');
  check('(1) petrified mob takes NO action on the skipped turn', skips >= 1 && eActs === eTurns - skips, `turns ${eTurns}, acts ${eActs}, skips ${skips}`);
  check('(2) the skipped action STILL counts as a turn', eTurns === eActs + skips && skips >= 1, `counted turns ${eTurns} = acts ${eActs} + skips ${skips}`);
  check('(4) NO AI/skill selection during the skipped turn (spy never called that turn)', eActs === eTurns - skips, `acts ${eActs} vs non-skip turns ${eTurns - skips}`);
  check('(5) Turn Meter resets normally — the pack keeps cycling after a skip', (r.turns['Hero'] || 0) >= 2 && eTurns >= 2, `Hero turns ${r.turns['Hero']}, Mob turns ${eTurns}`);
}

// 3 — expires at the correct time: a 1-turn petrif causes EXACTLY ONE skip, then the mob acts again.
{
  const acts = {}; const E = mob('Mob'); E.debuffs.push(petrif(1));
  const r = run({ allies: [dummyAlly()], phases: [{ name: 'wave 1', enemies: [E], actEnemy: spy(acts) }], turnCap: 16 });
  check('(3a) 1-turn petrif → exactly ONE skip, then the mob acts', r.cc('Mob') === 1 && (acts['Mob'] || 0) >= 1 && !E.debuffs.some(d => d.type === 'Petrification'),
    `skips ${r.cc('Mob')}, acts ${acts['Mob']}, petrif remaining ${E.debuffs.some(d => d.type === 'Petrification')}`);
}

// 3b — THE FIX: a reactive petrif (Pelops on-attacked, lands on the attacker MID-TURN) must survive the
// placement turn and skip the NEXT. Enemy "attacks" Pelops each turn via the real reaction path; CHANCE_MODE
// 'all' forces the 50% petrif to land. Without the placed-this-turn guard this is 0 skips (the bug).
{
  const pelops = makeCombatant({ name: 'Pelops the Victor', side: 'ally', maxHp: 1e9, atk: 0, spd: 100, affinity: 'Void' });
  const E = mob('Mob');
  const attackPelops = (state, e) => { const p = state.allies.find(a => /Pelops/.test(a.name) && a.alive); if (p) fireDamageReactions(state, p, e, 100); };
  const r = run({ allies: [pelops], phases: [{ name: 'wave 1', enemies: [E], actEnemy: attackPelops }], turnCap: 16, useRecipes: true, chance: 'all' });
  check('(3b) reactive petrif SURVIVES its placement turn → skips the next (the fix)', r.cc('Mob') >= 1, `reactive skips ${r.cc('Mob')} (0 = bug: expired same turn)`);
}

// 6 — multiple petrified mobs each lose their OWN turn (independent debuffs).
{
  const acts = {}; const A = mob('MobA', { spd: 100 }), B = mob('MobB', { spd: 100 });
  A.debuffs.push(petrif(1)); B.debuffs.push(petrif(1));
  const r = run({ allies: [dummyAlly()], phases: [{ name: 'wave 1', enemies: [A, B], actEnemy: spy(acts) }], turnCap: 16 });
  check('(6) two petrified mobs each lose exactly one of their own turns', r.cc('MobA') === 1 && r.cc('MobB') === 1, `A skips ${r.cc('MobA')}, B skips ${r.cc('MobB')}`);
}

// 7 — correct across a wave transition: wave 1 clears (its enemy starts dead), wave 2's petrified mob still
// skips in the new phase. Guards that CURRENT_TURN / placedTurn stay consistent across phases.
{
  const acts = {}; const dead = mob('W1'); dead.alive = false; dead.hp = 0;
  const E = mob('W2mob'); E.debuffs.push(petrif(1));
  const r = run({ allies: [dummyAlly()], phases: [
    { name: 'wave 1', enemies: [dead], actEnemy: spy(acts) },
    { name: 'wave 2', enemies: [E], actEnemy: spy(acts) },
  ], turnCap: 20 });
  check('(7) petrification skip works after a wave transition', r.cc('W2mob', /wave 2/) === 1, `wave-2 skips ${r.cc('W2mob', /wave 2/)}`);
}

console.log(`\n  ${fail === 0 ? '✅' : '❌'} petrification regression: ${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
