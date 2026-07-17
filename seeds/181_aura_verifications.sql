-- ============================================================================
-- Seed 181 — aura verifications from the in-game aura screen (TIER-1)
--
-- CONTEXT: seed 168 found that aura_restriction is NULL on 653 of 656 rows, and
-- that the aura_summary is TEMPLATED not verbatim — the restriction clause was
-- normalised away at capture, so a NULL is ambiguous: it could mean "genuinely
-- unrestricted" or "restricted, but we dropped it" (Rhaia was the latter).
-- "We cannot tell which" was the finding. This seed is where Tier-1 answers land.
--
-- ▶ Vallaryn the Equalizer — CONFIRMED UNRESTRICTED (Mike, in-game, 2026-07-17):
--   "his aura is all battles". ATK 28% / All Battles / no restriction. The NULL is
--   CORRECT for him.
--
--   This is the first Tier-1 evidence that a NULL restriction is genuinely null.
--   It does NOT clear the other 652 — n=1, and Rhaia proves the failure is real —
--   but it does say the corpus is not uniformly broken, which is worth knowing
--   before anyone commits to re-capturing all 656.
--
-- WHY BOTHER RECORDING A NEGATIVE: because verification_status is the only thing
-- that distinguishes "checked, genuinely unrestricted" from "never checked". Right
-- now 561 of 656 are 'pending' and they all look identical to a NULL that is wrong.
-- Same lesson as Staltus: the field that says how much you trust a row is what
-- makes the row falsifiable. A confirmed negative is data.
--
-- Running total of in-game aura checks:
--   Rhaia    — restriction WAS stripped ("only applies to Sylvan Watchers") → fixed, seed 168
--   Vallaryn — genuinely unrestricted → confirmed here
--   1 of 2 checked was wrong. Do not extrapolate from n=2; do keep counting.
-- ============================================================================

update champion_auras a
set verification_status = 'verified',
    review_notes = coalesce(a.review_notes || ' | ', '') || 'Confirmed in-game (Mike 2026-07-17): aura is All Battles with NO restriction. The NULL aura_restriction is CORRECT for this champion, not a stripped clause. Tier-1.'
from champions c
where a.champion_id = c.id
  and c.game_id = 'raid_shadow_legends'
  and c.name = 'Vallaryn the Equalizer'
  and a.verification_status is distinct from 'verified';
