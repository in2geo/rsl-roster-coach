-- ============================================================================
-- 85 — Fix Quargan the Crowned rarity 'Rare' -> 'Epic'.
--
-- CONFLICTS.md rarity conflict (master 'Epic' / DB 'Rare'). Resolved by in-game
-- Index screenshot 2026-07-09 (Lvl 60, magenta 6-star, role Support): card
-- reads EPIC. Master worksheet (C000457) already had Epic; live DB had Rare
-- (the error). Faction (Lizardmen), affinity (Spirit), role (Support) all
-- already agree — not touched. DB name is 'Quargan the Crowned'. Idempotent.
-- ============================================================================
update champions
set rarity = 'Epic'
where game_id = 'raid_shadow_legends' and name = 'Quargan the Crowned'
  and rarity <> 'Epic';
