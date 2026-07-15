-- Seed 131 — Spider's Den per-stage enemy stats, Stages 1-15 (Skavag + Spiderling).
-- Requires migrations/2026-07-15_dungeon_stage_enemies.sql.
--
-- Source: in-game / stat-site enemy table (factual game data). Transcribed 2026-07-15.
-- Cross-checks that validate the transcription: Spiderling ≈ Skavag ×0.04 HP / ×0.6 ATK /
-- ×0.2 DEF on every row; SPD (Skavag 95 / Spiderling 150), CR 15, CD 50 constant; RES/ACC
-- step in tiers (RES 30/35/50/75/100, ACC 0/30/50/75/100) matching the affinity/stage tiers.
-- Stages 16-25 pending a second capture.

insert into dungeon_stage_enemies (dungeon_id, stage_number, enemy_name, enemy_role, hp, atk, def, spd, res, acc, crit_rate, crit_dmg)
select d.id, v.* from dungeons d
cross join (values
  -- stage, name,          role,    hp,       atk,  def,  spd, res, acc, cr, cd
  ( 1,'Skavag',    'boss',    71430,  238,  159,  95,  30,   0, 15, 50),
  ( 1,'Spiderling','add',      2850,  143,   32, 150,  30,   0, 15, 50),
  ( 2,'Skavag',    'boss',    83325,  278,  185,  95,  30,   0, 15, 50),
  ( 2,'Spiderling','add',      3330,  167,   37, 150,  30,   0, 15, 50),
  ( 3,'Skavag',    'boss',    97200,  324,  216,  95,  30,   0, 15, 50),
  ( 3,'Spiderling','add',      3885,  194,   43, 150,  30,   0, 15, 50),
  ( 4,'Skavag',    'boss',   119505,  398,  266,  95,  35,  30, 15, 50),
  ( 4,'Spiderling','add',      4785,  239,   53, 150,  35,  30, 15, 50),
  ( 5,'Skavag',    'boss',   146355,  488,  325,  95,  35,  30, 15, 50),
  ( 5,'Spiderling','add',      5850,  293,   65, 150,  35,  30, 15, 50),
  ( 6,'Skavag',    'boss',   185370,  618,  412,  95,  35,  30, 15, 50),
  ( 6,'Spiderling','add',      7410,  371,   82, 150,  35,  30, 15, 50),
  ( 7,'Skavag',    'boss',   241260,  804,  536,  95,  50,  50, 15, 50),
  ( 7,'Spiderling','add',      9645,  483,  107, 150,  50,  50, 15, 50),
  ( 8,'Skavag',    'boss',   306960, 1023,  682,  95,  50,  50, 15, 50),
  ( 8,'Spiderling','add',     12285,  614,  136, 150,  50,  50, 15, 50),
  ( 9,'Skavag',    'boss',   406035, 1353,  902,  95,  50,  50, 15, 50),
  ( 9,'Spiderling','add',     16245,  812,  180, 150,  50,  50, 15, 50),
  (10,'Skavag',    'boss',   532275, 1774, 1183,  95,  75,  75, 15, 50),
  (10,'Spiderling','add',     21285, 1065,  237, 150,  75,  75, 15, 50),
  (11,'Skavag',    'boss',   678855, 2263, 1509,  95,  75,  75, 15, 50),
  (11,'Spiderling','add',     27150, 1358,  302, 150,  75,  75, 15, 50),
  (12,'Skavag',    'boss',   850005, 2833, 1889,  95,  75,  75, 15, 50),
  (12,'Spiderling','add',     34005, 1700,  378, 150,  75,  75, 15, 50),
  (13,'Skavag',    'boss',  1064310, 3548, 2365,  95, 100, 100, 15, 50),
  (13,'Spiderling','add',     42570, 2129,  473, 150, 100, 100, 15, 50),
  (14,'Skavag',    'boss',  1275055, 4247, 2831,  95, 100, 100, 15, 50),
  (14,'Spiderling','add',     50955, 2548,  566, 150, 100, 100, 15, 50),
  (15,'Skavag',    'boss',  1525125, 5084, 3389,  95, 100, 100, 15, 50),
  (15,'Spiderling','add',     61005, 3050,  678, 150, 100, 100, 15, 50)
) as v(stage_number, enemy_name, enemy_role, hp, atk, def, spd, res, acc, crit_rate, crit_dmg)
where d.game_id = 'raid_shadow_legends' and d.name = 'Spider''s Den'
on conflict (dungeon_id, stage_number, enemy_name) do update set
  enemy_role = excluded.enemy_role, hp = excluded.hp, atk = excluded.atk, def = excluded.def,
  spd = excluded.spd, res = excluded.res, acc = excluded.acc,
  crit_rate = excluded.crit_rate, crit_dmg = excluded.crit_dmg;
