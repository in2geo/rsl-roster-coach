// tools/debug-fk-rec.mjs — reproduce the live Fire Knight recommendation for a real account, to see
// WHICH stage the engine picks and WHY. Builds the roster from the Gestal snapshot + live champion tags
// (the same shape the app's roster query produces), then runs matchRoster.
//   node --env-file=.env.local tools/debug-fk-rec.mjs [AccountDisplayName=GuapoDonni] [content=fire_knight]
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import { matchRoster } from '../lib/match-engine.js';

const supabase = createClient((process.env.SUPABASE_URL ?? '').replace(/\/rest\/v1\/?$/, ''), process.env.SUPABASE_SERVICE_KEY, { global: { fetch } });
const want = process.argv[2] || 'GuapoDonni';
const content = process.argv[3] || 'fire_knight';

const dir = 'gestal-sync/output';
const file = fs.readdirSync(dir).find(f => f.includes(want) && f.endsWith('.json') && !f.startsWith('gear-corpus'));
const snap = JSON.parse(fs.readFileSync(`${dir}/${file}`, 'utf8'));

// all champions with approved tags + base stats, indexed by type_id and name
const { data: champs } = await supabase.from('champions')
  .select('id,name,type_id,rarity,faction,affinity,base_hp,base_atk,base_def,base_spd,base_acc,base_res,champion_tags(tag_id,status,tags(name,bypasses_accuracy_check))')
  .eq('game_id', 'raid_shadow_legends');
const byType = {}, byName = {};
for (const c of champs) { if (c.type_id != null) byType[c.type_id] = c; byName[c.name.toLowerCase()] = c; }

const RANK = { Mythical: 6, Legendary: 5, Epic: 4, Rare: 3 };
const gearTierFor = (c) => c.level >= 60 && (c.stars || 0) >= 6 ? 'Strong' : c.level >= 50 ? 'Dungeon' : 'Starter';
const roster = [];
for (const c of snap.champions ?? []) {
  if (!RANK[c.rarity]) continue;
  const champ = byType[c.baseTypeId] ?? byName[(c.name || '').toLowerCase()];
  if (!champ) continue;
  roster.push({
    id: `${c.heroId}`, level: c.level, stars: c.stars, ascension_level: c.ascensionLevel ?? (c.stars ? c.stars - 1 : 0),
    gear_tier: gearTierFor(c), mastery_tier: 'None', is_booked: c.rarity === 'Rare', awakening_level: c.awakenLevel ?? 0,
    champion: champ,
  });
}
console.log(`Roster: ${roster.length} Rare+ champs resolved for ${snap.displayName}\n`);

const r = await matchRoster(roster, content);
console.log(`=== ${content} recommendation ===`);
console.log(`  STAGE: ${r.stage_number_attempted ?? r.stageLabel ?? r.stageNumber}  | notReady: ${r.notReady}  | verdict: ${r.verdict_band}  | confidence: ${r.confidence_pct}`);
console.log(`  data_warning: ${r.data_warning || '(none)'}`);
console.log(`  team (${(r.team || []).length}): ${(r.team || []).map(c => c.name).join(', ')}`);
console.log(`\n  goal coverage:`);
for (const g of Object.values(r.coverage || {})) console.log(`    ${g.satisfied ? '✓' : '✗'} ${g.description}${g.satisfied ? '' : `  (${g.total_solutions} solution(s), none matched)`}`);
if ((r.gaps || []).length) console.log(`\n  gaps: ${r.gaps.join(' | ')}`);
console.log(`\n  thresholds:`);
for (const t of r.threshold_results || []) console.log(`    ${t.passes === true ? '✓' : t.passes === false ? '✗' : '~'} ${t.stat?.toUpperCase()} need ${t.threshold_value ?? '?'} team ${t.estimated_value ?? '?'}`);
console.log(`\n  full result keys: ${Object.keys(r).join(', ')}`);
