-- ============================================================================
-- Seed 60 — Stonebound Thisbe champion row + in-game skill tags
-- Source: in-game champion Index / skill-detail popups, captured verbatim from
-- a screen recording of Stonebound Thisbe (Lvl 60, 6★) on 2026-07-08.
-- source_type='in_game_index' (PRIMARY). status='proposed' — HUMAN REVIEW
-- REQUIRED; the match engine only reads status='approved' tags. No auto-merge.
--
-- (0) CHAMPION ROW — Stonebound Thisbe is absent from every committed seed (not in
--     seeds/15). Created here (idempotent; mirrors seeds/44 Venomage). Identity from
--     the in-game detail screen AND the Argonites collection screen: Argonites /
--     Spirit (green affinity icon) / Epic / Support.
--
--     >>> WORKSHEET DISCREPANCY (for Mike to fix on the master sheet): the roster
--         worksheet row C000500 lists her as Magic / ATTACK.
--         In-game (authoritative) shows SPIRIT / SUPPORT (confirmed on both the
--         champion detail header and the Argonites faction collection card). This
--         seed uses the correct Spirit affinity; the worksheet Champions row needs
--         Affinity Magic->Spirit and Role Attack->Support (Ayumi code AR-EAM ->
--         AR-ESS). (Same class of AyumiLove-sourced error as Michelangelo, seed 46.)
--         NOTE: the champions table has no role column, so the repo only records the
--         affinity fix; the role fix is worksheet-only. <<<
--
-- (1) FULL KIT (in-game, Level 1 = UNBOOKED). Damage [ATK]-based; all four skills
--     were visible/unlocked at 6★ (NONE ascension-gated):
--       A1 Eyes Of Granite: "Attacks 1 enemy. 25% chance of a 50% [Decrease ATK] 2t.
--         Steals 10% of the target's Turn Meter." Books: +10% Dmg L2/L3, +10% Chance
--         L4, +15% Chance L5.
--       A2 Fangs Of Quartz (cd 5t): "Attacks all enemies. 75% chance of a [Hex] and a
--         [Block Buffs] debuff on all enemies 2t." Books: +20% Dmg L2, +10% Chance L3,
--         +15% Chance L4, Cooldown -1 L5, Cooldown -1 L6 (5 -> 3).
--       A3 Heart Of Flint (cd 5t): "Decreases the duration of ALL ally debuffs by 1
--         turn. Heals ALL allies by 15% of their MAX HP. Fills the Turn Meters of ALL
--         allies by 20%." Books: +5% Heal L2/L3, Cooldown -1 L4/L5 (5 -> 3).
--       Passive Heir Of The Gorgoa [P]: "Allies deal 10% more damage to enemies under
--         debuffs placed by this Champion" (team damage amplifier; one copy activates).
--     Aura: +40 [ACC] to all allies in all Battles (ACC Aura; shown in the recording).
--
-- (2) TAGS ADDED (existing vocab; the SOLID ones). ascension_required = 0 for all:
--       * Decrease Attack     — A1 Eyes Of Granite (50%, 25% chance, 2t).
--       * Decrease Turn Meter — A1 (steals 10% of the target's TM).
--       * AoE Damage          — A2 Fangs Of Quartz (attacks all enemies).
--       * Hex                 — A2 (75% chance, all enemies, 2t).
--       * Block Buffs         — A2 (75% chance, all enemies, 2t).
--       * Healer              — A3 Heart Of Flint (heals ALL allies 15% of their MAX HP).
--       * Increase Turn Meter — A3 (fills ALL allies' TM by 20%; ally-facing).
--       * ACC Aura            — aura, +40 ACC all Battles (vocab from seeds/47).
--
-- (3) NOT TAGGED — logged in KNOWN_GAPS.md ("Stonebound Thisbe pending-review tag
--     decisions"), no vocabulary:
--       * Debuff-duration reduction (A3 — "decreases the duration of all ally debuffs
--         by 1 turn") — a partial cleanse; distinct from [Cleanse] (which removes
--         debuffs entirely). No vocab.
--       * Team damage amplification (passive — allies +10% dmg vs her-debuffed
--         enemies) — no vocab (a recurring "damage amp vs debuffed" concept).
-- ============================================================================

-- (0) Champion row (idempotent; mirrors seeds/44 Venomage pattern). Affinity Spirit
--     per the in-game Index (worksheet's Magic is wrong — see header).
insert into champions (game_id, name, faction, affinity, rarity, source_citation)
select 'raid_shadow_legends', 'Stonebound Thisbe', 'Argonites', 'Spirit', 'Epic',
       'in-game Index champion detail + Argonites collection screen (video, 2026-07-08)'
where not exists (
  select 1 from champions
  where game_id = 'raid_shadow_legends' and name = 'Stonebound Thisbe'
);

-- (2) Proposed tags from primary in-game text (idempotent per unique(champion_id, tag_id)).
insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by, proposed_at, ascension_required)
select ch.id, t.id, 'proposed', 'in_game_index', v.note, 'in-game-index-video', now(), 0
from (values
  ('Decrease Attack',
   'A1 Eyes Of Granite: single-target; 25% chance (unbooked) of a 50% [Decrease ATK] debuff 2t; books raise the chance (+10% L4, +15% L5). Verbatim in-game Index text, Level 1 unbooked, captured 2026-07-08.'),
  ('Decrease Turn Meter',
   'A1 Eyes Of Granite: steals 10% of the target''s Turn Meter (enemy TM reduction, guaranteed). Verbatim in-game Index text, Level 1 unbooked, captured 2026-07-08.'),
  ('AoE Damage',
   'A2 Fangs Of Quartz (cd 5t) attacks all enemies (the only AoE skill; A1 is single-target, A3 is a team support skill). Verbatim in-game Index text, Level 1 unbooked, captured 2026-07-08.'),
  ('Hex',
   'A2 Fangs Of Quartz (cd 5t): 75% chance (unbooked) of a [Hex] debuff on ALL enemies 2t. Verbatim in-game Index text, Level 1 unbooked, captured 2026-07-08.'),
  ('Block Buffs',
   'A2 Fangs Of Quartz (cd 5t): 75% chance (unbooked) of a [Block Buffs] debuff on ALL enemies 2t. Verbatim in-game Index text, Level 1 unbooked, captured 2026-07-08.'),
  ('Healer',
   'A3 Heart Of Flint (cd 5t): heals ALL allies by 15% of their MAX HP (books +5% Heal L2/L3). Verbatim in-game Index text, Level 1 unbooked, captured 2026-07-08.'),
  ('Increase Turn Meter',
   'A3 Heart Of Flint (cd 5t): fills the Turn Meters of ALL allies by 20% (ally-facing team TM). Verbatim in-game Index text, Level 1 unbooked, captured 2026-07-08.'),
  ('ACC Aura',
   'Leader aura: +40 [ACC] to all allies in all Battles. Only applies when Thisbe is the team leader. Shown in the recording. Verbatim in-game Index aura panel, captured 2026-07-08.')
) as v(tag, note)
join champions ch on ch.game_id = 'raid_shadow_legends' and ch.name = 'Stonebound Thisbe'
join tags t on t.name = v.tag
where not exists (
  select 1 from champion_tags x where x.champion_id = ch.id and x.tag_id = t.id
);
