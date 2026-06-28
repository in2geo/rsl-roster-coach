import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  (process.env.SUPABASE_URL ?? '').replace(/\/rest\/v1\/?$/, ''),
  process.env.SUPABASE_SERVICE_KEY,
  { global: { fetch } }
);

function json(res, status, body) { res.status(status).json(body); }

export default async function handler(req, res) {
  // POST — insert a new outcome row (outcome = null, player hasn't responded yet)
  if (req.method === 'POST') {
    const { user_id, dungeon_stage_id, verdict, recommended_team, roster_snapshot } = req.body ?? {};
    if (!user_id) {
      return json(res, 400, { error: 'user_id required' });
    }

    const { data, error } = await supabase
      .from('recommendation_outcomes')
      .insert({
        user_id,
        game_id:          'raid_shadow_legends',
        dungeon_stage_id: dungeon_stage_id ?? null,
        verdict:          verdict ?? null,
        recommended_team: recommended_team ?? null,
        roster_snapshot:  roster_snapshot  ?? null,
      })
      .select('id')
      .single();

    if (error) return json(res, 500, { error: error.message });
    return json(res, 200, { id: data.id });
  }

  // PATCH — record the player's outcome after they tap 👍 or 👎
  if (req.method === 'PATCH') {
    const { id, outcome, failure_reason } = req.body ?? {};
    if (!id || !outcome) return json(res, 400, { error: 'id and outcome required' });

    const { error } = await supabase
      .from('recommendation_outcomes')
      .update({
        outcome,
        failure_reason:      failure_reason ?? null,
        outcome_recorded_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) return json(res, 500, { error: error.message });
    return json(res, 200, { ok: true });
  }

  return json(res, 405, { error: 'Method not allowed' });
}
