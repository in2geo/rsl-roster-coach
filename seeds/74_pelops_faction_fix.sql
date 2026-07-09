-- ============================================================================
-- 74 — Fix Pelops (the Victor) faction 'The Sacred Order' -> 'Argonites'.
--
-- One of the genuine faction conflicts surfaced in the 2026-07-08 consolidation
-- (Champions tab = Argonites, DB/live = The Sacred Order). User confirmed
-- 2026-07-08 that Argonites is canonical. Live `champions` had 'The Sacred Order'
-- (verified read-only). DB champion name is 'Pelops the Victor'. Idempotent.
-- ============================================================================
update champions
set faction = 'Argonites'
where game_id = 'raid_shadow_legends' and name = 'Pelops the Victor'
  and faction <> 'Argonites';
