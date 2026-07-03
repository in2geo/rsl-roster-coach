-- 35 — Dragon's Lair Chunk 4: stat threshold checks + boss exceptions (stages 10-20).
-- NOT EXISTS guards added for idempotency (no unique keys on these tables).

-- ACC floor stages 10-14 (directional, judgment call)
insert into stat_threshold_checks
  (phase_id, goal_id, stat, comparison, formula, notes)
select p.id, null, 'acc', 'formula', '150',
  'Stages 10-14: ACC 150+ recommended. JUDGMENT CALL — Dragon boss RES
   scales with stage. Stage 20 confirmed 200 RES (target 225 ACC per
   HellHades). Stages 10-14 have lower RES — 150 is a directional floor,
   not confirmed from primary source. Calibrate down from battle log data
   once Dragon clears are captured.'
from phases p
join dungeon_stages ds on ds.id = p.dungeon_stage_id
join dungeons d on d.id = ds.dungeon_id
where d.name = 'Dragon''s Lair'
and ds.label in ('Stage 10','Stage 11','Stage 12','Stage 13','Stage 14')
and p.phase_type = 'boss'
and not exists (select 1 from stat_threshold_checks x where x.phase_id = p.id and x.stat = 'acc');

-- ACC floor stages 15-20 (confirmed from HellHades + forum)
insert into stat_threshold_checks
  (phase_id, goal_id, stat, comparison, formula, notes)
select p.id, null, 'acc', 'formula', '225',
  'Stages 15-20: ACC 225+ recommended. Dragon 20 confirmed 200 RES
   (HellHades: "target about 225 ACC" — hellhades.com). Forum data
   confirms 200 minimum, 230-250 ideal at stage 20. Using 225 as the
   calibrated floor. Source: HellHades HP Burn guide (April 2026) +
   Plarium forum stage 20 progression thread.'
from phases p
join dungeon_stages ds on ds.id = p.dungeon_stage_id
join dungeons d on d.id = ds.dungeon_id
where d.name = 'Dragon''s Lair'
and ds.label in ('Stage 15','Stage 16','Stage 17','Stage 18','Stage 19','Stage 20')
and p.phase_type = 'boss'
and not exists (select 1 from stat_threshold_checks x where x.phase_id = p.id and x.stat = 'acc');

-- SPD floor stages 15-20
insert into stat_threshold_checks
  (phase_id, goal_id, stat, comparison, formula, notes)
select p.id, null, 'spd', 'relative_to_enemy', null,
  'Stages 15-20: 170+ SPD recommended to lap the boss and waves.
   Source: Plarium forum stage 20 progression thread ("speed ranges
   we are referring to would be the 200 speed mark" for optimal;
   170 is the entry floor). JUDGMENT CALL — directional only.
   Calibrate from battle log data.'
from phases p
join dungeon_stages ds on ds.id = p.dungeon_stage_id
join dungeons d on d.id = ds.dungeon_id
where d.name = 'Dragon''s Lair'
and ds.label in ('Stage 15','Stage 16','Stage 17','Stage 18','Stage 19','Stage 20')
and p.phase_type = 'boss'
and not exists (select 1 from stat_threshold_checks x where x.phase_id = p.id and x.stat = 'spd');

-- Boss exceptions
insert into boss_exceptions (dungeon_stage_id, description, source_citation)
select ds.id, e.e_desc,
  'AyumiLove Dragon guide + empyreanrule.com + HellHades + Plarium forum (confirmed July 2026)'
from dungeon_stages ds
join dungeons d on d.id = ds.dungeon_id
join (values
  ('Stage 10',
   'Magic affinity. Scorch mechanic active from stage 7: Inhale sets all team TM to 50%, team gets one attack before Scorch fires (massive DEF-ignoring AoE + unresistable Stun). Dragon is immune to Decrease Turn Meter and Decrease SPD. Poison and HP Burn bypass the Scorch window and deal consistent damage every turn — the recommended damage approach for this stage range. Stage 21+ passives (Almighty Strength, Almighty Persistence) do NOT apply here.'),
  ('Stage 11',
   'Spirit affinity. All Stage 10 mechanics apply. No affinity disadvantage for Magic champions.'),
  ('Stage 12',
   'Force affinity. All Stage 10 mechanics apply. Void champions neutral, non-Force champions no bonus.'),
  ('Stage 13',
   'Void affinity. No affinity penalty for any champion — good benchmark stage for testing team compositions before affinity-disadvantage stages.'),
  ('Stage 14',
   'Magic affinity. All Stage 10 mechanics apply. Last stage before ACC floor increases meaningfully.'),
  ('Stage 15',
   'Spirit affinity. ACC floor increases at this tier — 150 ACC that was sufficient at stages 10-14 may no longer reliably land debuffs. Recommend verifying ACC before enabling auto-farm.'),
  ('Stage 16',
   'Force affinity. All Stage 15 mechanics apply.'),
  ('Stage 17',
   'Void affinity. No affinity penalty. Good benchmark for testing whether a team is ready for stages 18-20.'),
  ('Stage 18',
   'Magic affinity. Hellrazor HP and stats scale significantly. Decrease DEF and Weaken become more important to reliably clear the Scorch bar. Teams that cleared stage 15-17 on raw Poison stacking may need debuff amplifiers here.'),
  ('Stage 19',
   'Spirit affinity. All Stage 18 mechanics apply.'),
  ('Stage 20',
   'Force affinity. Primary farming stage for Speed, Accuracy, and Lifesteal gear. Dragon confirmed 200 RES — ACC 225+ required to land debuffs reliably (HellHades confirmed). Stage 21+ passives (Almighty Strength: HP-scaling damage capped at 10% boss Max HP; Almighty Persistence: TM reduction 50% less effective) do NOT apply here — Coldheart, HP-scalers, and TM reduction champions work normally at stage 20 but will underperform at stage 21+.')
) as e(e_stage_lbl, e_desc) on ds.label = e.e_stage_lbl
where d.name = 'Dragon''s Lair'
and not exists (select 1 from boss_exceptions x where x.dungeon_stage_id = ds.id and x.description = e.e_desc);
