-- ============================================================================
-- Add the game-global champion typeId to champions, so roster/battle matching
-- keys on a stable id instead of exact display-name strings (which drift:
-- "Glorious Pallas" vs "Pallas", "Narma the Returned" vs "Narma", …).
-- Nullable: only owned champions (from Gestal exports) have a known typeId yet;
-- the rest fall back to name matching until their typeId is observed.
-- ============================================================================

alter table champions add column if not exists type_id integer;

-- typeId is global per game (same champion = same id everywhere), so it must be
-- unique within a game. Partial: many rows are still null (unobserved).
create unique index if not exists uq_champions_game_type_id
  on champions(game_id, type_id) where type_id is not null;
