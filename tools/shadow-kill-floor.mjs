// tools/shadow-kill-floor.mjs — SHADOW the calibrated KILL-side power model as a stage FLOOR,
// vs the live OLD engine, measured against REALITY. Changes nothing player-facing (read-only).
//
// The claim to test (POWER_LAYER_SCOPE step 3): the old engine UNDER-recommends because it gates on
// coverage + placeholder floors (DonBrogni Spider → Stage 5, team farms 13). The kill model, used as
// a FLOOR = highest stage where turnsToKill ≤ budget, should fix that WITHOUT over-recommending
// (never floor a stage the team actually LOST). Kill side only — survival stays unwired (INS-0018).
//
// For each dungeon:
//   OLD   = live matchRoster() recommended stage (the current engine).
//   NEW   = kill floor: highest stage S with turnsToKill(fielded team, boss@S, affinity@S) ≤ BUDGET.
//   REAL  = from captures: highest floor this roster WON, lowest floor it LOST.
//   Budget = fitted from all captures (the ttk threshold that best separates wins from losses).
//
// Run: node tools/shadow-kill-floor.mjs   [--old]  (add --old to also run the live old engine)
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import * as pm from '../lib/power-model.js';

const RUN_OLD = process.argv.includes('--old');
const env = {};
for (const l of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, ''); }
const BASE = (env.SUPABASE_URL || '').replace(/\/rest\/v1\/?$/, '');
const H = { apikey: env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}` };
const rest = async (p) => (await fetch(`${BASE}/rest/v1/${p}`, { headers: H })).json();
process.env.SUPABASE_URL = env.SUPABASE_URL; process.env.SUPABASE_ANON_KEY = env.SUPABASE_ANON_KEY; process.env.SUPABASE_SERVICE_KEY = env.SUPABASE_SERVICE_KEY;

// ── champ data: affinity, DoT tags, damage multiplier, DoT uptime ─────────────────────────────
const champs = await rest('champions?select=id,name,affinity,champion_tags(status,tags(name))&game_id=eq.raid_shadow_legends');
const nameById = Object.fromEntries(champs.map(c => [c.id, c.name]));
const DOT = new Set(['Poison', 'HP Burn', 'Enemy Max HP Damage']);
const tagsByName = {}; for (const c of champs) tagsByName[c.name] = (c.champion_tags ?? []).filter(ct => ct.status === 'approved' && DOT.has(ct.tags?.name)).map(ct => ct.tags.name);
const affByName = {}; for (const c of champs) if (c.affinity) affByName[c.name.toLowerCase()] = c.affinity;
// NB a DIFFERENT projection from the alias→champion_id rows used for roster resolution below —
// this one carries affinity, so it keeps its own name rather than colliding with `aliasRows`.
const aliasAffinityRows = await rest('champion_aliases?select=alias,champions(affinity)');
for (const a of aliasAffinityRows) if (a.alias && a.champions?.affinity) affByName[a.alias.toLowerCase()] ??= a.champions.affinity;
const affOf = (n) => affByName[n?.toLowerCase()] ?? null;
const skills = await rest('champion_skills?select=champion_id,damage_multiplier&damage_multiplier=not.is.null');
const multByName = {}; for (const s of skills) { const nums = (String(s.damage_multiplier).match(/[0-9]+\.?[0-9]*/g) || []).map(Number); const mx = nums.length ? Math.max(...nums) : 0; const nm = nameById[s.champion_id]; if (nm && mx > (multByName[nm] || 0)) multByName[nm] = mx; }
const allSk = await rest('champion_skills?select=champion_id,slot,cooldown_base,skill_summary');
const skByCh = {}; for (const s of allSk) (skByCh[s.champion_id] ??= []).push(s);
const uptimeByName = {}; for (const c of champs) uptimeByName[c.name] = pm.dotUptimeFromSkills(skByCh[c.id] ?? []);

// ── per-(dungeon,stage) boss + affinity ───────────────────────────────────────────────────────
const DUNGEONS = { spider: "Spider's Den", ice_golem: "Ice Golem's Peak", dragon: "Dragon's Lair", fire_knight: "Fire Knight's Castle" };
const bossByStage = {}; // key -> {stage: bossRow}
const affByStage = {};
for (const [key, name] of Object.entries(DUNGEONS)) {
  const d = await rest(`dungeons?select=id&game_id=eq.raid_shadow_legends&name=eq.${encodeURIComponent(name)}`);
  if (!d[0]) continue;
  const en = await rest(`dungeon_stage_enemies?select=stage_number,enemy_role,hp,def,res&dungeon_id=eq.${d[0].id}&enemy_role=eq.boss`);
  bossByStage[key] = {}; for (const r of en) bossByStage[key][r.stage_number] = r;
  const af = await rest(`dungeon_stage_affinities?select=stage_number,affinity&dungeon_id=eq.${d[0].id}`);
  affByStage[key] = {}; for (const r of af) affByStage[key][r.stage_number] = r.affinity;
}
const keyOf = { "Spider's Den": 'spider', "Ice Golem's Peak": 'ice_golem', "Dragon's Lair": 'dragon', "Fire Knight's Castle": 'fire_knight' };
const parseDungeon = (c) => Object.keys(keyOf).find(n => c?.startsWith(n));

// ── captures ──────────────────────────────────────────────────────────────────────────────────
const runs = await rest('run_reconciliations?select=content,actual_floor,successful,turns,team_fielded,frozen_effective_stats');
function buildTeam(r) {
  const st = Object.fromEntries((r.frozen_effective_stats || []).map(c => [c.name, c.effective_stats]));
  return (r.team_fielded || [])
    .map(c => ({ name: c.name, estimated_stats: st[c.name], damage_multiplier: multByName[c.name] ?? null, tags: tagsByName[c.name] ?? [], affinity: affOf(c.name), dot_uptime: uptimeByName[c.name] ?? 1 }))
    .filter(c => c.estimated_stats);
}
const ttkAt = (team, key, stage) => {
  const boss = bossByStage[key]?.[stage]; if (!boss) return null;
  return pm.turnsToKill(team, boss, affByStage[key]?.[stage] ?? null);
};

// ── fit the BUDGET: the ttk threshold that best separates wins (≤B) from losses (>B) ───────────
const pts = [];
for (const r of runs) {
  if (/Hard/i.test(r.content || '')) continue;
  const key = keyOf[parseDungeon(r.content)]; if (!key) continue;
  const team = buildTeam(r); if (team.length < 2) continue;
  const ttk = ttkAt(team, key, r.actual_floor); if (ttk == null || !isFinite(ttk)) continue;
  pts.push({ key, stage: r.actual_floor, win: !!r.successful, ttk });
}
const cand = [...new Set(pts.map(p => Math.round(p.ttk)))].sort((a, b) => a - b);
let bestB = null, bestAcc = -1;
for (const B of cand) {
  let ok = 0; for (const p of pts) if ((p.ttk <= B) === p.win) ok++;
  if (ok > bestAcc) { bestAcc = ok; bestB = B; }
}
const BUDGET = bestB;
console.log(`Budget fit: ${pts.length} captures, best-separating ttk threshold = ${BUDGET} turns (${bestAcc}/${pts.length} correctly classified).`);
console.log(`  wins ttk:   ${pts.filter(p => p.win).map(p => Math.round(p.ttk)).sort((a, b) => a - b).join(' ')}`);
console.log(`  losses ttk: ${pts.filter(p => !p.win).map(p => Math.round(p.ttk)).sort((a, b) => a - b).join(' ')}`);

// ── per-dungeon: NEW kill floor (using each dungeon's push team) vs REALITY vs OLD ─────────────
// Push team = the fielded team from the HIGHEST-floor win we have for that dungeon (what they climb with).
function pushTeam(key) {
  const wins = runs.filter(r => keyOf[parseDungeon(r.content)] === key && r.successful && !/Hard/i.test(r.content || ''));
  wins.sort((a, b) => (b.actual_floor || 0) - (a.actual_floor || 0));
  return wins[0] ? { team: buildTeam(wins[0]), atFloor: wins[0].actual_floor } : null;
}
function reality(key) {
  const rs = runs.filter(r => keyOf[parseDungeon(r.content)] === key && !/Hard/i.test(r.content || ''));
  const wonF = rs.filter(r => r.successful).map(r => r.actual_floor).filter(Number.isFinite);
  const lostF = rs.filter(r => !r.successful).map(r => r.actual_floor).filter(Number.isFinite);
  return { maxWon: wonF.length ? Math.max(...wonF) : null, minLost: lostF.length ? Math.min(...lostF) : null };
}
function killFloor(team, key) {
  const stages = Object.keys(bossByStage[key] || {}).map(Number).sort((a, b) => a - b);
  let floor = null;
  for (const s of stages) { const t = ttkAt(team, key, s); if (t != null && isFinite(t) && t <= BUDGET) floor = s; }
  return floor;
}

let oldRec = {};
if (RUN_OLD) {
  try {
    const me = await import('../lib/match-engine.js');
    const gc = await import('../lib/gestal-context.js');
    // ALIASES ARE REQUIRED (2026-07-19) — omitting them silently drops champions whose Gestal
    // display name differs from champions.name (e.g. "Thor Faehammer" -> "Thor"). Fetched here
    // because `gc` is only imported inside this --old branch.
    const aliasRows = await gc.fetchAliasRows(rest);
    const SEL ='id,name,type_id,rarity,role,affinity,faction,base_hp,base_atk,base_def,base_spd,base_acc,base_res,base_crit_rate,base_crit_dmg,champion_tags(tag_id,status,ascension_required,tags(name,is_debuff,bypasses_accuracy_check)),champion_auras(aura_type,aura_value,aura_area)';
    let db = []; for (let f = 0; ; f += 1000) { const d = await rest(`champions?select=${encodeURIComponent(SEL)}&game_id=eq.raid_shadow_legends&limit=1000&offset=${f}`); if (!Array.isArray(d) || !d.length) break; db = db.concat(d); if (d.length < 1000) break; }
    const snap = JSON.parse(fs.readFileSync('gestal-sync/output/DonBrogni_768ae0d91391eff5.json', 'utf8'));
    const { userChampions } = gc.buildUserChampions(snap.champions, db, aliasRows);
    for (const key of Object.keys(DUNGEONS)) {
      try { const res = await me.matchRoster(userChampions, key, { account_development: 'fair' }); oldRec[key] = (res.content_label || '').match(/Stage\s+(\d+)/i)?.[1] ?? '?'; }
      catch (e) { oldRec[key] = `err:${e.message.slice(0, 20)}`; }
    }
  } catch (e) { console.log(`\n[--old] could not run live engine: ${e.message}`); }
}

console.log(`\n${'dungeon'.padEnd(12)} ${'OLD'.padStart(5)} ${'NEW(kill)'.padStart(10)} ${'REAL won'.padStart(9)} ${'REAL lost'.padStart(10)}  verdict`);
for (const key of Object.keys(DUNGEONS)) {
  const pt = pushTeam(key); if (!pt) { console.log(`${key.padEnd(12)}  (no wins captured)`); continue; }
  const nf = killFloor(pt.team, key);
  const rl = reality(key);
  const old = RUN_OLD ? (oldRec[key] ?? '?') : '(doc)';
  // verdict vs reality: NEW should be ≥ maxWon and < minLost (if a loss exists).
  let v = [];
  if (rl.maxWon != null && nf != null) v.push(nf >= rl.maxWon ? `covers won ${rl.maxWon}` : `UNDER (won ${rl.maxWon})`);
  if (rl.minLost != null && nf != null) v.push(nf < rl.minLost ? `< lost ${rl.minLost} ✓` : `OVER (lost ${rl.minLost})`);
  console.log(`${key.padEnd(12)} ${String(old).padStart(5)} ${String(nf ?? '—').padStart(10)} ${String(rl.maxWon ?? '—').padStart(9)} ${String(rl.minLost ?? '—').padStart(10)}  ${v.join(', ')}`);
}
console.log(`\nNote: NEW uses the push team (highest-floor captured win) per dungeon. OLD = live matchRoster (--old) or documented (INS-0015: spider 5, ice_golem 13, dragon 4, fire_knight 6). Survival NOT wired (INS-0018) — kill floor only.`);
process.exit(0);
