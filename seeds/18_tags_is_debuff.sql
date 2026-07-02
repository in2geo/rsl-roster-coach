-- ============================================================================
-- Classify tags as debuffs (is_debuff=true) for accuracy-aware threshold checks.
-- Rule: a negative effect placed on an ENEMY = debuff. Buffs/auras/heals/damage/
-- self-effects = false (the column default). Any tag with bypasses_accuracy_check
-- =true MUST be is_debuff=true (you can only bypass a check that applies) — both
-- such tags (AoE Decrease Turn Meter, True Fear) are in the list below.
--
-- TWO Decrease Turn Meter tags, by design (do NOT add a third):
--   'Decrease Turn Meter'     = the LANDED, RESISTIBLE variant → is_debuff=true,
--                               bypasses_accuracy_check=false (accuracy-gated).
--   'AoE Decrease Turn Meter' = the cannot-be-resisted / instant variant →
--                               is_debuff=true, bypasses_accuracy_check=true.
-- Human-decided 2026-07-01 (Mike). The plain tag's description is updated below to
-- state the landed/resistible semantics explicitly (it previously just said
-- "Reduces an enemy's Turn Meter", which didn't justify the ACC gate). Use the AoE/
-- bypass tag for any instant TM reduction that ignores ACC.
-- ============================================================================

-- Make the plain Decrease Turn Meter description self-justifying for is_debuff=true.
update tags
   set description = 'Reduces an enemy''s Turn Meter as a LANDED, resistible debuff — subject to the ACC/RES check. For instant / cannot-be-resisted TM reduction, use the AoE Decrease Turn Meter tag (bypasses_accuracy_check=true) instead.'
 where name = 'Decrease Turn Meter';

update tags set is_debuff = true
 where name in (
   -- crowd control
   'Stun', 'AoE Stun', 'Freeze', 'AoE Freeze', 'Sleep', 'AoE Sleep',
   'Fear', 'True Fear', 'Provoke',
   -- stat reductions on enemies
   'Decrease Attack', 'Decrease Defense', 'Decrease Speed', 'Decrease ACC',
   'AoE Decrease Turn Meter', 'Decrease Turn Meter',  -- plain = landed/resistible (see note above)
   -- damage-over-time / anti-heal / anti-revive
   'Poison', 'HP Burn', 'Weaken', 'Heal Reduction', 'Block Revive',
   -- skill/buff denial on enemies
   'Block Buffs', 'Block Cooldowns', 'Block Active Skills',
   -- targeting / detonation
   'Hex', 'Bomb'
 );

-- Consistency guard: every accuracy-bypassing tag must be a debuff.
do $$
declare bad int;
begin
  select count(*) into bad from tags where bypasses_accuracy_check = true and is_debuff = false;
  if bad > 0 then raise exception 'bypasses_accuracy_check=true but is_debuff=false on % tag(s)', bad; end if;
end $$;
