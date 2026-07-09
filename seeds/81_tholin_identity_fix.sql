-- ============================================================================
-- 81 — Fix Tholin Foulbeard identity: rarity 'Epic' -> 'Legendary' and
-- faction 'Skinwalkers' -> 'Dwarves'.
--
-- CONFLICTS.md double conflict (faction Dwarves/Skinwalkers; rarity
-- Legendary/Epic). Resolved by in-game Index screenshot 2026-07-09 (Lvl 60,
-- magenta 6-star, role Attack): card reads LEGENDARY and faction DWARVES.
-- Master worksheet (C000851) already had Legendary/Dwarves/Force/Attack; the
-- live DB was wrong on both fields (had Epic/Skinwalkers). Affinity (Force) and
-- role (Attack) already agree — not touched. DB name is 'Tholin Foulbeard'.
-- Idempotent.
-- ============================================================================
update champions
set rarity  = 'Legendary',
    faction = 'Dwarves'
where game_id = 'raid_shadow_legends' and name = 'Tholin Foulbeard'
  and (rarity <> 'Legendary' or faction <> 'Dwarves');
