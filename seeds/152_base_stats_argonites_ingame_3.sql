-- ============================================================================
-- Seed 152 — Argonites base stats from IN-GAME SCREENSHOTS, batch 3 (TIER-1)
--
-- SOURCE: Mike's in-game champion screens, 6* Lvl 60, 2026-07-17. Tier-1.
-- FILLS 2 — this COMPLETES the Argonites confirmed-real gaps (15/15 across
-- seeds 150-152). Argonites was the largest block of the post-149 backlog.
--
-- VALIDATION: HP multiple-of-15 enforced by the generator (throws on failure);
-- exactly-one-row assertion per name. CRIT written as PERCENT.
--
-- ⚠ THIRD FREE CONFIRMATION, AND A NEW BUG CLASS: "Sunken Sentinel" (Rare,
-- Argonites) was screenshotted and already had stats. HP/ATK/DEF/SPD/RES/ACC all
-- match EXACTLY (12390/1277/925/95/30/0). But:
--     base_crit_dmg: live 0.5   in-game 57%
-- That is not only the fraction-encoding bug — 0.5 scaled x100 is 50, NOT 57.
-- The VALUE is wrong independently of the encoding. 57% is the norm for a Rare
-- Attack champion (Bladerider's card reads 57% too), so this is a data error, not
-- a game quirk.
--
-- CONSEQUENCE FOR THE PLANNED CRIT-NORMALISATION SEED: a blanket x100 is still
-- the right mechanical fix — the 506 fraction rows DO carry real variance
-- (crit_dmg 0.5 x295 / 0.57 x84 / 0.6 x77 / 0.63 x50), so x100 preserves them and
-- does not flatten to a default. BUT x100 will NOT catch value errors like this
-- one: Sunken Sentinel would become a confident, well-encoded 50 that is still
-- wrong. Normalisation and value-correction are two different jobs. Not fixed
-- here — this seed is fill-only and Sunken Sentinel's base_hp is already set, so
-- the guard skips him by design.
-- ============================================================================

-- Crimson Pegason (Rare, Argonites)
update champions set base_hp=19320, base_atk=727, base_def=1013, base_spd=96, base_crit_rate=15, base_crit_dmg=50, base_res=30, base_acc=10
where id='e0146a87-d355-4677-ac3b-4e4f4cc2459f' and base_hp is null;

-- Acolyte of the Slither (Rare, Argonites)
update champions set base_hp=17835, base_atk=848, base_def=991, base_spd=107, base_crit_rate=15, base_crit_dmg=50, base_res=30, base_acc=0
where id='836c01aa-8a28-4ba6-b8bf-faa012373762' and base_hp is null;
