-- ============================================================================
-- Seed 47 — ACC Aura vocabulary tag + Venomage's aura (proposed)
-- Source: in-game champion Index AURA panel, captured verbatim from the same
-- screen recording of Venomage (Lvl 49, 6★) on 2026-07-07 that produced
-- seeds/44. source_type='in_game_index' (PRIMARY). status='proposed' — HUMAN
-- REVIEW REQUIRED; the match engine only reads status='approved' tags, so
-- nothing here changes behaviour until a human approves it. No auto-merge.
--
-- WHY THIS FILE EXISTS — the video's SKILLS are already fully captured by
-- seeds/44 (A1 Toxicity, A2 Neurotoxin, A3 Fleshmelter Venom, passive Pain
-- Writhe — all match the recording word-for-word; nothing new there). What
-- seeds/44 did NOT capture is the AURA. The in-game AURA panel reads:
--     "45  ACC  in all Battles"
-- i.e. Venomage is a leader-skill Accuracy aura: +45 flat ACC to all allies in
-- all battles. Two gaps follow from that, both fixed below:
--   (1) There is NO Accuracy aura tag in the vocabulary at all. The aura set is
--       Speed / Attack / Defense / HP (seeds/01) + RES (seeds/20). ACC is the
--       last of the six aura stats and was simply never added.
--   (2) Venomage has no aura tag assigned (seeds/44 documented her kit but
--       skipped the aura row entirely).
--
-- NAMING — 'ACC Aura', deliberately mirroring 'RES Aura' (seeds/20). ACC and
-- RES are the two additive/flat aura stats (cf. CLAUDE.md: "ACC and RES use
-- additive gear bonuses"), and RES Aura is the established precedent for the
-- 3-letter-stat abbreviation form — so 'ACC Aura' is the consistent choice, not
-- the spelled-out 'Accuracy Aura'.
--
-- MAGNITUDE/PLACEMENT — kept OFF the tag and IN the champion_tags.source_note,
-- exactly as seeds/20 prescribes for RES Aura ("magnitude/placement come from
-- the in-game Index (not stored on the tag)"). The tag is the stat+aura fact;
-- the "+45, all battles" specifics live on Venomage's row.
--
-- Auras are leader-only and content-scoped, never a placed debuff, so
-- is_debuff=false / bypasses_accuracy_check=false (ACC never gates a buff).
-- ============================================================================

-- (1) Vocabulary: ACC Aura — completes the six-stat aura set (Speed/Attack/
--     Defense/HP/RES already exist). Mirrors the seeds/20 RES Aura insert.
insert into tags (name, description, bypasses_accuracy_check, is_debuff)
values (
  'ACC Aura',
  'Increases Ally ACC by a flat amount in a specified placement (all battles, dungeons, arena, etc.). Only applies when this champion is the team leader. Value and placement confirmed from the in-game Index aura screen (not stored on the tag). Companion to RES Aura — both are additive/flat stat auras.',
  false, false
)
on conflict (name) do nothing;

-- (2) Venomage's aura: +45 flat ACC to all allies in all battles (leader skill).
--     Proposed; idempotent under the unique(champion_id, tag_id) guard.
insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by, proposed_at, ascension_required)
select ch.id, t.id, 'proposed', 'in_game_index',
       'Aura: "+45 ACC in all Battles" (leader skill). Flat +45 Accuracy to all allies, placement = all battles. Verbatim from the in-game Index AURA panel, Venomage Lvl 49 6★, same screen recording as seeds/44, captured 2026-07-07. Leader-only; applies only when Venomage leads the team. ascension_required=0 (auras are base, not ascension-gated).',
       'in-game-index-video', now(), 0
from champions ch
join tags t on t.name = 'ACC Aura'
where ch.game_id = 'raid_shadow_legends' and ch.name = 'Venomage'
  and not exists (
    select 1 from champion_tags x where x.champion_id = ch.id and x.tag_id = t.id
  );
