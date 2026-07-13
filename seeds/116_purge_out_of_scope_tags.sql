-- ============================================================================
-- 116 - Purge out-of-scope (Common/Uncommon) champion_tags (2026-07-13).
-- The app is Rare+ only (INCLUDED_RARITIES); these tags (from seed 05) are dead
-- data and diverge from the worksheet (which excludes Common/Uncommon). Aligns
-- live with the Rare+ scope. Supersedes seed 05 for these champions.
-- 10 champs, 21 tag rows.
-- ============================================================================
delete from champion_tags where champion_id in (
  '39b3b230-9cb1-4ae7-93ab-039061553137','575c9897-f012-425b-ae6f-62094f1cb5ad','4a6e2e3f-cb85-402c-9d60-8f566ff09a5c','734c7a14-582e-4b0a-aa45-4da6d57575de','7a161cc3-2255-420d-9433-97746cba50e9','7e834c2b-7863-47b6-81b1-c11d83b1d857','b3016673-16f1-4e9e-8638-7c29bdd4703a','7c41702e-444c-43a6-888d-20fd07458dd3','26edcfbb-8f17-4a0b-9f93-3d54c3fd73aa','e7e5ec3f-89be-4752-bb0c-b35b915ca098'
);
