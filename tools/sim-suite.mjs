// tools/sim-suite.mjs — THE TURN-LOOP REGRESSION SUITE (the Model, graduated into the Simulator).
//
// battle-suite.mjs scores every captured battle with the AGGREGATE predictor (computeContributions) —
// which simulates NO turns for either side. This tool answers the same binary question (did we predict
// the observed WIN/LOSS?) but through the Model's turn engine: build BOTH sides as combatants from the
// REAL modifier-inclusive stats (gestal effectiveStats), run the seeded MONTE-CARLO (lib/sim/simulate,
// N seeded battles → a WIN RATE), and predict WIN iff win-rate ≥ 0.5. The 0.5 threshold is PINNED, not
// fitted — turning a win-rate into a binary is the one knob, and per implement-don't-fit it stays put.
//
// SCOPE = the DRAGON subset (the only dungeon with a full enemy table + champion recipes today). Same
// case filter as battle-suite so the two are apples-to-apples: run this, then `battle-suite --by-dungeon`
// for the aggregate's Dragon line, and read the balanced-accuracy delta. This is the graduation proof —
// a NUMBER, next to the 52.9% aggregate floor, not a description.
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
import { buildUserChampions, fetchAliasRows } from '../lib/gestal-context.js';
import { mapRoster, pickLeaderFrom, applyLeaderAura } from '../lib/match-engine.js';
import { buildRosterIndex, loadNameResolverRest } from '../lib/champion-names.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname, '..');
const N = Number(process.argv.find((a, i) => i >= 2 && /^\d+$/.test(a)) ?? 25);
const DUNGEON = "Dragon's Lair";

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

// ── Dragon enemy table + per-stage affinity (the opposing side the turn loop needs) ──
const dun = (await rest('dungeons?select=id,name&game_id=eq.raid_shadow_legends')).find(x => x.name === DUNGEON);
const enemyRows = await rest('dungeon_stage_enemies?select=stage_number,enemy_role,enemy_name,wave_number,position,champion_id,hp,atk,def,spd,res,acc,crit_rate,crit_dmg&dungeon_id=eq.' + dun.id);
const affRows = await rest('dungeon_stage_affinities?select=stage_number,affinity&dungeon_id=eq.' + dun.id);
const stageAff = Object.fromEntries(affRows.map(r => [r.stage_number, r.affinity]));
const hasStage = (stage) => enemyRows.some(e => e.stage_number === stage && e.enemy_role === 'boss');

// Build the Dragon enemy side (boss + waves) for a stage — fresh each run (combat mutates state).
function buildDragonEnemies(stage) {
  const bossRow = enemyRows.find(e => e.stage_number === stage && e.enemy_role === 'boss');
  const boss = makeCombatant({ name: bossRow.enemy_name, side: 'enemy', role: 'boss',
    maxHp: +bossRow.hp, atk: +bossRow.atk, def: +bossRow.def, spd: +bossRow.spd, acc: +bossRow.acc, res: +bossRow.res,
    critRate: +bossRow.crit_rate, critDmg: +bossRow.crit_dmg, affinity: stageAff[stage] ?? 'Void' });
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
  const content = makeDragonContent({ stageNumber: stage, purpleBarHp: 0.20 * boss.maxHp, waves, boss });
  return { boss, waves, content };
}

// Build one ally combatant from a mapped-roster champ (real effective stats + kit).
// `lsById` maps champion id -> lifesteal fraction (from the account's gear sets; 0 if none).
function allyCombatant(champ, lsById = {}) {
  const es = champ.estimated_stats ?? {};
  return makeCombatant({ name: champ.name, side: 'ally',
    maxHp: es.hp, atk: es.atk, def: es.def, spd: es.spd, acc: es.acc, res: es.res,
    critRate: es.crit_rate ?? es.crate, critDmg: es.crit_dmg ?? es.cdmg,
    affinity: champ.affinity, lifesteal: lsById[champ.id] ?? 0,      // Lifesteal/Bloodthirst gear -> 30% heal of damage dealt
    bossMastery: !!champ.has_boss_mastery,                           // real Warmaster flag from masteryIds
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
function predictTurnLoop(team, stage, lsById = {}) {
  let wins = 0;
  for (let seed = 1; seed <= N; seed++) {
    const allies = team.map(c => allyCombatant(c, lsById));
    const { content } = buildDragonEnemies(stage);
    const state = makeState({ allies, enemies: [], seed }); state.purpleBarLeft = 0;
    installRecipeRun(state);   // run recipes for champs that have them (Perfect Veil, immunities, Second Wind, incoming mods); others fall back to applySkill
    const l = console.log; console.log = () => {};
    const res = simulate(state, content, { turnCap: 400 });
    console.log = l;
    if (res.won) wins++;
  }
  const winRate = wins / N;
  return { predWin: winRate >= 0.5, winRate };
}

// ── cases (same source + filter as battle-suite; scoped to Dragon) ──
const runs = await rest('run_reconciliations?select=account_id,display_name,content,successful,duration_seconds,turns,team_fielded&order=battle_captured_at.desc&limit=2000');
const cases = [], leaderTally = {}; let lifestealHits = 0;
const skipped = { no_outcome: 0, not_dragon: 0, no_stage: 0, no_enemies: 0, no_roster: 0, partial_team: 0 };
for (const r of runs) {
  if (r.successful !== true && r.successful !== false) { skipped.no_outcome++; continue; }
  const m = String(r.content ?? '').match(/^(.*?)\s+Stage\s+(\d+)/i);
  if (!m) { skipped.no_stage++; continue; }
  const dungeon = m[1], stage = +m[2];
  if (dungeon !== DUNGEON) { skipped.not_dragon++; continue; }
  if (!hasStage(stage)) { skipped.no_enemies++; continue; }
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
  for (const [, v] of Object.entries(lsById)) if (v > 0) lifestealHits++;
  const p = predictTurnLoop(auraTeam, stage, lsById);
  leaderTally[leader ? `${leader.name} (${leader.aura_type} ${leader.aura_value})` : '(no aura)'] = (leaderTally[leader ? `${leader.name} (${leader.aura_type} ${leader.aura_value})` : '(no aura)'] ?? 0) + 1;
  cases.push({ acct: r.display_name ?? r.account_id, stage, actualWin: r.successful, ...p, dur: r.duration_seconds, turns: r.turns });
}

// ── score (mirror of battle-suite.score) ──
const wins = cases.filter(c => c.actualWin), losses = cases.filter(c => !c.actualWin);
const tp = wins.filter(c => c.predWin).length, fn = wins.length - tp;
const tn = losses.filter(c => !c.predWin).length, fp = losses.length - tn;
const winRecall = wins.length ? tp / wins.length : null, lossRecall = losses.length ? tn / losses.length : null;
const balanced = (winRecall != null && lossRecall != null) ? (winRecall + lossRecall) / 2 : null;
const pct = v => v == null ? '  n/a' : (100 * v).toFixed(1).padStart(5) + '%';

console.log(`\n══ SIM SUITE (turn loop + RNG) ══  Dragon's Lair · N=${N} seeded battles/case`);
console.log(`   cases: ${cases.length}   skipped: ${Object.entries(skipped).map(([k, v]) => `${k} ${v}`).join(', ')}`);
console.log(`   leader aura applied: ${Object.entries(leaderTally).map(([k, v]) => `${k} ×${v}`).join(' · ')}`);
console.log(`   lifesteal champs applied (across ${cases.length} cases): ${lifestealHits}`);
console.log(`\n   BALANCED ACCURACY   ${pct(balanced)}   <- turn loop vs the aggregate's Dragon line`);
console.log(`   win recall          ${pct(winRecall)}   (won, predicted win ${tp}/${wins.length})`);
console.log(`   loss recall         ${pct(lossRecall)}   (lost, predicted loss ${tn}/${losses.length})`);
console.log(`\n   won,  predicted LOSS  ${String(fn).padStart(3)}   false wall`);
console.log(`   lost, predicted WIN   ${String(fp).padStart(3)}   FALSE CLEAR`);
console.log(`\n   compare: run  node --env-file=.env.local tools/battle-suite.mjs --by-dungeon  (Dragon's Lair line)\n`);
console.log('QA_JSON ' + JSON.stringify({ tool: 'sim-suite', dungeon: DUNGEON, N, n: cases.length,
  balanced, winRecall, lossRecall, tp, fp, tn, fn, wins: wins.length, losses: losses.length }));
