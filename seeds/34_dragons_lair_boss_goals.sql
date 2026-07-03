-- 34 — Dragon's Lair Chunk 3: boss phase goals + solutions (stages 10-20).
--
-- NOT EXISTS guards added for idempotency (goals/goal_solutions have no unique key).
-- Solutions are LABEL-ONLY (tags come in a later chunk) → tagless + proposed, so the
-- engine ignores them until they're tagged and approved. One informational goal (Dragon
-- immune to Decrease TM / Decrease SPD) carries no solutions by design.

insert into goals (phase_id, description, is_informational)
select p.id, g.g_desc, g.g_info
from phases p
join dungeon_stages ds on ds.id = p.dungeon_stage_id
join dungeons d on d.id = ds.dungeon_id
cross join (values
  ('Deal enough damage to clear the Scorch bar before Hellrazor acts — failure means unresistable team Stun and massive DEF-ignoring damage.', false),
  ('Survive Hellrazor''s debuffs — he applies Decrease ATK, Poison, and Weaken to your team each round.', false),
  ('Apply Decrease Defense and Weaken to Hellrazor to amplify damage in the Scorch window.', false),
  ('Dragon is immune to Decrease Turn Meter and Decrease SPD — do not bring champions whose only value is boss TM control.', true)
) as g(g_desc, g_info)
where d.name = 'Dragon''s Lair'
and ds.label in (
  'Stage 10','Stage 11','Stage 12','Stage 13','Stage 14',
  'Stage 15','Stage 16','Stage 17','Stage 18','Stage 19','Stage 20'
)
and p.phase_type = 'boss'
and not exists (select 1 from goals x where x.phase_id = p.id and x.description = g.g_desc);

-- Scorch damage solutions
insert into goal_solutions
  (goal_id, label, status, source_type, source_note, proposed_by)
select g.id, s.lbl, 'proposed', 'human_observation', s.note,
  'dragon-lair-seed-july-2026'
from goals g
join phases p on p.id = g.phase_id
join dungeon_stages ds on ds.id = p.dungeon_stage_id
join dungeons d on d.id = ds.dungeon_id
cross join (values
  ('Poison stacking',
   'Poison ticks bypass the Scorch window requirement — they deal damage
    every turn regardless of the Inhale/Scorch cycle. Primary damage
    mechanism for traditional Dragon teams. Confirmed by AyumiLove and
    HellHades as the standard approach for beginner and mid-game accounts.'),
  ('HP Burn',
   'HP Burn ticks same as Poison — bypasses Scorch cycle, deals damage
    every turn based on enemy Max HP. Stacks with Poison for faster clears.
    HellHades confirms HP Burn champions (Bad-el-Kazar, Teodor) are
    effective Dragon farmers. Source: hellhades.com.'),
  ('High burst AoE damage',
   'If the team deals enough raw damage in the one-turn Scorch window,
    Scorch is cancelled. Requires very high damage output. JUDGMENT CALL —
    viable for strong rosters but not reliable for beginner accounts.
    Lower confidence than Poison/HP Burn solutions.')
) as s(lbl, note)
where d.name = 'Dragon''s Lair'
and ds.label in (
  'Stage 10','Stage 11','Stage 12','Stage 13','Stage 14',
  'Stage 15','Stage 16','Stage 17','Stage 18','Stage 19','Stage 20'
)
and p.phase_type = 'boss'
and g.description like 'Deal enough damage%'
and not exists (select 1 from goal_solutions x where x.goal_id = g.id and x.label = s.lbl);

-- Survival solutions
insert into goal_solutions
  (goal_id, label, status, source_type, source_note, proposed_by)
select g.id, s.lbl, 'proposed', 'human_observation', s.note,
  'dragon-lair-seed-july-2026'
from goals g
join phases p on p.id = g.phase_id
join dungeon_stages ds on ds.id = p.dungeon_stage_id
join dungeons d on d.id = ds.dungeon_id
cross join (values
  ('Cleanse',
   'Removes Poison and Weaken placed by Hellrazor''s Wall of Fire.
    AyumiLove confirms: "a Support champion who can remove debuffs is
    critical for surviving lengthy battles." Source: ayumilove.net.'),
  ('Continuous Heal + high HP',
   'Passive healing offsets Poison tick damage from Hellrazor''s Wall of
    Fire. Combined with high team HP, allows teams to sustain without a
    dedicated Cleanser. Confirmed approach for solo carries like
    Bad-el-Kazar and Bad-el-Kazar. Source: HellHades solo Dragon guide.'),
  ('Decrease Attack on Hellrazor',
   'Placing Decrease ATK on Hellrazor reduces his Swipe damage by 50%.
    This is your champion placing Decrease ATK ON the boss — distinct from
    Hellrazor placing it on your team. Confirmed from empyreanrule.com
    Dragon guide. NOTE: Decrease ATK tag on a champion satisfies this.')
) as s(lbl, note)
where d.name = 'Dragon''s Lair'
and ds.label in (
  'Stage 10','Stage 11','Stage 12','Stage 13','Stage 14',
  'Stage 15','Stage 16','Stage 17','Stage 18','Stage 19','Stage 20'
)
and p.phase_type = 'boss'
and g.description like 'Survive Hellrazor%'
and not exists (select 1 from goal_solutions x where x.goal_id = g.id and x.label = s.lbl);

-- Damage amplification solutions
insert into goal_solutions
  (goal_id, label, status, source_type, source_note, proposed_by)
select g.id, s.lbl, 'proposed', 'human_observation', s.note,
  'dragon-lair-seed-july-2026'
from goals g
join phases p on p.id = g.phase_id
join dungeon_stages ds on ds.id = p.dungeon_stage_id
join dungeons d on d.id = ds.dungeon_id
cross join (values
  ('Decrease Defense + Weaken',
   'Both debuffs amplify all damage dealt to Hellrazor. AyumiLove Hard
    mode guide: "place Decrease DEF and Weaken on Hellrazor to maximize
    damage." Multiplicative interaction — having both is significantly
    better than either alone. Source: ayumilove.net.'),
  ('Decrease Defense only',
   'Viable without Weaken at stages 10-14 where Hellrazor HP pool is
    lower. At stages 18-20, both debuffs become more important to
    reliably clear the Scorch bar. JUDGMENT CALL — flagged for
    calibration from battle log data.')
) as s(lbl, note)
where d.name = 'Dragon''s Lair'
and ds.label in (
  'Stage 10','Stage 11','Stage 12','Stage 13','Stage 14',
  'Stage 15','Stage 16','Stage 17','Stage 18','Stage 19','Stage 20'
)
and p.phase_type = 'boss'
and g.description like 'Apply Decrease Defense%'
and not exists (select 1 from goal_solutions x where x.goal_id = g.id and x.label = s.lbl);
