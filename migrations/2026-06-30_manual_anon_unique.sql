-- ============================================================================
-- Migration — partial unique for the anonymous/legacy manual roster path
-- ============================================================================
-- After the profiles-layer migration dropped unique(user_id, champion_id), the
-- anonymous device-UUID manual path (profile_id IS NULL, account_id IS NULL) had
-- no uniqueness. Re-add it as a partial unique so one champion can't be saved
-- twice for the same device, without conflicting with the profile/account paths.
-- Idempotent.
-- ============================================================================

create unique index if not exists uq_user_champions_user_champion_anon
  on user_champions(user_id, champion_id)
  where profile_id is null and account_id is null;
