// tools/sim-spider-boss-attribution.mjs — WHAT kills Skavag, and why ~70t too fast? (fidelity defect #2)
//
// The sim boss dies at ~111t vs reality ~181t. Before ANY turn-count tuning we must know what is doing the
// killing: break the boss's damage-taken down by SOURCE CHAMP and by MECHANIC (direct / poison-DoT / reflect /
// HP-Burn / %MaxHP), aggregate over the frozen seeds, and see which contributor is carrying the kill. If one
// source/mechanic is outsized vs its reality share, that's the over-attribution stretching the fight short.
// Also reports the boss-damage RATE (taken/turn) vs the reality-implied rate. Observe-only (reads state.effects
// + the authoritative boss.taken).
//
// Run: node --env-file=.env.local tools/sim-spider-boss-attribution.mjs [N=60]

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { makeState, simulate } from '../lib/sim/engine.js';
import { buildBattle, applyBattleLayers } from '../lib/sim/dragon-fixture.js';
import { installRecipeRun } from '../lib/sim/interpreter.js';
import { champKey } from '../lib/sim/recipes.js';

const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const N = Number(process.argv[2] || 60);
const REALITY_TURNS = 181, BOSS_HP = 1064310;
if (!process.env.SUPABASE_URL) { console.log('needs the DB. Run with --env-file=.env.local'); process.exit(2); }
const BASE = process.env.SUPABASE_URL.replace(/\/rest\/v1\/?$/, '');
const H = { apikey: process.env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}` };
const _c = new Map();
const rest = async (p) => { if (!_c.has(p)) _c.set(p, await (await fetch(`${BASE}/rest/v1/${p}`, { headers: H })).json()); return _c.get(p); };

const mean = (a) => a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0;
const med = (a) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); return s[Math.floor((s.length - 1) / 2)]; };
const fmt = (n) => n == null ? '—' : Math.abs(n) >= 1e6 ? (n / 1e6).toFixed(2) + 'M' : Math.abs(n) >= 1e3 ? Math.round(n / 1e3) + 'k' : String(Math.round(n));

const fixture = JSON.parse(fs.readFileSync(path.join(REPO, 'test', 'golden', 'spider13-donbambus-current.json'), 'utf8'));
const probe0 = await buildBattle({ rest, fixture, repoRoot: REPO });
if (probe0.skip) { console.log('skipped:', probe0.skip); process.exit(0); }
const allyKeys = probe0.allies.map((a) => champKey(a.name));
const short = Object.fromEntries(probe0.allies.map((a) => [champKey(a.name), a.name.split(' ')[0]]));

// per-mechanic buckets (kind → label) — how the ledger tags boss damage
const KIND_LABEL = { damage: 'direct', dot: 'poison/DoT', reflect: 'reflect', hp_burn: 'HP-Burn', maxHP: '%MaxHP', absorb: 'absorb', activate: 'activate' };

const bySource = {}, byKind = {};          // aggregate totals
let wins = 0; const turnsArr = [], bossTakenArr = [], consumeHealArr = [];
const bump = (o, k, v) => { o[k] = (o[k] || 0) + v; };

for (let seed = 1; seed <= N; seed++) {
  const built = await buildBattle({ rest, fixture, repoRoot: REPO });
  applyBattleLayers(built.allies);
  const st = makeState({ allies: built.allies, enemies: [], seed });
  installRecipeRun(st);
  const res = simulate(st, built.content, { turnCap: 400 });
  if (res.won) wins++;
  turnsArr.push(res.turns || 0);
  const boss = (st.enemies || []).find((e) => e.role === 'boss') || {};
  bossTakenArr.push(boss.taken || 0);
  // consume heal-back to the boss (from the log): +3% maxHP × N per consume
  let healBack = 0;
  for (const l of res.log || []) { const mo = /CONSUME (\d+)/.exec(String(l.event)); if (mo) healBack += 0.03 * BOSS_HP * (+mo[1]); }
  consumeHealArr.push(healBack);
  // attribute boss damage from the ledger: any effect whose TARGET is the boss
  const bossName = boss.name;
  for (const e of res.effects || []) {
    if (!bossName || e.target !== bossName) continue;
    const amt = e.amount ?? 0; if (amt <= 0) continue;
    if (!['damage', 'dot', 'reflect', 'hp_burn', 'maxHP', 'absorb'].includes(e.kind)) continue;
    const src = e.source ? champKey(e.source) : 'unattributed';
    const sKey = allyKeys.includes(src) ? src : (e.kind === 'reflect' ? 'reflect(unattr)' : 'other/unattr');
    bump(bySource, sKey, amt);
    bump(byKind, KIND_LABEL[e.kind] || e.kind, amt);
  }
}

const perFight = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, v / N]));
const srcF = perFight(bySource), kindF = perFight(byKind);
const ledgerTotal = Object.values(srcF).reduce((s, x) => s + x, 0);
const bossTaken = med(bossTakenArr), simTurns = med(turnsArr), healBack = med(consumeHealArr);

console.log(`\n═══ BOSS DAMAGE ATTRIBUTION — Skavag, Spider-13  (${N} seeds) ═══`);
console.log(`  WR ${Math.round(100 * wins / N)}%  ·  sim fight ${simTurns}t  vs reality ~${REALITY_TURNS}t  ·  boss maxHP ${fmt(BOSS_HP)}`);
console.log(`  boss.taken (authoritative, /fight median): ${fmt(bossTaken)}   ·   consume heal-back to boss: ${fmt(healBack)}   ·   ledger-attributed total: ${fmt(ledgerTotal)}`);
console.log(`  RATE: sim ${fmt(bossTaken / Math.max(1, simTurns))}/turn  vs reality-implied ${fmt((BOSS_HP + healBack) / REALITY_TURNS)}/turn  →  sim is ${((bossTaken / simTurns) / Math.max(1, (BOSS_HP + healBack) / REALITY_TURNS)).toFixed(2)}× reality's kill rate`);

console.log(`\n  BY SOURCE CHAMP (boss damage /fight):`);
for (const [k, v] of Object.entries(srcF).sort((a, b) => b[1] - a[1])) {
  console.log(`    ${(short[k] || k).slice(0, 14).padEnd(15)}${fmt(v).padStart(9)}${('  ' + Math.round(100 * v / Math.max(1, ledgerTotal)) + '%').padStart(7)}`);
}
console.log(`\n  BY MECHANIC (boss damage /fight):`);
for (const [k, v] of Object.entries(kindF).sort((a, b) => b[1] - a[1])) {
  console.log(`    ${k.padEnd(15)}${fmt(v).padStart(9)}${('  ' + Math.round(100 * v / Math.max(1, ledgerTotal)) + '%').padStart(7)}`);
}
console.log(`\n  ▶ The source/mechanic carrying the biggest share is the one to check against reality first. If poison-DoT`);
console.log(`    is large despite Skavag's 90% poison reduction, or reflect is outsized, that's the over-attribution.`);
console.log(`\nQA_JSON ${JSON.stringify({ rung: 'boss-attribution', seeds: N, winRate: Math.round(100 * wins / N), simTurns, realityTurns: REALITY_TURNS,
  bossTaken: Math.round(bossTaken), consumeHealBack: Math.round(healBack), killRateVsReality: +((bossTaken / simTurns) / Math.max(1, (BOSS_HP + healBack) / REALITY_TURNS)).toFixed(2),
  bySource: Object.fromEntries(Object.entries(srcF).map(([k, v]) => [short[k] || k, Math.round(v)])), byMechanic: Object.fromEntries(Object.entries(kindF).map(([k, v]) => [k, Math.round(v)])) })}`);
