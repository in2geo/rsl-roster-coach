-- 39 — Dragon's Lair: mark the wave "preserve" goal as informational.
--
-- "Preserve team HP and cooldowns entering the boss phase" has no tag-based solutions —
-- it's a strategic outcome of solving the wave goal correctly, not an independently
-- matchable requirement. Flipping to is_informational=true removes the permanent
-- confidence penalty from all Dragon stage verdicts.
update goals g set is_informational = true
from phases p
join dungeon_stages ds on ds.id = p.dungeon_stage_id
join dungeons d on d.id = ds.dungeon_id
where g.phase_id = p.id
  and d.name = 'Dragon''s Lair'
  and ds.stage_number between 10 and 20
  and p.phase_type = 'wave'
  and g.description = 'Preserve team HP and cooldowns entering the boss phase.'
  and g.is_informational = false;
