-- 26 — clan_boss_chest_tiers: damage→chest thresholds for all six CB difficulties.
-- Source: in-game rewards-screen screenshots, July 2026 (re-verify if Plarium
-- rebalances CB rewards). Idempotent via ON CONFLICT on (dungeon_stage_id, sort_order).

-- EASY
insert into clan_boss_chest_tiers
  (dungeon_stage_id, chest_name, sort_order, damage_min, damage_max, source_citation)
select ds.id, t.chest_name, t.sort_order, t.damage_min, t.damage_max,
  'In-game rewards screen screenshot — Easy difficulty, July 2026'
from dungeon_stages ds
join dungeons d on d.id = ds.dungeon_id
cross join (values
  ('Novice',  1, 285320,   380430),
  ('Novice',  2, 380430,   760850),
  ('Adept',   3, 760850,  1150000),
  ('Warrior', 4, 1150000, null)
) as t(chest_name, sort_order, damage_min, damage_max)
where d.name = 'Clan Boss' and ds.label = 'Easy'
on conflict (dungeon_stage_id, sort_order) do nothing;

-- NORMAL
insert into clan_boss_chest_tiers
  (dungeon_stage_id, chest_name, sort_order, damage_min, damage_max, source_citation)
select ds.id, t.chest_name, t.sort_order, t.damage_min, t.damage_max,
  'In-game rewards screen screenshot — Normal difficulty, July 2026'
from dungeon_stages ds
join dungeons d on d.id = ds.dungeon_id
cross join (values
  ('Adept',   1,  909260,  1220000),
  ('Adept',   2, 1220000,  2430000),
  ('Warrior', 3, 2430000,  3640000),
  ('Knight',  4, 3640000,  null)
) as t(chest_name, sort_order, damage_min, damage_max)
where d.name = 'Clan Boss' and ds.label = 'Normal'
on conflict (dungeon_stage_id, sort_order) do nothing;

-- HARD
insert into clan_boss_chest_tiers
  (dungeon_stage_id, chest_name, sort_order, damage_min, damage_max, source_citation)
select ds.id, t.chest_name, t.sort_order, t.damage_min, t.damage_max,
  'In-game rewards screen screenshot — Hard difficulty, July 2026'
from dungeon_stages ds
join dungeons d on d.id = ds.dungeon_id
cross join (values
  ('Warrior',  1,  2920000,  3890000),
  ('Warrior',  2,  3890000,  7770000),
  ('Knight',   3,  7770000, 11650000),
  ('Guardian', 4, 11650000,  null)
) as t(chest_name, sort_order, damage_min, damage_max)
where d.name = 'Clan Boss' and ds.label = 'Hard'
on conflict (dungeon_stage_id, sort_order) do nothing;

-- BRUTAL
insert into clan_boss_chest_tiers
  (dungeon_stage_id, chest_name, sort_order, damage_min, damage_max, source_citation)
select ds.id, t.chest_name, t.sort_order, t.damage_min, t.damage_max,
  'In-game rewards screen screenshot — Brutal difficulty, July 2026'
from dungeon_stages ds
join dungeons d on d.id = ds.dungeon_id
cross join (values
  ('Knight',      1,  5430000,  7240000),
  ('Guardian',    2,  7240000, 14470000),
  ('Master',      3, 14470000, 21700000),
  ('Grandmaster', 4, 21700000,  null)
) as t(chest_name, sort_order, damage_min, damage_max)
where d.name = 'Clan Boss' and ds.label = 'Brutal'
on conflict (dungeon_stage_id, sort_order) do nothing;

-- NIGHTMARE
insert into clan_boss_chest_tiers
  (dungeon_stage_id, chest_name, sort_order, damage_min, damage_max, source_citation)
select ds.id, t.chest_name, t.sort_order, t.damage_min, t.damage_max,
  'In-game rewards screen screenshot — Nightmare difficulty, July 2026'
from dungeon_stages ds
join dungeons d on d.id = ds.dungeon_id
cross join (values
  ('Guardian',    1,  9800000, 13060000),
  ('Master',      2, 13060000, 26120000),
  ('Grandmaster', 3, 26120000, 39170000),
  ('Ultimate',    4, 39170000,  null)
) as t(chest_name, sort_order, damage_min, damage_max)
where d.name = 'Clan Boss' and ds.label = 'Nightmare'
on conflict (dungeon_stage_id, sort_order) do nothing;

-- ULTRA NIGHTMARE
insert into clan_boss_chest_tiers
  (dungeon_stage_id, chest_name, sort_order, damage_min, damage_max, source_citation)
select ds.id, t.chest_name, t.sort_order, t.damage_min, t.damage_max,
  'In-game rewards screen screenshot — UNM difficulty, July 2026'
from dungeon_stages ds
join dungeons d on d.id = ds.dungeon_id
cross join (values
  ('Mythical',     1, 17570000, 23430000),
  ('Divine',       2, 23430000, 46850000),
  ('Celestial',    3, 46850000, 70280000),
  ('Transcendent', 4, 70280000,  null)
) as t(chest_name, sort_order, damage_min, damage_max)
where d.name = 'Clan Boss' and ds.label = 'Ultra Nightmare'
on conflict (dungeon_stage_id, sort_order) do nothing;
