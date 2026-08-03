-- ============================================================================
-- 213 — Register Gestal's "Hilve the Rime-called" spelling as an alias for Hilvi.
--
-- ROOT CAUSE (2026-07-31): Gestal exports this champion as "Hilve the Rime-called"
-- (with an 'e'), but the DB champion is "Hilvi" (alias "Hilvi the Rime Called",
-- with an 'i'). normalizeName strips case/spacing/punctuation but NOT the e→i
-- letter difference, so the Gestal name failed to resolve → the champion came back
-- unmatched/tagless → she was SILENTLY DROPPED from the pool (DonaHilvi's best-built
-- champion, and the only BUILT champ that fills the tempo bucket both Dragon and
-- Spider flagged at 0%). Exact silent-failure class the NAMING_ARCHITECTURE rule
-- warns about: a name miss returns zero rows and reads as "no capability".
--
-- Idempotent. In-game name is "Hilvi …"; this only adds the alternate 'Hilve …'
-- spelling Gestal emits so roster→DB name resolution succeeds.
-- ============================================================================

insert into champion_aliases (game_id, champion_id, alias, source)
select 'raid_shadow_legends', ch.id, 'Hilve the Rime-called', 'gestal_spelling'
from champions ch
where ch.game_id = 'raid_shadow_legends' and ch.name = 'Hilvi'
  and not exists (
    select 1 from champion_aliases a
    where a.champion_id = ch.id and lower(a.alias) = lower('Hilve the Rime-called'));
