-- Seed 134 — Ice Golem's Peak per-stage enemy stats, Stages 1-25 (Klyssus + Klyssus Ally).
-- Requires migrations/2026-07-15_dungeon_stage_enemies.sql.
--
-- Source: in-game / stat-site enemy table (factual game data). Transcribed 2026-07-15.
-- Klyssus = boss; Klyssus Ally = the revive-minion (enemy_role 'minion'; IG's Frigid
-- Vengeance revives these, so they are modeled as minions not generic adds). Ally SPD read
-- as 105 (source showed "105/8" — treated the trailing "/8" as a display artifact).
--
-- Stage 21 affinity CONFIRMED Magic (in-game stage-select screenshot, 2026-07-15) — seed 130
-- was correct; an earlier misread of the compressed enemy-stat icon suggested Void. No change.
-- IG has its own ATK curve (lower than Spider/Dragon at low stages; converges up top).

insert into dungeon_stage_enemies (dungeon_id, stage_number, enemy_name, enemy_role, hp, atk, def, spd, res, acc, crit_rate, crit_dmg)
select d.id, v.* from dungeons d
cross join (values
  -- stage, name,           role,      hp,       atk,   def,  spd, res, acc, cr, cd
  ( 1,'Klyssus',    'boss',    20145,   204,  136,  90,  30,   0, 15, 50),
  ( 1,'Klyssus Ally','minion',  4080,    68,   68, 105,  30,   0, 15, 50),
  ( 2,'Klyssus',    'boss',    23805,   238,  159,  90,  30,   0, 15, 50),
  ( 2,'Klyssus Ally','minion',  4755,    79,   79, 105,  30,   0, 15, 50),
  ( 3,'Klyssus',    'boss',    27780,   278,  185,  90,  30,   0, 15, 50),
  ( 3,'Klyssus Ally','minion',  5550,    93,   93, 105,  30,   0, 15, 50),
  ( 4,'Klyssus',    'boss',    33645,   336,  224,  90,  35,  30, 15, 50),
  ( 4,'Klyssus Ally','minion',  6735,   112,  112, 105,  35,  30, 15, 50),
  ( 5,'Klyssus',    'boss',    39840,   398,  266,  90,  35,  30, 15, 50),
  ( 5,'Klyssus Ally','minion',  7965,   133,  133, 105,  35,  30, 15, 50),
  ( 6,'Klyssus',    'boss',    55830,   558,  372,  90,  35,  30, 15, 50),
  ( 6,'Klyssus Ally','minion', 11160,   186,  186, 105,  35,  30, 15, 50),
  ( 7,'Klyssus',    'boss',    61785,   618,  412,  90,  50,  50, 15, 50),
  ( 7,'Klyssus Ally','minion', 12360,   206,  206, 105,  50,  50, 15, 50),
  ( 8,'Klyssus',    'boss',    89310,   893,  595,  90,  50,  50, 15, 50),
  ( 8,'Klyssus Ally','minion', 17865,   298,  298, 105,  50,  50, 15, 50),
  ( 9,'Klyssus',    'boss',   121455,  1215,  810,  90,  50,  50, 15, 50),
  ( 9,'Klyssus Ally','minion', 24285,   405,  405, 105,  50,  50, 15, 50),
  (10,'Klyssus',    'boss',   135345,  1353,  902,  90,  75,  75, 15, 50),
  (10,'Klyssus Ally','minion', 27075,   451,  451, 105,  75,  75, 15, 50),
  (11,'Klyssus',    'boss',   206820,  2068, 1379,  90,  75,  75, 15, 50),
  (11,'Klyssus Ally','minion', 41370,   689,  689, 105,  75,  75, 15, 50),
  (12,'Klyssus',    'boss',   226290,  2263, 1509,  90,  75,  75, 15, 50),
  (12,'Klyssus Ally','minion', 45255,   754,  754, 105,  75,  75, 15, 50),
  (13,'Klyssus',    'boss',   283335,  2833, 1889,  90, 100, 100, 15, 50),
  (13,'Klyssus Ally','minion', 56670,   944,  944, 105, 100, 100, 15, 50),
  (14,'Klyssus',    'boss',   354765,  3548, 2365,  90, 100, 100, 15, 50),
  (14,'Klyssus Ally','minion', 70950,  1183, 1183, 105, 100, 100, 15, 50),
  (15,'Klyssus',    'boss',   424680,  4247, 2831,  90, 100, 100, 15, 50),
  (15,'Klyssus Ally','minion', 84930,  1416, 1416, 105, 100, 100, 15, 50),
  (16,'Klyssus',    'boss',   508380,  5084, 3389,  90, 150, 150, 15, 50),
  (16,'Klyssus Ally','minion',101670,  1695, 1695, 105, 150, 150, 15, 50),
  (17,'Klyssus',    'boss',   680700,  5818, 3258,  90, 150, 150, 15, 50),
  (17,'Klyssus Ally','minion',136140,  1939, 1629, 105, 150, 150, 15, 50),
  (18,'Klyssus',    'boss',   947175,  6965, 3250,  90, 150, 150, 15, 50),
  (18,'Klyssus Ally','minion',189435,  2322, 1625, 105, 150, 150, 15, 50),
  (19,'Klyssus',    'boss',  1292235,  8337, 3224,  90, 200, 200, 15, 50),
  (19,'Klyssus Ally','minion',258450,  2779, 1612, 105, 200, 200, 15, 50),
  (20,'Klyssus',    'boss',  1716540,  9980, 3260,  90, 200, 200, 15, 50),
  (20,'Klyssus Ally','minion',343305,  3327, 1630, 105, 200, 200, 15, 50),
  (21,'Klyssus',    'boss',  1982445, 13672, 3372,  90, 200, 200, 15, 50),
  (21,'Klyssus Ally','minion',470325,  4557, 2233, 105, 200, 200, 15, 50),
  (22,'Klyssus',    'boss',  2268765, 15647, 3442,  90, 200, 200, 15, 50),
  (22,'Klyssus Ally','minion',538245,  5216, 2556, 105, 200, 200, 15, 50),
  (23,'Klyssus',    'boss',  2614350, 17907, 3581,  90, 200, 200, 15, 50),
  (23,'Klyssus Ally','minion',615990,  5969, 2925, 105, 200, 200, 15, 50),
  (24,'Klyssus',    'boss',  2991945, 20493, 3689,  90, 200, 200, 15, 50),
  (24,'Klyssus Ally','minion',704955,  6831, 3347, 105, 200, 200, 15, 50),
  (25,'Klyssus',    'boss',  3363180, 22421, 3737,  90, 200, 200, 15, 50),
  (25,'Klyssus Ally','minion',771285,  7474, 3662, 105, 200, 200, 15, 50)
) as v(stage_number, enemy_name, enemy_role, hp, atk, def, spd, res, acc, crit_rate, crit_dmg)
where d.game_id = 'raid_shadow_legends' and d.name = 'Ice Golem''s Peak'
on conflict (dungeon_id, stage_number, enemy_name) do update set
  enemy_role = excluded.enemy_role, hp = excluded.hp, atk = excluded.atk, def = excluded.def,
  spd = excluded.spd, res = excluded.res, acc = excluded.acc,
  crit_rate = excluded.crit_rate, crit_dmg = excluded.crit_dmg;
