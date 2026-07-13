-- ============================================================================
-- Seed 118 — Spider's Den tier model: advisor rulings on seed 117 (2026-07-13)
-- ============================================================================
-- Three rulings from review of seed 117 (still all PROPOSED / staged):
--   1. ACC formula → stage × 10 (Plarium-sourced, per CLAUDE.md). Margin is a
--      SEPARATE deliberate choice (target ≈ floor + 10%), NOT baked into the
--      multiplier. The doc's stage × 11 was margin-in-the-multiplier; reconciled.
--   2. RES → ADVISORY (informational), same treatment Heal Reduction got for Fire
--      Knight: drop the hard threshold, keep it as guidance. A Shield/CC/strong-
--      sustain team can clear without meeting a RES floor.
--   3. Vocab: ADD `Poison Explosion` (distinct Spider mechanic — detonating stacks,
--      Sorath comps) and `AoE Shield` (team-wide protection matters here). DEFER
--      `AoE HP Burn` (plain HP Burn is sufficient for Spider).
-- All rows stay PROPOSED under proposed_by='spider-tiers-seed-2026-07-13'.
-- ============================================================================

-- ── Ruling 1: ACC formula stage×11 → stage×10, margin documented as separate ──
update stat_threshold_checks stc
set formula = 'stage * 10',
    notes = 'ACC floor = stage × 10 (Plarium-sourced; CLAUDE.md open-Q #3). Treat as a floor-WITH-MARGIN: target ≈ floor + 10% for reliability as a SEPARATE, deliberate choice — do NOT bake margin into the multiplier. (The doc''s stage × 11 was margin baked in; reconciled to ×10.)'
from phases p
join dungeon_stages ds on ds.id = p.dungeon_stage_id
join dungeons d on d.id = ds.dungeon_id
where stc.phase_id = p.id
  and d.name = 'Spider''s Den'
  and ds.label in ('Stages 1-14','Stages 15-20','Stages 21-25')
  and stc.stat = 'acc';

-- ── Ruling 2: RES → advisory. Drop the hard threshold, add an informational goal ──
delete from stat_threshold_checks stc
using phases p, dungeon_stages ds, dungeons d
where stc.phase_id = p.id and p.dungeon_stage_id = ds.id and ds.dungeon_id = d.id
  and d.name = 'Spider''s Den'
  and ds.label in ('Stages 1-14','Stages 15-20','Stages 21-25')
  and stc.stat = 'res';

insert into goals (phase_id, description, is_informational)
select p.id, g.descr, true
from phases p
join dungeon_stages ds on ds.id = p.dungeon_stage_id
join dungeons d on d.id = ds.dungeon_id
cross join (values
  ('Stages 1-14',  'Advisory: high RES helps resist the Spiderling MaxHP Poison but is NOT required — a Shield/CC or strong-sustain team clears without it. Rough guide RES ≈ stage × 10 + 100 (low priority at these stages).'),
  ('Stages 15-20', 'Advisory: high RES (≈ stage × 10 + 100, up to ~300) helps resist the Spiderling MaxHP Poison but is NOT required — a Shield/CC or strong-sustain team clears without it.'),
  ('Stages 21-25', 'Advisory: aim for ~300 RES to resist the Spiderling MaxHP Poison IF you rely on stat-resist survival — NOT required; a Shield/CC or strong-sustain team clears without it.')
) as g(lbl, descr)
where d.name = 'Spider''s Den' and ds.label = g.lbl
  and not exists (select 1 from goals x where x.phase_id = p.id and x.description = g.descr);

-- ── Ruling 3a: add the two new vocabulary tags ──────────────────────────────
insert into tags (name, description, is_debuff, bypasses_accuracy_check, game_id)
select v.name, v.descr, false, false, 'raid_shadow_legends'
from (values
  ('Poison Explosion', 'Detonates [Poison] stacks on enemies for burst damage (Poison Detonation) — ignores DEF and scales with the number of poison stacks. Spider-specific; Sorath-style comps.'),
  ('AoE Shield',       'Places a [Shield] buff on ALL allies (team-wide) — protects the whole team, e.g. against Spiderling attacks. Distinct from single-target Shield.')
) as v(name, descr)
where not exists (select 1 from tags t where t.name = v.name);

-- ── Ruling 3b: repoint the 'AoE Shield' solutions from generic Shield → AoE Shield ──
delete from goal_solution_tags gst
using goal_solutions gs, tags t
where gst.goal_solution_id = gs.id and gst.tag_id = t.id
  and gs.proposed_by = 'spider-tiers-seed-2026-07-13'
  and gs.label = 'AoE Shield'
  and t.name = 'Shield';

insert into goal_solution_tags (goal_solution_id, tag_id)
select gs.id, t.id
from goal_solutions gs
join tags t on t.name = 'AoE Shield'
where gs.proposed_by = 'spider-tiers-seed-2026-07-13'
  and gs.label = 'AoE Shield'
  and not exists (select 1 from goal_solution_tags x where x.goal_solution_id = gs.id and x.tag_id = t.id);

-- ── Ruling 3c: add Poison Explosion as a damage solution on the 15-20 damage goal ──
insert into goal_solutions (goal_id, label, status, source_type, source_note, proposed_by)
select g.id, 'Poison Explosion (detonate Poison stacks)', 'proposed', 'human_observation',
  'Detonates AoE Poison stacks for burst damage that ignores DEF (Poison Detonation / Sorath-style) — a distinct 15-20 damage path alongside Enemy-MaxHP nukes.',
  'spider-tiers-seed-2026-07-13'
from goals g
join phases p on p.id = g.phase_id
join dungeon_stages ds on ds.id = p.dungeon_stage_id
join dungeons d on d.id = ds.dungeon_id
where d.name = 'Spider''s Den' and ds.label = 'Stages 15-20'
  and g.description = 'Damage Skavag''s large HP pool — use Enemy-MaxHP damage, Poison, or HP Burn (raw AoE is too weak now).'
  and not exists (select 1 from goal_solutions x where x.goal_id = g.id and x.label = 'Poison Explosion (detonate Poison stacks)');

insert into goal_solution_tags (goal_solution_id, tag_id)
select gs.id, t.id
from goal_solutions gs
join tags t on t.name = 'Poison Explosion'
where gs.proposed_by = 'spider-tiers-seed-2026-07-13'
  and gs.label = 'Poison Explosion (detonate Poison stacks)'
  and not exists (select 1 from goal_solution_tags x where x.goal_solution_id = gs.id and x.tag_id = t.id);
