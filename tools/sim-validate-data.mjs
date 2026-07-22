// tools/sim-validate-data.mjs — QA PROTOCOL RUNG 1: validate the sim's INPUT DATA before any combat
// logic is tested. "A simulator cannot compensate for bad source data." (Simulator QA Protocol §1.)
//
// This is GATE 0 — it runs BEFORE gate 1 (sim-selftest, the spec) and gate 2 (sim-dragon, reality).
// A test on bad data is not a test. It checks the SAME data the sim consumes, read through the SAME
// parser (lib/sim/ai.js readSkillKit), so a "damage skill with no scaling stat" here is exactly a
// champion that deals 0 in the sim — no second interpretation to drift.
//
// Every finding is tagged VERIFIED / ESTIMATED / MISSING (the doc's rule: label estimated data
// separately). Structural integrity errors FAIL gate 0; MISSING data is labelled, not fatal — you
// may still run the test, you just know it is estimated-tier.
//
// Dragon-scoped v1 (Mike, 2026-07-22): start narrow, then reuse the frame for FK / IG / Spider.
// Run: node --env-file=.env.local tools/sim-validate-data.mjs [--all-champs]

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildUserChampions, fetchAliasRows } from '../lib/gestal-context.js';
import { mapRoster } from '../lib/match-engine.js';
import { buildRosterIndex, loadNameResolverRest } from '../lib/champion-names.js';
import { readSkillKit } from '../lib/sim/ai.js';
import { SCORCH_FROM_STAGE } from '../lib/sim/dragon.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname, '..');
const ALL_CHAMPS = process.argv.includes('--all-champs');   // widen from fielded-only to every champ

const BASE = (process.env.SUPABASE_URL || '').replace(/\/rest\/v1\/?$/, '');
const H = { apikey: process.env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}` };
const rest = async p => (await fetch(`${BASE}/rest/v1/${p}`, { headers: H })).json();

// ── load the same inputs sim-dragon.mjs uses ────────────────────────────────────
// Full SELECT — buildUserChampions/mapRoster need identity + base stats to resolve rosters; a slim
// projection silently yields an empty roster index (0 fielded champs). Mirror sim-dragon.mjs.
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
  rosters[snap.accountId] = buildRosterIndex(mapRoster(userChampions, {}).mapped, nameResolver);
}

const dun = (await rest('dungeons?select=id,name&game_id=eq.raid_shadow_legends')).find(x => x.name === "Dragon's Lair");
const enemyRows = await rest('dungeon_stage_enemies?select=stage_number,enemy_role,enemy_name,hp,atk,def,spd,res,acc,crit_rate,crit_dmg&dungeon_id=eq.' + dun.id);
// Probe whether the wave SCHEMA even exists live — migration 2026-07-22_dungeon_stage_enemies_waves
// adds wave_number/position and may be UNAPPLIED. A non-array reply = the column is absent.
const waveColsProbe = await rest('dungeon_stage_enemies?select=wave_number&limit=1&dungeon_id=eq.' + dun.id);
const waveColsApplied = Array.isArray(waveColsProbe);
const affRows = await rest('dungeon_stage_affinities?select=stage_number,affinity&dungeon_id=eq.' + dun.id);
const stageAff = Object.fromEntries(affRows.map(r => [r.stage_number, r.affinity]));

// which champions are ACTUALLY fielded on Dragon (the actionable set) + how often
const runs = await rest('run_reconciliations?select=account_id,content,successful,team_fielded&order=battle_captured_at.desc&limit=2000');
const fieldCount = {};   // champion_id -> # of Dragon battles fielded in
let dragonBattles = 0;
for (const r of runs) {
  if (!/^Dragon's Lair\s+Stage\s+\d+/i.test(String(r.content ?? ''))) continue;
  if (r.successful !== true && r.successful !== false) continue;
  const idx = rosters[r.account_id]; if (!idx) continue;
  let tf = r.team_fielded; if (typeof tf === 'string') { try { tf = JSON.parse(tf); } catch { tf = []; } }
  const team = (tf ?? []).map(h => idx.get(h.name)).filter(Boolean);
  if (team.length < 4) continue;
  dragonBattles += 1;
  for (const c of team) fieldCount[c.id] = (fieldCount[c.id] ?? 0) + 1;
}

// ── expected wave composition from seeds/205 (committed; may be UNAPPLIED to the live DB) ────────
// The doc's check is "5 expected enemies but only 4 records" — we can only run it against an
// EXPECTED count, and seeds/205 is where the expected Dragon waves live (composition, not stats).
const waveSeedText = fs.readFileSync(path.join(REPO, 'seeds/205_dragon_wave_composition.sql'), 'utf8');
const expectedWaves = {};   // stage -> { total, byWave: {waveNo: count} }
{
  const re = /\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*'[^']*'\s*,\s*'[^']*'\s*,\s*(?:\d+|null)\s*,\s*(?:\d+|null)\s*\)/g;
  let m;
  while ((m = re.exec(waveSeedText))) {
    const stage = +m[1], wave = +m[2];
    (expectedWaves[stage] ??= { total: 0, byWave: {} });
    expectedWaves[stage].total += 1;
    expectedWaves[stage].byWave[wave] = (expectedWaves[stage].byWave[wave] ?? 0) + 1;
  }
}

// ── findings collector ───────────────────────────────────────────────────────
const errors = [];    // structural integrity — these FAIL gate 0
const warns = [];     // MISSING / ESTIMATED — labelled, not fatal
let dataComplete = true;   // a whole phase missing flips this — a SEPARATE axis from gate-0 integrity
const note = (bucket, tier, msg) => bucket.push({ tier, msg });

console.log('\n══ DRAGON DATA VALIDATOR — QA rung 1 (gate 0) ══\n');

// ── 1a. WAVES FIRST — the phase Mike reports as the real wall, checked EXPECTED (seeds/205) vs LIVE.
// This leads the report on purpose: last session's wave work is a committed seed that was never
// applied and never consumed by the sim ("represented but not consumed" at the data layer). The gap
// must be loud, not a footnote — "enemy data clean" must never be readable off this tool again.
console.log('▶ WAVE DATA  (EXPECTED from seeds/205  vs  APPLIED in the live DB)');
{
  const liveByStage = {};
  for (const e of enemyRows) if (e.enemy_role === 'wave') liveByStage[e.stage_number] = (liveByStage[e.stage_number] ?? 0) + 1;
  const stagesInSeed = Object.keys(expectedWaves).map(Number).sort((a, b) => a - b);
  const totalExpected = Object.values(expectedWaves).reduce((s, w) => s + w.total, 0);
  const totalLive = Object.values(liveByStage).reduce((s, n) => s + n, 0);

  const gaps = [];
  for (let s = 1; s <= 25; s++) {
    const exp = expectedWaves[s]?.total ?? 0, have = liveByStage[s] ?? 0;
    if (exp > have) gaps.push({ s, exp, have, waves: Object.keys(expectedWaves[s]?.byWave ?? {}).length });
  }

  console.log(`    schema: wave columns (wave_number/position) applied to the live DB? ${waveColsApplied ? 'YES' : 'NO — migration 2026-07-22_dungeon_stage_enemies_waves is UNAPPLIED'}`);
  console.log(`    seeds/205 (committed) defines waves for ${stagesInSeed.length}/25 stages — ${totalExpected} mobs (~${Math.round(totalExpected / (stagesInSeed.length || 1))}/stage, 2 waves × 5).`);
  console.log(`    APPLIED wave rows in the live DB: ${totalLive}.`);
  if (!waveColsApplied) { dataComplete = false; note(warns, 'MISSING', 'wave schema columns are not applied (migration pending) — the seed cannot be applied until they are'); }
  if (gaps.length) {
    dataComplete = false;
    note(warns, 'MISSING', `${gaps.length} stages expect waves but have none applied (seeds/205 committed, NOT applied)`);
    console.log(`    ⛔ INCOMPLETE — ${gaps.length}/25 stages expect waves, ${totalLive === 0 ? 'ZERO' : totalLive} applied. Sample (expected → have):`);
    for (const g of gaps.filter(g => [2, 16, 20, 21].includes(g.s))) console.log(`         stage ${String(g.s).padStart(2)}: ${g.exp} wave mobs across ${g.waves} waves  →  ${g.have}`);
    console.log(`    ⇒ EVERY Dragon prediction is BOSS-PHASE ONLY, so treat it as LOW CONFIDENCE — the sim is blind to the phase Mike calls the wall.`);
  } else {
    console.log('    ✅ every expected wave is present in the live DB.');
  }
  console.log(`    ⚠ STAT-SOURCING GAP REMAINS: seeds/205 has NO stats (levels only on st 1/10/16/17/18). Enemy HP/ATK/DEF are`);
  console.log(`      NOT readable in-game — applying the seed gives COMPOSITION, not a combat-ready wave. This is the open problem.`);
}

// ── 1b. BOSS + affinity integrity ──────────────────────────────────────────────
console.log('\n▶ STAGE / BOSS DATA  (dungeon_stage_enemies boss rows, dungeon_stage_affinities)');
{
  const seen = new Set();
  for (const e of enemyRows) {
    const k = `${e.stage_number}/${e.enemy_role}/${e.wave_number ?? ''}/${e.position ?? ''}`;
    if (seen.has(k)) note(errors, 'MISSING', `duplicate enemy row: ${k}`);
    seen.add(k);
  }
  for (let s = 1; s <= 25; s++) {
    const boss = enemyRows.find(e => e.stage_number === s && e.enemy_role === 'boss');
    if (!boss) { note(errors, 'MISSING', `no boss row for stage ${s}`); continue; }
    for (const f of ['hp', 'atk', 'def', 'spd']) if (!(Number(boss[f]) > 0)) note(errors, 'MISSING', `stage ${s} boss ${f} not positive (${boss[f]})`);
    if (boss.crit_rate != null && (boss.crit_rate < 0 || boss.crit_rate > 100)) note(errors, 'MISSING', `stage ${s} boss crit_rate out of 0-100 (${boss.crit_rate})`);
    if (!stageAff[s]) note(warns, 'MISSING', `stage ${s} has no affinity row`);
  }
  const bossErr = errors.filter(e => !/duplicate/.test(e.msg)).length;
  console.log(`    boss rows 1-25: ${25 - errors.filter(e => /no boss row/.test(e.msg)).length}/25 present · affinity ${Object.keys(stageAff).length}/25`);
  console.log(`    boss stats: HP=VERIFIED (transcribed) · ATK/DEF/RES=ESTIMATED (shared ladder) · SPD=ESTIMATED (unverified)`);
  console.log(`    ${bossErr ? '⚠ ' + bossErr + ' integrity issue(s) — see FAIL list' : '✅ no integrity issues'}`);
}

// ── 2. CHAMPION SKILL DATA — read through the sim's own parser ───────────────────
console.log('\n▶ CHAMPION SKILL DATA  (read via lib/sim/ai.js readSkillKit — the sim\'s own eyes)');
const scope = ALL_CHAMPS ? db.map(c => c.id) : Object.keys(fieldCount);   // ids are UUID strings — do NOT Number()
console.log(`    scope: ${ALL_CHAMPS ? 'ALL champions' : `${scope.length} champions fielded on Dragon across ${dragonBattles} captured battles`}`);

const noCoeff = [];        // {name, battles, slots[]}  — damage skills with no scaling stat
const execUnread = [];     // {name, slots[]}           — execute threshold unmodelled
const cdMissing = [];      // {name, slots[]}           — active skill with no cooldown
let dmgSkills = 0, dmgWithCoeff = 0;

for (const id of scope) {
  const cat = byId[id]; if (!cat) continue;
  const kit = readSkillKit(cat.champion_skills ?? []);
  const battles = fieldCount[id] ?? 0;
  const missSlots = [], execSlots = [], cdSlots = [];
  for (const s of kit) {
    if (s.hitsEnemies) { dmgSkills++; if (s.coeff != null) dmgWithCoeff++; }
    if (s.unread.includes('damage_multiplier')) missSlots.push(s.slot);
    if (s.unread.includes('execute-threshold')) execSlots.push(s.slot);
    if (!s.isPassive && s.slot !== 'A1' && !(s.cooldown > 0)) cdSlots.push(s.slot);
  }
  if (missSlots.length) noCoeff.push({ name: cat.name, battles, slots: missSlots });
  if (execSlots.length) execUnread.push({ name: cat.name, slots: execSlots });
  if (cdSlots.length) cdMissing.push({ name: cat.name, slots: cdSlots });
}

const bump = (n) => String(n).padStart(4);
console.log(`\n    ✱ DAMAGE SKILLS WITH NO SCALING STAT  (these deal 0 in the sim — the extraction backlog)`);
if (!noCoeff.length) console.log('      ✅ none');
else for (const c of noCoeff.sort((a, b) => b.battles - a.battles))
  console.log(`      ${bump(c.battles)} battles  ${c.name.padEnd(22)} ${c.slots.join(', ')}   [MISSING damage_multiplier]`);

if (execUnread.length) {
  console.log(`\n    ✱ EXECUTE THRESHOLD unmodelled (skill fires normally instead — flagged, not guessed)`);
  for (const c of execUnread) console.log(`           ${c.name.padEnd(22)} ${c.slots.join(', ')}`);
}
if (cdMissing.length) {
  console.log(`\n    ✱ ACTIVE (non-A1) SKILL WITH NO COOLDOWN  (cooldown below 1 turn — verify vs skill text)`);
  for (const c of cdMissing.slice(0, 20)) console.log(`           ${c.name.padEnd(22)} ${c.slots.join(', ')}`);
  if (cdMissing.length > 20) console.log(`           … and ${cdMissing.length - 20} more`);
}

// ── 3. DATA-TIER SUMMARY + gate verdict ─────────────────────────────────────────
const coeffPct = dmgSkills ? Math.round(100 * dmgWithCoeff / dmgSkills) : 0;
console.log('\n▶ DATA-TIER SUMMARY');
console.log(`    enemy-attack skills in scope with a usable coefficient: ${dmgWithCoeff}/${dmgSkills} (${coeffPct}%)`);
console.log(`    → any battle whose team includes a MISSING-coeff champion is ESTIMATED-tier, not VERIFIED.`);
console.log(`      ${noCoeff.length} of ${scope.length} scoped champions carry at least one 0-damage skill.`);

console.log('\n══ GATE 0 VERDICT ══');
if (errors.length) {
  console.log(`  ✗ FAIL — ${errors.length} structural integrity error(s). A test on this data is not a test:`);
  for (const e of errors) console.log(`      [${e.tier}] ${e.msg}`);
} else {
  console.log('  ✅ PASS (structural integrity) — no duplicate/missing/impossible enemy rows.');
}
if (warns.length) {
  console.log(`\n  ⚠ ${warns.length} MISSING/ESTIMATED data warning(s) — labelled, not fatal:`);
  for (const w of warns) console.log(`      [${w.tier}] ${w.msg}`);
}

// DATA COMPLETENESS is a SEPARATE axis from structural integrity: the data present can be internally
// clean (gate 0 PASS) while a whole phase is missing. Conflating the two is how "enemy data clean"
// got said while the waves — the actual wall — were entirely absent.
console.log('\n══ DATA COMPLETENESS  (separate axis — a whole phase can be missing while integrity PASSES) ══');
if (dataComplete) {
  console.log('  ✅ COMPLETE — every modelled phase has data.');
} else {
  console.log('  ⛔ INCOMPLETE — Dragon has 2 wave phases with NO applied enemy data (seeds/205 committed, not applied,');
  console.log('     and stat-free even if applied). Predictions are BOSS-PHASE ONLY → LOW CONFIDENCE. Gate 0 can PASS');
  console.log('     on the boss data while the model stays blind to the phase Mike calls the wall.');
}
console.log('');
process.exit(errors.length ? 1 : 0);
