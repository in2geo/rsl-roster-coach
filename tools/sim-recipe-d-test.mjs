// tools/sim-recipe-d-test.mjs — MODEL QA · toy battles for II-D reactive passives + damage modifiers +
// EXTEND_EFFECT. These were verified once in throwaway inline runs; this commits them as a durable rung so
// the teeth check (model-mutants) can see them and they cannot silently break. No DB. Deterministic.
// Run: node tools/sim-recipe-d-test.mjs
import { makeCombatant, makeState, setChanceMode, chooseAllyTarget } from '../lib/sim/engine.js';
import { applyRecipe, fireTriggers, incomingDamage, passiveImmunities } from '../lib/sim/interpreter.js';
import { RECIPES } from '../lib/sim/recipes.js';

let pass = 0, fail = 0;
const check = (n, c, d = '') => { c ? pass++ : fail++; console.log(`  ${c ? 'PASS' : 'FAIL'}  ${n}${d ? ' — ' + d : ''}`); };
const V = () => makeCombatant({ name: 'Vergis', side: 'ally', maxHp: 16000, affinity: 'Void' });

console.log('\n=== II-D reactive passives + damage modifiers + EXTEND_EFFECT (toy battles) ===\n');

// ── Second Wind (event triggers) ──
{ const v = V(); fireTriggers(makeState({ allies: [v], enemies: [], seed: null }), v, 'hit_taken', { hitAmount: 2000 });
  const sh = v.buffs.find(b => b.type === 'Shield'); check('Second Wind: hit ≥10% MAX HP → [Shield] = 10% MAX HP (1600)', sh && sh.value === 1600, `shield ${sh?.value}`); }
{ const v = V(); fireTriggers(makeState({ allies: [v], enemies: [], seed: null }), v, 'hit_taken', { hitAmount: 1000 });
  check('Second Wind: hit <10% MAX HP → no shield', !v.buffs.some(b => b.type === 'Shield')); }
{ const v = V(); v.hp = 7000; fireTriggers(makeState({ allies: [v], enemies: [], seed: null }), v, 'hp_below', {});
  check('Second Wind: HP <50% → 15% [Continuous Heal]', v.buffs.some(b => b.type === 'Continuous Heal' && b.value === 15)); }
{ const v = V(); v.hp = 9000; fireTriggers(makeState({ allies: [v], enemies: [], seed: null }), v, 'hp_below', {});
  check('Second Wind: HP ≥50% → no continuous heal', !v.buffs.some(b => b.type === 'Continuous Heal')); }

// ── Ezio Perfect Veil (round_start trigger → untargetable) ──
{ const ez = makeCombatant({ name: 'Ezio', side: 'ally', maxHp: 16000 }); ez.hp = 2000;   // LOWEST HP% — would be the pick without a veil
  const ally = makeCombatant({ name: 'A', side: 'ally', maxHp: 20000 }); ally.hp = 10000;
  fireTriggers(makeState({ allies: [ez, ally], enemies: [], seed: null }), ez, 'round_start', {});
  const veiled = ez.buffs.some(b => b.type === 'Perfect Veil');
  const target = chooseAllyTarget([ez, ally]);   // single-target enemy pick MUST skip the veiled Ezio
  check('Ezio Perfect Veil: round_start places it AND single-target skips the veiled (lowest-HP) Ezio', veiled && target?.name === 'A', `veiled=${veiled} target=${target?.name}`); }

// ── Pelops passive immunities ([Stun]/[HP Burn]/[Petrification]) ──
{ const hpBurn = { slot: 'X', actions: [{ seq: 10, op: 'ACQUIRE_TARGETS', target: 'single' }, { seq: 20, op: 'PLACE_DEBUFF', target: 'intended_set', effect: { type: 'HP Burn', duration: 2, chance: 1.0, accuracy_check: false } }] };
  const foe = () => makeCombatant({ name: 'Foe', side: 'enemy', acc: 300, affinity: 'Void' });
  const pel = makeCombatant({ name: 'Pelops', side: 'ally', maxHp: 28000, res: 0, affinity: 'Void' }); pel.immune = passiveImmunities('Pelops');
  applyRecipe(makeState({ allies: [pel], enemies: [foe()], seed: null }), foe(), hpBurn);
  const ally = makeCombatant({ name: 'A', side: 'ally', maxHp: 20000, res: 0, affinity: 'Void' });   // control — not immune
  applyRecipe(makeState({ allies: [ally], enemies: [foe()], seed: null }), foe(), hpBurn);
  check('Pelops passive: immune to [HP Burn] (control ally gets it)', !pel.debuffs.some(d => d.type === 'HP Burn') && ally.debuffs.some(d => d.type === 'HP Burn'), `pelops=${pel.debuffs.length} ally=${ally.debuffs.length}`); }

// ── incoming-damage MODIFIERS ──
const modScene = (owners, target) => { const st = makeState({ allies: [...owners, target], enemies: [], seed: null }); return st; };
{ const tag = makeCombatant({ name: 'Tagoar', side: 'ally', maxHp: 24000 }); const a = makeCombatant({ name: 'A', side: 'ally', maxHp: 20000 }); a.hp = 8000;   // 40%
  check('Aid the Feeble: ally ≤50% HP → 1000 → 900', incomingDamage(modScene([tag], a), a, 1000) === 900); }
{ const tag = makeCombatant({ name: 'Tagoar', side: 'ally', maxHp: 24000 }); const a = makeCombatant({ name: 'A', side: 'ally', maxHp: 20000 }); a.hp = 14000; // 70%
  check('Aid the Feeble: ally >50% HP → 1000 unchanged', incomingDamage(modScene([tag], a), a, 1000) === 1000); }
{ const pel = makeCombatant({ name: 'Pelops', side: 'ally', maxHp: 28000 }); const a = makeCombatant({ name: 'A', side: 'ally', maxHp: 20000 });
  check('Pelops −20%: full-HP ally → 1000 → 800', incomingDamage(modScene([pel], a), a, 1000) === 800); }
{ const pel = makeCombatant({ name: 'Pelops', side: 'ally', maxHp: 28000 }); pel.debuffs.push({ type: 'Decrease Defense', turnsLeft: 2 }); const a = makeCombatant({ name: 'A', side: 'ally', maxHp: 20000 });
  check('Pelops −20% OFF while he is under [Decrease DEF] → 1000 unchanged', incomingDamage(modScene([pel], a), a, 1000) === 1000); }
{ const tag = makeCombatant({ name: 'Tagoar', side: 'ally', maxHp: 24000 }); const pel = makeCombatant({ name: 'Pelops', side: 'ally', maxHp: 28000 }); const a = makeCombatant({ name: 'A', side: 'ally', maxHp: 20000 }); a.hp = 8000;
  check('stacked (Aid the Feeble × Pelops): 1000 → 720', Math.round(incomingDamage(modScene([tag, pel], a), a, 1000)) === 720); }
// Ezio 35% nullify of a >50%-MAX-HP hit — needs the chance to fire; assert under all-land, then restore.
{ setChanceMode('all'); const ez = makeCombatant({ name: 'Ezio', side: 'ally', maxHp: 16000 });
  const nulled = incomingDamage(makeState({ allies: [ez], enemies: [], seed: null }), ez, 9000) === 0;      // 9000 > 50% of 16000
  const small = incomingDamage(makeState({ allies: [ez], enemies: [], seed: null }), ez, 5000) === 5000;    // < 50% → never
  setChanceMode('threshold');
  check('Ezio nullify: >50%-MAX-HP hit → 0 (all-land); small hit unchanged', nulled && small); }

// ── EXTEND_EFFECT (Bambus A2 extends all ally buff durations +1) ──
{ const bambus = makeCombatant({ name: 'Bambus', side: 'ally', atk: 844, maxHp: 26457, affinity: 'Void' });
  const ally = makeCombatant({ name: 'A', side: 'ally', maxHp: 20000, affinity: 'Void' }); ally.buffs.push({ type: 'Increase DEF', value: 60, turnsLeft: 2 });
  const enemy = makeCombatant({ name: 'Mob', side: 'enemy', maxHp: 1e9, def: 1000, affinity: 'Void' });
  applyRecipe(makeState({ allies: [bambus, ally], enemies: [enemy], seed: null }), bambus, RECIPES['BAMBUS-A2']);
  const idef = ally.buffs.find(b => b.type === 'Increase DEF');
  check('EXTEND_EFFECT: a pre-existing 2-turn buff becomes 3 after Bambus A2', idef && idef.turnsLeft === 3, `turnsLeft ${idef?.turnsLeft}`); }

console.log(`\n=== ${pass} passed, ${fail} failed ===\n`);
process.exit(fail ? 1 : 0);
