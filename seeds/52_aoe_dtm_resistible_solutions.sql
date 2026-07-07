-- ============================================================================
-- 52 — Resistible AoE-TM sibling solutions.
--
-- The tag split (seed 51) created 'AoE Decrease Turn Meter (Resistible)'
-- (is_debuff=true, bypasses_accuracy_check=false) alongside the existing
-- 'AoE Decrease Turn Meter' (bypass variant). Every dungeon goal that offered
-- the bypass variant as a solution now excludes resistible-AoE-TM champions
-- (e.g. Androc), even though they satisfy the same wave/minion TM-control goal
-- when their ACC is high enough.
--
-- Fix: add a sibling goal_solution on the resistible tag to each such goal. The
-- matching engine ACC-gates it automatically (isAccuracyGated = is_debuff AND
-- NOT bypasses_accuracy_check → true for this tag), evaluated per-goal against
-- the phase's existing ACC floor — so NO stat_threshold_checks row is needed,
-- and none is representable per-solution anyway. The bypass sibling stays as
-- the no-ACC path.
--
-- Affects 13 goals: Dragon's Lair wave stages 10-20 (11) + Spider's Den
-- Stages 1-6 and 7-10 (2). status='proposed' — human review required.
-- Idempotent: a goal already carrying a resistible sibling is skipped.
-- ============================================================================

with tgt as (
  select distinct g.id as goal_id
  from goals g
  join goal_solutions gs      on gs.goal_id = g.id and gs.status = 'approved'
  join goal_solution_tags gst on gst.goal_solution_id = gs.id
  join tags t                 on t.id = gst.tag_id and t.name = 'AoE Decrease Turn Meter'
  where not exists (
    select 1
    from goal_solutions gs2
    join goal_solution_tags gst2 on gst2.goal_solution_id = gs2.id
    join tags t2                 on t2.id = gst2.tag_id
                                 and t2.name = 'AoE Decrease Turn Meter (Resistible)'
    where gs2.goal_id = g.id
  )
),
ins as (
  insert into goal_solutions
    (goal_id, label, status, source_type, source_note, proposed_by, proposed_at)
  select
    goal_id,
    'AoE Decrease Turn Meter (resistible — requires ACC)',
    'proposed',
    'human_observation',
    'Sibling solution to the bypass-variant AoE Decrease Turn Meter solution. '
    'Satisfies the same wave TM control goal for champions whose skill text '
    'does NOT contain a "cannot be resisted" clause. The ACC-gated evaluation '
    'is handled dynamically by the matching engine (isAccuracyGated = true '
    'for this tag) — no explicit ACC threshold row is needed here. Added '
    'July 2026 after tag split created AoE Decrease Turn Meter (Resistible) '
    'as a distinct vocabulary entry.',
    'tag-split-resistible-july-2026',
    now()
  from tgt
  returning id
)
insert into goal_solution_tags (goal_solution_id, tag_id)
select ins.id, t.id
from ins
cross join tags t
where t.name = 'AoE Decrease Turn Meter (Resistible)'
on conflict (goal_solution_id, tag_id) do nothing;
