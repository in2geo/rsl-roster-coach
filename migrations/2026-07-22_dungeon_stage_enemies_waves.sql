-- Wave mobs in dungeon_stage_enemies — composition, identity, level, and PROVENANCE.
--
-- WHY (Mike, 2026-07-22): the boss rows have been there since seed 131, but the WAVES — where the
-- wall actually is on Dragon — had no representation at all. Dragon held 25 rows, every one
-- enemy_role='boss'. This adds the columns the wave data needs.
--
-- THE KEY COLUMN IS `champion_id`. Dragon's wave mobs are REAL CHAMPIONS (Tayrel, Hordin,
-- Crossbowman, Apothecary…), so linking the row to champions(id) inherits their entire kit —
-- skills, cooldowns, damage multipliers, tags, affinity, passives — from data we already own.
-- Nothing about their behaviour needs authoring. (Contrast Spiderling / Klyssus Ally, which are
-- NOT champions and keep champion_id null; their kits are hand-authored in lib/sim/.)
--
-- PRIMARY KEY CHANGE IS REQUIRED, not cosmetic. The old key was
-- (dungeon_id, stage_number, enemy_name), which cannot represent:
--   * the same champion twice in one wave   — "Crossbowman x2"
--   * the same champion in BOTH waves       — Tayrel appears in wave 1 and wave 2
-- wave_number 0 means "boss phase", so existing rows keep their meaning under the new key.
--
-- PROVENANCE (source_note / verified_at) exists because its absence caused a real problem: the
-- transcribed ATK/DEF/RES ladder was indistinguishable from a fabricated one at the point of use,
-- and was mistakenly recorded in project memory as "synthetic" for a day. A stat with no source is
-- a stat nobody can trust or refute. Backfilled below for the existing rows.

alter table dungeon_stage_enemies
  add column if not exists wave_number  int  not null default 0,   -- 0 = boss phase
  add column if not exists position     int  not null default 0,   -- slot within the wave, 1..5
  add column if not exists champion_id  uuid references champions(id),
  add column if not exists enemy_level  int,                       -- READABLE IN-GAME (only stat that is)
  add column if not exists enemy_stars  int,                       -- rank changes with stage: 1* @st1 -> 6* @st16
  add column if not exists difficulty   text not null default 'Normal',
  add column if not exists source_note  text,
  add column if not exists verified_at  date;

-- allow wave rows
alter table dungeon_stage_enemies drop constraint if exists dungeon_stage_enemies_enemy_role_check;
alter table dungeon_stage_enemies add constraint dungeon_stage_enemies_enemy_role_check
  check (enemy_role in ('boss', 'add', 'minion', 'wave'));

-- widen the key so duplicates and per-wave repeats are representable
alter table dungeon_stage_enemies drop constraint if exists dungeon_stage_enemies_pkey;
alter table dungeon_stage_enemies
  add constraint dungeon_stage_enemies_pkey
  primary key (dungeon_id, stage_number, wave_number, position, enemy_name);

create index if not exists dungeon_stage_enemies_champion_idx
  on dungeon_stage_enemies (champion_id) where champion_id is not null;

-- ── backfill provenance on the pre-existing boss/add rows ────────────────────
update dungeon_stage_enemies
   set source_note = coalesce(source_note,
         'in-game / stat-site enemy table, transcribed 2026-07-15 (seeds 131-135); cross-checked: '
         'add:boss ratios constant across stages 1-20, RES/ACC identical add-to-boss, SPD per-entity constant'),
       verified_at = coalesce(verified_at, date '2026-07-15')
 where wave_number = 0;

comment on column dungeon_stage_enemies.champion_id is
  'FK to champions(id) when the enemy IS a playable champion (Dragon wave mobs). Null for unique '
  'dungeon entities (Spiderling, Klyssus Ally, bosses), whose kits are authored in lib/sim/.';
comment on column dungeon_stage_enemies.enemy_level is
  'Enemy level, the ONLY enemy stat readable in-game. Stats scale off (level, stars); HP/ATK/DEF '
  'move in lockstep below ~level 200, above which DEF plateaus while ATK keeps climbing.';
comment on column dungeon_stage_enemies.source_note is
  'Where this row came from and how it was checked. Rows without provenance must be treated as '
  'unverified — see the 2026-07-22 incident where transcribed data was mistaken for fabricated.';
