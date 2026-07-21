-- ============================================================================
-- Seed 201 — PROPOSED: split `Enemy Max HP Damage` into two mechanics, and
--            extract the real per-skill %MAX-HP percentages.
--
-- ⚠⚠ NOT APPLIED. NEEDS MIKE'S SIGN-OFF. Per CLAUDE.md:
--   1. It introduces a NEW TAG (`Max HP Destruction`) — "Every new tag or rule
--      gets proposed in structured form, then reviewed and approved by a human
--      before it's considered live. No auto-merge."
--   2. It changes live recommendation behaviour: it strips a damage capability
--      from 38 champions and grants one to 8 others.
--   3. Requires migrations/2026-07-21_champion_skills_maxhp_extraction.sql FIRST
--      (adds the six maxhp_* columns this seed writes).
-- Policy #18 worksheet writeback: DONE in the same session (DB_Tags +
-- DB_Champion_Tags in "RAID Master Database v4.0 MASTER", backup
-- BACKUP-2026-07-21-preMaxHpSplit.xlsx).
--
-- ---------------------------------------------------------------------------
-- THE DEFECT
-- ---------------------------------------------------------------------------
-- 46 champions carried an approved `Enemy Max HP Damage` tag. Reading all 46 kits
-- verbatim against champion_skills.skill_summary, only EIGHT deal damage as a
-- percentage of the enemy's MAX HP. The tag conflated three mechanics:
--
--   F1  TRUE %maxHP DAMAGE  (8)  — "damage ... equal to 10% of their MAX HP".
--       Damage dealt OUT OF the health pool. DEF-independent. The only family
--       lib/damage-mechanics.js §6b caps, and the only one SOURCE_COEFF should score.
--
--   F2  MAX-HP DESTRUCTION  (37) — "destroys the target's MAX HP by 30% of the
--       damage inflicted" / "destroys 10% of the target's MAX HP". Permanently
--       SHRINKS the pool. A different mechanic the model does not represent at
--       all, and one the per-hit damage cap would not govern the same way.
--
--   F3  MIS-TAG  (1) — Edward. No skill in his kit mentions MAX HP at all.
--
-- SAME FAILURE CLASS AS TAG POLICIES #12 / #16 / #19 / #20: a phrase was matched
-- without reading the VERB in front of it or WHOSE stat it refers to. #16 is
-- "ignores [X]" ≠ places X; #19 is "removes [X]" ≠ places X; this is
-- "DESTROYS n% of MAX HP" ≠ DEALS n% of MAX HP as damage. Every one of those
-- policies also says: don't just reject the bracket, RELOCATE the capability to a
-- tag that names the real action. That is what `Max HP Destruction` is for.
--
-- ---------------------------------------------------------------------------
-- WHY IT BLOCKS THE §6b BOSS CAP (the reason this was worth doing now)
-- ---------------------------------------------------------------------------
-- `SOURCE_COEFF.enemy_maxhp` in lib/cb-damage-model.js is a flat nominal 0.05 for
-- every carrier. 0.05 < the 0.10 boss cap, so the cap encoded in eaf9843 can never
-- bind and is inert by construction. Replacing the nominal with the real numbers
-- extracted below is what switches it on. After this split the true-damage
-- percentages run 0.01 .. 0.30, and FIVE carriers cross the 10% ceiling:
--   Gamuran 20% · Defiled Sinner 15% · Cinda cap 15% · Kurosa 30% (non-boss)
--   · Quintus 10% PER BUFF (uncapped in text)
-- Those five are the entire mechanism by which crossing into Normal 21 produces
-- the step change §6b is about. Under the old tag they were diluted by 37
-- destruction champions all scored at a flat 5%.
--
-- ⚠ DO NOT change SOURCE_COEFF or the cap constants in this seed — extraction and
-- tagging only. Wiring the per-skill numbers into the model is a separate change
-- that should be shadow-graded before it drives live recommendations.
--
-- ---------------------------------------------------------------------------
-- ⚑ SOURCING UPGRADE — §6b's caveat is UNDERSTATED, and the repo already knew
-- ---------------------------------------------------------------------------
-- eaf9843 flags the 10%/5% cap as "INHERITED, NOT VERIFIED ... ONE unconfirmed
-- citation" from a community thread. That is too pessimistic. The mechanic was
-- ALREADY in this repo, by its in-game name, in all four dungeon-review packets:
--
--   FIRE_KNIGHT_REVIEW.md:22  "Almighty Strength (passive, Stages 21-25 only):
--        damage that scales on enemy MAX HP is capped at 10% of Fyro's MAX HP"
--   SPIDER_REVIEW.md:21 · ICE_GOLEM_REVIEW.md:17 · DRAGON_REVIEW.md:14 — same
--        passive, same 10%, same 21-25 boundary.
--
-- And FOUR separate Plarium skill/keyword texts in our own corpus independently
-- state a 10%-of-boss-MAX-HP ceiling in the same idiom:
--   Androc A3    "If the target is a Boss, the damage inflicted is equal to 10% of their MAX HP."
--   Kurosa A1    "If the other enemies are Bosses or Minions, ... 10% of their MAX HP instead."
--   Klaazag [P]  "This damage is capped at 10% of the enemy's MAX HP."
--   Infest       (data/keyword-glossary.json) "Against Bosses or their minions, capped at 10% of MAX HP."
--
-- So: the EXISTENCE of the cap, the 10% figure, and the stage-21 boundary are all
-- corroborated in-repo, and §6b's open question "the 21 boundary appears to have a
-- real mechanical basis after all" is ANSWERED — the basis is the named boss
-- passive ALMIGHTY STRENGTH. The 5% `ultra` tier remains single-sourced.
-- (This is the CLAUDE.md hard rule biting exactly as advertised: the reviews had
-- it, the summary did not. Reading them first would have found it.)
--
-- ⚠ AND A CONTRADICTION §6b SHOULD RESOLVE — NOT changed here, flagged for Mike.
-- §6b scopes the cap to MAXHP_CAP_APPLIES_TO = {enemy_maxhp} only, on the grounds
-- that whether Poison / HP Burn are also capped "is NOT established". The dungeon
-- reviews are broader ("damage that SCALES ON enemy MAX HP"), and
-- lib/dungeon-mechanics.js:214 already states the wider reading as project fact:
--   "Poison & HP Burn scale off enemy MAX HP, and Almighty Strength CAPS %maxHP
--    damage at 10% ... at stages 21-25 — which is exactly why DoT-solo works up to
--    ~20 (Michelangelo solos Dragon 20) but the top stages throttle DoT".
-- Two files in the same lib now disagree about whether DoT is capped. Because our
-- DoT nominals (0.025) sit far below 0.10 it changes nothing today, but it should
-- be settled before any DoT coefficient is calibrated upward.
--
-- ---------------------------------------------------------------------------
-- WHY `Max HP Destruction` IS A SEPARATE TAG, NOT A RENAME
-- ---------------------------------------------------------------------------
-- Checked data/keyword-glossary.json and all 108 rows of `tags` first: no existing
-- term covers it. `Shatter` is unrelated (it boosts Ignore-DEF). Plarium's own
-- immunity wording is "Decrease MAX HP" (Stone Skin's glossary def), but naming it
-- that would file it beside `Decrease ACC/ATK/DEF/RES/SPD/Turn Meter` — every one
-- of which is_debuff=true and ACC/RES-gated. MAX-HP destruction is an unavoidable
-- rider on a landed hit, not a resistible debuff, so it is seeded
-- is_debuff=false / bypasses_accuracy_check=true. Plarium uses "destroys" and
-- "decreases" interchangeably for the identical effect, so neither verb is
-- canonical; the discriminator is that it does not take an ACC check.
--
-- It is a DIFFERENT mechanic, not a weaker one:
--   • It shrinks the pool instead of damaging out of it, so it is not additive
--     with damage and cannot be summed into a kill-time calculation the same way.
--   • It is REVERSIBLE — several champions "fully restore destroyed MAX HP"
--     (Grand Oak Padraig, Knave, Galleus, Marichka, Craklin, Aeila, Artak, Wuzgar).
--     No such thing exists for damage.
--   • It carries per-battle ceilings the text states outright (25% .. 75%).
--   • ⚠ IT IS OFTEN DISABLED AGAINST BOSSES OUTRIGHT — and this is the concrete
--     harm of the conflation. THREE of the 37 say so in plain text:
--       Nais A3          "This effect does not work against Bosses."
--       Onryo Ieyasu A2  "This effect does not work against Bosses."
--       Urost [P]        "Will not decrease Bosses MAX HP."
--     Today all three are scored as dealing 5% of boss MAX HP per turn in a
--     dungeon. They deal ZERO. Three more carry reduced or altered boss values
--     (Skull Lord Var-Gall 5%→2.5%, Rotos flat→proportional, Vitrius 25%→35%).
--
-- ---------------------------------------------------------------------------
-- SPIDER IMPLICATION (read SPIDER_REVIEW.md in full before acting on this)
-- ---------------------------------------------------------------------------
-- lib/spider-rubric.js:51 defines MAXHP_DAMAGE = ['Enemy Max HP Damage'] and
-- allocates it 30 points — the largest single bucket — in the `maxhp_nuke`
-- strategy for stages 15-20, "the wall" where raw AoE stops working
-- (SPIDER_REVIEW.md:36). That bucket is currently scored off a tag whose carriers
-- are 80% MAX-HP destruction, including two (Nais, Onryo Ieyasu) that do literally
-- nothing to Skavag. After the split the bucket resolves to the 8+8 true carriers.
-- This CORRECTS the bucket's membership; it does NOT move the tier boundaries.
-- SPIDER_REVIEW.md:88 still lists "is the wall at 15 right?" as an OPEN QUESTION to
-- Mike, and the 15 boundary remains unsourced (only the 21 boundary is now
-- explained, by Almighty Strength). No stage boundary is changed by this seed.
--
-- ---------------------------------------------------------------------------
-- METHOD / SCOPE
-- ---------------------------------------------------------------------------
-- Every one of the 46 was read in full from champion_skills.skill_summary; each
-- clause quoted below was programmatically re-verified as a verbatim substring of
-- the stored text (58/58 fragments matched, skill names resolved).
-- The false-negative sweep read all 421 skills mentioning "MAX HP" — NOT a naive
-- match, which is dominated by [Shield]/heal clauses scaled off the champion's OWN
-- MAX HP, plus incoming-damage thresholds and destroyed-HP RESTORATION.
--
-- TWO CORRECTIONS to the eaf9843 first pass, both from reading the whole kit:
--   • Tribune Herakletes is NOT a mis-tag. His A1 "heals all allies by 20% of their
--     MAX HP" was correctly spotted as not-damage, but his A3 "Destroys the MAX HP
--     of all enemies by 10%" is real AoE destruction → F2, not F3.
--   • Rotos is NOT a mis-tag. His passive is indeed an incoming-damage cap on
--     himself, but his A2 destroys 20% of the target's MAX HP → F2, not F3.
--   Attribute a tag to the SKILL that provides it before rejecting the champion —
--   the policy #15 scope note (2026-07-18), which caught the same error on Venus.
--
-- KNOWN GAPS left open on purpose (no invented numbers):
--   • pct UNKNOWN, needs the in-game card: Royal Guard, Steel Bowyer, Odin
--     (true damage); Knosson, Nais, Varl (destruction).
--   • Varl's stored skill_summary is PARAPHRASED ("destroys a portion of MAX HP"),
--     not Plarium verbatim — it fails the Tier-1 source bar and needs re-capture.
--   • Galleus A1 "damage ... based on this Champion's DEF and the enemy's MAX HP"
--     is a DEF/MAX-HP hybrid with no stated split. Deliberately NOT tagged either
--     way pending the card.
--   • `Smite` (25% of MAX HP), `Infest` (50%, 10% vs bosses) and `Necrosis` (5%
--     per stack) are existing tags that ARE %maxHP damage sources but appear in
--     NEITHER TAG_TO_SOURCE (damage-mechanics.js) NOR TAG_SOURCE/SOURCE_COEFF
--     (cb-damage-model.js). Smite currently has 0 carriers, Infest 1 (Xenomorph),
--     Necrosis 1 (Embrys). Unmapped source families — a separate change.
--
-- TO APPLY (after sign-off):
--   node --env-file=.env.local tools/apply-migration.js migrations/2026-07-21_champion_skills_maxhp_extraction.sql
--   node --env-file=.env.local tools/apply-seed-pooler.mjs seeds/201_maxhp_tag_split_PROPOSED.sql
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. VOCABULARY.
-- ---------------------------------------------------------------------------
insert into tags (name, description, is_debuff, bypasses_accuracy_check)
values (
  'Max HP Destruction',
  'Permanently DESTROYS a portion of the enemy MAX HP pool (Plarium writes it as both "destroys" and "decreases"). NOT damage and NOT an enemy_maxhp damage source: it shrinks the health bar instead of dealing damage out of it, it is frequently reversible ("fully restores destroyed MAX HP"), it carries per-battle ceilings, and it is often DISABLED or reduced against Bosses. Two shapes: a flat % of MAX HP, or a % of the damage the hit inflicted — the denominators are not comparable (see champion_skills.maxhp_pct_basis). Not a resistible debuff: it rides a landed hit and takes no ACC/RES check.',
  false, true
)
on conflict (name) do nothing;

-- Sharpen the surviving tag so the same conflation cannot recur.
update tags set description =
  'Deals DAMAGE equal to a percentage of the target''s MAX HP, ignoring DEF. Not a debuff — no ACC/RES check. DOES NOT INCLUDE MAX-HP DESTRUCTION ("destroys/decreases the target''s MAX HP by X%") — that shrinks the pool rather than damaging out of it and is the separate `Max HP Destruction` tag (split 2026-07-21, seed 201). Capped at 10% of boss MAX HP at Normal 21-25 and Hard by the boss passive Almighty Strength — see lib/damage-mechanics.js §6b. Real per-skill percentages live in champion_skills.maxhp_pct.'
where name = 'Enemy Max HP Damage';


-- ---------------------------------------------------------------------------
-- 2a. REJECT `Enemy Max HP Damage` on the 38 champions that never deal it.
--     37 MAX-HP DESTRUCTION + 1 outright mis-tag.
-- ---------------------------------------------------------------------------
update champion_tags ct set status='rejected',
  source_note = coalesce(ct.source_note||' | ','') || 'Split 2026-07-21: this is MAX-HP DESTRUCTION, not %maxHP damage. A2 "Rolling Thunder": "If the target''s HP is equal to or higher than 50% after the first hit, destroys the target''s MAX HP by 30% of the damage inflicted instead." -> retagged Max HP Destruction.'
from champions c, tags t where ct.champion_id=c.id and ct.tag_id=t.id
  and c.game_id='raid_shadow_legends' and c.name='Alaz'
  and t.name='Enemy Max HP Damage' and ct.status='approved';
update champion_tags ct set status='rejected',
  source_note = coalesce(ct.source_note||' | ','') || 'Split 2026-07-21: this is MAX-HP DESTRUCTION, not %maxHP damage. A3 "Burn Away": "Destroys each target''s MAX HP by 50% of the damage inflicted." -> retagged Max HP Destruction.'
from champions c, tags t where ct.champion_id=c.id and ct.tag_id=t.id
  and c.game_id='raid_shadow_legends' and c.name='Cagebreaker'
  and t.name='Enemy Max HP Damage' and ct.status='approved';
update champion_tags ct set status='rejected',
  source_note = coalesce(ct.source_note||' | ','') || 'Split 2026-07-21: this is MAX-HP DESTRUCTION, not %maxHP damage. A1 "Necrotic Bolt": "Destroys the target''s MAX HP by 30% of the damage inflicted." -> retagged Max HP Destruction.'
from champions c, tags t where ct.champion_id=c.id and ct.tag_id=t.id
  and c.game_id='raid_shadow_legends' and c.name='Dark Elhain'
  and t.name='Enemy Max HP Damage' and ct.status='approved';
update champion_tags ct set status='rejected',
  source_note = coalesce(ct.source_note||' | ','') || 'Split 2026-07-21: this is MAX-HP DESTRUCTION, not %maxHP damage. A2 "Icequake": "Each hit decreases each target''s MAX HP by 25% of the damage inflicted (stacks up to 50%)." -> retagged Max HP Destruction.'
from champions c, tags t where ct.champion_id=c.id and ct.tag_id=t.id
  and c.game_id='raid_shadow_legends' and c.name='Fjorad'
  and t.name='Enemy Max HP Damage' and ct.status='approved';
update champion_tags ct set status='rejected',
  source_note = coalesce(ct.source_note||' | ','') || 'Split 2026-07-21: this is MAX-HP DESTRUCTION, not %maxHP damage. A1 "Stone Breaker": "Destroys the target''s MAX HP by 10% of the damage inflicted. The target''s MAX HP cannot be decreased by more than 50% in total." -> retagged Max HP Destruction.'
from champions c, tags t where ct.champion_id=c.id and ct.tag_id=t.id
  and c.game_id='raid_shadow_legends' and c.name='Fylja'
  and t.name='Enemy Max HP Damage' and ct.status='approved';
update champion_tags ct set status='rejected',
  source_note = coalesce(ct.source_note||' | ','') || 'Split 2026-07-21: this is MAX-HP DESTRUCTION, not %maxHP damage. A3 "Earthstomp": "Decreases each target''s MAX HP by 30% of the damage inflicted." -> retagged Max HP Destruction.'
from champions c, tags t where ct.champion_id=c.id and ct.tag_id=t.id
  and c.game_id='raid_shadow_legends' and c.name='Grizzled Jarl'
  and t.name='Enemy Max HP Damage' and ct.status='approved';
update champion_tags ct set status='rejected',
  source_note = coalesce(ct.source_note||' | ','') || 'Split 2026-07-21: this is MAX-HP DESTRUCTION, not %maxHP damage. A3 "Bloody Poleax": "The second hit destroys each target''s MAX HP by 10% (stacks up to 60%)." -> retagged Max HP Destruction.'
from champions c, tags t where ct.champion_id=c.id and ct.tag_id=t.id
  and c.game_id='raid_shadow_legends' and c.name='Grugtha'
  and t.name='Enemy Max HP Damage' and ct.status='approved';
update champion_tags ct set status='rejected',
  source_note = coalesce(ct.source_note||' | ','') || 'Split 2026-07-21: this is MAX-HP DESTRUCTION, not %maxHP damage. A1 "Lambent Trident": "The second hit decreases 3% of the target''s ATK or DEF or destroys 3% of the target''s MAX HP, depending on their Type (stacks up to 30%). [This effect does not work against Support Type Champions.]" -> retagged Max HP Destruction.'
from champions c, tags t where ct.champion_id=c.id and ct.tag_id=t.id
  and c.game_id='raid_shadow_legends' and c.name='Hierophant Lazarius'
  and t.name='Enemy Max HP Damage' and ct.status='approved';
update champion_tags ct set status='rejected',
  source_note = coalesce(ct.source_note||' | ','') || 'Split 2026-07-21: this is MAX-HP DESTRUCTION, not %maxHP damage. A1 "Vitality Censure": "Destroys the target''s MAX HP by 30% of the damage inflicted." -> retagged Max HP Destruction.'
from champions c, tags t where ct.champion_id=c.id and ct.tag_id=t.id
  and c.game_id='raid_shadow_legends' and c.name='Inithwe'
  and t.name='Enemy Max HP Damage' and ct.status='approved';
update champion_tags ct set status='rejected',
  source_note = coalesce(ct.source_note||' | ','') || 'Split 2026-07-21: this is MAX-HP DESTRUCTION, not %maxHP damage. A1 "Gouge": "Destroys enemy MAX HP by 15% of damage dealt." -> retagged Max HP Destruction.'
from champions c, tags t where ct.champion_id=c.id and ct.tag_id=t.id
  and c.game_id='raid_shadow_legends' and c.name='Ithos'
  and t.name='Enemy Max HP Damage' and ct.status='approved';
update champion_tags ct set status='rejected',
  source_note = coalesce(ct.source_note||' | ','') || 'Split 2026-07-21: this is MAX-HP DESTRUCTION, not %maxHP damage. A3 "Waste Away": "Destroys the enemy''s MAX HP by 30% of the damage inflicted if this attack is critical." -> retagged Max HP Destruction.'
from champions c, tags t where ct.champion_id=c.id and ct.tag_id=t.id
  and c.game_id='raid_shadow_legends' and c.name='Itinerant'
  and t.name='Enemy Max HP Damage' and ct.status='approved';
update champion_tags ct set status='rejected',
  source_note = coalesce(ct.source_note||' | ','') || 'Split 2026-07-21: this is MAX-HP DESTRUCTION, not %maxHP damage. A3 "Sear Away": "Decreases the target''s MAX HP by 30% of the damage inflicted." -> retagged Max HP Destruction.'
from champions c, tags t where ct.champion_id=c.id and ct.tag_id=t.id
  and c.game_id='raid_shadow_legends' and c.name='Jotun'
  and t.name='Enemy Max HP Damage' and ct.status='approved';
update champion_tags ct set status='rejected',
  source_note = coalesce(ct.source_note||' | ','') || 'Split 2026-07-21: this is MAX-HP DESTRUCTION, not %maxHP damage. A2 "Barkbreaker": "Also destroys each target''s MAX HP by 20% of the damage inflicted (stacks up to 50%)." -> retagged Max HP Destruction.'
from champions c, tags t where ct.champion_id=c.id and ct.tag_id=t.id
  and c.game_id='raid_shadow_legends' and c.name='Kawn'
  and t.name='Enemy Max HP Damage' and ct.status='approved';
update champion_tags ct set status='rejected',
  source_note = coalesce(ct.source_note||' | ','') || 'Split 2026-07-21: this is MAX-HP DESTRUCTION, not %maxHP damage. A4 "Eternal Sentinel [P]": "When attacked, destroys the attacker''s MAX HP by 20% of the damage received (stacks up to 50%)." -> retagged Max HP Destruction.'
from champions c, tags t where ct.champion_id=c.id and ct.tag_id=t.id
  and c.game_id='raid_shadow_legends' and c.name='Knave'
  and t.name='Enemy Max HP Damage' and ct.status='approved';
update champion_tags ct set status='rejected',
  source_note = coalesce(ct.source_note||' | ','') || 'Split 2026-07-21: this is MAX-HP DESTRUCTION, not %maxHP damage. A1 "Crushing Horns": "Destroys the target''s MAX HP and fills this Champion''s Turn Meter. Both effects are doubled if the target is under a [Provoke] debuff." -> retagged Max HP Destruction.'
from champions c, tags t where ct.champion_id=c.id and ct.tag_id=t.id
  and c.game_id='raid_shadow_legends' and c.name='Knosson'
  and t.name='Enemy Max HP Damage' and ct.status='approved';
update champion_tags ct set status='rejected',
  source_note = coalesce(ct.source_note||' | ','') || 'Split 2026-07-21: this is MAX-HP DESTRUCTION, not %maxHP damage. A3 "Playdate": "Destroys the target''s MAX HP by 25% of the damage inflicted if the target has higher MAX HP than this Champion." -> retagged Max HP Destruction.'
from champions c, tags t where ct.champion_id=c.id and ct.tag_id=t.id
  and c.game_id='raid_shadow_legends' and c.name='Little Miss Annie'
  and t.name='Enemy Max HP Damage' and ct.status='approved';
update champion_tags ct set status='rejected',
  source_note = coalesce(ct.source_note||' | ','') || 'Split 2026-07-21: this is MAX-HP DESTRUCTION, not %maxHP damage. A1 "Shattering Blow": "Decreases the target''s MAX HP by 30% of the damage inflicted." -> retagged Max HP Destruction.'
from champions c, tags t where ct.champion_id=c.id and ct.tag_id=t.id
  and c.game_id='raid_shadow_legends' and c.name='Lonatharil'
  and t.name='Enemy Max HP Damage' and ct.status='approved';
update champion_tags ct set status='rejected',
  source_note = coalesce(ct.source_note||' | ','') || 'Split 2026-07-21: this is MAX-HP DESTRUCTION, not %maxHP damage. A2 "Diminish": "Destroys the target''s MAX HP by 25% of the damage inflicted." -> retagged Max HP Destruction.'
from champions c, tags t where ct.champion_id=c.id and ct.tag_id=t.id
  and c.game_id='raid_shadow_legends' and c.name='Maiden'
  and t.name='Enemy Max HP Damage' and ct.status='approved';
update champion_tags ct set status='rejected',
  source_note = coalesce(ct.source_note||' | ','') || 'Split 2026-07-21: this is MAX-HP DESTRUCTION, not %maxHP damage. A3 "Thief''s Omen": "Destroys the target''s MAX HP and decreases the target''s ATK, DEF, SPD, RES and ACC by 10%... This effect does not work against Bosses." -> retagged Max HP Destruction.'
from champions c, tags t where ct.champion_id=c.id and ct.tag_id=t.id
  and c.game_id='raid_shadow_legends' and c.name='Nais'
  and t.name='Enemy Max HP Damage' and ct.status='approved';
update champion_tags ct set status='rejected',
  source_note = coalesce(ct.source_note||' | ','') || 'Split 2026-07-21: this is MAX-HP DESTRUCTION, not %maxHP damage. A2 "Violent Purification": "Before each hit, destroys the target''s MAX HP by 10% (stacks up to 50%). This effect does not work against Bosses." -> retagged Max HP Destruction.'
from champions c, tags t where ct.champion_id=c.id and ct.tag_id=t.id
  and c.game_id='raid_shadow_legends' and c.name='Onryo Ieyasu'
  and t.name='Enemy Max HP Damage' and ct.status='approved';
update champion_tags ct set status='rejected',
  source_note = coalesce(ct.source_note||' | ','') || 'Split 2026-07-21: this is MAX-HP DESTRUCTION, not %maxHP damage. A2 "Heartless Curse": "Destroys the target''s MAX HP by 20% of the damage inflicted." -> retagged Max HP Destruction.'
from champions c, tags t where ct.champion_id=c.id and ct.tag_id=t.id
  and c.game_id='raid_shadow_legends' and c.name='Pigsticker'
  and t.name='Enemy Max HP Damage' and ct.status='approved';
update champion_tags ct set status='rejected',
  source_note = coalesce(ct.source_note||' | ','') || 'Split 2026-07-21: this is MAX-HP DESTRUCTION, not %maxHP damage. A2 "Smart Disc": "Also destroys each enemy''s MAX HP by 30% of the damage dealt (stacks up to 50%)." -> retagged Max HP Destruction.'
from champions c, tags t where ct.champion_id=c.id and ct.tag_id=t.id
  and c.game_id='raid_shadow_legends' and c.name='Predator'
  and t.name='Enemy Max HP Damage' and ct.status='approved';
update champion_tags ct set status='rejected',
  source_note = coalesce(ct.source_note||' | ','') || 'Split 2026-07-21: this is MAX-HP DESTRUCTION, not %maxHP damage. A3 "Humble the Heathen": "Destroys the target''s MAX HP by 20% of the damage inflicted." -> retagged Max HP Destruction.'
from champions c, tags t where ct.champion_id=c.id and ct.tag_id=t.id
  and c.game_id='raid_shadow_legends' and c.name='Purgator'
  and t.name='Enemy Max HP Damage' and ct.status='approved';
update champion_tags ct set status='rejected',
  source_note = coalesce(ct.source_note||' | ','') || 'Split 2026-07-21: this is MAX-HP DESTRUCTION, not %maxHP damage. A1 "Ruination": "Destroys each target''s MAX HP by 30% of the damage inflicted." -> retagged Max HP Destruction.'
from champions c, tags t where ct.champion_id=c.id and ct.tag_id=t.id
  and c.game_id='raid_shadow_legends' and c.name='Richtoff the Bold'
  and t.name='Enemy Max HP Damage' and ct.status='approved';
update champion_tags ct set status='rejected',
  source_note = coalesce(ct.source_note||' | ','') || 'Split 2026-07-21: this is MAX-HP DESTRUCTION, not %maxHP damage. A3 "Heavy Slam": "Destroys their MAX HP by 40% of the damage inflicted." -> retagged Max HP Destruction.'
from champions c, tags t where ct.champion_id=c.id and ct.tag_id=t.id
  and c.game_id='raid_shadow_legends' and c.name='Ripper'
  and t.name='Enemy Max HP Damage' and ct.status='approved';
update champion_tags ct set status='rejected',
  source_note = coalesce(ct.source_note||' | ','') || 'Split 2026-07-21: this is MAX-HP DESTRUCTION, not %maxHP damage. A2 "Vitality Plunder": "Decreases the target''s MAX HP by 20%, then adds that HP to this Champion''s own MAX HP. Cannot decrease a single Champion''s MAX HP by more than 60% in one Battle. ... Decreases the MAX HP of Bosses by 30% of the damage inflicted instead." -> retagged Max HP Destruction.'
from champions c, tags t where ct.champion_id=c.id and ct.tag_id=t.id
  and c.game_id='raid_shadow_legends' and c.name='Rotos'
  and t.name='Enemy Max HP Damage' and ct.status='approved';
update champion_tags ct set status='rejected',
  source_note = coalesce(ct.source_note||' | ','') || 'Split 2026-07-21: this is MAX-HP DESTRUCTION, not %maxHP damage. A2 "Tender Meat": "Destroys the target''s MAX HP by 15% of the damage inflicted." -> retagged Max HP Destruction.'
from champions c, tags t where ct.champion_id=c.id and ct.tag_id=t.id
  and c.game_id='raid_shadow_legends' and c.name='Ruffstone'
  and t.name='Enemy Max HP Damage' and ct.status='approved';
update champion_tags ct set status='rejected',
  source_note = coalesce(ct.source_note||' | ','') || 'Split 2026-07-21: this is MAX-HP DESTRUCTION, not %maxHP damage. A2 "Crowd Pleaser": "Destroys the target''s MAX HP by 30% of the damage dealt." -> retagged Max HP Destruction.'
from champions c, tags t where ct.champion_id=c.id and ct.tag_id=t.id
  and c.game_id='raid_shadow_legends' and c.name='Scrapper'
  and t.name='Enemy Max HP Damage' and ct.status='approved';
update champion_tags ct set status='rejected',
  source_note = coalesce(ct.source_note||' | ','') || 'Split 2026-07-21: this is MAX-HP DESTRUCTION, not %maxHP damage. Passive "Horrific Foe [P]": "When attacked, destroys the attacker''s MAX HP by 5%. Destroys the MAX HP of Bosses by 2.5% instead (except the Scarab King, whose MAX HP will be destroyed by 0.5%). Cannot destroy a single enemy''s MAX HP by more than 50%." -> retagged Max HP Destruction.'
from champions c, tags t where ct.champion_id=c.id and ct.tag_id=t.id
  and c.game_id='raid_shadow_legends' and c.name='Skull Lord Var-Gall'
  and t.name='Enemy Max HP Damage' and ct.status='approved';
update champion_tags ct set status='rejected',
  source_note = coalesce(ct.source_note||' | ','') || 'Split 2026-07-21: this is MAX-HP DESTRUCTION, not %maxHP damage. A2 "Volatile Mixture": "The second hit has a 75% chance of destroying each target''s MAX HP by 3% for each [Poison] and [HP Burn] debuff activated on them by this skill (stacks up to 60%)." -> retagged Max HP Destruction.'
from champions c, tags t where ct.champion_id=c.id and ct.tag_id=t.id
  and c.game_id='raid_shadow_legends' and c.name='Stokk'
  and t.name='Enemy Max HP Damage' and ct.status='approved';
update champion_tags ct set status='rejected',
  source_note = coalesce(ct.source_note||' | ','') || 'Split 2026-07-21: this is MAX-HP DESTRUCTION, not %maxHP damage. A3 "Defender of Agaris": "Destroys the target''s MAX HP by 20% of the damage inflicted. Destroys the target''s MAX HP by 30% instead if the target is under a [Decrease DEF] debuff." -> retagged Max HP Destruction.'
from champions c, tags t where ct.champion_id=c.id and ct.tag_id=t.id
  and c.game_id='raid_shadow_legends' and c.name='Sunken Sentinel'
  and t.name='Enemy Max HP Damage' and ct.status='approved';
update champion_tags ct set status='rejected',
  source_note = coalesce(ct.source_note||' | ','') || 'Split 2026-07-21: this is MAX-HP DESTRUCTION, not %maxHP damage. A3 "For Valdemar!": "Attack all enemies. Destroys the MAX HP of all enemies by 10%." -> retagged Max HP Destruction.'
from champions c, tags t where ct.champion_id=c.id and ct.tag_id=t.id
  and c.game_id='raid_shadow_legends' and c.name='Tribune Herakletes'
  and t.name='Enemy Max HP Damage' and ct.status='approved';
update champion_tags ct set status='rejected',
  source_note = coalesce(ct.source_note||' | ','') || 'Split 2026-07-21: this is MAX-HP DESTRUCTION, not %maxHP damage. Passive "Call of the Cage": "Whenever an enemy receives damage from a [Poison] debuff placed by this Champion, also decreases their MAX HP by 5%. Cannot decrease a single Champion''s MAX HP by more than 25% in one Battle. Will not decrease Bosses MAX HP." -> retagged Max HP Destruction.'
from champions c, tags t where ct.champion_id=c.id and ct.tag_id=t.id
  and c.game_id='raid_shadow_legends' and c.name='Urost'
  and t.name='Enemy Max HP Damage' and ct.status='approved';
update champion_tags ct set status='rejected',
  source_note = coalesce(ct.source_note||' | ','') || 'Split 2026-07-21: this is MAX-HP DESTRUCTION, not %maxHP damage. A3 "Calamity Torrent": "Ignores a portion of enemy DEF, destroys a portion of MAX HP, and places [Block Damage] on self on a kill." -> retagged Max HP Destruction.'
from champions c, tags t where ct.champion_id=c.id and ct.tag_id=t.id
  and c.game_id='raid_shadow_legends' and c.name='Varl'
  and t.name='Enemy Max HP Damage' and ct.status='approved';
update champion_tags ct set status='rejected',
  source_note = coalesce(ct.source_note||' | ','') || 'Split 2026-07-21: this is MAX-HP DESTRUCTION, not %maxHP damage. A1 "Toxicity": "Destroys the target''s MAX HP by 75% of the damage inflicted if they are under a [Heal Reduction] debuff." -> retagged Max HP Destruction.'
from champions c, tags t where ct.champion_id=c.id and ct.tag_id=t.id
  and c.game_id='raid_shadow_legends' and c.name='Venomage'
  and t.name='Enemy Max HP Damage' and ct.status='approved';
update champion_tags ct set status='rejected',
  source_note = coalesce(ct.source_note||' | ','') || 'Split 2026-07-21: this is MAX-HP DESTRUCTION, not %maxHP damage. A3 "By My Hand!": "Each hit ignores 30% of the target''s DEF and destroys the enemy''s MAX HP by 25% of the damage dealt. Cannot destroy a single enemy''s MAX HP by more than 75%. If the target is a Boss, destroys MAX HP equal to 35% of the damage dealt." -> retagged Max HP Destruction.'
from champions c, tags t where ct.champion_id=c.id and ct.tag_id=t.id
  and c.game_id='raid_shadow_legends' and c.name='Vitrius'
  and t.name='Enemy Max HP Damage' and ct.status='approved';
update champion_tags ct set status='rejected',
  source_note = coalesce(ct.source_note||' | ','') || 'Split 2026-07-21: this is MAX-HP DESTRUCTION, not %maxHP damage. A1 "Thirsting Blade": "Destroys the target''s MAX HP by 30% of the damage inflicted." -> retagged Max HP Destruction.'
from champions c, tags t where ct.champion_id=c.id and ct.tag_id=t.id
  and c.game_id='raid_shadow_legends' and c.name='Vlad'
  and t.name='Enemy Max HP Damage' and ct.status='approved';

-- Edward — MIS-TAG
update champion_tags ct set status='rejected',
  source_note = coalesce(ct.source_note||' | ','') || 'Split 2026-07-21: MIS-TAG. Outright mis-tag. The source_note that justified the tag reads ''they receive additional bonus damage proportional to this Champion''s ATK... This bonus damage will ignore 100% of the target''s DEF'' — that is ATK-scaling damage with DEF-ignore, the DEF-DEPENDENT `attack` family, and the exact opposite of a %maxHP source. Nothing in his 5 skills references MAX HP.'
from champions c, tags t where ct.champion_id=c.id and ct.tag_id=t.id
  and c.game_id='raid_shadow_legends' and c.name='Edward'
  and t.name='Enemy Max HP Damage' and ct.status='approved';

-- ---------------------------------------------------------------------------
-- 2b. ADD `Max HP Destruction` (proposed) for the 38 real carriers.
-- ---------------------------------------------------------------------------
insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by)
select c.id, t.id, 'proposed', 'human_observation', 'A2 "Rolling Thunder": "If the target''s HP is equal to or higher than 50% after the first hit, destroys the target''s MAX HP by 30% of the damage inflicted instead."', 'maxhp-split-2026-07-21'
from champions c, tags t where c.game_id='raid_shadow_legends' and c.name='Alaz' and t.name='Max HP Destruction'
on conflict (champion_id, tag_id) do nothing;
insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by)
select c.id, t.id, 'proposed', 'human_observation', 'A3 "Burn Away": "Destroys each target''s MAX HP by 50% of the damage inflicted."', 'maxhp-split-2026-07-21'
from champions c, tags t where c.game_id='raid_shadow_legends' and c.name='Cagebreaker' and t.name='Max HP Destruction'
on conflict (champion_id, tag_id) do nothing;
insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by)
select c.id, t.id, 'proposed', 'human_observation', 'A1 "Necrotic Bolt": "Destroys the target''s MAX HP by 30% of the damage inflicted."', 'maxhp-split-2026-07-21'
from champions c, tags t where c.game_id='raid_shadow_legends' and c.name='Dark Elhain' and t.name='Max HP Destruction'
on conflict (champion_id, tag_id) do nothing;
insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by)
select c.id, t.id, 'proposed', 'human_observation', 'A2 "Icequake": "Each hit decreases each target''s MAX HP by 25% of the damage inflicted (stacks up to 50%)."', 'maxhp-split-2026-07-21'
from champions c, tags t where c.game_id='raid_shadow_legends' and c.name='Fjorad' and t.name='Max HP Destruction'
on conflict (champion_id, tag_id) do nothing;
insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by)
select c.id, t.id, 'proposed', 'human_observation', 'A1 "Stone Breaker": "Destroys the target''s MAX HP by 10% of the damage inflicted. The target''s MAX HP cannot be decreased by more than 50% in total."', 'maxhp-split-2026-07-21'
from champions c, tags t where c.game_id='raid_shadow_legends' and c.name='Fylja' and t.name='Max HP Destruction'
on conflict (champion_id, tag_id) do nothing;
insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by)
select c.id, t.id, 'proposed', 'human_observation', 'A3 "Earthstomp": "Decreases each target''s MAX HP by 30% of the damage inflicted."', 'maxhp-split-2026-07-21'
from champions c, tags t where c.game_id='raid_shadow_legends' and c.name='Grizzled Jarl' and t.name='Max HP Destruction'
on conflict (champion_id, tag_id) do nothing;
insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by)
select c.id, t.id, 'proposed', 'human_observation', 'A3 "Bloody Poleax": "The second hit destroys each target''s MAX HP by 10% (stacks up to 60%)."', 'maxhp-split-2026-07-21'
from champions c, tags t where c.game_id='raid_shadow_legends' and c.name='Grugtha' and t.name='Max HP Destruction'
on conflict (champion_id, tag_id) do nothing;
insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by)
select c.id, t.id, 'proposed', 'human_observation', 'A1 "Lambent Trident": "The second hit decreases 3% of the target''s ATK or DEF or destroys 3% of the target''s MAX HP, depending on their Type (stacks up to 30%). [This effect does not work against Support Type Champions.]" || Type-conditional — only the HP-Type branch destroys MAX HP.', 'maxhp-split-2026-07-21'
from champions c, tags t where c.game_id='raid_shadow_legends' and c.name='Hierophant Lazarius' and t.name='Max HP Destruction'
on conflict (champion_id, tag_id) do nothing;
insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by)
select c.id, t.id, 'proposed', 'human_observation', 'A1 "Vitality Censure": "Destroys the target''s MAX HP by 30% of the damage inflicted."', 'maxhp-split-2026-07-21'
from champions c, tags t where c.game_id='raid_shadow_legends' and c.name='Inithwe' and t.name='Max HP Destruction'
on conflict (champion_id, tag_id) do nothing;
insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by)
select c.id, t.id, 'proposed', 'human_observation', 'A1 "Gouge": "Destroys enemy MAX HP by 15% of damage dealt."', 'maxhp-split-2026-07-21'
from champions c, tags t where c.game_id='raid_shadow_legends' and c.name='Ithos' and t.name='Max HP Destruction'
on conflict (champion_id, tag_id) do nothing;
insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by)
select c.id, t.id, 'proposed', 'human_observation', 'A3 "Waste Away": "Destroys the enemy''s MAX HP by 30% of the damage inflicted if this attack is critical." || Crit-conditional (policy #4).', 'maxhp-split-2026-07-21'
from champions c, tags t where c.game_id='raid_shadow_legends' and c.name='Itinerant' and t.name='Max HP Destruction'
on conflict (champion_id, tag_id) do nothing;
insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by)
select c.id, t.id, 'proposed', 'human_observation', 'A3 "Sear Away": "Decreases the target''s MAX HP by 30% of the damage inflicted."', 'maxhp-split-2026-07-21'
from champions c, tags t where c.game_id='raid_shadow_legends' and c.name='Jotun' and t.name='Max HP Destruction'
on conflict (champion_id, tag_id) do nothing;
insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by)
select c.id, t.id, 'proposed', 'human_observation', 'A2 "Barkbreaker": "Also destroys each target''s MAX HP by 20% of the damage inflicted (stacks up to 50%)."', 'maxhp-split-2026-07-21'
from champions c, tags t where c.game_id='raid_shadow_legends' and c.name='Kawn' and t.name='Max HP Destruction'
on conflict (champion_id, tag_id) do nothing;
insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by)
select c.id, t.id, 'proposed', 'human_observation', 'A4 "Eternal Sentinel [P]": "When attacked, destroys the attacker''s MAX HP by 20% of the damage received (stacks up to 50%)." || RETALIATORY — scales off damage RECEIVED, not dealt. Fires on the enemy''s turn.', 'maxhp-split-2026-07-21'
from champions c, tags t where c.game_id='raid_shadow_legends' and c.name='Knave' and t.name='Max HP Destruction'
on conflict (champion_id, tag_id) do nothing;
insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by)
select c.id, t.id, 'proposed', 'human_observation', 'A1 "Crushing Horns": "Destroys the target''s MAX HP and fills this Champion''s Turn Meter. Both effects are doubled if the target is under a [Provoke] debuff." || Percentage NOT STATED in the stored text — needs the in-game card.', 'maxhp-split-2026-07-21'
from champions c, tags t where c.game_id='raid_shadow_legends' and c.name='Knosson' and t.name='Max HP Destruction'
on conflict (champion_id, tag_id) do nothing;
insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by)
select c.id, t.id, 'proposed', 'human_observation', 'A3 "Playdate": "Destroys the target''s MAX HP by 25% of the damage inflicted if the target has higher MAX HP than this Champion." || Stat-comparison conditional (policy #5). Her Passive 2 adds a separate 5%-of-damage destruction vs [Heal Reduction] targets.', 'maxhp-split-2026-07-21'
from champions c, tags t where c.game_id='raid_shadow_legends' and c.name='Little Miss Annie' and t.name='Max HP Destruction'
on conflict (champion_id, tag_id) do nothing;
insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by)
select c.id, t.id, 'proposed', 'human_observation', 'A1 "Shattering Blow": "Decreases the target''s MAX HP by 30% of the damage inflicted."', 'maxhp-split-2026-07-21'
from champions c, tags t where c.game_id='raid_shadow_legends' and c.name='Lonatharil' and t.name='Max HP Destruction'
on conflict (champion_id, tag_id) do nothing;
insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by)
select c.id, t.id, 'proposed', 'human_observation', 'A2 "Diminish": "Destroys the target''s MAX HP by 25% of the damage inflicted."', 'maxhp-split-2026-07-21'
from champions c, tags t where c.game_id='raid_shadow_legends' and c.name='Maiden' and t.name='Max HP Destruction'
on conflict (champion_id, tag_id) do nothing;
insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by)
select c.id, t.id, 'proposed', 'human_observation', 'A3 "Thief''s Omen": "Destroys the target''s MAX HP and decreases the target''s ATK, DEF, SPD, RES and ACC by 10%... This effect does not work against Bosses." || BOSS-DISABLED in text. Percentage not stated. Contributes ZERO in any boss content.', 'maxhp-split-2026-07-21'
from champions c, tags t where c.game_id='raid_shadow_legends' and c.name='Nais' and t.name='Max HP Destruction'
on conflict (champion_id, tag_id) do nothing;
insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by)
select c.id, t.id, 'proposed', 'human_observation', 'A2 "Violent Purification": "Before each hit, destroys the target''s MAX HP by 10% (stacks up to 50%). This effect does not work against Bosses." || BOSS-DISABLED in text. Contributes ZERO in any boss content.', 'maxhp-split-2026-07-21'
from champions c, tags t where c.game_id='raid_shadow_legends' and c.name='Onryo Ieyasu' and t.name='Max HP Destruction'
on conflict (champion_id, tag_id) do nothing;
insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by)
select c.id, t.id, 'proposed', 'human_observation', 'A2 "Heartless Curse": "Destroys the target''s MAX HP by 20% of the damage inflicted." || A3 Septic Spearhead destroys a further 30% of damage inflicted, 2 hits.', 'maxhp-split-2026-07-21'
from champions c, tags t where c.game_id='raid_shadow_legends' and c.name='Pigsticker' and t.name='Max HP Destruction'
on conflict (champion_id, tag_id) do nothing;
insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by)
select c.id, t.id, 'proposed', 'human_observation', 'A2 "Smart Disc": "Also destroys each enemy''s MAX HP by 30% of the damage dealt (stacks up to 50%)."', 'maxhp-split-2026-07-21'
from champions c, tags t where c.game_id='raid_shadow_legends' and c.name='Predator' and t.name='Max HP Destruction'
on conflict (champion_id, tag_id) do nothing;
insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by)
select c.id, t.id, 'proposed', 'human_observation', 'A3 "Humble the Heathen": "Destroys the target''s MAX HP by 20% of the damage inflicted."', 'maxhp-split-2026-07-21'
from champions c, tags t where c.game_id='raid_shadow_legends' and c.name='Purgator' and t.name='Max HP Destruction'
on conflict (champion_id, tag_id) do nothing;
insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by)
select c.id, t.id, 'proposed', 'human_observation', 'A1 "Ruination": "Destroys each target''s MAX HP by 30% of the damage inflicted."', 'maxhp-split-2026-07-21'
from champions c, tags t where c.game_id='raid_shadow_legends' and c.name='Richtoff the Bold' and t.name='Max HP Destruction'
on conflict (champion_id, tag_id) do nothing;
insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by)
select c.id, t.id, 'proposed', 'human_observation', 'A3 "Heavy Slam": "Destroys their MAX HP by 40% of the damage inflicted." || A1 Scar for Life destroys a further 30% of damage inflicted.', 'maxhp-split-2026-07-21'
from champions c, tags t where c.game_id='raid_shadow_legends' and c.name='Ripper' and t.name='Max HP Destruction'
on conflict (champion_id, tag_id) do nothing;
insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by)
select c.id, t.id, 'proposed', 'human_observation', 'A2 "Vitality Plunder": "Decreases the target''s MAX HP by 20%, then adds that HP to this Champion''s own MAX HP. Cannot decrease a single Champion''s MAX HP by more than 60% in one Battle. ... Decreases the MAX HP of Bosses by 30% of the damage inflicted instead." || BASIS SWITCHES vs Bosses: flat 20% of MAX HP normally, but 30% OF THE DAMAGE INFLICTED against Bosses. His Passive (Spurn Oblivion) is an INCOMING-damage cap on himself and is NOT the basis for any damage tag.', 'maxhp-split-2026-07-21'
from champions c, tags t where c.game_id='raid_shadow_legends' and c.name='Rotos' and t.name='Max HP Destruction'
on conflict (champion_id, tag_id) do nothing;
insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by)
select c.id, t.id, 'proposed', 'human_observation', 'A2 "Tender Meat": "Destroys the target''s MAX HP by 15% of the damage inflicted."', 'maxhp-split-2026-07-21'
from champions c, tags t where c.game_id='raid_shadow_legends' and c.name='Ruffstone' and t.name='Max HP Destruction'
on conflict (champion_id, tag_id) do nothing;
insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by)
select c.id, t.id, 'proposed', 'human_observation', 'A2 "Crowd Pleaser": "Destroys the target''s MAX HP by 30% of the damage dealt." || His Passive (Showoff) increases his damage by the percentage of MAX HP destroyed — a self-amplifier.', 'maxhp-split-2026-07-21'
from champions c, tags t where c.game_id='raid_shadow_legends' and c.name='Scrapper' and t.name='Max HP Destruction'
on conflict (champion_id, tag_id) do nothing;
insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by)
select c.id, t.id, 'proposed', 'human_observation', 'Passive "Horrific Foe [P]": "When attacked, destroys the attacker''s MAX HP by 5%. Destroys the MAX HP of Bosses by 2.5% instead (except the Scarab King, whose MAX HP will be destroyed by 0.5%). Cannot destroy a single enemy''s MAX HP by more than 50%." || RETALIATORY. Explicit halved boss value in text; 0.5% vs Scarab King.', 'maxhp-split-2026-07-21'
from champions c, tags t where c.game_id='raid_shadow_legends' and c.name='Skull Lord Var-Gall' and t.name='Max HP Destruction'
on conflict (champion_id, tag_id) do nothing;
insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by)
select c.id, t.id, 'proposed', 'human_observation', 'A2 "Volatile Mixture": "The second hit has a 75% chance of destroying each target''s MAX HP by 3% for each [Poison] and [HP Burn] debuff activated on them by this skill (stacks up to 60%)." || 75% chance; scales with the number of DoTs his first hit activates (see policy #12 Debuff Activation).', 'maxhp-split-2026-07-21'
from champions c, tags t where c.game_id='raid_shadow_legends' and c.name='Stokk' and t.name='Max HP Destruction'
on conflict (champion_id, tag_id) do nothing;
insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by)
select c.id, t.id, 'proposed', 'human_observation', 'A3 "Defender of Agaris": "Destroys the target''s MAX HP by 20% of the damage inflicted. Destroys the target''s MAX HP by 30% instead if the target is under a [Decrease DEF] debuff." || 30% instead when the target is under [Decrease DEF].', 'maxhp-split-2026-07-21'
from champions c, tags t where c.game_id='raid_shadow_legends' and c.name='Sunken Sentinel' and t.name='Max HP Destruction'
on conflict (champion_id, tag_id) do nothing;
insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by)
select c.id, t.id, 'proposed', 'human_observation', 'A3 "For Valdemar!": "Attack all enemies. Destroys the MAX HP of all enemies by 10%." || CORRECTION to the eaf9843 first pass, which called him an outright mis-tag off his A1 ALLY HEAL (''heals all allies by 20% of their MAX HP''). The A1 read was right, but his A3 is real AoE MAX-HP destruction — he is family 2, not a rejection. Attribute per SKILL, not per champion (policy #15 scope note, 2026-07-18).', 'maxhp-split-2026-07-21'
from champions c, tags t where c.game_id='raid_shadow_legends' and c.name='Tribune Herakletes' and t.name='Max HP Destruction'
on conflict (champion_id, tag_id) do nothing;
insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by)
select c.id, t.id, 'proposed', 'human_observation', 'Passive "Call of the Cage": "Whenever an enemy receives damage from a [Poison] debuff placed by this Champion, also decreases their MAX HP by 5%. Cannot decrease a single Champion''s MAX HP by more than 25% in one Battle. Will not decrease Bosses MAX HP." || BOSS-DISABLED in text. Contributes ZERO in any boss content.', 'maxhp-split-2026-07-21'
from champions c, tags t where c.game_id='raid_shadow_legends' and c.name='Urost' and t.name='Max HP Destruction'
on conflict (champion_id, tag_id) do nothing;
insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by)
select c.id, t.id, 'proposed', 'human_observation', 'A3 "Calamity Torrent": "Ignores a portion of enemy DEF, destroys a portion of MAX HP, and places [Block Damage] on self on a kill." || DATA-QUALITY FLAG: this skill_summary is PARAPHRASED, not Plarium verbatim (''a portion of''). Fails the Tier-1 source bar. Needs re-capture from the in-game Index before any percentage is trusted.', 'maxhp-split-2026-07-21'
from champions c, tags t where c.game_id='raid_shadow_legends' and c.name='Varl' and t.name='Max HP Destruction'
on conflict (champion_id, tag_id) do nothing;
insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by)
select c.id, t.id, 'proposed', 'human_observation', 'A1 "Toxicity": "Destroys the target''s MAX HP by 75% of the damage inflicted if they are under a [Heal Reduction] debuff." || Conditional on an ALLY-or-self-supplied [Heal Reduction]; Venomage does not place Heal Reduction himself.', 'maxhp-split-2026-07-21'
from champions c, tags t where c.game_id='raid_shadow_legends' and c.name='Venomage' and t.name='Max HP Destruction'
on conflict (champion_id, tag_id) do nothing;
insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by)
select c.id, t.id, 'proposed', 'human_observation', 'A3 "By My Hand!": "Each hit ignores 30% of the target''s DEF and destroys the enemy''s MAX HP by 25% of the damage dealt. Cannot destroy a single enemy''s MAX HP by more than 75%. If the target is a Boss, destroys MAX HP equal to 35% of the damage dealt." || One of the few effects that is BETTER against Bosses.', 'maxhp-split-2026-07-21'
from champions c, tags t where c.game_id='raid_shadow_legends' and c.name='Vitrius' and t.name='Max HP Destruction'
on conflict (champion_id, tag_id) do nothing;
insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by)
select c.id, t.id, 'proposed', 'human_observation', 'A1 "Thirsting Blade": "Destroys the target''s MAX HP by 30% of the damage inflicted."', 'maxhp-split-2026-07-21'
from champions c, tags t where c.game_id='raid_shadow_legends' and c.name='Vlad' and t.name='Max HP Destruction'
on conflict (champion_id, tag_id) do nothing;
insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by)
select c.id, t.id, 'proposed', 'human_observation', 'A1 "Fetid Glaive": "Destroys each target''s MAX HP by 3% (stacks up to 30%)." || The only MAX-HP-destruction carrier missed by the original tagging pass. Already carries Necrosis.', 'maxhp-split-2026-07-21'
from champions c, tags t where c.game_id='raid_shadow_legends' and c.name='Embrys' and t.name='Max HP Destruction'
on conflict (champion_id, tag_id) do nothing;

-- ---------------------------------------------------------------------------
-- 2c. ADD `Enemy Max HP Damage` (proposed) for 8 TRUE carriers the original
--     pass missed. These are what actually make the §6b cap bind.
-- ---------------------------------------------------------------------------
insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by)
select c.id, t.id, 'proposed', 'human_observation', 'A3 "Dread Invocation": "Each enemy will receive damage equal to 20% of the target enemy''s MAX HP." || LARGEST true %maxHP value in the corpus. 2x the boss cap — the single clearest case of the cap binding.', 'maxhp-split-2026-07-21'
from champions c, tags t where c.game_id='raid_shadow_legends' and c.name='Gamuran' and t.name='Enemy Max HP Damage'
on conflict (champion_id, tag_id) do nothing;
insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by)
select c.id, t.id, 'proposed', 'human_observation', 'Passive "Debilitating Force": "Whenever this Champion places a debuff, deals damage to that enemy equal to 1% of their MAX HP for each active debuff on them. This damage is capped at 10% of the enemy''s MAX HP." || Per active debuff. The skill''s OWN text caps at 10% of enemy MAX HP — a third in-text 10% ceiling.', 'maxhp-split-2026-07-21'
from champions c, tags t where c.game_id='raid_shadow_legends' and c.name='Klaazag' and t.name='Enemy Max HP Damage'
on conflict (champion_id, tag_id) do nothing;
insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by)
select c.id, t.id, 'proposed', 'human_observation', 'Passive "Engine of Murder [P]": "Whenever an enemy has their Turn Meter filled, this Champion inflicts pure damage on that enemy equal to 3% of their MAX HP for every 10% Turn Meter filled. Will inflict 6% of their MAX HP as pure damage instead, if the enemy is under a [Leech] debuff." || 3% per 10% TM filled; 6% under [Leech]. Fires off enemy TM gain, not this champion''s turn.', 'maxhp-split-2026-07-21'
from champions c, tags t where c.game_id='raid_shadow_legends' and c.name='Blood Marchioness Mina' and t.name='Enemy Max HP Damage'
on conflict (champion_id, tag_id) do nothing;
insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by)
select c.id, t.id, 'proposed', 'human_observation', 'A2 "Burning Tempest": "Each hit also deals additional pure damage to each target equal to 2% of their MAX HP for each turn remaining on all [HP Burn] debuffs on all enemies (stacks up to 15%)." || Scales off HP Burn turns remaining; self-capped at 15% — above the 10% boss cap.', 'maxhp-split-2026-07-21'
from champions c, tags t where c.game_id='raid_shadow_legends' and c.name='Cinda' and t.name='Enemy Max HP Damage'
on conflict (champion_id, tag_id) do nothing;
insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by)
select c.id, t.id, 'proposed', 'human_observation', 'Passive "Boltmaster": "If the target is not a Boss or a minion, the pure damage dealt is equal to 2% of the target''s MAX HP for each buff on this Champion (stacks up to 10%). If the target is a Boss or a minion, the pure damage dealt is equal to 3% of the target''s MAX HP." || Explicit boss branch in text — another skill that hard-codes a lower boss value.', 'maxhp-split-2026-07-21'
from champions c, tags t where c.game_id='raid_shadow_legends' and c.name='Storm Herald Hekaton' and t.name='Enemy Max HP Damage'
on conflict (champion_id, tag_id) do nothing;
insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by)
select c.id, t.id, 'proposed', 'human_observation', 'Passive "Stoneguard [P]": "When deflecting damage, on each enemy hit, has a 30% chance of dealing additional damage equal to 3% of the target''s MAX HP." || 30% chance, retaliatory (on deflect).', 'maxhp-split-2026-07-21'
from champions c, tags t where c.game_id='raid_shadow_legends' and c.name='Geomancer' and t.name='Enemy Max HP Damage'
on conflict (champion_id, tag_id) do nothing;
insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by)
select c.id, t.id, 'proposed', 'human_observation', 'A3 "Asgardian Judgment": "The damage inflicted by this skill depends on the target''s Type: ... HP/Support/Bosses - will inflict damage based on the target''s MAX HP." || Type-conditional; explicitly %maxHP against BOSSES. Percentage not stated — needs the in-game card.', 'maxhp-split-2026-07-21'
from champions c, tags t where c.game_id='raid_shadow_legends' and c.name='Odin' and t.name='Enemy Max HP Damage'
on conflict (champion_id, tag_id) do nothing;
insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by)
select c.id, t.id, 'proposed', 'human_observation', 'A3 "Big Game": "Damage increases according to enemy MAX HP." || Identical idiom to Septimus/Coldheart/Husk/Royal Guard. Percentage not stored — needs the in-game card.', 'maxhp-split-2026-07-21'
from champions c, tags t where c.game_id='raid_shadow_legends' and c.name='Steel Bowyer' and t.name='Enemy Max HP Damage'
on conflict (champion_id, tag_id) do nothing;

-- ---------------------------------------------------------------------------
-- 3. PER-SKILL EXTRACTION — the real percentages (54 skills).
--    Keyed on (champion, skill_name): verified unique across all 54 targets.
-- ---------------------------------------------------------------------------

-- F1 true %maxHP damage (tag KEPT)
update champion_skills s set maxhp_effect_kind='damage', maxhp_pct=null, maxhp_pct_basis='enemy_max_hp', maxhp_pct_boss=0.1, maxhp_pct_cap=null,
  maxhp_pct_note='If the target is a Boss, the damage inflicted is equal to 10% of their MAX HP. || BOSS-ONLY %maxHP damage; no %maxHP component vs non-boss enemies. In-text 10% boss figure — corroborates Almighty Strength.'
from champions c where s.champion_id=c.id and c.game_id='raid_shadow_legends' and c.name='Androc' and s.skill_name='Roar of Kitherus';
update champion_skills s set maxhp_effect_kind='damage', maxhp_pct=0.1, maxhp_pct_basis='enemy_max_hp', maxhp_pct_boss=null, maxhp_pct_cap=null,
  maxhp_pct_note='Damage increases according to enemy MAX HP. || champion_skills.damage_multiplier already decodes this as ''1.7 ATK + 0.1 ENEMY MAX HP formula'' -> 10%.'
from champions c where s.champion_id=c.id and c.game_id='raid_shadow_legends' and c.name='Coldheart' and s.skill_name='Heartseeker';
update champion_skills s set maxhp_effect_kind='damage', maxhp_pct=0.15, maxhp_pct_basis='enemy_max_hp', maxhp_pct_boss=null, maxhp_pct_cap=null,
  maxhp_pct_note='Then attacks all enemies inflicting damage equal to 15% of their MAX HP if the first hit kills an enemy. || Kill-conditional (policy #6 APPROVE). EXCEEDS the 10% boss cap -> the cap binds here.'
from champions c where s.champion_id=c.id and c.game_id='raid_shadow_legends' and c.name='Defiled Sinner' and s.skill_name='Ripe for Slaughter';
update champion_skills s set maxhp_effect_kind='damage', maxhp_pct=0.1, maxhp_pct_basis='enemy_max_hp', maxhp_pct_boss=null, maxhp_pct_cap=null,
  maxhp_pct_note='Damage inflicted is proportional to enemy MAX HP. || damage_multiplier = ''0.1 Enemy MAX HP formula'' -> 10%.'
from champions c where s.champion_id=c.id and c.game_id='raid_shadow_legends' and c.name='Husk' and s.skill_name='Despair';
update champion_skills s set maxhp_effect_kind='damage', maxhp_pct=0.3, maxhp_pct_basis='enemy_max_hp', maxhp_pct_boss=0.1, maxhp_pct_cap=null,
  maxhp_pct_note='If this attack kills an enemy, deals pure damage to all other enemies... equal to 30% of the initial target''s MAX HP. If the other enemies are Bosses or Minions, the pure damage is dealt equal to 10% of their MAX HP instead. || On-kill splash. The SKILL TEXT ITSELF caps at 10% vs Bosses/Minions — a second in-text 10% boss figure.'
from champions c where s.champion_id=c.id and c.game_id='raid_shadow_legends' and c.name='Kurosa' and s.skill_name='Destroyer Of All';
update champion_skills s set maxhp_effect_kind='damage', maxhp_pct=0.1, maxhp_pct_basis='enemy_max_hp', maxhp_pct_boss=null, maxhp_pct_cap=null,
  maxhp_pct_note='Each of this Champion''s skills deals additional pure damage. The amount of pure damage dealt is equal to 10% of the target''s MAX HP for each buff on them. || PER BUFF on the target and uncapped in text — 2 buffs = 20%, so this stacks past the boss cap.'
from champions c where s.champion_id=c.id and c.game_id='raid_shadow_legends' and c.name='Quintus' and s.skill_name='Percussion [P]';
update champion_skills s set maxhp_effect_kind='damage', maxhp_pct=null, maxhp_pct_basis='enemy_max_hp', maxhp_pct_boss=null, maxhp_pct_cap=null,
  maxhp_pct_note='Attacks all enemies. Damage increases according to enemy MAX HP. || Same idiom as Septimus/Coldheart/Husk but NO stored multiplier formula — percentage UNKNOWN, needs the in-game card.'
from champions c where s.champion_id=c.id and c.game_id='raid_shadow_legends' and c.name='Royal Guard' and s.skill_name='Takedown';
update champion_skills s set maxhp_effect_kind='damage', maxhp_pct=0.1, maxhp_pct_basis='enemy_max_hp', maxhp_pct_boss=null, maxhp_pct_cap=null,
  maxhp_pct_note='Damage increases according to enemy MAX HP. || damage_multiplier = ''2.5 ATK + 0.1 Enemy MAX HP formula'' -> 10%.'
from champions c where s.champion_id=c.id and c.game_id='raid_shadow_legends' and c.name='Septimus' and s.skill_name='Holy Sword';

-- F1 false negatives (tag ADDED)
update champion_skills s set maxhp_effect_kind='damage', maxhp_pct=0.2, maxhp_pct_basis='enemy_max_hp', maxhp_pct_boss=null, maxhp_pct_cap=null,
  maxhp_pct_note='Each enemy will receive damage equal to 20% of the target enemy''s MAX HP. || LARGEST true %maxHP value in the corpus. 2x the boss cap — the single clearest case of the cap binding.'
from champions c where s.champion_id=c.id and c.game_id='raid_shadow_legends' and c.name='Gamuran' and s.skill_name='Dread Invocation';
update champion_skills s set maxhp_effect_kind='damage', maxhp_pct=0.01, maxhp_pct_basis='enemy_max_hp', maxhp_pct_boss=null, maxhp_pct_cap=0.1,
  maxhp_pct_note='Whenever this Champion places a debuff, deals damage to that enemy equal to 1% of their MAX HP for each active debuff on them. This damage is capped at 10% of the enemy''s MAX HP. || Per active debuff. The skill''s OWN text caps at 10% of enemy MAX HP — a third in-text 10% ceiling.'
from champions c where s.champion_id=c.id and c.game_id='raid_shadow_legends' and c.name='Klaazag' and s.skill_name='Debilitating Force';
update champion_skills s set maxhp_effect_kind='damage', maxhp_pct=0.03, maxhp_pct_basis='enemy_max_hp', maxhp_pct_boss=null, maxhp_pct_cap=null,
  maxhp_pct_note='Whenever an enemy has their Turn Meter filled, this Champion inflicts pure damage on that enemy equal to 3% of their MAX HP for every 10% Turn Meter filled. Will inflict 6% of their MAX HP as pure damage instead, if the enemy is under a [Leech] debuff. || 3% per 10% TM filled; 6% under [Leech]. Fires off enemy TM gain, not this champion''s turn.'
from champions c where s.champion_id=c.id and c.game_id='raid_shadow_legends' and c.name='Blood Marchioness Mina' and s.skill_name='Engine of Murder [P]';
update champion_skills s set maxhp_effect_kind='damage', maxhp_pct=0.02, maxhp_pct_basis='enemy_max_hp', maxhp_pct_boss=null, maxhp_pct_cap=0.15,
  maxhp_pct_note='Each hit also deals additional pure damage to each target equal to 2% of their MAX HP for each turn remaining on all [HP Burn] debuffs on all enemies (stacks up to 15%). || Scales off HP Burn turns remaining; self-capped at 15% — above the 10% boss cap.'
from champions c where s.champion_id=c.id and c.game_id='raid_shadow_legends' and c.name='Cinda' and s.skill_name='Burning Tempest';
update champion_skills s set maxhp_effect_kind='damage', maxhp_pct=0.02, maxhp_pct_basis='enemy_max_hp', maxhp_pct_boss=0.03, maxhp_pct_cap=0.1,
  maxhp_pct_note='If the target is not a Boss or a minion, the pure damage dealt is equal to 2% of the target''s MAX HP for each buff on this Champion (stacks up to 10%). If the target is a Boss or a minion, the pure damage dealt is equal to 3% of the target''s MAX HP. || Explicit boss branch in text — another skill that hard-codes a lower boss value.'
from champions c where s.champion_id=c.id and c.game_id='raid_shadow_legends' and c.name='Storm Herald Hekaton' and s.skill_name='Boltmaster';
update champion_skills s set maxhp_effect_kind='damage', maxhp_pct=0.03, maxhp_pct_basis='enemy_max_hp', maxhp_pct_boss=null, maxhp_pct_cap=null,
  maxhp_pct_note='When deflecting damage, on each enemy hit, has a 30% chance of dealing additional damage equal to 3% of the target''s MAX HP. || 30% chance, retaliatory (on deflect).'
from champions c where s.champion_id=c.id and c.game_id='raid_shadow_legends' and c.name='Geomancer' and s.skill_name='Stoneguard [P]';
update champion_skills s set maxhp_effect_kind='damage', maxhp_pct=null, maxhp_pct_basis='enemy_max_hp', maxhp_pct_boss=null, maxhp_pct_cap=null,
  maxhp_pct_note='The damage inflicted by this skill depends on the target''s Type: ... HP/Support/Bosses - will inflict damage based on the target''s MAX HP. || Type-conditional; explicitly %maxHP against BOSSES. Percentage not stated — needs the in-game card.'
from champions c where s.champion_id=c.id and c.game_id='raid_shadow_legends' and c.name='Odin' and s.skill_name='Asgardian Judgment';
update champion_skills s set maxhp_effect_kind='damage', maxhp_pct=null, maxhp_pct_basis='enemy_max_hp', maxhp_pct_boss=null, maxhp_pct_cap=null,
  maxhp_pct_note='Damage increases according to enemy MAX HP. || Identical idiom to Septimus/Coldheart/Husk/Royal Guard. Percentage not stored — needs the in-game card.'
from champions c where s.champion_id=c.id and c.game_id='raid_shadow_legends' and c.name='Steel Bowyer' and s.skill_name='Big Game';

-- F2 MAX-HP destruction (retagged)
update champion_skills s set maxhp_effect_kind='destroy_proportional', maxhp_pct=0.3, maxhp_pct_basis='damage_inflicted', maxhp_pct_boss=null, maxhp_pct_cap=null,
  maxhp_pct_note='If the target''s HP is equal to or higher than 50% after the first hit, destroys the target''s MAX HP by 30% of the damage inflicted instead.'
from champions c where s.champion_id=c.id and c.game_id='raid_shadow_legends' and c.name='Alaz' and s.skill_name='Rolling Thunder';
update champion_skills s set maxhp_effect_kind='destroy_proportional', maxhp_pct=0.5, maxhp_pct_basis='damage_inflicted', maxhp_pct_boss=null, maxhp_pct_cap=null,
  maxhp_pct_note='Destroys each target''s MAX HP by 50% of the damage inflicted.'
from champions c where s.champion_id=c.id and c.game_id='raid_shadow_legends' and c.name='Cagebreaker' and s.skill_name='Burn Away';
update champion_skills s set maxhp_effect_kind='destroy_proportional', maxhp_pct=0.3, maxhp_pct_basis='damage_inflicted', maxhp_pct_boss=null, maxhp_pct_cap=null,
  maxhp_pct_note='Destroys the target''s MAX HP by 30% of the damage inflicted.'
from champions c where s.champion_id=c.id and c.game_id='raid_shadow_legends' and c.name='Dark Elhain' and s.skill_name='Necrotic Bolt';
update champion_skills s set maxhp_effect_kind='destroy_proportional', maxhp_pct=0.25, maxhp_pct_basis='damage_inflicted', maxhp_pct_boss=null, maxhp_pct_cap=0.5,
  maxhp_pct_note='Each hit decreases each target''s MAX HP by 25% of the damage inflicted (stacks up to 50%).'
from champions c where s.champion_id=c.id and c.game_id='raid_shadow_legends' and c.name='Fjorad' and s.skill_name='Icequake';
update champion_skills s set maxhp_effect_kind='destroy_proportional', maxhp_pct=0.1, maxhp_pct_basis='damage_inflicted', maxhp_pct_boss=null, maxhp_pct_cap=0.5,
  maxhp_pct_note='Destroys the target''s MAX HP by 10% of the damage inflicted. The target''s MAX HP cannot be decreased by more than 50% in total.'
from champions c where s.champion_id=c.id and c.game_id='raid_shadow_legends' and c.name='Fylja' and s.skill_name='Stone Breaker';
update champion_skills s set maxhp_effect_kind='destroy_proportional', maxhp_pct=0.3, maxhp_pct_basis='damage_inflicted', maxhp_pct_boss=null, maxhp_pct_cap=null,
  maxhp_pct_note='Decreases each target''s MAX HP by 30% of the damage inflicted.'
from champions c where s.champion_id=c.id and c.game_id='raid_shadow_legends' and c.name='Grizzled Jarl' and s.skill_name='Earthstomp';
update champion_skills s set maxhp_effect_kind='destroy_flat', maxhp_pct=0.1, maxhp_pct_basis='enemy_max_hp', maxhp_pct_boss=null, maxhp_pct_cap=0.6,
  maxhp_pct_note='The second hit destroys each target''s MAX HP by 10% (stacks up to 60%).'
from champions c where s.champion_id=c.id and c.game_id='raid_shadow_legends' and c.name='Grugtha' and s.skill_name='Bloody Poleax';
update champion_skills s set maxhp_effect_kind='destroy_flat', maxhp_pct=0.03, maxhp_pct_basis='enemy_max_hp', maxhp_pct_boss=null, maxhp_pct_cap=0.3,
  maxhp_pct_note='The second hit decreases 3% of the target''s ATK or DEF or destroys 3% of the target''s MAX HP, depending on their Type (stacks up to 30%). [This effect does not work against Support Type Champions.] || Type-conditional — only the HP-Type branch destroys MAX HP.'
from champions c where s.champion_id=c.id and c.game_id='raid_shadow_legends' and c.name='Hierophant Lazarius' and s.skill_name='Lambent Trident';
update champion_skills s set maxhp_effect_kind='destroy_proportional', maxhp_pct=0.3, maxhp_pct_basis='damage_inflicted', maxhp_pct_boss=null, maxhp_pct_cap=null,
  maxhp_pct_note='Destroys the target''s MAX HP by 30% of the damage inflicted.'
from champions c where s.champion_id=c.id and c.game_id='raid_shadow_legends' and c.name='Inithwe' and s.skill_name='Vitality Censure';
update champion_skills s set maxhp_effect_kind='destroy_proportional', maxhp_pct=0.15, maxhp_pct_basis='damage_inflicted', maxhp_pct_boss=null, maxhp_pct_cap=null,
  maxhp_pct_note='Destroys enemy MAX HP by 15% of damage dealt.'
from champions c where s.champion_id=c.id and c.game_id='raid_shadow_legends' and c.name='Ithos' and s.skill_name='Gouge';
update champion_skills s set maxhp_effect_kind='destroy_proportional', maxhp_pct=0.3, maxhp_pct_basis='damage_inflicted', maxhp_pct_boss=null, maxhp_pct_cap=null,
  maxhp_pct_note='Destroys the enemy''s MAX HP by 30% of the damage inflicted if this attack is critical. || Crit-conditional (policy #4).'
from champions c where s.champion_id=c.id and c.game_id='raid_shadow_legends' and c.name='Itinerant' and s.skill_name='Waste Away';
update champion_skills s set maxhp_effect_kind='destroy_proportional', maxhp_pct=0.3, maxhp_pct_basis='damage_inflicted', maxhp_pct_boss=null, maxhp_pct_cap=null,
  maxhp_pct_note='Decreases the target''s MAX HP by 30% of the damage inflicted.'
from champions c where s.champion_id=c.id and c.game_id='raid_shadow_legends' and c.name='Jotun' and s.skill_name='Sear Away';
update champion_skills s set maxhp_effect_kind='destroy_proportional', maxhp_pct=0.2, maxhp_pct_basis='damage_inflicted', maxhp_pct_boss=null, maxhp_pct_cap=0.5,
  maxhp_pct_note='Also destroys each target''s MAX HP by 20% of the damage inflicted (stacks up to 50%).'
from champions c where s.champion_id=c.id and c.game_id='raid_shadow_legends' and c.name='Kawn' and s.skill_name='Barkbreaker';
update champion_skills s set maxhp_effect_kind='destroy_proportional', maxhp_pct=0.2, maxhp_pct_basis='damage_inflicted', maxhp_pct_boss=null, maxhp_pct_cap=0.5,
  maxhp_pct_note='When attacked, destroys the attacker''s MAX HP by 20% of the damage received (stacks up to 50%). || RETALIATORY — scales off damage RECEIVED, not dealt. Fires on the enemy''s turn.'
from champions c where s.champion_id=c.id and c.game_id='raid_shadow_legends' and c.name='Knave' and s.skill_name='Eternal Sentinel [P]';
update champion_skills s set maxhp_effect_kind='destroy_flat', maxhp_pct=null, maxhp_pct_basis='enemy_max_hp', maxhp_pct_boss=null, maxhp_pct_cap=null,
  maxhp_pct_note='Destroys the target''s MAX HP and fills this Champion''s Turn Meter. Both effects are doubled if the target is under a [Provoke] debuff. || Percentage NOT STATED in the stored text — needs the in-game card.'
from champions c where s.champion_id=c.id and c.game_id='raid_shadow_legends' and c.name='Knosson' and s.skill_name='Crushing Horns';
update champion_skills s set maxhp_effect_kind='destroy_proportional', maxhp_pct=0.25, maxhp_pct_basis='damage_inflicted', maxhp_pct_boss=null, maxhp_pct_cap=null,
  maxhp_pct_note='Destroys the target''s MAX HP by 25% of the damage inflicted if the target has higher MAX HP than this Champion. || Stat-comparison conditional (policy #5). Her Passive 2 adds a separate 5%-of-damage destruction vs [Heal Reduction] targets.'
from champions c where s.champion_id=c.id and c.game_id='raid_shadow_legends' and c.name='Little Miss Annie' and s.skill_name='Playdate';
update champion_skills s set maxhp_effect_kind='destroy_proportional', maxhp_pct=0.3, maxhp_pct_basis='damage_inflicted', maxhp_pct_boss=null, maxhp_pct_cap=null,
  maxhp_pct_note='Decreases the target''s MAX HP by 30% of the damage inflicted.'
from champions c where s.champion_id=c.id and c.game_id='raid_shadow_legends' and c.name='Lonatharil' and s.skill_name='Shattering Blow';
update champion_skills s set maxhp_effect_kind='destroy_proportional', maxhp_pct=0.25, maxhp_pct_basis='damage_inflicted', maxhp_pct_boss=null, maxhp_pct_cap=null,
  maxhp_pct_note='Destroys the target''s MAX HP by 25% of the damage inflicted.'
from champions c where s.champion_id=c.id and c.game_id='raid_shadow_legends' and c.name='Maiden' and s.skill_name='Diminish';
update champion_skills s set maxhp_effect_kind='destroy_flat', maxhp_pct=null, maxhp_pct_basis='enemy_max_hp', maxhp_pct_boss=0, maxhp_pct_cap=null,
  maxhp_pct_note='Destroys the target''s MAX HP and decreases the target''s ATK, DEF, SPD, RES and ACC by 10%... This effect does not work against Bosses. || BOSS-DISABLED in text. Percentage not stated. Contributes ZERO in any boss content.'
from champions c where s.champion_id=c.id and c.game_id='raid_shadow_legends' and c.name='Nais' and s.skill_name='Thief''s Omen';
update champion_skills s set maxhp_effect_kind='destroy_flat', maxhp_pct=0.1, maxhp_pct_basis='enemy_max_hp', maxhp_pct_boss=0, maxhp_pct_cap=0.5,
  maxhp_pct_note='Before each hit, destroys the target''s MAX HP by 10% (stacks up to 50%). This effect does not work against Bosses. || BOSS-DISABLED in text. Contributes ZERO in any boss content.'
from champions c where s.champion_id=c.id and c.game_id='raid_shadow_legends' and c.name='Onryo Ieyasu' and s.skill_name='Violent Purification';
update champion_skills s set maxhp_effect_kind='destroy_proportional', maxhp_pct=0.2, maxhp_pct_basis='damage_inflicted', maxhp_pct_boss=null, maxhp_pct_cap=null,
  maxhp_pct_note='Destroys the target''s MAX HP by 20% of the damage inflicted. || A3 Septic Spearhead destroys a further 30% of damage inflicted, 2 hits.'
from champions c where s.champion_id=c.id and c.game_id='raid_shadow_legends' and c.name='Pigsticker' and s.skill_name='Heartless Curse';
update champion_skills s set maxhp_effect_kind='destroy_proportional', maxhp_pct=0.3, maxhp_pct_basis='damage_inflicted', maxhp_pct_boss=null, maxhp_pct_cap=0.5,
  maxhp_pct_note='Also destroys each enemy''s MAX HP by 30% of the damage dealt (stacks up to 50%).'
from champions c where s.champion_id=c.id and c.game_id='raid_shadow_legends' and c.name='Predator' and s.skill_name='Smart Disc';
update champion_skills s set maxhp_effect_kind='destroy_proportional', maxhp_pct=0.2, maxhp_pct_basis='damage_inflicted', maxhp_pct_boss=null, maxhp_pct_cap=null,
  maxhp_pct_note='Destroys the target''s MAX HP by 20% of the damage inflicted.'
from champions c where s.champion_id=c.id and c.game_id='raid_shadow_legends' and c.name='Purgator' and s.skill_name='Humble the Heathen';
update champion_skills s set maxhp_effect_kind='destroy_proportional', maxhp_pct=0.3, maxhp_pct_basis='damage_inflicted', maxhp_pct_boss=null, maxhp_pct_cap=null,
  maxhp_pct_note='Destroys each target''s MAX HP by 30% of the damage inflicted.'
from champions c where s.champion_id=c.id and c.game_id='raid_shadow_legends' and c.name='Richtoff the Bold' and s.skill_name='Ruination';
update champion_skills s set maxhp_effect_kind='destroy_proportional', maxhp_pct=0.4, maxhp_pct_basis='damage_inflicted', maxhp_pct_boss=null, maxhp_pct_cap=null,
  maxhp_pct_note='Destroys their MAX HP by 40% of the damage inflicted. || A1 Scar for Life destroys a further 30% of damage inflicted.'
from champions c where s.champion_id=c.id and c.game_id='raid_shadow_legends' and c.name='Ripper' and s.skill_name='Heavy Slam';
update champion_skills s set maxhp_effect_kind='destroy_flat', maxhp_pct=0.2, maxhp_pct_basis='enemy_max_hp', maxhp_pct_boss=null, maxhp_pct_cap=0.6,
  maxhp_pct_note='Decreases the target''s MAX HP by 20%, then adds that HP to this Champion''s own MAX HP. Cannot decrease a single Champion''s MAX HP by more than 60% in one Battle. ... Decreases the MAX HP of Bosses by 30% of the damage inflicted instead. || BASIS SWITCHES vs Bosses: flat 20% of MAX HP normally, but 30% OF THE DAMAGE INFLICTED against Bosses. His Passive (Spurn Oblivion) is an INCOMING-damage cap on himself and is NOT the basis for any damage tag.'
from champions c where s.champion_id=c.id and c.game_id='raid_shadow_legends' and c.name='Rotos' and s.skill_name='Vitality Plunder';
update champion_skills s set maxhp_effect_kind='destroy_proportional', maxhp_pct=0.15, maxhp_pct_basis='damage_inflicted', maxhp_pct_boss=null, maxhp_pct_cap=null,
  maxhp_pct_note='Destroys the target''s MAX HP by 15% of the damage inflicted.'
from champions c where s.champion_id=c.id and c.game_id='raid_shadow_legends' and c.name='Ruffstone' and s.skill_name='Tender Meat';
update champion_skills s set maxhp_effect_kind='destroy_proportional', maxhp_pct=0.3, maxhp_pct_basis='damage_inflicted', maxhp_pct_boss=null, maxhp_pct_cap=null,
  maxhp_pct_note='Destroys the target''s MAX HP by 30% of the damage dealt. || His Passive (Showoff) increases his damage by the percentage of MAX HP destroyed — a self-amplifier.'
from champions c where s.champion_id=c.id and c.game_id='raid_shadow_legends' and c.name='Scrapper' and s.skill_name='Crowd Pleaser';
update champion_skills s set maxhp_effect_kind='destroy_flat', maxhp_pct=0.05, maxhp_pct_basis='enemy_max_hp', maxhp_pct_boss=0.025, maxhp_pct_cap=0.5,
  maxhp_pct_note='When attacked, destroys the attacker''s MAX HP by 5%. Destroys the MAX HP of Bosses by 2.5% instead (except the Scarab King, whose MAX HP will be destroyed by 0.5%). Cannot destroy a single enemy''s MAX HP by more than 50%. || RETALIATORY. Explicit halved boss value in text; 0.5% vs Scarab King.'
from champions c where s.champion_id=c.id and c.game_id='raid_shadow_legends' and c.name='Skull Lord Var-Gall' and s.skill_name='Horrific Foe [P]';
update champion_skills s set maxhp_effect_kind='destroy_flat', maxhp_pct=0.03, maxhp_pct_basis='enemy_max_hp', maxhp_pct_boss=null, maxhp_pct_cap=0.6,
  maxhp_pct_note='The second hit has a 75% chance of destroying each target''s MAX HP by 3% for each [Poison] and [HP Burn] debuff activated on them by this skill (stacks up to 60%). || 75% chance; scales with the number of DoTs his first hit activates (see policy #12 Debuff Activation).'
from champions c where s.champion_id=c.id and c.game_id='raid_shadow_legends' and c.name='Stokk' and s.skill_name='Volatile Mixture';
update champion_skills s set maxhp_effect_kind='destroy_proportional', maxhp_pct=0.2, maxhp_pct_basis='damage_inflicted', maxhp_pct_boss=null, maxhp_pct_cap=null,
  maxhp_pct_note='Destroys the target''s MAX HP by 20% of the damage inflicted. Destroys the target''s MAX HP by 30% instead if the target is under a [Decrease DEF] debuff. || 30% instead when the target is under [Decrease DEF].'
from champions c where s.champion_id=c.id and c.game_id='raid_shadow_legends' and c.name='Sunken Sentinel' and s.skill_name='Defender of Agaris';
update champion_skills s set maxhp_effect_kind='destroy_flat', maxhp_pct=0.1, maxhp_pct_basis='enemy_max_hp', maxhp_pct_boss=null, maxhp_pct_cap=null,
  maxhp_pct_note='Attack all enemies. Destroys the MAX HP of all enemies by 10%. || CORRECTION to the eaf9843 first pass, which called him an outright mis-tag off his A1 ALLY HEAL (''heals all allies by 20% of their MAX HP''). The A1 read was right, but his A3 is real AoE MAX-HP destruction — he is family 2, not a rejection. Attribute per SKILL, not per champion (policy #15 scope note, 2026-07-18).'
from champions c where s.champion_id=c.id and c.game_id='raid_shadow_legends' and c.name='Tribune Herakletes' and s.skill_name='For Valdemar!';
update champion_skills s set maxhp_effect_kind='destroy_flat', maxhp_pct=0.05, maxhp_pct_basis='enemy_max_hp', maxhp_pct_boss=0, maxhp_pct_cap=0.25,
  maxhp_pct_note='Whenever an enemy receives damage from a [Poison] debuff placed by this Champion, also decreases their MAX HP by 5%. Cannot decrease a single Champion''s MAX HP by more than 25% in one Battle. Will not decrease Bosses MAX HP. || BOSS-DISABLED in text. Contributes ZERO in any boss content.'
from champions c where s.champion_id=c.id and c.game_id='raid_shadow_legends' and c.name='Urost' and s.skill_name='Call of the Cage';
update champion_skills s set maxhp_effect_kind='destroy_flat', maxhp_pct=null, maxhp_pct_basis='enemy_max_hp', maxhp_pct_boss=null, maxhp_pct_cap=null,
  maxhp_pct_note='Ignores a portion of enemy DEF, destroys a portion of MAX HP, and places [Block Damage] on self on a kill. || DATA-QUALITY FLAG: this skill_summary is PARAPHRASED, not Plarium verbatim (''a portion of''). Fails the Tier-1 source bar. Needs re-capture from the in-game Index before any percentage is trusted.'
from champions c where s.champion_id=c.id and c.game_id='raid_shadow_legends' and c.name='Varl' and s.skill_name='Calamity Torrent';
update champion_skills s set maxhp_effect_kind='destroy_proportional', maxhp_pct=0.75, maxhp_pct_basis='damage_inflicted', maxhp_pct_boss=null, maxhp_pct_cap=null,
  maxhp_pct_note='Destroys the target''s MAX HP by 75% of the damage inflicted if they are under a [Heal Reduction] debuff. || Conditional on an ALLY-or-self-supplied [Heal Reduction]; Venomage does not place Heal Reduction himself.'
from champions c where s.champion_id=c.id and c.game_id='raid_shadow_legends' and c.name='Venomage' and s.skill_name='Toxicity';
update champion_skills s set maxhp_effect_kind='destroy_proportional', maxhp_pct=0.25, maxhp_pct_basis='damage_inflicted', maxhp_pct_boss=0.35, maxhp_pct_cap=0.75,
  maxhp_pct_note='Each hit ignores 30% of the target''s DEF and destroys the enemy''s MAX HP by 25% of the damage dealt. Cannot destroy a single enemy''s MAX HP by more than 75%. If the target is a Boss, destroys MAX HP equal to 35% of the damage dealt. || One of the few effects that is BETTER against Bosses.'
from champions c where s.champion_id=c.id and c.game_id='raid_shadow_legends' and c.name='Vitrius' and s.skill_name='By My Hand!';
update champion_skills s set maxhp_effect_kind='destroy_proportional', maxhp_pct=0.3, maxhp_pct_basis='damage_inflicted', maxhp_pct_boss=null, maxhp_pct_cap=null,
  maxhp_pct_note='Destroys the target''s MAX HP by 30% of the damage inflicted.'
from champions c where s.champion_id=c.id and c.game_id='raid_shadow_legends' and c.name='Vlad' and s.skill_name='Thirsting Blade';

-- F2 false negative (tag ADDED)
update champion_skills s set maxhp_effect_kind='destroy_flat', maxhp_pct=0.03, maxhp_pct_basis='enemy_max_hp', maxhp_pct_boss=null, maxhp_pct_cap=0.3,
  maxhp_pct_note='Destroys each target''s MAX HP by 3% (stacks up to 30%). || The only MAX-HP-destruction carrier missed by the original tagging pass. Already carries Necrosis.'
from champions c where s.champion_id=c.id and c.game_id='raid_shadow_legends' and c.name='Embrys' and s.skill_name='Fetid Glaive';
