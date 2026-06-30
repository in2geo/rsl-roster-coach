-- ============================================================================
-- Seed 09 — Clan Boss goal_solution tags + approvals (DRAFT FOR REVIEW)
-- ============================================================================
-- Context: the six-difficulty Clan Boss content (Easy/Normal/Hard/Brutal/
-- Nightmare/Ultra Nightmare) was applied to the live DB out-of-band — there is
-- NO committed seed that produced it (the older seeds/02_dungeons.sql only
-- models a 2-tier Clan Boss). Its 40 goal_solutions landed as SKELETONS:
-- status='proposed' AND zero goal_solution_tags. With no tags the matching
-- engine can't satisfy any goal; and a tagless solution is *vacuously* satisfied
-- (`[].every()` is true) — so this also had to be guarded in match-engine.js
-- (computeTagCoverage / selectTeam now skip tagless solutions).
--
-- This seed tags those existing solutions from their LITERAL labels and approves
-- the ones it could tag. Per the no-auto-merge rule it is NOT auto-applied —
-- review, then run via the service-role admin path.
--
-- Tag-name note: the tags table has duplicate pairs ("Decrease ATK"/"Decrease
-- Attack", "Decrease SPD"/"Decrease Speed"). Champions are tagged with
-- "Decrease Attack" (4 champs) — "Decrease ATK" has 0 — so this seed targets the
-- names champions actually carry. Recommend de-duplicating the tags table later.
--
-- Coverage caveat (honest gaps, not bugs): HP Burn, Leech, Ally Protection, and
-- Continuous Heal are valid tags but currently have 0 approved champion_tags, so
-- solutions requiring them will correctly show as gaps until champions are tagged.
--
-- DELIBERATELY OUT OF SCOPE (data gaps to resolve separately — NOT invented here):
--   • Easy and Normal have goals but ZERO solutions — need solutions authored.
--   • The actionable DAMAGE goal had ZERO solutions in every Hard+ tier — worded
--     "Deal damage through Poison or HP Burn ticks …" (Hard/Brutal) and "Stack
--     Poisons and HP Burns …" (Nightmare/Ultra Nightmare). Section 3 now seeds
--     Poison / HP Burn solutions for it as 'proposed' (the only genuinely NEW
--     authored content here — pending the standard human approval step).
--   • "Lifesteal set on all 5 champions" is a GEAR-SET requirement with no tag
--     equivalent — left proposed + untagged (the engine guard skips it safely).
--     Sustain stays satisfiable via Leech or Ally Protection + Continuous Heal.
-- ============================================================================

-- ── 1. Tag the existing Clan Boss solutions (by literal label) ───────────────
-- Applies across all six difficulty stages at once (labels repeat per tier).
-- Idempotent via the unique(goal_solution_id, tag_id) constraint.

insert into goal_solution_tags (goal_solution_id, tag_id)
select gs.id, t.id
from goal_solutions gs
  join goals g           on g.id  = gs.goal_id
  join phases p          on p.id  = g.phase_id
  join dungeon_stages ds on ds.id = p.dungeon_stage_id
  join dungeons d        on d.id  = ds.dungeon_id
  join (values
    ('Decrease ATK debuff (50%)',              'Decrease Attack'),
    ('Block Debuffs on all allies',            'Block Debuffs'),
    ('Poison stacking',                        'Poison'),
    ('HP Burn',                                'HP Burn'),
    -- AND-combo: the gating debuffs. "direct damage" is generic (most attackers
    -- have it) so it is intentionally not required as a separate tag.
    ('Decrease DEF + Weaken + direct damage',  'Decrease Defense'),
    ('Decrease DEF + Weaken + direct damage',  'Weaken'),
    ('Permanent Leech debuff on boss',         'Leech'),
    -- AND-combo: both must be present.
    ('Ally Protection + Continuous Heal',      'Ally Protection'),
    ('Ally Protection + Continuous Heal',      'Continuous Heal'),
    ('Fast Cleanser (faster than all allies)', 'Cleanse'),
    ('Block Debuffs timed to the stun turn',   'Block Debuffs')
  ) as m(sol_label, tag_name) on m.sol_label = gs.label
  join tags t on t.name = m.tag_name
where d.name = 'Clan Boss'
on conflict (goal_solution_id, tag_id) do nothing;

-- ── 2. Approve the solutions that were tagged above ──────────────────────────
-- Excludes "Lifesteal set on all 5 champions" (no tag — stays proposed).

update goal_solutions gs
set status = 'approved', approved_by = 'seed_09_clan_boss', approved_at = now()
from goals g, phases p, dungeon_stages ds, dungeons d
where g.id = gs.goal_id and p.id = g.phase_id and ds.id = p.dungeon_stage_id and d.id = ds.dungeon_id
  and d.name = 'Clan Boss'
  and gs.label in (
    'Decrease ATK debuff (50%)',
    'Block Debuffs on all allies',
    'Poison stacking',
    'HP Burn',
    'Decrease DEF + Weaken + direct damage',
    'Permanent Leech debuff on boss',
    'Ally Protection + Continuous Heal',
    'Fast Cleanser (faster than all allies)',
    'Block Debuffs timed to the stun turn'
  );

-- ── 3. Solutions for the empty damage goal (PROPOSED — pending review) ───────
-- The actionable damage goal had NO solutions in any Hard+ tier (worded "Deal
-- damage through Poison or HP Burn ticks …" in Hard/Brutal; "Stack Poisons and
-- HP Burns …" in Nightmare/Ultra Nightmare), so the goal was permanently unmet.
-- The literal mechanic is Poison OR HP Burn (either one satisfies it). These are
-- the only genuinely NEW (authored) rows in this seed, so they land as 'proposed'
-- for the standard review step — not auto-approved. Idempotent: skips a label
-- that already exists for the goal. (Poison has tagged champions today; HP Burn
-- has none yet, so that solution will read as a gap until champions are tagged.)

insert into goal_solutions (goal_id, label, status, source_type, source_note, proposed_by)
select g.id, v.label, 'proposed', 'human_observation', v.note, 'seed_09_clan_boss'
from goals g
  join phases p          on p.id  = g.phase_id
  join dungeon_stages ds on ds.id = p.dungeon_stage_id
  join dungeons d        on d.id  = ds.dungeon_id
  join (values
    ('Poison damage over time',  'Poison ticks are the primary damage source for traditional Clan Boss teams'),
    ('HP Burn damage over time', 'HP Burn ticks add debuff-based damage independent of raw ATK')
  ) as v(label, note) on true
where d.name = 'Clan Boss'
  and (g.description ilike 'Deal damage through Poison or HP Burn ticks%'
       or g.description ilike 'Stack Poisons and HP Burns%')
  and not exists (
    select 1 from goal_solutions x where x.goal_id = g.id and x.label = v.label
  );

-- Tag the new solutions. Safe while they are still 'proposed' — the engine
-- ignores unapproved solutions, so approval later is a single status flip with
-- tags already attached.
insert into goal_solution_tags (goal_solution_id, tag_id)
select gs.id, t.id
from goal_solutions gs
  join goals g on g.id = gs.goal_id
  join phases p on p.id = g.phase_id
  join dungeon_stages ds on ds.id = p.dungeon_stage_id
  join dungeons d on d.id = ds.dungeon_id
  join tags t on (gs.label = 'Poison damage over time'  and t.name = 'Poison')
               or (gs.label = 'HP Burn damage over time' and t.name = 'HP Burn')
where d.name = 'Clan Boss'
  and (g.description ilike 'Deal damage through Poison or HP Burn ticks%'
       or g.description ilike 'Stack Poisons and HP Burns%')
on conflict (goal_solution_id, tag_id) do nothing;

-- ── 4. Verification (run after applying) ─────────────────────────────────────
-- select ds.label, count(*) filter (where gs.status='approved') as approved,
--        count(*) filter (where gst.id is not null) as tagged
-- from goal_solutions gs
--   join goals g on g.id = gs.goal_id
--   join phases p on p.id = g.phase_id
--   join dungeon_stages ds on ds.id = p.dungeon_stage_id
--   join dungeons d on d.id = ds.dungeon_id
--   left join goal_solution_tags gst on gst.goal_solution_id = gs.id
-- where d.name = 'Clan Boss'
-- group by ds.label order by ds.label;
