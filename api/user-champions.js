import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  (process.env.SUPABASE_URL ?? '').replace(/\/rest\/v1\/?$/, ''),
  process.env.SUPABASE_SERVICE_KEY,
  { global: { fetch: fetch } }
);

function json(res, status, body) { res.status(status).json(body); }

export default async function handler(req, res) {
  const { user_id } = req.method === 'GET' ? (req.query ?? {}) : (req.body ?? {});
  if (!user_id) return json(res, 400, { error: 'user_id required' });

  // ── GET: return saved roster for this device ──────────────────────────────
  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('user_champions')
      .select(`
        id, level, stars, ascension_level, gear_tier,
        mastery_tier, is_booked, awakening_level,
        champion:champion_id (
          id, name, rarity, portrait_url, affinity, faction,
          base_hp, base_atk, base_def, base_spd, base_acc, base_res,
          base_crit_rate, base_crit_dmg,
          champion_tags ( tag_id, status, ascension_required, tags ( name, bypasses_accuracy_check ) )
        )
      `)
      .eq('game_id', 'raid_shadow_legends')
      .eq('user_id', user_id);

    if (error) return json(res, 500, { error: error.message });
    return json(res, 200, { champions: data ?? [] });
  }

  // ── POST: upsert a single champion to the roster ──────────────────────────
  if (req.method === 'POST') {
    const {
      champion_id, level, stars, ascension_level,
      gear_tier, mastery_tier, is_booked,
    } = req.body ?? {};

    if (!champion_id) return json(res, 400, { error: 'champion_id required' });

    // Upsert — one row per (user_id, champion_id, game_id) triplet
    const { data, error } = await supabase
      .from('user_champions')
      .upsert({
        user_id,
        game_id:         'raid_shadow_legends',
        champion_id,
        level:           level           ?? 1,
        stars:           stars           ?? 1,
        ascension_level: ascension_level ?? 0,
        gear_tier:       gear_tier       ?? 'Starter',
        mastery_tier:    mastery_tier    ?? 'None',
        is_booked:       is_booked       ?? false,
      }, { onConflict: 'user_id,champion_id' })
      .select('id')
      .single();

    if (error) return json(res, 500, { error: error.message });
    return json(res, 200, { id: data.id });
  }

  // ── DELETE: remove a champion from the roster ─────────────────────────────
  if (req.method === 'DELETE') {
    const { champion_id } = req.body ?? {};
    if (!champion_id) return json(res, 400, { error: 'champion_id required' });

    const { error } = await supabase
      .from('user_champions')
      .delete()
      .eq('game_id', 'raid_shadow_legends')
      .eq('user_id', user_id)
      .eq('champion_id', champion_id);

    if (error) return json(res, 500, { error: error.message });
    return json(res, 200, { ok: true });
  }

  return json(res, 405, { error: 'Method not allowed' });
}
