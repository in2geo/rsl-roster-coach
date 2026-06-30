-- ============================================================================
-- Migration: multi-account support under Supabase Auth
-- ============================================================================
-- Adds the User (auth.users) → RSL Accounts (many) hierarchy and re-points
-- champion + artifact ownership at an RSL account instead of a bare user_id.
--
-- TRANSITION SAFETY (this migration is additive and non-breaking):
--   • All new columns are NULLABLE — existing inserts (the device-UUID path that
--     writes user_champions with user_id only) keep working unchanged.
--   • The existing unique(user_id, champion_id) constraint is left intact; a new
--     partial unique on (account_id, champion_id) covers the account path without
--     colliding with legacy rows.
--   • RLS is enabled ONLY on the new tables (rsl_accounts, account_artifacts).
--     Existing tables are untouched, so the current service-key API keeps full
--     access. The service role bypasses RLS, so even the new tables stay readable
--     by the existing backend.
--   • Idempotent: safe to re-run (IF NOT EXISTS / DROP POLICY IF EXISTS guards).
--
-- SUPABASE AUTH: enabling Auth itself (email/OAuth providers, redirect URLs) is a
-- project-dashboard setting, not SQL. auth.users already exists in every Supabase
-- project. This migration wires the data model + row-level security to it.
-- ============================================================================

-- ── Shared helper: keep updated_at fresh ────────────────────────────────────
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============================================================================
-- 1. rsl_accounts — links an authenticated user to one or more RSL accounts
-- ============================================================================
create table if not exists rsl_accounts (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  game_id        text not null default 'raid_shadow_legends',

  account_id     text not null,            -- Gestal account key, e.g. '9d7ce1cb4cd18276'
  display_name   text,                     -- 'DonCobb07'
  raid_player_id text,                     -- Plarium player id, e.g. '160725022'

  last_synced_at timestamptz,              -- from Gestal export (lastSnapshotAt/syncedAt)
  game_version   text,

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  -- one link per (user, gestal account); a user can hold many accounts.
  unique (user_id, account_id)
);

create index if not exists idx_rsl_accounts_user    on rsl_accounts(user_id);
create index if not exists idx_rsl_accounts_account on rsl_accounts(account_id);

drop trigger if exists trg_rsl_accounts_updated on rsl_accounts;
create trigger trg_rsl_accounts_updated
  before update on rsl_accounts
  for each row execute function set_updated_at();

-- RLS: an authenticated user sees/edits only their own account links.
alter table rsl_accounts enable row level security;
drop policy if exists rsl_accounts_owner on rsl_accounts;
create policy rsl_accounts_owner on rsl_accounts
  for all
  using      (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ============================================================================
-- 2. user_champions — add account scoping (additive; user_id path still works)
-- ============================================================================
alter table user_champions
  add column if not exists account_id uuid references rsl_accounts(id) on delete cascade;

create index if not exists idx_user_champions_account
  on user_champions(account_id);

-- New uniqueness for the account path. Partial so legacy account_id-NULL rows are
-- unaffected and the original unique(user_id, champion_id) keeps holding.
create unique index if not exists uq_user_champions_account_champion
  on user_champions(account_id, champion_id)
  where account_id is not null;

-- NOTE: RLS intentionally NOT enabled on user_champions yet — the live API reads
-- it with the service key and rows are still device-UUID-keyed during transition.
-- Flip it on once the client reads this table as an authenticated user:
--
--   alter table user_champions enable row level security;
--   create policy user_champions_account_owner on user_champions
--     for all using (exists (
--       select 1 from rsl_accounts a
--       where a.id = user_champions.account_id and a.user_id = auth.uid()))
--     with check (exists (
--       select 1 from rsl_accounts a
--       where a.id = user_champions.account_id and a.user_id = auth.uid()));

-- ============================================================================
-- 3. account_artifacts — player gear, owned by an RSL account (new table)
-- ============================================================================
-- Artifacts were never stored in Supabase before (they lived only in the local
-- Gestal export). This table mirrors the normalized Gestal artifact shape so the
-- matching engine can eventually use real gear instead of the coarse gear_tier.
create table if not exists account_artifacts (
  id                  uuid primary key default gen_random_uuid(),
  account_id          uuid not null references rsl_accounts(id) on delete cascade,

  artifact_ext_id     bigint not null,     -- game artifact id (Gestal 'id')
  slot                text,                -- Helmet, Weapon, Ring, ...
  gear_set            text,                -- Offense, Speed, Lifesteal, ...
  rarity              text,
  rank                int,                 -- stars 1-6
  level               int,                 -- upgrade level 0-16
  main_stat           jsonb,               -- { stat, value }
  substats            jsonb,               -- [ { stat, value, roll }, ... ]
  equipped_on_hero_id bigint,              -- Gestal heroId, links to user_champions

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  unique (account_id, artifact_ext_id)
);

create index if not exists idx_account_artifacts_account on account_artifacts(account_id);
create index if not exists idx_account_artifacts_hero    on account_artifacts(equipped_on_hero_id);

drop trigger if exists trg_account_artifacts_updated on account_artifacts;
create trigger trg_account_artifacts_updated
  before update on account_artifacts
  for each row execute function set_updated_at();

-- RLS: owned transitively via rsl_accounts.user_id.
alter table account_artifacts enable row level security;
drop policy if exists account_artifacts_owner on account_artifacts;
create policy account_artifacts_owner on account_artifacts
  for all
  using (exists (
    select 1 from rsl_accounts a
    where a.id = account_artifacts.account_id and a.user_id = auth.uid()))
  with check (exists (
    select 1 from rsl_accounts a
    where a.id = account_artifacts.account_id and a.user_id = auth.uid()));

-- ============================================================================
-- 4. OPTIONAL (next phase) — outcomes + battle history per account
-- ============================================================================
-- Beyond the strict champions+artifacts scope, but part of the same model.
-- Left commented so this migration stays focused; uncomment when wiring them up.
--
-- alter table recommendation_outcomes
--   add column if not exists account_id uuid references rsl_accounts(id) on delete set null;
-- create index if not exists idx_reco_outcomes_account on recommendation_outcomes(account_id);
--
-- create table if not exists battle_log (
--   id            uuid primary key default gen_random_uuid(),
--   account_id    uuid not null references rsl_accounts(id) on delete cascade,
--   captured_at   timestamptz not null,
--   stage         text,
--   dungeon       text,
--   stage_number  int,
--   difficulty    text,
--   result        text,           -- Victory / Defeat / Draw
--   finish_cause  text,           -- Retreat / ...
--   turns         int,
--   heroes        jsonb,
--   created_at    timestamptz not null default now(),
--   unique (account_id, captured_at, stage)
-- );
-- create index if not exists idx_battle_log_account on battle_log(account_id);
-- alter table battle_log enable row level security;
-- create policy battle_log_owner on battle_log
--   for all using (exists (
--     select 1 from rsl_accounts a
--     where a.id = battle_log.account_id and a.user_id = auth.uid()))
--   with check (exists (
--     select 1 from rsl_accounts a
--     where a.id = battle_log.account_id and a.user_id = auth.uid()));
