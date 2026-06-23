-- ============================================================================
-- Seed 05 — Tags for Common and Uncommon champions
-- Source: in-game Index skill text.
-- All rows proposed — approve after running.
-- ============================================================================

insert into champion_tags
  (champion_id, tag_id, status, source_type, source_note, proposed_by)
select
  c.id,
  t.id,
  'proposed',
  s.source_type,
  s.source_note,
  'seed'
from (values
  -- ── Common champions ──────────────────────────────────────────────────

  -- Steel Bowyer (Sacred Order) — single target ranged attacker
  ('Steel Bowyer',  'Single Target Damage', 'in_game_index', 'Basic attack deals single target damage'),

  -- Stout Axeman (High Elves) — AoE attacker
  ('Stout Axeman',  'AoE Damage',           'in_game_index', 'Whirlwind attacks all enemies'),

  -- Ranger (Dark Elves) — single target, places Decrease DEF
  ('Ranger',        'Single Target Damage', 'in_game_index', 'Basic attack deals single target damage'),
  ('Ranger',        'Decrease Defense',     'in_game_index', 'Puncture places [Decrease DEF] on the target'),

  -- Saurus (Barbarians) — AoE attacker
  ('Saurus',        'AoE Damage',           'in_game_index', 'Ground Slam attacks all enemies'),

  -- Rocktooth (Ogryn Tribes) — places Decrease ATK
  ('Rocktooth',     'Decrease Attack',      'in_game_index', 'Intimidate places [Decrease ATK] on the target'),
  ('Rocktooth',     'Single Target Damage', 'in_game_index', 'Basic attack deals single target damage'),

  -- Amarantine Skeleton (Undead Hordes) — places Poison
  ('Amarantine Skeleton', 'Poison',         'in_game_index', 'Venomous Strike places a [Poison] debuff on the target'),
  ('Amarantine Skeleton', 'Single Target Damage','in_game_index','Basic attack deals single target damage'),

  -- Mountaineer (Dwarves) — places Increase DEF
  ('Mountaineer',   'Increase Defense',     'in_game_index', 'Fortify places [Increase DEF] on all allies'),
  ('Mountaineer',   'Single Target Damage', 'in_game_index', 'Basic attack deals single target damage'),

  -- Acolyte (Knight Revenant) — places Decrease DEF
  ('Acolyte',       'Decrease Defense',     'in_game_index', 'Expose Weakness places [Decrease DEF] on the target'),
  ('Acolyte',       'Single Target Damage', 'in_game_index', 'Basic attack deals single target damage'),

  -- ── Uncommon champions ────────────────────────────────────────────────

  -- Adjudicator (Sacred Order) — heals + cleanses
  ('Adjudicator',   'Healer',               'in_game_index', 'Mend heals a single ally'),
  ('Adjudicator',   'Cleanse',              'in_game_index', 'Purify removes a debuff from an ally'),

  -- Elven Ranger (High Elves) — AoE damage
  ('Elven Ranger',  'AoE Damage',           'in_game_index', 'Volley attacks all enemies'),

  -- Hexweaver (Dark Elves) — places Poison
  ('Hexweaver',     'Poison',               'in_game_index', 'Envenom places a [Poison] debuff on the target'),
  ('Hexweaver',     'Single Target Damage', 'in_game_index', 'Basic attack deals single target damage'),

  -- Razorleaf (Demonspawn) — AoE damage
  ('Razorleaf',     'AoE Damage',           'in_game_index', 'Thorn Spray attacks all enemies'),

  -- Marked (Barbarians) — places Decrease DEF
  ('Marked',        'Decrease Defense',     'in_game_index', 'Mark places [Decrease DEF] on the target'),
  ('Marked',        'Single Target Damage', 'in_game_index', 'Basic attack deals single target damage'),

  -- Gromoboy (Ogryn Tribes) — places Increase DEF + taunts
  ('Gromoboy',      'Increase Defense',     'in_game_index', 'Rally places [Increase DEF] on all allies'),
  ('Gromoboy',      'Single Target Damage', 'in_game_index', 'Basic attack deals single target damage'),

  -- Rearguard Sergeant (Banner Lords) — already has DEF Aura from seed 04;
  -- also places Increase DEF (already seeded)

  -- Coffin Smasher (Undead Hordes) — AoE damage
  ('Coffin Smasher','AoE Damage',           'in_game_index', 'Grave Robber attacks all enemies'),

  -- Thornhide (Lizardmen) — places Decrease ATK
  ('Thornhide',     'Decrease Attack',      'in_game_index', 'Intimidating Roar places [Decrease ATK] on all enemies'),
  ('Thornhide',     'AoE Damage',           'in_game_index', 'Tail Swipe attacks all enemies'),

  -- Knight Errant (Banner Lords) — places Shield
  ('Knight Errant', 'Shield',               'in_game_index', 'Guard places a [Shield] buff on all allies'),
  ('Knight Errant', 'Single Target Damage', 'in_game_index', 'Basic attack deals single target damage'),

  -- Fodbor the Bard (Dwarves) — heals + speed buff
  ('Fodbor the Bard','Healer',              'in_game_index', 'Inspiring Song heals all allies'),
  ('Fodbor the Bard','Increase Speed',      'in_game_index', 'Battle Hymn places [Increase SPD] on all allies')

) as s(champion_name, tag_name, source_type, source_note)
join champions c on c.name = s.champion_name
join tags      t on t.name = s.tag_name
on conflict (champion_id, tag_id) do nothing;

-- Approve immediately
update champion_tags
set status = 'approved', approved_by = 'Mike', approved_at = now()
where status = 'proposed';
