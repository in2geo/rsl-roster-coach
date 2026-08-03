-- ============================================================================
-- 214 - Strip bogus Fellhound tag (2026-08-01). Verify-from-source (CLAUDE.md
-- HARD RULE): reconciling champion_skills.skill_summary vs champion_tags shows
-- Fellhound carries an APPROVED "AoE Decrease Turn Meter (Resistible)" tag that
-- NOTHING in his kit supports. His three skills:
--   A1 Ravage        - Attacks all enemies; 25% chance 15% [Decrease SPD] 2t
--   A2 Flameborn Vigor- [Continuous Heal] + [Reflect Damage] on all allies
--   A3 Deflect        - [Block Damage] on an ally
-- There is NO Decrease Turn Meter effect anywhere. His only slow is [Decrease
-- SPD] (already tagged, kept). The phantom tm_lock tag made the pool model pick
-- him for the Spider `tm_lock` bucket on a capability he does not have.
--
-- Soft-reject (status='rejected') to preserve the audit trail; the code consumes
-- only status='approved' (lib/match-engine.js:247), so this removes it from
-- selection. Same failure class as seed 110's ignore-mechanic false positives.
-- Policy #18 worksheet DB_Champion_Tags write-back still OWED (no worksheet
-- access this session).
-- ============================================================================
update champion_tags
   set status='rejected',
       source_note = coalesce(source_note,'') || ' | REJECTED 2026-08-01 (verify-from-source): skill_summary has NO Decrease Turn Meter; only A1 [Decrease SPD]. Phantom tag mis-credited Fellhound with tm_lock.'
 where champion_id='59565a3c-49d4-432c-af57-e384a2c25b4f'
   and tag_id='7790fa90-7186-40a9-8d33-d5fd3c11d8d1'
   and status='approved';
