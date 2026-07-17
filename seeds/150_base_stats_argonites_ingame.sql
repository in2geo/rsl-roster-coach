-- ============================================================================
-- Seed 150 — Argonites base stats from IN-GAME SCREENSHOTS (TIER-1)
--
-- SOURCE: Mike's own in-game champion screens, 6* Lvl 60, captured 2026-07-17.
-- This is TIER-1 under the CLAUDE.md source hierarchy — the game client's own
-- numbers, the highest-quality source available. Transcribed by hand from the
-- screenshots, all 8 stats per champion.
--
-- WHY ARGONITES FIRST: it is the largest single block of the remaining gap (15 of
-- the 59 confirmed-real gaps after seed 149). Argonites + Sylvan Watchers are the
-- newest factions, which is exactly why no community bulk source covers them.
--
-- FILLS 8.
--
-- VALIDATION: every HP is a multiple of 15 (the rule verified 3/3 in seed 149 and
-- now promoted to CLAUDE.md). The generator THROWS if any value fails, so a
-- transcription slip cannot land silently.
--
-- CRIT written as PERCENT (15 / 63), matching seeds 146/149 and what
-- estimate-stats.js consumes. The cards read "15%" / "63%".
--
-- ⚠ TWO FINDINGS FROM THIS BATCH — both need a decision, neither is fixed here:
--
--   1. "Aria the Golden Hope" (Legendary, Argonites) HAS NO ROW AT ALL. Mike
--      screenshotted her; `champions` has no match on name or on "Golden Hope".
--      This is a MISSING CHAMPION, not a missing stat — a different class of gap
--      than the worklist tracks, and evidence the roster itself is incomplete.
--      Needs an INSERT (with skills/tags/aura), not an UPDATE. Not done here.
--
--   2. OUR ARGONITE NAMES ARE TRUNCATED. The in-game names are longer than what
--      we store: "Phemo" -> "Phemo the Shepherd", "Keberon" -> "Keberon the
--      Underflame", "Knosson" -> "Knosson the Bronze Bull", "Pelagus" ->
--      "Pelagus the Wavewalker", "Tekteon" -> "Tekteon Fissureflesh".
--      DELIBERATELY NOT RENAMED HERE: renaming is a separate change that should
--      go through champion_aliases (which already exists, 421 rows) rather than
--      mutating champions.name, and it interacts with the duplicate-row problem
--      below. Recorded so it is not lost.
--
-- ⚠ CONTEXT — the short-name duplicate problem (knowledge/MISSING_BASE_STATS.md):
-- 56 of the 135 "missing" rows are short-name STUBS duplicating a populated
-- full-name row (Othorion / Wallmaster Othorion). NOTE the Argonites are the
-- INVERSE case: here the SHORT name is the real row (it carries skills/tags) and
-- there is no long-name row at all. So "short name" does NOT imply "phantom" —
-- the DB is simply inconsistent about which form it stores. Do not write a
-- blanket rule off either pattern.
--
-- ALREADY CORRECT (no statement emitted): "Pelops the Victor" was screenshotted
-- and our live row already matches on ALL 8 (22800/749/1310/97/15/50/50/10). A
-- free Tier-1 confirmation that the existing corpus is sound where it is filled.
--
-- FILL-ONLY, REPLAY-SAFE: guarded `and base_hp is null`, keyed on champions.id.
-- The generator also asserts exactly one row matches each name before emitting.
-- ============================================================================

-- Kassandra (Legendary, Argonites)
-- Assassin's Creed collab — omitted by both community sheets
update champions set base_hp=16350, base_atk=1343, base_def=1145, base_spd=101, base_crit_rate=15, base_crit_dmg=63, base_res=30, base_acc=0
where id='db839513-9cb3-42a7-8a0b-2463d4785350' and base_hp is null;

-- Glorious Pallas (Legendary, Argonites)
update champions set base_hp=21810, base_atk=826, base_def=1299, base_spd=109, base_crit_rate=15, base_crit_dmg=50, base_res=50, base_acc=0
where id='95853c5c-716f-488f-bd92-5d9066bf9a06' and base_hp is null;

-- Phemo the Shepherd (Legendary, Argonites)
-- NAME: in-game reads "Phemo the Shepherd"; our row is "Phemo". Not renamed here (see header).
update champions set base_hp=17835, base_atk=870, base_def=1520, base_spd=99, base_crit_rate=15, base_crit_dmg=50, base_res=40, base_acc=20
where id='9d87987f-60d4-4da4-bc9a-bf38b38961f2' and base_hp is null;

-- Keberon the Underflame (Legendary, Argonites)
-- NAME: in-game reads "Keberon the Underflame"; our row is "Keberon". Not renamed here (see header).
update champions set base_hp=15030, base_atk=1454, base_def=1123, base_spd=99, base_crit_rate=15, base_crit_dmg=63, base_res=30, base_acc=10
where id='4ff3953d-6213-4f49-b9e7-b746ec939010' and base_hp is null;

-- Knosson the Bronze Bull (Legendary, Argonites)
-- NAME: in-game reads "Knosson the Bronze Bull"; our row is "Knosson". Not renamed here (see header).
update champions set base_hp=23130, base_atk=738, base_def=1299, base_spd=97, base_crit_rate=15, base_crit_dmg=63, base_res=30, base_acc=10
where id='da03cf65-2178-4a80-8369-8ec87dfa5e8f' and base_hp is null;

-- Pelagus the Wavewalker (Legendary, Argonites)
-- NAME: in-game reads "Pelagus the Wavewalker"; our row is "Pelagus". Not renamed here (see header).
update champions set base_hp=20805, base_atk=848, base_def=1343, base_spd=115, base_crit_rate=15, base_crit_dmg=50, base_res=30, base_acc=10
where id='aa43fc35-4aa7-4503-bd56-7d9d285d1b77' and base_hp is null;

-- Storm Herald Hekaton (Legendary, Argonites)
update champions set base_hp=18660, base_atk=727, base_def=1608, base_spd=99, base_crit_rate=15, base_crit_dmg=50, base_res=50, base_acc=0
where id='b6106249-f2b4-4fc6-a478-d72b4d7bc28c' and base_hp is null;

-- Tekteon Fissureflesh (Legendary, Argonites)
-- NAME: in-game reads "Tekteon Fissureflesh"; our row is "Tekteon". Not renamed here (see header).
update champions set base_hp=22305, base_atk=705, base_def=1387, base_spd=98, base_crit_rate=15, base_crit_dmg=63, base_res=40, base_acc=0
where id='eafe0c3a-fcfd-4406-b57b-9cd08a8dbb0f' and base_hp is null;
