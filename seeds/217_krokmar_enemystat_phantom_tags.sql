-- ============================================================================
-- 217 - Strip Krok'mar the Devourer's 4 enemy-stat phantom tags (2026-08-01).
-- Verify-from-source (CLAUDE.md HARD RULE): Krok'mar's passive reads "decreases
-- the highest stat of each ENEMY by 5%. Can be either ATK or DEF ... ACC or RES
-- ... This Champion's stats are increased by the same amount." So ATK/DEF/ACC/RES
-- appear ONLY in an enemy-stat-DECREASE / self-mirror context - he places NO ally
-- [Increase ATK/DEF/ACC/RES] buff (regex-confirmed absent). The four Increase-X
-- tags were mis-scraped from that enemy-decrease prose. HELD out of the seed-216
-- self-scaling sweep for manual review; Mike confirmed removal 2026-08-01.
--
-- REAL ally buffs KEPT: A3 places [Increase C.RATE] + [Increase C.DMG] (not in
-- this reject set). Soft-reject; code consumes only 'approved'. Policy #18
-- worksheet DB_Champion_Tags write-back OWED.
-- ============================================================================
update champion_tags set status='rejected',
       source_note = coalesce(source_note,'') || ' | REJECTED 2026-08-01 (verify-from-source): from passive "decreases highest ENEMY stat, ATK or DEF / ACC or RES"; no ally Increase-stat buff placed.'
 where champion_id='a6b23b96-ffc6-44a8-aca6-a04e5d9fa60c'
   and status='approved'
   and tag_id in (
     '466efeab-39d1-4f71-b466-b40c5408e0ec',  -- Increase Attack
     '98bbbae2-6d09-44bf-8a85-85027baddf77',  -- Increase Defense
     '5b1ed025-47ed-463b-9888-508efc3448bc',  -- Increase ACC
     '0ceb6494-e9bd-4f5d-aa68-5538545712d7'   -- Increase RES
   );
