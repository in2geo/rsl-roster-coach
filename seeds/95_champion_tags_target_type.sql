-- ============================================================================
-- 95 — Add target_type to champion_tags.
--
-- Per-tag target SCOPE for each champion_tags row:
--   aoe                 all enemies / all allies (team-wide, incl. auras)
--   single              one enemy / one ally / self
--   random              random target(s)
--   conditional_aoe     scope expands to AoE only under a condition
--   conditional_single  conditional single-target effect
--   unknown             skill text unavailable / indeterminate (default)
--
-- Values are backfilled in the worksheet DB_Champion_Tags tab (2026-07-09) via
-- per-tag / per-clause detection over the Skills tab, and will sync to the live
-- DB when the champion_tags rows are seeded. This ALTER is a committed seed —
-- NOT YET APPLIED to Supabase (gated with the rest of the seed-apply pass).
-- ============================================================================
alter table champion_tags
  add column if not exists target_type varchar(20)
  check (target_type in ('aoe', 'single', 'random', 'conditional_aoe', 'conditional_single', 'unknown'))
  default 'unknown';
