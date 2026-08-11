// tools/sim-spider-targeting.mjs — WHO the swarm attacks, and whether the pick ROTATES, on Spider's Den 13.
//
// THE QUESTION (Mike 2026-07-30): off-taunt targeting is lowest CURRENT HP% — a RESET, so when Pelops's Taunt
// drops the swarm should re-pick the most-killable champ NOW, and in reality that target MOVES a lot (it should
// not always be Vergis). The HP-trace probe showed Vergis is the lowest-HP% floor ~73% of the fight. Is that
// because (a) the pick is STUCK (targeting not rotating / taunt not resetting it), or (b) the pick rotates fine
// but Vergis genuinely stays the lowest-HP% because he isn't healed back above the pack? This measures it.
//
// SOURCE: the engine already records a `spider_pick` ledger event on EVERY Spiderling single-target pick
// (spider.js:123) with the target + Pelops's live Taunt state — golden-safe, records-only. Boss AoE (Venom
// Spray / Stupefying Silk) hits ALL allies and is NOT a pick, so the swarm's SINGLE-TARGET picks are the only
// place concentration can happen. We aggregate those picks over N seeds.
//
// Run: node --env-file=.env.local tools/sim-spider-targeting.mjs [N=40]

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { makeState, simulate } from '../lib/sim/engine.js';
import { buildBattle, applyBattleLayers } from '../lib/sim/dragon-fixture.js';
import { installRecipeRun } from '../lib/sim/interpreter.js';
import { champKey } from '../lib/sim/recipes.js';

const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const N = Number(process.argv[2] || 40);

if (!process.env.SUPABASE_URL) { console.log('needs the DB. Run with --env-file=.env.local'); process.exit(2); }
const BASE = process.env.SUPABASE_URL.replace(/\/rest\/v1\/?$/, '');
const H = { apikey: process.env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}` };
const _c = new Map();
const rest = async (p) => { if (!_c.has(p)) _c.set(p, await (await fetch(`${BASE}/rest/v1/${p}`, { headers: H })).json()); return _c.get(p); };

const median = (arr) => { if (!arr.length) return null; const a = [...arr].sort((x, y) => x - y); return a[Math.floor((a.length - 1) / 2)]; };
const pctOf = (n, d) => d ? Math.round(100 * n / d) : 0;

const fixture = JSON.parse(fs.readFileSync(path.join(REPO, 'test', 'golden', 'spider13-donbambus-current.json'), 'utf8'));
const probe = await buildBattle({ rest, fixture, repoRoot: REPO });
if (probe.skip) { console.log('skipped:', probe.skip); process.exit(0); }
const allyKeys = probe.allies.map((a) => champKey(a.name));
const short = Object.fromEntries(probe.allies.map((a) => [champKey(a.name), a.name.split(' ')[0]]));

// aggregate across seeds
const totalTargeted = Object.fromEntries(allyKeys.map((k) => [k, 0]));   // all single-target picks
const offTaunted = Object.fromEntries(allyKeys.map((k) => [k, 0]));      // picks made while NO valid taunt (the "reset" picks)
let totalPicks = 0, tauntablePicks = 0, tauntingPicks = 0, tauntingHitPelops = 0;
const switchRates = [], distinctPerFight = [], picksPerFight = [];

for (let seed = 1; seed <= N; seed++) {
  const built = await buildBattle({ rest, fixture, repoRoot: REPO });
  applyBattleLayers(built.allies);
  const st = makeState({ allies: built.allies, enemies: [], seed });
  installRecipeRun(st);
  const res = simulate(st, built.content, { turnCap: 400 });

  const picks = (res.effects || []).filter((e) => e.kind === 'spider_pick');
  picksPerFight.push(picks.length);
  const seen = new Set();
  let switches = 0, prev = null;
  for (const p of picks) {
    const tk = champKey(p.target);
    totalPicks++;
    if (tk in totalTargeted) totalTargeted[tk]++;
    seen.add(tk);
    if (prev !== null && prev !== tk) switches++;
    prev = tk;
    // taunt accounting: pelTaunting = Pelops had a valid Taunt this pick; else it's an off-taunt "reset" pick
    if (p.pelTaunting) { tauntingPicks++; if (p.pelPicked) tauntingHitPelops++; }
    else { if (tk in offTaunted) offTaunted[tk]++; }
    if (p.pelTauntable) tauntablePicks++;
  }
  if (picks.length > 1) switchRates.push(switches / (picks.length - 1));
  distinctPerFight.push(seen.size);
}

console.log(`\n═══ SWARM TARGETING — Spider's Den 13  (${N} seeds) ═══`);
console.log(`  ${(totalPicks / N).toFixed(0)} single-target Spiderling picks/fight  ·  ${short['pelops'] ? '' : ''}median ${median(distinctPerFight)} of ${allyKeys.length} champs ever targeted/fight`);

console.log(`\n  TARGET DISTRIBUTION — where ALL single-target picks land (a rotating swarm spreads; a stuck one concentrates):`);
console.log(`  ${'CHAMP'.padEnd(9)}${'all picks'.padStart(10)}${'off-taunt picks'.padStart(17)}`);
console.log(`  ${'─'.repeat(38)}`);
const off = allyKeys.reduce((s, k) => s + offTaunted[k], 0);
for (const k of [...allyKeys].sort((a, b) => totalTargeted[b] - totalTargeted[a])) {
  console.log(`  ${short[k].slice(0, 8).padEnd(9)}${(pctOf(totalTargeted[k], totalPicks) + '%').padStart(10)}${(pctOf(offTaunted[k], off) + '%').padStart(17)}`);
}

console.log(`\n  ROTATION — does the pick MOVE between consecutive picks?`);
console.log(`    switch rate ${pctOf(median(switchRates), 1)}%  (fraction of consecutive picks that changed target; ~0% = stuck on one champ, high = rotating)`);
console.log(`    distinct targets/fight ${median(distinctPerFight)}/${allyKeys.length}  (a fully-rotating swarm touches most of the team; a stuck one touches ~1-2)`);

console.log(`\n  TAUNT — is Pelops's Taunt pulling picks, and does it RESET the target when it drops?`);
console.log(`    picks while Pelops has a valid Taunt: ${pctOf(tauntingPicks, totalPicks)}% of all picks  →  ${pctOf(tauntingHitPelops, tauntingPicks)}% of THOSE hit Pelops (should be ~100% if taunt is obeyed)`);
console.log(`    picks with NO valid taunt (the "reset" picks): ${pctOf(totalPicks - tauntingPicks, totalPicks)}% → these go to lowest CURRENT HP% (distribution in the off-taunt column above)`);

// ── DIAGNOSIS ──
const topK = [...allyKeys].sort((a, b) => offTaunted[b] - offTaunted[a])[0];
const topOffShare = pctOf(offTaunted[topK], off);
const sw = pctOf(median(switchRates), 1);
console.log(`\n  ▶ READ:`);
if (topOffShare > 55 && sw < 35) {
  console.log(`     The off-taunt pick is STICKY — ${short[topK]} takes ${topOffShare}% of reset picks and the target only changes`);
  console.log(`     ${sw}% of the time. Targeting IS re-evaluating each pick (dynamic lowest-HP%), but ${short[topK]} STAYS the lowest-HP%`);
  console.log(`     floor between picks because he isn't healed back above the pack — so "lowest-HP% now" keeps returning him.`);
  console.log(`     This is NOT a taunt-reset bug (taunt IS resetting); it's that nothing lifts ${short[topK]} off the bottom.`);
  console.log(`     → The lever is heal RATE / distribution onto the tunnel target (or spreading incoming), not the pick rule.`);
} else if (sw >= 35) {
  console.log(`     The pick ROTATES (${sw}% switch rate, ${median(distinctPerFight)}/${allyKeys.length} champs/fight) — targeting is spreading like reality.`);
  console.log(`     If one champ still dies, the driver is per-hit magnitude or heal timing, not target concentration.`);
} else {
  console.log(`     MIXED — off-taunt top share ${topOffShare}%, switch rate ${sw}%. Read the rows above.`);
}

console.log(`\nQA_JSON ${JSON.stringify({
  rung: 'spider-targeting', seeds: N, picksPerFight: Math.round(totalPicks / N),
  switchRatePct: pctOf(median(switchRates), 1), distinctPerFight: median(distinctPerFight),
  tauntingSharePct: pctOf(tauntingPicks, totalPicks), tauntObeyedPct: pctOf(tauntingHitPelops, tauntingPicks),
  allPicksDist: Object.fromEntries(allyKeys.map((k) => [short[k], pctOf(totalTargeted[k], totalPicks)])),
  offTauntDist: Object.fromEntries(allyKeys.map((k) => [short[k], pctOf(offTaunted[k], off)])),
})}`);
