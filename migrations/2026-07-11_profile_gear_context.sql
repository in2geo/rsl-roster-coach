-- ============================================================================
-- Add account-level gear context to profiles, for the recommendation engine's
-- stat estimator (updated gear-tier system, 2026-07-11):
--   • account_development — the Great Hall + Arena bonus bundle (poor/fair/good)
--   • masteries_default   — account-level masteries setting (none/partial/full),
--                           a Clan-Boss damage modifier (per-champion override TBD)
-- Consumed ONLY for MANUAL rosters; Gestal rosters carry real effective stats that
-- already include these bonuses, so the estimator is bypassed there (no double-count).
-- Defaults are conservative for this app's new/limited-roster audience.
-- Idempotent. Apply via the aws-1 pooler (tools/apply-seed-pooler.mjs).
-- ============================================================================
alter table profiles
  add column if not exists account_development text
    check (account_development in ('poor','fair','good')) default 'poor',
  add column if not exists masteries_default text
    check (masteries_default in ('none','partial','full')) default 'none';
