-- 37 — Dragon's Lair Chunk 6: goal_solution_tags (link solutions -> required tags).
--
-- Without these links every Dragon's Lair solution is a tagless skeleton and the engine
-- can't match any goal. Maps each solution label to the champion capability tag(s) it
-- needs. Note the two-tag AND: "Decrease Defense + Weaken" requires BOTH. Descriptive
-- labels map to their underlying tag (Poison stacking -> Poison, etc.).
-- Idempotent via ON CONFLICT on UNIQUE(goal_solution_id, tag_id).
--
-- The solutions remain status='proposed' — the engine reads only APPROVED solutions, so
-- Dragon's Lair still needs a human review->approve pass before it goes live.

insert into goal_solution_tags (goal_solution_id, tag_id)
select gs.id, t.id
from goal_solutions gs
join goals g on g.id = gs.goal_id
join phases p on p.id = g.phase_id
join dungeon_stages ds on ds.id = p.dungeon_stage_id
join dungeons d on d.id = ds.dungeon_id
join (values
  ('AoE Stun',                    'AoE Stun'),
  ('AoE Freeze',                  'AoE Freeze'),
  ('AoE Decrease Turn Meter',     'AoE Decrease Turn Meter'),
  ('AoE Damage',                  'AoE Damage'),
  ('Poison stacking',             'Poison'),
  ('HP Burn',                     'HP Burn'),
  ('High burst AoE damage',       'AoE Damage'),
  ('Cleanse',                     'Cleanse'),
  ('Continuous Heal + high HP',   'Continuous Heal'),
  ('Decrease Attack on Hellrazor','Decrease Attack'),
  ('Decrease Defense + Weaken',   'Decrease Defense'),
  ('Decrease Defense + Weaken',   'Weaken'),
  ('Decrease Defense only',       'Decrease Defense')
) as m(sol_label, tag_name) on gs.label = m.sol_label
join tags t on t.name = m.tag_name
where d.name = 'Dragon''s Lair'
  and ds.stage_number between 10 and 20
on conflict (goal_solution_id, tag_id) do nothing;
