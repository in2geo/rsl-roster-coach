-- ============================================================================
-- Base-stat corrections for the mis-seeded champion rows fixed in
-- seeds/11_champion_type_ids.sql (identity was wrong, so stats were too).
-- Crit stored as fractions (0.15 / 0.50); reference = 6 stars, level 60.
--
-- Sources:
--   Narma the Returned  — raid.guide (clean base, no Great Hall).
--   Longsword Torrux    — in-game champion screen, 6* L60 UNGEARED "Total Stats".
--     NOTE: in-game Total Stats include Great Hall bonuses (RES shows 40 vs the
--     standard 30 base => ~+10 GH; HP/DEF are a few % high). raid.guide does not
--     list this champion yet; re-verify the clean base when it does. Flagged, not
--     exact — acceptable given the stat engine's gear modifiers are still placeholders.
--   Sunken Sentinel     — NOT yet corrected (still needs an authoritative source).
-- ============================================================================

-- Narma the Returned (raid.guide clean base)
update champions set
  base_hp = 19815, base_atk = 1002, base_def = 1255, base_spd = 100,
  base_crit_rate = 0.15, base_crit_dmg = 0.50, base_res = 30, base_acc = 20,
  base_stat_reference_rank = 6, base_stat_reference_level = 60,
  source_citation = 'raid.guide (6* L60 base)', updated_at = now()
 where game_id = 'raid_shadow_legends' and type_id = 5350;

-- Longsword Torrux (in-game 6* L60 Total Stats; includes Great Hall — see note)
update champions set
  base_hp = 15030, base_atk = 749, base_def = 1277, base_spd = 96,
  base_crit_rate = 0.15, base_crit_dmg = 0.50, base_res = 40, base_acc = 0,
  base_stat_reference_rank = 6, base_stat_reference_level = 60,
  source_citation = 'in-game 6* L60 Total Stats (incl. Great Hall — verify vs raid.guide when listed)',
  updated_at = now()
 where game_id = 'raid_shadow_legends' and type_id = 8340;
