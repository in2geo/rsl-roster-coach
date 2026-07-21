-- ============================================================================
-- Seed 203 — Mike's rulings on seeds 201 + 202 (2026-07-21)
--
-- Two decisions, both his, both recorded here rather than applied ad hoc (the
-- "all content changes go through committed seed files" rule).
--
--  1. REJECT Skull Lord Var-Gall's `Revive` under policy #15 (ally-gated skill).
--  2. APPROVE the 46 rows seeds 201/202 landed as `proposed`
--     (8 `Self-Revive` + 38 `Max HP Destruction`).
--
-- ── 1. VAR-GALL — the correction behind this ruling ─────────────────────────
-- Claude proposed a new `Minion Revive` tag for him, describing his Passive 2 as
-- reviving "his own summoned minion". THAT WAS WRONG, and the error was invented
-- rather than read:
--     Passive 2: "Revives Skullsworn with 50% HP and 50% Turn Meter at the start
--                 of each turn. [If there are multiple Skullsworns on the team,
--                 only one of them will be revived.]"
-- SKULLSWORN IS A REAL CHAMPION — Rare, Lizardmen, in the champions table. So the
-- clause is an ALLY revive, and the correct question was never "what kind of minion
-- mechanic is this" but "is this ally-GATED". It is. A sweep for genuine summon
-- revivers across all 87 Revive-tagged champions found ZERO.
--
-- Policy #15 (synergy-dependent skills): a skill that only becomes available when a
-- SPECIFIC ALLY is on the team → REJECT. Var-Gall differs from the other ally-gated
-- revivers precisely where it matters: Rian (+Akoth/Urost), Djamarsa (+Crohnam) and
-- Noldua (+Solanar) each revive allies UNCONDITIONALLY in the base skill and merely
-- add a named special case — policy #15's SCOPE note keeps those approved. Var-Gall
-- has NO unconditional revive at all; without Skullsworn fielded, the passive has no
-- target and the team gets nothing. The engine must not count team recovery it only
-- gets in one specific roster pairing.
--
-- ── 2. THE 46 APPROVALS ─────────────────────────────────────────────────────
-- Both parent seeds landed their new rows as `proposed` per the no-auto-merge rule,
-- so the engine could not read them. Mike reviewed and approved 2026-07-21. Until
-- now the net effect of 201/202 was purely SUBTRACTIVE (false capability removed);
-- this is the half that adds the corrected capability back in its right form.
-- ============================================================================

BEGIN;

-- ── 1. Var-Gall: reject the ally-gated Revive ───────────────────────────────
update champion_tags ct set status = 'rejected',
  source_note = coalesce(ct.source_note, '') ||
    ' | REJECTED (policy #15, seed 203, Mike 2026-07-21): the ONLY revive in this kit is '
    'Passive 2 "Revives Skullsworn…", and Skullsworn is a specific ALLY CHAMPION (Rare, '
    'Lizardmen) — not a summon. With no unconditional revive, this is a synergy-gated skill '
    'and must not be credited as team recovery. NB it is NOT a minion mechanic: a sweep of '
    'all 87 Revive-tagged champions found zero genuine summon revivers.'
from champions c, tags t
where ct.champion_id = c.id and ct.tag_id = t.id
  and t.name = 'Revive' and ct.status = 'approved'
  and c.name = 'Skull Lord Var-Gall';

-- ── 2. Approve the 46 rows from seeds 201 + 202 ─────────────────────────────
update champion_tags ct set status = 'approved',
  approved_by = 'mike', approved_at = now()
from tags t
where ct.tag_id = t.id
  and ct.status = 'proposed'
  and t.name in ('Self-Revive', 'Max HP Destruction');

COMMIT;

-- VERIFY (expected values, not guesses):
--   Revive approved            80 -> 79   (Var-Gall removed)
--   Self-Revive approved        0 -> 8
--   Max HP Destruction approved 0 -> 38
--   Enemy Max HP Damage approved      8   (unchanged by this seed)
--
--   select t.name, ct.status, count(distinct ct.champion_id)
--     from champion_tags ct join tags t on t.id = ct.tag_id
--    where t.name in ('Revive','Self-Revive','Max HP Destruction','Enemy Max HP Damage')
--    group by 1,2 order by 1,2;
--
--   -- Lydia must still hold BOTH, now both approved:
--   select t.name, ct.status from champion_tags ct
--     join tags t on t.id=ct.tag_id join champions c on c.id=ct.champion_id
--    where c.name='Lydia' and t.name in ('Revive','Self-Revive');
