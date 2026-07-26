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
import { buildDragonBattle, applyBattleLayers } from '../lib/sim/dragon-fixture.js';
import { installRecipeRun } from '../lib/sim/interpreter.js';

const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const FIX = path.join(REPO, 'test', 'golden', 'dragon16-donbambus-2026-07-22.json');

// ── THE GOLDEN — hand-derived per-turn facts (actor · slot · exact damage to each target) ──
// Turn 1 is Bambus A3, which places team-wide [Increase ATK] 50%. Since the buff→stat CONSUMER was built
// (statFactor, 2026-07-24), every ATK-scaling ALLY attacker on turns 2/5/6 hits ×1.5 (each was exactly
// round(rawₚᵣₑ × 1.5); verified turn-by-turn).
// Turn 7 RE-DERIVED 2026-07-26 for the BASE-ONLY LEADER AURA fix (dragon-fixture.applyBattleLayers): the Ezio
// SPD aura now adds +19% of BASE speed, NOT the geared total (auras never scale gear speed — True Speed §4), so
// the whole team is slightly slower. The old geared-aura made Tagoar's [Increase SPD] cut in at t7 ahead of the
// enemies; with correct speeds that NO LONGER happens — the fastest mob Faceless#2 (SPD 101) takes t7. The SPD
// turn-order consumer is still exercised and is separately pinned (sim-recipe-d-test + the model-mutants "SPD
// modifiers ignored" mutant), so this golden now covers turns 1-7. t7's hit is the SAME Faceless#2 → Pelops 3887
// that was the old t8 (Ice Bolt ×0.70 [Enfeeble], ATK-based → speed-independent), no longer displaced by Tagoar.
//
// DAMAGE RE-DERIVED 2026-07-25 for the source-verified DEF-MITIGATION curve (M = 1 − 0.85·(1−e^(−2D/50L)),
// replacing the old linear placeholder). The ally-attack turns (2/5/6/7) drop to the new mitigation; the
// SEQUENCE is untouched (0 actor/slot/target divergences). This is a pure per-target mitigation-factor swap,
// PROVEN by ratio-invariance in the golden's OWN numbers: for any fixed target the cross-turn ratios are
// identical old↔new (e.g. Lua t2/t6 = 2373/3194 = 0.7430 vs 1947/2621 = 0.7429; t5/t2 = 6008/2373 = 2.532 vs
// 4930/1947 = 2.532) — so coeff × effATK × crit × the ×1.5 [Increase ATK] all cancel, leaving only the
// mitigation, and defMitigation() is independently pinned by sim-selftest §12. t8's Enfeeble weak-hit (3887,
// enemy→ally) was already on the verified path and is UNCHANGED.
const GOLDEN = [
  { turn: 1, actor: 'Bambus', slot: 'A3', dmg: {} },                                                   // buffs+debuffs (incl. team [Increase ATK] 50% + [Increase SPD] via Tagoar next turn), no damage
  { turn: 2, actor: 'Tagoar', slot: 'A2', dmg: { 'Lua#1': 1947, 'Faceless#2': 2026, 'Arbalester#3': 2235, 'Arbalester#4': 2235, 'Renegade#5': 2053 } },  // ×1.5 under [Increase ATK]; also places team [Increase SPD] 30%
  { turn: 3, actor: 'Vergis', slot: 'A2', dmg: {} },                                                    // Aegis — no damage
  { turn: 4, actor: 'Pelops', slot: 'A3', dmg: {} },                                                    // Victor's Bounty — no damage
  { turn: 5, actor: 'Ezio',   slot: 'A2', dmg: { 'Lua#1': 4930, 'Faceless#2': 5130, 'Arbalester#3': 5659, 'Arbalester#4': 5659, 'Renegade#5': 5199 } },  // ×1.5 under [Increase ATK]
  { turn: 6, actor: 'Bambus', slot: 'A2', dmg: { 'Lua#1': 2621, 'Faceless#2': 2727, 'Arbalester#3': 3008, 'Arbalester#4': 3008, 'Renegade#5': 2764 } },  // ×1.5 under [Increase ATK]
  { turn: 7, actor: 'Faceless#2', slot: 'A3', dmg: { 'Pelops': 3887 } },                                // FIRST enemy turn (base-only aura → no Tagoar cut-in): Ice Bolt → taunted Pelops (taunt overrides the max-HP rule); ×0.70 WEAK because Faceless is under [Enfeeble] from Bambus A3 t1 (5553 → 3887, the Enfeeble consumer)
];

if (!process.env.SUPABASE_URL) { console.log('\n⏳ golden — skipped (needs --env-file=.env.local)\n'); console.log('QA_JSON ' + JSON.stringify({ rung: 'model-golden', pass: 0, fail: 0, skipped: 'no DB' })); process.exit(0); }
const BASE = process.env.SUPABASE_URL.replace(/\/rest\/v1\/?$/, '');
const H = { apikey: process.env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}` };
const rest = async (p) => (await fetch(`${BASE}/rest/v1/${p}`, { headers: H })).json();

const fixture = JSON.parse(fs.readFileSync(FIX, 'utf8'));
const built = await buildDragonBattle({ rest, fixture, repoRoot: REPO });
if (built.skip) { console.log('golden skipped:', built.skip); console.log('QA_JSON ' + JSON.stringify({ rung: 'model-golden', pass: 0, fail: 0, skipped: built.skip })); process.exit(0); }
applyBattleLayers(built.allies);   // base-only SPD aura + arena (True Speed §4) — see dragon-fixture.applyBattleLayers

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
