-- ============================================================================
-- 196 — Merge the Slither / Acolyte of the Slither duplicate (data repair). ROW DELETE.
--
-- Grid-confirmed (Champions/argonites/argonite rare.png shows ONE card 'SLITHER'):
-- these are one Argonite Rare champion — short display name 'Slither', full name
-- 'Acolyte of the Slither'. The DB split it:
--   • 'Slither' (231c3451, Magic) — EMPTY (0 skills/tags/auras, hp NULL) but holds
--     the champion's PORTRAIT.
--   • 'Acolyte of the Slither' (836c01aa, Spirit) — the real kit (3 skills/8 tags/
--     1 aura, hp 17835) but NO portrait. KEPT.
-- Neither is roster-referenced. This is the Gracchos split once more (portrait on the
-- empty row, data on the other), so the portrait MUST move before the delete.
--
-- Pure dedup: keep 'Acolyte of the Slither' as-is (no rename — the short-vs-full display
-- decision is still open; resolution works via the alias either way), move the portrait
-- onto it, add 'Slither' as a shortform alias, delete the empty row.
-- Closes the last Rare+ base-stat NULL and one of the 7 missing portraits. Idempotent.
-- ============================================================================

-- 1. move the portrait from the empty Slither row onto the populated keeper
update champions kp set
  portrait_url  = ph.portrait_url,
  portrait_hash = ph.portrait_hash,
  updated_at    = now()
from champions ph
where kp.id = '836c01aa-8a28-4ba6-b8bf-faa012373762'
  and ph.id = '231c3451-0fd2-4981-9bf7-bdfcae930eae'
  and kp.portrait_url is null;

-- 2. preserve the short display name as an alias on the keeper
insert into champion_aliases (game_id, champion_id, alias, source)
select 'raid_shadow_legends','836c01aa-8a28-4ba6-b8bf-faa012373762','Slither','shortform'
where not exists (select 1 from champion_aliases a
  where a.champion_id='836c01aa-8a28-4ba6-b8bf-faa012373762' and lower(a.alias)=lower('Slither'));

-- 3. delete the empty phantom
delete from champions where id = '231c3451-0fd2-4981-9bf7-bdfcae930eae' and game_id='raid_shadow_legends';
