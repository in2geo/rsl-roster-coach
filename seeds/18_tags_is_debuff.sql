-- ============================================================================
-- Classify tags as debuffs (is_debuff=true) for accuracy-aware threshold checks.
-- Rule: a negative effect placed on an ENEMY = debuff. Buffs/auras/heals/damage/
-- self-effects = false (the column default). Any tag with bypasses_accuracy_check
-- =true MUST be is_debuff=true (you can only bypass a check that applies) — both
-- such tags (AoE Decrease Turn Meter, True Fear) are in the list below.
--
-- FLAGGED FOR MANUAL REVIEW (left is_debuff=false pending confirmation):
--   'Decrease Turn Meter' — single-target TM reduction is an INSTANT hostile effect,
--     not a persistent debuff icon, and in RSL is typically not ACC-checked (the AoE
--     variant already bypasses ACC). Setting it is_debuff=true would make it
--     accuracy-gated, which may be wrong. Confirm from literal skill text before
--     flipping. If flipped, verify whether bypasses_accuracy_check should also be true.
-- ============================================================================

update tags set is_debuff = true
 where name in (
   -- crowd control
   'Stun', 'AoE Stun', 'Freeze', 'AoE Freeze', 'Sleep', 'AoE Sleep',
   'Fear', 'True Fear', 'Provoke',
   -- stat reductions on enemies
   'Decrease Attack', 'Decrease Defense', 'Decrease Speed', 'Decrease ACC',
   'AoE Decrease Turn Meter',
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
