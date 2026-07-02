-- ============================================================================
-- Pelops the Victor — champion_tags from the in-game Index (July 2026 screenshots).
-- Deferred in seed 13 (not on raid.guide). status='proposed' → human review.
--
-- Corrections applied to the source SQL before committing (all would otherwise
-- have failed on champion_tags.tag_id NOT NULL, or been wrong):
--   A1  'Decrease ATK'  -> 'Decrease Attack' (real tag name)
--   A2  'AoE Stun'      -> 'Stun'            (single-target; the tag now exists, seed 20)
--   Passive 'AoE HP Burn' -> 'HP Burn'       (per-attacker, not true AoE — matches the note)
-- Solo-profile UPDATE kept but is a NO-OP: 0 Pelops champion_solo_profiles rows
-- exist yet (they're commented NOT SEEDED in seed 06). Seed them, then gate.
-- ============================================================================

-- Petrification — new tag (created before it is referenced below).
insert into tags (name, description, bypasses_accuracy_check, is_debuff)
values (
  'Petrification',
  'Prevents the target from taking any action for the duration. Similar to Stun but a distinct debuff type. Subject to ACC/RES check unless triggered by a passive mechanic (e.g. Pelops passive trigger on being hit does not go through a standard ACC check).',
  false, true
)
on conflict (name) do nothing;

insert into champion_tags
  (champion_id, tag_id, status, source_type, source_note, proposed_by, ascension_required)
values

-- A1: Decrease ATK (landed debuff; conditional bypass under HP Burn)
(
  (select id from champions where name = 'Pelops the Victor' and game_id = 'raid_shadow_legends'),
  (select id from tags where name = 'Decrease Attack'),
  'proposed', 'in_game_index',
  'A1 Triumphant Blow (L3/5): 75% chance, 50% Decrease ATK for 2 turns. Unbooked: 50%, fully booked: 90%. CONDITIONAL BYPASS: cannot be resisted if target is under HP Burn — effectively guaranteed when paired with his own passive. DEPENDENCY: passive requires 3-star ascension — without it, no HP Burn lands and this reverts to standard 50% unbooked ACC check.',
  'in-game-index-screenshot-july-2026', 0
),

-- A2: single-target Stun (conditional trigger)
(
  (select id from champions where name = 'Pelops the Victor' and game_id = 'raid_shadow_legends'),
  (select id from tags where name = 'Stun'),
  'proposed', 'in_game_index',
  'A2 Gorgoa''s Bane (L2/4): single-target Stun for 2 turns — ONLY if damage dealt is less than 50% of target MAX HP. Cannot be resisted if target is under HP Burn. Cooldown 4 unbooked, 3 fully booked. TAGGING NOTE: single-target — tagged with the single-target Stun tag (added 2026-07-01), NOT AoE Stun.',
  'in-game-index-screenshot-july-2026', 0
),

-- A3: Provoke (Taunt on self, 2 turns)
(
  (select id from champions where name = 'Pelops the Victor' and game_id = 'raid_shadow_legends'),
  (select id from tags where name = 'Provoke'),
  'proposed', 'in_game_index',
  'A3 Victor''s Bounty (L3/4): places Taunt on self for 2 turns, forcing all enemies to target Pelops. Cooldown 4 unbooked, 3 fully booked. 2-turn uptime gap per cycle at unbooked cooldown. Also places Magma Shield (30% MAX HP) and Increase ATK 50% on all allies.',
  'in-game-index-screenshot-july-2026', 0
),

-- A3: Ally Protection (Magma Shield — scales off Pelops MAX HP)
(
  (select id from champions where name = 'Pelops the Victor' and game_id = 'raid_shadow_legends'),
  (select id from tags where name = 'Ally Protection'),
  'proposed', 'in_game_index',
  'A3 Victor''s Bounty (L3/4): places Magma Shield on all allies equal to 30% of Pelops MAX HP for 2 turns. Passive effect also reduces damage all allies receive by 20% while Pelops is not under Decrease DEF. HP is his primary scaling stat for this reason.',
  'in-game-index-screenshot-july-2026', 0
),

-- Passive: HP Burn (per-attacker; ascension-gated)
(
  (select id from champions where name = 'Pelops the Victor' and game_id = 'raid_shadow_legends'),
  (select id from tags where name = 'HP Burn'),
  'proposed', 'in_game_index',
  'Passive Master of Games (L1/1, cannot be booked): 100% chance to place HP Burn on any enemy that attacks Pelops for 2 turns. Drops to 50% if Pelops is under Decrease DEF. Occurs once per enemy skill. With Taunt active, all spiderlings attack Pelops making this functionally AoE in Spider''s Den and Ice Golem. NOT standard AoE — it is per-attacker triggered by being hit (tagged HP Burn, not AoE HP Burn).',
  'in-game-index-screenshot-july-2026', 3
),

-- Passive: Petrification (per-attacker; ascension-gated)
(
  (select id from champions where name = 'Pelops the Victor' and game_id = 'raid_shadow_legends'),
  (select id from tags where name = 'Petrification'),
  'proposed', 'in_game_index',
  'Passive Master of Games (L1/1, cannot be booked): 50% chance to place Petrification on any enemy that attacks Pelops for 1 turn. Drops to 25% if under Decrease DEF. Occurs once per enemy skill. Not a standard ACC-gated debuff — triggered by being hit, not by an active skill.',
  'in-game-index-screenshot-july-2026', 3
),

-- Aura: RES +60 all battles
(
  (select id from champions where name = 'Pelops the Victor' and game_id = 'raid_shadow_legends'),
  (select id from tags where name = 'RES Aura'),
  'proposed', 'in_game_index',
  'Aura: Increases Ally RES in all battles by 60. When Pelops is team leader, adds 60 RES to all team members. Directly relevant to Ice Golem RES threshold checks.',
  'in-game-index-screenshot-july-2026', 0
)

on conflict (champion_id, tag_id) do nothing;

-- Gate Pelops solo profiles behind 3-star ascension (passive Master of Games unlocks
-- there; without it there is no HP Burn / Petrification / solo loop). NO-OP until the
-- Pelops solo profiles are actually seeded (currently commented NOT SEEDED in seed 06).
update champion_solo_profiles
set ascension_required = 3,
    source_note = coalesce(source_note, '')
      || ' ASCENSION REQUIRED (confirmed in-game Index July 2026): passive skill Master of Games only unlocks at 3-star ascension. Without it there is no HP Burn trigger, no Petrification, and the solo loop does not function. An unascended Pelops cannot solo this content.'
where champion_id = (select id from champions where name = 'Pelops the Victor' and game_id = 'raid_shadow_legends');
