-- 200_spider_p25_hp_floor.sql
-- Spider's Den had ONLY an ACC floor (stage*10) and NO survival floor, so any roster with one
-- accurate carrier got recommended into the top tiers. Add an HP survival floor from the p25 team-min
-- HP of teams that actually cleared each tier (tools: floor-from-reality method, PCTL=0.25).
--
-- Data: 1-14 n=23 (p25 minHP 8229) and 15-20 n=11 (p25 minHP 14287) are real. 21-25 has ZERO clears
-- in the entire corpus (nobody has cleared Spider 21+, developed accounts included), so its floor is
-- EXTRAPOLATED (20000) and explicitly a guess. NB Spider's true wall is partly MECHANICAL — DonThor
-- walls at 17 with strong stats — which a stat floor cannot express; this only adds survival gating.
-- Idempotent: HP INSERT guarded by NOT EXISTS. Attached to each tier-group's existing ACC-row phase.

BEGIN;

INSERT INTO stat_threshold_checks (id, phase_id, goal_id, stat, comparison, formula, threshold_type, notes)
SELECT gen_random_uuid(), stc.phase_id, NULL, 'hp', 'formula',
       CASE WHEN ds.label ILIKE '%1-14%'  THEN '8000'
            WHEN ds.label ILIKE '%15-20%' THEN '14000'
            ELSE '20000' END,
       'raw',
       CASE WHEN ds.label ILIKE '%1-14%'  THEN 'HP p25 team-min from real clears (Spider 1-14 = 8229, n=23). NEW survival floor. 2026-07-20 floor-from-reality.'
            WHEN ds.label ILIKE '%15-20%' THEN 'HP p25 team-min from real clears (Spider 15-20 = 14287, n=11; developed-account-biased). NEW survival floor. 2026-07-20 floor-from-reality.'
            ELSE 'HP EXTRAPOLATED (Spider 21-25 = 20000) — ZERO clears in corpus; a guess. Spider 21+ is also mechanically gated (spiderlings/heal-block), not just HP. 2026-07-20.' END
FROM stat_threshold_checks stc
JOIN phases p ON p.id = stc.phase_id JOIN dungeon_stages ds ON ds.id = p.dungeon_stage_id
JOIN dungeons d ON d.id = ds.dungeon_id
WHERE stc.stat = 'acc' AND d.name = 'Spider''s Den'
  AND NOT EXISTS (SELECT 1 FROM stat_threshold_checks x WHERE x.phase_id = stc.phase_id AND x.stat = 'hp');

COMMIT;
