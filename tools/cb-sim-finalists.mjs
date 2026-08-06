// tools/cb-sim-finalists.mjs — Archetype Selector Stage 7: SIMULATE the finalist teams and rank them by
// actual banked damage + survival. The deterministic layer (Stages 3-6) prunes to finalists; the SIM is
// the arbiter (POOL SELECTS, SIMULATOR VALIDATES). This is where the value-based picks get PROVEN — if a
// team is genuinely better it banks more DoT and survives to the wall.
//
// Flow: build profiles → feasibility → generateTeams (value-ranked) → take topN finalists → regenerate
// their exact builds from the live Gestal sync (tools/build-from-sync.mjs) → for each finalist construct a
// runtime fixture and run lib/sim/clan_boss.js (via buildBattle) over N seeds → rank by median confirmed DoT.
//
// Usage: node --env-file=.env.local tools/cb-sim-finalists.mjs [accountPrefix=DonaHilvi] [difficulty=Hard] [topN=5] [seeds=3]
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execFileSync } from 'child_process';
import { buildUserChampions } from '../lib/gestal-context.js';
import { usabilityTier } from '../lib/match-engine.js';
import { capabilityProfile } from '../lib/capability-profile.js';
import { archetypeById } from '../lib/archetypes/clan-boss.js';
import { assessFeasibility } from '../lib/selection/feasibility.js';
import { generateTeams } from '../lib/selection/candidate-generator.js';
import { selectLeader, leaderAuraLayer } from '../lib/selection/leader.js';
import { CB_ACC_FLOOR } from '../lib/cb-shadow-goals.js';
import { makeState, simulate } from '../lib/sim/engine.js';
import { buildBattle, applyBattleLayers } from '../lib/sim/dragon-fixture.js';
import { installRecipeRun } from '../lib/sim/interpreter.js';

if (!process.env.SUPABASE_URL) { console.log('no DB — run with --env-file=.env.local'); process.exit(0); }
const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = process.env.SUPABASE_URL.replace(/\/rest\/v1\/?$/, '');
const Hh = { apikey: process.env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}` };
const _c = new Map();
const rest = async p => { if (!_c.has(p)) _c.set(p, await (await fetch(`${BASE}/rest/v1/${p}`, { headers: Hh })).json()); return _c.get(p); };
const fmt = n => Math.round(Number(n) || 0).toLocaleString();
const median = a => { const s = [...a].sort((x, y) => x - y); return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2; };

const acctPrefix = process.argv[2] || 'DonaHilvi';
const difficulty = process.argv[3] || 'Hard';
const topN = Number(process.argv[4] || 5);
const seeds = Number(process.argv[5] || 3);
const arch = archetypeById('poison_sustain');

// ── selection (Stages 3-6) ──
let db = []; for (let o = 0; ; o += 1000) { const d = await rest(`champions?select=id,name,type_id,rarity,affinity,base_spd,champion_tags(status,tags(name)),champion_skills(slot,skill_name,cooldown_base,cooldown_booked,skill_summary),champion_auras(aura_type,aura_value,aura_area,aura_restriction,aura_summary)&game_id=eq.raid_shadow_legends&limit=1000&offset=${o}`); if (!d.length) break; db = db.concat(d); if (d.length < 1000) break; }
const dbByName = Object.fromEntries(db.map(c => [c.name, c]));
const aurasByChampId = Object.fromEntries(db.map(c => [c.id, c.champion_auras ?? []]));
let aliasRows = []; for (let o = 0; ; o += 1000) { const d = await rest(`champion_aliases?select=alias,champion_id&limit=1000&offset=${o}`); if (!d.length) break; aliasRows = aliasRows.concat(d); if (d.length < 1000) break; }
const tagRows = await rest('tags?select=name,is_debuff,bypasses_accuracy_check');
const tagMeta = Object.fromEntries((tagRows || []).map(t => [t.name, { is_debuff: t.is_debuff, bypasses_accuracy_check: t.bypasses_accuracy_check }]));
let cst = []; for (let o = 0; ; o += 1000) { const d = await rest(`champion_skill_tags?select=champion_id,skill_slot,magnitude_pct,stacks,duration_turns,hits,condition,chance_unbooked,tags(name)&status=eq.approved&limit=1000&offset=${o}`); if (!d.length) break; cst = cst.concat(d); if (d.length < 1000) break; }
const stByChamp = {}; for (const r of cst) (stByChamp[r.champion_id] ??= []).push({ tag: r.tags?.name, slot: r.skill_slot, magnitude_pct: r.magnitude_pct, stacks: r.stacks, duration_turns: r.duration_turns, hits: r.hits, condition: r.condition, chance_unbooked: r.chance_unbooked });

const file = fs.readdirSync(path.join(REPO, 'gestal-sync/output')).find(x => x.toLowerCase().startsWith(acctPrefix.toLowerCase()) && x.endsWith('.json'));
if (!file) { console.log('no account file for', acctPrefix); process.exit(0); }
const acctId = file.replace('.json', '').split('_').pop();
const snap = JSON.parse(fs.readFileSync(path.join(REPO, 'gestal-sync/output', file), 'utf8'));
const { userChampions } = buildUserChampions(snap.champions ?? [], db, aliasRows);
const pool = userChampions.filter(uc => usabilityTier(uc) >= 2);
const rosterProfiles = pool.map(uc => {
  const c = uc.champion;
  const tags = (c.champion_tags || []).filter(t => t.status === 'approved').map(t => t.tags?.name).filter(Boolean);
  const champ = { name: c.name, affinity: c.affinity, level: uc.level, stars: uc.stars, has_boss_mastery: uc.has_boss_mastery, mastery_tier: uc.mastery_tier, book_fraction: uc.book_fraction, is_booked: uc.is_booked, assume_booked: (uc.is_booked || c.rarity === 'Rare'), tags };
  return { name: c.name, profile: capabilityProfile(champ, { skillTags: stByChamp[c.id] || [], skillRows: c.champion_skills || [], tagMeta, bossAffinity: null }) };
});
const feas = assessFeasibility(rosterProfiles, arch);
if (!feas.feasible) { console.log(`${file.split('_')[0]} NOT feasible for ${arch.label} — missing: ${feas.missing.join(', ')}`); process.exit(0); }
const { teams } = generateTeams(rosterProfiles, arch, feas, { K: 6, cap: 2000 });
const finalists = teams.sort((a, b) => b.value - a.value).slice(0, topN);
console.log(`\n### ${file.split('_')[0]} — ${arch.label} ${difficulty}: ${finalists.length} finalists → SIM ###`);

// ── regenerate builds for the union of finalist champs from the live sync ──
const union = [...new Set(finalists.flatMap(t => t.members))];
const buildRel = `data/observed-builds/_cb_finalists_${acctId}.json`;
try {
  const out = execFileSync('node', [path.join(REPO, 'tools/build-from-sync.mjs'), acctId, union.join(',')], { cwd: REPO, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  fs.writeFileSync(path.join(REPO, buildRel), out);
} catch (e) { console.log('build-from-sync failed:', e.message); process.exit(1); }
const builtNames = new Set((JSON.parse(fs.readFileSync(path.join(REPO, buildRel), 'utf8')).champions || []).map(c => c.name));
const missingBuilds = union.filter(n => !builtNames.has(n));
if (missingBuilds.length) console.log(`⚠ no build for: ${missingBuilds.join(', ')} — teams needing them will be skipped`);

// ── sim each finalist over N seeds ──
const TURN_CAP = Number(process.env.SIM_CB_TURNCAP ?? 600);
async function simTeam(members) {
  // Select the LEADER (its aura) for this exact team, then apply it in the sim (SPD aura → more turns →
  // more DoT; ACC aura → landing). Only the leader's aura is live in RSL.
  const teamChamps = members.map(n => dbByName[n]).filter(Boolean);
  const leader = selectLeader(teamChamps, aurasByChampId, { contentArea: 'clan_boss', accFloor: CB_ACC_FLOOR[difficulty] ?? 0 });
  const fixture = {
    content: { dungeon: 'Clan Boss', difficulty, affinity: 'Void', bossAtk: null },
    battle_layers: { auraSpdPct: 0, arenaPct: 0.03, accAura: 0, leaderAura: leaderAuraLayer(leader) },
    team: members, roster: Object.fromEntries(members.map(n => [n, n])),
    inputs: Object.fromEntries(members.map(n => [n, { build: buildRel }])),
  };
  const dot = [], surv = [], direct = [];
  for (let s = 1; s <= seeds; s++) {
    const built = await buildBattle({ rest, fixture, repoRoot: REPO });
    if (built.skip) return { skip: built.skip };
    applyBattleLayers(built.allies, fixture.battle_layers);
    const st = makeState({ allies: built.allies, enemies: [], seed: s });
    installRecipeRun(st);
    const res = simulate(st, built.content, { turnCap: TURN_CAP });
    const led = st.cbLedger || { poisonExact: 0, hpBurnExact: 0 };
    const d = Math.round(led.poisonExact + led.hpBurnExact);
    dot.push(d); surv.push(res.survivors.length); direct.push(Math.max(0, Math.round((st.cbDamageToBoss ?? 0) - d)));
  }
  const ldr = leader ? `${leader.name} (${leader.aura_type} ${leader.aura_value})` : 'none';
  return { dot: median(dot), surv: median(surv), direct: median(direct), leader: ldr };
}

const results = [];
for (const t of finalists) {
  if (t.members.some(n => missingBuilds.includes(n))) { results.push({ t, skip: 'missing build' }); continue; }
  const r = await simTeam(t.members);
  results.push({ t, ...r });
}
results.sort((a, b) => (b.dot ?? -1) - (a.dot ?? -1));

console.log(`(${seeds} seeds each; ranked by median confirmed DoT banked to the wall)\n`);
for (const [i, r] of results.entries()) {
  if (r.skip) { console.log(`#${i + 1}  [skipped: ${r.skip}]  ${r.t.members.join(', ')}`); continue; }
  console.log(`#${i + 1}  DoT ${fmt(r.dot)}  survivors ${r.surv}/5  (direct≤${fmt(r.direct)}, selValue ${r.t.value.toFixed(2)})`);
  console.log(`     ${r.t.members.join(', ')}`);
  console.log(`     leader: ${r.leader}`);
}
try { fs.unlinkSync(path.join(REPO, buildRel)); } catch {}
