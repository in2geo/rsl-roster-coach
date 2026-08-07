-- ============================================================================
-- 2026-08-07 — Approve the champion_tags for the 8 newly-captured champions
--
-- Flips the 71 tags landed by seeds/2026-08-07_missing_champions_tags.sql from
-- 'proposed' to 'approved' so the match engine (reads only 'approved') surfaces
-- these champions in recommendations. Scoped by proposed_by so it touches ONLY
-- this batch. Mike-approved 2026-08-07. APPLIED 2026-08-07.
-- ============================================================================
begin;

update champion_tags
  set status = 'approved',
      approved_by = 'mike-approve-2026-08-07',
      approved_at = now()
where proposed_by = 'hellhades-capture-2026-08-07'
  and status = 'proposed';

commit;
