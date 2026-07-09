-- ============================================================================
-- 83 — Fix Gnishak Verminlord faction 'Ogryn Tribes' -> 'Skinwalkers'.
--
-- CONFLICTS.md faction conflict (master 'Skinwalkers' / DB 'Ogryn Tribes').
-- Resolved by in-game Index screenshot 2026-07-09 (Lvl 60, magenta 6-star,
-- Legendary, role Attack): faction reads SKINWALKERS. Master worksheet
-- (C000641) already had Skinwalkers; live DB had Ogryn Tribes (the error).
-- Rarity (Legendary), affinity (Force), role (Attack) already agree — not
-- touched. DB name is 'Gnishak Verminlord'. Idempotent.
-- ============================================================================
update champions
set faction = 'Skinwalkers'
where game_id = 'raid_shadow_legends' and name = 'Gnishak Verminlord'
  and faction <> 'Skinwalkers';
