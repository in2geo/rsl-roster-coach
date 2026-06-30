import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  let email;
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    email = (body?.email ?? '').trim().toLowerCase();
  } catch {
    return res.status(400).json({ message: 'Invalid request body' });
  }

  if (!email || !EMAIL_RE.test(email)) {
    return res.status(400).json({ message: 'Please enter a valid email address.' });
  }

  const { error } = await supabase
    .from('waitlist_emails')
    .insert({ email });

  if (error) {
    // Postgres unique violation code
    if (error.code === '23505') {
      return res.status(409).json({ message: "You're already on the list!" });
    }
    console.error('Waitlist insert error:', error);
    return res.status(500).json({ message: 'Something went wrong. Please try again.' });
  }

  return res.status(200).json({ message: "You're on the list — we'll email you when it's ready." });
}
