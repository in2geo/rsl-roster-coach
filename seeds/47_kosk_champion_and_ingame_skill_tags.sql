-- ============================================================================
-- Seed 47 — Kosk of Two Skins champion row + ACC Aura vocab + proposed tags
-- Source: in-game champion Index / skill-detail popups, captured verbatim from
-- a screen recording of Kosk of Two Skins (Lvl 60, 6★) on 2026-07-07.
-- source_type='in_game_index' (PRIMARY). status='proposed' — HUMAN REVIEW
-- REQUIRED; the match engine only reads status='approved' tags. No auto-merge.
--
-- (0) CHAMPION ROW — Kosk of Two Skins is absent from every committed seed.
--     Created here (idempotent; mirrors the seeds/44/45 Artak pattern). Identity
--     read off the in-game detail screen: Lizardmen / Force (red affinity icon;
--     RAID map Magic=blue/Force=red/Spirit=green/Void=purple) / Legendary /
--     Attack. (Cross-checks the roster worksheet's existing C000701 row, which
--     already had Force — the video confirms it.)
--
-- (1) VOCAB — 'ACC Aura' tag added (idempotent, mirrors seeds/20 'RES Aura').
--     Completes the aura-stat set (HP/ATK/DEF/Speed/RES/ACC Aura). Kosk's aura is
--     "+70 [Increase ACC] to all allies in all Battles" (flat, leader-only). Value
--     and placement live in the in-game Index, not on the tag.
--
-- (2) FULL KIT (in-game, Level 1 = UNBOOKED) — for provenance:
--       A1 Envenomed Sickles: "Attacks 1 enemy 2 times. Each hit has a 15% chance
--         of increasing the duration of all enemy debuffs by 1 turn. If the 2nd
--         hit does not increase the duration of all enemy debuffs, instantly
--         activates all [Poison] debuffs on the target instead." Dmg [ATK].
--         Single-target. Books: +20% Dmg L2, +10% Chance L3, +15% Chance L4.
--       A2 They Will Regret... (cd 4t): "Attacks 1 enemy 2 times. Before
--         attacking, places a 50% [Increase ACC] buff on THIS Champion 2t. The
--         first hit has a 75% chance of placing a 25% [Poison Sensitivity] debuff
--         and two 5% [Poison] debuffs 2t. The second hit applies a [Debuff Spread]:
--         takes all [Poison] debuffs and the [Poison Sensitivity] debuff from the
--         target and places them on all other enemies." Dmg [ATK]. Books: +20%
--         Dmg L2, +10% Chance L3, +15% Chance L4, Cooldown -1 L5 (4->3).
--       A3 Toxic Vitriol (cd 4t): "Attacks all enemies. Places a 50% [Decrease
--         ATK] debuff on all enemies 2t. Increases this Champion's Turn Meter by
--         20% for each [Decrease ATK] debuff placed. Instantly activates all
--         [Poison] debuffs on all enemies." Dmg [ATK]. AoE. Books: +10% Dmg L2,
--         +10% Dmg L3, Cooldown -1 L4 (4->3).
--       Passive Imbibed Immunity [P] (Level 1/1, NOT ascension-gated): "This
--         Champion is immune to [Poison], [Stun], and [Decrease SPD] debuffs.
--         Increases this Champion's damage dealt by 5% (stacks up to 50%) and
--         Ignore DEF effect by 3% (stacks up to 30%) for each active debuff on the
--         enemy team. Whenever this Champion is attacked by an enemy under a debuff
--         placed by this Champion, counterattacks using their default skill."
--
-- (3) TAGS ADDED (existing/added vocab; the SOLID ones):
--       * Poison            — A2 (two 5% Poison, 75% unbooked -> 100% booked).
--       * Poison Sensitivity — A2 (25% Poison Sensitivity, 75% -> 100% booked).
--       * Decrease Attack   — A3 Toxic Vitriol (50%, AoE, guaranteed).
--       * AoE Damage        — A3 Toxic Vitriol (hits all enemies; A1/A2 single).
--       * ACC Aura          — leader aura, +70 ACC all Battles (vocab added in (1)).
--
--     NOT TAGGED — logged for review in KNOWN_GAPS.md ("Kosk of Two Skins
--     pending-review tag decisions"), not decided here:
--       * Increase Turn Meter (A3) — the tag means "fills an ALLY's Turn Meter";
--         Kosk's +20%/Decrease-ATK is SELF only. Tagging it would wrongly surface
--         him as a team TM-booster (cf. Xenomorph self-revive, Michelangelo self-
--         buffs). Do not tag without a self-scoped variant.
--       * Counterattack (passive) — the tag means "places a [Counterattack] BUFF
--         on allies". Kosk's passive is that HE counterattacks enemies who hit him
--         while under his debuff — a self/passive counter, not an ally buff. Would
--         mis-surface him as a Counterattack enabler. Do not tag.
--       * Increase ACC self-buff (A2) — no 'Increase Accuracy' tag exists, and it
--         is SELF-applied (survival/self-scaling), not team support.
--       * Debuff Spread (A2) — no vocabulary (same call as Michelangelo/Karnage).
--       * Debuff-duration extension (A1) and Poison ACTIVATION/detonation (A1/A3)
--         — neither is a placed debuff; no tag fits (cf. Venomage Poison-activate).
--       * Immunity to [Poison]/[Stun]/[Decrease SPD] (passive) — a permanent self
--         immunity, NOT the [Block Debuffs] buff; no vocab for innate immunities.
--       * Damage-dealt increase + Ignore DEF per enemy debuff (passive) — self
--         damage-scaling; no vocabulary.
--     ascension_required = 0 for all (no ascension lock on any skill; passive 1/1).
-- ============================================================================

-- (0) Champion row (idempotent; mirrors seeds/44/45 pattern).
insert into champions (game_id, name, faction, affinity, rarity, source_citation)
select 'raid_shadow_legends', 'Kosk of Two Skins', 'Lizardmen', 'Force', 'Legendary',
       'in-game Index champion detail screen (video, 2026-07-07)'
where not exists (
  select 1 from champions
  where game_id = 'raid_shadow_legends' and name = 'Kosk of Two Skins'
);

-- (1) Vocabulary: ACC Aura (idempotent; mirrors seeds/20 RES Aura). Buff, not a
--     debuff; leader-only, magnitude/placement come from the in-game Index.
insert into tags (name, description, bypasses_accuracy_check, is_debuff)
values (
  'ACC Aura',
  'Increases Ally ACC by a flat amount in a specified placement (all battles, dungeons, arena, etc.). Only applies when this champion is the team leader. Value and placement confirmed from in-game Index aura screen.',
  false, false
)
on conflict (name) do nothing;

-- (2) Proposed tags (idempotent per unique(champion_id, tag_id)).
insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by, proposed_at, ascension_required)
select ch.id, t.id, 'proposed', 'in_game_index', v.note, 'in-game-index-video', now(), 0
from (values
  ('Poison',
   'A2 They Will Regret... (cd 4t): the first hit has a 75% chance (booked 100% at L4) of placing TWO 5% [Poison] debuffs 2t on the target; the second hit spreads them (with Poison Sensitivity) to all other enemies via [Debuff Spread]. A1/A3 only ACTIVATE existing Poisons, they do not place them. Verbatim in-game Index text, Level 1 unbooked, captured 2026-07-07.'),
  ('Poison Sensitivity',
   'A2 They Will Regret... (cd 4t): the first hit has a 75% chance (booked 100% at L4) of placing a 25% [Poison Sensitivity] debuff 2t on the target; the second hit spreads it (with the Poisons) to all other enemies via [Debuff Spread]. Verbatim in-game Index text, Level 1 unbooked, captured 2026-07-07.'),
  ('Decrease Attack',
   'A3 Toxic Vitriol (cd 4t): AoE, places a 50% [Decrease ATK] debuff on ALL enemies 2t (guaranteed, no chance stated). Verbatim in-game Index text, Level 1 unbooked, captured 2026-07-07.'),
  ('AoE Damage',
   'A3 Toxic Vitriol hits all enemies (the only AoE-damage skill; A1 Envenomed Sickles and A2 They Will Regret... are single-target). Verbatim in-game Index text, Level 1 unbooked, captured 2026-07-07.'),
  ('ACC Aura',
   'Leader aura: +70 [Increase ACC] to all allies in all Battles (flat, not a percentage). Only applies when Kosk is the team leader. Verbatim in-game Index aura panel, captured 2026-07-07.')
) as v(tag, note)
join champions ch on ch.game_id = 'raid_shadow_legends' and ch.name = 'Kosk of Two Skins'
join tags t on t.name = v.tag
where not exists (
  select 1 from champion_tags x where x.champion_id = ch.id and x.tag_id = t.id
);
