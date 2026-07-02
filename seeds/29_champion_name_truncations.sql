-- 29 — Correct truncated champion names to the full in-game name.
-- Source: Gestal game names matched by type_id = baseTypeId (audit-champion-names.js).
-- Names only — tags / solo profiles / team requirements are keyed by champion_id, so
-- they're unaffected. Guarded so it no-ops if already corrected (and won't collide with
-- an existing full-name row). ("Elder"/2030 is intentionally NOT touched here — its
-- canonical name is still under review.)

update champions set name = 'Glorious Pallas'
where game_id = 'raid_shadow_legends' and name = 'Pallas'
  and not exists (select 1 from champions x
                  where x.game_id = 'raid_shadow_legends' and x.name = 'Glorious Pallas');

update champions set name = 'Wyrennon the Silken'
where game_id = 'raid_shadow_legends' and name = 'Wyrennon'
  and not exists (select 1 from champions x
                  where x.game_id = 'raid_shadow_legends' and x.name = 'Wyrennon the Silken');
