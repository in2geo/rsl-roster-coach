// ── api/profiles.js ──────────────────────────────────────────────────────────
// Profiles are the general "named roster" layer for a signed-in user. Each is
// populated by one method: 'manual' (user_champions scoped by profile_id) or
// 'gestal' (an rsl_accounts row scoped by profile_id). Anonymous device users
// have no profiles — they use the single implicit device roster instead.
//
// GET   /api/profiles                        → { profiles: [...] }  (auth)
// POST  /api/profiles { name, method? }       → { profile }          (auth)
//   method defaults to 'manual'. The first profile becomes the default.
// PATCH /api/profiles { id, gear_tier?, account_development?, masteries_default? } → { profile }
//   updates account-level gear context (gear tier + Great Hall/Arena bundle + masteries)
//   used by the recommendation engine's stat estimator for manual rosters.

import { createClient } from '@supabase/supabase-js';

const BASE_URL    = (process.env.SUPABASE_URL ?? '').replace(/\/rest\/v1\/?$/, '');
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const ANON_KEY    = process.env.SUPABASE_ANON_KEY;
const service = createClient(BASE_URL, SERVICE_KEY, { global: { fetch } });

function json(res, status, body) { res.status(status).json(body); }

async function userFromToken(token) {
  if (!token) return null;
  const anon = createClient(BASE_URL, ANON_KEY, { global: { fetch } });
  const { data, error } = await anon.auth.getUser(token);
  return error ? null : data.user ?? null;
}

export default async function handler(req, res) {
  if (!SERVICE_KEY || !ANON_KEY) return json(res, 500, { error: 'Auth not configured on the server.' });
  const token = (req.headers.authorization ?? '').replace(/^Bearer\s+/i, '').trim();
  const user  = await userFromToken(token);
  if (!user) return json(res, 401, { error: 'Sign in required.' });

  // ── GET: list this user's profiles (with roster counts for display) ───────
  if (req.method === 'GET') {
    const { data: profiles, error } = await service
      .from('profiles')
      .select('id, name, population_method, is_default, created_at, gear_tier, account_development, masteries_default')
      .eq('user_id', user.id)
      .eq('game_id', 'raid_shadow_legends')
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: true });
    if (error) return json(res, 500, { error: error.message });
    return json(res, 200, { profiles: profiles ?? [] });
  }

  // ── POST: create a profile ─────────────────────────────────────────────────
  if (req.method === 'POST') {
    const name   = String(req.body?.name ?? '').trim();
    const method = req.body?.method === 'gestal' ? 'gestal' : 'manual';
    if (!name) return json(res, 400, { error: 'name required' });

    // First profile for this user becomes the default.
    const { count } = await service
      .from('profiles').select('id', { count: 'exact', head: true })
      .eq('user_id', user.id).eq('game_id', 'raid_shadow_legends');

    const { data, error } = await service
      .from('profiles')
      .insert({
        user_id: user.id, game_id: 'raid_shadow_legends',
        name, population_method: method, is_default: (count ?? 0) === 0,
      })
      .select('id, name, population_method, is_default, created_at')
      .single();
    if (error) return json(res, 500, { error: error.message });
    return json(res, 200, { profile: data });
  }

  // ── PATCH: update account-level gear context on one of the user's profiles ──
  if (req.method === 'PATCH') {
    const id = String(req.body?.id ?? '').trim();
    if (!id) return json(res, 400, { error: 'id required' });

    const GEAR_TIERS  = ['starter', 'fair', 'good', 'endgame'];
    const ACCOUNT_DEV = ['poor', 'fair', 'good'];
    const MASTERIES   = ['none', 'partial', 'full'];
    const update = {};
    if ('gear_tier' in (req.body ?? {})) {
      if (!GEAR_TIERS.includes(req.body.gear_tier)) {
        return json(res, 400, { error: `gear_tier must be one of ${GEAR_TIERS.join('/')}` });
      }
      update.gear_tier = req.body.gear_tier;
    }
    if ('account_development' in (req.body ?? {})) {
      if (!ACCOUNT_DEV.includes(req.body.account_development)) {
        return json(res, 400, { error: `account_development must be one of ${ACCOUNT_DEV.join('/')}` });
      }
      update.account_development = req.body.account_development;
    }
    if ('masteries_default' in (req.body ?? {})) {
      if (!MASTERIES.includes(req.body.masteries_default)) {
        return json(res, 400, { error: `masteries_default must be one of ${MASTERIES.join('/')}` });
      }
      update.masteries_default = req.body.masteries_default;
    }
    if (!Object.keys(update).length) return json(res, 400, { error: 'nothing to update' });

    // Owner-scoped: the eq(user_id) makes it impossible to patch another user's profile.
    const { data, error } = await service
      .from('profiles')
      .update(update)
      .eq('id', id)
      .eq('user_id', user.id)
      .eq('game_id', 'raid_shadow_legends')
      .select('id, name, population_method, is_default, created_at, gear_tier, account_development, masteries_default')
      .single();
    if (error) return json(res, 500, { error: error.message });
    if (!data)  return json(res, 404, { error: 'Profile not found.' });
    return json(res, 200, { profile: data });
  }

  return json(res, 405, { error: 'Method not allowed' });
}
