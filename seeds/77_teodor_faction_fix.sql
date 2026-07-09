-- ============================================================================
-- 77 — Fix Teodor the Savant faction 'High Elves' -> 'Knights Revenant'.
--
-- Held faction conflict (master 'Knight Revenant' / DB 'High Elves'). AyumiLove
-- list (2026-07-09) corroborated Knights Revenant; user confirmed 2026-07-09.
-- Live/DB had 'High Elves' (the error). DB champion name is 'Teodor the Savant'.
-- Idempotent.
-- ============================================================================
update champions
set faction = 'Knights Revenant'
where game_id = 'raid_shadow_legends' and name = 'Teodor the Savant'
  and faction <> 'Knights Revenant';
