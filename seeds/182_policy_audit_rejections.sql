-- ============================================================================
-- Seed 182 — policy-audit tag rejections (71 of the reviewer's 111)
--
-- PROVENANCE: an external reviewer audited TAG_REVIEW.xlsx (2026-07-17) and
-- returned 111 rejections as a seed numbered 167. TWO CHANGES were made before
-- anything ran:
--   1. RENUMBERED 167 -> 182. Seed 167 was already taken (Gladewulf + Vestele
--      base stats, applied earlier the same day). The reviewer was working from a
--      pre-push clone and could not see seeds 149-181.
--   2. 40 of the 111 REMOVED after audit. Detail below.
--
-- ▶ WHAT SURVIVED: 71 rejections.
--     #10 immunity ≠ placement ........ 9   (all sound)
--     #16 "will ignore [X]" ........... 44  (all sound)
--     #19 removal/cleanse ≠ placement . 12  (all sound)
--     #15 ally-gated skill ............ 6   (of 46 proposed — see below)
--
--   Every #10/#16/#19 row was re-checked against verbatim skill_summary for a
--   PLACEMENT verb elsewhere in the kit ("places|grants|puts|applies … [X]").
--   ZERO false positives in all 65. That is good work and it is applied as sent.
--
-- ▶▶ WHY 40 WERE REMOVED — THE #15 ERROR: THE GATE IS SKILL-LEVEL, NOT
--    CHAMPION-LEVEL.
--
--   Policy #15 rejects a skill that only works when a specific ally is fielded.
--   The reviewer applied the clause to EVERY tag on the champion, not just the
--   tags the GATED SKILL delivers. Almost every champion here has ONE gated skill
--   and three ungated ones that do the actual work.
--
--   Worked example — VENUS (Legendary, would have lost 6 of 7 tags):
--       A1 Pining ................ places [Poison]              NOT gated
--       A2 Blind With Infatuation  places [Decrease DEF]+[Weaken], hits all  NOT gated
--       A3 Burning Passion ....... places [HP Burn], hits all   NOT gated
--       A4 Pure Partner .......... removes all buffs   [Only available when Cupidus]
--   Only A4 is gated, so only Buff Strip is correctly rejected. Poison, Weaken,
--   Decrease Defense, HP Burn, AoE Damage and Multi-Hit A1 all come from ungated
--   skills. Rejecting them would have erased a well-known Legendary debuffer from
--   the engine.
--
--   Same shape on all 11 champions in the block: Atur (A1/A2 place [Provoke],
--   passive places [Counterattack]), Cupidus (A2 [HP Burn], A3 [Increase ATK]),
--   Harrier (A2 [Decrease DEF]), Hellfang (A2 [Weaken]), Hospitaller (A2 strips
--   buffs, A3 places [Increase SPD] + [Increase C.RATE]), Hound Spawn (A1 [Stun],
--   A2 [Decrease DEF]), Romero (A1/A2 [Continuous Heal], A3 [Shield]+[Increase
--   DEF], A2 steals buffs), Seducer (A1 [Sleep], A2 [Decrease ATK], A3 [Increase
--   DEF]+[Block Debuffs]), Sikara, Zavia.
--
--   AUDIT RESULT on the 46 #15 rows: 35 WRONG · 6 CORRECT (kept here) · 5 UNSURE.
--
--   THE 6 KEPT are the ones where the gated skill is the ONLY source: Hellfang |
--   AoE Freeze, Seducer | Ally Protection, Seducer | Block Damage, Sikara |
--   Revive, Venus | Buff Strip, Zavia | Debuff Spread.
--
--   THE 5 UNSURE ARE NOT IN THIS SEED and need a human read of the card:
--       Atur | Freeze · Atur | Sleep · Atur | Stun · Hound Spawn | Block Damage
--       · Romero | Ally Attack
--   No clear evidence either way from the text alone. Per the reviewer brief:
--   prefer 'unsure' over a guess.
--
-- ▶ POLICY #15 NEEDS A CLARIFYING AMENDMENT (proposed, not made here):
--   "#15 disqualifies the GATED SKILL's capabilities ONLY. A champion whose A4 is
--    ally-gated still delivers everything their A1/A2/A3/passive place. Attribute
--    each tag to the skill that provides it before rejecting."
--   The current wording ("a skill that only becomes available… → REJECT") does not
--   say whose tags are affected, which is exactly how this went wrong.
--
-- ▶ WHAT THE REVIEWER GOT RIGHT AND WHY THE PROCESS WORKED:
--   The verbatim-quote rule did its job. It did not prevent the error — but it made
--   the error visible in seconds, because the quote cited a "Partner" clause for a
--   tag that comes from A2. Without the quote this would have needed a full
--   re-derivation, or would have shipped. Keep the rule.
--   The reviewer also self-excluded three real false positives (Ailil | Weaken,
--   Harvest Jack | Poison — both "replaces them with" = a genuine placement; and a
--   duplicate Yannica | Shield row), which is a good sign on the #16/#19 work.
--
-- ▶ NOT COVERED HERE: seed 166 (proposed) rejects Rhaia | Veil, Rhaia | Perfect
--   Veil, Umetogi | Veil, Yumeko | Veil, Elegaius | Heal Reduction under proposed
--   policy #20 (self-condition brackets). The reviewer independently found
--   Yannica | Veil by the same reasoning (filed under #19, included here) but
--   MISSED the other four — because #20 is not yet in CLAUDE.md, so it was not in
--   the POLICIES.md the reviewer was given. Ratify #20 and those four land too.
-- ============================================================================

-- Chalco | Petrification   (#10)
update champion_tags
set    status = 'rejected',
       source_note = 'Policy #10: [Passive] Bottomless Maw [P]: This Champion is immune to [Stun], [Freeze], [Sleep], [Provoke], [Fear], [True Fear], and [Petrification] debuffs.'
where  champion_id = (select id from champions where game_id='raid_shadow_legends' and lower(name)=lower('Chalco'))
  and  tag_id      = (select id from tags where lower(name)=lower('Petrification'))
  and  status in ('approved','proposed');

-- Chalco | True Fear   (#10)
update champion_tags
set    status = 'rejected',
       source_note = 'Policy #10: [Passive] Bottomless Maw [P]: This Champion is immune to [Stun], [Freeze], [Sleep], [Provoke], [Fear], [True Fear], and [Petrification] debuffs.'
where  champion_id = (select id from champions where game_id='raid_shadow_legends' and lower(name)=lower('Chalco'))
  and  tag_id      = (select id from tags where lower(name)=lower('True Fear'))
  and  status in ('approved','proposed');

-- Fortus | Block Passive Skills   (#10)
update champion_tags
set    status = 'rejected',
       source_note = 'Policy #10: [A5] From the Depths: Immune to [Stun], [Freeze], [Sleep], [Provoke], [Block Active Skills], [Block Passive Skills], and [Fear] debuffs.'
where  champion_id = (select id from champions where game_id='raid_shadow_legends' and lower(name)=lower('Fortus'))
  and  tag_id      = (select id from tags where lower(name)=lower('Block Passive Skills'))
  and  status in ('approved','proposed');

-- Fortus | Sleep   (#10)
update champion_tags
set    status = 'rejected',
       source_note = 'Policy #10: [A5] From the Depths: Immune to [Stun], [Freeze], [Sleep], [Provoke], [Block Active Skills], [Block Passive Skills], and [Fear] debuffs.'
where  champion_id = (select id from champions where game_id='raid_shadow_legends' and lower(name)=lower('Fortus'))
  and  tag_id      = (select id from tags where lower(name)=lower('Sleep'))
  and  status in ('approved','proposed');

-- Norog | Freeze   (#10)
update champion_tags
set    status = 'rejected',
       source_note = 'Policy #10: [A3] Thick Skin: Immune to [Stun], [Freeze], [Sleep], [Fear], [True Fear], [Provoke], [Sheep], and [Petrification] debuffs.'
where  champion_id = (select id from champions where game_id='raid_shadow_legends' and lower(name)=lower('Norog'))
  and  tag_id      = (select id from tags where lower(name)=lower('Freeze'))
  and  status in ('approved','proposed');

-- Norog | Sleep   (#10)
update champion_tags
set    status = 'rejected',
       source_note = 'Policy #10: [A3] Thick Skin: Immune to [Stun], [Freeze], [Sleep], [Fear], [True Fear], [Provoke], [Sheep], and [Petrification] debuffs.'
where  champion_id = (select id from champions where game_id='raid_shadow_legends' and lower(name)=lower('Norog'))
  and  tag_id      = (select id from tags where lower(name)=lower('Sleep'))
  and  status in ('approved','proposed');

-- Norog | Stun   (#10)
update champion_tags
set    status = 'rejected',
       source_note = 'Policy #10: [A3] Thick Skin: Immune to [Stun], [Freeze], [Sleep], [Fear], [True Fear], [Provoke], [Sheep], and [Petrification] debuffs.'
where  champion_id = (select id from champions where game_id='raid_shadow_legends' and lower(name)=lower('Norog'))
  and  tag_id      = (select id from tags where lower(name)=lower('Stun'))
  and  status in ('approved','proposed');

-- Teumesia | Fear   (#10)
update champion_tags
set    status = 'rejected',
       source_note = 'Policy #10: Whenever any ally or enemy is under a [HP Burn] debuff, this Champion is immune to [Stun], [Sleep], [Freeze], [Fear], [True Fear], [Provoke], [Petrification] debuffs.'
where  champion_id = (select id from champions where game_id='raid_shadow_legends' and lower(name)=lower('Teumesia'))
  and  tag_id      = (select id from tags where lower(name)=lower('Fear'))
  and  status in ('approved','proposed');

-- Teumesia | Sleep   (#10)
update champion_tags
set    status = 'rejected',
       source_note = 'Policy #10: Whenever any ally or enemy is under a [HP Burn] debuff, this Champion is immune to [Stun], [Sleep], [Freeze], [Fear], [True Fear], [Provoke], [Petrification] debuffs.'
where  champion_id = (select id from champions where game_id='raid_shadow_legends' and lower(name)=lower('Teumesia'))
  and  tag_id      = (select id from tags where lower(name)=lower('Sleep'))
  and  status in ('approved','proposed');

-- Hellfang | AoE Freeze   (#15)
update champion_tags
set    status = 'rejected',
       source_note = 'Policy #15: [Only available when Hound Spawn is on the same team.] AUDIT: the gated skill is the ONLY source of AoE Freeze; A1/A2 do not deliver it.'
where  champion_id = (select id from champions where game_id='raid_shadow_legends' and lower(name)=lower('Hellfang'))
  and  tag_id      = (select id from tags where lower(name)=lower('AoE Freeze'))
  and  status in ('approved','proposed');

-- Seducer | Ally Protection   (#15)
update champion_tags
set    status = 'rejected',
       source_note = 'Policy #15: [Only available when Temptress is on the same team.] AUDIT: the gated skill is the ONLY source; A1/A2/A3 do not deliver it.'
where  champion_id = (select id from champions where game_id='raid_shadow_legends' and lower(name)=lower('Seducer'))
  and  tag_id      = (select id from tags where lower(name)=lower('Ally Protection'))
  and  status in ('approved','proposed');

-- Seducer | Block Damage   (#15)
update champion_tags
set    status = 'rejected',
       source_note = 'Policy #15: [Only available when Temptress is on the same team.] AUDIT: the gated skill is the ONLY source; A1/A2/A3 do not deliver it.'
where  champion_id = (select id from champions where game_id='raid_shadow_legends' and lower(name)=lower('Seducer'))
  and  tag_id      = (select id from tags where lower(name)=lower('Block Damage'))
  and  status in ('approved','proposed');

-- Sikara | Revive   (#15)
update champion_tags
set    status = 'rejected',
       source_note = 'Policy #15: [Only available when Alika is on the same team.] AUDIT: the gated skill is the ONLY source of Revive.'
where  champion_id = (select id from champions where game_id='raid_shadow_legends' and lower(name)=lower('Sikara'))
  and  tag_id      = (select id from tags where lower(name)=lower('Revive'))
  and  status in ('approved','proposed');

-- Venus | Buff Strip   (#15)
update champion_tags
set    status = 'rejected',
       source_note = 'Policy #15: [A4] Pure Partner: Removes all buffs from all enemies. [Only available when Cupidus is on the same team.] AUDIT: A4 is the ONLY source of Buff Strip; A1/A2/A3 do not remove buffs.'
where  champion_id = (select id from champions where game_id='raid_shadow_legends' and lower(name)=lower('Venus'))
  and  tag_id      = (select id from tags where lower(name)=lower('Buff Strip'))
  and  status in ('approved','proposed');

-- Zavia | Debuff Spread   (#15)
update champion_tags
set    status = 'rejected',
       source_note = 'Policy #15: [Only available when Belanor is on the same team.] AUDIT: the gated skill is the ONLY source of Debuff Spread.'
where  champion_id = (select id from champions where game_id='raid_shadow_legends' and lower(name)=lower('Zavia'))
  and  tag_id      = (select id from tags where lower(name)=lower('Debuff Spread'))
  and  status in ('approved','proposed');

-- Aratheia | Shield   (#16)
update champion_tags
set    status = 'rejected',
       source_note = 'Policy #16: Will ignore [Shield], [Block Damage], and [Strengthen] buffs.'
where  champion_id = (select id from champions where game_id='raid_shadow_legends' and lower(name)=lower('Aratheia'))
  and  tag_id      = (select id from tags where lower(name)=lower('Shield'))
  and  status in ('approved','proposed');

-- Astralon | Ally Protection   (#16)
update champion_tags
set    status = 'rejected',
       source_note = 'Policy #16: Will ignore [Increase DEF], [Strengthen], and [Ally Protection] buffs.'
where  champion_id = (select id from champions where game_id='raid_shadow_legends' and lower(name)=lower('Astralon'))
  and  tag_id      = (select id from tags where lower(name)=lower('Ally Protection'))
  and  status in ('approved','proposed');

-- Baron | Block Damage   (#16)
update champion_tags
set    status = 'rejected',
       source_note = 'Policy #16: Will ignore [Shield] buffs and [Block Damage] buffs, as well as 50% of the target''s DEF.'
where  champion_id = (select id from champions where game_id='raid_shadow_legends' and lower(name)=lower('Baron'))
  and  tag_id      = (select id from tags where lower(name)=lower('Block Damage'))
  and  status in ('approved','proposed');

-- Baron | Shield   (#16)
update champion_tags
set    status = 'rejected',
       source_note = 'Policy #16: Will ignore [Shield] buffs and [Block Damage] buffs, as well as 50% of the target''s DEF.'
where  champion_id = (select id from champions where game_id='raid_shadow_legends' and lower(name)=lower('Baron'))
  and  tag_id      = (select id from tags where lower(name)=lower('Shield'))
  and  status in ('approved','proposed');

-- Chaagur | Block Damage   (#16)
update champion_tags
set    status = 'rejected',
       source_note = 'Policy #16: Will ignore [Shield], [Block Damage] and [Unkillable] buffs if the target is under a [Poison] debuff.'
where  champion_id = (select id from champions where game_id='raid_shadow_legends' and lower(name)=lower('Chaagur'))
  and  tag_id      = (select id from tags where lower(name)=lower('Block Damage'))
  and  status in ('approved','proposed');

-- Chaagur | Shield   (#16)
update champion_tags
set    status = 'rejected',
       source_note = 'Policy #16: Will ignore [Shield], [Block Damage] and [Unkillable] buffs if the target is under a [Poison] debuff.'
where  champion_id = (select id from champions where game_id='raid_shadow_legends' and lower(name)=lower('Chaagur'))
  and  tag_id      = (select id from tags where lower(name)=lower('Shield'))
  and  status in ('approved','proposed');

-- Chaagur | Unkillable   (#16)
update champion_tags
set    status = 'rejected',
       source_note = 'Policy #16: Will ignore [Shield], [Block Damage] and [Unkillable] buffs if the target is under a [Poison] debuff.'
where  champion_id = (select id from champions where game_id='raid_shadow_legends' and lower(name)=lower('Chaagur'))
  and  tag_id      = (select id from tags where lower(name)=lower('Unkillable'))
  and  status in ('approved','proposed');

-- Chevalier | Block Damage   (#16)
update champion_tags
set    status = 'rejected',
       source_note = 'Policy #16: Will ignore [Block Damage] and [Shield] buffs.'
where  champion_id = (select id from champions where game_id='raid_shadow_legends' and lower(name)=lower('Chevalier'))
  and  tag_id      = (select id from tags where lower(name)=lower('Block Damage'))
  and  status in ('approved','proposed');

-- Chevalier | Shield   (#16)
update champion_tags
set    status = 'rejected',
       source_note = 'Policy #16: Will ignore [Block Damage] and [Shield] buffs.'
where  champion_id = (select id from champions where game_id='raid_shadow_legends' and lower(name)=lower('Chevalier'))
  and  tag_id      = (select id from tags where lower(name)=lower('Shield'))
  and  status in ('approved','proposed');

-- Crypt Witch | Block Damage   (#16)
update champion_tags
set    status = 'rejected',
       source_note = 'Policy #16: Will ignore [Shield] and [Block Damage] buffs.'
where  champion_id = (select id from champions where game_id='raid_shadow_legends' and lower(name)=lower('Crypt Witch'))
  and  tag_id      = (select id from tags where lower(name)=lower('Block Damage'))
  and  status in ('approved','proposed');

-- Crypt Witch | Shield   (#16)
update champion_tags
set    status = 'rejected',
       source_note = 'Policy #16: Will ignore [Shield] and [Block Damage] buffs.'
where  champion_id = (select id from champions where game_id='raid_shadow_legends' and lower(name)=lower('Crypt Witch'))
  and  tag_id      = (select id from tags where lower(name)=lower('Shield'))
  and  status in ('approved','proposed');

-- Faceless | Block Damage   (#16)
update champion_tags
set    status = 'rejected',
       source_note = 'Policy #16: Will ignore [Shield] and [Block Damage] buffs as well as DEF.'
where  champion_id = (select id from champions where game_id='raid_shadow_legends' and lower(name)=lower('Faceless'))
  and  tag_id      = (select id from tags where lower(name)=lower('Block Damage'))
  and  status in ('approved','proposed');

-- Faceless | Shield   (#16)
update champion_tags
set    status = 'rejected',
       source_note = 'Policy #16: Will ignore [Shield] and [Block Damage] buffs as well as DEF.'
where  champion_id = (select id from champions where game_id='raid_shadow_legends' and lower(name)=lower('Faceless'))
  and  tag_id      = (select id from tags where lower(name)=lower('Shield'))
  and  status in ('approved','proposed');

-- Gamuran | Shield   (#16)
update champion_tags
set    status = 'rejected',
       source_note = 'Policy #16: This attack cannot be critical, and will ignore any [Shield] buffs and 100% of each target''s DEF.'
where  champion_id = (select id from champions where game_id='raid_shadow_legends' and lower(name)=lower('Gamuran'))
  and  tag_id      = (select id from tags where lower(name)=lower('Shield'))
  and  status in ('approved','proposed');

-- Genzin | Shield   (#16)
update champion_tags
set    status = 'rejected',
       source_note = 'Policy #16: Will ignore [Unkillable] buffs and [Shield] buffs.'
where  champion_id = (select id from champions where game_id='raid_shadow_legends' and lower(name)=lower('Genzin'))
  and  tag_id      = (select id from tags where lower(name)=lower('Shield'))
  and  status in ('approved','proposed');

-- Genzin | Unkillable   (#16)
update champion_tags
set    status = 'rejected',
       source_note = 'Policy #16: Will ignore [Unkillable] buffs and [Shield] buffs.'
where  champion_id = (select id from champions where game_id='raid_shadow_legends' and lower(name)=lower('Genzin'))
  and  tag_id      = (select id from tags where lower(name)=lower('Unkillable'))
  and  status in ('approved','proposed');

-- Goremask | Block Damage   (#16)
update champion_tags
set    status = 'rejected',
       source_note = 'Policy #16: Will ignore [Shield] and [Block Damage] buffs.'
where  champion_id = (select id from champions where game_id='raid_shadow_legends' and lower(name)=lower('Goremask'))
  and  tag_id      = (select id from tags where lower(name)=lower('Block Damage'))
  and  status in ('approved','proposed');

-- Goremask | Shield   (#16)
update champion_tags
set    status = 'rejected',
       source_note = 'Policy #16: Will ignore [Shield] and [Block Damage] buffs.'
where  champion_id = (select id from champions where game_id='raid_shadow_legends' and lower(name)=lower('Goremask'))
  and  tag_id      = (select id from tags where lower(name)=lower('Shield'))
  and  status in ('approved','proposed');

-- Gory | Shield   (#16)
update champion_tags
set    status = 'rejected',
       source_note = 'Policy #16: Will ignore [Increase DEF] and [Shield] buffs.'
where  champion_id = (select id from champions where game_id='raid_shadow_legends' and lower(name)=lower('Gory'))
  and  tag_id      = (select id from tags where lower(name)=lower('Shield'))
  and  status in ('approved','proposed');

-- Halberdier | Block Damage   (#16)
update champion_tags
set    status = 'rejected',
       source_note = 'Policy #16: Will ignore [Shield] and [Block Damage] buffs.'
where  champion_id = (select id from champions where game_id='raid_shadow_legends' and lower(name)=lower('Halberdier'))
  and  tag_id      = (select id from tags where lower(name)=lower('Block Damage'))
  and  status in ('approved','proposed');

-- Halberdier | Shield   (#16)
update champion_tags
set    status = 'rejected',
       source_note = 'Policy #16: Will ignore [Shield] and [Block Damage] buffs.'
where  champion_id = (select id from champions where game_id='raid_shadow_legends' and lower(name)=lower('Halberdier'))
  and  tag_id      = (select id from tags where lower(name)=lower('Shield'))
  and  status in ('approved','proposed');

-- Jurojin | Block Damage   (#16)
update champion_tags
set    status = 'rejected',
       source_note = 'Policy #16: Will also ignore [Unkillable] and [Block Damage] buffs.'
where  champion_id = (select id from champions where game_id='raid_shadow_legends' and lower(name)=lower('Jurojin'))
  and  tag_id      = (select id from tags where lower(name)=lower('Block Damage'))
  and  status in ('approved','proposed');

-- Jurojin | Unkillable   (#16)
update champion_tags
set    status = 'rejected',
       source_note = 'Policy #16: Will also ignore [Unkillable] and [Block Damage] buffs.'
where  champion_id = (select id from champions where game_id='raid_shadow_legends' and lower(name)=lower('Jurojin'))
  and  tag_id      = (select id from tags where lower(name)=lower('Unkillable'))
  and  status in ('approved','proposed');

-- Keberon | Unkillable   (#16)
update champion_tags
set    status = 'rejected',
       source_note = 'Policy #16: Will ignore [Shield] and [Unkillable] buffs, as well as 25% of the target''s DEF.'
where  champion_id = (select id from champions where game_id='raid_shadow_legends' and lower(name)=lower('Keberon'))
  and  tag_id      = (select id from tags where lower(name)=lower('Unkillable'))
  and  status in ('approved','proposed');

-- Longbeard | Block Damage   (#16)
update champion_tags
set    status = 'rejected',
       source_note = 'Policy #16: Will ignore [Shield] and [Block Damage] buffs.'
where  champion_id = (select id from champions where game_id='raid_shadow_legends' and lower(name)=lower('Longbeard'))
  and  tag_id      = (select id from tags where lower(name)=lower('Block Damage'))
  and  status in ('approved','proposed');

-- Longbeard | Shield   (#16)
update champion_tags
set    status = 'rejected',
       source_note = 'Policy #16: Will ignore [Shield] and [Block Damage] buffs.'
where  champion_id = (select id from champions where game_id='raid_shadow_legends' and lower(name)=lower('Longbeard'))
  and  tag_id      = (select id from tags where lower(name)=lower('Shield'))
  and  status in ('approved','proposed');

-- Lua | Block Damage   (#16)
update champion_tags
set    status = 'rejected',
       source_note = 'Policy #16: Will ignore [Shield] and [Block Damage] buffs.'
where  champion_id = (select id from champions where game_id='raid_shadow_legends' and lower(name)=lower('Lua'))
  and  tag_id      = (select id from tags where lower(name)=lower('Block Damage'))
  and  status in ('approved','proposed');

-- Lua | Shield   (#16)
update champion_tags
set    status = 'rejected',
       source_note = 'Policy #16: Will ignore [Shield] and [Block Damage] buffs.'
where  champion_id = (select id from champions where game_id='raid_shadow_legends' and lower(name)=lower('Lua'))
  and  tag_id      = (select id from tags where lower(name)=lower('Shield'))
  and  status in ('approved','proposed');

-- Lydia | Block Revive   (#16)
update champion_tags
set    status = 'rejected',
       source_note = 'Policy #16: This skill will ignore [Block Revive].'
where  champion_id = (select id from champions where game_id='raid_shadow_legends' and lower(name)=lower('Lydia'))
  and  tag_id      = (select id from tags where lower(name)=lower('Block Revive'))
  and  status in ('approved','proposed');

-- Madman | Block Damage   (#16)
update champion_tags
set    status = 'rejected',
       source_note = 'Policy #16: Will ignore [Block Damage] and [Shield] buffs.'
where  champion_id = (select id from champions where game_id='raid_shadow_legends' and lower(name)=lower('Madman'))
  and  tag_id      = (select id from tags where lower(name)=lower('Block Damage'))
  and  status in ('approved','proposed');

-- Madman | Shield   (#16)
update champion_tags
set    status = 'rejected',
       source_note = 'Policy #16: Will ignore [Block Damage] and [Shield] buffs.'
where  champion_id = (select id from champions where game_id='raid_shadow_legends' and lower(name)=lower('Madman'))
  and  tag_id      = (select id from tags where lower(name)=lower('Shield'))
  and  status in ('approved','proposed');

-- Mortu-Macaab | Block Damage   (#16)
update champion_tags
set    status = 'rejected',
       source_note = 'Policy #16: Will ignore [Shield] and [Block Damage] buffs as well as DEF.'
where  champion_id = (select id from champions where game_id='raid_shadow_legends' and lower(name)=lower('Mortu-Macaab'))
  and  tag_id      = (select id from tags where lower(name)=lower('Block Damage'))
  and  status in ('approved','proposed');

-- Mortu-Macaab | Shield   (#16)
update champion_tags
set    status = 'rejected',
       source_note = 'Policy #16: Will ignore [Shield] and [Block Damage] buffs as well as DEF.'
where  champion_id = (select id from champions where game_id='raid_shadow_legends' and lower(name)=lower('Mortu-Macaab'))
  and  tag_id      = (select id from tags where lower(name)=lower('Shield'))
  and  status in ('approved','proposed');

-- Mountain King | Block Damage   (#16)
update champion_tags
set    status = 'rejected',
       source_note = 'Policy #16: Will ignore [Shield] and [Block Damage] buffs.'
where  champion_id = (select id from champions where game_id='raid_shadow_legends' and lower(name)=lower('Mountain King'))
  and  tag_id      = (select id from tags where lower(name)=lower('Block Damage'))
  and  status in ('approved','proposed');

-- Mountain King | Shield   (#16)
update champion_tags
set    status = 'rejected',
       source_note = 'Policy #16: Will ignore [Shield] and [Block Damage] buffs.'
where  champion_id = (select id from champions where game_id='raid_shadow_legends' and lower(name)=lower('Mountain King'))
  and  tag_id      = (select id from tags where lower(name)=lower('Shield'))
  and  status in ('approved','proposed');

-- Nais | Unkillable   (#16)
update champion_tags
set    status = 'rejected',
       source_note = 'Policy #16: Will ignore [Shield], [Unkillable], and [Block Damage] buffs.'
where  champion_id = (select id from champions where game_id='raid_shadow_legends' and lower(name)=lower('Nais'))
  and  tag_id      = (select id from tags where lower(name)=lower('Unkillable'))
  and  status in ('approved','proposed');

-- Purgator | Shield   (#16)
update champion_tags
set    status = 'rejected',
       source_note = 'Policy #16: Will ignore [Shield] buffs.'
where  champion_id = (select id from champions where game_id='raid_shadow_legends' and lower(name)=lower('Purgator'))
  and  tag_id      = (select id from tags where lower(name)=lower('Shield'))
  and  status in ('approved','proposed');

-- Sabrael the Distant | Block Damage   (#16)
update champion_tags
set    status = 'rejected',
       source_note = 'Policy #16: Will ignore [Block Damage] and [Unkillable] buffs.'
where  champion_id = (select id from champions where game_id='raid_shadow_legends' and lower(name)=lower('Sabrael the Distant'))
  and  tag_id      = (select id from tags where lower(name)=lower('Block Damage'))
  and  status in ('approved','proposed');

-- Sabrael the Distant | Unkillable   (#16)
update champion_tags
set    status = 'rejected',
       source_note = 'Policy #16: Will ignore [Block Damage] and [Unkillable] buffs.'
where  champion_id = (select id from champions where game_id='raid_shadow_legends' and lower(name)=lower('Sabrael the Distant'))
  and  tag_id      = (select id from tags where lower(name)=lower('Unkillable'))
  and  status in ('approved','proposed');

-- Septimus | Block Damage   (#16)
update champion_tags
set    status = 'rejected',
       source_note = 'Policy #16: Will ignore [Shield] and [Block Damage] buffs.'
where  champion_id = (select id from champions where game_id='raid_shadow_legends' and lower(name)=lower('Septimus'))
  and  tag_id      = (select id from tags where lower(name)=lower('Block Damage'))
  and  status in ('approved','proposed');

-- Septimus | Shield   (#16)
update champion_tags
set    status = 'rejected',
       source_note = 'Policy #16: Will ignore [Shield] and [Block Damage] buffs.'
where  champion_id = (select id from champions where game_id='raid_shadow_legends' and lower(name)=lower('Septimus'))
  and  tag_id      = (select id from tags where lower(name)=lower('Shield'))
  and  status in ('approved','proposed');

-- Skink | Block Damage   (#16)
update champion_tags
set    status = 'rejected',
       source_note = 'Policy #16: Will ignore [Block Damage] and [Shield] buffs.'
where  champion_id = (select id from champions where game_id='raid_shadow_legends' and lower(name)=lower('Skink'))
  and  tag_id      = (select id from tags where lower(name)=lower('Block Damage'))
  and  status in ('approved','proposed');

-- Skink | Shield   (#16)
update champion_tags
set    status = 'rejected',
       source_note = 'Policy #16: Will ignore [Block Damage] and [Shield] buffs.'
where  champion_id = (select id from champions where game_id='raid_shadow_legends' and lower(name)=lower('Skink'))
  and  tag_id      = (select id from tags where lower(name)=lower('Shield'))
  and  status in ('approved','proposed');

-- Yannica | Shield   (#16)
update champion_tags
set    status = 'rejected',
       source_note = 'Policy #16: [A3] Elven Judgment: Will ignore [Shield] buffs. Removes [Shield] buffs from targets if this Champion is under a [Veil] buff. Ignored (#16) AND removed (#19), never placed.'
where  champion_id = (select id from champions where game_id='raid_shadow_legends' and lower(name)=lower('Yannica'))
  and  tag_id      = (select id from tags where lower(name)=lower('Shield'))
  and  status in ('approved','proposed');

-- Archbishop Pinthroy | Weaken   (#19)
update champion_tags
set    status = 'rejected',
       source_note = 'Policy #19: [Passive] Splendor [P]: Removes all [Decrease DEF] debuffs and [Weaken] debuffs from this Champion at the start of each turn. Self-cleanse: removes from SELF, does not place on enemies.'
where  champion_id = (select id from champions where game_id='raid_shadow_legends' and lower(name)=lower('Archbishop Pinthroy'))
  and  tag_id      = (select id from tags where lower(name)=lower('Weaken'))
  and  status in ('approved','proposed');

-- Embrys | Stone Skin   (#19)
update champion_tags
set    status = 'rejected',
       source_note = 'Policy #19: [A3] The Unmaking: Removes any [Stone Skin] buffs and replaces them with [True Fear] debuffs. Removes from enemies; does not place.'
where  champion_id = (select id from champions where game_id='raid_shadow_legends' and lower(name)=lower('Embrys'))
  and  tag_id      = (select id from tags where lower(name)=lower('Stone Skin'))
  and  status in ('approved','proposed');

-- Harvest Jack | Continuous Heal   (#19)
update champion_tags
set    status = 'rejected',
       source_note = 'Policy #19: [A2] Dreams to Ash: Removes any [Continuous Heal] buff from the target and replaces them with a 5% [Poison] debuff for 2 turns. Removes from enemies; does not place.'
where  champion_id = (select id from champions where game_id='raid_shadow_legends' and lower(name)=lower('Harvest Jack'))
  and  tag_id      = (select id from tags where lower(name)=lower('Continuous Heal'))
  and  status in ('approved','proposed');

-- Hotatsu | Fear   (#19)
update champion_tags
set    status = 'rejected',
       source_note = 'Policy #19: [A4] Spirit Touched [P]: Removes 1 random debuff from this Champion at the start of each turn. Will remove [Stun], [Sleep], [Freeze], [Fear], [True Fear], [Provoke], [Petrification] debuffs before other debuffs. Self-cleanse.'
where  champion_id = (select id from champions where game_id='raid_shadow_legends' and lower(name)=lower('Hotatsu'))
  and  tag_id      = (select id from tags where lower(name)=lower('Fear'))
  and  status in ('approved','proposed');

-- Hotatsu | Freeze   (#19)
update champion_tags
set    status = 'rejected',
       source_note = 'Policy #19: [A4] Spirit Touched [P]: Removes 1 random debuff from this Champion at the start of each turn. Will remove [Stun], [Sleep], [Freeze], [Fear], [True Fear], [Provoke], [Petrification] debuffs before other debuffs. Self-cleanse.'
where  champion_id = (select id from champions where game_id='raid_shadow_legends' and lower(name)=lower('Hotatsu'))
  and  tag_id      = (select id from tags where lower(name)=lower('Freeze'))
  and  status in ('approved','proposed');

-- Hotatsu | Sleep   (#19)
update champion_tags
set    status = 'rejected',
       source_note = 'Policy #19: [A4] Spirit Touched [P]: Removes 1 random debuff from this Champion at the start of each turn. Will remove [Stun], [Sleep], [Freeze], [Fear], [True Fear], [Provoke], [Petrification] debuffs before other debuffs. Self-cleanse.'
where  champion_id = (select id from champions where game_id='raid_shadow_legends' and lower(name)=lower('Hotatsu'))
  and  tag_id      = (select id from tags where lower(name)=lower('Sleep'))
  and  status in ('approved','proposed');

-- Hotatsu | Stun   (#19)
update champion_tags
set    status = 'rejected',
       source_note = 'Policy #19: [A4] Spirit Touched [P]: Removes 1 random debuff from this Champion at the start of each turn. Will remove [Stun], [Sleep], [Freeze], [Fear], [True Fear], [Provoke], [Petrification] debuffs before other debuffs. Self-cleanse.'
where  champion_id = (select id from champions where game_id='raid_shadow_legends' and lower(name)=lower('Hotatsu'))
  and  tag_id      = (select id from tags where lower(name)=lower('Stun'))
  and  status in ('approved','proposed');

-- Hotatsu | True Fear   (#19)
update champion_tags
set    status = 'rejected',
       source_note = 'Policy #19: [A4] Spirit Touched [P]: Removes 1 random debuff from this Champion at the start of each turn. Will remove [Stun], [Sleep], [Freeze], [Fear], [True Fear], [Provoke], [Petrification] debuffs before other debuffs. Self-cleanse.'
where  champion_id = (select id from champions where game_id='raid_shadow_legends' and lower(name)=lower('Hotatsu'))
  and  tag_id      = (select id from tags where lower(name)=lower('True Fear'))
  and  status in ('approved','proposed');

-- Suzerain Katonn | Block Damage   (#19)
update champion_tags
set    status = 'rejected',
       source_note = 'Policy #19: [A3] Banish From Time: Removes [Shield], [Block Damage], and [Unkillable] buffs from all enemies, then attacks them. Buff-strip, not placement.'
where  champion_id = (select id from champions where game_id='raid_shadow_legends' and lower(name)=lower('Suzerain Katonn'))
  and  tag_id      = (select id from tags where lower(name)=lower('Block Damage'))
  and  status in ('approved','proposed');

-- Suzerain Katonn | Shield   (#19)
update champion_tags
set    status = 'rejected',
       source_note = 'Policy #19: [A3] Banish From Time: Removes [Shield], [Block Damage], and [Unkillable] buffs from all enemies, then attacks them. Buff-strip, not placement.'
where  champion_id = (select id from champions where game_id='raid_shadow_legends' and lower(name)=lower('Suzerain Katonn'))
  and  tag_id      = (select id from tags where lower(name)=lower('Shield'))
  and  status in ('approved','proposed');

-- Suzerain Katonn | Unkillable   (#19)
update champion_tags
set    status = 'rejected',
       source_note = 'Policy #19: [A3] Banish From Time: Removes [Shield], [Block Damage], and [Unkillable] buffs from all enemies, then attacks them. Buff-strip, not placement.'
where  champion_id = (select id from champions where game_id='raid_shadow_legends' and lower(name)=lower('Suzerain Katonn'))
  and  tag_id      = (select id from tags where lower(name)=lower('Unkillable'))
  and  status in ('approved','proposed');

-- Yannica | Veil   (#19)
update champion_tags
set    status = 'rejected',
       source_note = 'Policy #19: [A2] Baffling Speed: Places a [Perfect Veil] buff on this Champion for 3 turns if this attack is critical. She places [Perfect Veil], never [Veil]; A1/A3 use [Veil] only as a condition.'
where  champion_id = (select id from champions where game_id='raid_shadow_legends' and lower(name)=lower('Yannica'))
  and  tag_id      = (select id from tags where lower(name)=lower('Veil'))
  and  status in ('approved','proposed');
