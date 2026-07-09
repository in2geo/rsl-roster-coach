-- ============================================================================
-- 80 — Fix Drexthar Bloodtwin identity: rarity 'Epic' -> 'Legendary' and
-- faction 'Undead Hordes' -> 'Demonspawn'.
--
-- CONFLICTS.md double conflict (faction Demonspawn/Undead Hordes; rarity
-- Legendary/Epic). Resolved by in-game Index screenshot 2026-07-09 (Lvl 60,
-- magenta 6-star, role Defense): card reads LEGENDARY and faction DEMONSPAWN.
-- Master worksheet (C000604) already had Legendary/Demonspawn/Force/Defense;
-- the live DB was wrong on both fields (had Epic/Undead Hordes). Affinity
-- (Force) and role (Defense) already agree — not touched. DB name is
-- 'Drexthar Bloodtwin'. Idempotent.
-- ============================================================================
update champions
set rarity  = 'Legendary',
    faction = 'Demonspawn'
where game_id = 'raid_shadow_legends' and name = 'Drexthar Bloodtwin'
  and (rarity <> 'Legendary' or faction <> 'Demonspawn');
