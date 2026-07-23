// tools/sim-trace.mjs — QA PROTOCOL RUNG 3b: the REALITY ORACLE (trace vs the recorded fight).
//
// The check the ladder was missing. Every other rung tests the ENGINE (its machinery) or the sim's
// self-consistency; none tests whether the sim's TURN-BY-TURN behaviour on REAL Dragon content matches
// the real fight. This does: it runs the sim on a golden fixture's exact builds + real waves, then lines
// the sim's own event log (phase clears, deaths, revives, survivors) up against the hand-verified
// recording timeline — and reports WHERE the two first diverge.
//
// A divergence is a REALITY GAP (orchestrator bucket 4), never a blocker: the sim is known-incomplete,
// so mismatching a real battle is EXPECTED. The value is that the mismatch is now LOCALISED to the turn
// and phase it happens at ("sim wipes in wave 1 t34; reality clears wave 1 by t46 with all 5 alive"),
// instead of a human reasoning about an unvalidated trace for hours. It also surfaces the sim's own
// UNMODELLED / MISSING flags, so the divergence points straight at the systems still to build.
//
// DB-gated: needs the live DB for exact builds + boss + wave kits. No SUPABASE_URL → skipped with a note.
// Run: node --env-file=.env.local tools/sim-trace.mjs

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { makeState, simulate } from '../lib/sim/engine.js';
import { buildDragonBattle } from '../lib/sim/dragon-fixture.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname, '..');
const DIR = path.join(REPO, 'test', 'golden');

const files = fs.existsSync(DIR) ? fs.readdirSync(DIR).filter(f => f.endsWith('.json')) : [];
const HAS_DB = !!process.env.SUPABASE_URL;

// ── the comparison: derive machine-checkable facts from BOTH sides, line them up ─────────────────
// Reality facts come from the fixture's result + expected + timeline (hand-verified). Sim facts come
// from the sim's result object. Each checkpoint is {name, real, sim, match}; the FIRST non-match (in
// battle order) is the point the two stories part ways — the single most useful line in the report.
function compare(fixture, res) {
  const phases = res.phases || [];
  const phaseOf = (name) => phases.find(p => p.phase === name);
  const clearedPhase = (name) => phaseOf(name)?.outcome === 'cleared';
  const reachedPhase = (name) => !!phaseOf(name);
  // phaseResults carry per-phase DURATION; state.turn is cumulative, so absolute end = running sum.
  const absEnd = {}; { let acc = 0; for (const p of phases) { acc += p.turns; absEnd[p.phase] = acc; } }
  const bossStartAbs = (absEnd['wave 2'] ?? absEnd['wave 1'] ?? 0);
  const finalSurvivors = new Set(res.survivors || []);
  const diedEver = (who) => (res.deaths || []).some(d => d.who === who);

  // who walked into the boss alive: last wave-phase event per champ (death vs revive) decides it
  const waveEvents = (who) => [
    ...(res.deaths || []).filter(d => /wave/.test(d.phase) && d.who === who).map(d => ({ turn: d.turn, type: 'death' })),
    ...(res.revives || []).filter(r => /wave/.test(r.phase) && r.who === who).map(r => ({ turn: r.turn, type: 'revive' })),
  ].sort((a, b) => a.turn - b.turn);
  const aliveEnteringBoss = (fixture.team || []).filter(w => { const e = waveEvents(w); return !e.length || e[e.length - 1].type === 'revive'; }).length;

  const realWon = fixture.result?.outcome === 'WIN';
  const realSurv = fixture.result?.survivors;

  // each check carries `at` — the ABSOLUTE sim turn the fact resolves — so the FIRST divergence is the
  // earliest crack in battle order, not the first one we happened to list.
  const checks = [];
  const add = (at, name, real, sim, match) => checks.push({ at, name, real, sim, match });

  add(absEnd['wave 1'] ?? 46, 'wave 1 cleared', 'yes (~t46)',
      clearedPhase('wave 1') ? `yes (t${absEnd['wave 1']})` : (phaseOf('wave 1') ? `NO — ${phaseOf('wave 1').outcome}` : 'not reached'), clearedPhase('wave 1'));
  add(absEnd['wave 2'] ?? 86, 'wave 2 cleared', 'yes (~t86)',
      clearedPhase('wave 2') ? `yes (t${absEnd['wave 2']})` : (phaseOf('wave 2') ? `NO — ${phaseOf('wave 2').outcome}` : 'not reached'), clearedPhase('wave 2'));
  add(bossStartAbs || 86, 'entered boss with all 5 alive', '5 alive (t86)',
      reachedPhase('boss') ? `${aliveEnteringBoss} alive` : 'never reached boss', reachedPhase('boss') && aliveEnteringBoss === 5);

  // the healers — the standing finding: they out-heal (92k / 39k) and SURVIVE the real fight
  for (const healer of ['Vergis', 'Tagoar']) {
    if (!(fixture.team || []).includes(healer)) continue;
    const perHero = fixture.expected?.per_hero?.[healer];
    const realNote = healer === 'Vergis' ? 'survived (revived once in wave 2)' : 'survived to t150';
    const d = (res.deaths || []).find(x => x.who === healer);
    add(d ? d.turn : (res.turns || 999), `${healer} survives${perHero ? ` (real heals ${perHero.healing.toLocaleString()})` : ''}`,
        realNote, d ? `DIED t${d.turn} in ${d.phase}${finalSurvivors.has(healer) ? ' (revived)' : ' (stayed dead)'}` : 'survived',
        finalSurvivors.has(healer) || !diedEver(healer));
  }

  add(res.turns || 999, 'outcome', realWon ? 'WIN' : 'LOSS', res.won ? 'WIN' : 'LOSS', res.won === realWon);
  add((res.turns || 999) + 1, 'survivors at end', String(realSurv), String((res.survivors || []).length), (res.survivors || []).length === realSurv);

  const firstDiverge = checks.filter(c => !c.match).sort((a, b) => a.at - b.at)[0] || null;
  return { checks: checks.sort((a, b) => a.at - b.at), firstDiverge };
}

async function main() {
  if (!files.length) { console.log('\n══ SIM TRACE ORACLE (rung 3b) ══  no golden fixtures in test/golden/*.json\n'); emit({ fixtures: 0 }); return; }
  if (!HAS_DB) {
    console.log('\n══ SIM TRACE ORACLE (rung 3b) ══  ⏳ skipped — no SUPABASE_URL.');
    console.log('  Run with DB to score the sim trace vs the recording:  node --env-file=.env.local tools/sim-trace.mjs\n');
    emit({ fixtures: files.length, skipped: 'no DB' }); return;
  }

  const BASE = process.env.SUPABASE_URL.replace(/\/rest\/v1\/?$/, '');
  const H = { apikey: process.env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}` };
  const rest = async p => (await fetch(`${BASE}/rest/v1/${p}`, { headers: H })).json();

  const outcomes = [];
  for (const f of files) {
    const fixture = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'));
    const id = fixture.id || f;
    if (!fixture.timeline || fixture.content?.dungeon !== "Dragon's Lair") { outcomes.push({ id, skipped: 'no timeline or not a modelled Dragon fixture' }); continue; }

    const built = await buildDragonBattle({ rest, fixture, repoRoot: REPO });
    if (built.skip) { outcomes.push({ id, skipped: built.skip }); continue; }

    const state = makeState({ allies: built.allies, enemies: [] });
    state.purpleBarLeft = 0;
    const o = console.log; console.log = () => {};
    let res; try { res = simulate(state, built.content, { turnCap: 400 }); } finally { console.log = o; }

    const { checks, firstDiverge } = compare(fixture, res);

    console.log(`\n══ SIM TRACE ORACLE (rung 3b) ══  ${id}  (stage ${built.stage})\n`);
    for (const w of built.waveMobNames) console.log(`  · ${w}`);
    console.log('');
    console.log('   ~turn  CHECKPOINT                              REALITY (recorded)             SIM');
    console.log('  ' + '─'.repeat(90));
    for (const c of checks) {
      console.log(`  ${c.match ? '✓' : '✗'} ${('t' + c.at).padStart(5)}  ${c.name.padEnd(38).slice(0, 38)}  ${String(c.real).padEnd(30).slice(0, 30)}  ${c.sim}`);
    }
    if (firstDiverge) {
      console.log(`\n  ▶ SIM AND REALITY FIRST DIVERGE AT ~t${firstDiverge.at}: "${firstDiverge.name}"`);
      console.log(`      reality: ${firstDiverge.real}`);
      console.log(`      sim:     ${firstDiverge.sim}`);
      console.log('    Any earlier turn-by-turn analysis past this point describes the SIM, not the fight.');
    } else {
      console.log('\n  ▶ no divergence on the checked facts — the sim reproduces this fight at the checkpoint level.');
    }

    // WHY it diverges — the sim's own flags point at the unbuilt systems
    const flags = res.flags || [];
    const missing = flags.filter(x => /MISSING|UNMODELLED|UNKNOWN/.test(x));
    if (missing.length) {
      console.log('\n  WHY (the sim flagged these unmodelled/missing systems this run — the work the divergence points to):');
      for (const m of [...new Set(missing)].slice(0, 12)) console.log(`      - ${m}`);
      if (new Set(missing).size > 12) console.log(`      … +${new Set(missing).size - 12} more`);
    }

    outcomes.push({ id, stage: built.stage,
      simOutcome: res.won ? 'WIN' : 'LOSS', realOutcome: fixture.result?.outcome,
      simSurvivors: (res.survivors || []).length, realSurvivors: fixture.result?.survivors,
      firstDivergence: firstDiverge ? firstDiverge.name : null,
      divergences: checks.filter(c => !c.match).map(c => `${c.name}: real=${c.real} sim=${c.sim}`),
      unmodelledFlags: [...new Set(missing)].slice(0, 20) });
  }

  for (const s of outcomes.filter(o => o.skipped)) console.log(`\n  · ${s.id}: skipped — ${s.skipped}`);
  emit({ fixtures: files.length, runs: outcomes });
}

function emit(obj) { console.log('\nQA_JSON ' + JSON.stringify({ rung: 'trace', ...obj })); }
main().catch(e => { console.error(e); console.log('\nQA_JSON ' + JSON.stringify({ rung: 'trace', error: String(e.message || e) })); process.exit(1); });
