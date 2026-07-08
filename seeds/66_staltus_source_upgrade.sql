-- ============================================================================
-- 66 — Source upgrade for Staltus Dragonbane's 3 approved tags.
--
-- NOT a new-tag seed. Re-sources the already-approved AoE Stun / Decrease Speed /
-- AoE Damage rows (originally raid_guide-scraped) to the in-game Index reading:
--   source_type -> 'in_game_index', source_note -> richer verbatim readings.
-- Status stays 'approved'; no rows added or removed. Idempotent.
-- ============================================================================

update champion_tags ct
set source_type = 'in_game_index',
    source_note = v.note
from (values
  ('AoE Stun',
   'A2 Drakehunter Tactics (L1/5, unbooked): attacks all enemies 2 times, each '
   'hit 35% chance Stun for 1 turn (50% fully booked, books: +15% Lvl4). '
   'Effective stun rate per enemy unbooked ~58% (1-(0.65)^2). Cooldown 4 '
   'unbooked, 3 booked. Damage scales off DEF. Confirmed from in-game Index '
   'screenshot July 2026.'),
  ('Decrease Speed',
   'A3 Dragon Heart (L1/6, unbooked): 75% chance 30% Decrease SPD for 2 turns — '
   'CONDITIONAL: only applies to enemies whose ATK ≤ DEF. 50% unbooked (books: '
   '+10% Lvl4, +15% Lvl5). Cooldown 5 unbooked, 4 booked. Against DEF-based '
   'bosses (Ice Golem, Clan Boss) this is the debuff that applies. Confirmed from '
   'in-game Index screenshot July 2026.'),
  ('AoE Damage',
   'A3 Dragon Heart: attacks all enemies after placing 60% Increase DEF on self. '
   'AoE component unconditional — always hits all enemies. Damage scales off DEF. '
   'Also proposes DEF Aura (+30% all battles, ascension_required=3 pending '
   'confirmation). Confirmed from in-game Index screenshot July 2026.')
) as v(tag, note)
join tags t on t.name = v.tag
join champions c on c.name = 'Staltus Dragonbane' and c.game_id = 'raid_shadow_legends'
where ct.tag_id = t.id and ct.champion_id = c.id;
