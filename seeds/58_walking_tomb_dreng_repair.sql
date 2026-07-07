-- ============================================================================
-- 58 — Repair 'Walking Tomb Dreng' identity + delete the empty 'Dreng' shell.
--
-- Tier-1 in-game Index screenshot (2026-07-07) confirms:
--   Walking Tomb Dreng — Legendary / Knights Revenant / Void / HP.
--   NOTE: affinity is VOID (purple icon), NOT Spirit as the master CSV listed —
--   the CSV was wrong here; the screenshot governs.
--
-- DB had two rows for this one champion:
--   * 'Walking Tomb Dreng' (id 0959c10e): correct rarity (Legendary) + role (HP)
--     + HP Burn tag + 1 solo_profile + base stats, but MIS-SEEDED
--     faction=Undead Hordes / affinity=Force. Kept + repaired.
--   * 'Dreng' (id 3a0413f9): empty shell — right faction (Knights Revenant) but
--     wrong affinity (Magic), zero tags/stats/dependents. Deleted + aliased.
--
-- Base stats left as-is: the row's base_hp (23130) / base_spd (99) equal the
-- in-game TOTAL Stats (Great-Hall-inflated), so they are overstated vs true
-- base — flagged for a later normalization pass, not corrected here.
-- ============================================================================

-- 1. Repair the real Walking Tomb Dreng row (faction + affinity).
update champions
set faction  = 'Knights Revenant',
    affinity = 'Void'
where id = '0959c10e-1abe-4a63-bd3e-8a58e808bb43'
  and name = 'Walking Tomb Dreng'
  and game_id = 'raid_shadow_legends';

-- 2. Alias 'Dreng' -> Walking Tomb Dreng (shortform).
insert into champion_aliases (champion_id, alias, source)
select id, 'Dreng', 'shortform' from champions
where game_id = 'raid_shadow_legends' and name = 'Walking Tomb Dreng'
on conflict do nothing;

-- 3. Guarded delete of the empty 'Dreng' shell.
delete from champions
where game_id = 'raid_shadow_legends'
  and name = 'Dreng'
  and type_id is null
  and not exists (select 1 from champion_tags               t where t.champion_id = champions.id)
  and not exists (select 1 from champion_solo_profiles      s where s.champion_id = champions.id)
  and not exists (select 1 from champion_ai_notes           n where n.champion_id = champions.id)
  and not exists (select 1 from champion_team_requirements  r where r.champion_id = champions.id)
  and not exists (select 1 from champion_strategy_modifiers m where m.champion_id = champions.id)
  and not exists (select 1 from champion_solo_research_log  l where l.champion_id = champions.id)
  and not exists (select 1 from user_champions             u where u.champion_id = champions.id)
  and not exists (select 1 from champion_aliases            a where a.champion_id = champions.id);
