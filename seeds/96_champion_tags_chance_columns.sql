-- ============================================================================
-- 96 — Add chance columns to champion_tags. Stores the unbooked / fully-booked
-- placement chance for a debuff (percent, 0-100). Mirrors the worksheet
-- DB_Champion_Tags cols chance_unbooked / chance_booked. Idempotent.
-- ============================================================================
alter table champion_tags
  add column if not exists chance_unbooked numeric,
  add column if not exists chance_booked   numeric;
