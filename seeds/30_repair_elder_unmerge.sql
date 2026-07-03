-- 30 — Repair: undo the incorrect "Elder → Elder Skarg" merge.
--
-- "Elder" (Rare, Magic, faction 13, type_id 2030) and "Elder Skarg" (Legendary) are TWO
-- DIFFERENT champions — user-confirmed. An earlier seed 27 wrongly treated the prefix
-- match as a truncation and merged them: it gave Elder Skarg type_id 2030, moved Elder's
-- unique tags (Ally Protection, Counterattack) onto Elder Skarg, and deleted the Elder
-- row. This repairs both. Every step is guarded so it is a no-op on a correctly-built DB.
--
-- NOTE: Elder's faction here ('Barbarians') is DERIVED from Gestal factionId 13 (which
-- was ambiguous with 6=Barbarians) — verify. affinity/role/base-stats were never in a
-- committed seed and are left null to be backfilled (raid.guide scraper).

-- 1. Elder Skarg must not hold Elder's type_id.
update champions set type_id = null
where game_id = 'raid_shadow_legends' and name = 'Elder Skarg' and type_id = 2030;

-- 2. Remove Elder's tags that the merge pushed onto Elder Skarg (Elder Skarg's real kit
--    has neither Ally Protection nor Counterattack).
delete from champion_tags
where champion_id = (select id from champions where name = 'Elder Skarg' and game_id = 'raid_shadow_legends')
  and tag_id in (select id from tags where name in ('Ally Protection', 'Counterattack'));

-- 3. Recreate the Elder champion row if the merge deleted it (minimal identity — type_id
--    2030 + required faction/rarity; other fields backfilled later).
insert into champions (game_id, name, faction, rarity, type_id)
select 'raid_shadow_legends', 'Elder', 'Barbarians', 'Rare', 2030
where not exists (select 1 from champions where game_id = 'raid_shadow_legends' and name = 'Elder');

-- 4. Restore Elder's 3 tags (from seed 15), guarded.
insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by, proposed_at, ascension_required)
select ch.id, t.id, 'proposed', 'raid_guide', 'raid.guide A1 Mocking Blow: [Provoke] 25% unbooked (25% booked − 0% book). single-target.', 'raid-guide-scraper', now(), 0
from champions ch join tags t on t.name = 'Provoke'
where ch.game_id = 'raid_shadow_legends' and ch.name = 'Elder'
  and not exists (select 1 from champion_tags x where x.champion_id = ch.id and x.tag_id = t.id);

insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by, proposed_at, ascension_required)
select ch.id, t.id, 'proposed', 'raid_guide', 'raid.guide A2 Intercede: [Ally Protection] no explicit chance in description. single-target. Cooldown 4 unbooked, 3 fully booked.', 'raid-guide-scraper', now(), 0
from champions ch join tags t on t.name = 'Ally Protection'
where ch.game_id = 'raid_shadow_legends' and ch.name = 'Elder'
  and not exists (select 1 from champion_tags x where x.champion_id = ch.id and x.tag_id = t.id);

insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by, proposed_at, ascension_required)
select ch.id, t.id, 'proposed', 'raid_guide', 'raid.guide A3 Take Vengeance: [Counterattack] no explicit chance in description. single-target. Cooldown 5 unbooked, 4 fully booked.', 'raid-guide-scraper', now(), 0
from champions ch join tags t on t.name = 'Counterattack'
where ch.game_id = 'raid_shadow_legends' and ch.name = 'Elder'
  and not exists (select 1 from champion_tags x where x.champion_id = ch.id and x.tag_id = t.id);

-- 5. Drop the incorrect 'Elder' alias (Elder is its own canonical champion, not an alias).
delete from champion_aliases where game_id = 'raid_shadow_legends' and lower(alias) = 'elder';
