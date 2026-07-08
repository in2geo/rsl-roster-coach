-- ============================================================================
-- Seed 55 — Approve Ruella's seven SOLID tags
-- Human review outcome (Mike, 2026-07-08): the tags seeded in seeds/54 from
-- Ruella's verbatim in-game skill text are approved. Promotes proposed ->
-- approved: Decrease Turn Meter, Decrease Defense, Weaken, Decrease Speed (A1/A2),
-- Increase Turn Meter, Increase C.Rate (A3 Timed Offensive, ascension_required=3),
-- and ACC Aura. Mirrors the seeds/49/51 approval pattern. The ascension_required
-- values set in seeds/54 are preserved (this only flips status).
-- ============================================================================

update champion_tags
   set status = 'approved', approved_by = 'mike-review-2026-07-08', approved_at = now()
 where status = 'proposed'
   and champion_id = (select id from champions where name = 'Ruella' and game_id = 'raid_shadow_legends')
   and tag_id in (
     select id from tags where name in (
       'Decrease Turn Meter', 'Decrease Defense', 'Weaken', 'Decrease Speed',
       'Increase Turn Meter', 'Increase C.Rate', 'ACC Aura'
     )
   );
