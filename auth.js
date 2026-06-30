// ── auth.js — client-side Supabase magic-link auth ───────────────────────────
// Plain ES module, no build step. Loads supabase-js from a CDN (per the project's
// no-bundler constraint) and initializes it with the PUBLIC config from /api/config.
//
// Exposes a tiny surface the rest of the app uses:
//   getClient()          → the initialized Supabase client (lazy)
//   sendMagicLink(email) → emails a sign-in link, redirecting back to this origin
//   getSession()         → current session or null
//   onAuthChange(cb)     → subscribe to auth state changes
//   signOut()            → end the session
//
// The magic link redirects back to the app; supabase-js (detectSessionInUrl)
// consumes the token from the URL automatically on load.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

let _clientPromise = null;

async function loadConfig() {
  const res = await fetch('/api/config');
  if (!res.ok) throw new Error('Auth is not configured on the server (missing SUPABASE_ANON_KEY).');
  return res.json();
}

export function getClient() {
  if (!_clientPromise) {
    _clientPromise = loadConfig().then(({ supabaseUrl, supabaseAnonKey }) =>
      createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession:      true,
          autoRefreshToken:    true,
          detectSessionInUrl:  true, // consume the magic-link token on redirect
        },
      })
    );
  }
  return _clientPromise;
}

/** Sends a magic sign-in link to `email`, returning to the current page. */
export async function sendMagicLink(email) {
  const client = await getClient();
  const emailRedirectTo = `${window.location.origin}${window.location.pathname}`;
  const { error } = await client.auth.signInWithOtp({
    email,
    options: { emailRedirectTo },
  });
  if (error) throw error;
}

export async function getSession() {
  const client = await getClient();
  const { data } = await client.auth.getSession();
  return data.session ?? null;
}

/** Subscribe to auth changes. Returns an unsubscribe function. */
export async function onAuthChange(cb) {
  const client = await getClient();
  const { data } = client.auth.onAuthStateChange((_event, session) => cb(session));
  return () => data.subscription.unsubscribe();
}

export async function signOut() {
  const client = await getClient();
  await client.auth.signOut();
}
