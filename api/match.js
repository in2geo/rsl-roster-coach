import { matchRoster }         from '../lib/match-engine.js';
import { generateExplanation } from '../lib/explain.js';

function json(res, status, body) { res.status(status).json(body); }

const VALID_CONTENT = ['campaign', 'spider', 'spider_beginner', 'clan_boss'];

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });

  let body = req.body ?? {};
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { return json(res, 400, { error: 'Invalid JSON body' }); }
  }

  const { userChampions, champions, content: contentKey, options = {} } = body;

  if (!VALID_CONTENT.includes(contentKey)) {
    return json(res, 400, { error: `Invalid content key: ${contentKey}` });
  }

  // New roster flow: full user_champion objects already fetched by the client
  if (userChampions) {
    if (!Array.isArray(userChampions) || !userChampions.length) {
      return json(res, 400, { error: 'No champions in roster' });
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
      explanation = await generateExplanation(matchResult);
    } catch {
      explanation = 'Explanation unavailable right now — your team above is still valid.';
    }

    return json(res, 200, {
      content_label:     matchResult.content_label,
      solo_carries:      matchResult.solo_carries,
      team:              matchResult.team,
      stun_matrix:       matchResult.stun_matrix,
      gaps:              matchResult.gaps,
      threshold_results: matchResult.threshold_results,
      data_warning:      matchResult.data_warning,
      explanation,
    });
  }

  // Legacy flow: flat champion list from old confirm screen
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
