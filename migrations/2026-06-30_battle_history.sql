-- ============================================================================
-- Migration — battle data pipeline: battle_history + recommendation_outcomes.source
-- ============================================================================

-- recommendation_outcomes.source — specced earlier, never applied. Tags where an
-- outcome came from (e.g. 'battle_reader' for reverse-engineered battle captures
-- vs an in-app 👍/👎).
alter table recommendation_outcomes add column if not exists source text;

-- battle_history — persisted battle captures from RslBattleReader (battle-log.json).
-- profile_id is NULLABLE on purpose: battles captured before profiles existed (or
-- not yet attributed) must not break the upload.
create table if not exists battle_history (
  id               uuid primary key default gen_random_uuid(),
  profile_id       uuid references profiles(id) on delete set null,
  account_id       text,                 -- Gestal account id from the capture
  display_name     text,
  captured_at      timestamptz not null,
  dungeon          text,
  stage_number     int,
  difficulty       text,
  dungeon_stage_id uuid references dungeon_stages(id) on delete set null, -- resolved at upload; null when unresolved
  result           text,                 -- Victory / Defeat / Draw
  finish_cause     text,
  turns            int,
  heroes           jsonb,
  source           text not null default 'battle_reader',
  created_at       timestamptz not null default now(),
  unique (account_id, captured_at)        -- one row per battle (dedup key)
);

create index if not exists idx_battle_history_profile on battle_history(profile_id);
create index if not exists idx_battle_history_stage   on battle_history(dungeon_stage_id);

-- RLS: a signed-in user sees only their own profile's battles. Null-profile rows
-- are service-role-only (legacy/unattributed). Service key bypasses RLS for upload.
alter table battle_history enable row level security;
drop policy if exists battle_history_owner on battle_history;
create policy battle_history_owner on battle_history
  for all
  using      (profile_id is not null and exists (select 1 from profiles p where p.id = battle_history.profile_id and p.user_id = auth.uid()))
  with check (profile_id is not null and exists (select 1 from profiles p where p.id = battle_history.profile_id and p.user_id = auth.uid()));
