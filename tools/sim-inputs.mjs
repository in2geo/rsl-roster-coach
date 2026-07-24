// tools/sim-inputs.mjs — BATTLE-START STAT SNAPSHOT (the sim's INPUTS, not its behavior).
//
// Dumps every champion's stats EXACTLY as the sim builds them at t0 — effective stats, affinity, gear
// sets, derived lifesteal, and the leader aura folded in — so you can diff the sim's inputs against the
// in-game build / Total-Stats screen. This is the verification surface: if the sim's Pelops shows
// "Perception" + lifesteal 0% while the game shows Lifesteal, the INPUT PIPELINE is wrong, not the engine.
// (Sibling to sim-snapshot.mjs, which fingerprints engine BEHAVIOR; this dumps engine INPUTS.)
//
// Run: node --env-file=.env.local tools/sim-inputs.mjs [accountMatch=Bambus] [stage=16]

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { readSkillKit, gearLifesteal } from '../lib/sim/ai.js';
import { buildUserChampions, fetchAliasRows } from '../lib/gestal-context.js';
import { mapRoster, pickLeaderFrom, applyLeaderAura } from '../lib/match-engine.js';
import { buildRosterIndex, loadNameResolverRest } from '../lib/champion-names.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname, '..');
const ACCT = process.argv[2] && !/^\d+$/.test(process.argv[2]) ? process.argv[2] : 'Bambus';
const STAGE = Number(process.argv.find((a, i) => i >= 2 && /^\d+$/.test(a)) ?? 16);

if (!process.env.SUPABASE_URL) { console.log('needs --env-file=.env.local'); process.exit(2); }
const BASE = process.env.SUPABASE_URL.replace(/\/rest\/v1\/?$/, '');
const H = { apikey: process.env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}` };
const rest = async p => (await fetch(`${BASE}/rest/v1/${p}`, { headers: H })).json();

const SEL = 'id,name,type_id,rarity,affinity,base_hp,base_atk,base_def,base_spd,base_acc,base_res,base_crit_rate,base_crit_dmg,'
  + 'champion_tags(tag_id,status,tags(name)),champion_skills(slot,skill_name,skill_summary,cooldown_base,cooldown_booked,damage_multiplier,multiplier_type)';
let db = [];
for (let f = 0; ; f += 1000) { const d = await rest(`champions?select=${encodeURIComponent(SEL)}&game_id=eq.raid_shadow_legends&limit=1000&offset=${f}`); if (!Array.isArray(d) || !d.length) break; db = db.concat(d); if (d.length < 1000) break; }
const aliasRows = await fetchAliasRows(rest);
const nameResolver = await loadNameResolverRest(rest);
const auraRows = await rest('champion_auras?select=champion_id,aura_type,aura_value,aura_area,aura_restriction,aura_summary');

// account snapshot → gear sets per champion (for gear/lifesteal display)
const snapFile = fs.readdirSync(path.join(REPO, 'gestal-sync/output')).find(x => x.toLowerCase().includes(ACCT.toLowerCase()) && x.endsWith('.json'));
if (!snapFile) { console.log(`no gestal snapshot matching "${ACCT}"`); process.exit(2); }
const snap = JSON.parse(fs.readFileSync(path.join(REPO, 'gestal-sync/output', snapFile), 'utf8'));
const gearByName = {};
for (const c of snap.champions ?? []) {
  const sets = {}; for (const a of c.equippedArtifacts ?? []) if (a.set) sets[a.set] = (sets[a.set] ?? 0) + 1;
  gearByName[c.name] = { sets, setNames: Object.entries(sets).filter(([, n]) => n >= 2).map(([s]) => s) };
}
const { userChampions } = buildUserChampions(snap.champions ?? [], db, aliasRows);
const roster = buildRosterIndex(mapRoster(userChampions, {}).mapped, nameResolver);

// team = the most recent Dragon-16 run for this account that resolves to a FULL five (skip partial captures)
const runs = await rest('run_reconciliations?select=display_name,content,team_fielded&order=battle_captured_at.desc&limit=500');
const d16runs = runs.filter(r => new RegExp(ACCT, 'i').test(r.display_name ?? '') && new RegExp(`Dragon.*Stage ${STAGE}$`, 'i').test(String(r.content ?? '')) && r.team_fielded);
let team = [];
for (const r of d16runs) {
  let tf = r.team_fielded; if (typeof tf === 'string') { try { tf = JSON.parse(tf); } catch { tf = []; } }
  const t = (tf ?? []).map(h => roster.get(h.name)).filter(Boolean);
  if (t.length > team.length) team = t;
  if (team.length >= 5) break;                       // full five — good enough, stop at the most recent
}
if (team.length < 3) { console.log(`no resolvable Dragon-${STAGE} team for ${ACCT} (checked ${d16runs.length} runs; best resolved ${team.length})`); process.exit(2); }

// aura, then the ally rows exactly as sim-suite builds them
const teamAuras = auraRows.filter(a => team.some(c => c.id === a.champion_id));
const leader = pickLeaderFrom(team, teamAuras, { contentArea: 'dungeon', thresholdStats: ['acc', 'res'] });
const auraTeam = applyLeaderAura(team, leader);

const pad = (v, n) => String(v ?? '').padStart(n);
console.log(`\n══ SIM INPUTS ══  ${ACCT}  ·  Dragon's Lair Stage ${STAGE}  ·  source ${snapFile}`);
console.log(`   gestal extracted: ${snap.lastSnapshotAt}`);
console.log(`   leader aura: ${leader ? `${leader.name} — ${leader.aura_type} ${leader.aura_value} (${leader.aura_area})` : '(none)'}\n`);
console.log('   name           aff    HP     ATK   DEF   SPD pre→aura   ACC  RES  C.R C.D  lifesteal  gear (as sim sees it)');
for (let i = 0; i < auraTeam.length; i++) {
  const es = auraTeam[i].estimated_stats ?? {}, base = team[i].estimated_stats ?? {};
  const g = gearByName[auraTeam[i].name] ?? gearByName[team[i].name] ?? { sets: {}, setNames: [] };
  const ls = gearLifesteal(g.setNames);
  const cr = es.crit_rate ?? es.crate, cd = es.crit_dmg ?? es.cdmg;
  const sets = Object.entries(g.sets).map(([s, n]) => `${s}×${n}`).join(' ');
  console.log(`   ${auraTeam[i].name.slice(0,13).padEnd(13)} ${String(auraTeam[i].affinity ?? '').slice(0,5).padEnd(5)} ${pad(es.hp,6)} ${pad(es.atk,5)} ${pad(es.def,5)} ${pad(base.spd,4)}→${pad(es.spd,4)}    ${pad(es.acc,4)} ${pad(es.res,4)} ${pad(cr,3)} ${pad(cd,3)}  ${pad((ls*100).toFixed(0)+'%',6)}     ${sets}`);
}
console.log('\n   ▶ diff against the in-game Total-Stats / build screen. lifesteal 0% or a wrong set = INPUT-pipeline bug (stale/mis-mapped gear), not the engine.\n');
