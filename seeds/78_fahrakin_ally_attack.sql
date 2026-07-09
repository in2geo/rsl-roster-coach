-- ============================================================================
-- 78 — Fahrakin the Fat (Epic, Barbarians, Spirit, Attack): add the Ally Attack
-- tag. Closes the July-8 HIGH item "Fahrakin Ally Attack tag — needs manual add".
--
-- A3 Beatdown places Increase C.RATE + Increase C.DMG on all allies (except
-- Fahrakin) for 3 turns, then ALL those allies attack 1 target enemy. That
-- "all allies attack" is the Ally Attack mechanic — a distinct capability the
-- matching engine should be able to reason about (Fahrakin is the archetypal
-- Ally Attack CB champion; see seed 23 team-requirements + CLAUDE.md).
--
-- Two parts:
--   (1) New vocab row 'Ally Attack' (idempotent, on conflict do nothing).
--   (2) champion_tags row for Fahrakin, status='proposed', ar=0 (active skill).
--       Sourced fandom_wiki (A3 Beatdown text) — constraint-safe.
-- Idempotent (NOT EXISTS on the champion_tags insert). His five existing
-- proposed tags (Dec DEF, HP Burn, Poison, Inc C.DMG, Inc C.Rate) are untouched
-- and still await the normal proposed→approved review flip.
-- ============================================================================

-- ── New vocabulary: Ally Attack ──────────────────────────────────────────────
insert into tags (name, description, is_debuff, bypasses_accuracy_check)
values (
  'Ally Attack',
  'A skill that causes one or more allies to perform an attack, triggered by '
  'this champion (e.g. Fahrakin''s A3 Beatdown makes all allies attack a target). '
  'The allies deal their own damage and apply their own on-hit effects — this is '
  'a team-damage-multiplier mechanic, not a debuff. No ACC check.',
  false, false
)
on conflict (name) do nothing;

-- ── Fahrakin champion_tags ───────────────────────────────────────────────────
insert into champion_tags
  (champion_id, tag_id, status, source_type, source_note,
   proposed_by, proposed_at, ascension_required)
select ch.id, t.id, 'proposed', 'fandom_wiki',
  'fandom_wiki A3 Beatdown: places Increase C.RATE + Increase C.DMG on all '
  'allies except Fahrakin for 3 turns, then all those allies attack 1 target '
  'enemy (Ally Attack). Guaranteed — no chance roll. Cooldown 6 unbooked, 4 '
  'fully booked. Archetypal Ally Attack CB champion (see seed 23).',
  'claude-code-july-2026', now(), 0
from champions ch
join tags t on t.name = 'Ally Attack'
where ch.name = 'Fahrakin the Fat' and ch.game_id = 'raid_shadow_legends'
  and not exists (
    select 1 from champion_tags x where x.champion_id = ch.id and x.tag_id = t.id);
