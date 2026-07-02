-- ============================================================================
-- Human review of the raid.guide proposed tags for the five active battle-log
-- champions (Mike, 2026-07-01). Approves the 15 correct tags and deletes 4 false
-- positives where the scraper's bracket-extractor mistook a MENTION for a
-- placement (reflect passive / cleanse). Runs after seeds/13-15.
--
-- KNOWN LIMITATION: the false positives will re-appear on a re-scrape until the
-- scraper gains verb-context awareness (placed vs reflected/removed). Backlog.
-- ============================================================================

-- Delete false positives ------------------------------------------------------
-- Staltus: Untarnished [P] REFLECTS Weaken/Decrease DEF/Poison — it doesn't place them.
delete from champion_tags ct using champions ch, tags t
 where ct.champion_id = ch.id and ct.tag_id = t.id and ct.status = 'proposed'
   and ct.source_type = 'raid_guide' and ch.game_id = 'raid_shadow_legends'
   and ch.name = 'Staltus Dragonbane'
   and t.name in ('Decrease Defense', 'Poison', 'Weaken');
-- Uugo: Uugo's Brew REMOVES Heal Reduction from allies — it doesn't place it.
delete from champion_tags ct using champions ch, tags t
 where ct.champion_id = ch.id and ct.tag_id = t.id and ct.status = 'proposed'
   and ct.source_type = 'raid_guide' and ch.game_id = 'raid_shadow_legends'
   and ch.name = 'Uugo' and t.name = 'Heal Reduction';

-- Approve the correct tags ----------------------------------------------------
update champion_tags ct set status = 'approved', approved_by = 'Mike', approved_at = now()
 from champions ch, tags t
 where ct.champion_id = ch.id and ct.tag_id = t.id and ct.status = 'proposed'
   and ct.source_type = 'raid_guide' and ch.game_id = 'raid_shadow_legends'
   and (
     (ch.name = 'Staltus Dragonbane' and t.name in ('AoE Damage', 'AoE Stun', 'Decrease Speed', 'Decrease Turn Meter', 'Increase Defense'))
  or (ch.name = 'Fayne'              and t.name in ('Decrease Attack', 'Decrease Turn Meter', 'Weaken'))
  or (ch.name = 'Uugo'               and t.name in ('Block Buffs', 'Block Damage', 'Cleanse', 'Healer', 'Increase Speed', 'Leech', 'Revive'))
   );
