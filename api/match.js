import { createClient } from '@supabase/supabase-js';
import { matchRoster }         from '../lib/match-engine.js';
import { generateExplanation } from '../lib/explain.js';

const supabase = createClient(
  (process.env.SUPABASE_URL ?? '').replace(/\/rest\/v1\/?$/, ''),
  process.env.SUPABASE_SERVICE_KEY,
  { global: { fetch } }
);

function json(res, status, body) { res.status(status).json(body); }

const VALID_CONTENT = ['campaign', 'spider', 'spider_hard', 'clan_boss', 'event_dungeon', 'fire_knight', 'ice_golem', 'dragon'];

// ── Daily session helpers ─────────────────────────────────────────────────────

async function getSession(userId) {
  const today = new Date().toISOString().split('T')[0];
  const { data } = await supabase
    .from('daily_sessions')
    .select('free_recommendation_used, free_content_key, ad_views_today')
    .eq('game_id', 'raid_shadow_legends')
    .eq('user_id', userId)
    .eq('session_date', today)
    .maybeSingle();
  return data ?? { free_recommendation_used: false, free_content_key: null, ad_views_today: 0 };
}

async function markFreeUsed(userId, contentKey) {
  const today = new Date().toISOString().split('T')[0];
  await supabase.from('daily_sessions').upsert({
    user_id: userId,
    game_id: 'raid_shadow_legends',
    session_date: today,
    free_recommendation_used: true,
    free_content_key: contentKey,
  }, { onConflict: 'user_id,session_date' });
}

// ── Handler ───────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });

  let body = req.body ?? {};
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { return json(res, 400, { error: 'Invalid JSON body' }); }
  }

  const { userChampions, champions, content: contentKey, options = {}, user_id, context = null } = body;

  if (!VALID_CONTENT.includes(contentKey)) {
    return json(res, 400, { error: `Invalid content key: ${contentKey}` });
  }

  // New roster flow: full user_champion objects already fetched by the client
  if (userChampions) {
    if (!Array.isArray(userChampions) || !userChampions.length) {
      return json(res, 400, { error: 'No champions in roster' });
    }

    // ── Gate check ────────────────────────────────────────────────────────────
    let session = null;
    if (user_id) {
      session = await getSession(user_id);
      // Gate a DIFFERENT-content recommendation once the free one is used — UNLESS the
      // user has watched an ad today (verify-ad increments ad_views_today). This ad check
      // is what actually clears the gate: without it the condition could never become
      // false, so after verify-ad the client re-ran /api/match, got requiresAd again, and
      // in test mode auto-retried forever (an infinite match⇄verify-ad loop). Interim rule:
      // one ad unlocks further recs for the day; the 30-min ad_unlocked_until window is the
      // planned refinement (see monetization-recommendation-tiers).
      if (session.free_recommendation_used
          && session.free_content_key !== contentKey
          && !(session.ad_views_today > 0)) {
        const label = contentKey.replace(/_/g, ' ');
        return json(res, 200, {
          requiresAd: true,
          gateId: 2,
          message: `Watch a short video to get your ${label} recommendation.`,
        });
      }
    }

    let matchResult;
    try {
      matchResult = await matchRoster(userChampions, contentKey, options);
    } catch (e) {
      console.error('match-engine error', e);
      return json(res, 500, { error: e.message || 'Matching engine failed' });
    }

    let explanation;
    try {
      explanation = await generateExplanation(matchResult, context);
    } catch {
      explanation = 'Explanation unavailable right now — your team above is still valid.';
    }

    // Mark free recommendation used on first successful match for this user
    if (user_id && !session?.free_recommendation_used) {
      await markFreeUsed(user_id, contentKey);
    }

    const event_fallback_note = matchResult.event_fallback
      ? "We don't have specific data for this event yet — this recommendation uses general event dungeon strategy."
      : null;

    return json(res, 200, {
      content_label:          matchResult.content_label,
      dungeon_stage_id:       matchResult.dungeon_stage_id,
      stage_number_attempted: matchResult.stage_number_attempted ?? null,
      verdict:                matchResult.verdict,
      verdict_band:           matchResult.verdict_band,
      confidence_pct:         matchResult.confidence_pct,
      event_fallback_note,
      not_ready_note:          matchResult.not_ready_note ?? null,
      solo_carries:            matchResult.solo_carries,
      solo_carries_locked:     matchResult.solo_carries_locked,
      team:                   matchResult.team,
      leader:                 matchResult.leader ?? null,
      synergies:              matchResult.synergies ?? [],
      stun_matrix:            matchResult.stun_matrix,
      cb_damage:              matchResult.cb_damage ?? null,
      clan_boss_verdict:      matchResult.clan_boss_verdict ?? null,
      contribution:           matchResult.contribution ?? null,
      watchdog:               matchResult.watchdog ?? null,
      gaps:                   matchResult.gaps,
      threshold_results:      matchResult.threshold_results,
      ascension_gaps:         matchResult.ascension_gaps,
      data_warning:           matchResult.data_warning,
      explanation,
    });
  }

  // Legacy flow: flat champion list from old confirm screen (no gate)
  if (!Array.isArray(champions) || !champions.length) {
    return json(res, 400, { error: 'champions array is required' });
  }

  const roster = champions
    .map(c => ({ name: String(c.name || '').trim(), level: Number(c.level) || 1, stars: Number(c.stars) || 1 }))
    .filter(c => c.name);

  if (!roster.length) return json(res, 400, { error: 'No valid champion names provided' });

  let matchResult;
  try {
    matchResult = await matchRoster(roster, contentKey);
  } catch (e) {
    console.error('match-engine error', e);
    return json(res, 500, { error: 'Matching engine failed. Please try again.' });
  }

  let explanation;
  try {
    explanation = await generateExplanation(matchResult);
  } catch {
    explanation = 'Explanation unavailable right now — but your team above is still valid.';
  }

  return json(res, 200, {
    content_label: matchResult.content_label,
    team:          matchResult.team,
    gaps:          matchResult.gaps,
    explanation,
  });
}
