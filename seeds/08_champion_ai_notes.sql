-- ============================================================================
-- Seed 08 — Champion AI notes (per-champion, per-dungeon skill guidance)
-- These notes are injected into the AI explanation payload alongside the
-- standard matching result, giving the model concrete build and skill
-- direction to relay to the player.
-- All rows start as status='proposed'. Human review required before 'approved'.
-- ============================================================================

-- ── Mavara the Web Diviner — Clan Boss ───────────────────────────────────────
-- Team composition note (skill_slot = null = team-level, not per-skill).
--
-- Passive mechanic (corrected — two separate effects):
--   1. Heal trigger:  every 16 buffs on ALLIES  → 20% Max HP heal to team
--   2. TM trigger:    every 8 buffs on ENEMIES   → 20% Turn Meter boost to team
--
-- The Fervor ally-attack chain (Mavara A1 → Morag A3 → Ezio Poisons)
-- is the core 1-key Clan Boss mechanism.
insert into champion_ai_notes
  (champion_id, dungeon_id, skill_slot, instruction, source_note, status)
values (
  (select id from champions where name = 'Mavara the Web Diviner'),
  (select id from dungeons  where name = 'Clan Boss'),
  null,
  'If you own Mavara, replace Kael in your Clan Boss team. '
  'Her A1 places Fervor on a random ally, and her passive gives every '
  'Fervor-buffed ally a 50% chance to join attacks whenever another ally '
  'swings — combined with Morag Bronzelock''s ally attack on A3, this '
  'creates a chain of unresistable poison detonations from Ezio that can '
  'achieve 1-key Clan Boss runs. Her A2 also provides Strengthen 25% and '
  'Increase RES to the whole team, reducing gear requirements. '
  'Build her as fast as possible (210+ SPD) in Relentless or Speed set. '
  'Do NOT equip Reflex or Impulse — you want her using A1 as often as '
  'possible to spread Fervor, not cycling other skills. '
  'Passive note: heal triggers on ally buffs (every 16 ally buffs = 20% '
  'Max HP heal to the whole team); TM boost triggers on enemy buffs '
  '(every 8 enemy buffs = 20% Turn Meter to the whole team). These are '
  'two separate passive effects.',
  'Multiple Reddit threads and YouTube showcases confirm 1-key Clan Boss '
  'viability. Fervor ally-attack chain confirmed. Passive effects confirmed '
  'as two separate triggers: heal on ally buffs, TM boost on enemy buffs — '
  'sources that conflate them are incorrect. '
  'HellHades champion spotlight and Vortex Gaming deep dive (April 2026).',
  'proposed'
);
