-- ============================================================================
-- 47 — Androc (Mythical, Banner Lords, Void, role Defense) champion_tags.
--
-- Source: AyumiLove skill text, read by hand (Tier 2, factual game data only).
-- source_type='human_observation', status='proposed' — HUMAN REVIEW REQUIRED
-- (the engine reads only 'approved' rows). Idempotent (NOT EXISTS on champion +
-- tag), so re-running is safe.
--
-- Mythical champion: every row carries champion_form ('base' | 'alternate' |
-- 'both') per migrations/2026-07-02_champion_forms_and_team_requirements.sql.
-- DB champion name is 'Androc' (NOT 'Androc the Glorious' — display-name drift).
--
-- ascension_required:
--   * Aura -> 3. Per SOURCE_HIERARCHY.md (2026-07-06), auras default to
--     ascension_required=3 unless an unascended in-game screenshot shows no
--     padlock. Source here is AyumiLove, which cannot show ascension gates, so
--     the default stands. Downgrade to 0 only on an in-game no-padlock capture.
--   * Active-skill effects (A1/A2/A3) -> 0 (present from acquisition, not gated).
--   * Passives (Knights of the Wild [P] / Lionheart [P]) are NOT tagged here —
--     they produce no dungeon goal tag. If tagged later, default them to 3.
-- ============================================================================

-- ── Vocabulary the tags below depend on (create if absent) ───────────────────
-- Decrease RES already exists (seed 31). These five are new.
insert into tags (name, description, is_debuff, bypasses_accuracy_check)
values
  ('Strengthen',
   'Buff placed on allies that reduces incoming damage (e.g. 25%). An ally '
   'buff — no ACC/RES check.',
   false, false),
  ('AoE Decrease Defense',
   'Reduces the Defense of ALL enemies. Distinct from single-target '
   '[Decrease Defense]; modeled as its own AoE tag like [AoE Decrease Turn '
   'Meter]. Subject to ACC/RES check to land.',
   true, false),
  ('Enemy Max HP Damage',
   'Deals damage as a percentage of the target''s MAX HP, ignoring DEF. '
   'Typically boss-only. Not a debuff — no ACC/RES check.',
   false, false),
  ('Enfeeble',
   'Reduces the damage dealt by the target. A debuff on enemies, subject to '
   'ACC/RES check. On Androc alternate A2 it cannot be removed if the target '
   'is at or below 50% HP.',
   true, false),
  ('Buff Strip',
   'Removes all active buffs from enemies before/during the attack. Not '
   'subject to ACC/RES check — buff removal is guaranteed regardless of '
   'Resistance. Distinct from [Cleanse] (removes debuffs from allies).',
   false, false)
on conflict (name) do nothing;

-- ── Androc champion_tags ─────────────────────────────────────────────────────
insert into champion_tags
  (champion_id, tag_id, status, source_type, source_note,
   proposed_by, proposed_at, ascension_required, champion_form)
select ch.id, t.id, 'proposed', 'human_observation', v.note,
       'ayumilove-human-read-july-2026', now(), v.ar, v.form
from (values
  -- Aura (both forms)
  ('Defense Aura', 'both', 3,
   'Aura: Increases Ally DEF in All Battles by 35%. Confirmed on both Base and '
   'Alternate form screens (AyumiLove, human read). ascension_required=3 by '
   'default rule — AyumiLove cannot show ascension gates; downgrade only on an '
   'in-game no-padlock screenshot.'),

  -- Base form
  ('Healer', 'base', 0,
   'Base A2 Radiant Claw: heals all allies 4% MAX HP per ally buff whose '
   'duration it extended by 1 turn. Conditional heal scaling with active buff '
   'count. CD 5 unbooked / 3 fully booked. No Buff/Debuff Chance in books, so '
   'the heal trigger is not chance-gated. AyumiLove (human read).'),
  ('Continuous Heal', 'base', 0,
   'Base A3 Rock of Werinbur: places 15% Continuous Heal on all allies for 2 '
   'turns (extra 15% on allies below 50% HP). CD 5 unbooked / 3 fully booked. '
   'AyumiLove (human read).'),
  ('Strengthen', 'base', 0,
   'Base A3 Rock of Werinbur: places 25% Strengthen on all allies for 2 turns '
   '(alongside 50% Increase RES and Continuous Heal). AyumiLove (human read).'),

  -- Alternate form
  ('AoE Decrease Defense', 'alternate', 0,
   'Alt A1 Gildthorn Assault: single-target hit, but the 60% Decrease DEF (1 '
   'turn) lands on ALL enemies at 50% chance — effectively AoE Decrease '
   'Defense. 50% unbooked = 50% booked (no Buff/Debuff Chance books). FLAG: '
   '1-turn duration is very short — team must capitalize immediately; near-'
   'useless vs Clan Boss (see champion_ai_notes). AyumiLove (human read).'),
  ('Weaken', 'alternate', 0,
   'Alt A2 Palisade Breaker: places 25% Weaken on all enemies for 2 turns '
   '(with Decrease RES + Enfeeble). No Buff/Debuff Chance books -> unbooked = '
   'booked. CD 4 unbooked / 3 booked. AyumiLove (human read).'),
  ('Decrease RES', 'alternate', 0,
   'Alt A2 Palisade Breaker: places 50% Decrease RES on all enemies for 2 '
   'turns. Books are Ignore RES +20% (NOT Buff/Debuff Chance) — landing chance '
   'unchanged, targets act as if 20% less RES when booked. AyumiLove (human '
   'read).'),
  ('AoE Decrease Turn Meter', 'alternate', 0,
   'Alt A2 Palisade Breaker: decreases TM of all enemies by 15%. Landed debuff '
   '(ACC check applies). AyumiLove (human read).'),
  ('Enfeeble', 'alternate', 0,
   'Alt A2 Palisade Breaker: places Enfeeble on all enemies for 2 turns; '
   'cannot be removed if target HP <= 50%. AyumiLove (human read).'),
  ('Block Buffs', 'alternate', 0,
   'Alt A3 Roar of Kitherus: after stripping buffs, places Block Buffs on '
   'enemies that had no buffs, for 2 turns. CD 4 unbooked / 3 booked. '
   'AyumiLove (human read).'),
  ('Buff Strip', 'alternate', 0,
   'Alt A3 Roar of Kitherus: removes ALL buffs from all enemies before '
   'attacking (guaranteed, no ACC check). AyumiLove (human read).'),
  ('Enemy Max HP Damage', 'alternate', 0,
   'Alt A3 Roar of Kitherus: when the target is a Boss, damage = 10% of Boss '
   'MAX HP (ignores DEF). No effect on non-boss enemies. Relevant to Dragon, '
   'Clan Boss, Ice Golem boss phase. AyumiLove (human read).')
) as v(tag, form, ar, note)
join champions ch on ch.name = 'Androc' and ch.game_id = 'raid_shadow_legends'
join tags t on t.name = v.tag
where not exists (
  select 1 from champion_tags x
  where x.champion_id = ch.id and x.tag_id = t.id
);
