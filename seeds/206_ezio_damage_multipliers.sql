-- ============================================================================
-- 206 - Ezio Auditore damage multipliers (2026-07-22).
--
-- Source: in-game skill card (Mike 2026-07-22) CROSS-CHECKED with datamined
-- decimals. The card DISPLAYS ROUNDED-UP integers (4 / 4 / 5); the precise
-- coefficients are 3.8 / 3.7 / 4.7 (Mike confirmed the card values are just the
-- rounded form and align). We seed the PRECISE decimals. Ezio's multipliers were
-- never harvested (worksheet Skills tab rows blank / "Pending"), and the
-- validator flagged him as the top 0-damage champion on Dragon (100/102 fielded
-- battles, all 3 skills missing). This unblocks BOTH the boss purple-bar clear
-- and the wave clear in lib/sim.
--
-- All ATK-type. damage_multiplier stored as a bare number + multiplier_type,
-- matching seed 104's convention (e.g. '3.5' / 'ATK').
-- ============================================================================

update champion_skills set
  damage_multiplier = '3.8', multiplier_type = 'ATK',
  review_notes = 'Precise 3.8 ATK; in-game card rounds up to 4.',
  source = 'in-game skill card (Mike) + datamined decimal 2026-07-22', verification_status = 'verified'
where champion_id = '00404172-1b85-49eb-b353-a0aaaf9cca1f' and skill_name = 'Eagle Dive';

update champion_skills set
  damage_multiplier = '3.7', multiplier_type = 'ATK',
  review_notes = 'Precise 3.7 ATK; card rounds up to 4. Conditional Bomb Multiplier 6 ATK vs [Stone Skin] (not modelled).',
  source = 'in-game skill card (Mike) + datamined decimal 2026-07-22', verification_status = 'verified'
where champion_id = '00404172-1b85-49eb-b353-a0aaaf9cca1f' and skill_name = 'Da Vinci''s Design';

update champion_skills set
  damage_multiplier = '4.7', multiplier_type = 'ATK',
  review_notes = 'Precise 4.7 ATK; in-game card rounds up to 5.',
  source = 'in-game skill card (Mike) + datamined decimal 2026-07-22', verification_status = 'verified'
where champion_id = '00404172-1b85-49eb-b353-a0aaaf9cca1f' and skill_name = 'Hidden Gun';

-- Passive execute bonus (fires when an Assassin drops an enemy below 25% HP;
-- ignores 100% DEF, cannot crit). Recorded for completeness; the sim treats
-- passives as non-actions, so this does not yet enter the damage path.
update champion_skills set
  damage_multiplier = '2', multiplier_type = 'ATK',
  review_notes = 'Passive execute bonus (2 ATK is the rounded card value; precise decimal not sourced): enemy < 25% HP after damage from any Assassin; ignores 100% DEF, cannot crit.',
  source = 'in-game skill card (Mike-supplied) 2026-07-22', verification_status = 'verified'
where champion_id = '00404172-1b85-49eb-b353-a0aaaf9cca1f' and skill_name = 'Everything Is Permitted [P]';
