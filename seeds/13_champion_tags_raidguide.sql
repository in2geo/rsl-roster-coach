-- ============================================================================
-- Proposed champion_tags from raid.guide verbatim skill descriptions. SKILLS/DEBUFFS
-- ONLY — auras are NOT sourced here (raid.guide exposes only a coarse aura stat class,
-- with false negatives, and no percentage/placement; auras come from the in-game
-- Index and get proper stat+percent+placement storage separately).
-- source_type='raid_guide', status='proposed' — HUMAN REVIEW REQUIRED before use
-- (the match engine only reads status='approved' tags; these change nothing until
-- approved). Per the 2026-07-01 CLAUDE.md carve-out: raid.guide skill DESCRIPTIONS
-- are Plarium's literal skill text (allowed); ratings/strategy are not.
--
-- Unbooked debuff chance = described (booked/max) chance − sum of Buff/Debuff
-- Chance increases in the skill's book progression. Documented per tag in source_note.
-- ascension_required = 3 for tags derived from an ascended skill. raid.guide's static
-- HTML doesn't flag ascension reliably, so it defaults to 0 and is corrected manually:
-- Fayne's Decrease Attack is set to 3 in step (2) below (ascended A2, per in-game Index).
-- Conditional debuffs (land only under a condition) get the condition noted in
-- source_note, not just a chance — e.g. Staltus's Decrease Turn Meter (A1).
--
-- Only NEW tags (not already present) are inserted (NOT EXISTS guard), so this is
-- idempotent and won't duplicate existing approved tags.
--
-- NOT covered: Pelops the Victor — not listed on raid.guide (too new); source from
-- the in-game Index separately. Zero-tag until then.
--
-- Runs in order: (0) delete two mis-seeded approved tags, (1) insert proposed tags,
-- (2) correct Fayne's Decrease Attack ascension. Steps 0/2 confirmed with the user.
-- (Follow-up: seeds/04_champion_tags.sql may still create the two mis-seeds at source
-- and should be corrected there too; this file self-heals a rebuild since it runs after.)
-- ============================================================================

-- (0) Remove mis-seeded approved tags — confirmed absent from the champions' kits.
--     Kael has NO Decrease DEF on any skill; Fayne is entirely single-target (no AoE).
delete from champion_tags
 where champion_id = (select id from champions where game_id = 'raid_shadow_legends' and name = 'Kael')
   and tag_id = (select id from tags where name = 'Decrease Defense')
   and status = 'approved';
delete from champion_tags
 where champion_id = (select id from champions where game_id = 'raid_shadow_legends' and name = 'Fayne')
   and tag_id = (select id from tags where name = 'AoE Damage')
   and status = 'approved';

-- (1) Proposed skill/debuff tags.
insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by, proposed_at, ascension_required)
select ch.id, t.id, 'proposed', 'raid_guide', v.note, 'raid-guide-scraper', now(), v.asc_req
from (values
  -- Kael has no NEW skill/debuff tags beyond the existing approved Poison/AoE Damage.
  -- (Kael's aura HP +15% all battles is handled via proper aura storage, not a tag.)

  -- Fayne (single-target debuffer; existing approved Poison/Decrease Defense kept)
  ('Fayne', 'Decrease Attack', 0,
   'Flower''s Tears (A2): 50% Decrease ATK 2t. Described 75% chance (booked); book Buff/Debuff Chance +10%(L3)+15%(L4)=+25% => ~50% unbooked. 4t cd.'),
  ('Fayne', 'Weaken', 0,
   'Flowing Style (A3): 25% Weaken 3t. Described 75% (booked); book +25% => ~50% unbooked. 5t cd.'),
  ('Fayne', 'Decrease Turn Meter', 0,
   'Exotic Blades (A1): steals 5% TM per hit (x2). Described 35% (booked); book Buff/Debuff Chance +5%(L4)+10%(L5)=+15% => ~20% unbooked.'),

  -- Staltus Dragonbane (currently zero-tag)
  ('Staltus Dragonbane', 'AoE Damage', 0,
   'Drakehunter Tactics (A2) and Dragon Heart (A3) both hit all enemies.'),
  ('Staltus Dragonbane', 'AoE Stun', 0,
   'Drakehunter Tactics (A2): AoE Stun 1t. Described 50% (booked); book Stun chance +15%(L3) => ~35% unbooked. 4t cd.'),
  ('Staltus Dragonbane', 'Decrease Speed', 0,
   'Dragon Heart (A3): 30% Decrease SPD 2t. Described 75% (booked); book +10%(L3)+15%(L4)=+25% => ~50% unbooked. Also 25% Decrease C.DMG (no tag). 5t cd.'),
  ('Staltus Dragonbane', 'Increase Defense', 0,
   'Dragon Heart (A3): self 60% Increase DEF 3t (no chance).'),
  ('Staltus Dragonbane', 'Decrease Turn Meter', 0,
   'Axe of Glory (A1): -10% TM per hit IF target is under any debuff (conditional, no chance).'),

  -- Uugo (existing approved AoE Damage/Decrease Defense kept)
  ('Uugo', 'Leech', 0,
   'Black Hand (A1): Leech 2t. 35% base chance (+5% per alive enemy); book has no Buff/Debuff Chance increase => 35% unbooked.'),
  ('Uugo', 'Cleanse', 0,
   'Uugo''s Brew (A3): removes all Heal Reduction + 1 random debuff from all allies (no chance). 6t cd.'),
  ('Uugo', 'Healer', 0,
   'Uugo''s Brew (A3): heals all allies 20% of Uugo MAX HP (no chance).'),
  ('Uugo', 'Revive', 0,
   'Uugo''s Brew (A3): if all allies dead, revives at 50% HP + 50% TM (conditional).'),
  ('Uugo', 'Increase Speed', 0,
   'Final Spite [P]: self 30% Increase SPD 1t when the last ally dies (conditional passive).'),
  ('Uugo', 'Block Damage', 0,
   'Final Spite [P]: self Block Damage 1t when the last ally dies (conditional passive).')
) as v(champ, tag, asc_req, note)
join champions ch on ch.game_id = 'raid_shadow_legends' and ch.name = v.champ
join tags t on t.name = v.tag
where not exists (
  select 1 from champion_tags x where x.champion_id = ch.id and x.tag_id = t.id
);

-- (2) Correct Fayne's Decrease Attack ascension. The raid.guide static HTML doesn't
--     reliably flag ascended skills, so the scraper defaulted ascension_required=0;
--     Decrease ATK only exists on the ASCENDED version of A2 (Flower's Tears) per the
--     in-game Index. Runs after the insert above (targets the row it created).
update champion_tags
   set ascension_required = 3,
       source_note = source_note || ' CORRECTED: ascension_required set to 3 — Decrease ATK only exists on the ascended version of A2 (confirmed from in-game Index screenshot, June 2026).'
 where champion_id = (select id from champions where game_id = 'raid_shadow_legends' and name = 'Fayne')
   and tag_id = (select id from tags where name = 'Decrease Attack')
   and status = 'proposed';
