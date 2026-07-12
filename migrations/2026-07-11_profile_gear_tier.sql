-- ============================================================================
-- Gear tier is ACCOUNT-level (2026-07-11 decision), not per-champion. Add it to
-- profiles alongside account_development + masteries_default so the whole gear
-- context lives on the profile. user_champions.gear_tier is no longer read by the
-- engine (manual rosters); Gestal rosters use real effective_stats regardless.
-- Conservative default for the new/limited-roster audience. Idempotent.
-- Apply via the aws-1 pooler (tools/apply-seed-pooler.mjs).
-- ============================================================================
alter table profiles
  add column if not exists gear_tier text
    check (gear_tier in ('starter','fair','good','endgame')) default 'starter';
