-- 2026-07-02 — Mythical champion "form" tagging + champion team requirements
--
-- 1. champion_form discriminator on the tag + strategy-modifier tables, so a tag or
--    dungeon override can target a Mythical champion's base form, alternate form, or
--    both. NULL = form-agnostic (applies regardless), the default for every existing row.
-- 2. champion_team_requirements — "this champion needs an ally of role X (for content Y)".
--    Proposed → human-approved like the rest of the content graph (the engine reads only
--    approved rows). Carries game_id to match its sibling annotation tables
--    (champion_strategy_modifiers / champion_ai_notes / champion_solo_profiles).

-- ── Mythical form column ─────────────────────────────────────────────────────
alter table champion_tags
  add column if not exists champion_form text
  check (champion_form in ('base', 'alternate', 'both'));

alter table champion_strategy_modifiers
  add column if not exists champion_form text
  check (champion_form in ('base', 'alternate', 'both'));

-- ── Team requirements ────────────────────────────────────────────────────────
create table if not exists champion_team_requirements (
  id              uuid primary key default gen_random_uuid(),
  game_id         text not null default 'raid_shadow_legends' references games(id),
  champion_id     uuid not null references champions(id) on delete cascade,
  dungeon_id      uuid references dungeons(id) on delete cascade,
  required_role   text not null,
  reason          text not null,
  source_note     text,
  status          text not null default 'proposed'
                  check (status in ('proposed', 'approved', 'rejected')),
  proposed_by     text,
  proposed_at     timestamptz not null default now()
);

create index if not exists idx_ctr_game     on champion_team_requirements(game_id);
create index if not exists idx_ctr_champion on champion_team_requirements(champion_id);
create index if not exists idx_ctr_dungeon  on champion_team_requirements(dungeon_id);
create index if not exists idx_ctr_role     on champion_team_requirements(required_role);
