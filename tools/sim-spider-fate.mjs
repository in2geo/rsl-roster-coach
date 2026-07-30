// tools/sim-spider-fate.mjs — SPIDERLING FATE + HP-BURN-LOSS diagnostic (Spider damage wall).
//
// Mike, first-party: "many times Ezio will AoE-explode the Spiderlings so the HP Burn does not tick."
// Pelops's HP Burn only splashes onto Skavag WHEN IT TICKS (engine.js: the 3%-MaxHP splash rides the tick),
// and a DoT ticks only at the START of the bearer's own turn. So a Spiderling killed — by our own AoE OR by
// Skavag's consume — before its next turn carries its burn to the grave and lands ZERO splash on Skavag.
//
// This reconstructs, from the sim's own log + effect ledger (no engine change), the fate of every Spiderling:
//   spawned → { killed by our damage | consumed by Skavag | alive at end }
// who lands the killing blows (is it Ezio's AoE?), and how many HP Burns never ticked and WHY (killed vs
// consumed). It turns Mike's observation into a number and tells us whether HP-Burn splash can be a real
// Skavag-damage path on this team or is structurally self-defeating.
//
// Run: node --env-file=.env.local tools/sim-spider-fate.mjs [N] [stage]

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { makeState, simulate } from '../lib/sim/engine.js';
import { buildBattle, applyBattleLayers } from '../lib/sim/dragon-fixture.js';
import { installRecipeRun } from '../lib/sim/interpreter.js';
import { champKey } from '../lib/sim/recipes.js';

const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const N = Number(process.argv[2] || 40);
const STAGE = Number(process.argv[3] || 13);
const FIXTURE = 'spider13-donbambus-current.json';
const isSpiderling = (n) => /Spiderling/i.test(String(n));

if (!process.env.SUPABASE_URL) { console.log('needs the DB. Run with --env-file=.env.local'); process.exit(2); }
const BASE = process.env.SUPABASE_URL.replace(/\/rest\/v1\/?$/, '');
const H = { apikey: process.env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}` };
const _cache = new Map();
const rest = async (p) => { if (!_cache.has(p)) _cache.set(p, await (await fetch(`${BASE}/rest/v1/${p}`, { headers: H })).json()); return _cache.get(p); };

const fixture = JSON.parse(fs.readFileSync(path.join(REPO, 'test', 'golden', FIXTURE), 'utf8'));
const probe = await buildBattle({ rest, fixture, repoRoot: REPO });
if (probe.skip) { console.log('skipped:', probe.skip); process.exit(0); }

const agg = { spawned: 0, consumed: 0, killed: 0, aliveEnd: 0,
  burnPlaced: 0, burnTicked: 0, lostToKill: 0, lostToConsume: 0, splashToSkavag: 0 };
const killers = {};   // champKey -> spiderling killing blows
let wins = 0, totalTurns = 0;

for (let seed = 1; seed <= N; seed++) {
  const built = await buildBattle({ rest, fixture, repoRoot: REPO });
  applyBattleLayers(built.allies);
  const st = makeState({ allies: built.allies, enemies: [], seed });
  installRecipeRun(st);
  const res = simulate(st, built.content, { turnCap: 400 });
  if (res.won) wins++;
  totalTurns += res.turns || 0;

  const log = res.log || [], fx = res.effects || [];
  // spawns / consumes from the content log
  let spawned = 0, consumed = 0;
  for (const l of log) {
    const m = /spawn (\d+)/.exec(String(l.event)); if (m) spawned += Number(m[1]);
    const c = /CONSUME (\d+)/.exec(String(l.event)); if (c) consumed += Number(c[1]);
  }
  // killed-by-damage = death events for Spiderlings; record turn for killing-blow attribution
  const killTurn = new Map();
  for (const l of log) if (l.event === 'death' && isSpiderling(l.who)) killTurn.set(l.who, l.turn);
  const killed = killTurn.size;

  // per-Spiderling HP Burn: placed (debuff) vs ticked (dot). Splash-to-Skavag rides the tick amount.
  const burnPlacedOn = new Set(), burnTickedOn = new Set();
  for (const e of fx) {
    if (e.subtype !== 'HP Burn' || !isSpiderling(e.target)) continue;
    if (e.kind === 'debuff' && e.consumed !== false) burnPlacedOn.add(e.target);
    if (e.kind === 'dot') { burnTickedOn.add(e.target); agg.splashToSkavag += (e.amount || 0); }
  }
  // killing-blow attribution: on each killed Spiderling's death turn, the largest damage source is the killer
  for (const [name, t] of killTurn) {
    let best = null, bestAmt = -1;
    for (const e of fx) {
      if (e.kind !== 'damage' || e.target !== name || e.turn !== t || !e.source) continue;
      if ((e.amount || 0) > bestAmt) { bestAmt = e.amount || 0; best = champKey(e.source); }
    }
    if (best) killers[best] = (killers[best] || 0) + 1;
  }

  // burns that never ticked, split by why the carrier left the field
  let lostKill = 0, lostConsume = 0;
  for (const s of burnPlacedOn) {
    if (burnTickedOn.has(s)) continue;                 // it ticked at least once → not lost
    if (killTurn.has(s)) lostKill++; else lostConsume++;   // died to our damage, else removed by consume
  }

  agg.spawned += spawned; agg.consumed += consumed; agg.killed += killed;
  agg.aliveEnd += Math.max(0, spawned - consumed - killed);
  agg.burnPlaced += burnPlacedOn.size; agg.burnTicked += burnTickedOn.size;
  agg.lostToKill += lostKill; agg.lostToConsume += lostConsume;
}

const per = (x) => (x / N).toFixed(1);
const pct = (x, of) => of ? (100 * x / of).toFixed(0) + '%' : '—';
console.log(`\n═══ SPIDERLING FATE + HP-BURN LOSS — Spider's Den ${STAGE}  (${N} seeds) ═══`);
console.log(`  sim win rate ${(100 * wins / N).toFixed(0)}%  ·  avg fight ${Math.round(totalTurns / N)}t\n`);
console.log(`  SPIDERLING FATE (per fight, avg of ${N}):`);
console.log(`    spawned ................ ${per(agg.spawned)}`);
console.log(`    killed by OUR damage ... ${per(agg.killed)}   (${pct(agg.killed, agg.spawned)} of spawned)`);
console.log(`    consumed by Skavag ..... ${per(agg.consumed)}   (${pct(agg.consumed, agg.spawned)} of spawned)`);
console.log(`    alive at end ........... ${per(agg.aliveEnd)}`);

const totalKB = Object.values(killers).reduce((s, n) => s + n, 0);
console.log(`\n  WHO LANDS THE KILLING BLOWS ON SPIDERLINGS (share of ${totalKB} kills over ${N} fights):`);
for (const [k, n] of Object.entries(killers).sort((a, b) => b[1] - a[1])) console.log(`    ${k.padEnd(9)} ${pct(n, totalKB).padStart(4)}  (${per(n)}/fight)`);

console.log(`\n  HP-BURN SPLASH ONTO SKAVAG — is Pelops's burn a real boss-damage path here?`);
console.log(`    HP Burn placed on Spiderlings ... ${per(agg.burnPlaced)}/fight`);
console.log(`    …of those that EVER ticked ...... ${per(agg.burnTicked)}/fight  (${pct(agg.burnTicked, agg.burnPlaced)} — the rest carried the burn to the grave)`);
console.log(`    burns LOST because carrier was KILLED by our damage first ... ${per(agg.lostToKill)}/fight  (${pct(agg.lostToKill, agg.burnPlaced)})`);
console.log(`    burns LOST because carrier was CONSUMED by Skavag first ..... ${per(agg.lostToConsume)}/fight  (${pct(agg.lostToConsume, agg.burnPlaced)})`);
console.log(`    total HP-Burn tick damage (own+splash) credited to Pelops ... ${Math.round(agg.splashToSkavag / N).toLocaleString()}/fight`);

const killShare = pct(agg.lostToKill, agg.lostToKill + agg.lostToConsume);
console.log(`\n  ▶ VERDICT: of HP Burns that never tick, ${killShare} are lost to OUR OWN damage killing the carrier`);
console.log(`     (Mike's observation), the rest to Skavag's consume. Either way the splash never reaches Skavag.`);
console.log(`\nQA_JSON ${JSON.stringify({ rung: 'spider-fate', stage: STAGE, seeds: N, winRate: +(100 * wins / N).toFixed(0),
  perFight: { spawned: +per(agg.spawned), killed: +per(agg.killed), consumed: +per(agg.consumed), aliveEnd: +per(agg.aliveEnd) },
  killers: Object.fromEntries(Object.entries(killers).map(([k, n]) => [k, +per(n)])),
  burn: { placed: +per(agg.burnPlaced), ticked: +per(agg.burnTicked), lostToKill: +per(agg.lostToKill), lostToConsume: +per(agg.lostToConsume), tickPctOfPlaced: +pct(agg.burnTicked, agg.burnPlaced).replace('%','') } })}`);
