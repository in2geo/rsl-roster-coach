// tools/sim-spider-hp-trace.mjs — PER-CHAMP HP%-OVER-TIME probe for Spider's Den 13.
//
// THE QUESTION IT SETTLES (handoff 2026-07-29 session 4): the sim's `taken` OVER-shoots reality and its
// attributed `healing` reads as a fraction of reality — but healing in per-hero-bands is REPORT-ONLY because of
// a known ATTRIBUTION SEAM (Continuous Heal is sourced to the string, magma-lifesteal isn't ledgered). So the
// low healing numbers could mean either (A) REAL UNDER-HEAL — the healers genuinely under-deliver, champs dip in
// HP%, become the lowest-HP% target, and the swarm tunnels them (breaking Bambus's [Sleep] → he stops sponging);
// or (B) UNDER-COUNT — healing IS delivered and champs stay topped, and only the per-champ *attribution* is wrong.
// You cannot tell these apart from an attributed number. You CAN tell them apart from WORLD STATE.
//
// HOW IT SIDESTEPS THE SEAM: it never reads the effect ledger for healing. It reads two authoritative
// combatant fields the engine maintains on every HP change and NEVER attributes to a source — `combatant.healed`
// (gross healing RECEIVED) and `combatant.taken` (gross damage taken, incl. shield-absorbed) — plus the raw
// `combatant.hp/maxHp` trajectory sampled every turn via the observe-only onTurnStart hook. Received ≠ done at
// the per-champ level, but at the TEAM level total-received ≈ total-done (both net of overheal, which `healed`
// already excludes), so sim team `healed` vs the captured victory-screen team healing is an attribution-FREE
// delivery gate. Purely observe-only: sets one hook, mutates nothing → golden/snapshot-safe.
//
// WHAT IT REPORTS (medians over N seeds):
//   • per champ HP% trajectory — min, mean, %-of-fight below 60% / 40%, final — the CONSEQUENCE of (under)healing
//   • per champ healing RECEIVED (combatant.healed) and damage TAKEN (combatant.taken) — world-truth magnitudes
//   • TEAM healing delivered (sim `healed`) vs reality healing done (captures) — the attribution-free verdict
//   • Bambus [Sleep] uptime (= sponge availability) and how often each champ is the lowest-HP% tunnel magnet
//
// Run: node --env-file=.env.local tools/sim-spider-hp-trace.mjs [N=40]

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { makeState, simulate } from '../lib/sim/engine.js';
import { buildBattle, applyBattleLayers } from '../lib/sim/dragon-fixture.js';
import { installRecipeRun } from '../lib/sim/interpreter.js';
import { champKey } from '../lib/sim/recipes.js';

const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const N = Number(process.argv[2] || 40);
const DUNGEON = "Spider's Den", STAGE = 13;
const LOW = 0.60, CRIT = 0.40;   // HP% thresholds: "dipping" and "critical"

if (!process.env.SUPABASE_URL) { console.log('needs the DB. Run with --env-file=.env.local'); process.exit(2); }
const BASE = process.env.SUPABASE_URL.replace(/\/rest\/v1\/?$/, '');
const H = { apikey: process.env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}` };
const _cache = new Map();
const rest = async (p) => { if (!_cache.has(p)) _cache.set(p, await (await fetch(`${BASE}/rest/v1/${p}`, { headers: H })).json()); return _cache.get(p); };

const pctile = (arr, p) => {
  if (!arr.length) return null;
  const a = [...arr].sort((x, y) => x - y);
  return a[Math.min(a.length - 1, Math.max(0, Math.round(p * (a.length - 1))))];
};
const median = (arr) => pctile(arr, 0.5);
const asleep = (c) => (c.debuffs ?? []).some((d) => d.type === 'Sleep');
const fmt = (n) => n == null ? '—' : n >= 1e6 ? (n / 1e6).toFixed(2) + 'M' : n >= 1e3 ? Math.round(n / 1e3) + 'k' : String(Math.round(n));
const pct = (x) => x == null ? '—' : Math.round(100 * x) + '%';

// ── REALITY: team healing-done + taken medians from the hand-verified captures (attribution-free at team level) ──
function realityTeam() {
  const caps = JSON.parse(fs.readFileSync(path.join(REPO, 'data', 'manual-captures.json'), 'utf8')).captures;
  const wins = caps.filter((c) => c.dungeon === DUNGEON && c.stageNumber === STAGE && c.result === 'Victory');
  const teamHealing = [], teamTaken = [], perChampHealDone = {}, perChampTaken = {};
  for (const c of wins) {
    const heroes = c.heroes || [];
    if (!heroes.length) continue;
    teamHealing.push(heroes.reduce((s, h) => s + (h.healing || 0), 0));
    teamTaken.push(heroes.reduce((s, h) => s + (h.taken || 0), 0));
    for (const h of heroes) {
      const k = champKey(h.displayName || h.name);
      (perChampHealDone[k] ??= []).push(h.healing || 0);
      (perChampTaken[k] ??= []).push(h.taken || 0);
    }
  }
  return {
    n: wins.length,
    teamHealing: median(teamHealing), teamTaken: median(teamTaken),
    turns: median(wins.map((c) => c.turns).filter(Number.isFinite)),
    perChampHealDone: Object.fromEntries(Object.entries(perChampHealDone).map(([k, v]) => [k, median(v)])),
    perChampTaken: Object.fromEntries(Object.entries(perChampTaken).map(([k, v]) => [k, median(v)])),
  };
}

// ── SIM: run N seeds, sampling HP% every turn + reading healed/taken world-fields at the end ──
async function run() {
  const fixture = JSON.parse(fs.readFileSync(path.join(REPO, 'test', 'golden', 'spider13-donbambus-current.json'), 'utf8'));
  const probe = await buildBattle({ rest, fixture, repoRoot: REPO });
  if (probe.skip) { console.log('skipped:', probe.skip); process.exit(0); }
  const allyKeys = probe.allies.map((a) => champKey(a.name));
  const displayName = Object.fromEntries(probe.allies.map((a) => [champKey(a.name), a.name.split(' ')[0]]));
  const bambusKey = allyKeys.find((k) => /bambus/i.test(k)) || null;

  // accumulators — arrays hold one value PER SEED, so we can take medians (single-run anchor trap: never one run)
  const acc = Object.fromEntries(allyKeys.map((k) => [k, {
    minHp: [], meanHp: [], belowLow: [], belowCrit: [], finalHp: [], healed: [], taken: [], magnetShare: [],
  }]));
  const teamHealed = [], teamTaken = [], simTurns = [], winArr = [];
  const bambusSleepUptime = [], bambusMeanHpAsleep = [], bambusMeanHpAwake = [];

  for (let seed = 1; seed <= N; seed++) {
    const built = await buildBattle({ rest, fixture, repoRoot: REPO });
    applyBattleLayers(built.allies);
    const st = makeState({ allies: built.allies, enemies: [], seed });
    installRecipeRun(st);

    // per-turn snapshots for THIS run
    const samp = Object.fromEntries(allyKeys.map((k) => [k, []]));   // champKey → [hp% each turn it was alive]
    const magnet = Object.fromEntries(allyKeys.map((k) => [k, 0]));
    let ticks = 0, bamSleepTicks = 0;
    const bamAsleepHp = [], bamAwakeHp = [];
    const byKey = new Map(built.allies.map((a) => [champKey(a.name), a]));

    const orig = st.onTurnStart;
    st.onTurnStart = (s, actor) => {
      orig?.(s, actor);
      ticks++;
      // snapshot the WHOLE team's HP% at the top of every turn (observe-only)
      let lowestK = null, lowestHp = Infinity;
      for (const k of allyKeys) {
        const c = byKey.get(k);
        if (!c || !c.alive) continue;
        const hpf = Math.max(0, (c.hp || 0) / (c.maxHp || 1));
        samp[k].push(hpf);
        if (hpf < lowestHp) { lowestHp = hpf; lowestK = k; }
      }
      if (lowestK) magnet[lowestK]++;   // lowest CURRENT-HP% living ally = the swarm's tunnel target this turn
      if (bambusKey) {
        const b = byKey.get(bambusKey);
        if (b && b.alive) { const s2 = asleep(b); if (s2) { bamSleepTicks++; bamAsleepHp.push(b.hp / b.maxHp); } else bamAwakeHp.push(b.hp / b.maxHp); }
      }
    };

    const res = simulate(st, built.content, { turnCap: 400 });
    winArr.push(res.won ? 1 : 0);
    simTurns.push(res.turns || 0);

    let tHealed = 0, tTaken = 0;
    for (const k of allyKeys) {
      const c = byKey.get(k);
      const series = samp[k];
      const a = acc[k];
      a.minHp.push(series.length ? Math.min(...series) : (c.alive ? c.hp / c.maxHp : 0));
      a.meanHp.push(series.length ? series.reduce((s, x) => s + x, 0) / series.length : 0);
      a.belowLow.push(series.length ? series.filter((x) => x < LOW).length / series.length : 0);
      a.belowCrit.push(series.length ? series.filter((x) => x < CRIT).length / series.length : 0);
      a.finalHp.push(c.alive ? Math.max(0, c.hp / c.maxHp) : 0);
      a.healed.push(c.healed || 0);
      a.taken.push(c.taken || 0);
      a.magnetShare.push(ticks ? magnet[k] / ticks : 0);
      tHealed += c.healed || 0; tTaken += c.taken || 0;
    }
    teamHealed.push(tHealed); teamTaken.push(tTaken);
    if (bambusKey) {
      bambusSleepUptime.push(ticks ? bamSleepTicks / ticks : 0);
      bambusMeanHpAsleep.push(bamAsleepHp.length ? bamAsleepHp.reduce((s, x) => s + x, 0) / bamAsleepHp.length : null);
      bambusMeanHpAwake.push(bamAwakeHp.length ? bamAwakeHp.reduce((s, x) => s + x, 0) / bamAwakeHp.length : null);
    }
  }

  return {
    allyKeys, displayName, bambusKey, acc,
    winRate: Math.round(100 * winArr.reduce((s, x) => s + x, 0) / N),
    simTurns: median(simTurns),
    teamHealed: median(teamHealed), teamTaken: median(teamTaken),
    bambusSleepUptime: median(bambusSleepUptime),
    bambusMeanHpAsleep: median(bambusMeanHpAsleep.filter((x) => x != null)),
    bambusMeanHpAwake: median(bambusMeanHpAwake.filter((x) => x != null)),
  };
}

// ── report ──────────────────────────────────────────────────────────────────────────────────────────────
const sim = await run();
const real = realityTeam();

console.log(`\n═══ PER-CHAMP HP%-OVER-TIME — ${DUNGEON} ${STAGE}  (${N} seeds, medians) ═══`);
console.log(`  sim WR ${sim.winRate}%  ·  sim fight ${sim.simTurns}t  ·  reality WR ~71% / ~${real.turns ?? 181}t  ·  captured wins: ${real.n}`);

console.log(`\n  PER-CHAMP HP% TRAJECTORY (the CONSEQUENCE of healing) — sorted by how much time spent dipping:`);
console.log(`  ${'CHAMP'.padEnd(9)}${'min HP%'.padStart(8)}${'mean HP%'.padStart(9)}${'% <60%'.padStart(8)}${'% <40%'.padStart(8)}${'final'.padStart(7)}${'magnet'.padStart(8)}`);
console.log(`  ${'─'.repeat(56)}`);
const rows = sim.allyKeys.map((k) => ({ k, a: sim.acc[k], below: median(sim.acc[k].belowLow) }))
  .sort((x, y) => y.below - x.below);
for (const { k, a } of rows) {
  console.log(`  ${sim.displayName[k].slice(0, 8).padEnd(9)}${pct(median(a.minHp)).padStart(8)}${pct(median(a.meanHp)).padStart(9)}`
    + `${pct(median(a.belowLow)).padStart(8)}${pct(median(a.belowCrit)).padStart(8)}${pct(median(a.finalHp)).padStart(7)}${pct(median(a.magnetShare)).padStart(8)}`);
}

console.log(`\n  PER-CHAMP MAGNITUDE — healing RECEIVED (combatant.healed) vs damage TAKEN (combatant.taken), world-truth:`);
console.log(`  ${'CHAMP'.padEnd(9)}${'sim healed'.padStart(12)}${'sim taken'.padStart(11)}${'  real healDONE'.padStart(15)}${'real taken'.padStart(12)}`);
console.log(`  ${'─'.repeat(58)}`);
for (const k of sim.allyKeys) {
  const a = sim.acc[k];
  console.log(`  ${sim.displayName[k].slice(0, 8).padEnd(9)}${fmt(median(a.healed)).padStart(12)}${fmt(median(a.taken)).padStart(11)}`
    + `${fmt(real.perChampHealDone[k]).padStart(15)}${fmt(real.perChampTaken[k]).padStart(12)}`);
}
console.log(`    (per-champ healed≠healDONE — received vs done. Compare at TEAM level below, where they reconcile.)`);

// ── the attribution-free team gate ──
const healRatio = real.teamHealing ? sim.teamHealed / real.teamHealing : null;
const takenRatio = real.teamTaken ? sim.teamTaken / real.teamTaken : null;
console.log(`\n  ★ TEAM DELIVERY (attribution-free) — total healing received vs total healing done in reality:`);
console.log(`    healing:  sim delivered ${fmt(sim.teamHealed)}   reality done ${fmt(real.teamHealing)}   → ratio ${healRatio == null ? '—' : (healRatio).toFixed(2) + '×'}`);
console.log(`    taken:    sim ${fmt(sim.teamTaken)}   reality ${fmt(real.teamTaken)}   → ratio ${takenRatio == null ? '—' : (takenRatio).toFixed(2) + '×'}`);

// ── Bambus sponge availability ──
if (sim.bambusKey) {
  console.log(`\n  BAMBUS [Sleep] / sponge:  uptime ${pct(sim.bambusSleepUptime)}  ·  mean HP% asleep ${pct(sim.bambusMeanHpAsleep)}  ·  mean HP% awake ${pct(sim.bambusMeanHpAwake)}`);
  console.log(`    (asleep = sponge active. If uptime is high and HP% asleep stays up, the sponge is working — his poison is a symptom, not a leak.)`);
}

// ── DIAGNOSIS ──
// The three shapes we distinguish:
//   UNDER-COUNT     — team stays topped, healing delivered ≈ reality → the low attributed healing is the seam.
//   TUNNEL SPIRAL   — the team is FINE except ONE champ who is the persistent lowest-HP% target (a death spiral:
//                     dips → becomes lowest → focused → stays lowest). A LOCALISED targeting/rescue failure, NOT
//                     global under-delivery — the other four prove the healers work.
//   GLOBAL UNDERHEAL— multiple champs dip → the healers genuinely can't keep the team up.
const dips = rows.filter((r) => median(r.a.belowCrit) > 0.10);        // champs spending >10% of the fight under 40%
const magnets = sim.allyKeys.map((k) => ({ k, m: median(sim.acc[k].magnetShare) })).sort((a, b) => b.m - a.m);
const topMagnet = magnets[0], secondMagnet = magnets[1];
const concentrated = topMagnet && topMagnet.m > 0.5 && (!secondMagnet || secondMagnet.m < 0.2);   // one champ eats >50% of tunneling, next <20%
console.log(`\n  ▶ VERDICT:`);
if (dips.length === 0 && healRatio != null && healRatio >= 0.7) {
  console.log(`     UNDER-COUNT, not under-heal. The team RECEIVES ${(healRatio).toFixed(2)}× reality's healing and no champ`);
  console.log(`     spends meaningful time under ${Math.round(CRIT * 100)}% HP — champs stay topped. The low per-champ healing in`);
  console.log(`     per-hero-bands is the ATTRIBUTION SEAM (Continuous Heal → string, magma-lifesteal unledgered), NOT missing`);
  console.log(`     healing. → Fix the accounting (add per-champ healingDone), and look elsewhere for the taken-overshoot.`);
} else if (dips.length === 1 && concentrated) {
  const nm = sim.displayName[dips[0].k];
  console.log(`     TUNNEL SPIRAL on ${nm} — NOT global under-heal. The other ${sim.allyKeys.length - 1} champs stay topped`);
  console.log(`     (mean HP% ${pct(median(sim.acc[sim.allyKeys.find((k) => k !== dips[0].k)].meanHp))}+, ~0% time under ${Math.round(CRIT * 100)}%), so the healers ARE delivering. ${nm} alone is the`);
  console.log(`     lowest-HP% target ${pct(topMagnet.m)} of the fight and takes ${(takenRatio ?? 0).toFixed(1)}×-team damage → a death spiral: he dips,`);
  console.log(`     becomes lowest-HP%, gets focused (off-taunt = lowest CURRENT HP%), and stays lowest. → Next question is WHY`);
  console.log(`     ${nm} is over-focused: is he over-TARGETED (targeting concentration bug) or under-RESCUED (heals not directed`);
  console.log(`     to the tunnel target)? In reality ${nm} takes ${fmt(real.perChampTaken[dips[0].k])} vs sim ${fmt(median(sim.acc[dips[0].k].taken))} — the over-contact is the lever.`);
} else if (healRatio != null && healRatio < 0.7 && dips.length > 1) {
  console.log(`     GLOBAL UNDER-HEAL. The team receives only ${(healRatio).toFixed(2)}× reality's healing and ${dips.length} champs dip below ${Math.round(CRIT * 100)}%.`);
  console.log(`     Healing is genuinely under-delivered across the team → champs dip → become lowest-HP% → the swarm tunnels them.`);
  console.log(`     → Investigate WHY healers under-deliver: cadence, target selection, hoard threshold, Continuous-Heal firing.`);
} else {
  console.log(`     MIXED / inconclusive — team heal ratio ${healRatio == null ? '—' : healRatio.toFixed(2) + '×'}, ${dips.length} champ(s) deep-dipping, top magnet ${topMagnet ? pct(topMagnet.m) : '—'}.`);
  console.log(`     Read the trajectory + delivery rows above; the signals don't fit one clean story.`);
}

console.log(`\nQA_JSON ${JSON.stringify({
  rung: 'spider-hp-trace', seeds: N, winRate: sim.winRate, simTurns: sim.simTurns,
  teamHealedSim: Math.round(sim.teamHealed), teamHealingReal: real.teamHealing, healRatio: healRatio == null ? null : +healRatio.toFixed(2),
  teamTakenSim: Math.round(sim.teamTaken), teamTakenReal: real.teamTaken, takenRatio: takenRatio == null ? null : +takenRatio.toFixed(2),
  bambusSleepUptime: sim.bambusSleepUptime == null ? null : +sim.bambusSleepUptime.toFixed(2),
  deepDipChamps: dips.map((r) => sim.displayName[r.k]), topMagnet: topMagnet ? { champ: sim.displayName[topMagnet.k], share: Math.round(100 * topMagnet.m) } : null,
  perChamp: Object.fromEntries(sim.allyKeys.map((k) => [sim.displayName[k], {
    minHp: Math.round(100 * median(sim.acc[k].minHp)), meanHp: Math.round(100 * median(sim.acc[k].meanHp)),
    pctBelow60: Math.round(100 * median(sim.acc[k].belowLow)), pctBelow40: Math.round(100 * median(sim.acc[k].belowCrit)),
    healed: Math.round(median(sim.acc[k].healed)), taken: Math.round(median(sim.acc[k].taken)),
    magnetShare: Math.round(100 * median(sim.acc[k].magnetShare)),
  }])),
})}`);
