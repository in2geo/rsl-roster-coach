-- 38 — Dragon's Lair finalize: approve reviewed solutions + fix style-note topic prefixes.

-- Approve the (human-reviewed) Dragon's Lair solutions so the engine will use them.
-- Scoped to this content by proposed_by; only flips rows still 'proposed'.
update goal_solutions gs set status = 'approved'
from goals g
join phases p on p.id = g.phase_id
join dungeon_stages ds on ds.id = p.dungeon_stage_id
join dungeons d on d.id = ds.dungeon_id
where gs.goal_id = g.id
  and d.name = 'Dragon''s Lair'
  and ds.stage_number between 10 and 20
  and gs.proposed_by = 'dragon-lair-seed-july-2026'
  and gs.status = 'proposed';

-- Rename style-note topics 'Dragon ...' -> 'Dragon Lair ...' so matchRoster (which derives
-- the key "Dragon Lair" from "Dragon's Lair") surfaces them. Seed 36 created the 'Dragon ...'
-- form; these are one-time renames (no-op on a fresh rebuild if 36 is later corrected).
update explanation_style_notes set topic = 'Dragon Lair Scorch mechanic explanation'
  where topic = 'Dragon Scorch mechanic explanation';
update explanation_style_notes set topic = 'Dragon Lair TM immunity warning'
  where topic = 'Dragon TM immunity warning';
update explanation_style_notes set topic = 'Dragon Lair ACC floor explanation'
  where topic = 'Dragon ACC floor explanation';
update explanation_style_notes set topic = 'Dragon Lair stage 20 vs stage 21 transition'
  where topic = 'Dragon stage 20 vs stage 21 transition';
