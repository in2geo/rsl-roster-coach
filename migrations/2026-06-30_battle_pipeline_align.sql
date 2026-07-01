-- ============================================================================
-- Align the battle-data pipeline to the formal spec (hybrid ownership).
-- Supersedes 2026-06-30_battle_history.sql.
-- ============================================================================

-- ── recommendation_outcomes.source: enforce the spec's domain ────────────────
-- Re-source the earlier 'battle_reader' rows (they'll be reprocessed) and default
-- everything else to 'player_feedback', then lock the column down.
delete from recommendation_outcomes where source = 'battle_reader';
update recommendation_outcomes set source = 'player_feedback' where source is null;
alter table recommendation_outcomes alter column source set default 'player_feedback';
alter table recommendation_outcomes alter column source set not null;
do $$ begin
  alter table recommendation_outcomes
    add constraint recommendation_outcomes_source_check
    check (source in ('player_feedback', 'battle_log'));
exception when duplicate_object then null; end $$;
alter table recommendation_outcomes add column if not exists stage_number_attempted int;

-- ── battle_history: recreate to the spec, hybrid ownership ────────────────────
-- user_id (auth) and profile_id are BOTH nullable: the battle reader captures
-- with no auth context, so battles upload unattributed and get attributed later.
-- account_id (the in-game account id) is always present and is the dedup key.
drop table if exists battle_history cascade;
create table battle_history (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid references auth.users(id) on delete cascade,      -- nullable (hybrid)
  profile_id        uuid references profiles(id)   on delete set null,      -- nullable (hybrid)
  game_id           text not null default 'raid_shadow_legends' references games(id),
  account_id        text not null,     -- in-game account id, NOT the Supabase user_id
  display_name      text,
  captured_at       timestamptz not null,
  dungeon_name      text,              -- nullable (deviation): store battles whose dungeon is unmapped
  stage_number      int,
  difficulty        text,
  result            text not null check (result in ('Victory','Defeat','Draw','Unknown')),
  turns             int,
  finish_cause      text,
  manual_skill_used boolean not null default false,
  heroes            jsonb not null,
  dungeon_stage_id  uuid references dungeon_stages(id),  -- resolved at upload; null when unseeded
  outcome_recorded  boolean not null default false,
  created_at        timestamptz not null default now()
);

alter table battle_history enable row level security;
drop policy if exists "own battles only" on battle_history;
create policy "own battles only" on battle_history
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index idx_battle_history_user on battle_history(user_id);
create index idx_battle_history_dungeon_stage
  on battle_history(dungeon_stage_id) where dungeon_stage_id is not null;
-- Dedup on (account_id, captured_at): user_id is nullable in the hybrid model and
-- NULLs are distinct in a unique index, so account_id (always present) is the
-- reliable key for both attributed and unattributed battles.
create unique index idx_battle_history_dedupe on battle_history(account_id, captured_at);
