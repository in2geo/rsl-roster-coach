-- seeds/2026-08-06_owned_maxed_booked_cooldowns.sql
-- Backfill champion_skills.cooldown_booked for the owned+maxed champions (across all 8 Gestal
-- accounts) that were hitting a booked-cd gap in the sim — the roster-wide follow-up to
-- 2026-08-05_pool_booked_cooldowns.sql. Same rationale: a MAXED active skill recharges on its
-- BOOKED cooldown (lib/sim/dragon-fixture.js); a NULL leaves it stuck at base and self-flags.
--
-- SOURCE (Tier-2 human read, per CLAUDE.md source hierarchy — factual book-progression data):
-- AyumiLove "Level up" tables. EVERY value double-cross-checked and only landed when BOTH held:
--   (a) the source's stated base cd == our champion_skills.cooldown_base, AND
--   (b) the source's upgrade-level count == the captured Gestal per-skill maxLevel.
-- Written back to the master worksheet 'Skills' sheet the SAME session (writeback discipline).
--
--   Criodan the Blue  A2 Razor Hail          base 4, maxLvl 5, Lvl5 CD-1        -> 3
--   Criodan the Blue  A3 Blessing of the Blue base 5, maxLvl 3, Lvl2&3 CD-1      -> 3
--   Deacon Armstrong  A2 Sweeping Retribution base 4, maxLvl 6, Lvl6 CD-1        -> 3
--   Deacon Armstrong  A3 Time Compression    base 5, maxLvl 3, Lvl2&3 CD-1       -> 3
--   Geomancer         A2 Creeping Petrify    base 4, maxLvl 5, Lvl5 CD-1         -> 3
--   Geomancer         A3 Quicksand Grasp     base 5, maxLvl 7, Lvl6&7 CD-1       -> 3
--   Neldor            A2 Dancing Razor       base 4, maxLvl 6, Lvl6 CD-1         -> 3
--   Neldor            A3 Chromatic Cross     base 5, maxLvl 6, Lvl6 CD-1         -> 4
--   Donatello         A2 Shellshocker        base 6, maxLvl 4, Lvl3&4 CD-1       -> 4
--   Donatello         A3 Secret of the Ooze  base 6, maxLvl 4, Lvl2&3&4 CD-1     -> 3
--   Stonebound Thisbe A2 Fangs Of Quartz     base 5, maxLvl 6, Lvl5&6 CD-1       -> 3
--   Stonebound Thisbe A3 Heart Of Flint      base 5, maxLvl 5, Lvl4&5 CD-1       -> 3
--   Tagoar            A2 Charge Cant         base 5, maxLvl 5, Lvl4&5 CD-1       -> 3
--   Tagoar            A3 Rise And Fight      base 7, maxLvl 3, Lvl2&3 CD-1       -> 5
--
-- DEFERRED (data-integrity flag, NOT filled): Morag Bronzelock A2/A3. Her DB skill mechanics are
-- correct but her skill NAMES (Rallying Strength / Coordinated Assault) match no community DB, and
-- her A3 base cd is DISPUTED (DB 4 vs every external source 6, whose 3-level/two-CD-1 book structure
-- also matches her Gestal maxLevel of 3). A wrong base cd makes the booked value wrong too, so this
-- needs a Tier-1 base-cd + name re-capture before backfilling. See session notes 2026-08-06.
--
-- Matched by canonical champions.name + slot (Neldor's DB canonical is "Neldor"). Bare integer
-- strings to match existing convention. Apply via tools/apply-seed-pooler.mjs.

update champion_skills s
set cooldown_booked = v.booked
from (values
  ('Criodan the Blue',  'A2', '3'),
  ('Criodan the Blue',  'A3', '3'),
  ('Deacon Armstrong',  'A2', '3'),
  ('Deacon Armstrong',  'A3', '3'),
  ('Geomancer',         'A2', '3'),
  ('Geomancer',         'A3', '3'),
  ('Neldor',            'A2', '3'),
  ('Neldor',            'A3', '4'),
  ('Donatello',         'A2', '4'),
  ('Donatello',         'A3', '3'),
  ('Stonebound Thisbe', 'A2', '3'),
  ('Stonebound Thisbe', 'A3', '3'),
  ('Tagoar',            'A2', '3'),
  ('Tagoar',            'A3', '5')
) as v(champ, slot, booked)
join champions c on c.name = v.champ
where s.champion_id = c.id and s.slot = v.slot;
