-- ============================================================================
-- Seed 122 — Ice Golem's Peak: full stage range (Stages 1-9 and 21-25)
-- ============================================================================
-- Extends the existing live Ice Golem model (Stages 10-20) to the complete Normal
-- ladder (1-25), mirroring the Fire Knight treatment. Stages 10-20 are untouched.
-- All rows are status='proposed' (no-auto-merge). proposed_by='ig-full-range-2026-07-13'.
--
-- SOURCE: Klyssus mechanics hand-read from the AyumiLove Ice Golem's Peak guide
-- (factual game data — boss skills, the Frigid Vengeance revive/freeze passive,
-- affinity rotation, the two Stage 21-25 passives). source_type='human_observation'.
--
-- KLYSSUS — the mechanic that shapes every goal:
--   • 2 minions apply Heal Reduction + Decrease DEF to your team and must be killed
--     first. Klyssus's Frigid Vengeance passive REVIVES dead minions to 100% at 5 HP
--     thresholds (80/60/45/30/15%), ignores 50% DEF per alive ally, and Freezes
--     (chance rises with each alive minion). So: keep minions dead (Block Revive)
--     and DON'T burst the boss — Poison / HP Burn erode his HP WITHOUT triggering
--     Frigid Vengeance (the passive doesn't fire on DoT damage).
--   • Numbing Chill (CD4): AoE 50% Decrease ACC — cleanse it or run high base ACC.
--   • Almighty Immunity: CC works on the MINIONS, never the boss.
--   • Stages 21-25 ONLY: Almighty Strength (%MaxHP damage capped at 10%) + Almighty
--     Persistence (Turn Meter reduction -50%) — same pair as Fire Knight / Spider.
--
-- TIER FRAMING (mirrors the live bands: 10-13 forgiving, 14-20 dangerous):
--   • Stages 1-9  — beginner: Frigid Vengeance forgiving, burst survivable, low floors.
--   • Stages 21-25 — endgame: hardest band + the two passives; DoTs are the main path
--     (Almighty Strength caps %MaxHP burst, so Poison / HP Burn dominate).
--
-- Affinity rotation (matches the doc; live 10-20 rows already consistent):
--   Spirit 1/5/9/13/17/20/24 · Magic 2/6/10/14/18/21/25 · Force 3/7/11/15/19/23 · Void 4/8/12/16/22
--
-- Stat floors are JUDGMENT CALLS (the doc's Klyssus stat table is an image): 1-9
-- extends the forgiving 10-13 floors downward; 21-25 extends the 15-20 floors up.
-- ============================================================================

insert into dungeons (name, has_wave_phase) values ('Ice Golem''s Peak', true)
on conflict (name) do nothing;

-- ── 1. Stages ───────────────────────────────────────────────────────────────
insert into dungeon_stages (dungeon_id, stage_number, label, notes)
select d.id, s.num, s.lbl, s.note
from dungeons d
cross join (values
  (1, 'Stage 1', 'Spirit affinity. Beginner — Frigid Vengeance present but very forgiving; burst is survivable.'),
  (2, 'Stage 2', 'Magic affinity. Beginner — Frigid Vengeance forgiving.'),
  (3, 'Stage 3', 'Force affinity. Beginner — Frigid Vengeance forgiving.'),
  (4, 'Stage 4', 'Void affinity — no affinity advantage or penalty. Beginner — Frigid Vengeance forgiving.'),
  (5, 'Stage 5', 'Spirit affinity. Beginner — Frigid Vengeance forgiving.'),
  (6, 'Stage 6', 'Magic affinity. Beginner — Frigid Vengeance forgiving.'),
  (7, 'Stage 7', 'Force affinity. Beginner — Frigid Vengeance forgiving.'),
  (8, 'Stage 8', 'Void affinity — no affinity advantage or penalty. Beginner — Frigid Vengeance forgiving.'),
  (9, 'Stage 9', 'Spirit affinity. Last beginner stage before floors rise toward Stage 10+.'),
  (21, 'Stage 21', 'Magic affinity. Endgame — Almighty Strength + Almighty Persistence unlock here (see boss exceptions). DoTs over burst.'),
  (22, 'Stage 22', 'Void affinity — no affinity advantage or penalty. Endgame — Almighty Strength + Almighty Persistence active.'),
  (23, 'Stage 23', 'Force affinity. Endgame — Almighty Strength + Almighty Persistence active.'),
  (24, 'Stage 24', 'Spirit affinity. Endgame — Almighty Strength + Almighty Persistence active.'),
  (25, 'Stage 25', 'Magic affinity. Endgame — Almighty Strength + Almighty Persistence active.')
) as s(num, lbl, note)
where d.name = 'Ice Golem''s Peak'
on conflict (dungeon_id, label) do nothing;

-- ── 2. Phases (wave = minions, boss = Klyssus) ──────────────────────────────
insert into phases (dungeon_stage_id, phase_type, notes)
select ds.id, 'wave',
  'Klyssus''s 2 minions (they apply Heal Reduction + Decrease DEF and are revived by Frigid Vengeance). Kill them first; the deadlier minion applies Decrease DEF.'
from dungeon_stages ds join dungeons d on d.id = ds.dungeon_id
where d.name = 'Ice Golem''s Peak'
  and ds.label in ('Stage 1','Stage 2','Stage 3','Stage 4','Stage 5','Stage 6','Stage 7','Stage 8','Stage 9',
                   'Stage 21','Stage 22','Stage 23','Stage 24','Stage 25')
on conflict (dungeon_stage_id, phase_type) do nothing;

insert into phases (dungeon_stage_id, phase_type, notes)
select ds.id, 'boss',
  'Klyssus. Frigid Vengeance revives minions + Freezes at 5 HP thresholds — do NOT burst; erode HP with Poison / HP Burn and keep minions dead (Block Revive). Boss immune to all hard CC.'
from dungeon_stages ds join dungeons d on d.id = ds.dungeon_id
where d.name = 'Ice Golem''s Peak'
  and ds.label in ('Stage 1','Stage 2','Stage 3','Stage 4','Stage 5','Stage 6','Stage 7','Stage 8','Stage 9',
                   'Stage 21','Stage 22','Stage 23','Stage 24','Stage 25')
on conflict (dungeon_stage_id, phase_type) do nothing;

-- ── 3. Goals ────────────────────────────────────────────────────────────────
-- 3a. Stages 1-9 — WAVE
insert into goals (phase_id, description, is_informational)
select p.id, g.d, g.info
from phases p join dungeon_stages ds on ds.id = p.dungeon_stage_id join dungeons d on d.id = ds.dungeon_id
cross join (values
  ('Kill both minions before the boss phase — forgiving at low stages, but good practice.', false),
  ('Kill the right minion first — it applies a Decrease DEF debuff that amplifies the boss AoE.', true)
) as g(d, info)
where d.name = 'Ice Golem''s Peak' and ds.stage_number between 1 and 9 and p.phase_type = 'wave'
  and not exists (select 1 from goals x where x.phase_id = p.id and x.description = g.d);

-- 3b. Stages 1-9 — BOSS
insert into goals (phase_id, description, is_informational)
select p.id, g.d, g.info
from phases p join dungeon_stages ds on ds.id = p.dungeon_stage_id join dungeons d on d.id = ds.dungeon_id
cross join (values
  ('Avoid Counterattack / Reflect Damage champions — they can chain-trigger Frigid Vengeance.', true),
  ('Deal consistent damage to clear Klyssus — burst is survivable at these low stages.', false)
) as g(d, info)
where d.name = 'Ice Golem''s Peak' and ds.stage_number between 1 and 9 and p.phase_type = 'boss'
  and not exists (select 1 from goals x where x.phase_id = p.id and x.description = g.d);

-- 3c. Stages 21-25 — WAVE
insert into goals (phase_id, description, is_informational)
select p.id, g.d, g.info
from phases p join dungeon_stages ds on ds.id = p.dungeon_stage_id join dungeons d on d.id = ds.dungeon_id
cross join (values
  ('Kill both minions before the boss phase — alive minions during Frigid Vengeance make it lethal (revived to 100%, +DEF-ignore and Freeze).', false),
  ('Kill the right minion first — the more dangerous attack pattern (Decrease DEF).', true)
) as g(d, info)
where d.name = 'Ice Golem''s Peak' and ds.stage_number between 21 and 25 and p.phase_type = 'wave'
  and not exists (select 1 from goals x where x.phase_id = p.id and x.description = g.d);

-- 3d. Stages 21-25 — BOSS
insert into goals (phase_id, description, is_informational)
select p.id, g.d, g.info
from phases p join dungeon_stages ds on ds.id = p.dungeon_stage_id join dungeons d on d.id = ds.dungeon_id
cross join (values
  ('Avoid Counterattack / Reflect Damage champions — Frigid Vengeance chain-trigger risk.', true),
  ('Avoid triggering Frigid Vengeance with burst — erode Klyssus''s HP with Poison / HP Burn (%MaxHP burst is capped by Almighty Strength, so DoTs are the main path).', false),
  ('Keep the minions dead or Block Revive active — alive minions make Frigid Vengeance nearly unsurvivable.', false),
  ('Resist or cleanse Numbing Chill (50% Decrease ACC for 2 turns) so your debuffs keep landing.', false),
  ('Build RES to resist the Frigid Vengeance Freeze — the chance rises with each alive minion.', true)
) as g(d, info)
where d.name = 'Ice Golem''s Peak' and ds.stage_number between 21 and 25 and p.phase_type = 'boss'
  and not exists (select 1 from goals x where x.phase_id = p.id and x.description = g.d);

-- ── 4. Goal solutions (label-only; tags in §5) ──────────────────────────────
insert into goal_solutions (goal_id, label, status, source_type, source_note, proposed_by)
select g.id, s.lbl, 'proposed', 'human_observation', s.note, 'ig-full-range-2026-07-13'
from goals g
join phases p on p.id = g.phase_id
join dungeon_stages ds on ds.id = p.dungeon_stage_id
join dungeons d on d.id = ds.dungeon_id
cross join (values
  -- 1-9 wave: kill minions
  ('Kill both minions before the boss phase — forgiving at low stages, but good practice.',
     'Block Revive', 'Kill a minion in one hit with Block Revive active so it cannot be revived.'),
  ('Kill both minions before the boss phase — forgiving at low stages, but good practice.',
     'AoE Stun (control minions)', 'Stun the minions (they are NOT immune — only Klyssus is) to stop their Heal Reduction / Decrease DEF.'),
  ('Kill both minions before the boss phase — forgiving at low stages, but good practice.',
     'AoE Freeze (control minions)', 'Freeze the minions — same control outcome as Stun.'),
  ('Kill both minions before the boss phase — forgiving at low stages, but good practice.',
     'AoE Damage (clear minions)', 'Raw AoE clears the low-HP minions at beginner stages.'),
  -- 1-9 boss: consistent damage
  ('Deal consistent damage to clear Klyssus — burst is survivable at these low stages.',
     'Direct AoE damage', 'At low stages Frigid Vengeance is forgiving, so raw AoE clears the boss.'),
  ('Deal consistent damage to clear Klyssus — burst is survivable at these low stages.',
     'Poison (gradual, forward-compatible)', 'Poison erodes HP without triggering Frigid Vengeance — the habit to carry into higher stages.'),
  -- 21-25 wave: kill minions
  ('Kill both minions before the boss phase — alive minions during Frigid Vengeance make it lethal (revived to 100%, +DEF-ignore and Freeze).',
     'Block Revive', 'One-shot a minion with Block Revive so Frigid Vengeance cannot bring it back (Block Revive needs no ACC).'),
  ('Kill both minions before the boss phase — alive minions during Frigid Vengeance make it lethal (revived to 100%, +DEF-ignore and Freeze).',
     'AoE Damage + Decrease DEF', 'Decrease DEF lets AoE actually kill the tankier endgame minions.'),
  ('Kill both minions before the boss phase — alive minions during Frigid Vengeance make it lethal (revived to 100%, +DEF-ignore and Freeze).',
     'AoE Stun (control minions)', 'Lock the minions while you finish them.'),
  ('Kill both minions before the boss phase — alive minions during Frigid Vengeance make it lethal (revived to 100%, +DEF-ignore and Freeze).',
     'AoE Freeze (control minions)', 'Freeze the minions to deny their debuffs.'),
  -- 21-25 boss: avoid Frigid Vengeance
  ('Avoid triggering Frigid Vengeance with burst — erode Klyssus''s HP with Poison / HP Burn (%MaxHP burst is capped by Almighty Strength, so DoTs are the main path).',
     'Poison stacking', 'Poison damage does not trigger Frigid Vengeance and is not capped by Almighty Strength.'),
  ('Avoid triggering Frigid Vengeance with burst — erode Klyssus''s HP with Poison / HP Burn (%MaxHP burst is capped by Almighty Strength, so DoTs are the main path).',
     'HP Burn', 'HP Burn erodes HP without triggering the passive — pairs with Poison.'),
  -- 21-25 boss: minions dead
  ('Keep the minions dead or Block Revive active — alive minions make Frigid Vengeance nearly unsurvivable.',
     'Block Revive', 'Block Revive keeps the minions from coming back on Frigid Vengeance triggers.'),
  -- 21-25 boss: numbing chill
  ('Resist or cleanse Numbing Chill (50% Decrease ACC for 2 turns) so your debuffs keep landing.',
     'Cleanse (removes Decrease ACC)', 'Cleanse the Numbing Chill Decrease ACC so Poison / debuffs keep landing.')
) as s(goal_desc, lbl, note)
where d.name = 'Ice Golem''s Peak'
  and (ds.stage_number between 1 and 9 or ds.stage_number between 21 and 25)
  and g.description = s.goal_desc
  and not exists (select 1 from goal_solutions x where x.goal_id = g.id and x.label = s.lbl);

-- ── 5. Goal solution tags (global label -> tag map, scoped to this seed) ─────
insert into goal_solution_tags (goal_solution_id, tag_id)
select gs.id, t.id
from goal_solutions gs
join (values
  ('Block Revive',                          'Block Revive'),
  ('AoE Stun (control minions)',            'AoE Stun'),
  ('AoE Freeze (control minions)',          'AoE Freeze'),
  ('AoE Damage (clear minions)',            'AoE Damage'),
  ('Direct AoE damage',                     'AoE Damage'),
  ('Poison (gradual, forward-compatible)',  'Poison'),
  ('AoE Damage + Decrease DEF',             'AoE Damage'),
  ('AoE Damage + Decrease DEF',             'Decrease Defense'),
  ('Poison stacking',                       'Poison'),
  ('HP Burn',                               'HP Burn'),
  ('Cleanse (removes Decrease ACC)',        'Cleanse')
) as m(lbl, tag_name) on m.lbl = gs.label
join tags t on t.name = m.tag_name
where gs.proposed_by = 'ig-full-range-2026-07-13'
  and not exists (select 1 from goal_solution_tags x where x.goal_solution_id = gs.id and x.tag_id = t.id);

-- ── 6. Stat threshold checks (boss phase; JUDGMENT CALLS, extend the live bands) ──
insert into stat_threshold_checks (phase_id, stat, comparison, formula, notes)
select p.id, v.stat, 'formula', v.formula, v.note
from phases p join dungeon_stages ds on ds.id = p.dungeon_stage_id join dungeons d on d.id = ds.dungeon_id
cross join (values
  ('1-9',   'acc', '80',    'Stages 1-9: ACC ~80 to land Poison at beginner stages. JUDGMENT CALL, below the 10-13 floor (120).'),
  ('1-9',   'hp',  '5000',  'Stages 1-9: HP ~5000 floor — beginner, below the battle-log-derived 10-13 floor (8000). JUDGMENT CALL.'),
  ('21-25', 'acc', '210',   'Stages 21-25: ACC ~210 to keep Poison/debuffs landing through Numbing Chill. JUDGMENT CALL, above the 15-20 floor (200).'),
  ('21-25', 'res', '210',   'Stages 21-25: RES ~210 to resist Frigid Vengeance Freeze (chance rises per alive minion). JUDGMENT CALL, above 15-20 (200).'),
  ('21-25', 'hp',  '45000', 'Stages 21-25: HP ~45000 to survive Frigid Vengeance with minions up. JUDGMENT CALL, above 15-20 (40000). Recalibrate with account data.')
) as v(tier, stat, formula, note)
where d.name = 'Ice Golem''s Peak'
  and p.phase_type = 'boss'
  and ((v.tier = '1-9' and ds.stage_number between 1 and 9) or (v.tier = '21-25' and ds.stage_number between 21 and 25))
  and not exists (select 1 from stat_threshold_checks x where x.phase_id = p.id and x.stat = v.stat);

-- ── 7. Boss exceptions ──────────────────────────────────────────────────────
-- Universal (both new tiers): Frigid Vengeance + Almighty Immunity.
insert into boss_exceptions (dungeon_stage_id, description, source_citation)
select ds.id, e.descr, 'AyumiLove Ice Golem''s Peak guide (hand-read factual mechanics), 2026'
from dungeon_stages ds join dungeons d on d.id = ds.dungeon_id
cross join (values
  ('Frigid Vengeance (passive): Klyssus attacks all enemies at 80/60/45/30/15% HP, REVIVING dead minions to 100%, ignoring 50% DEF per alive minion (Klyssus''s allies = the minions; 0% with none up, 100% with both), and Freezing (20% + 40% per alive minion). Do NOT burst — erode HP with Poison / HP Burn (which does not trigger it) and keep minions dead with Block Revive.'),
  ('Almighty Immunity (passive): Klyssus is immune to Stun, Freeze, Sleep, Provoke, Fear/True Fear and cooldown-increase effects. Hard CC works only on the MINIONS, never the boss.')
) as e(descr)
where d.name = 'Ice Golem''s Peak'
  and ds.label like 'Stage %'   -- Normal stages only (excludes the "Hard Stage N" stubs)
  and (ds.stage_number between 1 and 9 or ds.stage_number between 21 and 25)
  and not exists (select 1 from boss_exceptions x where x.dungeon_stage_id = ds.id and x.description = e.descr);

-- Stages 21-25 only — the two endgame passives.
insert into boss_exceptions (dungeon_stage_id, description, source_citation)
select ds.id, e.descr, 'AyumiLove Ice Golem''s Peak guide (hand-read factual mechanics), 2026'
from dungeon_stages ds join dungeons d on d.id = ds.dungeon_id
cross join (values
  ('Almighty Strength (Stages 21-25): damage from skills that scale on enemy MAX HP cannot exceed 10% of Klyssus''s MAX HP. %MaxHP nukes fall off — Poison / HP Burn DoTs are the path.'),
  ('Almighty Persistence (Stages 21-25): all Turn Meter reduction against Klyssus is decreased by 50%.')
) as e(descr)
where d.name = 'Ice Golem''s Peak'
  and ds.label like 'Stage %'   -- Normal stages only
  and ds.stage_number between 21 and 25
  and not exists (select 1 from boss_exceptions x where x.dungeon_stage_id = ds.id and x.description = e.descr);
