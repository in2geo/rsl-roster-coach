-- ============================================================================
-- Seed 124 — Ice Golem's Peak: finalize (advisor rulings, 2026-07-13)
-- ============================================================================
-- Applies the reviewer's rulings on the 1-25 build (seed 122) + cleans the
-- pre-existing 10-20 skeleton solutions.
--
--   A. WORDING FIX: Frigid Vengeance ignores DEF "per alive MINION" (Klyssus's
--      allies = the minions), not "per alive ally" (which read as your team). This
--      is why keeping minions dead is critical — it removes the DEF shred entirely.
--      (Only the new 1-9/21-25 boss_exceptions had the wrong wording; live 10-20
--      already said "per alive minion".)
--   B. SKELETON CLEANUP (10-20): the untagged proposed solutions never got approved.
--      • 'AoE Stun or Freeze' → tag (AoE Stun, matching the live Stage 10 row) + approve.
--      • 'Avoid Counterattack/Reflect Damage entirely' → delete (its goal is already
--        informational; guidance stays there).
--      • 'Kill revived minions immediately' → delete (the "Keep minions dead" goal
--        carries it).
--      • 'High base ACC (150+ above threshold)' → delete (the ACC threshold system
--        already provides ACC guidance — redundant).
--   C. GO-LIVE: flip the new Stages 1-9 & 21-25 (seed 122) proposed → approved.
--
-- NOTE: seed 123 (reconstruction of 10-20) is regenerated AFTER this so it captures
-- the cleaned 10-20 state.
-- ============================================================================

-- ── A. Wording fix ──────────────────────────────────────────────────────────
update boss_exceptions be
set description = replace(description, 'per alive ally', 'per alive minion')
from dungeon_stages ds join dungeons d on d.id = ds.dungeon_id
where be.dungeon_stage_id = ds.id
  and d.name = 'Ice Golem''s Peak'
  and be.description like '%per alive ally%';

-- ── B. Skeleton cleanup (Ice Golem Stages 10-20) ────────────────────────────
-- B1. 'AoE Stun or Freeze' → add the AoE Stun tag, then approve.
insert into goal_solution_tags (goal_solution_id, tag_id)
select gs.id, t.id
from goal_solutions gs
join goals g on g.id = gs.goal_id
join phases p on p.id = g.phase_id
join dungeon_stages ds on ds.id = p.dungeon_stage_id
join dungeons d on d.id = ds.dungeon_id
join tags t on t.name = 'AoE Stun'
where d.name = 'Ice Golem''s Peak'
  and ds.stage_number between 10 and 20 and ds.label like 'Stage %'
  and gs.label = 'AoE Stun or Freeze' and gs.status = 'proposed'
  and not exists (select 1 from goal_solution_tags x where x.goal_solution_id = gs.id and x.tag_id = t.id);

update goal_solutions gs
set status = 'approved', approved_by = 'advisor-review-2026-07-13', approved_at = now()
from goals g, phases p, dungeon_stages ds, dungeons d
where gs.goal_id = g.id and g.phase_id = p.id and p.dungeon_stage_id = ds.id and ds.dungeon_id = d.id
  and d.name = 'Ice Golem''s Peak'
  and ds.stage_number between 10 and 20 and ds.label like 'Stage %'
  and gs.label = 'AoE Stun or Freeze' and gs.status = 'proposed';

-- B2. Delete the three broken skeleton solution types (cascade removes any tags).
delete from goal_solutions gs
using goals g, phases p, dungeon_stages ds, dungeons d
where gs.goal_id = g.id and g.phase_id = p.id and p.dungeon_stage_id = ds.id and ds.dungeon_id = d.id
  and d.name = 'Ice Golem''s Peak'
  and ds.stage_number between 10 and 20 and ds.label like 'Stage %'
  and gs.status = 'proposed'
  and gs.label in (
    'Avoid Counterattack/Reflect Damage entirely',
    'Kill revived minions immediately',
    'High base ACC (150+ above threshold)'
  );

-- ── C. Go-live: flip Stages 1-9 & 21-25 proposed → approved ──────────────────
update goal_solutions gs
set status = 'approved', approved_by = 'advisor-review-2026-07-13', approved_at = now()
where gs.status = 'proposed'
  and gs.proposed_by = 'ig-full-range-2026-07-13';
