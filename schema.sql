-- ============================================================================
-- RSL Roster Coach — core schema
-- Source of truth = champions + dungeon-requirements tables (see CLAUDE.md:
-- "the AI is not the source of truth"). Every proposable fact carries a
-- review-workflow status; nothing here auto-merges.
-- ============================================================================

create extension if not exists "pgcrypto"; -- for gen_random_uuid()

-- ----------------------------------------------------------------------------
-- 1. Tag vocabulary
-- ----------------------------------------------------------------------------
-- The canonical list of role/mechanic tags (Decrease Defense, AoE Damage,
-- Cleanser, Speed Aura, Revive, Block Damage, Turn Meter Control, ...).
-- bypasses_accuracy_check covers mechanics like instant Decrease Turn Meter,
-- which skip the ACC-vs-RES roll entirely (brief, section 5).

create table tags (
  id                       uuid primary key default gen_random_uuid(),
  name                     text unique not null,
  description              text,
  bypasses_accuracy_check  boolean not null default false,
  created_at               timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 2. Champions
-- ----------------------------------------------------------------------------
-- Identity fields are read straight off a roster screenshot (Tier 1).
-- base_* fields are the Tier 2 reference point: known, fixed base stats that
-- the estimation formula scales from. These are NOT the player's actual
-- stats — see user_champions.estimated_* for that.

create table champions (
  id                          uuid primary key default gen_random_uuid(),
  name                        text not null,
  faction                     text not null,
  affinity                    text not null
                              check (affinity in ('Magic','Spirit','Force','Void')),
  rarity                      text not null
                              check (rarity in ('Common','Uncommon','Rare','Epic','Legendary')),

  base_hp                     numeric,
  base_atk                    numeric,
  base_def                    numeric,
  base_spd                    numeric,
  base_acc                    numeric,
  base_res                    numeric,
  base_stat_reference_rank    int,   -- star rank these base stats were captured at
  base_stat_reference_level   int,

  source_citation             text,  -- e.g. "in-game Index, champion detail screen"
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);

create index idx_champions_rarity on champions(rarity);

-- ----------------------------------------------------------------------------
-- 3. Champion <-> tag junction (with review workflow)
-- ----------------------------------------------------------------------------
-- Tagged from literal skill text, not "best champions" guides (CLAUDE.md).
-- source_type='human_observation' is reserved for judgment calls that can't
-- be read off a primary source (e.g. "this counts as a soft Decrease Defense
-- substitute") — source_note holds the human's OWN paraphrase, never a
-- scraped/transcribed quote.

create table champion_tags (
  id            uuid primary key default gen_random_uuid(),
  champion_id   uuid not null references champions(id) on delete cascade,
  tag_id        uuid not null references tags(id) on delete cascade,

  status        text not null default 'proposed'
                check (status in ('proposed','approved','rejected')),
  source_type   text not null
                check (source_type in ('in_game_index','patch_notes','fandom_wiki','human_observation')),
  source_note   text,

  proposed_by   text,
  proposed_at   timestamptz not null default now(),
  approved_by   text,
  approved_at   timestamptz,

  unique (champion_id, tag_id)
);

create index idx_champion_tags_champion on champion_tags(champion_id);
create index idx_champion_tags_tag on champion_tags(tag_id);
create index idx_champion_tags_status on champion_tags(status);

-- ----------------------------------------------------------------------------
-- 4. Dungeons, stages, phases
-- ----------------------------------------------------------------------------
-- has_wave_phase = false for Spider's Den / Clan Boss (straight to boss).
-- has_wave_phase = true for Dragon's Lair / Fire Knight / Ice Golem.

create table dungeons (
  id              uuid primary key default gen_random_uuid(),
  name            text unique not null,
  has_wave_phase  boolean not null default false
);

-- A specific stage or difficulty tier within a dungeon.
create table dungeon_stages (
  id           uuid primary key default gen_random_uuid(),
  dungeon_id   uuid not null references dungeons(id) on delete cascade,
  stage_number int,            -- null for e.g. Clan Boss difficulty tiers
  label        text not null,  -- "Stage 9", "Hard"
  notes        text,
  unique (dungeon_id, label)
);

-- One row per phase that actually exists for that stage. Dungeons with no
-- wave/boss split get a single 'single' row, not a fake 'wave' row.
create table phases (
  id                 uuid primary key default gen_random_uuid(),
  dungeon_stage_id   uuid not null references dungeon_stages(id) on delete cascade,
  phase_type         text not null check (phase_type in ('wave','boss','single')),
  notes              text,
  unique (dungeon_stage_id, phase_type)
);

create index idx_phases_stage on phases(dungeon_stage_id);

-- ----------------------------------------------------------------------------
-- 5. Goals and goal solutions (the heart of the requirements table)
-- ----------------------------------------------------------------------------
-- A goal is satisfied by ANY of its solutions (OR). A solution is satisfied
-- only if ALL of its tags are present on the team (AND), via goal_solution_tags.
--
-- Example — Spider's Den, single phase, from the brief:
--   goal: "prevent the wave from dealing sustained damage before you clear it"
--     solution A: AoE Decrease Defense + AoE Damage   (2 tags, AND)
--     solution B: AoE Stun/Freeze/Daze                (1 tag)
--     solution C: AoE Decrease Turn Meter              (1 tag)

create table goals (
  id             uuid primary key default gen_random_uuid(),
  phase_id       uuid not null references phases(id) on delete cascade,
  description    text not null,
  is_informational boolean not null default false,
  -- true for goals that aren't solved by a tag-OR-of-ANDs at all (e.g.
  -- "don't fall behind the enemy's speed") and are instead evaluated via
  -- stat_threshold_checks below. When true, this goal has no rows in
  -- goal_solutions.
  created_at     timestamptz not null default now()
);

create index idx_goals_phase on goals(phase_id);

create table goal_solutions (
  id             uuid primary key default gen_random_uuid(),
  goal_id        uuid not null references goals(id) on delete cascade,
  label          text,  -- human-readable, e.g. "AoE Decrease Defense + AoE Damage"

  status         text not null default 'proposed'
                 check (status in ('proposed','approved','rejected')),
  source_type    text not null
                 check (source_type in ('in_game_index','patch_notes','fandom_wiki','human_observation')),
  source_note    text,

  proposed_by    text,
  proposed_at    timestamptz not null default now(),
  approved_by    text,
  approved_at    timestamptz
);

create index idx_goal_solutions_goal on goal_solutions(goal_id);
create index idx_goal_solutions_status on goal_solutions(status);

create table goal_solution_tags (
  id                uuid primary key default gen_random_uuid(),
  goal_solution_id  uuid not null references goal_solutions(id) on delete cascade,
  tag_id            uuid not null references tags(id) on delete cascade,
  unique (goal_solution_id, tag_id)
);

create index idx_gst_solution on goal_solution_tags(goal_solution_id);
create index idx_gst_tag on goal_solution_tags(tag_id);

-- ----------------------------------------------------------------------------
-- 6. Stat-threshold checks (speed, accuracy formulas — not tag-based)
-- ----------------------------------------------------------------------------
-- Covers: "speed matters independently of any tag", and known formulaic
-- thresholds like Spider's Den accuracy needed ≈ stage * 11. formula is a
-- small expression string the matching engine evaluates against stage_number.

create table stat_threshold_checks (
  id          uuid primary key default gen_random_uuid(),
  phase_id    uuid not null references phases(id) on delete cascade,
  goal_id     uuid references goals(id) on delete cascade, -- nullable: not every check ties to a named goal
  stat        text not null check (stat in ('spd','acc','res')),
  comparison  text not null check (comparison in ('relative_to_enemy','formula')),
  formula     text,  -- e.g. 'stage * 11', null when comparison = 'relative_to_enemy'
  notes       text
);

create index idx_stc_phase on stat_threshold_checks(phase_id);

-- ----------------------------------------------------------------------------
-- 7. Hardcoded boss exceptions
-- ----------------------------------------------------------------------------
-- e.g. Hydra's unresistable Mark, Max-HP-damage caps on bosses at high
-- stages that don't apply to wave enemies. Free-text by design — these are
-- one-off carve-outs, not a pattern worth normalizing further at MVP scope.

create table boss_exceptions (
  id                uuid primary key default gen_random_uuid(),
  dungeon_stage_id  uuid not null references dungeon_stages(id) on delete cascade,
  description       text not null,
  source_citation   text
);

-- ----------------------------------------------------------------------------
-- 8. Explanation style notes (separate from matching-engine rules)
-- ----------------------------------------------------------------------------
-- Per CLAUDE.md/brief section 6: judgment synthesized from watching
-- account-review content produces TWO separate outputs. This table is the
-- second one — how the AI should phrase explanations — kept deliberately
-- apart from goal_solutions, which is the matching engine's input.

create table explanation_style_notes (
  id          uuid primary key default gen_random_uuid(),
  topic       text not null,  -- e.g. "substituting Freeze for Decrease Defense"
  note        text not null,  -- the human's own-words observation
  created_at  timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 9. User rosters (Tier 1 + cached Tier 2 estimate + optional Tier 2 verified)
-- ----------------------------------------------------------------------------

create table user_champions (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  champion_id         uuid not null references champions(id),

  -- Tier 1: read directly off the roster screenshot
  level               int not null,
  stars               int not null,
  source_screenshot_id uuid,

  -- Tier 2: estimated from Tier 1 via base-stat + scaling formula.
  -- Reliability degrades as gear accumulates (brief, section 5) — treat as
  -- a triage signal, not ground truth.
  estimated_hp        numeric,
  estimated_atk       numeric,
  estimated_def       numeric,
  estimated_spd       numeric,
  estimated_acc       numeric,
  estimated_res       numeric,
  estimated_at        timestamptz,

  -- Tier 2 verified: only populated when the player submits an actual
  -- stat-page screenshot for failure diagnosis. Kept separate from the
  -- estimate so the matching engine always knows which one it's looking at.
  verified_stats      jsonb,
  verified_at         timestamptz,

  created_at          timestamptz not null default now(),
  unique (user_id, champion_id)
);

create index idx_user_champions_user on user_champions(user_id);
create index idx_user_champions_champion on user_champions(champion_id);

-- ----------------------------------------------------------------------------
-- 10. QA view — tag coverage by rarity
-- ----------------------------------------------------------------------------
-- "Periodically check tag coverage BY RARITY ... low coverage at low
-- rarities is the blind spot that breaks fallback logic silently." (brief)

create view tag_coverage_by_rarity as
select
  c.rarity,
  count(distinct c.id) as total_champions,
  count(distinct ct.champion_id)
    filter (where ct.status = 'approved') as champions_with_at_least_one_tag,
  round(
    100.0 * count(distinct ct.champion_id) filter (where ct.status = 'approved')
    / nullif(count(distinct c.id), 0),
    1
  ) as pct_tagged
from champions c
left join champion_tags ct on ct.champion_id = c.id
group by c.rarity
order by
  case c.rarity
    when 'Common' then 1 when 'Uncommon' then 2 when 'Rare' then 3
    when 'Epic' then 4 when 'Legendary' then 5
  end;

-- ----------------------------------------------------------------------------
-- Notes on Row Level Security (Supabase)
-- ----------------------------------------------------------------------------
-- champions / tags / champion_tags / dungeons / dungeon_stages / phases /
--   goals / goal_solutions / goal_solution_tags / stat_threshold_checks /
--   boss_exceptions / explanation_style_notes / tag_coverage_by_rarity
--   -> reference data. Public read, no public write (writes happen via a
--      service-role admin path that enforces the proposed->approved gate).
-- user_champions
--   -> enable RLS, policy: user can only select/insert/update rows where
--      user_id = auth.uid().
--
-- e.g.:
--   alter table user_champions enable row level security;
--   create policy "own roster only" on user_champions
--     for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
