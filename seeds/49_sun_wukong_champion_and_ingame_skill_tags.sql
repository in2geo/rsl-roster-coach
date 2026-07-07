-- ============================================================================
-- Seed 49 — Sun Wukong champion row + 'Sheep' vocabulary tag + proposed tags
-- (incl. aura) from in-game skill text. Source: in-game champion Index /
-- skill-detail popups, captured verbatim from a screen recording of Sun Wukong
-- (Lvl 50, 6★, Legendary) on 2026-07-07. source_type='in_game_index' (PRIMARY).
-- status='proposed' — HUMAN REVIEW REQUIRED; the match engine only reads
-- status='approved' tags, so nothing here changes behaviour until a human
-- approves it. No auto-merge.
--
-- (0) CHAMPION ROW — Sun Wukong had NO champions row in any committed seed. He
--     IS referenced by seeds/28 (an alias 'Wukong'), but that alias INSERT does
--     `select id from champions where name='Sun Wukong'` and silently no-ops on
--     a from-scratch rebuild without this row (same failure mode as Venomage in
--     seeds/44). He also has ZERO tags in seeds/15 (the raid.guide scrape never
--     covered him). Created here (idempotent). Identity off the in-game detail
--     screen: Skinwalkers / Spirit (GREEN affinity icon — Spirit, not Force;
--     cf. the KNOWN_GAPS affinity colour map: Spirit=green) / Legendary / Attack.
--
-- (1) 'Sheep' VOCABULARY TAG — new. Sun Wukong's A2 places [Sheep] but no 'Sheep'
--     tag existed. Added below (idempotent).
--
-- (2) FULL KIT (in-game, Level 1 = UNBOOKED) — for provenance:
--       A1 Gotcha! (no cd): "Attacks 1 enemy. Has a 25% chance of placing a
--         [Stun] debuff for 1 turn. The chance increases to 50% if the target
--         has any buffs." Dmg [ATK]. Single-target Stun (conditional chance).
--       A2 Staff of Wonder (cd 4t; booked 3t via L5 Cooldown -1): "Attacks 1
--         enemy. Will ignore 50% of the target's DEF. Will attack all remaining
--         enemies with any surplus damage if the target is killed (this cleave
--         also ignores 50% DEF and cannot be critical). If the initial target
--         survives, places a [Sheep] debuff on them for 1 turn. This debuff
--         cannot be blocked." Dmg [ATK].
--       A3 Now You See Us (cd 4t; booked 3t via L4 Cooldown -1): "Attacks all
--         enemies. Before attacking, steals all buffs from all enemies and then
--         places a [Block Buffs] debuff on them for 2 turns." Dmg [ATK]. AoE.
--       Passive Unbeatable Wukong [P] (locked, Unlocks at Ascension Level 3):
--         "Revives this Champion with 100% HP and 100% Turn Meter 3 turns after
--         they were killed." SELF-revive only (see reviewer flag (b)).
--       Aura: "Increases Ally SPD in Arena battles by 28%." -> Speed Aura, 28%,
--         placement = ARENA ONLY (see reviewer flag (a)).
--
-- (3) TAGS PROPOSED (6): Stun, Sheep, Steal Buffs, Block Buffs, AoE Damage,
--     Speed Aura. See per-tag source_notes below.
--
--     NOT TAGGED (no clean vocabulary fit; surfaced, not dropped):
--       * A2 Staff of Wonder's "ignore 50% DEF" and its conditional cleave (hits
--         all remaining enemies with surplus damage on a kill) — no ignore-DEF
--         or cleave tag exists.
--       * The passive's SELF-revive — see reviewer flag (b): deliberately NOT
--         tagged 'Revive' (that would imply ally-revive team utility he lacks).
--
-- >>> REVIEWER FLAGS <<<
--   (a) AURA IS ARENA-SCOPED. "Increases Ally SPD in Arena battles by 28%" —
--       placement = Arena, NOT all battles. This app is about PvE DUNGEON
--       content, where an Arena-only aura does NOT apply. The Speed Aura tag is
--       proposed for completeness/provenance, but the source_note records the
--       Arena scope explicitly — confirm the matching engine does NOT credit an
--       Arena-placement aura toward dungeon SPD before approving.
--   (b) SELF-REVIVE, NOT ALLY REVIVE. Passive Unbeatable Wukong revives ONLY Sun
--       Wukong himself (100% HP + 100% TM, 3 turns after death), and only at
--       Ascension 3. Not tagged 'Revive' — that tag reads as ally-revive utility
--       (cf. Dexikos seeds/48, whose A3 revives ALLIES). If a 'Self Revive' /
--       survival tag is ever added, apply it here (ascension_required=3).
--   (c) Sun Wukong had NO champions row and NO tags at all in committed seeds
--       despite the seeds/28 alias — this file is his first real content.
-- ============================================================================

-- (1) 'Sheep' vocabulary tag (idempotent). Crowd-control debuff.
insert into tags (name, description, bypasses_accuracy_check, is_debuff)
values (
  'Sheep',
  'Transforms the target into a sheep, a crowd-control debuff that makes them skip their turns (cannot use skills) for the duration. A landed, resistible debuff — subject to the normal ACC/RES check (bypasses_accuracy_check=false). A specific skill may state its [Sheep] "cannot be blocked", which bypasses the [Block Debuffs] buff only — that per-skill clause is separate from ACC/RES. Verify the full mechanic against the in-game [Sheep] More-Info text on review.',
  false, true
)
on conflict (name) do nothing;

-- (0) Champion row (idempotent; mirrors seeds/45 Xenomorph pattern).
insert into champions (game_id, name, faction, affinity, rarity, source_citation)
select 'raid_shadow_legends', 'Sun Wukong', 'Skinwalkers', 'Spirit', 'Legendary',
       'in-game Index champion detail screen (video, 2026-07-07)'
where not exists (
  select 1 from champions
  where game_id = 'raid_shadow_legends' and name = 'Sun Wukong'
);

-- (3) Proposed tags incl. aura (idempotent per unique(champion_id, tag_id)).
insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by, proposed_at, ascension_required)
select ch.id, t.id, 'proposed', 'in_game_index', v.note, 'in-game-index-video', now(), 0
from (values
  ('Stun',
   'A1 Gotcha! (no cooldown): single-target. 25% chance (unbooked) of placing a [Stun] 1t; chance increases to 50% if the target has ANY buffs. Single-target (NOT AoE Stun). Subject to ACC/RES. Verbatim in-game Index text, Level 1 unbooked, captured 2026-07-07.'),
  ('Sheep',
   'A2 Staff of Wonder (cd 4t unbooked, 3t booked via L5 Cooldown -1): if the initial single target SURVIVES the hit, places a [Sheep] debuff on them 1t. "This debuff cannot be blocked" => bypasses [Block Debuffs], but still subject to ACC/RES (bypasses_accuracy_check=false on the tag). Verbatim in-game Index text, Level 1 unbooked, captured 2026-07-07.'),
  ('Steal Buffs',
   'A3 Now You See Us (cd 4t unbooked, 3t booked via L4 Cooldown -1): before attacking, steals ALL buffs from ALL enemies (AoE, guaranteed — no chance clause). Verbatim in-game Index text, Level 1 unbooked, captured 2026-07-07.'),
  ('Block Buffs',
   'A3 Now You See Us: after the buff steal, places a [Block Buffs] debuff on ALL enemies for 2 turns (AoE, guaranteed). Verbatim in-game Index text, Level 1 unbooked, captured 2026-07-07.'),
  ('AoE Damage',
   'A3 Now You See Us: attacks ALL enemies. Dmg [ATK]. (A2 Staff of Wonder also cleaves all remaining enemies with surplus damage, but only conditionally on a kill — the clean AoE is A3. A1 Gotcha! is single-target.) Verbatim in-game Index text, Level 1 unbooked, captured 2026-07-07.'),
  ('Speed Aura',
   'Aura: "Increases Ally SPD in Arena battles by 28%." Leader skill. Magnitude 28%, placement = ARENA ONLY (NOT all battles) — see reviewer flag (a): does not apply to PvE dungeon content. Kept in source_note per the seeds/20 & 47 convention (not on the tag). Confirmed on the dedicated in-game AURA popup, captured 2026-07-07.')
) as v(tag, note)
join champions ch on ch.game_id = 'raid_shadow_legends' and ch.name = 'Sun Wukong'
join tags t on t.name = v.tag
where not exists (
  select 1 from champion_tags x where x.champion_id = ch.id and x.tag_id = t.id
);
