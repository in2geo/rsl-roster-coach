-- ============================================================================
-- Seed 116 — Fire Knight's Castle: advisor approval (2026-07-13)
-- ============================================================================
-- Reviewer verdict: APPROVE the full 1-25 build (seed 112) + the four 10-20
-- doc-gap fixes (seed 115), with three modifications:
--   MOD 1 — ACC floor for Stages 21-25: 210 -> 190.
--   MOD 2 — add 'Multi-Hit A1 + Ally Attack' shield-break solution to Stages
--           10-14, to match Stages 7-9 and 15-20.
--   MOD 3 — F2 (Reflect Damage) and F3 (Increase Speed as a shield-break
--           enabler) are DEFERRED pending in-game verification. They were never
--           seeded, so there is nothing to exclude here — just noting it.
-- Then flip ALL proposed Fire Knight goal_solutions -> approved.
--
-- STAGED-GOAL DECISIONS (the two goals that were parked as informational so they
-- couldn't penalise live 10-20 before approval):
--   • 'Counter Dazzling Flames' at Stages 7-14 -> PROMOTED to a real (hard) goal.
--     Fix #3's approved intent was "match 15-20", where Dazzling is already a real
--     goal; Dazzling Flames is a base skill active at every stage. This adds one
--     hard boss goal to the live 10-14 stages (solvable by Cleanse OR Increase
--     Speed), bringing them in line with 15-25.
--   • 'Deny Fyro's self-heal' (Heal Reduction) -> KEPT informational. Review
--     decision D (hard goal vs informational guidance) was left open, so we hold
--     the conservative staged default rather than penalise teams that win purely
--     by breaking the shield. Its solution is approved below, so a later promotion
--     is a one-line is_informational flip.
-- ============================================================================

-- ── MOD 2: add the Ally Attack shield-break solution at Stages 10-14 ─────────
insert into goal_solutions (goal_id, label, status, source_type, source_note, proposed_by)
select g.id, 'Multi-Hit A1 champions + Ally Attack', 'proposed', 'human_observation',
  'An unconditional team-wide Ally Attack adds a burst of hits toward the 10-hit shield. Added per advisor review 2026-07-13 to match Stages 7-9 and 15-20.',
  'fk-approval-2026-07-13'
from goals g
join phases p on p.id = g.phase_id
join dungeon_stages ds on ds.id = p.dungeon_stage_id
join dungeons d on d.id = ds.dungeon_id
where d.name = 'Fire Knight''s Castle'
  and p.phase_type = 'boss'
  and ds.stage_number between 10 and 14
  and g.description ilike 'Break%'
  and not exists (
    select 1 from goal_solutions x
    where x.goal_id = g.id and x.label = 'Multi-Hit A1 champions + Ally Attack'
  );

insert into goal_solution_tags (goal_solution_id, tag_id)
select gs.id, t.id
from goal_solutions gs
join (values ('Multi-Hit A1'), ('Ally Attack')) as m(tag_name) on true
join tags t on t.name = m.tag_name
where gs.proposed_by = 'fk-approval-2026-07-13'
  and gs.label = 'Multi-Hit A1 champions + Ally Attack'
  and not exists (
    select 1 from goal_solution_tags x
    where x.goal_solution_id = gs.id and x.tag_id = t.id
  );

-- ── MOD 1: ACC floor for Stages 21-25: 210 -> 190 ───────────────────────────
update stat_threshold_checks stc
set formula = '190',
    notes = 'ACC ~190+ (advisor-set 2026-07-13, down from the initial 210 estimate) to land Decrease SPD/DEF/Weaken vs endgame RES. Recalibrate with account data.'
from phases p
join dungeon_stages ds on ds.id = p.dungeon_stage_id
join dungeons d on d.id = ds.dungeon_id
where stc.phase_id = p.id
  and d.name = 'Fire Knight''s Castle'
  and p.phase_type = 'boss'
  and ds.stage_number between 21 and 25
  and stc.stat = 'acc';

-- ── Promote 'Counter Dazzling Flames' at Stages 7-14 to a real (hard) goal ───
update goals g
set is_informational = false
from phases p
join dungeon_stages ds on ds.id = p.dungeon_stage_id
join dungeons d on d.id = ds.dungeon_id
where g.phase_id = p.id
  and d.name = 'Fire Knight''s Castle'
  and p.phase_type = 'boss'
  and ds.stage_number between 7 and 14
  and g.is_informational = true
  and g.description ilike 'Counter Dazzling Flames%';

-- ── Flip ALL proposed Fire Knight goal_solutions -> approved ─────────────────
-- Covers seed 112 (stages 1-9, 21-25), seed 115 (Increase Turn Meter, Heal
-- Reduction, Dazzling 7-14 solutions), and MOD 2's Ally Attack solution.
update goal_solutions gs
set status = 'approved',
    approved_by = 'advisor-review-2026-07-13',
    approved_at = now()
where gs.status = 'proposed'
  and gs.goal_id in (
    select g.id from goals g
    join phases p on p.id = g.phase_id
    join dungeon_stages ds on ds.id = p.dungeon_stage_id
    join dungeons d on d.id = ds.dungeon_id
    where d.name = 'Fire Knight''s Castle'
  );
