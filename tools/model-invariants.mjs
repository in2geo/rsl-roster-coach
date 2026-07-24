// tools/model-invariants.mjs — MODEL QA · behavioural invariants (property-based, protocol layer 5).
//
// Some statements must hold after ANY recipe executes, whatever the inputs. We generate many randomised
// scenarios from a SEEDED PRNG (so any failure reproduces exactly) and assert the STATE-LEVEL invariants
// that are LOCAL to the interpreter (a piece). Outcome-level invariants that need a finished battle wait
// for the Simulator. A violation is a spec violation → blocks. No DB. Run: node tools/model-invariants.mjs

import { makeCombatant, makeState, makeRng } from '../lib/sim/engine.js';
import { applyRecipe } from '../lib/sim/interpreter.js';
import { RECIPES } from '../lib/sim/recipes.js';

const AFF = ['Magic', 'Spirit', 'Force', 'Void'];
const DEBUFF_TYPES = ['Decrease Speed', 'Decrease Defense', 'Poison', 'Decrease Attack', 'Enfeeble', 'Decrease ACC', 'HP Burn'];
const ACTIVE = Object.values(RECIPES).filter(r => r.type === 'active' && (r.actions || []).length);
const N = 800;

// deterministic random combatant from a stream
function mob(rng, side) {
  const r = (a, b) => a + Math.floor(rng() * (b - a));
  const c = makeCombatant({
    name: `${side[0]}${r(1, 999)}`, side,
    maxHp: r(10000, 30000), atk: r(500, 3000), def: r(400, 2200), spd: r(90, 210),
    acc: r(0, 220), res: r(0, 220), critRate: r(0, 100), critDmg: r(50, 200), affinity: AFF[r(0, 4)],
  });
  c.hp = Math.floor(c.maxHp * (0.2 + rng() * 0.8));   // random current HP (tests HEAL cap toward max)
  if (side === 'enemy' && rng() < 0.35) c.immune = [DEBUFF_TYPES[r(0, DEBUFF_TYPES.length)]];   // random immunity
  return c;
}
function scenario(seed) {
  const rng = makeRng(seed);
  const allies = Array.from({ length: 1 + Math.floor(rng() * 3) }, () => mob(rng, 'ally'));
  const enemies = Array.from({ length: 2 + Math.floor(rng() * 3) }, () => mob(rng, 'enemy'));
  // give some existing buffs/debuffs so duration/steal/extend paths are exercised
  for (const c of [...allies, ...enemies]) if (rng() < 0.4) c.buffs.push({ type: 'Increase DEF', value: 60, turnsLeft: 1 + Math.floor(rng() * 2) });
  const actor = allies[Math.floor(rng() * allies.length)];
  const recipe = ACTIVE[Math.floor(rng() * ACTIVE.length)];
  return { allies, enemies, actor, recipe, seed };
}

const fails = [];
const viol = (seed, msg) => fails.push(`seed ${seed}: ${msg}`);
const shieldPool = (c) => c.buffs.reduce((s, b) => s + (/Shield/.test(b.type) ? Math.max(0, b.value || 0) : 0), 0);

for (let seed = 1; seed <= N; seed++) {
  const sc = scenario(seed);
  const st = makeState({ allies: sc.allies, enemies: sc.enemies, seed });
  try { applyRecipe(st, sc.actor, sc.recipe); }
  catch (e) { viol(seed, `applyRecipe THREW on ${sc.recipe.slot}: ${e.message}`); continue; }

  for (const c of [...sc.allies, ...sc.enemies]) {
    if (c.hp > c.maxHp + 1e-6) viol(seed, `HP ${Math.round(c.hp)} > MAX ${c.maxHp} on ${c.name}`);
    for (const b of c.buffs) { if (/Shield/.test(b.type) && (b.value ?? 0) < 0) viol(seed, `negative shield ${b.value} on ${c.name}`); if ((b.turnsLeft ?? 1) < 1) viol(seed, `buff ${b.type} turnsLeft<1 on ${c.name}`); }
    for (const d of c.debuffs) { if ((d.turnsLeft ?? 1) < 1) viol(seed, `debuff ${d.type} turnsLeft<1 on ${c.name}`); }
    if (c.immune) for (const d of c.debuffs) if (c.immune.includes(d.type)) viol(seed, `IMMUNE ${c.name} got [${d.type}] it is immune to`);
  }
  for (const e of st.effects || []) if (e.kind === 'damage' && (e.amount ?? 0) < 0) viol(seed, `negative damage ${e.amount} → ${e.target}`);
  void shieldPool;
}

// ── determinism: same seed → identical result (allies' HP + total debuff/buff counts) ──
function fingerprint(seed) {
  const sc = scenario(seed);
  const st = makeState({ allies: sc.allies, enemies: sc.enemies, seed });
  applyRecipe(st, sc.actor, sc.recipe);
  return [...sc.allies, ...sc.enemies].map(c => `${Math.round(c.hp)}:${c.buffs.length}:${c.debuffs.length}`).join('|');
}
let detChecked = 0;
for (let seed = 1; seed <= N; seed += 40) { detChecked++; if (fingerprint(seed) !== fingerprint(seed)) viol(seed, 'NON-DETERMINISTIC — same seed produced different results'); }

const pass = fails.length === 0;
console.log(`\n══ MODEL INVARIANTS (layer 5) ══  ${N} randomised scenarios + ${detChecked} determinism checks — ${pass ? 'all invariants hold' : fails.length + ' VIOLATIONS'}\n`);
for (const f of fails.slice(0, 20)) console.log('  ✗ ' + f);
if (fails.length > 20) console.log(`  … +${fails.length - 20} more`);
if (pass) console.log('  ✓ HP≤max · immune never debuffed · durations≥1 · no negative damage/shields · deterministic · never throws');
console.log('\nQA_JSON ' + JSON.stringify({ rung: 'model-invariants', pass: pass ? N : N - fails.length, fail: fails.length, scenarios: N, failures: fails.slice(0, 40) }));
process.exit(pass ? 0 : 1);
