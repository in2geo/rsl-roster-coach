-- Clan Boss Nightmare damage_calibration — the scalar that turns lib/cb-damage-model.js's
-- nominal %-max-HP source sum into observed damage (absorbs the unpublished boss DEF/mitigation
-- and DoT tick frequency). Fitted from ONE captured Nightmare run (Don$Gnut, 13,281,342 total,
-- rec-time no-turns mode), 2026-07-12 — SOFT; re-fit as more runs accumulate. Other difficulties
-- stay at the 1.0 default (uncalibrated) so the engine surfaces carriers only, not a chest tier,
-- until a run is captured for each. Idempotent.
update clan_boss_stats
set damage_calibration = 0.002024
where difficulty = 'Nightmare';
