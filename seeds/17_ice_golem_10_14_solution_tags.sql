-- ============================================================================
-- Ice Golem's Peak stages 10-14: tag + approve the wave/boss goal_solutions.
-- These were skeleton rows (status='proposed', zero goal_solution_tags), so the
-- matching engine — which reads only APPROVED solutions WITH tags — treated both
-- actionable goals as permanent gaps regardless of the team's champion tags
-- (same class of bug as the Clan Boss skeleton-solutions incident). Human-approved
-- 2026-07-01 (Mike). Both steps required: the tag links AND status='approved'.
--
-- NOTE: stage 14 is included per scope decision, but its GOALS still carry the
-- "stage 10-13 relaxed floor" text — inconsistent with the stage-14 difficulty
-- cliff (ACC 200+/HP 40000+/RES 200+). Tagging is correct regardless; the stage-14
-- GOAL text is a separate content-accuracy fix.
-- ============================================================================

-- 1. Link each solution to its required tag (OR-of-ANDs: any one solution covers the goal).
insert into goal_solution_tags (goal_solution_id, tag_id)
select gs.id, t.id
from goal_solutions gs
join goals g on g.id = gs.goal_id
join phases p on p.id = g.phase_id
join dungeon_stages ds on ds.id = p.dungeon_stage_id
join dungeons d on d.id = ds.dungeon_id
join (values
  ('Direct AoE damage',                            'AoE Damage'),
  ('Poison stacking (forward-compatible approach)', 'Poison'),
  ('AoE Damage',                                    'AoE Damage'),
  ('AoE Stun or Freeze',                            'AoE Stun'),   -- Freeze alt → separate solution later
  ('Block Revive',                                  'Block Revive')
) as m(label, tag) on m.label = gs.label
join tags t on t.name = m.tag
where d.name = 'Ice Golem''s Peak'
  and ds.label in ('Stage 10', 'Stage 11', 'Stage 12', 'Stage 13', 'Stage 14')
on conflict (goal_solution_id, tag_id) do nothing;

-- 2. Approve those solutions (a solution with tags but status='proposed' is still ignored).
update goal_solutions set status = 'approved'
 where id in (
   select gs.id
   from goal_solutions gs
   join goals g on g.id = gs.goal_id
   join phases p on p.id = g.phase_id
   join dungeon_stages ds on ds.id = p.dungeon_stage_id
   join dungeons d on d.id = ds.dungeon_id
   where d.name = 'Ice Golem''s Peak'
     and ds.label in ('Stage 10', 'Stage 11', 'Stage 12', 'Stage 13', 'Stage 14')
     and gs.label in (
       'Direct AoE damage', 'Poison stacking (forward-compatible approach)',
       'AoE Damage', 'AoE Stun or Freeze', 'Block Revive'
     )
 );
