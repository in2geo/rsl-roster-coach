-- ============================================================================
-- CB reconciliation — extend run_reconciliations to the Clan Boss CHEST-TIER axis.
-- CB is graded by damage → chest tier, not by a stage floor, so the floor columns
-- don't represent it. This adds a chest axis alongside the floor axis; both are
-- nullable, so dungeon rows are completely unaffected. Additive + reversible.
--   • earned_chest    — the chest tier the key actually earned (clanBossVerdict on real damage).
--   • predicted_chest — the model's expected chest for the fielded team (null while the CB
--                       damage model is calibration-blocked — honest absence, not a guess).
-- CB reuses existing columns where they fit: successful = one-keyed the top chest;
-- actual_floor = chest-tier ordinal (Guardian=1 … Ultimate=4) for scoreboard ordering;
-- spec_margin = damage / top-chest threshold; content = "Clan Boss <difficulty>".
-- ============================================================================

alter table run_reconciliations add column if not exists earned_chest    text;
alter table run_reconciliations add column if not exists predicted_chest  text;

-- Extend the classification check to include the CB verdicts (one-keyed top vs below).
alter table run_reconciliations drop constraint if exists run_reconciliations_classification_check;
alter table run_reconciliations add constraint run_reconciliations_classification_check
  check (classification in
    ('fast_clear','grind_above_rec','overpower','on_spec','under_recommended','loss',
     'cb_one_key','cb_below_top') or classification is null);
