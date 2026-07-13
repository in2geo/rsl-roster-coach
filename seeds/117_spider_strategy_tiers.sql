-- ============================================================================
-- Seed 117 — Spider's Den: strategy-tier model for the full 1-25 ladder
-- ============================================================================
-- Rebuilds Spider's Den around the THREE strategy tiers the AyumiLove Spider guide
-- describes, replacing the ad-hoc live rows (`Stages 1-6` / `Stages 7-10`) which
-- were split on an ACC boundary, not strategy. Everything here is status='proposed'.
--
-- STRATEGY TIERS (the doc's core structure):
--   • Stages 1-14  — AoE NUKE: kill the Spiderlings with AoE damage before they act.
--   • Stages 15-20 — the WALL: raw AoE stops working; use %Enemy-MaxHP damage,
--                    Poison, or HP Burn.
--   • Stages 21-25 — AoE HP BURN: %MaxHP damage is capped (Almighty Strength), so
--                    HP Burn is the path.
--
-- SKAVAG (Spider Queen) MECHANICS driving the goals (hand-read, factual):
--   - Spiderlings spawn constantly (max 10), stacking 5% MaxHP Poison — they wipe
--     even tanky champs. Control/kill them every round.
--   - Skavag CONSUMES Spiderlings to heal 3% MaxHP and permanently +10% ATK EACH —
--     she snowballs the longer the fight runs. Deny her turn + kill fast.
--   - Almighty Immunity: boss immune to Stun/Freeze/Sleep/Provoke/Fear + cooldown-
--     increase. Hard CC works only on the SPIDERLINGS, never the boss.
--   - Healing Assured: boss immune to Heal Reduction.
--   - Lifesteal / heal-on-damage heals only 35% vs Spider — sustain via direct
--     heals / shields, not lifesteal.
--   - Stages 21-25 ONLY: Almighty Strength (%MaxHP damage capped at 10%) +
--     Almighty Persistence (Turn Meter reduction −50%).
--
-- STAT FLOORS (doc formulas; needs the evalFormula 'stage*N+M' support added alongside):
--   - ACC = stage × 11 (≈ enemy RES + 25, up to ~225). NOTE: differs from the live
--     model's stage × 10 and CLAUDE.md open-question #3 ("Plarium: stage × 10") —
--     flagged for the advisor to reconcile.
--   - RES = stage × 10 + 100 (≈ enemy ACC + 100), capped at 300 (used flat for 21-25).
--     This is the "resist the Spiderling Poison" survival path — a Shield/CC team can
--     substitute for it, so weight it as advisory (advisor call).
--
-- Affinity rotation (reference; tiers span multiple affinities):
--   Void 1/5/9/13/17/21 · Magic 2/6/10/14/18/22/25 · Force 3/7/11/15/19/23 · Spirit 4/8/12/16/20/24
--
-- ── STAGING / NO-REGRESSION ─────────────────────────────────────────────────
-- These 3 tiers are seeded PROPOSED and are NOT wired into the engine yet. The
-- Spider scan (SPIDER_SCAN_GROUPS) still points at the live `Stages 1-6` / `7-10`
-- rows, so live Spider is unchanged until an approval pass: flip proposed→approved,
-- repoint SPIDER_SCAN_GROUPS to these tiers (extended to 25), and delete the old
-- rows. proposed_by = 'spider-tiers-seed-2026-07-13' scopes every row here.
-- ============================================================================

insert into dungeons (name, has_wave_phase) values ('Spider''s Den', false)
on conflict (name) do nothing;

-- ── 1. Tier stage rows + single phase ───────────────────────────────────────
insert into dungeon_stages (dungeon_id, stage_number, label, notes)
select d.id, null::int, s.lbl, s.note
from dungeons d
cross join (values
  ('Stages 1-14',  'AoE-nuke tier. Kill Spiderlings with AoE damage before they poison-stack; burst Skavag fast. Affinities rotate Void/Magic/Force/Spirit.'),
  ('Stages 15-20', 'The wall — raw AoE no longer clears. Damage Skavag via Enemy-MaxHP / Poison / HP Burn. RES to resist Poison matters (up to ~300).'),
  ('Stages 21-25', 'Endgame — %MaxHP damage capped (Almighty Strength) and Turn Meter reduction halved (Almighty Persistence). AoE HP Burn is the path.')
) as s(lbl, note)
where d.name = 'Spider''s Den'
on conflict (dungeon_id, label) do nothing;

insert into phases (dungeon_stage_id, phase_type, notes)
select ds.id, 'single', 'Spider''s Den has no wave/boss split — Skavag + her Spiderlings fight together.'
from dungeon_stages ds join dungeons d on d.id = ds.dungeon_id
where d.name = 'Spider''s Den' and ds.label in ('Stages 1-14','Stages 15-20','Stages 21-25')
on conflict (dungeon_stage_id, phase_type) do nothing;

-- ── 2. Goals ────────────────────────────────────────────────────────────────
-- Tier 1-14
insert into goals (phase_id, description, is_informational)
select p.id, g.d, g.info
from phases p join dungeon_stages ds on ds.id = p.dungeon_stage_id join dungeons d on d.id = ds.dungeon_id
cross join (values
  ('Clear or lock down the Spiderlings each round before they stack MaxHP Poison on your team.', false),
  ('Burst Skavag down quickly with AoE damage — she heals and grows the longer the fight lasts.', false),
  ('Deny Skavag her turn so she cannot consume Spiderlings to heal and permanently grow her ATK.', false),
  ('Survive the Spiderling Poison stacks and Skavag''s AoE — lifesteal sustain is cut to 35% here.', false),
  ('Speed: act before the Spiderlings and keep the fight short — Skavag snowballs over time.', true)
) as g(d, info)
where d.name = 'Spider''s Den' and ds.label = 'Stages 1-14'
  and not exists (select 1 from goals x where x.phase_id = p.id and x.description = g.d);

-- Tier 15-20
insert into goals (phase_id, description, is_informational)
select p.id, g.d, g.info
from phases p join dungeon_stages ds on ds.id = p.dungeon_stage_id join dungeons d on d.id = ds.dungeon_id
cross join (values
  ('Clear or lock down the Spiderlings each round with AoE crowd control — raw AoE damage no longer clears them here.', false),
  ('Damage Skavag''s large HP pool — use Enemy-MaxHP damage, Poison, or HP Burn (raw AoE is too weak now).', false),
  ('Deny Skavag her turn so she cannot consume Spiderlings to heal and permanently grow her ATK.', false),
  ('Survive the Spiderling Poison stacks and Skavag''s AoE — lifesteal sustain is cut to 35% here.', false),
  ('Speed: act before the Spiderlings and keep the fight short — Skavag snowballs over time.', true)
) as g(d, info)
where d.name = 'Spider''s Den' and ds.label = 'Stages 15-20'
  and not exists (select 1 from goals x where x.phase_id = p.id and x.description = g.d);

-- Tier 21-25
insert into goals (phase_id, description, is_informational)
select p.id, g.d, g.info
from phases p join dungeon_stages ds on ds.id = p.dungeon_stage_id join dungeons d on d.id = ds.dungeon_id
cross join (values
  ('Clear or lock down the Spiderlings each round with AoE crowd control.', false),
  ('Damage Skavag with AoE HP Burn — %MaxHP-scaling damage is capped here (Almighty Strength).', false),
  ('Deny Skavag her turn — note Almighty Persistence halves all Turn Meter reduction against her.', false),
  ('Survive the Spiderling Poison stacks and Skavag''s AoE — lifesteal sustain is cut to 35% here.', false),
  ('Speed: act before the Spiderlings and keep the fight short — Skavag snowballs over time.', true)
) as g(d, info)
where d.name = 'Spider''s Den' and ds.label = 'Stages 21-25'
  and not exists (select 1 from goals x where x.phase_id = p.id and x.description = g.d);

-- ── 3. Goal solutions (label-only; tags in §4) ──────────────────────────────
insert into goal_solutions (goal_id, label, status, source_type, source_note, proposed_by)
select g.id, s.lbl, 'proposed', 'human_observation', s.note, 'spider-tiers-seed-2026-07-13'
from goals g
join phases p on p.id = g.phase_id
join dungeon_stages ds on ds.id = p.dungeon_stage_id
join dungeons d on d.id = ds.dungeon_id
cross join (values
  -- Spiderling control (1-14 allows AoE damage to kill; 15-25 rely on CC)
  ('Clear or lock down the Spiderlings each round before they stack MaxHP Poison on your team.',
     'AoE Damage (kill the Spiderlings)', 'At Stages 1-14 Spiderlings are low-HP — AoE damage kills them before they act.'),
  ('Clear or lock down the Spiderlings each round before they stack MaxHP Poison on your team.',
     'AoE Stun (Spiderlings)', 'Spiderlings are NOT immune to CC (only Skavag is) — AoE Stun denies their turns.'),
  ('Clear or lock down the Spiderlings each round before they stack MaxHP Poison on your team.',
     'AoE Freeze (Spiderlings)', 'AoE Freeze locks the Spiderlings — same effect as Stun.'),
  ('Clear or lock down the Spiderlings each round before they stack MaxHP Poison on your team.',
     'AoE Decrease Turn Meter (Spiderlings)', 'Pushes the Spiderlings'' Turn Meter back so they can''t bite.'),
  ('Clear or lock down the Spiderlings each round with AoE crowd control — raw AoE damage no longer clears them here.',
     'AoE Stun (Spiderlings)', 'At Stages 15-20 Spiderlings are too tanky to nuke — CC them instead.'),
  ('Clear or lock down the Spiderlings each round with AoE crowd control — raw AoE damage no longer clears them here.',
     'AoE Freeze (Spiderlings)', 'AoE Freeze locks the Spiderlings.'),
  ('Clear or lock down the Spiderlings each round with AoE crowd control — raw AoE damage no longer clears them here.',
     'AoE Decrease Turn Meter (Spiderlings)', 'Denies the Spiderlings their turn.'),
  ('Clear or lock down the Spiderlings each round with AoE crowd control.',
     'AoE Stun (Spiderlings)', 'CC the Spiderlings — they are not immune (only the boss is).'),
  ('Clear or lock down the Spiderlings each round with AoE crowd control.',
     'AoE Freeze (Spiderlings)', 'AoE Freeze locks the Spiderlings.'),
  ('Clear or lock down the Spiderlings each round with AoE crowd control.',
     'AoE Decrease Turn Meter (Spiderlings)', 'Denies the Spiderlings their turn.'),
  -- Damage the boss (per-tier)
  ('Burst Skavag down quickly with AoE damage — she heals and grows the longer the fight lasts.',
     'AoE Damage + AoE Decrease DEF', 'AoE Decrease DEF amplifies AoE nukes enough to kill Skavag fast at low stages.'),
  ('Burst Skavag down quickly with AoE damage — she heals and grows the longer the fight lasts.',
     'AoE Damage', 'Raw AoE burst is enough at Stages 1-14 where Skavag''s HP is low.'),
  ('Damage Skavag''s large HP pool — use Enemy-MaxHP damage, Poison, or HP Burn (raw AoE is too weak now).',
     'Enemy MAX HP Damage', 'Damage that scales on enemy MAX HP (e.g. Coldheart-style) — the primary 15-20 damage path.'),
  ('Damage Skavag''s large HP pool — use Enemy-MaxHP damage, Poison, or HP Burn (raw AoE is too weak now).',
     'Poison + HP Burn', 'Poison and HP Burn deal %MaxHP-style damage that scales with her big HP pool.'),
  ('Damage Skavag''s large HP pool — use Enemy-MaxHP damage, Poison, or HP Burn (raw AoE is too weak now).',
     'AoE HP Burn', 'AoE HP Burn chips her large HP pool independent of DEF (AoE preferred).'),
  ('Damage Skavag with AoE HP Burn — %MaxHP-scaling damage is capped here (Almighty Strength).',
     'AoE HP Burn', 'HP Burn is the endgame path — it is not capped by Almighty Strength like %MaxHP nukes (AoE preferred).'),
  ('Damage Skavag with AoE HP Burn — %MaxHP-scaling damage is capped here (Almighty Strength).',
     'Poison', 'Poison supplements HP Burn as a second damage-over-time source.'),
  -- Deny her turn (all tiers)
  ('Deny Skavag her turn so she cannot consume Spiderlings to heal and permanently grow her ATK.',
     'Decrease Turn Meter', 'Keeps Skavag from taking her turn (where she consumes Spiderlings to heal + grow).'),
  ('Deny Skavag her turn so she cannot consume Spiderlings to heal and permanently grow her ATK.',
     'Decrease Turn Meter + Decrease SPD', 'Pairing Decrease SPD with Decrease Turn Meter keeps her suppressed.'),
  ('Deny Skavag her turn — note Almighty Persistence halves all Turn Meter reduction against her.',
     'Decrease Turn Meter', 'Still useful, but Almighty Persistence halves it vs the boss — bring extra or pair with SPD.'),
  ('Deny Skavag her turn — note Almighty Persistence halves all Turn Meter reduction against her.',
     'Decrease Turn Meter + Decrease SPD', 'Decrease SPD backs up the (halved) Decrease Turn Meter at endgame.'),
  -- Survive (all tiers)
  ('Survive the Spiderling Poison stacks and Skavag''s AoE — lifesteal sustain is cut to 35% here.',
     'AoE Shield', 'A team-wide Shield absorbs the Spiderling Poison ticks and Venom Spray — the best sustain here.'),
  ('Survive the Spiderling Poison stacks and Skavag''s AoE — lifesteal sustain is cut to 35% here.',
     'Healer', 'A direct healer works (heal-on-damage/lifesteal is cut to 35%, but direct heals are not).'),
  ('Survive the Spiderling Poison stacks and Skavag''s AoE — lifesteal sustain is cut to 35% here.',
     'Continuous Heal', 'Continuous Heal counters the stacking Poison chip damage.')
) as s(goal_desc, lbl, note)
where d.name = 'Spider''s Den'
  and ds.label in ('Stages 1-14','Stages 15-20','Stages 21-25')
  and g.description = s.goal_desc
  and not exists (select 1 from goal_solutions x where x.goal_id = g.id and x.label = s.lbl);

-- ── 4. Goal solution tags (global label -> tag map, scoped to this seed) ─────
insert into goal_solution_tags (goal_solution_id, tag_id)
select gs.id, t.id
from goal_solutions gs
join (values
  ('AoE Damage (kill the Spiderlings)',            'AoE Damage'),
  ('AoE Stun (Spiderlings)',                       'AoE Stun'),
  ('AoE Freeze (Spiderlings)',                     'AoE Freeze'),
  ('AoE Decrease Turn Meter (Spiderlings)',        'AoE Decrease Turn Meter'),
  ('AoE Damage + AoE Decrease DEF',                'AoE Damage'),
  ('AoE Damage + AoE Decrease DEF',                'AoE Decrease Defense'),
  ('AoE Damage',                                   'AoE Damage'),
  ('Enemy MAX HP Damage',                          'Enemy Max HP Damage'),
  ('Poison + HP Burn',                             'Poison'),
  ('Poison + HP Burn',                             'HP Burn'),
  ('AoE HP Burn',                                  'HP Burn'),
  ('Poison',                                       'Poison'),
  ('Decrease Turn Meter',                          'Decrease Turn Meter'),
  ('Decrease Turn Meter + Decrease SPD',           'Decrease Turn Meter'),
  ('Decrease Turn Meter + Decrease SPD',           'Decrease Speed'),
  ('AoE Shield',                                   'Shield'),
  ('Healer',                                       'Healer'),
  ('Continuous Heal',                              'Continuous Heal')
) as m(lbl, tag_name) on m.lbl = gs.label
join tags t on t.name = m.tag_name
where gs.proposed_by = 'spider-tiers-seed-2026-07-13'
  and not exists (select 1 from goal_solution_tags x where x.goal_solution_id = gs.id and x.tag_id = t.id);

-- ── 5. Stat threshold checks (ACC stage×11; RES stage×10+100, capped 300 @ 21-25) ──
insert into stat_threshold_checks (phase_id, stat, comparison, formula, notes)
select p.id, v.stat, 'formula', v.formula, v.note
from phases p join dungeon_stages ds on ds.id = p.dungeon_stage_id join dungeons d on d.id = ds.dungeon_id
cross join (values
  ('lower', 'acc', 'stage * 11',
     'ACC ≈ stage × 11 (≈ enemy RES + 25, up to ~225) to land Poison/HP Burn/Decrease DEF/Decrease TM. NOTE: differs from the live stage × 10 and CLAUDE.md open-question #3 — advisor to reconcile.'),
  ('lower', 'res', 'stage * 10 + 100',
     'RES ≈ stage × 10 + 100 (≈ enemy ACC + 100) to resist the Spiderling MaxHP Poison. This is the resist-survival path — a Shield/CC team can substitute, so weight as advisory.'),
  ('cap', 'acc', 'stage * 11',
     'ACC ≈ stage × 11 (up to ~225) to land debuffs at endgame RES. Advisor to reconcile vs stage × 10.'),
  ('cap', 'res', '300',
     'RES ≈ 300 (the cap — stage × 10 + 100 tops out here). Resist-survival path vs the Spiderling Poison; a Shield/CC team can substitute.')
) as v(band, stat, formula, note)
where d.name = 'Spider''s Den'
  and (
       (v.band = 'lower' and ds.label in ('Stages 1-14','Stages 15-20'))
    or (v.band = 'cap'   and ds.label = 'Stages 21-25')
  )
  and not exists (select 1 from stat_threshold_checks x where x.phase_id = p.id and x.stat = v.stat);

-- ── 6. Boss exceptions ──────────────────────────────────────────────────────
-- Universal (all three tiers)
insert into boss_exceptions (dungeon_stage_id, description, source_citation)
select ds.id, e.descr, 'AyumiLove Spider''s Den guide (hand-read factual mechanics), 2026'
from dungeon_stages ds join dungeons d on d.id = ds.dungeon_id
cross join (values
  ('Almighty Immunity: Skavag is immune to Stun, Freeze, Sleep, Provoke, Fear/True Fear and cooldown-increase effects. Hard CC works only on the SPIDERLINGS, never the boss — never field a champion expecting to CC Skavag herself.'),
  ('Healing Assured: Skavag is immune to Heal Reduction — do not rely on it here.'),
  ('Lifesteal and heal-on-damage skills heal only 35% of their normal amount when attacking Skavag or her Spiderlings — sustain with direct heals / shields, not lifesteal.'),
  ('Skavag snowballs: she consumes remaining Spiderlings at the start of her turn, healing 3% MaxHP and PERMANENTLY gaining +10% ATK per Spiderling. Deny her turn (Decrease Turn Meter) and kill fast — dragging the fight out loses it.')
) as e(descr)
where d.name = 'Spider''s Den' and ds.label in ('Stages 1-14','Stages 15-20','Stages 21-25')
  and not exists (select 1 from boss_exceptions x where x.dungeon_stage_id = ds.id and x.description = e.descr);

-- Stages 21-25 only — the two endgame passives
insert into boss_exceptions (dungeon_stage_id, description, source_citation)
select ds.id, e.descr, 'AyumiLove Spider''s Den guide (hand-read factual mechanics), 2026'
from dungeon_stages ds join dungeons d on d.id = ds.dungeon_id
cross join (values
  ('Almighty Strength (Stages 21-25): damage from skills that scale on enemy MAX HP cannot exceed 10% of Skavag''s MAX HP. %MaxHP nukes fall off — switch to AoE HP Burn / Poison.'),
  ('Almighty Persistence (Stages 21-25): all Turn Meter reduction against Skavag is decreased by 50% — bring extra Turn Meter control or lean on Decrease SPD.')
) as e(descr)
where d.name = 'Spider''s Den' and ds.label = 'Stages 21-25'
  and not exists (select 1 from boss_exceptions x where x.dungeon_stage_id = ds.id and x.description = e.descr);
