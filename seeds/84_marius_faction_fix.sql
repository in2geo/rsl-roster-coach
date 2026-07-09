-- ============================================================================
-- 84 — Fix Marius the Gallant faction 'Sylvan Watchers' -> 'Skinwalkers'.
--
-- CONFLICTS.md faction conflict (master 'Skinwalkers' / DB 'Sylvan Watchers').
-- Resolved by in-game Index screenshot 2026-07-09 (Lvl 60, magenta 6-star,
-- Legendary, role Defense): faction reads SKINWALKERS. Master worksheet
-- (C000732) already had Skinwalkers; live DB had Sylvan Watchers (the error).
-- Rarity (Legendary), affinity (Void), role (Defense) already agree — not
-- touched. DB name is 'Marius the Gallant'. Idempotent.
-- ============================================================================
update champions
set faction = 'Skinwalkers'
where game_id = 'raid_shadow_legends' and name = 'Marius the Gallant'
  and faction <> 'Skinwalkers';
