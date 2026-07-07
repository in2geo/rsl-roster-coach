-- ============================================================================
-- Seed 44 — Venomage champion row + proposed tags from in-game skill text
-- Source: in-game champion Index / skill-detail popups, captured verbatim from
-- screen recording + screenshots of Venomage (Lvl 49, 6★) on 2026-07-07.
-- source_type='in_game_index' (PRIMARY). status='proposed' — HUMAN REVIEW
-- REQUIRED; the match engine only reads status='approved' tags. No auto-merge.
--
-- (0) CHAMPION ROW — Venomage had NO champions row in any committed seed, yet
--     she is referenced by seeds/06 (2 solo profiles) AND already has raid.guide
--     tags in seeds/15. Both silently no-op on a from-scratch rebuild without
--     this row. Created here (idempotent) so the DB is reconstructable.
--     Identity read off the in-game detail screen: Lizardmen / Magic (blue
--     affinity icon) / Epic / Support. Affinity 'Magic' already matches how
--     seeds/06 reasons about her (correctly: "Magic weak at Force stage").
--
-- (1) FULL KIT (in-game, Level 1 = UNBOOKED) — for provenance:
--       A1 Toxicity (green-claw icon): "Attacks 1 enemy 2 times. Destroys the
--         target's MAX HP by 75% of the damage inflicted IF they are under a
--         [Heal Reduction] debuff. Each hit has a 35% chance of ACTIVATING up to
--         two [Poison] debuffs on the target." Dmg [ATK]. Single-target.
--       A2 Neurotoxin (purple-shield icon, cd 4t): "Attacks 1 enemy. 75% chance
--         of 60% [Decrease DEF] 2t. Also 75% chance of 50% [Decrease ATK] 2t IF
--         the target is under a [Poison] debuff." Dmg [ATK]. Single-target.
--       A3 Fleshmelter Venom (green-chains icon, cd 4t): "Attacks all enemies.
--         75% chance of 100% [Heal Reduction] 3t. Also 75% chance of two 5%
--         [Poison] 2t." Dmg [ATK]. AoE. Booked 100% (+10% L3, +15% L4); cd 3t.
--       Passive Pain Writhe (locked, Unlocks at Ascension Level 3): "Enemies
--         under [Heal Reduction] debuffs inflict 15% less damage." Team defence.
--
-- (2) TAGS — only ONE genuinely-new tag is added (AoE Damage). Venomage already
--     has Heal Reduction, Poison, Decrease Defense, Decrease Attack from seeds/15
--     (unique(champion_id, tag_id) means the tags exist; see the reviewer flags).
--       * AoE Damage — from A3 Fleshmelter Venom (the only AoE skill; A1/A2 are
--         single-target). NEW. Added below.
--
--     NOT TAGGED (no vocabulary; surfaced, not dropped):
--       * Toxicity's MAX-HP-destroy (conditional on enemy Heal Reduction) and its
--         Poison ACTIVATION/detonation — neither is a placed debuff; no tag fits.
--       * Pain Writhe's 15% enemy-damage-reduction passive — no tag; ascension 3.
--
-- >>> REVIEWER FLAGS (seeds/15 raid.guide rows — NOT auto-edited here) <<<
--   (a) seeds/15 tags Venomage's [Heal Reduction] and [Poison] to "A1 Toxicity".
--       The in-game text shows Toxicity does NOT PLACE either: it BENEFITS from
--       Heal Reduction (the HP-destroy condition) and ACTIVATES existing Poisons.
--       The real PLACER of both is A3 Fleshmelter Venom (Heal Reduction 75%/3t
--       unbooked -> 100% booked; Poison two 5% 75%/2t unbooked -> 100% booked,
--       AoE). The champion-level Heal Reduction / Poison tags are CORRECT for
--       Venomage (she does place them) — only the seeds/15 source_note names the
--       wrong skill. Reviewer: repoint those notes to Fleshmelter Venom (A3).
--   (b) seeds/15 records Neurotoxin [Decrease DEF]/[Decrease ATK] as "50%
--       unbooked (75% booked)". The in-game Level-1 (unbooked) popup shows 75%
--       for BOTH — so unbooked is 75%, booked 100% (+10% L3, +15% L4), not
--       50/75. Reviewer: correct the chances. Also note Decrease ATK is
--       CONDITIONAL (only if the target is already under a [Poison] debuff).
-- ============================================================================

-- (0) Champion row (idempotent; mirrors seeds/41 Artak pattern).
insert into champions (game_id, name, faction, affinity, rarity, source_citation)
select 'raid_shadow_legends', 'Venomage', 'Lizardmen', 'Magic', 'Epic',
       'in-game Index champion detail screen (video + screenshots, 2026-07-07)'
where not exists (
  select 1 from champions
  where game_id = 'raid_shadow_legends' and name = 'Venomage'
);

-- (1) New proposed tag: AoE Damage from A3 Fleshmelter Venom.
insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by, proposed_at, ascension_required)
select ch.id, t.id, 'proposed', 'in_game_index',
       'A3 Fleshmelter Venom hits all enemies (only AoE skill; A1 Toxicity and A2 Neurotoxin are single-target). Same skill places 100% [Heal Reduction] 3t and two 5% [Poison] 2t at 75% unbooked -> 100% booked. Verbatim in-game Index text, Level 1 unbooked, captured 2026-07-07.',
       'in-game-index-video', now(), 0
from champions ch
join tags t on t.name = 'AoE Damage'
where ch.game_id = 'raid_shadow_legends' and ch.name = 'Venomage'
  and not exists (
    select 1 from champion_tags x where x.champion_id = ch.id and x.tag_id = t.id
  );
