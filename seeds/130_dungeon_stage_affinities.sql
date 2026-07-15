-- Seed 130 — per-stage boss affinity for the four classic dungeons (100 rows).
-- Requires migrations/2026-07-15_dungeon_stage_affinities.sql (table dungeon_stage_affinities).
--
-- Source of truth: the affinity rotations captured when each dungeon was modeled and
-- corrected 2026-07-07 from the in-game stage list. Reconciled here into queryable form
-- (previously orphaned in dungeon_stages.notes prose + a Spider SQL comment). Cross-checked
-- against DonBrogni live runs: Spider 11 = Force (Magic champs weak → near loss); 13 = Void
-- (neutral → the slow clear was difficulty, not affinity). Rotation is irregular at 20-25.
--
-- Void = neutral to every affinity (no advantage or penalty either direction).
-- One INSERT per dungeon; each resolves dungeon_id by name and enumerates 25 stages.

-- Spider's Den
insert into dungeon_stage_affinities (dungeon_id, stage_number, affinity)
select d.id, v.stage, v.aff from dungeons d
cross join (values
  (1,'Void'),(2,'Magic'),(3,'Force'),(4,'Spirit'),(5,'Void'),(6,'Magic'),(7,'Force'),(8,'Spirit'),
  (9,'Void'),(10,'Magic'),(11,'Force'),(12,'Spirit'),(13,'Void'),(14,'Magic'),(15,'Force'),(16,'Spirit'),
  (17,'Void'),(18,'Magic'),(19,'Force'),(20,'Spirit'),(21,'Void'),(22,'Magic'),(23,'Force'),(24,'Spirit'),(25,'Magic')
) as v(stage, aff)
where d.game_id = 'raid_shadow_legends' and d.name = 'Spider''s Den'
on conflict (dungeon_id, stage_number) do update set affinity = excluded.affinity;

-- Dragon's Lair
insert into dungeon_stage_affinities (dungeon_id, stage_number, affinity)
select d.id, v.stage, v.aff from dungeons d
cross join (values
  (1,'Magic'),(2,'Force'),(3,'Spirit'),(4,'Void'),(5,'Magic'),(6,'Force'),(7,'Spirit'),(8,'Void'),
  (9,'Magic'),(10,'Force'),(11,'Spirit'),(12,'Void'),(13,'Magic'),(14,'Force'),(15,'Spirit'),(16,'Void'),
  (17,'Magic'),(18,'Force'),(19,'Spirit'),(20,'Magic'),(21,'Force'),(22,'Magic'),(23,'Void'),(24,'Spirit'),(25,'Force')
) as v(stage, aff)
where d.game_id = 'raid_shadow_legends' and d.name = 'Dragon''s Lair'
on conflict (dungeon_id, stage_number) do update set affinity = excluded.affinity;

-- Ice Golem's Peak
insert into dungeon_stage_affinities (dungeon_id, stage_number, affinity)
select d.id, v.stage, v.aff from dungeons d
cross join (values
  (1,'Spirit'),(2,'Magic'),(3,'Force'),(4,'Void'),(5,'Spirit'),(6,'Magic'),(7,'Force'),(8,'Void'),
  (9,'Spirit'),(10,'Magic'),(11,'Force'),(12,'Void'),(13,'Spirit'),(14,'Magic'),(15,'Force'),(16,'Void'),
  (17,'Spirit'),(18,'Magic'),(19,'Force'),(20,'Spirit'),(21,'Magic'),(22,'Void'),(23,'Force'),(24,'Spirit'),(25,'Magic')
) as v(stage, aff)
where d.game_id = 'raid_shadow_legends' and d.name = 'Ice Golem''s Peak'
on conflict (dungeon_id, stage_number) do update set affinity = excluded.affinity;

-- Fire Knight's Castle
insert into dungeon_stage_affinities (dungeon_id, stage_number, affinity)
select d.id, v.stage, v.aff from dungeons d
cross join (values
  (1,'Force'),(2,'Spirit'),(3,'Magic'),(4,'Void'),(5,'Force'),(6,'Spirit'),(7,'Magic'),(8,'Void'),
  (9,'Force'),(10,'Spirit'),(11,'Magic'),(12,'Void'),(13,'Force'),(14,'Spirit'),(15,'Magic'),(16,'Void'),
  (17,'Force'),(18,'Spirit'),(19,'Magic'),(20,'Force'),(21,'Spirit'),(22,'Magic'),(23,'Void'),(24,'Force'),(25,'Spirit')
) as v(stage, aff)
where d.game_id = 'raid_shadow_legends' and d.name = 'Fire Knight''s Castle'
on conflict (dungeon_id, stage_number) do update set affinity = excluded.affinity;
