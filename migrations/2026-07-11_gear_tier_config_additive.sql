-- ============================================================================
-- Realign gear_tier_config to the ADDITIVE gear-tier system (2026-07-11) and add
-- account_development_config. These tables are the DB copy of the constants in
-- lib/estimate-stats.js (GEAR_TIERS / ACCOUNT_DEV) — kept in sync for future
-- calibration without code changes. The engine currently reads the code constants;
-- the tables are the source of record per CLAUDE.md ("store in config, not hardcoded").
-- gear_tier_config was previously vestigial (old multiplicative columns, unused).
-- All numbers are PLACEHOLDER — calibrate against 10-15 real accounts before ship.
-- Idempotent. Apply via the aws-1 pooler (tools/apply-seed-pooler.mjs).
-- ============================================================================

-- Swap the old multiplicative columns for the additive-model columns.
alter table gear_tier_config
  drop column if exists hp_mult,  drop column if exists atk_mult, drop column if exists def_mult,
  drop column if exists spd_add,  drop column if exists acc_add,  drop column if exists res_add,
  add  column if not exists hp_pct   numeric, add column if not exists atk_pct  numeric,
  add  column if not exists def_pct  numeric, add column if not exists spd_flat numeric,
  add  column if not exists acc_flat numeric, add column if not exists res_flat numeric,
  add  column if not exists crate    numeric, add column if not exists cdmg     numeric;

-- Old CHECK pinned gear_tier to Starter/Dungeon/Strong/God Tier. Drop it, clear the
-- legacy rows, THEN add the new-label constraint (added constraints validate against
-- existing rows immediately, so the delete must come first).
alter table gear_tier_config drop constraint if exists gear_tier_config_gear_tier_check;
delete from gear_tier_config;
alter table gear_tier_config add constraint gear_tier_config_gear_tier_check
  check (gear_tier in ('starter','fair','good','endgame'));

insert into gear_tier_config (gear_tier, hp_pct, atk_pct, def_pct, spd_flat, acc_flat, res_flat, crate, cdmg, notes) values
  ('starter', 0.30, 0.30, 0.30,  15,  30,  20, 0.20, 0.20, 'placeholder — mirrors estimate-stats.js GEAR_TIERS'),
  ('fair',    0.60, 0.60, 0.60,  35,  80,  50, 0.45, 0.50, 'placeholder — mirrors estimate-stats.js GEAR_TIERS'),
  ('good',    1.00, 1.00, 1.00,  60, 150,  80, 0.70, 0.80, 'placeholder — mirrors estimate-stats.js GEAR_TIERS'),
  ('endgame', 2.00, 2.00, 2.00, 100, 220, 120, 0.90, 1.30, 'placeholder — mirrors estimate-stats.js GEAR_TIERS');

-- Account-development bonus bundle (Great Hall + Arena), applied on top of gear.
create table if not exists account_development_config (
  account_development text primary key check (account_development in ('poor','fair','good')),
  hp_pct   numeric, atk_pct numeric, def_pct numeric,
  acc_flat numeric, res_flat numeric, cdmg numeric,
  notes text
);
delete from account_development_config;
insert into account_development_config (account_development, hp_pct, atk_pct, def_pct, acc_flat, res_flat, cdmg, notes) values
  ('poor', 0.05, 0.05, 0.05,  5,  5, 0.02, 'placeholder — mirrors estimate-stats.js ACCOUNT_DEV'),
  ('fair', 0.14, 0.14, 0.14, 20, 15, 0.06, 'placeholder — mirrors estimate-stats.js ACCOUNT_DEV'),
  ('good', 0.28, 0.28, 0.28, 40, 30, 0.15, 'placeholder — mirrors estimate-stats.js ACCOUNT_DEV');
