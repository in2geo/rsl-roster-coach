-- ============================================================================
-- Seed 112 — Fire Knight's Castle: full stage range (Stages 1-9 and 21-25)
-- ============================================================================
-- Extends the existing live Fire Knight model (Stages 10-20) to the complete
-- Normal-difficulty ladder (1-25). Stages 10-20 already exist live and are
-- untouched by this seed (NOT EXISTS / ON CONFLICT guards).
--
-- SOURCE: Fyro mechanics hand-read from the AyumiLove Fire Knight's Castle guide
-- (factual game data only — shield hit-counts, boss skill text, affinity
-- rotation, and the two Stage 21-25 passives; NOT editorial tier-list content,
-- per CLAUDE.md source hierarchy). source_type = 'human_observation'.
--
-- KEY DATA the doc supplied that drives this seed:
--   • Divine Shield hit-count to break, by tier:
--       Stages 1-6  = 5 hits   Stages 7-9  = 7 hits
--       Stages 10-20 = 10 hits  Stages 21-25 = 12 hits
--   • Searing Storm (AoE that destroys MAX HP) is active from Stage 7 onward —
--     so Stages 1-6 do NOT have it; the shield's own unbroken-turn AoE (Cloak of
--     Fire) still reduces MAX HP at every stage.
--   • Dazzling Flames (AoE + 30% Decrease SPD, cooldown 5) is a base Fyro skill —
--     active at ALL stages (only Almighty Strength / Almighty Persistence are
--     stage-gated). It is modelled as informational at low tiers, a real goal at
--     21-25 where it is most punishing.
--   • Stage 21-25 ONLY: two extra passives —
--       Almighty Strength   — MAX-HP-scaling damage vs the boss is capped at 10%
--                             of the boss' MAX HP (%HP nukes fall off hard).
--       Almighty Persistence — ALL Turn Meter reduction vs the boss is reduced
--                             by 50% (Decrease Turn Meter control is half as good).
--   • Affinity rotation (matches the existing 10-20 rows exactly):
--       Force  1/5/9/13/17/20/24   Spirit 2/6/10/14/18/21/25
--       Magic  3/7/11/15/19/22     Void   4/8/12/16/23
--
-- STATUS: every goal_solution here is status='proposed' per the no-auto-merge
-- hard rule — the matching engine reads only APPROVED solutions, so nothing goes
-- live off this seed until a human approval pass flips these to 'approved'.
--
-- ENGINE NOTE: lib/match-engine.js DUNGEON_STAGE_RANGE gated Fire Knight input to
-- 10-20. That is widened to 1-25 for fire_knight in the same change set so these
-- stages are reachable once approved (Ice Golem stays 10-20).
-- ============================================================================

-- ── 0. Dungeon (idempotent) ─────────────────────────────────────────────────
insert into dungeons (name, has_wave_phase) values
  ('Fire Knight''s Castle', true)
on conflict (name) do nothing;

-- ── 1. Stages 1-9 and 21-25 ─────────────────────────────────────────────────
insert into dungeon_stages (dungeon_id, stage_number, label, notes)
select d.id, s.num, s.lbl, s.note
from dungeons d
cross join (values
  (1,  'Stage 1',  'Force affinity. Divine Shield = 5 hits to break (beginner tier). Searing Storm not yet active (starts Stage 7).'),
  (2,  'Stage 2',  'Spirit affinity. Divine Shield = 5 hits. Searing Storm not yet active.'),
  (3,  'Stage 3',  'Magic affinity. Divine Shield = 5 hits. Searing Storm not yet active.'),
  (4,  'Stage 4',  'Void affinity — no affinity advantage or penalty. Divine Shield = 5 hits. Searing Storm not yet active.'),
  (5,  'Stage 5',  'Force affinity. Divine Shield = 5 hits. Searing Storm not yet active.'),
  (6,  'Stage 6',  'Spirit affinity. Divine Shield = 5 hits. Last stage before the shield rises to 7 (Stage 7).'),
  (7,  'Stage 7',  'Magic affinity. Divine Shield = 7 hits. Searing Storm (MAX-HP-destroy AoE) becomes active from this stage.'),
  (8,  'Stage 8',  'Void affinity — no affinity advantage or penalty. Divine Shield = 7 hits. Searing Storm active.'),
  (9,  'Stage 9',  'Force affinity. Divine Shield = 7 hits. Last stage before the shield rises to 10 (Stage 10).'),
  (21, 'Stage 21', 'Spirit affinity. Divine Shield = 12 hits. Almighty Strength + Almighty Persistence passives unlock here (see boss exceptions).'),
  (22, 'Stage 22', 'Magic affinity. Divine Shield = 12 hits. Almighty Strength + Almighty Persistence active.'),
  (23, 'Stage 23', 'Void affinity — no affinity advantage or penalty. Divine Shield = 12 hits. Almighty Strength + Almighty Persistence active.'),
  (24, 'Stage 24', 'Force affinity. Divine Shield = 12 hits. Almighty Strength + Almighty Persistence active.'),
  (25, 'Stage 25', 'Spirit affinity. Divine Shield = 12 hits (endgame). Almighty Strength + Almighty Persistence active.')
) as s(num, lbl, note)
where d.name = 'Fire Knight''s Castle'
on conflict (dungeon_id, label) do nothing;

-- ── 2. Phases (wave + boss) ─────────────────────────────────────────────────
-- Beginner tier (1-6): shield 5, Searing Storm off, minions milder.
insert into phases (dungeon_stage_id, phase_type, notes)
select ds.id, 'boss',
  'Fyro the Fire Knight. Divine Shield = 5 hits at this tier and regenerates
   every turn; fail to break it before his turn and he heals + hits the team
   with a MAX-HP-reducing AoE. Boss is immune to all debuffs while the shield
   is up. Immune to Stun/Freeze/Sleep/Provoke/Block Skills/Fear regardless.'
from dungeon_stages ds join dungeons d on d.id = ds.dungeon_id
where d.name = 'Fire Knight''s Castle'
  and ds.label in ('Stage 1','Stage 2','Stage 3','Stage 4','Stage 5','Stage 6')
on conflict (dungeon_stage_id, phase_type) do nothing;

insert into phases (dungeon_stage_id, phase_type, notes)
select ds.id, 'wave',
  'Two waves before the boss. Minions are mild at this tier but AoE CC still
   speeds the clear and preserves HP entering the boss phase.'
from dungeon_stages ds join dungeons d on d.id = ds.dungeon_id
where d.name = 'Fire Knight''s Castle'
  and ds.label in ('Stage 1','Stage 2','Stage 3','Stage 4','Stage 5','Stage 6')
on conflict (dungeon_stage_id, phase_type) do nothing;

-- Intermediate tier (7-9): shield 7, Searing Storm active.
insert into phases (dungeon_stage_id, phase_type, notes)
select ds.id, 'boss',
  'Fyro the Fire Knight. Divine Shield = 7 hits at this tier and regenerates
   every turn. Searing Storm (MAX-HP-destroy AoE) is now active, so an unbroken
   shield turn is more punishing than at Stages 1-6. Boss immune to all debuffs
   while the shield is up.'
from dungeon_stages ds join dungeons d on d.id = ds.dungeon_id
where d.name = 'Fire Knight''s Castle'
  and ds.label in ('Stage 7','Stage 8','Stage 9')
on conflict (dungeon_stage_id, phase_type) do nothing;

insert into phases (dungeon_stage_id, phase_type, notes)
select ds.id, 'wave',
  'Two waves before the boss. Minions grow more dangerous toward Stage 10 —
   AoE CC prevents their A2/A3 skills from hitting squishy champions.'
from dungeon_stages ds join dungeons d on d.id = ds.dungeon_id
where d.name = 'Fire Knight''s Castle'
  and ds.label in ('Stage 7','Stage 8','Stage 9')
on conflict (dungeon_stage_id, phase_type) do nothing;

-- Endgame tier (21-25): shield 12, + Almighty Strength / Almighty Persistence.
insert into phases (dungeon_stage_id, phase_type, notes)
select ds.id, 'boss',
  'Fyro the Fire Knight. Divine Shield = 12 hits at this tier and regenerates
   every turn — the hardest break requirement in the dungeon. Almighty
   Persistence halves all Turn Meter reduction against the boss, and Almighty
   Strength caps MAX-HP-scaling damage at 10% of his MAX HP. Boss immune to all
   debuffs while the shield is up.'
from dungeon_stages ds join dungeons d on d.id = ds.dungeon_id
where d.name = 'Fire Knight''s Castle'
  and ds.label in ('Stage 21','Stage 22','Stage 23','Stage 24','Stage 25')
on conflict (dungeon_stage_id, phase_type) do nothing;

insert into phases (dungeon_stage_id, phase_type, notes)
select ds.id, 'wave',
  'Two waves before the boss. Minions can one-shot squishy champions with their
   A2/A3 — AoE CC and Block Cooldowns keep the team intact for the boss phase.'
from dungeon_stages ds join dungeons d on d.id = ds.dungeon_id
where d.name = 'Fire Knight''s Castle'
  and ds.label in ('Stage 21','Stage 22','Stage 23','Stage 24','Stage 25')
on conflict (dungeon_stage_id, phase_type) do nothing;

-- ── 3. Goals ────────────────────────────────────────────────────────────────
-- Helper convention: goals are matched by exact description text when attaching
-- solutions below, so the descriptions here must stay in sync with section 4.

-- 3a. Boss goals — Stages 1-6 (2 goals: break shield, post-shield damage window)
insert into goals (phase_id, description, is_informational)
select p.id, g.d, g.info
from phases p
join dungeon_stages ds on ds.id = p.dungeon_stage_id
join dungeons d on d.id = ds.dungeon_id
cross join (values
  ('Break Fyro''s Divine Shield each round before his turn — 5 hits at Stages 1-6.', false),
  ('Apply Decrease DEF and Weaken once the shield is down to speed up the kill.', false)
) as g(d, info)
where d.name = 'Fire Knight''s Castle'
  and ds.label in ('Stage 1','Stage 2','Stage 3','Stage 4','Stage 5','Stage 6')
  and p.phase_type = 'boss'
  and not exists (select 1 from goals x where x.phase_id = p.id and x.description = g.d);

-- 3b. Boss goals — Stages 7-9 (4 goals, mirrors the live 10-14 structure)
insert into goals (phase_id, description, is_informational)
select p.id, g.d, g.info
from phases p
join dungeon_stages ds on ds.id = p.dungeon_stage_id
join dungeons d on d.id = ds.dungeon_id
cross join (values
  ('Counter Dazzling Flames SPD debuff — a team-wide Increase SPD buff or Cleanse keeps your turn cycle ahead of Fyro.', true),
  ('Break Fyro''s Divine Shield each round before his turn — 7 hits at Stages 7-9.', false),
  ('Apply Decrease DEF and Weaken once the shield is down to maximize damage in the window before it regenerates.', false),
  ('Control Fyro''s Turn Meter after the shield breaks — keep him in the vulnerable state as long as possible.', false)
) as g(d, info)
where d.name = 'Fire Knight''s Castle'
  and ds.label in ('Stage 7','Stage 8','Stage 9')
  and p.phase_type = 'boss'
  and not exists (select 1 from goals x where x.phase_id = p.id and x.description = g.d);

-- 3c. Boss goals — Stages 21-25 (5 goals, mirrors the live 15-20 structure + new passives)
insert into goals (phase_id, description, is_informational)
select p.id, g.d, g.info
from phases p
join dungeon_stages ds on ds.id = p.dungeon_stage_id
join dungeons d on d.id = ds.dungeon_id
cross join (values
  ('Speed: your team must land 12 hits AND cycle debuffs before Fyro acts. Almighty Persistence halves Turn Meter control here, so raw team SPD matters more.', true),
  ('Break Fyro''s Divine Shield each round before his turn — 12 hits at Stages 21-25.', false),
  ('Apply Decrease DEF and Weaken once the shield is down to maximize damage in the window before it regenerates.', false),
  ('Counter Dazzling Flames SPD debuff — without an SPD buffer or Cleanse your team loses turns to the boss.', false),
  ('Control Fyro''s Turn Meter after the shield breaks — note Almighty Persistence halves all Turn Meter reduction against Fyro.', false)
) as g(d, info)
where d.name = 'Fire Knight''s Castle'
  and ds.label in ('Stage 21','Stage 22','Stage 23','Stage 24','Stage 25')
  and p.phase_type = 'boss'
  and not exists (select 1 from goals x where x.phase_id = p.id and x.description = g.d);

-- 3d. Wave goals — all new stages (identical clear + preserve pair)
insert into goals (phase_id, description, is_informational)
select p.id, g.d, g.info
from phases p
join dungeon_stages ds on ds.id = p.dungeon_stage_id
join dungeons d on d.id = ds.dungeon_id
cross join (values
  ('Clear the wave before dangerous minion skills activate — use AoE CC to deny their turns.', false),
  ('Preserve team HP and buffs entering the boss phase — avoid unnecessary damage on waves.', true)
) as g(d, info)
where d.name = 'Fire Knight''s Castle'
  and ds.label in ('Stage 1','Stage 2','Stage 3','Stage 4','Stage 5','Stage 6',
                   'Stage 7','Stage 8','Stage 9',
                   'Stage 21','Stage 22','Stage 23','Stage 24','Stage 25')
  and p.phase_type = 'wave'
  and not exists (select 1 from goals x where x.phase_id = p.id and x.description = g.d);

-- ── 4. Goal solutions (label-only here; tags attached in section 5) ──────────
-- proposed_by tag 'fk-full-range-seed-2026-07-13' scopes section 5 + threshold
-- rows so this seed never touches the existing 10-20 content.

-- 4a. Stages 1-6 boss solutions
insert into goal_solutions (goal_id, label, status, source_type, source_note, proposed_by)
select g.id, s.lbl, 'proposed', 'human_observation', s.note, 'fk-full-range-seed-2026-07-13'
from goals g
join phases p on p.id = g.phase_id
join dungeon_stages ds on ds.id = p.dungeon_stage_id
join dungeons d on d.id = ds.dungeon_id
cross join (values
  ('Break Fyro''s Divine Shield each round before his turn — 5 hits at Stages 1-6.',
     'Multi-Hit A1 champions (3+ x 2 hits = 6+)',
     'Even three champions with 2-hit A1s clear the 5-hit shield comfortably at this tier.'),
  ('Break Fyro''s Divine Shield each round before his turn — 5 hits at Stages 1-6.',
     'Multi-Hit A1 champions + Counterattack buff',
     'Counterattack adds off-turn hits, reaching 5 shield hits even with fewer multi-hit A1s.'),
  ('Break Fyro''s Divine Shield each round before his turn — 5 hits at Stages 1-6.',
     'Multi-Hit A1 champions + Ally Attack',
     'An unconditional team-wide Ally Attack adds a burst of extra hits toward the shield.'),
  ('Apply Decrease DEF and Weaken once the shield is down to speed up the kill.',
     'Decrease DEF + Weaken',
     'Amplifies damage in the short post-shield window before it regenerates.'),
  ('Apply Decrease DEF and Weaken once the shield is down to speed up the kill.',
     'Decrease Turn Meter',
     'Delaying Fyro''s turn buys extra hits / a longer damage window at this tier.')
) as s(goal_desc, lbl, note)
where d.name = 'Fire Knight''s Castle'
  and ds.label in ('Stage 1','Stage 2','Stage 3','Stage 4','Stage 5','Stage 6')
  and p.phase_type = 'boss'
  and g.description = s.goal_desc
  and not exists (select 1 from goal_solutions x where x.goal_id = g.id and x.label = s.lbl);

-- 4b. Stages 7-9 boss solutions
insert into goal_solutions (goal_id, label, status, source_type, source_note, proposed_by)
select g.id, s.lbl, 'proposed', 'human_observation', s.note, 'fk-full-range-seed-2026-07-13'
from goals g
join phases p on p.id = g.phase_id
join dungeon_stages ds on ds.id = p.dungeon_stage_id
join dungeons d on d.id = ds.dungeon_id
cross join (values
  ('Break Fyro''s Divine Shield each round before his turn — 7 hits at Stages 7-9.',
     'Multi-Hit A1 champions (4+ x 2 hits = 8+)',
     'Four champions with 2-hit A1s clear the 7-hit shield each round.'),
  ('Break Fyro''s Divine Shield each round before his turn — 7 hits at Stages 7-9.',
     'Multi-Hit A1 champions + Counterattack buff',
     'Counterattack supplies the extra off-turn hits to reach 7 with fewer multi-hitters.'),
  ('Break Fyro''s Divine Shield each round before his turn — 7 hits at Stages 7-9.',
     'Multi-Hit A1 champions + Ally Attack',
     'An unconditional team-wide Ally Attack adds a burst of hits toward the 7-hit shield.'),
  ('Apply Decrease DEF and Weaken once the shield is down to maximize damage in the window before it regenerates.',
     'Decrease DEF + Weaken',
     'Maximizes damage in the post-shield window.'),
  ('Apply Decrease DEF and Weaken once the shield is down to maximize damage in the window before it regenerates.',
     'Decrease Turn Meter + Decrease SPD',
     'Extends the vulnerable window by keeping Fyro from acting.'),
  ('Apply Decrease DEF and Weaken once the shield is down to maximize damage in the window before it regenerates.',
     'Decrease Turn Meter only',
     'Turn Meter control alone still extends the damage window when no Decrease DEF is available.'),
  ('Control Fyro''s Turn Meter after the shield breaks — keep him in the vulnerable state as long as possible.',
     'Decrease Turn Meter',
     'Pushes Fyro''s Turn Meter back so the shield stays down longer.')
) as s(goal_desc, lbl, note)
where d.name = 'Fire Knight''s Castle'
  and ds.label in ('Stage 7','Stage 8','Stage 9')
  and p.phase_type = 'boss'
  and g.description = s.goal_desc
  and not exists (select 1 from goal_solutions x where x.goal_id = g.id and x.label = s.lbl);

-- 4c. Stages 21-25 boss solutions
insert into goal_solutions (goal_id, label, status, source_type, source_note, proposed_by)
select g.id, s.lbl, 'proposed', 'human_observation', s.note, 'fk-full-range-seed-2026-07-13'
from goals g
join phases p on p.id = g.phase_id
join dungeon_stages ds on ds.id = p.dungeon_stage_id
join dungeons d on d.id = ds.dungeon_id
cross join (values
  ('Break Fyro''s Divine Shield each round before his turn — 12 hits at Stages 21-25.',
     'Multi-Hit A1 champions (5 x 2+ hits, plus extra attacks to reach 12)',
     'The 12-hit shield needs a full multi-hit A1 core plus additional attacks (Counterattack / Ally Attack / extra turns from SPD).'),
  ('Break Fyro''s Divine Shield each round before his turn — 12 hits at Stages 21-25.',
     'Multi-Hit A1 champions + Counterattack buff',
     'Counterattack is near-mandatory here to reach 12 hits before Fyro''s turn.'),
  ('Break Fyro''s Divine Shield each round before his turn — 12 hits at Stages 21-25.',
     'Multi-Hit A1 champions + Ally Attack',
     'An unconditional team-wide Ally Attack contributes a burst of hits toward the 12-hit shield.'),
  ('Apply Decrease DEF and Weaken once the shield is down to maximize damage in the window before it regenerates.',
     'Decrease DEF + Weaken',
     'Maximizes damage in the narrow post-shield window at endgame stat floors.'),
  ('Counter Dazzling Flames SPD debuff — without an SPD buffer or Cleanse your team loses turns to the boss.',
     'Cleanse (removes SPD debuff)',
     'Removes the 30% Decrease SPD from Dazzling Flames so the team keeps cycling hits.'),
  ('Counter Dazzling Flames SPD debuff — without an SPD buffer or Cleanse your team loses turns to the boss.',
     'Increase SPD buff (team-wide)',
     'A team-wide Increase SPD buff offsets Dazzling Flames and sustains the hit cadence.'),
  ('Control Fyro''s Turn Meter after the shield breaks — note Almighty Persistence halves all Turn Meter reduction against Fyro.',
     'Decrease Turn Meter only',
     'Still useful, but Almighty Persistence halves its effect vs the boss — bring extra Turn Meter control or pair with SPD.'),
  ('Control Fyro''s Turn Meter after the shield breaks — note Almighty Persistence halves all Turn Meter reduction against Fyro.',
     'Decrease Turn Meter + Decrease SPD',
     'Pairing Decrease SPD with the (halved) Decrease Turn Meter keeps Fyro suppressed despite Almighty Persistence.')
) as s(goal_desc, lbl, note)
where d.name = 'Fire Knight''s Castle'
  and ds.label in ('Stage 21','Stage 22','Stage 23','Stage 24','Stage 25')
  and p.phase_type = 'boss'
  and g.description = s.goal_desc
  and not exists (select 1 from goal_solutions x where x.goal_id = g.id and x.label = s.lbl);

-- 4d. Wave solutions — all new stages
--   AoE CC set is shared; Block Cooldowns only added at the endgame tier (21-25).
insert into goal_solutions (goal_id, label, status, source_type, source_note, proposed_by)
select g.id, s.lbl, 'proposed', 'human_observation', s.note, 'fk-full-range-seed-2026-07-13'
from goals g
join phases p on p.id = g.phase_id
join dungeon_stages ds on ds.id = p.dungeon_stage_id
join dungeons d on d.id = ds.dungeon_id
cross join (values
  ('AoE Stun',                'Stuns the whole wave, denying every minion turn.'),
  ('AoE Freeze',              'Freezes the whole wave — same wave-control outcome as AoE Stun.'),
  ('AoE Decrease Turn Meter', 'Pushes the wave back so the team acts first and clears before minions cast.')
) as s(lbl, note)
where d.name = 'Fire Knight''s Castle'
  and ds.label in ('Stage 1','Stage 2','Stage 3','Stage 4','Stage 5','Stage 6',
                   'Stage 7','Stage 8','Stage 9',
                   'Stage 21','Stage 22','Stage 23','Stage 24','Stage 25')
  and p.phase_type = 'wave'
  and g.description = 'Clear the wave before dangerous minion skills activate — use AoE CC to deny their turns.'
  and not exists (select 1 from goal_solutions x where x.goal_id = g.id and x.label = s.lbl);

insert into goal_solutions (goal_id, label, status, source_type, source_note, proposed_by)
select g.id, 'Block Cooldowns', 'proposed', 'human_observation',
  'Blocks the dangerous A2/A3 minion skills that can one-shot squishy champions at endgame stages.',
  'fk-full-range-seed-2026-07-13'
from goals g
join phases p on p.id = g.phase_id
join dungeon_stages ds on ds.id = p.dungeon_stage_id
join dungeons d on d.id = ds.dungeon_id
where d.name = 'Fire Knight''s Castle'
  and ds.label in ('Stage 21','Stage 22','Stage 23','Stage 24','Stage 25')
  and p.phase_type = 'wave'
  and g.description = 'Clear the wave before dangerous minion skills activate — use AoE CC to deny their turns.'
  and not exists (select 1 from goal_solutions x where x.goal_id = g.id and x.label = 'Block Cooldowns');

-- ── 5. Goal solution tags (AND within a solution) ───────────────────────────
-- Global label -> tag map. Labels are unique to their tag set across all tiers,
-- so one join covers every new solution. Scoped to this seed's rows via
-- proposed_by; NOT EXISTS makes it idempotent.
insert into goal_solution_tags (goal_solution_id, tag_id)
select gs.id, t.id
from goal_solutions gs
join (values
  ('Multi-Hit A1 champions (3+ x 2 hits = 6+)',                              'Multi-Hit A1'),
  ('Multi-Hit A1 champions (4+ x 2 hits = 8+)',                              'Multi-Hit A1'),
  ('Multi-Hit A1 champions (5 x 2+ hits, plus extra attacks to reach 12)',   'Multi-Hit A1'),
  ('Multi-Hit A1 champions + Counterattack buff',                            'Multi-Hit A1'),
  ('Multi-Hit A1 champions + Counterattack buff',                            'Counterattack'),
  ('Multi-Hit A1 champions + Ally Attack',                                   'Multi-Hit A1'),
  ('Multi-Hit A1 champions + Ally Attack',                                   'Ally Attack'),
  ('Decrease DEF + Weaken',                                                  'Decrease Defense'),
  ('Decrease DEF + Weaken',                                                  'Weaken'),
  ('Decrease Turn Meter',                                                    'Decrease Turn Meter'),
  ('Decrease Turn Meter only',                                               'Decrease Turn Meter'),
  ('Decrease Turn Meter + Decrease SPD',                                     'Decrease Turn Meter'),
  ('Decrease Turn Meter + Decrease SPD',                                     'Decrease Speed'),
  ('Cleanse (removes SPD debuff)',                                           'Cleanse'),
  ('Increase SPD buff (team-wide)',                                          'Increase Speed'),
  ('AoE Stun',                                                               'AoE Stun'),
  ('AoE Freeze',                                                             'AoE Freeze'),
  ('AoE Decrease Turn Meter',                                                'AoE Decrease Turn Meter'),
  ('Block Cooldowns',                                                        'Block Cooldowns')
) as m(lbl, tag_name) on m.lbl = gs.label
join tags t on t.name = m.tag_name
where gs.proposed_by = 'fk-full-range-seed-2026-07-13'
  and not exists (
    select 1 from goal_solution_tags x
    where x.goal_solution_id = gs.id and x.tag_id = t.id
  );

-- ── 6. Stat threshold checks (per tier) ─────────────────────────────────────
-- ACC values are JUDGMENT CALLS extrapolated from the live 10-14 (120) / 15-20
-- (170) curve and the "stage x 10 floor-with-margin" convention (as used for
-- Spider's Den) — the doc's Fyro stat table is an image and was not machine-read.
-- Treat as starting floors; recalibrate against real account data.
insert into stat_threshold_checks (phase_id, stat, comparison, formula, notes)
select p.id, v.stat, v.cmp, v.formula, v.note
from phases p
join dungeon_stages ds on ds.id = p.dungeon_stage_id
join dungeons d on d.id = ds.dungeon_id
cross join (values
  -- Stages 1-6
  ('1-6', 'acc', 'formula', '60',
     'ACC ~60 to land Decrease DEF/Weaken/Decrease SPD once the 5-hit shield is down. Beginner floor (JUDGMENT CALL, not primary-sourced) — roughly stage x 10 at the top of the tier.'),
  ('1-6', 'spd', 'relative_to_enemy', null,
     'Stages 1-6: ~110+ SPD is enough to out-cycle the wave and land 5 shield hits before Fyro acts. Directional JUDGMENT CALL.'),
  -- Stages 7-9
  ('7-9', 'acc', 'formula', '90',
     'ACC ~90 to reliably land post-shield debuffs at the 7-hit tier. JUDGMENT CALL between the 1-6 (60) and 10-14 (120) floors; ~stage x 10 with margin.'),
  ('7-9', 'spd', 'relative_to_enemy', null,
     'Stages 7-9: ~130+ SPD to cycle 7 hits plus debuffs before Fyro''s turn. Directional JUDGMENT CALL.'),
  -- Stages 21-25
  ('21-25', 'acc', 'formula', '210',
     'ACC ~210+ to land Decrease SPD/DEF/Weaken vs the higher endgame RES. JUDGMENT CALL extrapolated above the 15-20 (170) floor toward the stage x 10 ceiling (25 -> 250). Recalibrate with account data.'),
  ('21-25', 'spd', 'relative_to_enemy', null,
     'Stages 21-25: ~200+ SPD. Almighty Persistence halves Turn Meter control, so out-speeding Fyro to land 12 hits before his turn matters more than at any lower tier. Directional JUDGMENT CALL.')
) as v(tier, stat, cmp, formula, note)
where d.name = 'Fire Knight''s Castle'
  and p.phase_type = 'boss'
  and (
       (v.tier = '1-6'   and ds.label in ('Stage 1','Stage 2','Stage 3','Stage 4','Stage 5','Stage 6'))
    or (v.tier = '7-9'   and ds.label in ('Stage 7','Stage 8','Stage 9'))
    or (v.tier = '21-25' and ds.label in ('Stage 21','Stage 22','Stage 23','Stage 24','Stage 25'))
  )
  and not exists (
    select 1 from stat_threshold_checks x
    where x.phase_id = p.id and x.stat = v.stat
  );

-- ── 7. Boss exceptions ──────────────────────────────────────────────────────
-- Per-stage affinity + shield note for the new stages (mirrors the 10-20 rows).
insert into boss_exceptions (dungeon_stage_id, description, source_citation)
select ds.id, e.descr, 'AyumiLove Fire Knight''s Castle guide (hand-read factual mechanics), 2026'
from dungeon_stages ds
join dungeons d on d.id = ds.dungeon_id
cross join (values
  ('Stage 1',  'Force affinity. Divine Shield = 5 hits. Searing Storm not yet active (starts Stage 7).'),
  ('Stage 2',  'Spirit affinity. Divine Shield = 5 hits. Searing Storm not yet active.'),
  ('Stage 3',  'Magic affinity. Divine Shield = 5 hits. Searing Storm not yet active.'),
  ('Stage 4',  'Void affinity — no affinity advantage or penalty. Divine Shield = 5 hits. Searing Storm not yet active.'),
  ('Stage 5',  'Force affinity. Divine Shield = 5 hits. Searing Storm not yet active.'),
  ('Stage 6',  'Spirit affinity. Divine Shield = 5 hits. Last 5-hit stage before the shield rises to 7.'),
  ('Stage 7',  'Magic affinity. Divine Shield = 7 hits. Searing Storm (MAX-HP-destroy AoE) becomes active from this stage — unbroken shield turns now cost MAX HP.'),
  ('Stage 8',  'Void affinity — no affinity advantage or penalty. Divine Shield = 7 hits. Searing Storm active.'),
  ('Stage 9',  'Force affinity. Divine Shield = 7 hits. Benchmark stage before the full 10-hit shield at Stage 10.')
) as e(lbl, descr)
where d.name = 'Fire Knight''s Castle' and ds.label = e.lbl
  and not exists (select 1 from boss_exceptions x where x.dungeon_stage_id = ds.id and x.description = e.descr);

-- Stage 21-25: the two extra passives (apply to every stage in the tier).
insert into boss_exceptions (dungeon_stage_id, description, source_citation)
select ds.id, e.descr, 'AyumiLove Fire Knight''s Castle guide (hand-read factual mechanics), 2026'
from dungeon_stages ds
join dungeons d on d.id = ds.dungeon_id
cross join (values
  ('Almighty Strength (passive, Stages 21-25): damage from skills that scale on enemy MAX HP cannot exceed 10% of Fyro''s MAX HP. %MAX-HP nukes fall off hard — rely on multi-hit shield-breaking and raw damage in the post-shield window instead.'),
  ('Almighty Persistence (passive, Stages 21-25): all Turn Meter reduction against Fyro is decreased by 50%. Decrease Turn Meter control is half as effective — bring extra Turn Meter control or lean on Increase SPD to out-cycle him.'),
  ('Divine Shield = 12 hits at Stages 21-25 (up from 10 at 10-20). The shield regenerates every turn; an unbroken turn triggers Searing Storm''s MAX-HP-destroying AoE.')
) as e(descr)
where d.name = 'Fire Knight''s Castle'
  and ds.label in ('Stage 21','Stage 22','Stage 23','Stage 24','Stage 25')
  and not exists (select 1 from boss_exceptions x where x.dungeon_stage_id = ds.id and x.description = e.descr);
