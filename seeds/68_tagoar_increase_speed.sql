-- ============================================================================
-- 68 — Tagoar: add A2 Increase Speed tag (from the in-game Index reading).
-- Follow-up to seed 67. status='proposed'. Idempotent.
-- ============================================================================
insert into champion_tags
  (champion_id, tag_id, status, source_type, source_note, proposed_by, proposed_at, ascension_required)
select ch.id, t.id, 'proposed', 'in_game_index',
  'A2 Charge Cant: places 30% Increase SPD on all allies for 2 turns. Guaranteed '
  '— no chance roll (alongside the A2 AoE heal). Source: in-game Index screenshot '
  'July 2026.',
  'in-game-index-screenshot-july-2026', now(), 0
from champions ch join tags t on t.name = 'Increase Speed'
where ch.name = 'Tagoar' and ch.game_id = 'raid_shadow_legends'
  and not exists (select 1 from champion_tags x where x.champion_id = ch.id and x.tag_id = t.id);
