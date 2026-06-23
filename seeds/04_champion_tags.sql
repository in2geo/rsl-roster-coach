-- ============================================================================
-- Seed 04 — Champion → tag proposals (MVP set)
-- Source: in-game Index skill text, read champion by champion.
-- ALL rows are status='proposed' — a human must approve before they go live.
-- source_note is the player's own paraphrase of what the skill text says;
-- never a quote lifted from a guide site.
-- ============================================================================

-- Helper macro pattern: (champion_name, tag_name, source_type, source_note)

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
  -- ── Kael ──────────────────────────────────────────────────────────────
  -- Acid Rain: places 2 Poison debuffs on all enemies
  -- Dark Blast: hits all enemies (A2)
  -- Disintegrate: has 50% chance to place [Decrease DEF] on all enemies (A3)
  ('Kael', 'AoE Damage',       'in_game_index', 'Dark Blast and Acid Rain both hit all enemies'),
  ('Kael', 'Poison',           'in_game_index', 'Acid Rain places 2 Poison debuffs on all enemies'),
  ('Kael', 'Decrease Defense', 'in_game_index', 'Disintegrate has 50% chance to place Decrease DEF on all enemies'),

  -- ── Elhain ────────────────────────────────────────────────────────────
  -- Arrow Shower: hits all enemies; Lightning Arrow: AoE chain
  ('Elhain', 'AoE Damage',     'in_game_index', 'Arrow Shower hits all enemies; Lightning Arrow chains to multiple targets'),

  -- ── Athel ─────────────────────────────────────────────────────────────
  -- Saintly Dread: AoE; Martyrdom: AoE with Weaken
  ('Athel', 'AoE Damage',      'in_game_index', 'Saintly Dread and Martyrdom both hit all enemies'),
  ('Athel', 'Weaken',          'in_game_index', 'Martyrdom places a [Weaken] debuff on all enemies'),

  -- ── Galek ─────────────────────────────────────────────────────────────
  -- Rain of Fire: AoE; Inferno: AoE with Decrease DEF
  ('Galek', 'AoE Damage',      'in_game_index', 'Rain of Fire and Inferno both attack all enemies'),
  ('Galek', 'Decrease Defense','in_game_index', 'Inferno places [Decrease DEF] on all enemies'),

  -- ── Warpriest ─────────────────────────────────────────────────────────
  -- Sacral Ward heals all allies; Suppress places Shield
  ('Warpriest', 'Healer',      'in_game_index', 'Sacral Ward heals all allies by a percentage of their max HP'),
  ('Warpriest', 'Shield',      'in_game_index', 'Suppress places a [Shield] buff on all allies'),

  -- ── Apothecary ────────────────────────────────────────────────────────
  -- Bless heals + places Increase SPD; Mend heals
  ('Apothecary', 'Healer',     'in_game_index', 'Mend and Bless both restore HP to allies'),
  ('Apothecary', 'Increase Speed','in_game_index','Bless places [Increase SPD] on all allies'),

  -- ── Diabolist ─────────────────────────────────────────────────────────
  -- Leader skill raises ally SPD; Dash places Increase SPD
  ('Diabolist', 'Speed Aura',  'in_game_index', 'Leader skill increases ally SPD in all battles'),
  ('Diabolist', 'Increase Speed','in_game_index','Dash places [Increase SPD] on a random ally'),

  -- ── Spirithost ────────────────────────────────────────────────────────
  -- Leader raises ally ATK; Awaken revives a dead ally
  ('Spirithost', 'ATK Aura',   'in_game_index', 'Leader skill increases ally ATK in all battles'),
  ('Spirithost', 'Revive',     'in_game_index', 'Awaken brings a dead ally back to life with partial HP'),

  -- ── Skullcrusher ──────────────────────────────────────────────────────
  -- Warhorn places Counterattack on all allies; Headbutt stuns
  ('Skullcrusher', 'Counterattack','in_game_index','Warhorn places [Counterattack] on all allies for 2 turns'),
  ('Skullcrusher', 'Block Debuffs','in_game_index','Demoralise places [Block Debuffs] on all allies'),

  -- ── Frozen Banshee ────────────────────────────────────────────────────
  -- Frostbite places Poison on all enemies; passive inflicts extra Poison
  ('Frozen Banshee', 'Poison',     'in_game_index', 'Frostbite places [Poison] debuffs on all enemies'),
  ('Frozen Banshee', 'AoE Damage', 'in_game_index', 'Frostbite attacks all enemies'),

  -- ── Executioner ───────────────────────────────────────────────────────
  -- Rain of Punishment AoE + Decrease DEF
  ('Executioner', 'AoE Damage',     'in_game_index', 'Rain of Punishment attacks all enemies'),
  ('Executioner', 'Decrease Defense','in_game_index','Rain of Punishment places [Decrease DEF] on all enemies'),

  -- ── Relickeeper ───────────────────────────────────────────────────────
  -- Judgement hits all enemies
  ('Relickeeper', 'AoE Damage',    'in_game_index', 'Judgement attacks all enemies'),

  -- ── Armiger ───────────────────────────────────────────────────────────
  -- Decreases Turn Meter via passive on crit hits
  ('Armiger', 'Decrease Turn Meter','in_game_index','Passive: landing a critical hit decreases the target''s Turn Meter'),

  -- ── Rearguard Sergeant ────────────────────────────────────────────────
  -- Leader raises ally DEF
  ('Rearguard Sergeant', 'DEF Aura','in_game_index','Leader skill increases ally DEF in all battles'),
  ('Rearguard Sergeant', 'Increase Defense','in_game_index','Rally places [Increase DEF] on all allies'),

  -- ── Corpse Collector ──────────────────────────────────────────────────
  -- Revives a dead ally
  ('Corpse Collector', 'Revive',   'in_game_index', 'Grave Digger revives a dead ally with partial HP'),

  -- ── Grizzled Jarl ─────────────────────────────────────────────────────
  -- Heals allies; places Increase DEF
  ('Grizzled Jarl', 'Healer',      'in_game_index', 'Tribal Remedy heals all allies'),
  ('Grizzled Jarl', 'Increase Defense','in_game_index','War Cry places [Increase DEF] on all allies'),

  -- ── Miscreated Monster ────────────────────────────────────────────────
  -- Heals + shields
  ('Miscreated Monster', 'Healer',  'in_game_index', 'Replenish heals all allies'),
  ('Miscreated Monster', 'Shield',  'in_game_index', 'Mutate places a [Shield] on all allies'),

  -- ── Quargan the Crowned ───────────────────────────────────────────────
  ('Quargan the Crowned', 'Decrease Attack','in_game_index','Subdue places [Decrease ATK] on all enemies'),
  ('Quargan the Crowned', 'AoE Damage',    'in_game_index', 'Tail Strike attacks all enemies')

) as s(champion_name, tag_name, source_type, source_note)
join champions c on c.name = s.champion_name
join tags      t on t.name = s.tag_name
on conflict (champion_id, tag_id) do nothing;
