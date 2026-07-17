-- ============================================================================
-- Seed 149 — base-stat backfill #2, from the "Champ List Tizlerio" sheet
--
-- WHY: seed 146 took the gap 513 -> 216 using "Ερμής's Champ Stats", then stalled:
-- that sheet is exhausted (it can fill only 3 more in-scope rows, all name-match
-- misses). The remaining gap is rarity-inverted — 133 Legendary + 20 Mythical —
-- i.e. blind to exactly the champions players field. A NULL base stat is not
-- cosmetic: estimateStats does `(base_hp ?? 0) * lvl * gear` and
-- evaluateThresholds takes the TEAM MINIMUM, so ONE null champion zeroes the
-- whole team (see HANDOFF_2026-07-17 bug #1 — Alice alone pinned Ice Golem to
-- Stage 1 after seed 146 filled the other four).
--
-- FILLS 77. Gap 218 -> 141.
--
-- SOURCE: "Champ List Tizlerio" sheet (Mike-provided, 884 champions, a DIFFERENT
-- 884 from Ερμής's). Stat columns ONLY: HP/ATK/DEF/SPD/C.RATE/C.DMG/RES/ACC.
-- Its TIER and RATING columns are TIER-3 EDITORIAL and are NOT read, per the
-- source hierarchy in CLAUDE.md.
--
-- VALIDATION performed before generating:
--   • Multiple-of-15 rule — base HP in Raid is always a multiple of 15. 881 of
--     the sheet's 884 rows obey it. The 3 that don't are typos and are handled:
--       - Criodan the Blue: sheet reads 178835 (extra digit). OVERRIDDEN to
--         17835 from Ερμής's sheet, which is a multiple of 15 and agrees with
--         Tizlerio on all his other stats.
--         ✅ CONFIRMED TIER-1 (Mike, in-game champion screen, 6* Lvl 60,
--         2026-07-17): HP 17,835 / ATK 1,090 / DEF 1,024 / SPD 99 / C.RATE 15% /
--         C.DMG 50% / RES 30 / ACC 15 — the game client agrees with this row on
--         ALL 8 stats. The multiple-of-15 rule picked the right value out of two
--         disagreeing community sheets; that is now an in-game-validated check,
--         not a heuristic.
--       - Tribuck Colwyn (15095) and Wallmaster Othorion (14690): NOT in this
--         seed — they already have stats, and OUR live values (15195 / 15690)
--         are the multiples of 15. The sheet is wrong there; we are right.
--         ✅ BOTH CONFIRMED TIER-1 (Mike, in-game, 6* Lvl 60, 2026-07-17):
--           Wallmaster Othorion — HP 15,690 / ATK 1,454 / DEF 1,079 / SPD 100 /
--             C.RATE 15% / C.DMG 63% / RES 30 / ACC 10. Sheet's 14690 = typo.
--           Tribuck Colwyn — HP 15,195 / ATK 727 / DEF 1,288 / SPD 102 /
--             C.RATE 15% / C.DMG 50% / RES 30 / ACC 10. Sheet's 15095 = typo.
--         Our live rows are EXACT on all 8 stats for both.
--
-- ▶ THE MULTIPLE-OF-15 RULE IS VALIDATED 3/3. It flagged exactly three rows in
-- 884 and the game client confirmed the correct value in every case (Criodan the
-- Blue, Wallmaster Othorion, Tribuck Colwyn). Base HP in Raid is ALWAYS a
-- multiple of 15 — this is now a verified check, not a heuristic, and it is the
-- cheapest available validator for the 141-champion hand-entry backlog: any HP
-- that is not a multiple of 15 is a typo, catchable with no second source.
--
-- ▶ AND: the 2026-06-24 ChatGPT bulk load is NOT uniformly bad. It is EXACT on
-- all 8 stats for both champions checked here (one Legendary, one Rare), and it
-- beat a community sheet on both. The 19 disputed rows are specific failures, not
-- a rotten corpus — do not "fix" the corpus wholesale on the strength of them.
--
-- ⚠ WHAT THE TYPOS IMPLY FOR THIS SEED (state honestly): the source has a
-- demonstrated ~3-in-884 HP error rate, and the multiple-of-15 rule only catches
-- HP errors that break the grid. A transposed HP that still lands on a multiple
-- of 15, or ANY typo in ATK/DEF/SPD/RES/ACC, would pass every check here
-- undetected. These 77 rows are Tier-2 community data, not verified game truth.
-- They are a large improvement over NULL (which the engine reads as 0 and which
-- zeroes an entire team), not a substitute for the in-game Index.
--   • Agreement — HP matches our existing rows on 589/608 overlaps (96.9%).
--   • Plausibility bands on HP/ATK/DEF/SPD/crit: no other row flagged.
--
-- CRIT ENCODING: written as PERCENT (15 / 63), matching seed 146 and what
-- estimate-stats.js consumes (`(base_crit_rate ?? 15) + gear.crate*100`,
-- documented "crit in percent"). The sheet stores fractions (0.15/0.63); values
-- here are x100. NOTE: these rows currently hold a DEFAULT 15/50 for every
-- champion — the sheet supplies real per-champion values (e.g. Balar 13, Arashi
-- 63), so this is a fill, not a no-op.
-- ⚠ The separate pre-existing crit bug is NOT fixed here: ~507 rows still store
-- crit as FRACTIONS (0.15), so the engine reads 0.15% crit for them. Own seed.
--
-- NOT FILLED (deliberate):
--   • Gracchos Turn Drake — duplicate champion row (dedup first)
--   • Gracchos Turn-drake — duplicate champion row (dedup first)
--   • Knight Errant — Uncommon, out of scope (Rare+ only)
--
-- FILL-ONLY, NO OVERWRITES: every statement is guarded `and base_hp is null`, so
-- this cannot touch existing rows — including the 19 disputed values (Kael,
-- Elhain, Coldheart, Uugo…) where this sheet, Ερμής's sheet, raid.guide AND the
-- game client all disagree with us. That remains a deliberate separate decision.
-- ⚠ CAVEAT on that corroboration: both community sheets have exactly 884 stat
-- rows. If they share an upstream source, the agreement is one source counted
-- twice. Treat the disputed-row case as strengthened, NOT settled.
-- REPLAY-SAFE: re-running is a no-op once base_hp is set.
-- ============================================================================

-- Admiral Blacktusk (Legendary)
update champions set base_hp=19320, base_atk=826, base_def=1376, base_spd=100, base_crit_rate=15, base_crit_dmg=50, base_res=50, base_acc=0
where id='ccb6bf0b-43f0-4bab-98f9-627ea623749e' and base_hp is null;

-- Amoch (Legendary)
update champions set base_hp=21645, base_atk=870, base_def=1266, base_spd=100, base_crit_rate=15, base_crit_dmg=50, base_res=40, base_acc=20
where id='4072aeb4-ce7a-493c-9b70-8b0852039def' and base_hp is null;

-- April (Legendary)
update champions set base_hp=19320, base_atk=1046, base_def=1244, base_spd=108, base_crit_rate=15, base_crit_dmg=50, base_res=30, base_acc=20
where id='6472cba7-9c28-4675-ae45-e576657488f0' and base_hp is null;

-- Aragaz (Legendary)
update champions set base_hp=22305, base_atk=881, base_def=1211, base_spd=100, base_crit_rate=15, base_crit_dmg=50, base_res=50, base_acc=0
where id='6a8e59dc-8b62-4783-a7c8-8cb8bffa41e4' and base_hp is null;

-- Arashi (Legendary)
update champions set base_hp=23955, base_atk=793, base_def=1189, base_spd=100, base_crit_rate=15, base_crit_dmg=63, base_res=40, base_acc=0
where id='970391a3-3264-4db0-bcd3-a3eda6610042' and base_hp is null;

-- Aratheia (Legendary)
update champions set base_hp=14700, base_atk=1498, base_def=1101, base_spd=100, base_crit_rate=15, base_crit_dmg=63, base_res=30, base_acc=10
where id='0410728c-0855-46e0-8910-489d38b3f762' and base_hp is null;

-- Arnorn (Legendary)
update champions set base_hp=15855, base_atk=1586, base_def=936, base_spd=103, base_crit_rate=15, base_crit_dmg=63, base_res=30, base_acc=0
where id='20200d61-bc07-4e8b-897d-7de91158df4f' and base_hp is null;

-- Balar (Legendary)
update champions set base_hp=15360, base_atk=1586, base_def=969, base_spd=99, base_crit_rate=13, base_crit_dmg=63, base_res=30, base_acc=10
where id='9881d6d5-a6f9-4000-a5a8-ae3659a805b0' and base_hp is null;

-- Belz (Legendary)
update champions set base_hp=23295, base_atk=749, base_def=1277, base_spd=99, base_crit_rate=15, base_crit_dmg=63, base_res=30, base_acc=10
where id='1b12a64b-f594-49dd-9638-279becbed828' and base_hp is null;

-- Bladechorister Caldor (Legendary)
update champions set base_hp=15855, base_atk=1663, base_def=859, base_spd=103, base_crit_rate=15, base_crit_dmg=63, base_res=30, base_acc=0
where id='6b45498c-3b72-450e-ac9d-76bc873ac411' and base_hp is null;

-- Bowf (Epic)
update champions set base_hp=18660, base_atk=936, base_def=1123, base_spd=99, base_crit_rate=15, base_crit_dmg=50, base_res=30, base_acc=15
where id='1dac52ef-05a3-4942-97a4-fa1539674aac' and base_hp is null;

-- Branch-Arm Lasair (Rare)
update champions set base_hp=17340, base_atk=892, base_def=980, base_spd=95, base_crit_rate=15, base_crit_dmg=50, base_res=40, base_acc=0
where id='9e606a70-8cef-4ce3-b0fe-0557bdf159e8' and base_hp is null;

-- Brewguard Jeroboam (Legendary)
update champions set base_hp=18165, base_atk=870, base_def=1498, base_spd=108, base_crit_rate=15, base_crit_dmg=50, base_res=30, base_acc=20
where id='abd75824-5d35-4428-a061-c2da2903af76' and base_hp is null;

-- Caoilte (Legendary)
update champions set base_hp=15690, base_atk=1553, base_def=980, base_spd=106, base_crit_rate=15, base_crit_dmg=63, base_res=30, base_acc=0
where id='1ea363f6-aff2-455f-8b09-c586bc1be715' and base_hp is null;

-- Chalco (Legendary)
update champions set base_hp=15525, base_atk=1542, base_def=1002, base_spd=99, base_crit_rate=15, base_crit_dmg=63, base_res=30, base_acc=10
where id='41f3ba14-8b2c-4ba5-901f-e7386ee74d95' and base_hp is null;

-- Cheshire (Legendary)
update champions set base_hp=15360, base_atk=1520, base_def=1035, base_spd=101, base_crit_rate=15, base_crit_dmg=63, base_res=30, base_acc=0
where id='c3f8b3da-1832-47d2-bc2e-eea3e8cec1e3' and base_hp is null;

-- Craklin (Legendary)
update champions set base_hp=21480, base_atk=903, base_def=1244, base_spd=99, base_crit_rate=15, base_crit_dmg=50, base_res=40, base_acc=20
where id='c1dc4599-ece6-4273-8d4d-9bf8278d7012' and base_hp is null;

-- Criodan the Blue (Epic)  -- HP from Ερμής sheet; Tizlerio reads 178835 (typo).
-- All 8 stats VERIFIED against an in-game screenshot, 6* Lvl 60 (Mike 2026-07-17). TIER-1.
update champions set base_hp=17835, base_atk=1090, base_def=1024, base_spd=99, base_crit_rate=15, base_crit_dmg=50, base_res=30, base_acc=15
where id='2142125e-bff5-4269-a8c0-5f164eed4b87' and base_hp is null;

-- Dawncaller Sabitha (Epic)
update champions set base_hp=17670, base_atk=837, base_def=1288, base_spd=98, base_crit_rate=15, base_crit_dmg=50, base_res=45, base_acc=0
where id='0465daca-89f5-4f27-9d9e-d8589d3725c7' and base_hp is null;

-- Denid (Rare)
update champions set base_hp=15030, base_atk=804, base_def=1222, base_spd=95, base_crit_rate=15, base_crit_dmg=50, base_res=40, base_acc=0
where id='d3065c2f-f339-4883-b617-b6d3232828f6' and base_hp is null;

-- Dune Herald Zaharis (Legendary)
update champions set base_hp=21480, base_atk=1035, base_def=1112, base_spd=108, base_crit_rate=15, base_crit_dmg=50, base_res=30, base_acc=20
where id='3fd85f24-33c1-46af-bdb9-845dc30b42f2' and base_hp is null;

-- Embrys (Mythical)
update champions set base_hp=22140, base_atk=1101, base_def=1277, base_spd=111, base_crit_rate=15, base_crit_dmg=50, base_res=30, base_acc=20
where id='add0176d-4aeb-49ca-b83e-d7237c280268' and base_hp is null;

-- Esme (Legendary)
update champions set base_hp=18165, base_atk=1090, base_def=1277, base_spd=113, base_crit_rate=15, base_crit_dmg=50, base_res=30, base_acc=10
where id='87592c83-1d73-4978-b18c-225dcc6e49d7' and base_hp is null;

-- Fahrakin the Fat (Epic)
update champions set base_hp=14535, base_atk=1244, base_def=1090, base_spd=100, base_crit_rate=15, base_crit_dmg=60, base_res=30, base_acc=0
where id='6dc7d742-fded-4111-8a7e-5e27d61fbc3e' and base_hp is null;

-- First Ax Tuskkor (Legendary)
update champions set base_hp=15030, base_atk=1476, base_def=1101, base_spd=99, base_crit_rate=15, base_crit_dmg=63, base_res=30, base_acc=0
where id='ab9bad3d-2b0c-4c2b-8b8d-50252f23a4a9' and base_hp is null;

-- Fjorad (Mythical)
update champions set base_hp=22635, base_atk=925, base_def=1421, base_spd=100, base_crit_rate=15, base_crit_dmg=63, base_res=50, base_acc=0
where id='917262ec-3487-440e-b2d9-9984d3e2b9a9' and base_hp is null;

-- Galleus (Mythical)
update champions set base_hp=22140, base_atk=881, base_def=1498, base_spd=101, base_crit_rate=15, base_crit_dmg=50, base_res=48, base_acc=20
where id='59b72f01-3c50-4ae7-b7a2-638680a12d49' and base_hp is null;

-- Ghomm (Epic)
update champions set base_hp=17175, base_atk=1167, base_def=991, base_spd=104, base_crit_rate=15, base_crit_dmg=50, base_res=30, base_acc=15
where id='e63b3146-26ea-4456-b3e1-1a95b474bd80' and base_hp is null;

-- Glensage Cithrel (Rare)
update champions set base_hp=15855, base_atk=1057, base_def=914, base_spd=102, base_crit_rate=15, base_crit_dmg=50, base_res=30, base_acc=10
where id='09e530d2-2652-41c9-9b0d-5e2e828b779a' and base_hp is null;

-- Gnarox (Epic)
update champions set base_hp=17505, base_atk=749, base_def=1387, base_spd=100, base_crit_rate=15, base_crit_dmg=50, base_res=30, base_acc=15
where id='a0277afc-509b-46f7-be27-5557b662b287' and base_hp is null;

-- Gretel (Legendary)
update champions set base_hp=15525, base_atk=1564, base_def=980, base_spd=100, base_crit_rate=15, base_crit_dmg=63, base_res=30, base_acc=10
where id='ee85b3a9-dbc7-49c5-a6d5-73d12cce0d21' and base_hp is null;

-- Hansel (Legendary)
update champions set base_hp=15030, base_atk=1663, base_def=914, base_spd=100, base_crit_rate=15, base_crit_dmg=63, base_res=30, base_acc=10
where id='121d3a4e-2a36-4ffb-b13e-0408035ce441' and base_hp is null;

-- He-Man (Legendary)
update champions set base_hp=16845, base_atk=1465, base_def=991, base_spd=104, base_crit_rate=15, base_crit_dmg=63, base_res=30, base_acc=0
where id='225be4df-4161-4438-9059-9c560d4ec2bc' and base_hp is null;

-- Hidestitcher Boorn (Rare)
update champions set base_hp=17340, base_atk=815, base_def=1057, base_spd=103, base_crit_rate=15, base_crit_dmg=50, base_res=30, base_acc=0
where id='d24cb41a-9ef4-4a8a-87cd-9f29c204eff5' and base_hp is null;

-- High Keeper Prysma (Legendary)
update champions set base_hp=21810, base_atk=936, base_def=1189, base_spd=103, base_crit_rate=15, base_crit_dmg=50, base_res=30, base_acc=20
where id='00ad5079-3462-457d-b894-c67efaaf898d' and base_hp is null;

-- Iudex Artor (Legendary)
update champions set base_hp=19980, base_atk=980, base_def=1266, base_spd=102, base_crit_rate=15, base_crit_dmg=50, base_res=50, base_acc=0
where id='d1d50cc9-2da8-4138-bad6-7e05c2a536f9' and base_hp is null;

-- Kawn (Legendary)
update champions set base_hp=18495, base_atk=881, base_def=1465, base_spd=100, base_crit_rate=15, base_crit_dmg=63, base_res=40, base_acc=0
where id='abbe86fa-5ffb-4260-97a2-0c850a5278a4' and base_hp is null;

-- Kerin (Legendary)
update champions set base_hp=22140, base_atk=837, base_def=1266, base_spd=109, base_crit_rate=15, base_crit_dmg=50, base_res=30, base_acc=20
where id='a08392cf-e4bd-4f2e-ba5c-e14f38f9fdd5' and base_hp is null;

-- Knave (Legendary)
update champions set base_hp=22470, base_atk=892, base_def=1189, base_spd=98, base_crit_rate=15, base_crit_dmg=50, base_res=40, base_acc=20
where id='9755ef8d-6bfe-4083-824c-a9618a282689' and base_hp is null;

-- Krokhad the Throatripper (Legendary)
update champions set base_hp=14700, base_atk=1729, base_def=870, base_spd=100, base_crit_rate=15, base_crit_dmg=63, base_res=30, base_acc=0
where id='20e18b74-2edb-403e-8e4f-5899d868f651' and base_hp is null;

-- Kurosa (Mythical)
update champions set base_hp=19155, base_atk=1509, base_def=1068, base_spd=110, base_crit_rate=15, base_crit_dmg=50, base_res=50, base_acc=0
where id='cb2ee945-37d2-42d8-98de-fba6b053f626' and base_hp is null;

-- Lady Noelle (Legendary)
update champions set base_hp=20805, base_atk=892, base_def=1299, base_spd=105, base_crit_rate=15, base_crit_dmg=50, base_res=30, base_acc=20
where id='90ce7b2d-a332-4472-895e-1b46b4893884' and base_hp is null;

-- Leminisi (Legendary)
update champions set base_hp=16515, base_atk=1520, base_def=958, base_spd=99, base_crit_rate=15, base_crit_dmg=63, base_res=30, base_acc=10
where id='07f240e5-739c-4dbd-af04-77abc07b3ccf' and base_hp is null;

-- Lightward Siendra (Epic)
update champions set base_hp=15690, base_atk=1509, base_def=749, base_spd=95, base_crit_rate=15, base_crit_dmg=60, base_res=30, base_acc=0
where id='141546c8-6658-46f5-80f1-6f128a5afe5b' and base_hp is null;

-- Lord Entertainer Fabian (Legendary)
update champions set base_hp=18990, base_atk=1211, base_def=1101, base_spd=109, base_crit_rate=15, base_crit_dmg=50, base_res=30, base_acc=20
where id='adb6e11c-4e72-49ab-b096-91904ae9ecb9' and base_hp is null;

-- Losan KLeth (Legendary)
update champions set base_hp=18825, base_atk=727, base_def=1597, base_spd=97, base_crit_rate=15, base_crit_dmg=50, base_res=40, base_acc=20
where id='597f0699-f70e-4842-9398-959fcbef5a38' and base_hp is null;

-- Lysanthir (Legendary)
update champions set base_hp=18000, base_atk=837, base_def=1542, base_spd=103, base_crit_rate=15, base_crit_dmg=63, base_res=30, base_acc=10
where id='ac7a424e-20f2-4d26-aeb6-021e0f38ac22' and base_hp is null;

-- Mad Hatter (Legendary)
update champions set base_hp=23295, base_atk=859, base_def=1167, base_spd=108, base_crit_rate=15, base_crit_dmg=50, base_res=30, base_acc=20
where id='67ca14b7-f3c0-48a5-bbf7-2f0110eac8f2' and base_hp is null;

-- MaShalled (Legendary)
update champions set base_hp=17835, base_atk=1454, base_def=936, base_spd=103, base_crit_rate=15, base_crit_dmg=63, base_res=30, base_acc=0
where id='300db846-f7c2-471d-9565-9eaf4a9aaba8' and base_hp is null;

-- Matriarch Zarguna (Legendary)
update champions set base_hp=22800, base_atk=969, base_def=1090, base_spd=104, base_crit_rate=15, base_crit_dmg=50, base_res=50, base_acc=0
where id='843385e2-f70d-4590-a2b1-ce5238a0602c' and base_hp is null;

-- Modo (Legendary)
update champions set base_hp=15360, base_atk=1498, base_def=1057, base_spd=99, base_crit_rate=15, base_crit_dmg=63, base_res=30, base_acc=10
where id='67df5f9d-a3aa-422c-95d5-a1178d152948' and base_hp is null;

-- Nell (Mythical)
update champions set base_hp=23130, base_atk=1013, base_def=1299, base_spd=112, base_crit_rate=15, base_crit_dmg=50, base_res=30, base_acc=20
where id='f12dc40e-98fb-4c94-ae5a-9fa00a2d71c2' and base_hp is null;

-- Niamhe (Legendary)
update champions set base_hp=18990, base_atk=782, base_def=1531, base_spd=98, base_crit_rate=15, base_crit_dmg=50, base_res=50, base_acc=0
where id='b09dce4f-93aa-4d0a-aad0-3bc412355306' and base_hp is null;

-- Onryo Ieyasu (Legendary)
update champions set base_hp=14205, base_atk=1630, base_def=1002, base_spd=103, base_crit_rate=15, base_crit_dmg=64, base_res=30, base_acc=0
where id='7930353a-a4e3-4006-8561-ad71df807c55' and base_hp is null;

-- Osgrun (Legendary)
update champions set base_hp=19815, base_atk=1156, base_def=1101, base_spd=109, base_crit_rate=15, base_crit_dmg=50, base_res=30, base_acc=20
where id='653e3736-92c2-40fe-97f7-5b93a91ed2c0' and base_hp is null;

-- Pheidi (Legendary)
update champions set base_hp=19320, base_atk=958, base_def=1090, base_spd=105, base_crit_rate=15, base_crit_dmg=50, base_res=30, base_acc=20
where id='3f1c85f4-d9cc-4d32-9ca8-41400b4b7f36' and base_hp is null;

-- Polara Fireheart (Mythical)
update champions set base_hp=15195, base_atk=1509, base_def=1332, base_spd=104, base_crit_rate=15, base_crit_dmg=63, base_res=30, base_acc=0
where id='0df56686-0cfb-43f3-979d-83a329522086' and base_hp is null;

-- Praeva (Legendary)
update champions set base_hp=21975, base_atk=947, base_def=1167, base_spd=110, base_crit_rate=15, base_crit_dmg=50, base_res=40, base_acc=0
where id='d844a25e-4f1c-474f-a6bd-aa8ea791e2a5' and base_hp is null;

-- Queen of Hearts (Legendary)
update champions set base_hp=17835, base_atk=1189, base_def=1200, base_spd=110, base_crit_rate=15, base_crit_dmg=50, base_res=30, base_acc=20
where id='5eeb16e5-9431-4419-86b2-d11a849c8926' and base_hp is null;

-- Raphael (Legendary)
update champions set base_hp=16515, base_atk=1498, base_def=980, base_spd=100, base_crit_rate=15, base_crit_dmg=63, base_res=30, base_acc=0
where id='8228db47-444a-498e-92c9-74e7f145bd7e' and base_hp is null;

-- Redcloak Taneko (Rare)
update champions set base_hp=16350, base_atk=749, base_def=1189, base_spd=98, base_crit_rate=15, base_crit_dmg=50, base_res=30, base_acc=10
where id='76a2e8db-7f4d-4717-916b-2e80ea8a011a' and base_hp is null;

-- Shredder (Legendary)
update champions set base_hp=23130, base_atk=914, base_def=1123, base_spd=103, base_crit_rate=15, base_crit_dmg=63, base_res=30, base_acc=0
where id='cd61585c-ce1f-41db-994d-9ef733206199' and base_hp is null;

-- Signy (Epic)
update champions set base_hp=20640, base_atk=747, base_def=1178, base_spd=97, base_crit_rate=15, base_crit_dmg=50, base_res=45, base_acc=0
where id='d3f6c7db-1f11-4769-800d-399dce1be5a8' and base_hp is null;

-- Skeletor (Legendary)
update champions set base_hp=21480, base_atk=1046, base_def=1101, base_spd=103, base_crit_rate=15, base_crit_dmg=50, base_res=30, base_acc=20
where id='8726c713-dff4-497b-955a-bd11e0d12790' and base_hp is null;

-- Skorid (Legendary)
update champions set base_hp=16515, base_atk=1498, base_def=980, base_spd=102, base_crit_rate=15, base_crit_dmg=63, base_res=30, base_acc=10
where id='9f835dbc-9f9b-41bf-b67a-ff2dffdba335' and base_hp is null;

-- Stokk (Legendary)
update champions set base_hp=20145, base_atk=1079, base_def=1156, base_spd=103, base_crit_rate=15, base_crit_dmg=50, base_res=30, base_acc=20
where id='dc1a1273-88b7-43e6-9fb7-64f9f17620ed' and base_hp is null;

-- Swarmspeaker Zyclic (Legendary)
update champions set base_hp=14040, base_atk=1575, base_def=1068, base_spd=101, base_crit_rate=15, base_crit_dmg=63, base_res=30, base_acc=0
where id='12fe8718-e769-40a4-bb92-3f2c69a51324' and base_hp is null;

-- Tetsuya (Legendary)
update champions set base_hp=15525, base_atk=1696, base_def=848, base_spd=106, base_crit_rate=15, base_crit_dmg=63, base_res=30, base_acc=0
where id='7c23ba87-9279-43f1-8af7-168b1ddef64f' and base_hp is null;

-- The Calamitus (Mythical)
update champions set base_hp=14850, base_atk=1553, base_def=1178, base_spd=104, base_crit_rate=15, base_crit_dmg=63, base_res=30, base_acc=20
where id='f6789af3-3a4d-4423-98e8-84101902358c' and base_hp is null;

-- Theodosia (Mythical)
update champions set base_hp=22470, base_atk=925, base_def=1432, base_spd=115, base_crit_rate=15, base_crit_dmg=50, base_res=50, base_acc=0
where id='148af4d8-c73e-43ca-a118-231c47a487c5' and base_hp is null;

-- Tholin Foulbeard (Legendary)
update champions set base_hp=14865, base_atk=1674, base_def=914, base_spd=100, base_crit_rate=15, base_crit_dmg=63, base_res=30, base_acc=0
where id='cd705c45-37b2-4943-9e77-a1d6775a2dc7' and base_hp is null;

-- Titus (Legendary)
update champions set base_hp=18495, base_atk=837, base_def=1509, base_spd=97, base_crit_rate=15, base_crit_dmg=50, base_res=50, base_acc=0
where id='45c27264-e41b-4593-bd03-c60f147bef2a' and base_hp is null;

-- Tribune Herakletes (Legendary)
update champions set base_hp=18660, base_atk=837, base_def=1498, base_spd=95, base_crit_rate=15, base_crit_dmg=63, base_res=40, base_acc=0
where id='6d374e05-a1c6-4225-af82-a33fba40c15a' and base_hp is null;

-- Uzol (Legendary)
update champions set base_hp=15195, base_atk=1498, base_def=1068, base_spd=99, base_crit_rate=15, base_crit_dmg=63, base_res=30, base_acc=0
where id='48249fbe-4ff2-4ff5-8770-b0587316fd88' and base_hp is null;

-- Vulkanos (Legendary)
update champions set base_hp=18330, base_atk=936, base_def=1421, base_spd=97, base_crit_rate=15, base_crit_dmg=63, base_res=30, base_acc=0
where id='848fb652-fb54-4912-b71a-0abce5779e63' and base_hp is null;

-- Wysteri (Epic)
update champions set base_hp=16515, base_atk=1310, base_def=892, base_spd=99, base_crit_rate=15, base_crit_dmg=60, base_res=30, base_acc=0
where id='5cd57de6-0ef0-486f-89a7-7d264608638c' and base_hp is null;

-- Yuzan (Epic)
update champions set base_hp=19980, base_atk=705, base_def=1266, base_spd=97, base_crit_rate=15, base_crit_dmg=50, base_res=45, base_acc=0
where id='d0cdcc94-adac-4167-ac16-11ad7c14187e' and base_hp is null;
