-- ============================================================================
-- Seed 42 — Ezio Auditore faction fix + proposed tags from in-game skill text
-- Source: in-game champion Index / skill-detail popups, captured verbatim from
-- a screen recording of Ezio Auditore (Lvl 60, 6★) on 2026-07-06.
-- source_type='in_game_index' — a PRIMARY source. status='proposed' — HUMAN
-- REVIEW REQUIRED; the match engine only reads status='approved' tags. No
-- auto-merge.
--
-- AFFINITY: Ezio's icon is GREEN = Spirit (RAID colour map: Magic=blue,
-- Force=red, Spirit=green, Void=purple). seeds/07 already has affinity='Spirit'
-- — CORRECT, unchanged here.
--
-- (0) FACTION FIX: the in-game detail screen shows faction = "Sacred Order",
--     but seeds/07 had "Shadowkin". seeds/07 is corrected at source, but its
--     insert is `on conflict (name) do nothing`, so a live DB that already has
--     the Shadowkin row won't pick up the change — this idempotent UPDATE fixes
--     the live row too. (The seeds/06 solo-profile lookups were also corrected
--     from name='Ezio' to name='Ezio Auditore', which previously bound to NULL.)
--
-- (1) TAGS — skills were shown at Level 1 (UNBOOKED), so chances below are read
--     directly as unbooked values. Verbatim skill text observed:
--       A1 Eagle Dive: "Attacks 1 enemy. Has a 75% chance of placing a 60%
--           [Decrease DEF] debuff for 2 turns. This debuff cannot be resisted if
--           this Champion is under a [Veil] or [Perfect Veil] buff." Dmg: [ATK].
--           Book: +10%(L4)+15%(L5) => 100% booked. Single target.
--           -> Decrease Defense.
--       A2 Da Vinci's Design (cd 4t, 6 skill levels): "Attacks all enemies. Has
--           a 75% chance of placing two 5% [Poison] debuffs and a 25% [Poison
--           Sensitivity] debuff on all enemies for 2 turns. These debuffs cannot
--           be resisted if under [Veil]/[Perfect Veil]. Instantly activates all
--           [Poison] debuffs on enemies under 4+ debuffs. If any enemies are
--           under a [Stone Skin] buff, has a 75% chance of placing 2 [Bomb]
--           debuffs (detonate after 2t) on them instead; if ALL enemies under
--           Stone Skin, -1 to each Bomb countdown." Dmg: [ATK].
--           -> AoE Damage, Poison, Bomb (Bomb is CONDITIONAL — see note).
--       A3 Hidden Gun (cd 4t): "Attacks 1 enemy. Before attacking, steals all
--           buffs from the target (cannot be resisted under [Veil]/[Perfect
--           Veil]). Ignores 35% of target DEF, plus [Shield] and [Strengthen]
--           buffs." Dmg: [ATK]. Single target. -> (Steal Buffs — NO VOCAB, see
--           below; DEF/Shield/Strengthen ignore are damage mechanics, not tags.)
--       Passive Everything Is Permitted [P]: enemy dropping below 25% HP after
--           damage from any Assassin takes bonus true damage (ignores 100% DEF,
--           can't crit). Execute mechanic — no debuff/buff tag.
--       Passive Full Synchronization [P]: "Places a [Perfect Veil] buff on THIS
--           Champion for 2t at the start of each Round. 35% chance to reduce
--           damage exceeding 50% MAX HP to 0. 35% chance to counterattack when
--           attacked." -> Perfect Veil (self). (See Counterattack note below.)
--
--     TAGGED (existing vocab): Decrease Defense (A1), AoE Damage (A2), Poison
--     (A2), Bomb (A2, conditional), Perfect Veil (A3 passive, self).
--
--     NOT TAGGED — surfaced explicitly rather than dropped:
--       * Poison Sensitivity (A2) — NO tag in the vocabulary. Needs a new
--         'Poison Sensitivity' tag proposed in seeds/01|14 and approved first.
--       * Steal Buffs (A3) — NO tag in the vocabulary. Needs a new 'Steal Buffs'
--         tag proposed and approved first.
--       * Counterattack (Full Synchronization passive) — Ezio has a PASSIVE 35%
--         self-counter chance, NOT a placed [Counterattack] buff. The existing
--         'Counterattack' tag means "places [Counterattack] buff on allies", so
--         it does NOT apply here. Left untagged deliberately.
--
--     ascension_required = 0 for all — no ascension padlock on any skill icon.
-- ============================================================================

-- (0) Faction fix for an already-seeded live row (seeds/07 fixed at source).
update champions
   set faction = 'Sacred Order'
 where game_id = 'raid_shadow_legends'
   and name = 'Ezio Auditore'
   and faction = 'Shadowkin';

-- (1) Proposed skill/debuff tags (idempotent per unique(champion_id, tag_id)).
insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by, proposed_at, ascension_required)
select ch.id, t.id, 'proposed', 'in_game_index', v.note, 'in-game-index-video', now(), 0
from (values
  ('Decrease Defense',
   'A1 Eagle Dive: single-target, 75% unbooked chance of 60% [Decrease DEF] 2t (booked 100%: +10% L4, +15% L5). Cannot be resisted while Ezio is under [Veil]/[Perfect Veil]. Verbatim in-game Index text, Level 1 unbooked, captured 2026-07-06.'),
  ('AoE Damage',
   'A2 Da Vinci''s Design hits all enemies (only AoE skill; A1 and A3 are single-target). Verbatim in-game Index text, Level 1 unbooked, captured 2026-07-06.'),
  ('Poison',
   'A2 Da Vinci''s Design (cd 4t): 75% unbooked chance of two 5% [Poison] on all enemies 2t (booked higher; A2 has 6 skill levels, lower book steps cut off in capture). Also places 25% [Poison Sensitivity] (no vocab tag). Cannot be resisted under [Veil]/[Perfect Veil]; instantly activates all Poisons on enemies with 4+ debuffs. Verbatim in-game Index text, Level 1 unbooked, captured 2026-07-06.'),
  ('Bomb',
   'A2 Da Vinci''s Design: CONDITIONAL — only vs enemies already under a [Stone Skin] buff (Ezio does not apply Stone Skin himself), 75% chance of 2 [Bomb] (2t detonation) instead of the Poisons. Rarely relevant outside Stone-Skin content; REVIEWER: consider whether this should stay a live tag given the external condition. Verbatim in-game Index text, Level 1 unbooked, captured 2026-07-06.'),
  ('Perfect Veil',
   'Passive Full Synchronization: self-applies [Perfect Veil] 2t at the start of each Round (on SELF, not allies). Also 35% chance to nullify damage exceeding 50% MAX HP and 35% self-counter (counter is passive, not a placed buff — no Counterattack tag). Verbatim in-game Index text, Level 1, captured 2026-07-06.')
) as v(tag, note)
join champions ch on ch.game_id = 'raid_shadow_legends' and ch.name = 'Ezio Auditore'
join tags t on t.name = v.tag
where not exists (
  select 1 from champion_tags x where x.champion_id = ch.id and x.tag_id = t.id
);
