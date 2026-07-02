-- 2026-07-02 — champion_aliases: map alternate/short display names to the canonical
-- champion row, so TEXT sources (patch-notes scraper, future inputs) can resolve a name
-- to a champion. The core roster mapping is typeId-based and name-independent; this is
-- only for name-keyed text. game_id matches the sibling annotation-table convention.
create table if not exists champion_aliases (
  id          uuid primary key default gen_random_uuid(),
  game_id     text not null default 'raid_shadow_legends' references games(id),
  champion_id uuid not null references champions(id) on delete cascade,
  alias       text not null,
  source      text,                                   -- 'truncation' | 'gestal-audit' | 'manual'
  created_at  timestamptz not null default now()
);
-- One canonical champion per alias per game (case-insensitive).
create unique index if not exists uq_champion_aliases_alias on champion_aliases(game_id, lower(alias));
create index if not exists idx_champion_aliases_champion on champion_aliases(champion_id);
