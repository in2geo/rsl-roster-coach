// tools/sim-suite.mjs — THE TURN-LOOP REGRESSION SUITE (the Model, graduated into the Simulator).
//
// battle-suite.mjs scores every captured battle with the AGGREGATE predictor (computeContributions) —
// which simulates NO turns for either side. This tool answers the same binary question (did we predict
// the observed WIN/LOSS?) but through the Model's turn engine: build BOTH sides as combatants from the
// REAL modifier-inclusive stats (gestal effectiveStats), run the seeded MONTE-CARLO (lib/sim/simulate,
// N seeded battles → a WIN RATE), and predict WIN iff win-rate ≥ 0.5. The 0.5 threshold is PINNED, not
// fitted — turning a win-rate into a binary is the one knob, and per implement-don't-fit it stays put.
//
// SCOPE = the dungeons with a sim content module + enemy table: DRAGON + SPIDER (Spider added 2026-08-08).
// Same case source + filter as battle-suite so the two are apples-to-apples: run this, then
// `battle-suite --by-dungeon` and read the balanced-accuracy delta PER DUNGEON. The graduation proof — a
// NUMBER per dungeon, next to the old model's line, not a description. `--dungeon spider` narrows to one.
//
// KNOWN v1 GAPS (flagged, not hidden): lifesteal gear-set sourcing for the roster path isn't wired yet
// (defaults 0 → survival-tank champs like Pelops under-survive); only 9 units have recipes, the rest run
// the legacy readSkillKit/applySkill path. Both narrow the fidelity and are the next items after the number.
//
// Run: node --env-file=.env.local tools/sim-suite.mjs [N]   (default N=25 seeded battles per case)

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { makeCombatant, makeState, simulate, actEnemyMob } from '../lib/sim/engine.js';
import { installRecipeRun } from '../lib/sim/interpreter.js';
import { readSkillKit, CONFIRMED_SKILL_ORDER, gearLifesteal } from '../lib/sim/ai.js';
import { makeDragonContent, HELLRAZOR_IMMUNE } from '../lib/sim/dragon.js';
import { makeSpiderContent, SKAVAG_IMMUNE } from '../lib/sim/spider.js';
import { buildUserChampions, fetchAliasRows } from '../lib/gestal-context.js';
import { mapRoster, pickLeaderFrom, applyLeaderAura } from '../lib/match-engine.js';
import { buildRosterIndex, loadNameResolverRest } from '../lib/champion-names.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname, '..');
const N = Number(process.argv.find((a, i) => i >= 2 && /^\d+$/.test(a)) ?? 25);
const BRIEF      = process.argv.includes('--brief');      // one-line readout (for watch-reconcile)
const NO_HISTORY = process.argv.includes('--no-history'); // read-only run
const DIAGNOSE   = process.argv.includes('--diagnose');   // dump false-wall / false-clear cases with failure mode
const PERHERO_I  = process.argv.indexOf('--perhero');     // --perhero <acctSubstr> <stage>: one Spider battle, sim per-hero vs reality
const PERHERO_ACCT  = PERHERO_I > -1 ? process.argv[PERHERO_I + 1] : null;
const PERHERO_STAGE = PERHERO_I > -1 ? +process.argv[PERHERO_I + 2] : null;
const TRACE      = process.argv.includes('--trace');      // with --perhero: run the deterministic MODEL (seed=null, no RNG) + full turn-by-turn trace
// --timeline: grade the sim's boss-HP CURVE (damage rate over the fight) against captured in-battle
// timelines (the sampler's boss-HP-over-time), not just win/loss. --timeline-path overrides the log path.
const TIMELINE   = process.argv.includes('--timeline');
const TIMELINE_PATH = (i => i > -1 ? process.argv[i + 1] : null)(process.argv.indexOf('--timeline-path'));
const NOTE       = (i => i > -1 ? process.argv[i + 1] ?? null : null)(process.argv.indexOf('--note'));
// Dungeons the sim can grade today (content module + enemy table both exist). `--dungeon <substr>` narrows
// to one (e.g. --dungeon spider); default = all supported.
const ALL_DUNGEONS = ["Dragon's Lair", "Spider's Den"];
const DUNGEON_ARG = (i => i > -1 ? process.argv[i + 1] : null)(process.argv.indexOf('--dungeon'));
const DUNGEONS = DUNGEON_ARG ? ALL_DUNGEONS.filter(d => d.toLowerCase().includes(DUNGEON_ARG.toLowerCase())) : ALL_DUNGEONS;

if (!process.env.SUPABASE_URL) { console.log('sim-suite needs the DB. Run with --env-file=.env.local'); process.exit(2); }
const BASE = process.env.SUPABASE_URL.replace(/\/rest\/v1\/?$/, '');
const H = { apikey: process.env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}` };
const rest = async p => (await fetch(`${BASE}/rest/v1/${p}`, { headers: H })).json();

// ── catalog: champions WITH damage coeffs (readSkillKit needs multiplier/multiplier_type/cooldown) ──
const SEL = 'id,name,type_id,rarity,role,affinity,faction,base_hp,base_atk,base_def,base_spd,base_acc,base_res,base_crit_rate,base_crit_dmg,'
  + 'champion_tags(tag_id,status,tags(name,is_debuff,bypasses_accuracy_check)),'
  + 'champion_skills(slot,skill_name,skill_summary,cooldown_base,cooldown_booked,damage_multiplier,multiplier_type,maxhp_effect_kind,maxhp_pct,maxhp_pct_boss,maxhp_pct_cap)';
let db = [];
for (let f = 0; ; f += 1000) {
  const d = await rest(`champions?select=${encodeURIComponent(SEL)}&game_id=eq.raid_shadow_legends&limit=1000&offset=${f}`);
  if (!Array.isArray(d) || !d.length) break; db = db.concat(d); if (d.length < 1000) break;
}
const byId = Object.fromEntries(db.map(c => [c.id, c]));
const aliasRows = await fetchAliasRows(rest);
const nameResolver = await loadNameResolverRest(rest);
// Leader auras (live all fight) — reuse the PRODUCT's correct logic: pickLeaderFrom + applyLeaderAura.
// SPD/ATK/DEF/HP auras are %-of-BASE (not total); area/restriction aware. Dragon floors ACC/RES.
const auraRows = await rest('champion_auras?select=champion_id,aura_type,aura_value,aura_area,aura_restriction,aura_summary');

// ── per-dungeon enemy tables + affinities (the opposing side the turn loop needs) ──
const dunRows = await rest('dungeons?select=id,name&game_id=eq.raid_shadow_legends');
const DUNGEON_DATA = {};   // name -> { enemyRows, stageAff }
for (const name of DUNGEONS) {
  const dun = dunRows.find(x => x.name === name);
  const enemyRows = await rest('dungeon_stage_enemies?select=stage_number,enemy_role,enemy_name,wave_number,position,champion_id,hp,atk,def,spd,res,acc,crit_rate,crit_dmg&dungeon_id=eq.' + dun.id);
  const affRows = await rest('dungeon_stage_affinities?select=stage_number,affinity&dungeon_id=eq.' + dun.id);
  DUNGEON_DATA[name] = { enemyRows, stageAff: Object.fromEntries(affRows.map(r => [r.stage_number, r.affinity])) };
}
const hasStage = (dungeon, stage) => (DUNGEON_DATA[dungeon]?.enemyRows ?? []).some(e => e.stage_number === stage && e.enemy_role === 'boss');

// Build the enemy side + content for a (dungeon, stage) — fresh each run (combat mutates state). Mirrors the
// per-dungeon assembly in lib/sim/dragon-fixture.js (Dragon: boss + discrete waves; Spider: boss + spawn template).
function buildEnemies(dungeon, stage) {
  const { enemyRows, stageAff } = DUNGEON_DATA[dungeon];
  const bossRow = enemyRows.find(e => e.stage_number === stage && e.enemy_role === 'boss');
  const boss = makeCombatant({ name: bossRow.enemy_name, side: 'enemy', role: 'boss',
    maxHp: +bossRow.hp, atk: +bossRow.atk, def: +bossRow.def, spd: +bossRow.spd, acc: +bossRow.acc, res: +bossRow.res,
    critRate: +bossRow.crit_rate, critDmg: +bossRow.crit_dmg, affinity: stageAff[stage] ?? 'Void' });

  if (dungeon === "Spider's Den") {
    boss.immune = SKAVAG_IMMUNE;
    // ONE Spiderling `add` row per stage = a SPAWN TEMPLATE (makeSpiderContent instantiates up to 10). acc:75 is
    // the real Spiderling ACC — the DB add-row's 100 is the in-game "suggested resistance" yellow number, NOT
    // accuracy (Mike first-party 2026-07-28). Spiderlings take the STAGE affinity. Mirrors dragon-fixture.js.
    const addRow = enemyRows.find(e => e.enemy_role === 'add' && e.stage_number === stage);
    const spawnTemplate = addRow ? { level: 60, maxHp: +addRow.hp, atk: +addRow.atk, def: +addRow.def, spd: +addRow.spd,
      acc: 75, res: +addRow.res, critRate: +addRow.crit_rate, critDmg: +addRow.crit_dmg, affinity: stageAff[stage] } : null;
    return { boss, content: makeSpiderContent({ stageNumber: stage, boss, spawnTemplate }) };
  }

  // Dragon: boss + discrete WAVES (real champions with kit/affinity from champion_id).
  boss.immune = HELLRAZOR_IMMUNE;
  const waveRows = enemyRows.filter(e => e.enemy_role === 'wave' && e.stage_number === stage);
  const waves = [...new Set(waveRows.map(e => e.wave_number))].sort((a, b) => a - b).map(wn => ({
    enemies: waveRows.filter(e => e.wave_number === wn).sort((a, b) => a.position - b.position).map(r => {
      const cat = byId[r.champion_id];
      return makeCombatant({ name: `${r.enemy_name}#${r.position}`, side: 'enemy', role: 'wave',
        maxHp: +r.hp, atk: +r.atk, def: +r.def, spd: +r.spd, acc: +r.acc, res: +r.res,
        critRate: +r.crit_rate, critDmg: +r.crit_dmg, affinity: cat?.affinity,
        skills: readSkillKit(cat?.champion_skills ?? []) });
    }),
    actEnemy: actEnemyMob,
  }));
  return { boss, content: makeDragonContent({ stageNumber: stage, waves, boss }) };
}

// Build one ally combatant from a mapped-roster champ (real effective stats + kit).
// `lsById` maps champion id -> lifesteal fraction (from the account's gear sets; 0 if none).
function allyCombatant(champ, lsById = {}) {
  const es = champ.estimated_stats ?? {};
  return makeCombatant({ name: champ.name, side: 'ally',
    maxHp: es.hp, atk: es.atk, def: es.def, spd: es.spd, acc: es.acc, res: es.res,
    critRate: es.crit_rate ?? es.crate, critDmg: es.crit_dmg ?? es.cdmg,
    affinity: champ.affinity, faction: champ.faction,               // faction gates faction-restricted ally-attacks (Pallas A1 Argonites join)
    lifesteal: lsById[champ.id] ?? 0,                               // Lifesteal/Bloodthirst gear -> 30% heal of damage dealt
    bossMastery: !!champ.has_boss_mastery,                           // legacy Warmaster flag (fallback when masteries[] is empty — manual rosters)
    masteries: champ.masteries ?? [],                                // full decoded mastery NAMES → target-type-aware Warmaster/Giant Slayer boss bonus + offense-proc damage masteries (was: only the boolean above; the montecarlo/fixture path already passed this)
    skillOrder: CONFIRMED_SKILL_ORDER[champ.name] ?? null,
    skills: readSkillKit(byId[champ.id]?.champion_skills ?? []) });
}

// ── rosters (identical construction to battle-suite so cases line up) + per-account lifesteal by gear ──
const rosterByAccount = {}, lifestealByAccount = {};
for (const f of fs.readdirSync(path.join(REPO, 'gestal-sync/output')).filter(x => x.endsWith('.json') && !/^gear-corpus/.test(x))) {
  const snap = JSON.parse(fs.readFileSync(path.join(REPO, 'gestal-sync/output', f), 'utf8'));
  if (!snap.accountId) continue;
  const { userChampions } = buildUserChampions(snap.champions ?? [], db, aliasRows);
  rosterByAccount[snap.accountId] = buildRosterIndex(mapRoster(userChampions, {}).mapped, nameResolver);
  // gear-derived lifesteal per champion NAME (Lifesteal / Bloodthirst 4-set = 30% of damage dealt)
  const ls = {};
  for (const c of snap.champions ?? []) {
    const counts = {}; for (const a of c.equippedArtifacts ?? []) if (a.set) counts[a.set] = (counts[a.set] ?? 0) + 1;
    const setNames = Object.entries(counts).filter(([, n]) => n >= 4).map(([s]) => s);   // lifesteal is a 4-set
    const frac = gearLifesteal(setNames) || (setNames.some(s => /bloodthirst/i.test(s)) ? 0.30 : 0);
    if (frac) ls[c.name] = frac;
  }
  lifestealByAccount[snap.accountId] = ls;
}

// ── the Monte-Carlo turn-loop predictor ──
function predictTurnLoop(dungeon, team, stage, lsById = {}) {
  let wins = 0, wipes = 0, timeouts = 0, survSum = 0, turnSum = 0, bossHpLossSum = 0, lossSeeds = 0, reviveSum = 0, deathSum = 0;
  for (let seed = 1; seed <= N; seed++) {
    const allies = team.map(c => allyCombatant(c, lsById));
    const { content } = buildEnemies(dungeon, stage);
    const state = makeState({ allies, enemies: [], seed }); state.purpleBarLeft = 0;   // Dragon-only; no-op for Spider
    installRecipeRun(state);   // run recipes for champs that have them (Perfect Veil, immunities, Second Wind, incoming mods); others fall back to applySkill
    const l = console.log; console.log = () => {};
    const res = simulate(state, content, { turnCap: 400 });
    console.log = l;
    survSum += (res.survivors?.length ?? 0); turnSum += (res.turns ?? 0);
    reviveSum += (res.revives?.length ?? 0);
    deathSum += (res.deaths ?? []).filter(e => !/^Spiderling#/i.test(e.who ?? '')).length;   // ALLY deaths only (exclude the swarm)
    if (res.won) { wins++; continue; }
    lossSeeds++;
    // failure mode: TIMED OUT (boss never died — a DAMAGE/under-credit loss) vs WIPED (team died — a SURVIVAL loss)
    if (/turn cap/i.test(res.reason || '') || (res.turns ?? 0) >= 400) timeouts++; else wipes++;
    const boss = state.enemies.find(e => e.role === 'boss');
    if (boss) bossHpLossSum += Math.max(0, boss.hp) / (boss.maxHp || 1);
  }
  const winRate = wins / N;
  return { predWin: winRate >= 0.5, winRate,
    diag: { wipes, timeouts, avgSurv: survSum / N, avgTurns: Math.round(turnSum / N),
            avgRevives: reviveSum / N, avgDeaths: deathSum / N,
            bossHpAtLoss: lossSeeds ? bossHpLossSum / lossSeeds : null } };
}

// ── --timeline: grade the sim's boss-HP CURVE vs captured in-battle timelines ────────────────────
// Reads local battle-log.json (where the sampler writes `timeline`). For each entry with a boss
// timeline in a supported dungeon, run the DETERMINISTIC sim (seed=null, EV) with a per-turn boss-HP
// recorder, then compare the sim's boss-HP-fraction curve to the captured one — normalized to
// battle-progress [0,1]. This grades the SHAPE of the fight (the damage rate the CB hand-calc checks
// by hand), not just the binary outcome. Self-contained: the entry carries account + stage + heroes.
if (TIMELINE) {
  const blPath = TIMELINE_PATH ?? path.join(REPO, 'gestal-sync/output/battle-log.json');
  if (!fs.existsSync(blPath)) { console.log(`[timeline] battle-log not found: ${blPath}`); process.exit(2); }
  const log = JSON.parse(fs.readFileSync(blPath, 'utf8'));
  const withTl = log.filter(e => e?.timeline?.boss?.trace?.length && DUNGEONS.includes(e.dungeon) && e.stageNumber && hasStage(e.dungeon, e.stageNumber));
  if (!withTl.length) { console.log(`[timeline] no entries with a boss timeline in ${DUNGEONS.join('/')} (need battles captured by the sampler-wired watcher).`); process.exit(0); }

  // linear-interpolate a curve (pts sorted by .p ascending) at normalized progress p∈[0,1].
  const sampleAt = (pts, p) => {
    if (p <= pts[0].p) return pts[0].v;
    if (p >= pts[pts.length - 1].p) return pts[pts.length - 1].v;
    for (let i = 1; i < pts.length; i++) if (pts[i].p >= p) { const a = pts[i - 1], b = pts[i]; return a.v + (p - a.p) / ((b.p - a.p) || 1) * (b.v - a.v); }
    return pts[pts.length - 1].v;
  };
  const GRID = Array.from({ length: 19 }, (_, i) => (i + 1) / 20); // 0.05..0.95

  let fidSum = 0, graded = 0;
  for (const e of withTl) {
    const roster = rosterByAccount[e.accountId];
    if (!roster) { console.log(`[timeline] skip ${e.stage}: no roster for ${e.displayName ?? e.accountId}`); continue; }
    const team = (e.heroes ?? []).map(h => roster.get(h.name)).filter(Boolean);
    if (team.length < 3) { console.log(`[timeline] skip ${e.stage}: partial team (${team.length})`); continue; }
    const auras = auraRows.filter(a => team.some(c => c.id === a.champion_id));
    const leader = pickLeaderFrom(team, auras, { contentArea: 'dungeon', thresholdStats: ['acc', 'res'] });
    const auraTeam = applyLeaderAura(team, leader);
    const lsMap = lifestealByAccount[e.accountId] ?? {};
    const lsById = {}; for (const h of e.heroes ?? []) { const c = roster.get(h.name); if (c && (lsMap[h.name] ?? lsMap[c.name])) lsById[c.id] = lsMap[h.name] ?? lsMap[c.name]; }

    // deterministic sim with a per-turn boss-HP recorder
    const allies = auraTeam.map(c => allyCombatant(c, lsById));
    const { content } = buildEnemies(e.dungeon, e.stageNumber);
    const state = makeState({ allies, enemies: [], seed: null }); state.purpleBarLeft = 0;
    installRecipeRun(state);
    const simPts = [];
    state.onTurn = (st) => { const bo = st.enemies.find(x => x.role === 'boss'); if (bo) simPts.push({ turn: st.turn, hpFrac: Math.max(0, bo.hp) / (bo.maxHp || 1), nEnemies: st.enemies.filter(x => x.alive).length }); };
    const l = console.log; if (!TRACE) console.log = () => {};
    const res = simulate(state, content, { turnCap: 400, trace: TRACE });
    console.log = l;
    if (simPts.length < 2) { console.log(`[timeline] skip ${e.stage}: sim produced no boss curve`); continue; }

    const simMaxT = simPts[simPts.length - 1].turn || 1;
    const simCurve = simPts.map(x => ({ p: x.turn / simMaxT, v: x.hpFrac }));
    const b = e.timeline.boss;
    const realDur = b.trace[b.trace.length - 1].tSec || 1;
    const realCurve = b.trace.map(x => ({ p: x.tSec / realDur, v: Math.max(0, x.hp) / (b.maxHp || 1) }));

    // Wave→boss transition: sim = first turn only the boss is alive; reality = first trace point where
    // boss HP starts dropping (>1% off max). If the sim's transition is LATER (bigger %), the sim's WAVE
    // phase is proportionally too long — the boss-damage clock starts late, back-loading the curve.
    const simWaveClear = simPts.find(x => x.nEnemies <= 1)?.turn ?? simMaxT;
    const simWaveFrac = simWaveClear / simMaxT;
    const realBossStart = b.trace.find(x => x.hp < b.maxHp * 0.99);
    const realWaveFrac = realBossStart ? realBossStart.tSec / realDur : null;

    let mae = 0; for (const p of GRID) mae += Math.abs(sampleAt(simCurve, p) - sampleAt(realCurve, p)); mae /= GRID.length;
    fidSum += mae; graded++;

    const dbMax = state.enemies.find(x => x.role === 'boss')?.maxHp ?? null;
    const capMax = Math.round(b.maxHp / (e.timeline.fixedDivisor || 1));
    console.log(`\n══ ${e.displayName} — ${e.stage} — real ${e.result} ${e.turns}t | sim ${res.won ? 'WIN' : 'LOSS'} ${res.turns}t ══`);
    console.log(`   boss maxHP: captured ${capMax}  sim/DB ${dbMax}${dbMax && Math.abs(dbMax - capMax) / capMax > 0.1 ? '  ⚠ >10% off — DB enemy table needs calibrating' : ''}`);
    console.log(`   boss-HP curve MAE = ${(mae * 100).toFixed(1)}%  (lower = sim damage-rate matches reality)`);
    console.log(`   wave→boss transition: real @${realWaveFrac != null ? Math.round(realWaveFrac * 100) + '%' : '?'} progress · sim @${Math.round(simWaveFrac * 100)}% (turn ${simWaveClear}/${simMaxT})`
      + `${realWaveFrac != null && simWaveFrac - realWaveFrac > 0.12 ? '  ⚠ sim wave phase too long → boss damage starts late' : ''}`);
    const show = GRID.filter((_, i) => i % 2 === 1);
    console.log(`   progress %  ${show.map(p => String(Math.round(p * 100)).padStart(5)).join('')}`);
    console.log(`   real bossHP% ${show.map(p => String(Math.round(sampleAt(realCurve, p) * 100)).padStart(5)).join('')}`);
    console.log(`   sim  bossHP% ${show.map(p => String(Math.round(sampleAt(simCurve, p) * 100)).padStart(5)).join('')}`);
  }
  console.log(`\n[timeline] graded ${graded} battle(s) · mean boss-HP-curve MAE = ${graded ? (100 * fidSum / graded).toFixed(1) + '%' : 'n/a'}  — the sim's damage-rate fidelity vs captured reality (the continuous signal beside win/loss)`);
  process.exit(0);
}

// ── cases (same source + filter as battle-suite; scoped to the sim's supported dungeons) ──
const runs = await rest('run_reconciliations?select=account_id,display_name,content,successful,duration_seconds,turns,team_fielded&order=battle_captured_at.desc&limit=2000');
const cases = [], leaderTally = {}; let lifestealHits = 0;
const skipped = { no_outcome: 0, not_supported: 0, no_stage: 0, no_enemies: 0, no_roster: 0, partial_team: 0 };
for (const r of runs) {
  if (r.successful !== true && r.successful !== false) { skipped.no_outcome++; continue; }
  const m = String(r.content ?? '').match(/^(.*?)\s+Stage\s+(\d+)/i);
  if (!m) { skipped.no_stage++; continue; }
  const dungeon = m[1], stage = +m[2];
  if (!DUNGEONS.includes(dungeon)) { skipped.not_supported++; continue; }
  if (!hasStage(dungeon, stage)) { skipped.no_enemies++; continue; }
  const roster = rosterByAccount[r.account_id];
  if (!roster) { skipped.no_roster++; continue; }
  let tf = r.team_fielded; if (typeof tf === 'string') { try { tf = JSON.parse(tf); } catch { tf = []; } }
  const team = (tf ?? []).map(h => roster.get(h.name)).filter(Boolean);
  if (team.length < 3) { skipped.partial_team++; continue; }
  // lifesteal per champ id, matched by the fielded name or the DB name (alias-tolerant).
  const lsMap = lifestealByAccount[r.account_id] ?? {};
  const lsById = {};
  for (const h of tf ?? []) { const c = roster.get(h.name); if (c && (lsMap[h.name] ?? lsMap[c.name])) lsById[c.id] = lsMap[h.name] ?? lsMap[c.name]; }
  // Leader aura, folded into estimated_stats ONCE per case (deterministic; same for every seed).
  const auras = auraRows.filter(a => team.some(c => c.id === a.champion_id));
  const leader = pickLeaderFrom(team, auras, { contentArea: 'dungeon', thresholdStats: ['acc', 'res'] });
  const auraTeam = applyLeaderAura(team, leader);
  // PER-HERO reality anchor: run ONE traced battle and put the sim's per-hero taken/healed/survived next to the
  // captured reality. This is the turn-by-turn / reality-anchored check — localizes the divergence (e.g. an
  // under-credited healer) instead of guessing coefficients from the aggregate.
  if (PERHERO_ACCT && dungeon === "Spider's Den" && stage === PERHERO_STAGE
      && String(r.display_name ?? '').toLowerCase().includes(PERHERO_ACCT.toLowerCase())) {
    const allies = auraTeam.map(c => allyCombatant(c, lsById));
    const { content } = buildEnemies(dungeon, stage);
    // TRACE = the deterministic MODEL: seed=null (no RNG, pure EV) + trace so the turn-by-turn is watchable and
    // reproducible. Otherwise seed=1 (one Monte-Carlo draw) for the per-hero summary.
    const state = makeState({ allies, enemies: [], seed: TRACE ? null : 1 }); state.purpleBarLeft = 0;
    installRecipeRun(state);
    const l = console.log; if (!TRACE) console.log = () => {};
    const res = simulate(state, content, { turnCap: 400, trace: TRACE });
    console.log = l;
    console.log(`\n══ PER-HERO — ${r.display_name} ${dungeon} s${stage} — ${TRACE ? 'MODEL (seed=null)' : 'SIM'} ${res.won ? 'WIN' : 'LOSS'} in ${res.turns}t (${res.reason}) | REALITY WIN in ${r.turns}t/${r.duration_seconds}s ══`);
    console.log(`   ${'champ'.padEnd(22)} ${'sim:alive taken healed'.padEnd(34)} | reality:survived taken healed`);
    let tf = r.team_fielded; if (typeof tf === 'string') { try { tf = JSON.parse(tf); } catch { tf = []; } }
    const realOf = n => (tf ?? []).find(h => (h.name ?? '') === n) ?? {};
    for (const a of allies) {
      const rl = realOf(a.name);
      const sim = `${String(a.alive).padEnd(6)} ${String(Math.round(a.taken)).padStart(9)} ${String(Math.round(a.healed)).padStart(9)}`;
      const real = `${String(rl.survived).padEnd(6)} ${String(rl.defense ?? '?').padStart(9)} ${String(rl.healing ?? '?').padStart(9)}`;
      console.log(`   ${a.name.padEnd(22)} ${sim.padEnd(34)} | ${real}`);
    }
    process.exit(0);
  }
  for (const [, v] of Object.entries(lsById)) if (v > 0) lifestealHits++;
  const p = predictTurnLoop(dungeon, auraTeam, stage, lsById);
  leaderTally[leader ? `${leader.name} (${leader.aura_type} ${leader.aura_value})` : '(no aura)'] = (leaderTally[leader ? `${leader.name} (${leader.aura_type} ${leader.aura_value})` : '(no aura)'] ?? 0) + 1;
  cases.push({ acct: r.display_name ?? r.account_id, dungeon, stage, actualWin: r.successful, ...p, dur: r.duration_seconds, turns: r.turns, team: auraTeam.map(c => c.name) });
}

// ── score (mirror of battle-suite.score): OVERALL + per dungeon ──
function score(rows) {
  const wins = rows.filter(c => c.actualWin), losses = rows.filter(c => !c.actualWin);
  const tp = wins.filter(c => c.predWin).length, fn = wins.length - tp;
  const tn = losses.filter(c => !c.predWin).length, fp = losses.length - tn;
  const winRecall = wins.length ? tp / wins.length : null, lossRecall = losses.length ? tn / losses.length : null;
  const balanced = (winRecall != null && lossRecall != null) ? (winRecall + lossRecall) / 2 : null;
  return { n: rows.length, wins: wins.length, losses: losses.length, tp, fn, tn, fp, winRecall, lossRecall, balanced };
}
const s = score(cases);
const byDun = {}; for (const d of DUNGEONS) { const rows = cases.filter(c => c.dungeon === d); if (rows.length) byDun[d] = score(rows); }
const pct = v => v == null ? '  n/a' : (100 * v).toFixed(1).padStart(5) + '%';
const r3 = v => v == null ? null : Math.round(v * 1000) / 1000;

// ── history + delta (mirror of battle-suite). sim-suite is DETERMINISTIC for a fixed N (seeds 1..N), so a
// move is a real change in code / captures / N — not RNG noise. Appended only on a move → a changelog of the
// SIMULATOR's number(s), standing next to battle-suite's old-model line. NORTH_STAR.md step 1. ──
const HIST = path.join(REPO, 'knowledge', 'sim-suite-history.jsonl');
let hist = [];
try { hist = fs.readFileSync(HIST, 'utf8').split(/\r?\n/).filter(Boolean).map(l => JSON.parse(l)); } catch { /* first run */ }
const prev  = hist.length ? hist[hist.length - 1] : null;
const entry = { at: new Date().toISOString(), dungeons: DUNGEONS, N, n: s.n, balanced: r3(s.balanced),
                winRecall: r3(s.winRecall), lossRecall: r3(s.lossRecall), false_clears: s.fp, false_walls: s.fn,
                byDungeon: Object.fromEntries(Object.entries(byDun).map(([d, x]) => [d, { n: x.n, balanced: r3(x.balanced), false_clears: x.fp }])), note: NOTE };
const moved = !prev || prev.n !== entry.n || prev.balanced !== entry.balanced || prev.N !== entry.N;
if (moved && !NO_HISTORY) { fs.mkdirSync(path.dirname(HIST), { recursive: true }); fs.appendFileSync(HIST, JSON.stringify(entry) + '\n'); }
const dBal = (prev && prev.balanced != null && s.balanced != null) ? 100 * (s.balanced - prev.balanced) : null;
const signed = (v, d = 1) => Math.abs(v) < 0.5 / 10 ** d ? `±${(0).toFixed(d)}` : `${v > 0 ? '+' : '−'}${Math.abs(v).toFixed(d)}`;
const deltaStr = prev == null ? 'no prior run recorded'
  : `${signed(dBal ?? 0)}pp vs ${prev.at.slice(0, 16).replace('T', ' ')}${prev.N !== N ? ` (was N=${prev.N})` : ''}`;
const perDun = Object.entries(byDun).map(([d, x]) => `${d.split("'")[0]} ${pct(x.balanced).trim()}(${x.n})`).join(' · ');

if (DIAGNOSE) {
  const fmt = c => `  s${String(c.stage).padStart(2)} WR${String(Math.round(c.winRate * 100)).padStart(3)}%  `
    + `wipe ${c.diag.wipes}/timeout ${c.diag.timeouts}  bossHP@loss ${c.diag.bossHpAtLoss == null ? ' n/a' : (100 * c.diag.bossHpAtLoss).toFixed(0).padStart(3) + '%'}  `
    + `rev ${c.diag.avgRevives.toFixed(1)}/death ${c.diag.avgDeaths.toFixed(1)}  surv ${c.diag.avgSurv.toFixed(1)}  ${c.diag.avgTurns}t  [${c.acct}] ${c.team.join(', ')}`;
  for (const d of DUNGEONS) {
    const fw = cases.filter(c => c.dungeon === d && c.actualWin && !c.predWin).sort((a, b) => a.stage - b.stage);
    console.log(`\n══ ${d} — ${fw.length} FALSE WALLS (won in reality, sim predicts loss) ══`);
    console.log(`   failure mode: WIPE = team died (survival over-punish) · TIMEOUT = boss never died in 400t (damage under-credit)`);
    console.log(`   rev/death = avg [revive]/death events per battle (N=${N})`);
    const wipeN = fw.reduce((n, c) => n + c.diag.wipes, 0), toN = fw.reduce((n, c) => n + c.diag.timeouts, 0);
    const revN = fw.reduce((n, c) => n + c.diag.avgRevives, 0), deathN = fw.reduce((n, c) => n + c.diag.avgDeaths, 0);
    console.log(`   aggregate loss-seeds across these cases: WIPE ${wipeN} · TIMEOUT ${toN}`);
    console.log(`   aggregate per-battle avg across ${fw.length} cases: revives ${revN.toFixed(1)} · deaths ${deathN.toFixed(1)}  (ratio ${deathN ? (revN / deathN * 100).toFixed(0) : 0}% of deaths reversed)`);
    for (const c of fw) console.log(fmt(c));
  }
  process.exit(0);
}

if (BRIEF) {
  console.log(`══ SIM SUITE  N=${N}  balanced ${pct(s.balanced).trim()}  (${deltaStr})  [${perDun}]  false-clears ${s.fp}`);
  process.exit(0);
}

console.log(`\n══ SIM SUITE (turn loop + RNG) ══  ${DUNGEONS.join(' + ')} · N=${N} seeded battles/case`);
console.log(`   cases: ${s.n}   skipped: ${Object.entries(skipped).map(([k, v]) => `${k} ${v}`).join(', ')}`);
console.log(`   leader aura applied: ${Object.entries(leaderTally).map(([k, v]) => `${k} ×${v}`).join(' · ')}`);
console.log(`   lifesteal champs applied (across ${s.n} cases): ${lifestealHits}`);
console.log(`\n   BALANCED ACCURACY   ${pct(s.balanced)}   <- turn loop, all supported dungeons`);
console.log(`   change              ${deltaStr}`);
console.log(`   win recall          ${pct(s.winRecall)}   (won, predicted win ${s.tp}/${s.wins})`);
console.log(`   loss recall         ${pct(s.lossRecall)}   (lost, predicted loss ${s.tn}/${s.losses})`);
console.log(`\n   won,  predicted LOSS  ${String(s.fn).padStart(3)}   false wall`);
console.log(`   lost, predicted WIN   ${String(s.fp).padStart(3)}   FALSE CLEAR`);
console.log('\n   per dungeon               n   balanced   false-clears');
for (const [d, x] of Object.entries(byDun)) console.log('   ' + d.padEnd(22) + String(x.n).padStart(4) + '   ' + pct(x.balanced) + '   ' + String(x.fp).padStart(6));
console.log(`\n   compare: node --env-file=.env.local tools/battle-suite.mjs --by-dungeon  (old model, per dungeon)\n`);
console.log('QA_JSON ' + JSON.stringify({ tool: 'sim-suite', dungeons: DUNGEONS, N, n: s.n,
  balanced: s.balanced, winRecall: s.winRecall, lossRecall: s.lossRecall, tp: s.tp, fp: s.fp, tn: s.tn, fn: s.fn,
  wins: s.wins, losses: s.losses, byDungeon: Object.fromEntries(Object.entries(byDun).map(([d, x]) => [d, { n: x.n, balanced: x.balanced, fp: x.fp, fn: x.fn }])) }));
