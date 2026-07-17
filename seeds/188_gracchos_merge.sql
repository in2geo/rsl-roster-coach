-- ============================================================================
-- 188 — Merge the duplicate Gracchos rows (data repair). CONTAINS A ROW DELETE.
--
-- PILOT for the phantom-cleanup pass (knowledge/HANDOFF_2026-07-18.md): proves the
-- merge mechanics on one row before the 65-row batch. Unlike a plain phantom, the
-- correct NAME and the correct DATA live on DIFFERENT rows here, so this is a true
-- merge, not a delete.
--
-- The live DB has TWO rows for the one real champion (Legendary, Demonspawn):
--   • 'Gracchos Turn Drake' (4a8175bd-6029-4456-b35d-6ee637f20c67)
--       WRONG name (space, no captured stats) but holds ALL the real content:
--       4 skills / 8 tags / 1 aura, and the CORRECT affinity (Spirit, matches the
--       in-game card). KEPT — this is the survivor.
--   • 'Gracchos Turn-drake' (d1da2423-f5d7-4dab-9789-647612004c33)
--       CORRECT name (hyphen, lowercase d — matches the in-game card) but EMPTY
--       (0 skills / 0 tags / 0 auras) and WRONG affinity (Force). Carries only the
--       'Grachos' truncation alias. DELETED after the alias is migrated off it.
-- Verified 2026-07-17: shell d1da2423 is referenced by nothing except that alias
-- (champion_skills/tags/auras/solo_profiles/user_champions/team_requirements/
-- strategy_modifiers all = 0). Keeper 4a8175bd carries 4/8/1.
--
-- ORDER MATTERS (two reasons):
--   1. FK champion_aliases -> champions is ON DELETE CASCADE, so the alias MUST be
--      re-pointed BEFORE the shell is deleted or it is destroyed (same trap as seed 87).
--   2. NAME COLLISION: the keeper's FINAL name equals the shell's CURRENT name
--      ('Gracchos Turn-drake'). So the shell is deleted BEFORE the keeper is renamed;
--      the two rows never share a name. Everything is keyed by UUID, not name.
--
-- STATS: Tier-1, from Mike's in-game champion screen (6* Lvl 60), captured 2026-07-17.
--   hp 22635 / atk 826 / def 1244 / spd 99 / crit_rate 15% / crit_dmg 63% / res 30 / acc 10
--   HP 22635 = 15 x 1509 — passes the multiple-of-15 rule (CLAUDE.md).
--   Reference rank/level set to 6/60 so the row is falsifiable (see seed 161).
--   Keeper's stored base_crit_dmg was 50; the card reads 63 -> corrected here.
--
-- Idempotent / replay-safe: step 1 no-ops once the alias points at the keeper;
-- the delete no-ops once the shell is gone; the update re-applies identical values;
-- the alias insert is NOT EXISTS-guarded.
-- ============================================================================

-- 1. Re-point the 'Grachos' alias from the doomed shell onto the surviving keeper.
update champion_aliases
set champion_id = '4a8175bd-6029-4456-b35d-6ee637f20c67'
where game_id = 'raid_shadow_legends'
  and champion_id = 'd1da2423-f5d7-4dab-9789-647612004c33';

-- 2. Delete the empty shell. Done BEFORE the rename so no two rows share a name.
delete from champions
where id = 'd1da2423-f5d7-4dab-9789-647612004c33'
  and game_id = 'raid_shadow_legends';

-- 3. Rename the survivor to the in-game canonical name and fill the Tier-1 base stats.
update champions set
  name = 'Gracchos Turn-drake',
  base_hp = 22635, base_atk = 826, base_def = 1244, base_spd = 99,
  base_res = 30, base_acc = 10,
  base_crit_rate = 15, base_crit_dmg = 63,
  base_stat_reference_rank = 6, base_stat_reference_level = 60,
  source_citation = 'In-game champion screen (6-star Lvl 60), Mike screenshot 2026-07-17 — TIER-1. Merge of duplicate rows (seed 188): name+affinity from the shell d1da2423, content from the keeper 4a8175bd.',
  updated_at = now()
where id = '4a8175bd-6029-4456-b35d-6ee637f20c67'
  and game_id = 'raid_shadow_legends';

-- 4. Preserve the prior 'Gracchos Turn Drake' spelling as a searchable alias.
insert into champion_aliases (game_id, champion_id, alias, source)
select 'raid_shadow_legends', '4a8175bd-6029-4456-b35d-6ee637f20c67', 'Gracchos Turn Drake', 'misspelling'
where not exists (
  select 1 from champion_aliases a
  where a.champion_id = '4a8175bd-6029-4456-b35d-6ee637f20c67'
    and lower(a.alias) = lower('Gracchos Turn Drake'));
