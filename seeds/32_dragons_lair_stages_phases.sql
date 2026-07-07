-- 32 — Dragon's Lair Chunk 1: dungeon_stages + phases (stages 10-20).
-- Idempotent (ON CONFLICT DO NOTHING). NOTE: "Stage 19"/"Stage 20" already existed, so
-- they're skipped here (their existing rows/notes are kept); this adds 10-18 fresh and
-- the wave/boss phases for any 10-20 stage that lacks them.

insert into dungeon_stages (dungeon_id, stage_number, label, notes)
select d.id, s.num, s.lbl, s.note
from dungeons d
cross join (values
  -- Affinities corrected 2026-07-07 from the in-game stage list (video). Prior values
  -- had Force/Spirit swapped (real rotation is Magic->Force->Spirit->Void, floors 1-19).
  (10, 'Stage 10', 'Force affinity. Scorch mechanic active (from stage 7). No stage 21+ passives.'),
  (11, 'Stage 11', 'Spirit affinity. Scorch mechanic active.'),
  (12, 'Stage 12', 'Void affinity. No affinity penalty for any champion. Scorch mechanic active.'),
  (13, 'Stage 13', 'Magic affinity. Scorch mechanic active.'),
  (14, 'Stage 14', 'Force affinity. Scorch mechanic active.'),
  (15, 'Stage 15', 'Spirit affinity. Scorch mechanic active.'),
  (16, 'Stage 16', 'Void affinity. No affinity penalty for any champion. Scorch mechanic active.'),
  (17, 'Stage 17', 'Magic affinity. Scorch mechanic active.'),
  (18, 'Stage 18', 'Force affinity. Scorch mechanic active.'),
  (19, 'Stage 19', 'Spirit affinity. Scorch mechanic active.'),
  (20, 'Stage 20', 'Magic affinity. Primary farming stage. Boss has 200 RES — ACC 225+ recommended. No stage 21+ passives.')
) as s(num, lbl, note)
where d.name = 'Dragon''s Lair'
on conflict (dungeon_id, label) do nothing;

insert into phases (dungeon_stage_id, phase_type, notes)
select ds.id, 'wave',
  'Two wave encounters before the boss. Waves are the biggest challenge
   at higher stages — AoE CC (Stun, Freeze) prevents dangerous wave
   skills from activating and saves healer cooldowns for the boss phase.'
from dungeon_stages ds
join dungeons d on d.id = ds.dungeon_id
where d.name = 'Dragon''s Lair'
and ds.label in (
  'Stage 10','Stage 11','Stage 12','Stage 13','Stage 14',
  'Stage 15','Stage 16','Stage 17','Stage 18','Stage 19','Stage 20'
)
on conflict (dungeon_stage_id, phase_type) do nothing;

insert into phases (dungeon_stage_id, phase_type, notes)
select ds.id, 'boss',
  'Hellrazor the Dragon. Key mechanic: Inhale (3-turn cooldown) sets
   all team Turn Meters to 50% and turns part of his HP purple. Team
   gets one attack to clear the purple bar before Scorch fires.
   Scorch = massive DEF-ignoring AoE + unresistable team Stun.
   Dragon is immune to Decrease Turn Meter and Decrease SPD.
   Hellrazor applies Decrease ATK, Poison, and Weaken to your team —
   sustain and cleanse are critical.'
from dungeon_stages ds
join dungeons d on d.id = ds.dungeon_id
where d.name = 'Dragon''s Lair'
and ds.label in (
  'Stage 10','Stage 11','Stage 12','Stage 13','Stage 14',
  'Stage 15','Stage 16','Stage 17','Stage 18','Stage 19','Stage 20'
)
on conflict (dungeon_stage_id, phase_type) do nothing;
