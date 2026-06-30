/**
 * Applies seeds 01–05 to the live Supabase DB using the JS client.
 * Mirrors the SQL seed files exactly — same data, same conflict handling.
 * Safe to re-run: all inserts use upsert / ignoreDuplicates.
 *
 * Usage: node --env-file=.env.local tools/apply-seeds.js
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  (process.env.SUPABASE_URL ?? '').replace(/\/rest\/v1\/?$/, ''),
  process.env.SUPABASE_SERVICE_KEY,
  { global: { fetch } }
);

function ok(label, data)  { console.log(`  ✓ ${label}${data != null ? ` (${data})` : ''}`); }
function err(label, e)    { console.error(`  ✗ ${label}: ${e.message}`); process.exit(1); }
function section(title)   { console.log(`\n${'─'.repeat(60)}\n  ${title}\n${'─'.repeat(60)}`); }

// ── Seed 01 — Tag vocabulary ──────────────────────────────────────────────────

section('Seed 01 — Tags');

const TAGS = [
  { name: 'AoE Damage',              description: 'Attacks all enemies in a single hit or multi-hit AoE',    bypasses_accuracy_check: false },
  { name: 'Single Target Damage',    description: 'High single-target damage skill',                          bypasses_accuracy_check: false },
  { name: 'Decrease Defense',        description: 'Places [Decrease DEF] debuff',                             bypasses_accuracy_check: false },
  { name: 'Decrease Attack',         description: 'Places [Decrease ATK] debuff',                             bypasses_accuracy_check: false },
  { name: 'Decrease Speed',          description: 'Places [Decrease SPD] debuff',                             bypasses_accuracy_check: false },
  { name: 'Weaken',                  description: 'Places [Weaken] debuff',                                   bypasses_accuracy_check: false },
  { name: 'Poison',                  description: 'Places [Poison] debuff (% max HP / turn)',                 bypasses_accuracy_check: false },
  { name: 'HP Burn',                 description: 'Places [HP Burn] debuff',                                  bypasses_accuracy_check: false },
  { name: 'Stun',                    description: 'Places [Stun] crowd-control debuff',                       bypasses_accuracy_check: false },
  { name: 'Freeze',                  description: 'Places [Freeze] crowd-control debuff',                     bypasses_accuracy_check: false },
  { name: 'Sleep',                   description: 'Places [Sleep] crowd-control debuff',                      bypasses_accuracy_check: false },
  { name: 'AoE Stun',               description: 'Places [Stun] on all or random enemies',                   bypasses_accuracy_check: false },
  { name: 'AoE Freeze',             description: 'Places [Freeze] on all or random enemies',                 bypasses_accuracy_check: false },
  { name: 'AoE Sleep',              description: 'Places [Sleep] on all or random enemies',                  bypasses_accuracy_check: false },
  { name: 'Decrease Turn Meter',     description: "Reduces an enemy's Turn Meter",                            bypasses_accuracy_check: false },
  { name: 'AoE Decrease Turn Meter', description: "Reduces all enemies' Turn Meter",                         bypasses_accuracy_check: true  },
  { name: 'Increase Turn Meter',     description: "Fills an ally's Turn Meter",                               bypasses_accuracy_check: false },
  { name: 'Healer',                  description: 'Restores ally HP',                                         bypasses_accuracy_check: false },
  { name: 'Revive',                  description: 'Brings a dead ally back to life',                          bypasses_accuracy_check: false },
  { name: 'Shield',                  description: 'Places [Shield] buff on allies',                           bypasses_accuracy_check: false },
  { name: 'Block Damage',            description: 'Places [Block Damage] buff',                               bypasses_accuracy_check: false },
  { name: 'Block Debuffs',           description: 'Places [Block Debuffs] buff on allies',                    bypasses_accuracy_check: false },
  { name: 'Counterattack',           description: 'Places [Counterattack] buff on allies',                    bypasses_accuracy_check: false },
  { name: 'Increase Defense',        description: 'Places [Increase DEF] buff',                               bypasses_accuracy_check: false },
  { name: 'Increase Attack',         description: 'Places [Increase ATK] buff',                               bypasses_accuracy_check: false },
  { name: 'Increase Speed',          description: 'Places [Increase SPD] buff',                               bypasses_accuracy_check: false },
  { name: 'Cleanse',                 description: 'Removes debuffs from allies',                              bypasses_accuracy_check: false },
  { name: 'Ally Protection',         description: 'Redirects damage taken by allies',                         bypasses_accuracy_check: false },
  { name: 'Speed Aura',              description: 'Leader skill that raises ally SPD',                        bypasses_accuracy_check: false },
  { name: 'ATK Aura',               description: 'Leader skill that raises ally ATK',                        bypasses_accuracy_check: false },
  { name: 'DEF Aura',               description: 'Leader skill that raises ally DEF',                        bypasses_accuracy_check: false },
  { name: 'HP Aura',                description: 'Leader skill that raises ally HP',                         bypasses_accuracy_check: false },
];

{
  const { error } = await supabase.from('tags')
    .upsert(TAGS, { onConflict: 'name', ignoreDuplicates: true });
  if (error) err('tags upsert', error);
  ok(`${TAGS.length} tags upserted (on conflict do nothing)`);
}

// ── Seed 02 — Dungeon structure check ────────────────────────────────────────
// Dungeons, stages, phases, and Spider's Den goals were applied earlier
// (confirmed in test run). This step verifies Campaign + Clan Boss goals exist
// and reports their status without reinserting.

section('Seed 02 — Dungeon structure (verify existing)');

{
  const { data, error } = await supabase
    .from('goals')
    .select('description, phases(dungeon_stages(label, dungeons(name)))');
  if (error) err('goals check', error);

  const byDungeon = {};
  for (const g of data ?? []) {
    const name = g.phases?.dungeon_stages?.dungeons?.name ?? 'unknown';
    byDungeon[name] = (byDungeon[name] ?? 0) + 1;
  }
  for (const [dungeon, count] of Object.entries(byDungeon)) {
    ok(`${dungeon}: ${count} goal(s) in DB`);
  }
  if (!byDungeon["Spider's Den"]) {
    err('goals check', new Error("Spider's Den goals missing — apply seed 02 manually"));
  }
}

// ── Seed 03 — Champions ───────────────────────────────────────────────────────

section('Seed 03 — Champions');

const CHAMPIONS = [
  // Starter Epics
  { name: 'Kael',                  faction: 'Dark Elves',      affinity: 'Magic',  rarity: 'Epic',     source_citation: 'in-game Index' },
  { name: 'Elhain',                faction: 'High Elves',      affinity: 'Magic',  rarity: 'Epic',     source_citation: 'in-game Index' },
  { name: 'Athel',                 faction: 'Sacred Order',    affinity: 'Magic',  rarity: 'Epic',     source_citation: 'in-game Index' },
  { name: 'Galek',                 faction: 'Orcs',            affinity: 'Force',  rarity: 'Epic',     source_citation: 'in-game Index' },
  // Sacred Order
  { name: 'Warpriest',             faction: 'Sacred Order',    affinity: 'Force',  rarity: 'Rare',     source_citation: 'in-game Index' },
  { name: 'Relickeeper',           faction: 'Sacred Order',    affinity: 'Magic',  rarity: 'Rare',     source_citation: 'in-game Index' },
  { name: 'Adjudicator',           faction: 'Sacred Order',    affinity: 'Magic',  rarity: 'Uncommon', source_citation: 'in-game Index' },
  { name: 'Steel Bowyer',          faction: 'Sacred Order',    affinity: 'Spirit', rarity: 'Common',   source_citation: 'in-game Index' },
  // High Elves
  { name: 'Apothecary',            faction: 'High Elves',      affinity: 'Spirit', rarity: 'Rare',     source_citation: 'in-game Index' },
  { name: 'Elven Ranger',          faction: 'High Elves',      affinity: 'Force',  rarity: 'Uncommon', source_citation: 'in-game Index' },
  { name: 'Stout Axeman',          faction: 'High Elves',      affinity: 'Magic',  rarity: 'Common',   source_citation: 'in-game Index' },
  // Dark Elves
  { name: 'Executioner',           faction: 'Dark Elves',      affinity: 'Magic',  rarity: 'Rare',     source_citation: 'in-game Index' },
  { name: 'Spirithost',            faction: 'Dark Elves',      affinity: 'Void',   rarity: 'Rare',     source_citation: 'in-game Index' },
  { name: 'Hexweaver',             faction: 'Dark Elves',      affinity: 'Magic',  rarity: 'Uncommon', source_citation: 'in-game Index' },
  { name: 'Ranger',                faction: 'Dark Elves',      affinity: 'Spirit', rarity: 'Common',   source_citation: 'in-game Index' },
  // Demonspawn (listed as Orcs faction in seed)
  { name: 'Diabolist',             faction: 'Demonspawn',      affinity: 'Force',  rarity: 'Rare',     source_citation: 'in-game Index' },
  { name: 'Armiger',               faction: 'Demonspawn',      affinity: 'Magic',  rarity: 'Rare',     source_citation: 'in-game Index' },
  { name: 'Razorleaf',             faction: 'Demonspawn',      affinity: 'Force',  rarity: 'Uncommon', source_citation: 'in-game Index' },
  // Barbarians
  { name: 'Grizzled Jarl',         faction: 'Barbarians',      affinity: 'Spirit', rarity: 'Rare',     source_citation: 'in-game Index' },
  { name: 'Marked',                faction: 'Barbarians',      affinity: 'Force',  rarity: 'Uncommon', source_citation: 'in-game Index' },
  { name: 'Saurus',                faction: 'Barbarians',      affinity: 'Force',  rarity: 'Common',   source_citation: 'in-game Index' },
  // Ogryn Tribes / Banner Lords
  { name: 'Skullcrusher',          faction: 'Ogryn Tribes',    affinity: 'Force',  rarity: 'Rare',     source_citation: 'in-game Index' },
  { name: 'Rearguard Sergeant',    faction: 'Banner Lords',    affinity: 'Magic',  rarity: 'Uncommon', source_citation: 'in-game Index' },
  { name: 'Gromoboy',              faction: 'Ogryn Tribes',    affinity: 'Void',   rarity: 'Uncommon', source_citation: 'in-game Index' },
  { name: 'Rocktooth',             faction: 'Ogryn Tribes',    affinity: 'Force',  rarity: 'Common',   source_citation: 'in-game Index' },
  // Undead Hordes
  { name: 'Frozen Banshee',        faction: 'Undead Hordes',   affinity: 'Magic',  rarity: 'Rare',     source_citation: 'in-game Index' },
  { name: 'Corpse Collector',      faction: 'Undead Hordes',   affinity: 'Force',  rarity: 'Rare',     source_citation: 'in-game Index' },
  { name: 'Coffin Smasher',        faction: 'Undead Hordes',   affinity: 'Magic',  rarity: 'Uncommon', source_citation: 'in-game Index' },
  { name: 'Amarantine Skeleton',   faction: 'Undead Hordes',   affinity: 'Spirit', rarity: 'Common',   source_citation: 'in-game Index' },
  // Lizardmen
  { name: 'Thornhide',             faction: 'Lizardmen',       affinity: 'Force',  rarity: 'Uncommon', source_citation: 'in-game Index' },
  { name: 'Quargan the Crowned',   faction: 'Lizardmen',       affinity: 'Magic',  rarity: 'Rare',     source_citation: 'in-game Index' },
  // Banner Lords
  { name: 'Knight Errant',         faction: 'Banner Lords',    affinity: 'Force',  rarity: 'Uncommon', source_citation: 'in-game Index' },
  { name: 'Armored Golem',         faction: 'Banner Lords',    affinity: 'Magic',  rarity: 'Rare',     source_citation: 'in-game Index' },
  // Dwarves
  { name: 'Mountaineer',           faction: 'Dwarves',         affinity: 'Magic',  rarity: 'Common',   source_citation: 'in-game Index' },
  { name: 'Fodbor the Bard',       faction: 'Dwarves',         affinity: 'Spirit', rarity: 'Uncommon', source_citation: 'in-game Index' },
  // Knight Revenant
  { name: 'Acolyte',               faction: 'Knight Revenant', affinity: 'Magic',  rarity: 'Common',   source_citation: 'in-game Index' },
  { name: 'Miscreated Monster',    faction: 'Knight Revenant', affinity: 'Void',   rarity: 'Rare',     source_citation: 'in-game Index' },
];

{
  // champions has no unique constraint on name, so check existing first
  const { data: existing } = await supabase.from('champions').select('name');
  const existingNames = new Set((existing ?? []).map(c => c.name));
  const toInsert = CHAMPIONS.filter(c => !existingNames.has(c.name));
  if (toInsert.length) {
    const { error } = await supabase.from('champions').insert(toInsert);
    if (error) err('champions insert', error);
    ok(`${toInsert.length} new champions inserted (${existingNames.size} already existed)`);
  } else {
    ok(`All ${CHAMPIONS.length} champions already in DB — skipped`);
  }
}

// ── Resolve tag + champion ID maps for seeds 04 & 05 ─────────────────────────

const { data: tagRows,  error: tagErr  } = await supabase.from('tags').select('id, name');
if (tagErr) err('tag lookup', tagErr);
const tagMap = new Map(tagRows.map(t => [t.name, t.id]));

const { data: champRows, error: champErr } = await supabase.from('champions').select('id, name');
if (champErr) err('champion lookup', champErr);
const champMap = new Map(champRows.map(c => [c.name, c.id]));

function ctRow(championName, tagName, sourceNote, status = 'proposed') {
  const champion_id = champMap.get(championName);
  const tag_id      = tagMap.get(tagName);
  if (!champion_id) { console.warn(`    ⚠ champion not found: ${championName}`); return null; }
  if (!tag_id)      { console.warn(`    ⚠ tag not found: ${tagName}`);           return null; }
  return { champion_id, tag_id, status, source_type: 'in_game_index',
           source_note: sourceNote, proposed_by: 'seed' };
}

// ── Seed 04 — Rare+ champion tags (proposed) ──────────────────────────────────

section('Seed 04 — Rare+ champion tags');

const TAGS_04 = [
  // Kael
  ctRow('Kael',       'AoE Damage',       'Dark Blast and Acid Rain both hit all enemies'),
  ctRow('Kael',       'Poison',           'Acid Rain places 2 Poison debuffs on all enemies'),
  ctRow('Kael',       'Decrease Defense', 'Disintegrate has 50% chance to place Decrease DEF on all enemies'),
  // Elhain
  ctRow('Elhain',     'AoE Damage',       'Arrow Shower hits all enemies; Lightning Arrow chains to multiple targets'),
  // Athel
  ctRow('Athel',      'AoE Damage',       'Saintly Dread and Martyrdom both hit all enemies'),
  ctRow('Athel',      'Weaken',           'Martyrdom places a [Weaken] debuff on all enemies'),
  // Galek
  ctRow('Galek',      'AoE Damage',       'Rain of Fire and Inferno both attack all enemies'),
  ctRow('Galek',      'Decrease Defense', 'Inferno places [Decrease DEF] on all enemies'),
  // Warpriest
  ctRow('Warpriest',  'Healer',           'Sacral Ward heals all allies by a percentage of their max HP'),
  ctRow('Warpriest',  'Shield',           'Suppress places a [Shield] buff on all allies'),
  // Apothecary
  ctRow('Apothecary', 'Healer',           'Mend and Bless both restore HP to allies'),
  ctRow('Apothecary', 'Increase Speed',   'Bless places [Increase SPD] on all allies'),
  // Diabolist
  ctRow('Diabolist',  'Speed Aura',       'Leader skill increases ally SPD in all battles'),
  ctRow('Diabolist',  'Increase Speed',   'Dash places [Increase SPD] on a random ally'),
  // Spirithost
  ctRow('Spirithost', 'ATK Aura',         'Leader skill increases ally ATK in all battles'),
  ctRow('Spirithost', 'Revive',           'Awaken brings a dead ally back to life with partial HP'),
  // Skullcrusher
  ctRow('Skullcrusher', 'Counterattack',  'Warhorn places [Counterattack] on all allies for 2 turns'),
  ctRow('Skullcrusher', 'Block Debuffs',  'Demoralise places [Block Debuffs] on all allies'),
  // Frozen Banshee
  ctRow('Frozen Banshee', 'Poison',       'Frostbite places [Poison] debuffs on all enemies'),
  ctRow('Frozen Banshee', 'AoE Damage',   'Frostbite attacks all enemies'),
  // Executioner
  ctRow('Executioner', 'AoE Damage',      'Rain of Punishment attacks all enemies'),
  ctRow('Executioner', 'Decrease Defense','Rain of Punishment places [Decrease DEF] on all enemies'),
  // Relickeeper
  ctRow('Relickeeper', 'AoE Damage',      'Judgement attacks all enemies'),
  // Armiger
  ctRow('Armiger',    'Decrease Turn Meter', "Passive: landing a critical hit decreases the target's Turn Meter"),
  // Rearguard Sergeant
  ctRow('Rearguard Sergeant', 'DEF Aura', 'Leader skill increases ally DEF in all battles'),
  ctRow('Rearguard Sergeant', 'Increase Defense', 'Rally places [Increase DEF] on all allies'),
  // Corpse Collector
  ctRow('Corpse Collector', 'Revive',     'Grave Digger revives a dead ally with partial HP'),
  // Grizzled Jarl
  ctRow('Grizzled Jarl', 'Healer',        'Tribal Remedy heals all allies'),
  ctRow('Grizzled Jarl', 'Increase Defense', 'War Cry places [Increase DEF] on all allies'),
  // Miscreated Monster
  ctRow('Miscreated Monster', 'Healer',   'Replenish heals all allies'),
  ctRow('Miscreated Monster', 'Shield',   'Mutate places a [Shield] on all allies'),
  // Quargan the Crowned
  ctRow('Quargan the Crowned', 'Decrease Attack', 'Subdue places [Decrease ATK] on all enemies'),
  ctRow('Quargan the Crowned', 'AoE Damage',      'Tail Strike attacks all enemies'),
].filter(Boolean);

{
  const { error } = await supabase.from('champion_tags')
    .upsert(TAGS_04, { onConflict: 'champion_id,tag_id', ignoreDuplicates: true });
  if (error) err('champion_tags seed 04', error);
  ok(`${TAGS_04.length} champion_tags upserted (proposed)`);
}

// ── Seed 05 — Common/Uncommon champion tags (proposed → then all approved) ───

section('Seed 05 — Common/Uncommon champion tags + approve all');

const TAGS_05 = [
  // Common
  ctRow('Steel Bowyer',       'Single Target Damage', 'Basic attack deals single target damage'),
  ctRow('Stout Axeman',       'AoE Damage',           'Whirlwind attacks all enemies'),
  ctRow('Ranger',             'Single Target Damage', 'Basic attack deals single target damage'),
  ctRow('Ranger',             'Decrease Defense',     'Puncture places [Decrease DEF] on the target'),
  ctRow('Saurus',             'AoE Damage',           'Ground Slam attacks all enemies'),
  ctRow('Rocktooth',          'Decrease Attack',      'Intimidate places [Decrease ATK] on the target'),
  ctRow('Rocktooth',          'Single Target Damage', 'Basic attack deals single target damage'),
  ctRow('Amarantine Skeleton','Poison',               'Venomous Strike places a [Poison] debuff on the target'),
  ctRow('Amarantine Skeleton','Single Target Damage', 'Basic attack deals single target damage'),
  ctRow('Mountaineer',        'Increase Defense',     'Fortify places [Increase DEF] on all allies'),
  ctRow('Mountaineer',        'Single Target Damage', 'Basic attack deals single target damage'),
  ctRow('Acolyte',            'Decrease Defense',     'Expose Weakness places [Decrease DEF] on the target'),
  ctRow('Acolyte',            'Single Target Damage', 'Basic attack deals single target damage'),
  // Uncommon
  ctRow('Adjudicator',        'Healer',               'Mend heals a single ally'),
  ctRow('Adjudicator',        'Cleanse',              'Purify removes a debuff from an ally'),
  ctRow('Elven Ranger',       'AoE Damage',           'Volley attacks all enemies'),
  ctRow('Hexweaver',          'Poison',               'Envenom places a [Poison] debuff on the target'),
  ctRow('Hexweaver',          'Single Target Damage', 'Basic attack deals single target damage'),
  ctRow('Razorleaf',          'AoE Damage',           'Thorn Spray attacks all enemies'),
  ctRow('Marked',             'Decrease Defense',     'Mark places [Decrease DEF] on the target'),
  ctRow('Marked',             'Single Target Damage', 'Basic attack deals single target damage'),
  ctRow('Gromoboy',           'Increase Defense',     'Rally places [Increase DEF] on all allies'),
  ctRow('Gromoboy',           'Single Target Damage', 'Basic attack deals single target damage'),
  ctRow('Coffin Smasher',     'AoE Damage',           'Grave Robber attacks all enemies'),
  ctRow('Thornhide',          'Decrease Attack',      'Intimidating Roar places [Decrease ATK] on all enemies'),
  ctRow('Thornhide',          'AoE Damage',           'Tail Swipe attacks all enemies'),
  ctRow('Knight Errant',      'Shield',               'Guard places a [Shield] buff on all allies'),
  ctRow('Knight Errant',      'Single Target Damage', 'Basic attack deals single target damage'),
  ctRow('Fodbor the Bard',    'Healer',               'Inspiring Song heals all allies'),
  ctRow('Fodbor the Bard',    'Increase Speed',       'Battle Hymn places [Increase SPD] on all allies'),
].filter(Boolean);

{
  const { error } = await supabase.from('champion_tags')
    .upsert(TAGS_05, { onConflict: 'champion_id,tag_id', ignoreDuplicates: true });
  if (error) err('champion_tags seed 05', error);
  ok(`${TAGS_05.length} champion_tags upserted (proposed)`);
}

// Approve ALL proposed tags — mirrors the final UPDATE in seed 05
{
  const { data: proposed } = await supabase
    .from('champion_tags')
    .select('id')
    .eq('status', 'proposed');

  if (proposed?.length) {
    const ids = proposed.map(r => r.id);
    // Supabase JS client doesn't support bulk update with .in() directly,
    // so update in one call using the status filter (same as the SQL UPDATE)
    const { error } = await supabase
      .from('champion_tags')
      .update({ status: 'approved', approved_by: 'Mike', approved_at: new Date().toISOString() })
      .eq('status', 'proposed');
    if (error) err('approve all champion_tags', error);
    ok(`${ids.length} proposed tags approved (approved_by: Mike)`);
  } else {
    ok('No proposed tags to approve');
  }
}

// ── Verification queries ──────────────────────────────────────────────────────

section('Verification');

// 1. Champions by rarity
{
  const { data, error } = await supabase
    .from('champions')
    .select('rarity');
  if (error) err('champions by rarity', error);
  const counts = {};
  for (const r of data) counts[r.rarity] = (counts[r.rarity] ?? 0) + 1;
  const order = ['Common','Uncommon','Rare','Epic','Legendary','Mythical'];
  console.log('\n  Champions by rarity:');
  for (const r of order) {
    if (counts[r]) console.log(`    ${r.padEnd(12)} ${counts[r]}`);
  }
  const total = Object.values(counts).reduce((a,b) => a+b, 0);
  console.log(`    ${'TOTAL'.padEnd(12)} ${total}`);
}

// 2. Priority champions — base stats
{
  const names = ['Tagoar','Uugo','Coldheart','Kael','Elhain','Fayne','Deacon Armstrong'];
  const { data, error } = await supabase
    .from('champions')
    .select('name, rarity, base_hp, base_atk, base_def, base_spd, base_acc, base_res')
    .in('name', names)
    .order('rarity');
  if (error) err('priority champions', error);
  console.log('\n  Priority champions — base stats:');
  console.log('    ' + 'Name'.padEnd(22) + 'Rarity'.padEnd(12) + 'HP'.padEnd(8) + 'ATK'.padEnd(7) + 'DEF'.padEnd(7) + 'SPD'.padEnd(6) + 'ACC'.padEnd(6) + 'RES');
  for (const c of data ?? []) {
    const hp  = c.base_hp  ?? 'null';
    const atk = c.base_atk ?? 'null';
    const def = c.base_def ?? 'null';
    const spd = c.base_spd ?? 'null';
    const acc = c.base_acc ?? 'null';
    const res = c.base_res ?? 'null';
    console.log(`    ${c.name.padEnd(22)}${c.rarity.padEnd(12)}${String(hp).padEnd(8)}${String(atk).padEnd(7)}${String(def).padEnd(7)}${String(spd).padEnd(6)}${String(acc).padEnd(6)}${res}`);
  }
  const found = (data ?? []).map(c => c.name);
  const missing = names.filter(n => !found.includes(n));
  if (missing.length) console.log(`    ⚠ Not in DB: ${missing.join(', ')}`);
}

// 3. champion_tags by status
{
  const { data, error } = await supabase
    .from('champion_tags')
    .select('status');
  if (error) err('champion_tags status', error);
  const counts = {};
  for (const r of data) counts[r.status] = (counts[r.status] ?? 0) + 1;
  console.log('\n  champion_tags by status:');
  for (const [status, count] of Object.entries(counts)) {
    console.log(`    ${status.padEnd(12)} ${count}`);
  }
  console.log(`    ${'TOTAL'.padEnd(12)} ${data.length}`);
}

console.log('\n' + '═'.repeat(60));
console.log('  All seeds applied successfully.');
console.log('═'.repeat(60) + '\n');
