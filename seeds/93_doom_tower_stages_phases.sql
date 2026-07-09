-- seeds/45_doom_tower_stages_phases.sql
-- Doom Tower — Chunk 2: boss-floor dungeon_stages + boss phases.
-- Structure (from in-game, 2026-07-06): 120 floors; a boss on every 10th floor
-- (10,20,...,120); Floor 120 = the month's MASTER rotation boss. 108 standard floors are
-- wave battles (3 rounds) — not modeled individually (trivial clears; skipped per scope).
-- Two difficulties as SEPARATE labeled stages: Normal (enemy lvl ~150-180) and Hard
-- (~250-350, sharply higher SPD/RES/ACC). 12 secret rooms exist (Silver Keys, rarity/
-- faction-restricted) — modeled later as their own stages.
-- Rotation: 4 bosses per rotation cycle fill the 12 boss floors; affinities shift per
-- rotation. Boss-SPECIFIC goals/mechanics are seeded per rotation in later chunks — this
-- chunk lays only the floor/difficulty frame + a generic boss phase per floor.
-- Idempotent (NOT EXISTS / ON CONFLICT DO NOTHING).

-- 12 boss floors x 2 difficulties = 24 stages
insert into dungeon_stages (dungeon_id, stage_number, label, notes)
select d.id, f.floor, 'Floor ' || f.floor || ' (' || diff.name || ')',
       'Boss floor ' || f.floor || '. ' || diff.note
       || case when f.floor = 120 then ' Floor 120 hosts the MASTER rotation boss that sets the month''s tower theme.' else '' end
from dungeons d
cross join (values (10),(20),(30),(40),(50),(60),(70),(80),(90),(100),(110),(120)) as f(floor)
cross join (values
  ('Normal', 'Normal difficulty — enemy levels ~150-180.'),
  ('Hard',   'Hard difficulty — enemy levels ~250-350 with sharply higher SPD, RES, and ACC. High ACC/SPD and strong sustain required, especially floors 100-120.')
) as diff(name, note)
where d.name = 'Doom Tower' and d.game_id = 'raid_shadow_legends'
on conflict (dungeon_id, label) do nothing;

-- one 'boss' phase per boss floor (boss identity is rotation-dependent — filled per rotation)
insert into phases (dungeon_stage_id, phase_type, notes)
select ds.id, 'boss',
  'Boss floor. The boss occupying this floor depends on the current monthly rotation '
  || '(4 bosses per rotation across the 12 boss floors; affinities shift each rotation). '
  || 'Floor 120 is the master rotation boss. Preview the map to see which boss governs each '
  || 'floor and gear/mastery accordingly (cleanse, shield, provoke, etc.). '
  || 'Boss-specific goals + boss_exceptions are seeded per rotation/boss in later chunks.'
from dungeon_stages ds
join dungeons d on d.id = ds.dungeon_id
where d.name = 'Doom Tower' and d.game_id = 'raid_shadow_legends'
  and ds.label like 'Floor %'
on conflict (dungeon_stage_id, phase_type) do nothing;
