-- Per-stage boss affinity for dungeons, promoted from prose to QUERYABLE data.
--
-- WHY: every dungeon's per-stage affinity was captured (corrected 2026-07-07 from the
-- in-game stage list) but only ever stored as free text — the leading phrase of
-- dungeon_stages.notes ("Force affinity. ...") for Dragon/IG/FK, and a bare SQL comment
-- for Spider (whose rows are 3 strategy TIERS, not 25 stages). The match engine therefore
-- could not read affinity at all, so team selection and confidence ignored a first-order
-- factor (a champ weak vs the boss deals less AND takes more). Confirmed live: DonBrogni's
-- Spider Stage 11 (Force) nearly lost because both Magic champs (Brogni + Uugo) were weak.
--
-- MODEL: keyed by (dungeon, stage_number) rather than dungeon_stage_id, because Spider is
-- modeled at tier granularity (one "Stages 1-14" row) while affinity rotates every stage.
-- The engine resolves affinity by the actual stage number it is evaluating, independent of
-- which stage/tier row supplies the goals.
create table if not exists dungeon_stage_affinities (
  dungeon_id   uuid not null references dungeons(id) on delete cascade,
  stage_number int  not null,
  affinity     text not null check (affinity in ('Magic', 'Force', 'Spirit', 'Void')),
  primary key (dungeon_id, stage_number)
);

comment on table dungeon_stage_affinities is
  'Per-stage boss affinity (Magic/Force/Spirit/Void). Void = neutral to all. Rotation is '
  'irregular at high stages (20-25 break the 4-cycle), so stored explicitly, not by formula. '
  'Source: in-game stage list, corrected 2026-07-07. Seeded by seeds/130.';
