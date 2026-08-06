// tools/cb-team-select.mjs — Archetype Selector orchestrator (Stages 3-5, coarse rank).
// profiles → feasibility → generate valid teams → coarse coverage rank → print. Stage 6 (team-validator +
// proper team-score) and Stage 7 (simulate finalists via lib/sim/clan_boss.js) are the next steps.
//
// Usage: node --env-file=.env.local tools/cb-team-select.mjs [accountPrefix=DonaHilvi] [archetypeId=poison_sustain] [topN=8]
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildUserChampions } from '../lib/gestal-context.js';
import { usabilityTier } from '../lib/match-engine.js';
import { capabilityProfile } from '../lib/capability-profile.js';
import { archetypeById } from '../lib/archetypes/clan-boss.js';
import { assessFeasibility } from '../lib/selection/feasibility.js';
import { generateTeams } from '../lib/selection/candidate-generator.js';
import { champValue } from '../lib/selection/team-score.js';

if (!process.env.SUPABASE_URL) { console.log('no DB — run with --env-file=.env.local'); process.exit(0); }
const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = process.env.SUPABASE_URL.replace(/\/rest\/v1\/?$/, '');
const H = { apikey: process.env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}` };
const rest = async p => (await fetch(`${BASE}/rest/v1/${p}`, { headers: H })).json();

const acctPrefix = process.argv[2] || 'DonaHilvi';
const arch = archetypeById(process.argv[3] || 'poison_sustain');
const topN = Number(process.argv[4] || 8);

let db = []; for (let o = 0; ; o += 1000) { const d = await rest(`champions?select=id,name,type_id,rarity,affinity,base_spd,champion_tags(status,tags(name)),champion_skills(slot,skill_name,cooldown_base,cooldown_booked,skill_summary)&game_id=eq.raid_shadow_legends&limit=1000&offset=${o}`); if (!d.length) break; db = db.concat(d); if (d.length < 1000) break; }
let aliasRows = []; for (let o = 0; ; o += 1000) { const d = await rest(`champion_aliases?select=alias,champion_id&limit=1000&offset=${o}`); if (!d.length) break; aliasRows = aliasRows.concat(d); if (d.length < 1000) break; }
const tagRows = await rest('tags?select=name,is_debuff,bypasses_accuracy_check');
const tagMeta = Object.fromEntries((tagRows || []).map(t => [t.name, { is_debuff: t.is_debuff, bypasses_accuracy_check: t.bypasses_accuracy_check }]));
let cst = []; for (let o = 0; ; o += 1000) { const d = await rest(`champion_skill_tags?select=champion_id,skill_slot,magnitude_pct,stacks,duration_turns,hits,condition,chance_unbooked,tags(name)&status=eq.approved&limit=1000&offset=${o}`); if (!d.length) break; cst = cst.concat(d); if (d.length < 1000) break; }
const stByChamp = {};
for (const r of cst) (stByChamp[r.champion_id] ??= []).push({ tag: r.tags?.name, slot: r.skill_slot, magnitude_pct: r.magnitude_pct, stacks: r.stacks, duration_turns: r.duration_turns, hits: r.hits, condition: r.condition, chance_unbooked: r.chance_unbooked });

const file = fs.readdirSync(path.join(REPO, 'gestal-sync/output')).find(x => x.toLowerCase().startsWith(acctPrefix.toLowerCase()) && x.endsWith('.json'));
if (!file) { console.log('no account file for', acctPrefix); process.exit(0); }
const snap = JSON.parse(fs.readFileSync(path.join(REPO, 'gestal-sync/output', file), 'utf8'));
const { userChampions } = buildUserChampions(snap.champions ?? [], db, aliasRows);
const pool = userChampions.filter(uc => usabilityTier(uc) >= 2);
const rosterProfiles = pool.map(uc => {
  const c = uc.champion;
  const tags = (c.champion_tags || []).filter(t => t.status === 'approved').map(t => t.tags?.name).filter(Boolean);
  const champ = { name: c.name, affinity: c.affinity, level: uc.level, stars: uc.stars,
    has_boss_mastery: uc.has_boss_mastery, mastery_tier: uc.mastery_tier, book_fraction: uc.book_fraction,
    is_booked: uc.is_booked, assume_booked: (uc.is_booked || c.rarity === 'Rare'), tags };
  return { name: c.name, profile: capabilityProfile(champ, { skillTags: stByChamp[c.id] || [], skillRows: c.champion_skills || [], tagMeta, bossAffinity: null }) };
});

const feas = assessFeasibility(rosterProfiles, arch);
console.log(`\n### ${file.split('_')[0]} — ${arch.label} (pool ${pool.length}) ###`);
for (const r of feas.requirements) {
  if (r.kind === 'budget') {
    const comps = r.components.map(c => `${c.key} ${(c.best?.coverage ?? 0).toFixed(2)}${c.best ? '(' + c.best.name + ')' : ''}`).join(' + ');
    console.log(`   ${r.met ? '✓' : '✗'} ${r.key} budget ${r.rosterMax.toFixed(2)}/${r.minTotal}  = ${comps}`);
  } else {
    console.log(`   ${r.met ? '✓' : '✗'} ${r.key} (${r.candidates.length}) ${r.candidates.slice(0, 3).map(c => c.name + ' ' + c.coverage.toFixed(2)).join(', ')}`);
  }
}
if (!feas.feasible) { console.log(`\nNOT feasible — missing: ${feas.missing.join(', ')}`); process.exit(0); }

const profileByName = Object.fromEntries(rosterProfiles.map(c => [c.name, c.profile]));
// Roster champs ranked by VALUE (contribution to the CB objective) — the strongest surface here on merit.
const byValue = rosterProfiles.map(c => ({ name: c.name, v: champValue(c.profile) })).sort((a, b) => b.v - a.v);
console.log(`\ntop champs by value (contribution to objective): ${byValue.slice(0, 6).map(c => `${c.name} ${c.v.toFixed(2)}`).join(', ')}`);

const { teams, truncated, generated } = generateTeams(rosterProfiles, arch, feas, { K: 6, cap: 2000 });
if (truncated) console.log(`⚠ generation hit the cap of ${generated}+ teams (truncated)`);
const ranked = teams.sort((a, b) => b.value - a.value);

console.log(`\ngenerated ${generated} valid teams. Top ${Math.min(topN, ranked.length)} by team value (SIM is the final arbiter):\n`);
for (const [i, t] of ranked.slice(0, topN).entries()) {
  const mem = t.members.map(n => `${n}(${champValue(profileByName[n]).toFixed(2)})`).join(', ');
  console.log(`#${i + 1}  value ${t.value.toFixed(2)}  ${mem}`);
  const cov = Object.entries(t.coverage).map(([k, v]) => `${k}=${v ? v.by + ' ' + v.coverage.toFixed(2) : '—'}`).join(' · ');
  const bud = Object.entries(t.budgets || {}).map(([k, b]) => `${k} ${b.total.toFixed(2)} [${b.breakdown.map(c => c.key + ' ' + c.coverage.toFixed(2)).join('/')}]`).join(' · ');
  console.log(`     ${cov}`);
  if (bud) console.log(`     ${bud}`);
}
