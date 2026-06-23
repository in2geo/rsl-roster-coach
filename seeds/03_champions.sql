-- ============================================================================
-- Seed 03 — Champion roster (MVP set)
-- Scope: the 4 starter Epics + Common/Uncommon/Rare champions a new player
-- realistically owns via campaign drops and early rewards.
-- Source: in-game champion Index for identity fields (faction, affinity, rarity).
-- Base stats omitted for now — add them when Tier 2 estimation is needed.
-- ============================================================================

insert into champions (name, faction, affinity, rarity, source_citation) values

  -- ── Starter Epics (player picks one; all four are seeded) ───────────────
  ('Kael',       'Dark Elves',     'Magic',  'Epic', 'in-game Index'),
  ('Elhain',     'High Elves',     'Magic',  'Epic', 'in-game Index'),
  ('Athel',      'Sacred Order',   'Magic',  'Epic', 'in-game Index'),
  ('Galek',      'Orcs',           'Force',  'Epic', 'in-game Index'),

  -- ── Sacred Order ────────────────────────────────────────────────────────
  ('Warpriest',      'Sacred Order', 'Force',  'Rare',     'in-game Index'),
  ('Relickeeper',    'Sacred Order', 'Magic',  'Rare',     'in-game Index'),
  ('Adjudicator',    'Sacred Order', 'Magic',  'Uncommon', 'in-game Index'),
  ('Steel Bowyer',   'Sacred Order', 'Spirit', 'Common',   'in-game Index'),

  -- ── High Elves ──────────────────────────────────────────────────────────
  ('Apothecary',     'High Elves',   'Spirit', 'Rare',     'in-game Index'),
  ('Elven Ranger',   'High Elves',   'Force',  'Uncommon', 'in-game Index'),
  ('Stout Axeman',   'High Elves',   'Magic',  'Common',   'in-game Index'),

  -- ── Dark Elves ──────────────────────────────────────────────────────────
  ('Executioner',    'Dark Elves',   'Magic',  'Rare',     'in-game Index'),
  ('Spirithost',     'Dark Elves',   'Void',   'Rare',     'in-game Index'),
  ('Hexweaver',      'Dark Elves',   'Magic',  'Uncommon', 'in-game Index'),
  ('Ranger',         'Dark Elves',   'Spirit', 'Common',   'in-game Index'),

  -- ── Orcs ────────────────────────────────────────────────────────────────
  ('Diabolist',      'Demonspawn',   'Force',  'Rare',     'in-game Index'),
  ('Armiger',        'Demonspawn',   'Magic',  'Rare',     'in-game Index'),
  ('Razorleaf',      'Demonspawn',   'Force',  'Uncommon', 'in-game Index'),

  -- ── Barbarians ──────────────────────────────────────────────────────────
  ('Grizzled Jarl',  'Barbarians',   'Spirit', 'Rare',     'in-game Index'),
  ('Marked',         'Barbarians',   'Force',  'Uncommon', 'in-game Index'),
  ('Saurus',         'Barbarians',   'Force',  'Common',   'in-game Index'),

  -- ── Ogryn Tribes ────────────────────────────────────────────────────────
  ('Skullcrusher',   'Ogryn Tribes', 'Force',  'Rare',     'in-game Index'),
  ('Rearguard Sergeant', 'Banner Lords', 'Magic', 'Uncommon', 'in-game Index'),
  ('Gromoboy',       'Ogryn Tribes', 'Void',   'Uncommon', 'in-game Index'),
  ('Rocktooth',      'Ogryn Tribes', 'Force',  'Common',   'in-game Index'),

  -- ── Undead Hordes ───────────────────────────────────────────────────────
  ('Frozen Banshee', 'Undead Hordes','Magic',  'Rare',     'in-game Index'),
  ('Corpse Collector','Undead Hordes','Force', 'Rare',     'in-game Index'),
  ('Coffin Smasher', 'Undead Hordes','Magic',  'Uncommon', 'in-game Index'),
  ('Amarantine Skeleton','Undead Hordes','Spirit','Common', 'in-game Index'),

  -- ── Lizardmen ───────────────────────────────────────────────────────────
  ('Thornhide',      'Lizardmen',    'Force',  'Uncommon', 'in-game Index'),
  ('Quargan the Crowned','Lizardmen','Magic',  'Rare',     'in-game Index'),

  -- ── Banner Lords ────────────────────────────────────────────────────────
  ('Knight Errant',  'Banner Lords', 'Force',  'Uncommon', 'in-game Index'),
  ('Armored Golem',  'Banner Lords', 'Magic',  'Rare',     'in-game Index'),

  -- ── Dwarves ─────────────────────────────────────────────────────────────
  ('Mountaineer',    'Dwarves',      'Magic',  'Common',   'in-game Index'),
  ('Fodbor the Bard','Dwarves',      'Spirit', 'Uncommon', 'in-game Index'),

  -- ── Knight Revenant ─────────────────────────────────────────────────────
  ('Acolyte',        'Knight Revenant','Magic','Common',   'in-game Index'),
  ('Miscreated Monster','Knight Revenant','Void','Rare',   'in-game Index')

on conflict do nothing;
