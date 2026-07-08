-- ============================================================================
-- 64 — Staltus Dragonbane (Legendary, Banner Lords, Force, Defense) — in-game
-- Index reading (magenta stars = ascended). status='proposed' where new.
--
-- Context: Staltus already had 5 APPROVED tags (AoE Damage, Decrease Speed,
-- AoE Stun, Decrease Turn Meter, Increase Defense). The in-game read confirms
-- AoE Stun / Decrease Speed / AoE Damage — those approved rows are left as-is
-- (not re-proposed). This seed only makes the NET changes:
--   1. New vocab: Decrease C.DMG.
--   2. Add DEF Aura (ar=3, star-color rule) + Decrease C.DMG (A3 conditional).
--   3. REJECT the approved Decrease Turn Meter tag — A1's TM cut is CONDITIONAL
--      (only fires if the target already has a debuff), so Staltus is not a
--      standalone TM controller (in-game Index Finding 4).
--   4. AI note: passive Untarnished debuff reflection on Ice Golem.
-- Source: in-game Index screenshots, July 2026.
-- ============================================================================

-- ── New vocabulary: Decrease C.DMG ───────────────────────────────────────────
insert into tags (name, description, is_debuff, bypasses_accuracy_check)
values (
  'Decrease C.DMG',
  'Reduces the target''s Critical Damage. A debuff on enemies — subject to the '
  'ACC/RES check. Distinct from Increase C.DMG (an ally buff).',
  true, false
)
on conflict (name) do nothing;

-- ── New champion_tags (DEF Aura + Decrease C.DMG) ────────────────────────────
insert into champion_tags
  (champion_id, tag_id, status, source_type, source_note, proposed_by, proposed_at, ascension_required)
select ch.id, t.id, 'proposed', 'in_game_index', v.note, 'in-game-index-screenshot-july-2026', now(), v.ar
from (values
  ('DEF Aura', 3,
   'Aura: Increases Ally DEF in All Battles by 30%. Confirmed from in-game Index '
   'screenshot July 2026. ascension_required defaulted to 3 per star-color rule — '
   'Staltus shown at magenta (ascended), so a yellow-star screenshot is needed to '
   'confirm 0.'),
  ('Decrease C.DMG', 0,
   'A3 Dragon Heart (L1/6, unbooked): 75% chance 25% Decrease C.DMG for 2 turns — '
   'CONDITIONAL: only applies to enemies whose ATK is HIGHER than their DEF. 50% '
   'unbooked (books: +10% Lvl4, +15% Lvl5). Mutually exclusive with the A3 Decrease '
   'Speed (which hits ATK<=DEF enemies). Cooldown 5 unbooked, 4 fully booked. '
   'Source: in-game Index screenshot July 2026.')
) as v(tag, ar, note)
join champions ch on ch.name = 'Staltus Dragonbane' and ch.game_id = 'raid_shadow_legends'
join tags t on t.name = v.tag
where not exists (select 1 from champion_tags x where x.champion_id = ch.id and x.tag_id = t.id);

-- ── Reject the approved Decrease Turn Meter tag (conditional, not a TM control) ─
update champion_tags ct
set status = 'rejected',
    source_note = coalesce(ct.source_note, '') ||
      ' | REJECTED 2026-07-07 (in-game Index Finding 4): A1 Axe of Glory''s Turn '
      'Meter decrease is CONDITIONAL — it only fires when the target ALREADY has a '
      'debuff (Staltus must not be counted as a standalone TM controller). Not a '
      'landed Decrease Turn Meter capability.'
from champions c, tags t
where ct.champion_id = c.id and ct.tag_id = t.id
  and c.name = 'Staltus Dragonbane' and c.game_id = 'raid_shadow_legends'
  and t.name = 'Decrease Turn Meter'
  and ct.status <> 'rejected';

-- ── AI note: passive Untarnished debuff reflection (Ice Golem) ────────────────
insert into champion_ai_notes (champion_id, dungeon_id, skill_slot, instruction, source_note, status)
select ch.id, d.id, 'passive',
  'Staltus''s passive (Untarnished) reflects Weaken, Decrease DEF, and Poison '
  'debuffs back onto any enemy that attempts to place them on him. On Ice Golem '
  'wave phase, if wave enemies attempt to Weaken/Decrease DEF/Poison Staltus, the '
  'debuffs land on the attacker instead — making him naturally resistant to the '
  'most dangerous wave debuffs. Note: passive ascension gate unconfirmed (shown '
  'at magenta/ascended); ascension_required defaults to 3.',
  'In-game Index screenshot July 2026. Passive mechanic confirmed from skill text. '
  'Proposed, needs review.',
  'proposed'
from champions ch join dungeons d on d.name = 'Ice Golem''s Peak'
where ch.name = 'Staltus Dragonbane' and ch.game_id = 'raid_shadow_legends'
  and not exists (
    select 1 from champion_ai_notes n
    where n.champion_id = ch.id and n.skill_slot = 'passive' and n.dungeon_id = d.id
      and n.instruction like 'Staltus%Untarnished%');
