// tools/sim-recipe-test.mjs — Milestone 0, Step 3 proof: run the recipe INTERPRETER in isolation.
//
// The doc's "isolated skill tests": build a tiny controlled state and execute each champion's damage
// recipe from DATA, asserting the tricky behaviours resolve. Deterministic (seed=null) so numbers are
// stable and checkable. Attackers are affinity Void (neutral) to keep magnitudes clean — affinity itself
// is exercised in the full fight (Step 4). Run: node tools/sim-recipe-test.mjs
import { makeCombatant, makeState } from '../lib/sim/engine.js';
import { applyRecipe, recipeFor } from '../lib/sim/interpreter.js';
import { RECIPES } from '../lib/sim/recipes.js';

let pass = 0, fail = 0;
const check = (name, cond, detail = '') => { (cond ? pass++ : fail++); console.log(`  ${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`); };

// build a fresh {attacker, enemies, state}. `enemyDebuffs` seeds debuffs on every enemy.
function scene({ atk = 0, hp = 0, def = 0, nEnemies = 3, enemyDef = 1000, enemyDebuffs = 0 } = {}) {
  const attacker = makeCombatant({ name: 'Hero', side: 'ally', atk, maxHp: hp, def, spd: 100, affinity: 'Void', critRate: 0, critDmg: 0 });
  const enemies = Array.from({ length: nEnemies }, (_, i) => {
    const e = makeCombatant({ name: `Mob${i + 1}`, side: 'enemy', maxHp: 100000, def: enemyDef, spd: 90, affinity: 'Void' });
    for (let d = 0; d < enemyDebuffs; d++) e.debuffs.push({ type: `Dbf${d}`, turnsLeft: 2 });
    return e;
  });
  return { attacker, enemies, state: makeState({ allies: [attacker], enemies, seed: null }) };
}
// run a named champion's slot by borrowing their recipe onto our controlled attacker
function run(state, attacker, champFirst, slot) {
  attacker.name = champFirst;                 // recipeFor keys off the first name
  const r = recipeFor(attacker, slot);
  if (!r) { console.log(`  (no recipe ${champFirst}-${slot})`); return []; }
  return applyRecipe(state, attacker, r);
}

console.log('\n=== Recipe interpreter — isolated damage tests ===\n');

// 1 + 2 — Bambus A1 conditional AoE (the pilot's hard case)
{
  const a = scene({ atk: 3000, enemyDebuffs: 0 });
  const res = run(a.state, a.attacker, 'Bambus', 'A1');
  check('Bambus A1 — target has 0 debuffs → single target', res.length === 1, `${res.length} hit(s)`);
}
{
  const a = scene({ atk: 3000, enemyDebuffs: 2 });
  const res = run(a.state, a.attacker, 'Bambus', 'A1');
  check('Bambus A1 — target has ≥2 debuffs → AoE (all enemies)', res.length === 3, `${res.length} hit(s)`);
}

// 3 — Tagoar A1 multi-hit (hits 1 enemy 2×)
{
  const a = scene({ atk: 3000 });
  const res = run(a.state, a.attacker, 'Tagoar', 'A1');
  const oneTarget = new Set(res.map(r => r.target)).size === 1;
  check('Tagoar A1 — single enemy, 2 hits', res.length === 2 && oneTarget, `${res.length} hits on ${new Set(res.map(r=>r.target)).size} target`);
}

// 4 — Pelops A1 scales off HP (not ATK): atk=0 but hp set → damage must be > 0
{
  const a = scene({ atk: 0, hp: 28000 });
  const res = run(a.state, a.attacker, 'Pelops', 'A1');
  check('Pelops A1 — scales off HP (atk=0, hp=28k → damage lands)', res[0]?.hp_damage > 0, `hp_damage=${res[0]?.hp_damage}`);
}

// 5 — Vergis A1 scales off DEF (not ATK): atk=0 but def set → damage must be > 0
{
  const a = scene({ atk: 0, def: 1500 });
  const res = run(a.state, a.attacker, 'Vergis', 'A1');
  check('Vergis A1 — scales off DEF (atk=0, def=1500 → damage lands)', res[0]?.hp_damage > 0, `hp_damage=${res[0]?.hp_damage}`);
}

// 6 — Ezio A3 ignores 35% DEF → more damage than A1 would land per unit (higher mult + def ignore)
{
  const hi = scene({ atk: 3000, enemyDef: 3000 });
  const a1 = run(hi.state, hi.attacker, 'Ezio', 'A1')[0];
  const hi2 = scene({ atk: 3000, enemyDef: 3000 });
  const a3 = run(hi2.state, hi2.attacker, 'Ezio', 'A3')[0];
  check('Ezio A3 — ignore-35%-DEF flag raises landed damage vs A1', a3.hp_damage > a1.hp_damage, `A1=${a1.hp_damage} A3=${a3.hp_damage}`);
}

// show one full structured resolution (the "does the target take the hit?" object)
{
  const a = scene({ atk: 3000, enemyDebuffs: 2 });
  const res = run(a.state, a.attacker, 'Bambus', 'A1');
  console.log('\n  sample structured resolution (Bambus A1, AoE branch):');
  console.log('   ', JSON.stringify(res[0]));
  console.log('    flags on state:', [...a.state.flags].length ? [...a.state.flags] : '(none)');
}

// 8 — EXACT damage incl. CRIT (pins the full damage math no-DB): 3.8×ATK × crit-EV × DEF-mit, to the unit
{
  const atk = makeCombatant({ name: 'Hero', side: 'ally', atk: 3000, affinity: 'Void', critRate: 50, critDmg: 100 });
  const t = makeCombatant({ name: 'Mob', side: 'enemy', maxHp: 1e9, def: 1000, affinity: 'Void' });
  const st = makeState({ allies: [atk], enemies: [t], seed: null });
  const r = applyRecipe(st, atk, RECIPES['BAMBUS-A1']);   // 3.8×ATK; crit EV = 1 + 0.50×1.00 = 1.5; DEF-mit = 1500/2500 = 0.6
  // 3.8 × 3000 × 1.5 × 0.6 = 10,260
  check('exact damage incl crit — 3.8×3000 × crit1.5 × defMit0.6 = 10,260', r[0]?.raw_damage === 10260, `raw ${r[0]?.raw_damage}`);
}

console.log(`\n=== ${pass} passed, ${fail} failed ===\n`);
process.exit(fail ? 1 : 0);
