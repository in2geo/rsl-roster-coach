// tools/sim-spider-taunt.mjs — TAUNT-STATE trace for Spider-13 (targeting coverage, not HP-Burn internals).
//
// Mike (2026-07-29): the next trace must expand TAUNT STATE — the ledger localized the gap to atk→Pel
// (~40% of Spiderling turns hit Pelops), so the question is now Pelops's Taunt COVERAGE, not the burn passive.
// Per Spiderling turn this captures: Pelops Taunt active? · target selected · reason (TAUNT/LOWEST_MAX_HP) ·
// and per Pelops turn: skill selected + all skill cooldowns (explains Taunt downtime) + Taunt duration.
// It also checks whether NEWLY-SPAWNED Spiderlings receive the Taunt, and asserts three invariants:
//   (1) valid Taunt + Pelops alive/targetable  ⇒  selected_target == Pelops
//   (2) attacks_on_Pelops == attacks_while_taunted + off_taunt_attacks_selecting_Pelops   (counting sanity)
//   (3) burns_placed == eligible_attacks_on_Pelops   (every hit on Pelops should place a burn; shortfall = Decrease-DEF-on-Pelops / immunity)
// Telemetry is records-only (spider.js emits a 'spider_pick' effect per Spiderling turn) — no engine behaviour change.
//
// Run: node --env-file=.env.local tools/sim-spider-taunt.mjs [seed] [stage] [rows]

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { makeState, simulate } from '../lib/sim/engine.js';
import { buildBattle, applyBattleLayers } from '../lib/sim/dragon-fixture.js';
import { installRecipeRun } from '../lib/sim/interpreter.js';
import { champKey } from '../lib/sim/recipes.js';

const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SEED = Number(process.argv[2] || 1);
const STAGE = Number(process.argv[3] || 13);
const ROWS = Number(process.argv[4] || 30);   // how many per-Spiderling-turn rows to print
const FIXTURE = 'spider13-donbambus-current.json';
const isSpiderling = (n) => /Spiderling/i.test(String(n));
const isPelops = (n) => champKey(n) === champKey('Pelops the Victor');

if (!process.env.SUPABASE_URL) { console.log('needs the DB. Run with --env-file=.env.local'); process.exit(2); }
const BASE = process.env.SUPABASE_URL.replace(/\/rest\/v1\/?$/, '');
const H = { apikey: process.env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}` };
const _cache = new Map();
const rest = async (p) => { if (!_cache.has(p)) _cache.set(p, await (await fetch(`${BASE}/rest/v1/${p}`, { headers: H })).json()); return _cache.get(p); };

const fixture = JSON.parse(fs.readFileSync(path.join(REPO, 'test', 'golden', FIXTURE), 'utf8'));
const probe = await buildBattle({ rest, fixture, repoRoot: REPO });
if (probe.skip) { console.log('skipped:', probe.skip); process.exit(0); }

const built = await buildBattle({ rest, fixture, repoRoot: REPO });
applyBattleLayers(built.allies);
const st = makeState({ allies: built.allies, enemies: [], seed: SEED });
installRecipeRun(st);

// Pelops turn log: skill chosen + all his skill cooldowns AT the decision point (onAction fires BEFORE cdLeft is
// re-armed, so these are the cooldowns that DID or DID NOT let him cast Taunt this turn).
const pelActs = [];
const prevOnAction = st.onAction;
st.onAction = (state, actor, skill) => {
  prevOnAction?.(state, actor, skill);
  if (!isPelops(actor.name)) return;
  const taunt = (actor.buffs ?? []).find((b) => b.type === 'Taunt' || b.type === 'Provoke');
  pelActs.push({ turn: state.turn, slot: skill?.slot ?? skill?.name ?? '?',
    cds: (actor.skills ?? []).map((s) => `${s.slot}:${s.cdLeft ?? 0}`).join(' '),
    tauntLeft: taunt?.turnsLeft ?? 0 });
};

// per-turn snapshot (end of turn): Pelops Taunt duration + swarm state.
const snaps = [];
const prevOnTurn = st.onTurn;
st.onTurn = (state, actor) => {
  prevOnTurn?.(state, actor);
  const pel = state.allies.find((a) => isPelops(a.name));
  const taunt = (pel?.buffs ?? []).find((b) => b.type === 'Taunt' || b.type === 'Provoke');
  const adds = state.enemies.filter((e) => e.role === 'add' && e.alive);
  snaps.push({ turn: state.turn, actor: actor?.name, role: actor?.role,
    pelAlive: !!pel?.alive, tauntLeft: taunt?.turnsLeft ?? 0,
    living: adds.length, burning: adds.filter((a) => (a.debuffs ?? []).some((d) => d.type === 'HP Burn')).length });
};

const res = simulate(st, built.content, { turnCap: 400 });
const fx = res.effects || [];
const picks = fx.filter((e) => e.kind === 'spider_pick');   // one per Spiderling turn, in order

// ── targeting coverage ────────────────────────────────────────────────────────
const nPicks = picks.length;
const onPelops = picks.filter((p) => p.pelPicked);
const whileTaunted = picks.filter((p) => p.pelTaunting);
const offTauntOnPelops = picks.filter((p) => p.pelPicked && !p.pelTaunting);
const tauntedPickedPel = whileTaunted.filter((p) => p.pelPicked);

// invariant 1 — valid Taunt (Pelops taunting + targetable) ⇒ Pelops picked
const inv1Viol = picks.filter((p) => p.pelTaunting && p.pelTauntable && !p.pelPicked);
// invariant 2 — attacks_on_Pelops == attacks_while_taunted(picked) + off_taunt_on_Pelops
const inv2LHS = onPelops.length, inv2RHS = tauntedPickedPel.length + offTauntOnPelops.length;
// invariant 3 — burns_placed == eligible_attacks_on_Pelops (every hit on Pelops attempts a burn)
const burnsPlaced = fx.filter((e) => e.kind === 'debuff' && e.subtype === 'HP Burn' && isSpiderling(e.target) && e.consumed !== false).length;

// new-spawn Taunt receipt: a Spiderling's FIRST pick while Pelops is taunting should be Pelops
const firstPickByActor = new Map();
for (const p of picks) if (!firstPickByActor.has(p.actor)) firstPickByActor.set(p.actor, p);
const firstWhileTaunted = [...firstPickByActor.values()].filter((p) => p.pelTaunting);
const firstWhileTauntedHitPel = firstWhileTaunted.filter((p) => p.pelPicked);

// Taunt uptime over the whole fight (fraction of turn-snapshots with Taunt up while Pelops alive)
const aliveSnaps = snaps.filter((s) => s.pelAlive);
const tauntUpSnaps = aliveSnaps.filter((s) => s.tauntLeft > 0);

const pct = (a, b) => (b ? (100 * a / b).toFixed(0) + '%' : '—');
console.log(`\n═══ TAUNT-STATE TRACE — Spider's Den ${STAGE}, seed ${SEED} ═══`);
console.log(`  result: ${res.won ? 'WIN' : 'LOSS'} in ${res.turns}t\n`);

console.log(`  TARGETING COVERAGE (${nPicks} Spiderling turns):`);
console.log(`    attacks on Pelops ............. ${onPelops.length}   (${pct(onPelops.length, nPicks)} of Spiderling turns)  ← reality "most"; sim ~40%`);
console.log(`    …while Pelops was Taunting .... ${tauntedPickedPel.length}`);
console.log(`    …OFF-Taunt but still Pelops ... ${offTauntOnPelops.length}   (expect ~0 — he is highest MAX HP)`);
console.log(`    Taunt uptime (of alive turns) . ${pct(tauntUpSnaps.length, aliveSnaps.length)}`);

console.log(`\n  INVARIANTS:`);
console.log(`    (1) valid Taunt ⇒ Pelops picked ......... ${inv1Viol.length === 0 ? 'PASS' : `FAIL (${inv1Viol.length} violations)`}`);
if (inv1Viol.length) for (const v of inv1Viol.slice(0, 5)) console.log(`         ⚠ ${v.actor} picked ${v.target} (${v.reason}) while Pelops taunting+targetable`);
console.log(`    (2) atk_on_Pelops == taunted+offtaunt ... ${inv2LHS === inv2RHS ? 'PASS' : `FAIL (${inv2LHS} vs ${inv2RHS})`}`);
console.log(`    (3) burns_placed == attacks_on_Pelops ... ${burnsPlaced === onPelops.length ? 'PASS' : `${burnsPlaced} vs ${onPelops.length}  (shortfall ⇒ Decrease-DEF-on-Pelops halves placement, or once-per-skill)`}`);

console.log(`\n  NEW-SPAWN TAUNT RECEIPT:`);
console.log(`    Spiderlings whose FIRST turn fell under Taunt .. ${firstWhileTaunted.length}`);
console.log(`    …that correctly attacked Pelops ............... ${firstWhileTauntedHitPel.length}  (${pct(firstWhileTauntedHitPel.length, firstWhileTaunted.length)})  ← <100% ⇒ spawn-state/eligibility bug`);

// Pelops Taunt cadence — his casts + the gaps where Taunt was DOWN
console.log(`\n  PELOPS TURNS (skill · cooldowns@decision · Taunt left):`);
for (const a of pelActs.slice(0, 14)) console.log(`    t${String(a.turn).padStart(3)}  ${String(a.slot).padEnd(4)}  [${a.cds}]  taunt=${a.tauntLeft}`);
if (pelActs.length > 14) console.log(`    … ${pelActs.length - 14} more Pelops turns`);

// per-Spiderling-turn table (first ROWS)
console.log(`\n  PER-SPIDERLING-TURN (first ${Math.min(ROWS, nPicks)} of ${nPicks}):`);
console.log(`    turn  actor          pelTaunt  target          reason          ok`);
const turnOfPick = [];   // align picks to their turn via snapshots order isn't 1:1; use effect turn
for (const p of picks.slice(0, ROWS)) {
  const ok = p.pelTaunting ? (p.pelPicked ? '✓' : '✗VIOL') : '·';
  console.log(`    ${String(p.turn ?? '').padStart(4)}  ${String(p.actor).padEnd(13)}  ${String(!!p.pelTaunting).padEnd(8)}  ${String(p.target).slice(0,14).padEnd(14)}  ${String(p.reason).padEnd(14)}  ${ok}`);
}

console.log(`\n  ▶ Compare atk→Pel (${pct(onPelops.length, nPicks)}) to a real consume cycle. Higher real ⇒ Taunt uptime/AI/`);
console.log(`    application is the primary defect. If invariant (1) FAILS, Taunt is placed but not obeyed for spawns.\n`);

console.log(`QA_JSON ${JSON.stringify({ rung: 'spider-taunt', stage: STAGE, seed: SEED, won: res.won, turns: res.turns,
  spiderlingTurns: nPicks, attacksOnPelops: onPelops.length, atkPelPct: +pct(onPelops.length, nPicks).replace('%',''),
  whileTaunted: tauntedPickedPel.length, offTauntOnPelops: offTauntOnPelops.length,
  tauntUptimePct: +pct(tauntUpSnaps.length, aliveSnaps.length).replace('%',''),
  inv1Violations: inv1Viol.length, inv2: [inv2LHS, inv2RHS], burnsPlaced, inv3Match: burnsPlaced === onPelops.length,
  newSpawnUnderTaunt: firstWhileTaunted.length, newSpawnHitPelops: firstWhileTauntedHitPel.length })}`);
