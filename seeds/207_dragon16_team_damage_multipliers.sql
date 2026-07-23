-- ============================================================================
-- 207 - Dragon-16 golden team damage multipliers (2026-07-22).
--
-- Source: verbatim in-game skill cards (Mike, 2026-07-22) for the Don$Bambus
-- Dragon-16 team (test/golden/dragon16-donbambus-2026-07-22.json). Captured to
-- make rung 4's exact-stat run consume this team's offense. Unblocks the
-- validator's top 0-damage champs on Dragon (Pelops 48 battles, Tagoar 37,
-- Bambus 19) and — critically — records the SCALING STAT in multiplier_type so
-- lib/sim reads it (the engine now multiplies by that stat, not always ATK).
--
-- CONVENTION (matches seed 206): damage_multiplier = bare number, scaling stat
-- in the multiplier_type column ('ATK' | 'HP' | 'DEF'). Pelops is HP-scaling and
-- Vergis is DEF-scaling — those are 0-or-wrong in the sim unless multiplier_type
-- is set. Vergis A1 ('3.9' / 'DEF') is ALREADY correct in the live DB, so he is
-- intentionally NOT in this seed.
--
-- Keyed by champion_id + slot (NOT skill_name): the cards use a typographic
-- apostrophe (Gorgoa's Bane / Da Vinci's Design) that does not match the DB's
-- straight-quote names; slot is unambiguous (one row per slot).
--
-- APPLIED to the live DB 2026-07-22 (with seed 206). Seed 205 (waves) remains
-- file-only. The former "DB untouched" branch posture no longer holds.
-- ============================================================================

-- Pelops the Victor — HP-scaling nuker (Lifesteal build). A3/passive place no direct damage.
update champion_skills set damage_multiplier = '0.25', multiplier_type = 'HP',
  review_notes = 'A1 Triumphant Blow: 0.25 x HP. Verbatim skill card (Mike 2026-07-22).',
  source = 'in-game skill card (Mike) 2026-07-22', verification_status = 'verified'
where champion_id = 'c372b462-30bf-495b-b5ab-c5ffc90a63e8' and slot = 'A1';

update champion_skills set damage_multiplier = '0.4', multiplier_type = 'HP',
  review_notes = 'A2 Gorgoa''s Bane (cd 4): 0.4 x HP. Damage scales +10%/turn of debuff duration on self+target (stacks 200%; not modelled). Verbatim card (Mike 2026-07-22).',
  source = 'in-game skill card (Mike) 2026-07-22', verification_status = 'verified'
where champion_id = 'c372b462-30bf-495b-b5ab-c5ffc90a63e8' and slot = 'A2';

-- Tagoar — ATK-scaling support/healer.
update champion_skills set damage_multiplier = '1.8', multiplier_type = 'ATK',
  review_notes = 'A1 Da Magic Stick: 1.8 x ATK, hits 2 times. Verbatim card (Mike 2026-07-22).',
  source = 'in-game skill card (Mike) 2026-07-22', verification_status = 'verified'
where champion_id = '994fc9c9-c99f-4618-b73b-29652b7791e7' and slot = 'A1';

update champion_skills set damage_multiplier = '3.7', multiplier_type = 'ATK',
  review_notes = 'A2 Charge Cant (cd 5): 3.7 x ATK, AoE; also Increase SPD + heal 15% of caster MAX HP. Verbatim card (Mike 2026-07-22).',
  source = 'in-game skill card (Mike) 2026-07-22', verification_status = 'verified'
where champion_id = '994fc9c9-c99f-4618-b73b-29652b7791e7' and slot = 'A2';

-- Bambus Fourleaf (champions.name 'Bambus') — ATK-scaling, but golden per-hero shows ~506k (top),
-- which 3.8/5.6 ATK @ 819 ATK cannot produce: his damage source is NOT reconciled (no Poison in kit).
-- Seed the direct coeffs; the ~506k discrepancy stays an OPEN item (see the golden qa_notes).
update champion_skills set damage_multiplier = '3.8', multiplier_type = 'ATK',
  review_notes = 'A1 Bamboo Splinter: 3.8 x ATK (hits all if target has 2+ debuffs). Verbatim card (Mike 2026-07-22). NOTE: golden top-damage ~506k unreconciled with this ATK coeff.',
  source = 'in-game skill card (Mike) 2026-07-22', verification_status = 'verified'
where champion_id = '98401e02-3594-43b2-8d41-0a0c0011a8ce' and slot = 'A1';

update champion_skills set damage_multiplier = '5.6', multiplier_type = 'ATK',
  review_notes = 'A2 Grovetender (cd 4): 5.6 x ATK, AoE; also team [Shield] 30% caster MAX HP + buff-duration ops. Verbatim card (Mike 2026-07-22).',
  source = 'in-game skill card (Mike) 2026-07-22', verification_status = 'verified'
where champion_id = '98401e02-3594-43b2-8d41-0a0c0011a8ce' and slot = 'A2';
