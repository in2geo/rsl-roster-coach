import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  (process.env.SUPABASE_URL ?? '').replace(/\/rest\/v1\/?$/, ''),
  process.env.SUPABASE_SERVICE_KEY,
  { global: { fetch: fetch } }
);

function json(res, status, body) { res.status(status).json(body); }

// Scope a query to one roster: a named profile (signed-in) when profile_id is
// given, else the anonymous device path (user_id + profile_id/account_id NULL).
// Mirrors the partial unique indexes uq_user_champions_profile_champion and
// uq_user_champions_user_champion_anon.
function scoped(q, { user_id, profile_id }) {
  return profile_id
    ? q.eq('profile_id', profile_id)
    : q.eq('user_id', user_id).is('profile_id', null).is('account_id', null);
}

const CHAMPION_JOIN = `
  id, level, stars, ascension_level, gear_tier,
  mastery_tier, is_booked, awakening_level,
  champion:champion_id (
    id, name, rarity, portrait_url, affinity, faction,
    base_hp, base_atk, base_def, base_spd, base_acc, base_res,
    base_crit_rate, base_crit_dmg,
    champion_tags ( tag_id, status, ascension_required, tags ( name, bypasses_accuracy_check ) ),
    champion_skills ( slot, skill_name, skill_summary )
  )`;

export default async function handler(req, res) {
  const src = req.method === 'GET' ? (req.query ?? {}) : (req.body ?? {});
  const { user_id, profile_id } = src;
  if (!user_id && !profile_id) return json(res, 400, { error: 'user_id or profile_id required' });

  // ── GET: return the scoped roster ─────────────────────────────────────────
  if (req.method === 'GET') {
    const { data, error } = await scoped(
      supabase.from('user_champions').select(CHAMPION_JOIN).eq('game_id', 'raid_shadow_legends'),
      { user_id, profile_id }
    );
    if (error) return json(res, 500, { error: error.message });
    return json(res, 200, { champions: data ?? [] });
  }

  // ── POST: add/update one champion in the scoped roster ────────────────────
  if (req.method === 'POST') {
    const { champion_id, level, stars, ascension_level, gear_tier, mastery_tier, is_booked } = req.body ?? {};
    if (!champion_id) return json(res, 400, { error: 'champion_id required' });

    const fields = {
      level:           level           ?? 1,
      stars:           stars           ?? 1,
      ascension_level: ascension_level ?? 0,
      gear_tier:       gear_tier       ?? 'Starter',
      mastery_tier:    mastery_tier    ?? 'None',
      is_booked:       is_booked       ?? false,
    };

    // Update-or-insert by hand: partial unique indexes don't play cleanly with
    // PostgREST's onConflict inference, so we match the scoped row explicitly.
    const { data: existing, error: findErr } = await scoped(
      supabase.from('user_champions').select('id').eq('game_id', 'raid_shadow_legends').eq('champion_id', champion_id),
      { user_id, profile_id }
    ).maybeSingle();
    if (findErr) return json(res, 500, { error: findErr.message });

    if (existing) {
      const { error } = await supabase.from('user_champions').update(fields).eq('id', existing.id);
      if (error) return json(res, 500, { error: error.message });
      return json(res, 200, { id: existing.id });
    }
    const { data, error } = await supabase.from('user_champions')
      .insert({ user_id, profile_id: profile_id ?? null, game_id: 'raid_shadow_legends', champion_id, ...fields })
      .select('id').single();
    if (error) return json(res, 500, { error: error.message });
    return json(res, 200, { id: data.id });
  }

  // ── DELETE: remove one champion from the scoped roster ────────────────────
  if (req.method === 'DELETE') {
    const { champion_id } = req.body ?? {};
    if (!champion_id) return json(res, 400, { error: 'champion_id required' });
    const { error } = await scoped(
      supabase.from('user_champions').delete().eq('game_id', 'raid_shadow_legends').eq('champion_id', champion_id),
      { user_id, profile_id }
    );
    if (error) return json(res, 500, { error: error.message });
    return json(res, 200, { ok: true });
  }

  return json(res, 405, { error: 'Method not allowed' });
}
