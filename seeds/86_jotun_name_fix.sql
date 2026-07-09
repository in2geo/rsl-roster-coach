-- ============================================================================
-- 86 — Fix Jotun name + preserve the old spelling as a searchable alias.
--
-- CONFLICTS.md 3a RELINK: live DB stored the champion as 'Jotunn' (double-n)
-- with 2 tags (Decrease Defense, HP Burn); master worksheet (C000390) has the
-- canonical 'Jotun'. In-game Index screenshot 2026-07-09 (Lvl 60, magenta
-- 6-star, Epic, role HP) confirms 'Jotun'. Everything else already agreed
-- (Epic / Barbarians / Magic / HP). No separate 'Jotun' row exists, so this is
-- a rename, NOT a tag relink — the 2 champion_tags travel with the row via FK.
--
-- Part 1: rename 'Jotunn' -> 'Jotun'.
-- Part 2: register 'Jotunn' as a misspelling alias so PWA search still finds it
--         (resolver ignores champion_aliases.source; see aliases architecture).
-- Both idempotent.
-- ============================================================================

update champions
set name = 'Jotun'
where game_id = 'raid_shadow_legends' and name = 'Jotunn';

insert into champion_aliases (game_id, champion_id, alias, source)
select 'raid_shadow_legends', ch.id, 'Jotunn', 'misspelling'
from champions ch
where ch.game_id = 'raid_shadow_legends' and ch.name = 'Jotun'
  and not exists (
    select 1 from champion_aliases a
    where a.champion_id = ch.id and lower(a.alias) = lower('Jotunn'));
