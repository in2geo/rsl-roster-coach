-- Seed 132 — Spider's Den per-stage enemy stats, Stages 16-25 (Skavag + Spiderling).
-- Extends seeds/131 (Stages 1-15) to the full ladder. Requires the dungeon_stage_enemies table.
--
-- Source: in-game / stat-site enemy table (factual game data). Transcribed 2026-07-15.
-- Affinity icons in the source match seed 130 exactly (16 Spirit / 17 Void / 18 Magic /
-- 19 Force / 20 Spirit / 21 Void / 22 Magic / 23 Force / 24 Spirit / 25 Magic).
--
-- TWO INTENTIONAL ODDITIES (verified against the source image — do NOT "correct" as typos):
--   1. RES/ACC is NON-MONOTONIC at high stages: 150 (16-18), 200 (19-20), 150 (21-23),
--      200 (24-25). A stage*N formula would be wrong here — this is why real capture matters.
--   2. Stage 19 Skavag ATK = 5,988 is FLAGGED-ANOMALOUS: it dips below st18 (8,337) and st20
--      (11,947) and equals the Spiderling's ATK, breaking the ~0.6 add:boss ATK ratio that
--      holds on every other row. Seeded as-shown pending Mike's re-check of that one cell.

insert into dungeon_stage_enemies (dungeon_id, stage_number, enemy_name, enemy_role, hp, atk, def, spd, res, acc, crit_rate, crit_dmg)
select d.id, v.* from dungeons d
cross join (values
  -- stage, name,          role,     hp,       atk,   def,  spd, res, acc, cr, cd
  (16,'Skavag',    'boss',  1745400,  5818, 3879,  95, 150, 150, 15, 50),
  (16,'Spiderling','add',     69810,  3491,  776, 150, 150, 150, 15, 50),
  (17,'Skavag',    'boss',  2381865,  6965, 3993,  95, 150, 150, 15, 50),
  (17,'Spiderling','add',     95280,  4179,  799, 150, 150, 150, 15, 50),
  (18,'Skavag',    'boss',  3226410,  8337, 4002,  95, 150, 150, 15, 50),
  (18,'Spiderling','add',    129060,  5002,  800, 150, 150, 150, 15, 50),
  (19,'Skavag',    'boss',  4311330,  5988, 3992,  95, 200, 200, 15, 50),   -- ATK anomaly: verify
  (19,'Spiderling','add',    172455,  5988,  798, 150, 200, 200, 15, 50),
  (20,'Skavag',    'boss',  5555175, 11947, 3982,  95, 200, 200, 15, 50),
  (20,'Spiderling','add',    222210,  7168,  796, 150, 200, 200, 15, 50),
  (21,'Skavag',    'boss',  5947350, 13672, 4010,  95, 150, 150, 15, 50),
  (21,'Spiderling','add',    254295,  8203,  802, 150, 150, 150, 15, 50),
  (22,'Skavag',    'boss',  6336915, 15647, 4068,  95, 150, 150, 15, 50),
  (22,'Spiderling','add',    262860,  9388,  803, 150, 150, 150, 15, 50),
  (23,'Skavag',    'boss',  6714945, 17097, 4178,  95, 150, 150, 15, 50),
  (23,'Spiderling','add',    268605, 10744,  805, 150, 150, 150, 15, 50),
  (24,'Skavag',    'boss',  7377390, 20493, 4181,  95, 200, 200, 15, 50),
  (24,'Spiderling','add',    282795, 12296,  806, 150, 200, 200, 15, 50),
  (25,'Skavag',    'boss',  7735320, 22421, 4185,  95, 200, 200, 15, 50),
  (25,'Spiderling','add',    295965, 13453,  807, 150, 200, 200, 15, 50)
) as v(stage_number, enemy_name, enemy_role, hp, atk, def, spd, res, acc, crit_rate, crit_dmg)
where d.game_id = 'raid_shadow_legends' and d.name = 'Spider''s Den'
on conflict (dungeon_id, stage_number, enemy_name) do update set
  enemy_role = excluded.enemy_role, hp = excluded.hp, atk = excluded.atk, def = excluded.def,
  spd = excluded.spd, res = excluded.res, acc = excluded.acc,
  crit_rate = excluded.crit_rate, crit_dmg = excluded.crit_dmg;
