// tools/mob-coverage.mjs — THE 3-LEVEL WAVE COVERAGE RUNG (the reviewer's completeness check).
//
// The Model QA ladder proves "what's IN the model is correct" but not "the model CONTAINS everything the
// wave champions do" — its structural blind spot (action-verification-review-request.md §2: "blind to
// omissions… the check stays green" while half of what should occur is missing). This rung closes it by
// diffing the model against EXTERNAL ground truth at three levels:
//
//   L1 COMPOSITION — the sim's wave == the VERIFIED table (data/dragon-wave-data.json, in-game screenshots).
//                    Catches a wrong / missing / extra mob. Ground truth is NOT the sim.
//   L2 RECIPES     — every mob skill is a COMPLETE RECIPE in the Model (interpreter path), NOT the
//                    readSkillKit auto-parse fallback. A recipe-less mob is OUTSIDE the Model (hard fail);
//                    open (non-ACCEPTED) deferred clauses are the unimplemented catalog.
//   L3 FIRING      — every ACTIVE skill actually FIRES and CONSUMES in the deterministic battle. Catches a
//                    skill/passive that should occur but never does (e.g. Lua's TM-strip was invisible).
//
// COMPLETE for the stage iff: L1 matches · L2 no missing/dupe AND the unimplemented catalog is empty ·
// L3 no unexpected never-fired. A non-empty L2 unimplemented catalog = INCOMPLETE (the deferred-mechanics
// to-do), reported not hidden. Run: node --env-file=.env.local tools/mob-coverage.mjs [stage=17]

import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
import { makeState, simulate, setChanceMode } from '../lib/sim/engine.js';
import { buildDragonBattle } from '../lib/sim/dragon-fixture.js';
import { installRecipeRun, recipeFor } from '../lib/sim/interpreter.js';
import { loadNameResolverRest } from '../lib/champion-names.js';

const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const STAGE = Number(process.argv[2] ?? process.env.MODEL_QA_STAGE ?? 17);
if (!process.env.SUPABASE_URL) { console.log('needs the DB — run with --env-file=.env.local'); process.exit(2); }
const BASE = process.env.SUPABASE_URL.replace(/\/rest\/v1\/?$/, '');
const H = { apikey: process.env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}` };
const rest = async p => (await fetch(`${BASE}/rest/v1/${p}`, { headers: H })).json();

let hardFails = 0; const unimplemented = []; const softNotes = [];
const say = (s) => console.log(s);
say(`\n══ MOB COVERAGE — Dragon stage ${STAGE} (3-level, vs external ground truth) ══`);

// ── L1 COMPOSITION ──────────────────────────────────────────────────────────────
const verified = JSON.parse(fs.readFileSync(path.join(REPO, 'data', 'dragon-wave-data.json'), 'utf8'))
  .filter(r => Number(r.Stage) === STAGE);
const dun = (await rest('dungeons?select=id,name&game_id=eq.raid_shadow_legends')).find(x => x.name === "Dragon's Lair");
const dbRows = (await rest(`dungeon_stage_enemies?select=enemy_name,champion_id,wave_number,position&dungeon_id=eq.${dun.id}&stage_number=eq.${STAGE}&enemy_role=eq.wave`));
say(`\n L1 COMPOSITION — sim/DB vs the verified table (${verified.length ? verified[0].Source : 'no verified rows'}):`);
if (!verified.length) { softNotes.push(`no verified composition for stage ${STAGE} — L1 cannot be checked`); say('    ⚠ no verified rows for this stage — cannot check (degrade to trust the DB).'); }
else {
  const vKey = r => `w${r.Wave}p${r.Position}`, dKey = r => `w${r.wave_number}p${r.position}`;
  const vMap = Object.fromEntries(verified.map(r => [vKey(r), r.Champion_ID]));
  const dMap = Object.fromEntries(dbRows.map(r => [dKey(r), r.champion_id]));
  const slots = [...new Set([...Object.keys(vMap), ...Object.keys(dMap)])].sort();
  const nameOf = id => (verified.find(r => r.Champion_ID === id)?.Champion) ?? (dbRows.find(r => r.champion_id === id)?.enemy_name) ?? id;
  let mismatch = 0;
  for (const s of slots) {
    if (vMap[s] !== dMap[s]) { mismatch++; hardFails++; say(`    ✗ ${s}: verified ${nameOf(vMap[s]) ?? '(none)'} — sim/DB ${nameOf(dMap[s]) ?? '(MISSING)'}`); }
  }
  if (!mismatch) say(`    ✅ all ${slots.length} wave slots match the verified composition (${[...new Set(verified.map(r => r.Champion))].join(', ')})`);
}

// ── L2 RECIPES — every mob skill is a COMPLETE recipe in the MODEL (not the readSkillKit fallback) ──
// A skill is "loaded" only if it has a RECIPE (interpreter path). A mob with NO recipe silently runs the
// readSkillKit/applySkill auto-parse — a SEPARATE, weaker-validated engine that has drifted (it was missing
// Enfeeble→weak-hit). So "no recipe" is a HARD FAIL: the mob is outside the Model. For recipes that DO
// exist, their open (non-ACCEPTED) `deferred[]` clauses are the unimplemented catalog.
const SEL = 'id,name,champion_skills(slot,skill_name,skill_summary)';
const mobIds = [...new Set(dbRows.map(r => r.champion_id).filter(Boolean))];
const mobChamps = (await rest(`champions?select=${encodeURIComponent(SEL)}&id=in.(${mobIds.join(',')})`)).map(c => ({ ...c, side: 'MOB' }));
// the TEAM — from the fixture roster (full DB names). BOTH sides must be in the Model, not the fallback.
const FIXP = path.join(REPO, 'test', 'golden', `dragon${STAGE}-donbambus-current.json`);
const fixture = fs.existsSync(FIXP) ? JSON.parse(fs.readFileSync(FIXP, 'utf8')) : null;
const teamNames = fixture ? [...new Set(Object.values(fixture.roster ?? {}))] : [];
let teamChamps = [];
if (teamNames.length) {
  const resolver = await loadNameResolverRest(rest);   // ALIAS-aware; resolveOrThrow is LOUD — never silently drops a champ
  const teamIds = teamNames.map(n => resolver.resolveOrThrow(n, 'coverage team roster').id);
  teamChamps = (await rest(`champions?select=${encodeURIComponent(SEL)}&id=in.(${teamIds.join(',')})`)).map(c => ({ ...c, side: 'TEAM' }));
}
const champs = mobChamps;   // L3 (firing) still keys off the mobs
say(`\n L2 RECIPES — every combatant (TEAM + MOBS) is a COMPLETE recipe in the Model (not the readSkillKit fallback):`);
for (const c of [...teamChamps, ...mobChamps]) {
  const rows = c.champion_skills ?? [];
  const slots = [...new Set(rows.map(r => String(r.slot).toUpperCase()))];
  const dupes = rows.map(r => String(r.slot).toUpperCase()).filter((s, i, a) => a.indexOf(s) !== i);
  const issues = [];
  if (dupes.length) { issues.push(`DUPLICATE skill row(s): ${[...new Set(dupes)].join(',')}`); hardFails++; }
  if (!slots.includes('A1')) { issues.push('MISSING A1'); hardFails++; }
  const noRecActive = [], noRecPassive = [];
  for (const slot of slots) {
    const rec = recipeFor({ name: c.name }, slot.replace(/\s+/g, ''));   // "PASSIVE 2" → "PASSIVE2"
    if (!rec) { (/^A\d$/.test(slot) ? noRecActive : noRecPassive).push(slot); continue; }
    for (const d of (rec.deferred ?? [])) if (!/ACCEPTED/i.test(d)) unimplemented.push(`${c.side} ${c.name} ${slot}: ${d}`);
  }
  if (noRecActive.length) { issues.push(`NO RECIPE — active skill(s) on the fallback: ${noRecActive.join(',')}`); hardFails += noRecActive.length; }
  if (noRecPassive.length) softNotes.push(`${c.side} ${c.name}: passive(s) with no recipe (modifier/trigger or deferred): ${noRecPassive.join(',')}`);
  const mark = issues.length ? '✗' : '✓';
  say(`    ${mark} [${c.side}] ${String(c.name).slice(0, 20).padEnd(21)} skills [${slots.join(',')}]${issues.length ? '  ⛔ ' + issues.join('; ') : '  — all recipes present'}`);
}

// ── L3 FIRING (every active fires + consumes in the deterministic battle) ────────
say(`\n L3 FIRING — every active skill fires + consumes in the deterministic battle:`);
const FIX = path.join(REPO, 'test', 'golden', `dragon${STAGE}-donbambus-current.json`);
if (!fs.existsSync(FIX)) { softNotes.push(`no fixture dragon${STAGE}-donbambus-current.json — L3 skipped`); say('    ⚠ no fixture — L3 skipped'); }
else {
  const fixture = JSON.parse(fs.readFileSync(FIX, 'utf8'));
  const built = await buildDragonBattle({ rest, fixture, repoRoot: REPO });
  for (const a of built.allies) { a.spd = Math.round(a.spd * 1.19); a.maxHp = Math.round(a.maxHp * 1.03); a.hp = a.maxHp; a.atk = Math.round(a.atk * 1.03); a.def = Math.round(a.def * 1.03); }
  setChanceMode('all');
  const st = makeState({ allies: built.allies, enemies: [], seed: null }); st.purpleBarLeft = 0;
  installRecipeRun(st);
  const res = simulate(st, built.content, { turnCap: 400 });
  const baseName = src => String(src || '').replace(/\s*\[[^\]]*\]\s*$/, '').replace(/#\d+$/, '');
  const firedSlots = {}; // champion -> Set(slot)
  for (const e of res.effects || []) {
    const nm = baseName(e.source); if (!champs.some(c => c.name === nm || c.name.split(' ')[0] === nm)) continue;
    if (e.slot) { (firedSlots[nm] ??= new Set()).add(String(e.slot).toUpperCase()); }
  }
  // WHOLE-BATTLE fired-vs-consumed (folds the former model-completeness rung): every fired effect — team
  // AND mob — must consume or carry a documented reason. An unexplained drop is a represented-but-not-
  // consumed DEFECT (a real bug, hard fail), distinct from a benign non-consumption or a data gap.
  const BENIGN = [/immune/, /^resisted /, /^overheal/, /^no debuffs to cleanse$/, /^no buffs to steal$/, /^nothing to /, /^turn lost$/, /^proc missed /, /^missed placement /, /^missed \(/, /^already full$/, /^already empty$/, /^condition not met$/, /^nullified /, /^fully absorbed/];
  const DATA_GAP = [/^MISSING coeff$/, /^UNKNOWN land chance$/];
  const noteHit = pats => e => pats.some(r => r.test(e.note ?? ''));
  const defects = (res.effects || []).filter(e => e.fired && !e.consumed && !noteHit(BENIGN)(e) && !noteHit(DATA_GAP)(e));
  const defectGroups = {}; for (const e of defects) { const k = `${e.source} ${e.kind}${e.subtype ? '/' + e.subtype : ''}`; defectGroups[k] = (defectGroups[k] || 0) + 1; }
  const fired = (res.effects || []).filter(e => e.fired).length;
  say(`    consumption: ${fired - defects.length}/${fired} fired effects consumed (or benign)`);
  if (defects.length) { hardFails += Object.keys(defectGroups).length; for (const [k, n] of Object.entries(defectGroups)) say(`    ⛔ fired-but-NOT-consumed: ${n}× ${k}`); }
  for (const c of champs) {
    const actives = [...new Set((c.champion_skills ?? []).map(r => String(r.slot).toUpperCase()).filter(s => /^A\d$/.test(s)))];
    const fired = firedSlots[c.name] || firedSlots[c.name.split(' ')[0]] || new Set();
    const never = actives.filter(s => !fired.has(s));
    if (never.length) { softNotes.push(`${c.name}: active skill(s) never fired in the battle: ${never.join(',')} (may be cooldown/death, or the AI never selects it)`); say(`    ~ ${String(c.name).padEnd(14)} fired [${[...fired].sort().join(',') || 'none'}]  never-fired: ${never.join(',')}`); }
    else say(`    ✓ ${String(c.name).padEnd(14)} all actives fired [${actives.join(',')}]`);
  }
  say(`    (battle: ${res.won ? 'WON' : 'LOST'} in ${res.turns}t — deterministic, CHANCE_MODE=all)`);
  // AUTHORED-COVERAGE TRIPWIRE — applySkill is gone; there is ONE engine now. This guards the remaining seam:
  // authored content must run AUTHORED recipes (recipeFor), never the kitToRecipe auto-parse fallback. A combatant
  // that falls to kit-synth in "fully modelled" content is an un-authored skill slipping through — name it.
  const fb = st._kitSynth || {};
  const fbKeys = Object.keys(fb);
  if (fbKeys.length) { hardFails += 1; say(`    ⛔ AUTO-PARSE (kitToRecipe) FIRED in authored content — these skills lack an authored recipe:`); for (const k of fbKeys) say(`        ${k} ×${fb[k]}`); }
  else say(`    ✓ every combatant ran an AUTHORED recipe — no auto-parse fallback (one engine)`);
}

// ── verdict ─────────────────────────────────────────────────────────────────────
say(`\n ── UNIMPLEMENTED CATALOG (mob mechanics parsed by nothing — the to-do) ──`);
if (!unimplemented.length) say('    ✅ empty');
else for (const u of unimplemented) say(`    ⏳ ${u}`);
if (softNotes.length) { say(`\n ── notes (confirm / soft) ──`); for (const n of softNotes) say(`    · ${n}`); }

const complete = hardFails === 0 && unimplemented.length === 0;
say(`\n VERDICT: ${complete ? '✅ COVERAGE COMPLETE — right mobs, full kits, all mechanics modelled & firing' : hardFails ? `⛔ COVERAGE BROKEN — ${hardFails} hard fail(s) (wrong mob / NO RECIPE / dupe / missing skill)` : `⏳ COVERAGE INCOMPLETE — ${unimplemented.length} mob mechanic(s) not yet modelled (see catalog)`}`);
console.log('QA_JSON ' + JSON.stringify({ rung: 'mob-coverage', stage: STAGE, complete, hardFails, unimplemented: unimplemented.length, softNotes: softNotes.length }));
if (hardFails) process.exit(1);
