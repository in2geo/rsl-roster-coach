-- ============================================================================
-- 62 — Delete the 'Armored Golem' mis-seed (non-champion) + its 'Golem' alias.
--
-- 'Armored Golem' (Rare / Banner Lords / Magic) is not a playable RAID champion
-- — confirmed absent from the game and community resources (2026-07-07). It was
-- an empty shell: null role / type_id / base stats, zero rows in all 7 champion
-- child tables, and only a self-referential 'Golem' shortform alias. Golems are
-- dungeon enemies, not recruitable champions; this was scraped in by mistake
-- (despite its 'in-game Index' source_citation).
--
-- Drop the alias first (it would otherwise block the guarded delete, and a stray
-- 'Golem' alias could mis-map a future Golem enemy onto a champion), then delete
-- the row. Guarded + idempotent.
-- ============================================================================

-- 1. Remove the 'Golem' -> Armored Golem alias.
delete from champion_aliases a
using champions c
where a.champion_id = c.id
  and c.game_id = 'raid_shadow_legends'
  and c.name = 'Armored Golem'
  and a.alias = 'Golem';

-- 2. Guarded delete of the empty 'Armored Golem' shell.
delete from champions
where game_id = 'raid_shadow_legends'
  and name = 'Armored Golem'
  and type_id is null
  and not exists (select 1 from champion_tags               t where t.champion_id = champions.id)
  and not exists (select 1 from champion_solo_profiles      s where s.champion_id = champions.id)
  and not exists (select 1 from champion_ai_notes           n where n.champion_id = champions.id)
  and not exists (select 1 from champion_team_requirements  r where r.champion_id = champions.id)
  and not exists (select 1 from champion_strategy_modifiers m where m.champion_id = champions.id)
  and not exists (select 1 from champion_solo_research_log  l where l.champion_id = champions.id)
  and not exists (select 1 from user_champions             u where u.champion_id = champions.id)
  and not exists (select 1 from champion_aliases            a where a.champion_id = champions.id);
