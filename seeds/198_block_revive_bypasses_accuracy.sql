-- seeds/198_block_revive_bypasses_accuracy.sql
--
-- FIX: `Block Revive` is flagged as requiring Accuracy. It does not.
--
-- RULING (Mike, 2026-07-19) — with the mechanism, not just the outcome:
--   "Because Block Revive applies immediately after an enemy champion dies, the target is considered
--    'dead' at the moment of placement. Dead champions have no stats and cannot resist anything,
--    rendering the standard Accuracy vs. Resistance check irrelevant."
--
-- So the ACC-vs-RES check never happens — not because the skill is unresistable by fiat (policy #17,
-- which is about "cannot be resisted" clauses on a LIVING target), but because there is no living
-- target to run the check against. Different reason, same scoring consequence.
--
-- WHY IT MATTERS (Ice Golem, the dungeon that prompted this):
--   Klyssus's Frigid Vengeance REVIVES dead minions to 100% HP at each of five HP thresholds
--   (80/60/45/30/15%), and alive minions make that retaliation dramatically worse — it ignores 50% of
--   each enemy's DEF PER ALIVE ALLY and its [Freeze] chance rises 40% PER ALIVE ALLY (2 alive => 100%
--   DEF-ignore and a guaranteed team Freeze). Block Revive is therefore close to a GATE mechanic on IG.
--
--   With the old (wrong) flag the engine discounted every Block Revive champion by ACC-vs-RES land
--   rate, and Numbing Chill's 50% [Decrease ACC] would have appeared to attack the player's ability to
--   stop the revives. That interaction is NOT REAL and any conclusion resting on it should be dropped.
--   Correctly flagged, Block Revive is buildable-independent — an accessible answer on any roster that
--   owns one, which is why its bucket weight (20-25) takes no ACC discount.
--
-- SCOPE: this row only. Whether other effects share the "target is already dead, so nothing resists"
-- property is a separate question and is NOT assumed here — do not batch-apply this reasoning.
--
-- Verify before/after:
--   select name, is_debuff, bypasses_accuracy_check from tags where name = 'Block Revive';

update tags
   set bypasses_accuracy_check = true
 where name = 'Block Revive';
