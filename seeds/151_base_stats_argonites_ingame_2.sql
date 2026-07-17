-- ============================================================================
-- Seed 151 — Argonites base stats from IN-GAME SCREENSHOTS, batch 2 (TIER-1)
--
-- SOURCE: Mike's own in-game champion screens, 6* Lvl 60, captured 2026-07-17.
-- TIER-1 per the CLAUDE.md source hierarchy. Continues seed 150.
--
-- FILLS 5. Argonites confirmed-real gaps: 7 -> 2 (Acolyte of the Slither,
-- Crimson Pegason still outstanding).
--
-- VALIDATION: every HP is a multiple of 15 (rule verified 3/3, now in CLAUDE.md).
-- The generator THROWS on a failing value and asserts exactly one row matches
-- each name, so neither a transcription slip nor an ambiguous name can land.
-- CRIT written as PERCENT, matching seeds 146/149/150.
--
-- ⚠ SECOND MISSING CHAMPION FOUND: "Xanthe Seaflower" (Epic, Defense, Argonites —
-- HP 18,495 / ATK 738 / DEF 1,332 / SPD 97 / C.RATE 15% / C.DMG 50% / RES 30 /
-- ACC 15) HAS NO ROW in `champions` — no match on her name or on "Seaflower".
-- That is TWO missing champions from ~16 Argonites screenshotted (with "Aria the
-- Golden Hope", seed 150). Both are Argonites. The stat worklist counts only rows
-- that EXIST, so it is structurally blind to this class of gap — our roster is
-- incomplete and we do not know by how much. Her stats are recorded here so the
-- capture is not lost when the INSERT is written.
--
-- ⚠ THE GROUP C PAIRS ARE STILL UNRESOLVED, and this batch sharpens the question.
-- Every champion filled here has a short-name twin that is ALSO empty:
--     Tidemaster Dexikos (Magic)  <-> Dexikos (Spirit)
--     Lionsguard Galatea (Spirit) <-> Galatea (Magic)
--     Stonebound Thisbe  (Magic)  <-> Thisbe  (Spirit)
--     Deephook Nagis     (Void)   <-> Nagis   (Force)
-- Note the affinities DISAGREE within every pair — the same signature as the
-- Group A stubs (Othorion Force vs Wallmaster Othorion Magic). Either the
-- Argonites genuinely ship base + evolved forms as separate champions (in which
-- case these are 4 real champions we have no stats for), or the short rows are
-- phantoms like Group A. The DB cannot answer this; the in-game Index can.
-- NOT resolved here — see knowledge/MISSING_BASE_STATS.md Group C.
--
-- FILL-ONLY, REPLAY-SAFE: guarded `and base_hp is null`, keyed on champions.id.
-- ============================================================================

-- Tidemaster Dexikos (Epic, Argonites)
update champions set base_hp=21315, base_atk=837, base_def=1046, base_spd=107, base_crit_rate=15, base_crit_dmg=50, base_res=30, base_acc=0
where id='3dfbfd27-2a35-49ee-a26b-638336684954' and base_hp is null;

-- Lionsguard Galatea (Epic, Argonites)
update champions set base_hp=16515, base_atk=1321, base_def=881, base_spd=97, base_crit_rate=15, base_crit_dmg=60, base_res=30, base_acc=0
where id='e7cf2b73-12fb-46ec-8b17-da8abef0a44a' and base_hp is null;

-- Stonebound Thisbe (Epic, Argonites)
update champions set base_hp=18165, base_atk=958, base_def=1134, base_spd=100, base_crit_rate=15, base_crit_dmg=50, base_res=30, base_acc=15
where id='c67dbcad-af36-49ef-90b7-67c9618a3745' and base_hp is null;

-- Deephook Nagis (Epic, Argonites)
update champions set base_hp=17175, base_atk=892, base_def=1266, base_spd=98, base_crit_rate=15, base_crit_dmg=50, base_res=45, base_acc=0
where id='d7113da8-d4b3-4503-9bd7-f450cadb1ced' and base_hp is null;

-- Bladerider (Rare, Argonites)
update champions set base_hp=14865, base_atk=1310, base_def=727, base_spd=98, base_crit_rate=15, base_crit_dmg=57, base_res=30, base_acc=0
where id='dd3f0669-f551-4253-b891-d3c8378a456e' and base_hp is null;
