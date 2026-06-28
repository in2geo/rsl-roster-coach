import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  (process.env.SUPABASE_URL ?? '').replace(/\/rest\/v1\/?$/, ''),
  process.env.SUPABASE_SERVICE_KEY,
  { global: { fetch } }
);

function json(res, status, body) { res.status(status).json(body); }

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });

  const { user_id } = req.body ?? {};
  if (!user_id) return json(res, 400, { error: 'user_id required' });

  // MVP placeholder — real ad networks send a server-side callback here.
  // For now we just increment ad_views_today so the gate re-check passes.
  const today = new Date().toISOString().split('T')[0];

  const { data: existing } = await supabase
    .from('daily_sessions')
    .select('ad_views_today')
    .eq('user_id', user_id)
    .eq('session_date', today)
    .maybeSingle();

  await supabase.from('daily_sessions').upsert({
    user_id,
    session_date: today,
    ad_views_today: (existing?.ad_views_today ?? 0) + 1,
  }, { onConflict: 'user_id,session_date' });

  return json(res, 200, { ok: true, verified: true });
}
