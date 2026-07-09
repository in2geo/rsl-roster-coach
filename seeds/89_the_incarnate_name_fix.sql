-- ============================================================================
-- 89 — Fix The Incarnate name + preserve old spelling as a searchable alias.
--
-- CONFLICTS.md 3b RELINK: live DB stored 'Incarnate' (no 'The'); master
-- worksheet (C000849) + in-game Index screenshot 2026-07-09 (Lvl 60, magenta
-- 6-star, Legendary, High Elves, role Defense) confirm canonical 'The
-- Incarnate'. Single live row, no tags/notes/roster refs, type_id NULL — a
-- clean rename (not a merge).
--
-- ⚠️ NOT changed here — UNRESOLVED affinity conflict: master says FORCE, live DB
-- says SPIRIT. The Index detail screen does not label affinity as text, so it
-- could not be confirmed from the screenshot. Affinity left untouched pending
-- verification (affinity-color screenshot or a Force/Spirit-labelled source).
--
-- Part 1: rename 'Incarnate' -> 'The Incarnate'.
-- Part 2: register 'Incarnate' as a search alias. Both idempotent.
-- ============================================================================

update champions
set name = 'The Incarnate'
where game_id = 'raid_shadow_legends' and name = 'Incarnate';

insert into champion_aliases (game_id, champion_id, alias, source)
select 'raid_shadow_legends', ch.id, 'Incarnate', 'shortform'
from champions ch
where ch.game_id = 'raid_shadow_legends' and ch.name = 'The Incarnate'
  and not exists (
    select 1 from champion_aliases a
    where a.champion_id = ch.id and lower(a.alias) = lower('Incarnate'));
