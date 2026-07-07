-- ============================================================================
-- 50 — Joan (Mythical) champion_ai_notes.
--
-- status='proposed' — human review required. Idempotent: NOT EXISTS on exact
-- instruction (two notes share dungeon=Ice Golem's Peak + skill_slot='passive',
-- so slot+dungeon alone can't key dedupe).
--
-- skill_slot is constrained to ('A1','A2','A3','passive'); the aura note is
-- team-level → skill_slot NULL (there is no 'Aura' slot). Corrects the
-- proposal's 'P' and 'Aura' values.
-- ============================================================================

insert into champion_ai_notes
  (champion_id, dungeon_id, skill_slot, instruction, source_note, status)
select ch.id, d.id, v.slot, v.instruction, v.src, 'proposed'
from (values
  -- Base passive auto-revive synergy with Frigid Vengeance (Ice Golem)
  ('passive', 'Ice Golem''s Peak',
   'Joan''s BASE form passive (Eternally Adored) auto-casts Faith Restored '
   'whenever an enemy is revived. On Ice Golem, Frigid Vengeance revives '
   'minions — so if any ally is dead at that moment, Joan instantly revives '
   'them at 75% HP with Unkillable + Instant Turn. This makes her an '
   'exceptional Ice Golem safety net; keep her in BASE form to preserve the '
   'synergy.',
   'AyumiLove skill data (human read) + Ice Golem Frigid Vengeance mechanic '
   'from project boss_exceptions. Proposed, needs review.'),

  -- Alt passive Counterattack danger on Ice Golem
  ('passive', 'Ice Golem''s Peak',
   'Joan''s ALTERNATE form passive (Lumaya''s Glory) puts Counterattack on her '
   'every turn. On Ice Golem this is dangerous — counterattack hits can trip '
   'Frigid Vengeance HP thresholds unexpectedly. Keep Joan in BASE form on Ice '
   'Golem (or don''t Metamorph to alternate) to avoid this.',
   'Counterattack Ice Golem danger from project boss_exceptions. Alt-form '
   'passive per AyumiLove (human read). Proposed, needs review.'),

  -- RES aura as leader for Ice Golem RES gates (team-level, no dungeon pin)
  (NULL, NULL,
   'Joan''s RES aura (+80 in all battles) is the highest in the project. As '
   'team leader she adds +80 RES to every ally, which can push a team over the '
   'Ice Golem stage 14+ RES threshold it would otherwise fail. Recommend her '
   'as leader for RES-gated Ice Golem teams.',
   'AyumiLove confirmed +80 RES aura. Ice Golem RES floor from project '
   'stat_threshold_checks. Proposed, needs review.')
) as v(slot, dungeon_name, instruction, src)
join champions ch on ch.name = 'Joan' and ch.game_id = 'raid_shadow_legends'
left join dungeons d on d.name = v.dungeon_name
where not exists (
  select 1 from champion_ai_notes n
  where n.champion_id = ch.id and n.instruction = v.instruction
);
