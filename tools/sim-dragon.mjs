// tools/sim-dragon.mjs — replay every captured Dragon battle through the turn loop.
//
// Step 1 of the build order: does the ENGINE produce sane turn counts against reality? We have
// `turns` and `duration_seconds` on every captured battle, so this is a CONTINUOUS error, not the
// one bit that battle-suite scores. If predicted turns are nonsense here, the whole approach is
// wrong and we know within the hour.
//
// Reports predicted vs actual outcome AND turns, plus every UNMODELLED / MISSING flag the run hit.
// Nothing is filled with a plausible default — see lib/sim/engine.js header.
//
// Run: node --env-file=.env.local tools/sim-dragon.mjs [--verbose] [--stage N]

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildUserChampions, fetchAliasRows } from '../lib/gestal-context.js';
import { mapRoster } from '../lib/match-engine.js';
import { buildRosterIndex, loadNameResolverRest } from '../lib/champion-names.js';
import { makeCombatant, makeState, simulate } from '../lib/sim/engine.js';
import { readSkillKit } from '../lib/sim/ai.js';
import { makeDragonContent, HELLRAZOR_IMMUNE } from '../lib/sim/dragon.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname, '..');
const VERBOSE = process.argv.includes('--verbose');
const ONLY_STAGE = (i => i > -1 ? +process.argv[i + 1] : null)(process.argv.indexOf('--stage'));

const BASE = (process.env.SUPABASE_URL || '').replace(/\/rest\/v1\/?$/, '');
const H = { apikey: process.env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}` };
const rest = async p => (await fetch(`${BASE}/rest/v1/${p}`, { headers: H })).json();

const SEL = 'id,name,type_id,rarity,role,affinity,faction,base_hp,base_atk,base_def,base_spd,base_acc,base_res,base_crit_rate,base_crit_dmg,'
  + 'champion_tags(tag_id,status,tags(name)),champion_skills(slot,skill_name,skill_summary,cooldown_base,cooldown_booked,damage_multiplier)';
let db = [];
for (let f = 0; ; f += 1000) {
  const d = await rest(`champions?select=${encodeURIComponent(SEL)}&game_id=eq.raid_shadow_legends&limit=1000&offset=${f}`);
  if (!Array.isArray(d) || !d.length) break; db = db.concat(d); if (d.length < 1000) break;
}
const byId = Object.fromEntries(db.map(c => [c.id, c]));
const aliasRows = await fetchAliasRows(rest);
const nameResolver = await loadNameResolverRest(rest);

const rosters = {};
for (const f of fs.readdirSync(path.join(REPO, 'gestal-sync/output')).filter(x => x.endsWith('.json') && !/^gear-corpus/.test(x))) {
  const snap = JSON.parse(fs.readFileSync(path.join(REPO, 'gestal-sync/output', f), 'utf8'));
  if (!snap.accountId) continue;
  const { userChampions } = buildUserChampions(snap.champions ?? [], db, aliasRows);
  rosters[snap.accountId] = { idx: buildRosterIndex(mapRoster(userChampions, {}).mapped, nameResolver), name: snap.displayName ?? snap.accountId };
}

const dun = (await rest('dungeons?select=id,name&game_id=eq.raid_shadow_legends')).find(x => x.name === "Dragon's Lair");
const enemyRows = await rest('dungeon_stage_enemies?select=stage_number,enemy_role,enemy_name,hp,atk,def,spd,res,acc,crit_rate,crit_dmg&dungeon_id=eq.' + dun.id);
const affRows = await rest('dungeon_stage_affinities?select=stage_number,affinity&dungeon_id=eq.' + dun.id);
const stageAff = Object.fromEntries(affRows.map(r => [r.stage_number, r.affinity]));
const bossRow = s => enemyRows.find(e => e.stage_number === s && e.enemy_role === 'boss');
const hasWaveRows = enemyRows.some(e => e.enemy_role !== 'boss');

function buildAlly(c) {
  const cat = byId[c.id];
  const st = c.estimated_stats ?? {};
  return makeCombatant({
    name: c.name, side: 'ally',
    maxHp: st.hp, atk: st.atk, def: st.def, spd: st.spd,
    acc: st.acc, res: st.res,
    critRate: st.crit_rate ?? st.crate, critDmg: st.crit_dmg ?? st.cdmg,
    affinity: c.affinity ?? cat?.affinity, tags: c.tags ?? [],
    skills: readSkillKit(cat?.champion_skills ?? []),
  });
}
function buildBoss(stage) {
  const r = bossRow(stage); if (!r) return null;
  const b = makeCombatant({
    name: r.enemy_name, side: 'enemy', role: 'boss',
    maxHp: Number(r.hp), atk: Number(r.atk), def: Number(r.def), spd: Number(r.spd),
    acc: Number(r.acc), res: Number(r.res),
    critRate: Number(r.crit_rate), critDmg: Number(r.crit_dmg), affinity: stageAff[stage],
    statsTrust: { hp: 'real', atk: 'SYNTHETIC', def: 'SYNTHETIC', res: 'SYNTHETIC', spd: 'unverified' },
  });
  b.immune = HELLRAZOR_IMMUNE;
  return b;
}

const runs = await rest('run_reconciliations?select=account_id,display_name,content,successful,turns,duration_seconds,team_fielded&order=battle_captured_at.desc&limit=2000');
const cases = [];
for (const r of runs) {
  const m = String(r.content ?? '').match(/^Dragon's Lair\s+Stage\s+(\d+)/i);
  if (!m || (r.successful !== true && r.successful !== false)) continue;
  const stage = +m[1];
  if (ONLY_STAGE && stage !== ONLY_STAGE) continue;
  const ro = rosters[r.account_id]; if (!ro) continue;
  let tf = r.team_fielded; if (typeof tf === 'string') { try { tf = JSON.parse(tf); } catch { tf = []; } }
  const team = (tf ?? []).map(h => ro.idx.get(h.name)).filter(Boolean);
  if (team.length < 4) continue;
  const boss = buildBoss(stage); if (!boss) continue;
  cases.push({ acct: ro.name, stage, aff: stageAff[stage], actualWon: r.successful, actualTurns: r.turns, actualSec: r.duration_seconds, team, boss });
}

console.log(`\n══ DRAGON TURN-LOOP SIM ══  ${cases.length} captured battles rebuilt\n`);
if (!hasWaveRows) console.log('  ⚠ UNMODELLED: Dragon has NO wave enemies in dungeon_stage_enemies (25 rows, all boss).');
console.log('  ⚠ UNMODELLED: purple-bar HP unknown -> Scorch damage check skipped.');
console.log('  ⚠ UNCALIBRATED: DEF_K=1500 is a NOMINAL mitigation curve (real DEF diminishing returns');
console.log('                  are an unimplemented formulas.js TODO) — the one unvalidated number');
console.log('                  in the damage path. Enemy stats themselves are transcribed, not synthetic.\n');

const rows = [];
for (const c of cases) {
  const allies = c.team.map(buildAlly);
  const content = makeDragonContent({ stageNumber: c.stage, purpleBarHp: null, waves: null, boss: c.boss });
  const state = makeState({ allies, enemies: [] });
  state.purpleBarLeft = 0;
  const TRACE = process.argv.includes('--trace') && rows.length === 0;
  if (TRACE) console.log(`\n── TRACE: ${c.acct} Dragon ${c.stage} [${c.aff}] — actual ${c.actualWon ? 'WIN' : 'LOSS'} in ${c.actualTurns}t/${c.actualSec}s ──`);
  const res = simulate(state, content, { turnCap: 400, trace: TRACE });
  if (TRACE) console.log(`── sim says: ${res.won ? 'WIN' : 'LOSS'} in ${res.turns}t (${res.reason}) ──\n`);
  rows.push({ ...c, pred: res });
  if (VERBOSE) {
    console.log(`  ${c.acct} st${c.stage} [${c.aff}] actual ${c.actualWon ? 'WIN ' : 'LOSS'} ${c.actualTurns}t`);
    console.log(`      phases: ${res.phases.map(p => `${p.name ?? p.phase}=${p.outcome}${p.turns ? ' ' + p.turns + 't' : ''}`).join(' · ')}`);
    for (const d of res.deaths) console.log(`        died t${d.turn} in ${d.phase}: ${d.who}`);
    for (const v of res.revives) console.log(`        REVIVE t${v.turn}: ${v.by} -> ${v.who}`);
  }
}

// ── scoring ──────────────────────────────────────────────────────────────────
const n = rows.length;
const correct = rows.filter(r => r.pred.won === r.actualWon).length;
const wins = rows.filter(r => r.actualWon), losses = rows.filter(r => !r.actualWon);
const tp = wins.filter(r => r.pred.won).length, tn = losses.filter(r => !r.pred.won).length;
const bal = (wins.length && losses.length) ? ((tp / wins.length) + (tn / losses.length)) / 2 : null;
const pct = v => v == null ? ' n/a' : (100 * v).toFixed(1) + '%';

console.log(`  outcome reproduced   ${correct}/${n}   accuracy ${pct(n ? correct / n : null)}`);
console.log(`  BALANCED ACCURACY    ${pct(bal)}   (battle-suite Dragon baseline: 53.0%)`);
console.log(`  win recall ${pct(wins.length ? tp / wins.length : null)}   loss recall ${pct(losses.length ? tn / losses.length : null)}`);

const withTurns = rows.filter(r => r.actualTurns && r.pred.turns);
if (withTurns.length) {
  const errs = withTurns.map(r => r.pred.turns - r.actualTurns);
  const abs = errs.map(Math.abs).sort((a, b) => a - b);
  console.log(`\n  TURN-COUNT ERROR over ${withTurns.length} battles (the continuous signal):`);
  console.log(`    median |error| ${abs[Math.floor(abs.length / 2)]} turns   ·   median actual ${withTurns.map(r => r.actualTurns).sort((a, b) => a - b)[Math.floor(withTurns.length / 2)]}t`);
  console.log(`    predicted too FAST ${errs.filter(e => e < 0).length}  ·  too SLOW ${errs.filter(e => e > 0).length}`);
}

// ── THE ACTUAL PRODUCT: where does the team break? ───────────────────────────
console.log('\n  WHERE THE TEAM BREAKS (the diagnosis, not the bit):');
const byPhase = {};
for (const r of rows) byPhase[r.pred.failedPhase ?? 'cleared everything'] = (byPhase[r.pred.failedPhase ?? 'cleared everything'] ?? 0) + 1;
for (const [p, k] of Object.entries(byPhase).sort((a, b) => b[1] - a[1])) console.log(`    ${String(k).padStart(4)}  ${p}`);

console.log('\n  WHO DIES FIRST, and in which phase (across all runs):');
const firstDeaths = {};
for (const r of rows) { const d = r.pred.deaths[0]; if (d) firstDeaths[`${d.who} (${d.phase})`] = (firstDeaths[`${d.who} (${d.phase})`] ?? 0) + 1; }
for (const [w, k] of Object.entries(firstDeaths).sort((a, b) => b[1] - a[1]).slice(0, 10)) console.log(`    ${String(k).padStart(4)}x  ${w}`);

const allFlags = {};
for (const r of rows) for (const f of r.pred.flags) allFlags[f] = (allFlags[f] ?? 0) + 1;
console.log('\n  FLAGS RAISED (what the sim could not model, by frequency):');
for (const [f, k] of Object.entries(allFlags).sort((a, b) => b[1] - a[1]).slice(0, 15)) console.log(`    ${String(k).padStart(4)}x  ${f}`);
console.log('');
