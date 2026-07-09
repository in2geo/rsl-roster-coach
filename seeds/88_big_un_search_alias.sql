-- ============================================================================
-- 88 — Add a no-apostrophe search alias for Big 'Un.
--
-- CONFLICTS.md 3b RELINK candidate ('Big 'Un' vs master 'Big Un'). Resolved by
-- in-game Index screenshot 2026-07-09 (Lvl 60, magenta 6-star, Legendary, role
-- Attack): canonical name is "Big 'Un" WITH the apostrophe. The live DB row is
-- already correct on every field (Legendary / Ogryn Tribes / Magic / Attack) —
-- so NO champion-row change is needed here (unlike Jotun/Polara). The master
-- worksheet has the off-spelling 'Big Un' (no apostrophe) — flagged for a
-- worksheet edit; the DB is the correct layer this time.
--
-- Only DB action: add 'Big Un' (no apostrophe) as a search alias so players who
-- omit the apostrophe still find him. Existing alias ''Un' (shortform) is kept.
-- Idempotent (NOT EXISTS guard).
-- ============================================================================
insert into champion_aliases (game_id, champion_id, alias, source)
select 'raid_shadow_legends', ch.id, 'Big Un', 'misspelling'
from champions ch
where ch.game_id='raid_shadow_legends' and ch.name='Big ''Un'
  and not exists (
    select 1 from champion_aliases a
    where a.champion_id = ch.id and lower(a.alias) = lower('Big Un'));
