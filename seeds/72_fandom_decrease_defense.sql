-- ============================================================================
-- 72 — 14 Decrease Defense champion_tags from Fandom review (advisor session).
-- source_type='fandom_wiki', status='proposed', ascension_required=0. Idempotent.
-- Keyed on DB champion names (short). Jotun SKIPPED (already has Decrease Defense
-- from raid.guide). Skill names + target patterns pulled from Skills_Raw.
-- ============================================================================
insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by, proposed_at, ascension_required)
select ch.id, t.id, 'proposed', 'fandom_wiki', v.note, 'fandom-review-2026-07-07', now(), 0
from (values
  ('Baroth', 'fandom_wiki A3 Serpent Axes: [Decrease DEF] 50% unbooked. single-target.'),
  ('Dhukk', 'fandom_wiki A2 Lunatic Outburst: [Decrease DEF] 50% unbooked. AoE (all enemies).'),
  ('Bloatwraith', 'fandom_wiki A2 Wretched Stench: [Decrease DEF] 70% unbooked. AoE (all enemies).'),
  ('Gloril', 'fandom_wiki A1 Scale Hacker: [Decrease DEF] 20% unbooked (per-hit chance). single-target.'),
  ('Gomlok', 'fandom_wiki A3 Wild Surge: [Decrease DEF] 50% unbooked. AoE (all enemies).'),
  ('Gorlos', 'fandom_wiki A2 Raging Hunger: [Decrease DEF] 50% unbooked. AoE (all enemies).'),
  ('Gravechill', 'fandom_wiki A2 Blood Chill: [Decrease DEF] 50% unbooked. single-target.'),
  ('Kurzad', 'fandom_wiki A3 Deep Ambush: [Decrease DEF] 50% unbooked. AoE (all enemies).'),
  ('Leorius', 'fandom_wiki A1 Lion''s Twinclaws: [Decrease DEF] 60% unbooked (already at cap). single-target.'),
  ('Lydia', 'fandom_wiki A2 Siren''s Wail: [Decrease DEF] 50% unbooked. AoE (all enemies).'),
  ('Rhazin', 'fandom_wiki A2 Shear: [Decrease DEF] 50% unbooked. single-target.'),
  ('Rotos', 'fandom_wiki A1 Terror Scourge: [Decrease DEF] 75% unbooked (already at cap). single-target.'),
  ('Ruel', 'fandom_wiki A1 Vile Arrows: [Decrease DEF] 35% unbooked. single-target.'),
  ('Sicia', 'fandom_wiki A2 Flame Eruption: [Decrease DEF] 60% unbooked. AoE (all enemies).')
) as v(name, note)
join champions ch on ch.name = v.name and ch.game_id = 'raid_shadow_legends'
join tags t on t.name = 'Decrease Defense'
where not exists (select 1 from champion_tags x where x.champion_id = ch.id and x.tag_id = t.id);
