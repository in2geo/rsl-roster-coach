-- ============================================================================
-- 69 — Reject Tagoar's two mis-read approved tags (AoE Damage, Decrease Defense).
--
-- In-game Index screenshot (2026-07-07, magenta/ascended) confirms Tagoar is a
-- pure support. A1 "Da Magic Stick" is a SINGLE-TARGET attack (attacks 1 enemy
-- 2 times) that places 60% Increase DEF on the lowest-HP ALLY (an ally buff) —
-- NOT Decrease DEF on enemies, and NOT AoE. A2 (heal + Increase SPD) and A3
-- (revive + shield) are support. So the prior in_game_index tags AoE Damage +
-- Decrease Defense were both mis-reads. Set to 'rejected' (audit trail kept).
-- ============================================================================

update champion_tags ct
set status = 'rejected',
    source_note = coalesce(ct.source_note, '') ||
      ' | REJECTED 2026-07-07: in-game Index screenshot (magenta/ascended) shows '
      'Tagoar is support — A1 "Da Magic Stick" is a SINGLE-TARGET attack (1 enemy, '
      '2 hits) placing 60% Increase DEF on the lowest-HP ALLY (ally buff), not '
      'Decrease DEF on enemies and not AoE; A2/A3 are heal/revive/buff. Prior '
      'in-game reading mis-labeled the ally DEF buff / single-target hit.'
from champions c, tags t
where ct.champion_id = c.id and ct.tag_id = t.id
  and c.name = 'Tagoar' and c.game_id = 'raid_shadow_legends'
  and t.name in ('AoE Damage', 'Decrease Defense')
  and ct.status <> 'rejected';
