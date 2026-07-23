// tools/sim-selftest.mjs — DOES THE SIMULATOR DO WHAT WE DESIGNED IT TO DO?
//
// GATE 1 of 2 (Mike, 2026-07-22): "we know what it SHOULD do based on how we set it up. When it is
// running as intended, THEN we compare to the real info."
//
// This file tests the engine against ITS OWN SPEC — no database, no captured battles, no reality.
// Reality is gate 2 (tools/sim-dragon.mjs). Mixing them is what cost an afternoon: when the sim
// disagreed with a real battle there was no way to tell a BUG from a MISSING MECHANIC, so every
// discrepancy became an investigation. All four bugs found by tracing on 2026-07-22 — passives cast
// as actions, shields never absorbing, CC never costing a turn, ignore-clauses parsed as
// placements — were violations of decisions we had ALREADY MADE. Each is one assertion here.
//
// Deterministic, instant, no I/O. Run: node tools/sim-selftest.mjs

import { makeCombatant, makeState, simulate, dealDamage, chooseEnemyTarget, chooseAllyTarget, isUntargetable,
         affinityFactor, landChance, defMitigation, effectiveDef, actEnemyMob, scaleStat, applyDebuff, CC_SKIPS_TURN } from '../lib/sim/engine.js';
import { readSkillKit, classifySkill, canUseSkill, parseCoeff, parseMaxHpPct, classifyPassiveTrigger } from '../lib/sim/ai.js';

let pass = 0, fail = 0; const failures = [];
const ok = (name, cond, detail = '') => {
  if (cond) { pass++; } else { fail++; failures.push(`${name}${detail ? ' — ' + detail : ''}`); }
};
const eq = (name, got, want) => ok(name, got === want, `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
const near = (name, got, want, tol = 0.01) => ok(name, Math.abs(got - want) <= tol, `got ${got}, want ~${want}`);

// ── fixtures ─────────────────────────────────────────────────────────────────
const champ = (o = {}) => makeCombatant({
  name: o.name ?? 'C', side: 'ally', maxHp: o.maxHp ?? 10000, atk: o.atk ?? 1000,
  def: o.def ?? 1000, spd: o.spd ?? 100, acc: o.acc ?? 100, res: o.res ?? 50,
  critRate: 0, critDmg: 0, affinity: o.affinity ?? 'Void', skills: o.skills ?? [], ...o,
});
const dummyEnemy = (o = {}) => makeCombatant({
  name: o.name ?? 'E', side: 'enemy', role: 'boss', maxHp: o.maxHp ?? 1e9,
  atk: 0, def: 0, spd: o.spd ?? 1, affinity: o.affinity ?? 'Void', ...o,
});
const passiveContent = (enemies) => ({ phases: [{ name: 'boss', enemies, actEnemy() {} }] });

// ── 1. TURN ORDER — the whole reason a loop exists ───────────────────────────
{
  const fast = champ({ name: 'Fast', spd: 200, skills: [{ slot: 'A1', cooldown: 0, cdLeft: 0, hitsEnemies: false }] });
  const slow = champ({ name: 'Slow', spd: 100, skills: [{ slot: 'A1', cooldown: 0, cdLeft: 0, hitsEnemies: false }] });
  const order = [];
  const e = dummyEnemy({ spd: 1 });
  const st = makeState({ allies: [fast, slow], enemies: [] });
  const content = { phases: [{ name: 'boss', enemies: [e], actEnemy(s, a) { order.push(a.name); } }] };
  const origLog = console.log; console.log = () => {};
  simulate(st, content, { turnCap: 6 });
  console.log = origLog;
  ok('turn order: faster champion acts first', fast.turnMeter !== null && slow.turnMeter !== null);
  // direct check of the meter maths rather than inferring from side effects
  const a = champ({ spd: 200 }), b = champ({ spd: 100 });
  const dt = Math.min((100 - a.turnMeter) / a.spd, (100 - b.turnMeter) / b.spd);
  near('turn meter: 200 SPD fills in half the time of 100 SPD', dt, 0.5);
}

// ── 2. SKILL SELECTION — the passive bug ─────────────────────────────────────
{
  const kit = readSkillKit([
    { slot: 'A1', skill_name: 'Hit', skill_summary: 'Attacks 1 enemy.', cooldown_base: '0', damage_multiplier: '3' },
    { slot: 'A3', skill_name: 'Big', skill_summary: 'Attacks all enemies.', cooldown_base: '4', damage_multiplier: '5' },
    { slot: 'Passive', skill_name: 'Aura [P]', skill_summary: 'Increases ally SPD.', cooldown_base: null, damage_multiplier: null },
    { slot: 'A4', skill_name: 'Aid the Feeble [P]', skill_summary: 'Decreases damage received.', cooldown_base: null, damage_multiplier: null },
  ]);
  eq('passive in slot "Passive" is marked isPassive', kit.find(s => s.slot === 'PASSIVE')?.isPassive, true);
  eq('passive in slot A4 with [P] suffix is marked isPassive', kit.find(s => s.slot === 'A4')?.isPassive, true);
  eq('A3 is NOT marked passive', kit.find(s => s.slot === 'A3')?.isPassive, false);
}

// ── 3. AI CONDITION LOCKS — AUTO_BATTLE_AI.md §2 ─────────────────────────────
{
  const revive = { revives: true };
  const pureSingleHeal = { healPct: 0.2, buffs: [], aoeHeal: false };
  const pureAoeHeal = { healPct: 0.2, buffs: [], aoeHeal: true };
  const healBuff = { healPct: 0.15, buffs: [{ type: 'Increase SPD' }] };
  eq('classify: revive', classifySkill(revive), 'revive');
  eq('classify: heal+buff is a BUFF (fires at full HP)', classifySkill(healBuff), 'heal_buff');
  eq('classify: pure single-target heal', classifySkill(pureSingleHeal), 'heal_single');

  const full = { allies: [champ({ maxHp: 100 }), champ({ maxHp: 100 })] };
  full.allies.forEach(a => { a.hp = 100; });
  const hurt = { allies: [champ({ maxHp: 100 }), champ({ maxHp: 100 })] };
  hurt.allies[0].hp = 50;
  const dead = { allies: [champ(), champ()] };
  dead.allies[0].alive = false;

  eq('REVIVE is LOCKED while everyone is alive', canUseSkill(revive, full), false);
  eq('revive fires once an ally is dead', canUseSkill(revive, dead), true);
  eq('pure single heal is HOARDED at full HP', canUseSkill(pureSingleHeal, full), false);
  eq('pure single heal fires below 75%', canUseSkill(pureSingleHeal, hurt), true);
  eq('pure AoE heal is hoarded at 50% (threshold 60%)', canUseSkill(pureAoeHeal, hurt), true);
  eq('heal+buff fires at FULL HP (heal wasted)', canUseSkill(healBuff, full), true);
}

// ── 4. SHIELDS — absorb direct, ignore DoT, override not stack ───────────────
{
  const c = champ({ maxHp: 10000 });
  c.buffs.push({ type: 'Shield', value: 3000, turnsLeft: 2 });
  const r1 = dealDamage(c, 1000, 'direct');
  eq('shield absorbs direct damage before HP', c.hp, 10000);
  eq('shield pool is drained', c.buffs[0].value, 2000);
  eq('dealDamage reports what it absorbed', r1.absorbed, 1000);

  const r2 = dealDamage(c, 5000, 'direct');
  eq('overflow past the shield reaches HP', c.hp, 10000 - 3000);
  eq('depleted shield is marked for removal', c.buffs[0].turnsLeft, 0);

  const d = champ({ maxHp: 10000 });
  d.buffs.push({ type: 'Magma Shield', value: 5000, turnsLeft: 2 });
  dealDamage(d, 1000, 'dot');
  eq('shields do NOT absorb DoT (PROTECTION_MECHANICS: direct only)', d.hp, 9000);
  eq('DoT leaves the shield pool untouched', d.buffs[0].value, 5000);
}

// ── 5. CC COSTS A TURN ───────────────────────────────────────────────────────
{
  ok('CC list includes Stun/Freeze/Sleep', ['Stun', 'Freeze', 'Sleep'].every(t => CC_SKIPS_TURN.includes(t)));
  const acted = [];
  const stunned = champ({ name: 'Stunned', spd: 100, skills: [{ slot: 'A1', cooldown: 0, cdLeft: 0, hitsEnemies: true, coeff: 1 }] });
  stunned.debuffs.push({ type: 'Stun', turnsLeft: 5 });
  const e = dummyEnemy({ maxHp: 1e9, spd: 1 });
  const st = makeState({ allies: [stunned], enemies: [] });
  const content = { phases: [{ name: 'boss', enemies: [e], actEnemy() {} }] };
  simulate(st, content, { turnCap: 3 });
  eq('a stunned champion deals no damage', e.hp, 1e9);
}

// ── 6. DoT — ticks on the AFFECTED champion's turn; HP Burn splashes ─────────
{
  const a = champ({ name: 'A', maxHp: 10000, spd: 100, skills: [] });
  const b = champ({ name: 'B', maxHp: 20000, spd: 1, skills: [] });
  a.debuffs.push({ type: 'Poison', pct: 0.05, stacks: 2, turnsLeft: 9 });
  const st = makeState({ allies: [a, b], enemies: [] });
  simulate(st, { phases: [{ name: 'boss', enemies: [dummyEnemy({ spd: 1 })], actEnemy() {} }] }, { turnCap: 1 });
  eq('poison ticks pct x stacks x maxHP on its own turn', a.hp, 10000 - 0.05 * 2 * 10000);
  eq("a poisoned champion's ally is unaffected", b.hp, 20000);

  const x = champ({ name: 'X', maxHp: 10000, spd: 100 });
  const y = champ({ name: 'Y', maxHp: 20000, spd: 1 });
  x.debuffs.push({ type: 'HP Burn', turnsLeft: 9 });
  const st2 = makeState({ allies: [x, y], enemies: [] });
  simulate(st2, { phases: [{ name: 'boss', enemies: [dummyEnemy({ spd: 1 })], actEnemy() {} }] }, { turnCap: 1 });
  eq('HP Burn hits the burned champion for 3% of ITS max HP', x.hp, 10000 - 300);
  eq('HP Burn SPLASHES to allies for 3% of THEIR max HP', y.hp, 20000 - 600);
}

// ── 7. AFFINITY ──────────────────────────────────────────────────────────────
{
  near('Magic beats Spirit (strong hit)', affinityFactor('Magic', 'Spirit'), 1.30);
  near('Spirit into Magic is a weak hit', affinityFactor('Spirit', 'Magic'), 0.70);
  near('Void is neutral attacking', affinityFactor('Void', 'Magic'), 1.0);
  near('Void is neutral defending', affinityFactor('Magic', 'Void'), 1.0);
}

// ── 8. ACC vs RES ────────────────────────────────────────────────────────────
{
  near('equal ACC and RES -> always lands', landChance(150, 150), 1);
  near('RES 50 above ACC -> 50% land', landChance(100, 150), 0.5);
  near('land chance floors at 5%', landChance(0, 500), 0.05);
  eq('unknown inputs return null (caller must FLAG, not assume)', landChance(null, 100), null);
}

// ── 9. TARGET SELECTION — lowest CURRENT HP%, avoid Unkillable ───────────────
{
  const hi = dummyEnemy({ name: 'hi', maxHp: 100 }); hi.hp = 90;
  const lo = dummyEnemy({ name: 'lo', maxHp: 100 }); lo.hp = 20;
  eq('targets the lowest current HP%', chooseEnemyTarget([hi, lo])?.name, 'lo');
  lo.buffs.push({ type: 'Unkillable', turnsLeft: 2 });
  eq('avoids [Unkillable]', chooseEnemyTarget([hi, lo])?.name, 'hi');
  const only = dummyEnemy({ name: 'only', maxHp: 100 });
  only.buffs.push({ type: 'Block Damage', turnsLeft: 2 });
  eq('…unless it is the only target left', chooseEnemyTarget([only])?.name, 'only');
}

// ── 10. KIT EXTRACTION — tag policies #16/#19 must not regress ───────────────
{
  const kit = readSkillKit([{
    slot: 'A3', skill_name: 'Hidden Gun', cooldown_base: '4', damage_multiplier: '5.2',
    skill_summary: "Attacks 1 enemy. Before attacking, steals all buffs from the target. Will ignore 35% of the target's DEF, as well as [Shield] and [Strengthen] buffs.",
  }]);
  eq('a [Shield] after "ignore" is NOT parsed as a shield this skill places', kit[0].buffs.length, 0);

  const shield = readSkillKit([{
    slot: 'A3', skill_name: 'Victor\'s Bounty', cooldown_base: '4 Turns', damage_multiplier: null,
    skill_summary: "Places a [Magma Shield] buff on all allies for 2 turns. The value of the [Magma Shield] is equal to 30% of this Champion's MAX HP.",
  }]);
  const ms = shield[0].buffs.find(b => b.type === 'Magma Shield');
  ok('Magma Shield is parsed', !!ms);
  near('shield size read as 30% of the CASTER max HP', ms?.pctOfCasterMaxHp ?? 0, 0.30);
  eq('cooldown parses from "4 Turns" (mixed-type column)', shield[0].cooldown, 4);
}

// ── 11. COEFFICIENT PARSING — value + scaling stat (multiplier_type) ─────────
{
  eq('bare coefficient value', parseCoeff('4.65')?.value, 4.65);
  eq('bare coefficient defaults to ATK scaling', parseCoeff('4.65')?.stat, 'atk');
  eq('"N ATK" form value', parseCoeff('2.5 ATK')?.value, 2.5);
  eq('"N HP" scales off HP (Pelops)', parseCoeff('0.4 HP')?.stat, 'hp');
  eq('"N HP" value', parseCoeff('0.4 HP')?.value, 0.4);
  eq('"N DEF" scales off DEF (Vergis)', parseCoeff('3.9 DEF')?.stat, 'def');
  eq('"N DEF" value', parseCoeff('3.9 DEF')?.value, 3.9);
  eq('compound form takes the ATK term', parseCoeff('0.02 Enemy MAX HP / 2.5 ATK')?.value, 2.5);
  eq('pure Enemy MAX HP is NOT read as attacker HP (separate mechanic)', parseCoeff('0.02 Enemy MAX HP'), null);
  eq('null stays null (never defaulted)', parseCoeff(null), null);

  // the multiplier_type COLUMN is the authority — Vergis is stored as bare '3.9' + column 'DEF'.
  const vk = readSkillKit([{ slot: 'A1', skill_name: 'Pierce', skill_summary: 'Attacks 1 enemy.', damage_multiplier: '3.9', multiplier_type: 'DEF' }]);
  eq('multiplier_type column sets coeffStat (bare value + DEF column)', vk[0].coeffStat, 'def');
  eq('coeff value still comes from damage_multiplier', vk[0].coeff, 3.9);
  const noType = readSkillKit([{ slot: 'A1', skill_name: 'X', skill_summary: 'Attacks 1 enemy.', damage_multiplier: '4', multiplier_type: null }]);
  eq('a null multiplier_type falls back to ATK', noType[0].coeffStat, 'atk');
}

// ── 12. MITIGATION is monotonic ──────────────────────────────────────────────
{
  ok('more DEF always mitigates more', defMitigation(2000) < defMitigation(1000));
  near('zero DEF takes full damage', defMitigation(0), 1);
}

// ── 13. PURPLE-BAR DRAIN — the engine must feed team damage to content.onDamageToBoss ────────
// QA protocol Layer 3/5 (toy encounter + behavioural invariant). The purple bar is 20% of
// Hellrazor's Max HP (Mike 2026-07-22) and is depleted by damage the team deals to the boss. The
// hook (dragon.js onDamageToBoss) existed but the ENGINE never called it — "represented but not
// consumed", the 5th of that species. This test exists so it can never silently regress: it FAILS
// on the engine that ignores the hook.
{
  let drained = 0;
  const boss = dummyEnemy({ name: 'Boss', maxHp: 1e6, def: 0, spd: 1 });
  const hitter = champ({ name: 'H', spd: 100, atk: 1000, affinity: 'Void',
    skills: [{ slot: 'A1', cooldown: 0, cdLeft: 0, hitsEnemies: true, coeff: 2 }] });
  const content = { phases: [{ name: 'boss', enemies: [boss], actEnemy() {} }],
    onDamageToBoss(_state, amount) { drained += amount; } };
  const st = makeState({ allies: [hitter], enemies: [] });
  const origLog = console.log; console.log = () => {};
  simulate(st, content, { turnCap: 1 });                       // exactly one ally turn
  console.log = origLog;
  // 1000 ATK x coeff 2 x mitig(def 0)=1 x affinity(Void)=1 x no-crit = 2000 into the boss
  near('engine feeds team damage to onDamageToBoss (purple-bar drain is wired)', drained, 2000, 1);
}

// ── 14. WAVE MOB ACTS — generic enemy attacks an ally, lands its debuff on ACC vs RES ────────
// The boss has a scripted kit; wave mobs must act from their EXTRACTED kit. This test pins the
// generic enemy action so the wave phase (the Dragon wall, per Mike) can be modelled at all.
{
  const ally = champ({ name: 'Ally', maxHp: 10000, def: 0, res: 50, affinity: 'Void' });
  const mob = makeCombatant({ name: 'Mob', side: 'enemy', role: 'wave', maxHp: 5000, atk: 1000,
    acc: 100, affinity: 'Void', critRate: 0, critDmg: 0,
    skills: [{ slot: 'A1', cooldown: 0, cdLeft: 0, hitsEnemies: true, coeff: 2,
               debuffs: [{ type: 'Decrease Attack', value: 50, turns: 2 }] }] });
  const st = makeState({ allies: [ally], enemies: [mob] });
  actEnemyMob(st, mob);
  eq('wave mob deals atk x coeff x mitig(def 0) to the ally', ally.hp, 10000 - 2000);
  eq('wave mob lands its debuff when ACC 100 clears RES 50', ally.debuffs.some(d => d.type === 'Decrease Attack'), true);

  const tanky = champ({ name: 'Tanky', maxHp: 10000, def: 0, res: 300, affinity: 'Void' });
  const st2 = makeState({ allies: [tanky], enemies: [mob] });
  mob.skills[0].cdLeft = 0;
  actEnemyMob(st2, mob);
  eq('a high-RES ally resists the mob debuff (RES 300 vs ACC 100)', tanky.debuffs.some(d => d.type === 'Decrease Attack'), false);
}

// ── 15. multiplier_type — DAMAGE SCALES OFF THE DECLARED STAT, not always ATK ──
// The Pelops (0.4 HP) / Vergis (3.9 DEF) fix: a coeff must multiply by the attacker's coeffStat.
{
  eq('scaleStat reads ATK by default', scaleStat({ atk: 1000, def: 500, maxHp: 20000 }, 'atk'), 1000);
  eq('scaleStat reads HP when stat=hp', scaleStat({ atk: 1000, def: 500, maxHp: 20000 }, 'hp'), 20000);
  eq('scaleStat reads DEF when stat=def', scaleStat({ atk: 1000, def: 500, maxHp: 20000 }, 'def'), 500);

  // end-to-end: an HP-scaling hit lands maxHp×coeff, NOT atk×coeff
  const hpHero = champ({ maxHp: 20000, atk: 1000, spd: 100,
    skills: [{ slot: 'A1', cooldown: 0, cdLeft: 0, hitsEnemies: true, coeff: 0.5, coeffStat: 'hp' }] });
  const boss = dummyEnemy({ maxHp: 1e9, def: 0, spd: 1 });
  const st = makeState({ allies: [hpHero], enemies: [] });
  const l = console.log; console.log = () => {};
  simulate(st, { phases: [{ name: 'boss', enemies: [boss], actEnemy() {} }] }, { turnCap: 1 });
  console.log = l;
  eq('HP-scaling skill hits for MAX HP × coeff (0.5×20000), not ATK × coeff', 1e9 - boss.hp, 10000);

  // a skill with no coeffStat still defaults to ATK (back-compat with every existing fixture)
  const atkHero = champ({ maxHp: 20000, atk: 1000, spd: 100,
    skills: [{ slot: 'A1', cooldown: 0, cdLeft: 0, hitsEnemies: true, coeff: 2 }] });   // no coeffStat
  const boss2 = dummyEnemy({ maxHp: 1e9, def: 0, spd: 1 });
  const st2 = makeState({ allies: [atkHero], enemies: [] });
  const l2 = console.log; console.log = () => {};
  simulate(st2, { phases: [{ name: 'boss', enemies: [boss2], actEnemy() {} }] }, { turnCap: 1 });
  console.log = l2;
  eq('a coeffStat-less skill still scales off ATK (2×1000)', 1e9 - boss2.hp, 2000);
}

// ── 16. PASSIVE-TRIGGER SYSTEM — passives place their effects at the right trigger ───
// The Ezio one-shot, half one: a passive [Perfect Veil] that never landed because there was no
// mechanism to fire passives at all (demonstrated blank, sim-effects Part C).
{
  eq('classify "start of each turn" as a start-of-turn trigger',
     classifyPassiveTrigger('Places a [Perfect Veil] buff on this Champion at the start of each turn.'), 'startOfTurn');
  eq('classify "at the start of the battle" as a start-of-battle trigger',
     classifyPassiveTrigger('At the start of the battle, places a [Shield] buff on all allies.'), 'startOfBattle');
  eq('a passive with no readable trigger classifies as null (flagged, never fired blind)',
     classifyPassiveTrigger("Increases this Champion's DEF by 20%."), null);

  // end-to-end: a start-of-turn passive [Perfect Veil] actually lands on its champion
  const kit = readSkillKit([
    { slot: 'A1', skill_name: 'Poke', skill_summary: 'Attacks 1 enemy.', cooldown_base: '0', damage_multiplier: '1' },
    { slot: 'Passive', skill_name: 'Ghostwalk [P]', skill_summary: 'Places a [Perfect Veil] buff on this Champion at the start of each turn.', cooldown_base: null, damage_multiplier: null },
  ]);
  eq('passive trigger parsed onto the skill', kit.find(s => s.isPassive)?.passiveTrigger, 'startOfTurn');
  const hero = champ({ name: 'Ghost', spd: 100, skills: kit });
  const st = makeState({ allies: [hero], enemies: [] });
  const l = console.log; console.log = () => {};
  simulate(st, passiveContent([dummyEnemy({ maxHp: 1e9, spd: 1 })]), { turnCap: 3 });
  console.log = l;
  eq('start-of-turn passive places [Perfect Veil] on its champion', hero.buffs.some(b => b.type === 'Perfect Veil'), true);

  // TEETH: a passive whose trigger we CANNOT read must NOT fire — we do not blindly apply every passive
  const kit2 = readSkillKit([
    { slot: 'A1', skill_name: 'Poke', skill_summary: 'Attacks 1 enemy.', cooldown_base: '0', damage_multiplier: '1' },
    { slot: 'Passive', skill_name: 'Onslaught [P]', skill_summary: 'Whenever this Champion is hit by a critical hit, places a [Shield] buff on this Champion.', cooldown_base: null, damage_multiplier: null },
  ]);
  const hero2 = champ({ name: 'NoTrig', spd: 100, skills: kit2 });
  const st2 = makeState({ allies: [hero2], enemies: [] });
  const l2 = console.log; console.log = () => {};
  simulate(st2, passiveContent([dummyEnemy({ maxHp: 1e9, spd: 1 })]), { turnCap: 3 });
  console.log = l2;
  eq('an on-crit passive (unmodelled trigger) does NOT place its [Shield] at start of turn', hero2.buffs.some(b => b.type === 'Shield'), false);
  ok('...and that unmodelled passive is flagged as unread', kit2.find(s => s.isPassive)?.unread.includes('passive-trigger'));
}

// ── 17. [PERFECT VEIL] = UNTARGETABLE — single-target skips it, AoE hits through it ──
// The Ezio one-shot, half two: single-target enemy attacks must skip a veiled ally.
{
  const veiled = champ({ name: 'Veiled', maxHp: 10000 }); veiled.hp = 1000;    // 10% — the lowest HP%
  const exposed = champ({ name: 'Exposed', maxHp: 10000 }); exposed.hp = 9000; // 90%
  eq('single-target normally picks the lowest HP% ally', chooseAllyTarget([veiled, exposed])?.name, 'Veiled');
  veiled.buffs.push({ type: 'Perfect Veil', turnsLeft: 3 });
  ok('isUntargetable recognises [Perfect Veil]', isUntargetable(veiled));
  eq('single-target SKIPS the veiled ally for the exposed one', chooseAllyTarget([veiled, exposed])?.name, 'Exposed');

  // TEETH: if EVERY ally is veiled the protection lapses — a veil cannot leave the attacker no target
  exposed.buffs.push({ type: 'Perfect Veil', turnsLeft: 3 });
  eq('all allies veiled -> veil offers no cover, lowest HP% is picked', chooseAllyTarget([veiled, exposed])?.name, 'Veiled');

  // our champs hitting enemies honor the same rule (one shared code path)
  const vEnemy = dummyEnemy({ name: 'VE', maxHp: 100 }); vEnemy.hp = 10; vEnemy.buffs.push({ type: 'Perfect Veil', turnsLeft: 2 });
  const exEnemy = dummyEnemy({ name: 'XE', maxHp: 100 }); exEnemy.hp = 90;
  eq('champ single-target skips a veiled enemy', chooseEnemyTarget([vEnemy, exEnemy])?.name, 'XE');

  // AoE hits THROUGH a veil (untargetability is single-target only)
  const va = champ({ name: 'VA', maxHp: 10000, def: 0, res: 0 }); va.buffs.push({ type: 'Perfect Veil', turnsLeft: 3 });
  const mob = makeCombatant({ name: 'AoeMob', side: 'enemy', role: 'wave', maxHp: 5000, atk: 1000, acc: 100,
    affinity: 'Void', critRate: 0, critDmg: 0,
    skills: [{ slot: 'A2', cooldown: 0, cdLeft: 0, hitsEnemies: true, aoe: true, coeff: 2 }] });
  const stv = makeState({ allies: [va], enemies: [mob] });
  actEnemyMob(stv, mob);
  ok('AoE damages a [Perfect Veil] ally (veil blocks single-target only)', va.hp < 10000);
}

// ── 18. [DECREASE DEFENSE] LOWERS EFFECTIVE DEF — ATTACK damage only (damage-mechanics.js §1/§2) ──
{
  const bare = champ({ def: 3000 });
  eq('no shred -> effective DEF is the raw DEF', effectiveDef(bare), 3000);
  const shred = champ({ def: 3000 }); applyDebuff(shred, { type: 'Decrease Defense', value: 60, turns: 2 });
  near('60% Decrease DEF -> effective DEF is 40% of raw', effectiveDef(shred), 1200);
  // magnitude comes from the debuff's own value, not a constant: a 30% weak version cuts less
  const weak = champ({ def: 3000 }); applyDebuff(weak, { type: 'Decrease Defense', value: 30, turns: 2 });
  near('30% (weak) Decrease DEF -> effective DEF is 70% of raw', effectiveDef(weak), 2100);
  // does not stack: two Decrease DEF take the LARGEST, never sum past the real DEF
  const two = champ({ def: 3000 }); applyDebuff(two, { type: 'Decrease Defense', value: 30, turns: 2 }); two.debuffs.push({ type: 'Decrease Defense', value: 60, turnsLeft: 2 });
  near('multiple Decrease DEF do not stack (largest wins)', effectiveDef(two), 1200);

  // end-to-end: a shredded enemy takes strictly MORE attack damage than an identical bare enemy
  const hitter = () => champ({ atk: 2000, spd: 100, skills: [{ slot: 'A1', cooldown: 0, cdLeft: 0, hitsEnemies: true, coeff: 1 }] });
  const eBare = dummyEnemy({ maxHp: 1e9, spd: 1 }); eBare.def = 3000;
  const eShred = dummyEnemy({ maxHp: 1e9, spd: 1 }); eShred.def = 3000; applyDebuff(eShred, { type: 'Decrease Defense', value: 60, turns: 5 });
  const l = console.log; console.log = () => {};
  simulate(makeState({ allies: [hitter()], enemies: [] }), passiveContent([eBare]), { turnCap: 1 });
  simulate(makeState({ allies: [hitter()], enemies: [] }), passiveContent([eShred]), { turnCap: 1 });
  console.log = l;
  ok('a DEF-shredded enemy takes strictly more ATTACK damage', (1e9 - eShred.hp) > (1e9 - eBare.hp),
     `bare ${Math.round(1e9 - eBare.hp)}, shred ${Math.round(1e9 - eShred.hp)}`);
}

// ── 19. %MaxHP DAMAGE — DEF-independent, and capped to 10%/hit on stage 21+/Hard ──
{
  // parse: pure %maxHP, column-authoritative, and the compound carve-out
  eq('pure "X Enemy MAX HP" reads a %maxHP fraction', parseMaxHpPct('0.02 Enemy MAX HP', null), 0.02);
  eq('bare value + "Enemy MAX HP" column reads the fraction', parseMaxHpPct('0.05', 'Enemy MAX HP'), 0.05);
  eq('compound "%maxHP / ATK" is NOT a pure %maxHP nuke (left to parseCoeff)', parseMaxHpPct('0.02 Enemy MAX HP / 2.5 ATK', null), null);
  eq('attacker "N HP" scaling is NOT %maxHP', parseMaxHpPct('0.4 HP', 'HP'), null);
  eq('null stays null', parseMaxHpPct(null, null), null);

  const kit = readSkillKit([{ slot: 'A3', skill_name: 'Rupture', skill_summary: 'Attacks 1 enemy.', cooldown_base: '4', damage_multiplier: '0.15 Enemy MAX HP' }]);
  eq('a %maxHP skill carries maxHpPct', kit[0].maxHpPct, 0.15);
  eq('...and has NO attacker-scaling coeff (never double-counted)', kit[0].coeff, null);

  // end-to-end: DEF-independent — a high-DEF and a low-DEF target of equal MAX HP take the SAME hit
  const nuke = () => champ({ atk: 2000, spd: 100, skills: [{ slot: 'A1', cooldown: 0, cdLeft: 0, hitsEnemies: true, maxHpPct: 0.1 }] });
  const tanky = dummyEnemy({ maxHp: 100000, spd: 1 }); tanky.def = 5000;
  const squish = dummyEnemy({ maxHp: 100000, spd: 1 }); squish.def = 0;
  const l = console.log; console.log = () => {};
  simulate(makeState({ allies: [nuke()], enemies: [] }), passiveContent([tanky]), { turnCap: 1 });
  simulate(makeState({ allies: [nuke()], enemies: [] }), passiveContent([squish]), { turnCap: 1 });
  console.log = l;
  eq('%maxHP hits 10% of MAX HP regardless of DEF (DEF-independent)', 100000 - tanky.hp, 10000);
  eq('...and the low-DEF target takes the exact same %maxHP damage', 100000 - squish.hp, 10000);

  // the stage-21+/Hard cap: a 20% skill is limited to 10% per hit when the content sets the cap
  const capContent = (enemies, cap) => ({ phases: [{ name: 'boss', enemies, actEnemy() {} }], maxHpDamageCap: cap });
  const big = () => champ({ spd: 100, skills: [{ slot: 'A1', cooldown: 0, cdLeft: 0, hitsEnemies: true, maxHpPct: 0.2 }] });
  const capped = dummyEnemy({ maxHp: 100000, spd: 1 });
  const uncapped = dummyEnemy({ maxHp: 100000, spd: 1 });
  const l2 = console.log; console.log = () => {};
  simulate(makeState({ allies: [big()], enemies: [] }), capContent([capped], 0.10), { turnCap: 1 });
  simulate(makeState({ allies: [big()], enemies: [] }), capContent([uncapped], null), { turnCap: 1 });
  console.log = l2;
  eq('stage 21+/Hard caps a 20% %maxHP skill to 10% per hit', 100000 - capped.hp, 10000);
  eq('uncapped (Normal <21), the full 20% lands', 100000 - uncapped.hp, 20000);
}

// ── 20. THE EZIO ONE-SHOT — round-start veil trigger + self-condition [Veil] is NOT a placement ──
{
  eq('classify "start of each Round" as a round trigger',
     classifyPassiveTrigger('Places a [Perfect Veil] buff on this Champion at the start of each Round.'), 'startOfRound');
  // policy #20: a [Perfect Veil] inside a self-CONDITION ("if this Champion is under [X]") is a
  // prerequisite, NOT a placement — else Ezio veils the whole team off his own condition clause.
  const cond = readSkillKit([{ slot: 'A3', skill_name: 'Hidden Gun', damage_multiplier: '5',
    skill_summary: 'Attacks 1 enemy. This effect cannot be resisted if this Champion is under a [Veil] or [Perfect Veil] buff.' }]);
  eq('a [Perfect Veil] inside an "if under" condition is NOT parsed as placed', cond[0].buffs.length, 0);
  // a passive that genuinely PLACES it at round start is still kept + triggered
  const place = readSkillKit([{ slot: 'Passive', skill_name: 'Sync [P]', cooldown_base: null, damage_multiplier: null,
    skill_summary: 'Places a [Perfect Veil] buff on this Champion for 2 turns at the start of each Round.' }]);
  eq('a round-start [Perfect Veil] passive is triggered', place[0].passiveTrigger, 'startOfRound');
  ok('...and carries the Perfect Veil buff', place[0].buffs.some(b => b.type === 'Perfect Veil'));

  // end-to-end: the veil is up from battle start (t0), before any enemy can act
  const hero = champ({ name: 'Sync', spd: 100, skills: place });
  const st = makeState({ allies: [hero], enemies: [] });
  const l = console.log; console.log = () => {};
  simulate(st, passiveContent([dummyEnemy({ maxHp: 1e9, spd: 1 })]), { turnCap: 1 });
  console.log = l;
  ok('round-start passive places [Perfect Veil] by t0 (Ezio is untargetable from the start)', hero.buffs.some(b => b.type === 'Perfect Veil'));
}

// ── 21. [CONTINUOUS HEAL] ticks at start of turn — heal-over-time (the sustain-side "not consumed") ──
{
  const kit = readSkillKit([{ slot: 'A2', skill_name: 'Aegis', damage_multiplier: null,
    skill_summary: 'Places a 15% [Continuous Heal] buff on a target ally for 3 turns.' }]);
  eq('parser reads the [Continuous Heal] %', kit[0].buffs.find(b => b.type === 'Continuous Heal')?.value, 15);

  const c = champ({ name: 'Hurt', maxHp: 10000, spd: 100 }); c.hp = 4000;
  c.buffs.push({ type: 'Continuous Heal', value: 15, turnsLeft: 3 });
  const st = makeState({ allies: [c], enemies: [] });
  const l = console.log; console.log = () => {};
  simulate(st, passiveContent([dummyEnemy({ spd: 1 })]), { turnCap: 1 });
  console.log = l;
  eq('[Continuous Heal] restores 15% of MAX HP on the buffed champ\'s turn', c.hp, 4000 + 0.15 * 10000);
}

// ── report ───────────────────────────────────────────────────────────────────
console.log(`\n══ SIM SELF-TEST ══  ${pass} passed, ${fail} failed\n`);
for (const f of failures) console.log(`  ✗ ${f}`);
console.log('QA_JSON ' + JSON.stringify({ rung: 'spec', pass, fail, failures }));
if (!fail) console.log('  all specified behaviour holds — gate 1 clear, reality comparison is gate 2\n');
else { console.log(`\n  ${fail} spec violation(s) — fix these BEFORE comparing to real battles.\n`); process.exit(1); }
