// tools/shadow-construct.mjs — SHADOW run of the phase/add-aware team constructor.
// Builds a team from per-phase DB needs for Dragon/Spider/Ice Golem on the DonBrogni roster,
// prints need coverage, the realized team, and POTENTIAL builds (unbuilt champs that fill gaps).
// Validation target: does Criodan the Blue surface as an add-handling fill — cleanly for Dragon
// (wave) + Spider (spiderlings), and only PARTIALLY for IG (minions revive → needs kill, not lock)?
// Run: node tools/shadow-construct.mjs
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import { deriveNeeds, constructTeam, potentialBuilds } from '../lib/team-constructor.js';

const env = {};
for (const l of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, ''); }
const BASE = (env.SUPABASE_URL || '').replace(/\/rest\/v1\/?$/, '');
const H = { apikey: env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}` };
const rest = async (p) => (await fetch(`${BASE}/rest/v1/${p}`, { headers: H })).json();
process.env.SUPABASE_URL = env.SUPABASE_URL; process.env.SUPABASE_ANON_KEY = env.SUPABASE_ANON_KEY; process.env.SUPABASE_SERVICE_KEY = env.SUPABASE_SERVICE_KEY;
const supabase = createClient(BASE, env.SUPABASE_SERVICE_KEY);
const gc = await import('../lib/gestal-context.js');
const me = await import('../lib/match-engine.js');
const mr = await import('../lib/multiplier-rank.js');

// catalog (tags + auras) + roster
const SEL = 'id,name,type_id,rarity,role,affinity,faction,base_hp,base_atk,base_def,base_spd,base_acc,base_res,base_crit_rate,base_crit_dmg,champion_tags(tag_id,status,ascension_required,tags(name,is_debuff,bypasses_accuracy_check)),champion_auras(aura_type,aura_value,aura_area)';
let db = [];
for (let f = 0; ; f += 1000) { const d = await rest(`champions?select=${encodeURIComponent(SEL)}&game_id=eq.raid_shadow_legends&limit=1000&offset=${f}`); if (!Array.isArray(d) || !d.length) break; db = db.concat(d); if (d.length < 1000) break; }
const auraByName = new Map(db.map(c => [c.name, (c.champion_auras || [])]));
const snap = JSON.parse(fs.readFileSync('gestal-sync/output/DonBrogni_768ae0d91391eff5.json', 'utf8'));
const { userChampions } = gc.buildUserChampions(snap.champions, db);
const mapped = me.mapRoster(userChampions, { accountDev: 'fair' }).mapped;
try { await mr.attachDamageScores(mapped, supabase); } catch {}
for (const c of mapped) c.auras = auraByName.get(c.name) || [];

// build gate: "built" = usabilityTier >= 2 (Lv30+); tier 0-1 (Lv<30) = unbuilt/potential.
const isBuilt = (c) => me.usabilityTier(c) >= 2;
const eligible = isBuilt;

async function stageNeeds(dungeonName, stageNumber) {
  const dun = await rest(`dungeons?select=id&game_id=eq.raid_shadow_legends&name=eq.${encodeURIComponent(dungeonName)}`);
  const stages = await rest(`dungeon_stages?select=id,label,stage_number&dungeon_id=eq.${dun[0].id}`);
  // Resolve by exact number, else a "Stages X-Y" tier that contains it (Spider), else "Stage N".
  let st = stages.find(s => s.stage_number === stageNumber);
  if (!st) st = stages.find(s => { const m = (s.label || '').match(/Stages?\s+(\d+)\s*-\s*(\d+)/i); return m && stageNumber >= +m[1] && stageNumber <= +m[2]; });
  if (!st) st = stages.find(s => { const m = (s.label || '').match(/Stage\s+(\d+)/i); return m && +m[1] === stageNumber; });
  if (!st) throw new Error(`no stage row for ${dungeonName} ${stageNumber}`);
  const ph = await rest(`phases?select=id,phase_type&dungeon_stage_id=eq.${st.id}`);
  const phaseGoals = [];
  for (const p of ph) {
    const goals = await rest(`goals?select=description,is_informational,goal_solutions(status,goal_solution_tags(tags(name)))&phase_id=eq.${p.id}`);
    phaseGoals.push({ phase_type: p.phase_type, goals });
  }
  return phaseGoals;
}

const CRIO = 'Criodan the Blue';
for (const [dungeon, key, stage] of [["Dragon's Lair", 'dragon', 20], ["Spider's Den", 'spider', 18], ["Ice Golem's Peak", 'ice_golem', 20]]) {
  const phaseGoals = await stageNeeds(dungeon, stage);
  const needs = deriveNeeds(phaseGoals);
  const { team, leader, needCoverage } = constructTeam(mapped, needs, { contentKey: key, eligible });
  const pot = potentialBuilds(mapped, needs, team, { isBuilt, contentKey: key });

  console.log(`\n========== ${dungeon} — Stage ${stage} (${key}) ==========`);
  console.log('NEEDS (from DB, per phase):');
  for (const n of needCoverage) console.log(`  [${n.phase}/${n.role}] ${n.description.slice(0, 60)} ⟶ ${n.covered_by.length ? n.covered_by.join(', ') : '*** UNCOVERED ***'}`);
  console.log('REALIZED TEAM:', team.map(c => c.name).join(', '));
  console.log('LEADER:', leader ? `${leader.name} (${leader.aura})` : 'none with SPD aura');
  console.log('POTENTIAL BUILDS (unbuilt champs that fill gaps):');
  for (const p of pot.slice(0, 4)) console.log(`  • ${p.name} — fills: ${p.fills.map(f => `[${f.phase}] ${f.description.slice(0, 45)}`).join(' | ')}`);
  const crio = pot.find(p => p.name === CRIO);
  console.log(`  >>> Criodan the Blue: ${crio ? 'SURFACED — ' + crio.fills.map(f => `${f.kind}:[${f.phase}/${f.role}] (str ${f.strength} vs built ${f.builtBest})`).join('  ') : 'NOT surfaced (does not cover / upgrade any need — correct if his kit does not fit)'}`);
}
