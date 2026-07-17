-- ============================================================================
-- Seed 145 — BLANKET APPROVAL: all proposed champion_tags + champion_solo_profiles
--
-- AUTHORITY: Mike, "approve all" (2026-07-16). This is the human-review gate the
-- project rule requires ("No auto-merge" / "reviewed and approved by a human").
-- Recorded as a seed rather than a direct UPDATE because status IS content and
-- the hard rule is that the DB must be reconstructable from committed seeds.
--
-- SCOPE (measured live 2026-07-16, immediately before writing):
--   champion_tags           896 proposed -> approved   (4,525 already approved)
--   champion_solo_profiles   36 proposed -> approved   (11 already approved)
--   goal_solutions            0 proposed               (nothing to do)
--   REJECTED rows are NOT touched — 188 tag + 0 solo rejections stay rejected.
--   Verified: 0 proposed tags on Common/Uncommon champions (Rare+ scope rule holds).
--
-- WHAT THIS UNBLOCKS: the engine reads approved-only. Until now checkSoloCarries
-- could not surface Michelangelo (Dragon 20), Venomage (Ice Golem 20) or Drexthar
-- (Spider 20, seed 143) because every one was proposed — the app under-called
-- Dragon at Stage 4 for an account that solos Stage 20.
--
-- PROVENANCE OF THE 896 (they are NOT all from this session — "all" is broad):
--    380  aoe-damage-backfill-2026-07-16          seed 142 (Mike human-reviewed 141 -> 142)
--    251  multihit-backfill-2026-07-16            seeds 137/139
--    120  tag-enrich-2026-07-15                   seed 136
--    102  raid-guide-scraper                      PRE-DATES this session
--     32  claude-code-policy12-activation-2026-07-16   seed 144 (generated TODAY)
--      5  ayumilove-human-read-july-2026
--      3  fk-mechanic-model-2026-07-16
--      2  mikey-damage-tags-2026-07-16            seed 140
--      1  player-skill-text-2026-07-14
--
-- ⚠ THREE BUCKETS THAT GO LIVE WITHOUT AN INDIVIDUAL READ — flagged, not blocked:
--   1. 39 rows whose source_note carries an explicit REVIEWER flag ("also places
--      Poison/HP Burn — verify the hit is real damage, cf. Frozen Banshee"). The
--      flag exists precisely to ask for a per-row look; blanket approval answers
--      it with "yes" for all 39 at once.
--   2. 32 activation tags authored by Claude TODAY (seed 144). Generated from live
--      skill_summary and machine-checked, but never human-read row by row.
--   3. 102 raid-guide-scraper rows that predate this session and were previously
--      held pending advisor review ([[raidguide-scrape-2026-07-09]]).
--
-- REVERSIBLE: approved_by is stamped 'mike-blanket-approval-2026-07-16', so any
-- bucket can be walked back precisely:
--   update champion_tags set status='proposed', approved_by=null, approved_at=null
--   where approved_by='mike-blanket-approval-2026-07-16'
--     and proposed_by='claude-code-policy12-activation-2026-07-16';
--
-- REPLAY-SAFE: the WHERE clause is status='proposed', so re-running is a no-op.
-- ============================================================================

-- ── champion_tags: proposed -> approved (Rare+ only; defensive, already verified 0) ──
update champion_tags ct
set status      = 'approved',
    approved_by = 'mike-blanket-approval-2026-07-16',
    approved_at = now()
where ct.status = 'proposed'
  and exists (
    select 1 from champions c
    where c.id = ct.champion_id
      and c.game_id = 'raid_shadow_legends'
      and c.rarity not in ('Common', 'Uncommon')
  );

-- ── champion_solo_profiles: proposed -> approved ────────────────────────────
-- This is the half that changes recommendations TODAY: solo carries are checked
-- before team building, and every real carrier on this account was proposed.
update champion_solo_profiles
set status      = 'approved',
    approved_by = 'mike-blanket-approval-2026-07-16',
    approved_at = now()
where status = 'proposed';
