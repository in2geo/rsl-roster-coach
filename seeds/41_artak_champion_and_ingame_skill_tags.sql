-- ============================================================================
-- Seed 41 — Artak champion row + proposed tags from in-game Index skill text
-- Source: in-game champion Index / skill-detail popups, captured verbatim from
-- a screen recording of Artak (Lvl 60, 6★) on 2026-07-06. Identity fields
-- (faction, affinity, rarity) read directly from the champion detail screen.
-- source_type='in_game_index' — a PRIMARY source. status='proposed' — HUMAN
-- REVIEW REQUIRED; the match engine only reads status='approved' tags. No
-- auto-merge.
--
-- (0) CHAMPION ROW — Artak had NO champions row in any committed seed, yet
--     seeds/06_solo_carry_proposals.sql references him via
--     `select id from champions where name = 'Artak'` (7 solo profiles). Those
--     inserts silently no-op on a from-scratch rebuild without this row. This
--     file creates it so the DB is reconstructable from committed seeds alone.
--
--     AFFINITY = Magic (blue affinity icon on the in-game detail screen; RAID
--     colour map: Magic=blue, Force=green, Spirit=yellow, Void=purple). NOTE:
--     seeds/06 previously labelled Artak "Spirit" and built his Dragon/Spider
--     affinity-matchup reasoning on that — corrected to Magic in the same
--     commit as this file. Faction = Orcs, Rarity = Legendary (both read off
--     the detail screen).
--
-- (1) TAGS — Artak's skills were shown at Level 1/5 (UNBOOKED), so the chances
--     below are read directly as unbooked values (no back-computation needed);
--     the booked value is unbooked + the skill's Buff/Debuff Chance book steps.
--
--     Verbatim skill text observed (Level 1 unbooked):
--       A1 Chaosrazor: "Attacks all enemies. Has a 35% chance to extend the
--           duration of any [HP Burn] debuffs on each target by 1 turn."
--           Dmg: [HP]. Book: +5%(L3)+5%(L5) => 45% extend chance booked.
--           -> AoE Damage. (The HP Burn interaction EXTENDS existing burns; it
--           does NOT place HP Burn, so no HP Burn tag from A1.)
--       A2 Dogs of War (cd 4t): "Attacks all enemies. Before attacking,
--           instantly activates one tick of all [HP Burn] debuffs on all
--           enemies. Has a 75% chance of placing a 50% [Decrease ATK] debuff on
--           all enemies for 2 turns." Dmg: [HP]. Book: +10%(L3)+15%(L4) => 100%
--           booked; L5 Cooldown -1 => 3t booked.
--           -> AoE Damage, Decrease Attack. (The HP Burn detonation is a synergy
--           mechanic, not a placed debuff — no HP Burn tag from A2.)
--       A3 Purifyre (cd 4t): "Attacks all enemies 2 times. The first hit has a
--           75% chance of placing a [HP Burn] debuff on all enemies for 2
--           turns. Restores this Champion's destroyed MAX HP... Heals this
--           Champion..." Dmg: [HP]. Book: +10%(L3)+15%(L4) => 100% booked; L5
--           Cooldown -1 => 3t booked.
--           -> AoE Damage, HP Burn. (Self-heal/self-restore only — heals THIS
--           champion, not allies, so NO Healer tag.)
--       Passive Burning Blood: self MAX HP destruction on HP Burn activation,
--           converted to self DMG/C.DMG/DEF/SPD/RES. Self-scaling only — no
--           ally-facing buff placement, so NO buff tags.
--
--     Distinct tags: AoE Damage (all 3 actives), Decrease Attack (A2), HP Burn
--     (A3). ascension_required = 0 for all — none of Artak's skills are gated
--     behind ascension (no padlock shown on the skill icons).
-- ============================================================================

-- (0) Champion row (idempotent; mirrors the insert...select...where not exists
--     pattern used in seeds/30_repair_elder_unmerge.sql).
insert into champions (game_id, name, faction, affinity, rarity, source_citation)
select 'raid_shadow_legends', 'Artak', 'Orcs', 'Magic', 'Legendary',
       'in-game Index champion detail screen (video, 2026-07-06)'
where not exists (
  select 1 from champions
  where game_id = 'raid_shadow_legends' and name = 'Artak'
);

-- (1) Proposed skill/debuff tags (idempotent per unique(champion_id, tag_id)).
insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by, proposed_at, ascension_required)
select ch.id, t.id, 'proposed', 'in_game_index', v.note, 'in-game-index-video', now(), 0
from (values
  ('AoE Damage',
   'All three active skills hit all enemies: A1 Chaosrazor, A2 Dogs of War, A3 Purifyre (2 hits). Verbatim in-game Index text, Level 1 unbooked, captured 2026-07-06.'),
  ('Decrease Attack',
   'A2 Dogs of War (cd 4t booked 3t): 75% unbooked chance of 50% [Decrease ATK] on all enemies for 2t. Booked 100% (+10% L3, +15% L4). AoE. Verbatim in-game Index text, Level 1 unbooked, captured 2026-07-06.'),
  ('HP Burn',
   'A3 Purifyre (cd 4t booked 3t): first hit 75% unbooked chance of [HP Burn] on all enemies for 2t. Booked 100% (+10% L3, +15% L4). AoE. (A1 extends and A2 detonates HP Burns but neither PLACES one — only A3 does.) Verbatim in-game Index text, Level 1 unbooked, captured 2026-07-06.')
) as v(tag, note)
join champions ch on ch.game_id = 'raid_shadow_legends' and ch.name = 'Artak'
join tags t on t.name = v.tag
where not exists (
  select 1 from champion_tags x where x.champion_id = ch.id and x.tag_id = t.id
);
