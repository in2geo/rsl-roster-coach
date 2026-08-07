-- ============================================================================
-- 2026-08-07 — distinctive-word SHORT-FORM aliases (alias-integrity audit vs AyumiLove)
--
-- The resolver is EXACT normalized-match (no fuzzy) so every name form must be an explicit alias.
-- Audit (tools/alias-audit-ayumilove.mjs): full-name coverage complete (0 missing); these 21 multi-word
-- champions lacked a resolving SHORT form. Short form = a DISTINCTIVE word (appears in exactly ONE
-- champion name) so shared titles ("Lady") and skin words ("Kael") are auto-excluded (collision-safe).
-- Idempotent (NOT EXISTS guard). APPLIED 2026-08-07; written back to worksheet Aliases tab (21 rows,
-- source 'short_name'; backup BACKUP-2026-08-07-preShortformAliases.xlsx). Full audit + the NO_SHORT /
-- UNMATCHED buckets: tools/alias-audit-ayumilove.mjs.
-- ============================================================================
begin;

insert into champion_aliases (game_id, champion_id, alias, source)
select 'raid_shadow_legends', '39b3b230-9cb1-4ae7-93ab-039061553137', 'Elven', 'distinctive-shortform; alias audit 2026-08-07'
  where not exists (select 1 from champion_aliases a where a.champion_id='39b3b230-9cb1-4ae7-93ab-039061553137' and lower(a.alias)=lower('Elven'));  -- Elven Ranger
insert into champion_aliases (game_id, champion_id, alias, source)
select 'raid_shadow_legends', '4a8175bd-6029-4456-b35d-6ee637f20c67', 'Gracchos', 'distinctive-shortform; alias audit 2026-08-07'
  where not exists (select 1 from champion_aliases a where a.champion_id='4a8175bd-6029-4456-b35d-6ee637f20c67' and lower(a.alias)=lower('Gracchos'));  -- Gracchos Turn-drake
insert into champion_aliases (game_id, champion_id, alias, source)
select 'raid_shadow_legends', '4a8175bd-6029-4456-b35d-6ee637f20c67', 'Turn-drake', 'distinctive-shortform; alias audit 2026-08-07'
  where not exists (select 1 from champion_aliases a where a.champion_id='4a8175bd-6029-4456-b35d-6ee637f20c67' and lower(a.alias)=lower('Turn-drake'));  -- Gracchos Turn-drake
insert into champion_aliases (game_id, champion_id, alias, source)
select 'raid_shadow_legends', 'da49abd4-a567-45da-a0a0-56b0ce8f375c', 'Sepulcher', 'distinctive-shortform; alias audit 2026-08-07'
  where not exists (select 1 from champion_aliases a where a.champion_id='da49abd4-a567-45da-a0a0-56b0ce8f375c' and lower(a.alias)=lower('Sepulcher'));  -- Sepulcher Sentinel
insert into champion_aliases (game_id, champion_id, alias, source)
select 'raid_shadow_legends', 'e0945e88-df9c-4a07-968d-b431c5c22c0a', 'Zinogre', 'distinctive-shortform; alias audit 2026-08-07'
  where not exists (select 1 from champion_aliases a where a.champion_id='e0945e88-df9c-4a07-968d-b431c5c22c0a' and lower(a.alias)=lower('Zinogre'));  -- Zinogre Blademaster
insert into champion_aliases (game_id, champion_id, alias, source)
select 'raid_shadow_legends', '7f66e631-d458-4309-a03f-0c23499d829c', 'Soulbond', 'distinctive-shortform; alias audit 2026-08-07'
  where not exists (select 1 from champion_aliases a where a.champion_id='7f66e631-d458-4309-a03f-0c23499d829c' and lower(a.alias)=lower('Soulbond'));  -- Soulbond Bowyer
insert into champion_aliases (game_id, champion_id, alias, source)
select 'raid_shadow_legends', '3f8ff348-1071-47a5-91d8-4cf8dc16f440', 'Sunken', 'distinctive-shortform; alias audit 2026-08-07'
  where not exists (select 1 from champion_aliases a where a.champion_id='3f8ff348-1071-47a5-91d8-4cf8dc16f440' and lower(a.alias)=lower('Sunken'));  -- Sunken Sentinel
insert into champion_aliases (game_id, champion_id, alias, source)
select 'raid_shadow_legends', 'a1317120-bd16-490f-aaf0-3eaedaa7f4b8', 'Alatreon', 'distinctive-shortform; alias audit 2026-08-07'
  where not exists (select 1 from champion_aliases a where a.champion_id='a1317120-bd16-490f-aaf0-3eaedaa7f4b8' and lower(a.alias)=lower('Alatreon'));  -- Alatreon Blademaster
insert into champion_aliases (game_id, champion_id, alias, source)
select 'raid_shadow_legends', 'd8cf0f71-b706-4f07-bacb-de87a652422d', 'Rotting', 'distinctive-shortform; alias audit 2026-08-07'
  where not exists (select 1 from champion_aliases a where a.champion_id='d8cf0f71-b706-4f07-bacb-de87a652422d' and lower(a.alias)=lower('Rotting'));  -- Rotting Mage
insert into champion_aliases (game_id, champion_id, alias, source)
select 'raid_shadow_legends', '31fbe227-a377-4d1f-bf7d-e9cae67f7a05', 'Fatalis', 'distinctive-shortform; alias audit 2026-08-07'
  where not exists (select 1 from champion_aliases a where a.champion_id='31fbe227-a377-4d1f-bf7d-e9cae67f7a05' and lower(a.alias)=lower('Fatalis'));  -- Fatalis Blademaster
insert into champion_aliases (game_id, champion_id, alias, source)
select 'raid_shadow_legends', 'd83595d1-8abe-44f5-a1bb-9c0c45719ca0', 'Rathalos', 'distinctive-shortform; alias audit 2026-08-07'
  where not exists (select 1 from champion_aliases a where a.champion_id='d83595d1-8abe-44f5-a1bb-9c0c45719ca0' and lower(a.alias)=lower('Rathalos'));  -- Rathalos Blademaster
insert into champion_aliases (game_id, champion_id, alias, source)
select 'raid_shadow_legends', 'a35a5661-d409-4747-9065-18c31c0275c0', 'Mausoleum', 'distinctive-shortform; alias audit 2026-08-07'
  where not exists (select 1 from champion_aliases a where a.champion_id='a35a5661-d409-4747-9065-18c31c0275c0' and lower(a.alias)=lower('Mausoleum'));  -- Mausoleum Mage
insert into champion_aliases (game_id, champion_id, alias, source)
select 'raid_shadow_legends', '37ed0e0d-adad-4332-a5f1-2ab68367943a', 'Skytouched', 'distinctive-shortform; alias audit 2026-08-07'
  where not exists (select 1 from champion_aliases a where a.champion_id='37ed0e0d-adad-4332-a5f1-2ab68367943a' and lower(a.alias)=lower('Skytouched'));  -- Skytouched Shaman
insert into champion_aliases (game_id, champion_id, alias, source)
select 'raid_shadow_legends', '24e30e6c-263f-4192-97eb-a83a55c41c9f', 'Black', 'distinctive-shortform; alias audit 2026-08-07'
  where not exists (select 1 from champion_aliases a where a.champion_id='24e30e6c-263f-4192-97eb-a83a55c41c9f' and lower(a.alias)=lower('Black'));  -- Black Knight
insert into champion_aliases (game_id, champion_id, alias, source)
select 'raid_shadow_legends', '2452ceac-ddc2-47db-a33d-b0a08448138b', 'Steel', 'distinctive-shortform; alias audit 2026-08-07'
  where not exists (select 1 from champion_aliases a where a.champion_id='2452ceac-ddc2-47db-a33d-b0a08448138b' and lower(a.alias)=lower('Steel'));  -- Steel Bowyer
insert into champion_aliases (game_id, champion_id, alias, source)
select 'raid_shadow_legends', '519ff300-8734-429a-9b58-abd6de09765e', 'Honor', 'distinctive-shortform; alias audit 2026-08-07'
  where not exists (select 1 from champion_aliases a where a.champion_id='519ff300-8734-429a-9b58-abd6de09765e' and lower(a.alias)=lower('Honor'));  -- Honor Guard
insert into champion_aliases (game_id, champion_id, alias, source)
select 'raid_shadow_legends', '6c87d3d6-2a7c-4672-97c1-92355634d13f', 'Ghoulish', 'distinctive-shortform; alias audit 2026-08-07'
  where not exists (select 1 from champion_aliases a where a.champion_id='6c87d3d6-2a7c-4672-97c1-92355634d13f' and lower(a.alias)=lower('Ghoulish'));  -- Ghoulish Ranger
insert into champion_aliases (game_id, champion_id, alias, source)
select 'raid_shadow_legends', '75fb7477-1485-428f-a1ea-bcd4bf18e0f1', 'Stag', 'distinctive-shortform; alias audit 2026-08-07'
  where not exists (select 1 from champion_aliases a where a.champion_id='75fb7477-1485-428f-a1ea-bcd4bf18e0f1' and lower(a.alias)=lower('Stag'));  -- Stag Knight
insert into champion_aliases (game_id, champion_id, alias, source)
select 'raid_shadow_legends', '406977e0-c6c8-4201-99b6-06aea1892311', 'Blind', 'distinctive-shortform; alias audit 2026-08-07'
  where not exists (select 1 from champion_aliases a where a.champion_id='406977e0-c6c8-4201-99b6-06aea1892311' and lower(a.alias)=lower('Blind'));  -- Blind Seer
insert into champion_aliases (game_id, champion_id, alias, source)
select 'raid_shadow_legends', 'cf72e8d7-4126-443a-9721-ba33a73dc26e', 'Bone', 'distinctive-shortform; alias audit 2026-08-07'
  where not exists (select 1 from champion_aliases a where a.champion_id='cf72e8d7-4126-443a-9721-ba33a73dc26e' and lower(a.alias)=lower('Bone'));  -- Bone Knight
insert into champion_aliases (game_id, champion_id, alias, source)
select 'raid_shadow_legends', 'ea854f28-82a1-4469-99c9-15c8097bf6aa', 'Frozen', 'distinctive-shortform; alias audit 2026-08-07'
  where not exists (select 1 from champion_aliases a where a.champion_id='ea854f28-82a1-4469-99c9-15c8097bf6aa' and lower(a.alias)=lower('Frozen'));  -- Frozen Banshee

commit;
