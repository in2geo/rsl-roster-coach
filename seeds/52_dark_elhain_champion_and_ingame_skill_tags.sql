-- ============================================================================
-- Seed 52 — Dark Elhain champion row + in-game skill tags; correct seed-15 Freeze
-- Source: in-game champion Index / skill-detail popups, captured verbatim from
-- a screen recording of Dark Elhain (Lvl 33, 4★) on 2026-07-07.
-- source_type='in_game_index' (PRIMARY). status='proposed' — HUMAN REVIEW
-- REQUIRED; the match engine only reads status='approved' tags. No auto-merge.
--
-- (0) CHAMPION ROW — Dark Elhain has NO champions row in any committed seed, yet
--     she is referenced by seeds/15 (raid.guide tags), which no-op on a from-
--     scratch rebuild without this row. Created here (idempotent; mirrors seeds/44
--     Venomage). Identity from the in-game detail screen: Undead Hordes / Magic
--     (blue affinity icon) / Epic / Attack. NOTE: base "Elhain" (High Elves/Magic,
--     seeds/03) is a DIFFERENT champion — this is Dark Elhain (Undead Hordes).
--     (Cross-checks the roster worksheet's C000316 row — same values.) NO AURA
--     (the in-game detail screen shows no aura panel for her).
--
-- (1) FULL KIT (in-game, Level 1 = UNBOOKED) — for provenance. Damage is [ATK]-based:
--       A1 Necrotic Bolt: "Attacks 1 enemy. Destroys the target's MAX HP by 30% of
--         the damage inflicted." Single-target. Books: +5% Dmg L2-L5.
--       A2 Death's Majesty (cd 4t): "Places a 50% [Increase ATK] buff on THIS
--         Champion 2t, then attacks all enemies. Has a 50% chance of placing a 30%
--         [Decrease SPD] debuff 2t." AoE. Books: +5% Dmg L2, +10% Dmg L3, +10%
--         Chance L4, +15% Chance L5, Cooldown -1 L6 (4 -> 3). Chance 50% unbooked
--         -> 75% booked.
--       A3 Lethal Winter [P] (cd 1t): "Fills THIS Champion's Turn Meter by 25% and
--         instantly activates the Death's Majesty skill whenever this Champion or
--         an ally receives a [Freeze] debuff." Freeze-reactive; self TM + re-cast.
--       Passive Veins of Ice [P] — UNLOCKS AT ASCENSION LEVEL 3 (cd 1t): "Instantly
--         removes any [Freeze] debuffs on THIS Champion and replaces them with a 30%
--         [Increase C.RATE] buff, a 30% [Increase C.DMG] buff, and a 15%
--         [Strengthen] buff whenever an enemy places a [Freeze] debuff on this
--         Champion." All buffs SELF.
--
-- (2) TAGS ADDED (existing vocab; the SOLID ones). ascension_required varies:
--       * Decrease Speed  — A2 Death's Majesty (50% -> 75% booked, 30%, 2t, AoE). asc 0.
--       * AoE Damage      — A2 Death's Majesty (attacks all enemies). NEW — seeds/15
--         did not tag it. asc 0.
--       * Increase Attack — A2. SELF only (50%, 2t, on himself before the AoE);
--         tagged with a self-only note (cf. Michelangelo self-buffs, seed 46). asc 0.
--       * Increase C.Rate — Veins of Ice (30%, SELF, only when an enemy Freezes her).
--         ASCENSION 3 + self. asc 3.
--       * Increase C.DMG  — Veins of Ice (30%, SELF, same trigger). ASCENSION 3 + self. asc 3.
--     (These also exist as seed-15 raid.guide rows, but those no-op in a clean
--     rebuild — no Dark Elhain row when seed 15 runs — so they are (re)asserted here
--     from PRIMARY in-game text with correct ascension_required and self-only notes.
--     seeds/15 recorded ascension_required=0 for the Veins-of-Ice C.Rate/C.DMG rows
--     and "25% unbooked" Decrease SPD; in-game shows Ascension-3-gated and 50%.)
--
-- (3) SEED-15 MIS-TAG CORRECTION — Dark Elhain [Freeze]:
--       seeds/15 auto-tagged [Freeze] from Lethal Winter's text "whenever this
--       Champion or an ally RECEIVES a [Freeze] debuff". She REACTS to being frozen
--       (TM fill + Veins-of-Ice buff conversion) — she does NOT place [Freeze] on
--       enemies. Tagging it would falsely surface her as a Freeze/crowd-control
--       champion. The seed-15 insert block is DELETED at source; (3) below also
--       defensively rejects the row on any live DB where it landed.
--
-- (4) NOT TAGGED — logged for review in KNOWN_GAPS.md ("Dark Elhain pending-review
--     tag decisions"), no vocabulary exists / self-scoped:
--       * Strengthen (Veins of Ice, 15% self, Ascension 3) — no 'Strengthen' vocab
--         tag exists. Decision: create it (common RSL buff) or skip (self-only here)?
--       * Increase Turn Meter (Lethal Winter) — the tag means "fills an ALLY's Turn
--         Meter"; hers is SELF (25%, on Freeze). Do not tag (cf. Kosk seed 47).
--       * MAX-HP destroy (A1 Necrotic Bolt, 30% of damage) — not a placed debuff;
--         no vocab (cf. Venomage seed 44).
--       * Death's-Majesty auto-activation on Freeze (Lethal Winter) — a re-cast
--         mechanic; no vocab.
--     ascension_required = 3 for the Veins-of-Ice tags (Increase C.Rate/C.DMG); 0
--     for the A1/A2 skills (available at 4★).
-- ============================================================================

-- (0) Champion row (idempotent; mirrors seeds/44 Venomage pattern).
insert into champions (game_id, name, faction, affinity, rarity, source_citation)
select 'raid_shadow_legends', 'Dark Elhain', 'Undead Hordes', 'Magic', 'Epic',
       'in-game Index champion detail screen (video, 2026-07-07)'
where not exists (
  select 1 from champions
  where game_id = 'raid_shadow_legends' and name = 'Dark Elhain'
);

-- (2) Proposed tags from primary in-game text (idempotent per unique(champion_id, tag_id)).
--     ascension_required is per-tag (Veins of Ice = 3; A1/A2 = 0).
insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by, proposed_at, ascension_required)
select ch.id, t.id, 'proposed', 'in_game_index', v.note, 'in-game-index-video', now(), v.asc
from (values
  ('Decrease Speed',
   'A2 Death''s Majesty (cd 4t): AoE, 50% chance (unbooked, Level 1) of a 30% [Decrease SPD] debuff 2t on all enemies; books raise the chance to 75% (+10% L4, +15% L5). NOTE: in-game shows 50% unbooked, not seeds/15 raid.guide''s 25%. Verbatim in-game Index text, Level 1 unbooked, captured 2026-07-07.', 0),
  ('AoE Damage',
   'A2 Death''s Majesty attacks all enemies (the only AoE skill; A1 Necrotic Bolt is single-target). NEW — seeds/15 did not tag this. Verbatim in-game Index text, Level 1 unbooked, captured 2026-07-07.', 0),
  ('Increase Attack',
   'A2 Death''s Majesty: SELF only — places a 50% [Increase ATK] buff on HERSELF 2t before the AoE attack (not on allies). Relevant for solo/self-damage, not team support (cf. Michelangelo self-buffs, seed 46). Verbatim in-game Index text, Level 1, captured 2026-07-07.', 0),
  ('Increase C.Rate',
   'Passive Veins of Ice [P] — UNLOCKS AT ASCENSION 3: SELF only — grants a 30% [Increase C.RATE] buff on HERSELF whenever an enemy places a [Freeze] on her (replaces the removed Freeze). Conditional + self + ascension-gated. Verbatim in-game Index text, Level 1, captured 2026-07-07.', 3),
  ('Increase C.DMG',
   'Passive Veins of Ice [P] — UNLOCKS AT ASCENSION 3: SELF only — grants a 30% [Increase C.DMG] buff on HERSELF whenever an enemy places a [Freeze] on her. Conditional + self + ascension-gated. Verbatim in-game Index text, Level 1, captured 2026-07-07.', 3)
) as v(tag, note, asc)
join champions ch on ch.game_id = 'raid_shadow_legends' and ch.name = 'Dark Elhain'
join tags t on t.name = v.tag
where not exists (
  select 1 from champion_tags x where x.champion_id = ch.id and x.tag_id = t.id
);

-- (3) Defensive correction: reject any Dark Elhain [Freeze] link a live DB may hold
--     from seeds/15 (deleted at source there). She reacts to Freeze; she does not place it.
update champion_tags
   set status = 'rejected',
       approved_by = 'in-game-index-correction-2026-07-08',
       approved_at = now(),
       source_note = 'REJECTED 2026-07-08: seed-15 raid.guide mis-tag. Lethal Winter/Veins of Ice REACT to Dark Elhain RECEIVING [Freeze]; she does NOT place [Freeze] on enemies (in-game Index, video 2026-07-07). Original: ' || coalesce(source_note, '')
 where champion_id = (select id from champions where name = 'Dark Elhain' and game_id = 'raid_shadow_legends')
   and tag_id = (select id from tags where name = 'Freeze')
   and status = 'proposed';
