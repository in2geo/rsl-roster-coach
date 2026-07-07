-- ============================================================================
-- 57 — Repair 'Myciliac Priest Orn' identity + delete the empty 'Orn' shell.
--
-- Tier-1 in-game Index screenshot (2026-07-07) confirms:
--   Myciliac Priest Orn — Epic / Sylvan Watchers / Spirit / HP.
--
-- DB had two rows for this one champion:
--   * 'Myciliac Priest Orn' (id cc745173): correct faction (Sylvan Watchers) +
--     role (HP) + 1 champion_solo_profile, but MIS-SEEDED rarity=Legendary /
--     affinity=Magic. Kept + repaired to Epic / Spirit.
--   * 'Orn' (id 7b3c83a0): empty shell — right rarity (Epic) but wrong affinity
--     (Force), zero tags/stats/dependents. Deleted (guarded) + aliased.
--
-- Base stats NOT set: the in-game panel shows Total Stats (includes Great Hall),
-- not base. Identity fields only.
-- ============================================================================

-- 1. Repair the real Myciliac Priest Orn row (rarity + affinity).
update champions
set rarity   = 'Epic',
    affinity = 'Spirit'
where id = 'cc745173-52ca-4a02-871c-b899a0f27fb0'
  and name = 'Myciliac Priest Orn'
  and game_id = 'raid_shadow_legends';

-- 2. Alias 'Orn' -> Myciliac Priest Orn (shortform).
insert into champion_aliases (champion_id, alias, source)
select id, 'Orn', 'shortform' from champions
where game_id = 'raid_shadow_legends' and name = 'Myciliac Priest Orn'
on conflict do nothing;

-- 3. Guarded delete of the empty 'Orn' shell.
delete from champions
where game_id = 'raid_shadow_legends'
  and name = 'Orn'
  and type_id is null
  and not exists (select 1 from champion_tags               t where t.champion_id = champions.id)
  and not exists (select 1 from champion_solo_profiles      s where s.champion_id = champions.id)
  and not exists (select 1 from champion_ai_notes           n where n.champion_id = champions.id)
  and not exists (select 1 from champion_team_requirements  r where r.champion_id = champions.id)
  and not exists (select 1 from champion_strategy_modifiers m where m.champion_id = champions.id)
  and not exists (select 1 from champion_solo_research_log  l where l.champion_id = champions.id)
  and not exists (select 1 from user_champions             u where u.champion_id = champions.id)
  and not exists (select 1 from champion_aliases            a where a.champion_id = champions.id);
