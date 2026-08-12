// ── api/import.js ────────────────────────────────────────────────────────────
// Authenticated roster-import endpoint for the PC companion, PLUS long-lived
// import-key management (folded into this one function to stay under Vercel's
// serverless-function cap).
//
// AUTH — two ways, checked in this order:
//   • X-Import-Key: <key>   a long-lived per-user key (rsl_import_keys). Best for
//                           unattended `--watch -> upload` — it never expires (until
//                           revoked). Only the sha256 HASH is stored server-side.
//   • Authorization: Bearer <supabase access JWT>   the ~1h session token (from the
//                           PC-import page). Used for a one-shot upload AND to manage keys.
//
// ROUTES:
//   POST /api/import  { account, roster }                 -> upsert the roster (key OR jwt)
//   POST /api/import  { action:'create-key', label? }     -> mint a key, return plaintext ONCE (jwt)
//   GET  /api/import?keys=1                                -> list this user's keys, no plaintext (jwt)
//   DELETE /api/import?key=<id>                            -> revoke a key (jwt)

import { createClient } from '@supabase/supabase-js';
import { createHash, randomBytes } from 'crypto';
import { upsertGestalProfile } from '../lib/roster-import.js';

const BASE_URL    = (process.env.SUPABASE_URL ?? '').replace(/\/rest\/v1\/?$/, '');
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const ANON_KEY    = process.env.SUPABASE_ANON_KEY;

const service = createClient(BASE_URL, SERVICE_KEY, { global: { fetch } });

function json(res, status, body) { res.status(status).json(body); }
const sha256 = (s) => createHash('sha256').update(s).digest('hex');

/** Validates a Supabase access token and returns its user, or null. */
async function userFromToken(token) {
  if (!token) return null;
  const anon = createClient(BASE_URL, ANON_KEY, { global: { fetch } });
  const { data, error } = await anon.auth.getUser(token);
  return error ? null : data.user ?? null;
}

/** Resolve a long-lived import key to a user_id (or null). Touches last_used_at. */
async function userIdFromImportKey(key) {
  if (!key) return null;
  const key_hash = sha256(key);
  const { data } = await service.from('rsl_import_keys')
    .select('id, user_id').eq('key_hash', key_hash).is('revoked_at', null).maybeSingle();
  if (!data) return null;
  // fire-and-forget usage stamp (don't block the import on it)
  service.from('rsl_import_keys').update({ last_used_at: new Date().toISOString() }).eq('id', data.id).then(() => {}, () => {});
  return data.user_id;
}

export default async function handler(req, res) {
  if (!SERVICE_KEY || !ANON_KEY) return json(res, 500, { error: 'Auth not configured on the server.' });

  const bearer = (req.headers.authorization ?? '').replace(/^Bearer\s+/i, '').trim();
  const importKey = (req.headers['x-import-key'] ?? '').toString().trim();

  // ── Key management (session-JWT authed) ──────────────────────────────────────
  // Mint a key.
  if (req.method === 'POST' && req.body?.action === 'create-key') {
    const user = await userFromToken(bearer);
    if (!user) return json(res, 401, { error: 'Sign in required to create an import key.' });
    const key = randomBytes(32).toString('base64url');   // ~43 chars, URL-safe
    const { error } = await service.from('rsl_import_keys').insert({
      user_id: user.id, key_hash: sha256(key), key_prefix: key.slice(0, 8),
      label: (req.body.label ?? 'PC companion').toString().slice(0, 80),
    });
    if (error) return json(res, 500, { error: 'Could not create key: ' + error.message });
    // Plaintext is returned ONCE and never stored.
    return json(res, 200, { key, note: 'Store this now — it will not be shown again.' });
  }
  // List keys (no plaintext).
  if (req.method === 'GET' && (req.query?.keys != null)) {
    const user = await userFromToken(bearer);
    if (!user) return json(res, 401, { error: 'Sign in required.' });
    const { data } = await service.from('rsl_import_keys')
      .select('id, key_prefix, label, created_at, last_used_at, revoked_at')
      .eq('user_id', user.id).order('created_at', { ascending: false });
    return json(res, 200, { keys: data ?? [] });
  }
  // Revoke a key.
  if (req.method === 'DELETE') {
    const user = await userFromToken(bearer);
    if (!user) return json(res, 401, { error: 'Sign in required.' });
    const id = req.query?.key;
    if (!id) return json(res, 400, { error: 'Pass ?key=<id> to revoke.' });
    const { error } = await service.from('rsl_import_keys')
      .update({ revoked_at: new Date().toISOString() }).eq('id', id).eq('user_id', user.id);
    if (error) return json(res, 500, { error: error.message });
    return json(res, 200, { ok: true });
  }

  // ── The actual import (import-key OR session JWT) ─────────────────────────────
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });

  const userId = importKey ? await userIdFromImportKey(importKey) : (await userFromToken(bearer))?.id ?? null;
  if (!userId) {
    return json(res, 401, { error: importKey
      ? 'Invalid or revoked import key.'
      : 'Sign in required (invalid or expired token), or use a long-lived import key.' });
  }

  const { account, roster } = req.body ?? {};
  if (!account?.accountId || !roster?.champions) {
    return json(res, 400, { error: 'Body must include account.accountId and roster.champions.' });
  }

  try {
    const result = await upsertGestalProfile(service, { userId, account, roster });
    return json(res, 200, { ok: true, ...result });
  } catch (e) {
    return json(res, 500, { error: e.message });
  }
}
