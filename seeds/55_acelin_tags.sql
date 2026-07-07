-- ============================================================================
-- 55 — Acelin (Legendary, Banner Lords, Magic, role Defense) champion_tags.
--
-- Source: AyumiLove skill text, read by hand (Tier 2, factual data only).
-- source_type='human_observation', status='proposed' — HUMAN REVIEW REQUIRED.
-- Idempotent (NOT EXISTS on champion + tag). DB champion name is 'Acelin'
-- (NOT 'Acelin the Stalwart'). Not Mythical → champion_form left NULL.
--
-- ascension_required:
--   * Defense Aura -> 3 (auras default to 3 per SOURCE_HIERARCHY.md; AyumiLove
--     cannot show gates — downgrade only on an in-game no-padlock screenshot).
--   * Active-skill effects -> 0.
--   * Passive "Knight of Knights" (10% damage reduction for Shield-buffed
--     allies) is NOT tagged — no matchable dungeon goal; document in
--     champion_ai_notes. If tagged later, default it to 3.
--   * Faction Unity HP aura (Banner Lords only) is NOT tagged separately —
--     the engine has no faction-aware aura logic yet, so a universal tag would
--     over-credit non-Banner-Lords teams. Noted in the Defense Aura source_note.
--
-- All referenced tags (Stun, Healer, AoE Damage, Ally Protection, Shield,
-- Defense Aura) already exist — no vocabulary insert needed.
-- ============================================================================

insert into champion_tags
  (champion_id, tag_id, status, source_type, source_note,
   proposed_by, proposed_at, ascension_required)
select ch.id, t.id, 'proposed', 'human_observation', v.note,
       'ayumilove-human-read-july-2026', now(), v.ar
from (values
  ('Stun', 0,
   'A1 Hammer of Kaerok: 50% chance to Stun for 1 turn. 25% unbooked '
   '(books: +10% Lvl2, +15% Lvl4). Single-target. Ignores 25% of the '
   'target''s RES while Acelin is under a Shield buff (A3 synergy). Damage '
   'scales off DEF. AyumiLove (human read).'),
  ('Healer', 0,
   'A2 Shield Crush: heals all allies by the total value of all Shield buffs '
   'on all allies, then removes those Shields. Heal scales with accumulated '
   'Shield value — optimal rotation is A3 (place Shields) then A2 (consume). '
   'CD 4 unbooked / 3 fully booked. AyumiLove (human read).'),
  ('AoE Damage', 0,
   'A2 Shield Crush: AoE attack dealing damage equal to the total Shield '
   'value removed, capped at 1000% DEF. Not a debuff, not ACC-gated. '
   'AyumiLove (human read).'),
  ('Ally Protection', 0,
   'A3 Behold the Banner: places 50% Ally Protection on all allies except '
   'Acelin for 2 turns. Guaranteed (no chance roll). CD 5 unbooked / 3 fully '
   'booked. AyumiLove (human read).'),
  ('Shield', 0,
   'A3 Behold the Banner: also places a Shield (30% of max HP) on all allies. '
   'Feeds the A2 (Shield Crush) heal + AoE damage and the A1 RES-ignore '
   'condition. AyumiLove (human read).'),
  ('Defense Aura', 3,
   'Aura: Increases Ally DEF in All Battles by 25% (all allies, faction-'
   'agnostic). NOTE: Acelin also has a Faction Unity HP +15% aura that applies '
   'ONLY to Banner Lords allies — intentionally NOT tagged separately until the '
   'engine has faction-aware aura logic, to avoid over-crediting mixed teams. '
   'ascension_required=3 by default rule (AyumiLove cannot show gates). '
   'AyumiLove (human read).')
) as v(tag, ar, note)
join champions ch on ch.name = 'Acelin' and ch.game_id = 'raid_shadow_legends'
join tags t on t.name = v.tag
where not exists (
  select 1 from champion_tags x where x.champion_id = ch.id and x.tag_id = t.id
);
