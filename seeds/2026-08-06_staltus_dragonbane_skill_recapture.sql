-- seeds/2026-08-06_staltus_dragonbane_skill_recapture.sql
-- DATA-INTEGRITY re-capture of Staltus Dragonbane
--   (champions.id = e627d4a5-8c62-4203-96f2-6a4f918342e4 — Legendary, Banner Lords, Force, Defense)
-- from TIER-1 verbatim skill text, corroborated across TWO independent sources
-- (raid.guide + AyumiLove, read by hand 2026-08-06) and cross-checked against Mike's
-- July-2026 in-game Index readings already banked in seeds 64 & 66.
--
-- WHY: his whole champion_skills row was mis-captured by the "worksheet Skills tab
-- 2026-07-11" bulk source (same class as Morag Bronzelock — see
-- seeds/2026-08-06_morag_bronzelock_skill_recapture.sql). His skill NAMES were generic
-- placeholders ("Basic Attack" / "Crowd Control" / "Self Buff/Debuff" / "Dragon's Fury"),
-- the summaries were vague/paraphrased, cooldowns were null, and the passive's mechanic
-- was WRONG. Because of that he was DROPPED from the CB skill-tags roster
-- (seeds/2026-08-06_cb_skill_tags_roster.sql, note (3)). This seed lands the correct kit
-- and then authors his per-skill champion_skill_tags rows.
--
-- ERRORS CORRECTED (old -> verified in-game):
--   A1 "Basic Attack"       -> "Axe of Glory". Summary was "Attacks an enemy. 20% chance
--                              -20% TM if debuffed" — WRONG: it is 2 hits, and the Turn-Meter
--                              cut is a GUARANTEED -10% per hit whenever the target is under
--                              ANY debuff (not a 20% chance, not -20%). No cooldown.
--   A2 "Crowd Control"      -> "Drakehunter Tactics" (cd 4; booked 3 via a Cooldown-1 book).
--                              Summary keeps the verbatim maxed 50% Stun chance.
--   A3 "Self Buff/Debuff"   -> "Dragon Heart" (cd 5; booked 4). Vague "(conditional)" replaced
--                              with the two explicit ATK-vs-DEF branches + the 60% self [Increase
--                              DEF] 3t and the exact 25% C.DMG / 30% SPD magnitudes.
--   A4 "Dragon's Fury"      -> "Untarnished" (passive). Mechanic was WRONG: DB said the passive
--                              made him "Immune to [Poison]/[Decrease DEF]/[Weaken]". It does NOT
--                              grant immunity — it REFLECTS those three debuffs back onto the
--                              attacker (a redirect, not an immunity). Both Tier-1 sources agree,
--                              as does seed 64's champion_ai_notes reading. ascension_required
--                              0 -> 3 (passive default per the CLAUDE.md star-color rule; Staltus
--                              was only ever seen at magenta/ascended, so a yellow-star screenshot
--                              is still needed to confirm — flagged, not asserted).
--   AURA (champion_auras row, was "None/None/None") -> DEF / 30% / All Battles.
--
-- BOOKED-vs-UNBOOKED reconciliation (important, resolves an apparent conflict):
--   raid.guide/AyumiLove DISPLAY the fully-booked (maxed) skill text. Proof: their A3 shows
--   75% while Mike's July screenshot (seed 66) reads A3 as 50% unbooked -> 75% booked
--   (+10% Lvl4, +15% Lvl5). Applying the same convention to A2, the displayed 50% is the
--   BOOKED value, so unbooked = 35% (+15% book). The old worksheet's "50% (65% booked)"
--   note mis-read the maxed 50% as the base and stacked the book on top — that was the bug.
--   Per the project rule (skill-book-data-model memory: chances in skill_summary are BOOKED),
--   skill_summary carries the maxed chances (50% / 75%); the true unbooked values are recorded
--   in the champion_skill_tags source_notes below.
--
-- Written back to the master worksheet 'Skills' + 'Auras' sheets the SAME session
-- (CLAUDE.md writeback discipline). Apply via tools/apply-seed-pooler.mjs.
-- Sources: raid.guide/en/shadow-legends/staltus-dragonbane (Tier-1, verbatim Plarium text);
--          ayumilove.net (Tier-2 human read, corroborating); seeds 64 & 66 (Mike in-game Index).

begin;

-- ── A1 Axe of Glory ──────────────────────────────────────────────────────────
update champion_skills s set
  skill_name = 'Axe of Glory',
  skill_summary = 'Attacks 1 enemy 2 times. If the target is under any debuff, each hit decreases the target''s Turn Meter by 10%.',
  cooldown_base = null,
  cooldown_booked = null,
  ascension_required = 0,
  verification_status = 'verified',
  source = 'raid.guide + AyumiLove (verbatim), corroborated by in-game Index (seeds 64/66) 2026-08-06',
  review_notes = 'Re-capture 2026-08-06: prior name "Basic Attack"; summary "20% chance -20% TM if debuffed" was WRONG — 2 hits, GUARANTEED -10% TM per hit when target is under any debuff. Dmg 1.9x DEF.'
from champions c where s.champion_id = c.id and c.name = 'Staltus Dragonbane' and c.game_id = 'raid_shadow_legends' and s.slot = 'A1';

-- ── A2 Drakehunter Tactics ───────────────────────────────────────────────────
update champion_skills s set
  skill_name = 'Drakehunter Tactics',
  skill_summary = 'Attacks all enemies 2 times. Each hit has a 50% chance of placing a [Stun] debuff for 1 turn.',
  cooldown_base = '4',
  cooldown_booked = '3',
  ascension_required = 0,
  verification_status = 'verified',
  source = 'raid.guide + AyumiLove (verbatim), corroborated by in-game Index (seeds 64/66) 2026-08-06',
  review_notes = 'Re-capture 2026-08-06: prior name "Crowd Control". Displayed 50% Stun is the BOOKED value (unbooked 35%, +15% book). Base cd 4, booked 3 (Cooldown-1 book). Dmg 2.1x DEF.'
from champions c where s.champion_id = c.id and c.name = 'Staltus Dragonbane' and c.game_id = 'raid_shadow_legends' and s.slot = 'A2';

-- ── A3 Dragon Heart ──────────────────────────────────────────────────────────
update champion_skills s set
  skill_name = 'Dragon Heart',
  skill_summary = 'Places a 60% [Increase DEF] buff on this Champion for 3 turns, then attacks all enemies. Has a 75% chance of placing a 25% [Decrease C. DMG] debuff for 2 turns on enemies whose ATK is higher than their DEF. Has a 75% chance of placing a 30% [Decrease SPD] debuff for 2 turns on enemies whose ATK is equal to or lower than their DEF.',
  cooldown_base = '5',
  cooldown_booked = '4',
  ascension_required = 0,
  verification_status = 'verified',
  source = 'raid.guide + AyumiLove (verbatim), corroborated by in-game Index (seeds 64/66) 2026-08-06',
  review_notes = 'Re-capture 2026-08-06: prior name "Self Buff/Debuff"; vague "(conditional)" replaced with the two explicit ATK-vs-DEF branches. Displayed 75% is BOOKED (unbooked 50%, +10% Lvl4 +15% Lvl5). Base cd 5, booked 4 (Cooldown-1 book). Dmg 4x DEF.'
from champions c where s.champion_id = c.id and c.name = 'Staltus Dragonbane' and c.game_id = 'raid_shadow_legends' and s.slot = 'A3';

-- ── A4 Untarnished (passive) ─────────────────────────────────────────────────
update champion_skills s set
  skill_name = 'Untarnished',
  skill_summary = 'Whenever an enemy attempts to place a [Weaken] debuff, a [Decrease DEF] debuff, or a [Poison] debuff on this Champion, reflects them back onto the attacker. Damage increases by 5% for each debuff on the target.',
  cooldown_base = null,
  cooldown_booked = null,
  ascension_required = 3,
  verification_status = 'verified',
  source = 'raid.guide + AyumiLove (verbatim), corroborated by in-game Index (seed 64 ai_notes) 2026-08-06',
  review_notes = 'Re-capture 2026-08-06: prior name "Dragon''s Fury"; mechanic was WRONG — passive REFLECTS [Weaken]/[Decrease DEF]/[Poison] back onto the attacker, it does NOT grant immunity. Also +5% dmg per debuff on the target. ascension_required defaulted to 3 (passive star-color rule) — unconfirmed, needs a yellow-star screenshot.'
from champions c where s.champion_id = c.id and c.name = 'Staltus Dragonbane' and c.game_id = 'raid_shadow_legends' and s.slot = 'A4';

-- ── Aura (champion_auras) ────────────────────────────────────────────────────
update champion_auras a set
  aura_type = 'DEF',
  aura_value = '30%',
  aura_area = 'All Battles',
  aura_summary = 'Increases ally DEF in all battles by 30%.',
  verification_status = 'verified',
  source = 'raid.guide + AyumiLove (verbatim), corroborated by in-game Index (seed 64) 2026-08-06',
  review_notes = 'Re-capture 2026-08-06: prior row was the "None/None/None" placeholder ("Increases ally None in None."). Confirmed DEF +30% in all battles. Already reflected in champion_tags "DEF Aura" (approved, seed 64).'
from champions c where a.champion_id = c.id and c.name = 'Staltus Dragonbane' and c.game_id = 'raid_shadow_legends';

-- ============================================================================
-- champion_skill_tags — per-skill CB capability tags (was DROPPED from the roster
-- seed for the mis-capture; now authorable). chance_unbooked holds the STATED
-- (booked/max) chance, matching the roster-seed convention + the sim's
-- fully-booked assumption (the code reads chance_unbooked, defaulting null->100);
-- chance_booked is filled to match; the TRUE unbooked is documented in source_note.
-- Idempotent upsert on (champion_id, tag_id, skill_slot).
-- ============================================================================

-- A1 — Multi-Hit A1 (2 hits)
insert into champion_skill_tags (champion_id, skill_id, skill_slot, tag_id, magnitude_pct, stacks, duration_turns, hits, condition, chance_unbooked, chance_booked, status, source_type, source_note, proposed_by, approved_by, approved_at)
select c.id, s.id, 'A1', t.id, null, null, null, 2, null, 100, 100, 'approved', 'human_observation', 'Axe of Glory: attacks 1 enemy 2 times', 'staltus-recapture-2026-08-06', 'staltus-recapture-2026-08-06', now()
from champions c join tags t on t.name = 'Multi-Hit A1' left join champion_skills s on s.champion_id = c.id and s.slot = 'A1'
where c.name = 'Staltus Dragonbane' and c.game_id = 'raid_shadow_legends'
on conflict (champion_id, tag_id, skill_slot) do update set skill_id=excluded.skill_id, magnitude_pct=excluded.magnitude_pct, stacks=excluded.stacks, duration_turns=excluded.duration_turns, hits=excluded.hits, condition=excluded.condition, chance_unbooked=excluded.chance_unbooked, chance_booked=excluded.chance_booked, source_note=excluded.source_note, status=excluded.status;

-- A1 — Decrease Turn Meter (guaranteed -10%/hit IF target already debuffed). PROPOSED:
-- overturns seed-64's coarse-layer rejection under Tag Policy #1 SELF-COMBO EXCEPTION
-- (Staltus self-provides the prerequisite debuff via A2 [Stun] / A3 [Decrease C.DMG]/[SPD]),
-- but the rejection was a considered human call, so this is left for review, not auto-approved.
insert into champion_skill_tags (champion_id, skill_id, skill_slot, tag_id, magnitude_pct, stacks, duration_turns, hits, condition, chance_unbooked, chance_booked, status, source_type, source_note, proposed_by, approved_by, approved_at)
select c.id, s.id, 'A1', t.id, 10, null, null, 2, 'target under any debuff (self-combo: A2 [Stun] / A3 [Decrease C.DMG]/[Decrease SPD])', 100, 100, 'proposed', 'human_observation', 'Axe of Glory: each of 2 hits -10% Turn Meter if the target is under any debuff. Re-review of seed-64 rejection under Tag Policy #1 self-combo exception. NOTE: inert on Clan Boss (Demon Lord is Turn-Meter-immune) — value is Arena/dungeon waves.', 'staltus-recapture-2026-08-06', null, null
from champions c join tags t on t.name = 'Decrease Turn Meter' left join champion_skills s on s.champion_id = c.id and s.slot = 'A1'
where c.name = 'Staltus Dragonbane' and c.game_id = 'raid_shadow_legends'
on conflict (champion_id, tag_id, skill_slot) do update set skill_id=excluded.skill_id, magnitude_pct=excluded.magnitude_pct, stacks=excluded.stacks, duration_turns=excluded.duration_turns, hits=excluded.hits, condition=excluded.condition, chance_unbooked=excluded.chance_unbooked, chance_booked=excluded.chance_booked, source_note=excluded.source_note, status=excluded.status;

-- A2 — AoE Stun (all enemies x2, each hit 50% booked / 35% unbooked, 1t)
insert into champion_skill_tags (champion_id, skill_id, skill_slot, tag_id, magnitude_pct, stacks, duration_turns, hits, condition, chance_unbooked, chance_booked, status, source_type, source_note, proposed_by, approved_by, approved_at)
select c.id, s.id, 'A2', t.id, null, null, 1, 2, null, 50, 50, 'approved', 'human_observation', 'Drakehunter Tactics: all enemies 2x, each hit 50% [Stun] 1t (booked; 35% unbooked, +15% book). Per-enemy effective ~75% over 2 hits. NOTE: bosses are Stun-immune.', 'staltus-recapture-2026-08-06', 'staltus-recapture-2026-08-06', now()
from champions c join tags t on t.name = 'AoE Stun' left join champion_skills s on s.champion_id = c.id and s.slot = 'A2'
where c.name = 'Staltus Dragonbane' and c.game_id = 'raid_shadow_legends'
on conflict (champion_id, tag_id, skill_slot) do update set skill_id=excluded.skill_id, magnitude_pct=excluded.magnitude_pct, stacks=excluded.stacks, duration_turns=excluded.duration_turns, hits=excluded.hits, condition=excluded.condition, chance_unbooked=excluded.chance_unbooked, chance_booked=excluded.chance_booked, source_note=excluded.source_note, status=excluded.status;

-- A3 — Increase Defense (60% on self, 3t, guaranteed)
insert into champion_skill_tags (champion_id, skill_id, skill_slot, tag_id, magnitude_pct, stacks, duration_turns, hits, condition, chance_unbooked, chance_booked, status, source_type, source_note, proposed_by, approved_by, approved_at)
select c.id, s.id, 'A3', t.id, 60, null, 3, null, 'self', 100, 100, 'approved', 'human_observation', 'Dragon Heart: places a 60% [Increase DEF] buff on this Champion for 3 turns (guaranteed) before attacking. Feeds his DEF-scaling damage (A1 1.9x / A2 2.1x / A3 4x DEF).', 'staltus-recapture-2026-08-06', 'staltus-recapture-2026-08-06', now()
from champions c join tags t on t.name = 'Increase Defense' left join champion_skills s on s.champion_id = c.id and s.slot = 'A3'
where c.name = 'Staltus Dragonbane' and c.game_id = 'raid_shadow_legends'
on conflict (champion_id, tag_id, skill_slot) do update set skill_id=excluded.skill_id, magnitude_pct=excluded.magnitude_pct, stacks=excluded.stacks, duration_turns=excluded.duration_turns, hits=excluded.hits, condition=excluded.condition, chance_unbooked=excluded.chance_unbooked, chance_booked=excluded.chance_booked, source_note=excluded.source_note, status=excluded.status;

-- A3 — Decrease C.DMG (25%, 2t, on enemies whose ATK > DEF)
insert into champion_skill_tags (champion_id, skill_id, skill_slot, tag_id, magnitude_pct, stacks, duration_turns, hits, condition, chance_unbooked, chance_booked, status, source_type, source_note, proposed_by, approved_by, approved_at)
select c.id, s.id, 'A3', t.id, 25, null, 2, null, 'enemies whose ATK is higher than their DEF', 75, 75, 'approved', 'human_observation', 'Dragon Heart branch (ATK > DEF): 75% booked chance (50% unbooked, +10% Lvl4 +15% Lvl5) of a 25% [Decrease C. DMG] 2t. Mutually exclusive with the [Decrease SPD] branch.', 'staltus-recapture-2026-08-06', 'staltus-recapture-2026-08-06', now()
from champions c join tags t on t.name = 'Decrease C.DMG' left join champion_skills s on s.champion_id = c.id and s.slot = 'A3'
where c.name = 'Staltus Dragonbane' and c.game_id = 'raid_shadow_legends'
on conflict (champion_id, tag_id, skill_slot) do update set skill_id=excluded.skill_id, magnitude_pct=excluded.magnitude_pct, stacks=excluded.stacks, duration_turns=excluded.duration_turns, hits=excluded.hits, condition=excluded.condition, chance_unbooked=excluded.chance_unbooked, chance_booked=excluded.chance_booked, source_note=excluded.source_note, status=excluded.status;

-- A3 — Decrease Speed (30%, 2t, on enemies whose ATK <= DEF)
insert into champion_skill_tags (champion_id, skill_id, skill_slot, tag_id, magnitude_pct, stacks, duration_turns, hits, condition, chance_unbooked, chance_booked, status, source_type, source_note, proposed_by, approved_by, approved_at)
select c.id, s.id, 'A3', t.id, 30, null, 2, null, 'enemies whose ATK is equal to or lower than their DEF', 75, 75, 'approved', 'human_observation', 'Dragon Heart branch (ATK <= DEF): 75% booked chance (50% unbooked, +10% Lvl4 +15% Lvl5) of a 30% [Decrease SPD] 2t. This is the branch that applies vs DEF-based bosses (Ice Golem, Clan Boss). Mutually exclusive with the [Decrease C. DMG] branch.', 'staltus-recapture-2026-08-06', 'staltus-recapture-2026-08-06', now()
from champions c join tags t on t.name = 'Decrease Speed' left join champion_skills s on s.champion_id = c.id and s.slot = 'A3'
where c.name = 'Staltus Dragonbane' and c.game_id = 'raid_shadow_legends'
on conflict (champion_id, tag_id, skill_slot) do update set skill_id=excluded.skill_id, magnitude_pct=excluded.magnitude_pct, stacks=excluded.stacks, duration_turns=excluded.duration_turns, hits=excluded.hits, condition=excluded.condition, chance_unbooked=excluded.chance_unbooked, chance_booked=excluded.chance_booked, source_note=excluded.source_note, status=excluded.status;

-- NOTE: the passive Untarnished reflection is a REDIRECT mechanic (Tag Policy #13 -> not a
-- placement, no skill_tag) and is already captured as a champion_ai_notes row (seed 64).
-- His AoE damage on A2/A3 stays in the coarse champion_tags layer ("AoE Damage", approved,
-- seed 66) rather than duplicated here, matching the roster-seed pattern.

commit;
