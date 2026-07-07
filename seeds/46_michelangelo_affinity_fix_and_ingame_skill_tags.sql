-- ============================================================================
-- Seed 46 — Michelangelo affinity/faction fix + proposed tags from in-game text
-- Source: in-game champion Index / skill-detail popups, captured verbatim from
-- a screen recording of Michelangelo (Lvl 50, 6★) on 2026-07-07. TMNT collab
-- (© 2025 Viacom). source_type='in_game_index' (PRIMARY). status='proposed' —
-- HUMAN REVIEW REQUIRED; the match engine only reads status='approved' tags.
--
-- (0) AFFINITY/FACTION FIX: the in-game detail screen shows Michelangelo is
--     SPIRIT (green affinity icon; RAID map Magic=blue/Force=red/Spirit=green/
--     Void=purple) and faction "Banner Lords". seeds/07 had Force / Shadowkin.
--     seeds/07 is corrected at source, but its insert is on-conflict-do-nothing,
--     so this idempotent UPDATE fixes an already-seeded live row too. The three
--     Michelangelo solo profiles in seeds/06 have had their affinity reasoning
--     corrected in the same commit (Spirit strong vs Force, weak vs Magic,
--     neutral vs Spirit/Void):
--       - Dragon Stage 20 (Force stage): Spirit is ADVANTAGED (was framed as
--         "Force affinity" lowering thresholds — now Spirit strong vs Force).
--       - Dragon Hard Stage 4: stage-affinity unconfirmed — no warning, pending.
--       - Ice Golem Stage 20 (Spirit stage): Spirit vs Spirit = NEUTRAL (was
--         wrongly "Force weak, confirmed despite penalty").
--
-- (1) FULL KIT (in-game, Level 1 = UNBOOKED):
--       A1 Boo-Yah!: "Attacks 1 enemy 2 times. If either hit was critical,
--         places a 50% [Increase ATK] buff on this Champion 2t." Dmg [ATK].
--       A2 Express Delivery! (cd 4t): "Attacks 1 enemy. Before attacking, 75%
--         chance of 60% [Decrease DEF] 2t. 75% chance of [Stun] 1t (ignore 25%
--         RES if crit). Then applies a [Debuff Spread]: takes all debuffs from
--         the target and places them on all enemies (ignore 25% RES if crit)."
--         Dmg [ATK]. Booked 100% (+10% L2, +15% L3); cd 3t.
--       A3 Shell Cyclone (cd 5t): "Attacks all enemies. 75% chance of 50%
--         [Decrease ATK] and a [Leech] debuff 2t (ignore 25% RES if crit). Then
--         places a [Taunt] buff on this Champion 2t." Dmg [ATK]. Booked 100%;
--         cd 4t.
--       Passive Party Dude: 15% Evade an enemy skill (30% under Taunt); whenever
--         he attacks, ally Leonardo/Donatello/Michelangelo/Raphael join the
--         attack; [Active] places a [Shield] = 300% ATK on this Champion 1t when
--         he receives a hit.
--
-- (2) TAGS ADDED (existing vocab; the SOLID ones):
--       * Decrease Defense — A2 (75%->100%, then spread to all enemies).
--       * Stun            — A2 (75%->100%, single, then spread).
--       * AoE Damage      — A3 Shell Cyclone (hits all enemies).
--       * Decrease Attack — A3 (75%->100%, AoE).
--       * Provoke         — A3 self-[Taunt] 2t (Taunt buff on himself = the
--         Provoke/Taunt tanking mechanic; same treatment as Pelops' Taunt).
--       * Increase Attack — A1 (self, 50% 2t, conditional on a critical hit).
--       * Shield          — passive (self, 300% ATK when hit).
--       Self-buffs (Increase ATK, Shield, Provoke/Taunt) are SELF-applied, not
--       on allies — noted per tag; relevant for solo/survival, not team support.
--
--     NOT TAGGED — logged for review in KNOWN_GAPS.md ("Michelangelo pending-
--     review tag decisions"), no vocabulary exists:
--       * Leech (A3), Debuff Spread (A2), Ally Attack (passive turtle-join),
--         Evade (passive). ascension_required = 0 (no ascension lock on any skill).
-- ============================================================================

-- (0) Affinity + faction fix for an already-seeded live row (seeds/07 fixed at source).
update champions
   set affinity = 'Spirit',
       faction  = 'Banner Lords'
 where game_id = 'raid_shadow_legends'
   and name = 'Michelangelo'
   and (affinity = 'Force' or faction = 'Shadowkin');

-- (1) Proposed tags (idempotent per unique(champion_id, tag_id)).
insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by, proposed_at, ascension_required)
select ch.id, t.id, 'proposed', 'in_game_index', v.note, 'in-game-index-video', now(), 0
from (values
  ('Decrease Defense',
   'A2 Express Delivery! (cd 4t): 75% unbooked (100% booked) chance of 60% [Decrease DEF] 2t on the target, then Debuff Spread copies all target debuffs to all enemies. Verbatim in-game Index text, Level 1 unbooked, captured 2026-07-07.'),
  ('Stun',
   'A2 Express Delivery!: 75% unbooked (100% booked) chance of [Stun] 1t on the target (ignores 25% RES on a crit), then spread to all enemies via Debuff Spread. Verbatim in-game Index text, Level 1 unbooked, captured 2026-07-07.'),
  ('AoE Damage',
   'A3 Shell Cyclone (cd 5t) hits all enemies (the only AoE-damage skill; A1/A2 are single-target). Verbatim in-game Index text, Level 1 unbooked, captured 2026-07-07.'),
  ('Decrease Attack',
   'A3 Shell Cyclone: AoE, 75% unbooked (100% booked) chance of 50% [Decrease ATK] 2t on all enemies (ignores 25% RES on a crit). Verbatim in-game Index text, Level 1 unbooked, captured 2026-07-07.'),
  ('Provoke',
   'A3 Shell Cyclone: places a [Taunt] buff on HIMSELF 2t (self-Taunt = the Provoke/Taunt tanking mechanic, forces enemies to target him; same treatment as Pelops). Verbatim in-game Index text, Level 1, captured 2026-07-07.'),
  ('Increase Attack',
   'A1 Boo-Yah!: self only — if either of the 2 hits is critical, places a 50% [Increase ATK] buff on HIMSELF 2t (conditional on a crit). Verbatim in-game Index text, Level 1, captured 2026-07-07.'),
  ('Shield',
   'Passive Party Dude: self only — places a [Shield] equal to 300% of his ATK on HIMSELF 1t whenever he receives a hit. Verbatim in-game Index text, Level 1, captured 2026-07-07.')
) as v(tag, note)
join champions ch on ch.game_id = 'raid_shadow_legends' and ch.name = 'Michelangelo'
join tags t on t.name = v.tag
where not exists (
  select 1 from champion_tags x where x.champion_id = ch.id and x.tag_id = t.id
);
