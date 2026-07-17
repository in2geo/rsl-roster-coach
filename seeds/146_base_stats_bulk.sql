-- ============================================================================
-- Seed 146 — BULK base-stat backfill (the HP=0 fix)
--
-- WHY: 513 of 1,000 champions had NULL base_hp/atk/def/spd. estimateStats does
-- `(champion.base_hp ?? 0) * lvl * gear`, so those champions estimate to HP 0 —
-- and evaluateThresholds takes the TEAM MINIMUM, so ONE null champion zeroes the
-- whole team. Result: Ice Golem recommended Stage 1 / stats_failing / 40% to an
-- account that clears Stage 20 five times over (`FAIL HP need 5000 team 0`).
-- The gap was rarity-inverted — 73% of Legendaries and 97% of Mythicals blank,
-- i.e. blind to exactly the champions players field.
--
-- FILLS 296 of 513 (58%). The remaining 217 (211 Rare+) stay NULL and are to be
-- added by hand (Mike, 2026-07-16) — mostly the newest Legendaries + Mythicals,
-- which no bulk source has.
--
-- SOURCES (two, both factual game data; NO editorial):
--   • 291 — "Ερμής's Champ Stats [RSL]" sheet (Mike-provided, 884 champions).
--     Base stats only: HP/ATK/DEF/SPD/C.Rate/C.DMG/RES/ACC. Its HH Rating,
--     AL Ranking and letter-grade columns are TIER-3 EDITORIAL and are NOT read.
--     Cross-checks: agrees with our existing 487 rows 96.9% (472/487), and
--     agrees with raid.guide on all 15 disputes.
--   • 5 — Gestal snapshots, 6* L60 FULLY-ASCENDED only (Sun Wukong, Michelangelo,
--     Xenomorph, Ezio Auditore, Donatello — the licensed collab champions the
--     community sheet omits, and GuapoDonni's actual Clan Boss team). This is
--     TIER-1: the game client's own numbers. VERIFIED EXACT against an in-game
--     screenshot — Xenomorph 6*L60 asc-6 reads hp 17670 / atk 1365 / def 1035 /
--     spd 102 / crate 15 / cdmg 63 / res 30 / acc 10, matching Gestal on all 8.
--
-- WHY 6*L60 asc-6 ONLY for Gestal: baseStats is scaled to the champion's CURRENT
-- level/stars and reported at ACTUAL ascension (Gestal's own `ascensionLevel`
-- field is always 0 and useless — real ascension = typeId - baseTypeId). Galek at
-- L1 3* reads hp 2775 vs his true 6*L60 base of 13710. Only fully-ascended L60
-- champions equal the reference these columns store.
--
-- raid.guide is DELIBERATELY NOT USED: after the sheet it adds ZERO unique rows
-- (strict subset). tools/scrape-base-stats.js + output/base-stats-full.sql remain
-- for reference but are superseded here.
--
-- CRIT ENCODING: written as PERCENT (15 / 50), matching what estimate-stats.js
-- consumes (`base_crit_rate ?? 15) + gear.crate*100`, documented "crit in
-- percent"). ⚠ SEPARATE PRE-EXISTING BUG, NOT FIXED HERE: the 487 rows that
-- already had stats store crit as FRACTIONS (0.15 / 0.50), so the engine reads
-- 0.15% crit for every one of them. 487 fraction vs 513 percent — the same split
-- as the HP gap. Needs its own normalising seed.
--
-- FILL-ONLY, NO OVERWRITES: every statement is guarded `and base_hp is null`, so
-- this cannot touch the 487 existing rows — including the 15 disputed values
-- (Kael 15690 vs 13710, Elhain, Coldheart) where the sheet, raid.guide AND the
-- game client all disagree with us. Those are a deliberate separate decision.
-- REPLAY-SAFE: re-running is a no-op once base_hp is set.
-- ============================================================================

-- Siphi
update champions set base_hp=21480, base_atk=859, base_def=1288, base_spd=114, base_crit_rate=15, base_crit_dmg=50, base_res=40, base_acc=0
where id='30ad1b2c-406a-48b3-b705-efe304a07eca' and base_hp is null;

-- Klodd
update champions set base_hp=21645, base_atk=815, base_def=1046, base_spd=110, base_crit_rate=15, base_crit_dmg=50, base_res=30, base_acc=0
where id='00ab27f0-a069-4301-b5c1-ac7527849eac' and base_hp is null;

-- Lydia
update champions set base_hp=20805, base_atk=903, base_def=1288, base_spd=110, base_crit_rate=15, base_crit_dmg=50, base_res=40, base_acc=0
where id='9c002021-9efd-4a38-9e6c-837df11b8bfe' and base_hp is null;

-- Lanakis the Chosen
update champions set base_hp=20145, base_atk=1255, base_def=980, base_spd=108, base_crit_rate=15, base_crit_dmg=50, base_res=30, base_acc=0
where id='6421ae45-0c1b-4cf8-af69-c8f53905544c' and base_hp is null;

-- Ursuga
update champions set base_hp=23460, base_atk=485, base_def=1531, base_spd=108, base_crit_rate=15, base_crit_dmg=50, base_res=50, base_acc=0
where id='fd71c02b-b94e-4ebf-99ee-9a117e847d3a' and base_hp is null;

-- Drokgul
update champions set base_hp=22965, base_atk=991, base_def=1057, base_spd=107, base_crit_rate=15, base_crit_dmg=50, base_res=40, base_acc=0
where id='a8efaf34-6976-4a54-b392-7e40ca124489' and base_hp is null;

-- Maulie
update champions set base_hp=18495, base_atk=881, base_def=1465, base_spd=107, base_crit_rate=15, base_crit_dmg=50, base_res=80, base_acc=10
where id='1d0e141f-837e-4882-a3a5-5e54c2835d15' and base_hp is null;

-- Skull Lord Var-Gall
update champions set base_hp=27420, base_atk=1112, base_def=1310, base_spd=107, base_crit_rate=15, base_crit_dmg=50, base_res=90, base_acc=70
where id='0f0090d8-504e-4e58-8124-aaf2a028d51c' and base_hp is null;

-- Leorius
update champions set base_hp=18495, base_atk=1409, base_def=936, base_spd=106, base_crit_rate=15, base_crit_dmg=63, base_res=30, base_acc=0
where id='6c43b048-b0aa-4bed-a581-717a07452e12' and base_hp is null;

-- Ramantu
update champions set base_hp=15690, base_atk=1487, base_def=1046, base_spd=105, base_crit_rate=15, base_crit_dmg=50, base_res=30, base_acc=20
where id='e35f7aad-aa66-4d6e-aadd-45a79e409ddc' and base_hp is null;

-- Riho
update champions set base_hp=18660, base_atk=1189, base_def=1145, base_spd=105, base_crit_rate=15, base_crit_dmg=50, base_res=40, base_acc=0
where id='bc0eb1a4-b556-4f7f-bee2-3836cd90337c' and base_hp is null;

-- Big 'Un
update champions set base_hp=17505, base_atk=1575, base_def=837, base_spd=104, base_crit_rate=15, base_crit_dmg=63, base_res=30, base_acc=10
where id='b770c304-23c6-41f0-8450-7db4b5332f76' and base_hp is null;

-- Gomlok
update champions set base_hp=19650, base_atk=1233, base_def=1035, base_spd=104, base_crit_rate=15, base_crit_dmg=50, base_res=30, base_acc=20
where id='6b90ed0f-9971-4c1f-b8a5-7d504e896252' and base_hp is null;

-- Old Hermit Jorrg
update champions set base_hp=16350, base_atk=1134, base_def=1079, base_spd=104, base_crit_rate=15, base_crit_dmg=50, base_res=30, base_acc=0
where id='ef5332a8-1b8f-4588-8518-cd02360c85ba' and base_hp is null;

-- Lugan
update champions set base_hp=22140, base_atk=1013, base_def=1090, base_spd=103, base_crit_rate=15, base_crit_dmg=63, base_res=40, base_acc=0
where id='df8238b1-8c48-4a80-89cf-7ef6b5108bca' and base_hp is null;

-- Ma'Shalled
update champions set base_hp=17835, base_atk=1454, base_def=936, base_spd=103, base_crit_rate=15, base_crit_dmg=63, base_res=30, base_acc=0
where id='90fff61e-b36f-4091-840e-8990191a4a1f' and base_hp is null;

-- Mistress
update champions set base_hp=18990, base_atk=1024, base_def=1013, base_spd=103, base_crit_rate=15, base_crit_dmg=50, base_res=30, base_acc=0
where id='a07bb7b1-b289-49ce-9669-2dc08a47fd27' and base_hp is null;

-- Yoshi
update champions set base_hp=19650, base_atk=1299, base_def=969, base_spd=103, base_crit_rate=15, base_crit_dmg=50, base_res=40, base_acc=20
where id='8b8161b4-aff0-4cee-a41b-558bcdd57915' and base_hp is null;

-- Avir
update champions set base_hp=16680, base_atk=881, base_def=1035, base_spd=102, base_crit_rate=15, base_crit_dmg=50, base_res=30, base_acc=10
where id='dade5e8c-416b-490a-82fd-6faf1b51aa61' and base_hp is null;

-- Grunch
update champions set base_hp=18000, base_atk=969, base_def=1134, base_spd=102, base_crit_rate=15, base_crit_dmg=50, base_res=30, base_acc=15
where id='92f9e10f-216a-4921-a558-4d55ed815361' and base_hp is null;

-- Skimfos
update champions set base_hp=13050, base_atk=1432, base_def=1002, base_spd=102, base_crit_rate=15, base_crit_dmg=60, base_res=30, base_acc=0
where id='fb3fc341-936b-4eb3-8cf4-3db02d0a7325' and base_hp is null;

-- Ursala
update champions set base_hp=18000, base_atk=1167, base_def=936, base_spd=102, base_crit_rate=15, base_crit_dmg=50, base_res=30, base_acc=15
where id='6ae1ab82-9666-47d3-8d62-f9de184a20e5' and base_hp is null;

-- Basileus Roanas
update champions set base_hp=15525, base_atk=1542, base_def=1002, base_spd=101, base_crit_rate=15, base_crit_dmg=63, base_res=30, base_acc=10
where id='d0ec94e3-3d90-4898-99db-92a208ba8ae0' and base_hp is null;

-- Brakus
update champions set base_hp=19815, base_atk=1465, base_def=793, base_spd=101, base_crit_rate=15, base_crit_dmg=63, base_res=40, base_acc=0
where id='83cdf734-2882-4972-b81b-b41f22c01743' and base_hp is null;

-- Gerhard
update champions set base_hp=12555, base_atk=1387, base_def=1079, base_spd=101, base_crit_rate=15, base_crit_dmg=60, base_res=30, base_acc=0
where id='293cab62-fad3-46c4-8c3d-7502275c8e3a' and base_hp is null;

-- Queen Eva
update champions set base_hp=15690, base_atk=1696, base_def=837, base_spd=101, base_crit_rate=15, base_crit_dmg=63, base_res=30, base_acc=10
where id='486e289a-35a9-4b35-a17f-0cbd37aeb50e' and base_hp is null;

-- Roric
update champions set base_hp=14535, base_atk=1641, base_def=969, base_spd=101, base_crit_rate=15, base_crit_dmg=63, base_res=30, base_acc=0
where id='138308d1-eeeb-4744-857a-21e7cdca58ca' and base_hp is null;

-- Drowned Bloatwraith
update champions set base_hp=13545, base_atk=1387, base_def=738, base_spd=100, base_crit_rate=15, base_crit_dmg=57, base_res=30, base_acc=0
where id='7bc1f224-f789-4d8e-bcc4-af678c304a9a' and base_hp is null;

-- Gurptuk
update champions set base_hp=18825, base_atk=1079, base_def=1244, base_spd=100, base_crit_rate=15, base_crit_dmg=50, base_res=50, base_acc=0
where id='340bed4a-f1e5-4e64-8304-05cfc4151115' and base_hp is null;

-- Melga
update champions set base_hp=20475, base_atk=947, base_def=991, base_spd=100, base_crit_rate=15, base_crit_dmg=50, base_res=45, base_acc=0
where id='1b281ff1-4f95-4069-8801-3e6f168a3bf9' and base_hp is null;

-- Roshcard
update champions set base_hp=24780, base_atk=947, base_def=980, base_spd=100, base_crit_rate=15, base_crit_dmg=50, base_res=50, base_acc=0
where id='1f51e53e-cd76-410d-9780-0d8ac94ed212' and base_hp is null;

-- Tainix
update champions set base_hp=17010, base_atk=1189, base_def=980, base_spd=100, base_crit_rate=15, base_crit_dmg=50, base_res=30, base_acc=0
where id='dc1ffa97-e0c3-4919-ad89-c0293d28d0c1' and base_hp is null;

-- Trunda
update champions set base_hp=22800, base_atk=1608, base_def=980, base_spd=100, base_crit_rate=15, base_crit_dmg=63, base_res=80, base_acc=10
where id='3f22092d-7e19-4280-8665-a5a23545c15c' and base_hp is null;

-- Wurlim
update champions set base_hp=19650, base_atk=1035, base_def=1233, base_spd=100, base_crit_rate=15, base_crit_dmg=50, base_res=30, base_acc=20
where id='f1138581-c1c3-4762-9c42-dd497f5cb87a' and base_hp is null;

-- Aox
update champions set base_hp=17010, base_atk=991, base_def=1178, base_spd=99, base_crit_rate=15, base_crit_dmg=50, base_res=30, base_acc=15
where id='58d407aa-33a8-444e-80fd-16990604d066' and base_hp is null;

-- Genbo
update champions set base_hp=14040, base_atk=1409, base_def=958, base_spd=99, base_crit_rate=15, base_crit_dmg=60, base_res=30, base_acc=0
where id='406d4c87-f865-408e-b3e4-22e56e6ce097' and base_hp is null;

-- Gorlos
update champions set base_hp=12720, base_atk=1354, base_def=1101, base_spd=99, base_crit_rate=15, base_crit_dmg=50, base_res=30, base_acc=15
where id='94f626a5-3e75-4a15-b861-704c32899685' and base_hp is null;

-- Hakkorhn
update champions set base_hp=23790, base_atk=848, base_def=1145, base_spd=99, base_crit_rate=15, base_crit_dmg=50, base_res=50, base_acc=10
where id='5ec3d5e0-27cf-443c-a4c4-2be773c12059' and base_hp is null;

-- Inithwe
update champions set base_hp=14370, base_atk=1729, base_def=892, base_spd=99, base_crit_rate=15, base_crit_dmg=63, base_res=30, base_acc=10
where id='eac3cd05-4aa1-44df-98a3-36a508fc9fad' and base_hp is null;

-- Kantra
update champions set base_hp=18330, base_atk=815, base_def=1542, base_spd=99, base_crit_rate=15, base_crit_dmg=50, base_res=40, base_acc=20
where id='0296ae1b-d749-44a7-8453-56b6e4ea1ab4' and base_hp is null;

-- Kreela
update champions set base_hp=16680, base_atk=1244, base_def=1222, base_spd=99, base_crit_rate=15, base_crit_dmg=57, base_res=30, base_acc=0
where id='d1a2e15d-8c71-4022-a51b-0ae52018ae87' and base_hp is null;

-- Ogryn Jailer
update champions set base_hp=11235, base_atk=1299, base_def=980, base_spd=99, base_crit_rate=15, base_crit_dmg=57, base_res=30, base_acc=0
where id='3f3d4b68-99f2-4892-acdf-14189dd59b21' and base_hp is null;

-- Rugnor
update champions set base_hp=16680, base_atk=1409, base_def=782, base_spd=99, base_crit_rate=15, base_crit_dmg=60, base_res=30, base_acc=0
where id='d1adee9a-1f42-4b55-86a0-a51e1052d1c6' and base_hp is null;

-- Alaric
update champions set base_hp=15855, base_atk=1454, base_def=793, base_spd=98, base_crit_rate=15, base_crit_dmg=60, base_res=30, base_acc=0
where id='b1e7b269-acfa-4de5-b893-e097e789a8e2' and base_hp is null;

-- Baroth
update champions set base_hp=20475, base_atk=826, base_def=1112, base_spd=98, base_crit_rate=15, base_crit_dmg=50, base_res=45, base_acc=0
where id='d793ca9a-038e-4bdd-afd4-fc2eb1c2d17a' and base_hp is null;

-- Cillian
update champions set base_hp=13215, base_atk=1432, base_def=1266, base_spd=98, base_crit_rate=15, base_crit_dmg=63, base_res=30, base_acc=10
where id='d7209e06-ab8a-4efe-98eb-6701f4f64cd1' and base_hp is null;

-- Dolor
update champions set base_hp=16845, base_atk=1035, base_def=870, base_spd=98, base_crit_rate=15, base_crit_dmg=50, base_res=30, base_acc=0
where id='d96f4368-1de7-4a21-8134-4c2405069da1' and base_hp is null;

-- Gurgoh
update champions set base_hp=16020, base_atk=1465, base_def=1046, base_spd=98, base_crit_rate=15, base_crit_dmg=63, base_res=30, base_acc=0
where id='a835ac8b-4045-4d15-80be-608e3b3af5ca' and base_hp is null;

-- Rian
update champions set base_hp=17010, base_atk=1002, base_def=1167, base_spd=98, base_crit_rate=15, base_crit_dmg=50, base_res=30, base_acc=15
where id='2533b60b-7e24-482b-9084-5f29afd939d1' and base_hp is null;

-- Samar
update champions set base_hp=21480, base_atk=936, base_def=1211, base_spd=98, base_crit_rate=15, base_crit_dmg=60, base_res=80, base_acc=0
where id='04daebcc-aa1c-480e-88ee-99d59545bb24' and base_hp is null;

-- Vasal
update champions set base_hp=21315, base_atk=870, base_def=1288, base_spd=98, base_crit_rate=15, base_crit_dmg=50, base_res=40, base_acc=20
where id='72ca84c5-fc66-40fe-9b40-23196de39768' and base_hp is null;

-- Varl
update champions set base_hp=15030, base_atk=1476, base_def=1101, base_spd=98, base_crit_rate=15, base_crit_dmg=63, base_res=30, base_acc=10
where id='3b5e2f4a-5431-454c-b784-160f7ff29146' and base_hp is null;

-- R. Nergigante Archer
update champions set base_hp=13050, base_atk=1156, base_def=727, base_spd=97, base_crit_rate=15, base_crit_dmg=50, base_res=30, base_acc=0
where id='7c238bd2-344e-497f-b23d-645c05feddc4' and base_hp is null;

-- Balthus
update champions set base_hp=18000, base_atk=848, base_def=1255, base_spd=97, base_crit_rate=15, base_crit_dmg=50, base_res=45, base_acc=0
where id='b87af04a-267a-4e9d-bafa-1c2bd84df43c' and base_hp is null;

-- Dhukk
update champions set base_hp=15855, base_atk=870, base_def=1376, base_spd=97, base_crit_rate=15, base_crit_dmg=50, base_res=45, base_acc=0
where id='6a96c742-9536-4eae-a995-2ca12d8734eb' and base_hp is null;

-- Gala
update champions set base_hp=18165, base_atk=1432, base_def=661, base_spd=97, base_crit_rate=15, base_crit_dmg=60, base_res=60, base_acc=0
where id='8e6e3b7d-52f3-460e-855f-397d42033638' and base_hp is null;

-- Hoforees
update champions set base_hp=20475, base_atk=903, base_def=1035, base_spd=97, base_crit_rate=15, base_crit_dmg=50, base_res=45, base_acc=0
where id='2cedc224-d364-46ee-9556-d300dedf16c6' and base_hp is null;

-- Kurzad
update champions set base_hp=12225, base_atk=1343, base_def=870, base_spd=97, base_crit_rate=15, base_crit_dmg=50, base_res=30, base_acc=10
where id='1213ea76-9a37-4a3c-bda9-13ff755287a7' and base_hp is null;

-- Masked Fearmonger
update champions set base_hp=13215, base_atk=1398, base_def=1024, base_spd=97, base_crit_rate=15, base_crit_dmg=60, base_res=30, base_acc=0
where id='88357d25-bd09-4838-a84a-1ebb7161b310' and base_hp is null;

-- Nekhret
update champions set base_hp=21480, base_atk=793, base_def=1354, base_spd=97, base_crit_rate=15, base_crit_dmg=50, base_res=50, base_acc=0
where id='8aabf35f-b849-41e7-87dc-42f8cb81366e' and base_hp is null;

-- Ruel
update champions set base_hp=13545, base_atk=1696, base_def=980, base_spd=97, base_crit_rate=15, base_crit_dmg=63, base_res=30, base_acc=10
where id='e72d9516-3cd5-4403-ac43-8320af6c7484' and base_hp is null;

-- Sicia
update champions set base_hp=13050, base_atk=1586, base_def=1123, base_spd=97, base_crit_rate=15, base_crit_dmg=60, base_res=30, base_acc=20
where id='dcd49ac0-f025-461e-9972-6882708796ea' and base_hp is null;

-- Tuhak
update champions set base_hp=16020, base_atk=1365, base_def=870, base_spd=97, base_crit_rate=15, base_crit_dmg=60, base_res=30, base_acc=0
where id='53d41159-f368-4521-8678-4e70016a7414' and base_hp is null;

-- Visix
update champions set base_hp=17175, base_atk=958, base_def=1476, base_spd=97, base_crit_rate=15, base_crit_dmg=50, base_res=50, base_acc=0
where id='fc09fcce-189f-448c-9738-c6111b3dd851' and base_hp is null;

-- Giscard
update champions set base_hp=17505, base_atk=683, base_def=1454, base_spd=96, base_crit_rate=15, base_crit_dmg=50, base_res=30, base_acc=0
where id='fe0f5171-ec54-49dd-8e2e-532c10190c04' and base_hp is null;

-- Gravechill
update champions set base_hp=13545, base_atk=1233, base_def=892, base_spd=96, base_crit_rate=15, base_crit_dmg=50, base_res=30, base_acc=10
where id='5c52e58b-a276-46c4-b941-2cc8da2aa93e' and base_hp is null;

-- Grohak
update champions set base_hp=15690, base_atk=1487, base_def=1046, base_spd=96, base_crit_rate=15, base_crit_dmg=63, base_res=30, base_acc=10
where id='b978913e-e267-4afe-9aba-030a58da75fe' and base_hp is null;

-- Lodric
update champions set base_hp=18825, base_atk=947, base_def=1101, base_spd=96, base_crit_rate=15, base_crit_dmg=50, base_res=45, base_acc=0
where id='2832814f-df55-402a-bf33-1dd6a2dc0633' and base_hp is null;

-- Nogdar
update champions set base_hp=12060, base_atk=1696, base_def=1079, base_spd=96, base_crit_rate=15, base_crit_dmg=60, base_res=30, base_acc=0
where id='79b415ad-5c5d-48fc-a2db-d39a323d05f7' and base_hp is null;

-- Suwai
update champions set base_hp=14040, base_atk=1343, base_def=1024, base_spd=96, base_crit_rate=15, base_crit_dmg=60, base_res=30, base_acc=0
where id='a833c2f2-6470-4542-9c7c-8456c7247854' and base_hp is null;

-- Toragi
update champions set base_hp=21810, base_atk=892, base_def=958, base_spd=96, base_crit_rate=15, base_crit_dmg=50, base_res=45, base_acc=0
where id='96d3d570-d225-4ceb-88a5-dc06711f530d' and base_hp is null;

-- Versulf
update champions set base_hp=22635, base_atk=870, base_def=1200, base_spd=96, base_crit_rate=15, base_crit_dmg=50, base_res=50, base_acc=10
where id='5381f560-9095-4251-bacd-754ea0e0a8e0' and base_hp is null;

-- Akoth
update champions set base_hp=16680, base_atk=892, base_def=1299, base_spd=95, base_crit_rate=15, base_crit_dmg=50, base_res=30, base_acc=12
where id='ca100e57-1745-4ce4-9c3a-15c655c31a9d' and base_hp is null;

-- Bergoth
update champions set base_hp=21810, base_atk=716, base_def=1134, base_spd=95, base_crit_rate=15, base_crit_dmg=50, base_res=45, base_acc=0
where id='71aebf3d-cb6c-4b8f-aca4-e79ea7e5d207' and base_hp is null;

-- Haarken
update champions set base_hp=14865, base_atk=1487, base_def=826, base_spd=95, base_crit_rate=15, base_crit_dmg=60, base_res=30, base_acc=0
where id='ac3d23f8-7022-444e-bdb4-ee83bbd5eec0' and base_hp is null;

-- Scyl of the Drakes
update champions set base_hp=19980, base_atk=859, base_def=1387, base_spd=95, base_crit_rate=15, base_crit_dmg=63, base_res=40, base_acc=0
where id='890c0295-1682-4efc-a179-a477236af6ea' and base_hp is null;

-- Urost
update champions set base_hp=24450, base_atk=782, base_def=1167, base_spd=95, base_crit_rate=15, base_crit_dmg=50, base_res=50, base_acc=10
where id='d7e727bc-4782-4648-baae-f222e22c5d6f' and base_hp is null;

-- Yaga
update champions set base_hp=15195, base_atk=1365, base_def=925, base_spd=95, base_crit_rate=15, base_crit_dmg=50, base_res=30, base_acc=15
where id='20897abc-bbd2-4f4f-8880-58a2dd6fe1e9' and base_hp is null;

-- Yakarl
update champions set base_hp=16350, base_atk=1597, base_def=892, base_spd=95, base_crit_rate=15, base_crit_dmg=63, base_res=30, base_acc=10
where id='ec2f81a3-5ef4-4d89-869e-d96fca053652' and base_hp is null;

-- Achak
update champions set base_hp=17505, base_atk=947, base_def=1189, base_spd=94, base_crit_rate=15, base_crit_dmg=50, base_res=30, base_acc=15
where id='8fc52b52-01e4-42e4-afc4-373f41d24441' and base_hp is null;

-- Baerdal
update champions set base_hp=18330, base_atk=1398, base_def=683, base_spd=94, base_crit_rate=15, base_crit_dmg=60, base_res=60, base_acc=0
where id='0f0259df-eedc-42cf-98d0-3c948c77e22d' and base_hp is null;

-- Ghrush
update champions set base_hp=19320, base_atk=694, base_def=1321, base_spd=94, base_crit_rate=15, base_crit_dmg=50, base_res=45, base_acc=0
where id='00a1e602-cc21-4063-ab6d-3afc4f69d917' and base_hp is null;

-- Hellborn
update champions set base_hp=15360, base_atk=1145, base_def=859, base_spd=94, base_crit_rate=15, base_crit_dmg=50, base_res=30, base_acc=10
where id='4a41681e-78a5-44a7-98f0-d33a8eb7086e' and base_hp is null;

-- Krisk
update champions set base_hp=19485, base_atk=760, base_def=1520, base_spd=94, base_crit_rate=15, base_crit_dmg=50, base_res=50, base_acc=10
where id='14f4aafe-4dbe-4262-b19c-00073108c79f' and base_hp is null;

-- Sandlashed Survivor
update champions set base_hp=15030, base_atk=936, base_def=1365, base_spd=94, base_crit_rate=15, base_crit_dmg=50, base_res=45, base_acc=0
where id='b7cad312-8504-4ff7-96bc-95b45fd56ebd' and base_hp is null;

-- Tormin
update champions set base_hp=20145, base_atk=815, base_def=1421, base_spd=94, base_crit_rate=15, base_crit_dmg=50, base_res=70, base_acc=20
where id='69de143a-f1dd-4d62-9229-953c50d88bf2' and base_hp is null;

-- Tolf
update champions set base_hp=21975, base_atk=793, base_def=1046, base_spd=94, base_crit_rate=15, base_crit_dmg=50, base_res=45, base_acc=0
where id='0968680d-5b0b-40f4-9bc6-3e215284e24b' and base_hp is null;

-- Elder
update champions set base_hp=14865, base_atk=914, base_def=1123, base_spd=92, base_crit_rate=15, base_crit_dmg=50, base_res=40, base_acc=0
where id='519fe176-9074-40d6-9fe0-33001d9539c4' and base_hp is null;

-- Teela
update champions set base_hp=21975, base_atk=892, base_def=1222, base_spd=98, base_crit_rate=15, base_crit_dmg=63, base_res=30, base_acc=0
where id='ad6db86d-edd7-4353-b5af-f02bff5d4219' and base_hp is null;

-- Rhazin
update champions set base_hp=18330, base_atk=1046, base_def=1310, base_spd=91, base_crit_rate=15, base_crit_dmg=50, base_res=50, base_acc=0
where id='0403ccfc-3590-4f2a-b9ad-e8e0e9aeb23d' and base_hp is null;

-- Fortress Goon
update champions set base_hp=15525, base_atk=859, base_def=1134, base_spd=90, base_crit_rate=15, base_crit_dmg=50, base_res=40, base_acc=0
where id='032752ee-6049-435b-b488-653d313a2dbb' and base_hp is null;

-- Gloril
update champions set base_hp=16185, base_atk=1244, base_def=705, base_spd=90, base_crit_rate=15, base_crit_dmg=57, base_res=30, base_acc=0
where id='855b4d67-4856-48c6-9d1f-16917f890971' and base_hp is null;

-- Pharsalas
update champions set base_hp=18660, base_atk=892, base_def=1167, base_spd=90, base_crit_rate=15, base_crit_dmg=50, base_res=45, base_acc=10
where id='a2d66545-cddb-436a-87eb-d204c5cf3a46' and base_hp is null;

-- Rotos
update champions set base_hp=11895, base_atk=1520, base_def=1266, base_spd=90, base_crit_rate=15, base_crit_dmg=63, base_res=40, base_acc=0
where id='e0f7f4b6-c93e-4edd-928f-6ab949d384e5' and base_hp is null;

-- Thea
update champions set base_hp=16020, base_atk=1542, base_def=969, base_spd=90, base_crit_rate=15, base_crit_dmg=63, base_res=30, base_acc=0
where id='361415fe-013e-4684-afea-511e9642ddbb' and base_hp is null;

-- Sentinel
update champions set base_hp=18825, base_atk=914, base_def=859, base_spd=86, base_crit_rate=15, base_crit_dmg=50, base_res=30, base_acc=10
where id='0cf63721-e5b7-40da-b955-4902069c8cc6' and base_hp is null;

-- Twinclaw
update champions set base_hp=11565, base_atk=1365, base_def=892, base_spd=85, base_crit_rate=15, base_crit_dmg=57, base_res=30, base_acc=0
where id='2d8288d1-d94d-4fdd-834f-ed256dd4a6d0' and base_hp is null;

-- Sigmund
update champions set base_hp=20640, base_atk=848, base_def=1354, base_spd=97, base_crit_rate=15, base_crit_dmg=50, base_res=50, base_acc=10
where id='68392117-d44b-4b7a-bd8b-b5308ce8c8df' and base_hp is null;

-- Duhr
update champions set base_hp=17505, base_atk=1068, base_def=1068, base_spd=102, base_crit_rate=15, base_crit_dmg=50, base_res=30, base_acc=0
where id='7c74d1f1-30df-47f9-a827-b86463fdcc82' and base_hp is null;

-- Vlad
update champions set base_hp=15030, base_atk=1443, base_def=1134, base_spd=105, base_crit_rate=15, base_crit_dmg=63, base_res=30, base_acc=0
where id='24b10aef-94b0-4bec-b519-b1925b3f6b5c' and base_hp is null;

-- Konstantin
update champions set base_hp=14700, base_atk=1421, base_def=1178, base_spd=105, base_crit_rate=15, base_crit_dmg=63, base_res=30, base_acc=0
where id='e0eafc90-474a-4e4f-91cf-5221f9ab515b' and base_hp is null;

-- Wythir
update champions set base_hp=24120, base_atk=793, base_def=1178, base_spd=108, base_crit_rate=15, base_crit_dmg=50, base_res=40, base_acc=0
where id='1457bf9c-fd08-4461-b0c7-a09ff77a6e62' and base_hp is null;

-- Aleksandr
update champions set base_hp=17505, base_atk=1432, base_def=980, base_spd=100, base_crit_rate=15, base_crit_dmg=63, base_res=30, base_acc=10
where id='60f6d582-c79a-42f5-8886-133281f18b24' and base_hp is null;

-- Mithrala
update champions set base_hp=20310, base_atk=870, base_def=1354, base_spd=109, base_crit_rate=15, base_crit_dmg=50, base_res=30, base_acc=10
where id='c9b9109c-10f6-48ad-b94a-e0cb641d1926' and base_hp is null;

-- Gliseah
update champions set base_hp=18660, base_atk=826, base_def=1509, base_spd=100, base_crit_rate=15, base_crit_dmg=50, base_res=40, base_acc=20
where id='fb236e91-0f10-4dba-8dba-12c282094914' and base_hp is null;

-- Tatura
update champions set base_hp=20145, base_atk=804, base_def=1432, base_spd=102, base_crit_rate=15, base_crit_dmg=50, base_res=50, base_acc=10
where id='2e96c545-5aa1-4dd4-8223-db5dcf64c8ee' and base_hp is null;

-- Danag
update champions set base_hp=17010, base_atk=1487, base_def=958, base_spd=97, base_crit_rate=15, base_crit_dmg=63, base_res=30, base_acc=10
where id='bfbca815-4467-4c78-a96f-45f0681cfe0d' and base_hp is null;

-- Opardin
update champions set base_hp=22470, base_atk=870, base_def=1211, base_spd=102, base_crit_rate=15, base_crit_dmg=50, base_res=50, base_acc=0
where id='90f14d4c-9fa7-4396-a7f8-2326e1388ecd' and base_hp is null;

-- Old Ghrukkus
update champions set base_hp=17010, base_atk=1079, base_def=1090, base_spd=98, base_crit_rate=15, base_crit_dmg=50, base_res=30, base_acc=15
where id='b77b5f3f-4671-4195-a982-ba5914bd6cf0' and base_hp is null;

-- Guurda
update champions set base_hp=20640, base_atk=892, base_def=1310, base_spd=97, base_crit_rate=15, base_crit_dmg=50, base_res=40, base_acc=20
where id='6adccc51-0535-4e55-842c-9af5c728c163' and base_hp is null;

-- Karato
update champions set base_hp=17340, base_atk=1564, base_def=859, base_spd=99, base_crit_rate=15, base_crit_dmg=63, base_res=30, base_acc=10
where id='c8f61c77-9474-47fb-82bc-bb13a27faf21' and base_hp is null;

-- Boragar
update champions set base_hp=21135, base_atk=925, base_def=1244, base_spd=97, base_crit_rate=15, base_crit_dmg=50, base_res=50, base_acc=0
where id='849e49ac-6770-49f2-8de1-9d6fff502873' and base_hp is null;

-- Ginro
update champions set base_hp=18825, base_atk=936, base_def=1387, base_spd=98, base_crit_rate=15, base_crit_dmg=50, base_res=50, base_acc=0
where id='8284c14d-d0dc-407b-9ddb-7b5ea63ace2e' and base_hp is null;

-- Cromax
update champions set base_hp=18000, base_atk=958, base_def=1421, base_spd=100, base_crit_rate=15, base_crit_dmg=50, base_res=50, base_acc=10
where id='4c181d46-8efb-4c6a-a5f6-c7b17468f3f7' and base_hp is null;

-- Zii
update champions set base_hp=14535, base_atk=1421, base_def=914, base_spd=99, base_crit_rate=15, base_crit_dmg=60, base_res=30, base_acc=0
where id='f5c4d5ea-932c-4c05-b43f-b98170693daa' and base_hp is null;

-- Keeyra
update champions set base_hp=19485, base_atk=870, base_def=1409, base_spd=104, base_crit_rate=15, base_crit_dmg=50, base_res=50, base_acc=0
where id='f865e286-631c-40cf-b4f9-853a4151bc21' and base_hp is null;

-- Goffred
update champions set base_hp=19485, base_atk=848, base_def=1432, base_spd=102, base_crit_rate=15, base_crit_dmg=50, base_res=50, base_acc=10
where id='e07eda4c-e298-4206-ba33-03bbc1cfaf26' and base_hp is null;

-- Sniktraak
update champions set base_hp=22965, base_atk=826, base_def=1222, base_spd=99, base_crit_rate=15, base_crit_dmg=50, base_res=45, base_acc=20
where id='3634145a-9c60-46b8-8e07-bcf93f593295' and base_hp is null;

-- Teodor the Savant
update champions set base_hp=20805, base_atk=980, base_def=1211, base_spd=105, base_crit_rate=15, base_crit_dmg=50, base_res=30, base_acc=20
where id='1e8f3e54-e38d-43a5-bfe6-c4b21127eae4' and base_hp is null;

-- Rakka
update champions set base_hp=19650, base_atk=1134, base_def=1134, base_spd=109, base_crit_rate=15, base_crit_dmg=50, base_res=40, base_acc=0
where id='6e37034e-9325-4042-880f-3b5e9416d5db' and base_hp is null;

-- Lonatharil
update champions set base_hp=23130, base_atk=848, base_def=1189, base_spd=99, base_crit_rate=15, base_crit_dmg=57, base_res=50, base_acc=0
where id='86d9c534-e507-4437-a733-349140710f13' and base_hp is null;

-- Mighty Ukko
update champions set base_hp=18495, base_atk=1233, base_def=1112, base_spd=109, base_crit_rate=15, base_crit_dmg=50, base_res=30, base_acc=10
where id='55954ec6-16b4-4174-b3a6-e8e181b2335b' and base_hp is null;

-- Acrizia
update champions set base_hp=15855, base_atk=1476, base_def=1046, base_spd=97, base_crit_rate=15, base_crit_dmg=63, base_res=40, base_acc=0
where id='6f1a2c1b-34d3-40ed-abdf-8668a11c7ea4' and base_hp is null;

-- Maranix
update champions set base_hp=15360, base_atk=1487, base_def=1068, base_spd=100, base_crit_rate=15, base_crit_dmg=63, base_res=30, base_acc=10
where id='3ebdc6d9-7999-498d-a6b8-ae3671143527' and base_hp is null;

-- Fortus
update champions set base_hp=19980, base_atk=859, base_def=1387, base_spd=97, base_crit_rate=15, base_crit_dmg=63, base_res=40, base_acc=0
where id='14cdbb8f-7ce2-4f33-8f3c-77e2748423aa' and base_hp is null;

-- Tomoe
update champions set base_hp=16185, base_atk=1024, base_def=1200, base_spd=99, base_crit_rate=15, base_crit_dmg=50, base_res=30, base_acc=15
where id='7531ef09-1cfe-4774-86c6-af00df366ef8' and base_hp is null;

-- Prosecutor
update champions set base_hp=13545, base_atk=1288, base_def=837, base_spd=96, base_crit_rate=15, base_crit_dmg=57, base_res=30, base_acc=0
where id='cf0dba5e-f10b-48f3-a29b-879a462483c0' and base_hp is null;

-- Morrigaine
update champions set base_hp=19815, base_atk=1068, base_def=1189, base_spd=112, base_crit_rate=15, base_crit_dmg=50, base_res=30, base_acc=10
where id='933cce5c-b640-44f5-8d96-70606c91da9e' and base_hp is null;

-- Ailil
update champions set base_hp=15690, base_atk=1630, base_def=903, base_spd=105, base_crit_rate=15, base_crit_dmg=63, base_res=30, base_acc=0
where id='83dd5dcc-40cc-4169-9005-6683acf678ea' and base_hp is null;

-- Elva
update champions set base_hp=19650, base_atk=936, base_def=1332, base_spd=110, base_crit_rate=15, base_crit_dmg=50, base_res=40, base_acc=0
where id='f77e297b-c560-4753-9fcd-87a78d8e0550' and base_hp is null;

-- Greenwarden Ruarc
update champions set base_hp=19650, base_atk=771, base_def=1498, base_spd=102, base_crit_rate=15, base_crit_dmg=50, base_res=50, base_acc=0
where id='40ea0168-897b-4c59-85f4-60e1e8771c35' and base_hp is null;

-- King Gallcobar
update champions set base_hp=20970, base_atk=903, base_def=1277, base_spd=108, base_crit_rate=15, base_crit_dmg=50, base_res=30, base_acc=15
where id='1f83da97-dd65-4beb-bb4a-8e62b4910656' and base_hp is null;

-- Michinaki
update champions set base_hp=19650, base_atk=804, base_def=1465, base_spd=101, base_crit_rate=15, base_crit_dmg=57, base_res=30, base_acc=20
where id='f80f6081-0381-45ab-bcc6-7e7d4540f1b6' and base_hp is null;

-- Cormac
update champions set base_hp=14535, base_atk=1509, base_def=826, base_spd=94, base_crit_rate=15, base_crit_dmg=60, base_res=30, base_acc=0
where id='2caeb5fe-fce5-4c24-bdd3-24a9262e6d05' and base_hp is null;

-- Duedan
update champions set base_hp=19815, base_atk=826, base_def=1156, base_spd=97, base_crit_rate=15, base_crit_dmg=50, base_res=45, base_acc=0
where id='a59d4a8d-e753-4d6a-8233-7bdb0f09b0bb' and base_hp is null;

-- Lady Annabelle
update champions set base_hp=20310, base_atk=881, base_def=1068, base_spd=100, base_crit_rate=15, base_crit_dmg=50, base_res=30, base_acc=15
where id='dee83272-a858-45e6-924e-a4cc69765fef' and base_hp is null;

-- Mistrider Daithi
update champions set base_hp=15360, base_atk=1376, base_def=903, base_spd=97, base_crit_rate=15, base_crit_dmg=60, base_res=30, base_acc=0
where id='ccf19498-0d1f-4705-99ad-834b9e1c5f55' and base_hp is null;

-- Myciliac Priest Orn
update champions set base_hp=20310, base_atk=760, base_def=1189, base_spd=95, base_crit_rate=15, base_crit_dmg=50, base_res=30, base_acc=15
where id='cc745173-52ca-4a02-871c-b899a0f27fb0' and base_hp is null;

-- White Dryad Nia
update champions set base_hp=20145, base_atk=683, base_def=1277, base_spd=98, base_crit_rate=15, base_crit_dmg=50, base_res=45, base_acc=0
where id='c4627bee-de4d-488f-b51b-deb582e247cc' and base_hp is null;

-- Pathfinder Cait
update champions set base_hp=11895, base_atk=1288, base_def=947, base_spd=95, base_crit_rate=15, base_crit_dmg=50, base_res=30, base_acc=10
where id='68208c87-65c1-498c-8434-434bef86a3a4' and base_hp is null;

-- Ceez
update champions set base_hp=14040, base_atk=1531, base_def=837, base_spd=100, base_crit_rate=15, base_crit_dmg=60, base_res=30, base_acc=0
where id='6efc1667-742f-4b52-ba51-95fde27f4bdf' and base_hp is null;

-- Corvis the Corruptor
update champions set base_hp=19155, base_atk=903, base_def=1398, base_spd=99, base_crit_rate=15, base_crit_dmg=50, base_res=40, base_acc=20
where id='5ae9262c-b74a-4cda-aab3-8b65fafc3b4f' and base_hp is null;

-- Eolfrig
update champions set base_hp=16185, base_atk=1233, base_def=991, base_spd=100, base_crit_rate=15, base_crit_dmg=50, base_res=30, base_acc=15
where id='bcf78859-4ce4-4088-b794-212d0b4d553c' and base_hp is null;

-- Harima
update champions set base_hp=16845, base_atk=925, base_def=1531, base_spd=97, base_crit_rate=15, base_crit_dmg=63, base_res=40, base_acc=0
where id='5eb4a778-843b-411b-bda0-8dd76d7079c1' and base_hp is null;

-- Hoskarul
update champions set base_hp=17670, base_atk=804, base_def=1321, base_spd=98, base_crit_rate=15, base_crit_dmg=50, base_res=45, base_acc=0
where id='e63da688-d115-4807-9878-b6e05092cf6d' and base_hp is null;

-- Lorn
update champions set base_hp=15360, base_atk=1443, base_def=837, base_spd=98, base_crit_rate=15, base_crit_dmg=50, base_res=30, base_acc=15
where id='023bba1c-11ce-4023-8e31-961c177dfa18' and base_hp is null;

-- Noct
update champions set base_hp=22470, base_atk=836, base_def=1255, base_spd=99, base_crit_rate=15, base_crit_dmg=50, base_res=40, base_acc=20
where id='cf3e7292-9af8-453b-ab59-b3d39cea2397' and base_hp is null;

-- Samson
update champions set base_hp=22635, base_atk=815, base_def=1255, base_spd=98, base_crit_rate=15, base_crit_dmg=63, base_res=30, base_acc=10
where id='2450de16-a5a3-4cff-9d27-b93685fc3cc1' and base_hp is null;

-- Skeuramis
update champions set base_hp=19980, base_atk=848, base_def=1123, base_spd=97, base_crit_rate=15, base_crit_dmg=50, base_res=30, base_acc=15
where id='9abf2a7a-cbb4-485b-989a-ec1fdcd9dbdb' and base_hp is null;

-- Suiren
update champions set base_hp=14370, base_atk=1310, base_def=1035, base_spd=99, base_crit_rate=15, base_crit_dmg=50, base_res=30, base_acc=15
where id='b357ac41-373e-452d-8793-35231845f994' and base_hp is null;

-- Ronda
update champions set base_hp=14865, base_atk=1542, base_def=1046, base_spd=101, base_crit_rate=15, base_crit_dmg=63, base_res=40, base_acc=0
where id='3f59adc1-a67c-49e3-a3d0-fffbcc3a2aa1' and base_hp is null;

-- Gnishak Verminlord
update champions set base_hp=17175, base_atk=1365, base_def=1068, base_spd=105, base_crit_rate=15, base_crit_dmg=50, base_res=30, base_acc=20
where id='7da92236-f47c-46a6-9e84-6b332de8e7b0' and base_hp is null;

-- Marichka
update champions set base_hp=21810, base_atk=892, base_def=1233, base_spd=110, base_crit_rate=15, base_crit_dmg=50, base_res=40, base_acc=0
where id='f36fc02d-fa99-4111-a751-ddc711de9741' and base_hp is null;

-- Taras
update champions set base_hp=22305, base_atk=705, base_def=1387, base_spd=97, base_crit_rate=15, base_crit_dmg=63, base_res=40, base_acc=0
where id='93ce1922-3ef0-4fff-aafb-9ae5c48032d2' and base_hp is null;

-- Tramaria
update champions set base_hp=21645, base_atk=892, base_def=1244, base_spd=105, base_crit_rate=15, base_crit_dmg=50, base_res=50, base_acc=0
where id='6ae0435e-ff57-40d5-a654-c5f604495b32' and base_hp is null;

-- Georgid
update champions set base_hp=13710, base_atk=1608, base_def=1057, base_spd=103, base_crit_rate=15, base_crit_dmg=63, base_res=30, base_acc=0
where id='a072b00d-beb7-44a0-bbb0-b6587d560bec' and base_hp is null;

-- Aeshma
update champions set base_hp=14535, base_atk=1354, base_def=980, base_spd=98, base_crit_rate=15, base_crit_dmg=50, base_res=30, base_acc=15
where id='dc88498e-ecde-4599-a1ed-54ce6cef5514' and base_hp is null;

-- Endalia
update champions set base_hp=20475, base_atk=749, base_def=1189, base_spd=100, base_crit_rate=15, base_crit_dmg=50, base_res=30, base_acc=15
where id='ca9f40fb-50e8-40a6-8620-54ace02c352b' and base_hp is null;

-- Trumborr
update champions set base_hp=18330, base_atk=749, base_def=1332, base_spd=99, base_crit_rate=15, base_crit_dmg=50, base_res=45, base_acc=0
where id='bbc6d256-a443-4eb4-ab23-818fe0d64f8a' and base_hp is null;

-- Riscarm
update champions set base_hp=16680, base_atk=705, base_def=1211, base_spd=95, base_crit_rate=15, base_crit_dmg=50, base_res=40, base_acc=0
where id='5e059491-9cd8-4833-9521-48d318339e09' and base_hp is null;

-- Pythion
update champions set base_hp=21135, base_atk=870, base_def=1299, base_spd=105, base_crit_rate=15, base_crit_dmg=50, base_res=50, base_acc=0
where id='2f4786f2-f294-4cb7-8b6c-1e94ce6c66ea' and base_hp is null;

-- Korugar
update champions set base_hp=21645, base_atk=881, base_def=1255, base_spd=103, base_crit_rate=15, base_crit_dmg=50, base_res=50, base_acc=0
where id='5d428674-0a8d-4cdd-8607-97d9ce67c9ce' and base_hp is null;

-- Kellan
update champions set base_hp=13545, base_atk=1443, base_def=958, base_spd=98, base_crit_rate=15, base_crit_dmg=60, base_res=30, base_acc=0
where id='9f7d8dfd-3b11-4c28-9aeb-243b31c24756' and base_hp is null;

-- Akemtum
update champions set base_hp=16020, base_atk=1354, base_def=881, base_spd=98, base_crit_rate=15, base_crit_dmg=50, base_res=30, base_acc=15
where id='ec57de92-161a-4b7a-af40-05ef6b4ba695' and base_hp is null;

-- Enda
update champions set base_hp=14040, base_atk=1476, base_def=892, base_spd=99, base_crit_rate=15, base_crit_dmg=60, base_res=30, base_acc=0
where id='28175d91-7434-41b8-8028-cddbbe60bc2b' and base_hp is null;

-- Oella
update champions set base_hp=21135, base_atk=980, base_def=1189, base_spd=110, base_crit_rate=15, base_crit_dmg=50, base_res=50, base_acc=0
where id='ead684f1-43b5-43b8-8537-ea72d595f829' and base_hp is null;

-- Ultan
update champions set base_hp=15525, base_atk=1553, base_def=991, base_spd=101, base_crit_rate=15, base_crit_dmg=63, base_res=30, base_acc=0
where id='7ea96637-2885-4f96-bace-a11b701fd9ca' and base_hp is null;

-- Merouka
update champions set base_hp=18660, base_atk=771, base_def=1288, base_spd=98, base_crit_rate=15, base_crit_dmg=50, base_res=45, base_acc=0
where id='3af6c579-6ec3-42cc-8aa6-12deebefcda2' and base_hp is null;

-- Shadowbow Tirlac
update champions set base_hp=15030, base_atk=793, base_def=1233, base_spd=95, base_crit_rate=15, base_crit_dmg=50, base_res=40, base_acc=0
where id='8eb852bb-6324-4cee-a5cd-034b908fc553' and base_hp is null;

-- Nari
update champions set base_hp=19320, base_atk=804, base_def=1487, base_spd=104, base_crit_rate=15, base_crit_dmg=50, base_res=30, base_acc=20
where id='5647fc65-2a77-4509-9ab3-c6c5e76aa0ba' and base_hp is null;

-- Supreme Kael
update champions set base_hp=15855, base_atk=1531, base_def=991, base_spd=110, base_crit_rate=15, base_crit_dmg=63, base_res=30, base_acc=0
where id='00f424e6-9c2f-42ac-9e93-a0b7122adb9d' and base_hp is null;

-- Supreme Athel
update champions set base_hp=16185, base_atk=1597, base_def=903, base_spd=100, base_crit_rate=15, base_crit_dmg=63, base_res=30, base_acc=0
where id='177f1b11-3241-4637-a430-3d671654cd02' and base_hp is null;

-- Supreme Elhain
update champions set base_hp=13875, base_atk=1509, base_def=1145, base_spd=102, base_crit_rate=15, base_crit_dmg=63, base_res=40, base_acc=0
where id='bac4bb44-8617-4871-815f-b1459ee607fe' and base_hp is null;

-- Supreme Galek
update champions set base_hp=17010, base_atk=1509, base_def=936, base_spd=100, base_crit_rate=15, base_crit_dmg=63, base_res=30, base_acc=10
where id='b265d43d-34a3-41d9-aa6b-f71790356276' and base_hp is null;

-- Bivald
update champions set base_hp=22470, base_atk=903, base_def=1178, base_spd=98, base_crit_rate=15, base_crit_dmg=50, base_res=50, base_acc=10
where id='62f4ab1d-c2ca-4b01-9f1d-591eba164371' and base_hp is null;

-- Gaius
update champions set base_hp=15195, base_atk=1586, base_def=980, base_spd=105, base_crit_rate=15, base_crit_dmg=63, base_res=30, base_acc=0
where id='883224a0-3222-4eb5-b775-4a73e3067665' and base_hp is null;

-- Searsha
update champions set base_hp=19155, base_atk=1002, base_def=1299, base_spd=100, base_crit_rate=15, base_crit_dmg=50, base_res=30, base_acc=20
where id='495f653f-a983-4ea1-a888-fe18cf19bb0a' and base_hp is null;

-- Quintus
update champions set base_hp=15030, base_atk=1608, base_def=969, base_spd=105, base_crit_rate=15, base_crit_dmg=63, base_res=30, base_acc=0
where id='bbede283-6e97-4ec7-9ae9-913defb6512c' and base_hp is null;

-- Razelvarg
update champions set base_hp=15030, base_atk=1520, base_def=1057, base_spd=110, base_crit_rate=15, base_crit_dmg=63, base_res=30, base_acc=0
where id='0937b803-a37f-4af0-96bc-e6f9cb534a4f' and base_hp is null;

-- Claidna
update champions set base_hp=21315, base_atk=804, base_def=1354, base_spd=100, base_crit_rate=15, base_crit_dmg=50, base_res=40, base_acc=20
where id='50a681fc-8e03-4357-9867-ba9bc823eb22' and base_hp is null;

-- Wyrennon the Silken
update champions set base_hp=17835, base_atk=848, base_def=1266, base_spd=104, base_crit_rate=15, base_crit_dmg=50, base_res=30, base_acc=0
where id='cf60dfca-3017-43aa-b53f-1af42b166da4' and base_hp is null;

-- Locwain
update champions set base_hp=14040, base_atk=1409, base_def=958, base_spd=98, base_crit_rate=15, base_crit_dmg=60, base_res=30, base_acc=0
where id='c5b59a96-7e80-4fa9-bf5c-cc5142788c8d' and base_hp is null;

-- Delaaja
update champions set base_hp=20640, base_atk=760, base_def=1167, base_spd=98, base_crit_rate=15, base_crit_dmg=50, base_res=30, base_acc=15
where id='97616ff0-ba14-4e21-907e-d9a8afef6c32' and base_hp is null;

-- Margrave
update champions set base_hp=19320, base_atk=760, base_def=980, base_spd=95, base_crit_rate=15, base_crit_dmg=50, base_res=40, base_acc=0
where id='c585fbf3-50cf-4275-b3ad-54e623a73e7a' and base_hp is null;

-- Jetni
update champions set base_hp=15360, base_atk=1586, base_def=969, base_spd=100, base_crit_rate=15, base_crit_dmg=63, base_res=30, base_acc=10
where id='acf195e7-7be1-4f36-aaf8-27668529cab2' and base_hp is null;

-- Alsgor
update champions set base_hp=21975, base_atk=936, base_def=1178, base_spd=99, base_crit_rate=15, base_crit_dmg=50, base_res=50, base_acc=10
where id='15e1a033-ad40-4db4-9cc0-5ef373783f82' and base_hp is null;

-- Graazur
update champions set base_hp=18660, base_atk=1013, base_def=1321, base_spd=102, base_crit_rate=15, base_crit_dmg=50, base_res=40, base_acc=20
where id='4836f219-b28d-4214-911c-26491ad0c6a6' and base_hp is null;

-- Wuzgar
update champions set base_hp=20640, base_atk=881, base_def=1046, base_spd=105, base_crit_rate=15, base_crit_dmg=50, base_res=30, base_acc=0
where id='26afadfe-0110-4fff-a2b0-a39934163350' and base_hp is null;

-- Ilysinya
update champions set base_hp=21480, base_atk=749, base_def=1123, base_spd=98, base_crit_rate=15, base_crit_dmg=50, base_res=30, base_acc=15
where id='f358dd6c-8e71-4b38-b5f2-278b1c0fbcc1' and base_hp is null;

-- Artak
update champions set base_hp=22140, base_atk=936, base_def=1167, base_spd=100, base_crit_rate=15, base_crit_dmg=63, base_res=30, base_acc=10
where id='20072536-e08f-4782-b198-6a608144ba67' and base_hp is null;

-- Greathoof Loriaca
update champions set base_hp=18495, base_atk=1123, base_def=1222, base_spd=105, base_crit_rate=15, base_crit_dmg=50, base_res=30, base_acc=20
where id='f6928807-a4ac-42b5-a6a8-f03b15162ba1' and base_hp is null;

-- Gnut
update champions set base_hp=19650, base_atk=749, base_def=1520, base_spd=99, base_crit_rate=15, base_crit_dmg=50, base_res=40, base_acc=20
where id='39597945-295c-4ec5-8f2a-67888ab3143e' and base_hp is null;

-- Ambassador Lethelin
update champions set base_hp=17175, base_atk=969, base_def=1189, base_spd=106, base_crit_rate=15, base_crit_dmg=50, base_res=30, base_acc=0
where id='503c24fc-1bb0-40ad-8415-b819fbc491c2' and base_hp is null;

-- Weregren
update champions set base_hp=15690, base_atk=1421, base_def=837, base_spd=98, base_crit_rate=15, base_crit_dmg=60, base_res=30, base_acc=0
where id='b4e44edd-e9fe-4327-9caa-462d371df1b1' and base_hp is null;

-- Ethlen
update champions set base_hp=13215, base_atk=1432, base_def=991, base_spd=97, base_crit_rate=15, base_crit_dmg=60, base_res=30, base_acc=0
where id='a64c3653-5522-4240-bf7e-ee23704c2938' and base_hp is null;

-- Loneblade Riab
update champions set base_hp=12060, base_atk=1299, base_def=925, base_spd=96, base_crit_rate=15, base_crit_dmg=57, base_res=30, base_acc=0
where id='85dcabf7-7bbc-41c1-902f-3f7486684abd' and base_hp is null;

-- Treeshield Knott
update champions set base_hp=16020, base_atk=947, base_def=1013, base_spd=101, base_crit_rate=15, base_crit_dmg=50, base_res=30, base_acc=0
where id='498e029e-c0ae-4ede-87ed-d8f4c509bdb0' and base_hp is null;

-- Emic
update champions set base_hp=23130, base_atk=848, base_def=1189, base_spd=105, base_crit_rate=15, base_crit_dmg=50, base_res=50, base_acc=0
where id='a700373d-be35-4da1-83c7-381541a717fb' and base_hp is null;

-- Fyr-Gun Isbeil
update champions set base_hp=13215, base_atk=1542, base_def=881, base_spd=102, base_crit_rate=15, base_crit_dmg=50, base_res=30, base_acc=15
where id='55e03ed1-b948-4f69-9430-52b5b44b56c9' and base_hp is null;

-- Frenzi the Cackler
update champions set base_hp=16680, base_atk=749, base_def=1443, base_spd=100, base_crit_rate=15, base_crit_dmg=50, base_res=30, base_acc=15
where id='ffa31167-a5e6-4625-b75a-5743694a7ca7' and base_hp is null;

-- Aeila
update champions set base_hp=18000, base_atk=1123, base_def=980, base_spd=108, base_crit_rate=15, base_crit_dmg=50, base_res=30, base_acc=0
where id='4e3c73c8-1edf-47f6-b262-00986ab03a19' and base_hp is null;

-- Jagg
update champions set base_hp=15690, base_atk=1531, base_def=1002, base_spd=101, base_crit_rate=15, base_crit_dmg=63, base_res=30, base_acc=10
where id='8cf7dab5-d7d8-4f01-af1f-c22d90a8fc79' and base_hp is null;

-- Sulfuryion
update champions set base_hp=18825, base_atk=1112, base_def=1211, base_spd=109, base_crit_rate=15, base_crit_dmg=50, base_res=30, base_acc=20
where id='016723a2-158b-4e04-9d6a-46b2f371a9b7' and base_hp is null;

-- Sun Wukong
update champions set base_hp=16515, base_atk=1586, base_def=892, base_spd=105, base_crit_rate=15, base_crit_dmg=63, base_res=30, base_acc=10
where id='89293b1f-6b1c-4b40-b793-a7e662d53b42' and base_hp is null;

-- Siegfrund
update champions set base_hp=16350, base_atk=1663, base_def=1101, base_spd=110, base_crit_rate=15, base_crit_dmg=63, base_res=30, base_acc=0
where id='2341c4f3-f43c-4671-8c30-bed99ca6c9a7' and base_hp is null;

-- Gharol
update champions set base_hp=23955, base_atk=958, base_def=1299, base_spd=102, base_crit_rate=15, base_crit_dmg=50, base_res=50, base_acc=20
where id='41ad2872-bfa1-4647-9724-d587e539e008' and base_hp is null;

-- Arbais
update champions set base_hp=22305, base_atk=980, base_def=1387, base_spd=115, base_crit_rate=15, base_crit_dmg=50, base_res=30, base_acc=20
where id='68010857-61fc-4dc1-8280-c7b53ac8350f' and base_hp is null;

-- Mezomel
update champions set base_hp=16680, base_atk=1652, base_def=1090, base_spd=105, base_crit_rate=15, base_crit_dmg=63, base_res=30, base_acc=20
where id='97e4f9b4-8b0b-4422-8dfa-caa690a11076' and base_hp is null;

-- Frolni
update champions set base_hp=22305, base_atk=980, base_def=1387, base_spd=10, base_crit_rate=15, base_crit_dmg=63, base_res=50, base_acc=0
where id='06cae4d7-63b0-40a8-9c12-0aa9b4136cba' and base_hp is null;

-- Vitrius
update champions set base_hp=15855, base_atk=1707, base_def=815, base_spd=100, base_crit_rate=15, base_crit_dmg=63, base_res=40, base_acc=0
where id='ea019155-b47d-42a1-923f-728a093e7d77' and base_hp is null;

-- Togron
update champions set base_hp=21315, base_atk=958, base_def=1200, base_spd=110, base_crit_rate=15, base_crit_dmg=50, base_res=40, base_acc=0
where id='8793e62a-af0c-436c-b718-3209006beb9a' and base_hp is null;

-- Bambus
update champions set base_hp=21480, base_atk=870, base_def=1277, base_spd=110, base_crit_rate=15, base_crit_dmg=50, base_res=30, base_acc=20
where id='98401e02-3594-43b2-8d41-0a0c0011a8ce' and base_hp is null;

-- Pann
update champions set base_hp=14370, base_atk=1443, base_def=903, base_spd=100, base_crit_rate=15, base_crit_dmg=50, base_res=30, base_acc=15
where id='a7286e51-aadc-4cf3-8ea9-08f3618308a3' and base_hp is null;

-- Petrifya
update champions set base_hp=13380, base_atk=1288, base_def=848, base_spd=99, base_crit_rate=15, base_crit_dmg=50, base_res=30, base_acc=10
where id='0b9739f5-1dff-4f9c-8e15-e69251315b22' and base_hp is null;

-- Malkith
update champions set base_hp=16515, base_atk=1079, base_def=1123, base_spd=99, base_crit_rate=15, base_crit_dmg=50, base_res=30, base_acc=15
where id='6c89fa2f-fc68-4841-9638-beb585a52dc3' and base_hp is null;

-- Selinia
update champions set base_hp=13380, base_atk=1266, base_def=870, base_spd=100, base_crit_rate=15, base_crit_dmg=57, base_res=30, base_acc=0
where id='9a881cd0-13d4-479f-b7d5-adbbdbbf641c' and base_hp is null;

-- Meatcarver Tolog
update champions set base_hp=20640, base_atk=672, base_def=980, base_spd=95, base_crit_rate=15, base_crit_dmg=50, base_res=40, base_acc=0
where id='3f4c7d33-ee28-4813-a96a-25b5d0a67fd2' and base_hp is null;

-- Strategos Islin
update champions set base_hp=19485, base_atk=760, base_def=1520, base_spd=102, base_crit_rate=15, base_crit_dmg=50, base_res=50, base_acc=10
where id='ab825a40-6c22-4d40-ac9b-bea7972799d9' and base_hp is null;

-- Neldor
update champions set base_hp=14700, base_atk=1343, base_def=980, base_spd=98, base_crit_rate=15, base_crit_dmg=60, base_res=30, base_acc=0
where id='0eedf45f-fada-4c6c-936f-0411df715995' and base_hp is null;

-- Belletar
update champions set base_hp=21975, base_atk=848, base_def=1266, base_spd=103, base_crit_rate=15, base_crit_dmg=50, base_res=50, base_acc=0
where id='4db794c4-c5ac-47d3-beeb-a58aea1cb241' and base_hp is null;

-- KrokMar the Devourer
update champions set base_hp=22140, base_atk=991, base_def=1112, base_spd=102, base_crit_rate=15, base_crit_dmg=63, base_res=40, base_acc=0
where id='a6b23b96-ffc6-44a8-aca6-a04e5d9fa60c' and base_hp is null;

-- Timit
update champions set base_hp=22635, base_atk=859, base_def=1211, base_spd=99, base_crit_rate=15, base_crit_dmg=50, base_res=45, base_acc=20
where id='1cd23b1a-2dba-4cdb-9094-8df06c3f5828' and base_hp is null;

-- Ostrox
update champions set base_hp=16515, base_atk=1167, base_def=1035, base_spd=98, base_crit_rate=15, base_crit_dmg=50, base_res=30, base_acc=15
where id='7cc3b59e-4a6a-4252-a047-83fedf245268' and base_hp is null;

-- Kaja
update champions set base_hp=19650, base_atk=947, base_def=1321, base_spd=112, base_crit_rate=15, base_crit_dmg=50, base_res=40, base_acc=0
where id='2b22f964-49f7-410c-a22f-5c67c38f0f58' and base_hp is null;

-- Night Queen Krixia
update champions set base_hp=20970, base_atk=1189, base_def=1266, base_spd=110, base_crit_rate=15, base_crit_dmg=50, base_res=30, base_acc=20
where id='0d775c36-6b4d-4903-82f1-606fcd0ffb0a' and base_hp is null;

-- Lady Mikage
update champions set base_hp=21645, base_atk=1200, base_def=1211, base_spd=115, base_crit_rate=15, base_crit_dmg=50, base_res=30, base_acc=20
where id='61b6927f-209f-4ccf-8801-16fdcb4c1e15' and base_hp is null;

-- Tatsu
update champions set base_hp=14700, base_atk=1553, base_def=1046, base_spd=100, base_crit_rate=15, base_crit_dmg=63, base_res=30, base_acc=10
where id='75390a65-4b29-4c13-a906-d0990ca28ea0' and base_hp is null;

-- Xena
update champions set base_hp=15690, base_atk=1542, base_def=1046, base_spd=100, base_crit_rate=15, base_crit_dmg=63, base_res=40, base_acc=0
where id='0d16b8ff-e3f8-4be4-8974-b85c3dae1121' and base_hp is null;

-- Ugir
update champions set base_hp=22800, base_atk=771, base_def=1288, base_spd=105, base_crit_rate=15, base_crit_dmg=50, base_res=40, base_acc=20
where id='3a73a65e-0c18-49b6-add0-38d151ba84db' and base_hp is null;

-- Hierophant Lazarius
update champions set base_hp=19980, base_atk=1233, base_def=1288, base_spd=115, base_crit_rate=15, base_crit_dmg=50, base_res=30, base_acc=20
where id='6989047d-12f6-4d0a-a550-4dd0a9d87833' and base_hp is null;

-- Aphidus
update champions set base_hp=17010, base_atk=1586, base_def=1134, base_spd=103, base_crit_rate=15, base_crit_dmg=63, base_res=30, base_acc=20
where id='5406b5c2-2a6c-42da-81fd-c15c3eeb6be1' and base_hp is null;

-- Tribuck Colwyn
update champions set base_hp=15195, base_atk=727, base_def=1288, base_spd=102, base_crit_rate=15, base_crit_dmg=50, base_res=30, base_acc=10
where id='697fc243-40df-4d25-a6b5-511ac67d9a1a' and base_hp is null;

-- Karilon
update champions set base_hp=19155, base_atk=1189, base_def=1112, base_spd=109, base_crit_rate=15, base_crit_dmg=50, base_res=30, base_acc=20
where id='b29ed6ab-cf26-44e3-aca1-402d8d676e9c' and base_hp is null;

-- Firrol
update champions set base_hp=18330, base_atk=859, base_def=1498, base_spd=100, base_crit_rate=15, base_crit_dmg=50, base_res=50, base_acc=10
where id='9d2b6aae-71de-4a34-a92a-3b8786c783a0' and base_hp is null;

-- Gwyndolin
update champions set base_hp=15855, base_atk=1520, base_def=1002, base_spd=102, base_crit_rate=15, base_crit_dmg=63, base_res=30, base_acc=10
where id='56a3d800-d457-4553-9ef6-3777db79cdb0' and base_hp is null;

-- Blizaar
update champions set base_hp=20145, base_atk=804, base_def=1432, base_spd=102, base_crit_rate=15, base_crit_dmg=50, base_res=50, base_acc=10
where id='dd04a9fe-f974-47f0-baf0-7d6f2d61481b' and base_hp is null;

-- Bovos
update champions set base_hp=19155, base_atk=859, base_def=1167, base_spd=98, base_crit_rate=15, base_crit_dmg=50, base_res=30, base_acc=15
where id='e9091a34-cfea-46ac-8a36-2f4c2dcb1fda' and base_hp is null;

-- Alatreon Blademaster
update champions set base_hp=20805, base_atk=914, base_def=1277, base_spd=110, base_crit_rate=15, base_crit_dmg=50, base_res=40, base_acc=0
where id='a1317120-bd16-490f-aaf0-3eaedaa7f4b8' and base_hp is null;

-- Fatalis Blademaster
update champions set base_hp=23130, base_atk=782, base_def=1255, base_spd=104, base_crit_rate=15, base_crit_dmg=63, base_res=30, base_acc=0
where id='31fbe227-a377-4d1f-bf7d-e9cae67f7a05' and base_hp is null;

-- Rathalos Blademaster
update champions set base_hp=16185, base_atk=1487, base_def=1013, base_spd=105, base_crit_rate=15, base_crit_dmg=63, base_res=30, base_acc=0
where id='d83595d1-8abe-44f5-a1bb-9c0c45719ca0' and base_hp is null;

-- Zinogre Blademaster
update champions set base_hp=17340, base_atk=165, base_def=958, base_spd=104, base_crit_rate=15, base_crit_dmg=63, base_res=30, base_acc=10
where id='e0945e88-df9c-4a07-968d-b431c5c22c0a' and base_hp is null;

-- Wight Queen Ankora
update champions set base_hp=20805, base_atk=908, base_def=1211, base_spd=111, base_crit_rate=15, base_crit_dmg=50, base_res=40, base_acc=0
where id='1eed375c-b9a6-45f2-95c7-545559efea5b' and base_hp is null;

-- Starsage Galathir
update champions set base_hp=22305, base_atk=1013, base_def=1354, base_spd=115, base_crit_rate=15, base_crit_dmg=50, base_res=50, base_acc=0
where id='d4964e4c-67af-4137-87cd-d31687bfe007' and base_hp is null;

-- Alaz
update champions set base_hp=20970, base_atk=980, base_def=1476, base_spd=105, base_crit_rate=15, base_crit_dmg=63, base_res=50, base_acc=0
where id='5220ca59-816b-4ae4-845c-0cbac7bea6b1' and base_hp is null;

-- Highmother Maud
update champions set base_hp=20805, base_atk=925, base_def=1266, base_spd=105, base_crit_rate=15, base_crit_dmg=50, base_res=30, base_acc=20
where id='7b5d14fe-a162-46cf-93ca-27cb06634731' and base_hp is null;

-- Wight King Narses
update champions set base_hp=23955, base_atk=705, base_def=1277, base_spd=101, base_crit_rate=15, base_crit_dmg=63, base_res=40, base_acc=0
where id='7023ffea-67b9-42e8-9b46-87d9aac33a08' and base_hp is null;

-- Acelin
update champions set base_hp=18825, base_atk=760, base_def=1564, base_spd=106, base_crit_rate=15, base_crit_dmg=63, base_res=30, base_acc=0
where id='a25dfaad-e8e8-4031-9ecf-56d334029eb7' and base_hp is null;

-- Boughsmith Flannan
update champions set base_hp=15690, base_atk=617, base_def=1365, base_spd=97, base_crit_rate=15, base_crit_dmg=50, base_res=30, base_acc=10
where id='214270e2-e447-434e-b866-1019fe8a494b' and base_hp is null;

-- Gizmak
update champions set base_hp=22800, base_atk=991, base_def=1343, base_spd=115, base_crit_rate=15, base_crit_dmg=50, base_res=50, base_acc=0
where id='0b7361b7-d41e-4617-83ac-eb796521eb59' and base_hp is null;

-- Grand Oak Padraig
update champions set base_hp=17670, base_atk=1200, base_def=1200, base_spd=112, base_crit_rate=15, base_crit_dmg=50, base_res=40, base_acc=0
where id='19904ab2-c6b2-4d47-bc25-8a5960766493' and base_hp is null;

-- Fyna
update champions set base_hp=18660, base_atk=1123, base_def=1211, base_spd=113, base_crit_rate=15, base_crit_dmg=50, base_res=40, base_acc=0
where id='ea9a0d57-63c2-4f10-a9e1-6576a024183f' and base_hp is null;

-- Khafru
update champions set base_hp=18330, base_atk=749, base_def=1332, base_spd=99, base_crit_rate=15, base_crit_dmg=50, base_res=45, base_acc=0
where id='7c9361ec-9c38-4293-935f-7186843aee96' and base_hp is null;

-- Eostrid
update champions set base_hp=21135, base_atk=1035, base_def=1134, base_spd=115, base_crit_rate=15, base_crit_dmg=50, base_res=30, base_acc=10
where id='c03c3ac3-4430-4de3-aeb4-d541b6b03737' and base_hp is null;

-- Chronicler Adelyn
update champions set base_hp=19650, base_atk=1013, base_def=1255, base_spd=105, base_crit_rate=15, base_crit_dmg=50, base_res=30, base_acc=20
where id='e367d6c7-30c5-4991-95f9-b57130c7b22d' and base_hp is null;

-- Armanz
update champions set base_hp=19320, base_atk=1167, base_def=1123, base_spd=105, base_crit_rate=15, base_crit_dmg=50, base_res=30, base_acc=20
where id='7b64076f-b070-4b76-a26d-d5b6150a24ed' and base_hp is null;

-- Lady of Ireth
update champions set base_hp=20475, base_atk=1035, base_def=1178, base_spd=106, base_crit_rate=15, base_crit_dmg=50, base_res=40, base_acc=0
where id='8812baad-c379-48d1-a775-d1b507b26aa1' and base_hp is null;

-- Toshiro
update champions set base_hp=18660, base_atk=1520, base_def=1090, base_spd=103, base_crit_rate=15, base_crit_dmg=63, base_res=30, base_acc=20
where id='6b6a6574-f30a-4a07-a433-1db2634519c0' and base_hp is null;

-- Shu-Zhen
update champions set base_hp=21645, base_atk=826, base_def=1310, base_spd=110, base_crit_rate=15, base_crit_dmg=50, base_res=30, base_acc=10
where id='d8be564a-861b-4bf3-b143-4d057613a64d' and base_hp is null;

-- Calamitus
update champions set base_hp=16845, base_atk=1553, base_def=1178, base_spd=105, base_crit_rate=15, base_crit_dmg=63, base_res=30, base_acc=20
where id='13af82e7-0703-4747-b42f-52625f5f9c14' and base_hp is null;

-- Valkanen
update champions set base_hp=14865, base_atk=1531, base_def=1057, base_spd=96, base_crit_rate=15, base_crit_dmg=63, base_res=30, base_acc=10
where id='45de3969-2b93-4f1d-9f91-e66ef1fde65a' and base_hp is null;

-- Karnage
update champions set base_hp=19155, base_atk=1476, base_def=1101, base_spd=100, base_crit_rate=15, base_crit_dmg=63, base_res=30, base_acc=20
where id='8ecd698b-784d-4c88-bd9d-67e92350013e' and base_hp is null;

-- Marius the Gallant
update champions set base_hp=19815, base_atk=716, base_def=1542, base_spd=110, base_crit_rate=15, base_crit_dmg=50, base_res=30, base_acc=20
where id='1085daa2-1eec-44d1-a6fe-8c9635b44bb5' and base_hp is null;

-- Falmond
update champions set base_hp=14535, base_atk=1564, base_def=1046, base_spd=98, base_crit_rate=15, base_crit_dmg=63, base_res=40, base_acc=0
where id='7060d2de-4936-456e-bb0d-24c3eea93c0f' and base_hp is null;

-- Wallmaster Othorion
update champions set base_hp=15690, base_atk=1454, base_def=1079, base_spd=100, base_crit_rate=15, base_crit_dmg=63, base_res=30, base_acc=10
where id='0a442031-0625-4684-bacb-565c9ee5617f' and base_hp is null;

-- Androc
update champions set base_hp=20640, base_atk=859, base_def=1619, base_spd=110, base_crit_rate=15, base_crit_dmg=50, base_res=50, base_acc=0
where id='46bbb3bb-6b80-4364-9083-27b32649599d' and base_hp is null;

-- Vault Keeper Wixwell
update champions set base_hp=19650, base_atk=771, base_def=7498, base_spd=102, base_crit_rate=15, base_crit_dmg=50, base_res=50, base_acc=0
where id='bcf948cb-ef87-4a46-b5ed-ac5e296548e4' and base_hp is null;

-- Teryx
update champions set base_hp=16185, base_atk=771, base_def=1178, base_spd=99, base_crit_rate=15, base_crit_dmg=50, base_res=30, base_acc=10
where id='e158601f-6542-49cf-adf1-33e65d52a315' and base_hp is null;

-- Arwydd
update champions set base_hp=14205, base_atk=1365, base_def=991, base_spd=97, base_crit_rate=15, base_crit_dmg=60, base_res=30, base_acc=0
where id='487efd8e-2710-4820-8cc4-308d6479705f' and base_hp is null;

-- Dune Lord Greggor
update champions set base_hp=19485, base_atk=793, base_def=1487, base_spd=105, base_crit_rate=15, base_crit_dmg=50, base_res=50, base_acc=10
where id='2989fb5a-a1f5-473b-9b13-315e660afc2e' and base_hp is null;

-- Senna
update champions set base_hp=18990, base_atk=1112, base_def=1200, base_spd=113, base_crit_rate=15, base_crit_dmg=50, base_res=40, base_acc=0
where id='186b37fc-bb5f-4542-9457-09ef211de682' and base_hp is null;

-- Giath
update champions set base_hp=18495, base_atk=925, base_def=1421, base_spd=104, base_crit_rate=15, base_crit_dmg=50, base_res=50, base_acc=0
where id='d191a575-ef71-4e3e-b2ca-77463c4060f7' and base_hp is null;

-- Glaicad
update champions set base_hp=21480, base_atk=782, base_def=1365, base_spd=112, base_crit_rate=15, base_crit_dmg=50, base_res=40, base_acc=0
where id='098288e1-458c-4f97-a74b-b367feb7c1f7' and base_hp is null;

-- The Incarnate
update champions set base_hp=19320, base_atk=804, base_def=1487, base_spd=100, base_crit_rate=15, base_crit_dmg=50, base_res=40, base_acc=20
where id='88b27956-00d7-46de-854d-c3d81492987a' and base_hp is null;

-- Nais
update champions set base_hp=19980, base_atk=1663, base_def=859, base_spd=105, base_crit_rate=15, base_crit_dmg=63, base_res=30, base_acc=0
where id='a3efe80a-1372-4614-8f55-25849028d5eb' and base_hp is null;

-- Yncensa
update champions set base_hp=18660, base_atk=1200, base_def=1134, base_spd=110, base_crit_rate=15, base_crit_dmg=50, base_res=30, base_acc=20
where id='c923f52d-7e82-46a3-9794-abc62a0abddb' and base_hp is null;

-- Mathias
update champions set base_hp=22965, base_atk=914, base_def=1134, base_spd=100, base_crit_rate=15, base_crit_dmg=50, base_res=50, base_acc=10
where id='0b1d4753-7914-4c58-91db-9b5aca9cfff2' and base_hp is null;

-- Vizug
update champions set base_hp=22470, base_atk=881, base_def=1200, base_spd=106, base_crit_rate=15, base_crit_dmg=50, base_res=30, base_acc=20
where id='66c6c097-12b8-4db4-a6ce-9be33574d825' and base_hp is null;

-- Slixus
update champions set base_hp=14535, base_atk=1454, base_def=881, base_spd=100, base_crit_rate=15, base_crit_dmg=60, base_res=30, base_acc=0
where id='7236cd06-e01f-48b3-a8fe-3d3d3f8321dd' and base_hp is null;

-- Ingid
update champions set base_hp=16515, base_atk=991, base_def=936, base_spd=98, base_crit_rate=15, base_crit_dmg=50, base_res=30, base_acc=10
where id='ff22a265-cb14-4cb1-816f-152aed57211d' and base_hp is null;

-- Komidus
update champions set base_hp=21975, base_atk=1035, base_def=1354, base_spd=110, base_crit_rate=15, base_crit_dmg=50, base_res=50, base_acc=20
where id='ab3a4318-82c2-491c-a1f2-0d3d8791edfc' and base_hp is null;

-- Legate Teox
update champions set base_hp=17175, base_atk=1520, base_def=914, base_spd=103, base_crit_rate=15, base_crit_dmg=63, base_res=40, base_acc=0
where id='6962ee3d-07e6-47fb-8e1e-6a41ba8e3509' and base_hp is null;

-- Authoratrix Lamasu
update champions set base_hp=20805, base_atk=936, base_def=1255, base_spd=115, base_crit_rate=15, base_crit_dmg=50, base_res=30, base_acc=20
where id='a9504e74-b2cc-4a3a-aa41-0fea63d09d0e' and base_hp is null;

-- Diamant
update champions set base_hp=19650, base_atk=1145, base_def=1123, base_spd=112, base_crit_rate=15, base_crit_dmg=50, base_res=40, base_acc=0
where id='7bbf2e4f-21b2-46aa-816f-aa8128fb27d8' and base_hp is null;

-- Packmaster Shyek
update champions set base_hp=22305, base_atk=870, base_def=1222, base_spd=98, base_crit_rate=15, base_crit_dmg=50, base_res=50, base_acc=10
where id='a91a584c-68b1-48dc-809e-214eeef0cebf' and base_hp is null;

-- Ashnar Dragonsoul
update champions set base_hp=23130, base_atk=1013, base_def=1299, base_spd=105, base_crit_rate=15, base_crit_dmg=63, base_res=30, base_acc=20
where id='bcaef84c-eaf3-4894-97ae-a1cc10dab6ea' and base_hp is null;

-- Bolint
update champions set base_hp=22140, base_atk=980, base_def=1123, base_spd=104, base_crit_rate=15, base_crit_dmg=50, base_res=30, base_acc=20
where id='25b35306-c41c-40a9-b448-94753f6e2244' and base_hp is null;

-- Loki
update champions set base_hp=19155, base_atk=980, base_def=1321, base_spd=105, base_crit_rate=15, base_crit_dmg=50, base_res=40, base_acc=20
where id='2fe5f99c-4f12-4d95-8741-cd65d615b445' and base_hp is null;

-- Freyja
update champions set base_hp=20310, base_atk=815, base_def=1409, base_spd=110, base_crit_rate=15, base_crit_dmg=50, base_res=50, base_acc=0
where id='66f01377-9e57-45f2-a833-e7cefaa2af9d' and base_hp is null;

-- Odin
update champions set base_hp=18825, base_atk=1002, base_def=1321, base_spd=105, base_crit_rate=15, base_crit_dmg=50, base_res=30, base_acc=10
where id='1672a0e0-a46d-4d7e-b17c-f5ed3e6c3a6f' and base_hp is null;

-- Thor
update champions set base_hp=15690, base_atk=1553, base_def=980, base_spd=105, base_crit_rate=15, base_crit_dmg=63, base_res=30, base_acc=10
where id='d8b35f5c-74dd-4ee3-9818-c75dfe1dafae' and base_hp is null;

-- Dyana
update champions set base_hp=15525, base_atk=1421, base_def=848, base_spd=104, base_crit_rate=15, base_crit_dmg=60, base_res=30, base_acc=0
where id='2f29c0bf-7e5d-4bd1-9cf4-717e11728c4c' and base_hp is null;

-- Xenomorph
update champions set base_hp=17670, base_atk=1365, base_def=1035, base_spd=102, base_crit_rate=15, base_crit_dmg=63, base_res=30, base_acc=10
where id='4c8eaa38-1e82-4e1a-91f7-aad86bbc23b2' and base_hp is null;

-- Pelops the Victor
update champions set base_hp=22800, base_atk=749, base_def=1310, base_spd=97, base_crit_rate=15, base_crit_dmg=50, base_res=50, base_acc=10
where id='c372b462-30bf-495b-b5ab-c5ffc90a63e8' and base_hp is null;

-- Michelangelo
update champions set base_hp=15360, base_atk=1520, base_def=1035, base_spd=99, base_crit_rate=15, base_crit_dmg=63, base_res=30, base_acc=10
where id='fc4ad157-66c8-431a-a925-5ad23cf0db64' and base_hp is null;

-- Donatello
update champions set base_hp=21810, base_atk=1013, base_def=1112, base_spd=108, base_crit_rate=15, base_crit_dmg=50, base_res=45, base_acc=0
where id='5ca3ff71-8c61-46c5-89dc-84e18beec90b' and base_hp is null;

-- Ezio Auditore
update champions set base_hp=16020, base_atk=1498, base_def=1013, base_spd=99, base_crit_rate=15, base_crit_dmg=63, base_res=30, base_acc=0
where id='00404172-1b85-49eb-b353-a0aaaf9cca1f' and base_hp is null;

