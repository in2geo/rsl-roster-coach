-- ============================================================================
-- Seed 45 — Xenomorph champion row + proposed tags from in-game skill text
-- Source: in-game champion Index / skill-detail popups, captured verbatim from
-- a screen recording of Xenomorph (Lvl 41, 6★) on 2026-07-07. Alien: Earth
-- collab champion (© 2025 FX). source_type='in_game_index' (PRIMARY).
-- status='proposed' — HUMAN REVIEW REQUIRED; the match engine only reads
-- status='approved' tags. No auto-merge.
--
-- (0) CHAMPION ROW — Xenomorph is brand new and absent from every committed
--     seed. Created here (idempotent). Identity from the in-game detail screen:
--     Dark Elves / Magic (blue affinity icon) / Legendary / Attack.
--
-- (1) FULL KIT (in-game, Level 1 = UNBOOKED) — for provenance:
--       A1 Tail Stab: "Attacks 1 enemy. Places a 5% [Poison] 2t. Places THREE
--         5% [Poison] if this attack is critical. Also places a [Perfect Veil]
--         buff on this Champion 2t." Dmg [ATK]. Single-target. Poison guaranteed.
--       A2 Infestation (cd 4t): "Attacks 1 enemy. Before attacking, places a
--         [Stun] and an [Infest] debuff on the target 2t (cannot be resisted if
--         under [Perfect Veil]). Places a [True Fear] on all OTHER enemies 1t
--         (cannot be resisted if under [Perfect Veil]). [Passive] Revives THIS
--         Champion at 50% HP + 50% TM whenever an enemy under [Infest] dies."
--         Dmg [ATK]. Stun/Infest single-target, True Fear AoE. All guaranteed.
--       A3 Rip and Claw (cd 4t): "Attacks 1 enemy 2 times. +15% damage per
--         [Poison] on the target. Also places a [Perfect Veil] on this Champion
--         2t." Dmg [ATK]. Single-target.
--       Passive Caustic Blood: "When attacked, 25% chance to place a 5% [Poison]
--         on the attacker 2t (cannot be resisted/blocked if the attack is
--         critical). If an enemy is under a [Poison] placed by this Champion,
--         decreases their DEF by 20%." Book: +10% L2, +15% L3 => 50% booked.
--
-- (2) TAGS ADDED (existing vocab; the SOLID ones):
--       * Poison        — A1 Tail Stab (guaranteed) + Caustic Blood passive (25%).
--       * Perfect Veil  — A1 Tail Stab + A3 Rip and Claw (self, each 2t).
--       * Stun          — A2 Infestation (single-target, 2t).
--       * True Fear     — A2 Infestation (AoE, all other enemies, 1t).
--         NOTE: the 'True Fear' tag is bypasses_accuracy_check=true (always
--         unresistable), but Xenomorph's application is "cannot be resisted ONLY
--         if under [Perfect Veil]" — conditionally unresistable. He self-applies
--         Perfect Veil on A1/A3 so it is usually up, but the engine/reviewer
--         should know the bypass is conditional here (cf. CLAUDE.md open Q#2).
--
--     NOT TAGGED — logged for review in KNOWN_GAPS.md ("Xenomorph pending-review
--     tag decisions"), not decided here:
--       * Infest (A2) — no vocabulary; only mechanical hook is his OWN self-
--         revive (single-champion, niche).
--       * Self-revive (A2 passive) — the 'Revive' tag means reviving ALLIES;
--         his is self-only, so tagging it would wrongly surface him as a team
--         reviver.
--       * -20% DEF (Caustic Blood) — a PASSIVE, CONDITIONAL DEF reduction (only
--         on his-poisoned enemies), not a placed [Decrease DEF] debuff; unclear
--         whether it should carry the Decrease Defense tag.
--     ascension_required = 0 for all (no ascension lock on any skill icon).
-- ============================================================================

-- (0) Champion row (idempotent; mirrors seeds/41 Artak pattern).
insert into champions (game_id, name, faction, affinity, rarity, source_citation)
select 'raid_shadow_legends', 'Xenomorph', 'Dark Elves', 'Magic', 'Legendary',
       'in-game Index champion detail screen (video, 2026-07-07); Alien: Earth collab'
where not exists (
  select 1 from champions
  where game_id = 'raid_shadow_legends' and name = 'Xenomorph'
);

-- (1) Proposed tags (idempotent per unique(champion_id, tag_id)).
insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by, proposed_at, ascension_required)
select ch.id, t.id, 'proposed', 'in_game_index', v.note, 'in-game-index-video', now(), 0
from (values
  ('Poison',
   'A1 Tail Stab: single-target, places a 5% [Poison] 2t (guaranteed, no chance); THREE 5% Poisons if the hit is critical. Passive Caustic Blood: 25% chance (booked 50%) to place a 5% [Poison] on the attacker when hit (unresistable/unblockable on a critical hit). Verbatim in-game Index text, Level 1 unbooked, captured 2026-07-07.'),
  ('Perfect Veil',
   'A1 Tail Stab and A3 Rip and Claw each self-apply a [Perfect Veil] buff 2t (on SELF). Enables the conditional unresistability on A2. Verbatim in-game Index text, Level 1, captured 2026-07-07.'),
  ('Stun',
   'A2 Infestation (cd 4t): before attacking, places a [Stun] on the single target 2t (guaranteed). Cannot be resisted while Xenomorph is under [Perfect Veil]. Verbatim in-game Index text, Level 1 unbooked, captured 2026-07-07.'),
  ('True Fear',
   'A2 Infestation (cd 4t): places a [True Fear] on ALL OTHER enemies 1t (AoE, guaranteed). CONDITIONAL unresistability: "cannot be resisted if this Champion is under a [Perfect Veil] buff" — the True Fear tag is bypasses_accuracy_check=true (always), but Xenomorph''s bypass is Perfect-Veil-gated. Verbatim in-game Index text, Level 1 unbooked, captured 2026-07-07.')
) as v(tag, note)
join champions ch on ch.game_id = 'raid_shadow_legends' and ch.name = 'Xenomorph'
join tags t on t.name = v.tag
where not exists (
  select 1 from champion_tags x where x.champion_id = ch.id and x.tag_id = t.id
);
