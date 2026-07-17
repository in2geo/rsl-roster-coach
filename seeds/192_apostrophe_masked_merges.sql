-- ============================================================================
-- 192 — Merge 6 apostrophe-masked phantom pairs (data repair). ROW DELETES + RENAMES.
--
-- Same class as seed 189, but these 6 evaded that word-run scan because an APOSTROPHE
-- broke the substring match. Each is an EMPTY short-name row carrying the CORRECT
-- apostrophized name, sitting beside a FULLY-POPULATED twin whose stored name had the
-- apostrophe stripped (and a title added). Confirmed 2026-07-18 via a normalized-name
-- containment scan (same faction, twin holds stats+skills+tags+aura, phantom holds
-- nothing). This is the Gracchos pattern (seed 188): correct NAME on one row, correct
-- DATA on the other.
--
-- Per pair: keep the populated twin, RENAME it to the correct apostrophized in-game
-- name, move any non-cascade content (ai_notes/strategy_modifiers/aliases) off the
-- phantom, add both spellings as searchable aliases, delete the empty phantom.
--
-- NAME provenance:
--   * Ash'nar Dragonsoul / Kro'khad the Throatripper / Packmaster Shy'ek — TIER-1
--     (Mike in-game screenshots 2026-07-18).
--   * Fren'zi the Cackler / Losan K'Leth / Krok'mar the Devourer — apostrophe inserted
--     to match the champion's own in-game SHORT name (Fren'zi confirmed in the
--     Skinwalker Epic grid; K'Leth/Krok'mar are the apostrophized short rows). If any
--     full form differs in game, adjust — the merge itself is unaffected.
--
-- The phantom's affinity is discarded (it is the garbage-default side, as in Gracchos);
-- the twin's affinity is authoritative because it carries the real kit.
-- Keyed by UUID. Idempotent: alias INSERTs NOT EXISTS-guarded; DELETE/UPDATE no-op on replay.
-- ============================================================================

-- Ash'nar (Force, empty) => keep Ashnar Dragonsoul (Force) rename-> Ash'nar Dragonsoul [Orcs/Mythical]
insert into champion_aliases (game_id, champion_id, alias, source)
 select 'raid_shadow_legends','bcaef84c-eaf3-4894-97ae-a1cc10dab6ea','Ash''nar','truncation'
 where not exists (select 1 from champion_aliases a where a.champion_id='bcaef84c-eaf3-4894-97ae-a1cc10dab6ea' and lower(a.alias)=lower('Ash''nar'));
insert into champion_aliases (game_id, champion_id, alias, source)
 select 'raid_shadow_legends','bcaef84c-eaf3-4894-97ae-a1cc10dab6ea','Ashnar Dragonsoul','spelling'
 where not exists (select 1 from champion_aliases a where a.champion_id='bcaef84c-eaf3-4894-97ae-a1cc10dab6ea' and lower(a.alias)=lower('Ashnar Dragonsoul'));
delete from champions where id='7b7e8757-0d3c-4f3d-99bd-3acfa8275355' and game_id='raid_shadow_legends';
update champions set name='Ash''nar Dragonsoul', updated_at=now() where id='bcaef84c-eaf3-4894-97ae-a1cc10dab6ea' and game_id='raid_shadow_legends';

-- Kro'khad (Void, empty) => keep Krokhad the Throatripper (Magic) rename-> Kro'khad the Throatripper [Orcs/Legendary]
insert into champion_aliases (game_id, champion_id, alias, source)
 select 'raid_shadow_legends','20e18b74-2edb-403e-8e4f-5899d868f651','Kro''khad','truncation'
 where not exists (select 1 from champion_aliases a where a.champion_id='20e18b74-2edb-403e-8e4f-5899d868f651' and lower(a.alias)=lower('Kro''khad'));
insert into champion_aliases (game_id, champion_id, alias, source)
 select 'raid_shadow_legends','20e18b74-2edb-403e-8e4f-5899d868f651','Krokhad the Throatripper','spelling'
 where not exists (select 1 from champion_aliases a where a.champion_id='20e18b74-2edb-403e-8e4f-5899d868f651' and lower(a.alias)=lower('Krokhad the Throatripper'));
delete from champions where id='26952bb5-30e7-411c-a29f-e679c9539b7b' and game_id='raid_shadow_legends';
update champions set name='Kro''khad the Throatripper', updated_at=now() where id='20e18b74-2edb-403e-8e4f-5899d868f651' and game_id='raid_shadow_legends';

-- Shy'ek (Magic, empty) => keep Packmaster Shyek (Force) rename-> Packmaster Shy'ek [Orcs/Legendary]
insert into champion_aliases (game_id, champion_id, alias, source)
 select 'raid_shadow_legends','a91a584c-68b1-48dc-809e-214eeef0cebf','Shy''ek','truncation'
 where not exists (select 1 from champion_aliases a where a.champion_id='a91a584c-68b1-48dc-809e-214eeef0cebf' and lower(a.alias)=lower('Shy''ek'));
insert into champion_aliases (game_id, champion_id, alias, source)
 select 'raid_shadow_legends','a91a584c-68b1-48dc-809e-214eeef0cebf','Packmaster Shyek','spelling'
 where not exists (select 1 from champion_aliases a where a.champion_id='a91a584c-68b1-48dc-809e-214eeef0cebf' and lower(a.alias)=lower('Packmaster Shyek'));
delete from champions where id='15ffab5b-6135-42fc-b55d-0f6136ca11c5' and game_id='raid_shadow_legends';
update champions set name='Packmaster Shy''ek', updated_at=now() where id='a91a584c-68b1-48dc-809e-214eeef0cebf' and game_id='raid_shadow_legends';

-- Fren'zi (Magic, empty) => keep Frenzi the Cackler (Void) rename-> Fren'zi the Cackler [Skinwalkers/Epic]
insert into champion_aliases (game_id, champion_id, alias, source)
 select 'raid_shadow_legends','ffa31167-a5e6-4625-b75a-5743694a7ca7','Fren''zi','truncation'
 where not exists (select 1 from champion_aliases a where a.champion_id='ffa31167-a5e6-4625-b75a-5743694a7ca7' and lower(a.alias)=lower('Fren''zi'));
insert into champion_aliases (game_id, champion_id, alias, source)
 select 'raid_shadow_legends','ffa31167-a5e6-4625-b75a-5743694a7ca7','Frenzi the Cackler','spelling'
 where not exists (select 1 from champion_aliases a where a.champion_id='ffa31167-a5e6-4625-b75a-5743694a7ca7' and lower(a.alias)=lower('Frenzi the Cackler'));
delete from champions where id='ddc90150-e774-4eea-a70c-7678e227be76' and game_id='raid_shadow_legends';
update champions set name='Fren''zi the Cackler', updated_at=now() where id='ffa31167-a5e6-4625-b75a-5743694a7ca7' and game_id='raid_shadow_legends';

-- K'Leth (Void, empty) => keep Losan KLeth (Force) rename-> Losan K'Leth [Knights Revenant/Legendary]
insert into champion_aliases (game_id, champion_id, alias, source)
 select 'raid_shadow_legends','597f0699-f70e-4842-9398-959fcbef5a38','K''Leth','truncation'
 where not exists (select 1 from champion_aliases a where a.champion_id='597f0699-f70e-4842-9398-959fcbef5a38' and lower(a.alias)=lower('K''Leth'));
insert into champion_aliases (game_id, champion_id, alias, source)
 select 'raid_shadow_legends','597f0699-f70e-4842-9398-959fcbef5a38','Losan KLeth','spelling'
 where not exists (select 1 from champion_aliases a where a.champion_id='597f0699-f70e-4842-9398-959fcbef5a38' and lower(a.alias)=lower('Losan KLeth'));
delete from champions where id='d530ede8-bc0e-4440-98ad-70d7695b78c8' and game_id='raid_shadow_legends';
update champions set name='Losan K''Leth', updated_at=now() where id='597f0699-f70e-4842-9398-959fcbef5a38' and game_id='raid_shadow_legends';

-- Krok'mar (Force, empty) => keep KrokMar the Devourer (Spirit) rename-> Krok'mar the Devourer [Lizardmen/Legendary]
insert into champion_aliases (game_id, champion_id, alias, source)
 select 'raid_shadow_legends','a6b23b96-ffc6-44a8-aca6-a04e5d9fa60c','Krok''mar','truncation'
 where not exists (select 1 from champion_aliases a where a.champion_id='a6b23b96-ffc6-44a8-aca6-a04e5d9fa60c' and lower(a.alias)=lower('Krok''mar'));
insert into champion_aliases (game_id, champion_id, alias, source)
 select 'raid_shadow_legends','a6b23b96-ffc6-44a8-aca6-a04e5d9fa60c','KrokMar the Devourer','spelling'
 where not exists (select 1 from champion_aliases a where a.champion_id='a6b23b96-ffc6-44a8-aca6-a04e5d9fa60c' and lower(a.alias)=lower('KrokMar the Devourer'));
delete from champions where id='44be1c2a-ab47-4994-bb50-b0fe13a46317' and game_id='raid_shadow_legends';
update champions set name='Krok''mar the Devourer', updated_at=now() where id='a6b23b96-ffc6-44a8-aca6-a04e5d9fa60c' and game_id='raid_shadow_legends';
