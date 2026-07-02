-- ============================================================================
-- Add is_debuff to tags — the companion to bypasses_accuracy_check needed for
-- accuracy-aware threshold evaluation. A tag is accuracy-gated iff
--   is_debuff AND NOT bypasses_accuracy_check
-- (a debuff placed on an enemy that must pass an ACC/RES check to land). Buffs,
-- auras, heals, damage, and self-effects are is_debuff=false → ACC never applies.
-- ============================================================================

alter table tags add column if not exists is_debuff boolean not null default false;
