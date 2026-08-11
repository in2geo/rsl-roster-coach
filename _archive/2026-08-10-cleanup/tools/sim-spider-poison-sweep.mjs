// tools/sim-spider-poison-sweep.mjs — sensitivity sweep of Skavag's poison-reduction factor.
//
// The sim currently uses poisonDamageFactorVsBoss = 0.10 (90% reduction, "Healing Assured") — an UNVERIFIED
// amount (Mike 2026-07-30). This sweeps the factor over the frozen seeds (1..N) and reports WR, median turns,
// boss damage-taken, and Bambus's poison-to-boss, so we can see how much this one constant moves the fight.
// Override only — no permanent change. Baseline row is 0.10.
//
// Run: node --env-file=.env.local tools/sim-spider-poison-sweep.mjs [N=40]

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { makeState, simulate } from '../lib/sim/engine.js';
import { buildBattle, applyBattleLayers } from '../lib/sim/dragon-fixture.js';
import { installRecipeRun } from '../lib/sim/interpreter.js';
import { champKey } from '../lib/sim/recipes.js';

const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const N = Number(process.argv[2] || 40);
const FACTORS = [0.02, 0.10, 0.25, 0.50];   // 0.10 = current baseline; 0.50 = the value Mike asked to test
if (!process.env.SUPABASE_URL) { console.log('needs the DB. Run with --env-file=.env.local'); process.exit(2); }
const BASE = process.env.SUPABASE_URL.replace(/\/rest\/v1\/?$/, '');
const H = { apikey: process.env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}` };
const _c = new Map();
const rest = async (p) => { if (!_c.has(p)) _c.set(p, await (await fetch(`${BASE}/rest/v1/${p}`, { headers: H })).json()); return _c.get(p); };
const med = (a) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); return s[Math.floor((s.length - 1) / 2)]; };
const fmt = (n) => Math.abs(n) >= 1e6 ? (n / 1e6).toFixed(2) + 'M' : Math.abs(n) >= 1e3 ? Math.round(n / 1e3) + 'k' : String(Math.round(n));
const fixture = JSON.parse(fs.readFileSync(path.join(REPO, 'test', 'golden', 'spider13-donbambus-current.json'), 'utf8'));
const bambusKey = (await buildBattle({ rest, fixture, repoRoot: REPO })).allies.map((a) => champKey(a.name)).find((k) => /bambus/i.test(k));

console.log(`\n═══ POISON-REDUCTION SWEEP — Skavag, Spider-13  (${N} seeds each)  [reality WR ~71%, ~181t] ═══`);
console.log(`  ${'factor'.padEnd(9)}${'reduction'.padStart(10)}${'WR'.padStart(7)}${'medTurns'.padStart(10)}${'bossTaken'.padStart(11)}${'Bambus→boss poison'.padStart(20)}`);
console.log(`  ${'─'.repeat(66)}`);
const out = [];
for (const factor of FACTORS) {
  let wins = 0; const turns = [], bossTaken = [], bamPoison = [];
  for (let seed = 1; seed <= N; seed++) {
    const built = await buildBattle({ rest, fixture, repoRoot: REPO });
    applyBattleLayers(built.allies);
    built.content.poisonDamageFactorVsBoss = factor;   // OVERRIDE the constant under test
    const st = makeState({ allies: built.allies, enemies: [], seed });
    installRecipeRun(st);
    const res = simulate(st, built.content, { turnCap: 400 });
    if (res.won) wins++;
    turns.push(res.turns || 0);
    const boss = (st.enemies || []).find((e) => e.role === 'boss') || {};
    bossTaken.push(boss.taken || 0);
    let bp = 0; for (const e of res.effects || []) if (e.target === boss.name && e.kind === 'dot' && champKey(e.source || '') === bambusKey) bp += (e.amount || 0);
    bamPoison.push(bp);
  }
  const wr = Math.round(100 * wins / N), mt = med(turns), bt = med(bossTaken), bp = med(bamPoison);
  const tag = factor === 0.10 ? '  ← CURRENT BASELINE' : factor === 0.50 ? '  ← requested' : '';
  console.log(`  ${factor.toFixed(2).padEnd(9)}${(Math.round((1 - factor) * 100) + '%').padStart(10)}${(wr + '%').padStart(7)}${String(mt).padStart(10)}${fmt(bt).padStart(11)}${fmt(bp).padStart(20)}${tag}`);
  out.push({ factor, reductionPct: Math.round((1 - factor) * 100), winRate: wr, medTurns: mt, bossTaken: Math.round(bt), bambusBossPoison: Math.round(bp) });
}
console.log(`\n  ▶ Higher factor = LESS reduction = MORE poison = boss dies FASTER (fewer turns). To move toward reality's`);
console.log(`    ~181t the factor would go DOWN, not up — but WR is the product gate; watch both columns.`);
console.log(`\nQA_JSON ${JSON.stringify({ rung: 'poison-sweep', seeds: N, sweep: out })}`);
