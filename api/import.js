// ── api/import.js ────────────────────────────────────────────────────────────
// Authenticated roster-import endpoint for the PC companion (Option A).
// The companion (tools/import-upload.js) reads the local Gestal export and POSTs
// it here with the signed-in user's access token. We validate the token → user,
// then upsert the roster onto that user's rsl_accounts row (RLS-equivalent: the
// write is scoped to the validated user_id).
//
// POST /api/import
//   Authorization: Bearer <supabase access token>
//   body: { account:{ accountId, displayName?, raidPlayerId?, gameVersion?, extractedAt? },
//           roster:{ champions:[...], artifacts:[...] } }
//
// NOTE (beta): the token is the user's Supabase access JWT (~1h TTL). Good enough
// for the validation phase; a long-lived per-user import key is a follow-up.

import { createClient } from '@supabase/supabase-js';

const BASE_URL    = (process.env.SUPABASE_URL ?? '').replace(/\/rest\/v1\/?$/, '');
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const ANON_KEY    = process.env.SUPABASE_ANON_KEY;

const service = createClient(BASE_URL, SERVICE_KEY, { global: { fetch } });

function json(res, status, body) { res.status(status).json(body); }

/** Validates a Supabase access token and returns its user, or null. */
async function userFromToken(token) {
  if (!token) return null;
  const anon = createClient(BASE_URL, ANON_KEY, { global: { fetch } });
  const { data, error } = await anon.auth.getUser(token);
  return error ? null : data.user ?? null;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });
  if (!SERVICE_KEY || !ANON_KEY) return json(res, 500, { error: 'Auth not configured on the server.' });

  const token = (req.headers.authorization ?? '').replace(/^Bearer\s+/i, '').trim();
  const user  = await userFromToken(token);
  if (!user) return json(res, 401, { error: 'Sign in required (invalid or expired token).' });

  const { account, roster } = req.body ?? {};
  if (!account?.accountId || !roster?.champions) {
    return json(res, 400, { error: 'Body must include account.accountId and roster.champions.' });
  }

  // Upsert the user's account link + roster snapshot. Unique (user_id, account_id).
  const row = {
    user_id:        user.id,
    account_id:     account.accountId,
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
    .select('id, account_id, display_name')
    .single();

  if (error) return json(res, 500, { error: 'Import failed: ' + error.message });

  return json(res, 200, {
    ok: true,
    accountId: data.account_id,
    displayName: data.display_name,
    champions: roster.champions.length,
    artifacts: (roster.artifacts ?? []).length,
  });
}
