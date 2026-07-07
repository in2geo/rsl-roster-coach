-- ============================================================================
-- Seed 43 — Vocabulary: Poison Sensitivity + Steal Buffs, and Ezio's links
-- Requested 2026-07-07 (Mike) to close the two "no vocab" gaps left by seed 42
-- (Ezio Auditore's Da Vinci's Design A2 and Hidden Gun A3).
--
-- New vocabulary tags are inserted here (tags have no status column — they ARE
-- the vocabulary). The Ezio champion_tags LINKS are status='proposed' and must
-- be human-reviewed before the match engine reads them, same as every other
-- champion_tag. No auto-merge of the links.
--
-- Flag semantics (see migrations/2026-07-01_tags_is_debuff.sql + seeds/18):
--   accuracy-gated iff (is_debuff AND NOT bypasses_accuracy_check).
--   * Poison Sensitivity — a debuff placed on an enemy that must land vs ACC/RES
--     => is_debuff=true, bypasses_accuracy_check=false (accuracy-gated). Ezio's
--     "cannot be resisted under [Veil]/[Perfect Veil]" is a per-SKILL clause, so
--     it lives in the champion_tag source_note, not on the tag (same treatment
--     as his normal Decrease Defense).
--   * Steal Buffs — buff removal/theft is NOT accuracy-gated in RAID (ignores
--     ACC/RES; it is not a lingering debuff placed on the target)
--     => is_debuff=false, bypasses_accuracy_check=false.
-- ============================================================================

-- (1) Vocabulary.
insert into tags (name, description, bypasses_accuracy_check, is_debuff) values
  ('Poison Sensitivity',
   'Places [Poison Sensitivity] debuff — increases the damage the target takes from [Poison] debuffs by the stated percent. A landed, resistible debuff (subject to the ACC/RES check). Pairs with AoE Poison appliers (e.g. Ezio''s Da Vinci''s Design).',
   false, true),
  ('Steal Buffs',
   'Instantly removes buffs from the target and transfers them to the caster. Not accuracy-gated — buff theft/removal ignores ACC/RES and is not a lingering debuff. Distinct from Block Buffs (prevents NEW buffs) and Cleanse (removes debuffs from ALLIES).',
   false, false)
on conflict (name) do nothing;

-- (2) Ezio Auditore proposed links (idempotent per unique(champion_id, tag_id)).
insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by, proposed_at, ascension_required)
select ch.id, t.id, 'proposed', 'in_game_index', v.note, 'in-game-index-video', now(), 0
from (values
  ('Poison Sensitivity',
   'A2 Da Vinci''s Design (cd 4t): AoE, 75% unbooked chance places a 25%-potency [Poison Sensitivity] 2t on all enemies (same roll as the two 5% Poisons). Cannot be resisted while Ezio is under [Veil]/[Perfect Veil]. Verbatim in-game Index text, Level 1 unbooked, captured 2026-07-06.'),
  ('Steal Buffs',
   'A3 Hidden Gun (cd 4t): single-target — before attacking, steals ALL buffs from the target (guaranteed, no chance). Cannot be resisted while Ezio is under [Veil]/[Perfect Veil]. Verbatim in-game Index text, Level 1, captured 2026-07-06.')
) as v(tag, note)
join champions ch on ch.game_id = 'raid_shadow_legends' and ch.name = 'Ezio Auditore'
join tags t on t.name = v.tag
where not exists (
  select 1 from champion_tags x where x.champion_id = ch.id and x.tag_id = t.id
);
