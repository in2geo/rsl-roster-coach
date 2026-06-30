-- ============================================================================
-- Migration — general PROFILES layer over both roster-population methods
-- ============================================================================
-- Supersedes the Gestal-only framing. A "profile" is a named roster owned by an
-- authenticated user, populated by EXACTLY ONE method:
--   • manual  → rows in user_champions, scoped by profile_id (rarity/grid flow)
--   • gestal  → a single rsl_accounts row, scoped by profile_id (Gestal export)
-- The switcher lists every profile regardless of method; reads dispatch on
-- population_method. Gestal-specific fields (account_id/display_name/roster_json)
-- stay on rsl_accounts — this does NOT collapse the two storage backends, it
-- indexes them under one identity table.
--
-- This also FOLDS IN the never-applied 2026-06-30_roster_import.sql (the
-- roster_json/extracted_at/imported_at columns) so the Gestal import path works.
--
-- NOT auto-applied — DDL needs a direct Postgres connection (SUPABASE_DB_URL via
-- tools/apply-migration.js; the service key can't run DDL). Review, then apply.
-- Idempotent (IF EXISTS / IF NOT EXISTS guards).
-- ============================================================================

-- ── 1. profiles — add population_method; enable RLS (owner-scoped) ───────────
-- profiles already exists: id, user_id, game_id, name, is_default, created_at.
alter table profiles
  add column if not exists population_method text
    check (population_method in ('manual','gestal'));

create index if not exists idx_profiles_user on profiles(user_id);

-- One default profile per (user, game) — partial unique on is_default = true.
create unique index if not exists uq_profiles_one_default
  on profiles(user_id, game_id) where is_default;

alter table profiles enable row level security;
drop policy if exists profiles_owner on profiles;
create policy profiles_owner on profiles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── 2. user_champions — scope by profile_id; fix uniqueness ──────────────────
alter table user_champions
  add column if not exists profile_id uuid references profiles(id) on delete cascade;
create index if not exists idx_user_champions_profile on user_champions(profile_id);

-- One row per (profile, champion) for the manual path.
create unique index if not exists uq_user_champions_profile_champion
  on user_champions(profile_id, champion_id) where profile_id is not null;

-- The legacy unique(user_id, champion_id) would block the same champion existing
-- in two manual profiles of one user — drop it. (Default Postgres name; verify
-- with \d user_champions if this no-ops.) Legacy profile_id-NULL rows are handled
-- by a separate, reviewed backfill (NOT in this migration — see notes).
alter table user_champions drop constraint if exists user_champions_user_id_champion_id_key;

-- ── 3. rsl_accounts — scope by profile_id (1:1) + roster_json columns ────────
alter table rsl_accounts
  add column if not exists profile_id   uuid references profiles(id) on delete cascade,
  add column if not exists roster_json  jsonb,         -- { champions:[...], artifacts:[...] }
  add column if not exists extracted_at timestamptz,   -- Gestal payload.extractedAt (staleness)
  add column if not exists imported_at  timestamptz;   -- when the companion uploaded it

create unique index if not exists uq_rsl_accounts_profile
  on rsl_accounts(profile_id) where profile_id is not null;

-- ── 4. Verification (after applying) ─────────────────────────────────────────
-- select column_name from information_schema.columns
--   where table_name='profiles' and column_name='population_method';   -- 1 row
-- select column_name from information_schema.columns
--   where table_name='user_champions' and column_name='profile_id';    -- 1 row
-- select column_name from information_schema.columns
--   where table_name='rsl_accounts' and column_name in ('profile_id','roster_json'); -- 2 rows

-- ── NOT in this migration (intentionally) ────────────────────────────────────
--  • Data backfill of the existing legacy user_champions rows into profiles —
--    pending a decision on whether those rows are a keepable manual roster or
--    throwaway test data.
--  • Dropping `profiles` — explicitly reversed; profiles is now the core table.
