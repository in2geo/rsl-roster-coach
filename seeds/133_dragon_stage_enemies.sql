-- Seed 133 — Dragon's Lair per-stage boss stats, Stages 1-25 (Hellrazor).
-- Requires migrations/2026-07-15_dungeon_stage_enemies.sql.
--
-- Source: in-game / stat-site enemy table (factual game data). Transcribed 2026-07-15.
-- Single boss per stage (no adds in this table; wave mobs are separate content).
-- Cross-checks: enemy ATK/DEF match Spider Skavag's per-stage values exactly (shared
-- scaling) — which CONFIRMED the correct Stage-19 ATK is 9,980 (Spider's table had a
-- glitched 5,988 there; fixed in seed 132). Affinity icons match seed 130's Dragon
-- rotation on all 25 stages incl. the irregular top (21 Force/22 Magic/23 Void/24 Spirit/
-- 25 Force). RES/ACC here is MONOTONIC (unlike Spider's 21-23 dip).

insert into dungeon_stage_enemies (dungeon_id, stage_number, enemy_name, enemy_role, hp, atk, def, spd, res, acc, crit_rate, crit_dmg)
select d.id, v.* from dungeons d
cross join (values
  -- stage, name,       role,     hp,       atk,   def,  spd, res, acc, cr, cd
  ( 1,'Hellrazor','boss',    29760,   238,  159, 100,  30,   0, 15, 50),
  ( 2,'Hellrazor','boss',    34725,   278,  185, 100,  30,   0, 15, 50),
  ( 3,'Hellrazor','boss',    40500,   324,  216, 100,  30,   0, 15, 50),
  ( 4,'Hellrazor','boss',    49800,   398,  266, 100,  35,  30, 15, 50),
  ( 5,'Hellrazor','boss',    60990,   488,  325, 100,  35,  30, 15, 50),
  ( 6,'Hellrazor','boss',    77235,   618,  412, 100,  35,  30, 15, 50),
  ( 7,'Hellrazor','boss',   100515,   804,  536, 100,  50,  50, 15, 50),
  ( 8,'Hellrazor','boss',   127905,  1023,  682, 100,  50,  50, 15, 50),
  ( 9,'Hellrazor','boss',   169185,  1353,  902, 100,  50,  50, 15, 50),
  (10,'Hellrazor','boss',   221775,  1774, 1183, 100,  75,  75, 15, 50),
  (11,'Hellrazor','boss',   282855,  2263, 1509, 100,  75,  75, 15, 50),
  (12,'Hellrazor','boss',   354165,  2833, 1889, 100,  75,  75, 15, 50),
  (13,'Hellrazor','boss',   443460,  3548, 2365, 100, 100, 100, 15, 50),
  (14,'Hellrazor','boss',   530850,  4247, 2831, 100, 100, 100, 15, 50),
  (15,'Hellrazor','boss',   635460,  5084, 3389, 100, 100, 100, 15, 50),
  (16,'Hellrazor','boss',   727245,  5818, 3879, 100, 150, 150, 15, 50),
  (17,'Hellrazor','boss',   992445,  6965, 3993, 100, 150, 150, 15, 50),
  (18,'Hellrazor','boss',  1344345,  8337, 4002, 100, 150, 150, 15, 50),
  (19,'Hellrazor','boss',  1796385,  9980, 3992, 100, 200, 200, 15, 50),
  (20,'Hellrazor','boss',  2314665, 11947, 3982, 100, 200, 200, 15, 50),
  (21,'Hellrazor','boss',  2648955, 13672, 4102, 100, 200, 200, 15, 50),
  (22,'Hellrazor','boss',  3031545, 15947, 4172, 100, 200, 200, 15, 50),
  (23,'Hellrazor','boss',  3469395, 17907, 4178, 100, 200, 200, 15, 50),
  (24,'Hellrazor','boss',  3970470, 20493, 4099, 100, 200, 200, 15, 50),
  (25,'Hellrazor','boss',  4344105, 22421, 4484, 100, 200, 200, 15, 50)
) as v(stage_number, enemy_name, enemy_role, hp, atk, def, spd, res, acc, crit_rate, crit_dmg)
where d.game_id = 'raid_shadow_legends' and d.name = 'Dragon''s Lair'
on conflict (dungeon_id, stage_number, enemy_name) do update set
  enemy_role = excluded.enemy_role, hp = excluded.hp, atk = excluded.atk, def = excluded.def,
  spd = excluded.spd, res = excluded.res, acc = excluded.acc,
  crit_rate = excluded.crit_rate, crit_dmg = excluded.crit_dmg;
