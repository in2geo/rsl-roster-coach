import { createClient } from '@supabase/supabase-js';
import { matchRoster }        from '../lib/match-engine.js';
import { generateExplanation } from '../lib/explain.js';

const supabase = createClient(
  (process.env.SUPABASE_URL ?? '').replace(/\/rest\/v1\/?$/, ''),
  process.env.SUPABASE_SERVICE_KEY,
  { global: { fetch } }
);

const VALID_CONTENT = ['campaign', 'spider', 'spider_beginner', 'clan_boss'];

function json(res, status, body) {
  res.status(status).json(body);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });

  const { userId, contentKey } = req.body ?? {};

  if (!userId)     return json(res, 400, { error: 'Missing userId' });
  if (!contentKey) return json(res, 400, { error: 'Missing contentKey' });
  if (!VALID_CONTENT.includes(contentKey)) {
    return json(res, 400, { error: `Invalid contentKey: ${contentKey}` });
  }

  // ── Step 1: Load this user's roster with full champion data ────────────────
  const { data: roster, error: rosterErr } = await supabase
    .from('user_champions')
    .select(`
      id, level, stars, ascension_level, gear_tier, mastery_tier,
      is_booked, awakening_level,
      champion:champions (
        id, name, rarity, faction, affinity,
        base_hp, base_atk, base_def, base_spd, base_acc, base_res,
        champion_tags ( tag_id, status, tags ( name, bypasses_accuracy_check ) )
      )
    `)
    .eq('game_id', 'raid_shadow_legends')
    .eq('user_id', userId);

  if (rosterErr) {
    console.error('roster query error', rosterErr);
    return json(res, 500, { error: 'Could not load roster from database.' });
  }

  if (!roster?.length) {
    return json(res, 422, { error: 'No champions found for this user. Add champions to your roster first.' });
  }

  // ── Step 2: Matching engine — deterministic, no LLM ───────────────────────
  let matchResult;
  try {
    matchResult = await matchRoster(roster, contentKey);
  } catch (e) {
    console.error('match-engine error', e);
    return json(res, 500, { error: 'Matching engine failed. Please try again.' });
  }

  // ── Step 3: Explanation — AI writes plain-language summary ────────────────
  let explanation;
  try {
    explanation = await generateExplanation(matchResult);
  } catch (e) {
    console.error('explain error', e);
    explanation = 'Explanation unavailable right now — but your team above is still valid.';
  }

  return json(res, 200, {
    content_label:      matchResult.content_label,
    team:               matchResult.team,
    gaps:               matchResult.gaps,
    threshold_results:  matchResult.threshold_results,
    zero_tag_warnings:  matchResult.zero_tag_warnings,
    explanation,
  });
}
