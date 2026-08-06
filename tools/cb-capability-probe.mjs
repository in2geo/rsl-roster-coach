// tools/cb-capability-probe.mjs — print the magnitude-aware capability profile for one or more champions.
// Diagnostic for lib/capability-profile.js (Archetype Selector Stage 3). Assumes a MAXED build
// (level 60 / 6★ / booked) so the output isolates the KIT's capabilities from any account's build state.
//
// Usage: node --env-file=.env.local tools/cb-capability-probe.mjs "Xenomorph" "Fahrakin the Fat" ...
import { loadNameResolverRest } from '../lib/champion-names.js';
import { capabilityProfile } from '../lib/capability-profile.js';

if (!process.env.SUPABASE_URL) { console.log('no DB — run with --env-file=.env.local'); process.exit(0); }
const BASE = process.env.SUPABASE_URL.replace(/\/rest\/v1\/?$/, '');
const H = { apikey: process.env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}` };
const rest = async p => (await fetch(`${BASE}/rest/v1/${p}`, { headers: H })).json();

const names = process.argv.slice(2);
if (!names.length) { console.log('pass champion names'); process.exit(0); }

const resolver = await loadNameResolverRest(rest);
const tagRows = await rest('tags?select=name,is_debuff,bypasses_accuracy_check');
const tagMeta = Object.fromEntries((tagRows || []).map(t => [t.name, { is_debuff: t.is_debuff, bypasses_accuracy_check: t.bypasses_accuracy_check }]));

for (const input of names) {
  const hit = resolver.resolve(input);
  if (!hit) { console.log(`\n${input}: UNRESOLVED`); continue; }
  const [champRow] = await rest(`champions?select=id,name,affinity,champion_tags(status,tags(name)),champion_skills(slot,skill_name,cooldown_base,cooldown_booked,skill_summary)&id=eq.${hit.id}`);
  const stRows = await rest(`champion_skill_tags?select=skill_slot,magnitude_pct,stacks,duration_turns,hits,condition,chance_unbooked,tags(name)&status=eq.approved&champion_id=eq.${hit.id}`);
  const flatTags = (champRow.champion_tags || []).filter(t => t.status === 'approved').map(t => t.tags?.name).filter(Boolean);
  const skillTags = (stRows || []).map(r => ({ tag: r.tags?.name, slot: r.skill_slot, magnitude_pct: r.magnitude_pct,
    stacks: r.stacks, duration_turns: r.duration_turns, hits: r.hits, condition: r.condition, chance_unbooked: r.chance_unbooked }));
  // MAXED nominal build so coverage reflects the kit, not an account's development.
  const champ = { name: champRow.name, affinity: champRow.affinity, level: 60, stars: 6,
    has_boss_mastery: true, mastery_tier: 'Complete', book_fraction: 1, is_booked: true, assume_booked: true, tags: flatTags };
  const profile = capabilityProfile(champ, { skillTags, skillRows: champRow.champion_skills || [], tagMeta, bossAffinity: null });

  const entries = Object.entries(profile).sort((a, b) => b[1].coverage - a[1].coverage);
  console.log(`\n══ ${champRow.name} (${champRow.affinity}) — ${entries.length} capabilities [maxed build] ══`);
  for (const [cap, v] of entries) {
    const mag = v.magnitude != null ? `${v.magnitude}${v.stacks && v.stacks > 1 ? `×${v.stacks}` : ''}` : '—';
    console.log(`  ${cap.padEnd(18)} cov ${v.coverage.toFixed(2)}  mag ${String(mag).padEnd(6)} ${v.scope.padEnd(11)} ${v.accGated ? 'ACC-gated ' : ''}[${v.source}]`);
  }
}
