-- ============================================================================
-- Allow source_type='raid_guide' on champion_tags. Per the 2026-07-01 CLAUDE.md
-- carve-out: raid.guide verbatim skill DESCRIPTIONS are an allowed source for
-- PROPOSED tags (human-reviewed before going live). Extends the existing domain.
-- ============================================================================

alter table champion_tags drop constraint if exists champion_tags_source_type_check;
alter table champion_tags add constraint champion_tags_source_type_check
  check (source_type in (
    'in_game_index', 'patch_notes', 'fandom_wiki', 'human_observation', 'raid_guide'
  ));
