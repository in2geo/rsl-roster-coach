-- ============================================================================
-- 61 — Rename + repair the 8 remaining collab shell rows (Monster Hunter
-- Blademasters + TMNT turtles), filling role and correcting affinity.
--
-- Identity confirmed 2026-07-07 from Plarium official + HellHades / AyumiLove /
-- BlueStacks (human read, factual data). Each DB row is an empty shell (0 tags,
-- 0 solo_profiles, null type_id/base stats) carrying an abbreviated name, right
-- faction, null role, and mostly-wrong affinity. No full-name collisions exist.
--
-- (Michelangelo/'Mikey' is NOT here — already resolved in seed 56.)
--
-- For each: rename abbreviated -> canonical, set affinity + role (faction already
-- correct, rarity already Legendary), and register the abbreviation as a
-- shortform alias. Idempotent: the UPDATE keys on the abbreviated name (no-ops
-- once renamed); aliases use ON CONFLICT DO NOTHING.
-- ============================================================================

-- 1. Rename + fix identity fields.
update champions c
set name     = v.full_name,
    faction  = v.faction,
    affinity = v.affinity,
    role     = v.role,
    source_citation = 'Identity confirmed 2026-07-07: Plarium official + '
                      'HellHades / AyumiLove / BlueStacks (human read).'
from (values
  ('Donnie',         'Donatello',            'Lizardmen',        'Magic',  'Support'),
  ('Leo',            'Leonardo',             'Shadowkin',        'Void',   'Defense'),
  ('Raph',           'Raphael',              'Barbarians',       'Force',  'Attack'),
  ('R. Blademaster', 'Rathalos Blademaster', 'Banner Lords',     'Force',  'Attack'),
  ('Z. Blademaster', 'Zinogre Blademaster',  'Shadowkin',        'Magic',  'Attack'),
  ('A. Blademaster', 'Alatreon Blademaster', 'Knights Revenant', 'Spirit', 'Support'),
  ('F. Blademaster', 'Fatalis Blademaster',  'Dark Elves',       'Void',   'HP'),
  ('R. N. Archer',   'R. Nergigante Archer', 'Barbarians',       'Spirit', 'Defense')
) as v(abbr, full_name, faction, affinity, role)
where c.game_id = 'raid_shadow_legends' and c.name = v.abbr;

-- 2. Register the abbreviations as shortform aliases (matched on the new names).
insert into champion_aliases (champion_id, alias, source)
select c.id, v.abbr, 'shortform'
from (values
  ('Donnie',         'Donatello'),
  ('Leo',            'Leonardo'),
  ('Raph',           'Raphael'),
  ('R. Blademaster', 'Rathalos Blademaster'),
  ('Z. Blademaster', 'Zinogre Blademaster'),
  ('A. Blademaster', 'Alatreon Blademaster'),
  ('F. Blademaster', 'Fatalis Blademaster'),
  ('R. N. Archer',   'R. Nergigante Archer')
) as v(abbr, full_name)
join champions c on c.game_id = 'raid_shadow_legends' and c.name = v.full_name
on conflict do nothing;
