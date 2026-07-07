-- ============================================================================
-- Seed 51 — Rathalos Blademaster champion row + proposed tags (incl. aura) from
-- in-game skill text. Source: in-game champion Index / skill-detail popups,
-- captured verbatim from a screen recording of Rathalos Blademaster (Lvl 29,
-- 5★, Legendary) on 2026-07-07. source_type='in_game_index' (PRIMARY).
-- status='proposed' — HUMAN REVIEW REQUIRED; the match engine only reads
-- status='approved' tags. No auto-merge.
--
-- (0) CHAMPION ROW — Rathalos Blademaster had NO champions row and NO tags in
--     any committed seed (not in the seeds/15 raid.guide scrape). NEW champion
--     (Monster Hunter collab). Identity off the in-game detail screen: Banner
--     Lords / Force (RED affinity header icon — see reviewer flag (a)) /
--     Legendary / Attack.
--
-- (1) FULL KIT (in-game, Level 1 = UNBOOKED) — for provenance:
--       A1 Spirit Thrust (no cd): "Attacks 1 enemy. 50% chance of 60% [Decrease
--         DEF] 2t. If the target is a Boss, this debuff cannot be resisted."
--         Dmg [ATK]. Single-target. (Boss-only unresistable — see flag (b).)
--       A2 Spirit Step Slash (cd 4t; booked 3t via L5 Cooldown -1): "Attacks 1
--         enemy. Every SECOND use of this skill in a Round will attack all
--         enemies instead. Will also ignore 25% of the target's DEF. If the
--         target is a Boss, will ignore 100% DEF." Dmg [ATK]. Conditional AoE
--         (every 2nd use) — the CLEAN AoE is A3, so AoE Damage is cited to A3.
--       A3 Overhead Slash (cd 4t; booked 3t via L5 Cooldown -1): "Attacks ALL
--         enemies. Before attacking, places a 30% [Increase C. DMG] buff and a
--         30% [Increase SPD] buff on THIS Champion for 2 turns." Dmg [ATK].
--         AoE damage + two SELF buffs.
--       Passive Rathalos Mastery [P] (locked, Unlocks at Ascension Level 3):
--         "Inflicts 50% more damage against targets under [HP Burn] debuffs.
--         Receives 25% less damage from enemies under [HP Burn] debuffs. Every
--         fifth skill used by this Champion deals 200% more damage." Damage
--         modifiers only — no placed effect, and he does NOT place [HP Burn]
--         himself, so no HP Burn tag (see NOT TAGGED).
--       Aura: "Increases Ally ATK in Dungeons by 30%." -> Attack Aura, 30%,
--         placement = DUNGEONS. Directly relevant to this app (flag (c)).
--
-- (2) TAGS PROPOSED (5): Decrease Defense, AoE Damage, Increase C.DMG,
--     Increase Speed, Attack Aura. See per-tag source_notes below.
--
--     NOT TAGGED (no clean vocabulary fit; surfaced, not dropped):
--       * A2's ignore-25%/100%-DEF and its conditional every-2nd-use AoE — no
--         ignore-DEF tag; the AoE is already covered by A3's clean AoE Damage.
--       * Passive: +50% dmg vs [HP Burn] targets / -25% dmg from [HP Burn]
--         enemies / every-5th-skill +200% dmg — damage modifiers, no placed
--         effect. He does NOT apply [HP Burn], so no HP Burn tag.
--
-- >>> REVIEWER FLAGS <<<
--   (a) AFFINITY read as FORCE from the RED header affinity icon (a stylized
--       Monster-Hunter skull, not the standard glyph). Confirm Force before
--       approving (cf. the KNOWN_GAPS colour map: Force=red).
--   (b) A1 Decrease DEF is UNRESISTABLE vs a Boss only. That is a per-champion
--       CONDITIONAL bypass, not a tag-level property — the Decrease Defense tag
--       stays accuracy-gated (bypasses_accuracy_check unchanged); the boss-only
--       bypass is recorded in the source_note, not encoded on the tag.
--   (c) AURA IS DUNGEONS-SCOPED (30% ATK in Dungeons) — unlike Sun Wukong's
--       Arena aura (seeds/49), this DOES apply to the PvE dungeon content the
--       app targets. Placement recorded as 'dungeons' in the source_note.
--   (d) AURA TAG NAME: seeds create 'ATK Aura' (seeds/01) but migration
--       2026-06-30_dedupe_tags renames it to 'Attack Aura'. The aura INSERT
--       below joins on t.name IN ('Attack Aura','ATK Aura') so it lands
--       regardless of whether that rename has been applied (avoids a silent
--       no-op — the exact failure mode CLAUDE.md warns about).
-- ============================================================================

-- (0) Champion row (idempotent; mirrors seeds/48 Dexikos pattern).
insert into champions (game_id, name, faction, affinity, rarity, source_citation)
select 'raid_shadow_legends', 'Rathalos Blademaster', 'Banner Lords', 'Force', 'Legendary',
       'in-game Index champion detail screen (video, 2026-07-07); Monster Hunter collab'
where not exists (
  select 1 from champions
  where game_id = 'raid_shadow_legends' and name = 'Rathalos Blademaster'
);

-- (1) Proposed skill tags (idempotent per unique(champion_id, tag_id)).
insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by, proposed_at, ascension_required)
select ch.id, t.id, 'proposed', 'in_game_index', v.note, 'in-game-index-video', now(), 0
from (values
  ('Decrease Defense',
   'A1 Spirit Thrust (no cd): single-target, 50% chance (unbooked) of a 60% [Decrease DEF] 2t. "If the target is a Boss, this debuff cannot be resisted" — boss-only unresistable (per-champion conditional; tag stays ACC-gated, see reviewer flag (b)). Verbatim in-game Index text, Level 1 unbooked, captured 2026-07-07.'),
  ('AoE Damage',
   'A3 Overhead Slash (cd 4t unbooked, 3t booked via L5 Cooldown -1): "Attacks ALL enemies." Clean AoE. (A2 Spirit Step Slash is ALSO AoE but only on every 2nd use in a Round — conditional; A1 is single-target.) Verbatim in-game Index text, Level 1 unbooked, captured 2026-07-07.'),
  ('Increase C.DMG',
   'A3 Overhead Slash: before attacking, places a 30% [Increase C. DMG] buff on THIS Champion (self) for 2 turns (guaranteed, no chance). Verbatim in-game Index text, Level 1 unbooked, captured 2026-07-07.'),
  ('Increase Speed',
   'A3 Overhead Slash: before attacking, places a 30% [Increase SPD] buff on THIS Champion (self) for 2 turns (guaranteed, no chance). Verbatim in-game Index text, Level 1 unbooked, captured 2026-07-07.')
) as v(tag, note)
join champions ch on ch.game_id = 'raid_shadow_legends' and ch.name = 'Rathalos Blademaster'
join tags t on t.name = v.tag
where not exists (
  select 1 from champion_tags x where x.champion_id = ch.id and x.tag_id = t.id
);

-- (2) Aura tag — tolerant join on the pre/post-rename name (reviewer flag (d)).
insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by, proposed_at, ascension_required)
select ch.id, t.id, 'proposed', 'in_game_index',
       'Aura: "Increases Ally ATK in Dungeons by 30%." Leader skill. Magnitude 30%, placement = DUNGEONS (applies to PvE dungeon content — see reviewer flag (c)). Kept in source_note per the seeds/20 & 47 convention (not on the tag). Confirmed on the dedicated in-game AURA popup, captured 2026-07-07.',
       'in-game-index-video', now(), 0
from champions ch
join tags t on t.name in ('Attack Aura', 'ATK Aura')
where ch.game_id = 'raid_shadow_legends' and ch.name = 'Rathalos Blademaster'
  and not exists (
    select 1 from champion_tags x where x.champion_id = ch.id and x.tag_id = t.id
  );
