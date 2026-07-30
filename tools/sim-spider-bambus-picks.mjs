// tools/sim-spider-bambus-picks.mjs — ISOLATE why the sim's spiderlings target Bambus.
//
// THE QUESTION (Mike 2026-07-30): Bambus has the 2nd-highest HP on the team → under a shield-EHP "easiest to
// kill" rule he should be #4 of 5 (only Pelops safer) and almost never picked. Yet the sim hits him ~55k
// (reality 8k). This isolates EVERY off-taunt spiderling pick of Bambus and dumps the full decision state at
// that instant — all 5 champs' current HP, shield pool, EFFECTIVE HP, and availability (veil/taunt/sleep) —
// so we can see WHETHER Bambus was genuinely the lowest targetable effHP (→ his effHP is dropping, find why)
// or the pick is a BUG (a squishier champ was available and skipped).
//
// Method: the engine records a `spider_pick` ledger event per pick (spider.js). We snapshot the team's effHP
// at each turn (onTurnStart, before the spiderling acts — DoTs on allies tick on THEIR turns, not the
// spiderling's, so the snapshot == pick-time state) and join it to the Bambus picks. Observe-only.
//
// Run: node --env-file=.env.local tools/sim-spider-bambus-picks.mjs [N=20]

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { makeState, simulate } from '../lib/sim/engine.js';
import { buildBattle, applyBattleLayers } from '../lib/sim/dragon-fixture.js';
import { installRecipeRun } from '../lib/sim/interpreter.js';
import { champKey } from '../lib/sim/recipes.js';

const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const N = Number(process.argv[2] || 20);
const DUMP = Number(process.env.DUMP ?? 8);   // how many example Bambus-pick decisions to print in full

if (!process.env.SUPABASE_URL) { console.log('needs the DB. Run with --env-file=.env.local'); process.exit(2); }
const BASE = process.env.SUPABASE_URL.replace(/\/rest\/v1\/?$/, '');
const H = { apikey: process.env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}` };
const _c = new Map();
const rest = async (p) => { if (!_c.has(p)) _c.set(p, await (await fetch(`${BASE}/rest/v1/${p}`, { headers: H })).json()); return _c.get(p); };

const shieldPool = (c) => (c.buffs || []).reduce((s, b) => s + (/Shield/.test(b.type) ? Math.max(0, b.value || 0) : 0), 0);
const has = (c, t) => (c.buffs || []).some((b) => b.type === t);
const asleep = (c) => (c.debuffs || []).some((d) => d.type === 'Sleep');
const fmt = (n) => n == null ? '—' : n >= 1e3 ? Math.round(n / 1e3) + 'k' : String(Math.round(n));
const median = (a) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); return s[Math.floor((s.length - 1) / 2)]; };

const fixture = JSON.parse(fs.readFileSync(path.join(REPO, 'test', 'golden', 'spider13-donbambus-current.json'), 'utf8'));
const probe = await buildBattle({ rest, fixture, repoRoot: REPO });
if (probe.skip) { console.log('skipped:', probe.skip); process.exit(0); }
const allyKeys = probe.allies.map((a) => champKey(a.name));
const short = Object.fromEntries(probe.allies.map((a) => [champKey(a.name), a.name.split(' ')[0]]));
const bambusKey = allyKeys.find((k) => /bambus/i.test(k));

// The engine's targetable filter (mirror of chooseSingleTarget), so we can tell whether a lower-effHP champ was
// AVAILABLE when Bambus was picked: drop Perfect-Veil always; drop plain Veil unless all veiled.
function targetablePool(snapAllies) {
  const live = snapAllies.filter((a) => a.alive);
  let base = live.filter((a) => !a.perfectVeil);
  const unveiled = base.filter((a) => !a.veil);
  if (unveiled.length) base = unveiled;
  return base;
}

let totalBambusPicks = 0, offTauntBambusPicks = 0, bambusWasMinEff = 0, bambusNotMin = 0;
const bambusHpPctWhenPicked = [], bambusEffWhenPicked = [], bambusShieldWhenPicked = [], bambusRankWhenPicked = [];
const examples = [];

for (let seed = 1; seed <= N; seed++) {
  const built = await buildBattle({ rest, fixture, repoRoot: REPO });
  applyBattleLayers(built.allies);
  const st = makeState({ allies: built.allies, enemies: [], seed });
  installRecipeRun(st);
  const byKey = new Map(built.allies.map((a) => [champKey(a.name), a]));

  const snapByTurn = new Map();   // turn → [{key, hp, maxHp, shield, eff, alive, perfectVeil, veil, taunt, sleep}]
  const orig = st.onTurnStart;
  st.onTurnStart = (s, actor) => {
    orig?.(s, actor);
    snapByTurn.set(s.turn, allyKeys.map((k) => {
      const c = byKey.get(k);
      const shield = shieldPool(c);
      return { key: k, hp: Math.max(0, c.hp || 0), maxHp: c.maxHp || 1, shield, eff: Math.max(0, c.hp || 0) + shield,
        alive: !!c.alive, perfectVeil: has(c, 'Perfect Veil'), veil: has(c, 'Veil'), taunt: has(c, 'Taunt') || has(c, 'Provoke'), sleep: asleep(c) };
    }));
  };

  const res = simulate(st, built.content, { turnCap: 400 });

  for (const e of (res.effects || [])) {
    if (e.kind !== 'spider_pick') continue;
    if (champKey(e.target) !== bambusKey) continue;
    totalBambusPicks++;
    if (e.pelTaunting) continue;             // taunt overrode the pick — not an effHP decision
    offTauntBambusPicks++;
    const snap = snapByTurn.get(e.turn);
    if (!snap) continue;
    const bam = snap.find((x) => x.key === bambusKey);
    const pool = targetablePool(snap);
    const minEff = Math.min(...pool.map((x) => x.eff));
    const isMin = bam.eff <= minEff + 1e-6;
    if (isMin) bambusWasMinEff++; else bambusNotMin++;
    // Bambus's effHP rank among targetable (1 = lowest = easiest)
    const rank = pool.filter((x) => x.eff < bam.eff).length + 1;
    bambusHpPctWhenPicked.push(bam.hp / bam.maxHp);
    bambusEffWhenPicked.push(bam.eff);
    bambusShieldWhenPicked.push(bam.shield);
    bambusRankWhenPicked.push(rank);
    if (examples.length < DUMP) examples.push({ seed, turn: e.turn, snap, bam, isMin });
  }
}

console.log(`\n═══ WHY IS BAMBUS TARGETED? — Spider's Den 13  (${N} seeds) ═══`);
console.log(`  Bambus picks: ${totalBambusPicks} total  ·  ${offTauntBambusPicks} OFF-taunt (the ones to explain; taunt picks are Pelops-forced)`);
if (offTauntBambusPicks === 0) { console.log('  (no off-taunt Bambus picks — nothing to explain)'); process.exit(0); }
console.log(`\n  Of the off-taunt Bambus picks:`);
console.log(`    • Bambus WAS the lowest targetable effHP: ${bambusWasMinEff}/${offTauntBambusPicks} (${Math.round(100 * bambusWasMinEff / offTauntBambusPicks)}%)  → legit by the rule; his effHP is genuinely dropping lowest`);
console.log(`    • Bambus was NOT the min (a squishier champ was available): ${bambusNotMin}/${offTauntBambusPicks} (${Math.round(100 * bambusNotMin / offTauntBambusPicks)}%)  → targeting BUG`);
console.log(`\n  At the moment Bambus was picked (medians):`);
console.log(`    • his HP%: ${Math.round(100 * median(bambusHpPctWhenPicked))}%   (low ⇒ he's being DRAINED before the pick — poison? AoE? — not a tank anymore)`);
console.log(`    • his effHP: ${fmt(median(bambusEffWhenPicked))}   ·   of which shield: ${fmt(median(bambusShieldWhenPicked))}   (shield depleted ⇒ effHP collapses to bare HP)`);
console.log(`    • his effHP RANK among targetable: #${median(bambusRankWhenPicked)} of 5  (1 = easiest)`);

console.log(`\n  ── EXAMPLE DECISIONS (full team state at the pick) ──`);
for (const ex of examples) {
  console.log(`\n  seed ${ex.seed} · turn ${ex.turn} · Bambus ${ex.isMin ? 'WAS min effHP (rule-legit)' : 'was NOT min — BUG'}`);
  console.log(`    ${'champ'.padEnd(8)}${'HP'.padStart(8)}${'HP%'.padStart(6)}${'shield'.padStart(8)}${'effHP'.padStart(8)}   flags`);
  for (const x of [...ex.snap].sort((a, b) => a.eff - b.eff)) {
    const flags = [x.alive ? '' : 'DEAD', x.perfectVeil ? 'PVEIL' : '', x.veil ? 'veil' : '', x.taunt ? 'TAUNT' : '', x.sleep ? 'sleep' : ''].filter(Boolean).join(' ');
    const mark = x.key === bambusKey ? ' ◄ picked' : '';
    console.log(`    ${short[x.key].slice(0, 7).padEnd(8)}${String(Math.round(x.hp)).padStart(8)}${(Math.round(100 * x.hp / x.maxHp) + '%').padStart(6)}${fmt(x.shield).padStart(8)}${fmt(x.eff).padStart(8)}   ${flags}${mark}`);
  }
}

console.log(`\nQA_JSON ${JSON.stringify({ rung: 'spider-bambus-picks', seeds: N, offTauntBambusPicks,
  wasMinPct: Math.round(100 * bambusWasMinEff / offTauntBambusPicks), bugPct: Math.round(100 * bambusNotMin / offTauntBambusPicks),
  medHpPctWhenPicked: Math.round(100 * median(bambusHpPctWhenPicked)), medEffWhenPicked: Math.round(median(bambusEffWhenPicked)),
  medShieldWhenPicked: Math.round(median(bambusShieldWhenPicked)), medRank: median(bambusRankWhenPicked) })}`);
