// ── lib/roster-import.js ─────────────────────────────────────────────────────
// Shared core for importing a Gestal roster onto a signed-in user's Supabase
// profile. One 'gestal' PROFILE per rsl_account (the user-facing named roster the
// switcher lists); the roster snapshot lives on rsl_accounts.roster_json.
//
// Used by BOTH api/import.js (companion upload, user resolved from an access
// token) and tools/auto-profile-sync.mjs (dev-box daemon, user resolved from
// email + service key). Keeping the upsert in one place stops the two paths from
// drifting.

/**
 * Find-or-create the gestal profile for `account` and upsert its roster snapshot,
 * scoped to `userId`. Idempotent on (user_id, account_id) — safe to call on every
 * re-sync. Returns a small summary.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} service  service-role client
 * @param {{ userId:string,
 *           account:{ accountId:string, displayName?:string, raidPlayerId?:string,
 *                     gameVersion?:string, extractedAt?:string },
 *           roster:{ champions:any[], artifacts?:any[] } }} args
 */
export async function upsertGestalProfile(service, { userId, account, roster }) {
  if (!userId) throw new Error('userId required');
  if (!account?.accountId) throw new Error('account.accountId required');
  if (!Array.isArray(roster?.champions)) throw new Error('roster.champions required');

  // Reuse this account's existing profile if it has one; else create it. The
  // first profile for the user becomes the default (matches manual-profile rules).
  const { data: existingAcct } = await service
    .from('rsl_accounts').select('id, profile_id')
    .eq('user_id', userId).eq('account_id', account.accountId).maybeSingle();

  let profileId = existingAcct?.profile_id ?? null;
  let createdProfile = false;
  if (!profileId) {
    const { count } = await service
      .from('profiles').select('id', { count: 'exact', head: true })
      .eq('user_id', userId).eq('game_id', 'raid_shadow_legends');
    const { data: prof, error: pErr } = await service
      .from('profiles')
      .insert({
        user_id: userId, game_id: 'raid_shadow_legends',
        name: account.displayName ?? account.accountId,
        population_method: 'gestal', is_default: (count ?? 0) === 0,
      })
      .select('id').single();
    if (pErr) throw new Error('Profile create failed: ' + pErr.message);
    profileId = prof.id;
    createdProfile = true;
  }

  const row = {
    user_id:        userId,
    account_id:     account.accountId,
    profile_id:     profileId,
    display_name:   account.displayName  ?? null,
    raid_player_id: account.raidPlayerId ?? null,
    game_version:   account.gameVersion  ?? null,
    last_synced_at: account.extractedAt  ?? new Date().toISOString(),
    extracted_at:   account.extractedAt  ?? null,
    imported_at:    new Date().toISOString(),
    roster_json:    { champions: roster.champions, artifacts: roster.artifacts ?? [] },
  };

  const { data, error } = await service
    .from('rsl_accounts')
    .upsert(row, { onConflict: 'user_id,account_id' })
    .select('id, account_id, display_name, profile_id')
    .single();
  if (error) throw new Error('Import failed: ' + error.message);

  return {
    accountId:   data.account_id,
    displayName: data.display_name,
    profileId:   data.profile_id,
    createdProfile,
    champions:   roster.champions.length,
    artifacts:   (roster.artifacts ?? []).length,
  };
}
