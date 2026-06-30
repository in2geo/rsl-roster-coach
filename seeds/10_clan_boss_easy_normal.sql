-- ============================================================================
-- Seed 10 — Clan Boss Easy/Normal: de-dup goals + author solutions (DRAFT)
-- ============================================================================
-- Easy and Normal each had 5 goals from a double-seed (2026-06-27 22:54 then
-- 23:09): a later batch re-worded two of the three concepts, leaving near-
-- duplicate goals. All 10 rows had 0 solutions, so neither tier could produce a
-- recommendation. Decision (reviewed): KEEP the later "Batch B" wording for the
-- two duplicated concepts + Batch A's unique sustain goal; delete the two Batch A
-- duplicates per tier.
--
-- Final 3 goals per tier:
--   1. "… keep Decrease ATK active as much as possible."   (Batch B)
--   2. "… any Poison or direct damage source contributes." (Batch B)
--   3. "Sustain through the fight — at least one healing mechanism on the team." (Batch A)
--
-- Authored solutions land as 'proposed' (new content → standard human review).
-- NOT auto-applied — review, then run via the service-role path. Easy/Normal are
-- the forgiving tiers, so solutions are lenient (OR of common options).
-- ============================================================================

-- ── 1. Remove the duplicate Batch A goals (guarded: only if they have NO
--       solutions, so this can never delete authored content) ────────────────
delete from goals g
using phases p, dungeon_stages ds, dungeons d
where p.id = g.phase_id and ds.id = p.dungeon_stage_id and d.id = ds.dungeon_id
  and d.name = 'Clan Boss'
  and ds.label in ('Easy','Normal')
  and g.description in (
    'Prevent the boss from one-shotting your team — keep Decrease ATK active.',
    'Deal damage before keys expire — any Poison or direct damage source.'
  )
  and not exists (select 1 from goal_solutions x where x.goal_id = g.id);

-- ── 2. Author solutions (proposed) for the 3 kept goals ──────────────────────
-- Idempotent: skips a (goal, label) that already exists.
insert into goal_solutions (goal_id, label, status, source_type, source_note, proposed_by)
select g.id, v.label, 'proposed', 'human_observation', v.note, 'seed_10_clan_boss_easy_normal'
from goals g
  join phases p          on p.id  = g.phase_id
  join dungeon_stages ds on ds.id = p.dungeon_stage_id
  join dungeons d        on d.id  = ds.dungeon_id
  join (values
    -- Goal 1 — Decrease ATK
    ('keep Decrease ATK active as much as possible.', 'Decrease ATK debuff',           'Decrease ATK is the single biggest survival lever at Easy/Normal'),
    -- Goal 2 — deal damage (OR: any one is enough)
    ('any Poison or direct damage source contributes.', 'Poison damage over time',     'Poison ticks chip the boss down over the key window'),
    ('any Poison or direct damage source contributes.', 'AoE damage attacker',          'AoE attackers contribute steady direct damage'),
    ('any Poison or direct damage source contributes.', 'Single-target damage attacker','Single-target hitters work fine at these forgiving tiers'),
    -- Goal 3 — sustain (OR)
    ('at least one healing mechanism on the team.', 'Healer in the team', 'A healer keeps the team alive through boss hits'),
    ('at least one healing mechanism on the team.', 'Continuous Heal',     'Continuous Heal is sufficient sustain at Easy/Normal')
  ) as v(goal_match, label, note) on g.description like '%' || v.goal_match || '%'
where d.name = 'Clan Boss'
  and ds.label in ('Easy','Normal')
  and not exists (select 1 from goal_solutions x where x.goal_id = g.id and x.label = v.label);

-- ── 3. Tag the authored solutions ────────────────────────────────────────────
insert into goal_solution_tags (goal_solution_id, tag_id)
select gs.id, t.id
from goal_solutions gs
  join goals g           on g.id  = gs.goal_id
  join phases p          on p.id  = g.phase_id
  join dungeon_stages ds on ds.id = p.dungeon_stage_id
  join dungeons d        on d.id  = ds.dungeon_id
  join (values
    ('Decrease ATK debuff',            'Decrease Attack'),
    ('Poison damage over time',        'Poison'),
    ('AoE damage attacker',            'AoE Damage'),
    ('Single-target damage attacker',  'Single Target Damage'),
    ('Healer in the team',             'Healer'),
    ('Continuous Heal',                'Continuous Heal')
  ) as m(label, tag_name) on m.label = gs.label
  join tags t on t.name = m.tag_name
where d.name = 'Clan Boss' and ds.label in ('Easy','Normal')
on conflict (goal_solution_id, tag_id) do nothing;

-- ── 4. Verification (run after applying) ─────────────────────────────────────
-- select ds.label, g.description, count(gs.id) as solutions,
--        count(gst.id) as tag_links
-- from goals g
--   join phases p on p.id = g.phase_id
--   join dungeon_stages ds on ds.id = p.dungeon_stage_id
--   join dungeons d on d.id = ds.dungeon_id
--   left join goal_solutions gs on gs.goal_id = g.id
--   left join goal_solution_tags gst on gst.goal_solution_id = gs.id
-- where d.name = 'Clan Boss' and ds.label in ('Easy','Normal')
-- group by ds.label, g.description order by ds.label, g.description;
