-- 25 — Approve the champion_team_requirements rows seeded in 23 (human review step).
-- Keyed on proposed_by so it stays idempotent and re-approves any row from these
-- sources (incl. Heinrich Demondoom once that champion is added and seed 23 re-runs).
-- The engine (checkTeamRequirements) reads only status='approved' rows.

update champion_team_requirements
set status = 'approved'
where proposed_by in (
  'kit-analysis-july-2026',
  'patch-11-65-card-analysis-july-2026',
  'cobb-video-june-2026'
);
