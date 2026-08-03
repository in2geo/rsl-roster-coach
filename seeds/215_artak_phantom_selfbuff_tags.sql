-- ============================================================================
-- 215 - Strip 4 phantom self-buff tags from Artak (2026-08-01). Verify-from-
-- source (CLAUDE.md HARD RULE): Artak's passive Burning Blood reads "Increases
-- THIS CHAMPION's DMG, C.DMG and DEF by 1% ... SPD and RES by 2 ..." per 1% of
-- destroyed MAX HP. That is SELF stat-scaling, NOT placed [Increase X] buffs on
-- allies. Nothing in A1/A2/A3 places Increase DEF/SPD/RES/C.DMG. So these four
-- tags are phantoms scraped from self-scaling prose (individual self-buffs are
-- excluded by design). REAL tags kept: HP Burn, Decrease Attack, AoE Damage,
-- Increase Debuff Duration, Debuff Activation.
--
-- Impact: the phantom [Increase Speed] put Artak in the Spider `tempo` bucket,
-- which is scored NEGATIVE (overfill tempo -1) - a tag he does not have was
-- DOCKING his Spider score. Same failure class as seed 214 (Fellhound phantom
-- tm tag) and seed 110's mis-scrapes.
--
-- Soft-reject (status='rejected'); code consumes only 'approved'
-- (lib/match-engine.js:247). Policy #18 worksheet write-back still OWED.
-- ============================================================================
update champion_tags set status='rejected',
       source_note = coalesce(source_note,'') || ' | REJECTED 2026-08-01 (verify-from-source): passive self-scaling ("increases THIS CHAMPION''s ...") mis-scraped as a placed buff; Artak places no ally Increase-stat buff.'
 where champion_id='20072536-e08f-4782-b198-6a608144ba67'
   and status='approved'
   and tag_id in (
     '98bbbae2-6d09-44bf-8a85-85027baddf77',  -- Increase Defense
     'ca018a80-426e-44e2-bd2c-7e869cbf18df',  -- Increase Speed
     '0ceb6494-e9bd-4f5d-aa68-5538545712d7',  -- Increase RES
     '75a32692-9eb6-4431-9a20-331fa08e2616'   -- Increase C.DMG
   );
