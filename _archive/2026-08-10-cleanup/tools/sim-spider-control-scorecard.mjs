// tools/sim-spider-control-scorecard.mjs — AGGREGATE swarm-control metrics over N seeds, split WIN vs LOSS.
//
// The forensic traces (shield/cast/opening/a1-aoe) were single-run (seed 3, a loss). This confirms the
// quantitative claims in aggregate and tests the core hypothesis: if WINS have high swarm-control coverage and
// LOSSES have low, then swarm control IS the driver of the outcome. Per fight it measures: swarm turn-share,
// avg live spiderlings, Decrease-Speed coverage, Petrification coverage, Bambus A2 (shield) casts, and A1 AoE
// rate. Observe-only.
//
// Run: node --env-file=.env.local tools/sim-spider-control-scorecard.mjs [N=50]

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { makeState, simulate } from '../lib/sim/engine.js';
import { buildBattle, applyBattleLayers } from '../lib/sim/dragon-fixture.js';
import { installRecipeRun } from '../lib/sim/interpreter.js';
import { champKey } from '../lib/sim/recipes.js';

const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const N = Number(process.argv[2] || 50);
if (!process.env.SUPABASE_URL) { console.log('needs the DB. Run with --env-file=.env.local'); process.exit(2); }
const BASE = process.env.SUPABASE_URL.replace(/\/rest\/v1\/?$/, '');
const H = { apikey: process.env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}` };
const _c = new Map();
const rest = async (p) => { if (!_c.has(p)) _c.set(p, await (await fetch(`${BASE}/rest/v1/${p}`, { headers: H })).json()); return _c.get(p); };

const isSlow = (c) => (c.debuffs || []).some((d) => /Decrease Sp(ee|)d|Decrease SPD/i.test(d.type));
const isPetr = (c) => (c.debuffs || []).some((d) => d.type === 'Petrification');
const shieldPool = (c) => (c.buffs || []).reduce((s, b) => s + (/Shield/.test(b.type) ? Math.max(0, b.value || 0) : 0), 0);
const mean = (a) => a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0;
const med = (a) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); return s[Math.floor((s.length - 1) / 2)]; };

const fixture = JSON.parse(fs.readFileSync(path.join(REPO, 'test', 'golden', 'spider13-donbambus-current.json'), 'utf8'));
const probe0 = await buildBattle({ rest, fixture, repoRoot: REPO });
if (probe0.skip) { console.log('skipped:', probe0.skip); process.exit(0); }
const bambusKey = probe0.allies.map((a) => champKey(a.name)).find((k) => /bambus/i.test(k));

const fights = [];
for (let seed = 1; seed <= N; seed++) {
  const built = await buildBattle({ rest, fixture, repoRoot: REPO });
  applyBattleLayers(built.allies);
  const st = makeState({ allies: built.allies, enemies: [], seed });
  installRecipeRun(st);

  let ticks = 0, addAlive = 0, addTurns = 0, swarmSlowFrac = 0, swarmPetrFrac = 0, a2 = 0, a1 = 0, a1aoe = 0;
  const eff = (e) => Math.max(0, e.hp || 0) + shieldPool(e);
  st.onAction = (s, actor, skill) => {
    if (champKey(actor.name) !== bambusKey) return;
    const slot = (skill?.slot || '').toString().match(/A[1-4]/)?.[0];
    if (slot === 'A2') a2++;
    if (slot === 'A1') { a1++; const en = (s.enemies || []).filter((e) => e.alive); const tgt = en.slice().sort((x, y) => eff(x) - eff(y))[0]; if (tgt && (tgt.debuffs || []).length >= 2) a1aoe++; }
  };
  const orig = st.onTurnStart;
  st.onTurnStart = (s, actor) => {
    orig?.(s, actor);
    ticks++;
    const adds = (s.enemies || []).filter((e) => e.role === 'add' && e.alive);
    addAlive += adds.length;
    if (adds.length) { swarmSlowFrac += adds.filter(isSlow).length / adds.length; swarmPetrFrac += adds.filter(isPetr).length / adds.length; }
    if (actor?.role === 'add') addTurns++;
  };
  const res = simulate(st, built.content, { turnCap: 400 });
  fights.push({
    won: !!res.won, turns: res.turns || 0,
    swarmTurnShare: res.turns ? addTurns / res.turns : 0,
    avgLive: ticks ? addAlive / ticks : 0,
    slowCov: ticks ? swarmSlowFrac / ticks : 0,
    petrCov: ticks ? swarmPetrFrac / ticks : 0,
    a2casts: a2, a1aoeRate: a1 ? a1aoe / a1 : 0,
  });
}

const wins = fights.filter((f) => f.won), losses = fights.filter((f) => !f.won);
const row = (label, arr) => {
  const g = (f) => f;
  console.log(`  ${label.padEnd(22)}`
    + `${(mean(arr.map((f) => f.slowCov)) * 100).toFixed(0).padStart(7)}%`
    + `${(mean(arr.map((f) => f.petrCov)) * 100).toFixed(0).padStart(9)}%`
    + `${mean(arr.map((f) => f.avgLive)).toFixed(1).padStart(9)}`
    + `${(mean(arr.map((f) => f.swarmTurnShare)) * 100).toFixed(0).padStart(10)}%`
    + `${(mean(arr.map((f) => f.a1aoeRate)) * 100).toFixed(0).padStart(9)}%`
    + `${mean(arr.map((f) => f.a2casts)).toFixed(1).padStart(8)}`
    + `${Math.round(med(arr.map((f) => f.turns))).toString().padStart(8)}`);
};

console.log(`\n═══ SWARM-CONTROL SCORECARD — Spider-13  (${N} seeds) ═══`);
console.log(`  win rate: ${Math.round(100 * wins.length / N)}%  (${wins.length}W / ${losses.length}L)   [reality ~71%]\n`);
console.log(`  ${'group'.padEnd(22)}${'slow%'.padStart(8)}${'petr%'.padStart(9)}${'avgLive'.padStart(9)}${'swarmTurn%'.padStart(11)}${'A1-AoE%'.padStart(9)}${'A2cast'.padStart(8)}${'medTurns'.padStart(8)}`);
console.log(`  ${'─'.repeat(84)}`);
row('ALL', fights);
if (wins.length) row('WINS', wins);
if (losses.length) row('LOSSES', losses);
console.log(`\n  ▶ If WINS show higher slow%/petr% + lower swarmTurn% than LOSSES, swarm control drives the outcome (hypothesis confirmed).`);
console.log(`\nQA_JSON ${JSON.stringify({ rung: 'control-scorecard', seeds: N, winRate: Math.round(100 * wins.length / N),
  all: { slowCov: +mean(fights.map((f) => f.slowCov)).toFixed(3), petrCov: +mean(fights.map((f) => f.petrCov)).toFixed(3), avgLive: +mean(fights.map((f) => f.avgLive)).toFixed(1), swarmTurnShare: +mean(fights.map((f) => f.swarmTurnShare)).toFixed(3), a1aoeRate: +mean(fights.map((f) => f.a1aoeRate)).toFixed(2), a2casts: +mean(fights.map((f) => f.a2casts)).toFixed(1) },
  wins: wins.length && { slowCov: +mean(wins.map((f) => f.slowCov)).toFixed(3), petrCov: +mean(wins.map((f) => f.petrCov)).toFixed(3), swarmTurnShare: +mean(wins.map((f) => f.swarmTurnShare)).toFixed(3) },
  losses: losses.length && { slowCov: +mean(losses.map((f) => f.slowCov)).toFixed(3), petrCov: +mean(losses.map((f) => f.petrCov)).toFixed(3), swarmTurnShare: +mean(losses.map((f) => f.swarmTurnShare)).toFixed(3) } })}`);
