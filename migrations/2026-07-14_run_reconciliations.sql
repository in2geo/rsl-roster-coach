-- ============================================================================
-- run_reconciliations — one row per captured battle, reconciling the engine's
-- PREDICTION against the captured REALITY, with derived classification + a
-- structured analysis layer. The persisted form of the feedback loop
-- (assumption-audit / battle-gaps / gap-review). Populated by
-- tools/reconcile-runs.mjs: sections ①–④ auto; ⑤ drafted by the gap-review LLM
-- and human-confirmed.
--
-- Design notes:
--  • Separate table (not bloating recommendation_outcomes / battle_history) —
--    those are at a different grain (a recommendation event / a raw capture).
--  • frozen_effective_stats is a FROZEN artifact: the stat estimate AT run time,
--    so a later gear-tier recalibration never rewrites what the model "saw".
--  • team_match gates signal quality: a run on a different team can't validate
--    the recommendation.
-- ============================================================================

create table if not exists run_reconciliations (
  id uuid primary key default gen_random_uuid(),

  -- ① identity & context (auto)
  battle_history_id  uuid references battle_history(id) on delete set null,
  account_id         text,
  display_name       text,
  content            text,          -- e.g. "Ice Golem's Peak" / "Clan Boss Nightmare"
  auto_battle        boolean,       -- = NOT manual_skill_used (auto is the target)
  account_maturity   jsonb,         -- {level, champions, lvl60, ascensions}
  reconciled_at      timestamptz not null default now(),

  -- ② prediction — engine re-run against the account's roster (auto)
  recommended_team        jsonb,    -- [{name, gear_tier}]
  leader_name             text,
  leader_skill            text,
  recommended_floor       int,
  predicted_confidence_pct int,
  verdict_band            text,
  predicted_limiting_factor text,   -- which floor/goal/carrier capped the rec
  gear_context            jsonb,    -- {account_gear, great_hall}

  -- ③ reality — from the capture (auto)
  successful           boolean,
  actual_floor         int,
  floor_vs_recommended text check (floor_vs_recommended in ('higher','same','lower') or floor_vs_recommended is null),
  duration_seconds     real,
  turns                int,
  battle_speed         real,
  team_fielded         jsonb,       -- [{name, survived, damage}]
  gestal_snapshot_ref  jsonb,       -- {account_id, last_snapshot_at}
  frozen_effective_stats jsonb,     -- FROZEN per-champ {name, gear_tier, effective_stats} at run time

  -- ④ derived reconciliation (auto)
  team_match     int check (team_match between 0 and 5 or team_match is null),  -- recommended champs that appeared
  off_spec       boolean,           -- team_match < 3 => limited signal
  spec_margin    real,              -- min(estimated/threshold)
  classification text check (classification in
    ('fast_clear','grind_above_rec','overpower','on_spec','under_recommended','loss') or classification is null),
  assumptions    jsonb,             -- {confirmed:[...], refuted:[...]}

  -- ⑤ analysis — gap-review LLM draft + human confirm (structured)
  result_summary         text,      -- "what does the result tell us?"
  confirmed_capabilities jsonb,     -- "what worked well" (tag/champ + evidence)
  evidence               text check (evidence in
    ('time','survival','damage_attribution','aggregate_proxy','none') or evidence is null),  -- "can we confirm why?"
  refuted_assumptions    jsonb,     -- "what did not work as intended"
  feedback_layer         text check (feedback_layer in
    ('structural','numeric','data_quality','none') or feedback_layer is null),  -- "how do we fix it?"
  proposed_change        text,
  status                 text not null default 'candidate'
    check (status in ('candidate','applied','rejected'))
);

-- Natural key: one reconciliation per (account, captured battle). Lets the reconciler
-- re-run and UPSERT sections ①–④ while preserving the human/LLM ⑤ analysis.
alter table run_reconciliations add column if not exists battle_captured_at timestamptz;
create unique index if not exists uq_run_recon_natural
  on run_reconciliations (account_id, battle_captured_at) where battle_captured_at is not null;

create index if not exists idx_run_recon_account   on run_reconciliations (account_id);
create index if not exists idx_run_recon_content    on run_reconciliations (content);
create index if not exists idx_run_recon_class      on run_reconciliations (classification);
create index if not exists idx_run_recon_battle     on run_reconciliations (battle_history_id);
