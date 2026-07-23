// tools/sim-sensitivity.mjs — QA PROTOCOL RUNG 6: sensitivity tests.
//
// The sim's conclusions should change in SENSIBLE DIRECTIONS when one input moves (Simulator QA
// Protocol §6). Each test is metamorphic: baseline vs one-input-perturbed, comparing a measured
// output. Two rules keep this honest:
//   - Only assert directions that rest on IMPLEMENTED mechanics; sensitivities that need unimplemented
//     mechanics are LISTED as informational, never asserted (they'd be false bucket-1 failures).
//   - Encode the PROJECT CARVE-OUTS (damage-mechanics.js game facts): DEF cuts ATTACK damage but does
//     NOTHING to Poison/%MaxHP; a naive "more DEF = less damage" table would assert a direction the
//     game does not have.
// A violated direction is a spec violation → orchestrator bucket 1 (blocks). Needs no reality, no DB.
// Run: node tools/sim-sensitivity.mjs

import { makeCombatant, makeState, simulate, actEnemyMob, applyDebuff } from '../lib/sim/engine.js';

let pass = 0, fail = 0; const failures = [];
const ok = (name, cond, detail = '') => { if (cond) pass++; else { fail++; failures.push(`${name}${detail ? ' — ' + detail : ''}`); } };
const silent = (fn) => { const o = console.log; console.log = () => {}; try { return fn(); } finally { console.log = o; } };

const champ = (o = {}) => makeCombatant({ name: o.name ?? 'C', side: 'ally', maxHp: o.maxHp ?? 20000, atk: o.atk ?? 2000, def: o.def ?? 1000, spd: o.spd ?? 100, acc: o.acc ?? 100, res: o.res ?? 100, critRate: 0, critDmg: 0, affinity: 'Void', skills: o.skills ?? [], ...o });
const boss = (o = {}) => { const b = makeCombatant({ name: o.name ?? 'Boss', side: 'enemy', role: 'boss', maxHp: o.maxHp ?? 1e9, atk: o.atk ?? 3000, def: o.def ?? 0, spd: o.spd ?? 100, acc: o.acc ?? 150, res: o.res ?? 150, critRate: 0, critDmg: 0, affinity: 'Void', skills: o.skills ?? [], ...o }); if (o.immune) b.immune = o.immune; return b; };
const run = (allies, enemies, cap, content) => silent(() => simulate(makeState({ allies, enemies: [] }), content ?? { phases: [{ name: 'boss', enemies, actEnemy: actEnemyMob }] }, { turnCap: cap }));
const countTurns = (allies, enemies, cap, name) => {
  let out = ''; const o = console.log; console.log = (...a) => { out += a.join(' ') + '\n'; };
  try { simulate(makeState({ allies, enemies: [] }), { phases: [{ name: 'boss', enemies, actEnemy: actEnemyMob }] }, { turnCap: cap, trace: true }); } finally { console.log = o; }
  return out.split('\n').filter(l => { const t = l.trim(); return t.startsWith('t') && t.replace(/^t\s*\d+\s+/, '').startsWith(name); }).length;
};

// ── T1: ACC↑ → more debuffs land ─────────────────────────────────────────────────
{
  const mk = (acc) => champ({ acc, skills: [{ slot: 'A1', cooldown: 0, cdLeft: 0, hitsEnemies: true, coeff: 1, debuffs: [{ type: 'Decrease Attack', value: 50, turns: 5 }] }] });
  const bLo = boss({ res: 150 }), bHi = boss({ res: 150 });
  run([mk(100)], [bLo], 1); run([mk(250)], [bHi], 1);
  const lo = bLo.debuffs.length, hi = bHi.debuffs.length;
  ok('ACC↑ lands more debuffs (and the test ran)', hi >= lo && hi > 0, `acc100→${lo} debuffs, acc250→${hi}`);
}

// ── T2: RES↑ → fewer ENEMY debuffs land on me ────────────────────────────────────
{
  const mob = () => boss({ role: 'wave', maxHp: 1e9, acc: 150, skills: [{ slot: 'A1', cooldown: 0, cdLeft: 0, hitsEnemies: true, coeff: 0.01, debuffs: [{ type: 'Decrease Attack', value: 50, turns: 5 }] }] });
  const lo = champ({ res: 50, skills: [{ slot: 'A1', cooldown: 0, cdLeft: 0, hitsEnemies: false }] });
  const hi = champ({ res: 250, skills: [{ slot: 'A1', cooldown: 0, cdLeft: 0, hitsEnemies: false }] });
  run([lo], [mob()], 4); run([hi], [mob()], 4);
  ok('RES↑ resists more enemy debuffs (and the test ran)', hi.debuffs.length <= lo.debuffs.length && lo.debuffs.length > 0, `res50→${lo.debuffs.length}, res250→${hi.debuffs.length}`);
}

// ── T3: DEF↑ → less ATTACK damage taken ──────────────────────────────────────────
{
  const mob = () => boss({ role: 'wave', maxHp: 1e9, atk: 4000, skills: [{ slot: 'A1', cooldown: 0, cdLeft: 0, hitsEnemies: true, coeff: 1 }] });
  const lo = champ({ def: 500, skills: [{ slot: 'A1', cooldown: 0, cdLeft: 0, hitsEnemies: false }] });
  const hi = champ({ def: 3000, skills: [{ slot: 'A1', cooldown: 0, cdLeft: 0, hitsEnemies: false }] });
  run([lo], [mob()], 6); run([hi], [mob()], 6);
  const lossLo = lo.maxHp - lo.hp, lossHi = hi.maxHp - hi.hp;
  ok('DEF↑ reduces ATTACK damage taken (and the test ran)', lossHi < lossLo && lossLo > 0, `def500 lost ${Math.round(lossLo)}, def3000 lost ${Math.round(lossHi)}`);
}

// ── T4 (CARVE-OUT): DEF↑ does NOTHING to POISON damage (DoT is DEF-independent) ──
{
  const mk = (def) => { const c = champ({ def, spd: 100, skills: [{ slot: 'A1', cooldown: 0, cdLeft: 0, hitsEnemies: false }] }); c.debuffs.push({ type: 'Poison', pct: 0.05, stacks: 2, turnsLeft: 5 }); return c; };
  const lo = mk(500), hi = mk(3000);
  run([lo], [boss({ spd: 1 })], 1); run([hi], [boss({ spd: 1 })], 1);
  const lossLo = lo.maxHp - lo.hp, lossHi = hi.maxHp - hi.hp;
  ok('DEF does NOT change POISON damage (game fact: DoT is DEF-independent)', lossLo === lossHi && lossLo > 0, `def500 lost ${Math.round(lossLo)}, def3000 lost ${Math.round(lossHi)}`);
}

// ── T5: champ SPD↑ → more damage dealt over a fixed turn budget ──────────────────
{
  const mk = (spd) => champ({ spd, atk: 1000, skills: [{ slot: 'A1', cooldown: 0, cdLeft: 0, hitsEnemies: true, coeff: 1 }] });
  const bSlow = boss({ maxHp: 1e9, spd: 100 }), bFast = boss({ maxHp: 1e9, spd: 100 });
  run([mk(100)], [bSlow], 60); run([mk(200)], [bFast], 60);
  const lossSlow = 1e9 - bSlow.hp, lossFast = 1e9 - bFast.hp;
  ok('champ SPD↑ deals more damage over fixed turns (and the test ran)', lossFast >= lossSlow && lossSlow > 0, `spd100→${Math.round(lossSlow)}, spd200→${Math.round(lossFast)}`);
}

// ── T6: boss SPD↓ → more ALLY actions ────────────────────────────────────────────
{
  const team = () => [champ({ name: 'Ally1', maxHp: 1e7, spd: 120, skills: [{ slot: 'A1', cooldown: 0, cdLeft: 0, hitsEnemies: true, coeff: 0.01 }] })];
  const slowBoss = boss({ maxHp: 1e9, spd: 60, atk: 10 }), fastBoss = boss({ maxHp: 1e9, spd: 150, atk: 10 });
  const withFast = countTurns(team(), [fastBoss], 80, 'Ally1');
  const withSlow = countTurns(team(), [slowBoss], 80, 'Ally1');
  ok('boss SPD↓ gives allies more actions (and the test ran)', withSlow >= withFast && withFast > 0, `bossSpd150→${withFast} ally turns, bossSpd60→${withSlow}`);
}

// ── T7: a reviver RECOVERS a death (remove it → deaths stick) ─────────────────────
{
  const build = (withRevive) => {
    const squishy = champ({ name: 'Squishy', maxHp: 6000, def: 0, spd: 130, skills: [{ slot: 'A1', cooldown: 0, cdLeft: 0, hitsEnemies: false }] });
    const reviver = champ({ name: 'Reviver', maxHp: 40000, def: 4000, spd: 90, skills: [{ slot: 'A1', cooldown: 0, cdLeft: 0, hitsEnemies: false }, { slot: 'A3', cooldown: 0, cdLeft: 0, hitsEnemies: false, revives: withRevive }] });
    const b = boss({ maxHp: 1e9, atk: 5000, spd: 110, skills: [{ slot: 'A1', cooldown: 0, cdLeft: 0, hitsEnemies: true, aoe: false, coeff: 1 }] });
    run([squishy, reviver], [b], 30);
    return { squishy, reviver };
  };
  const withR = build(true), withoutR = build(false);
  const aliveWith = [withR.squishy, withR.reviver].filter(c => c.alive).length;
  const aliveWithout = [withoutR.squishy, withoutR.reviver].filter(c => c.alive).length;
  ok('a reviver recovers deaths (removing it never helps)', aliveWith >= aliveWithout && !withoutR.squishy.alive, `alive with reviver ${aliveWith}, without ${aliveWithout}`);
}

// ── T8: CC on enemies (wave control) → fewer ENEMY actions ────────────────────────
{
  const ccChamp = (cc) => champ({ name: 'Cc', spd: 160, acc: 300, skills: [{ slot: 'A1', cooldown: 0, cdLeft: 0, hitsEnemies: true, coeff: 0.001, debuffs: cc ? [{ type: 'Stun', turns: 1 }] : [] }] });
  const mkMob = () => boss({ name: 'Mob', role: 'wave', maxHp: 1e9, atk: 10, spd: 90, res: 0 });   // res 0 so Stun lands; not boss-immune
  const noCc = countTurns([ccChamp(false)], [mkMob()], 60, 'Mob');
  const withCc = countTurns([ccChamp(true)], [mkMob()], 60, 'Mob');
  ok('CC on enemies reduces their actions (and the test ran)', withCc <= noCc && noCc > 0, `noCC→${noCc} mob turns, withCC→${withCc}`);
}

// ── T9: [Decrease Defense] on an enemy → MORE ATTACK damage into it ───────────────
{
  const mk = () => champ({ atk: 2000, spd: 100, skills: [{ slot: 'A1', cooldown: 0, cdLeft: 0, hitsEnemies: true, coeff: 1 }] });
  const bare = boss({ maxHp: 1e9, def: 3000, spd: 1 });
  const shredded = boss({ maxHp: 1e9, def: 3000, spd: 1 }); applyDebuff(shredded, { type: 'Decrease Defense', value: 60, turns: 5 });
  run([mk()], [bare], 1); run([mk()], [shredded], 1);
  const dmgBare = 1e9 - bare.hp, dmgShred = 1e9 - shredded.hp;
  ok('Decrease DEF↑ raises ATTACK damage dealt (and the test ran)', dmgShred > dmgBare && dmgBare > 0, `no-shred→${Math.round(dmgBare)}, 60% shred→${Math.round(dmgShred)}`);
}

// ── T10 (CARVE-OUT): [Decrease Defense] does NOTHING to POISON damage (DoT is DEF-independent) ──
{
  const mk = (shred) => { const c = champ({ def: 3000, spd: 100, skills: [{ slot: 'A1', cooldown: 0, cdLeft: 0, hitsEnemies: false }] }); c.debuffs.push({ type: 'Poison', pct: 0.05, stacks: 2, turnsLeft: 5 }); if (shred) c.debuffs.push({ type: 'Decrease Defense', value: 60, turnsLeft: 5 }); return c; };
  const plain = mk(false), shredded = mk(true);
  run([plain], [boss({ spd: 1 })], 1); run([shredded], [boss({ spd: 1 })], 1);
  const lossPlain = plain.maxHp - plain.hp, lossShred = shredded.maxHp - shredded.hp;
  ok('Decrease DEF does NOT change POISON damage (game fact: DoT is DEF-independent)', lossPlain === lossShred && lossPlain > 0, `no-shred lost ${Math.round(lossPlain)}, 60% shred lost ${Math.round(lossShred)}`);
}

// ── informational: sensitivities NOT asserted because they need unimplemented mechanics ──
const notTested = [
  'Add one Fire-Knight hit → shield removal easier  [needs FK shield module — not built]',
  '[Ignore Defense] skill flag → more ATTACK damage  [skill-level DEF-ignore not parsed yet — unimplemented]',
];

// ── report ───────────────────────────────────────────────────────────────────
console.log(`\n══ SIM SENSITIVITY (rung 6) ══  ${pass} directions held, ${fail} violated\n`);
for (const f of failures) console.log(`  ✗ ${f}`);
if (!fail) console.log('  every asserted direction moved the right way (carve-outs included)\n');
console.log('  not asserted (need unimplemented mechanics):');
for (const n of notTested) console.log(`    · ${n}`);
console.log('QA_JSON ' + JSON.stringify({ rung: 'sensitivity', pass, fail, failures, notTested }));
if (fail) process.exit(1);
