-- ============================================================================
-- Seed 119 — Spider's Den strategy tiers: GO-LIVE (advisor approved 2026-07-13)
-- ============================================================================
-- Reviewer approved the 3-tier model (seeds 117 + 118) in full. This seed flips
-- it live and retires the old rows. Pairs with the lib/match-engine.js change that
-- repoints SPIDER_SCAN_GROUPS to the three tiers (extended to stage 25).
--
-- Steps:
--   1. Preserve data: repoint the 9 champion_solo_profiles on the old 'Stages 7-10'
--      row to the new 'Stages 1-14' tier (7-10 ⊂ 1-14, same AoE-nuke tier) BEFORE
--      deleting — otherwise the ON DELETE CASCADE would destroy those solo carries.
--   2. Flip all proposed Spider-tier solutions -> approved.
--   3. Explanation-layer notes (reviewer requirements B & C).
--   4. Flag the AoE-HP-Burn limitation on the 15-20 solution.
--   5. Delete the old 'Stages 1-6' / 'Stages 7-10' rows (clean break — the 3-tier
--      model supersedes them and they conflict with the new scan).
-- ============================================================================

-- ── 1. Preserve/detach ALL references to the old rows before deleting ───────
-- The old 'Stages 1-6'/'7-10' rows are referenced by: champion_solo_profiles (ON
-- DELETE CASCADE — would be silently lost), recommendation_outcomes (NOT NULL,
-- RESTRICT — blocks the delete), and battle_history (nullable). Repoint the first
-- two to the new 'Stages 1-14' tier (both old rows fall within it) and null the
-- battle_history link (it re-resolves; battle keeps its own stage_number).
-- 1a. champion_solo_profiles → Stages 1-14
update champion_solo_profiles
set dungeon_stage_id = (select ds.id from dungeon_stages ds join dungeons d on d.id = ds.dungeon_id
                        where d.name = 'Spider''s Den' and ds.label = 'Stages 1-14')
where dungeon_stage_id in (
  select ds.id from dungeon_stages ds join dungeons d on d.id = ds.dungeon_id
  where d.name = 'Spider''s Den' and ds.label in ('Stages 1-6','Stages 7-10'));

-- 1b. recommendation_outcomes (feedback data; NOT NULL) → Stages 1-14
--     stage_number_attempted already preserves the exact stage that was played.
update recommendation_outcomes
set dungeon_stage_id = (select ds.id from dungeon_stages ds join dungeons d on d.id = ds.dungeon_id
                        where d.name = 'Spider''s Den' and ds.label = 'Stages 1-14')
where dungeon_stage_id in (
  select ds.id from dungeon_stages ds join dungeons d on d.id = ds.dungeon_id
  where d.name = 'Spider''s Den' and ds.label in ('Stages 1-6','Stages 7-10'));

-- 1c. battle_history (nullable) → null the stale group link
update battle_history
set dungeon_stage_id = null
where dungeon_stage_id in (
  select ds.id from dungeon_stages ds join dungeons d on d.id = ds.dungeon_id
  where d.name = 'Spider''s Den' and ds.label in ('Stages 1-6','Stages 7-10'));

-- ── 2. Flip all proposed Spider-tier solutions -> approved ──────────────────
update goal_solutions gs
set status = 'approved', approved_by = 'advisor-review-2026-07-13', approved_at = now()
where gs.status = 'proposed'
  and gs.proposed_by = 'spider-tiers-seed-2026-07-13';

-- ── 3. Explanation-layer notes (explanation_style_notes; read by explain.js) ─
insert into explanation_style_notes (topic, note)
select v.topic, v.note
from (values
  ('Spider''s Den 21-25 — why burst fails and DoTs win',
   'At Stages 21-25 Almighty Strength caps SINGLE-HIT %MaxHP damage at 10% of the boss'' MaxHP, so burst nukers fall off. But Poison and HP Burn are damage-over-time: each ticks ~3% MaxHP per round, well UNDER the cap, so they are unaffected and become the most effective damage. When recommending 21-25, tell the player plainly: their burst / %MaxHP-nuke champs stop working here — switch to AoE HP Burn + Poison DoTs.'),
  ('Spider''s Den ACC floor + margin',
   'The ACC floor is stage x 10 (e.g. 200 at Stage 20). Surface a deliberate ~+10% reliability margin to the player as GUIDANCE, not as the floor value: e.g. "Stage 20 needs 200 ACC; aim for ~220 to land debuffs reliably." Keep the floor and the margin separate so the margin can be recalibrated once real data exists.')
) as v(topic, note)
where not exists (select 1 from explanation_style_notes x where x.topic = v.topic);

-- ── 4. Flag the AoE-HP-Burn deferral on the 15-20 damage solution ───────────
update goal_solutions
set source_note = source_note || ' KNOWN LIMITATION: the AoE HP Burn tag is deferred, so this uses the plain HP Burn tag — the engine cannot distinguish AoE vs single-target HP Burn placers here. Revisit these when AoE HP Burn is added to the vocabulary.'
where proposed_by = 'spider-tiers-seed-2026-07-13'
  and label = 'AoE HP Burn';

-- ── 5. Delete the old rows (cascade clears their phases/goals/solutions/thresholds) ──
delete from dungeon_stages ds
using dungeons d
where ds.dungeon_id = d.id
  and d.name = 'Spider''s Den'
  and ds.label in ('Stages 1-6', 'Stages 7-10');
