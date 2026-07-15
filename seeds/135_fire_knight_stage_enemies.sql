-- Seed 135 — Fire Knight's Castle per-stage boss stats, Stages 1-25 (Fyro).
-- Requires migrations/2026-07-15_dungeon_stage_enemies.sql. Completes all 4 classic dungeons.
--
-- Source: in-game / stat-site enemy table (factual game data). Transcribed 2026-07-15.
-- Single boss per stage (waves are separate content). Enemy ATK/DEF match the shared
-- Spider/Dragon per-stage scaling (e.g. S19 ATK 9,980). Affinities match seed 130's FK
-- rotation on all 25 stages. RES/ACC monotonic.
--
-- NOTE: FK boss HP is much LOWER than the other dungeons — FK's difficulty is the DIVINE
-- SHIELD gate (hits-to-break 5/7/10/12 by tier, in dungeon_stages notes), not raw HP. That
-- shield is a TACTICAL GATE the power model must apply on top of this HP wall.
-- FLAGGED-BUT-REAL: HP dips at 20->21 (1,851,720 -> 1,640,640) at the Almighty-tier boundary
-- (ATK keeps climbing monotonically), mirroring the tier-reset oddities in the other tables.

insert into dungeon_stage_enemies (dungeon_id, stage_number, enemy_name, enemy_role, hp, atk, def, spd, res, acc, crit_rate, crit_dmg)
select d.id, v.* from dungeons d
cross join (values
  -- stage, name,   role,     hp,       atk,   def,  spd, res, acc, cr, cd
  ( 1,'Fyro','boss',    23805,   238,  159, 100,  30,   0, 15, 50),
  ( 2,'Fyro','boss',    27780,   278,  185, 100,  30,   0, 15, 50),
  ( 3,'Fyro','boss',    32400,   324,  216, 100,  30,   0, 15, 50),
  ( 4,'Fyro','boss',    39840,   398,  266, 100,  35,  30, 15, 50),
  ( 5,'Fyro','boss',    48780,   488,  325, 100,  35,  30, 15, 50),
  ( 6,'Fyro','boss',    61785,   618,  412, 100,  35,  30, 15, 50),
  ( 7,'Fyro','boss',    80415,   804,  536, 100,  50,  50, 15, 50),
  ( 8,'Fyro','boss',   102315,  1023,  682, 100,  50,  50, 15, 50),
  ( 9,'Fyro','boss',   135345,  1353,  902, 100,  50,  50, 15, 50),
  (10,'Fyro','boss',   177420,  1774, 1183, 100,  75,  75, 15, 50),
  (11,'Fyro','boss',   226290,  2263, 1509, 100,  75,  75, 15, 50),
  (12,'Fyro','boss',   283335,  2833, 1889, 100,  75,  75, 15, 50),
  (13,'Fyro','boss',   354765,  3548, 2365, 100, 100, 100, 15, 50),
  (14,'Fyro','boss',   424680,  4247, 2831, 100, 100, 100, 15, 50),
  (15,'Fyro','boss',   508380,  5084, 3389, 100, 100, 100, 15, 50),
  (16,'Fyro','boss',   581805,  5818, 3879, 100, 150, 150, 15, 50),
  (17,'Fyro','boss',   793950,  6965, 3993, 100, 150, 150, 15, 50),
  (18,'Fyro','boss',  1075470,  8337, 4002, 100, 150, 150, 15, 50),
  (19,'Fyro','boss',  1437105,  9980, 3992, 100, 200, 200, 15, 50),
  (20,'Fyro','boss',  1851720, 11947, 3982, 100, 200, 200, 15, 50),
  (21,'Fyro','boss',  1640640, 13672, 4102, 100, 200, 200, 15, 50),
  (22,'Fyro','boss',  1877610, 15647, 4172, 100, 200, 200, 15, 50),
  (23,'Fyro','boss',  2148780, 17907, 4178, 100, 200, 200, 15, 50),
  (24,'Fyro','boss',  2459130, 20493, 4235, 100, 200, 200, 15, 50),
  (25,'Fyro','boss',  2690550, 22421, 4335, 100, 200, 200, 15, 50)
) as v(stage_number, enemy_name, enemy_role, hp, atk, def, spd, res, acc, crit_rate, crit_dmg)
where d.game_id = 'raid_shadow_legends' and d.name = 'Fire Knight''s Castle'
on conflict (dungeon_id, stage_number, enemy_name) do update set
  enemy_role = excluded.enemy_role, hp = excluded.hp, atk = excluded.atk, def = excluded.def,
  spd = excluded.spd, res = excluded.res, acc = excluded.acc,
  crit_rate = excluded.crit_rate, crit_dmg = excluded.crit_dmg;
