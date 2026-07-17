-- ============================================================================
-- 191 — Delete the fabricated champions 'Fimo' and 'Jorad Wolfhart'. ROW DELETES.
--
-- Both were created 2026-06-27 with source_citation "Identity confirmed via Google
-- AI Overview June 2026 …" — the same unreliable, non-hierarchy source that produced
-- 'Nson' (seed 190). Confirmed fabricated 2026-07-18 against the project's own
-- ground-truth in-game faction roster screenshots (Champions/<faction>/*.png):
--   * 'Fimo' (Epic/Skinwalkers, 986e060c) — the Skinwalker Epic grids run
--     alphabetically Fayne -> Flesh-Tearer -> Fren'zi with NO Fimo. Not in game.
--   * 'Jorad Wolfhart' (Mythical/Sylvan Watchers, 28a3fbfb) — the Sylvan Watchers
--     Mythical roster is exactly Arbais / Nais / Nell. No Jorad Wolfhart. Not in game.
-- Neither carries real data (base stats NULL, 0 skills/tags/auras). Each has one
-- hallucinated champion_ai_notes row (same June 2026 AI Overview); Jorad also has one
-- fabricated alias. All deleted — there is no real champion to re-point them to.
--
-- This completes removal of the 3 "Google AI Overview" fakes. The roster is now being
-- reconciled against the full in-game grid archive (Champions/) as the master list —
-- which is also how the MISSING real champions (Aria the Golden Hope, Xanthe
-- Seaflower, …) will be found.
--
-- Order: delete RESTRICT-FK ai_notes (and the alias) before the champion rows.
-- ============================================================================

-- Fimo
delete from champion_ai_notes
where champion_id = '986e060c-d47d-445f-80b2-6cd96c07bb0d' and game_id = 'raid_shadow_legends';
delete from champions
where id = '986e060c-d47d-445f-80b2-6cd96c07bb0d' and game_id = 'raid_shadow_legends' and name = 'Fimo';

-- Jorad Wolfhart
delete from champion_ai_notes
where champion_id = '28a3fbfb-a194-4a75-b272-0e9bd294973a' and game_id = 'raid_shadow_legends';
delete from champion_aliases
where champion_id = '28a3fbfb-a194-4a75-b272-0e9bd294973a' and game_id = 'raid_shadow_legends';
delete from champions
where id = '28a3fbfb-a194-4a75-b272-0e9bd294973a' and game_id = 'raid_shadow_legends' and name = 'Jorad Wolfhart';
