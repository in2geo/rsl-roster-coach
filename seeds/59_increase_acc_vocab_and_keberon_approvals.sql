-- ============================================================================
-- Seed 59 — 'Increase ACC' vocabulary; apply to Keberon + Kosk; approve Keberon
-- Human review outcome (Mike, 2026-07-09):
--   (1) Keberon the Underflame's tags (seeds/58) are APPROVED.
--   (2) 'Increase ACC' EARNS a vocabulary tag — surfaced ally-facing on Keberon
--       (A3 Pyrenei Power, all allies) and self on Kosk (A2 They Will Regret...).
--       Named 'Increase ACC' to pair with the existing 'Decrease ACC'. Created here
--       and applied to both champions with verified in-game text.
--
-- Both applications are inserted 'approved' (Keberon is being approved now; Kosk's
-- other tags were approved in seeds/49). Mirrors the seeds/48/53/57 (vocab + apply +
-- approve) patterns.
-- ============================================================================

-- (1) Vocabulary: Increase ACC (idempotent). A buff that raises the affected ally's
--     Accuracy; the buff counterpart to 'Decrease ACC'. Not a debuff, not accuracy-gated.
insert into tags (name, description, bypasses_accuracy_check, is_debuff)
values (
  'Increase ACC',
  'Places an [Increase ACC] buff that raises the affected ally''s Accuracy by a percentage (helps debuffs land). A buff (not a debuff); the buff counterpart to Decrease ACC. Magnitude/placement come from the in-game Index.',
  false, false
)
on conflict (name) do nothing;

-- (2) Apply Increase ACC (approved) to the two champions with verified in-game text.
insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by, proposed_at, approved_by, approved_at, ascension_required)
select ch.id, t.id, 'approved', 'in_game_index', v.note, 'in-game-index-video', now(), 'mike-review-2026-07-09', now(), 0
from (values
  ('Keberon the Underflame',
   'A3 Pyrenei Power (cd 4t): before attacking, places a 50% [Increase ACC] buff on ALL allies 2t (ally-facing team buff). Verbatim in-game Index text, Level 1 unbooked, captured 2026-07-08.'),
  ('Kosk of Two Skins',
   'A2 They Will Regret... (cd 4t): before attacking, places a 50% [Increase ACC] buff on HIMSELF 2t (SELF only — feeds his own debuff landing, not team support). Verbatim in-game Index text, Level 1, captured 2026-07-07.')
) as v(name, note)
join champions ch on ch.game_id = 'raid_shadow_legends' and ch.name = v.name
join tags t on t.name = 'Increase ACC'
where not exists (
  select 1 from champion_tags x where x.champion_id = ch.id and x.tag_id = t.id
);

-- (3) Approve Keberon's five seed-58 tags (proposed -> approved).
update champion_tags
   set status = 'approved', approved_by = 'mike-review-2026-07-09', approved_at = now()
 where status = 'proposed'
   and champion_id = (select id from champions where name = 'Keberon the Underflame' and game_id = 'raid_shadow_legends')
   and tag_id in (
     select id from tags where name in ('Decrease Defense', 'AoE Damage', 'HP Burn', 'True Fear', 'ATK Aura')
   );
