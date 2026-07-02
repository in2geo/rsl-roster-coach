-- ============================================================================
-- Vocabulary: add RES Aura; clarify single-target Stun. Prereqs for tagging
-- champions (e.g. Pelops) from the in-game Index. Human-approved 2026-07-01.
-- ============================================================================

-- RES Aura — new aura-stat tag (completes the set with HP/Attack/Defense/Speed Aura).
-- Auras are leader-only and content-scoped; magnitude/placement come from the in-game
-- Index (not stored on the tag). is_debuff=false (a buff), bypass n/a.
insert into tags (name, description, bypasses_accuracy_check, is_debuff)
values (
  'RES Aura',
  'Increases Ally RES by a percentage in a specified placement (all battles, dungeons, arena, etc.). Only applies when this champion is the team leader. Value and placement confirmed from in-game Index aura screen.',
  false, false
)
on conflict (name) do nothing;

-- 'Stun' already exists (is_debuff=true, accuracy-gated). The proposed INSERT would
-- no-op under on-conflict, so UPDATE its description to carry the single-target
-- guidance (do NOT assign AoE Stun to a "attacks 1 enemy" skill — use plain Stun).
update tags
   set description = 'Stuns a single target, causing them to skip their next turn. Subject to ACC/RES check. Distinct from AoE Stun — does not affect all enemies. Do not assign AoE Stun to a champion whose skill text says "attacks 1 enemy" — use this tag instead.'
 where name = 'Stun';
