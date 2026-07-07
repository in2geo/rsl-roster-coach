-- ============================================================================
-- 49 — Joan (Mythical, Banner Lords, Magic, role Attack) champion_tags.
--
-- Source: AyumiLove skill text, read by hand (Tier 2, factual data only).
-- source_type='human_observation', status='proposed' — HUMAN REVIEW REQUIRED.
-- Idempotent (NOT EXISTS on champion + tag). DB champion name is 'Joan'
-- (NOT 'Joan the Luminant' — display-name drift). Mythical → champion_form set.
--
-- ascension_required:
--   * RES Aura -> 3 (auras default to 3 per SOURCE_HIERARCHY.md; AyumiLove
--     cannot show gates — downgrade only on an in-game no-padlock screenshot).
--   * Counterattack (alt passive Lumaya's Glory) -> 3 (passive default).
--   * Active-skill effects -> 0.
--   * Base passive Eternally Adored produces no matchable tag — documented in
--     champion_ai_notes (seed 50) instead.
-- ============================================================================

-- ── New vocabulary ───────────────────────────────────────────────────────────
insert into tags (name, description, is_debuff, bypasses_accuracy_check)
values
  ('Buff Spread',
   'Takes a random buff from one or more allies and copies/places it on all '
   'allies. Amplifies strong single-target buffs (Unkillable, Block Damage) '
   'across the team. An ally-side effect — no ACC/RES check.',
   false, false)
on conflict (name) do nothing;

-- ── Joan champion_tags ───────────────────────────────────────────────────────
insert into champion_tags
  (champion_id, tag_id, status, source_type, source_note,
   proposed_by, proposed_at, ascension_required, champion_form)
select ch.id, t.id, 'proposed', 'human_observation', v.note,
       'ayumilove-human-read-july-2026', now(), v.ar, v.form
from (values
  -- Aura (both forms)
  ('RES Aura', 'both', 3,
   'Aura: Increases Ally RES in All Battles by 80 (flat). Confirmed on both '
   'Base and Alternate form screens. Highest RES aura in the project — '
   'materially shifts Ice Golem RES threshold checks. ascension_required=3 by '
   'default rule (AyumiLove cannot show gates; downgrade only on an in-game '
   'no-padlock screenshot). AyumiLove (human read).'),

  -- Base form
  ('Healer', 'base', 0,
   'Base A1 Sacred Lance: heals all allies proportional to their RES + 5% MAX '
   'HP each use. Heal scales with RES — synergizes with her own +80 RES aura. '
   'AyumiLove (human read).'),
  ('Buff Spread', 'base', 0,
   'Base A1 Sacred Lance: also spreads a random ally buff to all allies — 20% '
   'chance unbooked, 35% fully booked (books: +15% Buff/Debuff Chance). '
   'AyumiLove (human read).'),
  ('Cleanse', 'base', 0,
   'Base A2 Symbol of Hope: removes ALL debuffs from all allies — guaranteed, '
   'no chance roll. Also places Increase ATK + Increase RES and fills TM 15%. '
   'CD 4 unbooked / 3 fully booked. AyumiLove (human read).'),
  ('Revive', 'base', 0,
   'Base A3 Faith Restored: revives 1 dead ally at 75% HP with Unkillable (2 '
   'turns) and Instant Turn — revived ally acts immediately and cannot die '
   'that turn. CD 4 unbooked / 3 fully booked. AyumiLove (human read).'),

  -- Alternate form
  ('AoE Decrease Turn Meter', 'alternate', 0,
   'Alt A2 Pierced By Light: steals 25% TM from ALL enemies before attacking. '
   'Cannot be resisted — matches the tag''s tag-level bypasses_accuracy_check='
   'true, so it lands regardless of ACC. CD 4 unbooked / 3 fully booked. '
   'Reliable TM control for Fire Knight / Dragon wave phases. AyumiLove (human '
   'read).'),
  ('Block Revive', 'alternate', 0,
   'Alt A3 Seraphic Swoop: places Block Revive on a killed target IF the '
   'target''s RES is lower than Joan''s RES. Conditional — fires only on kill '
   'and only when Joan out-RESists the target. CD 5 unbooked / 4 fully booked. '
   'AyumiLove (human read).'),
  ('Counterattack', 'alternate', 3,
   'Alt passive Lumaya''s Glory: at the end of every turn places a PROTECTED '
   'Counterattack buff on Joan for 1 turn (cannot be stripped/stolen) — '
   'effectively guaranteed Counterattack each turn. ascension_required=3 '
   '(passive default). WARNING: Counterattack is dangerous on Ice Golem — see '
   'champion_ai_notes. AyumiLove (human read).')
) as v(tag, form, ar, note)
join champions ch on ch.name = 'Joan' and ch.game_id = 'raid_shadow_legends'
join tags t on t.name = v.tag
where not exists (
  select 1 from champion_tags x
  where x.champion_id = ch.id and x.tag_id = t.id
);
