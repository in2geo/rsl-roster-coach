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

// 9 — BUFF→STAT CONSUMER: [Increase/Decrease ATK/DEF] fold into the damage math (exact numbers).
// Bambus A1 = 3.8×ATK, def_mit = 1500/(1500+def), crit/affinity/variance off. Base with atk=3000, def=1000:
//   3.8 × 3000 × (1500/2500=0.6) = 6,840.  Each buff/debuff reads its OWN magnitude — no constant.
{
  const B = (type, value) => ({ type, value, turnsLeft: 2 });
  const statHit = ({ atkBuffs = [], atkDebuffs = [], tgtBuffs = [], tgtDebuffs = [], atk = 3000, tdef = 1000 }) => {
    const a = makeCombatant({ name: 'Bambus', side: 'ally', atk, affinity: 'Void', critRate: 0, critDmg: 0 });
    a.buffs.push(...atkBuffs); a.debuffs.push(...atkDebuffs);
    const t = makeCombatant({ name: 'Mob', side: 'enemy', maxHp: 1e9, def: tdef, affinity: 'Void' });
    t.buffs.push(...tgtBuffs); t.debuffs.push(...tgtDebuffs);
    return applyRecipe(makeState({ allies: [a], enemies: [t], seed: null }), a, RECIPES['BAMBUS-A1'])[0];
  };
  const base = statHit({});
  check('stat consumer — baseline 3.8×3000 × defMit0.6 = 6,840', base.raw_damage === 6840, `raw ${base.raw_damage}`);
  // [Increase DEF] 60 on TARGET → effDef 1600, defMit 1500/3100 → 3.8×3000×0.48387 = 5,516
  check('[Increase DEF] on target lowers landed damage (6,840 → 5,516)', statHit({ tgtBuffs: [B('Increase DEF', 60)] }).raw_damage === 5516);
  // [Decrease Attack] 50 on ATTACKER → effATK 1500 → 3.8×1500×0.6 = 3,420
  check('[Decrease Attack] on attacker halves its damage (6,840 → 3,420)', statHit({ atkDebuffs: [B('Decrease Attack', 50)] }).raw_damage === 3420);
  // [Increase ATK] 50 on ATTACKER → effATK 4500 → 3.8×4500×0.6 = 10,260
  check('[Increase ATK] on attacker raises its damage (6,840 → 10,260)', statHit({ atkBuffs: [B('Increase ATK', 50)] }).raw_damage === 10260);
  // non-stacking: two [Increase DEF] 60 == one (Raid refreshes, never stacks magnitude)
  check('two [Increase DEF] do NOT stack — same as one (5,516)', statHit({ tgtBuffs: [B('Increase DEF', 60), B('Increase DEF', 60)] }).raw_damage === 5516);
  // net of opposing mods on one unit: (1+0.5)(1−0.5)=0.75 → effATK 2250 → 3.8×2250×0.6 = 5,130
  check('[Increase ATK]+[Decrease Attack] net to ×0.75 (5,130)', statHit({ atkBuffs: [B('Increase ATK', 50)], atkDebuffs: [B('Decrease Attack', 50)] }).raw_damage === 5130);
}

// 10 — THE CROSS-EFFECT: a DEF-scaling attacker (Vergis, offense uses effective DEF) under [Increase DEF]
// hits ~60% harder. This is why offense and defense share ONE statFactor — the buff can't be inert on either side.
{
  const vergis = (buffs) => {
    const v = makeCombatant({ name: 'Vergis', side: 'ally', atk: 0, def: 1500, affinity: 'Void', critRate: 0, critDmg: 0 });
    v.buffs.push(...buffs);
    const t = makeCombatant({ name: 'Mob', side: 'enemy', maxHp: 1e9, def: 1000, affinity: 'Void' });
    return applyRecipe(makeState({ allies: [v], enemies: [t], seed: null }), v, RECIPES['VERGIS-A1'])[0];
  };
  const vb = vergis([]), vi = vergis([{ type: 'Increase DEF', value: 60, turnsLeft: 2 }]);
  check('Vergis (DEF-scaler) under [Increase DEF] hits ×1.6 (offense reads effective DEF)', Math.abs(vi.raw_damage / vb.raw_damage - 1.6) < 0.01, `base ${vb.raw_damage} buffed ${vi.raw_damage}`);
}

// 11 — PELOPS A2 DYNAMIC SCALER: +10% dmg per TURN REMAINING on debuffs on self & target, bonus ≤ +200%.
// F_PELOPS_A2 = 0.4×HP, def_mit 1500/2500 = 0.6, crit/affinity/variance off. hp=100000, target def=1000:
//   base = 0.4 × 100,000 × 0.6 = 24,000. Each debuff-turn = +10% (reads turnsLeft — turn-weighted, not a count).
{
  const D = (turnsLeft) => ({ type: 'Dbf', turnsLeft });
  const a2 = ({ selfDebuffs = [], tgtDebuffs = [] } = {}) => {
    const p = makeCombatant({ name: 'Pelops', side: 'ally', atk: 0, maxHp: 100000, affinity: 'Void', critRate: 0, critDmg: 0 });
    p.debuffs.push(...selfDebuffs);
    const t = makeCombatant({ name: 'Mob', side: 'enemy', maxHp: 1e9, def: 1000, affinity: 'Void' });
    t.debuffs.push(...tgtDebuffs);
    return applyRecipe(makeState({ allies: [p], enemies: [t], seed: null }), p, RECIPES['PELOPS-A2'])[0];
  };
  check('Pelops A2 — no debuffs → base 0.4×100k × defMit0.6 = 24,000', a2().raw_damage === 24000, `raw ${a2().raw_damage}`);
  // target 2 debuffs × 2 turns = 4 debuff-turns → +40% → ×1.4 → 33,600
  check('Pelops A2 — 4 debuff-turns on target → ×1.4 = 33,600', a2({ tgtDebuffs: [D(2), D(2)] }).raw_damage === 33600, `raw ${a2({ tgtDebuffs: [D(2), D(2)] }).raw_damage}`);
  // self 3 turns + target 4 turns = 7 debuff-turns → +70% → ×1.7 → 40,800 (self AND target both count)
  check('Pelops A2 — self+target both count (7 turns → ×1.7 = 40,800)', a2({ selfDebuffs: [D(3)], tgtDebuffs: [D(2), D(2)] }).raw_damage === 40800);
  // 25 debuff-turns → bonus +250% CAPPED to +200% → ×3.0 → 72,000 (not ×3.5)
  check('Pelops A2 — bonus caps at +200% (25 turns → ×3.0 = 72,000)', a2({ tgtDebuffs: [D(25)] }).raw_damage === 72000, `raw ${a2({ tgtDebuffs: [D(25)] }).raw_damage}`);
}

console.log(`\n=== ${pass} passed, ${fail} failed ===\n`);
process.exit(fail ? 1 : 0);
