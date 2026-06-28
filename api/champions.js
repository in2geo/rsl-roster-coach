import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  (process.env.SUPABASE_URL ?? '').replace(/\/rest\/v1\/?$/, ''),
  process.env.SUPABASE_SERVICE_KEY,
  { global: { fetch: fetch } }
);

function json(res, status, body) { res.status(status).json(body); }

export default async function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed' });

  const { data, error } = await supabase
    .from('champions')
    .select('id, name, rarity, portrait_url')
    .eq('game_id', 'raid_shadow_legends')
    .order('name', { ascending: true });

  if (error) return json(res, 500, { error: error.message });

  // Group by rarity
  const byRarity = {};
  for (const champ of data) {
    if (!byRarity[champ.rarity]) byRarity[champ.rarity] = [];
    byRarity[champ.rarity].push({
      id:          champ.id,
      name:        champ.name,
      portrait_url: champ.portrait_url ?? null,
    });
  }

  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
  return json(res, 200, { byRarity });
}
