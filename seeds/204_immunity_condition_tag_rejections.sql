-- ============================================================================
-- ⚠ RENUMBERED 199 -> 204 on 2026-07-21. This seed was authored in an earlier
-- session on branch `claude/happy-rubin-95be3a` and never merged, while seed
-- number 199 was meanwhile taken by 199_dragon_ig_p25_floors_from_reality.sql.
-- Renumbering only — no ruling in this file was changed.
--
-- ⚠ STILL NOT APPLIED TO LIVE (verified 2026-07-21: Atur | Freeze/Sleep/Stun and
-- Archbishop Pinthroy | Decrease Defense are all still `approved` in the DB, i.e.
-- none of the 26 rejections below have landed). It is committed here so the work
-- is not lost — committing is not applying. Needs Mike's sign-off like any other
-- tag ruling, and the policy #18 worksheet writeback appears to have been done
-- already (BACKUP-2026-07-20-preSeed199ImmunityRejections.xlsx exists), so the
-- worksheet and live may currently DISAGREE on these 26 pairs.
-- ============================================================================
-- ============================================================================
-- Seed 204 — non-placement debuff tags: immunity / condition / activation
--
-- 26 approved (champion, debuff-tag) pairs where the champion DOES NOT PLACE the
-- debuff. Every bracket occurrence in the champion's whole kit sits in a clause
-- that is not a placement: an immunity clause (#10), a target/damage CONDITION,
-- a self-cleanse or ally-cleanse (#19), a forced early tick (#12), a random-pool
-- placer (#2), or a self-state the champion applies to itself (#20 sibling).
--
-- METHOD (per CLAUDE.md "regenerate from skill_summary, NOT bracket-scraping"):
--   1,979 approved debuff pairs were joined to champion_skills. A narrower flagged
--   pairs where NO occurrence was governed by a placement verb; then EVERY survivor
--   was read verbatim, whole-kit, before any ruling here. The narrower only chose
--   what to read. It did not decide anything, and three successive versions of it
--   were wrong in instructive ways (recorded at the bottom).
--
-- ▶ RESOLVES THE 3 "UNSURE" ROWS SEED 182 LEFT OPEN.
--   182 deferred Atur | Freeze, Atur | Sleep, Atur | Stun as "no clear evidence
--   either way", having filed them under policy #15 (ally-gated skill) because the
--   clause ends "[Only available when Kallia is on the same team.]".
--   They are not a #15 question. The clause is:
--       (Passive 2) Vigilant Partner [P]: "Immune to [Stun], [Freeze], and [Sleep]
--       debuffs. [Only available when Kallia is on the same team.]"
--   That is an IMMUNITY clause -> #10 REJECT, and the ally gate is irrelevant: a
--   gate on a skill that never placed the debuff cannot decide whether it places it.
--   Atur keeps Provoke (A1 40%, A2 50% per hit) and Counterattack (passive) — which
--   is also exactly why 182 was right to strip his #15 rejections back.
--
-- ▶ 182 APPLIED TWO CLAUSES ONLY HALFWAY. Same sentence, tag left behind:
--     Archbishop Pinthroy — 182 rejected | Weaken, but not | Decrease Defense, though
--       both come from "Removes all [Decrease DEF] debuffs and [Weaken] debuffs from
--       this Champion" (one self-cleanse clause naming both).
--     Teumesia — 182 rejected | Fear and | Sleep off the immunity list, but not
--       | Freeze, which sits in the SAME list (plus an ally-replacement clause).
--   Both are finished here. Worth noting for the next sweep: when a rejection cites a
--   bracket LIST, every tag in that list needs checking, not just the cited one.
--
-- ▶ THE CONDITION CLASS IS THE BIG ONE (14 of 26) AND HAS NO POLICY YET.
--   Plarium writes "if the target is under a [Fear], [True Fear], [Freeze], [Provoke],
--   [Sleep], [Stun], or [Petrification] debuff" to gate a DAMAGE BONUS or pick which
--   allies get a [Shield]. Nothing in that list is placed by the champion — it is a
--   precondition someone ELSE on the team supplies. Lady Etessa, Robar, Ba Satha and
--   Nobel each got 4/4/4/1 tags from exactly one such sentence.
--   This is the enemy-side twin of policy #20 (self-condition brackets). Proposed
--   wording is in the Notes block at the end — NOT ratified here.
--
-- ▶ NOT APPLIED — four items surfaced by this sweep that are ADDS or need a ruling,
--   and so are deliberately left for Mike (see the Notes block at the end):
--   Valkanen | True Fear (currently rejected, looks WRONGLY so), Bambus | Sleep +
--   | AoE Sleep (self-inflicted), Jingwon | Cleanse (missing tag).
--
-- ▶ ENGINE IMPACT: these tags feed the affinity placement model. A champion whose
--   only bracket sits in a passive immunity clause classifies as `passive` and is
--   EXEMPTED from the weak-hit placement penalty — so a bad tag currently also buys
--   an undeserved scoring exemption. (Noted as inherited: the `tagPlacementSource`
--   function is not present in lib/bucket-magnitude.js on this branch, so the
--   exemption path was NOT verified here — only the tag data was.)
--
-- ▶▶ THE ROOT CAUSE IS NOT BAD EXTRACTION — IT IS WORKSHEET/LIVE DRIFT.
--   Discovered during the policy #18 writeback: 23 of these 26 pairs were ALREADY
--   `rejected` in DB_Champion_Tags and `approved` in the live DB. The rulings had
--   been made correctly and never reached live. Only 3 rows were genuinely new
--   analysis (Dark Kael | HP Burn, Valkanen | Fear, Raphael | Berserk).
--
--   A full worksheet-vs-live comparison (3,241 pairs present in both) found:
--       worksheet=rejected, live=APPROVED ... 39   <- bad tags live RIGHT NOW
--       worksheet=approved, live=rejected ... 11
--   This seed fixes 23 of those 39. The other 16 are BUFF tags, outside a
--   debuff-scoped sweep, and are NOT touched here because their skill text has not
--   been read in this session:
--       Astralon | Increase Defense · Astralon | Perfect Veil · Astralon | Veil
--       Candraphon | Veil · Chonoru | Increase Defense · Elder Skarg | Block Damage
--       Elder Skarg | Shield · Gory | Increase Defense · Gronjarr | Block Debuffs
--       Harvest Jack | Increase Attack · Hound Spawn | Block Damage
--       Minaya | Increase Defense · Oboro | Veil · Rector Drath | Veil
--       Roxam | Veil · War Mother | Increase Attack
--   Six of those are | Veil, which is exactly the policy #20 class seed 166 still
--   holds as PROPOSED — consistent with the theory that live never received them.
--
--   IMPLICATION: policy #18 protects worksheet -> seed. Nothing protects
--   worksheet -> LIVE. The 2026-07-13 LLM regeneration landed proposed -> approved
--   across the corpus and appears to have re-approved rows the worksheet had already
--   rejected. A recurring drift check belongs in tooling, or the next regeneration
--   reintroduces all 39. Ad-hoc audits like this one only find what someone happens
--   to trip over — this was noticed via one champion, Atur.
--
-- Policy #18: rulings must be written back to DB_Champion_Tags in the master
-- worksheet in the SAME session. DONE for all 26 (backup written to
-- BACKUP-2026-07-20-preSeed199ImmunityRejections.xlsx); 23 already carried the
-- correct status and had their Source Note updated with the verbatim clause.
-- ============================================================================

-- ── #10 IMMUNITY: "immune to [X]" ───────────────────────────────────────────
-- Atur (resolves seed 182's 3 UNSURE rows)

-- Atur | Stun   (#10)
update champion_tags
set    status = 'rejected',
       source_note = 'Policy #10: (Passive 2) Vigilant Partner [P]: Immune to [Stun], [Freeze], and [Sleep] debuffs. [Only available when Kallia is on the same team.] Immunity, not placement. Atur places only [Provoke] (A1/A2) and [Counterattack] (passive). Resolves the UNSURE row deferred by seed 182, which filed it under #15 (ally gate) rather than #10.'
where  champion_id = (select id from champions where game_id='raid_shadow_legends' and lower(name)=lower('Atur'))
  and  tag_id      = (select id from tags where lower(name)=lower('Stun'))
  and  status in ('approved','proposed');

-- Atur | Freeze   (#10)
update champion_tags
set    status = 'rejected',
       source_note = 'Policy #10: (Passive 2) Vigilant Partner [P]: Immune to [Stun], [Freeze], and [Sleep] debuffs. [Only available when Kallia is on the same team.] Immunity, not placement. Resolves the UNSURE row deferred by seed 182.'
where  champion_id = (select id from champions where game_id='raid_shadow_legends' and lower(name)=lower('Atur'))
  and  tag_id      = (select id from tags where lower(name)=lower('Freeze'))
  and  status in ('approved','proposed');

-- Atur | Sleep   (#10)
update champion_tags
set    status = 'rejected',
       source_note = 'Policy #10: (Passive 2) Vigilant Partner [P]: Immune to [Stun], [Freeze], and [Sleep] debuffs. [Only available when Kallia is on the same team.] Immunity, not placement. Resolves the UNSURE row deferred by seed 182.'
where  champion_id = (select id from champions where game_id='raid_shadow_legends' and lower(name)=lower('Atur'))
  and  tag_id      = (select id from tags where lower(name)=lower('Sleep'))
  and  status in ('approved','proposed');

-- Jingwon: immunity list + ally-cleanse list, both in A4. He places [Stun] (A1, 50%)
-- which stays; Fear/True Fear/Freeze/Provoke come only from the two lists.
-- (182-era cleanup already rejected his Petrification and Sleep from the same lists.)

-- Jingwon | Fear   (#10 + #19)
update champion_tags
set    status = 'rejected',
       source_note = 'Policy #10 + #19: (A4) Unchained [P]: "This Champion is immune to [Fear], [True Fear], [Freeze], [Provoke], [Sleep], [Stun], and [Petrification] debuffs" and "removes all [Fear], ... debuffs from all allies". Immunity + ally-cleanse; never placed. His [Stun] tag is genuine (A1 Doom Exchange, 50%) and is retained.'
where  champion_id = (select id from champions where game_id='raid_shadow_legends' and lower(name)=lower('Jingwon'))
  and  tag_id      = (select id from tags where lower(name)=lower('Fear'))
  and  status in ('approved','proposed');

-- Jingwon | True Fear   (#10 + #19)
update champion_tags
set    status = 'rejected',
       source_note = 'Policy #10 + #19: (A4) Unchained [P]: immune to [Fear], [True Fear], ... and removes all [True Fear] debuffs from all allies. Immunity + ally-cleanse; never placed.'
where  champion_id = (select id from champions where game_id='raid_shadow_legends' and lower(name)=lower('Jingwon'))
  and  tag_id      = (select id from tags where lower(name)=lower('True Fear'))
  and  status in ('approved','proposed');

-- Jingwon | Freeze   (#10 + #19)
update champion_tags
set    status = 'rejected',
       source_note = 'Policy #10 + #19: (A4) Unchained [P]: immune to [Freeze] and removes all [Freeze] debuffs from all allies. Immunity + ally-cleanse; never placed.'
where  champion_id = (select id from champions where game_id='raid_shadow_legends' and lower(name)=lower('Jingwon'))
  and  tag_id      = (select id from tags where lower(name)=lower('Freeze'))
  and  status in ('approved','proposed');

-- Jingwon | Provoke   (#10 + #19)
update champion_tags
set    status = 'rejected',
       source_note = 'Policy #10 + #19: (A4) Unchained [P]: immune to [Provoke] and removes all [Provoke] debuffs from all allies. Immunity + ally-cleanse; never placed.'
where  champion_id = (select id from champions where game_id='raid_shadow_legends' and lower(name)=lower('Jingwon'))
  and  tag_id      = (select id from tags where lower(name)=lower('Provoke'))
  and  status in ('approved','proposed');

-- Teumesia | Freeze   (#10 + #19) — completes seed 182, which took Fear and Sleep
-- from the same immunity list but left Freeze.
update champion_tags
set    status = 'rejected',
       source_note = 'Policy #10 + #19: (Passive) Inner Heat [P]: "Whenever an ally receives a [Freeze] debuff, has a 50% chance of replacing it with a [HP Burn]" (removes it from an ALLY) and "this Champion is immune to [Stun], [Sleep], [Freeze], ... debuffs". Never placed on an enemy. Seed 182 rejected | Fear and | Sleep off this same list but missed | Freeze.'
where  champion_id = (select id from champions where game_id='raid_shadow_legends' and lower(name)=lower('Teumesia'))
  and  tag_id      = (select id from tags where lower(name)=lower('Freeze'))
  and  status in ('approved','proposed');

-- ── CONDITION: the bracket gates a damage bonus / target selection ───────────
-- Not yet a numbered policy; the enemy-side twin of #20. See Notes.

-- Lady Etessa | Fear   (CONDITION)
update champion_tags
set    status = 'rejected',
       source_note = 'CONDITION (enemy-side twin of #20): (A3) Fiend Purge: "Damage inflicted ... will be increased by 20% if the target is under a [Fear], [True Fear], [Freeze], [Provoke], [Sleep], [Stun], or [Petrification] debuff." A damage-bonus precondition another champion must supply. She places only [Block Buffs] (A1) and [Stun] (A2), both retained.'
where  champion_id = (select id from champions where game_id='raid_shadow_legends' and lower(name)=lower('Lady Etessa'))
  and  tag_id      = (select id from tags where lower(name)=lower('Fear'))
  and  status in ('approved','proposed');

-- Lady Etessa | True Fear   (CONDITION)
update champion_tags
set    status = 'rejected',
       source_note = 'CONDITION: (A3) Fiend Purge damage-bonus list "if the target is under a [Fear], [True Fear], ... debuff". Precondition, not placement.'
where  champion_id = (select id from champions where game_id='raid_shadow_legends' and lower(name)=lower('Lady Etessa'))
  and  tag_id      = (select id from tags where lower(name)=lower('True Fear'))
  and  status in ('approved','proposed');

-- Lady Etessa | Freeze   (CONDITION)
update champion_tags
set    status = 'rejected',
       source_note = 'CONDITION: (A3) Fiend Purge damage-bonus list "if the target is under a ... [Freeze] ... debuff". Precondition, not placement.'
where  champion_id = (select id from champions where game_id='raid_shadow_legends' and lower(name)=lower('Lady Etessa'))
  and  tag_id      = (select id from tags where lower(name)=lower('Freeze'))
  and  status in ('approved','proposed');

-- Lady Etessa | Provoke   (CONDITION)
update champion_tags
set    status = 'rejected',
       source_note = 'CONDITION: (A3) Fiend Purge damage-bonus list "if the target is under a ... [Provoke] ... debuff". Precondition, not placement.'
where  champion_id = (select id from champions where game_id='raid_shadow_legends' and lower(name)=lower('Lady Etessa'))
  and  tag_id      = (select id from tags where lower(name)=lower('Provoke'))
  and  status in ('approved','proposed');

-- Robar | Fear   (CONDITION)
update champion_tags
set    status = 'rejected',
       source_note = 'CONDITION: (A3) Merciless Assault: "Damage increases if the target is under [Fear], [True Fear], [Freeze], [Provoke], [Sleep], [Stun], [Petrification] debuffs." He places [Stun] (A1) and [Decrease DEF] (A2), both retained.'
where  champion_id = (select id from champions where game_id='raid_shadow_legends' and lower(name)=lower('Robar'))
  and  tag_id      = (select id from tags where lower(name)=lower('Fear'))
  and  status in ('approved','proposed');

-- Robar | True Fear   (CONDITION)
update champion_tags
set    status = 'rejected',
       source_note = 'CONDITION: (A3) Merciless Assault damage-scaling list. Precondition, not placement.'
where  champion_id = (select id from champions where game_id='raid_shadow_legends' and lower(name)=lower('Robar'))
  and  tag_id      = (select id from tags where lower(name)=lower('True Fear'))
  and  status in ('approved','proposed');

-- Robar | AoE Freeze   (CONDITION)
update champion_tags
set    status = 'rejected',
       source_note = 'CONDITION: (A3) Merciless Assault damage-scaling list. Precondition, not placement. (His AoE Sleep and AoE Stun were already rejected from this same sentence.)'
where  champion_id = (select id from champions where game_id='raid_shadow_legends' and lower(name)=lower('Robar'))
  and  tag_id      = (select id from tags where lower(name)=lower('AoE Freeze'))
  and  status in ('approved','proposed');

-- Robar | Provoke   (CONDITION)
update champion_tags
set    status = 'rejected',
       source_note = 'CONDITION: (A3) Merciless Assault damage-scaling list. Precondition, not placement.'
where  champion_id = (select id from champions where game_id='raid_shadow_legends' and lower(name)=lower('Robar'))
  and  tag_id      = (select id from tags where lower(name)=lower('Provoke'))
  and  status in ('approved','proposed');

-- Ba Satha | Fear   (CONDITION — target selection for a [Shield])
update champion_tags
set    status = 'rejected',
       source_note = 'CONDITION: (A2) God Beast''s Boon: "Also places a [Shield] buff ... on allies under [Fear], [True Fear], [Freeze], [Provoke], [Sleep], or [Stun] debuffs." The placement verb governs [Shield]; the debuff list only selects WHICH ALLIES receive it. He places [Decrease ATK] (A1), [Stun] (A3/passive), [Strengthen] + [Continuous Heal] + [Shield] (A2) — all retained.'
where  champion_id = (select id from champions where game_id='raid_shadow_legends' and lower(name)=lower('Ba Satha'))
  and  tag_id      = (select id from tags where lower(name)=lower('Fear'))
  and  status in ('approved','proposed');

-- Ba Satha | True Fear   (CONDITION)
update champion_tags
set    status = 'rejected',
       source_note = 'CONDITION: (A2) God Beast''s Boon — [Shield] target-selection list "on allies under [Fear], [True Fear], ...". Not placed.'
where  champion_id = (select id from champions where game_id='raid_shadow_legends' and lower(name)=lower('Ba Satha'))
  and  tag_id      = (select id from tags where lower(name)=lower('True Fear'))
  and  status in ('approved','proposed');

-- Ba Satha | Freeze   (CONDITION)
update champion_tags
set    status = 'rejected',
       source_note = 'CONDITION: (A2) God Beast''s Boon — [Shield] target-selection list. Not placed.'
where  champion_id = (select id from champions where game_id='raid_shadow_legends' and lower(name)=lower('Ba Satha'))
  and  tag_id      = (select id from tags where lower(name)=lower('Freeze'))
  and  status in ('approved','proposed');

-- Ba Satha | Provoke   (CONDITION)
update champion_tags
set    status = 'rejected',
       source_note = 'CONDITION: (A2) God Beast''s Boon — [Shield] target-selection list. Not placed.'
where  champion_id = (select id from champions where game_id='raid_shadow_legends' and lower(name)=lower('Ba Satha'))
  and  tag_id      = (select id from tags where lower(name)=lower('Provoke'))
  and  status in ('approved','proposed');

-- Nobel | True Fear   (CONDITION)
-- His | Fear IS genuine (passive: 20% chance of placing [Fear] on Turn-Meter-reduced
-- enemies) and is retained. Only True Fear is condition-only.
update champion_tags
set    status = 'rejected',
       source_note = 'CONDITION: every [True Fear] occurrence is a precondition — (A1) "If the target is under a [Fear] or [True Fear] debuff, decreases the duration...", (A2) same twice, (A3) "If this attack kills a target under a [Fear] or [True Fear] debuff...". He places [Fear] only (passive Desolation, 20%), which is retained.'
where  champion_id = (select id from champions where game_id='raid_shadow_legends' and lower(name)=lower('Nobel'))
  and  tag_id      = (select id from tags where lower(name)=lower('True Fear'))
  and  status in ('approved','proposed');

-- Whisper | Decrease Defense   (CONDITION)
update champion_tags
set    status = 'rejected',
       source_note = 'CONDITION: (A3) Unyielding Flurry: "Grants an Extra Turn if the target is under [Decrease DEF] and [Weaken] debuffs." Only occurrence in the kit. His [Weaken] IS genuine (A1, 50%) and is retained — Whisper needs an ally to supply the Decrease DEF.'
where  champion_id = (select id from champions where game_id='raid_shadow_legends' and lower(name)=lower('Whisper'))
  and  tag_id      = (select id from tags where lower(name)=lower('Decrease Defense'))
  and  status in ('approved','proposed');

-- ── #19 SELF-CLEANSE ────────────────────────────────────────────────────────

-- Archbishop Pinthroy | Decrease Defense   (#19) — completes seed 182, which took
-- | Weaken from this same sentence but left | Decrease Defense.
update champion_tags
set    status = 'rejected',
       source_note = 'Policy #19: (Passive) Splendor [P]: "Removes all [Decrease DEF] debuffs and [Weaken] debuffs from this Champion at the start of each turn." Self-cleanse; removes from SELF, never places on enemies. Seed 182 rejected | Weaken off this exact sentence but missed | Decrease Defense.'
where  champion_id = (select id from champions where game_id='raid_shadow_legends' and lower(name)=lower('Archbishop Pinthroy'))
  and  tag_id      = (select id from tags where lower(name)=lower('Decrease Defense'))
  and  status in ('approved','proposed');

-- ── #12 ACTIVATION: forced early tick, not placement ────────────────────────

-- Dark Kael | HP Burn   (#12)
update champion_tags
set    status = 'rejected',
       source_note = 'Policy #12: (A1) Weaver of Woes: "Each hit has a 25% chance to instantly activate 2 [Poison] debuffs or 1 [Poison] debuff and 1 [HP Burn] debuffs." Forces an existing DoT to tick early; does not place HP Burn — nothing else in the kit places it. He already carries the correct Debuff Activation tag, so this row is pure duplication of a capability he does not have. His [Poison] tag is genuine (A3) and is retained.'
where  champion_id = (select id from champions where game_id='raid_shadow_legends' and lower(name)=lower('Dark Kael'))
  and  tag_id      = (select id from tags where lower(name)=lower('HP Burn'))
  and  status in ('approved','proposed');

-- ── #2 RANDOM-POOL PLACER ───────────────────────────────────────────────────

-- Valkanen | Fear   (#2)
update champion_tags
set    status = 'rejected',
       source_note = 'Policy #2 (random pool placer): (Passive) Phantom Bulwark: "places a RANDOM debuff on the attacking enemy. [Fear], [True Fear], [Freeze], [Provoke], [Petrification], [Sleep] and [Stun] debuffs are placed for 1 turn." One random pick from a 7-debuff pool, so no individual debuff is a deliverable capability. NOTE: his | True Fear is currently rejected but A3 Death''s Bargain places [True Fear] on all enemies outright — see the Notes block; not changed here.'
where  champion_id = (select id from champions where game_id='raid_shadow_legends' and lower(name)=lower('Valkanen'))
  and  tag_id      = (select id from tags where lower(name)=lower('Fear'))
  and  status in ('approved','proposed');

-- ── #20 SIBLING: self-applied state, never placed on an enemy ────────────────

-- Raphael | Berserk   (#20 sibling)
update champion_tags
set    status = 'rejected',
       source_note = 'Policy #20 sibling (self-state): all three occurrences are about HIMSELF — (A2) "If under [Berserk], attacks all enemies", (A3) "activates [Berserk] (boosts damage but increases damage taken by 50%)", (A4) "gain an Extra Turn while under [Berserk]". [Berserk] is is_debuff in our vocab, so this row credited him with an ENEMY debuff he never places. Self-buff/self-state, not a placement.'
where  champion_id = (select id from champions where game_id='raid_shadow_legends' and lower(name)=lower('Raphael'))
  and  tag_id      = (select id from tags where lower(name)=lower('Berserk'))
  and  status in ('approved','proposed');

-- ============================================================================
-- VERIFY (expect 26 rows, all status='rejected'):
--
--   select c.name, t.name, ct.status
--   from champion_tags ct
--   join champions c on c.id = ct.champion_id
--   join tags t on t.id = ct.tag_id
--   where (c.name, t.name) in (
--     ('Atur','Stun'),('Atur','Freeze'),('Atur','Sleep'),
--     ('Jingwon','Fear'),('Jingwon','True Fear'),('Jingwon','Freeze'),('Jingwon','Provoke'),
--     ('Teumesia','Freeze'),
--     ('Lady Etessa','Fear'),('Lady Etessa','True Fear'),('Lady Etessa','Freeze'),('Lady Etessa','Provoke'),
--     ('Robar','Fear'),('Robar','True Fear'),('Robar','AoE Freeze'),('Robar','Provoke'),
--     ('Ba Satha','Fear'),('Ba Satha','True Fear'),('Ba Satha','Freeze'),('Ba Satha','Provoke'),
--     ('Nobel','True Fear'),('Whisper','Decrease Defense'),
--     ('Archbishop Pinthroy','Decrease Defense'),('Dark Kael','HP Burn'),
--     ('Valkanen','Fear'),('Raphael','Berserk'))
--   order by c.name, t.name;
--
-- ============================================================================
-- NOTES — NOT APPLIED IN THIS SEED. Each needs a ruling from Mike.
--
-- 1. VALKANEN | TRUE FEAR looks WRONGLY REJECTED (an over-rejection, not an
--    over-approval). A3 Death's Bargain: "Also places a 25% [Weaken] debuff for 2
--    turns and [True Fear] debuff for 1 turn on all enemies. These debuffs cannot be
--    resisted or blocked." That is an unconditional AoE placement, and his [Weaken]
--    from the SAME sentence is approved. Re-approving is a capability ADD, so it is
--    flagged rather than applied.
--
-- 2. BAMBUS | SLEEP and | AoE SLEEP — he places [Sleep] only ON HIMSELF, once per
--    skill ("Then places a [Sleep] debuff on this Champion for 1 turn"), as the fuel
--    for his own passive debuff-transfer engine. Literally a placement, so no current
--    policy rejects it, but it is zero CC against enemies and there is no AoE Sleep
--    anywhere in his kit. The engine would fill a CC seat with it. Needs either a
--    self-target rule or a per-tag target_type check.
--
-- 3. JINGWON | CLEANSE is MISSING. A4 "removes all [Fear], [True Fear], [Freeze],
--    [Provoke], [Sleep], [Stun], and [Petrification] debuffs from all allies" is a
--    textbook Cleanse under #19's boundary. This seed removes 4 wrong tags from that
--    sentence; the real capability in it is still uncaptured. Same root cause #12
--    called out: rejecting a bracket without relocating the real action.
--
-- 4. PROPOSED POLICY #21 — CONDITION BRACKETS (enemy side). Suggested wording:
--    "A [Bracket] that appears only as a PRECONDITION on the TARGET ('if the target
--     is under [X]', 'damage increases if the target is under [X]', 'on allies under
--     [X]') is a trigger the champion does not supply -> REJECT as a placement.
--     BOUNDARY vs #17: #17 keeps a debuff SHE PLACES tagged when a condition governs
--     only its RESISTANCE; #21 covers brackets that gate a bonus or select targets.
--     Sibling of #20, which covers the same construction pointed at the SELF."
--    14 of the 26 rows here are this class; without #21 the next regeneration puts
--    them straight back.
--
-- ── Method notes: three narrower versions, two instructive failures ──────────
--    v1 "is a negation cue nearby?" -> 130 hits, mostly false. It fired on any
--       sentence that also mentioned removing something else ("places [Stun]...
--       Steals 20% Turn Meter"), and it wrongly treated "cannot be resisted" as a
--       negation when policy #17 says that is APPROVE.
--    v2 "is a placement verb local to the bracket?" -> 46 hits, but FALSE NEGATIVES:
--       "places a [Shield] buff ... on allies under [Fear], [True Fear], [Freeze]"
--       hid Ba Satha's Fear/True Fear/Freeze because a placement verb sat in the
--       window. Only his Provoke — furthest from the verb — surfaced.
--    v3 list-head-aware + nearest-cue-wins -> 24 hits, plus 2 v3 alone missed
--       (Teumesia | Freeze via "an ally receives a [X]", Valkanen | Fear via the
--       random-pool construction). The applied set is the UNION of v2 and v3 after
--       verbatim review — which is the point: no single pattern pass is sufficient,
--       and that is exactly why CLAUDE.md bans regex as the source of truth here.
-- ============================================================================
