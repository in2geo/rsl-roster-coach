// tools/sim-snapshot.mjs — QA PROTOCOL RUNG 10: regression snapshot (characterization / golden-master).
//
// THE GAP THIS CLOSES. Rung 4 compares the sim to REALITY; but the sim is deliberately INCOMPLETE, so
// its reality mismatches are EXPECTED (bucket 4) and never block. That leaves a blind spot: an
// UNINTENDED behaviour change — a refactor that shifts the Dragon win, kills a healer 20 turns earlier,
// or drops damage 3% — lands INSIDE an already-failing metric and nothing notices. "Did we get worse?"
// is exactly the question MODEL_AS_REIMPLEMENTATION says the metric must answer, and reality-comparison
// cannot answer it in the known-wrong region.
//
// So this rung pins the sim's OWN current output. A fixed set of deterministic scenarios (seed=null → v0,
// bit-reproducible) is run and fingerprinted; the fingerprints are frozen in test/snapshots/*.json. On
// every run we DIFF against that baseline. A diff is not "wrong vs the game" — it is "the engine no
// longer does what it did at the last blessing." That is a REGRESSION SIGNAL: it BLOCKS until a human
// confirms the change was intended by re-blessing (SNAPSHOT_BLESS=1), the standard golden-master loop.
// When you fix healer survival, the snapshot will light up EXACTLY the scenarios you moved — re-bless
// them in the same commit and the diff becomes your changelog.
//
// Run:  node tools/sim-snapshot.mjs              # compare against the frozen baseline
//       SNAPSHOT_BLESS=1 node tools/sim-snapshot.mjs   # freeze current behaviour as the new baseline

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { makeCombatant, makeState, simulate, actEnemyMob } from '../lib/sim/engine.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SNAP = path.join(__dirname, '..', 'test', 'snapshots', 'engine-behavior.json');

// ── scenario builders — FIXED inputs, no RNG, no DB. Each exercises a different mechanic cluster so a
// regression in any one lights up a specific scenario rather than smearing across all of them. ────────
const champ = (o) => makeCombatant({ side: 'ally', critRate: 0, critDmg: 0, affinity: 'Void', ...o });
const boss = (o) => makeCombatant({ side: 'enemy', role: 'boss', critRate: 0, critDmg: 0, affinity: 'Void', acc: 150, res: 150, ...o });
const mob = (o) => makeCombatant({ side: 'enemy', role: 'wave', critRate: 0, critDmg: 0, affinity: 'Void', acc: 150, res: 100, ...o });
const bossPhase = (enemies) => ({ phases: [{ name: 'boss', enemies, actEnemy: actEnemyMob }] });

const SCENARIOS = {
  // 1. Attrition: no sustain, a hard-hitting boss → a predictable wipe at a fixed turn.
  attrition: () => {
    const a1 = champ({ name: 'Striker', maxHp: 18000, atk: 2200, def: 900, spd: 130, skills: [{ slot: 'A1', cooldown: 0, cdLeft: 0, hitsEnemies: true, coeff: 2.5 }] });
    const a2 = champ({ name: 'Bruiser', maxHp: 22000, atk: 1600, def: 1400, spd: 105, skills: [{ slot: 'A1', cooldown: 0, cdLeft: 0, hitsEnemies: true, coeff: 2.0 }] });
    return { allies: [a1, a2], content: bossPhase([boss({ name: 'Boss', maxHp: 400000, atk: 4200, def: 1200, spd: 120, aoe: true, skills: [{ slot: 'A1', cooldown: 0, cdLeft: 0, hitsEnemies: true, aoe: true, coeff: 1.4 }] })]) };
  },
  // 2. Sustained: same fight, one champ carries a heal → the team survives longer / wins.
  sustained: () => {
    const heal = champ({ name: 'Cleric', maxHp: 20000, atk: 1200, def: 1200, spd: 120, skills: [{ slot: 'A1', cooldown: 0, cdLeft: 0, hitsEnemies: true, coeff: 1.2 }, { slot: 'A2', cooldown: 2, cdLeft: 0, hitsEnemies: false, healPct: 0.25 }] });
    const dps = champ({ name: 'Blade', maxHp: 19000, atk: 2400, def: 1000, spd: 110, skills: [{ slot: 'A1', cooldown: 0, cdLeft: 0, hitsEnemies: true, coeff: 2.6 }] });
    return { allies: [heal, dps], content: bossPhase([boss({ name: 'Boss', maxHp: 240000, atk: 3200, def: 1000, spd: 100, skills: [{ slot: 'A1', cooldown: 0, cdLeft: 0, hitsEnemies: true, aoe: true, coeff: 1.1 }] })]) };
  },
  // 3. DoT grind: poison stackers vs a high-HP boss → win via DEF-independent tick damage.
  dotGrind: () => {
    const p1 = champ({ name: 'Venom', maxHp: 21000, atk: 1500, def: 1200, spd: 140, acc: 250, skills: [{ slot: 'A1', cooldown: 0, cdLeft: 0, hitsEnemies: true, coeff: 1.0, debuffs: [{ type: 'Poison', pct: 0.05, turns: 4, stacking: true, maxStacks: 10 }] }] });
    const p2 = champ({ name: 'Toxin', maxHp: 20000, atk: 1400, def: 1100, spd: 118, acc: 250, skills: [{ slot: 'A1', cooldown: 0, cdLeft: 0, hitsEnemies: true, coeff: 1.0, debuffs: [{ type: 'Poison', pct: 0.05, turns: 4, stacking: true, maxStacks: 10 }] }] });
    return { allies: [p1, p2], content: bossPhase([boss({ name: 'Boss', maxHp: 500000, atk: 2600, def: 2000, spd: 95, skills: [{ slot: 'A1', cooldown: 0, cdLeft: 0, hitsEnemies: true, coeff: 1.0 }] })]) };
  },
  // 4. Shielded: a shield buff absorbs a chunk of the mob's hits (shield-consumption path).
  shielded: () => {
    const tank = champ({ name: 'Aegis', maxHp: 16000, atk: 1000, def: 1500, spd: 125, skills: [{ slot: 'A1', cooldown: 0, cdLeft: 0, hitsEnemies: true, coeff: 1.5 }, { slot: 'A2', cooldown: 3, cdLeft: 0, hitsEnemies: false, buffs: [{ type: 'Shield', value: 8000, turns: 3, self: true }] }] });
    return { allies: [tank], content: bossPhase([mob({ name: 'Mob', maxHp: 120000, atk: 2600, def: 800, spd: 100, skills: [{ slot: 'A1', cooldown: 0, cdLeft: 0, hitsEnemies: true, coeff: 1.2 }] })]) };
  },
  // 5. Revive: a squishy dies, the reviver brings it back (revive-after-death path).
  revive: () => {
    const squishy = champ({ name: 'Glass', maxHp: 7000, atk: 1800, def: 300, spd: 135, skills: [{ slot: 'A1', cooldown: 0, cdLeft: 0, hitsEnemies: true, coeff: 2.2 }] });
    const reviver = champ({ name: 'Priest', maxHp: 30000, atk: 900, def: 2500, spd: 100, skills: [{ slot: 'A1', cooldown: 0, cdLeft: 0, hitsEnemies: true, coeff: 1.0 }, { slot: 'A3', cooldown: 4, cdLeft: 0, hitsEnemies: false, revives: true }] });
    return { allies: [squishy, reviver], content: bossPhase([boss({ name: 'Boss', maxHp: 300000, atk: 5000, def: 1000, spd: 115, skills: [{ slot: 'A1', cooldown: 0, cdLeft: 0, hitsEnemies: true, coeff: 1.0 }] })]) };
  },
  // 6. Waves→boss: cooldowns and HP carry across a phase boundary (the mechanic a per-phase model can't see).
  wavesThenBoss: () => {
    const a1 = champ({ name: 'Vanguard', maxHp: 24000, atk: 2000, def: 1300, spd: 128, skills: [{ slot: 'A1', cooldown: 0, cdLeft: 0, hitsEnemies: true, coeff: 2.0 }, { slot: 'A3', cooldown: 3, cdLeft: 0, hitsEnemies: true, aoe: true, coeff: 2.4 }] });
    const a2 = champ({ name: 'Support', maxHp: 22000, atk: 1200, def: 1400, spd: 112, skills: [{ slot: 'A1', cooldown: 0, cdLeft: 0, hitsEnemies: true, coeff: 1.4 }, { slot: 'A2', cooldown: 3, cdLeft: 0, hitsEnemies: false, healPct: 0.15 }] });
    const content = { phases: [
      { name: 'wave1', enemies: [mob({ name: 'Add', maxHp: 40000, atk: 1800, def: 600, spd: 100, skills: [{ slot: 'A1', cooldown: 0, cdLeft: 0, hitsEnemies: true, coeff: 1.0 }] }), mob({ name: 'Add2', maxHp: 40000, atk: 1800, def: 600, spd: 98, skills: [{ slot: 'A1', cooldown: 0, cdLeft: 0, hitsEnemies: true, coeff: 1.0 }] })], actEnemy: actEnemyMob },
      { name: 'boss', enemies: [boss({ name: 'Boss', maxHp: 260000, atk: 3000, def: 1100, spd: 118, skills: [{ slot: 'A1', cooldown: 0, cdLeft: 0, hitsEnemies: true, aoe: true, coeff: 1.1 }] })], actEnemy: actEnemyMob },
    ] };
    return { allies: [a1, a2], content };
  },
};

// ── run + fingerprint ──────────────────────────────────────────────────────────
const hpPct = (c) => Math.round(100 * Math.max(0, c.hp) / (c.maxHp || 1));
function fingerprint(build) {
  const { allies, content } = build();
  const st = makeState({ allies, enemies: [] });   // seed=null → deterministic v0
  const o = console.log; console.log = () => {};
  let res; try { res = simulate(st, content, { turnCap: 300 }); } finally { console.log = o; }
  return {
    won: res.won, turns: res.turns,
    failedPhase: res.failedPhase ?? null,
    deaths: res.deaths.length, revives: res.revives.length,
    survivors: res.survivors.slice().sort(),
    allies: allies.map(a => ({ name: a.name, hpPct: hpPct(a), alive: a.alive })).sort((x, y) => x.name.localeCompare(y.name)),
  };
}

const current = {};
for (const [name, build] of Object.entries(SCENARIOS)) current[name] = fingerprint(build);

// ── bless mode (or first run) → freeze current as the baseline ─────────────────
const bless = /^(1|true|yes)$/i.test(process.env.SNAPSHOT_BLESS ?? '');
const exists = fs.existsSync(SNAP);
if (bless || !exists) {
  fs.mkdirSync(path.dirname(SNAP), { recursive: true });
  fs.writeFileSync(SNAP, JSON.stringify(current, null, 2) + '\n');
  const why = exists ? 'RE-BLESSED (SNAPSHOT_BLESS=1)' : 'no baseline existed — CREATED';
  console.log(`\n══ SIM SNAPSHOT (rung 10) ══  ${why}: froze ${Object.keys(current).length} scenario(s) → ${path.relative(path.join(__dirname, '..'), SNAP)}\n`);
  for (const [n, fp] of Object.entries(current)) console.log(`  · ${n}: ${fp.won ? 'WIN' : 'LOSS'} in ${fp.turns}t, survivors ${fp.survivors.length}, deaths ${fp.deaths}, revives ${fp.revives}`);
  console.log('\nQA_JSON ' + JSON.stringify({ rung: 'snapshot', pass: Object.keys(current).length, fail: 0, blessed: true, scenarios: Object.keys(current).length }));
  process.exit(0);
}

// ── compare against the frozen baseline ────────────────────────────────────────
const baseline = JSON.parse(fs.readFileSync(SNAP, 'utf8'));
const drifts = [];       // { scenario, field, was, now }
const TURN_TOL = 0;      // deterministic v0 → turns must match exactly
const HP_TOL = 1;        // absorb integer-rounding only

for (const name of new Set([...Object.keys(baseline), ...Object.keys(current)])) {
  const b = baseline[name], c = current[name];
  if (!b) { drifts.push({ scenario: name, field: 'NEW scenario (not in baseline)', was: '—', now: 'present' }); continue; }
  if (!c) { drifts.push({ scenario: name, field: 'REMOVED scenario (in baseline, not run)', was: 'present', now: '—' }); continue; }
  const push = (field, was, now) => drifts.push({ scenario: name, field, was, now });
  if (b.won !== c.won) push('outcome', b.won ? 'WIN' : 'LOSS', c.won ? 'WIN' : 'LOSS');
  if (Math.abs((b.turns ?? 0) - (c.turns ?? 0)) > TURN_TOL) push('turns', b.turns, c.turns);
  if ((b.failedPhase ?? null) !== (c.failedPhase ?? null)) push('failedPhase', b.failedPhase, c.failedPhase);
  if (b.deaths !== c.deaths) push('deaths', b.deaths, c.deaths);
  if (b.revives !== c.revives) push('revives', b.revives, c.revives);
  if (JSON.stringify(b.survivors) !== JSON.stringify(c.survivors)) push('survivors', b.survivors.join('/') || '∅', c.survivors.join('/') || '∅');
  const bByName = Object.fromEntries((b.allies ?? []).map(a => [a.name, a]));
  for (const a of c.allies ?? []) {
    const ba = bByName[a.name]; if (!ba) continue;
    if (ba.alive !== a.alive) push(`${a.name}.alive`, ba.alive, a.alive);
    if (Math.abs((ba.hpPct ?? 0) - (a.hpPct ?? 0)) > HP_TOL) push(`${a.name}.hpPct`, ba.hpPct, a.hpPct);
  }
}

// ── report ─────────────────────────────────────────────────────────────────────
console.log(`\n══ SIM SNAPSHOT (rung 10) ══  ${drifts.length ? `✗ ${drifts.length} drift(s) vs baseline` : `✅ ${Object.keys(current).length} scenario(s) match the frozen baseline`}\n`);
for (const d of drifts) console.log(`  ✗ ${d.scenario} · ${d.field}: was ${JSON.stringify(d.was)} → now ${JSON.stringify(d.now)}`);
if (drifts.length) {
  console.log('\n  The engine no longer behaves as it did at the last blessing. If this change was INTENTIONAL');
  console.log('  (e.g. you fixed healer survival), re-bless in the same commit:  SNAPSHOT_BLESS=1 node tools/sim-snapshot.mjs');
  console.log('  If it was NOT intended, it is a regression — investigate before trusting any reality comparison.');
} else {
  console.log('  no unintended behavioural drift — the sim does exactly what it did at the last blessing.');
}
console.log('\nQA_JSON ' + JSON.stringify({ rung: 'snapshot', pass: Object.keys(current).length - new Set(drifts.map(d => d.scenario)).size, fail: drifts.length, blessed: false,
  scenarios: Object.keys(current).length, driftScenarios: [...new Set(drifts.map(d => d.scenario))],
  drifts: drifts.slice(0, 40).map(d => `${d.scenario}.${d.field}: ${JSON.stringify(d.was)}→${JSON.stringify(d.now)}`) }));
process.exit(drifts.length ? 1 : 0);
