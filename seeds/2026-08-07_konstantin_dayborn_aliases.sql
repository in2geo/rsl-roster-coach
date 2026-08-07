-- ============================================================================
-- 2026-08-07 — Konstantin ⇄ Konstantin the Dayborn alias link
--
-- The champion's canonical champions.name is the SHORT "Konstantin" (Legendary,
-- Sacred Order, id e0eafc90-474a-4e4f-91cf-5221f9ab515b) and it had ZERO alias
-- rows. The full official Plarium name is "Konstantin the Dayborn" (Vlad the
-- Nightborn's counterpart). Today "Konstantin the Dayborn" only resolves through
-- the registry's fuzzy normalization — fragile, and it means external sources
-- that use the full name (AyumiLove, in-game Index) have no explicit bridge.
--
-- Surfaced during the bad-bulk skill-name corruption audit (2026-08-06): the
-- AyumiLove diff had to confirm DB "Konstantin" == AyumiLove "Konstantin the
-- Dayborn" (same champion — Sacred Order Legendary, Vlad-synergy fingerprint) to
-- rule out a name-collision false positive. Mike: both names must be explicit
-- aliases.
--
-- Adds BOTH names to champion_aliases (canonical too, per the request) so either
-- form resolves without relying on normalization. Idempotent (NOT EXISTS guards).
-- Apply via tools/apply-seed-pooler.mjs.
-- ============================================================================
begin;

-- full official name (the genuinely-missing bridge to external sources)
insert into champion_aliases (game_id, champion_id, alias, source)
select 'raid_shadow_legends', ch.id, 'Konstantin the Dayborn', 'longform'
from champions ch
where ch.game_id = 'raid_shadow_legends' and ch.name = 'Konstantin'
  and not exists (select 1 from champion_aliases a
    where a.champion_id = ch.id and lower(a.alias) = lower('Konstantin the Dayborn'));

-- short form (canonical name, added as an explicit alias per Mike's request)
insert into champion_aliases (game_id, champion_id, alias, source)
select 'raid_shadow_legends', ch.id, 'Konstantin', 'shortform'
from champions ch
where ch.game_id = 'raid_shadow_legends' and ch.name = 'Konstantin'
  and not exists (select 1 from champion_aliases a
    where a.champion_id = ch.id and lower(a.alias) = lower('Konstantin'));

commit;
