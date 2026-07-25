// tools/sim-recipe-d-test.mjs — MODEL QA · toy battles for II-D reactive passives + damage modifiers +
// EXTEND_EFFECT. These were verified once in throwaway inline runs; this commits them as a durable rung so
// the teeth check (model-mutants) can see them and they cannot silently break. No DB. Deterministic.
// Run: node tools/sim-recipe-d-test.mjs
import { makeCombatant, makeState, setChanceMode, chooseAllyTarget, dealDamage } from '../lib/sim/engine.js';
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

// ── Reflect Damage buff (Vergis A1): the attacker takes value% of the damage it inflicted ──
{ const attacker = makeCombatant({ name: 'Mob', side: 'enemy', maxHp: 50000, affinity: 'Void' });
  const target = makeCombatant({ name: 'Vergis', side: 'ally', maxHp: 40000, affinity: 'Void' });
  target.buffs.push({ type: 'Reflect Damage', value: 30, turnsLeft: 2 });
  const before = attacker.hp;
  const dd = dealDamage(target, 10000, 'direct', attacker, null);
  check('Reflect Damage 30%: attacker takes 3000 back off a 10000 hit', before - attacker.hp === 3000 && dd.reflectBuffDmg === 3000, `back=${before - attacker.hp}`); }
{ const attacker = makeCombatant({ name: 'Mob', side: 'enemy', maxHp: 50000, affinity: 'Void' });
  const target = makeCombatant({ name: 'Ally', side: 'ally', maxHp: 40000, affinity: 'Void' });   // no reflect buff
  const before = attacker.hp;
  dealDamage(target, 10000, 'direct', attacker, null);
  check('no [Reflect Damage] → attacker takes nothing back', before - attacker.hp === 0); }

// ── EXTEND_EFFECT (Bambus A2 extends all ally buff durations +1) ──
{ const bambus = makeCombatant({ name: 'Bambus', side: 'ally', atk: 844, maxHp: 26457, affinity: 'Void' });
  const ally = makeCombatant({ name: 'A', side: 'ally', maxHp: 20000, affinity: 'Void' }); ally.buffs.push({ type: 'Increase DEF', value: 60, turnsLeft: 2 });
  const enemy = makeCombatant({ name: 'Mob', side: 'enemy', maxHp: 1e9, def: 1000, affinity: 'Void' });
  applyRecipe(makeState({ allies: [bambus, ally], enemies: [enemy], seed: null }), bambus, RECIPES['BAMBUS-A2']);
  const idef = ally.buffs.find(b => b.type === 'Increase DEF');
  check('EXTEND_EFFECT: a pre-existing 2-turn buff becomes 3 after Bambus A2', idef && idef.turnsLeft === 3, `turnsLeft ${idef?.turnsLeft}`); }

// ── Pelops passive "Master of Games": HP Burn + Petrification on attacker, chance HALVED under [Decrease DEF] ──
// Chances are RNG (100/50, 50/25) → measure land-rate over seeded trials (the caster-conditional chance).
function pelopsOnAttackedRate(debuffType, pelopsUnderDecrDef, n = 4000) {
  let landed = 0;
  for (let s = 1; s <= n; s++) {
    const pel = makeCombatant({ name: 'Pelops', side: 'ally', maxHp: 28000, affinity: 'Void' });
    if (pelopsUnderDecrDef) pel.debuffs.push({ type: 'Decrease Defense', turnsLeft: 2 });
    const mob = makeCombatant({ name: 'Mob', side: 'enemy', maxHp: 50000, res: 0, affinity: 'Void' });
    fireTriggers(makeState({ allies: [pel], enemies: [mob], seed: s }), pel, 'attacked', { attacker: mob });
    if (mob.debuffs.some(d => d.type === debuffType)) landed++;
  }
  return landed / n;
}
{ const r = pelopsOnAttackedRate('HP Burn', false); check('Pelops passive: [HP Burn] on attacker ~100%', r > 0.99, `rate ${r.toFixed(3)}`); }
{ const r = pelopsOnAttackedRate('HP Burn', true);  check('Pelops passive: [HP Burn] drops to ~50% under [Decrease DEF]', r > 0.45 && r < 0.55, `rate ${r.toFixed(3)}`); }
{ const r = pelopsOnAttackedRate('Petrification', false); check('Pelops passive: [Petrification] on attacker ~50%', r > 0.45 && r < 0.55, `rate ${r.toFixed(3)}`); }
{ const r = pelopsOnAttackedRate('Petrification', true);  check('Pelops passive: [Petrification] drops to ~25% under [Decrease DEF]', r > 0.20 && r < 0.30, `rate ${r.toFixed(3)}`); }

// ── Pelops A1: [Decrease ATK] cannot be resisted/blocked if the target is under [HP Burn] (policy #17) ──
{ const pelA1 = (targetHpBurn) => {
    const pel = makeCombatant({ name: 'Pelops', side: 'ally', atk: 0, maxHp: 28000, acc: 0, affinity: 'Void' });
    const t = makeCombatant({ name: 'Mob', side: 'enemy', maxHp: 1e9, def: 500, res: 300, affinity: 'Void' });   // high RES → resists normally (acc 0)
    if (targetHpBurn) t.debuffs.push({ type: 'HP Burn', turnsLeft: 2 });
    applyRecipe(makeState({ allies: [pel], enemies: [t], seed: null }), pel, RECIPES['PELOPS-A1']);
    return t.debuffs.some(d => d.type === 'Decrease Attack');
  };
  check('Pelops A1: [Decrease ATK] RESISTED vs high-RES target (acc 0, res 300)', pelA1(false) === false);
  check('Pelops A1: [Decrease ATK] UNRESISTABLE when the target is under [HP Burn]', pelA1(true) === true); }

// ── Pelops A2: ignore 50% DEF if the target is under [HP Burn]. Control carries the SAME debuff-turns of a
// neutral debuff (Weaken) so the dynamic scaler is identical and only the ignore-DEF differs. ──
{ const pelA2 = (targetDebuff) => {
    const pel = makeCombatant({ name: 'Pelops', side: 'ally', atk: 0, maxHp: 100000, affinity: 'Void', critRate: 0, critDmg: 0 });
    const t = makeCombatant({ name: 'Mob', side: 'enemy', maxHp: 1e9, def: 3000, affinity: 'Void' });
    t.debuffs.push({ type: targetDebuff, turnsLeft: 2 });   // 2 debuff-turns either way → scaler ×1.2 for both
    return applyRecipe(makeState({ allies: [pel], enemies: [t], seed: null }), pel, RECIPES['PELOPS-A2'])[0].raw_damage;
  };
  // base 0.4×100k=40,000 ×scaler1.2=48,000. Weaken: defMit 1500/4500 → 16,000. HP Burn: DEF halved → defMit 1500/3000=0.5 → 24,000.
  const ctrl = pelA2('Weaken'), burn = pelA2('HP Burn');
  check('Pelops A2: ignore-50%-DEF only vs [HP Burn] (16,000 → 24,000, same debuff-turns)', ctrl === 16000 && burn === 24000, `ctrl=${ctrl} burn=${burn}`); }

// ── Bambus "Sleeping Sage": self-[Sleep], wake-without-skip, dump, sponge ──
{ // A1 places [Sleep] on self
  const bam = makeCombatant({ name: 'Bambus', side: 'ally', atk: 800, affinity: 'Void' });
  const mob = makeCombatant({ name: 'Mob', side: 'enemy', maxHp: 1e9, def: 1000, affinity: 'Void' });
  applyRecipe(makeState({ allies: [bam], enemies: [mob], seed: null }), bam, RECIPES['BAMBUS-A1']);
  check('Sleeping Sage: Bambus A1 places [Sleep] on self', bam.debuffs.some(d => d.type === 'Sleep'));
}
{ // wake: start_of_turn removes [Sleep] (so the CC-skip check that follows finds nothing) and dumps to highest-RES enemy
  const bam = makeCombatant({ name: 'Bambus', side: 'ally', affinity: 'Void' });
  bam.debuffs.push({ type: 'Sleep', turnsLeft: 1 }, { type: 'Decrease Defense', value: 60, turnsLeft: 2 });
  const lowRes = makeCombatant({ name: 'Low', side: 'enemy', res: 20, affinity: 'Void' });
  const hiRes = makeCombatant({ name: 'Hi', side: 'enemy', res: 200, affinity: 'Void' });
  fireTriggers(makeState({ allies: [bam], enemies: [lowRes, hiRes], seed: null }), bam, 'start_of_turn');
  check('Sleeping Sage: wake removes [Sleep] (no turn lost — CC check finds nothing)', !bam.debuffs.some(d => d.type === 'Sleep'));
  // [Sleep] is REMOVED, not dumped — the highest-RES enemy gets the real debuff but NOT [Sleep] (a wake that
  // failed to remove Sleep would splice it onto the enemy AND make Bambus skip his turn).
  check('Sleeping Sage: dumps real debuffs to the HIGHEST-RES enemy, never [Sleep]', hiRes.debuffs.some(d => d.type === 'Decrease Defense') && !hiRes.debuffs.some(d => d.type === 'Sleep') && !lowRes.debuffs.length && !bam.debuffs.length);
}
{ // sponge: a debuff placed on an ally transfers to an asleep Bambus (force the 75% via all-land)
  setChanceMode('all');
  const bam = makeCombatant({ name: 'Bambus', side: 'ally', affinity: 'Void' }); bam.debuffs.push({ type: 'Sleep', turnsLeft: 1 });
  const ally = makeCombatant({ name: 'Ally', side: 'ally', maxHp: 20000, res: 0, affinity: 'Void' }); ally.hp = 1000;   // lowest HP% → the foe's single-target pick
  const foe = makeCombatant({ name: 'Foe', side: 'enemy', acc: 300, affinity: 'Void' });
  const decDef = { slot: 'X', actions: [{ seq: 10, op: 'ACQUIRE_TARGETS', target: 'single' }, { seq: 20, op: 'PLACE_DEBUFF', target: 'intended_set', effect: { type: 'Decrease Defense', magnitude: 60, duration: 2, chance: 1.0, accuracy_check: false } }] };
  applyRecipe(makeState({ allies: [bam, ally], enemies: [foe], seed: null }), foe, decDef);
  setChanceMode('threshold');
  check('Sleeping Sage: a debuff on an ally sponges to the asleep Bambus', bam.debuffs.some(d => d.type === 'Decrease Defense') && !ally.debuffs.some(d => d.type === 'Decrease Defense'));
}

console.log(`\n=== ${pass} passed, ${fail} failed ===\n`);
process.exit(fail ? 1 : 0);
