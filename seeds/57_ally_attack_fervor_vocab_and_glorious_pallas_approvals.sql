-- ============================================================================
-- Seed 57 — 'Ally Attack' + 'Fervor' vocabulary; apply them; approve Glorious Pallas
-- Human review outcome (Mike, 2026-07-08):
--   (1) Glorious Pallas's tags (seeds/56) are APPROVED.
--   (2) 'Ally Attack' EARNS a vocabulary tag — surfaced twice now (Michelangelo
--       seed 46, Glorious Pallas seed 56) and previously handled outside the tag
--       vocab for the Clan Boss Fahrakin/Cardiel concept (see CLAUDE.md). Created
--       here and applied to the two champions with verified in-game text.
--   (3) 'Fervor' EARNS a vocabulary tag (buff that boosts Turn-Meter gain from
--       beneficial effects). Created here and applied to Glorious Pallas.
--
-- Application status: Glorious Pallas is fully approved (explicit instruction), so
-- her Ally Attack + Fervor links are inserted 'approved'. Michelangelo's Ally Attack
-- is inserted 'proposed' — his other seeds/46 tags are still proposed pending his
-- own review, so his new tag matches that state.
-- Mirrors the seeds/48 (vocab + apply) and seeds/53/55 (approval) patterns.
-- ============================================================================

-- (1) Vocabulary: Ally Attack (idempotent). An offensive mechanic — the champion
--     calls one or more allies to join the attack (allies use their default skill);
--     not itself a buff/debuff and not accuracy-gated.
insert into tags (name, description, bypasses_accuracy_check, is_debuff)
values (
  'Ally Attack',
  'Calls one or more allies to join this Champion''s attack (the joining ally uses their default skill). An offensive teamplay mechanic; not itself a buff or debuff and not accuracy-gated. Distinct from a simple AoE — specific allies act.',
  false, false
)
on conflict (name) do nothing;

-- (2) Vocabulary: Fervor (idempotent). A buff that increases the Turn Meter the
--     affected ally gains from beneficial effects; a buff, not accuracy-gated.
insert into tags (name, description, bypasses_accuracy_check, is_debuff)
values (
  'Fervor',
  'Places a [Fervor] buff that increases the amount of Turn Meter the affected ally gains from beneficial effects. A buff (not a debuff); magnitude/placement come from the in-game Index.',
  false, false
)
on conflict (name) do nothing;

-- (3) Glorious Pallas: Ally Attack (A1) + Fervor (A2), inserted APPROVED.
insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by, proposed_at, approved_by, approved_at, ascension_required)
select ch.id, t.id, 'approved', 'in_game_index', v.note, 'in-game-index-video', now(), 'mike-review-2026-07-08', now(), 0
from (values
  ('Ally Attack',
   'A1 Spear of Serenity: attacks 1 enemy together with 1 random ally from the Argonites Faction (the ally uses their default skill). Verbatim in-game Index text, Level 1, captured 2026-07-08.'),
  ('Fervor',
   'A2 Gift of Thalass (cd 5t): places a [Fervor] buff on ALL allies 2t (alongside Cleanse + Block Debuffs). Verbatim in-game Index text, Level 1, captured 2026-07-08.')
) as v(tag, note)
join champions ch on ch.game_id = 'raid_shadow_legends' and ch.name = 'Glorious Pallas'
join tags t on t.name = v.tag
where not exists (
  select 1 from champion_tags x where x.champion_id = ch.id and x.tag_id = t.id
);

-- (4) Michelangelo: Ally Attack (passive turtle-join), inserted PROPOSED (matches his
--     other seeds/46 tags awaiting review).
insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by, proposed_at, ascension_required)
select ch.id, t.id, 'proposed', 'in_game_index',
       'Passive Party Dude: whenever Michelangelo attacks, ally Leonardo/Donatello/Michelangelo/Raphael join the attack (TMNT-set synergy). Verbatim in-game Index text (seed 46 provenance), captured 2026-07-07.',
       'in-game-index-video', now(), 0
from champions ch
join tags t on t.name = 'Ally Attack'
where ch.game_id = 'raid_shadow_legends' and ch.name = 'Michelangelo'
  and not exists (
    select 1 from champion_tags x where x.champion_id = ch.id and x.tag_id = t.id
  );

-- (5) Approve Glorious Pallas's nine seed-56 tags (proposed -> approved).
update champion_tags
   set status = 'approved', approved_by = 'mike-review-2026-07-08', approved_at = now()
 where status = 'proposed'
   and champion_id = (select id from champions where name = 'Glorious Pallas' and game_id = 'raid_shadow_legends')
   and tag_id in (
     select id from tags where name in (
       'Healer', 'Cleanse', 'Block Debuffs', 'Revive', 'Increase Speed',
       'Strengthen', 'Shield', 'Increase Turn Meter', 'RES Aura'
     )
   );
