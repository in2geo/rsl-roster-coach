-- ============================================================================
-- Seed 48 — 'Debuff Spread' vocabulary + champion links; approve 'ACC Aura'
-- Human review outcome (Mike, 2026-07-08): both open decisions from seed 47's
-- review greenlit —
--   (1) 'ACC Aura' (added as vocab in seeds/47) is APPROVED as a live tag; Kosk's
--       ACC Aura link is promoted proposed -> approved.
--   (2) 'Debuff Spread' finally EARNS a vocabulary tag. It had been surfaced-but-
--       untagged three times (Michelangelo seed 46, Kosk seed 47, and Karnage in
--       the roster worksheet). Created here and applied to the repo champions that
--       have it in verbatim in-game skill text: Michelangelo and Kosk. (Karnage is
--       not in any committed champions seed — worksheet-only, C000919 — so he gets
--       no row here; add him via a champion seed first if/when he enters the repo.)
--
-- source_type='in_game_index' for the champion links (read off the skill text).
-- The links are inserted as status='approved' because this IS the human review
-- that blesses the new vocabulary (same one-step approve pattern as seeds/22).
-- ============================================================================

-- (1) Vocabulary: Debuff Spread (idempotent). An offensive utility mechanic that
--     copies/transfers debuffs from the target to all other enemies — it is not
--     itself a status effect (is_debuff=false) and the copy action is not modelled
--     as accuracy-gated (bypasses_accuracy_check=false); mirrors 'Steal Buffs'.
insert into tags (name, description, bypasses_accuracy_check, is_debuff)
values (
  'Debuff Spread',
  'Takes some or all debuffs from the target and places copies on all other enemies (a debuff-propagation mechanic). Not itself a debuff and not accuracy-gated as a spread action; the spread copies retain their own nature. Distinct from Steal Buffs (moves BUFFS off the target) and from placing a fresh AoE debuff.',
  false, false
)
on conflict (name) do nothing;

-- (2) Debuff Spread champion links (approved). Only the repo champions whose
--     in-game skill text names [Debuff Spread]: Michelangelo and Kosk of Two Skins.
insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by, proposed_at, approved_by, approved_at, ascension_required)
select ch.id, t.id, 'approved', 'in_game_index', v.note, 'in-game-index-video', now(), 'mike-review-2026-07-08', now(), 0
from (values
  ('Michelangelo',
   'A2 Express Delivery! (cd 4t): after placing Decrease DEF/Stun on the target, applies a [Debuff Spread] — takes all debuffs from the target and copies them to all enemies (ignores 25% RES on a crit). Verbatim in-game Index text, Level 1 unbooked, captured 2026-07-07.'),
  ('Kosk of Two Skins',
   'A2 They Will Regret... (cd 4t): the second hit applies a [Debuff Spread] — takes all [Poison] debuffs and the [Poison Sensitivity] debuff from the target and places them on all other enemies. Verbatim in-game Index text, Level 1 unbooked, captured 2026-07-07.')
) as v(name, note)
join champions ch on ch.game_id = 'raid_shadow_legends' and ch.name = v.name
join tags t on t.name = 'Debuff Spread'
where not exists (
  select 1 from champion_tags x where x.champion_id = ch.id and x.tag_id = t.id
);

-- (3) Approve Kosk's ACC Aura link (proposed -> approved). Mirrors seeds/22.
update champion_tags
   set status = 'approved', approved_by = 'mike-review-2026-07-08', approved_at = now()
 where status = 'proposed'
   and champion_id = (select id from champions where name = 'Kosk of Two Skins' and game_id = 'raid_shadow_legends')
   and tag_id      = (select id from tags where name = 'ACC Aura');
