-- ============================================================================
-- run_reconciliations_readable — a flat, human-readable VIEW over
-- run_reconciliations for the Supabase Table Editor (live spreadsheet). Unpacks
-- the jsonb columns (team + gear tiers, fielded ✓/✗ survival, ⑤ lists,
-- account maturity) into text cells and orders columns for review.
-- ============================================================================

create or replace view run_reconciliations_readable as
select
  display_name                                    as account,
  content,
  classification,
  status,
  case when successful then 'WON' when successful is false then 'lost' end as won,
  recommended_floor                               as rec_floor,
  actual_floor,
  floor_vs_recommended                            as floor_vs_rec,
  predicted_confidence_pct                        as confidence_pct,
  duration_seconds,
  turns,
  case when team_match is not null then team_match || '/5' end as team_match,
  case when off_spec then 'YES' end               as off_spec,
  round(spec_margin::numeric, 2)                  as spec_margin,
  predicted_limiting_factor                       as predicted_limiter,
  (select string_agg((e->>'name') || '(' || coalesce(e->>'gear_tier','?') || ')', ', ')
     from jsonb_array_elements(recommended_team) e)                       as recommended_team,
  leader_name                                     as leader,
  (select string_agg((e->>'name') ||
       case when e->>'survived'='false' then '✗' when e->>'survived'='true' then '✓' else '' end, ', ')
     from jsonb_array_elements(team_fielded) e)                           as team_fielded,
  coalesce(account_maturity->>'champions','?') || 'ch ' ||
    coalesce(account_maturity->>'lvl60','?') || '@60 ' ||
    coalesce(account_maturity->>'ascensions','?') || 'asc'               as account_maturity,
  result_summary                                  as tells_us,
  (select string_agg(value, '  |  ') from jsonb_array_elements_text(confirmed_capabilities)) as what_worked,
  evidence                                        as confirm_why,
  (select string_agg(value, '  |  ') from jsonb_array_elements_text(refuted_assumptions))    as didnt_work,
  feedback_layer                                  as fix_layer,
  proposed_change,
  battle_captured_at                              as captured_at
from run_reconciliations;
