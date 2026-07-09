-- seeds/42_ambiguous_roles_resolved.sql
-- Role updates for the 10 ambiguous spreadsheet names (multiple DB candidates) from the
-- master roster reconciliation. Human-confirmed picks; roles from the master spreadsheet.
-- Keyed to the actual champions.name. These are NOT in update_roles_reconciled.sql
-- (they were excluded as ambiguous) — run this file as well.
--
-- 9 UPDATEs below. The 10th ambiguous name, 'Sentinel' (Rare/HP), is NOT here: both
-- 'Sunken Sentinel' and 'Sepulcher Sentinel' are distinct champions already handled by
-- their own rows, and there is no bare 'Sentinel' in the DB. It needs a seed or a
-- mis-seed fix decision (see notes) — do not force it onto a Sentinel variant.

update champions set role = 'Attack'  where name = 'Alice';     -- Alice the Wanderer (confirmed Attack, 2026-07-06)
update champions set role = 'Attack'  where name = 'Tuhak';     -- Tuhak the Wanderer
update champions set role = 'Support' where name = 'Slither';   -- Acolyte of the Slither  [corrected: NOT 'Acolyte' — that is the separate bare-Acolyte champion, already updated]
update champions set role = 'HP'      where name = 'Belletar';  -- Belletar Mage Slayer
update champions set role = 'HP'      where name = 'Bivald';    -- Bivald of the Thorn
update champions set role = 'HP'      where name = 'Boragar';   -- Boragar the Elder
update champions set role = 'Defense' where name = 'Cecilia';   -- Cecilia the Red Hope
update champions set role = 'Support' where name = 'Kerin';     -- Kerin the Harvester
update champions set role = 'Attack'  where name = 'Vitrius';   -- Vitrius the Anointed
