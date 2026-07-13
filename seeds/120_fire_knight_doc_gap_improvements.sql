-- ============================================================================
-- Seed 115 — Fire Knight's Castle: doc-gap improvements to the existing model
-- ============================================================================
-- Adds mechanics the AyumiLove Fire Knight guide describes that the pre-existing
-- 10-20 model never wired up. Applies across the full 1-25 ladder so all tiers
-- stay consistent. Everything is status='proposed' (no-auto-merge).
--
-- FOUR IMPROVEMENTS:
--   #1 Increase Turn Meter as a shield-break enabler — the guide names a Speed
--      champ with "Increase Speed AND Increase Turn Meter" as a core requirement.
--      Extra turns = more attacks toward the shield. Added as an AND-combo
--      solution on every boss shield-break goal.
--   #2 Deny Fyro's per-turn self-heal — Cloak of Fire makes Fyro heal every turn
--      (scaling with shield strength). The 15-20 ACC-threshold note even referenced
--      "Heal Reduction" but no goal or solution ever used the tag. Added as a goal
--      solved by Heal Reduction.
--   #3 Dazzling Flames counter at Stages 7-14 — the doc confirms Dazzling Flames
--      is a BASE skill (cooldown 5), active at ALL stages; only Almighty Strength/
--      Persistence are 21-25-gated. The 10-14 goal was stuck as informational
--      "confirm whether active". Corrected + given Cleanse / Increase SPD solutions
--      to match the live 15-20 treatment.
--   #6 Almighty Immunity — documented as a boss_exception so the explanation layer
--      never suggests a player's Stun/Freeze/Provoke champ helps against the boss
--      (it only helps on the minions).
--
-- ── NO-REGRESSION STAGING ───────────────────────────────────────────────────
-- The matching engine counts EVERY non-informational goal with no satisfied
-- APPROVED solution as an unmet gap (computeTagCoverage). So creating a new hard
-- goal on the live 10-20 stages would drop their confidence BEFORE the advisor
-- approves. To avoid that, the two NEW goals (#2, #3) are created / kept
-- is_informational = TRUE — the engine skips informational goals entirely, so
-- they are fully DORMANT and have zero effect on live 10-20 confidence. Their
-- solutions are attached but ignored until the approval seed flips
-- is_informational -> false AND status -> approved together.
--   • #1 is inherently safe: a proposed solution on a goal that already has
--     approved solutions — ignored until approved, no goal added.
--   • #6 is inherently safe: boss_exceptions are free-text documentation, not
--     read by the coverage/threshold engine.
--
-- proposed_by = 'fk-doc-gap-seed-2026-07-13' scopes every row this seed adds so
-- the approval seed can target them precisely.
-- ============================================================================

-- ── #1. Increase Turn Meter shield-break solution (all 25 boss shield-break goals) ──
-- The shield-break goal is the only boss goal whose description starts with "Break".
insert into goal_solutions (goal_id, label, status, source_type, source_note, proposed_by)
select g.id, 'Multi-Hit A1 champions + Increase Turn Meter', 'proposed', 'human_observation',
  'Increase Turn Meter grants the team extra turns = more attacks toward the shield each round. The FK guide lists a Speed champ with Increase Speed AND Increase Turn Meter as a core requirement. AND-combo: Turn Meter boost alone does not break a shield, so it pairs with multi-hit A1 champions.',
  'fk-doc-gap-seed-2026-07-13'
from goals g
join phases p on p.id = g.phase_id
join dungeon_stages ds on ds.id = p.dungeon_stage_id
join dungeons d on d.id = ds.dungeon_id
where d.name = 'Fire Knight''s Castle'
  and p.phase_type = 'boss'
  and g.description ilike 'Break%'
  and not exists (
    select 1 from goal_solutions x
    where x.goal_id = g.id and x.label = 'Multi-Hit A1 champions + Increase Turn Meter'
  );

-- ── #2. Deny Fyro's per-turn self-heal (new INFORMATIONAL goal, all 25 boss phases) ──
insert into goals (phase_id, description, is_informational)
select p.id,
  'Deny Fyro''s per-turn self-heal — Cloak of Fire heals him at the start of every turn, scaling with shield strength, which can undo your shield-break damage.',
  true
from phases p
join dungeon_stages ds on ds.id = p.dungeon_stage_id
join dungeons d on d.id = ds.dungeon_id
where d.name = 'Fire Knight''s Castle'
  and p.phase_type = 'boss'
  and not exists (
    select 1 from goals x where x.phase_id = p.id and x.description like 'Deny Fyro''s per-turn self-heal%'
  );

insert into goal_solutions (goal_id, label, status, source_type, source_note, proposed_by)
select g.id, 'Heal Reduction', 'proposed', 'human_observation',
  'Heal Reduction cuts Fyro''s per-turn self-heal (Cloak of Fire passive). STAGED informational — the advisor decides at approval whether to promote this to a hard coverage goal; leaving it informational avoids over-penalizing teams that win purely by breaking the shield every round.',
  'fk-doc-gap-seed-2026-07-13'
from goals g
join phases p on p.id = g.phase_id
join dungeon_stages ds on ds.id = p.dungeon_stage_id
join dungeons d on d.id = ds.dungeon_id
where d.name = 'Fire Knight''s Castle'
  and p.phase_type = 'boss'
  and g.description like 'Deny Fyro''s per-turn self-heal%'
  and not exists (select 1 from goal_solutions x where x.goal_id = g.id and x.label = 'Heal Reduction');

-- ── #3. Dazzling Flames counter — upgrade the informational goals at Stages 7-14 ──
-- Correct the 10-14 "confirm whether active" wording (doc confirms Dazzling Flames
-- is a base skill active at every stage), matching the live 15-20 goal text.
update goals g
set description = 'Counter Dazzling Flames SPD debuff — without an SPD buffer or Cleanse your team loses turns to the boss.'
from phases p, dungeon_stages ds, dungeons d
where g.phase_id = p.id and p.dungeon_stage_id = ds.id and ds.dungeon_id = d.id
  and d.name = 'Fire Knight''s Castle'
  and p.phase_type = 'boss'
  and ds.stage_number between 10 and 14
  and g.is_informational = true
  and g.description ilike 'Counter Dazzling Flames%confirm%';

-- Stage Cleanse / Increase SPD solutions on the informational Dazzling goals at 7-14.
-- (15-20 already have these as approved solutions; 21-25 got them in seed 112.)
insert into goal_solutions (goal_id, label, status, source_type, source_note, proposed_by)
select g.id, s.lbl, 'proposed', 'human_observation', s.note, 'fk-doc-gap-seed-2026-07-13'
from goals g
join phases p on p.id = g.phase_id
join dungeon_stages ds on ds.id = p.dungeon_stage_id
join dungeons d on d.id = ds.dungeon_id
cross join (values
  ('Cleanse (removes SPD debuff)',   'Removes the 30% Decrease SPD from Dazzling Flames (base skill, cooldown 5, active at every stage per the FK guide).'),
  ('Increase SPD buff (team-wide)',  'A team-wide Increase SPD buff offsets Dazzling Flames so the team keeps its hit cadence.')
) as s(lbl, note)
where d.name = 'Fire Knight''s Castle'
  and p.phase_type = 'boss'
  and ds.stage_number between 7 and 14
  and g.is_informational = true
  and g.description ilike 'Counter Dazzling Flames%'
  and not exists (select 1 from goal_solutions x where x.goal_id = g.id and x.label = s.lbl);

-- ── Tags for the new solutions (#1, #2, #3), scoped to this seed's rows ──────
insert into goal_solution_tags (goal_solution_id, tag_id)
select gs.id, t.id
from goal_solutions gs
join (values
  ('Multi-Hit A1 champions + Increase Turn Meter', 'Multi-Hit A1'),
  ('Multi-Hit A1 champions + Increase Turn Meter', 'Increase Turn Meter'),
  ('Heal Reduction',                               'Heal Reduction'),
  ('Cleanse (removes SPD debuff)',                 'Cleanse'),
  ('Increase SPD buff (team-wide)',                'Increase Speed')
) as m(lbl, tag_name) on m.lbl = gs.label
join tags t on t.name = m.tag_name
where gs.proposed_by = 'fk-doc-gap-seed-2026-07-13'
  and not exists (
    select 1 from goal_solution_tags x
    where x.goal_solution_id = gs.id and x.tag_id = t.id
  );

-- ── #6. Almighty Immunity — boss_exception on every stage (documentation/guardrail) ──
insert into boss_exceptions (dungeon_stage_id, description, source_citation)
select ds.id,
  'Almighty Immunity (passive): Fyro is immune to Stun, Freeze, Sleep, Provoke, Block Active Skills, Block Passive Skills, Fear and True Fear, plus HP-exchange, HP-balancing and cooldown-increase effects. Hard CC works only on the MINIONS, never on the boss — do not field a champion expecting to CC Fyro himself.',
  'AyumiLove Fire Knight''s Castle guide (hand-read factual mechanics), 2026'
from dungeon_stages ds
join dungeons d on d.id = ds.dungeon_id
where d.name = 'Fire Knight''s Castle'
  and not exists (
    select 1 from boss_exceptions x
    where x.dungeon_stage_id = ds.id and x.description like 'Almighty Immunity%'
  );
