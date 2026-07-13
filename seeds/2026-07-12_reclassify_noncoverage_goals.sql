-- Reclassify mis-modeled goals as is_informational so they STOP counting as false tag-coverage
-- gaps. These are stat-threshold / advisory / constraint / mastery requirements — NOT things a
-- champion's TAG satisfies — so they can never be "covered" and were permanently marking teams
-- not-ready. The engine already excludes is_informational goals from actionableGoals/gaps
-- (lib/match-engine.js computeTagCoverage). Idempotent. 2026-07-12.
--
-- Follow-ups (separate): (a) the THRESHOLD ones belong in stat_threshold_checks — confirm a check
-- exists per stage; (b) the ADVISORY ones ("kill the right minion", "preserve HP") should be
-- re-surfaced as explanation notes (boss_exceptions), not silently dropped; (c) the MASTERY one
-- can be checked via team has_boss_mastery.
update goals set is_informational = true
where is_informational is distinct from true and (
  -- THRESHOLD (speed tunes / RES) → belong in stat_threshold_checks, not tag coverage
  description ilike '%speed must exceed the spiderlings%'
  or description ilike '%Speed tuning: ensure the fastest champion%'
  or description ilike '%Run 1:1 speed tune%'
  or description ilike '%fast enough to land 10 hits%'
  or description ilike '%sufficient RES to resist Frigid Vengeance%'
  -- ADVISORY (strategy / targeting / state) → notes, never a coverage gap
  or description ilike '%Preserve team HP%'
  or description ilike '%Kill the right minion first%'
  or description ilike '%Counter Dazzling Flames SPD debuff%confirm%'
  -- MASTERY → checked via team has_boss_mastery (Warmaster/Giant Slayer)
  or description ilike '%Warmaster or Giant Slayer%'
  -- CONSTRAINT (negative / don't-bring)
  or description ilike '%Avoid bringing Counterattack champions%'
  or description ilike '%immune to Decrease Turn Meter and Decrease SPD%'
);

-- Fire Knight "Apply Decrease DEF and Weaken once shield is down" is a genuine COVERAGE goal that
-- had NO solution at all → a permanent false gap. Create an approved solution wired to the tags.
insert into goal_solutions (goal_id, label, status, source_type, source_note)
select g.id, 'Decrease DEF + Weaken', 'approved', 'human_observation',
       'Wired 2026-07-12: coverage goal had no solution (Fire Knight boss damage window).'
from goals g
where g.description ilike 'Apply Decrease DEF and Weaken once shield is down%'
  and not exists (select 1 from goal_solutions s where s.goal_id = g.id and s.label = 'Decrease DEF + Weaken');

insert into goal_solution_tags (goal_solution_id, tag_id)
select s.id, t.id
from goal_solutions s
join goals g on g.id = s.goal_id and g.description ilike 'Apply Decrease DEF and Weaken once shield is down%'
cross join tags t
where s.label = 'Decrease DEF + Weaken' and t.name in ('Decrease Defense', 'Weaken')
  and not exists (select 1 from goal_solution_tags x where x.goal_solution_id = s.id and x.tag_id = t.id);
