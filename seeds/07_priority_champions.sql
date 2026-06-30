-- ============================================================================
-- Seed 07 — Priority Legendaries and Epics (non-starter-pack)
-- Champions that appear in team recommendations but are not in the MVP
-- starter-pack seed (03_champions.sql).
-- Columns confirmed against live schema 2026-06-27:
--   id, name, faction, affinity, rarity,
--   base_hp, base_atk, base_def, base_spd, base_acc, base_res,
--   base_stat_reference_rank, base_stat_reference_level,
--   source_citation, base_crit_rate, base_crit_dmg
-- NOTE: no 'role' column in live schema.
-- ============================================================================

-- ── Mavara the Web Diviner ────────────────────────────────────────────────────
-- Legendary / Magic / Dark Elves
-- base_spd confirmed 110. All other base stats to be populated by scraper.
insert into champions (name, faction, affinity, rarity, base_spd, source_citation)
values ('Mavara the Web Diviner', 'Dark Elves', 'Magic', 'Legendary', 110,
        'raid.guide/en/stats/ — base_spd confirmed 110; remaining base stats populated by scraper')
on conflict (name) do nothing;

-- ── Mithrala ─────────────────────────────────────────────────────────────────
-- Legendary / Void / Dark Elves (free fusion champion)
-- DB name confirmed "Mithrala" (not "Mithrala Lifebane") — 2026-06-27
insert into champions (name, faction, affinity, rarity, source_citation)
values ('Mithrala', 'Dark Elves', 'Void', 'Legendary',
        'in-game Index — base stats to be populated by scraper')
on conflict (name) do nothing;

-- ── Gnishak Verminlord ───────────────────────────────────────────────────────
-- Legendary / Force / Ogryn Tribes
-- FLAG-25: AI Overview spells "Verminhide" — in-game name is Verminlord
insert into champions (name, faction, affinity, rarity, source_citation)
values ('Gnishak Verminlord', 'Ogryn Tribes', 'Force', 'Legendary',
        'in-game Index — FLAG-25: name confirmed Verminlord not Verminhide')
on conflict (name) do nothing;

-- ── Ezio Auditore ────────────────────────────────────────────────────────────
-- Legendary / Spirit / Shadowkin (Assassin's Creed collab)
insert into champions (name, faction, affinity, rarity, source_citation)
values ('Ezio Auditore', 'Shadowkin', 'Spirit', 'Legendary',
        'in-game Index — collab champion; base stats to be populated by scraper')
on conflict (name) do nothing;

-- ── Ninja ─────────────────────────────────────────────────────────────────────
-- Legendary / Magic / Shadowkin (promotional/collab champion)
insert into champions (name, faction, affinity, rarity, source_citation)
values ('Ninja', 'Shadowkin', 'Magic', 'Legendary',
        'in-game Index — collab champion; base stats to be populated by scraper')
on conflict (name) do nothing;

-- ── Teodor the Savant ────────────────────────────────────────────────────────
-- Legendary / Spirit / High Elves
insert into champions (name, faction, affinity, rarity, source_citation)
values ('Teodor the Savant', 'High Elves', 'Spirit', 'Legendary',
        'in-game Index — base stats to be populated by scraper')
on conflict (name) do nothing;

-- ── Michelangelo ─────────────────────────────────────────────────────────────
-- Legendary / Force / Shadowkin (TMNT collab, Aug–Nov 2025 — not currently obtainable)
insert into champions (name, faction, affinity, rarity, source_citation)
values ('Michelangelo', 'Shadowkin', 'Force', 'Legendary',
        'in-game Index — TMNT collab, not currently obtainable; base stats to be populated by scraper')
on conflict (name) do nothing;

-- ── Morag Bronzelock ──────────────────────────────────────────────────────────
-- Epic / Spirit / Dwarves
-- Base stats from InTeleria: HP 18165, ATK 804, DEF 1288, SPD 99,
--   C.Rate 15%, C.DMG 50%, RES 45, ACC 0
insert into champions
  (name, faction, affinity, rarity,
   base_hp, base_atk, base_def, base_spd, base_acc, base_res,
   base_crit_rate, base_crit_dmg,
   base_stat_reference_rank, base_stat_reference_level,
   source_citation)
values
  ('Morag Bronzelock', 'Dwarves', 'Spirit', 'Epic',
   18165, 804, 1288, 99, 0, 45,
   0.15, 0.50,
   6, 60,
   'InTeleria — confirm against raid.guide/en/stats/ before approving')
on conflict (name) do nothing;

-- ── Champions referenced in seed 06 solo profiles — confirmed missing 2026-06-27 ──

-- Drexthar Bloodtwin — Epic / Force / Undead Hordes (free from 3v3 Arena Bazaar)
insert into champions (name, faction, affinity, rarity, source_citation)
values ('Drexthar Bloodtwin', 'Undead Hordes', 'Force', 'Epic',
        'in-game Index — base stats to be populated by scraper')
on conflict (name) do nothing;

-- Myciliac Priest Orn — Legendary / Magic / Sylvan Watchers (FLAG-14: verify exact name)
insert into champions (name, faction, affinity, rarity, source_citation)
values ('Myciliac Priest Orn', 'Sylvan Watchers', 'Magic', 'Legendary',
        'in-game Index — faction/affinity unconfirmed; verify before approving solo rows (FLAG-14)')
on conflict (name) do nothing;

-- Richtoff the Bold — Legendary / Spirit / Banner Lords (Dragon Stage 25 solo)
insert into champions (name, faction, affinity, rarity, source_citation)
values ('Richtoff the Bold', 'Banner Lords', 'Spirit', 'Legendary',
        'in-game Index — base stats to be populated by scraper')
on conflict (name) do nothing;

-- Pelops the Victor — Epic / Spirit / The Sacred Order (Spider Stage 20/25 solo)
insert into champions (name, faction, affinity, rarity, source_citation)
values ('Pelops the Victor', 'The Sacred Order', 'Spirit', 'Epic',
        'in-game Index — base stats to be populated by scraper')
on conflict (name) do nothing;

-- Akemtum — Legendary / Void / Skinwalkers (Dragon Stage 25 solo)
insert into champions (name, faction, affinity, rarity, source_citation)
values ('Akemtum', 'Skinwalkers', 'Void', 'Legendary',
        'in-game Index — base stats to be populated by scraper')
on conflict (name) do nothing;
