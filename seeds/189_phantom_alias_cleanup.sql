-- ============================================================================
-- 189 — Phantom-alias cleanup batch (65 merges). CONTAINS ROW DELETES.
--
-- Follows the Gracchos pilot (seed 188). Each row here is a short-name STUB with NO
-- payload (no base stats, skills, tags, or aura) sitting beside a populated
-- full-name row of the SAME champion (e.g. 'Othorion' beside 'Wallmaster Othorion').
-- Mike's ruling 2026-07-17: "those are all aliases." Per stub: add the short name as
-- a searchable alias on the real keeper, then delete the empty stub.
--
-- SAFETY (generator tools/../gen-phantom-batch.mjs, verified against live):
--   * discriminator is PAYLOAD, not name shape — every stub here has 0 skills/0 tags/
--     0 auras/0 stats (the word-run heuristic alone is WRONG on 13/80, incl. the 4
--     starters, which all carry payload and are NOT in this set).
--   * keeper must be a DIFFERENT row that shares FACTION + RARITY and has base_hp
--     (a fuller-name form is the same champion). Exactly one such keeper, else FLAGGED.
--   * everything keyed by UUID. Idempotent: alias INSERTs are NOT EXISTS-guarded;
--     DELETEs no-op on replay once the stub is gone.
--   * Adelyn included as a plain phantom: its 5 tags are 4 duplicates of the keeper's
--     + 1 anomalous 'ACC Aura' tag (92 aura-holders carry NO such tag); keeper
--     'Chronicler Adelyn' already holds the ACC aura in champion_auras. No tag flip.
--   * EXCLUDED (real champions, NOT phantoms — separate capture task): the 9 empty
--     shells (Ash'nar, Fimo, Fren'zi, Jorad Wolfhart, K'Leth, Kro'khad, Krok'mar,
--     Nson, Shy'ek) — all corroborated real by the worksheet DB_Champions tab.
--   * FLAGGED by the generator, NOT included here: Slither
-- ============================================================================

-- Step 0: move non-cascade content OFF the doomed stubs onto their keepers
-- (these stubs are empty of skills/tags/auras but carry rows here). Keepers verified
-- to have NO existing rows in these tables, so no duplicate-key risk.
update champion_strategy_modifiers set champion_id='bcf948cb-ef87-4a46-b5ed-ac5e296548e4' where champion_id='604f2a9c-5618-4af4-b05e-4b86b18c8516'; -- Wixwell -> Vault Keeper Wixwell
update champion_ai_notes set champion_id='e367d6c7-30c5-4991-95f9-b57130c7b22d' where champion_id='77e76f49-e47d-45e1-a0a0-91062b1ad2e0'; -- Adelyn -> Chronicler Adelyn

-- Ankora -> Wight Queen Ankora [Knights Revenant/Legendary]
insert into champion_aliases (game_id, champion_id, alias, source)
select 'raid_shadow_legends', '1eed375c-b9a6-45f2-95c7-545559efea5b', 'Ankora', 'truncation'
where not exists (select 1 from champion_aliases a where a.champion_id='1eed375c-b9a6-45f2-95c7-545559efea5b' and lower(a.alias)=lower('Ankora'));
delete from champions where id='1ed2d478-3b67-4fcc-8e79-c8eb95d34a31' and game_id='raid_shadow_legends';

-- Artor -> Iudex Artor [Sacred Order/Legendary] (affinity differs: stub Force vs keeper Spirit)
insert into champion_aliases (game_id, champion_id, alias, source)
select 'raid_shadow_legends', 'd1d50cc9-2da8-4138-bad6-7e05c2a536f9', 'Artor', 'truncation'
where not exists (select 1 from champion_aliases a where a.champion_id='d1d50cc9-2da8-4138-bad6-7e05c2a536f9' and lower(a.alias)=lower('Artor'));
delete from champions where id='7cbde62d-b042-464c-8491-ce90f4e2cd12' and game_id='raid_shadow_legends';

-- Augustin -> Pontiff Augustin [Knights Revenant/Legendary] (affinity differs: stub Force vs keeper Void)
insert into champion_aliases (game_id, champion_id, alias, source)
select 'raid_shadow_legends', 'af36750e-4916-4543-b669-ea1b80e373f4', 'Augustin', 'truncation'
where not exists (select 1 from champion_aliases a where a.champion_id='af36750e-4916-4543-b669-ea1b80e373f4' and lower(a.alias)=lower('Augustin'));
delete from champions where id='6b55173b-778c-4867-ba7f-2cb542486657' and game_id='raid_shadow_legends';

-- Blacktusk -> Admiral Blacktusk [Dwarves/Legendary] (affinity differs: stub Force vs keeper Spirit)
insert into champion_aliases (game_id, champion_id, alias, source)
select 'raid_shadow_legends', 'ccb6bf0b-43f0-4bab-98f9-627ea623749e', 'Blacktusk', 'truncation'
where not exists (select 1 from champion_aliases a where a.champion_id='ccb6bf0b-43f0-4bab-98f9-627ea623749e' and lower(a.alias)=lower('Blacktusk'));
delete from champions where id='b9f29a07-b577-4e0b-8689-5a7bbe358182' and game_id='raid_shadow_legends';

-- Boorn -> Hidestitcher Boorn [Skinwalkers/Rare] (affinity differs: stub Force vs keeper Magic)
insert into champion_aliases (game_id, champion_id, alias, source)
select 'raid_shadow_legends', 'd24cb41a-9ef4-4a8a-87cd-9f29c204eff5', 'Boorn', 'truncation'
where not exists (select 1 from champion_aliases a where a.champion_id='d24cb41a-9ef4-4a8a-87cd-9f29c204eff5' and lower(a.alias)=lower('Boorn'));
delete from champions where id='1559bcb3-b7d7-4cdc-bae0-4f90c0570507' and game_id='raid_shadow_legends';

-- Cait -> Pathfinder Cait [Sylvan Watchers/Rare]
insert into champion_aliases (game_id, champion_id, alias, source)
select 'raid_shadow_legends', '68208c87-65c1-498c-8434-434bef86a3a4', 'Cait', 'truncation'
where not exists (select 1 from champion_aliases a where a.champion_id='68208c87-65c1-498c-8434-434bef86a3a4' and lower(a.alias)=lower('Cait'));
delete from champions where id='76ed0841-7243-47c2-812e-5870abd6f9d9' and game_id='raid_shadow_legends';

-- Caldor -> Bladechorister Caldor [Sylvan Watchers/Legendary] (affinity differs: stub Magic vs keeper Spirit)
insert into champion_aliases (game_id, champion_id, alias, source)
select 'raid_shadow_legends', '6b45498c-3b72-450e-ac9d-76bc873ac411', 'Caldor', 'truncation'
where not exists (select 1 from champion_aliases a where a.champion_id='6b45498c-3b72-450e-ac9d-76bc873ac411' and lower(a.alias)=lower('Caldor'));
delete from champions where id='53dd96dd-0ce3-4d7e-b682-8321c9ed01dc' and game_id='raid_shadow_legends';

-- Cithrel -> Glensage Cithrel [Sylvan Watchers/Rare] (affinity differs: stub Force vs keeper Void)
insert into champion_aliases (game_id, champion_id, alias, source)
select 'raid_shadow_legends', '09e530d2-2652-41c9-9b0d-5e2e828b779a', 'Cithrel', 'truncation'
where not exists (select 1 from champion_aliases a where a.champion_id='09e530d2-2652-41c9-9b0d-5e2e828b779a' and lower(a.alias)=lower('Cithrel'));
delete from champions where id='fe69d605-f2e0-4afb-a243-d3be19148a61' and game_id='raid_shadow_legends';

-- Colwyn -> Tribuck Colwyn [Sylvan Watchers/Rare]
insert into champion_aliases (game_id, champion_id, alias, source)
select 'raid_shadow_legends', '697fc243-40df-4d25-a6b5-511ac67d9a1a', 'Colwyn', 'truncation'
where not exists (select 1 from champion_aliases a where a.champion_id='697fc243-40df-4d25-a6b5-511ac67d9a1a' and lower(a.alias)=lower('Colwyn'));
delete from champions where id='1b1f8a79-8fb5-428a-9a1d-dbc9a2b406f9' and game_id='raid_shadow_legends';

-- Daithi -> Mistrider Daithi [Sylvan Watchers/Epic] (affinity differs: stub Void vs keeper Force)
insert into champion_aliases (game_id, champion_id, alias, source)
select 'raid_shadow_legends', 'ccf19498-0d1f-4705-99ad-834b9e1c5f55', 'Daithi', 'truncation'
where not exists (select 1 from champion_aliases a where a.champion_id='ccf19498-0d1f-4705-99ad-834b9e1c5f55' and lower(a.alias)=lower('Daithi'));
delete from champions where id='15f756ce-ecc6-4d5f-a957-b9b1a88a25fa' and game_id='raid_shadow_legends';

-- Dexikos -> Tidemaster Dexikos [Argonites/Epic] (affinity differs: stub Spirit vs keeper Magic)
insert into champion_aliases (game_id, champion_id, alias, source)
select 'raid_shadow_legends', '3dfbfd27-2a35-49ee-a26b-638336684954', 'Dexikos', 'truncation'
where not exists (select 1 from champion_aliases a where a.champion_id='3dfbfd27-2a35-49ee-a26b-638336684954' and lower(a.alias)=lower('Dexikos'));
delete from champions where id='bde0b00c-ed1d-413a-a452-a48f88b511dd' and game_id='raid_shadow_legends';

-- Eva -> Queen Eva [Dark Elves/Legendary] (affinity differs: stub Magic vs keeper Spirit)
insert into champion_aliases (game_id, champion_id, alias, source)
select 'raid_shadow_legends', '486e289a-35a9-4b35-a17f-0cbd37aeb50e', 'Eva', 'truncation'
where not exists (select 1 from champion_aliases a where a.champion_id='486e289a-35a9-4b35-a17f-0cbd37aeb50e' and lower(a.alias)=lower('Eva'));
delete from champions where id='55e05296-3206-4402-a012-f07f684f9a11' and game_id='raid_shadow_legends';

-- Fabian -> Lord Entertainer Fabian [Undead Hordes/Legendary] (affinity differs: stub Force vs keeper Spirit)
insert into champion_aliases (game_id, champion_id, alias, source)
select 'raid_shadow_legends', 'adb6e11c-4e72-49ab-b096-91904ae9ecb9', 'Fabian', 'truncation'
where not exists (select 1 from champion_aliases a where a.champion_id='adb6e11c-4e72-49ab-b096-91904ae9ecb9' and lower(a.alias)=lower('Fabian'));
delete from champions where id='f7573df2-76a8-47c1-81e6-04f5718c3a66' and game_id='raid_shadow_legends';

-- Fearmonger -> Masked Fearmonger [Banner Lords/Epic] (affinity differs: stub Void vs keeper Spirit)
insert into champion_aliases (game_id, champion_id, alias, source)
select 'raid_shadow_legends', '88357d25-bd09-4838-a84a-1ebb7161b310', 'Fearmonger', 'truncation'
where not exists (select 1 from champion_aliases a where a.champion_id='88357d25-bd09-4838-a84a-1ebb7161b310' and lower(a.alias)=lower('Fearmonger'));
delete from champions where id='3c618df0-f811-43a6-bba2-cc917e3fa905' and game_id='raid_shadow_legends';

-- Flannan -> Boughsmith Flannan [Sylvan Watchers/Rare] (affinity differs: stub Spirit vs keeper Force)
insert into champion_aliases (game_id, champion_id, alias, source)
select 'raid_shadow_legends', '214270e2-e447-434e-b866-1019fe8a494b', 'Flannan', 'truncation'
where not exists (select 1 from champion_aliases a where a.champion_id='214270e2-e447-434e-b866-1019fe8a494b' and lower(a.alias)=lower('Flannan'));
delete from champions where id='d5196fd7-adbf-404b-88b8-12872d38d293' and game_id='raid_shadow_legends';

-- Galatea -> Lionsguard Galatea [Argonites/Epic] (affinity differs: stub Magic vs keeper Spirit)
insert into champion_aliases (game_id, champion_id, alias, source)
select 'raid_shadow_legends', 'e7cf2b73-12fb-46ec-8b17-da8abef0a44a', 'Galatea', 'truncation'
where not exists (select 1 from champion_aliases a where a.champion_id='e7cf2b73-12fb-46ec-8b17-da8abef0a44a' and lower(a.alias)=lower('Galatea'));
delete from champions where id='c45059d7-2748-428d-b03c-7e8350102009' and game_id='raid_shadow_legends';

-- Galathir -> Starsage Galathir [High Elves/Mythical] (affinity differs: stub Magic vs keeper Force)
insert into champion_aliases (game_id, champion_id, alias, source)
select 'raid_shadow_legends', 'd4964e4c-67af-4137-87cd-d31687bfe007', 'Galathir', 'truncation'
where not exists (select 1 from champion_aliases a where a.champion_id='d4964e4c-67af-4137-87cd-d31687bfe007' and lower(a.alias)=lower('Galathir'));
delete from champions where id='f983b171-58b0-42a9-a5ef-83894ba16fcd' and game_id='raid_shadow_legends';

-- Ghrukkus -> Old Ghrukkus [Ogryn Tribes/Epic]
insert into champion_aliases (game_id, champion_id, alias, source)
select 'raid_shadow_legends', 'b77b5f3f-4671-4195-a982-ba5914bd6cf0', 'Ghrukkus', 'truncation'
where not exists (select 1 from champion_aliases a where a.champion_id='b77b5f3f-4671-4195-a982-ba5914bd6cf0' and lower(a.alias)=lower('Ghrukkus'));
delete from champions where id='5db41f47-14b3-4d3d-9004-fe3c9e9ccd91' and game_id='raid_shadow_legends';

-- Goon -> Fortress Goon [Ogryn Tribes/Rare] (affinity differs: stub Spirit vs keeper Magic)
insert into champion_aliases (game_id, champion_id, alias, source)
select 'raid_shadow_legends', '032752ee-6049-435b-b488-653d313a2dbb', 'Goon', 'truncation'
where not exists (select 1 from champion_aliases a where a.champion_id='032752ee-6049-435b-b488-653d313a2dbb' and lower(a.alias)=lower('Goon'));
delete from champions where id='98d2c3b9-2d6d-45d7-9cff-65fe529251e0' and game_id='raid_shadow_legends';

-- Greggor -> Dune Lord Greggor [Barbarians/Legendary]
insert into champion_aliases (game_id, champion_id, alias, source)
select 'raid_shadow_legends', '2989fb5a-a1f5-473b-9b13-315e660afc2e', 'Greggor', 'truncation'
where not exists (select 1 from champion_aliases a where a.champion_id='2989fb5a-a1f5-473b-9b13-315e660afc2e' and lower(a.alias)=lower('Greggor'));
delete from champions where id='0fe7c76e-409e-48a9-9be7-e1014aba6414' and game_id='raid_shadow_legends';

-- Hatter -> Mad Hatter [Knights Revenant/Legendary] (affinity differs: stub Spirit vs keeper Force)
insert into champion_aliases (game_id, champion_id, alias, source)
select 'raid_shadow_legends', '67ca14b7-f3c0-48a5-bbf7-2f0110eac8f2', 'Hatter', 'truncation'
where not exists (select 1 from champion_aliases a where a.champion_id='67ca14b7-f3c0-48a5-bbf7-2f0110eac8f2' and lower(a.alias)=lower('Hatter'));
delete from champions where id='3b6b9555-d759-483e-a320-00447051354a' and game_id='raid_shadow_legends';

-- Hekaton -> Storm Herald Hekaton [Argonites/Legendary] (affinity differs: stub Force vs keeper Void)
insert into champion_aliases (game_id, champion_id, alias, source)
select 'raid_shadow_legends', 'b6106249-f2b4-4fc6-a478-d72b4d7bc28c', 'Hekaton', 'truncation'
where not exists (select 1 from champion_aliases a where a.champion_id='b6106249-f2b4-4fc6-a478-d72b4d7bc28c' and lower(a.alias)=lower('Hekaton'));
delete from champions where id='1ff27261-b21f-4266-9eff-553c20b02850' and game_id='raid_shadow_legends';

-- Herakletes -> Tribune Herakletes [Undead Hordes/Legendary] (affinity differs: stub Force vs keeper Spirit)
insert into champion_aliases (game_id, champion_id, alias, source)
select 'raid_shadow_legends', '6d374e05-a1c6-4225-af82-a33fba40c15a', 'Herakletes', 'truncation'
where not exists (select 1 from champion_aliases a where a.champion_id='6d374e05-a1c6-4225-af82-a33fba40c15a' and lower(a.alias)=lower('Herakletes'));
delete from champions where id='5225e495-a535-4a1a-ac3e-70c7b1eafe97' and game_id='raid_shadow_legends';

-- Ieyasu -> Onryo Ieyasu [Shadowkin/Legendary] (affinity differs: stub Spirit vs keeper Void)
insert into champion_aliases (game_id, champion_id, alias, source)
select 'raid_shadow_legends', '7930353a-a4e3-4006-8561-ad71df807c55', 'Ieyasu', 'truncation'
where not exists (select 1 from champion_aliases a where a.champion_id='7930353a-a4e3-4006-8561-ad71df807c55' and lower(a.alias)=lower('Ieyasu'));
delete from champions where id='d39e68b8-6583-4f32-969d-ec04eacee25d' and game_id='raid_shadow_legends';

-- Isbeil -> Fyr-Gun Isbeil [Dwarves/Epic]
insert into champion_aliases (game_id, champion_id, alias, source)
select 'raid_shadow_legends', '55e03ed1-b948-4f69-9430-52b5b44b56c9', 'Isbeil', 'truncation'
where not exists (select 1 from champion_aliases a where a.champion_id='55e03ed1-b948-4f69-9430-52b5b44b56c9' and lower(a.alias)=lower('Isbeil'));
delete from champions where id='bae64f86-e775-4824-8f71-d0c9a6d11400' and game_id='raid_shadow_legends';

-- Islin -> Strategos Islin [High Elves/Legendary] (affinity differs: stub Void vs keeper Magic)
insert into champion_aliases (game_id, champion_id, alias, source)
select 'raid_shadow_legends', 'ab825a40-6c22-4d40-ac9b-bea7972799d9', 'Islin', 'truncation'
where not exists (select 1 from champion_aliases a where a.champion_id='ab825a40-6c22-4d40-ac9b-bea7972799d9' and lower(a.alias)=lower('Islin'));
delete from champions where id='ce0c2cce-a843-404c-b326-fa2c5c00b693' and game_id='raid_shadow_legends';

-- Jailer -> Ogryn Jailer [Ogryn Tribes/Rare] (affinity differs: stub Magic vs keeper Force)
insert into champion_aliases (game_id, champion_id, alias, source)
select 'raid_shadow_legends', '3f3d4b68-99f2-4892-acdf-14189dd59b21', 'Jailer', 'truncation'
where not exists (select 1 from champion_aliases a where a.champion_id='3f3d4b68-99f2-4892-acdf-14189dd59b21' and lower(a.alias)=lower('Jailer'));
delete from champions where id='958b37d2-7a8c-4615-8ada-ec867cb45b72' and game_id='raid_shadow_legends';

-- Jeroboam -> Brewguard Jeroboam [Ogryn Tribes/Legendary]
insert into champion_aliases (game_id, champion_id, alias, source)
select 'raid_shadow_legends', 'abd75824-5d35-4428-a061-c2da2903af76', 'Jeroboam', 'truncation'
where not exists (select 1 from champion_aliases a where a.champion_id='abd75824-5d35-4428-a061-c2da2903af76' and lower(a.alias)=lower('Jeroboam'));
delete from champions where id='85b91e8d-7453-4033-9b93-a91bc5f4f0bf' and game_id='raid_shadow_legends';

-- Jorrg -> Old Hermit Jorrg [Orcs/Epic]
insert into champion_aliases (game_id, champion_id, alias, source)
select 'raid_shadow_legends', 'ef5332a8-1b8f-4588-8518-cd02360c85ba', 'Jorrg', 'truncation'
where not exists (select 1 from champion_aliases a where a.champion_id='ef5332a8-1b8f-4588-8518-cd02360c85ba' and lower(a.alias)=lower('Jorrg'));
delete from champions where id='2393da4f-b645-436d-8d86-64d505962e83' and game_id='raid_shadow_legends';

-- Knott -> Treeshield Knott [Sylvan Watchers/Rare] (affinity differs: stub Spirit vs keeper Void)
insert into champion_aliases (game_id, champion_id, alias, source)
select 'raid_shadow_legends', '498e029e-c0ae-4ede-87ed-d8f4c509bdb0', 'Knott', 'truncation'
where not exists (select 1 from champion_aliases a where a.champion_id='498e029e-c0ae-4ede-87ed-d8f4c509bdb0' and lower(a.alias)=lower('Knott'));
delete from champions where id='0c648dfe-173e-4222-8db1-2e5369136b6b' and game_id='raid_shadow_legends';

-- Krixia -> Night Queen Krixia [Knights Revenant/Mythical]
insert into champion_aliases (game_id, champion_id, alias, source)
select 'raid_shadow_legends', '0d775c36-6b4d-4903-82f1-606fcd0ffb0a', 'Krixia', 'truncation'
where not exists (select 1 from champion_aliases a where a.champion_id='0d775c36-6b4d-4903-82f1-606fcd0ffb0a' and lower(a.alias)=lower('Krixia'));
delete from champions where id='cab930f6-0f7c-4af3-8c3a-9d0b6cd5b05e' and game_id='raid_shadow_legends';

-- Lamasu -> Authoratrix Lamasu [Demonspawn/Legendary] (affinity differs: stub Magic vs keeper Void)
insert into champion_aliases (game_id, champion_id, alias, source)
select 'raid_shadow_legends', 'a9504e74-b2cc-4a3a-aa41-0fea63d09d0e', 'Lamasu', 'truncation'
where not exists (select 1 from champion_aliases a where a.champion_id='a9504e74-b2cc-4a3a-aa41-0fea63d09d0e' and lower(a.alias)=lower('Lamasu'));
delete from champions where id='99d7ee39-e363-4823-b567-57f2ca461d76' and game_id='raid_shadow_legends';

-- Lasair -> Branch-Arm Lasair [Sylvan Watchers/Rare] (affinity differs: stub Force vs keeper Void)
insert into champion_aliases (game_id, champion_id, alias, source)
select 'raid_shadow_legends', '9e606a70-8cef-4ce3-b0fe-0557bdf159e8', 'Lasair', 'truncation'
where not exists (select 1 from champion_aliases a where a.champion_id='9e606a70-8cef-4ce3-b0fe-0557bdf159e8' and lower(a.alias)=lower('Lasair'));
delete from champions where id='27bb2d69-ba95-4b75-8824-2d2480f052a5' and game_id='raid_shadow_legends';

-- Lazarius -> Hierophant Lazarius [Lizardmen/Mythical]
insert into champion_aliases (game_id, champion_id, alias, source)
select 'raid_shadow_legends', '6989047d-12f6-4d0a-a550-4dd0a9d87833', 'Lazarius', 'truncation'
where not exists (select 1 from champion_aliases a where a.champion_id='6989047d-12f6-4d0a-a550-4dd0a9d87833' and lower(a.alias)=lower('Lazarius'));
delete from champions where id='760966d9-6838-4129-9aaf-843856284ed5' and game_id='raid_shadow_legends';

-- Loriaca -> Greathoof Loriaca [Skinwalkers/Legendary] (affinity differs: stub Magic vs keeper Spirit)
insert into champion_aliases (game_id, champion_id, alias, source)
select 'raid_shadow_legends', 'f6928807-a4ac-42b5-a6a8-f03b15162ba1', 'Loriaca', 'truncation'
where not exists (select 1 from champion_aliases a where a.champion_id='f6928807-a4ac-42b5-a6a8-f03b15162ba1' and lower(a.alias)=lower('Loriaca'));
delete from champions where id='6717b081-1e5b-4175-bb47-3e81c90d91a3' and game_id='raid_shadow_legends';

-- Maria -> Sanguine Maria [Undead Hordes/Legendary] (affinity differs: stub Spirit vs keeper Force)
insert into champion_aliases (game_id, champion_id, alias, source)
select 'raid_shadow_legends', 'f73b6bcd-1935-4bd0-9195-a6c41be632cd', 'Maria', 'truncation'
where not exists (select 1 from champion_aliases a where a.champion_id='f73b6bcd-1935-4bd0-9195-a6c41be632cd' and lower(a.alias)=lower('Maria'));
delete from champions where id='86dade78-80da-465b-b662-06ea4a35c42a' and game_id='raid_shadow_legends';

-- Maud -> Highmother Maud [Sacred Order/Legendary] (affinity differs: stub Spirit vs keeper Force)
insert into champion_aliases (game_id, champion_id, alias, source)
select 'raid_shadow_legends', '7b5d14fe-a162-46cf-93ca-27cb06634731', 'Maud', 'truncation'
where not exists (select 1 from champion_aliases a where a.champion_id='7b5d14fe-a162-46cf-93ca-27cb06634731' and lower(a.alias)=lower('Maud'));
delete from champions where id='7307f032-f1d4-4345-a511-5a3de2acbcf5' and game_id='raid_shadow_legends';

-- Mina -> Blood Marchioness Mina [Undead Hordes/Mythical]
insert into champion_aliases (game_id, champion_id, alias, source)
select 'raid_shadow_legends', '1ef6e374-67e7-49da-b9ff-210d78a7fe47', 'Mina', 'truncation'
where not exists (select 1 from champion_aliases a where a.champion_id='1ef6e374-67e7-49da-b9ff-210d78a7fe47' and lower(a.alias)=lower('Mina'));
delete from champions where id='e3fc0f47-7b73-4d49-b9d1-5582556c5563' and game_id='raid_shadow_legends';

-- Nagis -> Deephook Nagis [Argonites/Epic] (affinity differs: stub Force vs keeper Void)
insert into champion_aliases (game_id, champion_id, alias, source)
select 'raid_shadow_legends', 'd7113da8-d4b3-4503-9bd7-f450cadb1ced', 'Nagis', 'truncation'
where not exists (select 1 from champion_aliases a where a.champion_id='d7113da8-d4b3-4503-9bd7-f450cadb1ced' and lower(a.alias)=lower('Nagis'));
delete from champions where id='b807a42c-f8d6-412c-aeec-8a1fda7d9905' and game_id='raid_shadow_legends';

-- Narses -> Wight King Narses [Knights Revenant/Legendary] (affinity differs: stub Magic vs keeper Void)
insert into champion_aliases (game_id, champion_id, alias, source)
select 'raid_shadow_legends', '7023ffea-67b9-42e8-9b46-87d9aac33a08', 'Narses', 'truncation'
where not exists (select 1 from champion_aliases a where a.champion_id='7023ffea-67b9-42e8-9b46-87d9aac33a08' and lower(a.alias)=lower('Narses'));
delete from champions where id='889f420d-7a2d-4bc7-a605-f9dbc13891db' and game_id='raid_shadow_legends';

-- Nia -> White Dryad Nia [Sylvan Watchers/Epic] (affinity differs: stub Magic vs keeper Void)
insert into champion_aliases (game_id, champion_id, alias, source)
select 'raid_shadow_legends', 'c4627bee-de4d-488f-b51b-deb582e247cc', 'Nia', 'truncation'
where not exists (select 1 from champion_aliases a where a.champion_id='c4627bee-de4d-488f-b51b-deb582e247cc' and lower(a.alias)=lower('Nia'));
delete from champions where id='4e4db40f-0fad-4c19-80fd-03bba8a24117' and game_id='raid_shadow_legends';

-- Noelle -> Lady Noelle [Sacred Order/Legendary] (affinity differs: stub Spirit vs keeper Void)
insert into champion_aliases (game_id, champion_id, alias, source)
select 'raid_shadow_legends', '90ce7b2d-a332-4472-895e-1b46b4893884', 'Noelle', 'truncation'
where not exists (select 1 from champion_aliases a where a.champion_id='90ce7b2d-a332-4472-895e-1b46b4893884' and lower(a.alias)=lower('Noelle'));
delete from champions where id='bf507095-2eb5-4370-a605-6452404764e0' and game_id='raid_shadow_legends';

-- Othorion -> Wallmaster Othorion [High Elves/Legendary] (affinity differs: stub Force vs keeper Magic)
insert into champion_aliases (game_id, champion_id, alias, source)
select 'raid_shadow_legends', '0a442031-0625-4684-bacb-565c9ee5617f', 'Othorion', 'truncation'
where not exists (select 1 from champion_aliases a where a.champion_id='0a442031-0625-4684-bacb-565c9ee5617f' and lower(a.alias)=lower('Othorion'));
delete from champions where id='1823de18-305a-43ec-af48-4fe9c6b759b8' and game_id='raid_shadow_legends';

-- Padraig -> Grand Oak Padraig [Sylvan Watchers/Legendary] (affinity differs: stub Magic vs keeper Spirit)
insert into champion_aliases (game_id, champion_id, alias, source)
select 'raid_shadow_legends', '19904ab2-c6b2-4d47-bc25-8a5960766493', 'Padraig', 'truncation'
where not exists (select 1 from champion_aliases a where a.champion_id='19904ab2-c6b2-4d47-bc25-8a5960766493' and lower(a.alias)=lower('Padraig'));
delete from champions where id='a1fe9e28-86d7-4738-b422-b2632ba90c05' and game_id='raid_shadow_legends';

-- Pegason -> Crimson Pegason [Argonites/Rare] (affinity differs: stub Spirit vs keeper Force)
insert into champion_aliases (game_id, champion_id, alias, source)
select 'raid_shadow_legends', 'e0146a87-d355-4677-ac3b-4e4f4cc2459f', 'Pegason', 'truncation'
where not exists (select 1 from champion_aliases a where a.champion_id='e0146a87-d355-4677-ac3b-4e4f4cc2459f' and lower(a.alias)=lower('Pegason'));
delete from champions where id='12d7eaef-1a40-4b15-b890-4cf7196d0a53' and game_id='raid_shadow_legends';

-- Prysma -> High Keeper Prysma [High Elves/Legendary] (affinity differs: stub Magic vs keeper Spirit)
insert into champion_aliases (game_id, champion_id, alias, source)
select 'raid_shadow_legends', '00ad5079-3462-457d-b894-c67efaaf898d', 'Prysma', 'truncation'
where not exists (select 1 from champion_aliases a where a.champion_id='00ad5079-3462-457d-b894-c67efaaf898d' and lower(a.alias)=lower('Prysma'));
delete from champions where id='1bd96105-8a57-43c4-be15-65802417e6e6' and game_id='raid_shadow_legends';

-- Riab -> Loneblade Riab [Sylvan Watchers/Rare] (affinity differs: stub Spirit vs keeper Force)
insert into champion_aliases (game_id, champion_id, alias, source)
select 'raid_shadow_legends', '85dcabf7-7bbc-41c1-902f-3f7486684abd', 'Riab', 'truncation'
where not exists (select 1 from champion_aliases a where a.champion_id='85dcabf7-7bbc-41c1-902f-3f7486684abd' and lower(a.alias)=lower('Riab'));
delete from champions where id='35ba189d-aab8-4da3-82dd-ca8340d3377b' and game_id='raid_shadow_legends';

-- Roanas -> Basileus Roanas [High Elves/Legendary] (affinity differs: stub Magic vs keeper Force)
insert into champion_aliases (game_id, champion_id, alias, source)
select 'raid_shadow_legends', 'd0ec94e3-3d90-4898-99db-92a208ba8ae0', 'Roanas', 'truncation'
where not exists (select 1 from champion_aliases a where a.champion_id='d0ec94e3-3d90-4898-99db-92a208ba8ae0' and lower(a.alias)=lower('Roanas'));
delete from champions where id='dc21e0a4-208b-43b4-8ac6-c8aca4ad6f46' and game_id='raid_shadow_legends';

-- Ruarc -> Greenwarden Ruarc [Sylvan Watchers/Legendary]
insert into champion_aliases (game_id, champion_id, alias, source)
select 'raid_shadow_legends', '40ea0168-897b-4c59-85f4-60e1e8771c35', 'Ruarc', 'truncation'
where not exists (select 1 from champion_aliases a where a.champion_id='40ea0168-897b-4c59-85f4-60e1e8771c35' and lower(a.alias)=lower('Ruarc'));
delete from champions where id='f48b6f4a-e89d-4a07-9752-443e4ae738c1' and game_id='raid_shadow_legends';

-- Sabitha -> Dawncaller Sabitha [Knights Revenant/Epic] (affinity differs: stub Magic vs keeper Void)
insert into champion_aliases (game_id, champion_id, alias, source)
select 'raid_shadow_legends', '0465daca-89f5-4f27-9d9e-d8589d3725c7', 'Sabitha', 'truncation'
where not exists (select 1 from champion_aliases a where a.champion_id='0465daca-89f5-4f27-9d9e-d8589d3725c7' and lower(a.alias)=lower('Sabitha'));
delete from champions where id='91472af7-9cba-4089-9e63-d1278be56c9a' and game_id='raid_shadow_legends';

-- Siendra -> Lightward Siendra [High Elves/Epic] (affinity differs: stub Magic vs keeper Void)
insert into champion_aliases (game_id, champion_id, alias, source)
select 'raid_shadow_legends', '141546c8-6658-46f5-80f1-6f128a5afe5b', 'Siendra', 'truncation'
where not exists (select 1 from champion_aliases a where a.champion_id='141546c8-6658-46f5-80f1-6f128a5afe5b' and lower(a.alias)=lower('Siendra'));
delete from champions where id='1d276f35-fc30-4329-9f22-9b8a6070e80f' and game_id='raid_shadow_legends';

-- Survivor -> Sandlashed Survivor [Orcs/Epic] (affinity differs: stub Force vs keeper Spirit)
insert into champion_aliases (game_id, champion_id, alias, source)
select 'raid_shadow_legends', 'b7cad312-8504-4ff7-96bc-95b45fd56ebd', 'Survivor', 'truncation'
where not exists (select 1 from champion_aliases a where a.champion_id='b7cad312-8504-4ff7-96bc-95b45fd56ebd' and lower(a.alias)=lower('Survivor'));
delete from champions where id='d773ac5c-8329-4efc-a261-fe4162f08099' and game_id='raid_shadow_legends';

-- Taneko -> Redcloak Taneko [Shadowkin/Rare]
insert into champion_aliases (game_id, champion_id, alias, source)
select 'raid_shadow_legends', '76a2e8db-7f4d-4717-916b-2e80ea8a011a', 'Taneko', 'truncation'
where not exists (select 1 from champion_aliases a where a.champion_id='76a2e8db-7f4d-4717-916b-2e80ea8a011a' and lower(a.alias)=lower('Taneko'));
delete from champions where id='4dd0f46d-5ef4-4c45-ab15-ef617bbdedad' and game_id='raid_shadow_legends';

-- Teox -> Legate Teox [Lizardmen/Legendary] (affinity differs: stub Force vs keeper Spirit)
insert into champion_aliases (game_id, champion_id, alias, source)
select 'raid_shadow_legends', '6962ee3d-07e6-47fb-8e1e-6a41ba8e3509', 'Teox', 'truncation'
where not exists (select 1 from champion_aliases a where a.champion_id='6962ee3d-07e6-47fb-8e1e-6a41ba8e3509' and lower(a.alias)=lower('Teox'));
delete from champions where id='499211fd-ad80-4093-8b34-b9d5edb45d71' and game_id='raid_shadow_legends';

-- Thisbe -> Stonebound Thisbe [Argonites/Epic] (affinity differs: stub Spirit vs keeper Magic)
insert into champion_aliases (game_id, champion_id, alias, source)
select 'raid_shadow_legends', 'c67dbcad-af36-49ef-90b7-67c9618a3745', 'Thisbe', 'truncation'
where not exists (select 1 from champion_aliases a where a.champion_id='c67dbcad-af36-49ef-90b7-67c9618a3745' and lower(a.alias)=lower('Thisbe'));
delete from champions where id='2fccb011-2613-4785-92d2-738548ca333f' and game_id='raid_shadow_legends';

-- Tirlac -> Shadowbow Tirlac [Sylvan Watchers/Rare] (affinity differs: stub Force vs keeper Spirit)
insert into champion_aliases (game_id, champion_id, alias, source)
select 'raid_shadow_legends', '8eb852bb-6324-4cee-a5cd-034b908fc553', 'Tirlac', 'truncation'
where not exists (select 1 from champion_aliases a where a.champion_id='8eb852bb-6324-4cee-a5cd-034b908fc553' and lower(a.alias)=lower('Tirlac'));
delete from champions where id='1d96c153-4be3-461f-91c4-fe13eea5d094' and game_id='raid_shadow_legends';

-- Tolog -> Meatcarver Tolog [Skinwalkers/Rare]
insert into champion_aliases (game_id, champion_id, alias, source)
select 'raid_shadow_legends', '3f4c7d33-ee28-4813-a96a-25b5d0a67fd2', 'Tolog', 'truncation'
where not exists (select 1 from champion_aliases a where a.champion_id='3f4c7d33-ee28-4813-a96a-25b5d0a67fd2' and lower(a.alias)=lower('Tolog'));
delete from champions where id='43b7e399-ce45-490e-a8d1-7edd6832bb98' and game_id='raid_shadow_legends';

-- Tuskkor -> First Ax Tuskkor [Ogryn Tribes/Legendary]
insert into champion_aliases (game_id, champion_id, alias, source)
select 'raid_shadow_legends', 'ab9bad3d-2b0c-4c2b-8b8d-50252f23a4a9', 'Tuskkor', 'truncation'
where not exists (select 1 from champion_aliases a where a.champion_id='ab9bad3d-2b0c-4c2b-8b8d-50252f23a4a9' and lower(a.alias)=lower('Tuskkor'));
delete from champions where id='09530cc8-160e-441c-b23e-0521cb876346' and game_id='raid_shadow_legends';

-- Ukko -> Mighty Ukko [Skinwalkers/Legendary] (affinity differs: stub Spirit vs keeper Force)
insert into champion_aliases (game_id, champion_id, alias, source)
select 'raid_shadow_legends', '55954ec6-16b4-4174-b3a6-e8e181b2335b', 'Ukko', 'truncation'
where not exists (select 1 from champion_aliases a where a.champion_id='55954ec6-16b4-4174-b3a6-e8e181b2335b' and lower(a.alias)=lower('Ukko'));
delete from champions where id='8b084ec2-670a-447a-8c6d-88715b9ead36' and game_id='raid_shadow_legends';

-- Var-Gall -> Skull Lord Var-Gall [Lizardmen/Legendary] (affinity differs: stub Void vs keeper Force)
insert into champion_aliases (game_id, champion_id, alias, source)
select 'raid_shadow_legends', '0f0090d8-504e-4e58-8124-aaf2a028d51c', 'Var-Gall', 'truncation'
where not exists (select 1 from champion_aliases a where a.champion_id='0f0090d8-504e-4e58-8124-aaf2a028d51c' and lower(a.alias)=lower('Var-Gall'));
delete from champions where id='db246717-59ff-46fb-9273-6d8d4f7a214a' and game_id='raid_shadow_legends';

-- Wixwell -> Vault Keeper Wixwell [Sacred Order/Legendary] (affinity differs: stub Magic vs keeper Force)
insert into champion_aliases (game_id, champion_id, alias, source)
select 'raid_shadow_legends', 'bcf948cb-ef87-4a46-b5ed-ac5e296548e4', 'Wixwell', 'truncation'
where not exists (select 1 from champion_aliases a where a.champion_id='bcf948cb-ef87-4a46-b5ed-ac5e296548e4' and lower(a.alias)=lower('Wixwell'));
delete from champions where id='604f2a9c-5618-4af4-b05e-4b86b18c8516' and game_id='raid_shadow_legends';

-- Zaharis -> Dune Herald Zaharis [Barbarians/Legendary] (affinity differs: stub Spirit vs keeper Force)
insert into champion_aliases (game_id, champion_id, alias, source)
select 'raid_shadow_legends', '3fd85f24-33c1-46af-bdb9-845dc30b42f2', 'Zaharis', 'truncation'
where not exists (select 1 from champion_aliases a where a.champion_id='3fd85f24-33c1-46af-bdb9-845dc30b42f2' and lower(a.alias)=lower('Zaharis'));
delete from champions where id='85ed6a21-a164-4fdd-9532-213f08f34746' and game_id='raid_shadow_legends';

-- Zarguna -> Matriarch Zarguna [Orcs/Legendary] (affinity differs: stub Magic vs keeper Force)
insert into champion_aliases (game_id, champion_id, alias, source)
select 'raid_shadow_legends', '843385e2-f70d-4590-a2b1-ce5238a0602c', 'Zarguna', 'truncation'
where not exists (select 1 from champion_aliases a where a.champion_id='843385e2-f70d-4590-a2b1-ce5238a0602c' and lower(a.alias)=lower('Zarguna'));
delete from champions where id='9c48404e-e75d-472d-a5f9-b7566c37234b' and game_id='raid_shadow_legends';

-- Zyclic -> Swarmspeaker Zyclic [Dark Elves/Legendary]
insert into champion_aliases (game_id, champion_id, alias, source)
select 'raid_shadow_legends', '12fe8718-e769-40a4-bb92-3f2c69a51324', 'Zyclic', 'truncation'
where not exists (select 1 from champion_aliases a where a.champion_id='12fe8718-e769-40a4-bb92-3f2c69a51324' and lower(a.alias)=lower('Zyclic'));
delete from champions where id='67795f25-735e-43f8-9911-250875e483ca' and game_id='raid_shadow_legends';

-- Adelyn -> Chronicler Adelyn [Banner Lords/Legendary]
insert into champion_aliases (game_id, champion_id, alias, source)
select 'raid_shadow_legends', 'e367d6c7-30c5-4991-95f9-b57130c7b22d', 'Adelyn', 'truncation'
where not exists (select 1 from champion_aliases a where a.champion_id='e367d6c7-30c5-4991-95f9-b57130c7b22d' and lower(a.alias)=lower('Adelyn'));
delete from champions where id='77e76f49-e47d-45e1-a0a0-91062b1ad2e0' and game_id='raid_shadow_legends';
