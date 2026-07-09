-- ============================================================================
-- Seed 40 — Coldheart proposed tags from in-game Index skill text
-- Source: in-game champion Index / skill-detail popups, captured verbatim from
-- a screen recording of Coldheart (Lvl 60, 6★, all skills booked to Level 5)
-- on 2026-07-06. source_type='in_game_index' — a PRIMARY source (the literal
-- Plarium skill text), allowed per CLAUDE.md. status='proposed' — HUMAN REVIEW
-- REQUIRED before use; the match engine only reads status='approved' tags, so
-- nothing here changes behaviour until a human approves it. No auto-merge.
--
-- Verbatim skill text observed (Level 5 = fully booked, so the % below are the
-- BOOKED/max values):
--   A1 Flurry of Arrows: "Attacks 4 times at random. Each hit has a 25% chance
--       of placing a 100% [Heal Reduction] debuff for 2 turns." Damage: [ATK].
--   A2 Art of Pain (cd 3t): "Attacks all enemies. Has a 30% chance of placing a
--       50% [Decrease ACC] debuff for 1 turn. Places a 5% [Poison] debuff for 2
--       turns IF the target is under a [Heal Reduction] debuff." Damage: [ATK].
--   A3 Heartseeker (cd 4t): "Attacks 1 enemy. Decreases the target's Turn Meter
--       by 100%. Has an extra 30% chance of inflicting a critical hit. Damage
--       increases according to enemy MAX HP." Damage: [Enemy MAX HP] [ATK].
--
-- What this file inserts (NEW, not already present):
--   * Coldheart A3 Heartseeker -> Decrease Turn Meter. This tag is MISSING from
--     the existing Coldheart tag set — the raid.guide scrape (seeds/15) only
--     covered A1 and A2 for this champion, so A3's guaranteed 100% Turn Meter
--     reduction was never proposed. This is the substantive gap the video fills.
--     Single-target, no chance clause => guaranteed on hit (still subject to the
--     normal ACC/RES check; Heartseeker's text has no "cannot be resisted"
--     clause, so bypasses_accuracy_check=false on the tag is correct here — cf.
--     CLAUDE.md open question #2 on instant-DTM bypass).
--
-- Already covered by seeds/15_champion_tags_raidguide_full.sql (NOT re-inserted
-- here; the unique(champion_id, tag_id) constraint would no-op them anyway):
--   * A1 Heal Reduction  — raid.guide seeded "15% unbooked (25% booked)". The
--     in-game text CONFIRMS 25% at Level 5 (booked). No new row needed.
--   * A2 Decrease ACC    — raid.guide seeded "25% unbooked (30% booked)". The
--     in-game text CONFIRMS 30% at Level 5 (booked). No new row needed.
--   * A2 Poison          — see the REVIEWER FLAG below; not re-inserted.
--
-- >>> REVIEWER FLAG (do not auto-fix; flagged for the human review pass) <<<
--   The existing raid.guide Poison row for Coldheart (seeds/15) records the A2
--   Poison as a flat chance: "[Poison] 25% unbooked (30% booked). AoE (all
--   enemies)." The in-game skill text shows the Poison is actually CONDITIONAL,
--   not a flat chance: it is placed (5%, 2t) ONLY when the target is already
--   under a [Heal Reduction] debuff — i.e. it combos off Coldheart's own A1.
--   When reviewing, correct that raid.guide row's source_note (and any matching
--   logic that treats the Poison as an unconditional AoE Poison) to reflect the
--   conditional application. This file deliberately does NOT mutate the other
--   source's proposed row — the correction is a human review decision.
-- ============================================================================

-- ascension_required = 0: Heartseeker is Coldheart's base A3, not an ascended
-- skill. Explicit (matching seeds/13,15) so this works whether or not the
-- champion_tags.ascension_required column carries a default.
insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by, proposed_at, ascension_required)
select ch.id, t.id, 'proposed', 'in_game_index',
       'A3 Heartseeker (cd 4t): single-target, "Decreases the target''s Turn Meter by 100%." No chance clause => guaranteed on hit (subject to normal ACC/RES; no "cannot be resisted" clause). Also has +30% extra crit chance and damage scaling on enemy MAX HP (not tags). Verbatim in-game Index skill text, Level 5 booked, captured 2026-07-06. Fills a gap: raid.guide scrape (seeds/15) only tagged Coldheart A1/A2.',
       'in-game-index-video', now(), 0
from champions ch
join tags t on t.name = 'Decrease Turn Meter'
where ch.game_id = 'raid_shadow_legends' and ch.name = 'Coldheart'
  and not exists (
    select 1 from champion_tags x where x.champion_id = ch.id and x.tag_id = t.id
  );
