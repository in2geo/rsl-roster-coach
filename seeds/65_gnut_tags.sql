-- ============================================================================
-- 65 — Gnut (Legendary, Dwarves, Void, Defense) — in-game Index reading.
-- source_type='in_game_index', status='proposed'. HUMAN REVIEW REQUIRED.
-- Idempotent (NOT EXISTS). Not Mythical → champion_form NULL. Gnut had no
-- prior tags (all net-new).
--
-- Flag 1 resolved: A1's Freeze is SINGLE-TARGET; the single-target 'Freeze' tag
-- already exists (parallel to 'Stun'), so it's used instead of 'AoE Freeze'.
--
-- ascension_required: active-skill effects -> 0; ACC Aura -> 3 (star-color
-- default). A1 Decrease Turn Meter is a genuine landed debuff (primary effect,
-- Freeze is the per-hit fallback), NOT conditional like Staltus — so it counts.
-- ============================================================================

insert into champion_tags
  (champion_id, tag_id, status, source_type, source_note, proposed_by, proposed_at, ascension_required)
select ch.id, t.id, 'proposed', 'in_game_index', v.note, 'in-game-index-screenshot-july-2026', now(), v.ar
from (values
  ('Decrease Turn Meter', 0,
   'A1 Dwarven Might (L1/5, unbooked): attacks 1 enemy 3 times; each hit 80% '
   'chance to decrease TM by 15%. 60% unbooked (books: +10% Lvl4, +10% Lvl5). '
   'Per-hit FALLBACK: if the TM decrease is resisted, that hit instead has an 80% '
   'chance to place Freeze (mutually exclusive per hit). Single-target — landed, '
   'primary effect (Gnut IS a real TM controller). In-game Index July 2026.'),
  ('Freeze', 0,
   'A1 Dwarven Might: 80% chance Freeze for 1 turn per hit — ONLY triggers when '
   'the TM decrease failed to land on that hit (mutually exclusive with the TM '
   'decrease per hit). 60% unbooked. Single-target (3 hits). In-game Index July '
   '2026.'),
  ('Decrease Attack', 0,
   'A2 Fury of the King (L1/6, unbooked): 75% chance 50% Decrease ATK on all '
   'enemies for 2 turns. 50% unbooked (books: +10% Lvl4, +15% Lvl5). AoE; lands '
   'alongside Weaken. Cooldown 4 unbooked, 3 fully booked. Also places '
   'Counterattack on Gnut (guaranteed). In-game Index July 2026.'),
  ('Weaken', 0,
   'A2 Fury of the King (L1/6, unbooked): 75% chance 25% Weaken on all enemies for '
   '2 turns. 50% unbooked (books: +10% Lvl4, +15% Lvl5). AoE; lands alongside '
   'Decrease ATK at the same probability. In-game Index July 2026.'),
  ('Counterattack', 0,
   'A2 Fury of the King: places Counterattack on Gnut for 2 turns. Guaranteed — no '
   'chance roll. Self only. WARNING: Counterattack is dangerous on Ice Golem — '
   'counterattack hits can trigger Frigid Vengeance HP thresholds. See '
   'champion_ai_notes. In-game Index July 2026.'),
  ('Enemy Max HP Damage', 0,
   'A3 Blessed Bash (L1/4, unbooked): 3 hits; damage scales off DEF AND enemy MAX '
   'HP. Each hit decreases target DEF by 3% (stacks to 30%) and heals Gnut by 30% '
   'of damage dealt (self-sustain). Cooldown 5 unbooked, 4 fully booked. In-game '
   'Index July 2026.'),
  ('ACC Aura', 3,
   'Aura: Increases Ally ACC in DUNGEONS by 80 (dungeon-only — does NOT apply in '
   'Arena or Clan Boss; placement not modeled in schema, see KNOWN_GAPS). Highest '
   'dungeon ACC aura in the project; as leader adds +80 ACC to all allies in '
   'dungeons — significant for Dragon 15-20 (ACC 225+ floor) and Spider. '
   'ascension_required=3 (star-color default). In-game Index July 2026.')
) as v(tag, ar, note)
join champions ch on ch.name = 'Gnut' and ch.game_id = 'raid_shadow_legends'
join tags t on t.name = v.tag
where not exists (select 1 from champion_tags x where x.champion_id = ch.id and x.tag_id = t.id);

-- ── AI note: Counterattack danger on Ice Golem ───────────────────────────────
insert into champion_ai_notes (champion_id, dungeon_id, skill_slot, instruction, source_note, status)
select ch.id, d.id, 'A2',
  'Gnut''s A2 (Fury of the King) places a guaranteed Counterattack on himself for '
  '2 turns. On Ice Golem this is dangerous — his counterattack hits can trip '
  'Frigid Vengeance HP thresholds unexpectedly (same caution as Joan/Celendiel). '
  'Field him on Ice Golem only if the team can control the boss''s HP threshold, '
  'or avoid casting A2 into the threshold window.',
  'In-game Index screenshot July 2026 + Ice Golem Frigid Vengeance from project '
  'boss_exceptions. Proposed, needs review.',
  'proposed'
from champions ch join dungeons d on d.name = 'Ice Golem''s Peak'
where ch.name = 'Gnut' and ch.game_id = 'raid_shadow_legends'
  and not exists (
    select 1 from champion_ai_notes n
    where n.champion_id = ch.id and n.dungeon_id = d.id and n.instruction like 'Gnut%Counterattack%');
