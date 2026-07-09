-- ============================================================================
-- Backfill DDL for champion_tags.ascension_required
--
-- This column has been in use since 2026-07-02 (seeds 13/15/21/22/30/31 insert
-- it; lib/match-engine.js gates tags on it — a tag from a skill that only
-- unlocks at ascension N is ignored until the owned champion is ascended to N).
-- But it was applied directly to the live DB and never had committed DDL, so a
-- from-scratch rebuild from schema.sql + migrations was missing the column and
-- every one of those seeds would fail on `insert ... (…, ascension_required)`.
-- This migration makes the schema reconstructable again (CLAUDE.md: "the DB
-- should always be reconstructable from the committed seed files").
--
-- Shape mirrors user_champions.ascension_level (schema.sql 11d): a 0-6 int,
-- NOT NULL DEFAULT 0. 0 = unlocked at base (the common case); 3 = unlocks at
-- Ascension 3 (e.g. Fayne's Decrease ATK, Pelops' HP Burn/Petrification). See
-- KNOWN_GAPS.md "ascension_required — no automated source" for how values are
-- sourced (manually, from the in-game Index; seeds/31_ascension_overrides.sql).
--
-- Idempotent: `add column if not exists` no-ops on the live DB where the column
-- already exists, and creates it on a fresh rebuild. The matching value has
-- also been added to the champion_tags CREATE TABLE in schema.sql so a pure
-- schema.sql build (before migrations run) already includes it; this migration
-- then self-heals any environment built before that edit.
-- ============================================================================

alter table champion_tags
  add column if not exists ascension_required int not null default 0;

-- Range guard (0-6), added separately so it also lands on live DBs whose column
-- predates this file. `if not exists` on named constraints keeps it idempotent.
alter table champion_tags
  drop constraint if exists champion_tags_ascension_required_check;
alter table champion_tags
  add constraint champion_tags_ascension_required_check
  check (ascension_required between 0 and 6);
