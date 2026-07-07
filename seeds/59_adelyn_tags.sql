-- ============================================================================
-- 59 — Adelyn (Legendary, Banner Lords, Force, role Support) champion_tags.
--
-- Source: AyumiLove skill text, read by hand (Tier 2, factual data only).
-- source_type='human_observation', status='proposed' — HUMAN REVIEW REQUIRED.
-- Idempotent (NOT EXISTS on champion + tag). DB champion name is 'Adelyn'
-- (NOT 'Chronicler Adelyn'). Not Mythical → champion_form left NULL.
--
-- Corrections vs the proposal:
--   * 'Decrease SPD' -> 'Decrease Speed' (actual tag name).
--   * 'Sleep' already exists in the DB (is_debuff=true, bypass=false) — only
--     'ACC Aura' is created here.
--
-- ascension_required:
--   * ACC Aura -> 3 (auras default to 3 per SOURCE_HIERARCHY.md; AyumiLove
--     cannot show gates — downgrade only on an in-game no-padlock screenshot).
--   * Active-skill effects -> 0.
--   * Passive "Perceive Weakness" (+3% damage per debuff Adelyn placed) is NOT
--     tagged — it's a damage amplifier with no matchable dungeon goal; document
--     in champion_ai_notes. If tagged later, default it to 3.
--
-- Sleep A3 "ignores Block Debuffs" is a distinct mechanic from ACC bypass — it
-- still passes the normal ACC/RES check (bypasses_accuracy_check stays false).
-- ============================================================================

-- ── New vocabulary: ACC Aura (Sleep already exists) ──────────────────────────
insert into tags (name, description, is_debuff, bypasses_accuracy_check)
values (
  'ACC Aura',
  'Increases Ally Accuracy in a specified placement (all battles, dungeons, '
  'arena, etc.), applied only when this champion is team leader. Raises debuff '
  'landing rates for all allies. Not a debuff — no ACC check.',
  false, false
)
on conflict (name) do nothing;

-- ── Adelyn champion_tags ─────────────────────────────────────────────────────
insert into champion_tags
  (champion_id, tag_id, status, source_type, source_note,
   proposed_by, proposed_at, ascension_required)
select ch.id, t.id, 'proposed', 'human_observation', v.note,
       'ayumilove-human-read-july-2026', now(), v.ar
from (values
  ('ACC Aura', 3,
   'Aura: Increases Ally ACC in All Battles by 60 — highest ACC aura in the '
   'project. As team leader adds +60 ACC to all allies, directly lifting debuff '
   'landing rates on threshold-sensitive stages. ascension_required=3 by default '
   'rule (AyumiLove cannot show gates). AyumiLove (human read).'),
  ('Healer', 0,
   'A2 Healing Script: heals all allies by 25% of Adelyn''s MAX HP (also '
   'restores 25% of each ally''s destroyed MAX HP — HP-destruction recovery, '
   'minor for current dungeon scope). Guaranteed. CD 4 unbooked / 3 fully '
   'booked. AyumiLove (human read).'),
  ('Sleep', 0,
   'A3 Writ of Sleep: 75% chance Sleep for 1 turn; 50% unbooked (books: +10% '
   'Lvl1, +15% Lvl2). Single-target. Ignores Block Debuffs (still passes the '
   'normal ACC/RES check — NOT an accuracy bypass). CD 5 unbooked / 3 fully '
   'booked. AyumiLove (human read).'),
  ('Decrease Attack', 0,
   'A3 Writ of Sleep: 75% chance 50% Decrease ATK for 2 turns; 50% unbooked '
   '(books: +10% Lvl1, +15% Lvl2). Single-target. Ignores Block Debuffs. Paired '
   'with Sleep + Decrease Speed on the same skill. AyumiLove (human read).'),
  ('Decrease Speed', 0,
   'A3 Writ of Sleep: 75% chance 30% Decrease SPD for 2 turns; 50% unbooked '
   '(books: +10% Lvl1, +15% Lvl2). Single-target. Ignores Block Debuffs. Paired '
   'with Sleep + Decrease Attack. AyumiLove (human read).')
) as v(tag, ar, note)
join champions ch on ch.name = 'Adelyn' and ch.game_id = 'raid_shadow_legends'
join tags t on t.name = v.tag
where not exists (
  select 1 from champion_tags x where x.champion_id = ch.id and x.tag_id = t.id
);
