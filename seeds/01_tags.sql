-- ============================================================================
-- Seed 01 — Tag vocabulary
-- Source: derived from in-game mechanic categories, not from any guide site.
-- Add new tags here; update bypasses_accuracy_check for instant effects.
-- ============================================================================

insert into tags (name, description, bypasses_accuracy_check) values
  -- Damage
  ('AoE Damage',           'Attacks all enemies in a single hit or multi-hit AoE', false),
  ('Single Target Damage', 'High single-target damage skill',                       false),

  -- Debuffs (accuracy check applies unless noted)
  ('Decrease Defense',     'Places [Decrease DEF] debuff',              false),
  ('Decrease Attack',      'Places [Decrease ATK] debuff',              false),
  ('Decrease Speed',       'Places [Decrease SPD] debuff',              false),
  ('Weaken',               'Places [Weaken] debuff',                    false),
  ('Poison',               'Places [Poison] debuff (% max HP / turn)',  false),
  ('HP Burn',              'Places [HP Burn] debuff',                   false),
  ('Stun',                 'Places [Stun] crowd-control debuff',        false),
  ('Freeze',               'Places [Freeze] crowd-control debuff',      false),
  ('Sleep',                'Places [Sleep] crowd-control debuff',       false),

  -- AoE CC
  ('AoE Stun',             'Places [Stun] on all or random enemies',    false),
  ('AoE Freeze',           'Places [Freeze] on all or random enemies',  false),
  ('AoE Sleep',            'Places [Sleep] on all or random enemies',   false),

  -- Turn Meter
  ('Decrease Turn Meter',  'Reduces an enemy''s Turn Meter',            false),
  ('AoE Decrease Turn Meter', 'Reduces all enemies'' Turn Meter',       true),  -- instant, bypasses ACC check
  ('Increase Turn Meter',  'Fills an ally''s Turn Meter',               false),

  -- Buffs / support
  ('Healer',               'Restores ally HP',                          false),
  ('Revive',               'Brings a dead ally back to life',           false),
  ('Shield',               'Places [Shield] buff on allies',            false),
  ('Block Damage',         'Places [Block Damage] buff',                false),
  ('Block Debuffs',        'Places [Block Debuffs] buff on allies',     false),
  ('Counterattack',        'Places [Counterattack] buff on allies',     false),
  ('Increase Defense',     'Places [Increase DEF] buff',                false),
  ('Increase Attack',      'Places [Increase ATK] buff',                false),
  ('Increase Speed',       'Places [Increase SPD] buff',                false),
  ('Cleanse',              'Removes debuffs from allies',               false),
  ('Ally Protection',      'Redirects damage taken by allies',          false),

  -- Auras (passive, always-on in the right context)
  ('Speed Aura',           'Leader skill that raises ally SPD',         false),
  ('ATK Aura',             'Leader skill that raises ally ATK',         false),
  ('DEF Aura',             'Leader skill that raises ally DEF',         false),
  ('HP Aura',              'Leader skill that raises ally HP',          false)

on conflict (name) do nothing;
