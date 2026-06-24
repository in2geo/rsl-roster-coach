import { matchRoster }         from '../lib/match-engine.js';
import { generateExplanation } from '../lib/explain.js';

function json(res, status, body) { res.status(status).json(body); }

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });

  let body;
  try {
    body = req.body;
    if (typeof body === 'string') body = JSON.parse(body);
  } catch {
    return json(res, 400, { error: 'Invalid JSON body' });
  }

  const { champions, content: contentKey } = body ?? {};

  if (!Array.isArray(champions) || !champions.length) {
    return json(res, 400, { error: 'champions array is required' });
  }

  const validContent = ['campaign', 'spider', 'clan_boss'];
  if (!validContent.includes(contentKey)) {
    return json(res, 400, { error: `Invalid content key: ${contentKey}` });
  }

  // champions from client: [{ name, level, stars }]
  const roster = champions.map(c => ({
    name:  String(c.name || '').trim(),
    level: Number(c.level) || 1,
    stars: Number(c.stars) || 1,
  })).filter(c => c.name);

  if (!roster.length) {
    return json(res, 400, { error: 'No valid champion names provided' });
  }

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
  } catch (e) {
    console.error('explain error', e);
    explanation = 'Explanation unavailable right now — but your team above is still valid.';
  }

  return json(res, 200, {
    content_label: matchResult.content_label,
    team:          matchResult.team,
    gaps:          matchResult.gaps,
    explanation,
  });
}
