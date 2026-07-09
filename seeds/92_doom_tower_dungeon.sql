-- seeds/44_doom_tower_dungeon.sql
-- Doom Tower — Chunk 1: the dungeon row. (Scope decision 2026-07-06: Doom Tower moved
-- in-scope; see STRATEGY.md.) Permanent mode (is_event=false). Has wave phases — floors
-- run wave encounters before boss floors. The TOP boss ROTATES each cycle (Frost Spider
-- observed live 2026-07-06, ~2d8h left) — rotation is modeled at the boss-phase level in
-- later chunks, NOT here. Cursed City and Grim Forest are SEPARATE game modes / dungeons
-- (each its own tab in-game) and are NOT part of this row.
insert into dungeons (name, has_wave_phase, game_id, is_event)
select 'Doom Tower', true, 'raid_shadow_legends', false
where not exists (
  select 1 from dungeons where name = 'Doom Tower' and game_id = 'raid_shadow_legends'
);
