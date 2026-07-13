-- ============================================================================
-- 113 - Tag vocabulary for the LLM tag-regeneration batch (2026-07-13). 4 tags
-- the regen surfaced + advisor-approved. Mirrors worksheet DB_Tags v4.86.
-- ON CONFLICT (name) DO NOTHING.
-- ============================================================================
insert into tags (name, description, is_debuff, bypasses_accuracy_check) values
  ('AoE Heal','One-time heal applied to ALL allies at once (not a HoT). Distinct from Continuous Heal and Healer (single-target).', false, false),
  ('Reset Cooldowns','Resets the cooldown(s) of one or more skills (own or ally).', false, false),
  ('Increase Enemy Cooldowns','Increases the skill cooldowns of enemies (debuff). Consolidates Increase Cooldown(s).', true, false),
  ('Decrease Buff Duration','Reduces the remaining duration of buffs on enemies (not a Turn Meter effect).', false, false)
on conflict (name) do nothing;
