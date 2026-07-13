-- ============================================================================
-- Seed 125 — Dragon's Lair: full stage range (Stages 1-9 and 21-25)
-- ============================================================================
-- Extends the existing live Dragon's Lair model (Stages 10-20, seeds 32-39) to the
-- complete Normal ladder (1-25). Stages 10-20 untouched. All rows status='proposed'.
-- proposed_by='dragon-full-range-2026-07-13'.
--
-- SOURCE: Hellrazor mechanics hand-read from the AyumiLove Dragon's Lair guide.
--   - Swipe: AoE + 50% Decrease ATK (2t). Wall of Fire (CD3): AoE + two 5% Poison
--     (3t) + 25% Weaken (2t). Inhale (CD3): depletes his TM, unlocks the SECRET skill
--     Scorch and the purple bar — clear the bar (deal damage) or Scorch fires next
--     turn (AoE + 1t Stun); enough damage re-locks Scorch.
--   - Immune to Stun/Freeze/Sleep/Provoke/Fear + Decrease Turn Meter AND Decrease SPD.
--   - Stages 21-25 ONLY: Almighty Strength (%MaxHP damage capped at 10%) + Almighty
--     Persistence (Turn Meter reduction -50%) — same pair as the other dungeons.
--   - Strategy: Decrease ATK on the boss; nukers/Poison/HP Burn to clear the purple bar;
--     Cleanse + Block Debuffs to counter his Poison/Weaken/Decrease ATK; high RES to
--     resist; Revive / Ally Protection if dying.
--
-- COMPLETENESS NOTE: this build includes Block Debuffs, Revive, Ally Protection on the
-- survival goal and a RES floor — items the doc calls for that the live 10-20 model is
-- MISSING (flagged for a separate 10-20 backfill review).
--
-- TIER FRAMING (mirrors the live model):
--   - Stages 1-6  : Scorch/Inhale NOT active yet (starts stage 7) — simpler fight.
--   - Stages 7-9  : Scorch active, like 10-14.
--   - Stages 21-25: Scorch + the two endgame passives.
--
-- Affinity rotation (doc): Magic 1/5/9/13/17/20/22 · Force 2/6/10/14/18/21/25 ·
--   Spirit 3/7/11/15/19/24 · Void 4/8/12/16/23.
-- Stat floors are JUDGMENT CALLS (stat table is an image); RES ~300 at high stages is
-- the doc's one concrete number.
-- ============================================================================

insert into dungeons (name, has_wave_phase) values ('Dragon''s Lair', true)
on conflict (name) do nothing;

-- ── 1. Stages ───────────────────────────────────────────────────────────────
insert into dungeon_stages (dungeon_id, stage_number, label, notes)
select d.id, s.num, s.lbl, s.note from dungeons d cross join (values
  (1, 'Stage 1', 'Magic affinity. Beginner — Inhale/Scorch not active yet (starts stage 7). Just survive his debuffs and clear him.'),
  (2, 'Stage 2', 'Force affinity. Beginner — no Scorch yet.'),
  (3, 'Stage 3', 'Spirit affinity. Beginner — no Scorch yet.'),
  (4, 'Stage 4', 'Void affinity — no affinity penalty. Beginner — no Scorch yet.'),
  (5, 'Stage 5', 'Magic affinity. Beginner — no Scorch yet.'),
  (6, 'Stage 6', 'Force affinity. Last stage before Scorch/Inhale turns on at stage 7.'),
  (7, 'Stage 7', 'Spirit affinity. Scorch mechanic becomes active from this stage (Inhale → purple bar).'),
  (8, 'Stage 8', 'Void affinity — no affinity penalty. Scorch active.'),
  (9, 'Stage 9', 'Magic affinity. Scorch active. Benchmark before the stat jump at Stage 10+.'),
  (21, 'Stage 21', 'Force affinity. Endgame — Almighty Strength + Almighty Persistence unlock here (see boss exceptions).'),
  (22, 'Stage 22', 'Magic affinity. Endgame — Almighty Strength + Almighty Persistence active.'),
  (23, 'Stage 23', 'Void affinity — no affinity penalty. Endgame — Almighty Strength + Almighty Persistence active.'),
  (24, 'Stage 24', 'Spirit affinity. Endgame — Almighty Strength + Almighty Persistence active.'),
  (25, 'Stage 25', 'Force affinity. Endgame — Almighty Strength + Almighty Persistence active.')
) as s(num,lbl,note) where d.name='Dragon''s Lair' on conflict (dungeon_id,label) do nothing;

-- ── 2. Phases (wave + boss) ─────────────────────────────────────────────────
insert into phases (dungeon_stage_id, phase_type, notes)
select ds.id, 'wave', 'Two waves before Hellrazor. Clear them with AoE CC / damage and preserve HP + cooldowns for the boss.'
from dungeon_stages ds join dungeons d on d.id=ds.dungeon_id
where d.name='Dragon''s Lair' and ds.stage_number in (1,2,3,4,5,6,7,8,9,21,22,23,24,25) and ds.label like 'Stage %'
on conflict (dungeon_stage_id,phase_type) do nothing;

insert into phases (dungeon_stage_id, phase_type, notes)
select ds.id, 'boss', 'Hellrazor the Dragon. Immune to Decrease Turn Meter and Decrease SPD; applies Decrease ATK / Poison / Weaken to your team. From stage 7, Inhale unlocks Scorch (purple bar — clear it with damage or eat an AoE + Stun).'
from dungeon_stages ds join dungeons d on d.id=ds.dungeon_id
where d.name='Dragon''s Lair' and ds.stage_number in (1,2,3,4,5,6,7,8,9,21,22,23,24,25) and ds.label like 'Stage %'
on conflict (dungeon_stage_id,phase_type) do nothing;

-- ── 3. Goals ────────────────────────────────────────────────────────────────
-- 3a. WAVE (all new stages, identical)
insert into goals (phase_id, description, is_informational)
select p.id, g.d, g.info
from phases p join dungeon_stages ds on ds.id=p.dungeon_stage_id join dungeons d on d.id=ds.dungeon_id
cross join (values
  ('Clear the wave before dangerous enemy skills activate.', false),
  ('Preserve team HP and cooldowns entering the boss phase.', true)
) as g(d,info)
where d.name='Dragon''s Lair' and ds.stage_number in (1,2,3,4,5,6,7,8,9,21,22,23,24,25) and ds.label like 'Stage %' and p.phase_type='wave'
  and not exists (select 1 from goals x where x.phase_id=p.id and x.description=g.d);

-- 3b. BOSS — Stages 1-6 (no Scorch)
insert into goals (phase_id, description, is_informational)
select p.id, g.d, g.info
from phases p join dungeon_stages ds on ds.id=p.dungeon_stage_id join dungeons d on d.id=ds.dungeon_id
cross join (values
  ('Hellrazor is immune to Decrease Turn Meter and Decrease SPD — do not rely on slowing him; speed up your own team instead.', true),
  ('Deal steady damage to clear Hellrazor — Inhale/Scorch is not active yet at these stages, so there is no purple-bar race.', false),
  ('Apply Decrease Defense and Weaken to Hellrazor to amplify your damage.', false),
  ('Survive Hellrazor''s debuffs — Swipe (Decrease ATK), Wall of Fire (Poison + Weaken).', false)
) as g(d,info)
where d.name='Dragon''s Lair' and ds.stage_number between 1 and 6 and ds.label like 'Stage %' and p.phase_type='boss'
  and not exists (select 1 from goals x where x.phase_id=p.id and x.description=g.d);

-- 3c. BOSS — Stages 7-9 (Scorch active)
insert into goals (phase_id, description, is_informational)
select p.id, g.d, g.info
from phases p join dungeon_stages ds on ds.id=p.dungeon_stage_id join dungeons d on d.id=ds.dungeon_id
cross join (values
  ('Hellrazor is immune to Decrease Turn Meter and Decrease SPD — do not rely on slowing him; speed up your own team instead.', true),
  ('Clear the Scorch bar before Hellrazor acts — Inhale depletes his Turn Meter and unlocks Scorch (AoE + Stun); enough damage re-locks it.', false),
  ('Apply Decrease Defense and Weaken to Hellrazor to amplify your damage.', false),
  ('Survive Hellrazor''s debuffs — Swipe (Decrease ATK), Wall of Fire (Poison + Weaken), and the Scorch Stun.', false)
) as g(d,info)
where d.name='Dragon''s Lair' and ds.stage_number between 7 and 9 and ds.label like 'Stage %' and p.phase_type='boss'
  and not exists (select 1 from goals x where x.phase_id=p.id and x.description=g.d);

-- 3d. BOSS — Stages 21-25 (Scorch + passives)
insert into goals (phase_id, description, is_informational)
select p.id, g.d, g.info
from phases p join dungeon_stages ds on ds.id=p.dungeon_stage_id join dungeons d on d.id=ds.dungeon_id
cross join (values
  ('Hellrazor is immune to Decrease Turn Meter and Decrease SPD, and Almighty Persistence halves any Turn Meter reduction — speed up your own team instead.', true),
  ('Clear the Scorch bar before Hellrazor acts — %MaxHP nukes are capped here (Almighty Strength), so raw burst / Poison / HP Burn clear the purple bar.', false),
  ('Apply Decrease Defense and Weaken to Hellrazor to amplify your damage.', false),
  ('Survive Hellrazor''s debuffs — Swipe (Decrease ATK), Wall of Fire (Poison + Weaken), and the Scorch Stun.', false)
) as g(d,info)
where d.name='Dragon''s Lair' and ds.stage_number between 21 and 25 and ds.label like 'Stage %' and p.phase_type='boss'
  and not exists (select 1 from goals x where x.phase_id=p.id and x.description=g.d);

-- ── 4. Goal solutions ───────────────────────────────────────────────────────
insert into goal_solutions (goal_id, label, status, source_type, source_note, proposed_by)
select g.id, s.lbl, 'proposed', 'human_observation', s.note, 'dragon-full-range-2026-07-13'
from goals g join phases p on p.id=g.phase_id join dungeon_stages ds on ds.id=p.dungeon_stage_id join dungeons d on d.id=ds.dungeon_id
cross join (values
  -- WAVE (all tiers)
  ('Clear the wave before dangerous enemy skills activate.','AoE Stun','Stuns the wave, denying their turns.'),
  ('Clear the wave before dangerous enemy skills activate.','AoE Freeze','Freezes the wave.'),
  ('Clear the wave before dangerous enemy skills activate.','AoE Decrease Turn Meter','Pushes the wave back so you act first.'),
  ('Clear the wave before dangerous enemy skills activate.','AoE Damage','Raw AoE clears the wave quickly.'),
  -- 1-6 damage
  ('Deal steady damage to clear Hellrazor — Inhale/Scorch is not active yet at these stages, so there is no purple-bar race.','Poison stacking','Poison chips his HP over the fight.'),
  ('Deal steady damage to clear Hellrazor — Inhale/Scorch is not active yet at these stages, so there is no purple-bar race.','HP Burn','HP Burn adds damage-over-time.'),
  ('Deal steady damage to clear Hellrazor — Inhale/Scorch is not active yet at these stages, so there is no purple-bar race.','High burst AoE damage','Raw burst clears the low-stage Dragon fast.'),
  -- 7-9 & 21-25 scorch-bar damage
  ('Clear the Scorch bar before Hellrazor acts — Inhale depletes his Turn Meter and unlocks Scorch (AoE + Stun); enough damage re-locks it.','Poison stacking','Poison damage helps erode the purple bar.'),
  ('Clear the Scorch bar before Hellrazor acts — Inhale depletes his Turn Meter and unlocks Scorch (AoE + Stun); enough damage re-locks it.','HP Burn','HP Burn contributes damage to re-lock Scorch.'),
  ('Clear the Scorch bar before Hellrazor acts — Inhale depletes his Turn Meter and unlocks Scorch (AoE + Stun); enough damage re-locks it.','High burst AoE damage','Nukers burst the purple bar in the Inhale window.'),
  ('Clear the Scorch bar before Hellrazor acts — %MaxHP nukes are capped here (Almighty Strength), so raw burst / Poison / HP Burn clear the purple bar.','Poison stacking','Poison is not capped by Almighty Strength.'),
  ('Clear the Scorch bar before Hellrazor acts — %MaxHP nukes are capped here (Almighty Strength), so raw burst / Poison / HP Burn clear the purple bar.','HP Burn','HP Burn is not capped by Almighty Strength.'),
  ('Clear the Scorch bar before Hellrazor acts — %MaxHP nukes are capped here (Almighty Strength), so raw burst / Poison / HP Burn clear the purple bar.','High burst AoE damage','Raw (non-%MaxHP) burst clears the purple bar.'),
  -- amplify (all tiers, same descriptions)
  ('Apply Decrease Defense and Weaken to Hellrazor to amplify your damage.','Decrease Defense + Weaken','Decrease DEF + Weaken maximize the damage into the bar.'),
  ('Apply Decrease Defense and Weaken to Hellrazor to amplify your damage.','Decrease Defense only','Decrease DEF alone still amplifies burst.'),
  -- survive (all tiers) — the COMPLETE set per the doc
  ('Survive Hellrazor''s debuffs — Swipe (Decrease ATK), Wall of Fire (Poison + Weaken).','Cleanse (Remove Debuff)','Removes the Poison / Weaken / Decrease ATK he applies.'),
  ('Survive Hellrazor''s debuffs — Swipe (Decrease ATK), Wall of Fire (Poison + Weaken).','Block Debuffs (prevent them)','A team-wide Block Debuffs buff stops his debuffs landing at all.'),
  ('Survive Hellrazor''s debuffs — Swipe (Decrease ATK), Wall of Fire (Poison + Weaken).','Continuous Heal + high HP','Sustains through the Poison chip and Swipe.'),
  ('Survive Hellrazor''s debuffs — Swipe (Decrease ATK), Wall of Fire (Poison + Weaken).','Decrease Attack on Hellrazor','Decrease ATK on the boss cuts his nuke damage.'),
  ('Survive Hellrazor''s debuffs — Swipe (Decrease ATK), Wall of Fire (Poison + Weaken).','Revive fallen allies','A Reviver recovers from a bad Scorch / nuke.'),
  ('Survive Hellrazor''s debuffs — Swipe (Decrease ATK), Wall of Fire (Poison + Weaken).','Ally Protection','Ally Protection soaks the AoE damage across the team.'),
  ('Survive Hellrazor''s debuffs — Swipe (Decrease ATK), Wall of Fire (Poison + Weaken), and the Scorch Stun.','Cleanse (Remove Debuff)','Removes the Poison / Weaken / Decrease ATK and can clear the Scorch Stun.'),
  ('Survive Hellrazor''s debuffs — Swipe (Decrease ATK), Wall of Fire (Poison + Weaken), and the Scorch Stun.','Block Debuffs (prevent them)','A team-wide Block Debuffs buff stops his debuffs landing.'),
  ('Survive Hellrazor''s debuffs — Swipe (Decrease ATK), Wall of Fire (Poison + Weaken), and the Scorch Stun.','Continuous Heal + high HP','Sustains through Poison, Swipe and the Scorch AoE.'),
  ('Survive Hellrazor''s debuffs — Swipe (Decrease ATK), Wall of Fire (Poison + Weaken), and the Scorch Stun.','Decrease Attack on Hellrazor','Decrease ATK on the boss cuts his Scorch / nuke damage.'),
  ('Survive Hellrazor''s debuffs — Swipe (Decrease ATK), Wall of Fire (Poison + Weaken), and the Scorch Stun.','Revive fallen allies','A Reviver recovers from a bad Scorch.'),
  ('Survive Hellrazor''s debuffs — Swipe (Decrease ATK), Wall of Fire (Poison + Weaken), and the Scorch Stun.','Ally Protection','Ally Protection soaks the Scorch AoE across the team.')
) as s(gdesc,lbl,note)
where d.name='Dragon''s Lair' and (ds.stage_number between 1 and 9 or ds.stage_number between 21 and 25) and ds.label like 'Stage %'
  and g.description=s.gdesc
  and not exists (select 1 from goal_solutions x where x.goal_id=g.id and x.label=s.lbl);

-- ── 5. Goal solution tags (global label -> tag map, scoped to this seed) ─────
insert into goal_solution_tags (goal_solution_id, tag_id)
select gs.id, t.id from goal_solutions gs
join (values
  ('AoE Stun','AoE Stun'),
  ('AoE Freeze','AoE Freeze'),
  ('AoE Decrease Turn Meter','AoE Decrease Turn Meter'),
  ('AoE Damage','AoE Damage'),
  ('Poison stacking','Poison'),
  ('HP Burn','HP Burn'),
  ('High burst AoE damage','AoE Damage'),
  ('Decrease Defense + Weaken','Decrease Defense'),
  ('Decrease Defense + Weaken','Weaken'),
  ('Decrease Defense only','Decrease Defense'),
  ('Cleanse (Remove Debuff)','Cleanse'),
  ('Block Debuffs (prevent them)','Block Debuffs'),
  ('Continuous Heal + high HP','Continuous Heal'),
  ('Decrease Attack on Hellrazor','Decrease Attack'),
  ('Revive fallen allies','Revive'),
  ('Ally Protection','Ally Protection')
) as m(lbl,tname) on m.lbl=gs.label
join tags t on t.name=m.tname
where gs.proposed_by='dragon-full-range-2026-07-13'
  and not exists (select 1 from goal_solution_tags x where x.goal_solution_id=gs.id and x.tag_id=t.id);

-- ── 6. Stat threshold checks (boss phase; JUDGMENT CALLS + doc's RES 300) ────
insert into stat_threshold_checks (phase_id, stat, comparison, formula, notes)
select p.id, v.stat, 'formula', v.formula, v.note
from phases p join dungeon_stages ds on ds.id=p.dungeon_stage_id join dungeons d on d.id=ds.dungeon_id
cross join (values
  ('1-6',   'acc', '100', 'Stages 1-6: ACC ~100 to land Decrease DEF/Weaken/Poison. Beginner JUDGMENT CALL, below the 10-14 floor (150).'),
  ('7-9',   'acc', '130', 'Stages 7-9: ACC ~130. JUDGMENT CALL between beginner and the 10-14 floor (150).'),
  ('7-9',   'res', '200', 'Stages 7-9: RES ~200 to resist Hellrazor''s Poison/Weaken/Stun. JUDGMENT CALL (doc: high RES needed; ~300 at stage 20).'),
  ('21-25', 'acc', '250', 'Stages 21-25: ACC ~250 to land debuffs at endgame RES. JUDGMENT CALL, above the 15-20 floor (225).'),
  ('21-25', 'res', '300', 'Stages 21-25: RES ~300 to resist Hellrazor''s Poison/Weaken/Scorch-Stun (the doc''s stated high-stage figure).')
) as v(tier,stat,formula,note)
where d.name='Dragon''s Lair' and p.phase_type='boss' and ds.label like 'Stage %'
  and ((v.tier='1-6' and ds.stage_number between 1 and 6) or (v.tier='7-9' and ds.stage_number between 7 and 9) or (v.tier='21-25' and ds.stage_number between 21 and 25))
  and not exists (select 1 from stat_threshold_checks x where x.phase_id=p.id and x.stat=v.stat);

-- ── 7. Boss exceptions ──────────────────────────────────────────────────────
-- Universal (all new stages): immunity + Scorch/Inhale framing.
insert into boss_exceptions (dungeon_stage_id, description, source_citation)
select ds.id, e.descr, 'AyumiLove Dragon''s Lair guide (hand-read factual mechanics), 2026'
from dungeon_stages ds join dungeons d on d.id=ds.dungeon_id
cross join (values
  ('Almighty Immunity (passive): Hellrazor is immune to Stun, Freeze, Sleep, Provoke, Fear/True Fear, cooldown-increase, AND both Decrease Turn Meter and Decrease SPD. You cannot slow him — speed up your own team instead.'),
  ('Inhale (CD3) depletes Hellrazor''s Turn Meter and unlocks the secret skill Scorch, turning part of his HP purple. Deal enough damage to clear the purple bar and Scorch stays locked; otherwise Scorch fires (AoE + 1-turn Stun). Scorch is active from stage 7.')
) as e(descr)
where d.name='Dragon''s Lair' and ds.label like 'Stage %'
  and (ds.stage_number between 1 and 9 or ds.stage_number between 21 and 25)
  and not exists (select 1 from boss_exceptions x where x.dungeon_stage_id=ds.id and x.description=e.descr);

-- Stages 21-25 only — the two endgame passives.
insert into boss_exceptions (dungeon_stage_id, description, source_citation)
select ds.id, e.descr, 'AyumiLove Dragon''s Lair guide (hand-read factual mechanics), 2026'
from dungeon_stages ds join dungeons d on d.id=ds.dungeon_id
cross join (values
  ('Almighty Strength (Stages 21-25): damage from skills that scale on enemy MAX HP cannot exceed 10% of Hellrazor''s MAX HP. %MaxHP nukes fall off — clear the purple bar with raw burst / Poison / HP Burn.'),
  ('Almighty Persistence (Stages 21-25): all Turn Meter reduction against Hellrazor is decreased by 50% (on top of his innate Decrease-TM immunity).')
) as e(descr)
where d.name='Dragon''s Lair' and ds.stage_number between 21 and 25 and ds.label like 'Stage %'
  and not exists (select 1 from boss_exceptions x where x.dungeon_stage_id=ds.id and x.description=e.descr);
