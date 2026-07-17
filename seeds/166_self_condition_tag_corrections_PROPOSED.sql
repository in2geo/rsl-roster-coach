-- ============================================================================
-- Seed 166 — PROPOSED: reject 7 "self-condition bracket" false-positive tags
--
-- ⚠⚠ NOT APPLIED. NEEDS MIKE'S SIGN-OFF. Three reasons, per CLAUDE.md:
--   1. It implies a NEW TAG POLICY (#20 below). CLAUDE.md: "Every new tag or rule
--      gets proposed in structured form, then reviewed and approved by a human
--      before it's considered live. No auto-merge."
--   2. Policy #18 requires any tag ruling to be written back to DB_Champion_Tags in
--      the master worksheet IN THE SAME SESSION, or it is ORPHANED. That worksheet
--      write has NOT been done — it is the exact failure that let the careful
--      hand-analysis in seeds 42/43 be silently overwritten by a bracket scraper.
--   3. It changes live recommendation behaviour (removes carrier capabilities).
--
-- FOUND BY: Mike sending Rhaia the Mourned's four skill screens 2026-07-17. Her
-- stored skill_summary matches the game VERBATIM — the SKILL layer is correct. The
-- TAG layer derived from it is not.
--
-- ▶ PROPOSED TAG POLICY #20 — SELF-CONDITION BRACKETS ≠ PLACEMENT
--   A `[Bracket]` appearing inside a clause describing a state the CHAMPION (or an
--   ally) must ALREADY BE IN — "while this Champion is under an [X] buff", "if they
--   are under a [X] debuff", "if this Champion is under a [Veil] buff" — is a
--   PREREQUISITE, not a placement. The champion does not deliver [X]; it must come
--   from an ally, a passive, or gear. → REJECT the placement tag.
--   A sibling of #16 (ignore), #19 (removal) and #12 (activation): same root cause —
--   a bracket scraper cannot tell a CONDITION clause from a PLACEMENT clause.
--   BOUNDARY vs #17 (resistance bypass, APPROVE): #17 is about the DEBUFF THE
--   CHAMPION PLACES being unresistable while she is under [Veil] — the debuff still
--   gets placed, so it is tagged. #20 is about tagging [Veil] ITSELF. The 2026-07-12
--   sweep fixed the #17 half and left this half. Both halves of the same sentence.
--   NOTE the [Perfect Veil] / [Veil] distinction is LOAD-BEARING: three of the five
--   champions below DO place [Perfect Veil] and were tagged [Veil] off a condition
--   clause. They are different buffs and the vocabulary has both.
--
-- THE 7 REJECTIONS (every one verified against verbatim skill_summary):
--
--   Rhaia — Veil, Perfect Veil
--     "While this Champion is under an [Increase ATK] buff, a [Block Debuffs] buff,
--      and a [Veil] or a [Perfect Veil] buff at the same time, prevents this
--      Champion's death..."  → NOTHING in her kit places any veil. Both wrong.
--     (Her only self-buff is [Increase ATK] on A3, which IS correctly tagged.)
--
--   Umetogi — Veil
--     A3 "Places a [Perfect Veil] buff ... on this Champion" → places PERFECT Veil.
--     A1/A2 "...if this Champion is under a [Veil] or [Perfect Veil] buff" → condition.
--     → keep Perfect Veil, REJECT Veil.
--
--   Yannica — Veil, Shield
--     A2 "Places a [Perfect Veil] buff on this Champion" → places PERFECT Veil.
--     A1/A3 "if this Champion is under a [Veil] buff" → condition. REJECT Veil.
--     A3 "Will ignore [Shield] buffs. Removes [Shield] buffs from targets..." →
--     Shield is IGNORED (#16) and REMOVED (#19), never placed. REJECT Shield.
--     ⚠ #19 says the removal ACTION earns a tag — Yannica should probably GAIN a
--     `Buff Strip` tag. NOT added here (an addition needs the normal proposed flow).
--
--   Yumeko — Veil
--     Passive "Places a [Perfect Veil] buff on this Champion ... at the start of each
--     Round" → places PERFECT Veil. "...immune to all debuffs if they are under a
--     [Veil] or [Perfect Veil] buff" → condition. "Whenever a [Veil] or a [Perfect
--     Veil] buff is placed on an enemy, has a 75% chance of stealing the buff" →
--     that is STEALING (#19), not placing. REJECT Veil.
--
--   Elegaius — Heal Reduction
--     Passive "Will NOT prevent this Champion's death if they are under a [Heal
--     Reduction] debuff" → a NEGATED self-condition. He places no Heal Reduction.
--     (He DOES place [Shield] on himself in the same passive — that tag is correct.)
--
-- ⚠ SEPARATE ISSUE SPOTTED, NOT ACTED ON — Yumeko's A2 and Passive both end "Only
-- available when Karato Foxhunter is on the same team." Policy #15 says
-- synergy-dependent skills are REJECTED. That would strip her Hex — her main
-- debuff. It is ambiguous whether the clause gates the whole skill or only the
-- [Passive Effect] paragraph. NEEDS MIKE + the in-game card. Do not act on the
-- basis of this note alone.
--
-- SCAN: tools scratch, "self-condition" regex over all 934 champions with skill
-- text, cross-checked against approved tags, excluding any tag also genuinely
-- placed elsewhere in the kit. 7 hits. This is a SMALL class — the 2026-07-12
-- regeneration was largely sound.
--
-- TO APPLY (after sign-off + worksheet writeback):
--   node --env-file=.env.local tools/apply-seed-pooler.mjs seeds/166_*.sql
-- ============================================================================

-- Rhaia — places no veil of any kind; both tags come from the passive's condition clause
update champion_tags ct set status='rejected',
  review_notes = coalesce(ct.review_notes||' | ','') || 'Policy #20 (proposed): self-condition bracket, not a placement. Passive requires her to BE under [Veil]/[Perfect Veil]; nothing in her kit places either. Verified vs in-game card 2026-07-17.'
from champions c, tags t
where ct.champion_id=c.id and ct.tag_id=t.id
  and c.game_id='raid_shadow_legends' and c.name='Rhaia'
  and t.name in ('Veil','Perfect Veil') and ct.status='approved';

-- Umetogi — places [Perfect Veil] (A3); [Veil] appears only as an A1/A2 crit condition
update champion_tags ct set status='rejected',
  review_notes = coalesce(ct.review_notes||' | ','') || 'Policy #20 (proposed): places [Perfect Veil] on A3, never [Veil]. [Veil] appears only in "if this Champion is under a [Veil]" crit conditions. Different buffs.'
from champions c, tags t
where ct.champion_id=c.id and ct.tag_id=t.id
  and c.game_id='raid_shadow_legends' and c.name='Umetogi'
  and t.name='Veil' and ct.status='approved';

-- Yannica — Veil (condition; she places Perfect Veil) and Shield (ignored + removed, never placed)
update champion_tags ct set status='rejected',
  review_notes = coalesce(ct.review_notes||' | ','') || 'Policy #20 (proposed) for Veil: places [Perfect Veil] on A2, never [Veil]. Policy #16+#19 for Shield: A3 IGNORES and REMOVES [Shield] buffs, never places one — the removal should instead earn Buff Strip.'
from champions c, tags t
where ct.champion_id=c.id and ct.tag_id=t.id
  and c.game_id='raid_shadow_legends' and c.name='Yannica'
  and t.name in ('Veil','Shield') and ct.status='approved';

-- Yumeko — places [Perfect Veil] in her passive; [Veil] is a condition + a steal target
update champion_tags ct set status='rejected',
  review_notes = coalesce(ct.review_notes||' | ','') || 'Policy #20 (proposed): passive places [Perfect Veil], never [Veil]. [Veil] appears as a debuff-immunity condition and as a STEAL target (#19), not a placement.'
from champions c, tags t
where ct.champion_id=c.id and ct.tag_id=t.id
  and c.game_id='raid_shadow_legends' and c.name='Yumeko'
  and t.name='Veil' and ct.status='approved';

-- Elegaius — Heal Reduction sits inside a NEGATED self-condition
update champion_tags ct set status='rejected',
  review_notes = coalesce(ct.review_notes||' | ','') || 'Policy #20 (proposed): "Will NOT prevent this Champion''s death if they are under a [Heal Reduction] debuff" is a negated self-condition. He places no Heal Reduction.'
from champions c, tags t
where ct.champion_id=c.id and ct.tag_id=t.id
  and c.game_id='raid_shadow_legends' and c.name='Elegaius'
  and t.name='Heal Reduction' and ct.status='approved';
