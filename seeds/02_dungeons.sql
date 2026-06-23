-- ============================================================================
-- Seed 02 — Dungeons, stages, phases, goals, and goal solutions
-- Source: in-game observation + Fandom wiki (CC-BY-SA) for mechanic framing.
-- All goal_solutions start as 'proposed' — human review required before live.
-- ============================================================================

-- ── 1. Dungeons ──────────────────────────────────────────────────────────────

insert into dungeons (name, has_wave_phase) values
  ('Campaign',    false),   -- treated as single phase for MVP
  ('Spider''s Den', false), -- no separate wave/boss split (brief, section 4)
  ('Clan Boss',   false)    -- no separate wave phase
on conflict (name) do nothing;

-- ── 2. Stages ────────────────────────────────────────────────────────────────
-- Campaign: we model it as a single "Early Campaign" block for MVP.
-- Spider's Den: stages 1-10. Model 1-6 and 7-10 as separate tiers for now.
-- Clan Boss: Easy / Normal / Hard / Brutal / Nightmare / Ultra-Nightmare.

insert into dungeon_stages (dungeon_id, stage_number, label, notes)
select d.id, s.stage_number, s.label, s.notes
from dungeons d
join (values
  ('Campaign',      null::int, 'Early (1-12)',  'Chapters 1-3; new-player focus'),
  ('Spider''s Den', null::int, 'Stages 1-6',   'Beginner Spider — survivability is the main wall'),
  ('Spider''s Den', null::int, 'Stages 7-10',  'Advanced Spider — ACC threshold matters'),
  ('Clan Boss',     null::int, 'Easy/Normal',  'Entry Clan Boss — establish debuff foundation'),
  ('Clan Boss',     null::int, 'Hard/Brutal',  'Mid Clan Boss — Decrease ATK becomes critical')
) as s(dungeon_name, stage_number, label, notes)
  on d.name = s.dungeon_name
on conflict (dungeon_id, label) do nothing;

-- ── 3. Phases ────────────────────────────────────────────────────────────────
-- All MVP content is 'single' phase (no wave/boss split — see CLAUDE.md).

insert into phases (dungeon_stage_id, phase_type, notes)
select ds.id, 'single', null
from dungeon_stages ds
on conflict (dungeon_stage_id, phase_type) do nothing;

-- ── 4. Goals + solutions — Campaign Early ─────────────────────────────────────

with
  phase as (
    select ph.id from phases ph
    join dungeon_stages ds on ds.id = ph.dungeon_stage_id
    join dungeons d on d.id = ds.dungeon_id
    where d.name = 'Campaign' and ds.label = 'Early (1-12)'
  ),

  g1 as (
    insert into goals (phase_id, description)
    select phase.id, 'Clear enemy waves quickly before they can output sustained damage'
    from phase
    returning id
  ),
  g2 as (
    insert into goals (phase_id, description)
    select phase.id, 'Survive the chapter boss hit'
    from phase
    returning id
  ),

  -- G1 solutions
  s1a as (
    insert into goal_solutions (goal_id, label, status, source_type, source_note, proposed_by)
    select g1.id, 'AoE Damage champion(s)', 'proposed', 'human_observation',
      'AoE attackers clear waves in fewer turns, reducing incoming damage before it accumulates',
      'seed'
    from g1
    returning id
  ),

  -- G2 solutions
  s2a as (
    insert into goal_solutions (goal_id, label, status, source_type, source_note, proposed_by)
    select g2.id, 'Healer in team', 'proposed', 'human_observation',
      'A healer sustains the team through boss hits in early campaign chapters',
      'seed'
    from g2
    returning id
  ),
  s2b as (
    insert into goal_solutions (goal_id, label, status, source_type, source_note, proposed_by)
    select g2.id, 'Increase DEF buff', 'proposed', 'human_observation',
      'DEF buff reduces the flat damage taken from boss hits',
      'seed'
    from g2
    returning id
  )

-- G1 solution tags
insert into goal_solution_tags (goal_solution_id, tag_id)
select s1a.id, tags.id from s1a, tags where tags.name = 'AoE Damage'
union all
select s2a.id, tags.id from s2a, tags where tags.name = 'Healer'
union all
select s2b.id, tags.id from s2b, tags where tags.name = 'Increase Defense';


-- ── 5. Goals + solutions — Spider's Den Stages 1-6 ───────────────────────────

with
  phase as (
    select ph.id from phases ph
    join dungeon_stages ds on ds.id = ph.dungeon_stage_id
    join dungeons d on d.id = ds.dungeon_id
    where d.name = 'Spider''s Den' and ds.label = 'Stages 1-6'
  ),

  -- Goal A: deny the spiderlings from dealing sustained damage
  ga as (
    insert into goals (phase_id, description)
    select phase.id, 'Prevent the spiderlings from dealing sustained damage before the team clears them'
    from phase
    returning id
  ),
  -- Goal B: speed (informational — evaluated via stat_threshold_checks)
  gb as (
    insert into goals (phase_id, description, is_informational)
    select phase.id, 'Team speed must exceed the spiderlings'' speed to avoid falling behind', true
    from phase
    returning id
  ),
  -- Goal C: survive the Spider boss' large single hits
  gc as (
    insert into goals (phase_id, description)
    select phase.id, 'Survive the Spider boss'' large single-target hits'
    from phase
    returning id
  ),

  -- GA solutions (OR — any one is enough)
  sa_sol1 as (
    insert into goal_solutions (goal_id, label, status, source_type, source_note, proposed_by)
    select ga.id, 'AoE Decrease DEF + AoE Damage', 'proposed', 'human_observation',
      'Decrease DEF amplifies AoE hits enough to burst spiderlings before they act', 'seed'
    from ga returning id
  ),
  sa_sol2 as (
    insert into goal_solutions (goal_id, label, status, source_type, source_note, proposed_by)
    select ga.id, 'AoE Stun / Freeze / Sleep', 'proposed', 'human_observation',
      'Hard CC stops spiderlings acting entirely, solving the sustained-damage problem', 'seed'
    from ga returning id
  ),
  sa_sol3 as (
    insert into goal_solutions (goal_id, label, status, source_type, source_note, proposed_by)
    select ga.id, 'AoE Decrease Turn Meter', 'proposed', 'human_observation',
      'Instant DTM (bypasses ACC check) delays spiderlings indefinitely when spammed', 'seed'
    from ga returning id
  ),

  -- GC solutions
  gc_sol1 as (
    insert into goal_solutions (goal_id, label, status, source_type, source_note, proposed_by)
    select gc.id, 'Healer', 'proposed', 'human_observation',
      'A healer patches the team between Spider boss hits', 'seed'
    from gc returning id
  ),
  gc_sol2 as (
    insert into goal_solutions (goal_id, label, status, source_type, source_note, proposed_by)
    select gc.id, 'Shield buff', 'proposed', 'human_observation',
      'Shield absorbs the large single-target hit', 'seed'
    from gc returning id
  )

-- Solution tags (AND within each solution)
insert into goal_solution_tags (goal_solution_id, tag_id)
-- SA sol1 needs BOTH tags
select sa_sol1.id, tags.id from sa_sol1, tags where tags.name = 'Decrease Defense'
union all
select sa_sol1.id, tags.id from sa_sol1, tags where tags.name = 'AoE Damage'
-- SA sol2: any AoE CC tag covers it (we map all three as separate 1-tag solutions above)
union all
select sa_sol2.id, tags.id from sa_sol2, tags where tags.name = 'AoE Stun'
union all
select sa_sol2.id, tags.id from sa_sol2, tags where tags.name = 'AoE Freeze'
union all  -- third AoE CC option as its own solution would be cleaner; keeping joined for brevity
select sa_sol3.id, tags.id from sa_sol3, tags where tags.name = 'AoE Decrease Turn Meter'
union all
select gc_sol1.id, tags.id from gc_sol1, tags where tags.name = 'Healer'
union all
select gc_sol2.id, tags.id from gc_sol2, tags where tags.name = 'Shield';


-- ── 6. Spider's Den stage 7-10 ACC threshold ─────────────────────────────────
-- formula: stage * 11 (from community observation — ACC needed to land debuffs)

insert into stat_threshold_checks (phase_id, stat, comparison, formula, notes)
select ph.id, 'acc', 'formula', 'stage * 11',
  'ACC needed to reliably land debuffs on spiderlings ≈ stage number × 11'
from phases ph
join dungeon_stages ds on ds.id = ph.dungeon_stage_id
join dungeons d on d.id = ds.dungeon_id
where d.name = 'Spider''s Den' and ds.label = 'Stages 7-10';


-- ── 7. Goals + solutions — Clan Boss Easy/Normal ──────────────────────────────

with
  phase as (
    select ph.id from phases ph
    join dungeon_stages ds on ds.id = ph.dungeon_stage_id
    join dungeons d on d.id = ds.dungeon_id
    where d.name = 'Clan Boss' and ds.label = 'Easy/Normal'
  ),

  g_def as (
    insert into goals (phase_id, description)
    select phase.id, 'Reduce Clan Boss'' outgoing damage (Decrease ATK or Decrease DEF on CB)'
    from phase returning id
  ),
  g_surv as (
    insert into goals (phase_id, description)
    select phase.id, 'Keep the team alive through the CB''s hits'
    from phase returning id
  ),
  g_dmg as (
    insert into goals (phase_id, description)
    select phase.id, 'Deal sustained damage over many turns (Poison preferred at Easy/Normal)'
    from phase returning id
  ),

  sol_dec_atk as (
    insert into goal_solutions (goal_id, label, status, source_type, source_note, proposed_by)
    select g_def.id, 'Decrease ATK on CB', 'proposed', 'human_observation',
      'Decrease ATK reduces CB''s hit size — critical for survival at all stages', 'seed'
    from g_def returning id
  ),
  sol_healer as (
    insert into goal_solutions (goal_id, label, status, source_type, source_note, proposed_by)
    select g_surv.id, 'Healer', 'proposed', 'human_observation',
      'Healer covers the chip damage between CB hits', 'seed'
    from g_surv returning id
  ),
  sol_poison as (
    insert into goal_solutions (goal_id, label, status, source_type, source_note, proposed_by)
    select g_dmg.id, 'Poison debuff(s)', 'proposed', 'human_observation',
      'Poison deals % max HP and is the most efficient damage source vs the CB''s high HP pool', 'seed'
    from g_dmg returning id
  )

insert into goal_solution_tags (goal_solution_id, tag_id)
select sol_dec_atk.id, tags.id from sol_dec_atk, tags where tags.name = 'Decrease Attack'
union all
select sol_healer.id,  tags.id from sol_healer,  tags where tags.name = 'Healer'
union all
select sol_poison.id,  tags.id from sol_poison,  tags where tags.name = 'Poison';
