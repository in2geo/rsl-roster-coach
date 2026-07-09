-- ============================================================================
-- Seed 58 — Keberon the Underflame champion row + in-game skill tags
-- Source: in-game champion Index / skill-detail popups, captured verbatim from
-- a screen recording of Keberon the Underflame (Lvl 60, 6★) on 2026-07-08.
-- source_type='in_game_index' (PRIMARY). status='proposed' — HUMAN REVIEW
-- REQUIRED; the match engine only reads status='approved' tags. No auto-merge.
--
-- (0) CHAMPION ROW — Keberon is absent from every committed seed (not in seeds/15).
--     Created here (idempotent; mirrors seeds/44 Venomage). Identity from the in-game
--     detail screen: Argonites / Force (red affinity icon) / Legendary / Attack.
--     (Cross-checks the roster worksheet's C000690 row — same values.)
--     An HP-Burn-centric nuker with self-sustain and a cheat-death passive.
--
-- (1) FULL KIT (in-game, Level 1 = UNBOOKED). Damage [ATK]-based; all four skills
--     were visible/unlocked at 6★ (NONE ascension-gated):
--       A1 Fiery Rend: "Attacks 1 enemy 2 times. 75% chance of a 60% [Decrease DEF]
--         2t. 50% chance of attacking with this skill whenever an enemy has a
--         [HP Burn] activated on them (once per turn)." Books: +5% Dmg L2-L5.
--       A2 Searing Brand (cd 4t): "Attacks 1 enemy 2 times. Before attacking, places
--         a [Deathbrand] debuff 2t. Will ignore [Unkillable] and [Shield] buffs and
--         25% of the target's DEF. Activates Pyrenei Power if the target is killed;
--         else fills this Champion's Turn Meter by 50%." Books: +10% Dmg L2/L3,
--         Cooldown -1 L4 (4 -> 3).
--       A3 Pyrenei Power (cd 4t): "Attacks all enemies. Before attacking, places a
--         50% [Increase ACC] buff on ALL allies 2t. 75% chance of a [HP Burn] on ALL
--         enemies 2t. Fills own Turn Meter 20% per HP Burn placed / 10% per HP Burn
--         resisted." Books: +10% Dmg L2/L3, +10% Chance L4, +15% Chance L5, Cooldown
--         -1 L6 (4 -> 3).
--       Passive Underflame's Protection [P] (cd 4t): [Active] activates a [Delay]
--         (cheat-death) on this Champion when they take a fatal hit. [Passive] heals
--         SELF 20% MAX HP whenever a [HP Burn] is activated on an enemy; when a
--         [HP Burn] on an enemy expires/is removed, places a [True Fear] 1t on it.
--
--     >>> AURA NOT CAPTURED: like the Glorious Pallas clip, this recording used the
--         collection / Total-Stats view (no aura panel). Aura UNKNOWN from this clip
--         — not guessed. Needs a follow-up skills-screen shot; Aura Status stays
--         Pending. <<<
--
-- (2) TAGS ADDED (existing vocab; the SOLID ones). ascension_required = 0 for all:
--       * Decrease Defense — A1 Fiery Rend (60%, 75% chance, 2t, single-target).
--       * AoE Damage       — A3 Pyrenei Power (attacks all enemies; A1/A2 single).
--       * HP Burn          — A3 Pyrenei Power (75% chance, ALL enemies, 2t).
--       * True Fear        — passive: places [True Fear] 1t on an enemy when its
--         [HP Burn] expires or is removed.
--
-- (3) NOT TAGGED — logged in KNOWN_GAPS.md ("Keberon pending-review tag decisions"),
--     no vocabulary / self-scoped:
--       * Increase ACC (A3) — 50% [Increase ACC] buff on ALL ALLIES 2t. Genuinely
--         ally-facing team buff, but no 'Increase Accuracy' vocab tag exists (also
--         seen SELF on Kosk seed 47). Strong candidate to promote — decision needed.
--       * Deathbrand (A2) — unique debuff, no vocab.
--       * Ignore [Unkillable]/[Shield] + 25% DEF (A2) — anti-buff/penetration tech;
--         he BYPASSES these enemy buffs, does NOT grant them (same pattern as Jurojin
--         seed 50). No vocab. If he ever gets a raid.guide scrape, watch for the
--         Unkillable/Shield mis-tag.
--       * [Delay] cheat-death (passive Active) — survival mechanic, no vocab.
--       * Self-heal 20% MAX HP on HP-Burn activation (passive) — SELF sustain; the
--         'Healer' tag is ally-facing, so NOT tagged.
--       * Self Turn-Meter fills (A2 on survive, A3 per HP Burn) — SELF; 'Increase
--         Turn Meter' is ally-facing, so NOT tagged.
-- ============================================================================

-- (0) Champion row (idempotent; mirrors seeds/44 Venomage pattern).
insert into champions (game_id, name, faction, affinity, rarity, source_citation)
select 'raid_shadow_legends', 'Keberon the Underflame', 'Argonites', 'Force', 'Legendary',
       'in-game Index champion detail screen (video, 2026-07-08)'
where not exists (
  select 1 from champions
  where game_id = 'raid_shadow_legends' and name = 'Keberon the Underflame'
);

-- (2) Proposed tags from primary in-game text (idempotent per unique(champion_id, tag_id)).
insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by, proposed_at, ascension_required)
select ch.id, t.id, 'proposed', 'in_game_index', v.note, 'in-game-index-video', now(), 0
from (values
  ('Decrease Defense',
   'A1 Fiery Rend: single-target 2-hit; 75% chance (unbooked) of a 60% [Decrease DEF] debuff 2t. Verbatim in-game Index text, Level 1 unbooked, captured 2026-07-08.'),
  ('AoE Damage',
   'A3 Pyrenei Power (cd 4t) attacks all enemies (the only AoE skill; A1 Fiery Rend and A2 Searing Brand are single-target). Verbatim in-game Index text, Level 1 unbooked, captured 2026-07-08.'),
  ('HP Burn',
   'A3 Pyrenei Power (cd 4t): 75% chance (unbooked) of placing a [HP Burn] debuff on ALL enemies 2t; books raise the chance (+10% L4, +15% L5). His kit is HP-Burn-centric (A1 extra attack, passive heal + True Fear all key off HP Burn). Verbatim in-game Index text, Level 1 unbooked, captured 2026-07-08.'),
  ('True Fear',
   'Passive Underflame''s Protection [P]: whenever a [HP Burn] debuff on an enemy expires or is removed, places a [True Fear] debuff 1t on that enemy. Verbatim in-game Index text, Level 1, captured 2026-07-08.')
) as v(tag, note)
join champions ch on ch.game_id = 'raid_shadow_legends' and ch.name = 'Keberon the Underflame'
join tags t on t.name = v.tag
where not exists (
  select 1 from champion_tags x where x.champion_id = ch.id and x.tag_id = t.id
);
