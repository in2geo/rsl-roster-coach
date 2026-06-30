// ── api/profiles.js ──────────────────────────────────────────────────────────
// Profiles are the general "named roster" layer for a signed-in user. Each is
// populated by one method: 'manual' (user_champions scoped by profile_id) or
// 'gestal' (an rsl_accounts row scoped by profile_id). Anonymous device users
// have no profiles — they use the single implicit device roster instead.
//
// GET  /api/profiles                         → { profiles: [...] }  (auth)
// POST /api/profiles { name, method? }        → { profile }          (auth)
//   method defaults to 'manual'. The first profile becomes the default.

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
      .select('id, name, population_method, is_default, created_at')
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

  return json(res, 405, { error: 'Method not allowed' });
}
