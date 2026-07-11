-- ============================================================================
-- 106 — Delete stale 'Bloatwraith' champion. Not a real champion (confirmed
-- 2026-07-11); was removed from the master worksheet earlier but lingered in the
-- live champions table (distinct from the real 'Drowned Bloatwraith'). Its single
-- proposed 'Decrease Defense' tag cascade-deletes; no skills/auras/user_champions
-- reference it. Idempotent.
-- ============================================================================
delete from champions
where game_id = 'raid_shadow_legends' and name = 'Bloatwraith';
