-- ============================================================================
-- 53 — Dedup: 'Grachos' is a truncated duplicate of 'Gracchos Turn-drake'.
--
-- Both are Demonspawn / Legendary / Force. 'Gracchos Turn-drake' (seed 40) is
-- canonical (matches the master spreadsheet "Gracchos Turn Drake", holds role
-- HP); 'Grachos' is an empty truncated shell — null type_id, null stats, and
-- ZERO references across all 8 champion child tables (verified 2026-07-07).
--
-- Seed 46's exact-name role UPDATE skipped 'Grachos', which is why it surfaced
-- as a "missing role" — it's a duplicate, not a gap.
--
-- 1. Register 'Grachos' as a truncation alias of the canonical row so any
--    future name-keyed source resolves to it instead of re-creating the dupe.
-- 2. Guarded delete of the 'Grachos' shell (seeds/27 pattern: type_id null AND
--    no child rows), so re-running is safe and a row that later gains data is
--    left untouched.
-- ============================================================================

-- 1. Alias 'Grachos' -> Gracchos Turn-drake (idempotent on the unique lower(alias)).
insert into champion_aliases (champion_id, alias, source)
select id, 'Grachos', 'truncation' from champions
where game_id = 'raid_shadow_legends' and name = 'Gracchos Turn-drake'
on conflict do nothing;

-- 2. Guarded delete of the truncated duplicate.
delete from champions
where game_id = 'raid_shadow_legends' and name = 'Grachos'
  and type_id is null
  and not exists (select 1 from champion_tags               t where t.champion_id = champions.id)
  and not exists (select 1 from champion_solo_profiles      s where s.champion_id = champions.id)
  and not exists (select 1 from champion_ai_notes           n where n.champion_id = champions.id)
  and not exists (select 1 from champion_team_requirements  r where r.champion_id = champions.id)
  and not exists (select 1 from champion_strategy_modifiers m where m.champion_id = champions.id)
  and not exists (select 1 from champion_solo_research_log  l where l.champion_id = champions.id)
  and not exists (select 1 from user_champions             u where u.champion_id = champions.id)
  and not exists (select 1 from champion_aliases            a where a.champion_id = champions.id);
