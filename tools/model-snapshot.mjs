// tools/model-snapshot.mjs — MODEL QA · regression snapshot (characterization / golden-master).
//
// The blind spot the other rungs leave: an UNINTENDED behaviour change — a refactor that shifts a damage
// number, drops a buff, or reorders an effect — is not "wrong vs the game" (that's Simulator-side) and not
// caught by a spec assertion that still passes. This rung pins the Model's OWN current deterministic output
// (fixed scenarios, seed=null → v0, bit-reproducible), freezes fingerprints in test/snapshots/, and DIFFs on
// every run. A drift is an unacknowledged regression → BLOCKS until a human re-blesses (SNAPSHOT_BLESS=1).
// No DB. Run: node tools/model-snapshot.mjs   ·   re-bless: SNAPSHOT_BLESS=1 node tools/model-snapshot.mjs

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { makeCombatant, makeState } from '../lib/sim/engine.js';
import { applyRecipe, fireTriggers, incomingDamage } from '../lib/sim/interpreter.js';
import { RECIPES } from '../lib/sim/recipes.js';
import { applyBattleLayers } from '../lib/sim/dragon-fixture.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIR = path.join(__dirname, '..', 'test', 'snapshots');
const FILE = path.join(DIR, 'model-snapshot.json');

// a FIXED deterministic scene (rebuilt fresh each time, since applyRecipe mutates)
function scene() {
  const actor = makeCombatant({ name: 'Actor', side: 'ally', atk: 2000, maxHp: 24000, def: 1200, spd: 150, acc: 100, res: 60, critRate: 25, critDmg: 60, affinity: 'Void' });
  const allies = [actor,
    makeCombatant({ name: 'AllyB', side: 'ally', maxHp: 20000, def: 1100, affinity: 'Void' }),
    makeCombatant({ name: 'AllyC', side: 'ally', maxHp: 18000, def: 1000, affinity: 'Void' })];
  allies[1].hp = 12000; allies[2].hp = 6000;   // give heal/lowest-HP paths something to do
  const enemies = [
    makeCombatant({ name: 'E1', side: 'enemy', maxHp: 50000, def: 1000, res: 80, affinity: 'Void' }),
    makeCombatant({ name: 'E2', side: 'enemy', maxHp: 50000, def: 1500, res: 80, affinity: 'Void' }),
    makeCombatant({ name: 'E3', side: 'enemy', maxHp: 50000, def: 1000, res: 200, affinity: 'Void' })];
  for (const e of enemies) e.debuffs.push({ type: 'Poison', pct: 0.05, turnsLeft: 2 }, { type: 'Weaken', turnsLeft: 2 });   // ≥2 debuffs → Bambus A1 AoE branch
  return { actor, allies, enemies, state: makeState({ allies, enemies, seed: null }) };
}
const num = (n) => Math.round(n);
const fpCombatants = (arr) => arr.map(c => `${c.name}:hp${num(c.hp)}:b[${c.buffs.map(b => b.type).sort().join(',')}]:d[${c.debuffs.map(d => d.type).sort().join(',')}]`).join(';');

// fingerprint one recipe: its effect ledger (kind:subtype:target:amount) + resulting combatant state
function fpRecipe(key) {
  const s = scene();
  applyRecipe(s.state, s.actor, RECIPES[key]);
  const fx = (s.state.effects || []).map(e => `${e.kind}${e.subtype ? ':' + e.subtype : ''}→${e.target}=${num(e.amount || 0)}`).sort().join('|');
  return `FX{${fx}} ALLIES{${fpCombatants(s.allies)}} ENEMIES{${fpCombatants(s.enemies)}}`;
}

// build the current fingerprint map
const current = {};
for (const key of Object.keys(RECIPES).filter(k => (RECIPES[k].actions || []).length)) current[key] = fpRecipe(key);
// passives (triggers + modifiers) pinned with fixed events
{ const v = makeCombatant({ name: 'V', side: 'ally', maxHp: 16000 }); fireTriggers(makeState({ allies: [v], enemies: [], seed: null }), v, 'hit_taken', { hitAmount: 2500 });
  current['VERGIS-PASSIVE:hit_taken'] = `shield=${num(v.buffs.find(b => b.type === 'Shield')?.value ?? 0)}`; }
{ const tag = makeCombatant({ name: 'T', side: 'ally', maxHp: 24000 }); const a = makeCombatant({ name: 'A', side: 'ally', maxHp: 20000 }); a.hp = 8000;
  current['TAGOAR-A4:modifier'] = `incoming=${num(incomingDamage(makeState({ allies: [tag, a], enemies: [], seed: null }), a, 1000))}`; }
{ const pel = makeCombatant({ name: 'P', side: 'ally', maxHp: 28000 }); const a = makeCombatant({ name: 'A', side: 'ally', maxHp: 20000 });
  current['PELOPS-A3:modifier'] = `incoming=${num(incomingDamage(makeState({ allies: [pel, a], enemies: [], seed: null }), a, 1000))}`; }
// FIXTURE BUILDER (P2b) — aura SPD + arena HP/ATK/DEF scaling of BASE stats. Pins lib/sim/dragon-fixture.js
// so a drift in applyBattleLayers (aura/arena constant or formula) is caught NO-DB, giving the teeth harness
// a killer for the fixture builder (model-golden covers it only with DB). Deterministic synthetic team.
{ const team = [makeCombatant({ name: 'F1', side: 'ally', spd: 210, maxHp: 30000, atk: 3000, def: 2000 }),
                makeCombatant({ name: 'F2', side: 'ally', spd: 165, maxHp: 25000, atk: 2500, def: 1800 })];
  team[0].baseSpd = 105; team[0].baseHp = 20000; team[0].baseAtk = 2000; team[0].baseDef = 1500;
  team[1].baseSpd = 96;  team[1].baseHp = 18000; team[1].baseAtk = 1800; team[1].baseDef = 1300;
  applyBattleLayers(team);
  current['FIXTURE-LAYERS:aura+arena'] = team.map(a => `${a.name}:spd${num(a.spd)}:hp${num(a.maxHp)}:atk${num(a.atk)}:def${num(a.def)}`).join(';'); }

const bless = process.env.SNAPSHOT_BLESS === '1';
const exists = fs.existsSync(FILE);
if (!exists || bless) {
  fs.mkdirSync(DIR, { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(current, null, 1));
  console.log(`\n══ MODEL SNAPSHOT (regression) ══  ${exists ? 're-blessed' : 'baseline CREATED'} — ${Object.keys(current).length} fingerprints frozen (${path.relative(process.cwd(), FILE)})\n`);
  console.log('QA_JSON ' + JSON.stringify({ rung: 'model-snapshot', pass: Object.keys(current).length, fail: 0, blessed: true }));
  process.exit(0);
}

const baseline = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const drifts = [];
for (const k of new Set([...Object.keys(baseline), ...Object.keys(current)])) {
  if (baseline[k] !== current[k]) drifts.push(k + (baseline[k] == null ? ' (new)' : current[k] == null ? ' (removed)' : ' (changed)'));
}
console.log(`\n══ MODEL SNAPSHOT (regression) ══  ${drifts.length ? '⚠ ' + drifts.length + ' DRIFT(S) vs baseline' : 'no drift — matches baseline'}\n`);
for (const d of drifts.slice(0, 20)) console.log('  ✗ ' + d);
if (drifts.length) console.log('\n  A drift is an UNACKNOWLEDGED behaviour change. If intended, re-bless: SNAPSHOT_BLESS=1 node tools/model-snapshot.mjs');
console.log('\nQA_JSON ' + JSON.stringify({ rung: 'model-snapshot', pass: drifts.length ? 0 : 1, fail: drifts.length, drifts: drifts.slice(0, 40) }));
process.exit(drifts.length ? 1 : 0);
