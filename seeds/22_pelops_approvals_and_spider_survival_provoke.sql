-- ============================================================================
-- Pelops enablement: (1) approve his 7 in-game-Index tags, (2) add Provoke as a
-- survival solution to Spider's Den so his Taunt actually covers the gap.
-- Human-approved 2026-07-01 (Mike).
--
-- Ascension gate VERIFIED before approving the two passive (asc 3) tags: mapRoster
-- excludes a tag when ascension_required > player's ascension_level (match-engine.js
-- ~L133), so HP Burn / Petrification only count for a 3★+ Pelops.
--
-- CORRECTION to the source SQL: the Spider's Den solution insert as written matched
-- 0 rows (labels are "Stages 1-6"/"Stages 7-10" not "Stage 9/10"; and it targeted the
-- already-satisfied "Prevent the spiderlings" goal, not the gap). The gap is the
-- SURVIVAL goal — which is where the intent ("Provoke covering the survival goal")
-- actually applies. Targeting it here.
-- ============================================================================

-- (1) Approve all 7 Pelops tags (5 non-passive + 2 ascension-gated passives).
update champion_tags
   set status = 'approved', approved_by = 'mike-review-2026-07-01', approved_at = now()
 where status = 'proposed'
   and champion_id = (select id from champions where name = 'Pelops the Victor' and game_id = 'raid_shadow_legends');

-- (2a) Add "Provoke (Taunt)" as a solution to the Spider's Den survival goal (both groups).
insert into goal_solutions (goal_id, label, status, source_type, source_note, proposed_by)
select g.id, 'Provoke (Taunt)', 'approved', 'human_observation',
  'Taunt onto a tanky champion (e.g. Pelops: Magma Shield 30% MAX HP + damage-reduction passive + high HP, with passive HP Burn punishing attackers) redirects the boss''s large single-target hit onto a body built to absorb it — a valid survival route alongside Healer and Shield. Added per battle-log review: a Pelops team cleared Spider 10 while the engine flagged this survival goal as unmet.',
  'in-game-index-review-july-2026'
from goals g
join phases p on p.id = g.phase_id
join dungeon_stages ds on ds.id = p.dungeon_stage_id
join dungeons d on d.id = ds.dungeon_id
where d.name = 'Spider''s Den'
  and ds.label in ('Stages 1-6', 'Stages 7-10')
  and g.description ilike '%Survive the Spider boss%'
  and g.is_informational = false;

-- (2b) Tag those new solutions with Provoke.
insert into goal_solution_tags (goal_solution_id, tag_id)
select gs.id, t.id
from goal_solutions gs
join tags t on t.name = 'Provoke'
where gs.label = 'Provoke (Taunt)'
  and gs.goal_id in (
    select g.id from goals g
    join phases p on p.id = g.phase_id
    join dungeon_stages ds on ds.id = p.dungeon_stage_id
    join dungeons d on d.id = ds.dungeon_id
    where d.name = 'Spider''s Den' and g.description ilike '%Survive the Spider boss%'
  )
on conflict (goal_solution_id, tag_id) do nothing;
