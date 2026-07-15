-- Per-stage ENEMY STATS (boss + adds) — the real stage-difficulty data the power layer needs.
--
-- WHY: dungeon difficulty was only ever expressed as placeholder stat FLOORS
-- (stat_threshold_checks, "JUDGMENT CALLS — source table is an image"). The actual enemy
-- stats — boss HP (the kill-speed wall), enemy ATK/crit (incoming damage), enemy RES (what
-- your ACC must beat to land debuffs), enemy DEF (your attack mitigation) — were never
-- captured. This table holds them, so the power model can compute turns-to-kill and
-- turns-survived against real numbers instead of proxies. See knowledge/POWER_LAYER_SCOPE.md.
--
-- Factual game data (enemy stat table), permitted under the data-sourcing rules. Keyed by
-- (dungeon, stage_number, enemy_name) so bosses and adds are separate rows and it lines up
-- with dungeon_stage_affinities. Seeded per dungeon as stat tables are captured (Spider 1-15
-- first, seeds/131).
create table if not exists dungeon_stage_enemies (
  dungeon_id  uuid not null references dungeons(id) on delete cascade,
  stage_number int not null,
  enemy_name  text not null,               -- 'Skavag', 'Spiderling'
  enemy_role  text not null check (enemy_role in ('boss', 'add', 'minion')),
  hp   int, atk int, def int, spd int,
  res  int, acc int,
  crit_rate int, crit_dmg int,
  primary key (dungeon_id, stage_number, enemy_name)
);

comment on table dungeon_stage_enemies is
  'Real per-stage enemy stats (boss + adds). Feeds the power model: HP = kill-speed wall, '
  'ATK+crit = incoming damage, RES = your ACC-to-land target (replaces placeholder ACC floors), '
  'DEF = your attack mitigation. Factual game data. Seeded per dungeon as captured.';
