-- ============================================================================
-- 97 — champion_skills table. One row per champion skill (A1/A2/A3/A4/Passive,
-- per form). Source: worksheet Skills tab (Table_2). champion_id is the
-- champions.id UUID (resolved by name at seed time); skill_id is the worksheet's
-- stable "{cid}-{slot}" key. Idempotent.
-- ============================================================================
create table if not exists champion_skills (
  id                   uuid primary key default gen_random_uuid(),
  champion_id          uuid references champions(id) on delete cascade,
  skill_id             text unique,
  slot                 text,
  form                 text,
  skill_name           text,
  skill_summary        text,
  cooldown_base        text,
  cooldown_booked      text,
  damage_multiplier    text,
  multiplier_type      text,
  ascension_required   integer default 0,
  verification_status  text default 'pending',
  source               text,
  review_notes         text,
  created_at           timestamptz default now()
);
create index if not exists idx_champion_skills_champion_id on champion_skills(champion_id);
