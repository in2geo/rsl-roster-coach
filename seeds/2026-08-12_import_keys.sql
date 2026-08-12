-- ============================================================================
-- Long-lived per-user import keys for the PC companion.
--
-- The import endpoint authenticates with the user's Supabase access JWT (~1h TTL),
-- which is fine for a one-shot upload but forces a fresh token every hour — no good
-- for unattended `--watch -> upload` sync. This table backs a long-lived key the
-- companion stores once and sends via the X-Import-Key header.
--
-- SECURITY: only the SHA-256 HASH of the key is stored (the plaintext is shown once
-- at generation and never persisted). RLS is enabled with NO policies, so the anon /
-- authenticated PostgREST roles are fully denied — only the service role (api/import.js)
-- can read or write. Key generation/validation/revocation all live in api/import.js.
-- ============================================================================

begin;

create table if not exists rsl_import_keys (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  key_hash     text not null unique,        -- sha256 hex of the plaintext key
  key_prefix   text,                        -- first 8 chars, for display only (not secret)
  label        text,
  created_at   timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at   timestamptz
);

create index if not exists rsl_import_keys_user_idx on rsl_import_keys (user_id);

-- RLS on + no policies => anon/authenticated denied; service role (import.js) bypasses.
alter table rsl_import_keys enable row level security;

commit;
