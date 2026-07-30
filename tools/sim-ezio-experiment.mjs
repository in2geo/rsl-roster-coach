// tools/sim-ezio-experiment.mjs — DOES THE SIM REPRODUCE MIKE'S EZIO EXPERIMENT?
//
// First-party finding (Mike): Ezio HURTS this team on Spider. His AoE explodes the Spiderlings; when the
// Spiderlings instead LIVE, they tick Pelops's [HP Burn] onto Skavag (Master of Games places it on every
// attacker; the tick splashes 3% MaxHP onto the boss). Swapping Ezio out (he ran Vallaryn) let the burn
// engine fire — Pelops dealt 1.71M and the team won.
//
// This is the in-sim analog of that swap: run the SAME 5, but in arm B neuter Ezio's A2 from all-enemies to
// single-target (he stops clearing the swarm). If the model captures the mechanic, arm B should show MORE
// Spiderlings surviving → MORE HP-Burn ticks → MORE Pelops damage → LOWER Skavag end-HP. That would validate
// the sim reproduces the causal chain — the point of a reimplementation.
//
// Run: node --env-file=.env.local tools/sim-ezio-experiment.mjs [N]

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { makeState, simulate } from '../lib/sim/engine.js';
import { buildBattle, applyBattleLayers } from '../lib/sim/dragon-fixture.js';
import { installRecipeRun } from '../lib/sim/interpreter.js';
import { RECIPES, champKey } from '../lib/sim/recipes.js';

const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const N = Number(process.argv[2] || 40);
const isSpiderling = (n) => /Spiderling/i.test(String(n));

if (!process.env.SUPABASE_URL) { console.log('needs the DB. Run with --env-file=.env.local'); process.exit(2); }
const BASE = process.env.SUPABASE_URL.replace(/\/rest\/v1\/?$/, '');
const H = { apikey: process.env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}` };
const _cache = new Map();
const rest = async (p) => { if (!_cache.has(p)) _cache.set(p, await (await fetch(`${BASE}/rest/v1/${p}`, { headers: H })).json()); return _cache.get(p); };

const fixture = JSON.parse(fs.readFileSync(path.join(REPO, 'test', 'golden', 'spider13-donbambus-current.json'), 'utf8'));
const probe = await buildBattle({ rest, fixture, repoRoot: REPO });
if (probe.skip) { console.log('skipped:', probe.skip); process.exit(0); }

async function runArm(neuterEzioAoE) {
  // arm B: temporarily retarget Ezio A2 to single-target so he stops clearing the swarm (restored after).
  const a2 = RECIPES['EZIO-A2'];
  const acquire = a2.actions.find(x => x.op === 'ACQUIRE_TARGETS');
  const savedTarget = acquire.target;
  if (neuterEzioAoE) acquire.target = 'single';
  const acc = { wins: 0, turns: 0, consumed: 0, killed: 0, burnTicks: 0, pelops: 0, bossPct: 0 };
  try {
    for (let seed = 1; seed <= N; seed++) {
      const built = await buildBattle({ rest, fixture, repoRoot: REPO });
      applyBattleLayers(built.allies);
      const st = makeState({ allies: built.allies, enemies: [], seed });
      installRecipeRun(st);
      const res = simulate(st, built.content, { turnCap: 400 });
      if (res.won) acc.wins++;
      acc.turns += res.turns || 0;
      for (const l of res.log || []) {
        const c = /CONSUME (\d+)/.exec(String(l.event)); if (c) acc.consumed += Number(c[1]);
        if (l.event === 'death' && isSpiderling(l.who)) acc.killed++;
      }
      for (const e of res.effects || []) {
        if (e.kind === 'dot' && e.subtype === 'HP Burn') acc.burnTicks++;
        if ((e.kind === 'damage' || e.kind === 'dot') && e.source && champKey(e.source) === 'PELOPS') acc.pelops += (e.amount || 0);
      }
      const boss = (st.enemies || []).find(x => x.role === 'boss');
      acc.bossPct += boss ? Math.max(0, 100 * boss.hp / (boss.maxHp || 1)) : 0;
    }
  } finally { acquire.target = savedTarget; }   // ALWAYS restore the shared recipe object
  const d = (x) => x / N;
  return { winRate: 100 * acc.wins / N, turns: d(acc.turns), consumed: d(acc.consumed), killed: d(acc.killed),
    burnTicks: d(acc.burnTicks), pelops: d(acc.pelops), bossPct: d(acc.bossPct) };
}

const A = await runArm(false);   // baseline: Ezio AoE nuke (as shipped)
const B = await runArm(true);    // intervention: Ezio A2 single-target (stops clearing the swarm)

const row = (label, a, b, fmt = (x) => Math.round(x).toLocaleString()) =>
  console.log(`    ${label.padEnd(34)}${fmt(a).padStart(14)}${fmt(b).padStart(16)}   ${b > a ? '▲' : b < a ? '▼' : '='} ${(a ? ((b - a) / a * 100).toFixed(0) : '—')}%`);

console.log(`\n═══ EZIO EXPERIMENT — does the sim reproduce it?  Spider's Den 13 (${N} seeds/arm) ═══`);
console.log(`\n    ${'METRIC'.padEnd(34)}${'A: Ezio AoE'.padStart(14)}${'B: Ezio single'.padStart(16)}   Δ`);
console.log(`    ${'─'.repeat(78)}`);
row('sim win rate %', A.winRate, B.winRate, (x) => x.toFixed(0) + '%');
row('Spiderlings killed by us/fight', A.killed, B.killed, (x) => x.toFixed(1));
row('Spiderlings consumed/fight', A.consumed, B.consumed, (x) => x.toFixed(1));
row('HP-Burn TICKS/fight', A.burnTicks, B.burnTicks, (x) => x.toFixed(1));
row('Pelops damage dealt/fight', A.pelops, B.pelops);
row('Skavag END-HP % (lower = closer to kill)', A.bossPct, B.bossPct, (x) => x.toFixed(0) + '%');

const validated = B.burnTicks > A.burnTicks * 1.15 && B.pelops > A.pelops * 1.15 && B.bossPct < A.bossPct;
console.log(`\n  ▶ ${validated ? 'VALIDATED' : 'NOT reproduced'}: neutering Ezio’s AoE ${validated
  ? 'raises Spiderling survival → HP-Burn ticks → Pelops damage → and drops Skavag’s end-HP. The sim CONTAINS the mechanic Mike found.'
  : 'did NOT move the burn/Pelops/boss chain as reality showed — the sim is under-modeling the HP-Burn-splash path even when the swarm lives.'}`);
console.log(`\nQA_JSON ${JSON.stringify({ rung: 'ezio-experiment', seeds: N, armA: A, armB: B, validated })}`);
