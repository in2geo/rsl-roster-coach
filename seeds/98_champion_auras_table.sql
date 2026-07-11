-- ============================================================================
-- 98 — champion_auras table. One row per champion aura. Source: worksheet Auras
-- tab (Table_4). champion_id is the champions.id UUID (resolved by name at seed
-- time); aura_id is the worksheet's stable key. aura_restriction holds
-- faction/affinity gating (e.g. "Void allies only"). Idempotent.
-- ============================================================================
create table if not exists champion_auras (
  id                   uuid primary key default gen_random_uuid(),
  champion_id          uuid references champions(id) on delete cascade,
  aura_id              text unique,
  aura_type            text,
  aura_value           text,
  aura_area            text,
  aura_restriction     text,
  aura_summary         text,
  verification_status  text default 'pending',
  source               text,
  review_notes         text,
  created_at           timestamptz default now()
);
create index if not exists idx_champion_auras_champion_id on champion_auras(champion_id);
