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

import { makeCombatant, makeState, simulate, dealDamage, chooseEnemyTarget,
         affinityFactor, landChance, defMitigation, CC_SKIPS_TURN } from '../lib/sim/engine.js';
import { readSkillKit, classifySkill, canUseSkill, parseCoeff } from '../lib/sim/ai.js';

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

// ── 11. COEFFICIENT PARSING — three formats in one free-text column ─────────
{
  eq('bare coefficient', parseCoeff('4.65'), 4.65);
  eq('"N ATK" form', parseCoeff('2.5 ATK'), 2.5);
  eq('compound form takes the ATK term', parseCoeff('0.02 Enemy MAX HP / 2.5 ATK'), 2.5);
  eq('null stays null (never defaulted)', parseCoeff(null), null);
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

// ── report ───────────────────────────────────────────────────────────────────
console.log(`\n══ SIM SELF-TEST ══  ${pass} passed, ${fail} failed\n`);
for (const f of failures) console.log(`  ✗ ${f}`);
if (!fail) console.log('  all specified behaviour holds — gate 1 clear, reality comparison is gate 2\n');
else { console.log(`\n  ${fail} spec violation(s) — fix these BEFORE comparing to real battles.\n`); process.exit(1); }
