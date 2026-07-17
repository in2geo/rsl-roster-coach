-- ============================================================================
-- Seed 163 — CORRECT Staltus Dragonbane (the 5★/50 placeholder) — TIER-1
--
-- ⚠ THIS IS AN OVERWRITE OF A POPULATED ROW. Every other base-stat seed in this
-- project (146, 149-162) is fill-only and guarded `base_hp is null`. This one is
-- deliberately different. The justification:
--
--   1. The row is a SELF-DOCUMENTED PLACEHOLDER. Its own source_citation reads:
--        "Gestal export at 5★/50 — placeholder; refresh with 6★ base from raid.guide"
--      It has carried base_stat_reference_rank=5 / base_stat_reference_level=50
--      since the 2026-06-24 load — the ONLY such row in 908. We are not overruling
--      a considered value; we are doing what the row asks for.
--   2. The replacement is TIER-1: Mike's in-game champion screen, 6★ Lvl 60,
--      2026-07-17. That outranks everything else in the CLAUDE.md hierarchy.
--   3. It is independently corroborated: the "Champ List Tizlerio" sheet reads HP
--      20,805 — matching the screenshot exactly. Seed 149 logged that as one of the
--      19 "disputed" rows. IT WAS NEVER A DISPUTE. That header is wrong; the sheet
--      was right and we were the placeholder. Corrected here.
--   4. It passes the rules: 20805 = 1387 × 15, and ATK 518 is impossible for a
--      6★/60 Legendary (the corpus range is ~700-1750).
--
-- THE DIFF (live -> in-game), from tools/seed-base-stats.mjs:
--     base_hp        14085 -> 20805
--     base_atk         518 -> 738
--     base_def         972 -> 1454
--     base_acc           0 -> 10
--     base_crit_dmg    0.5 -> 63      (fraction encoding AND wrong value: 0.5×100=50, not 63)
--     base_crit_rate  0.15 -> 15      (fraction encoding; value was right)
--     base_spd          99 -> 99      ✓ ALREADY CORRECT
--     base_res          30 -> 30      ✓ ALREADY CORRECT
--
-- ▶ WHY SPD AND RES WERE ALREADY RIGHT — a fact worth keeping. Only HP/ATK/DEF
-- scale with stars and level. SPD, RES, ACC and crit are FLAT. That is why a 5★/50
-- export had correct SPD (99) and RES (30) while HP/ATK/DEF were all ~1.42-1.50×
-- too small. Consequences:
--   • A wrongly-scaled row is HARDER to spot than a blank one — it is only wrong in
--     3 of 8 columns, and the other 5 look reassuring.
--   • This is the missing half of the known `estimateStats` bug (no level/stars
--     scaling, ~3.3× over-estimate on under-levelled champs, see the
--     stat-estimator-accuracy memory). Whatever scaling curve gets implemented must
--     apply to HP/ATK/DEF ONLY. Scaling SPD would be a new bug.
--   • ACC 0->10 and crit_dmg 0.5->63 are NOT scaling errors — those are DEFAULTS
--     that got written where real values were unknown. Same shape as Sunken
--     Sentinel's crit_dmg. A defaulted value is indistinguishable from a measured
--     one once the citation is gone.
--
-- After this, base_stat_reference_rank/level is 6/60 on ALL 908 stat-bearing rows
-- and the 5★/50 outlier is gone.
-- ============================================================================

update champions
set base_hp = 20805,
    base_atk = 738,
    base_def = 1454,
    base_spd = 99,
    base_crit_rate = 15,
    base_crit_dmg = 63,
    base_res = 30,
    base_acc = 10,
    base_stat_reference_rank = 6,
    base_stat_reference_level = 60,
    source_citation = 'in-game Index 6★ L60 Total Stats (Mike screenshot 2026-07-17). Replaces the 5★/50 Gestal placeholder. Corroborated by the Tizlerio sheet (HP 20805). HP ✓ multiple-of-15.'
where game_id = 'raid_shadow_legends'
  and name = 'Staltus Dragonbane'
  and base_stat_reference_rank = 5;   -- guard: only fires on the known placeholder; no-op once fixed
