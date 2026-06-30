// ── api/config.js ────────────────────────────────────────────────────────────
// Exposes the PUBLIC Supabase config the browser needs to run auth (magic link).
// The anon key is safe to ship to clients (RLS enforces row access); the
// service key must NEVER be sent here.
//
// GET /api/config → { supabaseUrl, supabaseAnonKey }

function json(res, status, body) { res.status(status).json(body); }

export default function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed' });

  const supabaseUrl     = (process.env.SUPABASE_URL ?? '').replace(/\/rest\/v1\/?$/, '');
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY ?? '';

  if (!supabaseUrl || !supabaseAnonKey) {
    return json(res, 500, {
      error: 'Auth not configured — set SUPABASE_URL and SUPABASE_ANON_KEY in the environment.',
    });
  }

  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
  return json(res, 200, { supabaseUrl, supabaseAnonKey });
}
