-- ============================================================================
-- Seed 54 — Ruella champion row + in-game skill tags
-- Source: in-game champion Index / skill-detail popups, captured verbatim from
-- a screen recording of Ruella (Lvl 30, 4★) on 2026-07-07.
-- source_type='in_game_index' (PRIMARY). status='proposed' — HUMAN REVIEW
-- REQUIRED; the match engine only reads status='approved' tags. No auto-merge.
--
-- (0) CHAMPION ROW — Ruella is absent from every committed seed (not even in the
--     seeds/15 raid.guide batch), so there are no prior tags/mis-tags to reconcile.
--     Created here (idempotent; mirrors seeds/44 Venomage). Identity from the in-
--     game detail screen: Sylvan Watchers / Spirit (green affinity icon) / Epic /
--     Attack. (Cross-checks the roster worksheet's C000468 row — same values.)
--
-- (1) FULL KIT (in-game, Level 1 = UNBOOKED). Damage is [ATK]-based:
--       A1 Harassment Volley: "Attacks 1 enemy 3 times. Each critical hit has an
--         80% chance of stealing 5% of the target's Turn Meter." Single-target.
--         Books: +5% Dmg L2, +5% Chance L3, +5% Dmg L4, +5% Chance L5, +10% Chance L6.
--       A2 No Respite (cd 4t): "Attacks 1 enemy 3 times. Each hit has a 50% chance
--         of placing a 60% [Decrease DEF] debuff, a 25% [Weaken] debuff and a 30%
--         [Decrease SPD] debuff for 2 turns." Single-target (per-hit debuff rolls).
--         Books: +5% Dmg L2, +5% Chance L3, +5% Dmg L4, +5% Chance L5, +10% Chance L6.
--       A3 Timed Offensive — UNLOCKS AT ASCENSION LEVEL 3 (cd 6t): "Fills the Turn
--         Meters of ALL ALLIES by 20% and places a 30% [Increase C.RATE] buff on
--         ALL ALLIES for 2 turns." Books: Cooldown -1 L2-L4 (6 -> 3).
--     Aura: +40 [ACC] to all allies in Dungeons (placement = Dungeons, not all battles).
--
-- (2) TAGS ADDED (existing vocab; all SOLID and team-relevant). ascension_required
--     varies (Timed Offensive = 3; A1/A2/aura = 0):
--       * Decrease Turn Meter — A1 Harassment Volley (steals 5% TM per critical hit,
--         80% chance). Enemy TM reduction. asc 0.
--       * Decrease Defense    — A2 No Respite (60%, 50% chance/hit, 2t). asc 0.
--       * Weaken              — A2 No Respite (25%, 50% chance/hit, 2t). asc 0.
--       * Decrease Speed      — A2 No Respite (30%, 50% chance/hit, 2t). asc 0.
--       * Increase Turn Meter — A3 Timed Offensive (fills ALL ALLIES' TM by 20% —
--         genuinely ally-facing, unlike Kosk/Dark Elhain's self-TM). asc 3.
--       * Increase C.Rate     — A3 Timed Offensive (30% to ALL ALLIES 2t). asc 3.
--       * ACC Aura            — leader aura, +40 ACC in DUNGEONS (placement noted;
--         vocab added in seeds/47). asc 0.
--
-- (3) NOT TAGGED — nothing pending. A1's TM steal is captured by Decrease Turn Meter
--     (conditional: on a critical hit, 80%); noted in its source_note. No self-only
--     or no-vocab effects on this kit.
-- ============================================================================

-- (0) Champion row (idempotent; mirrors seeds/44 Venomage pattern).
insert into champions (game_id, name, faction, affinity, rarity, source_citation)
select 'raid_shadow_legends', 'Ruella', 'Sylvan Watchers', 'Spirit', 'Epic',
       'in-game Index champion detail screen (video, 2026-07-07)'
where not exists (
  select 1 from champions
  where game_id = 'raid_shadow_legends' and name = 'Ruella'
);

-- (2) Proposed tags from primary in-game text (idempotent per unique(champion_id, tag_id)).
--     ascension_required is per-tag (Timed Offensive = 3; others = 0).
insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by, proposed_at, ascension_required)
select ch.id, t.id, 'proposed', 'in_game_index', v.note, 'in-game-index-video', now(), v.asc
from (values
  ('Decrease Turn Meter',
   'A1 Harassment Volley: attacks 1 enemy 3 times; each CRITICAL hit has an 80% chance of stealing 5% of the target''s Turn Meter (enemy TM reduction, conditional on a crit). Verbatim in-game Index text, Level 1 unbooked, captured 2026-07-07.', 0),
  ('Decrease Defense',
   'A2 No Respite (cd 4t): single-target 3-hit; each hit 50% chance (unbooked) of a 60% [Decrease DEF] debuff 2t. Books raise the chance (+5% L3, +5% L5, +10% L6). Verbatim in-game Index text, Level 1 unbooked, captured 2026-07-07.', 0),
  ('Weaken',
   'A2 No Respite (cd 4t): each hit 50% chance (unbooked) of a 25% [Weaken] debuff 2t. Verbatim in-game Index text, Level 1 unbooked, captured 2026-07-07.', 0),
  ('Decrease Speed',
   'A2 No Respite (cd 4t): each hit 50% chance (unbooked) of a 30% [Decrease SPD] debuff 2t. Verbatim in-game Index text, Level 1 unbooked, captured 2026-07-07.', 0),
  ('Increase Turn Meter',
   'A3 Timed Offensive — UNLOCKS AT ASCENSION 3 (cd 6t): fills the Turn Meters of ALL ALLIES by 20% (genuinely ally-facing team TM boost). Verbatim in-game Index text, Level 1, captured 2026-07-07.', 3),
  ('Increase C.Rate',
   'A3 Timed Offensive — UNLOCKS AT ASCENSION 3 (cd 6t): places a 30% [Increase C.RATE] buff on ALL ALLIES 2t. Verbatim in-game Index text, Level 1, captured 2026-07-07.', 3),
  ('ACC Aura',
   'Leader aura: +40 [ACC] to all allies in DUNGEONS (placement = Dungeons, not all battles). Only applies when Ruella is the team leader. Verbatim in-game Index aura panel, captured 2026-07-07.', 0)
) as v(tag, note, asc)
join champions ch on ch.game_id = 'raid_shadow_legends' and ch.name = 'Ruella'
join tags t on t.name = v.tag
where not exists (
  select 1 from champion_tags x where x.champion_id = ch.id and x.tag_id = t.id
);
