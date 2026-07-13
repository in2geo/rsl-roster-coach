-- ============================================================================
-- Seed 126 — Dragon's Lair: finalize (advisor rulings, 2026-07-13)
-- ============================================================================
-- Reviewer approved the 1-25 build (seed 125) + a 10-20 backfill. This flips the
-- new stages live and completes 10-20 per the doc.
--
--   A. WORDING (all-or-nothing Scorch) → explanation_style_note (below); the goal
--      text is left stable for matching.
--   B. ACC-vs-RES distinction → explanation_style_note (below); floors stay as
--      CALIBRATION-NEEDED placeholders (see CLAUDE.md).
--   C. 10-20 BACKFILL (doc-justified, all APPROVED):
--      • add Block Debuffs / Revive / Ally Protection to the 10-20 survival goal
--      • add RES floors (10-14 ≈ 250, 15-20 ≈ 300) — the model had none
--      • fix the over-stated Scorch wording ("DEF-ignoring AoE + unresistable
--        Stun" → "AoE + 1-turn Stun") so players know RES helps
--      • approve the wave "AoE Decrease Turn Meter (resistible)" solution —
--        KEEPING its (Resistible) tag (bypasses_acc=false, needs ACC, 15 champs).
--        NOT retagged to plain "AoE Decrease Turn Meter" (bypasses_acc=true,
--        instant, 51 champs, already an approved solution on the same goal) —
--        they cover different champion pools; retagging would duplicate + drop 15.
--   D. GO-LIVE: flip the new Stages 1-9 & 21-25 (seed 125) proposed → approved.
-- ============================================================================

-- ── C. Fix the over-stated Scorch wording in the live 10-20 boss_exceptions ──
update boss_exceptions be
set description = replace(description, 'massive DEF-ignoring AoE + unresistable Stun', 'AoE + 1-turn Stun')
from dungeon_stages ds join dungeons d on d.id = ds.dungeon_id
where be.dungeon_stage_id = ds.id and d.name = 'Dragon''s Lair'
  and be.description like '%DEF-ignoring AoE + unresistable Stun%';

-- ── C. Backfill the survival goal at 10-20: Block Debuffs / Revive / Ally Protection ──
insert into goal_solutions (goal_id, label, status, source_type, source_note, proposed_by, approved_by, approved_at)
select g.id, s.lbl, 'approved', 'human_observation', s.note, 'dragon-10-20-backfill-2026-07-13', 'advisor-review-2026-07-13', now()
from goals g join phases p on p.id = g.phase_id join dungeon_stages ds on ds.id = p.dungeon_stage_id join dungeons d on d.id = ds.dungeon_id
cross join (values
  ('Block Debuffs (prevent them)', 'A team-wide Block Debuffs buff stops his Poison / Weaken / Decrease ATK landing at all (doc-recommended).'),
  ('Revive fallen allies',         'A Reviver recovers from a bad Scorch / nuke (doc: "if dying easily, include a Reviver").'),
  ('Ally Protection',              'Ally Protection soaks the AoE damage across the team (doc-recommended).')
) as s(lbl, note)
where d.name = 'Dragon''s Lair'
  and ds.stage_number between 10 and 20 and ds.label like 'Stage %'
  and p.phase_type = 'boss'
  and g.description = 'Survive Hellrazor''s debuffs — he applies Decrease ATK, Poison, and Weaken to your team each round.'
  and not exists (select 1 from goal_solutions x where x.goal_id = g.id and x.label = s.lbl);

insert into goal_solution_tags (goal_solution_id, tag_id)
select gs.id, t.id
from goal_solutions gs
join (values ('Block Debuffs (prevent them)','Block Debuffs'), ('Revive fallen allies','Revive'), ('Ally Protection','Ally Protection')) as m(lbl,tname) on m.lbl = gs.label
join tags t on t.name = m.tname
where gs.proposed_by = 'dragon-10-20-backfill-2026-07-13'
  and not exists (select 1 from goal_solution_tags x where x.goal_solution_id = gs.id and x.tag_id = t.id);

-- ── C. Add RES floors to 10-20 (the model had none; doc: ~300 at stage 20) ──
insert into stat_threshold_checks (phase_id, stat, comparison, formula, notes)
select p.id, 'res', 'formula', v.formula, v.note
from phases p join dungeon_stages ds on ds.id = p.dungeon_stage_id join dungeons d on d.id = ds.dungeon_id
cross join (values
  ('10-14', '250', 'RES ~250 to resist Hellrazor''s Poison/Weaken/Decrease-ATK/Scorch-Stun. JUDGMENT CALL (doc: high RES; ~300 by stage 20). CALIBRATION NEEDED.'),
  ('15-20', '300', 'RES ~300 to resist Hellrazor''s debuffs (the doc''s stated stage-20 figure). CALIBRATION NEEDED.')
) as v(band, formula, note)
where d.name = 'Dragon''s Lair' and p.phase_type = 'boss' and ds.label like 'Stage %'
  and ((v.band = '10-14' and ds.stage_number between 10 and 14) or (v.band = '15-20' and ds.stage_number between 15 and 20))
  and not exists (select 1 from stat_threshold_checks x where x.phase_id = p.id and x.stat = 'res');

-- ── C. Approve the wave "AoE Decrease Turn Meter (resistible)" solution (keep its tag) ──
update goal_solutions gs
set status = 'approved', approved_by = 'advisor-review-2026-07-13', approved_at = now()
from goals g, phases p, dungeon_stages ds, dungeons d
where gs.goal_id = g.id and g.phase_id = p.id and p.dungeon_stage_id = ds.id and ds.dungeon_id = d.id
  and d.name = 'Dragon''s Lair' and ds.stage_number between 10 and 20 and ds.label like 'Stage %'
  and p.phase_type = 'wave' and gs.status = 'proposed'
  and gs.label = 'AoE Decrease Turn Meter (resistible — requires ACC)';

-- ── D. Go-live: flip the new Stages 1-9 & 21-25 proposed → approved ──────────
update goal_solutions gs
set status = 'approved', approved_by = 'advisor-review-2026-07-13', approved_at = now()
where gs.status = 'proposed' and gs.proposed_by = 'dragon-full-range-2026-07-13';

-- ── A & B. Explanation-layer notes (read by explain.js) ─────────────────────
insert into explanation_style_notes (topic, note)
select v.topic, v.note
from (values
  ('Dragon''s Lair — Scorch is all-or-nothing',
   'Hellrazor''s Scorch purple bar must be cleared COMPLETELY within the window to re-lock it — partial damage does NOT help. Tell the player it is all-or-nothing: either burst/DoT the whole bar down, or plan to survive the Scorch (AoE + 1-turn Stun). Do not imply chipping the bar reduces the hit.'),
  ('Dragon''s Lair — ACC vs RES are two different jobs',
   'ACC is for YOUR team LANDING debuffs on Hellrazor (Decrease DEF / Weaken / Poison) — your offense; a nuker/debuffer needs it. RES is for RESISTING Hellrazor''s OWN debuffs (Decrease ATK, Poison, Weaken, Scorch Stun) — your defense; supports want ~300 by stage 20. Explain them separately; do not tell a player to raise ACC to avoid the boss''s debuffs (that''s RES), or RES to land their own (that''s ACC).')
) as v(topic, note)
where not exists (select 1 from explanation_style_notes x where x.topic = v.topic);
