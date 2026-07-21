// tools/battle-suite.mjs — THE REGRESSION SUITE. Every captured battle is a test case.
//
// WHY THIS EXISTS (Mike, 2026-07-21): "if we were trying to recreate Raid, how would we test our
// results?" That reframe is the right one. This is not a recommendation heuristic — it is a partial
// REIMPLEMENTATION of Raid's combat model, and a reimplementation is tested by replaying known
// inputs and checking it reproduces the known output. We had 837 such cases and no test suite: the
// reconciler produced aggregates a human eyeballed, so a change could be called an improvement
// without anyone counting whether it reproduced more battles than before.
//
// THE TEST. For each captured battle we know: the exact five champions FIELDED, the stage, and what
// actually happened. So: rebuild that team, evaluate it against that stage's real enemy magnitude,
// and ask a binary question — did we predict the observed outcome? Pass or fail. No correlation
// coefficients, no medians, no interpretation.
//
// ⚠ THE BASELINE IS THE POINT. 82% of captured battles are WINS, so "always predict a win" scores
// 82% while knowing nothing. A suite that reports only accuracy would have made every model this
// session look excellent. Every run therefore prints the majority-class baseline alongside, and the
// number that matters is BALANCED accuracy (mean of win-recall and loss-recall), which a constant
// predictor cannot game — it scores exactly 50%.
//
// ASYMMETRY ALSO MATTERS. Predicting a win that LOST (a false clear) sends a player into a wall and
// wastes their energy; predicting a loss that WON (a false wall) just under-sells them. Both are
// reported separately; they are not equally bad.
//
// Run:  node --env-file=.env.local tools/battle-suite.mjs [--by-dungeon] [--failures]

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildUserChampions, fetchAliasRows } from '../lib/gestal-context.js';
import { mapRoster, STAGE_EHP_MULTIPLIER } from '../lib/match-engine.js';
import { computeContributions } from '../lib/contribution-model.js';
import { buildRosterIndex, loadNameResolverRest } from '../lib/champion-names.js';
import { maxHpCapFor } from '../lib/damage-mechanics.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname, '..');
const BY_DUNGEON = process.argv.includes('--by-dungeon');
const SHOW_FAILS = process.argv.includes('--failures');

const BASE = (process.env.SUPABASE_URL || '').replace(/\/rest\/v1\/?$/, '');
const H = { apikey: process.env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}` };
const rest = async p => (await fetch(`${BASE}/rest/v1/${p}`, { headers: H })).json();

// ── catalog + registries ─────────────────────────────────────────────────────
const SEL = 'id,name,type_id,rarity,role,affinity,faction,base_hp,base_atk,base_def,base_spd,base_acc,base_res,base_crit_rate,base_crit_dmg,'
  + 'champion_tags(tag_id,status,tags(name,is_debuff,bypasses_accuracy_check)),'
  + 'champion_skills(slot,skill_name,skill_summary,maxhp_effect_kind,maxhp_pct,maxhp_pct_boss,maxhp_pct_cap)';
let db = [];
for (let f = 0; ; f += 1000) {
  const d = await rest(`champions?select=${encodeURIComponent(SEL)}&game_id=eq.raid_shadow_legends&limit=1000&offset=${f}`);
  if (!Array.isArray(d) || !d.length) break; db = db.concat(d); if (d.length < 1000) break;
}
const aliasRows    = await fetchAliasRows(rest);
const nameResolver = await loadNameResolverRest(rest);

// ── real per-stage enemy magnitude ───────────────────────────────────────────
const dungeons   = await rest('dungeons?select=id,name&game_id=eq.raid_shadow_legends');
const dungeonById = Object.fromEntries(dungeons.map(d => [d.id, d.name]));
const enemies    = await rest('dungeon_stage_enemies?select=dungeon_id,stage_number,enemy_role,hp,atk');
const bossAt = {};
for (const e of enemies) if (e.enemy_role === 'boss') bossAt[`${dungeonById[e.dungeon_id]}|${e.stage_number}`] = { hp: Number(e.hp), atk: Number(e.atk) };

// ── rosters ──────────────────────────────────────────────────────────────────
const rosterByAccount = {};
for (const f of fs.readdirSync(path.join(REPO, 'gestal-sync/output')).filter(x => x.endsWith('.json') && !/^gear-corpus/.test(x))) {
  const snap = JSON.parse(fs.readFileSync(path.join(REPO, 'gestal-sync/output', f), 'utf8'));
  if (!snap.accountId) continue;
  const { userChampions } = buildUserChampions(snap.champions ?? [], db, aliasRows);
  rosterByAccount[snap.accountId] = buildRosterIndex(mapRoster(userChampions, {}).mapped, nameResolver);
}

// ── the cases ────────────────────────────────────────────────────────────────
const runs = await rest('run_reconciliations?select=account_id,display_name,content,successful,duration_seconds,turns,team_fielded&order=battle_captured_at.desc&limit=2000');

/** THE MODEL UNDER TEST. Given the fielded five and the stage, predict WIN or LOSS. */
function predict(team, dungeon, stage) {
  const boss = bossAt[`${dungeon}|${stage}`];
  if (!boss) return null;
  const mult = STAGE_EHP_MULTIPLIER[dungeon] ?? 2.0;
  const contribTeam = team.map(c => ({
    name: c.name, tags: c.tags, has_boss_mastery: c.has_boss_mastery,
    atk: c.estimated_stats?.atk, spd: c.estimated_stats?.spd, hp: c.estimated_stats?.hp,
    crit_rate: c.estimated_stats?.crit_rate ?? c.estimated_stats?.crate,
    crit_dmg:  c.estimated_stats?.crit_dmg  ?? c.estimated_stats?.cdmg,
    damage_multiplier_score: c.damage_multiplier_score,
    maxhp_damage: c.maxhp_damage ?? null,
  }));
  const r = computeContributions(contribTeam, {
    bossHp: boss.hp * mult,
    incomingDamagePerTurn: null,          // survival side still unmodelled — see INS-0016
    maxHpCap: maxHpCapFor({ stageNumber: stage }),
  });
  return { predWin: r.confidence >= 0.5, confidence: r.confidence, killTurns: r.killTurns };
}

const cases = [], skipped = { no_outcome: 0, no_stage: 0, no_boss: 0, no_roster: 0, partial_team: 0 };
for (const r of runs) {
  if (r.successful !== true && r.successful !== false) { skipped.no_outcome++; continue; }
  const m = String(r.content ?? '').match(/^(.*?)\s+Stage\s+(\d+)/i);
  if (!m) { skipped.no_stage++; continue; }
  const [, dungeon, sN] = m, stage = +sN;
  if (!bossAt[`${dungeon}|${stage}`]) { skipped.no_boss++; continue; }
  const roster = rosterByAccount[r.account_id];
  if (!roster) { skipped.no_roster++; continue; }
  let tf = r.team_fielded; if (typeof tf === 'string') { try { tf = JSON.parse(tf); } catch { tf = []; } }
  const team = (tf ?? []).map(h => roster.get(h.name)).filter(Boolean);
  if (team.length < 3) { skipped.partial_team++; continue; }   // a partial rebuild is not a fair test
  const p = predict(team, dungeon, stage);
  if (!p) { skipped.no_boss++; continue; }
  cases.push({ acct: r.display_name ?? r.account_id, dungeon, stage, actualWin: r.successful,
               ...p, dur: r.duration_seconds, turns: r.turns });
}

// ── score ────────────────────────────────────────────────────────────────────
const score = (rows) => {
  const n = rows.length;
  const wins = rows.filter(r => r.actualWin), losses = rows.filter(r => !r.actualWin);
  const tp = wins.filter(r => r.predWin).length;            // won,  predicted win
  const fn = wins.length - tp;                              // won,  predicted loss  → false wall
  const tn = losses.filter(r => !r.predWin).length;         // lost, predicted loss
  const fp = losses.length - tn;                            // lost, predicted win   → FALSE CLEAR
  const acc = n ? (tp + tn) / n : 0;
  const winRecall  = wins.length ? tp / wins.length : null;
  const lossRecall = losses.length ? tn / losses.length : null;
  const balanced = (winRecall != null && lossRecall != null) ? (winRecall + lossRecall) / 2 : null;
  const majority = n ? Math.max(wins.length, losses.length) / n : 0;
  return { n, pass: tp + tn, acc, balanced, majority, tp, fp, tn, fn, wins: wins.length, losses: losses.length };
};

const pct = v => v == null ? '  n/a' : (100 * v).toFixed(1).padStart(5) + '%';
const s = score(cases);

console.log(`\n══ BATTLE SUITE ══  ${s.pass}/${s.n} battles reproduced`);
console.log(`   skipped: ${Object.entries(skipped).map(([k, v]) => `${k} ${v}`).join(', ')}`);
console.log(`\n   accuracy            ${pct(s.acc)}   <- flattered by class imbalance, do not track this`);
console.log(`   majority baseline   ${pct(s.majority)}   <- "always predict the common class", knows nothing`);
console.log(`   BALANCED ACCURACY   ${pct(s.balanced)}   <- THE NUMBER. a constant predictor scores 50.0%`);
console.log(`\n   won,  predicted win   ${String(s.tp).padStart(4)}   (win recall  ${pct(s.wins ? s.tp / s.wins : null)})`);
console.log(`   won,  predicted LOSS  ${String(s.fn).padStart(4)}   false wall  — under-sells the player`);
console.log(`   lost, predicted loss  ${String(s.tn).padStart(4)}   (loss recall ${pct(s.losses ? s.tn / s.losses : null)})`);
console.log(`   lost, predicted WIN   ${String(s.fp).padStart(4)}   FALSE CLEAR — sends them into a wall`);

if (BY_DUNGEON) {
  console.log('\n   dungeon                  n   balanced   false-clears');
  const by = {}; for (const c of cases) (by[c.dungeon] ??= []).push(c);
  for (const [d, rows] of Object.entries(by).sort()) {
    const x = score(rows);
    console.log('   ' + d.padEnd(22) + String(x.n).padStart(4) + '   ' + pct(x.balanced) + '   ' + String(x.fp).padStart(6));
  }
}
if (SHOW_FAILS) {
  console.log('\n   FALSE CLEARS (predicted a win, actually lost) — the dangerous failures:');
  for (const c of cases.filter(c => !c.actualWin && c.predWin).slice(0, 20))
    console.log(`     ${c.acct.padEnd(12)} ${c.dungeon} ${c.stage}  conf ${(100 * c.confidence).toFixed(0)}%  killTurns ${Math.round(c.killTurns)}  (actual: LOST in ${c.turns}t/${c.dur}s)`);
}
console.log('');
