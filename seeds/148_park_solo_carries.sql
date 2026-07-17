-- ============================================================================
-- Seed 148 — PARK the solo-carry layer (Mike, 2026-07-16)
--
-- DECISION: "the solo carry is very niche and i don't want it interfering with
-- the main app" ... "it seems like the solo stuff is really getting in the way
-- of the regular stuff. we might need to park all the solo stuff for a while."
--
-- WHAT PARKING MEANS HERE: solo profiles go back to status='proposed', so
-- checkSoloCarries (which reads approved-only) returns nothing and the solo
-- layer goes silent in the main app. NOTHING IS DELETED — the rows, the seeds
-- (06, 143) and the research all remain; flipping them back to 'approved'
-- un-parks the feature in one statement.
--
-- WHY, concretely — approving these in seed 145 made the app WORSE, not better:
--   • Spider now surfaces "Arix, Kael, Elhain, Kael, Elhain" — DUPLICATE rows,
--     starter Rares, to an account that clears Spider 16.
--   • checkSoloCarries is INVERTED: it queries `dungeon_stage_id = <the stage the
--     TEAM scan already picked>`, so a carry is only found if the team could
--     already get there — the opposite of the point, and the opposite of what
--     CLAUDE.md claims ("Solo carry check runs BEFORE team recommendation").
--     Mike has explicitly declined this fix; parking is the alternative.
--   • The profiles' required_set is NOT checked against equipped gear, so the
--     layer proposes champions in builds the player does not have (Michelangelo's
--     IG/Dragon solos need Toxic; he is in Perception 4 + Accuracy 2).
--
-- SCOPE: 47 rows (11 pre-existing approved + 36 approved by seed 145). This
-- REVERSES part of seed 145 deliberately — the tag half of that approval stays.
--
-- REPLAY-SAFE: guarded on status='approved'; re-running is a no-op.
-- UN-PARK: update champion_solo_profiles set status='approved' where status='proposed';
-- ============================================================================

update champion_solo_profiles
set status      = 'proposed',
    approved_by = null,
    approved_at = null
where status = 'approved';
