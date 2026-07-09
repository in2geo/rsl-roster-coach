-- ============================================================================
-- 73 - Decrease ATK / Decrease SPD / Decrease DEF (in-game) / Provoke champion_tags
--      from advisor batch review 2026-07-08. status='proposed'. Idempotent.
--      Keyed on DB champion names (short). Skill names pulled from Skills_Raw;
--      target patterns / conditions per advisor session. Per-row source_type and
--      ascension_required (Krisk passive = ar 3). 14 fandom Decrease Defense rows
--      were already committed in seed 72 and are intentionally NOT repeated here.
-- ============================================================================

-- Decrease Attack
insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by, proposed_at, ascension_required)
select ch.id, t.id, 'proposed', v.src, v.note, 'batch-review-2026-07-08', now(), v.ar
from (values
  ('Alaric', 'fandom_wiki', 'fandom_wiki A3 Crimson Warlord: [Decrease ATK] 50% unbooked. AoE (all enemies). also Decrease ACC.', 0),
  ('Aox', 'in_game_index', 'in_game_index A3 Weight of Aeons: [Decrease ATK] 100% unbooked. guaranteed AoE (all enemies). TM books do not affect this chance.', 0),
  ('Avir', 'fandom_wiki', 'fandom_wiki A2 Corroding Catalyst: [Decrease ATK] 0% unbooked. books-only - not functional pre-books (50% booked, books +50%). AoE.', 0),
  ('Balthus', 'fandom_wiki', 'fandom_wiki A1 Shield Strike: [Decrease ATK] 20% unbooked. single-target.', 0),
  ('Baroth', 'fandom_wiki', 'fandom_wiki A3 Serpent Axes: [Decrease ATK] 50% unbooked. single-target. also Decrease DEF.', 0),
  ('Dhukk', 'fandom_wiki', 'fandom_wiki A2 Lunatic Outburst: [Decrease ATK] 50% unbooked. AoE (all enemies). also Decrease DEF.', 0),
  ('Ghrush', 'fandom_wiki', 'fandom_wiki A2 Bonebreaker Stomp: [Decrease ATK] 20% unbooked. AoE; random Decrease ATK or Decrease C.DMG.', 0),
  ('Giscard', 'fandom_wiki', 'fandom_wiki A1 Foebreaker: [Decrease ATK] 25% unbooked. single-target.', 0),
  ('Krisk', 'in_game_index', 'in_game_index Passive Might of Ages: [Decrease ATK] 25% unbooked. on-hit reactive when Krisk is hit (50% booked). also places Decrease DEF.', 3),
  ('Lodric', 'fandom_wiki', 'fandom_wiki A1 Strike of Dismay: [Decrease ATK] 20% unbooked. single-target.', 0),
  ('Nekhret', 'fandom_wiki', 'fandom_wiki A1 Tomb Glaive: [Decrease ATK] 10% unbooked. per-hit; cannot be resisted.', 0),
  ('Riho', 'in_game_index', 'in_game_index A2 Pressure Points: [Decrease ATK] 100% unbooked. guaranteed (100% chance). Pressure Points multi-debuff.', 0),
  ('Skimfos', 'fandom_wiki', 'fandom_wiki A2 Curse Feeder: [Decrease ATK] 50% unbooked. AoE (all enemies).', 0),
  ('Toragi', 'fandom_wiki', 'fandom_wiki A1 Swamp Club: [Decrease ATK] 20% unbooked. single-target.', 0),
  ('Ursala', 'fandom_wiki', 'fandom_wiki A2 Waves of Grief: [Decrease ATK] 50% unbooked. AoE (all enemies).', 0),
  ('Vasal', 'fandom_wiki', 'fandom_wiki A2 Infernal Darkness: [Decrease ATK] 50% unbooked. AoE (all enemies). also True Fear.', 0)
) as v(name, src, note, ar)
join champions ch on ch.name = v.name and ch.game_id = 'raid_shadow_legends'
join tags t on t.name = 'Decrease Attack'
where not exists (select 1 from champion_tags x where x.champion_id = ch.id and x.tag_id = t.id);

-- Decrease Speed
insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by, proposed_at, ascension_required)
select ch.id, t.id, 'proposed', v.src, v.note, 'batch-review-2026-07-08', now(), v.ar
from (values
  ('Cillian', 'fandom_wiki', 'fandom_wiki A1 Trip Up: [Decrease SPD] 20% unbooked. per-hit chance. single-target.', 0),
  ('Grohak', 'fandom_wiki', 'fandom_wiki A1 Sap Swiftness: [Decrease SPD] 20% unbooked. per-hit; random targets.', 0),
  ('Krisk', 'fandom_wiki', 'fandom_wiki A1 Enter the Morass: [Decrease SPD] 10% unbooked. AoE (all enemies).', 0),
  ('Kurzad', 'in_game_index', 'in_game_index A1 Bushwhack: [Decrease SPD] 100% unbooked. 100% on critical hit (crit-conditional; tagged at guaranteed per policy).', 0),
  ('Skimfos', 'fandom_wiki', 'fandom_wiki A1 Growing Hunger: [Decrease SPD] 25% unbooked. per-hit.', 0),
  ('Teodor the Savant', 'fandom_wiki', 'fandom_wiki A1 (skill name pending): [Decrease SPD] 10% unbooked. AoE (all enemies).', 0),
  ('Tuhak', 'fandom_wiki', 'fandom_wiki A2 Whirl of Battle: [Decrease SPD] 50% unbooked. AoE (all enemies).', 0),
  ('Yakarl', 'fandom_wiki', 'fandom_wiki A2 (skill name pending): [Decrease SPD] 50% unbooked. single-target. also Freeze.', 0)
) as v(name, src, note, ar)
join champions ch on ch.name = v.name and ch.game_id = 'raid_shadow_legends'
join tags t on t.name = 'Decrease Speed'
where not exists (select 1 from champion_tags x where x.champion_id = ch.id and x.tag_id = t.id);

-- Decrease Defense
insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by, proposed_at, ascension_required)
select ch.id, t.id, 'proposed', v.src, v.note, 'batch-review-2026-07-08', now(), v.ar
from (values
  ('Krisk', 'in_game_index', 'in_game_index Passive Might of Ages: [Decrease DEF] 50% unbooked. on-hit reactive when Krisk is hit (75% booked). also places Decrease ATK.', 3),
  ('Riho', 'in_game_index', 'in_game_index A2 Pressure Points: [Decrease DEF] 100% unbooked. guaranteed (100% chance). Pressure Points multi-debuff.', 0)
) as v(name, src, note, ar)
join champions ch on ch.name = v.name and ch.game_id = 'raid_shadow_legends'
join tags t on t.name = 'Decrease Defense'
where not exists (select 1 from champion_tags x where x.champion_id = ch.id and x.tag_id = t.id);

-- Provoke
insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by, proposed_at, ascension_required)
select ch.id, t.id, 'proposed', v.src, v.note, 'batch-review-2026-07-08', now(), v.ar
from (values
  ('Pharsalas', 'in_game_index', 'in_game_index A1 Grasp of the Grave: [Provoke] 0% unbooked. books-only Provoke - not functional pre-books (20% booked, books +20%). A1 also places Decrease ATK only if target under Fear/True Fear (conditional, not tagged).', 0)
) as v(name, src, note, ar)
join champions ch on ch.name = v.name and ch.game_id = 'raid_shadow_legends'
join tags t on t.name = 'Provoke'
where not exists (select 1 from champion_tags x where x.champion_id = ch.id and x.tag_id = t.id);

-- ----------------------------------------------------------------------------
-- PENDING champion creation (absent from live `champions` on 2026-07-08 DB check).
-- These tags CANNOT seed until the champion rows exist. Re-run after adding them.
--   Mighty Ukko | Decrease Attack | fandom_wiki | ar=0 | fandom_wiki A1 (skill name pending): [Decrease ATK] 25% unbooked. AoE (all enemies).
--   Sentinel | Decrease Attack | fandom_wiki | ar=0 | fandom_wiki A2 Glaive Swing: [Decrease ATK] 40% unbooked. AoE (all enemies). also Heal Reduction.
--   Skull Lord Var-Gall | Decrease Attack | fandom_wiki | ar=0 | fandom_wiki A3 Abyssal Clutch: [Decrease ATK] 50% unbooked. AoE (all enemies).
--   Fortress Goon | Decrease Speed | in_game_index | ar=0 | in_game_index A1 Cruel Trap: [Decrease SPD] 15% unbooked. single-target (scraper booked value was wrong; 15% is unbooked).
--   Masked Fearmonger | Decrease Speed | fandom_wiki | ar=0 | fandom_wiki A2 Haunted Machete: [Decrease SPD] 50% unbooked. single-target.
