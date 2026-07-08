-- ============================================================================
-- 71 — Fix Gaius (the Gleeful) affinity Force -> Magic.
--
-- The one champion where raid.guide (Magic) disagreed with BOTH the Champions
-- tab and the DB (Force) — held out of seed 70. In-game Index screenshot
-- (2026-07-07, Knights Revenant / Legendary / Attack, blue Magic icon) confirms
-- MAGIC. So raid.guide was right and the Champions tab was wrong here (its single
-- miss, 676/677). DB champion name is 'Gaius' (Champions tab uses 'Gaius the
-- Gleeful'). Idempotent.
-- ============================================================================
update champions
set affinity = 'Magic'
where game_id = 'raid_shadow_legends' and name = 'Gaius'
  and faction = 'Knights Revenant' and affinity <> 'Magic';
