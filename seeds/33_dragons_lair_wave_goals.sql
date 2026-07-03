-- 33 — Dragon's Lair Chunk 2: wave phase goals + solutions (stages 10-20).
--
-- NOT EXISTS guards added (goals/goal_solutions have no unique constraint) so the seed is
-- idempotent. The solutions here are LABEL-ONLY — their goal_solution_tags come in a later
-- chunk; until then they're tagless + status='proposed', so the engine ignores them (it
-- only reads approved, tagged solutions). Nothing goes live off this chunk.

insert into goals (phase_id, description, is_informational)
select p.id, g.g_desc, g.g_info
from phases p
join dungeon_stages ds on ds.id = p.dungeon_stage_id
join dungeons d on d.id = ds.dungeon_id
cross join (values
  ('Clear the wave before dangerous enemy skills activate.', false),
  ('Preserve team HP and cooldowns entering the boss phase.', false)
) as g(g_desc, g_info)
where d.name = 'Dragon''s Lair'
and ds.label in (
  'Stage 10','Stage 11','Stage 12','Stage 13','Stage 14',
  'Stage 15','Stage 16','Stage 17','Stage 18','Stage 19','Stage 20'
)
and p.phase_type = 'wave'
and not exists (select 1 from goals x where x.phase_id = p.id and x.description = g.g_desc);

insert into goal_solutions
  (goal_id, label, status, source_type, source_note, proposed_by)
select g.id, s.lbl, 'proposed', 'human_observation', s.note,
  'dragon-lair-seed-july-2026'
from goals g
join phases p on p.id = g.phase_id
join dungeon_stages ds on ds.id = p.dungeon_stage_id
join dungeons d on d.id = ds.dungeon_id
cross join (values
  ('AoE Stun',
   'Stuns all wave enemies, denying their turns entirely. HellHades
    confirms this is the primary wave control method for Dragon.
    Source: hellhades.com Dragon guide.'),
  ('AoE Freeze',
   'Freezes all wave enemies — same outcome as AoE Stun for wave
    control purposes.'),
  ('AoE Decrease Turn Meter',
   'Pushes all wave enemies back, buying extra turns before they act.
    Confirmed viable by HellHades: "use turn meter manipulation to
    prevent the wave from getting a turn before you do."'),
  ('AoE Damage',
   'Raw AoE damage clears waves fast enough that CC is less critical —
    viable at stages 10-14 where wave stats are lower. Source:
    human_observation, lower-confidence than CC solutions.')
) as s(lbl, note)
where d.name = 'Dragon''s Lair'
and ds.label in (
  'Stage 10','Stage 11','Stage 12','Stage 13','Stage 14',
  'Stage 15','Stage 16','Stage 17','Stage 18','Stage 19','Stage 20'
)
and p.phase_type = 'wave'
and g.description like 'Clear the wave%'
and not exists (select 1 from goal_solutions x where x.goal_id = g.id and x.label = s.lbl);
