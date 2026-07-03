-- 2026-07-02 — Clan Boss chest-tier outcome model (DDL).
--
-- CB isn't kill-or-die: success is the damage/chest tier reached. This adds:
--   1. clan_boss_chest_tiers — per-difficulty damage→chest thresholds (seeded in 26).
--   2. battle_history.total_damage_dealt — the run's total damage (from the reader;
--      currently only present on manually-backfilled rows until damage capture lands).
--   3. recommendation_outcomes.outcome CHECK widened to allow chest-tier names, so a
--      CB outcome can be stored as e.g. 'guardian' instead of 'cleared'/'failed'.

-- 1. Chest-tier thresholds ----------------------------------------------------
create table if not exists clan_boss_chest_tiers (
  id               uuid primary key default gen_random_uuid(),
  dungeon_stage_id uuid not null references dungeon_stages(id),
  chest_name       text not null,
  sort_order       int  not null,    -- 1=lowest, 4=highest per difficulty
  damage_min       bigint not null,
  damage_max       bigint,           -- null = no upper limit (top tier)
  source_citation  text,
  captured_at      date not null default current_date,
  unique (dungeon_stage_id, sort_order)
);

-- 2. Total damage on the captured battle --------------------------------------
alter table battle_history
  add column if not exists total_damage_dealt bigint;

-- 3. Allow chest-tier names in recommendation_outcomes.outcome ----------------
-- Drop whatever CHECK currently constrains `outcome`, then re-add a widened one.
do $$
declare cname text;
begin
  select tc.constraint_name into cname
  from information_schema.check_constraints cc
  join information_schema.table_constraints tc on tc.constraint_name = cc.constraint_name
  where tc.table_name = 'recommendation_outcomes'
    and cc.check_clause ilike '%outcome%'
  limit 1;
  if cname is not null then
    execute format('alter table recommendation_outcomes drop constraint %I', cname);
  end if;
end $$;

alter table recommendation_outcomes
  add constraint recommendation_outcomes_outcome_check
  check (outcome is null or outcome in (
    -- dungeon / campaign outcomes
    'cleared', 'failed', 'no_response',
    -- Clan Boss chest tiers (lowercased chest_name)
    'novice', 'adept', 'warrior', 'knight', 'guardian', 'master',
    'grandmaster', 'ultimate', 'mythical', 'divine', 'celestial', 'transcendent'
  ));
