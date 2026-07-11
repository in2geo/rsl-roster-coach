-- ============================================================================
-- 99 — Add 5 champions that were approved for tags but had no row in the live
-- champions table (PENDING_CHAMPIONS.md). Identity from the master Champions
-- tab. type_id left null (worksheet C-id is not the game baseTypeId; Gestal
-- mapping is a separate follow-up). champions has no unique name constraint, so
-- guard each insert with NOT EXISTS. Idempotent.
-- ============================================================================
insert into champions (name, faction, affinity, rarity, role, game_id, source_citation)
select v.name, v.faction, v.affinity, v.rarity, v.role, 'raid_shadow_legends',
       'master Champions tab (2026-07-11 pending-champion backfill)'
from (values
  ('Fortress Goon',        'Ogryn Tribes', 'Magic',  'Rare',      'Defense'),
  ('Sentinel',             'Barbarians',   'Force',  'Rare',      'HP'),
  ('Masked Fearmonger',    'Banner Lords', 'Spirit', 'Epic',      'Attack'),
  ('Mighty Ukko',          'Skinwalkers',  'Force',  'Legendary', 'Support'),
  ('Skull Lord Var-Gall',  'Lizardmen',    'Force',  'Legendary', 'Defense')
) as v(name, faction, affinity, rarity, role)
where not exists (
  select 1 from champions c
  where c.game_id = 'raid_shadow_legends' and c.name = v.name
);
