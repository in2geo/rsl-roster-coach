-- ============================================================================
-- 79 — Uugo (Epic, Ogryn Tribes, Magic, Support): replace two TEST_DATA
-- placeholder source_notes with real skill text.
--
-- Uugo's 'AoE Damage' and 'Decrease Defense' rows are already status='approved'
-- but still carry "TEST_DATA — replace with real skill text before shipping".
-- Both effects are legitimate — they come from A2 Maelstrom Wrack:
--   "Attacks all enemies. 75% chance of placing a 60% Decrease DEF debuff for
--    2 turns. Also 50% chance of placing a Block Buffs debuff for 2 turns
--    (+5% per alive enemy)." Books: +5%, +10%, +10%.
-- So AoE Damage = the all-enemy attack; Decrease Defense = the 60% AoE Dec DEF.
-- 75% is the fully-booked chance; 50% unbooked (75 − 5 − 10 − 10).
--
-- This only rewrites the source_note (and corrects source_type in_game_index →
-- fandom_wiki, the actual source); status stays 'approved'. Cleanse, Leech,
-- Block Buffs, Healer, Revive, etc. are untouched. Idempotent — only touches
-- rows that still carry the TEST_DATA placeholder.
-- ============================================================================

update champion_tags ct
set source_type = 'fandom_wiki',
    source_note =
      'fandom_wiki A2 Maelstrom Wrack: attacks all enemies (AoE damage). '
      'Fully-booked chance 75%, 50% unbooked (books +5%, +10%, +10%). '
      'Cooldown 4 unbooked, 3 fully booked.'
from champions c, tags t
where ct.champion_id = c.id and ct.tag_id = t.id
  and c.name = 'Uugo' and c.game_id = 'raid_shadow_legends'
  and t.name = 'AoE Damage'
  and ct.source_note like 'TEST_DATA%';

update champion_tags ct
set source_type = 'fandom_wiki',
    source_note =
      'fandom_wiki A2 Maelstrom Wrack: [Decrease DEF] 60% for 2 turns. AoE '
      '(all enemies). 50% unbooked, 75% fully booked (books +5%, +10%, +10%). '
      'Cooldown 4 unbooked, 3 fully booked.'
from champions c, tags t
where ct.champion_id = c.id and ct.tag_id = t.id
  and c.name = 'Uugo' and c.game_id = 'raid_shadow_legends'
  and t.name = 'Decrease Defense'
  and ct.source_note like 'TEST_DATA%';
