-- ============================================================================
-- Seed 201 — PROPOSED: split SELF-REVIVE out of the ally `Revive` capability
--
-- ⚠⚠ NOT APPLIED. NEEDS MIKE'S SIGN-OFF. Same three reasons as seed 166:
--   1. It implies a NEW TAG POLICY (#21 below). CLAUDE.md: "Every new tag or rule
--      gets proposed in structured form, then reviewed and approved by a human
--      before it's considered live. No auto-merge."
--   2. Policy #18 requires any tag ruling to be written back to DB_Champion_Tags in
--      the master worksheet IN THE SAME SESSION or it is ORPHANED. That worksheet
--      write is still OWED for this seed.
--   3. It changes live recommendation behaviour (removes a team-sustain capability
--      from 7 champions).
--
-- FOUND BY: Mike, 2026-07-21 — "xenomorph is not a reviver and Sun Wu only revives
-- himself." Both confirmed verbatim. The tag's OWN source_note already recorded the
-- disproof:
--     Xenomorph  — "Revives THIS CHAMPION with 50% HP ... whenever an enemy under
--                   an [Infest] debuff dies."
--     Sun Wukong — "Revives THIS CHAMPION with 100% HP and 100% Turn Meter 3 turns
--                   after they were killed."
-- The tagger transcribed the text correctly and then applied the wrong tag. And the
-- vocabulary itself already draws the line: tags.Revive.description reads
-- "Brings a dead ALLY back to life" — these champions never met the definition.
--
-- ▶ PROPOSED TAG POLICY #21 — SELF-REVIVE ≠ ALLY REVIVE (the #19 boundary, again)
--   "Revives this Champion / revives them(selves)" is PERSONAL DURABILITY. "Revives
--   an ally / all dead allies" is TEAM RECOVERY. They are different capabilities and
--   must not share a tag. → tag self-revive as `Self-Revive`; reserve `Revive` for
--   bringing back an ALLY.
--   This is policy #19's rule restated on a new axis. #19: "BOUNDARY: side decides
--   the tag" (a buff removed from an ENEMY is Buff Strip; debuffs removed from an
--   ALLY are Cleanse). #20 does it for self-CONDITIONS; #9 for innate-vs-placed
--   Counterattack. Same root cause every time: the tag names an EFFECT without
--   checking WHO RECEIVES IT.
--   WHY IT MATTERS MECHANICALLY (not pedantry): the engine reads `Revive` as team
--   sustain — "if someone dies we get them back". Sustain is MULTIPLICATIVE and,
--   worse, a single point of failure (lib/damage-mechanics.js §3). A self-revive
--   contributes NOTHING to that: Xenomorph reviving himself keeps a damage dealer
--   running, but rescues no one. Crediting it as team sustain is the over-credit
--   failure §1 exists to prevent, applied to the survival side.
--   BOUNDARY vs the existing `Revive on Death` tag: that is the [Revive on Death]
--   BUFF PLACED on an ally (a placement). #21 is about an innate self-resurrection
--   that places no buff. Keep them distinct.
--
-- METHOD: read all 100 clauses containing "reviv" across the 87 champions carrying
-- an approved `Revive` tag, and classify by RECIPIENT from literal skill_summary.
--   ally revive — tag CORRECT, unchanged .................... 78
--   self-revive only — RE-CLASSIFIED: the `Revive` ROW is
--     rejected and a `Self-Revive` row added. These champions
--     DO self-revive; that is exactly why they must not carry
--     `Revive`, which means "brings a dead ALLY back to life".
--     Nobody loses a capability they actually have. ...........  7
--   both self and ally (Lydia) — keeps `Revive`, GAINS
--     `Self-Revive` ...........................................  1
--   minion-only — FLAGGED, no change proposed ................  1
-- ⚠ Do NOT regex this. A first pass missed every "revives 2 random allies" (it only
-- matched "a random ally") and MIS-READ Arne, whose "revives THEM" refers back to
-- "this Champion". Every row below was read by eye.
-- ============================================================================

BEGIN;

-- ── 1. New vocabulary term ──────────────────────────────────────────────────
insert into tags (id, name, description, is_debuff, bypasses_accuracy_check, game_id)
select gen_random_uuid(), 'Self-Revive',
       'Brings only THIS champion back to life (personal durability, not team recovery). '
       'Distinct from Revive, which brings back a dead ALLY. See tag policy #21.',
       false, false, 'raid_shadow_legends'
where not exists (select 1 from tags where name = 'Self-Revive' and game_id = 'raid_shadow_legends');

-- ── 2. REJECT the 7 self-only `Revive` tags ─────────────────────────────────
-- Verbatim evidence for each, from champion_skills.skill_summary:
--   Arne       [Passive] "Whenever this Champion is killed, revives THEM with 50% HP,
--                        100% Turn Meter, and places a [Block Damage] buff on them"
--   Bushi      [A3]      "Revives THIS CHAMPION with 30% HP."
--   Minaya     [Passive] "Revives THIS CHAMPION with 75% HP when killed if Khoronar
--                        is on the same team."   (also ally-GATED — doubly not team sustain)
--   Skullcrown [Passive2]"Revives THIS CHAMPION with 30% HP."
--   Solanar    [Passive] "Once per Round, if this Champion is dead, revives THIS
--                        CHAMPION with 100% HP ... when their last living ally is killed."
--   Sun Wukong [A4]      "Revives THIS CHAMPION with 100% HP and 100% Turn Meter 3
--                        turns after they were killed."
--   Xenomorph  [A2]      "[Passive Effect] Revives THIS CHAMPION with 50% HP and 50%
--                        Turn Meter whenever an enemy under an [Infest] debuff dies."
update champion_tags ct set status = 'rejected',
  source_note = coalesce(ct.source_note,'') ||
    ' | REJECTED (policy #21, seed 201): revives only THIS CHAMPION — personal durability, '
    'not team recovery. Re-tagged Self-Revive. tags.Revive = "brings a dead ALLY back to life".'
from champions c, tags t
where ct.champion_id = c.id and ct.tag_id = t.id
  and t.name = 'Revive' and ct.status = 'approved'
  and c.name in ('Arne','Bushi','Minaya','Skullcrown','Solanar','Sun Wukong','Xenomorph');

-- ── 3. ADD `Self-Revive` for those 7, plus Lydia (who does BOTH) ────────────
--   Lydia [Passive] "If this Champion is ALIVE when an enemy revive is denied, revives
--                    ALL DEAD ALLIES with 50% HP and 50% Turn Meter. If this Champion
--                    is DEAD ..., revives THIS CHAMPION with 50% HP and 50% Turn Meter."
--   → genuinely both. Her `Revive` tag is CORRECT and is left approved; Self-Revive is
--     added alongside. This is the case that proves the two tags must coexist.
insert into champion_tags (id, champion_id, tag_id, status, source_type, source_note, proposed_by, proposed_at, ascension_required)
select gen_random_uuid(), c.id, t.id, 'proposed', 'human_observation',
       'Self-revive read from verbatim skill_summary (policy #21, seed 201). Revives only this '
       'Champion — personal durability, NOT team recovery; must not count as team sustain.',
       'claude-seed-201', now(),
       3   -- passive/self-revive: ar=3 default per policy #7 unless a yellow-star screenshot proves otherwise
from champions c cross join tags t
where t.name = 'Self-Revive' and t.game_id = 'raid_shadow_legends'
  and c.name in ('Arne','Bushi','Minaya','Skullcrown','Solanar','Sun Wukong','Xenomorph','Lydia')
  and not exists (select 1 from champion_tags x where x.champion_id = c.id and x.tag_id = t.id);

COMMIT;

-- ============================================================================
-- FLAGGED, NO CHANGE PROPOSED — needs Mike's ruling
--
-- Skull Lord Var-Gall [Passive 2]: "Revives Skullsworn with 50% HP and 50% Turn Meter
--   at the start of each turn. [If there are multiple Skullsworns on the team, only one
--   of them will be revived.]"
--   Skullsworn is his OWN SUMMONED MINION, not a roster ally. So this is neither
--   self-revive nor ally-revive — it is minion sustain. It cannot bring your dead
--   champion back, so counting it as team recovery over-credits him; but it is also
--   not merely personal. Left as `Revive` pending a ruling. A third term
--   (`Minion Revive`) may be warranted — deliberately NOT invented here, because the
--   vocabulary should not grow on my judgement alone.
--
-- ALSO NOT CHANGED (correctly tagged, listed so the review is auditable):
--   • KILL-CONDITIONAL ally revives stay APPROVED per policy #6 (the champion controls
--     the kill): Altan, Astralon, Gaspard, Nais, Odin, Reinbeast, Sachi, Gamuran A4,
--     Tribune Herakletes A2, Master Butcher (on his own death), Marichka (on her death).
--   • ALLY-GATED SPECIAL CASES stay APPROVED per policy #15's SCOPE note — the gate
--     disqualifies only the gated clause, and each of these revives allies
--     unconditionally in the base skill: Djamarsa (+Crohnam), Noldua (+Solanar),
--     Rian (+Akoth/Urost).
--   • Godseeker Aniri keeps BOTH `Revive` (A3 revives a dead ally) and her separate
--     [Revive on Death] placement — different mechanics, correctly separate tags.
-- ============================================================================

-- VERIFY (run after applying; every count is the expectation, not a guess):
--   -- 7 rejected, 8 proposed Self-Revive, Lydia keeps Revive:
--   select t.name, ct.status, count(*) from champion_tags ct
--     join tags t on t.id = ct.tag_id join champions c on c.id = ct.champion_id
--    where t.name in ('Revive','Self-Revive')
--      and c.name in ('Arne','Bushi','Minaya','Skullcrown','Solanar','Sun Wukong','Xenomorph','Lydia')
--    group by 1,2 order by 1,2;
--   -- ally-revive population should fall 87 -> 80 (78 ally + Lydia + Var-Gall):
--   select count(distinct ct.champion_id) from champion_tags ct join tags t on t.id=ct.tag_id
--    where t.name='Revive' and ct.status='approved';
--
-- ⚠ NAME-MATCHED, NOT ID-MATCHED. If any champion above has been renamed this seed
-- silently no-ops for that row. Confirm all 8 matched before trusting the result:
--   select name from champions where name in
--     ('Arne','Bushi','Minaya','Skullcrown','Solanar','Sun Wukong','Xenomorph','Lydia');
--   -- expect 8 rows. (Live names can differ from worksheet names — resolve via
--   -- champion_aliases, never by exact name alone. That trap cost time THIS session:
--   -- "Mavara" is an alias; her champions.name is "Mavara the Web Diviner".)
