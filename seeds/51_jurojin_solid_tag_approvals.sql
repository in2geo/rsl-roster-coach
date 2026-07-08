-- ============================================================================
-- Seed 51 — Approve Jurojin's four SOLID tags
-- Human review outcome (Mike, 2026-07-08): the four proposed tags seeded in
-- seeds/50 from Jurojin's verbatim in-game skill text are approved. Promotes
-- proposed -> approved: Decrease Attack (A1), Provoke (A2), Shield (A2, self-only),
-- HP Aura. Mirrors the seeds/49 approval pattern. (The seed-15 Unkillable/Block
-- Damage mis-tags were already rejected in seeds/50 — a correction, not affected
-- here.)
-- ============================================================================

update champion_tags
   set status = 'approved', approved_by = 'mike-review-2026-07-08', approved_at = now()
 where status = 'proposed'
   and champion_id = (select id from champions where name = 'Jurojin' and game_id = 'raid_shadow_legends')
   and tag_id in (
     select id from tags where name in ('Decrease Attack', 'Provoke', 'Shield', 'HP Aura')
   );
