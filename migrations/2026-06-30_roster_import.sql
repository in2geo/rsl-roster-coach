-- ============================================================================
-- Migration: PC roster import (Option A — Gestal companion → Supabase)
-- ============================================================================
-- Stores the normalized Gestal roster (champions + artifacts) as a JSON snapshot
-- per RSL account, so the deployed PWA can read a synced roster from the backend
-- instead of the developer's local files. The companion uploader writes this;
-- /api/my-roster reads it and runs the existing buildUserChampions/buildContext
-- join logic (champions matched to the DB by name), so no downstream changes.
--
-- Why a JSON blob (not the structured account_artifacts table yet): the match
-- engine consumes the whole roster array at once, so a snapshot is the fastest
-- path to "up and running". Normalize into structured tables later if analytics
-- need per-row queries.
--
-- Additive + idempotent. RLS already protects rsl_accounts (owner = auth.uid()).
-- ============================================================================

alter table rsl_accounts
  add column if not exists roster_json  jsonb,        -- { champions:[...], artifacts:[...] }
  add column if not exists extracted_at timestamptz,  -- Gestal payload.extractedAt (staleness)
  add column if not exists imported_at  timestamptz;  -- when our companion uploaded it

comment on column rsl_accounts.roster_json is
  'Normalized Gestal export snapshot (champions + artifacts) uploaded by the PC companion.';
comment on column rsl_accounts.extracted_at is
  'Gestal extraction time of this snapshot — used to warn when the roster is stale.';
