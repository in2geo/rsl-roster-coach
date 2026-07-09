-- ============================================================================
-- Seed 50 — Jurojin champion row + in-game skill tags; correct seed-15 mis-tags
-- Source: in-game champion Index / skill-detail popups, captured verbatim from
-- a screen recording of Jurojin (Lvl 21, 4★) on 2026-07-07.
-- source_type='in_game_index' (PRIMARY). status='proposed' — HUMAN REVIEW
-- REQUIRED; the match engine only reads status='approved' tags. No auto-merge.
--
-- (0) CHAMPION ROW — Jurojin has NO champions row in any committed seed, yet he is
--     referenced by seeds/15 (raid.guide tags). Those inserts silently no-op on a
--     from-scratch rebuild without this row (seed 15 runs before this one). Created
--     here (idempotent; mirrors the seeds/44 Venomage pattern) so the DB is
--     reconstructable. Identity from the in-game detail screen: Shadowkin / Spirit
--     (green affinity icon; RAID map Magic=blue/Force=red/Spirit=green/Void=purple)
--     / Epic / HP. (Cross-checks the roster worksheet's C000392 row — same values.)
--
-- (1) FULL KIT (in-game, Level 1 = UNBOOKED) — for provenance. Damage is [HP]-based
--     on every skill:
--       A1 Monk's Spade: "Attacks 1 enemy. Has a 45% chance of placing a 50%
--         [Decrease ATK] debuff for 2 turns." Single-target. Books: +5% Dmg L2,
--         +5% Chance L3, +10% Dmg L4, +10% Chance L5 (so chance 45% -> 60% booked).
--       A2 Fated Duel (cd 4t): "Places a [Shield] buff on THIS Champion 2t equal to
--         25% of their MAX HP, then attacks 1 enemy. Places a [Provoke] debuff 1t.
--         If the target's MAX HP <= this Champion's, the [Provoke] cannot be
--         resisted." Books through L8; Cooldown -1 at L8 (4 -> 3).
--       A3 True Smite (cd 4t): "Attacks 1 enemy. Will ignore 25% of the target's
--         DEF. Will also ignore [Unkillable] and [Block Damage] buffs." Books: +5%
--         Dmg L2, +5% Dmg L3, +10% Dmg L4, Cooldown -1 L5 (4 -> 3).
--       Passive Smiles at Death [P] — UNLOCKS AT ASCENSION LEVEL 3: "Will receive
--         25% less damage from enemy attacks when this Champion's HP drops to 50%
--         or below." (Self damage mitigation.)
--     Aura: +25% [HP] to all allies in all Battles.
--
-- (2) TAGS ADDED (existing vocab; the SOLID ones):
--       * Decrease Attack — A1 Monk's Spade (45% unbooked -> 60% booked, 50%, 2t).
--       * Provoke         — A2 Fated Duel ([Provoke] debuff on the enemy 1t;
--         conditionally unresistable if target MAX HP <= Jurojin's).
--       * Shield          — A2 Fated Duel. SELF only (25% of his MAX HP, 2t);
--         tagged with a self-only note (cf. Michelangelo seed 46 self-Shield).
--       * HP Aura         — leader aura, +25% HP all Battles (NEW for Jurojin;
--         seeds/15 did not tag his aura).
--     (Decrease Attack / Provoke / Shield also exist as seed-15 raid.guide rows, but
--     those no-op in a clean rebuild — no Jurojin row exists when seed 15 runs — so
--     they are (re)asserted here from the PRIMARY in-game source. The not-exists
--     guard prevents duplicates if a row somehow pre-exists.)
--
-- (3) SEED-15 MIS-TAG CORRECTION — Jurojin [Unkillable] and [Block Damage]:
--       seeds/15 auto-tagged both from A3's text "will also ignore [Unkillable] and
--       [Block Damage] buffs". That is a BYPASS of enemy buffs — Jurojin does NOT
--       grant Unkillable/Block Damage. Tagging them would falsely surface him as an
--       Unkillable/Block-Damage granter (a major sustain mechanic) and could fool
--       the team sustain check. The two seed-15 insert blocks are DELETED at source;
--       (3) below also defensively rejects the rows on any live DB where they landed.
--
-- (4) NOT TAGGED — logged for review in KNOWN_GAPS.md ("Jurojin pending-review tag
--     decisions"), no vocabulary exists:
--       * Ignore DEF 25% (A3) — no vocab (same call as Kosk seed 47).
--       * Ignore [Unkillable]/[Block Damage] on enemies (A3) — a notable anti-tank /
--         anti-revive tech; no vocab for "ignores enemy buff X".
--       * Smiles at Death damage-mitigation passive (25% less dmg at HP<=50%,
--         Ascension 3) — self mitigation; no vocab.
--     ascension_required = 0 for the tagged skills (A1/A2/A3 available at 4★). The
--     passive is Ascension-3-gated but is untagged (no vocab), so no row carries it.
--
--     >>> DISCREPANCY (in-game vs seed-15 raid.guide) for the reviewer: the in-game
--     A1 Monk's Spade Level-1 popup shows a 45% Decrease-ATK chance (-> 60% booked
--     via +5% L3 / +10% L5). seeds/15 recorded "30% unbooked (45% booked)". The
--     in-game Index is primary; the Decrease Attack note below uses 45% -> 60%.
-- ============================================================================

-- (0) Champion row (idempotent; mirrors seeds/44 Venomage pattern).
insert into champions (game_id, name, faction, affinity, rarity, source_citation)
select 'raid_shadow_legends', 'Jurojin', 'Shadowkin', 'Spirit', 'Epic',
       'in-game Index champion detail screen (video, 2026-07-07)'
where not exists (
  select 1 from champions
  where game_id = 'raid_shadow_legends' and name = 'Jurojin'
);

-- (2) Proposed tags from primary in-game text (idempotent per unique(champion_id, tag_id)).
insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by, proposed_at, ascension_required)
select ch.id, t.id, 'proposed', 'in_game_index', v.note, 'in-game-index-video', now(), 0
from (values
  ('Decrease Attack',
   'A1 Monk''s Spade: single-target, 45% chance (unbooked, Level 1) of a 50% [Decrease ATK] debuff 2t; books raise the chance to 60% (+5% L3, +10% L5). NOTE: in-game shows 45% unbooked, not seeds/15 raid.guide''s 30%. Verbatim in-game Index text, Level 1 unbooked, captured 2026-07-07.'),
  ('Provoke',
   'A2 Fated Duel (cd 4t): places a [Provoke] debuff on the enemy 1t. Conditionally unresistable — "if the target''s MAX HP is equal to or lower than this Champion''s, the [Provoke] cannot be resisted". Verbatim in-game Index text, Level 1 unbooked, captured 2026-07-07.'),
  ('Shield',
   'A2 Fated Duel (cd 4t): SELF only — places a [Shield] buff on HIMSELF 2t equal to 25% of his MAX HP before attacking. Not an ally shield; relevant for solo/survival, not team support (cf. Michelangelo self-Shield, seed 46). Verbatim in-game Index text, Level 1, captured 2026-07-07.'),
  ('HP Aura',
   'Leader aura: +25% [HP] to all allies in all Battles. Only applies when Jurojin is the team leader. NEW — seeds/15 did not tag his aura. Verbatim in-game Index aura panel, captured 2026-07-07.')
) as v(tag, note)
join champions ch on ch.game_id = 'raid_shadow_legends' and ch.name = 'Jurojin'
join tags t on t.name = v.tag
where not exists (
  select 1 from champion_tags x where x.champion_id = ch.id and x.tag_id = t.id
);

-- (3) Defensive correction: reject any Jurojin [Unkillable]/[Block Damage] links
--     that a live DB may already hold from seeds/15 (deleted at source there). A3
--     True Smite IGNORES these enemy buffs; Jurojin does not place them.
update champion_tags
   set status = 'rejected',
       approved_by = 'in-game-index-correction-2026-07-08',
       approved_at = now(),
       source_note = 'REJECTED 2026-07-08: seed-15 raid.guide mis-tag. A3 True Smite IGNORES enemy [Unkillable]/[Block Damage] buffs; Jurojin does NOT place them (in-game Index, video 2026-07-07). Original: ' || coalesce(source_note, '')
 where champion_id = (select id from champions where name = 'Jurojin' and game_id = 'raid_shadow_legends')
   and tag_id in (select id from tags where name in ('Unkillable', 'Block Damage'))
   and status = 'proposed';
