-- ============================================================================
-- Champion name-uniqueness constraints — locks the naming fix so masked duplicates
-- (K'Leth/Losan KLeth, Ma'Shalled/MaShalled, Ashnar/Ash'nar Dragonsoul) can NEVER
-- be inserted again. Pairs with lib/champion-names.js normalizeName() in code.
--
-- Normalization here is ASCII (lower + strip non-alphanumeric) — immutable, so it is
-- index-safe. It intentionally covers the ENTIRE observed duplicate class (case,
-- apostrophes, hyphens, spaces). It does NOT strip accents (unaccent is not immutable);
-- the JS normalizeName does, and remains the authoritative resolver — this is a backstop.
--
-- Verified 2026-07-18: 0 Rare+ normalized-name collisions and 0 ambiguous aliases at
-- creation time (the Ma'Shalled dup was merged in seed 193; the only remaining raw
-- collision is Knight Errant/Knight-Errant, both handled below — the Uncommon one is
-- out of scope and excluded by the partial predicate).
-- ============================================================================

-- 1. No two IN-SCOPE (Rare+) champions may share a normalized name.
--    Partial so out-of-scope Common/Uncommon rows (never advised on) don't block it.
create unique index if not exists champions_norm_name_uniq
  on champions (game_id, (lower(regexp_replace(name, '[^a-zA-Z0-9]', '', 'g'))))
  where rarity in ('Rare', 'Epic', 'Legendary', 'Mythical');

-- 2. A normalized alias maps to exactly one champion, game-wide — so "any name →
--    exactly one champion.id" is enforced by the DB, not just convention.
create unique index if not exists champion_aliases_norm_uniq
  on champion_aliases (game_id, (lower(regexp_replace(alias, '[^a-zA-Z0-9]', '', 'g'))));
