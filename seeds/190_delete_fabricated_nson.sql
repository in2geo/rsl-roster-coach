-- ============================================================================
-- 190 — Delete the fabricated champion 'Nson'. CONTAINS ROW DELETES.
--
-- 'Nson' (Epic / Orcs / Magic, id 1bd05a0a-998b-4deb-9e14-1a6fb70a56b0) is NOT a
-- real Raid champion. It was created 2026-06-27 with source_citation:
--   "Identity confirmed via Google AI Overview June 2026 — base stats not yet on
--    raid.guide or Gestal."
-- Google AI Overview is not on the CLAUDE.md source hierarchy and hallucinates
-- plausible-sounding champions. Confirmed fabricated 2026-07-18:
--   * Mike checked the in-game Orcs roster: the Magic Epic Orcs are Dhukk, Jorrg,
--     Tagoar, Merouka — there is no Nson (screenshot).
--   * The row carries NO real data: base stats NULL, 0 skills, 0 tags, 0 auras,
--     0 aliases, 0 type_id, 0 roster references.
--   * Its ONE attached row — a champion_ai_notes entry — is itself hallucinated
--     ("Pure burst assassin ... high-multiplier ignore-DEF single-target nuke",
--     sourced from the same June 2026 AI Overview, status='proposed'). There is no
--     real champion to move it to, so it is deleted, not re-pointed.
--
-- This is a data-integrity find, not a dedup: the roster is inflated by AI-Overview
-- fakes AND missing real champions (Aria the Golden Hope, Xanthe Seaflower). Two
-- sibling AI-Overview rows remain UNDER REVIEW (not touched here): 'Fimo' and
-- 'Jorad Wolfhart' — pending in-game verification.
--
-- Order: delete the RESTRICT-FK ai_note before the champion row. Idempotent.
-- ============================================================================

delete from champion_ai_notes
where champion_id = '1bd05a0a-998b-4deb-9e14-1a6fb70a56b0'
  and game_id = 'raid_shadow_legends';

delete from champions
where id = '1bd05a0a-998b-4deb-9e14-1a6fb70a56b0'
  and game_id = 'raid_shadow_legends'
  and name = 'Nson';
