-- ============================================================================
-- Seed 169 — a READ-ONLY Postgres role for an external reviewer
--
-- ⚠ NOT APPLIED. You must set a password first (see "HOW TO APPLY" below). This file
-- is committed WITHOUT a password on purpose — never commit one.
--
-- WHY: an external agent asked for "the connection string". The only string that
-- works is SUPABASE_POOLER_URL, which connects as `postgres` — write and DELETE on
-- all 40 tables — and it lives in .env.local beside an ANTHROPIC_API_KEY and a
-- VERCEL_OIDC_TOKEN. This role is the least-privilege alternative: SELECT on exactly
-- the 6 tables a tag review needs, and nothing else, ever.
--
-- ▶ THE EXPORT IS STILL THE BETTER ANSWER FOR THIS TASK. `output/tag-review/`
-- already contains champion_tags joined to champion_skills with the verbatim text —
-- the exact query the agent described. A snapshot cannot be written to, cannot leak
-- a credential, cannot trip the PostgREST 1000-row cap, and is reproducible when
-- someone asks how a finding was reached. Use this role only if a reviewer genuinely
-- needs live data (e.g. re-checking after a seed lands).
--
-- ▶ WHAT THIS ROLE CANNOT SEE — this is the point of it.
-- 34 of the 40 tables, including everything with personal or account data:
--     waitlist_emails      ← prospective users' EMAIL ADDRESSES
--     profiles             ← user profiles
--     rsl_accounts         ← linked game accounts
--     user_champions       ← per-user rosters
--     daily_sessions, battle_history, account_artifacts, recommendation_outcomes
-- A tag review needs none of it. Granting `postgres` would have handed over all of it.
--
-- GRANTED (SELECT only):
--     champions · champion_skills · champion_tags · champion_auras
--     champion_aliases · tags
--
-- ============================================================================
-- HOW TO APPLY
--
--   1. Generate a password — do NOT reuse one, do NOT let an agent choose it:
--        node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))"
--
--   2. Apply, substituting it (psql, so the password never lands in this file):
--        psql "$SUPABASE_POOLER_URL" -v ro_pw="'<PASTE-PASSWORD>'" -f seeds/169_readonly_review_role.sql
--
--   3. The reviewer's connection string is then:
--        postgresql://rsl_tag_review.bmuugbrevcukaeayqqwb:<PASSWORD>@aws-1-us-west-2.pooler.supabase.com:5432/postgres
--      NB the pooler wants `<role>.<project_ref>` as the username, not a bare role
--      name. VERIFY THIS CONNECTS before handing it over — Supabase's pooler has
--      historically been fussy about custom roles, and the direct host
--      (db.bmuugbrevcukaeayqqwb.supabase.co) is IPv6-only and will NOT resolve from
--      most networks. If it will not connect, that is a reason to use the export,
--      not a reason to fall back to the superuser string.
--
--   4. When the review is done, revoke it — a credential with no expiry is a
--      credential you will forget:
--        DROP OWNED BY rsl_tag_review; DROP ROLE rsl_tag_review;
-- ============================================================================

-- idempotent: safe to re-run to rotate the password
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'rsl_tag_review') then
    execute format('create role rsl_tag_review login password %L', :ro_pw);
  else
    execute format('alter role rsl_tag_review password %L', :ro_pw);
  end if;
end
$$;

-- Least privilege: strip anything inherited, then grant back only what is needed.
alter role rsl_tag_review nosuperuser nocreatedb nocreaterole noinherit noreplication nobypassrls;
alter role rsl_tag_review connection limit 5;
alter role rsl_tag_review set statement_timeout = '30s';        -- no runaway scans
alter role rsl_tag_review set idle_in_transaction_session_timeout = '60s';
alter role rsl_tag_review set default_transaction_read_only = on; -- belt and braces: no writes, ever

revoke all on schema public from rsl_tag_review;
grant connect on database postgres to rsl_tag_review;
grant usage on schema public to rsl_tag_review;

-- The 6 tables a tag review needs. SELECT only. Nothing else in the schema.
grant select on table public.champions        to rsl_tag_review;
grant select on table public.champion_skills  to rsl_tag_review;
grant select on table public.champion_tags    to rsl_tag_review;
grant select on table public.champion_auras   to rsl_tag_review;
grant select on table public.champion_aliases to rsl_tag_review;
grant select on table public.tags             to rsl_tag_review;

-- Do NOT grant on future tables. A new table must be granted deliberately, not
-- inherited — otherwise the next migration silently widens this role's reach.
-- (i.e. we intentionally do NOT run: alter default privileges ... grant select ...)

-- Verify (should list exactly the 6 above, all SELECT):
--   select table_name, privilege_type
--   from information_schema.role_table_grants
--   where grantee = 'rsl_tag_review'
--   order by table_name;
