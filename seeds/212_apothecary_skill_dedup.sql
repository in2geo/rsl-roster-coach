-- ============================================================================
-- 212 — Apothecary skill dedup + verbatim correction.
--
-- Apothecary (champion_id 146236f2-a913-47d8-822a-31eaf7d2480f; High Elves,
-- Magic, Rare Support) had 6 champion_skills rows — each of A1/A2/A3 DUPLICATED:
-- one verbatim row (with a real damage_multiplier) and one stale PARAPHRASED row
-- that carried no multiplier and parsed to NOTHING in the sim (surfaced by
-- tools/mob-skill-audit.mjs while building Dragon stage 17, a Magic stage whose
-- waves include Apothecary). Verbatim skill text confirmed from in-game
-- screenshots 2026-07-25 (VERIFY-FROM-SOURCE):
--   A1 Scatterbolt   — "Attacks 3 times at random." (1.4×ATK; multi-hit)
--   A2 Soothing Chant — "Heals a target ally by 35% HP. This Heal can be critical." (CD 3)
--   A3 Boon of Speed  — "Places a 30% [Increase SPD] buff on all allies for 2 turns.
--                        Fills the Turn Meter of all allies by 15%." (CD 5)
--   Aura              — "Increases Ally DEF in Dungeons by 21%."
--
-- Deletes the 3 stale rows by id; keeps the verbatim rows; normalises the A3
-- wording to the exact in-game text ([Increase SPD], not "[Increase Speed]").
-- Idempotent: re-running deletes nothing and re-applies the same A3 text.
-- ============================================================================

delete from champion_skills where id in (
  'c8666b37-241a-4156-b29e-35c35a85db87',   -- A1 duplicate (cooldown_base null; the verbatim cd=0 row 51e29c97 stays)
  'd449ee58-67b6-44a4-a359-1fea2d4433aa',   -- A2 paraphrase ("Single-target heal based on ally HP; heal can crit.")
  '329184a1-b3d6-483c-abcf-6672ccdc2fc3'    -- A3 paraphrase ("Team Increase SPD plus Turn Meter fill.")
);

update champion_skills
   set skill_summary = 'Places a 30% [Increase SPD] buff on all allies for 2 turns. Fills the Turn Meter of all allies by 15%.'
 where id = 'dab05e6a-fcfe-465f-98e6-9294907da002';
