-- seeds/2026-08-05_pool_booked_cooldowns.sql
-- Fill champion_skills.cooldown_booked for CB-pool champs whose value was NEVER captured
-- (NULL in both the master worksheet AND the DB — verified 2026-08-05, not lost on import).
--
-- WHY IT MATTERS: the simulator swaps a MAXED active skill to its BOOKED cooldown
-- (lib/sim/dragon-fixture.js). A NULL booked value leaves a maxed skill stuck at BASE cd and
-- self-flags via bookedCdGaps — Michelangelo's maxed A3 (Shell Cyclone) was the one ACTIVE gap
-- (he is maxed 4/4 → should recharge on 4, not 5). Hilvi/Artak/Michelangelo-A2 are LATENT
-- (those skills aren't maxed on the current DonaHilvi build) but are filled now so a future
-- re-sync that books them cannot silently reopen the gap.
--
-- SOURCE (Tier-2 human read, per CLAUDE.md source hierarchy — factual book-progression data):
-- AyumiLove skill "Level up" tables. Each value cross-checked against the captured per-skill
-- maxLevel (Gestal), the strongest internal consistency check available:
--   Michelangelo A2 Express Delivery  base 4, maxLvl 4, Lvl4=Cooldown-1            -> booked 3
--   Michelangelo A3 Shell Cyclone     base 5, maxLvl 4, Lvl4=Cooldown-1            -> booked 4  (THE FIX)
--   Hilvi        A2 Embittering Cold   base 5, maxLvl 3, Lvl2&3=Cooldown-1          -> booked 3
--   Hilvi        A3 Ward of the Glacier base 6, maxLvl 3, Lvl2&3=Cooldown-1         -> booked 4
--   Artak        A2 Dogs of War        base 4, maxLvl 5, Lvl5=Cooldown-1            -> booked 3
--   Artak        A3 Purifyre           base 4, maxLvl 5, Lvl5=Cooldown-1            -> booked 3
-- Ninja and Mausoleum Mage already carry booked cooldowns (worksheet + DB) — untouched.
-- Written back to the master worksheet 'Skills' sheet the SAME session (writeback discipline).
--
-- Stored as bare integer strings to match the existing Ninja/Mausoleum Mage convention
-- (the column is text; the sim parses the leading number either way). Apply via tools/apply-seed-pooler.mjs.

update champion_skills s
set cooldown_booked = v.booked
from (values
  ('Michelangelo', 'A2', '3'),
  ('Michelangelo', 'A3', '4'),
  ('Hilvi',        'A2', '3'),
  ('Hilvi',        'A3', '4'),
  ('Artak',        'A2', '3'),
  ('Artak',        'A3', '3')
) as v(champ, slot, booked)
join champions c on c.name = v.champ
where s.champion_id = c.id and s.slot = v.slot;
