-- ============================================================================
-- 67 — Tagoar (Epic, Orcs, Force, Support) — in-game Index reading.
-- source_type='in_game_index', status='proposed'. Idempotent (NOT EXISTS).
-- Not Mythical → champion_form NULL.
--
-- This seed adds only the UNAMBIGUOUS new tags. The pre-existing approved
-- 'Decrease Defense' + 'AoE Damage' (both in_game_index, from a PRIOR reading
-- that conflicts with the current support-only read) are intentionally NOT
-- touched here — pending human adjudication (see Flag 1 discussion).
--
-- ascension_required: active-skill effects -> 0; HP Aura -> 3 (star-color
-- default; Tagoar shown ascended/magenta).
-- ============================================================================

insert into champion_tags
  (champion_id, tag_id, status, source_type, source_note, proposed_by, proposed_at, ascension_required)
select ch.id, t.id, 'proposed', 'in_game_index', v.note, 'in-game-index-screenshot-july-2026', now(), v.ar
from (values
  ('Healer', 0,
   'A2 Charge Cant (L4/5, partially booked): heals all allies by 15% of Tagoar''s '
   'MAX HP. Guaranteed — no chance roll. Also places 30% Increase SPD on all '
   'allies for 2 turns. Cooldown 4 unbooked, 2 fully booked (two Cooldown -1 '
   'books). Source: in-game Index screenshot July 2026.'),
  ('Revive', 0,
   'A3 Rise And Fight (L3/3, fully booked): revives ALL dead allies with 30% HP '
   '(AoE revive — all dead allies simultaneously; using the single Revive tag, no '
   'AoE Revive tag exists). Also places a Shield (20% of Tagoar''s MAX HP) on all '
   'allies for 2 turns. Guaranteed. Cooldown 5 unbooked, 3 fully booked. Source: '
   'in-game Index screenshot July 2026.'),
  ('Shield', 0,
   'A3 Rise And Fight: places a Shield equal to 20% of Tagoar''s MAX HP on all '
   'allies for 2 turns (alongside the AoE revive). Guaranteed. Source: in-game '
   'Index screenshot July 2026.'),
  ('HP Aura', 3,
   'Aura: Increases Ally HP in All Battles by 25%. Confirmed from in-game Index '
   'screenshot July 2026. ascension_required=3 (star-color default) — a yellow-'
   'star unascended screenshot is needed to confirm 0.')
) as v(tag, ar, note)
join champions ch on ch.name = 'Tagoar' and ch.game_id = 'raid_shadow_legends'
join tags t on t.name = v.tag
where not exists (select 1 from champion_tags x where x.champion_id = ch.id and x.tag_id = t.id);
