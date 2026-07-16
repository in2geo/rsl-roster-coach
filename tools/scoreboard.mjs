// tools/scoreboard.mjs — the EVALUATOR SCOREBOARD (the Deep Blue test).
// Grades the power-model evaluator's verdict against every captured battle: for each real run,
// did the evaluator's judgment (clears / doesn't) match what actually happened? Produces a
// confusion matrix overall + per content, and surfaces the SYSTEMATIC misses — which tell us,
// measurably, which mechanic term to build next (heal, adds, survival) instead of guessing.
//
// Two predictors are scored side by side ON PURPOSE:
//   KILL-ONLY  = ttk <= budget                    (the calibrated, load-bearing half)
//   TWO-SIDED  = ttk <= budget AND tsv >= ttk      (adds the survival half — expected WORSE,
//                                                    because survival is structurally broken, INS-0018)
// Comparing them shows whether survival currently HELPS or HURTS prediction.
//
// A change to the evaluator is only kept if it raises accuracy HERE. This is the guardrail against
// the over-fitting / single-anchor mistakes made all session. Run: node tools/scoreboard.mjs
import fs from 'fs';
import * as pm from '../lib/power-model.js';

const env = {};
for (const l of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, ''); }
const BASE = (env.SUPABASE_URL || '').replace(/\/rest\/v1\/?$/, '');
const H = { apikey: env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}` };
const rest = async (p) => (await fetch(`${BASE}/rest/v1/${p}`, { headers: H })).json();

// champ data: affinity, DoT tags, damage multiplier, DoT uptime (same prep the calibrators use).
const champs = await rest('champions?select=id,name,affinity,champion_tags(status,tags(name))&game_id=eq.raid_shadow_legends');
const nameById = Object.fromEntries(champs.map(c => [c.id, c.name]));
// ALL approved tags (champDotPerTurn filters to DoT internally; waveDefenseOK needs Block Debuffs/AoE/CC).
const tagsByName = {}; for (const c of champs) tagsByName[c.name] = (c.champion_tags ?? []).filter(ct => ct.status === 'approved').map(ct => ct.tags?.name).filter(Boolean);
const affByName = {}; for (const c of champs) if (c.affinity) affByName[c.name.toLowerCase()] = c.affinity;
const aliasRows = await rest('champion_aliases?select=alias,champions(affinity)');
for (const a of aliasRows) if (a.alias && a.champions?.affinity) affByName[a.alias.toLowerCase()] ??= a.champions.affinity;
const affOf = (n) => affByName[n?.toLowerCase()] ?? null;
const skills = await rest('champion_skills?select=champion_id,damage_multiplier&damage_multiplier=not.is.null');
const multByName = {}; for (const s of skills) { const nums = (String(s.damage_multiplier).match(/[0-9]+\.?[0-9]*/g) || []).map(Number); const mx = nums.length ? Math.max(...nums) : 0; const nm = nameById[s.champion_id]; if (nm && mx > (multByName[nm] || 0)) multByName[nm] = mx; }
const allSk = await rest('champion_skills?select=champion_id,slot,cooldown_base,skill_summary');
const skByCh = {}; for (const s of allSk) (skByCh[s.champion_id] ??= []).push(s);
const uptimeByName = {}; for (const c of champs) uptimeByName[c.name] = pm.dotUptimeFromSkills(skByCh[c.id] ?? []);

// enemies + affinity per (dungeon, stage)
const DUNGEONS = { "Spider's Den": 'spider', "Ice Golem's Peak": 'ice_golem', "Dragon's Lair": 'dragon', "Fire Knight's Castle": 'fire_knight' };
const enemiesBy = {}, affByStage = {};
for (const [name, key] of Object.entries(DUNGEONS)) {
  const d = await rest(`dungeons?select=id&game_id=eq.raid_shadow_legends&name=eq.${encodeURIComponent(name)}`);
  if (!d[0]) continue;
  const en = await rest(`dungeon_stage_enemies?select=stage_number,enemy_role,hp,def,res,atk,crit_rate,crit_dmg&dungeon_id=eq.${d[0].id}`);
  for (const r of en) (enemiesBy[`${key}|${r.stage_number}`] ??= []).push(r);
  const af = await rest(`dungeon_stage_affinities?select=stage_number,affinity&dungeon_id=eq.${d[0].id}`);
  for (const r of af) affByStage[`${key}|${r.stage_number}`] = r.affinity;
}
const keyOf = (content) => { const n = Object.keys(DUNGEONS).find(x => content?.startsWith(x)); return n ? DUNGEONS[n] : null; };

// build each capture point with ttk + tsv
const runs = await rest('run_reconciliations?select=content,actual_floor,successful,turns,team_fielded,frozen_effective_stats');
const pts = [];
for (const r of runs) {
  if (/Hard/i.test(r.content || '')) continue;
  const key = keyOf(r.content); if (!key) continue;
  const en = enemiesBy[`${key}|${r.actual_floor}`]; if (!en) continue;
  const st = Object.fromEntries((r.frozen_effective_stats || []).map(c => [c.name, c.effective_stats]));
  const team = (r.team_fielded || []).map(c => ({ name: c.name, estimated_stats: st[c.name], damage_multiplier: multByName[c.name] ?? null, tags: tagsByName[c.name] ?? [], affinity: affOf(c.name), dot_uptime: uptimeByName[c.name] ?? 1 })).filter(c => c.estimated_stats);
  if (team.length < 2) continue;
  const boss = en.find(e => e.enemy_role === 'boss') ?? en[0];
  const ttk = pm.turnsToKill(team, boss, affByStage[`${key}|${r.actual_floor}`] ?? null);
  const tsv = pm.turnsSurvived(team, en);
  if (!isFinite(ttk)) continue;
  pts.push({ key, stage: r.actual_floor, win: !!r.successful, ttk, tsv, team });
}

// fit the kill BUDGET = ttk threshold that maximizes kill-only accuracy.
const cand = [...new Set(pts.map(p => Math.round(p.ttk)))].sort((a, b) => a - b);
let BUDGET = null, bestAcc = -1;
for (const B of cand) { let ok = 0; for (const p of pts) if ((p.ttk <= B) === p.win) ok++; if (ok > bestAcc) { bestAcc = ok; BUDGET = B; } }

// score a predictor → confusion, overall + by content
function score(predClear) {
  const conf = { TP: 0, TN: 0, FP: 0, FN: 0 };
  const byContent = {};
  for (const p of pts) {
    const pred = predClear(p);
    const cell = p.win ? (pred ? 'TP' : 'FN') : (pred ? 'FP' : 'TN');
    conf[cell]++;
    (byContent[p.key] ??= { TP: 0, TN: 0, FP: 0, FN: 0 })[cell]++;
  }
  return { conf, byContent };
}
const acc = (c) => ((c.TP + c.TN) / ((c.TP + c.TN + c.FP + c.FN) || 1) * 100).toFixed(0);
const fmt = (c) => `acc ${acc(c)}%  [TP ${c.TP} TN ${c.TN} FP ${c.FP} FN ${c.FN}]  overpredict(FP) ${c.FP}  underpredict(FN) ${c.FN}`;

console.log(`EVALUATOR SCOREBOARD — ${pts.length} captured battles (${pts.filter(p => p.win).length} wins, ${pts.filter(p => !p.win).length} losses)`);
console.log(`Fitted kill budget = ${BUDGET} turns (best-separating).\n`);

for (const [label, pred] of [
  ['KILL-ONLY  (ttk <= budget)', p => p.ttk <= BUDGET],
  ['KILL + WAVE-DEFENSE  (ttk<=budget AND wave-defense OK)', p => p.ttk <= BUDGET && pm.waveDefenseOK(p.team, p.key)],
  ['TWO-SIDED  (ttk<=budget AND tsv>=ttk)', p => p.ttk <= BUDGET && p.tsv >= p.ttk],
]) {
  const { conf, byContent } = score(pred);
  console.log(`${label}`);
  console.log(`  OVERALL  ${fmt(conf)}`);
  for (const key of ['spider', 'ice_golem', 'dragon', 'fire_knight']) if (byContent[key]) console.log(`    ${key.padEnd(11)} ${fmt(byContent[key])}`);
  console.log('');
}

// Systematic errors: the direction of each content's misses = the term to build.
console.log('SYSTEMATIC ERRORS (kill-only) — the direction tells us the missing term:');
const { byContent } = score(p => p.ttk <= BUDGET);
for (const key of ['spider', 'ice_golem', 'dragon', 'fire_knight']) {
  const c = byContent[key]; if (!c) continue;
  const note = c.FP > c.FN ? `OVER-predicts (${c.FP} losses called clear) → missing a WALL term (heal/adds/survival)`
    : c.FN > c.FP ? `UNDER-predicts (${c.FN} wins called fail) → too conservative here`
    : 'balanced';
  console.log(`  ${key.padEnd(11)} ${note}`);
}
console.log('\nWorst over-predictions (losses the evaluator called clear — where the wall term is missing):');
for (const p of pts.filter(p => !p.win && p.ttk <= BUDGET).sort((a, b) => a.ttk - b.ttk).slice(0, 8))
  console.log(`  ${p.key.padEnd(11)} stage ${String(p.stage).padStart(2)}  ttk ${Math.round(p.ttk)} (<=${BUDGET}) but LOST`);
process.exit(0);
