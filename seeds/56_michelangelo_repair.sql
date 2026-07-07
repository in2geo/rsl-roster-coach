-- ============================================================================
-- 56 — Repair 'Michelangelo' identity + delete the empty 'Mikey' shell.
--
-- Tier-1 in-game Index screenshot (2026-07-07) confirms:
--   Michelangelo — Legendary / Banner Lords / Spirit / Attack (TMNT collab).
--
-- DB had two rows for this one champion:
--   * 'Michelangelo' (id fc4ad157): correct role (Attack) + 3 champion_solo_profiles,
--     but MIS-SEEDED faction=Shadowkin / affinity=Force. Kept + repaired.
--   * 'Mikey' (id 83f050c4): empty shell — right faction (Banner Lords) but wrong
--     affinity (Void), zero tags/stats/dependents. Deleted (guarded) + aliased.
--
-- Base stats NOT set: the in-game panel shows Total Stats (C.DMG 63% includes
-- Great Hall), not base. Identity fields only.
-- ============================================================================

-- 1. Repair the real Michelangelo row (faction + affinity; role/rarity already right).
update champions
set faction  = 'Banner Lords',
    affinity = 'Spirit'
where id = 'fc4ad157-66c8-431a-a925-5ad23cf0db64'
  and name = 'Michelangelo'
  and game_id = 'raid_shadow_legends';

-- 2. Alias 'Mikey' -> Michelangelo (shortform) so the nickname resolves post-delete.
insert into champion_aliases (champion_id, alias, source)
select id, 'Mikey', 'shortform' from champions
where game_id = 'raid_shadow_legends' and name = 'Michelangelo'
on conflict do nothing;

-- 3. Guarded delete of the empty 'Mikey' shell.
delete from champions
where game_id = 'raid_shadow_legends'
  and name = 'Mikey'
  and type_id is null
  and not exists (select 1 from champion_tags               t where t.champion_id = champions.id)
  and not exists (select 1 from champion_solo_profiles      s where s.champion_id = champions.id)
  and not exists (select 1 from champion_ai_notes           n where n.champion_id = champions.id)
  and not exists (select 1 from champion_team_requirements  r where r.champion_id = champions.id)
  and not exists (select 1 from champion_strategy_modifiers m where m.champion_id = champions.id)
  and not exists (select 1 from champion_solo_research_log  l where l.champion_id = champions.id)
  and not exists (select 1 from user_champions             u where u.champion_id = champions.id)
  and not exists (select 1 from champion_aliases            a where a.champion_id = champions.id);
