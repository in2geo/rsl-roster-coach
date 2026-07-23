// tools/sim-golden.mjs — QA PROTOCOL RUNG 4: golden battles.
//
// A golden battle is a hand-verified real fight (from a recording + note session): exact INPUTS
// (per-champion builds) and exact OUTPUT (result, per-hero totals, a turn-by-turn timeline with
// confidence). The sim is scored against it at the levels it's complete enough to attempt.
//
// This v1 does two honest things without needing the sim or a DB:
//   1. VALIDATES each fixture's internal consistency — a malformed golden is a broken TEST (bucket 1).
//   2. Reports each fixture's READINESS — RUNNABLE (all builds captured + content modelled) vs
//      PENDING-INPUTS (bucket 3) vs CONTENT-NOT-MODELLED. Running the sim against a RUNNABLE fixture
//      and scoring outcome/failure-location is the next step, once a complete capture exists.
//
// Run: node tools/sim-golden.mjs   (reads test/golden/*.json, no DB)

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { makeCombatant, makeState, simulate, actEnemyMob } from '../lib/sim/engine.js';
import { readSkillKit } from '../lib/sim/ai.js';
import { makeDragonContent, HELLRAZOR_IMMUNE } from '../lib/sim/dragon.js';
import { loadNameResolverRest } from '../lib/champion-names.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIR = path.join(__dirname, '..', 'test', 'golden');
const REPO = path.join(__dirname, '..');
const MODELLED = new Set(["Dragon's Lair"]);   // dungeons lib/sim can currently run

let pass = 0, fail = 0; const failures = [];
const ok = (name, cond, detail = '') => { if (cond) pass++; else { fail++; failures.push(`${name}${detail ? ' — ' + detail : ''}`); } };

const files = fs.existsSync(DIR) ? fs.readdirSync(DIR).filter(f => f.endsWith('.json')) : [];
const report = [];
const goldens = {};

for (const f of files) {
  let g; try { g = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')); } catch (e) { ok(`${f}: valid JSON`, false, e.message); continue; }
  const id = g.id || f;
  goldens[id] = g;

  // ── 1. FIXTURE INTERNAL CONSISTENCY (a malformed golden can't be a valid test) ──
  ok(`${id}: has content+result+team`, !!(g.content && g.result && Array.isArray(g.team) && g.team.length));
  if (g.result) ok(`${id}: outcome is WIN|LOSS`, ['WIN', 'LOSS'].includes(g.result.outcome), `got ${g.result?.outcome}`);
  if (g.result && g.team) ok(`${id}: survivors within 0..team`, g.result.survivors >= 0 && g.result.survivors <= g.team.length, `survivors ${g.result.survivors}/${g.team.length}`);
  if (g.expected?.per_hero && g.expected?.damage_rank) {
    const byDmg = Object.entries(g.expected.per_hero).sort((a, b) => b[1].damage - a[1].damage).map(([n]) => n);
    ok(`${id}: damage_rank matches per-hero damage`, JSON.stringify(byDmg) === JSON.stringify(g.expected.damage_rank), `derived ${byDmg.join('>')}`);
    for (const n of Object.keys(g.expected.per_hero)) ok(`${id}: per-hero '${n}' is on the team`, g.team.includes(n));
  }
  if (Array.isArray(g.timeline)) {
    let mono = true, within = true;
    for (let i = 0; i < g.timeline.length; i++) {
      if (i && g.timeline[i].turn <= g.timeline[i - 1].turn) mono = false;
      if (g.result && g.timeline[i].turn > g.result.turns) within = false;
    }
    ok(`${id}: timeline turns strictly increasing`, mono);
    ok(`${id}: timeline turns <= total turns`, within);
  }

  // ── 2. READINESS (not a pass/fail — a data-tier report) ──
  const inputs = g.inputs || {};
  const heroes = g.team || [];
  const captured = heroes.filter(h => inputs[h] && inputs[h].build);
  const pending = heroes.filter(h => !(inputs[h] && inputs[h].build));
  const modelled = MODELLED.has(g.content?.dungeon);
  const runnable = modelled && pending.length === 0;
  report.push({ id, modelled, captured: captured.length, total: heroes.length, pending, runnable });
}

// ── 3. EXACT-STAT RUN — run the sim on the fixture's REAL builds, score vs the golden ──────────
// The payoff of a golden battle: not "is the fixture well-formed" but "does the sim REPRODUCE it".
// Uses the EXACT captured builds (data/observed-builds/*), so a mismatch has NO estimation excuse.
// Champion KITS (coeffs) + the boss + name resolution come from the LIVE DB, so the score RESPONDS to
// multiplier work as it is COMMITTED (not to numbers pasted in chat — that would fit the fixture). A
// golden OUTCOME mismatch is NOT a rung failure: the sim is known-incomplete, so mismatching a real
// battle is expected and labelled (bucket 4). DB-gated: skipped with a note when no SUPABASE_URL, so
// the consistency checks above still run standalone.
const runs = [];
const HAS_DB = !!process.env.SUPABASE_URL;
if (HAS_DB) {
  const BASE = process.env.SUPABASE_URL.replace(/\/rest\/v1\/?$/, '');
  const H = { apikey: process.env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}` };
  const rest = async p => (await fetch(`${BASE}/rest/v1/${p}`, { headers: H })).json();

  const SEL = 'id,name,affinity,champion_skills(slot,skill_name,skill_summary,cooldown_base,cooldown_booked,damage_multiplier,multiplier_type)';
  let db = [];
  for (let off = 0; ; off += 1000) {
    const d = await rest(`champions?select=${encodeURIComponent(SEL)}&game_id=eq.raid_shadow_legends&limit=1000&offset=${off}`);
    if (!Array.isArray(d) || !d.length) break; db = db.concat(d); if (d.length < 1000) break;
  }
  const byId = Object.fromEntries(db.map(c => [c.id, c]));
  const resolver = await loadNameResolverRest(rest);

  const dun = (await rest('dungeons?select=id,name&game_id=eq.raid_shadow_legends')).find(x => x.name === "Dragon's Lair");
  const enemyRows = dun ? await rest('dungeon_stage_enemies?select=stage_number,enemy_role,enemy_name,wave_number,position,champion_id,hp,atk,def,spd,res,acc,crit_rate,crit_dmg&dungeon_id=eq.' + dun.id) : [];
  const affRows = dun ? await rest('dungeon_stage_affinities?select=stage_number,affinity&dungeon_id=eq.' + dun.id) : [];
  const stageAff = Object.fromEntries(affRows.map(r => [r.stage_number, r.affinity]));
  const buildBoss = (stage) => {
    const r = enemyRows.find(e => e.stage_number === stage && e.enemy_role === 'boss'); if (!r) return null;
    const b = makeCombatant({ name: r.enemy_name, side: 'enemy', role: 'boss',
      maxHp: +r.hp, atk: +r.atk, def: +r.def, spd: +r.spd, acc: +r.acc, res: +r.res,
      critRate: +r.crit_rate, critDmg: +r.crit_dmg, affinity: stageAff[stage] });
    b.immune = HELLRAZOR_IMMUNE; return b;
  };

  // Wave mobs are REAL champions: stats from the dungeon row, kit + affinity inherited from champion_id
  // (verified: each mob's canonical affinity == its stage wave affinity, so no per-row affinity needed).
  const buildWaveMob = (r) => {
    const cat = byId[r.champion_id];
    return makeCombatant({ name: `${r.enemy_name}#${r.position}`, side: 'enemy', role: 'wave',
      maxHp: +r.hp, atk: +r.atk, def: +r.def, spd: +r.spd, acc: +r.acc, res: +r.res,
      critRate: +r.crit_rate, critDmg: +r.crit_dmg, affinity: cat?.affinity,
      skills: readSkillKit(cat?.champion_skills ?? []) });
  };
  const buildWaves = (stage) => {
    const rows = enemyRows.filter(e => e.enemy_role === 'wave' && e.stage_number === stage);
    if (!rows.length) return null;
    return [...new Set(rows.map(e => e.wave_number))].sort((a, b) => a - b).map(wn => ({
      enemies: rows.filter(e => e.wave_number === wn).sort((a, b) => a.position - b.position).map(buildWaveMob),
      actEnemy: actEnemyMob,
    }));
  };

  for (const r of report.filter(x => x.runnable)) {
    const g = goldens[r.id];
    if (g.content?.dungeon !== "Dragon's Lair") { runs.push({ id: r.id, skipped: 'boss build is Dragon-only for now' }); continue; }
    const buildRef = Object.values(g.inputs || {}).map(v => v.build).find(Boolean);
    let builds = {};
    try { builds = Object.fromEntries((JSON.parse(fs.readFileSync(path.join(REPO, buildRef), 'utf8')).champions || []).map(c => [c.name, c])); }
    catch (e) { runs.push({ id: r.id, skipped: `cannot read builds (${buildRef}): ${e.message}` }); continue; }
    const boss = buildBoss(g.content.stage);
    if (!boss) { runs.push({ id: r.id, skipped: `no boss row for stage ${g.content.stage}` }); continue; }

    const missing = [];
    const allies = g.team.map(name => {
      const canon = g.roster?.[name] ?? name;   // explicit short→canonical map (fixture data), then the registry
      const hit = resolver.resolveOrThrow(canon, 'golden team hero');
      const cat = byId[hit.id];
      const dbName = cat?.name ?? canon;
      const b = builds[dbName] ?? builds[canon] ?? builds[name];
      if (!b) { missing.push(name); return null; }
      const s = b.total_stats;
      return makeCombatant({ name: canon, side: 'ally',
        maxHp: s.hp, atk: s.atk, def: s.def, spd: s.spd, acc: s.acc, res: s.res,
        critRate: s.crit_rate, critDmg: s.crit_dmg, affinity: b.affinity ?? cat?.affinity,
        skills: readSkillKit(cat?.champion_skills ?? []) });
    }).filter(Boolean);
    if (missing.length) { runs.push({ id: r.id, skipped: `no exact build for ${missing.join(', ')}` }); continue; }

    const waves = buildWaves(g.content.stage);
    const content = makeDragonContent({ stageNumber: g.content.stage, purpleBarHp: 0.20 * boss.maxHp, waves, boss });
    const state = makeState({ allies, enemies: [] });
    state.purpleBarLeft = 0;
    const l = console.log; console.log = () => {};
    const res = simulate(state, content, { turnCap: 400 });
    console.log = l;

    const predOutcome = res.won ? 'WIN' : 'LOSS';
    const zeroDmg = allies.filter(a => a.skills.some(s => s.hitsEnemies && s.coeff == null)).map(a => a.name);
    runs.push({ id: r.id, mode: waves ? `with-waves (${waves.length})` : 'boss-only',
      predOutcome, actualOutcome: g.result.outcome, outcomeMatch: predOutcome === g.result.outcome,
      predSurvivors: res.survivors.length, actualSurvivors: g.result.survivors,
      predTurns: res.turns, actualTurns: g.result.turns,
      failedPhase: res.failedPhase, expectedFailure: g.expected?.failure_location ?? null, zeroDmg });
  }
  // TEETH — a silent no-op is the exact failure mode this rung guards against: assert the run
  // actually executed and produced an outcome for at least one runnable fixture.
  const executed = runs.filter(r => r.predOutcome);
  if (report.some(r => r.runnable)) ok('exact-stat run executed for the runnable fixture(s)', executed.length > 0,
     runs.map(r => r.skipped ? `${r.id} skipped: ${r.skipped}` : '').filter(Boolean).join(' | '));
}

// ── report ───────────────────────────────────────────────────────────────────
console.log(`\n══ SIM GOLDEN BATTLES (rung 4) ══  ${files.length} fixture(s); ${pass} consistency checks passed, ${fail} failed\n`);
for (const f of failures) console.log(`  ✗ ${f}`);
for (const r of report) {
  const state = r.runnable ? '✅ RUNNABLE' : !r.modelled ? '⃠ content not modelled by lib/sim' : `⏳ PENDING inputs (${r.captured}/${r.total} builds; missing ${r.pending.join(', ')})`;
  console.log(`  · ${r.id}: ${state}`);
}
if (!files.length) console.log('  no golden fixtures yet — add test/golden/*.json from a recording + note session');

// ── EXACT-STAT RUN results (the reality comparison) ──────────────────────────
if (!HAS_DB) {
  console.log('\n  EXACT-STAT RUN: skipped (no SUPABASE_URL) — run via the orchestrator or with --env-file=.env.local to score vs reality.');
} else if (runs.length) {
  console.log('\n  EXACT-STAT RUN — the sim on each fixture\'s REAL builds, scored vs the golden record:');
  for (const r of runs) {
    if (r.skipped) { console.log(`    · ${r.id}: skipped — ${r.skipped}`); continue; }
    const tag = r.outcomeMatch ? '✅ REPRODUCED' : '✗ MISMATCH (bucket 4 — sim is known-incomplete, not a rung failure)';
    console.log(`    · ${r.id} [${r.mode}]: sim ${r.predOutcome} / real ${r.actualOutcome}  ${tag}`);
    console.log(`        survivors sim ${r.predSurvivors}/real ${r.actualSurvivors}  ·  turns sim ${r.predTurns}/real ${r.actualTurns}  ·  sim breaks at: ${r.failedPhase ?? 'nowhere (cleared)'} (golden: ${r.expectedFailure ?? 'n/a'})`);
    if (r.zeroDmg.length) console.log(`        ⚠ 0-damage champs (coeff absent or non-ATK scaling the sim can't consume): ${r.zeroDmg.join(', ')}`);
    if (r.mode === 'boss-only') console.log('        NOTE: waves not modelled in this run → failure-LOCATION is not comparable to a wave-2 golden; OUTCOME is.');
  }
}

console.log('QA_JSON ' + JSON.stringify({ rung: 'golden', fixtures: files.length, pass, fail, failures,
  pendingInputs: report.filter(r => r.modelled && !r.runnable).map(r => `${r.id}: missing builds ${r.pending.join('/')}`),
  runs: runs.map(r => r.skipped ? { id: r.id, skipped: r.skipped } : { id: r.id, mode: r.mode, predOutcome: r.predOutcome, actualOutcome: r.actualOutcome, outcomeMatch: r.outcomeMatch, predSurvivors: r.predSurvivors, actualSurvivors: r.actualSurvivors, zeroDmg: r.zeroDmg }) }));
if (fail) process.exit(1);
