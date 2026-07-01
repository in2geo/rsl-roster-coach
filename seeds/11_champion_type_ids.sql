-- ============================================================================
-- Champion type_id link + data corrections.
-- type_id = the game-global champion baseTypeId (stable across copies/ascension;
-- the per-copy typeId is baseTypeId + a 0-9 copy index). Sourced from Gestal
-- roster exports (DonCobb07 + Don$Gnut). Run AFTER
-- migrations/2026-06-30_champion_type_id.sql.
--
-- (0) DATA CORRECTION (human-confirmed via in-game screenshot): DB "Narma" was
--     mis-seeded (truncated name + wrong affinity Void). It is baseTypeId 5350 =
--     Narma the Returned (Legendary/Magic/Support/Knights Revenant). Runs first so
--     the row is exact-name matched in step (2) on a fresh DB.
-- (1) reset type_id (idempotent re-runs).
-- (2) 48 exact-name matches (baseTypeId; RSL base names are unique).
-- (3) Verified epithet aliases (identity confirmed by affinity+rarity):
--     Wyrennon the Silken -> DB "Wyrennon" (7660); Glorious Pallas -> DB "Pallas" (10390).
--
-- NOT LINKED (same mis-seed signature as Narma, awaiting in-game confirmation):
--   Longsword Torrux 8340 (export Spirit/Defense; DB "Torrux"=Force),
--   Sunken Sentinel 10160 (export Void/Attack; DB "Sentinel"=Spirit).
-- ============================================================================

-- (0) Narma correction
update champions set name='Narma the Returned', affinity='Magic', role='Support', updated_at=now()
 where game_id='raid_shadow_legends' and name='Narma';

-- (1) reset
update champions set type_id = null where game_id = 'raid_shadow_legends';

-- (2) exact-name matches (baseTypeId)
update champions set type_id = 1000 where game_id = 'raid_shadow_legends' and name = 'Rocktooth';
update champions set type_id = 10270 where game_id = 'raid_shadow_legends' and name = 'Ezio Auditore';
update champions set type_id = 10410 where game_id = 'raid_shadow_legends' and name = 'Pelops the Victor';
update champions set type_id = 1050 where game_id = 'raid_shadow_legends' and name = 'Armiger';
update champions set type_id = 1120 where game_id = 'raid_shadow_legends' and name = 'Seeker';
update champions set type_id = 1170 where game_id = 'raid_shadow_legends' and name = 'Saurus';
update champions set type_id = 1200 where game_id = 'raid_shadow_legends' and name = 'Grinner';
update champions set type_id = 1260 where game_id = 'raid_shadow_legends' and name = 'Goremask';
update champions set type_id = 1490 where game_id = 'raid_shadow_legends' and name = 'Elhain';
update champions set type_id = 1500 where game_id = 'raid_shadow_legends' and name = 'Athel';
update champions set type_id = 1510 where game_id = 'raid_shadow_legends' and name = 'Kael';
update champions set type_id = 1630 where game_id = 'raid_shadow_legends' and name = 'Diabolist';
update champions set type_id = 1860 where game_id = 'raid_shadow_legends' and name = 'Halberdier';
update champions set type_id = 2030 where game_id = 'raid_shadow_legends' and name = 'Elder';
update champions set type_id = 2060 where game_id = 'raid_shadow_legends' and name = 'Warpriest';
update champions set type_id = 2220 where game_id = 'raid_shadow_legends' and name = 'Justiciar';
update champions set type_id = 2430 where game_id = 'raid_shadow_legends' and name = 'Totem';
update champions set type_id = 2460 where game_id = 'raid_shadow_legends' and name = 'Maiden';
update champions set type_id = 2660 where game_id = 'raid_shadow_legends' and name = 'Basher';
update champions set type_id = 2670 where game_id = 'raid_shadow_legends' and name = 'Flesh-Tearer';
update champions set type_id = 30 where game_id = 'raid_shadow_legends' and name = 'Apothecary';
update champions set type_id = 3110 where game_id = 'raid_shadow_legends' and name = 'Centurion';
update champions set type_id = 3240 where game_id = 'raid_shadow_legends' and name = 'Jizoh';
update champions set type_id = 330 where game_id = 'raid_shadow_legends' and name = 'Avenger';
update champions set type_id = 3350 where game_id = 'raid_shadow_legends' and name = 'Tormentor';
update champions set type_id = 390 where game_id = 'raid_shadow_legends' and name = 'Heiress';
update champions set type_id = 4010 where game_id = 'raid_shadow_legends' and name = 'High Khatun';
update champions set type_id = 4150 where game_id = 'raid_shadow_legends' and name = 'Grumbler';
update champions set type_id = 4170 where game_id = 'raid_shadow_legends' and name = 'Runic Warder';
update champions set type_id = 430 where game_id = 'raid_shadow_legends' and name = 'Arbalester';
update champions set type_id = 4460 where game_id = 'raid_shadow_legends' and name = 'Staltus Dragonbane';
update champions set type_id = 450 where game_id = 'raid_shadow_legends' and name = 'Valerie';
update champions set type_id = 4940 where game_id = 'raid_shadow_legends' and name = 'Mordecai';
update champions set type_id = 50 where game_id = 'raid_shadow_legends' and name = 'Ranger';
update champions set type_id = 510 where game_id = 'raid_shadow_legends' and name = 'Templar';
update champions set type_id = 5230 where game_id = 'raid_shadow_legends' and name = 'Renouncer';
update champions set type_id = 5300 where game_id = 'raid_shadow_legends' and name = 'Fayne';
update champions set type_id = 5350 where game_id = 'raid_shadow_legends' and name = 'Narma the Returned';
update champions set type_id = 5600 where game_id = 'raid_shadow_legends' and name = 'Uugo';
update champions set type_id = 5660 where game_id = 'raid_shadow_legends' and name = 'Fahrakin the Fat';
update champions set type_id = 5890 where game_id = 'raid_shadow_legends' and name = 'Lifetaker';
update champions set type_id = 610 where game_id = 'raid_shadow_legends' and name = 'Zelotah';
update champions set type_id = 7310 where game_id = 'raid_shadow_legends' and name = 'Tagoar';
update champions set type_id = 750 where game_id = 'raid_shadow_legends' and name = 'Sorceress';
update champions set type_id = 7950 where game_id = 'raid_shadow_legends' and name = 'Criodan the Blue';
update champions set type_id = 8010 where game_id = 'raid_shadow_legends' and name = 'Gnut';
update champions set type_id = 820 where game_id = 'raid_shadow_legends' and name = 'Warmaiden';
update champions set type_id = 9330 where game_id = 'raid_shadow_legends' and name = 'Skeletor';

-- (3) verified epithet aliases
update champions set type_id = 7660  where game_id = 'raid_shadow_legends' and name = 'Wyrennon';
update champions set type_id = 10390 where game_id = 'raid_shadow_legends' and name = 'Pallas';
