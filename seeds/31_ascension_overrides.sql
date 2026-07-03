-- 31 — Champion skill ascension_required overrides (from the in-game Index skill padlock).
--
-- raid.guide cannot flag ascension unlocks (see scrape-champion-tags.js), and the padlock
-- is only visible on an OWNED, not-yet-ascended champion — so per-skill ascension
-- requirements are captured manually from the in-game Index. This seed is the durable,
-- growable source of truth: the promotion of the hardcoded ASCENSION_OVERRIDES map. Add a
-- row to the override list below as each gated skill is confirmed.
--
-- Skeletor is a licensed crossover (not on raid.guide), so his passive tags are seeded
-- here directly. Passive "Master of Evil" [P] unlocks at Ascension Level 3 and, when hit,
-- places [Decrease RES] (50%) / [Petrification] (25%) on the attacker (confirmed from the
-- in-game skill screen, 2026-07-02). Partial tag set (passive only), status=proposed.

-- The Decrease RES debuff had no tag yet (matches the other Decrease-stat debuffs).
insert into tags (name, is_debuff, bypasses_accuracy_check)
select 'Decrease RES', true, false
where not exists (select 1 from tags where name = 'Decrease RES');

-- Skeletor passive tags.
insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by, proposed_at, ascension_required)
select ch.id, t.id, 'proposed', 'in_game_index',
  'In-game Index: passive "Master of Evil" [P] unlocks at Ascension Level 3; when hit, 50% chance to place [Decrease RES] on the attacker.',
  'in-game-index-2026-07-02', now(), 3
from champions ch join tags t on t.name = 'Decrease RES'
where ch.name = 'Skeletor' and ch.game_id = 'raid_shadow_legends'
  and not exists (select 1 from champion_tags x where x.champion_id = ch.id and x.tag_id = t.id);

insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by, proposed_at, ascension_required)
select ch.id, t.id, 'proposed', 'in_game_index',
  'In-game Index: passive "Master of Evil" [P] unlocks at Ascension Level 3; when hit, 25% chance to place [Petrification] on the attacker.',
  'in-game-index-2026-07-02', now(), 3
from champions ch join tags t on t.name = 'Petrification'
where ch.name = 'Skeletor' and ch.game_id = 'raid_shadow_legends'
  and not exists (select 1 from champion_tags x where x.champion_id = ch.id and x.tag_id = t.id);

-- ── Ascension override list (durable, growable) ──────────────────────────────
-- (champion, tag) -> ascension_required. Applied to whatever champion_tags exist; a
-- champion/tag not yet present is simply skipped (add the entry, re-run when it's tagged).
update champion_tags ct set ascension_required = v.lvl
from (values
  ('Fayne',    'Decrease Attack', 3),   -- confirmed in-game Index (re-verify per KNOWN_GAPS)
  ('Skeletor', 'Decrease RES',    3),
  ('Skeletor', 'Petrification',   3)
) as v(champion, tag, lvl)
join champions ch on ch.name = v.champion and ch.game_id = 'raid_shadow_legends'
join tags t on t.name = v.tag
where ct.champion_id = ch.id and ct.tag_id = t.id;
