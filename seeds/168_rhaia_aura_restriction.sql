-- ============================================================================
-- Seed 168 — Rhaia's aura restriction (TIER-1) + logging a SYSTEMIC aura gap
--
-- SOURCE: Mike's in-game aura screen for Rhaia the Mourned, 2026-07-17. Verbatim:
--     "Increases Ally ATK in all Battles by 35% (only applies to Sylvan Watchers)."
--
-- Our row had aura_type=ATK, aura_value=35%, aura_area='All Battles' — all correct —
-- and aura_restriction = NULL, with aura_summary reduced to "Increases ally ATK in
-- All Battles." The restriction clause was DROPPED.
--
-- WHY IT MATTERS: `selectLeader()` scores each fielded champion's aura for the
-- content and only the leader's aura applies (see the leader-aura-selection memory).
-- With restriction NULL, Rhaia reads as a flat +35% team ATK aura — one of the
-- strongest in the game — when in reality she buffs NOBODY outside Sylvan Watchers.
-- On a mixed team the engine would elect her leader and credit ATK that never
-- lands. This is a wrong recommendation, not a cosmetic gap.
--
-- ▶▶ THE SYSTEMIC FINDING (this seed fixes ONE row; the class is much bigger)
--
--   champion_auras                     656 rows
--     aura_restriction SET               3   (all affinity: "Magic allies only" ×2,
--                                             "Void allies only" ×1)
--     aura_restriction NULL            653
--     aura_summary containing "only applies"    0
--     aura_summary mentioning ANY faction name  6
--     verification_status: pending 561 / web_sourced 80 / verified 15
--     source: "worksheet Auras tab 2026-07-11" — ALL 656
--
--   THE AURA SUMMARIES ARE TEMPLATED, NOT VERBATIM. 86 distinct shapes across 656
--   rows, all of the form "Increases ally <STAT> in <AREA>." This is the opposite of
--   `champion_skills.skill_summary`, which is verbatim Plarium text and is exactly
--   why the tag layer can be re-derived from it (CLAUDE.md "Tag source of truth").
--   The aura layer has no such ground truth: the restriction clause was normalised
--   away at capture and CANNOT be recovered from what we store.
--
--   CONSEQUENCE: we cannot tell which of the 653 are genuinely unrestricted and
--   which are restricted-but-stripped. Rhaia proves at least one is stripped. The
--   only fix is RE-CAPTURE from a source that carries the clause (the in-game aura
--   screen is Tier-1 and shows it, as this screenshot does).
--
--   This is NOT the same as the 2026-07-10 aura gap batch (80 MISSING auras added
--   from ayumilove). Those rows exist and their type/value/area are right. The
--   defect is a missing FIELD on rows that look complete — the same shape as
--   Staltus's 5★/50 stats (right-looking, wrong) rather than a NULL that announces
--   itself.
--
-- SCOPE OF THIS SEED: Rhaia only. One champion, one screenshot, Tier-1. Fixing the
-- other 652 is a re-capture project and needs Mike's call on priority — it is
-- plausibly small (most Raid auras are genuinely unrestricted) but we do not know,
-- and "we do not know" is the finding.
--
-- GUARDED on the champion + the current NULL so it is a no-op once applied.
-- ============================================================================

update champion_auras a
set aura_restriction = 'Sylvan Watchers only',
    aura_summary = 'Increases Ally ATK in all Battles by 35% (only applies to Sylvan Watchers).',
    verification_status = 'verified',
    review_notes = coalesce(a.review_notes || ' | ', '') || 'Restriction recovered from in-game aura screen (Mike screenshot 2026-07-17), Tier-1. Was NULL; summary had the "(only applies to Sylvan Watchers)" clause stripped by the worksheet template. See seed header re: the systemic aura_restriction gap (653/656 NULL).'
from champions c
where a.champion_id = c.id
  and c.game_id = 'raid_shadow_legends'
  and c.name = 'Rhaia'
  and a.aura_restriction is null;
