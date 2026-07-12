-- ============================================================================
-- Clan Boss (Demon Lord) boss-side stats per difficulty, for the CB damage →
-- chest-tier estimator. The boss is NOT killable — "one-key" means reaching the
-- top chest (clan_boss_chest_tiers top bracket's damage_min), never a kill.
--
--   boss_spd  — real boss speed (AyumiLove CB recommended-stats table, 2026-07);
--               drives turn counts (how many turns your champs get per key).
--   boss_hp   — full HP pool (raid-codex). NOT a kill threshold; used only for
--               mastery %-of-max-HP damage (Warmaster / Giant Slayer).
--   damage_calibration — per-difficulty factor that ABSORBS the unpublished boss
--               DEF + affinity + average conditions. Starts at 1.0; tuned against
--               recommendation_outcomes as real chest results come in.
--   boss_def_estimate — intentionally null; boss DEF is not published anywhere
--               (folded into damage_calibration).
-- Champion-side floors (Req ACC/DEF/HP) live in stat_threshold_checks, not here.
-- Idempotent. Apply via the aws-1 pooler (tools/apply-seed-pooler.mjs).
-- ============================================================================
create table if not exists clan_boss_stats (
  dungeon_stage_id   uuid primary key references dungeon_stages(id) on delete cascade,
  difficulty         text not null,
  boss_spd           integer,
  boss_hp            bigint,
  boss_def_estimate  integer,
  damage_calibration numeric default 1.0,
  source_citation    text,
  captured_at        date
);

insert into clan_boss_stats
  (dungeon_stage_id, difficulty, boss_spd, boss_hp, boss_def_estimate, damage_calibration, source_citation, captured_at)
values
  ('3f0019cf-ff14-4fab-b239-6963135b5455', 'Easy',             90,   19020000, null, 1.0, 'boss_spd: AyumiLove CB stats table 2026-07; boss_hp: raid-codex', '2026-07-12'),
  ('2339d654-b033-474d-88dd-42180347ea3d', 'Normal',          120,   60620000, null, 1.0, 'boss_spd: AyumiLove CB stats table 2026-07; boss_hp: raid-codex', '2026-07-12'),
  ('2a4cdc2e-ad64-4a00-9571-13d946075993', 'Hard',            140,  194130000, null, 1.0, 'boss_spd: AyumiLove CB stats table 2026-07; boss_hp: raid-codex', '2026-07-12'),
  ('132d8b05-3d23-41a9-bfa3-a8f84a182892', 'Brutal',          160,  361550000, null, 1.0, 'boss_spd: AyumiLove CB stats table 2026-07; boss_hp: raid-codex', '2026-07-12'),
  ('7765b9d3-57ad-4fdf-a901-4c7888d909ec', 'Nightmare',       170,  652750000, null, 1.0, 'boss_spd: AyumiLove CB stats table 2026-07; boss_hp: raid-codex', '2026-07-12'),
  ('911270d3-32b8-49da-ab50-9b2173e15995', 'Ultra Nightmare', 190, 1171200000, null, 1.0, 'boss_spd: AyumiLove CB stats table 2026-07; boss_hp: raid-codex', '2026-07-12')
on conflict (dungeon_stage_id) do update set
  boss_spd = excluded.boss_spd, boss_hp = excluded.boss_hp,
  source_citation = excluded.source_citation, captured_at = excluded.captured_at;
