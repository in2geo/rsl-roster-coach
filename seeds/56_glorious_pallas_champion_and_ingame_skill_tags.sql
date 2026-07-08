-- ============================================================================
-- Seed 56 — Glorious Pallas champion row + in-game skill tags
-- Source: in-game champion Index / skill-detail popups, captured verbatim from
-- a screen recording of Glorious Pallas (Lvl 60, 6★) on 2026-07-08.
-- source_type='in_game_index' (PRIMARY). status='proposed' — HUMAN REVIEW
-- REQUIRED; the match engine only reads status='approved' tags. No auto-merge.
--
-- (0) CHAMPION ROW — Glorious Pallas is referenced by seeds/11 (type_ids), seeds/28
--     (aliases) and seeds/29 (name truncations), but NO seed creates her champions
--     row, and she has no seeds/15 raid.guide tags. Created here (idempotent; mirrors
--     seeds/44 Venomage) so the DB is reconstructable. Identity from the in-game
--     detail screen: Argonites / Magic (blue affinity icon) / Legendary / Support.
--     (Cross-checks the roster worksheet's C000640 row — same values.)
--
-- (1) FULL KIT (in-game, Level 1 = UNBOOKED). Damage [ATK]-based; all four skills
--     were visible/unlocked at 6★ (NONE ascension-gated):
--       A1 Spear of Serenity: "Attacks 1 enemy with 1 random ally from the Argonites
--         Faction (the ally uses their default skill). Heals ALL allies by 10% of
--         this Champion's MAX HP." Books: +10% Dmg L2, +10% Heal L3, +10% Dmg L4,
--         +10% Heal L5.
--       A2 Gift of Thalass (cd 5t): "Removes ALL debuffs from ALL allies and places
--         a [Block Debuffs] buff and a [Fervor] buff on ALL allies 2t." Books:
--         Cooldown -1 L2, Cooldown -1 L3 (5 -> 3).
--       A3 Glorious Revival (cd 7t): "Revives ALL dead allies with 50% HP and 50%
--         Turn Meter. Places a 25% [Strengthen] buff and a 30% [Increase SPD] buff
--         on ALL allies 2t." Books: Cooldown -1 L2-L4 (7 -> 4).
--       Passive Shield of the Argolades [P]: "Whenever an ally receives a debuff,
--         places a [Shield] buff on that ally = 20% of their MAX HP 1t. Fills the
--         Turn Meters of ALL allies by 15% at the end of this Champion's turn."
--
--     Aura: +50 [RES] to all allies in all Battles (RES Aura). The original recording
--         used the collection / Total-Stats view (no aura panel); aura confirmed from
--         Mike's follow-up on 2026-07-08.
--
-- (2) TAGS ADDED (existing vocab; all SOLID and genuinely ALLY-FACING — she is a
--     dedicated Support). ascension_required = 0 for all:
--       * Healer          — A1 (heals ALL allies 10% of her MAX HP).
--       * Cleanse         — A2 (removes ALL debuffs from ALL allies).
--       * Block Debuffs   — A2 (Block Debuffs buff on ALL allies 2t).
--       * Revive          — A3 (revives ALL dead allies — a true ALLY revive, unlike
--         Xenomorph's self-revive, seed 45).
--       * Increase Speed  — A3 (30% [Increase SPD] on ALL allies 2t).
--       * Strengthen      — A3 (25% [Strengthen] on ALL allies 2t; vocab added seeds/53).
--       * Shield          — passive (ALLY shield = 20% MAX HP when an ally is debuffed;
--         the first genuinely ally-facing Shield — cf. the SELF-only shields on
--         Jurojin/Michelangelo).
--       * Increase Turn Meter — passive (fills ALL allies' TM by 15% at end of turn).
--       * RES Aura         — leader aura, +50 [RES] to all allies in all Battles
--         (vocab from seeds/20; confirmed 2026-07-08).
--
-- (3) NOT TAGGED — logged in KNOWN_GAPS.md ("Glorious Pallas pending-review tag
--     decisions"), no vocabulary exists:
--       * Ally Attack (A1) — 1 random Argonites ally joins the attack. No vocab tag.
--         This is now the SECOND occurrence (Michelangelo seed 46 was the first) —
--         worth promoting to a real tag, same as Debuff Spread was.
--       * Fervor (A2) — [Fervor] buff on all allies. No vocab tag.
-- ============================================================================

-- (0) Champion row (idempotent; mirrors seeds/44 Venomage pattern).
insert into champions (game_id, name, faction, affinity, rarity, source_citation)
select 'raid_shadow_legends', 'Glorious Pallas', 'Argonites', 'Magic', 'Legendary',
       'in-game Index champion detail screen (video, 2026-07-08)'
where not exists (
  select 1 from champions
  where game_id = 'raid_shadow_legends' and name = 'Glorious Pallas'
);

-- (2) Proposed tags from primary in-game text (idempotent per unique(champion_id, tag_id)).
insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by, proposed_at, ascension_required)
select ch.id, t.id, 'proposed', 'in_game_index', v.note, 'in-game-index-video', now(), 0
from (values
  ('Healer',
   'A1 Spear of Serenity: heals ALL allies by 10% of Glorious Pallas''s MAX HP on every use (books +10% Heal L3/L5). Verbatim in-game Index text, Level 1 unbooked, captured 2026-07-08.'),
  ('Cleanse',
   'A2 Gift of Thalass (cd 5t): removes ALL debuffs from ALL allies. Verbatim in-game Index text, Level 1 unbooked, captured 2026-07-08.'),
  ('Block Debuffs',
   'A2 Gift of Thalass (cd 5t): places a [Block Debuffs] buff on ALL allies 2t (alongside Fervor). Verbatim in-game Index text, Level 1 unbooked, captured 2026-07-08.'),
  ('Revive',
   'A3 Glorious Revival (cd 7t): revives ALL dead allies with 50% HP and 50% Turn Meter (a true ALLY revive). Verbatim in-game Index text, Level 1 unbooked, captured 2026-07-08.'),
  ('Increase Speed',
   'A3 Glorious Revival (cd 7t): places a 30% [Increase SPD] buff on ALL allies 2t. Verbatim in-game Index text, Level 1 unbooked, captured 2026-07-08.'),
  ('Strengthen',
   'A3 Glorious Revival (cd 7t): places a 25% [Strengthen] buff on ALL allies 2t. Verbatim in-game Index text, Level 1 unbooked, captured 2026-07-08.'),
  ('Shield',
   'Passive Shield of the Argolades [P]: whenever an ally receives a debuff, places a [Shield] buff on THAT ALLY = 20% of their MAX HP 1t. Genuinely ally-facing (not self-only). Verbatim in-game Index text, Level 1, captured 2026-07-08.'),
  ('Increase Turn Meter',
   'Passive Shield of the Argolades [P]: fills the Turn Meters of ALL allies by 15% at the end of Glorious Pallas''s turn (ally-facing team TM). Verbatim in-game Index text, Level 1, captured 2026-07-08.'),
  ('RES Aura',
   'Leader aura: +50 [RES] to all allies in all Battles. Only applies when Glorious Pallas is the team leader. Confirmed 2026-07-08 (original recording used the Total-Stats view which omits the aura panel). Magnitude/placement per the in-game Index.')
) as v(tag, note)
join champions ch on ch.game_id = 'raid_shadow_legends' and ch.name = 'Glorious Pallas'
join tags t on t.name = v.tag
where not exists (
  select 1 from champion_tags x where x.champion_id = ch.id and x.tag_id = t.id
);
