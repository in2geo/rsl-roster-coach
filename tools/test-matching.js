/**
 * Matching engine integration test — Spider's Den Stages 7-10 (Stage 9).
 *
 * Fully self-contained: creates a temp auth user + champion rows + approved
 * tags, runs all four test scenarios, then deletes everything it created.
 * Does not depend on any seeds being applied to the live DB.
 *
 * Tags are marked TEST_DATA and use simplified but structurally correct
 * entries — the goal is to exercise the matching ENGINE logic, not validate
 * real in-game accuracy. Real tags come from Mike's in-game Index reads.
 *
 * Usage: node --env-file=.env.local tools/test-matching.js
 */

import { createClient } from '@supabase/supabase-js';
import { matchRoster }  from '../lib/match-engine.js';

const supabase = createClient(
  (process.env.SUPABASE_URL ?? '').replace(/\/rest\/v1\/?$/, ''),
  process.env.SUPABASE_SERVICE_KEY,
  { global: { fetch } }
);

const CONTENT_KEY = 'spider'; // → Spider's Den Stages 7-10, stageNumber=9

// ── Test champion definitions ─────────────────────────────────────────────────
// Tags are TEST_DATA — simplified for engine testing only.
// Real tags must come from in-game Index skill text.

const TEST_CHAMPIONS = [
  // Debuffers / damage dealers
  { name: 'Tagoar',           faction: 'Lizardmen',      affinity: 'Force',  rarity: 'Rare',      base_hp: 15855, base_atk: 980,  base_def: 958,  base_spd: 92,  base_acc: 0,  base_res: 30,  tags: ['AoE Damage', 'Decrease Defense'] },
  { name: 'Uugo',             faction: 'Ogryn Tribes',   affinity: 'Void',   rarity: 'Rare',      base_hp: 17010, base_atk: 870,  base_def: 1057, base_spd: 93,  base_acc: 0,  base_res: 30,  tags: ['AoE Damage', 'Decrease Defense'] },
  { name: 'Fayne',            faction: 'Dark Elves',     affinity: 'Void',   rarity: 'Legendary', base_hp: 17835, base_atk: 1344, base_def: 1068, base_spd: 101, base_acc: 0,  base_res: 30,  tags: ['AoE Damage', 'Decrease Defense', 'Poison'] },
  { name: 'Kael',             faction: 'Dark Elves',     affinity: 'Magic',  rarity: 'Epic',      base_hp: 15690, base_atk: 1155, base_def: 804,  base_spd: 100, base_acc: 0,  base_res: 30,  tags: ['AoE Damage', 'Decrease Defense', 'Poison'] },
  { name: 'Coldheart',        faction: 'High Elves',     affinity: 'Void',   rarity: 'Epic',      base_hp: 15855, base_atk: 1288, base_def: 870,  base_spd: 98,  base_acc: 0,  base_res: 30,  tags: ['AoE Damage'] },
  { name: 'Deacon Armstrong', faction: 'Banner Lords',   affinity: 'Spirit', rarity: 'Legendary', base_hp: 18660, base_atk: 1013, base_def: 1057, base_spd: 105, base_acc: 0,  base_res: 30,  tags: ['AoE Damage', 'Decrease Defense', 'SPD Aura'] },
  // Healers / tanks
  { name: 'Miscreated Monster', faction: 'Knight Revenant', affinity: 'Void', rarity: 'Rare',    base_hp: 21150, base_atk: 694,  base_def: 1013, base_spd: 92,  base_acc: 0,  base_res: 30,  tags: ['Healer', 'Shield'] },
  { name: 'Rector Drath',     faction: 'Undead Hordes',  affinity: 'Force',  rarity: 'Legendary', base_hp: 21615, base_atk: 1068, base_def: 1123, base_spd: 96,  base_acc: 0,  base_res: 30,  tags: ['Healer', 'Revive'] },
  { name: 'Stag Knight',      faction: 'Banner Lords',   affinity: 'Force',  rarity: 'Legendary', base_hp: 22440, base_atk: 1024, base_def: 1112, base_spd: 96,  base_acc: 0,  base_res: 30,  tags: ['Decrease Attack', 'Counterattack'] },
  { name: 'Elenaril',         faction: 'High Elves',     affinity: 'Magic',  rarity: 'Epic',      base_hp: 16650, base_atk: 1167, base_def: 826,  base_spd: 97,  base_acc: 0,  base_res: 30,  tags: ['AoE Damage', 'Poison'] },
  { name: 'Ruella',           faction: 'Skinwalkers',    affinity: 'Magic',  rarity: 'Rare',      base_hp: 16485, base_atk: 826,  base_def: 1013, base_spd: 96,  base_acc: 0,  base_res: 30,  tags: ['Healer'] },
  // Zero-tag champion (Narma intentionally has no tags to test that warning)
  { name: 'Narma',            faction: 'Ogryn Tribes',   affinity: 'Magic',  rarity: 'Rare',      base_hp: 17010, base_atk: 815,  base_def: 1002, base_spd: 94,  base_acc: 0,  base_res: 30,  tags: [] },
  // Kael/Elhain already above; adding Elhain for roster 4
  { name: 'Elhain',           faction: 'High Elves',     affinity: 'Magic',  rarity: 'Epic',      base_hp: 15525, base_atk: 1200, base_def: 760,  base_spd: 103, base_acc: 0,  base_res: 30,  tags: ['AoE Damage'] },
];

// ── Test rosters ─────────────────────────────────────────────────────────────

const ROSTERS = [
  {
    label: 'Roster 1 — typical day-1 team; expect goal satisfied via Decrease Defense + AoE Damage; borderline ACC at Stage 9',
    champions: [
      { champion_name: 'Tagoar',    level: 60, stars: 6, gear_tier: 'Dungeon',  ascension_level: 5 },
      { champion_name: 'Uugo',      level: 50, stars: 5, gear_tier: 'Dungeon',  ascension_level: 4 },
      { champion_name: 'Fayne',     level: 50, stars: 5, gear_tier: 'Starter',  ascension_level: 3 },
      { champion_name: 'Kael',      level: 40, stars: 4, gear_tier: 'Starter',  ascension_level: 2 },
      { champion_name: 'Coldheart', level: 40, stars: 4, gear_tier: 'Starter',  ascension_level: 2 },
    ],
  },
  {
    label: 'Roster 2 — no debuffers; expect explicit gap for the damage-control goal',
    champions: [
      { champion_name: 'Miscreated Monster', level: 60, stars: 6, gear_tier: 'Strong',  ascension_level: 5 },
      { champion_name: 'Rector Drath',       level: 50, stars: 5, gear_tier: 'Dungeon', ascension_level: 4 },
      { champion_name: 'Stag Knight',        level: 40, stars: 5, gear_tier: 'Dungeon', ascension_level: 3 },
      { champion_name: 'Elenaril',           level: 40, stars: 4, gear_tier: 'Starter', ascension_level: 2 },
      { champion_name: 'Ruella',             level: 30, stars: 4, gear_tier: 'Starter', ascension_level: 1 },
    ],
  },
  {
    label: 'Roster 3 — God Tier gear + full tag coverage; expect all goals satisfied and ACC threshold passing',
    champions: [
      { champion_name: 'Tagoar',           level: 60, stars: 6, gear_tier: 'God Tier', ascension_level: 6 },
      { champion_name: 'Uugo',             level: 60, stars: 6, gear_tier: 'God Tier', ascension_level: 6 },
      { champion_name: 'Fayne',            level: 60, stars: 6, gear_tier: 'Strong',   ascension_level: 5 },
      { champion_name: 'Coldheart',        level: 60, stars: 6, gear_tier: 'Strong',   ascension_level: 5 },
      { champion_name: 'Deacon Armstrong', level: 50, stars: 5, gear_tier: 'Strong',   ascension_level: 4 },
    ],
  },
  {
    label: 'Roster 4 — Narma has no approved tags; expect explicit zero-tag warning',
    champions: [
      { champion_name: 'Tagoar', level: 60, stars: 6, gear_tier: 'Dungeon', ascension_level: 5 },
      { champion_name: 'Narma',  level: 50, stars: 5, gear_tier: 'Dungeon', ascension_level: 4 },
      { champion_name: 'Kael',   level: 40, stars: 4, gear_tier: 'Starter', ascension_level: 2 },
      { champion_name: 'Elhain', level: 40, stars: 4, gear_tier: 'Starter', ascension_level: 2 },
      { champion_name: 'Ruella', level: 30, stars: 3, gear_tier: 'Starter', ascension_level: 1 },
    ],
  },
];

// ── Setup / teardown ──────────────────────────────────────────────────────────

let testUserId  = null;
let insertedChampionIds  = [];  // rows we created — deleted in teardown
let savedChampionStats   = [];  // rows we modified — base stats restored in teardown

async function setup() {
  // Create a temporary auth user
  const { data: { user }, error } = await supabase.auth.admin.createUser({
    email: `test-matching-${Date.now()}@test.internal`,
    password: 'test-password-not-used',
    email_confirm: true,
  });
  if (error) throw new Error(`Could not create test auth user: ${error.message}`);
  testUserId = user.id;
  console.log(`  Created test user: ${testUserId}`);

  // Load required tags from DB (they must already exist in the tags table)
  const tagNames = [...new Set(TEST_CHAMPIONS.flatMap(c => c.tags))];
  const { data: tagRows, error: tagErr } = await supabase
    .from('tags')
    .select('id, name')
    .in('name', tagNames);
  if (tagErr) throw new Error(`Tag lookup failed: ${tagErr.message}`);
  const tagMap = new Map(tagRows.map(t => [t.name, t.id]));

  const missingTags = tagNames.filter(n => !tagMap.has(n));
  if (missingTags.length) {
    throw new Error(`Tags not in DB (run seeds/01_tags.sql first): ${missingTags.join(', ')}`);
  }

  const BASE_STAT_COLS = 'base_hp,base_atk,base_def,base_spd,base_crit_rate,base_crit_dmg,base_acc,base_res';

  for (const champ of TEST_CHAMPIONS) {
    const fixtureStats = {
      base_hp:        champ.base_hp,
      base_atk:       champ.base_atk,
      base_def:       champ.base_def,
      base_spd:       champ.base_spd,
      base_crit_rate: champ.base_crit_rate ?? 0.15,
      base_crit_dmg:  champ.base_crit_dmg  ?? 0.50,
      base_acc:       champ.base_acc,
      base_res:       champ.base_res,
    };

    const { data: existing } = await supabase
      .from('champions')
      .select(`id, ${BASE_STAT_COLS}`)
      .eq('name', champ.name)
      .maybeSingle();

    let champId;
    if (existing) {
      // Save the real DB stats so teardown can restore them exactly.
      savedChampionStats.push({
        id: existing.id,
        original: {
          base_hp:        existing.base_hp,
          base_atk:       existing.base_atk,
          base_def:       existing.base_def,
          base_spd:       existing.base_spd,
          base_crit_rate: existing.base_crit_rate,
          base_crit_dmg:  existing.base_crit_dmg,
          base_acc:       existing.base_acc,
          base_res:       existing.base_res,
        },
      });
      // Overwrite with fixture values so the test runs against known stats.
      const { error: updateErr } = await supabase
        .from('champions')
        .update(fixtureStats)
        .eq('id', existing.id);
      if (updateErr) throw new Error(`Champion stat update failed (${champ.name}): ${updateErr.message}`);
      champId = existing.id;
    } else {
      const { data: inserted, error: insertErr } = await supabase
        .from('champions')
        .insert({
          name: champ.name, faction: champ.faction, affinity: champ.affinity,
          rarity: champ.rarity, source_citation: 'TEST_DATA',
          ...fixtureStats,
        })
        .select('id')
        .single();
      if (insertErr) throw new Error(`Champion insert failed (${champ.name}): ${insertErr.message}`);
      champId = inserted.id;
      insertedChampionIds.push(champId);
    }

    // Insert approved tags for this champion (ignore conflicts)
    for (const tagName of champ.tags) {
      const tagId = tagMap.get(tagName);
      if (!tagId) continue;
      await supabase.from('champion_tags').upsert({
        champion_id: champId, tag_id: tagId,
        status: 'approved', source_type: 'in_game_index',
        source_note: 'TEST_DATA — replace with real skill text before shipping',
        proposed_by: 'test-matching',
      }, { onConflict: 'champion_id,tag_id', ignoreDuplicates: true });
    }
  }

  console.log(`  Ensured ${TEST_CHAMPIONS.length} test champions in DB`);
  if (savedChampionStats.length)  console.log(`  Saved original stats for ${savedChampionStats.length} pre-existing champion(s) — will restore in teardown`);
  if (insertedChampionIds.length) console.log(`  Inserted ${insertedChampionIds.length} new champion(s) — will delete in teardown`);
}

async function teardown() {
  if (testUserId) {
    await supabase.from('user_champions').delete().eq('user_id', testUserId);
    await supabase.auth.admin.deleteUser(testUserId);
  }
  // Restore original base stats for pre-existing champions.
  for (const { id, original } of savedChampionStats) {
    await supabase.from('champions').update(original).eq('id', id);
  }
  if (savedChampionStats.length) console.log(`  Restored original stats for ${savedChampionStats.length} pre-existing champion(s)`);
  // Delete only rows we created — leave everything else untouched.
  if (insertedChampionIds.length) {
    await supabase.from('champions').delete().in('id', insertedChampionIds);
  }
}

async function insertTestRoster(rosterChampions) {
  // Clear previous roster for this user
  await supabase.from('user_champions').delete().eq('user_id', testUserId);

  const names = rosterChampions.map(c => c.champion_name);
  const { data: champRows, error } = await supabase
    .from('champions').select('id, name').in('name', names);
  if (error) throw new Error(`Champion lookup: ${error.message}`);
  const idMap = new Map(champRows.map(c => [c.name, c.id]));

  const missing = names.filter(n => !idMap.has(n));
  if (missing.length) console.log(`  ⚠ Not in DB (skipped): ${missing.join(', ')}`);

  const rows = rosterChampions
    .filter(c => idMap.has(c.champion_name))
    .map(c => ({
      user_id: testUserId, champion_id: idMap.get(c.champion_name),
      level: c.level, stars: c.stars, gear_tier: c.gear_tier,
      ascension_level: c.ascension_level, mastery_tier: 'None',
      is_booked: false, awakening_level: 0,
    }));

  // Plain insert (not upsert): the roster is deleted just above, and
  // user_champions now has only PARTIAL unique indexes (profiles migration), which
  // PostgREST's onConflict column list can't target.
  const { error: insertErr } = await supabase
    .from('user_champions')
    .insert(rows);
  if (insertErr) throw new Error(`Roster insert failed: ${insertErr.message}`);
}

// ── Output helpers ────────────────────────────────────────────────────────────

function printResult(result) {
  console.log(`\n  Team selected (${result.team.length}):`);
  for (const c of result.team) {
    const s = c.estimated_stats;
    console.log(`    ${c.name.padEnd(26)} Lv${c.level} ★${c.stars} ${(c.gear_tier ?? 'Starter').padEnd(10)}`);
    console.log(`      Tags:  ${c.tags.length ? c.tags.join(', ') : 'NONE'}`);
    if (s) console.log(`      Stats: HP:${s.hp} ATK:${s.atk} DEF:${s.def} SPD:${s.spd} ACC:${s.acc} RES:${s.res}`);
  }

  console.log(`\n  Goal coverage:`);
  for (const g of Object.values(result.coverage)) {
    const icon = g.satisfied ? '✓' : '✗';
    const note = g.satisfied
      ? `covered — "${g.solution_label}"`
      : `NOT COVERED (${g.total_solutions} approved solution(s) available)`;
    console.log(`    ${icon} ${g.description}`);
    console.log(`        ${note}`);
  }

  if (result.gaps.length) {
    console.log(`\n  Gaps (${result.gaps.length}):`);
    for (const g of result.gaps) console.log(`    ✗ ${g}`);
  } else {
    console.log(`\n  ✓ All goals covered.`);
  }

  if (result.data_warning) {
    console.log(`\n  ⚠ DATA WARNING: ${result.data_warning}`);
  }

  console.log(`\n  Stat thresholds (Stage 9 → ACC needed ≈ 90 at stage × 10):`);
  if (!result.threshold_results.length) {
    console.log('    (none configured for this stage)');
  }
  for (const t of result.threshold_results) {
    const icon = t.passes === true ? '✓' : t.passes === false ? '✗' : '~';
    const verdict = t.passes === true ? 'PASS' : t.passes === false ? 'FAIL' : 'needs_review';
    console.log(`    ${icon} ${t.stat.toUpperCase()}  threshold:${t.threshold_value ?? '?'}  team-min:${t.estimated_value ?? '?'}  → ${verdict}`);
  }

  if (result.zero_tag_warnings.length) {
    console.log(`\n  ⚠ Zero-tag champions:`);
    for (const n of result.zero_tag_warnings) console.log(`    • ${n}`);
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

console.log(`\n${'═'.repeat(70)}`);
console.log(`  RSL Matching Engine — Integration Test`);
console.log(`  Content: Spider's Den Stages 7-10 (Stage 9 ACC threshold)`);
console.log(`  Note: champion tags are TEST_DATA — not from in-game Index`);
console.log(`${'═'.repeat(70)}`);

try {
  console.log('\nSetting up test data...');
  await setup();
} catch (err) {
  console.error(`\nSetup failed: ${err.message}`);
  process.exit(1);
}

for (let i = 0; i < ROSTERS.length; i++) {
  const { label, champions } = ROSTERS[i];
  console.log(`\n${'─'.repeat(70)}`);
  console.log(`Test ${i + 1}: ${label}`);
  console.log(`${'─'.repeat(70)}`);

  try {
    await insertTestRoster(champions);

    const { data: roster, error: rosterErr } = await supabase
      .from('user_champions')
      .select(`
        id, level, stars, ascension_level, gear_tier, mastery_tier,
        is_booked, awakening_level,
        champion:champions (
          id, name, rarity, faction, affinity,
          base_hp, base_atk, base_def, base_spd, base_acc, base_res,
          champion_tags ( tag_id, status, tags ( name, bypasses_accuracy_check ) )
        )
      `)
      .eq('user_id', testUserId);

    if (rosterErr) throw new Error(`Roster load: ${rosterErr.message}`);

    const result = await matchRoster(roster, CONTENT_KEY);
    printResult(result);
  } catch (err) {
    console.log(`\n  ERROR: ${err.message}`);
  }
}

console.log(`\n${'─'.repeat(70)}`);
console.log('Cleaning up test data...');
await teardown();
console.log(`${'═'.repeat(70)}`);
console.log('  Done.');
console.log(`${'═'.repeat(70)}\n`);
