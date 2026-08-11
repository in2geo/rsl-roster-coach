// tools/sim-spider-protection-lifecycle.mjs — Vergis/Bambus PROTECTION LIFECYCLE (defect #1 investigation).
//
// Measures the Ally-Protection lifecycle the RIGHT way — coverage PER INCOMING ATTACK, not per global turn
// (Mike 2026-07-30): a protection buff that's "up" but not up WHEN A HIT LANDS does nothing. Over N seeds:
//   • Vergis A2 (the Ally-Protection source) cast count + cadence (observed cooldown; base cd4)
//   • Ally Protection PER-INCOMING-ATTACK coverage per champ: of all hits on a champ, what fraction had AP active
//   • AP duration at placement (recipe = 2t) vs MAX observed → does Bambus A2 EXTEND_EFFECT (+1t) land on it?
//   • Shield PER-INCOMING-ATTACK coverage per champ (had any shield pool when the hit landed?)
// Observe-only (onAction + onDamageTaken). Aggregate — never a single seed.
//
// Run: node --env-file=.env.local tools/sim-spider-protection-lifecycle.mjs [N=40]

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

const hasBuff = (c, t) => (c.buffs || []).some((b) => b.type === t);
const shieldPool = (c) => (c.buffs || []).reduce((s, b) => s + (/Shield/.test(b.type) ? Math.max(0, b.value || 0) : 0), 0);
const apDur = (c) => Math.max(0, ...((c.buffs || []).filter((b) => b.type === 'Ally Protection').map((b) => b.turnsLeft)), 0);
const mean = (a) => a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0;
const med = (a) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); return s[Math.floor((s.length - 1) / 2)]; };
const vergKey = champKey('Vergis');

const probe0 = await buildBattle({ rest, fixture: JSON.parse(fs.readFileSync(path.join(REPO, 'test', 'golden', 'spider13-donbambus-current.json'), 'utf8')), repoRoot: REPO });
if (probe0.skip) { console.log('skipped:', probe0.skip); process.exit(0); }
const allyKeys = probe0.allies.map((a) => champKey(a.name));
const short = Object.fromEntries(probe0.allies.map((a) => [champKey(a.name), a.name.split(' ')[0]]));
const fixture = JSON.parse(fs.readFileSync(path.join(REPO, 'test', 'golden', 'spider13-donbambus-current.json'), 'utf8'));

// aggregate accumulators
const hits = Object.fromEntries(allyKeys.map((k) => [k, { total: 0, apOn: 0, shieldOn: 0 }]));
const vergA2counts = [], vergA2intervals = [], apPlaceDur = [], apMaxDur = [];

for (let seed = 1; seed <= N; seed++) {
  const built = await buildBattle({ rest, fixture, repoRoot: REPO });
  applyBattleLayers(built.allies);
  const st = makeState({ allies: built.allies, enemies: [], seed });
  installRecipeRun(st);
  const byKey = new Map(built.allies.map((a) => [champKey(a.name), a]));

  let vergA2 = 0; const vergA2turns = [];
  let maxApSeen = 0;
  st.onAction = (s, actor, skill) => {
    if (champKey(actor.name) !== vergKey) return;
    const slot = (skill?.slot || '').toString().match(/A[1-4]/)?.[0];
    if (slot === 'A2') { vergA2++; vergA2turns.push(s.turn); }
  };
  st.onDamageTaken = (s, target, attacker, toHp) => {
    const k = champKey(target.name); if (!(k in hits)) return;
    hits[k].total++;
    if (hasBuff(target, 'Ally Protection')) hits[k].apOn++;
    if (shieldPool(target) > 0) hits[k].shieldOn++;
  };
  const origTS = st.onTurnStart;
  st.onTurnStart = (s, actor) => { origTS?.(s, actor); for (const a of built.allies) { const d = apDur(a); if (d > maxApSeen) maxApSeen = d; } };

  simulate(st, built.content, { turnCap: 400 });
  vergA2counts.push(vergA2);
  for (let i = 1; i < vergA2turns.length; i++) vergA2intervals.push(vergA2turns[i] - vergA2turns[i - 1]);
  apMaxDur.push(maxApSeen);
}

console.log(`\n═══ PROTECTION LIFECYCLE — Spider-13  (${N} seeds) ═══`);
console.log(`\n  VERGIS A2 (Ally-Protection source, base cd4):`);
console.log(`    casts/fight: ${mean(vergA2counts).toFixed(1)}   ·   median turns between casts: ${med(vergA2intervals)}   (base cd4 → he'd cast every 4 of HIS turns; his turns are ~14t apart, so AP is placed ~every ${med(vergA2intervals) || '—'} wall-clock turns)`);
console.log(`    AP placed duration (recipe): 2t   ·   MAX AP duration ever observed: ${med(apMaxDur)}t   → ${med(apMaxDur) > 2 ? 'Bambus A2 EXTEND is landing (>2)' : '⚠ never exceeds 2t — Bambus A2 EXTEND_EFFECT is NOT extending Ally Protection'}`);

console.log(`\n  PER-INCOMING-ATTACK COVERAGE (the honest measure — was protection up WHEN the hit landed?):`);
console.log(`    ${'champ'.padEnd(9)}${'hits'.padStart(7)}${'AllyProt%'.padStart(11)}${'shield%'.padStart(9)}   note`);
console.log(`    ${'─'.repeat(52)}`);
for (const k of allyKeys) {
  const h = hits[k];
  const ap = h.total ? Math.round(100 * h.apOn / h.total) : 0;
  const sh = h.total ? Math.round(100 * h.shieldOn / h.total) : 0;
  const note = k === vergKey ? '(caster — excluded from own AP)' : ap < 40 ? 'LOW — eats most hits unprotected' : '';
  console.log(`    ${short[k].slice(0, 8).padEnd(9)}${String(h.total).padStart(7)}${(ap + '%').padStart(11)}${(sh + '%').padStart(9)}   ${note}`);
}
console.log(`\n  ▶ Ally-Protection SPREADS a focused champ's damage to the other protected allies (−50% to the target). If`);
console.log(`    coverage-per-attack is low, the focused champ (Bambus/Vergis) eats full hits exactly when it matters.`);

console.log(`\nQA_JSON ${JSON.stringify({ rung: 'protection-lifecycle', seeds: N,
  vergisA2PerFight: +mean(vergA2counts).toFixed(1), apPlacedDur: 2, apMaxDurObserved: med(apMaxDur),
  perAttackCoverage: Object.fromEntries(allyKeys.map((k) => [short[k], { hits: hits[k].total, apPct: hits[k].total ? Math.round(100 * hits[k].apOn / hits[k].total) : 0, shieldPct: hits[k].total ? Math.round(100 * hits[k].shieldOn / hits[k].total) : 0 }])) })}`);
