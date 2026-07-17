-- ============================================================================
-- 194 — Consolidate the champion name registry: add every genuinely-different name
-- form as a champion_aliases row so ANY name (long / short / spelling) resolves to
-- champions.id. Punctuation/spacing/case variants are handled by normalizeName() in
-- code (lib/champion-names.js) and need NO row here — this adds only forms whose
-- NORMALIZED key still differs (mostly worksheet long-names vs the DB short name).
--
-- Generated 2026-07-18 from the worksheet↔DB reconciliation + known Gestal spellings.
-- Each row skipped if it already resolves or would collide with another champion.
-- UUID-keyed, NOT EXISTS-guarded, idempotent. 2 rows.
-- ============================================================================
insert into champion_aliases (game_id, champion_id, alias, source)
 select 'raid_shadow_legends','60f6d582-c79a-42f5-8886-133281f18b24','Alexandr the Sharpshooter','spelling'
 where not exists (select 1 from champion_aliases a where a.champion_id='60f6d582-c79a-42f5-8886-133281f18b24' and lower(a.alias)=lower('Alexandr the Sharpshooter'));
insert into champion_aliases (game_id, champion_id, alias, source)
 select 'raid_shadow_legends','3f59adc1-a67c-49e3-a3d0-fffbcc3a2aa1','Ronda the Rowdy','spelling'
 where not exists (select 1 from champion_aliases a where a.champion_id='3f59adc1-a67c-49e3-a3d0-fffbcc3a2aa1' and lower(a.alias)=lower('Ronda the Rowdy'));
