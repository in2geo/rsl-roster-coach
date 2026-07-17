-- ============================================================================
-- Seed 161 — backfill base_stat_reference_rank/level on the rows seeds 146-160 filled
--
-- WHY: `base_stat_reference_rank` / `base_stat_reference_level` record WHAT A ROW'S
-- STATS ARE SCALED TO. Base stats in Raid scale with stars and level, so a bare
-- number is meaningless without them — 14,085 HP is either a correct 5★/50 value or
-- a badly wrong 6★/60 one, and NOTHING in the row distinguishes those two cases.
-- Without the reference columns a stat row is unfalsifiable.
--
-- THIS IS NOT THEORETICAL. `Staltus Dragonbane` has sat at rank=5 / level=50 with
-- ATK 518 (impossible for a Legendary) since the 2026-06-24 load. It was caught ONLY
-- because its source_citation says so verbatim:
--     "Gestal export at 5★/50 — placeholder; refresh with 6★ base from raid.guide"
-- Every row filled since seed 146 had NULL reference columns, i.e. the same latent
-- failure with no citation to catch it. Found 2026-07-17 when Mike asked "do we have
-- all other information for Predator?" — the stat fills were never the whole row.
--
-- WHAT: 403 rows have base stats but NULL reference columns. That is EXACTLY the
-- 296 (seed 146) + 77 (seed 149) + 30 (seeds 150-160) this project filled. Every one
-- of those sources is a 6★ Lvl 60 reference by construction:
--   • seed 146 — Ερμής's sheet (6★ L60 columns) + Gestal restricted to 6★ L60 asc-6
--   • seed 149 — "Champ List Tizlerio" sheet (6★ L60 columns)
--   • seeds 150-160 — Mike's in-game champion screens, every one captioned "Lvl. 60"
--     with 6 stars visible
-- so 6/60 is a FACT about these rows, not an assumption.
--
-- GUARDED: `base_hp is not null and base_stat_reference_rank is null` — cannot touch
-- the 504 rows already marked 6/60, and CANNOT touch Staltus (his rank is 5, not
-- null). Fixing Staltus is a separate, evidence-backed decision; see below.
-- REPLAY-SAFE.
--
-- ⚠ STALTUS DRAGONBANE IS NOT FIXED HERE — and he is NOT one of the 19 "disputed"
-- rows, which is a correction to seed 149's header. The Tizlerio sheet reads HP
-- 20,805 against our 14,085 and I logged that as a disagreement. It is not: our row
-- is a self-documented placeholder and the sheet is almost certainly right (20805 =
-- 1387 × 15, and it is a plausible 6★/60 Legendary). But overwriting a populated row
-- wants Tier-1 evidence, not a Tier-2 sheet — ONE in-game screenshot settles it.
-- Do not "fix" him from the sheet without that.
--
-- ⚠ ALSO OUTSTANDING (found in the same audit, not fixed here):
--   • `source_citation` is set on only 110 of 908 stat-bearing rows. It is what saved
--     Staltus. tools/seed-base-stats.mjs now writes one on every future fill.
--   • `type_id` is set on only 240 of 1021 rows. Roster matching keys on type_id
--     (the stable baseTypeId), not names — see the champion-identity-typeid memory.
--   • 5 rows cite "in-game Index — base stats to be populated by scraper" and 3 cite
--     "base stats not yet on raid.guide or Gestal. Run stat scraper when available."
--     Those are more self-documented placeholders. Worth re-checking whether they are
--     still unpopulated or were silently filled by a later bulk load.
-- ============================================================================

update champions
set base_stat_reference_rank = 6,
    base_stat_reference_level = 60
where game_id = 'raid_shadow_legends'
  and base_hp is not null
  and base_stat_reference_rank is null
  and base_stat_reference_level is null;
