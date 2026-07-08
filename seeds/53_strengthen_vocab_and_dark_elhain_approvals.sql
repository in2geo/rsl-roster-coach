-- ============================================================================
-- Seed 53 — 'Strengthen' vocabulary + Dark Elhain link; approve Dark Elhain tags
-- Human review outcome (Mike, 2026-07-08): the two open decisions from seed 52's
-- review greenlit —
--   (1) Dark Elhain's SOLID tags (Decrease Speed, AoE Damage, Increase Attack
--       [self], Increase C.Rate [self, Asc 3], Increase C.DMG [self, Asc 3]) are
--       APPROVED — promoted proposed -> approved.
--   (2) 'Strengthen' EARNS a vocabulary tag (a common RSL buff; first needed for
--       Dark Elhain's Ascension-3 Veins of Ice). Created here and applied — approved
--       — to Dark Elhain (self, ascension_required=3). Future Strengthen champions
--       can now be tagged against this vocab.
--
-- Mirrors the seeds/48 (vocab + approve) and seeds/49/51 (approval) patterns.
-- ============================================================================

-- (1) Vocabulary: Strengthen (idempotent). A buff that reduces damage the ally
--     takes; not a debuff, not accuracy-gated.
insert into tags (name, description, bypasses_accuracy_check, is_debuff)
values (
  'Strengthen',
  'Places a [Strengthen] buff that reduces the damage the affected ally takes by a percentage. A buff (not a debuff); magnitude/placement come from the in-game Index.',
  false, false
)
on conflict (name) do nothing;

-- (2) Dark Elhain Strengthen link (approved). Veins of Ice [P], Ascension 3, SELF.
insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by, proposed_at, approved_by, approved_at, ascension_required)
select ch.id, t.id, 'approved', 'in_game_index',
       'Passive Veins of Ice [P] — UNLOCKS AT ASCENSION 3: SELF only — grants a 15% [Strengthen] buff on HERSELF whenever an enemy places a [Freeze] on her (alongside the C.RATE/C.DMG buffs). Verbatim in-game Index text, Level 1, captured 2026-07-07.',
       'in-game-index-video', now(), 'mike-review-2026-07-08', now(), 3
from champions ch
join tags t on t.name = 'Strengthen'
where ch.game_id = 'raid_shadow_legends' and ch.name = 'Dark Elhain'
  and not exists (
    select 1 from champion_tags x where x.champion_id = ch.id and x.tag_id = t.id
  );

-- (3) Approve Dark Elhain's five solid tags from seeds/52 (proposed -> approved).
update champion_tags
   set status = 'approved', approved_by = 'mike-review-2026-07-08', approved_at = now()
 where status = 'proposed'
   and champion_id = (select id from champions where name = 'Dark Elhain' and game_id = 'raid_shadow_legends')
   and tag_id in (
     select id from tags where name in ('Decrease Speed', 'AoE Damage', 'Increase Attack', 'Increase C.Rate', 'Increase C.DMG')
   );
