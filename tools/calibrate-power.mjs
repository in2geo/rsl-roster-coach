// tools/calibrate-power.mjs — calibrate the power model's ABSOLUTE damage scale against
// real captured battles (run_reconciliations). For each captured WIN on a dungeon we have
// enemy stats for, the model's team damage-per-turn should predict bossHP / actual_turns.
// The ratio (implied real DPT / model DPT) is the global damage SCALE that puts turnsToKill
// into REAL turns. Reports the scale distribution + the calibrated turns-vs-actual fit.
//
// Run: node tools/calibrate-power.mjs
import fs from 'fs';
import * as pm from '../lib/power-model.js';

const env = {};
for (const l of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, ''); }
const BASE = (env.SUPABASE_URL || '').replace(/\/rest\/v1\/?$/, '');
const H = { apikey: env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}` };
const rest = async (p) => (await fetch(`${BASE}/rest/v1/${p}`, { headers: H })).json();

// champion name -> best damage multiplier, and name -> DoT tags (Poison/HP Burn/Enemy Max HP).
const skills = await rest('champion_skills?select=champion_id,damage_multiplier&damage_multiplier=not.is.null');
const champs = await rest('champions?select=id,name,affinity,champion_tags(status,tags(name))&game_id=eq.raid_shadow_legends');
const nameById = Object.fromEntries(champs.map(c => [c.id, c.name]));
// champ name -> affinity (for the affinity-adjusted kill model). Include aliases so captured
// team names that differ from champions.name still resolve (INS-0018 affinity-in-ttk fix).
const affByName = {};
for (const c of champs) if (c.affinity) affByName[c.name.toLowerCase()] = c.affinity;
const aliasRows = await rest('champion_aliases?select=alias,champions(affinity)');
for (const a of aliasRows) if (a.alias && a.champions?.affinity) affByName[a.alias.toLowerCase()] ??= a.champions.affinity;
const affOf = (name) => affByName[name?.toLowerCase()] ?? null;
const DOT_TAGS = new Set(['Poison', 'HP Burn', 'Enemy Max HP Damage']);
const tagsByName = {};
for (const c of champs) {
  tagsByName[c.name] = (c.champion_tags ?? [])
    .filter(ct => ct.status === 'approved' && DOT_TAGS.has(ct.tags?.name))
    .map(ct => ct.tags.name);
}
const multByName = {};
for (const s of skills) {
  const nums = (String(s.damage_multiplier).match(/[0-9]+\.?[0-9]*/g) || []).map(Number);
  const mx = nums.length ? Math.max(...nums) : 0;
  const nm = nameById[s.champion_id]; if (!nm) continue;
  if (mx > (multByName[nm] || 0)) multByName[nm] = mx;
}
// per-champ DoT uptime (cooldown/duration of poison/HP-burn placers) → deflates on-cooldown placers.
const allSkills = await rest('champion_skills?select=champion_id,slot,cooldown_base,skill_summary');
const skillsByChamp = {};
for (const s of allSkills) (skillsByChamp[s.champion_id] ??= []).push(s);
const dotUptimeByName = {};
for (const c of champs) dotUptimeByName[c.name] = pm.dotUptimeFromSkills(skillsByChamp[c.id] ?? []);

// boss HP/DEF per (dungeon, stage)
const DUNGEONS = { "Spider's Den": null, "Ice Golem's Peak": null, "Dragon's Lair": null, "Fire Knight's Castle": null };
for (const n of Object.keys(DUNGEONS)) { const d = await rest(`dungeons?select=id&game_id=eq.raid_shadow_legends&name=eq.${encodeURIComponent(n)}`); DUNGEONS[n] = d[0]?.id; }
const bossBy = {}; // "dungeon|stage" -> boss row
const affBy = {};  // "dungeon|stage" -> boss affinity (for weak/strong hit factors)
for (const [n, id] of Object.entries(DUNGEONS)) {
  if (!id) continue;
  const rows = await rest(`dungeon_stage_enemies?select=stage_number,enemy_role,hp,def,res&dungeon_id=eq.${id}&enemy_role=eq.boss`);
  for (const r of rows) bossBy[`${n}|${r.stage_number}`] = r;
  const aff = await rest(`dungeon_stage_affinities?select=stage_number,affinity&dungeon_id=eq.${id}`);
  for (const r of aff) affBy[`${n}|${r.stage_number}`] = r.affinity;
}

// captured wins on Normal dungeons with turns. Fielded champs come from team_fielded (names);
// their REAL stats come from frozen_effective_stats (the roster snapshot at battle time).
const runs = await rest('run_reconciliations?select=content,actual_floor,successful,turns,team_fielded,frozen_effective_stats&successful=eq.true');
const parseDungeon = (content) => Object.keys(DUNGEONS).find(n => content?.startsWith(n));

const points = [];
for (const r of runs) {
  if (/Hard/i.test(r.content || '')) continue;               // enemy data is Normal
  const dn = parseDungeon(r.content); if (!dn) continue;
  const boss = bossBy[`${dn}|${r.actual_floor}`]; if (!boss) continue;
  if (!r.turns || !Array.isArray(r.team_fielded) || !Array.isArray(r.frozen_effective_stats)) continue;
  const statsByName = Object.fromEntries(r.frozen_effective_stats.map(c => [c.name, c.effective_stats]));
  const team = r.team_fielded
    .map(c => ({ name: c.name, estimated_stats: statsByName[c.name], damage_multiplier: multByName[c.name] ?? null, tags: tagsByName[c.name] ?? [], affinity: affOf(c.name), dot_uptime: dotUptimeByName[c.name] ?? 1 }))
    .filter(c => c.estimated_stats);                          // must have real stats to score
  if (team.length < 2) continue;
  const stageAffinity = affBy[`${dn}|${r.actual_floor}`] ?? null;
  const dptModel = pm.teamDamagePerTurn(team, boss, stageAffinity);
  if (!(dptModel > 0)) continue;
  const impliedDpt = boss.hp / r.turns;                      // real damage/turn implied by the clear
  points.push({ content: r.content, stage: r.actual_floor, turns: r.turns, dptModel, impliedDpt, scale: impliedDpt / dptModel });
}

points.sort((a, b) => a.scale - b.scale);
const scales = points.map(p => p.scale);
const median = scales.length ? scales[Math.floor(scales.length / 2)] : null;
const mean = scales.reduce((s, x) => s + x, 0) / (scales.length || 1);

console.log(`Calibration points: ${points.length} captured dungeon wins\n`);
console.log('content                         stage turns  modelDPT  impliedDPT  scale');
for (const p of points) console.log(
  (p.content || '').slice(0, 30).padEnd(31),
  String(p.stage).padStart(3), String(p.turns).padStart(5),
  String(Math.round(p.dptModel)).padStart(9), String(Math.round(p.impliedDpt)).padStart(10),
  p.scale.toFixed(2).padStart(7));
console.log(`\nDAMAGE SCALE (raw)  median ${median?.toFixed(2)}  mean ${mean.toFixed(2)}  min ${scales[0]?.toFixed(2)}  max ${scales[scales.length-1]?.toFixed(2)}`);

// PRUNE OVERPOWER anchors. A stage cleared FAR below the team's ceiling has huge headroom, so its
// implied DPT (bossHP / turns) is a FLOOR on real DPT, not a measurement — it shows up as an
// extreme-HIGH scale (killed way faster than the model) and doesn't constrain the calibration; it
// only inflates the spread. Trim to scales within [median/K, median*K] and re-fit. (These are the
// trivial low-stage overkills, e.g. Spider 4/6 cleared in 8-13 turns — NOT wall anchors.)
const OVER_K = 3;
const kept   = points.filter(p => p.scale >= median / OVER_K && p.scale <= median * OVER_K);
const pruned = points.filter(p => p.scale < median / OVER_K || p.scale > median * OVER_K);
const keptScales = kept.map(p => p.scale).sort((a, b) => a - b);
const medTrim = keptScales.length ? keptScales[Math.floor(keptScales.length / 2)] : median;
function bossHpFor(p) { const dn = parseDungeon(p.content); return bossBy[`${dn}|${p.stage}`].hp; }
const predOf = (p, scale) => (p.dptModel * scale > 0 ? bossHpFor(p) / (p.dptModel * scale) : Infinity);
const fitErr = (pts, scale) => pts.reduce((s, p) => s + Math.abs(predOf(p, scale) - p.turns), 0) / (pts.length || 1);
// relative error is the fair metric when turns span 8-245: |pred-actual| / actual.
const fitRel = (pts, scale) => pts.reduce((s, p) => s + Math.abs(predOf(p, scale) - p.turns) / p.turns, 0) / (pts.length || 1);

console.log(`\nPruned ${pruned.length} overpower/anomalous anchor(s) (scale outside [${(median/OVER_K).toFixed(2)}, ${(median*OVER_K).toFixed(2)}]):`);
for (const p of pruned.sort((a, b) => b.scale - a.scale).slice(0, 8))
  console.log(`  ${(p.content||'').slice(0,28).padEnd(29)} stage ${String(p.stage).padStart(3)} turns ${String(p.turns).padStart(4)}  scale ${p.scale.toFixed(2)}`);
console.log(`\nDAMAGE SCALE (trimmed, n=${kept.length})  median ${medTrim.toFixed(2)}  => set DAMAGE_SCALE = ${(0.30 * medTrim).toFixed(2)} to re-center`);
console.log(`Fit |pred-actual| turns:  raw(all ${points.length}) = ${fitErr(points, median).toFixed(1)}   trimmed(kept ${kept.length}) = ${fitErr(kept, medTrim).toFixed(1)}`);
console.log(`Fit RELATIVE |pred-actual|/actual:  raw = ${(100*fitRel(points, median)).toFixed(0)}%   trimmed = ${(100*fitRel(kept, medTrim)).toFixed(0)}%   (fair metric across the 8-245 turn span)`);
process.exit(0);
