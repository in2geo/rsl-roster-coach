-- ============================================================================
-- 108 - Tag vocabulary expansion (2026-07-11). Inserts the tags present in the
-- master worksheet DB_Tags (99) but absent from the live tags table (66).
-- name/description/is_debuff/bypasses_accuracy_check carried from the worksheet;
-- game_id defaults to raid_shadow_legends. ON CONFLICT (name) DO NOTHING.
-- Unblocks the 222 champion_tags approvals whose tag did not yet exist live
-- (backfilled by seed 109). Human-reviewed vocab (advisor batch 2026-07-11).
-- ============================================================================
insert into tags (name, description, is_debuff, bypasses_accuracy_check) values
  ('Berserk', 'Debuff (Berserk); cannot be placed on Bosses.', true, false),
  ('Block Passive Skills', 'Debuff blocking the target''s passive skills.', true, false),
  ('Deathbrand', 'Debuff (Deathbrand).', true, false),
  ('Debuff Spread', 'Takes debuffs from a target and places them on other enemies', false, false),
  ('Decrease C.Rate', 'Debuff decreasing the target''s Critical Rate.', true, false),
  ('Ensnare', 'Debuff (Ensnare).', true, false),
  ('Fatigue', 'Debuff (Fatigue).', true, false),
  ('Fervor', 'Ally buff (Fervor).', false, false),
  ('Fortify', 'Buff (Fortify) that bolsters defenses.', false, false),
  ('Hunter''s Gaze', 'Debuff marking the target (Hunter''s Gaze).', true, false),
  ('Immutable', 'Buff preventing this champion''s buffs from being removed or stolen.', false, false),
  ('Increase ACC', 'Buff increasing the champion''s Accuracy.', false, false),
  ('Increase RES', 'Buff increasing the champion''s Resistance.', false, false),
  ('Infest', 'Debuff (Infest) - detonating/spreading effect.', true, false),
  ('Intercept', 'Ally protection buff (stacks) that intercepts incoming hits.', false, false),
  ('Life Barrier', 'Buff that prevents the champion from being killed below a set HP.', false, false),
  ('Magma Shield', 'Shield-type buff (Magma Shield).', false, false),
  ('Master Seal', 'Debuff (Master Seal) - stronger Seal variant.', true, false),
  ('Necrosis', 'Stacking damage-over-time debuff (Necrosis).', true, false),
  ('Nullify', 'Debuff (Nullify).', true, false),
  ('Pain Link', 'Reflects a portion of the attacker''s skill damage back to the target when it attacks. Cannot be removed, resisted, or blocked.', true, true),
  ('Poison Cloud', 'Buff interacting with Poison effects.', false, false),
  ('Poison Sensitivity', 'Places [Poison Sensitivity] debuff - increases damage the target takes from [Poison]. Landed, resistible (seed 43).', true, false),
  ('Revive on Death', 'Buff that revives the champion when killed.', false, false),
  ('Seal', 'Debuff (Seal).', true, false),
  ('Shatter', 'Buff that reduces the target''s MAX HP / shreds shields on hit.', false, false),
  ('Sheep', 'Debuff transforming/incapacitating the target so it cannot act.', true, false),
  ('Smite', 'Debuff marking the target for bonus damage.', true, false),
  ('Steal Buffs', 'Removes buffs from the target and applies them to this champion; not accuracy-gated (seed 43).', false, false),
  ('Stone Skin', 'Buff that reduces incoming damage.', false, false),
  ('Stormcall', 'Buff (Stormcall).', false, false),
  ('Taunt', 'Buff placed on an ally forcing enemies to target them (distinct from Provoke).', false, false),
  ('Total Guard', 'Buff that blocks incoming damage up to a threshold.', false, false)
on conflict (name) do nothing;
