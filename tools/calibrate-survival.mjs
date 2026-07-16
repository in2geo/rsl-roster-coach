// tools/calibrate-survival.mjs — calibrate the power model's SURVIVAL side against real
// captured battles (run_reconciliations), so turnsSurvived lands in the SAME real-turn unit
// as the (already calibrated) turnsToKill and the two-sided stagePower verdict becomes valid.
//
// METHOD (mirror tools/calibrate-power.mjs, but survival is harder — read the findings below):
//   • A LOSS captures the team's realized survival: it died at `turns`, so turnsSurvived ≈ turns.
//   • A WIN is only a LOWER BOUND: the team was still alive at the kill, so survival ≥ turns.
//   • So losses are the anchors. But (see below) most captured losses are NOT survival-limited,
//     so we anchor the scale on the one clean fixed-team survival boundary and REPORT the
//     classification confusion rather than pretending a single scale fits.
//
// WHAT THE DATA SAYS (2026-07-15, 48 reconciled captures, 5 losses):
//   1. The 5 losses are HETEROGENEOUS, not clean survival anchors:
//        - Spider 20  (ttk 159 > died 145)  → KILL wall (couldn't finish in time).
//        - Spider 11  (all-support team, died 156, no damage; Force affinity) → KILL + affinity
//          (INS-0015 already documents this exact roster's Force weakness).
//        - IG 10 / 18 / 19 (died AFTER their ttk) → survival/attrition, the only survival anchors.
//   2. RAW BULK GETS THE BOUNDARY BACKWARDS. In both boundary pairs the TANKIER team LOST
//        (IG18: loss team sumEHP 298k @119t vs win team 211k @197t; Spider11: loss 314k vs win
//        276k). Survival is NOT bulk — it's the kill/survival RACE plus a content spike the tanky
//        team lacked a counter to. A survival model keyed on EHP alone mis-ranks the boundary.
//   3. THE 3 IG SURVIVAL ANCHORS DO NOT SHARE A SCALE (turns/proxy spans 0.78→8.28, CV ~0.8):
//        real survival grows SLOWER with stage than modeled enemy-ATK incoming grows. Root cause:
//        boss lethality on IG is mechanic-driven (Frigid Vengeance %-AoE), not ATK-proportional,
//        so enemy `atk` overstates real incoming at high stages. This is the mirror of the
//        kill-side DoT gap (INS-0017) — a MISSING TERM, not a scale error — but there aren't
//        enough survival captures to fit that term yet.
//   4. THE ONE CLEAN ANCHOR: the SAME team (Tagoar/Gnut/Pelops/Narma) CLEARS IG-18 (@197t) and
//        FAILS IG-19 (@195t). For a fixed team survival ≈ constant (~196 real turns); the wall is
//        that IG-19's tougher boss (ATK +20%) isn't killed before that survival runs out. We
//        anchor SURVIVAL_SCALE on this boundary (nominal, IG-anchored) and report the rest.
//
// VERDICT: survival is NOT ready to wire. The kill side + turn budget is the load-bearing half;
// survival stays a NOMINAL guardrail until (a) per-champ damage capture separates kill-under-
// performance from survival-exhaustion on the IG losses, and (b) more losses (ideally same-team
// stage sweeps) let us fit the missing mechanic-incoming term. See INS-0018.
//
// Run: node tools/calibrate-survival.mjs
import fs from 'fs';
import * as pm from '../lib/power-model.js';

const env = {};
for (const l of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, ''); }
const BASE = (env.SUPABASE_URL || '').replace(/\/rest\/v1\/?$/, '');
const H = { apikey: env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}` };
const rest = async (p) => (await fetch(`${BASE}/rest/v1/${p}`, { headers: H })).json();

// champ name -> best damage multiplier (kill side) + all approved tag names (DoT + sustain).
const skills = await rest('champion_skills?select=champion_id,damage_multiplier&damage_multiplier=not.is.null');
const champs = await rest('champions?select=id,name,affinity,champion_tags(status,tags(name))&game_id=eq.raid_shadow_legends');
const nameById = Object.fromEntries(champs.map(c => [c.id, c.name]));
const tagsByName = {};
for (const c of champs) tagsByName[c.name] = (c.champion_tags ?? []).filter(ct => ct.status === 'approved').map(ct => ct.tags?.name).filter(Boolean);
// champ name -> affinity (+ aliases) for the affinity-adjusted kill side (INS-0018 ttk fix).
const affByName = {};
for (const c of champs) if (c.affinity) affByName[c.name.toLowerCase()] = c.affinity;
const aliasRows = await rest('champion_aliases?select=alias,champions(affinity)');
for (const a of aliasRows) if (a.alias && a.champions?.affinity) affByName[a.alias.toLowerCase()] ??= a.champions.affinity;
const affOf = (name) => affByName[name?.toLowerCase()] ?? null;
const multByName = {};
for (const s of skills) {
  const nums = (String(s.damage_multiplier).match(/[0-9]+\.?[0-9]*/g) || []).map(Number);
  const mx = nums.length ? Math.max(...nums) : 0;
  const nm = nameById[s.champion_id]; if (!nm) continue;
  if (mx > (multByName[nm] || 0)) multByName[nm] = mx;
}
const allSkills = await rest('champion_skills?select=champion_id,slot,cooldown_base,skill_summary');
const skillsByChamp = {};
for (const s of allSkills) (skillsByChamp[s.champion_id] ??= []).push(s);
const dotUptimeByName = {};
for (const c of champs) dotUptimeByName[c.name] = pm.dotUptimeFromSkills(skillsByChamp[c.id] ?? []);

// full enemy list per (dungeon, stage) — need boss + minion for the incoming side.
const DUNGEONS = { "Spider's Den": null, "Ice Golem's Peak": null, "Dragon's Lair": null, "Fire Knight's Castle": null };
for (const n of Object.keys(DUNGEONS)) { const d = await rest(`dungeons?select=id&game_id=eq.raid_shadow_legends&name=eq.${encodeURIComponent(n)}`); DUNGEONS[n] = d[0]?.id; }
const enemiesBy = {}; // "dungeon|stage" -> enemy rows
const affBy = {};     // "dungeon|stage" -> boss affinity
for (const [n, id] of Object.entries(DUNGEONS)) {
  if (!id) continue;
  const rows = await rest(`dungeon_stage_enemies?select=stage_number,enemy_role,hp,def,res,atk,crit_rate,crit_dmg&dungeon_id=eq.${id}`);
  for (const r of rows) (enemiesBy[`${n}|${r.stage_number}`] ??= []).push(r);
  const aff = await rest(`dungeon_stage_affinities?select=stage_number,affinity&dungeon_id=eq.${id}`);
  for (const r of aff) affBy[`${n}|${r.stage_number}`] = r.affinity;
}
const parseDungeon = (content) => Object.keys(DUNGEONS).find(n => content?.startsWith(n));
const contentKeyOf = { "Spider's Den": 'spider', "Ice Golem's Peak": 'ice_golem', "Dragon's Lair": 'dragon', "Fire Knight's Castle": 'fire_knight' };

const runs = await rest('run_reconciliations?select=content,actual_floor,successful,turns,team_fielded,frozen_effective_stats');
function buildTeam(r) {
  const statsByName = Object.fromEntries((r.frozen_effective_stats || []).map(c => [c.name, c.effective_stats]));
  return (r.team_fielded || [])
    .map(c => ({ name: c.name, estimated_stats: statsByName[c.name], damage_multiplier: multByName[c.name] ?? null, tags: tagsByName[c.name] ?? [], affinity: affOf(c.name), dot_uptime: dotUptimeByName[c.name] ?? 1 }))
    .filter(c => c.estimated_stats);
}

// Build every usable capture point with the CALIBRATED kill side (ttk, real turns) and the
// SURVIVAL PROXY (team-sum EHP × sustain / boss-AoE incoming — see finding #2: sum, not weak-link).
const pts = [];
for (const r of runs) {
  if (/Hard/i.test(r.content || '')) continue;
  const dn = parseDungeon(r.content); if (!dn) continue;
  const en = enemiesBy[`${dn}|${r.actual_floor}`]; if (!en) continue;
  if (!r.turns) continue;
  const team = buildTeam(r); if (team.length < 2) continue;
  const boss = en.find(e => e.enemy_role === 'boss') ?? en[0];
  const ttk = pm.turnsToKill(team, boss, affBy[`${dn}|${r.actual_floor}`] ?? null);
  const proxy = pm.survivalProxy(team, en); // unscaled "rounds" on the team-sum/AoE basis
  pts.push({
    content: r.content, dn, key: contentKeyOf[dn], stage: r.actual_floor, win: !!r.successful,
    turns: r.turns, ttk, proxy,
  });
}

// --- Anchor the scale on the CLEAN fixed-team IG-18/IG-19 survival boundary --------------------
// Only ONE loss is an uncontaminated survival anchor: the fixed team (Tagoar/Gnut/Pelops/Narma)
// that CLEARS IG-18 and FAILS IG-19 at ~the same realized survival. IG-19 is its death (survival
// ran out before the tougher boss died), so anchor SURVIVAL_SCALE so modeled survival for that
// team at IG-19 = its ~195 realized turns. (The other two "anchors" are contaminated: IG-10 is
// early-stage noise — same team WINS IG-10 at 55/64/69t — and IG-18's loss is a DIFFERENT, tanky
// team whose real failure is kill-accuracy, ttk=77 fiction, not survival. Including them in a
// median inverts the answer.) We still PRINT all three so the spread (finding #3) is visible.
const igLossAnchors = pts.filter(p => p.key === 'ice_golem' && !p.win && p.ttk < p.turns);
const cleanAnchor = igLossAnchors.find(p => p.stage === 19) ?? igLossAnchors.sort((a, b) => b.stage - a.stage)[0];
const SURVIVAL_SCALE = cleanAnchor ? cleanAnchor.turns / cleanAnchor.proxy : null; // nominal, IG-anchored

console.log(`Usable capture points: ${pts.length}  (losses ${pts.filter(p => !p.win).length})`);
console.log(`\nIG survival-limited loss "anchors" (ttk < died-at-turns) — note they DON'T share a scale:`);
console.log('  stage  turns   proxy  turns/proxy  note');
for (const p of igLossAnchors.sort((a, b) => a.stage - b.stage)) {
  const note = p.stage === 19 ? '<- CLEAN (fixed team, IG18-clear/IG19-fail)'
    : p.stage === 18 ? 'contaminated: tanky team, kill-accuracy loss'
    : 'contaminated: early-stage noise (also wins here)';
  console.log(`   ${String(p.stage).padStart(3)}  ${String(p.turns).padStart(5)}  ${p.proxy.toFixed(1).padStart(6)}  ${(p.turns / p.proxy).toFixed(2).padStart(8)}   ${note}`);
}
console.log(`\n  -> nominal SURVIVAL_SCALE (clean anchor only) = ${SURVIVAL_SCALE?.toFixed(2)}`);
console.log(`  The 0.52 / 2.35 / 7.24 spread is STRUCTURAL (finding #3): real survival grows slower`);
console.log(`  than modeled enemy-ATK incoming. This scale is one-anchor + IG-only + NOMINAL.`);

// --- Classification under the two-sided race (surv_scaled >= ttk) -----------------------------
// Acceptance test: WINS should have surv >= ttk at the stage they won; LOSSES should fail. Report
// the confusion honestly — the kill-accuracy false-positives (IG18 tanky loss team) are expected.
const cls = pts.map(p => {
  const surv = SURVIVAL_SCALE * p.proxy;
  const predClear = surv >= p.ttk;
  const binds = predClear ? null : 'survival';
  return { ...p, surv, predClear, binds };
});
let TP = 0, TN = 0, FP = 0, FN = 0;
for (const c of cls) {
  if (c.win && c.predClear) TP++;
  else if (!c.win && !c.predClear) TN++;
  else if (!c.win && c.predClear) FP++;   // predicted clear, actually lost
  else FN++;                              // predicted die, actually won
}
console.log(`\nClassification (predClear = SURVIVAL_SCALE*proxy >= ttk):`);
console.log(`  wins correctly cleared (TP):        ${TP}/${pts.filter(p => p.win).length}`);
console.log(`  losses correctly failed  (TN):      ${TN}/${pts.filter(p => !p.win).length}`);
console.log(`  losses predicted to clear (FP):     ${FP}  <- kill-accuracy residual (see #1/#2)`);
console.log(`  wins predicted to die     (FN):     ${FN}  <- survival too pessimistic`);

console.log(`\nLosses in detail (does the model call them?):`);
console.log('  content                     stage died@  ttk  surv  verdict');
for (const c of cls.filter(p => !p.win).sort((a, b) => a.content.localeCompare(b.content))) {
  console.log('  ' + (c.content || '').slice(0, 26).padEnd(27),
    String(c.stage).padStart(3), String(c.turns).padStart(5),
    String(Math.round(c.ttk)).padStart(5), String(Math.round(c.surv)).padStart(5),
    (c.predClear ? 'MISS (pred clear)' : 'HIT  (pred fail)'));
}

// --- Per-content binding wall (INS-0016 expectation: Spider=kill, IG=survival) ----------------
console.log(`\nPer-content binding wall among WINS (median ttk vs median surv, real turns):`);
const walls = {};
for (const key of ['spider', 'ice_golem']) {
  const ws = cls.filter(p => p.win && p.key === key);
  if (!ws.length) continue;
  const med = (arr) => arr.slice().sort((a, b) => a - b)[Math.floor(arr.length / 2)];
  const mttk = med(ws.map(w => w.ttk)), msurv = med(ws.map(w => w.surv));
  walls[key] = msurv < mttk ? 'survival' : 'kill';
  console.log(`  ${key.padEnd(10)} median ttk ${Math.round(mttk).toString().padStart(4)}  median surv ${Math.round(msurv).toString().padStart(4)}  -> binds: ${walls[key].toUpperCase()}`);
}
const expected = { spider: 'kill', ice_golem: 'survival' }; // INS-0016 ground truth
const inverted = Object.keys(expected).filter(k => walls[k] && walls[k] !== expected[k]);
console.log(`\nKEY FINDING: expected walls (INS-0016) = Spider:kill, IceGolem:survival.`);
console.log(inverted.length
  ? `  MODEL INVERTS them (${inverted.map(k => `${k}->${walls[k]}`).join(', ')}). An ATK-based incoming\n` +
    `  proxy CANNOT place the survival wall: IG's wall is the mechanic spike (Frigid Vengeance),\n` +
    `  not enemy ATK; Spider's low-burst poison race reads as fragile on ATK. => survival is NOT\n` +
    `  wire-ready on this basis; it needs a content-threat / mechanic-incoming term. See INS-0018.`
  : `  Model matches expected walls.`);
process.exit(0);
