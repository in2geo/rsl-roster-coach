-- ============================================================================
-- 48 — Androc (Mythical) champion_ai_notes: the four flags from the skill read.
--
-- champion_ai_notes are injected into the AI explanation payload, so these are
-- written as guidance the model relays to the player (or uses to avoid a wrong
-- claim). status='proposed' — human review required. Idempotent: NOT EXISTS on
-- (champion, skill_slot, dungeon).
--
-- NOTE: champion_ai_notes has no champion_form column (only champion_tags /
-- champion_strategy_modifiers do), so form is stated inline. All four flags
-- concern the ALTERNATE form except where noted.
-- ============================================================================

insert into champion_ai_notes
  (champion_id, dungeon_id, skill_slot, instruction, source_note, status)
select ch.id, d.id, v.slot, v.instruction, v.src, 'proposed'
from (values
  -- Flag 1 — Gildthorn Assault 1-turn Decrease DEF is near-useless vs Clan Boss
  ('A1', 'Clan Boss',
   'Alternate form A1 (Gildthorn Assault) places 60% Decrease DEF on ALL '
   'enemies, but only for 1 turn and only at 50% chance. Against Clan Boss '
   'this is close to useless — a 1-turn debuff expires before the team can '
   'reliably exploit it over a full turn cycle, and it loses to dedicated '
   'Decrease DEF champions who hold it for 2+ turns. Do NOT count Androc''s '
   'alternate form as a Clan Boss Decrease Defense source. The short duration '
   'is fine for dungeon wave clearing, where you burst the same turn it lands.',
   'Flag 1 — human skill read (AyumiLove): 60% Decrease DEF, 1 turn, 50% '
   'chance, alternate form A1. 50% unbooked = 50% booked (no chance books).'),

  -- Flag 2 — Alt A2 books are Ignore RES +20%, NOT Buff/Debuff Chance
  ('A2', NULL,
   'When explaining alternate form A2 (Palisade Breaker), note its books are '
   '"Ignore RES +20%", NOT "Buff/Debuff Chance". Booking does NOT raise the '
   'landing chance of its Decrease RES / Weaken / Enfeeble — it only makes '
   'those debuffs act as if the targets have 20% less Resistance. Never tell '
   'the player that booking increases his debuff apply rate.',
   'Flag 2 — book progression mechanic distinction, human read. Ignore RES '
   'reduces effective target RES; it is not a landing-chance increase.'),

  -- Flag 3 — Alt A3 buff strip is not a Cleanse
  ('A3', NULL,
   'Alternate form A3 (Roar of Kitherus) removes all buffs FROM ENEMIES before '
   'attacking. This is a buff strip, not a Cleanse — it does not remove '
   'debuffs from your own team. Never surface Androc as a cleanser / '
   'debuff-remover for the ally side; his removal only affects enemies '
   '(tagged Buff Strip).',
   'Flag 3 — buff strip vs cleanse, human read. Distinct ally-side mechanic '
   'we do not tag him with.'),

  -- Flag 4 — passive Lionheart ACC synergy + unconfirmed ascension status
  ('passive', NULL,
   'Alternate form passive Lionheart [P]: each ally gains +10 ACC for every '
   'buff currently on the ENEMY team (stacks with enemy buff count) — strongest '
   'against bosses/enemies that maintain self-buffs. Tension to note: his own '
   'alternate A3 strips enemy buffs, removing the very buffs that feed this ACC '
   'bonus that turn. Base form mirror is Knights of the Wild [P] (ally RES +10 '
   'per buff on allies). Ascension status of BOTH passives is UNCONFIRMED — '
   'assume they unlock at Ascension Level 3 (project default) until an '
   'unascended in-game screenshot proves otherwise; passive tags are not yet '
   'seeded.',
   'Flag 4 — passive synergy + ascension status unknown, human read. Default '
   'ascension_required=3 per SOURCE_HIERARCHY.md.')
) as v(slot, dungeon_name, instruction, src)
join champions ch on ch.name = 'Androc' and ch.game_id = 'raid_shadow_legends'
left join dungeons d on d.name = v.dungeon_name
where not exists (
  select 1 from champion_ai_notes n
  where n.champion_id = ch.id
    and n.skill_slot  = v.slot
    and n.dungeon_id is not distinct from d.id
);
