// tools/sim-spider-bambus-casts.mjs — what skill does the sim's Bambus actually cast, and how often A2 (the
// shield-builder Grovetender)? In a 1-round fight the ONLY thing that maintains + grows a shield is re-casting
// the active shield skills; reality holds Bambus at ~4 bars, the sim drops him to 0. This traces his skill
// sequence (via onAction) so we can see whether Grovetender recurs on cooldown or gets crowded out by A3/A1.
//
// Run: SEED=3 node --env-file=.env.local tools/sim-spider-bambus-casts.mjs        (single fight, full sequence)
//      node --env-file=.env.local tools/sim-spider-bambus-casts.mjs 20            (aggregate counts over N seeds)

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { makeState, simulate } from '../lib/sim/engine.js';
import { buildBattle, applyBattleLayers } from '../lib/sim/dragon-fixture.js';
import { installRecipeRun } from '../lib/sim/interpreter.js';
import { champKey } from '../lib/sim/recipes.js';

const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const N = Number(process.argv[2] || 1);
const SEED = process.env.SEED ? Number(process.env.SEED) : null;
if (!process.env.SUPABASE_URL) { console.log('needs the DB. Run with --env-file=.env.local'); process.exit(2); }
const BASE = process.env.SUPABASE_URL.replace(/\/rest\/v1\/?$/, '');
const H = { apikey: process.env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}` };
const _c = new Map();
const rest = async (p) => { if (!_c.has(p)) _c.set(p, await (await fetch(`${BASE}/rest/v1/${p}`, { headers: H })).json()); return _c.get(p); };
const shieldPool = (c) => (c.buffs || []).reduce((s, b) => s + (/Shield/.test(b.type) ? Math.max(0, b.value || 0) : 0), 0);

const fixture = JSON.parse(fs.readFileSync(path.join(REPO, 'test', 'golden', 'spider13-donbambus-current.json'), 'utf8'));
const probe = await buildBattle({ rest, fixture, repoRoot: REPO });
if (probe.skip) { console.log('skipped:', probe.skip); process.exit(0); }
const bambusKey = probe.allies.map((a) => champKey(a.name)).find((k) => /bambus/i.test(k));

const totalCounts = {};
const perFightBambusTurns = [];

for (let i = 0; i < N; i++) {
  const seed = SEED != null ? SEED : i + 1;
  const built = await buildBattle({ rest, fixture, repoRoot: REPO });
  applyBattleLayers(built.allies);
  const st = makeState({ allies: built.allies, enemies: [], seed });
  installRecipeRun(st);
  const bam = built.allies.find((a) => champKey(a.name) === bambusKey);

  const seq = [];
  const counts = { A1: 0, A2: 0, A3: 0, other: 0 };
  st.onAction = (s, actor, skill) => {
    if (champKey(actor.name) !== bambusKey) return;
    const slot = (skill?.slot || skill?.name || '?').toString();
    const key = /A1|A2|A3/.test(slot) ? slot.match(/A[123]/)[0] : (skill?.name || slot);
    counts[key] != null ? counts[key]++ : (counts.other++, counts[key] = (counts[key] || 0) + 1);
    seq.push({ turn: s.turn, slot: key, shieldAfterNext: null, cd: { ...(bam.cooldowns || {}) } });
    // shield pool sampled at the START of his next-turn snapshot instead; here record cast + current shield
    seq[seq.length - 1].shieldNow = Math.round(shieldPool(bam));
  };
  const res = simulate(st, built.content, { turnCap: 400 });
  perFightBambusTurns.push(seq.length);
  for (const [k, v] of Object.entries(counts)) totalCounts[k] = (totalCounts[k] || 0) + v;

  if (N === 1) {
    console.log(`\n═══ BAMBUS SKILL SEQUENCE — Spider's Den 13 · seed ${seed} ═══`);
    console.log(`  ${res.won ? 'WIN' : 'LOSS'} in ${res.turns}t.  A2 = Grovetender (the shield builder, cd4).\n`);
    console.log(`  ${'#'.padStart(3)}  turn  skill   shieldPool(after cast)`);
    console.log(`  ${'─'.repeat(44)}`);
    seq.forEach((x, idx) => console.log(`  ${String(idx + 1).padStart(3)}  ${String(x.turn).padStart(4)}  ${x.slot.padEnd(6)}  ${String(x.shieldNow).padStart(8)}${x.slot === 'A2' ? '   ◄ shield built/grown' : ''}`));
    console.log(`\n  counts: ${JSON.stringify(counts)}  ·  Bambus acted ${seq.length}×`);
    const a2 = counts.A2 || 0;
    console.log(`  A2 (Grovetender) cast ${a2}× in ${res.turns}t → a shield-builder on cd4 that fires ${a2} time(s) cannot hold 4 bars.`);
  }
}

if (N > 1) {
  const t = perFightBambusTurns.reduce((s, x) => s + x, 0) / N;
  console.log(`\n═══ BAMBUS CASTS — Spider's Den 13  (${N} seeds, avg per fight) ═══`);
  console.log(`  Bambus turns/fight: ${t.toFixed(1)}`);
  for (const [k, v] of Object.entries(totalCounts)) console.log(`    ${k}: ${(v / N).toFixed(1)}/fight  (${Math.round(100 * v / Object.values(totalCounts).reduce((s, x) => s + x, 0))}% of his casts)`);
  console.log(`\n  ▶ A2 (Grovetender) share tells the story: low ⇒ the AI crowds out the shield-builder → shields lapse.`);
}

console.log(`\nQA_JSON ${JSON.stringify({ rung: 'bambus-casts', seeds: N, counts: totalCounts })}`);
