// tools/model-golden.mjs — MODEL QA · scoped hand-calc golden (protocol layer 4).
//
// A "golden battle" is a HAND-CALCULATED sequence: for each turn, the expected actor, skill, and exact
// damage — derived by hand from the cards + stats, NOT read off the code. Asserting the deterministic run
// against it catches COMPOSITION bugs (turn order, cooldowns, cross-turn passive timing) that single-recipe
// toy battles and the snapshot cannot. Scoped to the first turns (only built mechanics fire there).
//
// The values below were hand-derived and verified to the unit during the turn-by-turn walk (Dragon-16,
// all-land, Ezio SPD-aura + Bronze III). This rung re-proves the code still reproduces them, and on a
// mismatch prints the FIRST divergence turn. DB-gated (needs the exact builds). Run:
//   node --env-file=.env.local tools/model-golden.mjs

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { makeState, simulate, setChanceMode } from '../lib/sim/engine.js';
import { buildDragonBattle } from '../lib/sim/dragon-fixture.js';
import { installRecipeRun } from '../lib/sim/interpreter.js';

const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const FIX = path.join(REPO, 'test', 'golden', 'dragon16-donbambus-2026-07-22.json');

// ── THE GOLDEN — hand-derived per-turn facts (actor · slot · exact damage to each target) ──
// Turn 1 is Bambus A3, which places team-wide [Increase ATK] 50%. Since the buff→stat CONSUMER was built
// (statFactor, 2026-07-24), every ATK-scaling ALLY attacker on turns 2/5/6 hits ×1.5 — re-derived below
// (each was exactly round(rawₚᵣₑ × 1.5); the sole cause, verified turn-by-turn). Turns 7/8 are ENEMY hits on
// Pelops → no Increase ATK on their side → unchanged. This composed run is the mechanic's end-to-end proof.
const GOLDEN = [
  { turn: 1, actor: 'Bambus', slot: 'A3', dmg: {} },                                                   // buffs+debuffs (incl. team [Increase ATK] 50%), no damage
  { turn: 2, actor: 'Tagoar', slot: 'A2', dmg: { 'Lua#1': 2373, 'Faceless#2': 2442, 'Arbalester#3': 2621, 'Arbalester#4': 2621, 'Renegade#5': 2466 } },  // ×1.5 under [Increase ATK]
  { turn: 3, actor: 'Vergis', slot: 'A2', dmg: {} },                                                    // Aegis — no damage
  { turn: 4, actor: 'Pelops', slot: 'A3', dmg: {} },                                                    // Victor's Bounty — no damage
  { turn: 5, actor: 'Ezio',   slot: 'A2', dmg: { 'Lua#1': 6008, 'Faceless#2': 6185, 'Arbalester#3': 6636, 'Arbalester#4': 6636, 'Renegade#5': 6244 } },  // ×1.5 under [Increase ATK]
  { turn: 6, actor: 'Bambus', slot: 'A2', dmg: { 'Lua#1': 3194, 'Faceless#2': 3288, 'Arbalester#3': 3528, 'Arbalester#4': 3528, 'Renegade#5': 3319 } },  // ×1.5 under [Increase ATK]
  { turn: 7, actor: 'Faceless#2', slot: 'A3', dmg: { 'Pelops': 5553 } },                                // Ice Bolt → taunted Pelops, halved by Ally Protection
  { turn: 8, actor: 'Lua#1', slot: 'A3', dmg: { 'Pelops': 5725 } },                                     // Lucky Shot → Pelops
];

if (!process.env.SUPABASE_URL) { console.log('\n⏳ golden — skipped (needs --env-file=.env.local)\n'); console.log('QA_JSON ' + JSON.stringify({ rung: 'model-golden', pass: 0, fail: 0, skipped: 'no DB' })); process.exit(0); }
const BASE = process.env.SUPABASE_URL.replace(/\/rest\/v1\/?$/, '');
const H = { apikey: process.env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}` };
const rest = async (p) => (await fetch(`${BASE}/rest/v1/${p}`, { headers: H })).json();

const fixture = JSON.parse(fs.readFileSync(FIX, 'utf8'));
const built = await buildDragonBattle({ rest, fixture, repoRoot: REPO });
if (built.skip) { console.log('golden skipped:', built.skip); console.log('QA_JSON ' + JSON.stringify({ rung: 'model-golden', pass: 0, fail: 0, skipped: built.skip })); process.exit(0); }
for (const a of built.allies) { a.spd = Math.round(a.spd * 1.19); a.maxHp = Math.round(a.maxHp * 1.03); a.hp = a.maxHp; a.atk = Math.round(a.atk * 1.03); a.def = Math.round(a.def * 1.03); }

setChanceMode('all');
const st = makeState({ allies: built.allies, enemies: [], seed: null }); st.purpleBarLeft = 0;
installRecipeRun(st);
const acts = {}; st.onAction = (s, actor, skill) => { acts[s.turn] = { actor: actor.name, slot: skill.slot }; };
const res = simulate(st, built.content, { turnCap: 8 });

// per-turn actual damage
const dmgByTurn = {};
for (const e of res.effects || []) if (e.kind === 'damage' && (e.amount || 0) > 0) { (dmgByTurn[e.turn] ??= {}); dmgByTurn[e.turn][e.target] = Math.round((dmgByTurn[e.turn][e.target] || 0) + e.amount); }

const diffs = [];
for (const g of GOLDEN) {
  const a = acts[g.turn] || {};
  if (a.actor !== g.actor || String(a.slot) !== g.slot) { diffs.push(`t${g.turn}: actor/slot — golden ${g.actor} ${g.slot}, sim ${a.actor} ${a.slot}`); continue; }
  const actual = dmgByTurn[g.turn] || {};
  for (const [tgt, exp] of Object.entries(g.dmg)) if (actual[tgt] !== exp) diffs.push(`t${g.turn} ${g.actor} ${g.slot} → ${tgt}: golden ${exp}, sim ${actual[tgt]}`);
  for (const tgt of Object.keys(actual)) if (!(tgt in g.dmg)) diffs.push(`t${g.turn}: sim dealt UNEXPECTED damage → ${tgt} = ${actual[tgt]}`);
}

const first = diffs[0] || null;
console.log(`\n══ MODEL GOLDEN (layer 4) ══  ${GOLDEN.length} hand-derived turns — ${diffs.length ? '⚠ ' + diffs.length + ' DIVERGENCE(S)' : 'sim reproduces the hand-calc turn-by-turn'}\n`);
if (first) { console.log('  ▶ FIRST DIVERGENCE: ' + first); for (const d of diffs.slice(1, 12)) console.log('    · ' + d); }
else console.log('  ✓ actor · skill · exact damage all match the hand-derivation for turns 1–8');
console.log('\nQA_JSON ' + JSON.stringify({ rung: 'model-golden', pass: diffs.length ? 0 : GOLDEN.length, fail: diffs.length, firstDivergence: first, diffs: diffs.slice(0, 20) }));
process.exit(diffs.length ? 1 : 0);
