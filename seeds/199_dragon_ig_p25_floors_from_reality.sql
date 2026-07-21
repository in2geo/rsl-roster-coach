-- 199_dragon_ig_p25_floors_from_reality.sql
-- Replace the hand-guessed Dragon + Ice Golem stat floors with the 25th-percentile stats of teams
-- that ACTUALLY CLEARED each band (tools/floor-from-reality.mjs, PCTL=0.25), and ADD Dragon's missing
-- HP survival floor. The old numbers were JUDGMENT CALLs measurably wrong by multiples (Dragon RES
-- 250-300 vs a real ceiling of 119; IG HP 40-45k vs teams that cleared at ~21-31k).
--
-- Pairs with a match-engine change (soft-penalty ceiling 0.55 -> 0.20) so a team genuinely far below a
-- now-CORRECT floor scores honestly low instead of a floored ~55%. Neither change is a hard line —
-- every floor stays soft (degrades confidence), nothing gates.
--
-- Data strength: Dragon 20-25 n=49 and IG 14-20 n=57 are solid; Dragon 15-19 (n=11) is Bambus-heavy
-- and IG 21-25 (n=2) is THIN — those two are directional and will firm up as more accounts sync.
-- Idempotent: UPDATEs by (dungeon, stage, stat); the HP INSERT is guarded by NOT EXISTS.

BEGIN;

-- ============================ Dragon's Lair ============================
-- RES was a false gate. Every clearing team had a champion at team-min RES ~30 (the carrier, who does
-- not build RES); a low-RES champ is debuffed individually, it is not a team wipe, and cleanse/sustain
-- covers it. Neutralise to 40 across all Dragon stages that declare RES (7-25).
UPDATE stat_threshold_checks stc SET formula = '40',
  notes = 'RES p25 team-min from real clears (~30) -> 40. Was 250-300 JUDGMENT CALL. Team-min RES is a weak gate; cleanse/sustain covers the boss debuffs. 2026-07-20 floor-from-reality.'
WHERE stc.stat = 'res' AND stc.phase_id IN (
  SELECT p.id FROM phases p JOIN dungeon_stages ds ON ds.id = p.dungeon_stage_id
  JOIN dungeons d ON d.id = ds.dungeon_id WHERE d.name = 'Dragon''s Lair');

-- ACC is carrier-aware in the engine (best debuff-carrier, not team-min); set to the p25 best-carrier
-- ACC per band (10-14: 47 -> 50, 15-19: 124 -> 125, 20-25: 194 -> 195). Stages 1-9 left as seeded.
UPDATE stat_threshold_checks stc SET formula = '50',
  notes = 'ACC p25 best-carrier from real clears (Dragon 10-14 = 47) -> 50. Was 150. 2026-07-20 floor-from-reality.'
WHERE stc.stat = 'acc' AND stc.phase_id IN (
  SELECT p.id FROM phases p JOIN dungeon_stages ds ON ds.id = p.dungeon_stage_id
  JOIN dungeons d ON d.id = ds.dungeon_id WHERE d.name = 'Dragon''s Lair' AND ds.stage_number BETWEEN 10 AND 14);

UPDATE stat_threshold_checks stc SET formula = '125',
  notes = 'ACC p25 best-carrier from real clears (Dragon 15-19 = 124) -> 125. Was 225. 2026-07-20 floor-from-reality.'
WHERE stc.stat = 'acc' AND stc.phase_id IN (
  SELECT p.id FROM phases p JOIN dungeon_stages ds ON ds.id = p.dungeon_stage_id
  JOIN dungeons d ON d.id = ds.dungeon_id WHERE d.name = 'Dragon''s Lair' AND ds.stage_number BETWEEN 15 AND 19);

UPDATE stat_threshold_checks stc SET formula = '195',
  notes = 'ACC p25 best-carrier from real clears (Dragon 20-25 = 194) -> 195. Was 225-250. 2026-07-20 floor-from-reality.'
WHERE stc.stat = 'acc' AND stc.phase_id IN (
  SELECT p.id FROM phases p JOIN dungeon_stages ds ON ds.id = p.dungeon_stage_id
  JOIN dungeons d ON d.id = ds.dungeon_id WHERE d.name = 'Dragon''s Lair' AND ds.stage_number BETWEEN 20 AND 25);

-- ADD Dragon's HP survival floor. Dragon declared NO HP floor, so once RES is relaxed nothing bounds a
-- low-HP team and it over-recommends. p25 team-min HP from clears gives a clean ramp. Attached to each
-- stage's existing RES-row phase; NOT EXISTS keeps re-runs from duplicating.
INSERT INTO stat_threshold_checks (id, phase_id, goal_id, stat, comparison, formula, threshold_type, notes)
SELECT gen_random_uuid(), stc.phase_id, NULL, 'hp', 'formula',
       CASE WHEN ds.stage_number BETWEEN 10 AND 14 THEN '8000'
            WHEN ds.stage_number BETWEEN 15 AND 19 THEN '10000'
            ELSE '19000' END,
       'raw',
       'HP p25 team-min from real clears (Dragon 10-14 ~8k / 15-19 ~10k / 20-25 ~19k). NEW survival floor — Dragon had none. 15-19 is Bambus-heavy (thin); 20-25 n=49 solid. 2026-07-20 floor-from-reality.'
FROM stat_threshold_checks stc
JOIN phases p ON p.id = stc.phase_id JOIN dungeon_stages ds ON ds.id = p.dungeon_stage_id
JOIN dungeons d ON d.id = ds.dungeon_id
WHERE stc.stat = 'res' AND d.name = 'Dragon''s Lair' AND ds.stage_number BETWEEN 10 AND 25
  AND NOT EXISTS (SELECT 1 FROM stat_threshold_checks x WHERE x.phase_id = stc.phase_id AND x.stat = 'hp');

-- ============================ Ice Golem's Peak ============================
-- HP was the culprit behind the IG over-recommendation. Real p25 team-min HP: 21221 (14-20, n=57) and
-- 30849 (21-25, n=2 THIN). Low bands (1-13: 5000/8000) left alone — their clears are over-geared farm
-- runs, so their p25 overstates the requirement; the seeded low values are already permissive.
UPDATE stat_threshold_checks stc SET formula = '21000',
  notes = 'HP p25 team-min from real clears (IG 14-20 = 21221, n=57). Was 40000. 2026-07-20 floor-from-reality.'
WHERE stc.stat = 'hp' AND stc.phase_id IN (
  SELECT p.id FROM phases p JOIN dungeon_stages ds ON ds.id = p.dungeon_stage_id
  JOIN dungeons d ON d.id = ds.dungeon_id WHERE d.name = 'Ice Golem''s Peak' AND ds.stage_number BETWEEN 14 AND 20);

UPDATE stat_threshold_checks stc SET formula = '30000',
  notes = 'HP p25 team-min from real clears (IG 21-25 = 30849, n=2 THIN — directional). Was 45000. 2026-07-20 floor-from-reality.'
WHERE stc.stat = 'hp' AND stc.phase_id IN (
  SELECT p.id FROM phases p JOIN dungeon_stages ds ON ds.id = p.dungeon_stage_id
  JOIN dungeons d ON d.id = ds.dungeon_id WHERE d.name = 'Ice Golem''s Peak' AND ds.stage_number BETWEEN 21 AND 25);

-- IG RES: same false-gate story as Dragon (team-min ~40 on clearing teams). Was 200-210.
UPDATE stat_threshold_checks stc SET formula = '40',
  notes = 'RES p25 team-min from real clears (IG 14+ ~40). Was 200-210. Team-min RES is a weak gate; cleanse/sustain covers it. 2026-07-20 floor-from-reality.'
WHERE stc.stat = 'res' AND stc.phase_id IN (
  SELECT p.id FROM phases p JOIN dungeon_stages ds ON ds.id = p.dungeon_stage_id
  JOIN dungeons d ON d.id = ds.dungeon_id WHERE d.name = 'Ice Golem''s Peak');
-- IG ACC intentionally UNCHANGED: p25 best-carrier was 273 (> the declared 200), so the current floor
-- is already permissive and is not what over-recommends IG. Leaving it avoids raising difficulty.

COMMIT;
