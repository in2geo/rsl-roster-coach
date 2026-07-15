-- ============================================================================
-- skill_ai_configs — auto-battle SKILL AI settings, per champion × skill × content.
-- (INS-0010) The optimal AI setting for a skill (always/never/conditional) is often
-- TEAM-dependent and encodes skill-INTERACTION knowledge not derivable from tags
-- (e.g. Xenomorph A2/A3 = never_use because they break his Perfect Veil window).
-- This is Layer 1 (annotation); the team resolver (Layer 2) reads these + reliability
-- to produce a per-team config; ai_config_used (below) closes the validation loop.
--
-- auto_reliable here is a per-CONTENT OVERRIDE; the GLOBAL default lives on
-- champion_skills.auto_reliable (fall back when this is null). Idempotent.
-- ============================================================================
create table if not exists skill_ai_configs (
  id                   uuid primary key default gen_random_uuid(),
  champion_id          uuid references champions(id) on delete cascade,
  skill_slot           text not null,                 -- A1 / A2 / A3 / A4 / Passive
  content_key          text not null,                 -- clan_boss / ice_golem / ... / 'default'
  recommended_setting  text not null default 'default'
    check (recommended_setting in ('always_use', 'never_use', 'conditional', 'default')),
  condition            text,                           -- e.g. 'only if no other Decrease DEF on team'
  priority             integer,                        -- relative firing priority among available skills
  ai_condition_notes   text,                           -- game-AI quirks ('only fires if enemy HP > 75%')
  auto_reliable        boolean,                        -- per-content override; null → champion_skills.auto_reliable
  rationale            text,                           -- why this setting (human-readable)
  validated            boolean not null default false, -- true once run data confirms
  confidence_pct       integer,                        -- pre-validation confidence
  source               text,
  created_at           timestamptz default now(),
  unique (champion_id, skill_slot, content_key)
);
create index if not exists idx_skill_ai_configs_champ_content on skill_ai_configs(champion_id, content_key);

-- Validation loop (Layer 3): the ACTUAL AI settings the player ran, so outcomes can be compared
-- across config variants for the same team. NOTE: the battle reader CANNOT read in-game AI skill
-- settings (confirmed 2026-07-15), so this is MANUAL entry — ask the player for the settings of any
-- run being validated. Low-volume (config-validation runs only), so manual is workable.
alter table run_reconciliations
  add column if not exists ai_config_used jsonb;
