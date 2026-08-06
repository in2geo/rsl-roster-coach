// tools/cb-archetype-probe.mjs — Archetype Selector Stages 3-4 end-to-end: build capability profiles for
// each account's CB pool and test which accounts can COMPLETE a CB archetype (default poison_sustain).
//
// Usage: node --env-file=.env.local tools/cb-archetype-probe.mjs [archetypeId] [accountPrefix]
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildUserChampions } from '../lib/gestal-context.js';
import { usabilityTier } from '../lib/match-engine.js';
import { capabilityProfile } from '../lib/capability-profile.js';
import { archetypeById, CLAN_BOSS_ARCHETYPES } from '../lib/archetypes/clan-boss.js';
import { assessFeasibility } from '../lib/selection/feasibility.js';

if (!process.env.SUPABASE_URL) { console.log('no DB — run with --env-file=.env.local'); process.exit(0); }
const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = process.env.SUPABASE_URL.replace(/\/rest\/v1\/?$/, '');
const H = { apikey: process.env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}` };
const rest = async p => (await fetch(`${BASE}/rest/v1/${p}`, { headers: H })).json();

const archId = process.argv[2] || 'poison_sustain';
const acctFilter = process.argv[3] || '';
const arch = archetypeById(archId);
if (!arch) { console.log('unknown archetype:', archId, '— have:', CLAN_BOSS_ARCHETYPES.map(a => a.id).join(', ')); process.exit(0); }

let db = []; for (let o = 0; ; o += 1000) { const d = await rest(`champions?select=id,name,type_id,rarity,affinity,base_spd,champion_tags(status,tags(name)),champion_skills(slot,skill_name,cooldown_base,cooldown_booked,skill_summary)&game_id=eq.raid_shadow_legends&limit=1000&offset=${o}`); if (!d.length) break; db = db.concat(d); if (d.length < 1000) break; }
let aliasRows = []; for (let o = 0; ; o += 1000) { const d = await rest(`champion_aliases?select=alias,champion_id&limit=1000&offset=${o}`); if (!d.length) break; aliasRows = aliasRows.concat(d); if (d.length < 1000) break; }
const tagRows = await rest('tags?select=name,is_debuff,bypasses_accuracy_check');
const tagMeta = Object.fromEntries((tagRows || []).map(t => [t.name, { is_debuff: t.is_debuff, bypasses_accuracy_check: t.bypasses_accuracy_check }]));
let cst = []; for (let o = 0; ; o += 1000) { const d = await rest(`champion_skill_tags?select=champion_id,skill_slot,magnitude_pct,stacks,duration_turns,hits,condition,chance_unbooked,tags(name)&status=eq.approved&limit=1000&offset=${o}`); if (!d.length) break; cst = cst.concat(d); if (d.length < 1000) break; }
const stByChamp = {};
for (const r of cst) (stByChamp[r.champion_id] ??= []).push({ tag: r.tags?.name, slot: r.skill_slot, magnitude_pct: r.magnitude_pct, stacks: r.stacks, duration_turns: r.duration_turns, hits: r.hits, condition: r.condition, chance_unbooked: r.chance_unbooked });

console.log(`\n### Archetype feasibility: ${arch.label} (${arch.id}) ###\n`);
for (const f of fs.readdirSync(path.join(REPO, 'gestal-sync/output')).filter(x => x.endsWith('.json') && !/^gear/.test(x))) {
  const acct = f.split('_')[0];
  if (acctFilter && !acct.toLowerCase().includes(acctFilter.toLowerCase())) continue;
  const snap = JSON.parse(fs.readFileSync(path.join(REPO, 'gestal-sync/output', f), 'utf8'));
  const { userChampions } = buildUserChampions(snap.champions ?? [], db, aliasRows);
  const pool = userChampions.filter(uc => usabilityTier(uc) >= 2);
  const profiles = pool.map(uc => {
    const c = uc.champion;
    const tags = (c.champion_tags || []).filter(t => t.status === 'approved').map(t => t.tags?.name).filter(Boolean);
    const champ = { name: c.name, affinity: c.affinity, level: uc.level, stars: uc.stars,
      has_boss_mastery: uc.has_boss_mastery, mastery_tier: uc.mastery_tier, book_fraction: uc.book_fraction,
      is_booked: uc.is_booked, assume_booked: (uc.is_booked || c.rarity === 'Rare'), tags };
    return { name: c.name, profile: capabilityProfile(champ, { skillTags: stByChamp[c.id] || [], skillRows: c.champion_skills || [], tagMeta, bossAffinity: null }) };
  });
  const r = assessFeasibility(profiles, arch);
  console.log(`══ ${acct} (pool ${pool.length}) — ${r.feasible ? 'FEASIBLE ✅' : 'NOT feasible ❌ (missing: ' + r.missing.join(', ') + ')'}`);
  for (const req of r.requirements) {
    if (req.kind === 'budget') {
      const comps = req.components.map(c => `${c.key} ${(c.best?.coverage ?? 0).toFixed(2)}${c.best ? '(' + c.best.name + ')' : ''}`).join(' + ');
      console.log(`   ${req.met ? '✓' : '✗'} ${req.key.padEnd(22)} budget ${req.rosterMax.toFixed(2)}/${req.minTotal} = ${comps}`);
    } else {
      const top = req.candidates.slice(0, 3).map(c => `${c.name}[${c.cap} ${c.coverage.toFixed(2)}]`).join(', ');
      console.log(`   ${req.met ? '✓' : '✗'} ${req.key.padEnd(22)} (${req.candidates.length}) ${top || '— none ≥ ' + req.minScore}`);
    }
  }
  console.log('');
}
