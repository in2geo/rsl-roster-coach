-- ============================================================================
-- 60 — Adelyn (Legendary) champion_ai_notes: passive "Perceive Weakness" synergy.
--
-- Perceive Weakness (+3% ally damage vs the target per debuff Adelyn placed) is
-- a damage amplifier with no matchable dungeon goal tag — documented here for
-- the Dragon and Ice Golem boss phases where her A3 (Sleep + Decrease ATK +
-- Decrease SPD) can land all three debuffs. status='proposed' — human review
-- required. Idempotent: NOT EXISTS on exact instruction.
-- ============================================================================

insert into champion_ai_notes
  (champion_id, dungeon_id, skill_slot, instruction, source_note, status)
select ch.id, d.id, 'passive', v.instruction, v.src, 'proposed'
from (values
  ('Dragon''s Lair',
   'Adelyn''s passive (Perceive Weakness) gives all allies +3% damage per '
   'debuff she has placed on the target. If her A3 lands all three debuffs '
   '(Sleep, Decrease ATK, Decrease SPD) on the Dragon boss, the whole team '
   'deals +9% more damage to it. Pair her with high-damage dealers in the boss '
   'phase to capitalize. ACC must be high enough for A3 to land — at Dragon '
   'stage 15-20 this means 225+ ACC including her own aura.',
   'AyumiLove skill data (human read). Passive synergy proposed, needs review.'),
  ('Ice Golem''s Peak',
   'Adelyn''s passive (Perceive Weakness) gives all allies +3% damage per '
   'debuff she placed on the target. On Ice Golem boss, if Sleep, Decrease ATK '
   'and Decrease SPD all land via A3, the team deals +9% more damage. Note: '
   'Sleep on Ice Golem boss may interact with Frigid Vengeance mechanics — '
   'verify whether Sleep delays the boss turn and how that interacts with the '
   'HP threshold trigger.',
   'AyumiLove skill data (human read). Ice Golem Sleep interaction unverified — '
   'flagged for review.')
) as v(dungeon_name, instruction, src)
join champions ch on ch.name = 'Adelyn' and ch.game_id = 'raid_shadow_legends'
join dungeons d on d.name = v.dungeon_name
where not exists (
  select 1 from champion_ai_notes n
  where n.champion_id = ch.id and n.instruction = v.instruction
);
