// ── api/my-roster.js ─────────────────────────────────────────────────────────
// Authenticated roster read for the deployed PWA (Option A). Returns the synced
// roster the PC companion uploaded — the same shape as /api/gestal-context, but
// sourced from Supabase (rsl_accounts.roster_json) and scoped to the signed-in
// user, instead of the developer's local files.
//
// GET /api/my-roster[?account=<accountId>]
//   Authorization: Bearer <supabase access token>
//   → { account, userChampions, context, stale:{ minutes, extractedAt } }
//
// Reuses buildUserChampions/buildContext, so the match engine consumes it
// unchanged. Battle history isn't synced to the backend yet, so it's empty here.

import { createClient } from '@supabase/supabase-js';
import { buildUserChampions, buildContext } from '../lib/gestal-context.js';

const BASE_URL    = (process.env.SUPABASE_URL ?? '').replace(/\/rest\/v1\/?$/, '');
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const ANON_KEY    = process.env.SUPABASE_ANON_KEY;

const service = createClient(BASE_URL, SERVICE_KEY, { global: { fetch } });

const CHAMPION_SELECT = `
  id, name, rarity, portrait_url, affinity, faction,
  base_hp, base_atk, base_def, base_spd, base_acc, base_res,
  base_crit_rate, base_crit_dmg,
  champion_tags ( tag_id, status, ascension_required, tags ( name, bypasses_accuracy_check ) )
`;

const STALE_AFTER_MIN = 30;

function json(res, status, body) { res.status(status).json(body); }

async function userFromToken(token) {
  if (!token) return null;
  const anon = createClient(BASE_URL, ANON_KEY, { global: { fetch } });
  const { data, error } = await anon.auth.getUser(token);
  return error ? null : data.user ?? null;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed' });
  if (!SERVICE_KEY || !ANON_KEY) return json(res, 500, { error: 'Auth not configured on the server.' });

  const token = (req.headers.authorization ?? '').replace(/^Bearer\s+/i, '').trim();
  const user  = await userFromToken(token);
  if (!user) return json(res, 401, { error: 'Sign in required.' });

  // Resolve target: an explicit profile, else legacy ?account / most-recent gestal.
  const profileId = req.query?.profile ?? null;

  // Manual profile → return its user_champions roster directly (match-engine shape).
  if (profileId) {
    const { data: prof } = await service.from('profiles')
      .select('id, name, population_method')
      .eq('id', profileId).eq('user_id', user.id).maybeSingle();
    if (!prof) return json(res, 404, { error: 'Profile not found.' });
    if (prof.population_method === 'manual') {
      const { data: champs, error: cErr } = await service.from('user_champions')
        .select(`
          id, level, stars, ascension_level, gear_tier, mastery_tier, is_booked, awakening_level,
          champion:champion_id (
            id, name, rarity, portrait_url, affinity, faction,
            base_hp, base_atk, base_def, base_spd, base_acc, base_res, base_crit_rate, base_crit_dmg,
            champion_tags ( tag_id, status, ascension_required, tags ( name, bypasses_accuracy_check ) )
          )`)
        .eq('game_id', 'raid_shadow_legends').eq('profile_id', profileId);
      if (cErr) return json(res, 500, { error: cErr.message });
      return json(res, 200, {
        account: { accountId: null, displayName: prof.name, profileId: prof.id, method: 'manual' },
        userChampions: champs ?? [],
        context: { account: { displayName: prof.name }, roster: { total: (champs ?? []).length } },
        stale: null,
      });
    }
  }

  // Gestal path: the requested profile (gestal), else ?account, else most-recent.
  let q = service.from('rsl_accounts')
    .select('account_id, display_name, raid_player_id, extracted_at, roster_json')
    .eq('user_id', user.id)
    .not('roster_json', 'is', null)
    .order('imported_at', { ascending: false })
    .limit(1);
  if (profileId) q = q.eq('profile_id', profileId);
  else if (req.query?.account) q = q.eq('account_id', req.query.account);

  const { data: rows, error } = await q;
  if (error) return json(res, 500, { error: error.message });
  const acct = rows?.[0];
  if (!acct) return json(res, 404, { error: 'No imported roster yet. Use the PC companion to import.' });

  // Reconstruct the gestalRoster shape buildContext expects.
  const gestalRoster = {
    accountId:      acct.account_id,
    displayName:    acct.display_name,
    raidPlayerId:   acct.raid_player_id,
    lastSnapshotAt: acct.extracted_at,
    champions:      acct.roster_json?.champions ?? [],
    artifacts:      acct.roster_json?.artifacts ?? [],
  };

  // Join owned champions to the DB knowledge base (tags + base stats) by name.
  const ownedNames = [...new Set(
    gestalRoster.champions.filter(c => !c.inStorage).map(c => c.name).filter(Boolean)
  )];
  let dbChampions = [];
  if (ownedNames.length) {
    const { data, error: cErr } = await service
      .from('champions')
      .select(CHAMPION_SELECT)
      .eq('game_id', 'raid_shadow_legends')
      .in('name', ownedNames);
    if (cErr) return json(res, 500, { error: cErr.message });
    dbChampions = data ?? [];
  }

  const { userChampions, unmatched } = buildUserChampions(gestalRoster.champions, dbChampions);
  const context = buildContext({ gestalRoster, userChampions, unmatched, battleLog: [] });

  const minutes = acct.extracted_at
    ? Math.round((Date.now() - new Date(acct.extracted_at)) / 60000) : null;

  return json(res, 200, {
    account: context.account,
    userChampions,
    context,
    stale: { minutes, extractedAt: acct.extracted_at, isStale: minutes != null && minutes > STALE_AFTER_MIN },
  });
}
