// tools/sim-recipe-d-test.mjs — MODEL QA · toy battles for II-D reactive passives + damage modifiers +
// EXTEND_EFFECT. These were verified once in throwaway inline runs; this commits them as a durable rung so
// the teeth check (model-mutants) can see them and they cannot silently break. No DB. Deterministic.
// Run: node tools/sim-recipe-d-test.mjs
import { makeCombatant, makeState, setChanceMode, chooseAllyTarget, chooseSingleTarget, dealDamage, simulate, actEnemyMob, defMitigation } from '../lib/sim/engine.js';
import { applyRecipe, fireTriggers, incomingDamage, passiveImmunities, installRecipeRun, tickPassiveCooldowns, maybeSponge } from '../lib/sim/interpreter.js';
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

// ── Second Wind [Shield] PASSIVE-TRIGGER COOLDOWN (base 3): the shield fires at most once per 3 owner-turns.
// Three big hits back-to-back (no owner turn between) → it fires ONCE, the next two are suppressed on cooldown;
// after 3 owner-turn ticks it can fire again. Without the cooldown consumer it re-shields every hit (unkillable). ──
{
  const v = V(); const s = makeState({ allies: [v], enemies: [], seed: null });
  const bigHit = () => fireTriggers(s, v, 'hit_taken', { hitAmount: 2000 });   // 2000 = 12.5% of 16000 MAX HP ≥ 10%
  bigHit(); bigHit(); bigHit();
  const fired = () => (s.effects || []).filter(e => e.kind === 'passive-cd' && e.fired).length;
  const supp  = (s.effects || []).filter(e => e.kind === 'passive-cd' && !e.fired).length;
  check('Second Wind cooldown: 3 back-to-back big hits → [Shield] fires ONCE (2 suppressed on cd)', fired() === 1 && supp === 2, `fired=${fired()} suppressed=${supp}`);
  tickPassiveCooldowns(v); tickPassiveCooldowns(v); tickPassiveCooldowns(v);   // 3 owner-turns → cd 3→0
  bigHit();
  check('Second Wind cooldown: after 3 owner-turn ticks the [Shield] can fire again', fired() === 2, `total fired=${fired()}`); }

// ── Ezio Perfect Veil (round_start trigger → untargetable) ──
{ const ez = makeCombatant({ name: 'Ezio', side: 'ally', maxHp: 16000 }); ez.hp = 2000;   // LOWEST HP% — would be the pick without a veil
  const ally = makeCombatant({ name: 'A', side: 'ally', maxHp: 20000 }); ally.hp = 10000;
  fireTriggers(makeState({ allies: [ez, ally], enemies: [], seed: null }), ez, 'round_start', {});
  const veiled = ez.buffs.some(b => b.type === 'Perfect Veil');
  const target = chooseAllyTarget([ez, ally]);   // single-target enemy pick MUST skip the veiled Ezio
  check('Ezio Perfect Veil: round_start places it AND single-target skips the veiled (lowest-HP) Ezio', veiled && target?.name === 'A', `veiled=${veiled} target=${target?.name}`); }

// ── Round-based Perfect Veil TIMING (the round-boundary fix): the veil re-applies once per ROUND, not per
// TURN, so a FAST Ezio (who takes several turns per round) OUTRUNS his 2-turn veil and it LAPSES mid-round
// → uptime is NOT 100%. The old bug fired round_start every turn (veil never dropped, down===0); the mutant
// that reverts to per-turn firing is killed by the down>0 assertion. Deterministic (seed=null). ──
{
  const basic = (slot, coeff) => ({ slot, isPassive: false, cooldown: 0, coeff, coeffStat: 'atk', hitsEnemies: true, aoe: false });
  const ezio = makeCombatant({ name: 'Ezio Auditore', side: 'ally', maxHp: 30000, spd: 250, atk: 500, critRate: 0, critDmg: 0, affinity: 'Void', skills: [basic('A1', 0.1)] });
  const ally = makeCombatant({ name: 'Ally', side: 'ally', maxHp: 40000, spd: 80, atk: 100, critRate: 0, critDmg: 0, affinity: 'Void', skills: [basic('A1', 0.1)] });
  const mob = (n) => makeCombatant({ name: 'Mob#' + n, side: 'enemy', maxHp: 1e9, spd: 80, atk: 100, critRate: 0, critDmg: 0, affinity: 'Void', skills: [basic('A1', 0.01)] });
  const st = makeState({ allies: [ezio, ally], enemies: [], seed: null });
  installRecipeRun(st);
  let up = 0, down = 0;
  st.onAction = () => { if (!ezio.alive) return; ezio.buffs.some(b => b.type === 'Perfect Veil') ? up++ : down++; };   // sample veil presence each turn
  const content = { phases: [{ name: 'wave 1', enemies: [mob(1), mob(2), mob(3)], actEnemy: actEnemyMob }], maxHpDamageCap: null };
  simulate(st, content, { turnCap: 40 });
  check('round-based Perfect Veil: a FAST Ezio’s veil LAPSES between rounds (uptime ≠ 100%)', up > 0 && down > 0, `up=${up} down=${down}`);
}

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
  // base 0.4×100k=40,000 ×scaler1.2=48,000. Weaken (neutral): effDef 3000. HP Burn: 50% DEF ignored → effDef 1500.
  // Expected mitigation computed from the verified defMitigation() (Pelops = default L60), never a hardcoded constant.
  const ctrl = pelA2('Weaken'), burn = pelA2('HP Burn');
  const expCtrl = Math.round(48000 * defMitigation(3000, 60)), expBurn = Math.round(48000 * defMitigation(1500, 60));
  check(`Pelops A2: ignore-50%-DEF only vs [HP Burn] (${expCtrl} → ${expBurn}, same debuff-turns)`, ctrl === expCtrl && burn === expBurn, `ctrl=${ctrl} burn=${burn}`); }

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
{ // wake-ON-ATTACK: being hit while asleep ALSO removes [Sleep] and fires the dump ("…or by an enemy attack")
  const bam = makeCombatant({ name: 'Bambus', side: 'ally', affinity: 'Void' });
  bam.debuffs.push({ type: 'Sleep', turnsLeft: 2 }, { type: 'Decrease Defense', value: 60, turnsLeft: 2 });
  const lowRes = makeCombatant({ name: 'Low', side: 'enemy', res: 20, affinity: 'Void' });
  const hiRes = makeCombatant({ name: 'Hi', side: 'enemy', res: 200, affinity: 'Void' });
  fireTriggers(makeState({ allies: [bam], enemies: [lowRes, hiRes], seed: null }), bam, 'attacked', { attacker: lowRes });
  check('Sleeping Sage: an enemy attack wakes Bambus (removes [Sleep]) and dumps to the highest-RES enemy',
    !bam.debuffs.some(d => d.type === 'Sleep') && hiRes.debuffs.some(d => d.type === 'Decrease Defense') && !bam.debuffs.length);
}
{ // sponge: a debuff placed on an ally transfers to an asleep Bambus (force the 75% via all-land)
  setChanceMode('all');
  const bam = makeCombatant({ name: 'Bambus', side: 'ally', maxHp: 26000, affinity: 'Void' }); bam.debuffs.push({ type: 'Sleep', turnsLeft: 1 });
  const ally = makeCombatant({ name: 'Ally', side: 'ally', maxHp: 15000, res: 0, affinity: 'Void' });   // LOWEST max HP → the foe's single-target pick (glass-cannon rule), so the debuff lands on it and must sponge to Bambus
  const foe = makeCombatant({ name: 'Foe', side: 'enemy', acc: 300, affinity: 'Void' });
  const decDef = { slot: 'X', actions: [{ seq: 10, op: 'ACQUIRE_TARGETS', target: 'single' }, { seq: 20, op: 'PLACE_DEBUFF', target: 'intended_set', effect: { type: 'Decrease Defense', magnitude: 60, duration: 2, chance: 1.0, accuracy_check: false } }] };
  applyRecipe(makeState({ allies: [bam, ally], enemies: [foe], seed: null }), foe, decDef);
  setChanceMode('threshold');
  check('Sleeping Sage: a debuff on an ally sponges to the asleep Bambus', bam.debuffs.some(d => d.type === 'Decrease Defense') && !ally.debuffs.some(d => d.type === 'Decrease Defense'));
}
{ // sponge STACK ACCUMULATION: a 2-stack [Poison] from EACH of two allies accumulates to 4 on Bambus (was
  // collapsed to 1 by upsert — the bug that gutted his boss poison-redirect: 5%×MaxHP×stacks on Hellrazor).
  setChanceMode('all');
  const bam = makeCombatant({ name: 'Bambus', side: 'ally', maxHp: 26000, affinity: 'Void' }); bam.debuffs.push({ type: 'Sleep', turnsLeft: 2 });
  const a1 = makeCombatant({ name: 'Vergis', side: 'ally', maxHp: 16000, affinity: 'Void' });
  const a2 = makeCombatant({ name: 'Ezio', side: 'ally', maxHp: 16000, affinity: 'Void' });
  for (const a of [a1, a2]) a.debuffs.push({ type: 'Poison', pct: 0.05, turnsLeft: 3, stacks: 2 });
  const st = makeState({ allies: [bam, a1, a2], enemies: [], seed: null });
  maybeSponge(st, a1, 'Poison'); maybeSponge(st, a2, 'Poison');
  setChanceMode('threshold');
  const stacks = bam.debuffs.filter(d => d.type === 'Poison').reduce((n, d) => n + (d.stacks ?? 1), 0);
  check('Sleeping Sage: sponge ACCUMULATES stacks — 2+2 from two allies → 4 on Bambus (not collapsed to 1)', stacks === 4, `stacks=${stacks}`);
}

// ── Enemy AI targeting: LOWEST MAX HP (glass-cannon rule #3), not lowest current HP%; [Perfect Veil] hides
// the true-lowest (Ezio) so the NEXT lowest (Vergis) is tunneled — even at full HP behind a shield. ──
{ const mk = (n, maxHp, { veil = false, shield = false, hpPct = 1 } = {}) => {
    const c = makeCombatant({ name: n, side: 'ally', maxHp }); c.hp = maxHp * hpPct;
    if (veil) c.buffs.push({ type: 'Perfect Veil', turnsLeft: 2 });
    if (shield) c.buffs.push({ type: 'Shield', value: 5000, turnsLeft: 2 });
    return c; };
  const team = [
    mk('Ezio', 15929, { veil: true }),                 // TRUE lowest max HP, but Perfect-Veil hidden
    mk('Vergis', 16681, { shield: true, hpPct: 1.0 }),  // 2nd-lowest max HP, FULL HP + shield
    mk('Bambus', 25686, { hpPct: 0.25 }),               // scratched to 25% — the OLD (current-HP%) code picks this
    mk('Pelops', 28543), mk('Tagoar', 24283),
  ];
  const pick = chooseSingleTarget(team);
  check('AI tunnels lowest-max-HP TARGETABLE (Vergis), not the veiled Ezio nor the scratched Bambus', pick?.name === 'Vergis', 'picked ' + pick?.name);
  // and if that lowest-max-HP champ TAUNTS, taunt overrides (Pelops pulls it)
  const withTaunt = team.map(c => c.name === 'Pelops' ? (c.buffs.push({ type: 'Taunt', turnsLeft: 2 }), c) : c);
  check('AI: [Taunt] overrides the max-HP rule (Pelops pulls it)', chooseSingleTarget(withTaunt)?.name === 'Pelops');
}

// ── Enfeeble on the ATTACKER forces weak hits (×0.70), overriding affinity (Bambus A3 debuffs the mobs) ──
{ const hit = (enfeeble) => {
    const a = makeCombatant({ name: 'Mob', side: 'enemy', atk: 3000, affinity: 'Void', critRate: 0, critDmg: 0 });
    if (enfeeble) a.debuffs.push({ type: 'Enfeeble', turnsLeft: 2 });
    const t = makeCombatant({ name: 'Ally', side: 'ally', maxHp: 1e9, def: 1000, affinity: 'Void' });
    return applyRecipe(makeState({ allies: [t], enemies: [a], seed: null }), a, RECIPES['FACELESS-A1'])[0].raw_damage;   // 3×ATK
  };
  const normal = hit(false), enf = hit(true);
  // ×0.70 is applied to the RAW product then rounded once; `normal` is already rounded, so round(normal×0.70)
  // can differ from `enf` by one unit. Pin the 0.70 factor with a ±1 rounding tolerance (a real regression to
  // 0.65/0.75 would miss by ~130, far outside ±1).
  check('Enfeeble on attacker → weak hit ×0.70 (mobs hit 30% softer)', normal > 0 && Math.abs(enf - normal * 0.70) <= 1, `normal=${normal} enfeebled=${enf}`);
}

// ── Ezio P2 counterattack (35% when attacked → re-runs A1 AT the attacker). Two enemies: the attacker has the
// HIGHER max HP so it is NOT the AI's default single-target pick — proving the counter uses forceTarget (hits
// the attacker), not normal targeting. 35% rolls off the proc stream; force it via all-land, control via none. ──
{
  const mk = () => ({
    ez: makeCombatant({ name: 'Ezio Auditore', side: 'ally', atk: 3000, acc: 200, affinity: 'Void', critRate: 0, critDmg: 0 }),
    attacker: makeCombatant({ name: 'Attacker', side: 'enemy', maxHp: 1e7, def: 1000, res: 0, affinity: 'Void' }),   // higher max HP
    other: makeCombatant({ name: 'Other', side: 'enemy', maxHp: 1e6, def: 1000, res: 0, affinity: 'Void' }),          // lower max HP = AI's default pick
  });
  setChanceMode('all');
  const a = mk(); fireTriggers(makeState({ allies: [a.ez], enemies: [a.attacker, a.other], seed: null }), a.ez, 'attacked', { attacker: a.attacker });
  setChanceMode('none');
  const b = mk(); fireTriggers(makeState({ allies: [b.ez], enemies: [b.attacker, b.other], seed: null }), b.ez, 'attacked', { attacker: b.attacker });
  setChanceMode('threshold');
  check('Ezio P2 counterattack: fires (all-proc) and hits the ATTACKER via forceTarget, not the AI-preferred target',
    a.attacker.hp < 1e7 && a.other.hp === 1e6, `attacker took ${1e7 - a.attacker.hp}, other took ${1e6 - a.other.hp}`);
  check('Ezio P2 counterattack: no counter under none-proc → attacker untouched', b.attacker.hp === 1e7, `attacker took ${1e7 - b.attacker.hp}`);
}

console.log(`\n=== ${pass} passed, ${fail} failed ===\n`);
process.exit(fail ? 1 : 0);
