-- ============================================================================
-- 197 — Short-form (in-game grid display) name aliases so portrait recovery — and
-- any-name resolution — matches these champions. The faction roster grid labels each
-- card with the SHORT name; these three had no alias for it, so recover-portraits.js
-- (and the resolver) couldn't bridge the grid name to the DB long name.
-- Each short form is unique to one champion (verified 2026-07-18); no collision.
-- ============================================================================

insert into champion_aliases (game_id, champion_id, alias, source)
select 'raid_shadow_legends', id, 'Bloatwraith', 'shortform' from champions
where game_id='raid_shadow_legends' and name='Drowned Bloatwraith'
  and not exists (select 1 from champion_aliases a where a.champion_id=champions.id and lower(a.alias)='bloatwraith');

insert into champion_aliases (game_id, champion_id, alias, source)
select 'raid_shadow_legends', id, 'Skeleton', 'shortform' from champions
where game_id='raid_shadow_legends' and name='Amarantine Skeleton'
  and not exists (select 1 from champion_aliases a where a.champion_id=champions.id and lower(a.alias)='skeleton');

insert into champion_aliases (game_id, champion_id, alias, source)
select 'raid_shadow_legends', id, 'Vallaryn', 'shortform' from champions
where game_id='raid_shadow_legends' and name='Vallaryn the Equalizer'
  and not exists (select 1 from champion_aliases a where a.champion_id=champions.id and lower(a.alias)='vallaryn');
