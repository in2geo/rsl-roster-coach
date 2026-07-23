// tools/sim-invariants.mjs — QA PROTOCOL RUNG 5: behavioural invariants (property-based).
//
// Some statements must hold in EVERY battle, whatever the inputs. We generate many randomised
// battles from a SEEDED PRNG (so any failure reproduces exactly — Simulator QA Protocol §5) and
// assert the invariants on each, plus two metamorphic controlled tests. A violation is a SPEC
// violation (the sim contradicts a rule that must always be true) → it lands in the orchestrator's
// bucket 1 and BLOCKS. This rung needs no reality and no sim completeness — it is pure spec.
//
// Run: node tools/sim-invariants.mjs   (no DB)

import { makeCombatant, makeState, simulate, actEnemyMob } from '../lib/sim/engine.js';

const N = 400;                 // randomised battles
const CAP = 200;               // turn cap per battle
let pass = 0, fail = 0; const failures = [];
const ok = (name, cond, detail = '') => { if (cond) pass++; else { fail++; failures.push(`${name}${detail ? ' — ' + detail : ''}`); } };

// deterministic PRNG so a failing seed can be replayed
const mulberry32 = (a) => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };

const withSilentSim = (fn) => { const o = console.log; console.log = () => {}; try { return fn(); } finally { console.log = o; } };

// ── scenario generator (pure function of the seed) ──────────────────────────────
const AFF = ['Magic', 'Spirit', 'Force', 'Void'];
const DEBUFFS = ['Poison', 'Decrease Attack', 'Weaken', 'Stun', 'Freeze'];
function genScenario(seed) {
  const r = mulberry32(seed);
  const ri = (a, b) => a + Math.floor(r() * (b - a + 1));
  const pick = (arr) => arr[Math.floor(r() * arr.length)];
  const mkSkill = (slot) => ({
    slot, cooldown: ri(0, 4), cdLeft: 0,
    hitsEnemies: r() < 0.85, aoe: r() < 0.3,
    coeff: r() < 0.7 ? +(1 + r() * 4).toFixed(1) : null,
    debuffs: r() < 0.4 ? [{ type: pick(DEBUFFS), pct: 0.05, value: 30, turns: ri(1, 3), stacking: true, maxStacks: 10 }] : [],
    buffs: r() < 0.2 ? [{ type: 'Shield', value: ri(1000, 5000), turns: 2 }] : [],
    healPct: r() < 0.2 ? 0.15 : null,
  });
  const mkChamp = (i) => {
    const c = makeCombatant({
      name: `Ally${i}`, side: 'ally', maxHp: ri(10000, 30000), atk: ri(1000, 4000), def: ri(500, 3000),
      spd: ri(90, 200), acc: ri(0, 200), res: ri(0, 200), critRate: ri(0, 100), critDmg: ri(50, 150),
      affinity: pick(AFF), skills: [mkSkill('A1'), ...(r() < 0.7 ? [mkSkill('A2')] : []), ...(r() < 0.5 ? [mkSkill('A3')] : [])],
    });
    if (r() < 0.3) c.debuffs.push({ type: 'Poison', pct: 0.05, stacks: ri(1, 3), turnsLeft: ri(1, 4) });
    return c;
  };
  const allies = Array.from({ length: ri(2, 4) }, (_, i) => mkChamp(i + 1));
  const boss = makeCombatant({
    name: 'Boss', side: 'enemy', role: 'boss', maxHp: ri(200000, 900000), atk: ri(3000, 7000), def: ri(2000, 5000),
    spd: ri(90, 150), acc: ri(100, 250), res: ri(100, 300), critRate: 15, critDmg: 50, affinity: pick(AFF),
    skills: [{ slot: 'A1', cooldown: 0, cdLeft: 0, hitsEnemies: true, aoe: r() < 0.5, coeff: +(1 + r() * 3).toFixed(1),
               debuffs: [{ type: 'Poison', pct: 0.05, turns: 2, stacking: true, maxStacks: 10 }] }],
  });
  boss.immune = ['Stun', 'Freeze', 'Sleep'];      // to exercise the immunity invariant
  return { allies, boss, content: { phases: [{ name: 'boss', enemies: [boss], actEnemy: actEnemyMob }] } };
}

// ── invariants checked on the FINAL state of every randomised battle ─────────────
function checkInvariants(seed) {
  const { allies, boss, content } = genScenario(seed);
  const res = withSilentSim(() => { const st = makeState({ allies, enemies: [] }); return simulate(st, content, { turnCap: CAP }); });
  const all = [...allies, boss];
  for (const c of all) {
    ok('HP never exceeds MAX HP', c.hp <= c.maxHp + 0.5, `seed ${seed}: ${c.name} ${c.hp}/${c.maxHp}`);
    ok('alive/dead is consistent with HP', c.alive ? c.hp > 0 : c.hp <= 0, `seed ${seed}: ${c.name} alive=${c.alive} hp=${c.hp}`);
    for (const s of c.skills ?? []) ok('cooldown never goes negative', (s.cdLeft ?? 0) >= 0, `seed ${seed}: ${c.name} ${s.slot} cd=${s.cdLeft}`);
    for (const d of c.debuffs ?? []) ok('debuff duration never negative', (d.turnsLeft ?? 1) >= 0, `seed ${seed}: ${c.name} ${d.type}=${d.turnsLeft}`);
    for (const b of c.buffs ?? []) ok('buff duration never negative', (b.turnsLeft ?? 1) >= 0, `seed ${seed}: ${c.name} ${b.type}=${b.turnsLeft}`);
  }
  for (const t of boss.immune ?? []) ok('an immune target never carries the immune debuff', !boss.debuffs.some(d => d.type === t), `seed ${seed}: boss has ${t}`);
  return res;
}

// count the seeds first so the summary counts BATTLES, not per-battle asserts
let overMax = 0, negCd = 0, immuneBreak = 0;
for (let seed = 1; seed <= N; seed++) checkInvariants(seed);

// ── metamorphic 1: SAME INPUT -> SAME BATTLE (determinism; catches any unseeded RNG) ─────────────
for (const seed of [7, 42, 123, 999, 2718]) {
  const a = withSilentSim(() => { const s = genScenario(seed); return simulate(makeState({ allies: s.allies, enemies: [] }), s.content, { turnCap: CAP }); });
  const b = withSilentSim(() => { const s = genScenario(seed); return simulate(makeState({ allies: s.allies, enemies: [] }), s.content, { turnCap: CAP }); });
  ok('same input -> same battle (deterministic)', a.won === b.won && a.turns === b.turns, `seed ${seed}: ${a.won}/${a.turns} vs ${b.won}/${b.turns}`);
}

// ── metamorphic 2: MORE SPEED -> NOT FEWER ACTIONS ──────────────────────────────
function buildSpeedScenario(spdA) {
  const A = makeCombatant({ name: 'Aspd', side: 'ally', maxHp: 1e7, atk: 500, def: 5000, spd: spdA, acc: 200, res: 200, affinity: 'Void', skills: [{ slot: 'A1', cooldown: 0, cdLeft: 0, hitsEnemies: true, coeff: 1 }] });
  const B = makeCombatant({ name: 'Bslow', side: 'ally', maxHp: 1e7, atk: 500, def: 5000, spd: 120, acc: 200, res: 200, affinity: 'Void', skills: [{ slot: 'A1', cooldown: 0, cdLeft: 0, hitsEnemies: true, coeff: 1 }] });
  const boss = makeCombatant({ name: 'Boss', side: 'enemy', role: 'boss', maxHp: 1e9, atk: 10, def: 0, spd: 100, affinity: 'Void', skills: [{ slot: 'A1', cooldown: 0, cdLeft: 0, hitsEnemies: true, coeff: 0.1 }] });
  return { allies: [A, B], content: { phases: [{ name: 'boss', enemies: [boss], actEnemy: actEnemyMob }] } };
}
function countTurns(spdA, name) {
  let out = ''; const o = console.log; console.log = (...a) => { out += a.join(' ') + '\n'; };
  try { const s = buildSpeedScenario(spdA); simulate(makeState({ allies: s.allies, enemies: [] }), s.content, { turnCap: 80, trace: true }); } finally { console.log = o; }
  // count trace lines whose ACTOR (right after "t<n>") is `name` — a multiline regex silently matched
  // NOTHING here (0 vs 0 = a vacuous pass the teeth check caught), so split and test the actor column.
  return out.split('\n').filter(l => { const t = l.trim(); return t.startsWith('t') && t.replace(/^t\s*\d+\s+/, '').startsWith(name); }).length;
}
{
  const slow = countTurns(120, 'Aspd'), fast = countTurns(220, 'Aspd');
  // slow > 0 guards against a vacuous pass: if the counter breaks and returns 0, this FAILS loudly.
  ok('more SPD never yields FEWER actions (and the test actually ran)', fast >= slow && slow > 0, `120spd->${slow} turns, 220spd->${fast} turns`);
}

// ── metamorphic 3: REMOVING SUSTAIN CANNOT IMPROVE SURVIVAL ──────────────────────
function survivalHp(withHeal) {
  const heal = makeCombatant({ name: 'Heal', side: 'ally', maxHp: 20000, atk: 800, def: 1000, spd: 130, acc: 100, res: 100, affinity: 'Void',
    skills: [{ slot: 'A1', cooldown: 0, cdLeft: 0, hitsEnemies: true, coeff: 1 }, { slot: 'A2', cooldown: 0, cdLeft: 0, hitsEnemies: false, healPct: withHeal ? 0.2 : null }] });
  const buddy = makeCombatant({ name: 'Buddy', side: 'ally', maxHp: 20000, atk: 800, def: 1000, spd: 110, acc: 100, res: 100, affinity: 'Void', skills: [{ slot: 'A1', cooldown: 0, cdLeft: 0, hitsEnemies: true, coeff: 1 }] });
  const boss = makeCombatant({ name: 'Boss', side: 'enemy', role: 'boss', maxHp: 1e9, atk: 2500, def: 0, spd: 120, affinity: 'Void', skills: [{ slot: 'A1', cooldown: 0, cdLeft: 0, hitsEnemies: true, aoe: true, coeff: 1 }] });
  const st = makeState({ allies: [heal, buddy], enemies: [] });
  withSilentSim(() => simulate(st, { phases: [{ name: 'boss', enemies: [boss], actEnemy: actEnemyMob }] }, { turnCap: 60 }));
  return [heal, buddy].reduce((s, c) => s + Math.max(0, c.hp), 0);
}
{
  const withH = survivalHp(true), without = survivalHp(false);
  // without < full (40000) guards against a vacuous pass — the boss must have dealt real damage.
  ok('removing a heal cannot IMPROVE survival (and the boss dealt real damage)', withH >= without && without < 40000, `withHeal ${Math.round(withH)} vs without ${Math.round(without)}`);
}

// ── report ───────────────────────────────────────────────────────────────────
console.log(`\n══ SIM INVARIANTS (rung 5) ══  ${pass} checks passed, ${fail} failed  (over ${N} random battles + metamorphic)\n`);
const shown = [...new Set(failures)].slice(0, 20);
for (const f of shown) console.log(`  ✗ ${f}`);
if (!fail) console.log('  every invariant holds — no rule was violated across the random corpus\n');
console.log('QA_JSON ' + JSON.stringify({ rung: 'invariants', pass, fail, failures: [...new Set(failures)].slice(0, 30) }));
if (fail) process.exit(1);
