// tools/shadow-grade.mjs — GRADE THE MODEL, not the team. SHADOW. Read-only, no DB writes.
//
// THE PROBLEM THIS EXISTS TO FIX (see the 2026-07-18 handoff): five team selectors have been built
// across four days and NOT ONE has ever been graded against a captured battle. `run_reconciliations`
// records the LIVE engine's prediction, so every shadow model ends at "eyeball the terminal output"
// and goes on the pile. Sessions feel like they go in circles because the loop is real but the new
// models are not plugged into it.
//
// THE TEST — RANKING, not prediction. A model that cannot predict absolute damage can still be
// judged: given teams the player ACTUALLY FIELDED, whose outcomes we captured, does the model ORDER
// them correctly? That is calibration-free (no damage model, no thresholds) and answers the only
// question that matters for selection: would following this model have picked the better team?
//
// SCOPE BY ACCOUNT **AND DIFFICULTY** — the standing rule plus one more: chest thresholds differ per
// difficulty, so 13.2M at Nightmare and 23.5M at Brutal are not comparable. Compare within a group.
//
// Metric: pairwise agreement (a rank-correlation that is readable at tiny n). For every pair of teams
// in a group, did the model put them in the same order as reality? Reported as agreed/total.
//
// Run: node --env-file=.env.local tools/shadow-grade.mjs

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildUserChampions } from '../lib/gestal-context.js';
import { mapRoster } from '../lib/match-engine.js';
import { scoreTeam } from './bucket-score.mjs';
import * as cb from '../lib/clan-boss.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname, '..');
const BASE = (process.env.SUPABASE_URL || '').replace(/\/rest\/v1\/?$/, '');
const H = { apikey: process.env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}` };
const rest = async p => (await fetch(`${BASE}/rest/v1/${p}`, { headers: H })).json();

const SEL = 'id,name,type_id,rarity,role,affinity,faction,base_hp,base_atk,base_def,base_spd,base_acc,base_res,base_crit_rate,base_crit_dmg,champion_tags(tag_id,status,tags(name,is_debuff,bypasses_accuracy_check))';
let db = [];
for (let f = 0; ; f += 1000) { const d = await rest(`champions?select=${encodeURIComponent(SEL)}&game_id=eq.raid_shadow_legends&limit=1000&offset=${f}`); if (!Array.isArray(d) || !d.length) break; db = db.concat(d); if (d.length < 1000) break; }
let skRows = [];
for (let f = 0; ; f += 1000) { const d = await rest(`champion_skills?select=slot,skill_summary,cooldown_base,cooldown_booked,champions(name)&limit=1000&offset=${f}`); if (!Array.isArray(d) || !d.length) break; skRows = skRows.concat(d); if (d.length < 1000) break; }
const skillsByName = {};
for (const r of skRows) { const n = r.champions?.name; if (n) (skillsByName[n] ??= []).push(r); }
const tagRows = await rest('tags?select=name,is_debuff,bypasses_accuracy_check');
const tagMeta = Object.fromEntries((tagRows || []).map(t => [t.name, { is_debuff: t.is_debuff, bypasses_accuracy_check: t.bypasses_accuracy_check }]));

// Rosters per account (for champion state at selection time).
const rosterByAccount = {};
for (const f of fs.readdirSync(path.join(REPO, 'gestal-sync/output')).filter(x => x.endsWith('.json') && !/^gear-corpus/.test(x))) {
  const snap = JSON.parse(fs.readFileSync(path.join(REPO, 'gestal-sync/output', f), 'utf8'));
  if (!snap.accountId) continue;
  const { userChampions } = buildUserChampions(snap.champions ?? [], db);
  rosterByAccount[snap.accountId] = Object.fromEntries(mapRoster(userChampions, {}).mapped.map(c => [c.name, c]));
}

// Captured CB battles with real damage and a full 5-hero read.
const log = JSON.parse(fs.readFileSync(path.join(REPO, 'gestal-sync/RslBattleReader/output/battle-log.json'), 'utf8'));
const arr = Array.isArray(log) ? log : (log.battles ?? log.entries ?? []);
const runs = [];
for (const b of arr) {
  if (!cb.isClanBoss?.(b)) continue;
  const heroes = b.heroes ?? [];
  if (heroes.length < 5) continue;                       // dropped-hero read — never grade it
  const total = b.totalDamageDealt ?? (heroes.reduce((s, h) => s + (Number(h.damage) || 0), 0) || null);
  if (total == null) continue;                           // quick battle — no result dialog, not gradeable
  const diff = cb.classifyClanBoss?.(b)?.difficulty;
  if (!diff) continue;
  runs.push({ acct: b.displayName, accountId: b.accountId, diff, total, turns: b.turns,
              names: heroes.map(h => h.name), at: b.capturedAt });
}

// Group by account + difficulty (thresholds differ per difficulty — cross-difficulty is meaningless).
const groups = {};
for (const r of runs) (groups[`${r.acct} · ${r.diff}`] ??= []).push(r);

console.log('══ SHADOW GRADE — does the POOL model RANK real teams correctly? ══');
console.log('   (pairwise agreement within account+difficulty; ties in reality are skipped)\n');

let agreeAll = 0, totalAll = 0;
for (const [key, rs] of Object.entries(groups)) {
  if (rs.length < 2) continue;                            // need a pair to rank
  const roster = rosterByAccount[rs[0].accountId];
  if (!roster) { console.log(`── ${key}: no roster snapshot, skipped`); continue; }
  const scored = [];
  for (const r of rs) {
    const team = r.names.map(n => roster[n]).filter(Boolean);
    if (team.length < 5) continue;                        // a hero we cannot map — don't guess
    scored.push({ ...r, grade: scoreTeam(team, tagMeta, skillsByName).grade });
  }
  if (scored.length < 2) { console.log(`── ${key}: <2 mappable teams, skipped`); continue; }
  console.log(`── ${key}`);
  for (const s of [...scored].sort((a, b) => b.total - a.total))
    console.log(`     ${s.at?.slice(0, 16)}  actual ${(s.total / 1e6).toFixed(2).padStart(6)}M  model ${s.grade.toFixed(1).padStart(6)}  [${s.names.join(', ')}]`);
  let agree = 0, tot = 0;
  for (let i = 0; i < scored.length; i++) for (let j = i + 1; j < scored.length; j++) {
    const a = scored[i], b = scored[j];
    if (a.total === b.total) continue;
    tot++;
    const realBetter = a.total > b.total ? a : b;
    const modelBetter = a.grade > b.grade ? a : b;
    if (realBetter === modelBetter) agree++;
  }
  agreeAll += agree; totalAll += tot;
  console.log(`     → pairwise agreement ${agree}/${tot}\n`);
}
console.log(`══ OVERALL: ${agreeAll}/${totalAll} pairs ranked correctly` +
  (totalAll ? ` (${((agreeAll / totalAll) * 100).toFixed(0)}%)` : '') +
  ` — 50% is a coin flip, so anything near that means the model is not adding signal.`);
