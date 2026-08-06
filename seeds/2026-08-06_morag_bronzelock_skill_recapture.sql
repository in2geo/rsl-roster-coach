-- seeds/2026-08-06_morag_bronzelock_skill_recapture.sql
-- DATA-INTEGRITY re-capture of Morag Bronzelock (champions.id=e4d7c304-25c9-4ca3-a465-4bc0a6a5b755)
-- from TIER-1 in-game Index screenshots (Mike-supplied 2026-08-06). Discovered while backfilling
-- booked cooldowns: her whole skill row was mis-captured by the original "worksheet Skills tab
-- 2026-07-11" source. The mechanics were roughly right but the NAMES were invented and the A3 base
-- cooldown was wrong — a booked-cd fill on top would have compounded the error, so it was deferred
-- until the authoritative source arrived.
--
-- ERRORS CORRECTED (old -> verified in-game):
--   A1 name "Bronze Sword"        -> "Raw Iron Slab";   summary added "2 times" + ignore [Shield]
--   A2 name "Rallying Strength"   -> "Outrage"          (cd 4; booked 3 via Lvl4 Cooldown-1)
--   A3 name "Coordinated Assault" -> "Raider Captain";  base cd 4 -> 6 (WRONG in DB); booked 4 (Lvl2&3 CD-1)
--                                    summary added "allies ... use their default skills" + "any enemy" (was "the target")
--   A4 name "Dwarven Resilience"  -> "Test This Might [P]"; ascension_required 0 -> 3 (Index: "Unlocks at Ascension 3")
--                                    summary "placed by this Champion" (was "with the default skill")
-- Book progressions cross-checked against Gestal per-skill maxLevel (A1 5, A2 4, A3 3) — all consistent.
-- Written back to the master worksheet 'Skills' sheet the SAME session. Apply via tools/apply-seed-pooler.mjs.

update champion_skills s set
  skill_name = 'Raw Iron Slab',
  skill_summary = 'Attacks 1 enemy 2 times. Each hit will ignore [Shield] buffs.',
  verification_status = 'verified',
  source = 'in-game Index (Mike screenshots) 2026-08-06',
  review_notes = 'Re-capture 2026-08-06: prior name "Bronze Sword" + summary "Attacks 1 enemy." were mis-captured.'
from champions c where s.champion_id = c.id and c.name = 'Morag Bronzelock' and s.slot = 'A1';

update champion_skills s set
  skill_name = 'Outrage',
  skill_summary = 'Attacks all enemies. Places a 25% [Strengthen] buff on all allies for 2 turns.',
  cooldown_base = '4',
  cooldown_booked = '3',
  verification_status = 'verified',
  source = 'in-game Index (Mike screenshots) 2026-08-06',
  review_notes = 'Re-capture 2026-08-06: prior name "Rallying Strength". Base cd 4, booked 3 (Lvl4 Cooldown-1).'
from champions c where s.champion_id = c.id and c.name = 'Morag Bronzelock' and s.slot = 'A2';

update champion_skills s set
  skill_name = 'Raider Captain',
  skill_summary = 'Teams up with 2 random allies to attack a single enemy. The allies joining the attack will always use their default skills. Grants an Extra Turn if any enemy is killed.',
  cooldown_base = '6',
  cooldown_booked = '4',
  verification_status = 'verified',
  source = 'in-game Index (Mike screenshots) 2026-08-06',
  review_notes = 'Re-capture 2026-08-06: prior name "Coordinated Assault"; base cd was WRONG (4 -> 6); added "default skills" clause + "any enemy" (was "the target"). Booked 4 (Lvl2&3 Cooldown-1).'
from champions c where s.champion_id = c.id and c.name = 'Morag Bronzelock' and s.slot = 'A3';

update champion_skills s set
  skill_name = 'Test This Might [P]',
  skill_summary = 'Counterattacks when hit while under a [Strengthen] buff placed by this Champion.',
  ascension_required = 3,
  verification_status = 'verified',
  source = 'in-game Index (Mike screenshots) 2026-08-06',
  review_notes = 'Re-capture 2026-08-06: prior name "Dwarven Resilience"; Index shows "Unlocks at Ascension 3"; summary "placed by this Champion" (was "with the default skill").'
from champions c where s.champion_id = c.id and c.name = 'Morag Bronzelock' and s.slot = 'A4';
