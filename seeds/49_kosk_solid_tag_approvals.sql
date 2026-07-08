-- ============================================================================
-- Seed 49 — Approve Kosk of Two Skins' four remaining SOLID tags
-- Human review outcome (Mike, 2026-07-08): the four proposed tags seeded in
-- seeds/47 from Kosk's verbatim in-game skill text are approved. (ACC Aura and
-- Debuff Spread were already approved in seeds/48.) Promotes proposed -> approved:
--   Poison, Poison Sensitivity (A2 They Will Regret...), Decrease Attack,
--   AoE Damage (A3 Toxic Vitriol). Mirrors the seeds/22 approval pattern.
-- ============================================================================

update champion_tags
   set status = 'approved', approved_by = 'mike-review-2026-07-08', approved_at = now()
 where status = 'proposed'
   and champion_id = (select id from champions where name = 'Kosk of Two Skins' and game_id = 'raid_shadow_legends')
   and tag_id in (
     select id from tags where name in ('Poison', 'Poison Sensitivity', 'Decrease Attack', 'AoE Damage')
   );
