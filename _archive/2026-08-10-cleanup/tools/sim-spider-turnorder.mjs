// tools/sim-spider-turnorder.mjs — TURN-ORDER / SPEED diagnostic for Spider 13.
//
// Mike's decision tree: speed drives everything. (1) Is the TURN ORDER right — does each unit take turns in
// proportion to its effective SPD? If not, the turn engine is broken and nothing else can be trusted. (2) If
// turn order is right, is SKAVAG moving too fast (taking too many turns → too many consumes)? That's a SPEED
// problem. (3) If turn order is right and she is NOT too fast, then the damage wall is a HEAL problem (each
// consume heals too much). This tool measures which.
//
// Method: read-only wrap of onTurnStart tallies turns per unit; compare each unit's OBSERVED turn share to its
// SPD-implied share (turn frequency ∝ effective speed in RSL). A unit taking its SPD share = turn order OK.
//
// Run: node --env-file=.env.local tools/sim-spider-turnorder.mjs [N]

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { makeState, simulate } from '../lib/sim/engine.js';
import { buildBattle, applyBattleLayers } from '../lib/sim/dragon-fixture.js';
import { installRecipeRun } from '../lib/sim/interpreter.js';
import { champKey } from '../lib/sim/recipes.js';

const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const N = Number(process.argv[2] || 30);
const roleOf = (c) => c.role === 'boss' ? 'Skavag' : /Spiderling/i.test(c.name) ? 'Spiderlings' : champKey(c.name);

if (!process.env.SUPABASE_URL) { console.log('needs the DB. Run with --env-file=.env.local'); process.exit(2); }
const BASE = process.env.SUPABASE_URL.replace(/\/rest\/v1\/?$/, '');
const H = { apikey: process.env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}` };
const _cache = new Map();
const rest = async (p) => { if (!_cache.has(p)) _cache.set(p, await (await fetch(`${BASE}/rest/v1/${p}`, { headers: H })).json()); return _cache.get(p); };

const fixture = JSON.parse(fs.readFileSync(path.join(REPO, 'test', 'golden', 'spider13-donbambus-current.json'), 'utf8'));
const probe = await buildBattle({ rest, fixture, repoRoot: REPO });
if (probe.skip) { console.log('skipped:', probe.skip); process.exit(0); }

// base SPDs (allies from the build; boss + spiderling captured live during a run)
const baseSpd = {};
for (const a of probe.allies) baseSpd[champKey(a.name)] = a.spd;

const turns = {};        // unit -> total turns taken
const spdSeen = {};      // unit -> {sum,count} of base spd observed (spiderlings/boss vary)
let wins = 0, totTurns = 0, totConsume = 0, totSkavagRamp = 0, rampSamples = 0;
const bump = (o, k, v = 1) => { o[k] = (o[k] || 0) + v; };

for (let seed = 1; seed <= N; seed++) {
  const built = await buildBattle({ rest, fixture, repoRoot: REPO });
  applyBattleLayers(built.allies);
  const st = makeState({ allies: built.allies, enemies: [], seed });
  installRecipeRun(st);
  const orig = st.onTurnStart;
  st.onTurnStart = (s, actor) => {
    orig?.(s, actor);
    const k = roleOf(actor);
    bump(turns, k);
    (spdSeen[k] ??= { sum: 0, count: 0 }); spdSeen[k].sum += (actor.spd || 0); spdSeen[k].count++;
  };
  const res = simulate(st, built.content, { turnCap: 400 });
  if (res.won) wins++;
  totTurns += res.turns || 0;
  for (const l of res.log || []) { const c = /CONSUME (\d+)/.exec(String(l.event)); if (c) totConsume++; }
  const boss = (st.enemies || []).find(x => x.role === 'boss');
  if (boss) { totSkavagRamp += boss.atk; rampSamples++; }
}

const avgSpd = (k) => spdSeen[k] ? Math.round(spdSeen[k].sum / spdSeen[k].count) : (baseSpd[k] ?? 0);
const units = Object.keys(turns).sort((a, b) => turns[b] - turns[a]);
const totalActorTurns = Object.values(turns).reduce((s, n) => s + n, 0);
const totalSpd = units.reduce((s, u) => s + avgSpd(u) * (turns[u] > 0 ? 1 : 0), 0);   // rough: one "slot" per unit type

console.log(`\n═══ TURN ORDER / SPEED — Spider's Den 13  (${N} seeds) ═══`);
console.log(`  sim win rate ${(100 * wins / N).toFixed(0)}%  ·  avg fight ${Math.round(totTurns / N)} sim-turns  ·  reality Ezio-team wins ~181 turns`);
console.log(`\n  unit          baseSPD(eff)   turns/fight   % of all turns`);
console.log(`  ${'─'.repeat(60)}`);
for (const u of units) {
  console.log(`  ${u.padEnd(13)} ${String(avgSpd(u)).padStart(6)}        ${String((turns[u] / N).toFixed(1)).padStart(6)}        ${(100 * turns[u] / totalActorTurns).toFixed(1)}%`);
}

// Skavag turn-share vs her SPD share: are the SINGLE-UNIT actors (Skavag + each ally) taking turns in SPD
// proportion? (Spiderlings are a growing pack, so compare only the single units to each other.)
const singles = units.filter(u => u !== 'Spiderlings');
const spdSum = singles.reduce((s, u) => s + avgSpd(u), 0);
console.log(`\n  TURN ORDER CHECK — single units, observed turn-share vs SPD-implied share:`);
console.log(`  ${'unit'.padEnd(13)}${'SPD'.padStart(6)}${'SPD-share'.padStart(11)}${'obs-share'.padStart(11)}   verdict`);
let orderOK = true;
const singleTurns = singles.reduce((s, u) => s + turns[u], 0);
for (const u of singles) {
  const spdShare = avgSpd(u) / spdSum, obsShare = turns[u] / singleTurns;
  const off = Math.abs(obsShare - spdShare) / spdShare;
  if (off > 0.25) orderOK = false;
  console.log(`  ${u.padEnd(13)}${String(avgSpd(u)).padStart(6)}${(100 * spdShare).toFixed(1).padStart(10)}%${(100 * obsShare).toFixed(1).padStart(10)}%   ${off > 0.25 ? '✗ off ' + (100 * off).toFixed(0) + '%' : '✓'}`);
}

const skavagTPF = turns['Skavag'] / N;
const rampX = rampSamples ? (totSkavagRamp / rampSamples) / (probe.allies, 1) : 0;
console.log(`\n  SKAVAG PACE:  ${skavagTPF.toFixed(1)} turns/fight  ·  ${(totConsume / N).toFixed(1)} consumes/fight  ·  1 consume per ${(skavagTPF / Math.max(1, totConsume / N)).toFixed(1)} of her turns`);

console.log(`\n  ▶ DIAGNOSIS:`);
if (!orderOK) {
  console.log(`     (1) TURN ORDER LOOKS WRONG — at least one unit's turn-share is >25% off its SPD-implied share.`);
  console.log(`         Fix the turn engine FIRST; consume/heal numbers can't be trusted until turns are allocated by speed.`);
} else {
  console.log(`     (1) TURN ORDER OK — single units take turns in proportion to their SPD (turn engine is allocating correctly).`);
  console.log(`     (2) Is Skavag too fast? Compare her ${skavagTPF.toFixed(1)} turns/fight and ${(totConsume / N).toFixed(1)} consumes to what reality's`);
  console.log(`         ~181-turn win implies. If her consume cadence is faster than reality → SPEED problem (she out-paces the`);
  console.log(`         team and strips Spiderlings before HP-Burn ticks). If her pace matches reality → HEAL problem (each`);
  console.log(`         consume heals too much). This tool localizes turn order; the reality consume-rate is the last input needed.`);
}
console.log(`\nQA_JSON ${JSON.stringify({ rung: 'spider-turnorder', seeds: N, winRate: +(100 * wins / N).toFixed(0),
  avgSimTurns: Math.round(totTurns / N), skavagTurnsPerFight: +skavagTPF.toFixed(1), consumesPerFight: +(totConsume / N).toFixed(1),
  turnOrderOK: orderOK,
  units: Object.fromEntries(units.map(u => [u, { spd: avgSpd(u), turnsPerFight: +(turns[u] / N).toFixed(1), sharePct: +(100 * turns[u] / totalActorTurns).toFixed(1) }])) })}`);
