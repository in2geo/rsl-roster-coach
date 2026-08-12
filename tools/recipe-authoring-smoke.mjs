// tools/recipe-authoring-smoke.mjs — STEP B.4 (part) of the recipe-authoring loop (see
// knowledge/RECIPE_AUTHORING_RUNBOOK.md). Runs every ACTIVE recipe through the interpreter on a
// synthetic battle and reports any state.flags (unknown op/formula/condition/field) or throws.
// Catches integration mistakes the static validator can't (e.g. a field the handler never reads).
//
// Usage:
//   node tools/recipe-authoring-smoke.mjs                       # smoke ALL active recipes (regression)
//   node tools/recipe-authoring-smoke.mjs "Champ A" "Champ B"   # only these champions (the batch you added)
// Exit code is non-zero if anything is flagged.
import { makeCombatant, makeState } from '../lib/sim/engine.js';
import { applyRecipe, installRecipeRun } from '../lib/sim/interpreter.js';
import { RECIPES } from '../lib/sim/recipes.js';

const filter = process.argv.slice(2);
const want = filter.length ? new Set(filter) : null;
const asArr = (f) => (Array.isArray(f) ? f : [...f]);
const mk = (name, side) => makeCombatant({ name, side, role: side === 'enemy' ? 'boss' : 'champion', atk: 2500, def: 1200, maxHp: 30000, spd: 100, acc: 300, res: 0, critRate: 0, critDmg: 50, affinity: 'Void' });

let ran = 0; const flagged = [];
for (const [key, r] of Object.entries(RECIPES)) {
  if (r.type === 'passive' || !r.actions) continue;
  if (want && !want.has(r.champion)) continue;
  const caster = mk(r.champion, 'ally'); const a1 = mk('Kael', 'ally'); const a2 = mk('Bambus', 'ally');
  const e1 = mk('Boss', 'enemy'); e1.maxHp = 5e8; e1.hp = 5e8; const e2 = mk('Add', 'enemy'); e2.maxHp = 1e6; e2.hp = 1e6;
  a1.hp = 15000; a2.hp = 8000; caster.hp = 12000;   // hurt allies so heal/equalize/swap exercise
  const st = makeState({ allies: [caster, a1, a2], enemies: [e1, e2], seed: 12345 });
  installRecipeRun(st);
  const before = new Set(asArr(st.flags));
  try { applyRecipe(st, caster, r); } catch (err) { flagged.push(`${key}: THREW ${err.message}`); continue; }
  ran++;
  const nf = asArr(st.flags).filter((x) => !before.has(x));
  if (nf.length) flagged.push(`${key}: ${nf.join(' | ')}`);
}

console.log(`smoke-ran ${ran} active recipe(s)${want ? ` for [${[...want].join(', ')}]` : ' (all)'}`);
if (flagged.length) { console.log('\n✗ FLAGGED:'); flagged.forEach((f) => console.log('  ' + f)); process.exit(1); }
console.log('✓ no flags/throws — all recipes execute cleanly');
