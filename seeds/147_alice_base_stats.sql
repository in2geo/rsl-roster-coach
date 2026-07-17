-- ============================================================================
-- Seed 147 — Alice the Wanderer base stats (hand-added, Tier-1)
--
-- WHY SHE WAS MISSED BY THE BULK (seed 146): she is L60 6* but ASCENSION 5
-- (typeId 9495 - baseTypeId 9490), and Gestal reports base stats at a champion's
-- ACTUAL ascension. Her Gestal numbers are asc-5 values, ~2% below the asc-6
-- reference these columns store, so the bulk seed's `ascension === 6` filter
-- correctly excluded her. The community sheet does not carry her at all.
--
-- This mattered: Alice is fielded on 4 of GuapoDonni's 5 recommended teams, and
-- evaluateThresholds takes the TEAM MINIMUM with `?? 0` — so one null champion
-- reported team HP = 0 and pinned Ice Golem to Stage 1 / stats_failing / 40%
-- even AFTER seed 146 filled the other four.
--
-- SOURCE: in-game Index screenshot (Mike, 2026-07-16) — Tier 1, the top of the
-- project's source hierarchy. The Index shows champions at MAX ASCENSION
-- (magenta stars), which is exactly the asc-6 reference base_* stores. Note a
-- screenshot of his OWNED Alice would NOT have worked: the game reports her at
-- her actual asc-5. The Index sidesteps that closed window.
--
-- VALIDATES THE ASCENSION MODEL (asc-5 -> asc-6 deltas, measured):
--   HP 15690 -> 16020 (+330, +2.1%) | ATK 1387 -> 1443 (+56) | DEF 1057 -> 1068
--   (+11) | SPD 99 -> 99 (unchanged) | C.DMG 50 -> 63 (+13) | ACC 0 -> 10 (+10)
-- The +2.1% HP gap matches the ~2% predicted from the asc-5 sample (Hellborn
-- Sprite +2.2%), and confirms why Gestal's ACC/C.DMG read low on un-ascended
-- champions. Ascension grants ACC/C.DMG on this champion — worth remembering
-- before trusting Gestal ACC for any champion below asc-6.
--
-- Crit written as PERCENT (15 / 63) per estimate-stats.js. Fill-only guard.
-- ============================================================================

update champions set
  base_hp        = 16020,
  base_atk       = 1443,
  base_def       = 1068,
  base_spd       = 99,
  base_crit_rate = 15,
  base_crit_dmg  = 63,
  base_res       = 30,
  base_acc       = 10
where game_id = 'raid_shadow_legends'
  and name = 'Alice'
  and base_hp is null;
