-- ============================================================================
-- Seed 06 — Solo carry profiles
-- Source: Google AI Overview bulk queries + per-champion supplemental searches
-- Research date: 2026-06-27
-- All rows status='proposed'. Nothing auto-approves.
-- Proposed by: claude-code-solo-research-pass
--
-- Processing order followed:
--   Step 2 — Pre-seeded champions from handoff doc section 6 (Dragon solos)
--   Step 3 — Additional champions from bulk query results
--   Step 4 — Starter-pack champion supplemental queries
-- ============================================================================

-- ── Apply schema additions before inserting ──────────────────────────────────
-- (Run schema.sql sections 13 + 13b first if not already applied)

-- ── Dungeon preamble — ensure all referenced dungeons and stages exist ────────
-- Dragon's Lair, Ice Golem's Peak, Fire Knight's Castle are inserted here.
-- Spider's Den should already exist from seed 02; included with ON CONFLICT
-- DO NOTHING for safety.

insert into dungeons (name, has_wave_phase) values
  ('Dragon''s Lair',        true),
  ('Spider''s Den',         false),
  ('Ice Golem''s Peak',     true),
  ('Fire Knight''s Castle', true)
on conflict (name) do nothing;

-- Dragon's Lair stages (Normal + Hard)
insert into dungeon_stages (dungeon_id, stage_number, label, notes)
select d.id, v.sn, v.lbl, v.notes
from dungeons d
cross join (values
  (19, 'Stage 19',      'Spirit affinity — Spirit champions advantaged, Force champions hit weak.'),
  (20, 'Stage 20',      'Force affinity — Force champions advantaged, Magic and Spirit hit weak.'),
  (23, 'Stage 23',      'Spirit affinity — Spirit champions advantaged, Force champions hit weak.'),
  (25, 'Stage 25',      'Force affinity — Spirit champions advantaged, Magic champions hit weak, Force and Void neutral.'),
  (4,  'Hard Stage 4',  'Dragon Hard mode.'),
  (7,  'Hard Stage 7',  'Dragon Hard mode.'),
  (8,  'Hard Stage 8',  'Dragon Hard mode.'),
  (10, 'Hard Stage 10', 'Dragon Hard mode. Force affinity inferred from Ezio Spirit advantage — verify in-game (see FLAG-24).')
) as v(sn, lbl, notes)
where d.name = 'Dragon''s Lair'
on conflict (dungeon_id, label) do nothing;

-- Spider's Den stages
insert into dungeon_stages (dungeon_id, stage_number, label, notes)
select d.id, v.sn, v.lbl, v.notes
from dungeons d
cross join (values
  (9,  'Stage 9',       'Void affinity — neutral for all champion affinities.'),
  (10, 'Stage 10',      'Magic affinity — Force champions hit weak, Magic champions advantaged.'),
  (20, 'Stage 20',      'Spirit affinity — Force champions advantaged, Magic champions hit weak.'),
  (25, 'Stage 25',      'Magic affinity — Force champions hit weak, Magic champions advantaged.'),
  (5,  'Hard Stage 5',  'Spider Hard mode.')
) as v(sn, lbl, notes)
where d.name = 'Spider''s Den'
on conflict (dungeon_id, label) do nothing;

-- Ice Golem's Peak stages
insert into dungeon_stages (dungeon_id, stage_number, label, notes)
select d.id, v.sn, v.lbl, v.notes
from dungeons d
cross join (values
  (20, 'Stage 20',      'Spirit affinity — Magic champions advantaged, Force champions hit weak.'),
  (4,  'Hard Stage 4',  'Ice Golem Hard mode. Hard boss is immune to Poison and Poison Sensitivity.'),
  (8,  'Hard Stage 8',  'Ice Golem Hard mode.'),
  (10, 'Hard Stage 10', 'Ice Golem Hard mode. Requires higher gear than stages 4/8.')
) as v(sn, lbl, notes)
where d.name = 'Ice Golem''s Peak'
on conflict (dungeon_id, label) do nothing;

-- ── Helper function (inline) — dungeon stage lookup ──────────────────────────
-- Each INSERT below uses this subquery pattern:
--   (select ds.id from dungeon_stages ds
--    join dungeons d on d.id = ds.dungeon_id
--    where d.name = 'X' and ds.label = 'Y')


-- ============================================================================
-- DRAGON'S LAIR — Stage 20 (Force affinity)
-- Force champions advantaged. Magic and Spirit hit weak.
-- General stat thresholds (non-Force affinity): HP 55k+, DEF 2500+,
--   SPD 210+, ACC 220+ (if using Poison/HP Burn/Bombs), RES 220+ (optional)
-- Force affinity champions require lower stats due to affinity advantage.
-- ============================================================================

-- ── Torturehelm (Epic / Force) — BUDGET TIER ─────────────────────────────────
insert into champion_solo_profiles
  (champion_id, dungeon_stage_id, required_set, required_stats,
   ai_settings, mechanism, source_note,
   affinity_warning, availability_note, research_confidence, status, proposed_by)
values (
  (select id from champions where name = 'Torturehelm'),
  (select ds.id from dungeon_stages ds join dungeons d on d.id = ds.dungeon_id
   where d.name = 'Dragon''s Lair' and ds.label = 'Stage 20'),
  'Lifesteal or Toxic + Immortal',
  '{"note": "Below general thresholds — budget build viable unbooked. Force affinity reduces stat requirements."}',
  'Cycle A2 for fastest wave clear — damage scales with number of dead allies.',
  'Self-revive passive triggers every 3 turns on death; A2 damage scales with dead food champions, making food dying an active benefit rather than a problem; no teammate skills needed.',
  'Multiple Reddit threads confirm. Described as the budget Dragon 20 solo champion. Self-revive + food-death synergy confirmed.',
  null,
  null,
  'High',
  'proposed',
  'claude-code-solo-research-pass'
);

-- ── Drexthar Bloodtwin (Legendary / Force) ──────────────────────────────────
insert into champion_solo_profiles
  (champion_id, dungeon_stage_id, required_set, required_stats,
   ai_settings, mechanism, source_note,
   affinity_warning, availability_note, research_confidence, status, proposed_by)
values (
  (select id from champions where name = 'Drexthar Bloodtwin'),
  (select ds.id from dungeon_stages ds join dungeons d on d.id = ds.dungeon_id
   where d.name = 'Dragon''s Lair' and ds.label = 'Stage 20'),
  'Lifesteal or Regeneration',
  '{"note": "High DEF and HP recommended. Exact thresholds unverified — research Boozor/finalKenpachi YouTube before approving."}',
  null,
  'Passive applies HP Burn to any enemy that hits him; Force affinity means strong hits and reduced incoming damage at Stage 20; Lifesteal or Regen sustains through the fight.',
  'Multiple YouTube showcases and Reddit threads confirmed. Free from 3v3 Arena Bazaar — accessible to all accounts.',
  null,
  'Free from 3v3 Arena Bazaar — accessible to all accounts.',
  'Medium',
  'proposed',
  'claude-code-solo-research-pass'
);

-- ── Tholin Foulbeard (Epic / Force) — NOT SEEDED (FLAG-02: single source, FLAG-22: not in wiki) ─
-- Uncomment when a second independent source confirms solo + stat thresholds are verified.
/*
insert into champion_solo_profiles
  (champion_id, dungeon_stage_id, required_set, required_stats,
   ai_settings, mechanism, source_note,
   affinity_warning, availability_note, research_confidence, status, proposed_by)
values (
  (select id from champions where name = 'Tholin Foulbeard'),
  (select ds.id from dungeon_stages ds join dungeons d on d.id = ds.dungeon_id
   where d.name = 'Dragon''s Lair' and ds.label = 'Stage 20'),
  'Lifesteal',
  '{"note": "At or below general thresholds due to Force affinity advantage. Exact stats unverified."}',
  null,
  'Passive prevents boss and waves from landing critical hits on him; Force affinity means strong hits and reduced incoming damage; AoE attacks clear waves efficiently.',
  'One YouTube showcase found — flag for additional verification before approving this row.',
  null,
  'Starter pack champion.',
  'Low',
  'proposed',
  'claude-code-solo-research-pass'
);
*/

-- ── Michelangelo (Legendary / Force) — TIME-LIMITED ──────────────────────────
insert into champion_solo_profiles
  (champion_id, dungeon_stage_id, required_set, required_stats,
   ai_settings, mechanism, source_note,
   affinity_warning, availability_note, research_confidence, status, proposed_by)
values (
  (select id from champions where name = 'Michelangelo'),
  (select ds.id from dungeon_stages ds join dungeons d on d.id = ds.dungeon_id
   where d.name = 'Dragon''s Lair' and ds.label = 'Stage 20'),
  'Toxic + Merciless or Savage',
  '{"note": "Toxic set required — Poison spread mechanic is the core of the solo. At or below general thresholds due to Force affinity."}',
  'Toxic set must be equipped. Poison spread via A2 is the primary damage source.',
  'Evasion passive reduces incoming damage; Shield passive on every hit self-sustains; Leech on A3 heals; Toxic set procs spread Poisons through A2 debuff propagation.',
  'Multiple Reddit threads and YouTube Shorts confirmed Dragon 20 and Ice Golem Normal solo. Stage 20 cap confirmed.',
  null,
  'TMNT crossover champion (Aug–Nov 2025). Not currently obtainable.',
  'High',
  'proposed',
  'claude-code-solo-research-pass'
);

-- ── Gnishak Verminlord (Legendary / Force) ───────────────────────────────────
insert into champion_solo_profiles
  (champion_id, dungeon_stage_id, required_set, required_stats,
   ai_settings, mechanism, source_note,
   affinity_warning, availability_note, research_confidence, status, proposed_by)
values (
  (select id from champions where name = 'Gnishak Verminlord'),
  (select ds.id from dungeon_stages ds join dungeons d on d.id = ds.dungeon_id
   where d.name = 'Dragon''s Lair' and ds.label = 'Stage 20'),
  'Regeneration',
  '{"note": "Lower gear requirements than non-Force Poison champions due to affinity advantage."}',
  null,
  'Passive converts Bomb detonations into protected Poisons; Force affinity reduces incoming damage and lands strong hits; Regen sustains through the fight.',
  'HellHades solo Dragon article (Jun 2023) plus community-confirmed Dragon 20.',
  null,
  null,
  'Medium',
  'proposed',
  'claude-code-solo-research-pass'
);

-- ── Tomb Lord (Legendary / Force) — Stage 20 ─────────────────────────────────
insert into champion_solo_profiles
  (champion_id, dungeon_stage_id, required_set, required_stats,
   ai_settings, mechanism, source_note,
   affinity_warning, availability_note, research_confidence, status, proposed_by)
values (
  (select id from champions where name = 'Tomb Lord'),
  (select ds.id from dungeon_stages ds join dungeons d on d.id = ds.dungeon_id
   where d.name = 'Dragon''s Lair' and ds.label = 'Stage 20'),
  'Regeneration + Speed',
  '{"acc_min": 220, "hp_min": 55000, "spd_min": 180}',
  'A3 can be turned OFF for faster wave clear — test both on and off.',
  'Force affinity provides strong hits and reduced incoming damage at Stage 20; Poisons accumulate while Regen sustains HP through the fight.',
  'HellHades solo Dragon article (Jun 2023). Confirmed viable through Stage 25.',
  null,
  null,
  'High',
  'proposed',
  'claude-code-solo-research-pass'
);

-- ── Bad El Kazar (Legendary / Void) ──────────────────────────────────────────
insert into champion_solo_profiles
  (champion_id, dungeon_stage_id, required_set, required_stats,
   ai_settings, mechanism, source_note,
   affinity_warning, availability_note, research_confidence, status, proposed_by)
values (
  (select id from champions where name = 'Bad-el-Kazar'),
  (select ds.id from dungeon_stages ds join dungeons d on d.id = ds.dungeon_id
   where d.name = 'Dragon''s Lair' and ds.label = 'Stage 20'),
  'Regeneration + Speed or Perception',
  '{"acc_min": 220, "hp_min": 55000, "spd_min": 180, "note": "Brimstone blessing speeds up runs."}',
  null,
  'Continuous Heal passive sustains indefinitely; self-immune to Poison, Decrease DEF, and Weaken (Dragon''s own debuffs do not degrade his performance); Void affinity means neutral at all stages.',
  'HellHades solo Dragon article (Jun 2023). Multiple Reddit threads. Classic solo Dragon champion.',
  null,
  null,
  'High',
  'proposed',
  'claude-code-solo-research-pass'
);

-- ── Artak (Legendary / Magic) — Dragon Stage 20 (Force stage — Magic WEAK) ──
-- Magic is WEAK vs Force, so Artak is disadvantaged at Dragon Stage 20 (Force
-- affinity, repo-confirmed seed 32/35). Confirmed solo despite the penalty;
-- affinity warning included. Best Dragon stages for Artak: 19 and 23 (Spirit
-- affinity — Magic is strong vs Spirit, so advantaged).
insert into champion_solo_profiles
  (champion_id, dungeon_stage_id, required_set, required_stats,
   ai_settings, mechanism, source_note,
   affinity_warning, availability_note, research_confidence, status, proposed_by)
values (
  (select id from champions where name = 'Artak'),
  (select ds.id from dungeon_stages ds join dungeons d on d.id = ds.dungeon_id
   where d.name = 'Dragon''s Lair' and ds.label = 'Stage 20'),
  'Toxic + Speed',
  '{"hp_min": 50000, "spd_min": 190, "note": "Toxic set required — Scorch passive relies on it."}',
  'A3 must be turned ON manually — AI does not activate it by default. Without this the solo fails.',
  'Scorch passive deals bonus damage through Toxic set procs against Dragon''s large HP pool; Toxic set is required for the passive to trigger at full frequency.',
  'HellHades solo Dragon article (Jun 2023). Confirmed viable at Stage 20; noted as capable of Stage 24 with very good stats.',
  'Magic affinity hits weak at Dragon Stage 20 (Force). Best Dragon stages for Artak: 19 and 23 (Spirit affinity — Magic advantaged). Stage 25 (Void) also viable at neutral.',
  null,
  'High',
  'proposed',
  'claude-code-solo-research-pass'
);

-- ── Artak (Legendary / Magic) — Dragon Stage 19 (Spirit stage — Magic ADVANTAGED) ──
-- Magic is strong vs Spirit, so Artak is advantaged at Stage 19 (Spirit
-- affinity, repo-confirmed seed 32/35). One of Artak's best Dragon stages —
-- full strong-hit bonus, no weak-hit penalty.
insert into champion_solo_profiles
  (champion_id, dungeon_stage_id, required_set, required_stats,
   ai_settings, mechanism, source_note,
   affinity_warning, availability_note, research_confidence, status, proposed_by)
values (
  (select id from champions where name = 'Artak'),
  (select ds.id from dungeon_stages ds join dungeons d on d.id = ds.dungeon_id
   where d.name = 'Dragon''s Lair' and ds.label = 'Stage 19'),
  'Toxic + Speed',
  '{"hp_min": 50000, "spd_min": 190, "note": "Toxic set required. Magic affinity advantaged at Stage 19 (Spirit stage) — lower stat thresholds than Stage 20."}',
  'A3 must be turned ON manually — AI does not activate it by default. Without this the solo fails.',
  'Scorch passive deals bonus damage through Toxic set Poison procs; Magic affinity is advantaged at Dragon Stage 19 (Spirit affinity stage — Magic strong vs Spirit) — strong hits and increased damage output vs. Stage 20.',
  'HellHades solo Dragon article (Jun 2023) confirms Artak as a Dragon solo champion. Stage 19 is a Spirit-affinity stage — advantaged for Magic Artak and among his preferred Dragon stages.',
  null,
  null,
  'High',
  'proposed',
  'claude-code-solo-research-pass'
);

-- ── Artak (Legendary / Magic) — Dragon Stage 23 (Spirit stage — Magic ADVANTAGED) ──
-- Magic is strong vs Spirit, so Artak is advantaged at Stage 23. Stage-23
-- affinity = Spirit is EXTRAPOLATED from the Dragon rotation (Magic→Spirit→
-- Force→Void from stage 10); repo seeds only cover stages 10-20 — verify.
insert into champion_solo_profiles
  (champion_id, dungeon_stage_id, required_set, required_stats,
   ai_settings, mechanism, source_note,
   affinity_warning, availability_note, research_confidence, status, proposed_by)
values (
  (select id from champions where name = 'Artak'),
  (select ds.id from dungeon_stages ds join dungeons d on d.id = ds.dungeon_id
   where d.name = 'Dragon''s Lair' and ds.label = 'Stage 23'),
  'Toxic + Speed',
  '{"hp_min": 50000, "spd_min": 190, "note": "Toxic set required. Magic affinity advantaged at Stage 23 (Spirit stage). Slightly higher gear floor than Stage 19 due to boss scaling."}',
  'A3 must be turned ON manually — AI does not activate it by default. Without this the solo fails.',
  'Scorch passive deals bonus damage through Toxic set Poison procs; Magic affinity is advantaged at Dragon Stage 23 (Spirit affinity stage — Magic strong vs Spirit) — strong hits, no weak-hit penalty.',
  'HellHades solo Dragon article (Jun 2023) confirms Artak, noted as capable of Stage 24 with very good stats. Stage 23 is a Spirit-affinity stage (extrapolated from the rotation) — advantaged for Magic Artak and within confirmed capability range.',
  null,
  null,
  'High',
  'proposed',
  'claude-code-solo-research-pass'
);

-- ── Marius the Gallant (Legendary / Watcher) — NOT SEEDED (FLAG-03: affinity unknown) ─
-- Faction confirmed: Watcher. Affinity still unknown — blocking all Marius rows.
-- Hard 10 mechanism confirmed: 9-piece Slayer set; counterattacks whenever TM is
-- decreased; AoE skills + massive DEF scaling; clears Hard 10 in 35-45 seconds.
-- Stage 20 mechanism: sub-20-second clears via same TM-decrease counterattack loop.
-- Uncomment BOTH blocks below only after affinity is confirmed in-game.
/*
insert into champion_solo_profiles
  (champion_id, dungeon_stage_id, required_set, required_stats,
   ai_settings, mechanism, source_note,
   affinity_warning, availability_note, research_confidence, status, proposed_by)
values (
  (select id from champions where name = 'Marius the Gallant'),
  (select ds.id from dungeon_stages ds join dungeons d on d.id = ds.dungeon_id
   where d.name = 'Dragon''s Lair' and ds.label = 'Stage 20'),
  'Slayer (9-piece) or Slayer + Savage/Lethal',
  '{"note": "Stat thresholds for Stage 20 unverified. Hard 10 floor: DEF 4500-5000, SPD 280-300. Stage 20 will be lower."}',
  null,
  'Passive triggers Counterattack every time Turn Meter is decreased — Dragon''s attacks constantly reduce TM, causing Marius to counterattack on nearly every hit; massive DEF scaling means his damage also scales with defense investment.',
  'AI Overview (Jun 2026): sub-20-second Dragon Stage 20 clears cited. 4 sources. Faction = Watcher confirmed.',
  'UNVERIFIED — affinity unknown. Update affinity_warning after confirming in-game.',
  null,
  'Medium',
  'proposed',
  'claude-code-solo-research-pass'
);

insert into champion_solo_profiles
  (champion_id, dungeon_stage_id, required_set, required_stats,
   ai_settings, mechanism, source_note,
   affinity_warning, availability_note, research_confidence, status, proposed_by)
values (
  (select id from champions where name = 'Marius the Gallant'),
  (select ds.id from dungeon_stages ds join dungeons d on d.id = ds.dungeon_id
   where d.name = 'Dragon''s Lair' and ds.label = 'Hard Stage 10'),
  'Slayer (9-piece) or Slayer + Savage/Lethal',
  '{"hp_min": 60000, "def_min": 5000, "spd_min": 300, "acc_min": 350, "res_min": 450, "note": "DEF is the primary scaling stat — prioritize DEF over HP. 9-piece Slayer mandatory for TM loop."}',
  null,
  'Passive triggers Counterattack every time Turn Meter is decreased; Dragon Hard constantly reduces TM, triggering an almost perpetual counterattack loop; massive DEF scaling amplifies each counterattack; 35-45 second clear.',
  'AI Overview (Jun 2026): described as "absolute premium Hard 10 speed-farmer." 4 sources cited.',
  'UNVERIFIED — affinity unknown. If Magic, Hard Stage 10 (Force) makes him weak. Update before approving.',
  null,
  'High',
  'proposed',
  'claude-code-solo-research-pass'
);
*/


-- ============================================================================
-- DRAGON'S LAIR — Stage 25 (Force affinity — confirmed in-game 2026-06-27)
-- Spirit champions ADVANTAGED (strong hits, reduced incoming damage).
-- Magic champions WEAK (weak hits, take increased damage).
-- Force and Void champions neutral.
--
-- Confirmed stat floor for neutral-affinity (Force/Void) champions:
--   HP 65k+ | DEF 3200+ | SPD 220-240+ | ACC 250+ | RES 300+
-- Spirit champions can clear with lower gear due to affinity advantage.
-- Recommended gear: Regeneration + Immortal (18% Max HP heal per turn total).
-- Recommended mastery: Spirit Haste (+24 SPD the moment food champions die).
-- ============================================================================

-- ── Tomb Lord (Legendary / Force) — Stage 25 (Force = neutral) ──────────────
insert into champion_solo_profiles
  (champion_id, dungeon_stage_id, required_set, required_stats,
   ai_settings, mechanism, source_note,
   affinity_warning, availability_note, research_confidence, status, proposed_by)
values (
  (select id from champions where name = 'Tomb Lord'),
  (select ds.id from dungeon_stages ds join dungeons d on d.id = ds.dungeon_id
   where d.name = 'Dragon''s Lair' and ds.label = 'Stage 25'),
  'Regeneration + Immortal',
  '{"hp_min": 65000, "def_min": 3200, "spd_min": 220, "acc_min": 250, "res_min": 300}',
  'A3 can be turned OFF for faster wave clear — test both. Spirit Haste mastery gives +24 SPD when food dies.',
  'A2 places four Poisons instantly; A3 applies Decrease Attack and Decrease Defense on waves, lowering stat requirements significantly; Regen + Immortal sustains 18% Max HP per turn.',
  'HellHades solo Dragon article (Jun 2023). Explicitly confirmed through Stage 25. Named consensus "Solo King" of Dragon 25 across multiple community sources.',
  null,
  null,
  'High',
  'proposed',
  'claude-code-solo-research-pass'
);

-- ── Urogrim (Epic / Void) — Stage 25 ─────────────────────────────────────────
insert into champion_solo_profiles
  (champion_id, dungeon_stage_id, required_set, required_stats,
   ai_settings, mechanism, source_note,
   affinity_warning, availability_note, research_confidence, status, proposed_by)
values (
  (select id from champions where name = 'Urogrim'),
  (select ds.id from dungeon_stages ds join dungeons d on d.id = ds.dungeon_id
   where d.name = 'Dragon''s Lair' and ds.label = 'Stage 25'),
  'Regeneration + Immortal',
  '{"hp_min": 70000, "def_min": 3000, "spd_min": 250, "res_min": 330, "acc_min": 250}',
  null,
  'Void affinity is neutral at every stage with no weak-hit penalty anywhere; Continuous Heal buffs sustain indefinitely; stacked Poisons melt Dragon''s large HP pool over extended runs.',
  'Plarium forum confirmed (multiple posters). Also confirmed Dragon 24/25. Stats cited: 70k HP, 3k DEF, 250+ SPD, 330+ RES, 250+ ACC.',
  null,
  null,
  'High',
  'proposed',
  'claude-code-solo-research-pass'
);

-- ── Teodor the Savant (Legendary / Spirit) — Stage 25 (Force = ADVANTAGED) ──
-- Spirit is WEAK at Dragon Stage 20 — but Stage 25 is also Force, so Teodor is
-- ADVANTAGED here too. Stage 25 is actually Teodor's best Dragon stage.
insert into champion_solo_profiles
  (champion_id, dungeon_stage_id, required_set, required_stats,
   ai_settings, mechanism, source_note,
   affinity_warning, availability_note, research_confidence, status, proposed_by)
values (
  (select id from champions where name = 'Teodor the Savant'),
  (select ds.id from dungeon_stages ds join dungeons d on d.id = ds.dungeon_id
   where d.name = 'Dragon''s Lair' and ds.label = 'Stage 25'),
  'Regeneration + Immortal',
  '{"hp_min": 65000, "def_min": 3200, "spd_min": 220, "acc_min": 250, "res_min": 300, "note": "Spirit affinity advantage at Force Stage 25 reduces effective gear floor."}',
  'Spirit Haste mastery gives +24 SPD when food dies — essential for speed-gated clear times.',
  'Applies Poisons and HP Burns then activates and detonates them for the fastest solo clear times in the game (~1:30 Dragon 25); Regen + Immortal sustains 18% Max HP per turn; Spirit affinity is ADVANTAGED at Force Stage 25.',
  'Named "best soloer in the game" in multiple forum posts. ~1:30 Dragon 25 clear confirmed. YouTube Shorts and BlueStacks guide. Corroborated by AI Overview (Jun 2026).',
  'Spirit affinity hits weak at Dragon Stage 20 (Force). Stage 25 is also Force — Spirit is ADVANTAGED at Stage 25, not weak. Preferred stage for Teodor.',
  null,
  'High',
  'proposed',
  'claude-code-solo-research-pass'
);

-- ── Myciliac Priest Orn (Epic / Magic) — Stage 25 (Force = WEAK) ────────────
-- Magic is WEAK at both Dragon Stage 20 and Stage 25 (both Force affinity).
-- Confirmed solo despite the penalty — passive stat scaling compensates.
insert into champion_solo_profiles
  (champion_id, dungeon_stage_id, required_set, required_stats,
   ai_settings, mechanism, source_note,
   affinity_warning, availability_note, research_confidence, status, proposed_by)
values (
  (select id from champions where name = 'Myciliac Priest Orn'),
  (select ds.id from dungeon_stages ds join dungeons d on d.id = ds.dungeon_id
   where d.name = 'Dragon''s Lair' and ds.label = 'Stage 25'),
  'Regeneration',
  '{"hp_min": 75000, "def_min": 2600, "spd_min": 186, "acc_min": 265}',
  'A2 should be turned ON manually in the boss stage — AI does not activate it automatically, and it significantly speeds up the run by exploding Poisons on the boss.',
  'Passive increases Max HP and DEF every time a Poison tick activates — gets progressively tankier as the fight goes on, making him nearly unkillable in extended solo runs.',
  'Plarium forum confirmed (~3:30 Dragon 25 clear). Stats cited: 75k HP, 2.6k DEF, 186 SPD, 265 ACC. Also HellHades solo Dragon article (Jun 2023).',
  'Magic affinity hits weak at both Dragon Stage 20 and Stage 25 (both Force). Confirmed solo despite the penalty — passive HP/DEF stacking compensates over the run.',
  null,
  'High',
  'proposed',
  'claude-code-solo-research-pass'
);

-- ── Akemtum (Epic) — Stage 25 ────────────────────────────────────────────────
insert into champion_solo_profiles
  (champion_id, dungeon_stage_id, required_set, required_stats,
   ai_settings, mechanism, source_note,
   affinity_warning, availability_note, research_confidence, status, proposed_by)
values (
  (select id from champions where name = 'Akemtum'),
  (select ds.id from dungeon_stages ds join dungeons d on d.id = ds.dungeon_id
   where d.name = 'Dragon''s Lair' and ds.label = 'Stage 25'),
  'Lifesteal',
  '{"spd_min": 231, "hp_min": 50000, "res_min": 200, "note": "Lifesteal required — Regeneration does not work for this champion''s mechanic."}',
  null,
  'Passive chains Poison damage through Hexed enemies; Dragon''s own Poisons landing on food champions trigger a cascade effect that accelerates the kill without needing teammate actions.',
  'HellHades solo Dragon article (Jun 2023). Stats cited: SPD 231, HP 50k. Confirmed Dragon 25. Void affinity confirmed via Fandom wiki — neutral at all stages.',
  null,
  null,
  'High',
  'proposed',
  'claude-code-solo-research-pass'
);

-- ── Artak (Legendary / Magic) — Dragon Stage 25 (Void stage — NEUTRAL) ──────
-- CORRECTED: Stage 25 is a VOID affinity stage (extrapolated from the Dragon
-- rotation Magic→Spirit→Force→Void; this file previously mislabelled it "Force").
-- Magic is neutral vs Void — no strong-hit bonus, no weak-hit penalty. Cleared
-- on the Scorch mechanic alone. (Repo seeds only cover 10-20 — verify 21-25.)
insert into champion_solo_profiles
  (champion_id, dungeon_stage_id, required_set, required_stats,
   ai_settings, mechanism, source_note,
   affinity_warning, availability_note, research_confidence, status, proposed_by)
values (
  (select id from champions where name = 'Artak'),
  (select ds.id from dungeon_stages ds join dungeons d on d.id = ds.dungeon_id
   where d.name = 'Dragon''s Lair' and ds.label = 'Stage 25'),
  'Toxic + Speed',
  '{"hp_min": 50000, "spd_min": 190, "note": "Toxic set required. Noted as capable of Stage 24 with very good stats."}',
  'A3 must be turned ON manually — AI does not activate it by default. Without this the solo fails.',
  'Scorch passive deals bonus damage through Toxic set procs; Dragon''s large HP pool amplifies the damage; Stage 25 is a Void affinity stage — Magic is neutral (no strong-hit bonus, no weak-hit penalty).',
  'HellHades solo Dragon article (Jun 2023). Confirmed Stage 24 capability; Stage 25 is a Void affinity stage (rotation; previously mislabelled Force) — Magic neutral, cleared on the Scorch mechanic alone.',
  null,
  null,
  'Medium',
  'proposed',
  'claude-code-solo-research-pass'
);

-- ── Venomage (Epic / Magic) — Stage 25 (Force = WEAK) ───────────────────────
-- Magic affinity is WEAK at Stage 25 (Force). Confirmed solo despite penalty.
-- Best Dragon stages for Venomage: Magic-affinity stages (10, 14, 18, 22) and Void (21).
insert into champion_solo_profiles
  (champion_id, dungeon_stage_id, required_set, required_stats,
   ai_settings, mechanism, source_note,
   affinity_warning, availability_note, research_confidence, status, proposed_by)
values (
  (select id from champions where name = 'Venomage'),
  (select ds.id from dungeon_stages ds join dungeons d on d.id = ds.dungeon_id
   where d.name = 'Dragon''s Lair' and ds.label = 'Stage 25'),
  'Regeneration',
  '{"note": "Stat thresholds not found in sources. UNVERIFIED — research build guide before approving."}',
  null,
  'Passive reduces incoming damage from any enemy affected by Poison; heals and sustains while detonating Poisons on A2; self-sustaining Poison engine requires no teammates to trigger.',
  'YouTube Shorts confirmed Dragon solo. Also confirmed Ice Golem and Scarab King solos (same video). Stage confirmed as Dragon 25.',
  'Magic affinity hits weak at Dragon Stage 25 (Force). Confirmed solo despite the penalty. Best stages for Venomage: Magic-affinity stages 10, 14, 18, 22 and Void Stage 21.',
  'Starter pack champion.',
  'Medium',
  'proposed',
  'claude-code-solo-research-pass'
);

-- ── Noct the Paralyzer (Legendary) — NOT SEEDED (FLAG-05: single source, affinity unverified) ─
-- Uncomment when a second source corroborates the solo and affinity is confirmed.
/*
insert into champion_solo_profiles
  (champion_id, dungeon_stage_id, required_set, required_stats,
   ai_settings, mechanism, source_note,
   affinity_warning, availability_note, research_confidence, status, proposed_by)
values (
  (select id from champions where name = 'Noct the Paralyzer'),
  (select ds.id from dungeon_stages ds join dungeons d on d.id = ds.dungeon_id
   where d.name = 'Dragon''s Lair' and ds.label = 'Stage 25'),
  'Regeneration or Guardian',
  '{"note": "UNVERIFIED stats. SPD and ACC prioritized per build guides. Research before approving."}',
  null,
  'AoE Poisons and Sleep debuffs control waves; passive heals the team when Poison ticks, providing self-sustain without requiring specific teammate skills.',
  'Plarium forum: multiple posters confirm "great for soloing dungeons 25." Single source category — Low confidence until corroborated.',
  'Affinity unverified — confirm before approving.',
  null,
  'Low',
  'proposed',
  'claude-code-solo-research-pass'
);
*/

-- ── Bad El Kazar (Legendary / Void) — Stage 25 ───────────────────────────────
insert into champion_solo_profiles
  (champion_id, dungeon_stage_id, required_set, required_stats,
   ai_settings, mechanism, source_note,
   affinity_warning, availability_note, research_confidence, status, proposed_by)
values (
  (select id from champions where name = 'Bad-el-Kazar'),
  (select ds.id from dungeon_stages ds join dungeons d on d.id = ds.dungeon_id
   where d.name = 'Dragon''s Lair' and ds.label = 'Stage 25'),
  'Regeneration + Speed or Perception',
  '{"acc_min": 220, "hp_min": 55000, "spd_min": 180}',
  null,
  'Continuous Heal passive sustains indefinitely through any stage; self-immune to Dragon''s own debuffs (Poison, Decrease DEF, Weaken); Void affinity is neutral at Stage 25.',
  'Multiple Reddit threads and HellHades article. Classic solo Dragon champion, confirmed viable across all stages.',
  null,
  null,
  'High',
  'proposed',
  'claude-code-solo-research-pass'
);

-- ── Richtoff the Bold (Legendary / Spirit) — Stage 25 (Force = ADVANTAGED) ──
-- DB name verify: select name from champions where name ilike '%richtoff%';
insert into champion_solo_profiles
  (champion_id, dungeon_stage_id, required_set, required_stats,
   ai_settings, mechanism, source_note,
   affinity_warning, availability_note, research_confidence, status, proposed_by)
values (
  (select id from champions where name = 'Richtoff the Bold'),
  (select ds.id from dungeon_stages ds join dungeons d on d.id = ds.dungeon_id
   where d.name = 'Dragon''s Lair' and ds.label = 'Stage 25'),
  'Regeneration + Immortal',
  '{"hp_min": 65000, "def_min": 3200, "spd_min": 220, "acc_min": 250, "res_min": 300, "note": "Spirit affinity advantage at Force Stage 25 reduces effective gear floor."}',
  'Spirit Haste mastery gives +24 SPD when food dies.',
  'A2 applies multiple Poisons and extends their duration; high-resistance build sustains through the fight and blocks debuffs from waves; Spirit affinity ADVANTAGED at Force Stage 25; Poison accumulation melts Dragon''s HP pool in ~2-3 minutes.',
  'AI Overview (Jun 2026): described as "exceptional solo farmer" for Dragon 25, 2-3 min clear time. 3 sources cited.',
  'Spirit affinity hits weak at Dragon Stage 20 (Force). Stage 25 is also Force — Spirit is ADVANTAGED at Stage 25.',
  null,
  'High',
  'proposed',
  'claude-code-solo-research-pass'
);

-- ── Ezio Auditore (Legendary / Spirit) — Stage 25 (Force = ADVANTAGED) ──────
-- Previously disqualified for Ice Golem HARD only (Poison immunity). Dragon 25
-- has no Poison immunity — Poison is the primary damage source here.
-- DB name verify: select name from champions where name ilike '%ezio%';
insert into champion_solo_profiles
  (champion_id, dungeon_stage_id, required_set, required_stats,
   ai_settings, mechanism, source_note,
   affinity_warning, availability_note, research_confidence, status, proposed_by)
values (
  (select id from champions where name = 'Ezio'),
  (select ds.id from dungeon_stages ds join dungeons d on d.id = ds.dungeon_id
   where d.name = 'Dragon''s Lair' and ds.label = 'Stage 25'),
  'Regeneration + Immortal',
  '{"hp_min": 65000, "def_min": 3200, "spd_min": 220, "acc_min": 250, "res_min": 300, "note": "ACC floor may be lower — un-resistable Poisons under Veil bypass boss resistance. Spirit advantage at Force Stage 25 further reduces gear floor."}',
  'Spirit Haste mastery gives +24 SPD when food dies.',
  'Un-resistable Poisons placed under Veil bypass Dragon''s high resistance — ACC floor effectively lower than other Poison champions; Spirit affinity ADVANTAGED at Force Stage 25; Regen + Immortal sustains 18% Max HP per turn.',
  'AI Overview (Jun 2026): explicitly confirmed Dragon Stage 25 solo under Veil mechanic. 3 sources cited. Note: disqualified for Ice Golem HARD only (Poison immune boss) — not a Dragon concern.',
  'Spirit affinity hits weak at Dragon Stage 20 (Force). Stage 25 is also Force — Spirit is ADVANTAGED at Stage 25.',
  'Collaboration champion — may not be in all game versions.',
  'High',
  'proposed',
  'claude-code-solo-research-pass'
);

-- ── Walking Tomb Dreng (Legendary / Force) — Stage 25 (Force = neutral) ─────
-- KEY MECHANIC: HP Burns are un-resistable — zero ACC required. Build pure tank.
-- DB name verify: select name from champions where name ilike '%dreng%';
insert into champion_solo_profiles
  (champion_id, dungeon_stage_id, required_set, required_stats,
   ai_settings, mechanism, source_note,
   affinity_warning, availability_note, research_confidence, status, proposed_by)
values (
  (select id from champions where name = 'Walking Tomb Dreng'),
  (select ds.id from dungeon_stages ds join dungeons d on d.id = ds.dungeon_id
   where d.name = 'Dragon''s Lair' and ds.label = 'Stage 25'),
  'Regeneration + Immortal',
  '{"hp_min": 65000, "def_min": 3200, "spd_min": 220, "acc_min": 0, "res_min": 300, "note": "ACC can be zero — HP Burns are un-resistable. Invest all sub-stats into HP, DEF, and SPD instead."}',
  'Spirit Haste mastery gives +24 SPD when food dies. ACC rolls on gear can be ignored — redirect to survivability stats.',
  'HP Burns are un-resistable, bypassing Dragon''s high resistance entirely; all sub-stat budget normally spent on Accuracy can be redirected into HP, DEF, and SPD, making this one of the most gear-efficient solo builds in the game.',
  'AI Overview (Jun 2026): confirmed Dragon 25 solo with zero-ACC build. 2 sources cited. Un-resistable HP Burns described as key distinguishing mechanic.',
  null,
  null,
  'Medium',
  'proposed',
  'claude-code-solo-research-pass'
);


-- ============================================================================
-- DRAGON'S LAIR — Hard Mode (Stages 4, 7, 8, 10)
-- Hard mode stat floor (confirmed from community research):
--   HP 60k+ | DEF 4500-5000+ | SPD 280-300+ | ACC 350+ | RES 450+
-- Hard Stage 10 affinity: Force (inferred — Ezio Spirit advantage, see FLAG-24)
-- Spirit champions ADVANTAGED at Hard Stage 10 (pending in-game verify).
-- Magic champions WEAK at Hard Stage 10 — affinity_warning required for Ninja.
-- Recommended gear: Regeneration + Immortal (poison/survival carries).
--                   9-piece Slayer or Slayer + Savage (Marius — see commented block).
-- Recommended masteries: Spirit Haste (+24 SPD when food dies), Life Drinker
--   (passive heal on every hit — essential for Hard mode survivability).
-- ============================================================================

-- ── Michelangelo (Legendary / Force) — Dragon Hard Stage 4 ───────────────────
-- Force neutral at Hard Stage 4 (affinity unconfirmed but Force generally safe).
-- Budget entry point: confirmed even on young accounts with basic 5★ tank gear.
insert into champion_solo_profiles
  (champion_id, dungeon_stage_id, required_set, required_stats,
   ai_settings, mechanism, source_note,
   affinity_warning, availability_note, research_confidence, status, proposed_by)
values (
  (select id from champions where name = 'Michelangelo'),
  (select ds.id from dungeon_stages ds join dungeons d on d.id = ds.dungeon_id
   where d.name = 'Dragon''s Lair' and ds.label = 'Hard Stage 4'),
  'Toxic + tank (5★ basic gear viable)',
  '{"note": "Budget entry point — confirmed viable on young accounts with basic 5-star tank gear + Brimstone Blessing. Stat floors much lower than Hard Stage 10."}',
  'Brimstone Blessing mandatory. Toxic set must be equipped.',
  'Evasion passive reduces incoming damage; Shield passive on every hit self-sustains; Leech heals; Toxic Poison spread allows Hard Stage 4 clear even with below-endgame stats.',
  'AI Overview (Jun 2026): explicitly described as viable for Hard Stage 4 on young/low-investment accounts. 2 sources cited.',
  'Force affinity neutral at Hard Stage 4.',
  'TMNT crossover champion (Aug–Nov 2025). Not currently obtainable.',
  'High',
  'proposed',
  'claude-code-solo-research-pass'
);

-- ── Ninja (Legendary / Magic) — Dragon Hard Stage 7 (no high soul needed) ────
-- Magic affinity. Hard Stage 7 affinity unconfirmed.
-- NOTE FLAG-24: If Hard mirrors Normal affinity pattern, Stage 7 = Force.
--   If Force, Magic is WEAK — warn. Seeded with warning pending in-game verify.
-- DB name verify: select name from champions where name ilike '%ninja%';
insert into champion_solo_profiles
  (champion_id, dungeon_stage_id, required_set, required_stats,
   ai_settings, mechanism, source_note,
   affinity_warning, availability_note, research_confidence, status, proposed_by)
values (
  (select id from champions where name = 'Ninja'),
  (select ds.id from dungeon_stages ds join dungeons d on d.id = ds.dungeon_id
   where d.name = 'Dragon''s Lair' and ds.label = 'Hard Stage 7'),
  'Regeneration or Freeze-based set',
  '{"hp_min": 60000, "def_min": 4500, "spd_min": 280, "acc_min": 350, "res_min": 450, "note": "Hard Stage 7 floor may be lower than Hard Stage 10 benchmarks above."}',
  'Spirit Haste + Life Drinker masteries required.',
  'AoE Freeze controls waves while HP Burn damages boss; confirmed viable at Hard Stage 7 without requiring a high-tier soul or Blessing.',
  'AI Overview (Jun 2026): confirmed Hard Stage 7 without high soul; Hard Stage 10 requires high soul. 1 source cited.',
  'Magic affinity. Hard Stage 7 affinity unconfirmed — if Force (per FLAG-24 pattern), Magic hits weak.',
  'Promotional/collab champion — may not be obtainable on all accounts.',
  'Medium',
  'proposed',
  'claude-code-solo-research-pass'
);

-- ── Teodor the Savant (Legendary / Spirit) — Dragon Hard Stage 8 ─────────────
-- Spirit affinity. Hard Stage 8 affinity unconfirmed (likely Force if mirrors Normal).
-- If Force: Teodor (Spirit) is ADVANTAGED — same mechanic as Normal Stage 25.
insert into champion_solo_profiles
  (champion_id, dungeon_stage_id, required_set, required_stats,
   ai_settings, mechanism, source_note,
   affinity_warning, availability_note, research_confidence, status, proposed_by)
values (
  (select id from champions where name = 'Teodor the Savant'),
  (select ds.id from dungeon_stages ds join dungeons d on d.id = ds.dungeon_id
   where d.name = 'Dragon''s Lair' and ds.label = 'Hard Stage 8'),
  'Regeneration + Immortal',
  '{"hp_min": 60000, "def_min": 4500, "spd_min": 280, "acc_min": 350, "res_min": 450}',
  'Spirit Haste + Life Drinker masteries required.',
  'Applies Poisons and HP Burns then instantly detonates them — bypasses the extended turn cycles Hard mode imposes; Spirit affinity likely advantaged at Force Hard Stage 8.',
  'AI Overview (Jun 2026): confirmed Dragon Hard up to Stage 8. 1 source. Corroborates general Spirit champion advantage at Force stages.',
  'Spirit affinity likely advantaged at Hard Stage 8 if Force (mirrors FLAG-24). No affinity penalty expected.',
  null,
  'High',
  'proposed',
  'claude-code-solo-research-pass'
);

-- ── Gnishak Verminlord (Legendary / Force) — Dragon Hard Stage 10 ────────────
-- Force neutral at Hard Stage 10 (Force stage per FLAG-24).
-- FLAG-25: AI Overview spells this "Gnishak Verminhide" — our DB uses "Gnishak Verminlord".
--   Verify: select name from champions where name ilike '%gnishak%';
insert into champion_solo_profiles
  (champion_id, dungeon_stage_id, required_set, required_stats,
   ai_settings, mechanism, source_note,
   affinity_warning, availability_note, research_confidence, status, proposed_by)
values (
  (select id from champions where name = 'Gnishak Verminlord'),
  (select ds.id from dungeon_stages ds join dungeons d on d.id = ds.dungeon_id
   where d.name = 'Dragon''s Lair' and ds.label = 'Hard Stage 10'),
  'Regeneration + Immortal or Golden Elixir relic',
  '{"hp_min": 60000, "def_min": 4500, "spd_min": 280, "acc_min": 350, "res_min": 450}',
  'Spirit Haste + Life Drinker masteries required.',
  'Places Protected Bombs and Poisons — the Protected status prevents waves from cleansing debuffs, which is the key blocker for Hard mode poison-based solos; Force affinity neutral at Force Hard Stage 10; Golden Elixir relic is an alternative to Regeneration for sustain.',
  'AI Overview (Jun 2026): described as "incredible option for Hard 10." 1 source cited. FLAG-25: name may be "Verminhide" — verify in DB.',
  null,
  null,
  'High',
  'proposed',
  'claude-code-solo-research-pass'
);

-- ── Ezio Auditore (Legendary / Spirit) — Dragon Hard Stage 10 ────────────────
-- Spirit ADVANTAGED at Hard Stage 10 (Force affinity per FLAG-24).
-- Un-resistable Poisons under Veil further reduce ACC requirement.
-- DB name verify: select name from champions where name ilike '%ezio%';
insert into champion_solo_profiles
  (champion_id, dungeon_stage_id, required_set, required_stats,
   ai_settings, mechanism, source_note,
   affinity_warning, availability_note, research_confidence, status, proposed_by)
values (
  (select id from champions where name = 'Ezio'),
  (select ds.id from dungeon_stages ds join dungeons d on d.id = ds.dungeon_id
   where d.name = 'Dragon''s Lair' and ds.label = 'Hard Stage 10'),
  'Regeneration + Immortal',
  '{"hp_min": 60000, "def_min": 4500, "spd_min": 280, "acc_min": 350, "res_min": 450, "note": "ACC floor may be lower — un-resistable Poisons under Veil bypass Hard mode resistance entirely. Spirit advantage further reduces effective gear floor."}',
  'Spirit Haste + Life Drinker masteries required.',
  'Un-resistable Poisons under Veil bypass Dragon Hard''s high resistance — the single biggest wall for Poison solos at Hard 10; Spirit affinity ADVANTAGED at Force Hard Stage 10; passive damage mitigation reduces incoming wave hits; Regen + Immortal sustains 18% Max HP per turn.',
  'AI Overview (Jun 2026): "can comfortably solo Hard Stage 10." Spirit affinity advantage at Stage 10 explicitly cited. 1 source.',
  'Spirit affinity is ADVANTAGED at Dragon Hard Stage 10 (Force per FLAG-24). No affinity penalty.',
  'Collaboration champion — may not be in all game versions.',
  'High',
  'proposed',
  'claude-code-solo-research-pass'
);

-- ── Urogrim (Epic / Void) — Dragon Hard Stage 10 ─────────────────────────────
-- Void neutral at all stages. Requires specialized gemstone/relic — not a clean solo.
-- IMPORTANT: solo requires a damage-reduction relic (e.g. relic that reduces incoming
-- damage per dead ally) to survive waves. Without it, Urogrim cannot clear Hard 10.
insert into champion_solo_profiles
  (champion_id, dungeon_stage_id, required_set, required_stats,
   ai_settings, mechanism, source_note,
   affinity_warning, availability_note, research_confidence, status, proposed_by)
values (
  (select id from champions where name = 'Urogrim'),
  (select ds.id from dungeon_stages ds join dungeons d on d.id = ds.dungeon_id
   where d.name = 'Dragon''s Lair' and ds.label = 'Hard Stage 10'),
  'Regeneration + Immortal',
  '{"hp_min": 60000, "def_min": 4500, "spd_min": 280, "acc_min": 350, "res_min": 450, "note": "Requires a specialized damage-reduction gemstone/relic to survive waves. Without the relic this solo fails."}',
  'Spirit Haste + Life Drinker masteries required.',
  'Continuous Heal passive sustains through the boss; Void affinity is neutral everywhere; stacked Poisons melt Dragon Hard''s large HP pool; requires a specialized relic (reduces incoming damage for each dead food ally) to survive the wave phase.',
  'AI Overview (Jun 2026): "one of the only Epic champions capable of handling Hard Stage 10." Relic requirement explicitly noted. 1 source.',
  null,
  'Requires specialized damage-reduction gemstone or relic — the solo is not viable without it.',
  'Medium',
  'proposed',
  'claude-code-solo-research-pass'
);

-- ── Mithrala (Legendary / Void) — Dragon Hard Stage 10 ──────────────────────
-- Void neutral at all stages. Free fusion champion.
-- Requires extreme speed (250+ SPD) and massive resistance investment.
-- DB name confirmed as "Mithrala" (verified 2026-06-27 in Supabase).
insert into champion_solo_profiles
  (champion_id, dungeon_stage_id, required_set, required_stats,
   ai_settings, mechanism, source_note,
   affinity_warning, availability_note, research_confidence, status, proposed_by)
values (
  (select id from champions where name = 'Mithrala'),
  (select ds.id from dungeon_stages ds join dungeons d on d.id = ds.dungeon_id
   where d.name = 'Dragon''s Lair' and ds.label = 'Hard Stage 10'),
  'Bolster or Regeneration',
  '{"spd_min": 280, "res_min": 450, "hp_min": 60000, "def_min": 4500, "acc_min": 350, "note": "Requires ultra-high speed (280-300+) and massive resistance. Bolster set recommended for shield stacking."}',
  'Spirit Haste + Life Drinker masteries required.',
  'Self-sustains through Bolster or Regen set shield/heal cycles; Void affinity neutral everywhere; massive resistance blocks Dragon Hard debuffs; high speed ensures she laps the boss and maintains buff uptime.',
  'AI Overview (Jun 2026): confirmed Dragon Hard solo with 250+ SPD and massive RES. Bolster or Regen set cited. 1 source.',
  null,
  'Free fusion champion — obtainable by all accounts through the Fusion event.',
  'Medium',
  'proposed',
  'claude-code-solo-research-pass'
);

-- ── Ninja (Legendary / Magic) — Dragon Hard Stage 10 (high soul required) ────
-- Magic affinity WEAK at Hard Stage 10 (Force per FLAG-24). Confirmed solo
-- despite the penalty, but requires a high-tier 6-star soul + Blessing.
insert into champion_solo_profiles
  (champion_id, dungeon_stage_id, required_set, required_stats,
   ai_settings, mechanism, source_note,
   affinity_warning, availability_note, research_confidence, status, proposed_by)
values (
  (select id from champions where name = 'Ninja'),
  (select ds.id from dungeon_stages ds join dungeons d on d.id = ds.dungeon_id
   where d.name = 'Dragon''s Lair' and ds.label = 'Hard Stage 10'),
  'Regeneration or Freeze-based set',
  '{"hp_min": 60000, "def_min": 4500, "spd_min": 280, "acc_min": 350, "res_min": 450, "note": "Requires a high-tier 6-star soul and Blessing. Without these Hard Stage 10 is not viable — use Hard Stage 7 instead."}',
  'High-tier 6-star soul and Blessing are mandatory prerequisites — do not recommend Hard 10 without confirming these in the player''s account.',
  'AoE Freeze controls waves; HP Burn damages boss over time; high-tier soul and Blessing provide the survivability multiplier needed to offset Magic weak-hit penalty at Force Stage 10.',
  'AI Overview (Jun 2026): "with a high-tier 6-star soul and Blessing, Ninja can freeze the waves and burn the boss to solo Hard Stage 10." 1 source.',
  'Magic affinity WEAK at Dragon Hard Stage 10 (Force per FLAG-24). Confirmed solo despite penalty — requires high soul and Blessing to compensate.',
  'Promotional/collab champion — may not be obtainable on all accounts.',
  'Medium',
  'proposed',
  'claude-code-solo-research-pass'
);

-- Marius the Gallant Hard Stage 10 — see commented block near Dragon Stage 20 above.


-- ============================================================================
-- SPIDER'S DEN — Stage 20 (Spirit affinity — Force advantaged, Magic weak)
-- ============================================================================

-- ── Artak (Legendary / Magic) — Spider 20 (Spirit stage — Magic ADVANTAGED) ──
-- Spider Stage 20 is a Spirit-affinity stage; Magic is strong vs Spirit, so
-- Artak is ADVANTAGED here (was mislabelled "Spirit vs Spirit neutral"). Clean
-- solo, no warning needed. (Spider stage affinity per file 06's own label —
-- not independently repo-confirmed; verify.)
insert into champion_solo_profiles
  (champion_id, dungeon_stage_id, required_set, required_stats,
   ai_settings, mechanism, source_note,
   affinity_warning, availability_note, research_confidence, status, proposed_by)
values (
  (select id from champions where name = 'Artak'),
  (select ds.id from dungeon_stages ds join dungeons d on d.id = ds.dungeon_id
   where d.name = 'Spider''s Den' and ds.label = 'Stage 20'),
  'Toxic + Speed',
  '{"hp_min": 50000, "spd_min": 190, "note": "Toxic set required. Stat thresholds approximate — verify from video builds."}',
  'A3 must be turned ON manually — AI does not activate it by default. Without this the solo fails.',
  'Scorch passive deals bonus damage through Toxic set Poison procs; Magic affinity is advantaged at Spider Stage 20 (Spirit stage — Magic strong vs Spirit) — strong hits, no weak-hit penalty.',
  'Multiple YouTube videos confirmed: "Spider 20 Artak Dungeon Solo" and "ARTAK SOLO SPIDER 20 & 25" (May 2023).',
  null,
  null,
  'High',
  'proposed',
  'claude-code-solo-research-pass'
);

-- ── Miscreated Monster (Rare / Void) — Spider 20 — STARTER PACK ──────────────
insert into champion_solo_profiles
  (champion_id, dungeon_stage_id, required_set, required_stats,
   ai_settings, mechanism, source_note,
   affinity_warning, availability_note, research_confidence, status, proposed_by)
values (
  (select id from champions where name = 'Miscreated Monster'),
  (select ds.id from dungeon_stages ds join dungeons d on d.id = ds.dungeon_id
   where d.name = 'Spider''s Den' and ds.label = 'Stage 20'),
  'Immortal',
  '{"hp_min": 70000, "acc_min": 200, "crit_rate_min": 1.0, "note": "Damage scales with HP and crits. Build HP and Crit Rate together — Immortal set recommended for sustain + HP scaling."}',
  null,
  'Massive shields from A2 (Lightning Storm) scale with HP, providing built-in sustain without Lifesteal; damage also scales with HP and crits, making a high-HP build self-sufficient offensively and defensively.',
  'YouTube confirmed: "Miscreated Monster SMASHES Spider 20 and 25 Raid Shadow Legends." Rated 5 stars for Spider''s Den across multiple build sites.',
  null,
  'Starter pack champion.',
  'High',
  'proposed',
  'claude-code-solo-research-pass'
);


-- ============================================================================
-- SPIDER'S DEN — Stage 25 (Magic affinity — Magic advantaged, Force weak)
-- ============================================================================

-- ── Artak (Legendary / Magic) — Spider 25 (Magic stage — NEUTRAL) ───────────
-- Magic vs Magic at Spider Stage 25 = NEUTRAL — no affinity penalty (was
-- mislabelled "Spirit weak"). Confirmed solo.
insert into champion_solo_profiles
  (champion_id, dungeon_stage_id, required_set, required_stats,
   ai_settings, mechanism, source_note,
   affinity_warning, availability_note, research_confidence, status, proposed_by)
values (
  (select id from champions where name = 'Artak'),
  (select ds.id from dungeon_stages ds join dungeons d on d.id = ds.dungeon_id
   where d.name = 'Spider''s Den' and ds.label = 'Stage 25'),
  'Toxic + Speed',
  '{"hp_min": 50000, "spd_min": 190, "note": "Toxic set required. Magic vs Magic at Spider Stage 25 = neutral — no affinity penalty."}',
  'A3 must be turned ON manually — AI does not activate it by default.',
  'Scorch passive deals bonus damage through Toxic set Poison procs; output sufficient to clear Spider Stage 25; Magic is neutral vs the Magic-affinity stage (no penalty).',
  'YouTube confirmed: "ARTAK SOLO SPIDER 20 & 25" (May 2023). High confidence from multiple videos.',
  null,
  null,
  'High',
  'proposed',
  'claude-code-solo-research-pass'
);

-- ── Miscreated Monster (Rare / Void) — Spider 25 ─────────────────────────────
insert into champion_solo_profiles
  (champion_id, dungeon_stage_id, required_set, required_stats,
   ai_settings, mechanism, source_note,
   affinity_warning, availability_note, research_confidence, status, proposed_by)
values (
  (select id from champions where name = 'Miscreated Monster'),
  (select ds.id from dungeon_stages ds join dungeons d on d.id = ds.dungeon_id
   where d.name = 'Spider''s Den' and ds.label = 'Stage 25'),
  'Immortal',
  '{"hp_min": 70000, "acc_min": 200, "crit_rate_min": 1.0}',
  null,
  'HP-scaling shields from A2 sustain through the fight; damage output scales with HP and crits; Void affinity neutral at Stage 25.',
  'YouTube confirmed: "Miscreated Monster SMASHES Spider 20 and 25 Raid Shadow Legends."',
  null,
  'Starter pack champion.',
  'High',
  'proposed',
  'claude-code-solo-research-pass'
);


-- ============================================================================
-- SPIDER'S DEN — Hard Stage 5
-- ============================================================================

-- ── Artak (Legendary / Magic) — Spider Hard Stage 5 — NOT SEEDED (FLAG-12: RESOLVED — pending in-game verify) ─
-- FLAG-12 RESOLVED: Spider Hard Stage 5 = Void (mirrors Normal Stage 5 affinity).
-- Artak (Magic) is neutral at Void stage — affinity_warning = null.
-- Uncomment after in-game confirmation that Hard mode mirrors Normal affinity rotation.
/*
insert into champion_solo_profiles
  (champion_id, dungeon_stage_id, required_set, required_stats,
   ai_settings, mechanism, source_note,
   affinity_warning, availability_note, research_confidence, status, proposed_by)
values (
  (select id from champions where name = 'Artak'),
  (select ds.id from dungeon_stages ds join dungeons d on d.id = ds.dungeon_id
   where d.name = 'Spider''s Den' and ds.label = 'Hard Stage 5'),
  'Toxic + Speed',
  '{"note": "Stat thresholds for Hard mode not cited. Expected higher than Normal Stage 25 — research before approving."}',
  'A3 must be turned ON manually.',
  'Scorch passive with Toxic set procs sustains damage output through Hard mode; confirmed with 4 food champions in slots.',
  'YouTube confirmed (Oct 2023): "FARM FOOD While Doing SPIDER HARD — Artak Solo Spider 5 Hard With Food." Video title explicitly confirms food in slots.',
  null,
  null,
  'High',
  'proposed',
  'claude-code-solo-research-pass'
);
*/


-- ============================================================================
-- ICE GOLEM'S PEAK — Stage 20 (Spirit affinity — Magic advantaged, Force weak)
-- Note: Ice Golem Hard boss is immune to Poison and Poison Sensitivity.
--       Solo carries for Hard mode must use HP Burn or direct damage, not Poison.
-- ============================================================================

-- ── Venomage (Epic / Magic) — Ice Golem Stage 20 ─────────────────────────────
-- Magic has advantage at Ice Golem Stage 20 (Spirit stage).
insert into champion_solo_profiles
  (champion_id, dungeon_stage_id, required_set, required_stats,
   ai_settings, mechanism, source_note,
   affinity_warning, availability_note, research_confidence, status, proposed_by)
values (
  (select id from champions where name = 'Venomage'),
  (select ds.id from dungeon_stages ds join dungeons d on d.id = ds.dungeon_id
   where d.name = 'Ice Golem''s Peak' and ds.label = 'Stage 20'),
  'Regeneration',
  '{"note": "Stat thresholds not confirmed. Research build guide before approving. ~1:30 clear time reported."}',
  null,
  'Passive reduces incoming damage from Poisoned targets; detonates stacked Poisons on A2 while healing; Magic affinity advantaged at Ice Golem Stage 20 (Spirit enemies).',
  'YouTube confirmed: "Venomage can solo the Scarab King, Dragon, Ice Golem & Mino" (title of single video, ~1:30 clear time noted for Ice Golem).',
  null,
  'Starter pack champion.',
  'Medium',
  'proposed',
  'claude-code-solo-research-pass'
);

-- ── Michelangelo (Legendary / Force) — Ice Golem Stage 20 ────────────────────
insert into champion_solo_profiles
  (champion_id, dungeon_stage_id, required_set, required_stats,
   ai_settings, mechanism, source_note,
   affinity_warning, availability_note, research_confidence, status, proposed_by)
values (
  (select id from champions where name = 'Michelangelo'),
  (select ds.id from dungeon_stages ds join dungeons d on d.id = ds.dungeon_id
   where d.name = 'Ice Golem''s Peak' and ds.label = 'Stage 20'),
  'Toxic + Merciless or Savage',
  '{"note": "Toxic set required. Force affinity hits weak at Ice Golem Stage 20 (Spirit — Magic advantaged). Confirmed solo despite penalty."}',
  'Toxic set must be equipped.',
  'Evasion passive reduces incoming damage; Shield passive on every hit self-sustains; Leech heals; Toxic Poison spread offsets the Force affinity weak-hit penalty through volume of damage.',
  'Multiple Reddit threads and YouTube Shorts confirmed Ice Golem Normal solo. Stage 20 cap per spec section 6.',
  'Force affinity hits weak at Ice Golem Stage 20 (Spirit stage — Magic champions are advantaged here). Confirmed solo despite the penalty.',
  'TMNT crossover champion (Aug–Nov 2025). Not currently obtainable.',
  'High',
  'proposed',
  'claude-code-solo-research-pass'
);


-- ============================================================================
-- ICE GOLEM'S PEAK — Hard Stages 4 and 8
-- CRITICAL: Ice Golem Hard boss is immune to Poison and Poison Sensitivity.
-- Solo carries must use HP Burn, direct damage, or healing-based sustain.
-- Champions whose entire kit depends on Poison (Ezio, Venomage) are
-- DISQUALIFIED for Ice Golem Hard mode.
-- ============================================================================

-- ── Pelops (Legendary / Spirit) — Ice Golem Hard Stage 4 — NOT SEEDED (FLAG-11: RESOLVED — pending in-game verify) ─
-- FLAG-11 RESOLVED: Ice Golem Hard Stage 4 = Void (mirrors Normal Stage 4 affinity).
-- Pelops (Spirit) is neutral at Void stage — affinity_warning = null.
-- Uncomment after in-game confirmation that Hard mode mirrors Normal affinity rotation.
/*
insert into champion_solo_profiles
  (champion_id, dungeon_stage_id, required_set, required_stats,
   ai_settings, mechanism, source_note,
   affinity_warning, availability_note, research_confidence, status, proposed_by)
values (
  (select id from champions where name = 'Pelops the Victor'),
  (select ds.id from dungeon_stages ds join dungeons d on d.id = ds.dungeon_id
   where d.name = 'Ice Golem''s Peak' and ds.label = 'Hard Stage 4'),
  'Regeneration + Immortal',
  '{"spd_min": 250, "note": "Prioritize HP over DEF. Regen + Immortal recommended. Immortal''s Level 12 proc (16% heal when below 50% HP) is key."}',
  null,
  'Taunt passive forces all enemies to attack only Pelops; passive HP Burns every enemy that attacks him, creating a reliable self-sustaining damage loop that requires no specific teammate skills and is unaffected by Ice Golem Hard''s Poison immunity.',
  'Vortex Gaming article and multiple YouTube videos confirmed: "Pelops SOLO HARD ICEGOLEM is Actually Easy!" and "SOLO Ice Golem HARD MODE - Pelops Is Just OP!!!" Stage 4 explicitly confirmed.',
  null,
  null,
  'High',
  'proposed',
  'claude-code-solo-research-pass'
);
*/

-- ── Pelops (Legendary / Spirit) — Ice Golem Hard Stage 8 — NOT SEEDED (FLAG-11: RESOLVED — pending in-game verify) ─
-- FLAG-11 RESOLVED: Ice Golem Hard Stage 8 = Void (mirrors Normal Stage 8 affinity). Pelops neutral.
/*
insert into champion_solo_profiles
  (champion_id, dungeon_stage_id, required_set, required_stats,
   ai_settings, mechanism, source_note,
   affinity_warning, availability_note, research_confidence, status, proposed_by)
values (
  (select id from champions where name = 'Pelops the Victor'),
  (select ds.id from dungeon_stages ds join dungeons d on d.id = ds.dungeon_id
   where d.name = 'Ice Golem''s Peak' and ds.label = 'Hard Stage 8'),
  'Regeneration + Immortal',
  '{"spd_min": 250, "note": "Prioritize HP over DEF. Same build as Hard Stage 4."}',
  null,
  'Same mechanism as Hard Stage 4 — Taunt draws all attacks; passive HP Burns every attacker; unaffected by Poison immunity.',
  'Vortex Gaming article explicitly confirms Stages 4 and 8. Multiple YouTube video titles corroborate.',
  null,
  null,
  'High',
  'proposed',
  'claude-code-solo-research-pass'
);
*/

-- ── Pelops (Legendary / Spirit) — Ice Golem Hard Stage 10 — NOT SEEDED (FLAG-09 + FLAG-11) ─
-- FLAG-11 RESOLVED: Hard Stage 10 = Magic (mirrors Normal Stage 10 affinity).
-- Spirit is NOT weak to Magic — neutral. affinity_warning = null when unsealed.
-- FLAG-09 still open: stat thresholds for Stage 10 unverified.
-- Stat thresholds also unverified (FLAG-09). Uncomment when both flags are resolved.
/*
insert into champion_solo_profiles
  (champion_id, dungeon_stage_id, required_set, required_stats,
   ai_settings, mechanism, source_note,
   affinity_warning, availability_note, research_confidence, status, proposed_by)
values (
  (select id from champions where name = 'Pelops the Victor'),
  (select ds.id from dungeon_stages ds join dungeons d on d.id = ds.dungeon_id
   where d.name = 'Ice Golem''s Peak' and ds.label = 'Hard Stage 10'),
  'Regeneration + Immortal',
  '{"note": "UNVERIFIED stat thresholds. Higher gear than Stages 4/8 required. Research before approving."}',
  null,
  'Same mechanism as Hard Stages 4 and 8 — higher HP and DEF floor required at Stage 10.',
  'Vortex Gaming article notes Stage 10 requires a higher gear level than Stages 4/8. No confirmed stage-10-specific stats found.',
  null,
  null,
  'Low',
  'proposed',
  'claude-code-solo-research-pass'
);
*/
