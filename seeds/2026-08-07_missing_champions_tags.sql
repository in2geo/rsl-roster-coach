-- ============================================================================
-- 2026-08-07 — champion_tags for the 8 newly-captured champions — APPLIED 2026-08-07
--
-- Derived from champion_skills.skill_summary (HellHades verbatim) by the Tag Review Policies.
-- status='proposed' (HUMAN REVIEW before live matching). source_type='human_observation'.
-- Policy calls applied: immunities skipped (#10); ignore-DEF skipped (#16); self-combo conditionals
-- APPROVED with note (#1: Holguk Decrease C.DMG under his own Hex; Xalgaze Block Active Skills under his
-- own Leech); HP-Burn-tick = Debuff Activation (#12); self-placed [Perfect Veil]/[Shatter] tagged; all
-- revives are ALLY revives → Revive (#21). Idempotent on (champion_id, tag_id).
-- ============================================================================
begin;

-- Heinrik Demondoom
insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by, target_type, ascension_required)
select '6639d81a-f444-4232-8582-607a60ceb503', '1e1764cb-4794-4062-9e36-0a6ecc78e804', 'proposed', 'human_observation', 'HellHades (human-read) 2026-08-07: A1 Sanctified Mace attacks 1 enemy 2 times', 'hellhades-capture-2026-08-07', 'single', 0
  where not exists (select 1 from champion_tags where champion_id='6639d81a-f444-4232-8582-607a60ceb503' and tag_id='1e1764cb-4794-4062-9e36-0a6ecc78e804');
insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by, target_type, ascension_required)
select '6639d81a-f444-4232-8582-607a60ceb503', 'ba40aec7-e700-4a0a-be7d-cd7ae271e71f', 'proposed', 'human_observation', 'HellHades (human-read) 2026-08-07: A1 each hit -10% TM (-20% if target under a control debuff)', 'hellhades-capture-2026-08-07', 'single', 0
  where not exists (select 1 from champion_tags where champion_id='6639d81a-f444-4232-8582-607a60ceb503' and tag_id='ba40aec7-e700-4a0a-be7d-cd7ae271e71f');
insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by, target_type, ascension_required)
select '6639d81a-f444-4232-8582-607a60ceb503', 'f4477327-58a6-44f3-9df6-229636ee8c72', 'proposed', 'human_observation', 'HellHades (human-read) 2026-08-07: A2 Evil Begone! [Stun] 1t on all enemies', 'hellhades-capture-2026-08-07', 'aoe', 0
  where not exists (select 1 from champion_tags where champion_id='6639d81a-f444-4232-8582-607a60ceb503' and tag_id='f4477327-58a6-44f3-9df6-229636ee8c72');
insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by, target_type, ascension_required)
select '6639d81a-f444-4232-8582-607a60ceb503', 'fa4a649a-376c-4071-9719-6b6cde85c326', 'proposed', 'human_observation', 'HellHades (human-read) 2026-08-07: A2 30% [Decrease SPD] 2t on all enemies', 'hellhades-capture-2026-08-07', 'aoe', 0
  where not exists (select 1 from champion_tags where champion_id='6639d81a-f444-4232-8582-607a60ceb503' and tag_id='fa4a649a-376c-4071-9719-6b6cde85c326');
insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by, target_type, ascension_required)
select '6639d81a-f444-4232-8582-607a60ceb503', '8dd046f2-679c-4ff5-9b38-987b7a6af674', 'proposed', 'human_observation', 'HellHades (human-read) 2026-08-07: A2 attacks all enemies', 'hellhades-capture-2026-08-07', 'aoe', 0
  where not exists (select 1 from champion_tags where champion_id='6639d81a-f444-4232-8582-607a60ceb503' and tag_id='8dd046f2-679c-4ff5-9b38-987b7a6af674');
insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by, target_type, ascension_required)
select '6639d81a-f444-4232-8582-607a60ceb503', 'ca018a80-426e-44e2-bd2c-7e869cbf18df', 'proposed', 'human_observation', 'HellHades (human-read) 2026-08-07: A3 Hateful Orator 30% [Increase SPD] all allies 2t', 'hellhades-capture-2026-08-07', 'aoe', 0
  where not exists (select 1 from champion_tags where champion_id='6639d81a-f444-4232-8582-607a60ceb503' and tag_id='ca018a80-426e-44e2-bd2c-7e869cbf18df');
insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by, target_type, ascension_required)
select '6639d81a-f444-4232-8582-607a60ceb503', '5b1ed025-47ed-463b-9888-508efc3448bc', 'proposed', 'human_observation', 'HellHades (human-read) 2026-08-07: A3 50% [Increase ACC] all allies 2t', 'hellhades-capture-2026-08-07', 'aoe', 0
  where not exists (select 1 from champion_tags where champion_id='6639d81a-f444-4232-8582-607a60ceb503' and tag_id='5b1ed025-47ed-463b-9888-508efc3448bc');
insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by, target_type, ascension_required)
select '6639d81a-f444-4232-8582-607a60ceb503', '46652e93-6acc-498e-bfba-b5933657509d', 'proposed', 'human_observation', 'HellHades (human-read) 2026-08-07: A3 steals 50% of each enemy Turn Meter', 'hellhades-capture-2026-08-07', 'aoe', 0
  where not exists (select 1 from champion_tags where champion_id='6639d81a-f444-4232-8582-607a60ceb503' and tag_id='46652e93-6acc-498e-bfba-b5933657509d');
insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by, target_type, ascension_required)
select '6639d81a-f444-4232-8582-607a60ceb503', 'e32b9628-19b6-468b-8020-a77a79d9d423', 'proposed', 'human_observation', 'HellHades (human-read) 2026-08-07: Passive Renewed Purpose fills ally TM 10% on control events', 'hellhades-capture-2026-08-07', 'aoe', 0
  where not exists (select 1 from champion_tags where champion_id='6639d81a-f444-4232-8582-607a60ceb503' and tag_id='e32b9628-19b6-468b-8020-a77a79d9d423');
insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by, target_type, ascension_required)
select '6639d81a-f444-4232-8582-607a60ceb503', '6d9e0045-0222-44d6-8c93-4a03bb9f5a5e', 'proposed', 'human_observation', 'HellHades (human-read) 2026-08-07: Aura: Ally SPD +25% All Battles', 'hellhades-capture-2026-08-07', 'unknown', 3
  where not exists (select 1 from champion_tags where champion_id='6639d81a-f444-4232-8582-607a60ceb503' and tag_id='6d9e0045-0222-44d6-8c93-4a03bb9f5a5e');

-- Haggibah the Nestmaid
insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by, target_type, ascension_required)
select '78d7b646-e181-4c00-884e-41a7cbabcf92', '6d05a9c9-0cab-44e6-bd96-4f9b9eb37021', 'proposed', 'human_observation', 'HellHades (human-read) 2026-08-07: A1 Blast Of Purification 75% [HP Burn] 2t', 'hellhades-capture-2026-08-07', 'single', 0
  where not exists (select 1 from champion_tags where champion_id='78d7b646-e181-4c00-884e-41a7cbabcf92' and tag_id='6d05a9c9-0cab-44e6-bd96-4f9b9eb37021');
insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by, target_type, ascension_required)
select '78d7b646-e181-4c00-884e-41a7cbabcf92', 'c94cf8c9-595b-455f-a228-6da6e7205bce', 'proposed', 'human_observation', 'HellHades (human-read) 2026-08-07: A1 places [Perfect Veil] on self 1t', 'hellhades-capture-2026-08-07', 'single', 0
  where not exists (select 1 from champion_tags where champion_id='78d7b646-e181-4c00-884e-41a7cbabcf92' and tag_id='c94cf8c9-595b-455f-a228-6da6e7205bce');
insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by, target_type, ascension_required)
select '78d7b646-e181-4c00-884e-41a7cbabcf92', 'ef411c41-0bf1-42cd-b91d-b77879385cc2', 'proposed', 'human_observation', 'HellHades (human-read) 2026-08-07: A2 Insidious Eruption activates one tick of all [HP Burn] (policy #12)', 'hellhades-capture-2026-08-07', 'aoe', 0
  where not exists (select 1 from champion_tags where champion_id='78d7b646-e181-4c00-884e-41a7cbabcf92' and tag_id='ef411c41-0bf1-42cd-b91d-b77879385cc2');
insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by, target_type, ascension_required)
select '78d7b646-e181-4c00-884e-41a7cbabcf92', 'e17af464-a61c-43bc-86fb-f416cfe6fe1a', 'proposed', 'human_observation', 'HellHades (human-read) 2026-08-07: A2 75% [Leech] 2t', 'hellhades-capture-2026-08-07', 'aoe', 0
  where not exists (select 1 from champion_tags where champion_id='78d7b646-e181-4c00-884e-41a7cbabcf92' and tag_id='e17af464-a61c-43bc-86fb-f416cfe6fe1a');
insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by, target_type, ascension_required)
select '78d7b646-e181-4c00-884e-41a7cbabcf92', '8dd046f2-679c-4ff5-9b38-987b7a6af674', 'proposed', 'human_observation', 'HellHades (human-read) 2026-08-07: A2 attacks all enemies', 'hellhades-capture-2026-08-07', 'aoe', 0
  where not exists (select 1 from champion_tags where champion_id='78d7b646-e181-4c00-884e-41a7cbabcf92' and tag_id='8dd046f2-679c-4ff5-9b38-987b7a6af674');
insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by, target_type, ascension_required)
select '78d7b646-e181-4c00-884e-41a7cbabcf92', 'c4e01135-5d61-4305-8621-0ac777b5e058', 'proposed', 'human_observation', 'HellHades (human-read) 2026-08-07: A3 Larval Consumption steals all buffs from all enemies', 'hellhades-capture-2026-08-07', 'aoe', 0
  where not exists (select 1 from champion_tags where champion_id='78d7b646-e181-4c00-884e-41a7cbabcf92' and tag_id='c4e01135-5d61-4305-8621-0ac777b5e058');
insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by, target_type, ascension_required)
select '78d7b646-e181-4c00-884e-41a7cbabcf92', '77d2d38d-031b-48a3-8267-a2fa089e7e88', 'proposed', 'human_observation', 'HellHades (human-read) 2026-08-07: A3 two [Bomb] on all enemies (2t; 1t vs no-buff); passive reactive Bomb', 'hellhades-capture-2026-08-07', 'aoe', 0
  where not exists (select 1 from champion_tags where champion_id='78d7b646-e181-4c00-884e-41a7cbabcf92' and tag_id='77d2d38d-031b-48a3-8267-a2fa089e7e88');
insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by, target_type, ascension_required)
select '78d7b646-e181-4c00-884e-41a7cbabcf92', '4d3021bd-c728-4175-bc2b-1760998a256d', 'proposed', 'human_observation', 'HellHades (human-read) 2026-08-07: Aura: Ally HP +30% All Battles', 'hellhades-capture-2026-08-07', 'unknown', 3
  where not exists (select 1 from champion_tags where champion_id='78d7b646-e181-4c00-884e-41a7cbabcf92' and tag_id='4d3021bd-c728-4175-bc2b-1760998a256d');

-- Celendiel the Opal Guardian
insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by, target_type, ascension_required)
select '32b93107-8252-4f67-a0a3-e707531225ee', '22a57e74-2b78-4df0-ba77-f83347ce2317', 'proposed', 'human_observation', 'HellHades (human-read) 2026-08-07: A1 Opal Thrust 50% [Stun] 1t, unresistable', 'hellhades-capture-2026-08-07', 'single', 0
  where not exists (select 1 from champion_tags where champion_id='32b93107-8252-4f67-a0a3-e707531225ee' and tag_id='22a57e74-2b78-4df0-ba77-f83347ce2317');
insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by, target_type, ascension_required)
select '32b93107-8252-4f67-a0a3-e707531225ee', '98bbbae2-6d09-44bf-8a85-85027baddf77', 'proposed', 'human_observation', 'HellHades (human-read) 2026-08-07: A2 Agent Of Light 60% [Increase DEF] all allies 2t', 'hellhades-capture-2026-08-07', 'aoe', 0
  where not exists (select 1 from champion_tags where champion_id='32b93107-8252-4f67-a0a3-e707531225ee' and tag_id='98bbbae2-6d09-44bf-8a85-85027baddf77');
insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by, target_type, ascension_required)
select '32b93107-8252-4f67-a0a3-e707531225ee', '99d86987-4054-4359-85eb-6bf7ce6c1c1d', 'proposed', 'human_observation', 'HellHades (human-read) 2026-08-07: A2 places 15% [Shatter] on self 2t', 'hellhades-capture-2026-08-07', 'single', 0
  where not exists (select 1 from champion_tags where champion_id='32b93107-8252-4f67-a0a3-e707531225ee' and tag_id='99d86987-4054-4359-85eb-6bf7ce6c1c1d');
insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by, target_type, ascension_required)
select '32b93107-8252-4f67-a0a3-e707531225ee', '8dd046f2-679c-4ff5-9b38-987b7a6af674', 'proposed', 'human_observation', 'HellHades (human-read) 2026-08-07: A3 Eternal Defender attacks all enemies', 'hellhades-capture-2026-08-07', 'aoe', 0
  where not exists (select 1 from champion_tags where champion_id='32b93107-8252-4f67-a0a3-e707531225ee' and tag_id='8dd046f2-679c-4ff5-9b38-987b7a6af674');
insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by, target_type, ascension_required)
select '32b93107-8252-4f67-a0a3-e707531225ee', '845648cb-ab94-4189-8adc-cf53428cb89a', 'proposed', 'human_observation', 'HellHades (human-read) 2026-08-07: A3 [Unkillable] all allies 1t', 'hellhades-capture-2026-08-07', 'aoe', 0
  where not exists (select 1 from champion_tags where champion_id='32b93107-8252-4f67-a0a3-e707531225ee' and tag_id='845648cb-ab94-4189-8adc-cf53428cb89a');
insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by, target_type, ascension_required)
select '32b93107-8252-4f67-a0a3-e707531225ee', '978056f7-310b-48d1-b411-1b67f279f837', 'proposed', 'human_observation', 'HellHades (human-read) 2026-08-07: A3 [Counterattack] all allies 2t', 'hellhades-capture-2026-08-07', 'aoe', 0
  where not exists (select 1 from champion_tags where champion_id='32b93107-8252-4f67-a0a3-e707531225ee' and tag_id='978056f7-310b-48d1-b411-1b67f279f837');
insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by, target_type, ascension_required)
select '32b93107-8252-4f67-a0a3-e707531225ee', '69e1a96c-45b6-4f5d-ac8f-ca91d0314265', 'proposed', 'human_observation', 'HellHades (human-read) 2026-08-07: Aura: Ally DEF +33% All Battles', 'hellhades-capture-2026-08-07', 'unknown', 3
  where not exists (select 1 from champion_tags where champion_id='32b93107-8252-4f67-a0a3-e707531225ee' and tag_id='69e1a96c-45b6-4f5d-ac8f-ca91d0314265');

-- Aria the Golden Hope
insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by, target_type, ascension_required)
select 'b0d2304c-afa3-4b89-ae98-8afd9082adbd', '1a051b19-c263-4c16-9898-0a26dac0ef93', 'proposed', 'human_observation', 'HellHades (human-read) 2026-08-07: A1 Blazing Glory 75% 100% [Heal Reduction] 2t (+ passive activation <50% HP)', 'hellhades-capture-2026-08-07', 'single', 0
  where not exists (select 1 from champion_tags where champion_id='b0d2304c-afa3-4b89-ae98-8afd9082adbd' and tag_id='1a051b19-c263-4c16-9898-0a26dac0ef93');
insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by, target_type, ascension_required)
select 'b0d2304c-afa3-4b89-ae98-8afd9082adbd', 'd0e41808-629c-4271-81d7-ea0d720e35d7', 'proposed', 'human_observation', 'HellHades (human-read) 2026-08-07: A2 Halcyon Boons 25% [Fortify] all allies 2t', 'hellhades-capture-2026-08-07', 'aoe', 0
  where not exists (select 1 from champion_tags where champion_id='b0d2304c-afa3-4b89-ae98-8afd9082adbd' and tag_id='d0e41808-629c-4271-81d7-ea0d720e35d7');
insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by, target_type, ascension_required)
select 'b0d2304c-afa3-4b89-ae98-8afd9082adbd', '00ff45c2-765e-46d8-993c-218ff7fe9a72', 'proposed', 'human_observation', 'HellHades (human-read) 2026-08-07: A2 25% [Strengthen] all allies 2t', 'hellhades-capture-2026-08-07', 'aoe', 0
  where not exists (select 1 from champion_tags where champion_id='b0d2304c-afa3-4b89-ae98-8afd9082adbd' and tag_id='00ff45c2-765e-46d8-993c-218ff7fe9a72');
insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by, target_type, ascension_required)
select 'b0d2304c-afa3-4b89-ae98-8afd9082adbd', '8dd046f2-679c-4ff5-9b38-987b7a6af674', 'proposed', 'human_observation', 'HellHades (human-read) 2026-08-07: A2/A3 attack all enemies', 'hellhades-capture-2026-08-07', 'aoe', 0
  where not exists (select 1 from champion_tags where champion_id='b0d2304c-afa3-4b89-ae98-8afd9082adbd' and tag_id='8dd046f2-679c-4ff5-9b38-987b7a6af674');
insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by, target_type, ascension_required)
select 'b0d2304c-afa3-4b89-ae98-8afd9082adbd', 'c4e01135-5d61-4305-8621-0ac777b5e058', 'proposed', 'human_observation', 'HellHades (human-read) 2026-08-07: A3 Avatar Of Victory 75% steal all buffs from all enemies', 'hellhades-capture-2026-08-07', 'aoe', 0
  where not exists (select 1 from champion_tags where champion_id='b0d2304c-afa3-4b89-ae98-8afd9082adbd' and tag_id='c4e01135-5d61-4305-8621-0ac777b5e058');
insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by, target_type, ascension_required)
select 'b0d2304c-afa3-4b89-ae98-8afd9082adbd', 'cfba716d-ab90-4e08-8d67-bb5b913516bb', 'proposed', 'human_observation', 'HellHades (human-read) 2026-08-07: A3 75% [True Fear] 1t', 'hellhades-capture-2026-08-07', 'aoe', 0
  where not exists (select 1 from champion_tags where champion_id='b0d2304c-afa3-4b89-ae98-8afd9082adbd' and tag_id='cfba716d-ab90-4e08-8d67-bb5b913516bb');
insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by, target_type, ascension_required)
select 'b0d2304c-afa3-4b89-ae98-8afd9082adbd', 'a55ea2cd-4f03-4d1d-8540-dee4e678bfd3', 'proposed', 'human_observation', 'HellHades (human-read) 2026-08-07: A3 75% [Block Passive Skills] 2t', 'hellhades-capture-2026-08-07', 'aoe', 0
  where not exists (select 1 from champion_tags where champion_id='b0d2304c-afa3-4b89-ae98-8afd9082adbd' and tag_id='a55ea2cd-4f03-4d1d-8540-dee4e678bfd3');
insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by, target_type, ascension_required)
select 'b0d2304c-afa3-4b89-ae98-8afd9082adbd', '46652e93-6acc-498e-bfba-b5933657509d', 'proposed', 'human_observation', 'HellHades (human-read) 2026-08-07: Passive Surefire Success -5% all enemy TM before their turn (not vs bosses)', 'hellhades-capture-2026-08-07', 'aoe', 3
  where not exists (select 1 from champion_tags where champion_id='b0d2304c-afa3-4b89-ae98-8afd9082adbd' and tag_id='46652e93-6acc-498e-bfba-b5933657509d');
insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by, target_type, ascension_required)
select 'b0d2304c-afa3-4b89-ae98-8afd9082adbd', '6d9e0045-0222-44d6-8c93-4a03bb9f5a5e', 'proposed', 'human_observation', 'HellHades (human-read) 2026-08-07: Aura: Spirit Ally SPD +25% All Battles (affinity-restricted)', 'hellhades-capture-2026-08-07', 'unknown', 3
  where not exists (select 1 from champion_tags where champion_id='b0d2304c-afa3-4b89-ae98-8afd9082adbd' and tag_id='6d9e0045-0222-44d6-8c93-4a03bb9f5a5e');

-- Holguk of the Hallowsights
insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by, target_type, ascension_required)
select '91fbbb1f-547b-4826-98f0-66be1a6404ee', '7d117838-1c93-4429-9418-0b87c3fad821', 'proposed', 'human_observation', 'HellHades (human-read) 2026-08-07: A1 Skull Staff Pummel 80% 30% [Decrease C.RATE] 2t', 'hellhades-capture-2026-08-07', 'single', 0
  where not exists (select 1 from champion_tags where champion_id='91fbbb1f-547b-4826-98f0-66be1a6404ee' and tag_id='7d117838-1c93-4429-9418-0b87c3fad821');
insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by, target_type, ascension_required)
select '91fbbb1f-547b-4826-98f0-66be1a6404ee', 'b3fe005f-e740-4d55-9eae-46614ff35a84', 'proposed', 'human_observation', 'HellHades (human-read) 2026-08-07: A1 25% [Decrease C.DMG] 2t if target under [Hex] (self-combo: his A2 places Hex; policy #1)', 'hellhades-capture-2026-08-07', 'conditional_single', 0
  where not exists (select 1 from champion_tags where champion_id='91fbbb1f-547b-4826-98f0-66be1a6404ee' and tag_id='b3fe005f-e740-4d55-9eae-46614ff35a84');
insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by, target_type, ascension_required)
select '91fbbb1f-547b-4826-98f0-66be1a6404ee', 'aca51e00-28db-411f-b71d-5e7473c29a26', 'proposed', 'human_observation', 'HellHades (human-read) 2026-08-07: A2 Hallowhex 75% [Block Buffs] 2t all', 'hellhades-capture-2026-08-07', 'aoe', 0
  where not exists (select 1 from champion_tags where champion_id='91fbbb1f-547b-4826-98f0-66be1a6404ee' and tag_id='aca51e00-28db-411f-b71d-5e7473c29a26');
insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by, target_type, ascension_required)
select '91fbbb1f-547b-4826-98f0-66be1a6404ee', '1e1f6e90-17cf-4076-828e-cd595a827a5d', 'proposed', 'human_observation', 'HellHades (human-read) 2026-08-07: A2 75% [Hex] 2t all (cannot be removed/stolen/transferred)', 'hellhades-capture-2026-08-07', 'aoe', 0
  where not exists (select 1 from champion_tags where champion_id='91fbbb1f-547b-4826-98f0-66be1a6404ee' and tag_id='1e1f6e90-17cf-4076-828e-cd595a827a5d');
insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by, target_type, ascension_required)
select '91fbbb1f-547b-4826-98f0-66be1a6404ee', 'f54cd3e4-90b2-44d5-bbda-12adbded4aa0', 'proposed', 'human_observation', 'HellHades (human-read) 2026-08-07: A2 75% decrease all enemy buff durations by 2 turns', 'hellhades-capture-2026-08-07', 'aoe', 0
  where not exists (select 1 from champion_tags where champion_id='91fbbb1f-547b-4826-98f0-66be1a6404ee' and tag_id='f54cd3e4-90b2-44d5-bbda-12adbded4aa0');
insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by, target_type, ascension_required)
select '91fbbb1f-547b-4826-98f0-66be1a6404ee', '8dd046f2-679c-4ff5-9b38-987b7a6af674', 'proposed', 'human_observation', 'HellHades (human-read) 2026-08-07: A2 attacks all enemies', 'hellhades-capture-2026-08-07', 'aoe', 0
  where not exists (select 1 from champion_tags where champion_id='91fbbb1f-547b-4826-98f0-66be1a6404ee' and tag_id='8dd046f2-679c-4ff5-9b38-987b7a6af674');
insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by, target_type, ascension_required)
select '91fbbb1f-547b-4826-98f0-66be1a6404ee', '7cfe4ed3-f6d9-4c54-b935-6e813fb5cd34', 'proposed', 'human_observation', 'HellHades (human-read) 2026-08-07: A3 Spirit-Speaker revives all dead allies (50% HP/TM)', 'hellhades-capture-2026-08-07', 'aoe', 0
  where not exists (select 1 from champion_tags where champion_id='91fbbb1f-547b-4826-98f0-66be1a6404ee' and tag_id='7cfe4ed3-f6d9-4c54-b935-6e813fb5cd34');
insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by, target_type, ascension_required)
select '91fbbb1f-547b-4826-98f0-66be1a6404ee', 'f945d363-0360-429e-884a-5c9526706221', 'proposed', 'human_observation', 'HellHades (human-read) 2026-08-07: A3 [Revive on Death] all allies 1t', 'hellhades-capture-2026-08-07', 'aoe', 0
  where not exists (select 1 from champion_tags where champion_id='91fbbb1f-547b-4826-98f0-66be1a6404ee' and tag_id='f945d363-0360-429e-884a-5c9526706221');
insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by, target_type, ascension_required)
select '91fbbb1f-547b-4826-98f0-66be1a6404ee', 'cdce52df-f566-432e-a78b-ec032a93649f', 'proposed', 'human_observation', 'HellHades (human-read) 2026-08-07: A3 [Shield] 30% of MAX HP on all allies 2t', 'hellhades-capture-2026-08-07', 'aoe', 0
  where not exists (select 1 from champion_tags where champion_id='91fbbb1f-547b-4826-98f0-66be1a6404ee' and tag_id='cdce52df-f566-432e-a78b-ec032a93649f');
insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by, target_type, ascension_required)
select '91fbbb1f-547b-4826-98f0-66be1a6404ee', '6d9e0045-0222-44d6-8c93-4a03bb9f5a5e', 'proposed', 'human_observation', 'HellHades (human-read) 2026-08-07: Aura: Ally SPD +28% Arena', 'hellhades-capture-2026-08-07', 'unknown', 3
  where not exists (select 1 from champion_tags where champion_id='91fbbb1f-547b-4826-98f0-66be1a6404ee' and tag_id='6d9e0045-0222-44d6-8c93-4a03bb9f5a5e');

-- Xanthe Seaflower
insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by, target_type, ascension_required)
select 'c4610046-decc-41a8-afdb-1910865fa3d3', 'aca51e00-28db-411f-b71d-5e7473c29a26', 'proposed', 'human_observation', 'HellHades (human-read) 2026-08-07: A1 Arrow Of Languor 50% [Block Buffs] 2t', 'hellhades-capture-2026-08-07', 'single', 0
  where not exists (select 1 from champion_tags where champion_id='c4610046-decc-41a8-afdb-1910865fa3d3' and tag_id='aca51e00-28db-411f-b71d-5e7473c29a26');
insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by, target_type, ascension_required)
select 'c4610046-decc-41a8-afdb-1910865fa3d3', '7c81924a-6be6-42dd-a748-24394626ee1a', 'proposed', 'human_observation', 'HellHades (human-read) 2026-08-07: A2 Passionroot Volley 75% 50% [Decrease ATK] 2t all', 'hellhades-capture-2026-08-07', 'aoe', 0
  where not exists (select 1 from champion_tags where champion_id='c4610046-decc-41a8-afdb-1910865fa3d3' and tag_id='7c81924a-6be6-42dd-a748-24394626ee1a');
insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by, target_type, ascension_required)
select 'c4610046-decc-41a8-afdb-1910865fa3d3', 'f373cd9a-6bd2-4a4b-85e8-eac03fddbb5b', 'proposed', 'human_observation', 'HellHades (human-read) 2026-08-07: A2 heals all allies 5% MAX HP per debuff placed', 'hellhades-capture-2026-08-07', 'aoe', 0
  where not exists (select 1 from champion_tags where champion_id='c4610046-decc-41a8-afdb-1910865fa3d3' and tag_id='f373cd9a-6bd2-4a4b-85e8-eac03fddbb5b');
insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by, target_type, ascension_required)
select 'c4610046-decc-41a8-afdb-1910865fa3d3', '8dd046f2-679c-4ff5-9b38-987b7a6af674', 'proposed', 'human_observation', 'HellHades (human-read) 2026-08-07: A2 attacks all enemies', 'hellhades-capture-2026-08-07', 'aoe', 0
  where not exists (select 1 from champion_tags where champion_id='c4610046-decc-41a8-afdb-1910865fa3d3' and tag_id='8dd046f2-679c-4ff5-9b38-987b7a6af674');
insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by, target_type, ascension_required)
select 'c4610046-decc-41a8-afdb-1910865fa3d3', '0ceb6494-e9bd-4f5d-aa68-5538545712d7', 'proposed', 'human_observation', 'HellHades (human-read) 2026-08-07: A3 Generous Friend 50% [Increase RES] all allies 2t', 'hellhades-capture-2026-08-07', 'aoe', 0
  where not exists (select 1 from champion_tags where champion_id='c4610046-decc-41a8-afdb-1910865fa3d3' and tag_id='0ceb6494-e9bd-4f5d-aa68-5538545712d7');
insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by, target_type, ascension_required)
select 'c4610046-decc-41a8-afdb-1910865fa3d3', 'a00d9203-203a-42b3-a94a-149e12ca39c6', 'proposed', 'human_observation', 'HellHades (human-read) 2026-08-07: A3 protected 15% [Continuous Heal] all allies 2t', 'hellhades-capture-2026-08-07', 'aoe', 0
  where not exists (select 1 from champion_tags where champion_id='c4610046-decc-41a8-afdb-1910865fa3d3' and tag_id='a00d9203-203a-42b3-a94a-149e12ca39c6');
insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by, target_type, ascension_required)
select 'c4610046-decc-41a8-afdb-1910865fa3d3', 'e2f58a30-7952-49d4-858d-a118139fe2f6', 'proposed', 'human_observation', 'HellHades (human-read) 2026-08-07: AoE heal (A2) + Continuous Heal (A3) + self Continuous Heal (passive)', 'hellhades-capture-2026-08-07', 'unknown', 0
  where not exists (select 1 from champion_tags where champion_id='c4610046-decc-41a8-afdb-1910865fa3d3' and tag_id='e2f58a30-7952-49d4-858d-a118139fe2f6');
insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by, target_type, ascension_required)
select 'c4610046-decc-41a8-afdb-1910865fa3d3', '69e1a96c-45b6-4f5d-ac8f-ca91d0314265', 'proposed', 'human_observation', 'HellHades (human-read) 2026-08-07: Aura: Ally DEF +30% Faction Wars', 'hellhades-capture-2026-08-07', 'unknown', 3
  where not exists (select 1 from champion_tags where champion_id='c4610046-decc-41a8-afdb-1910865fa3d3' and tag_id='69e1a96c-45b6-4f5d-ac8f-ca91d0314265');

-- Khamir Scald-eye
insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by, target_type, ascension_required)
select '4737a72b-bc8c-4e43-8d8d-4b47b6af89cc', '1e1764cb-4794-4062-9e36-0a6ecc78e804', 'proposed', 'human_observation', 'HellHades (human-read) 2026-08-07: A1 Dark Restoration attacks 1 enemy 2 times', 'hellhades-capture-2026-08-07', 'single', 0
  where not exists (select 1 from champion_tags where champion_id='4737a72b-bc8c-4e43-8d8d-4b47b6af89cc' and tag_id='1e1764cb-4794-4062-9e36-0a6ecc78e804');
insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by, target_type, ascension_required)
select '4737a72b-bc8c-4e43-8d8d-4b47b6af89cc', 'f373cd9a-6bd2-4a4b-85e8-eac03fddbb5b', 'proposed', 'human_observation', 'HellHades (human-read) 2026-08-07: A1 heals all allies 5% MAX HP per hit (+ passive on ally death)', 'hellhades-capture-2026-08-07', 'aoe', 0
  where not exists (select 1 from champion_tags where champion_id='4737a72b-bc8c-4e43-8d8d-4b47b6af89cc' and tag_id='f373cd9a-6bd2-4a4b-85e8-eac03fddbb5b');
insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by, target_type, ascension_required)
select '4737a72b-bc8c-4e43-8d8d-4b47b6af89cc', 'e2f58a30-7952-49d4-858d-a118139fe2f6', 'proposed', 'human_observation', 'HellHades (human-read) 2026-08-07: AoE heal (A1) + passive heal-on-death', 'hellhades-capture-2026-08-07', 'unknown', 0
  where not exists (select 1 from champion_tags where champion_id='4737a72b-bc8c-4e43-8d8d-4b47b6af89cc' and tag_id='e2f58a30-7952-49d4-858d-a118139fe2f6');
insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by, target_type, ascension_required)
select '4737a72b-bc8c-4e43-8d8d-4b47b6af89cc', 'e32b9628-19b6-468b-8020-a77a79d9d423', 'proposed', 'human_observation', 'HellHades (human-read) 2026-08-07: A2 Gloom-Powered fills all allies TM 25% (+ passive)', 'hellhades-capture-2026-08-07', 'aoe', 0
  where not exists (select 1 from champion_tags where champion_id='4737a72b-bc8c-4e43-8d8d-4b47b6af89cc' and tag_id='e32b9628-19b6-468b-8020-a77a79d9d423');
insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by, target_type, ascension_required)
select '4737a72b-bc8c-4e43-8d8d-4b47b6af89cc', '466efeab-39d1-4f71-b466-b40c5408e0ec', 'proposed', 'human_observation', 'HellHades (human-read) 2026-08-07: A2 50% [Increase ATK] all allies 2t', 'hellhades-capture-2026-08-07', 'aoe', 0
  where not exists (select 1 from champion_tags where champion_id='4737a72b-bc8c-4e43-8d8d-4b47b6af89cc' and tag_id='466efeab-39d1-4f71-b466-b40c5408e0ec');
insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by, target_type, ascension_required)
select '4737a72b-bc8c-4e43-8d8d-4b47b6af89cc', 'ca018a80-426e-44e2-bd2c-7e869cbf18df', 'proposed', 'human_observation', 'HellHades (human-read) 2026-08-07: A2 30% [Increase SPD] all allies 2t', 'hellhades-capture-2026-08-07', 'aoe', 0
  where not exists (select 1 from champion_tags where champion_id='4737a72b-bc8c-4e43-8d8d-4b47b6af89cc' and tag_id='ca018a80-426e-44e2-bd2c-7e869cbf18df');
insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by, target_type, ascension_required)
select '4737a72b-bc8c-4e43-8d8d-4b47b6af89cc', '7cfe4ed3-f6d9-4c54-b935-6e813fb5cd34', 'proposed', 'human_observation', 'HellHades (human-read) 2026-08-07: A3 Death Is Weakness revives all dead allies (50% HP/TM)', 'hellhades-capture-2026-08-07', 'aoe', 0
  where not exists (select 1 from champion_tags where champion_id='4737a72b-bc8c-4e43-8d8d-4b47b6af89cc' and tag_id='7cfe4ed3-f6d9-4c54-b935-6e813fb5cd34');
insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by, target_type, ascension_required)
select '4737a72b-bc8c-4e43-8d8d-4b47b6af89cc', '98bbbae2-6d09-44bf-8a85-85027baddf77', 'proposed', 'human_observation', 'HellHades (human-read) 2026-08-07: A3 60% [Increase DEF] all allies 2t', 'hellhades-capture-2026-08-07', 'aoe', 0
  where not exists (select 1 from champion_tags where champion_id='4737a72b-bc8c-4e43-8d8d-4b47b6af89cc' and tag_id='98bbbae2-6d09-44bf-8a85-85027baddf77');
insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by, target_type, ascension_required)
select '4737a72b-bc8c-4e43-8d8d-4b47b6af89cc', '00ff45c2-765e-46d8-993c-218ff7fe9a72', 'proposed', 'human_observation', 'HellHades (human-read) 2026-08-07: A3 [Strengthen] all allies 2t', 'hellhades-capture-2026-08-07', 'aoe', 0
  where not exists (select 1 from champion_tags where champion_id='4737a72b-bc8c-4e43-8d8d-4b47b6af89cc' and tag_id='00ff45c2-765e-46d8-993c-218ff7fe9a72');
insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by, target_type, ascension_required)
select '4737a72b-bc8c-4e43-8d8d-4b47b6af89cc', '6d9e0045-0222-44d6-8c93-4a03bb9f5a5e', 'proposed', 'human_observation', 'HellHades (human-read) 2026-08-07: Aura: Ally SPD +20% All Battles', 'hellhades-capture-2026-08-07', 'unknown', 3
  where not exists (select 1 from champion_tags where champion_id='4737a72b-bc8c-4e43-8d8d-4b47b6af89cc' and tag_id='6d9e0045-0222-44d6-8c93-4a03bb9f5a5e');

-- Xalgaze Fangwall
insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by, target_type, ascension_required)
select 'fbd2dd61-fa58-448d-8949-86bbe2e90a6e', 'cfba716d-ab90-4e08-8d67-bb5b913516bb', 'proposed', 'human_observation', 'HellHades (human-read) 2026-08-07: A1 Unsettling Warrior 50% [True Fear] 1t', 'hellhades-capture-2026-08-07', 'single', 0
  where not exists (select 1 from champion_tags where champion_id='fbd2dd61-fa58-448d-8949-86bbe2e90a6e' and tag_id='cfba716d-ab90-4e08-8d67-bb5b913516bb');
insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by, target_type, ascension_required)
select 'fbd2dd61-fa58-448d-8949-86bbe2e90a6e', '7b2005cd-5bfe-4603-aaf2-508e645dfa10', 'proposed', 'human_observation', 'HellHades (human-read) 2026-08-07: A1 50% [Block Active Skills] 1t if target under [Leech] (self-combo: his A2 places Leech; policy #1)', 'hellhades-capture-2026-08-07', 'conditional_single', 0
  where not exists (select 1 from champion_tags where champion_id='fbd2dd61-fa58-448d-8949-86bbe2e90a6e' and tag_id='7b2005cd-5bfe-4603-aaf2-508e645dfa10');
insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by, target_type, ascension_required)
select 'fbd2dd61-fa58-448d-8949-86bbe2e90a6e', 'e17af464-a61c-43bc-86fb-f416cfe6fe1a', 'proposed', 'human_observation', 'HellHades (human-read) 2026-08-07: A2 Horrific Mission 75% [Leech] 2t', 'hellhades-capture-2026-08-07', 'aoe', 0
  where not exists (select 1 from champion_tags where champion_id='fbd2dd61-fa58-448d-8949-86bbe2e90a6e' and tag_id='e17af464-a61c-43bc-86fb-f416cfe6fe1a');
insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by, target_type, ascension_required)
select 'fbd2dd61-fa58-448d-8949-86bbe2e90a6e', 'ab6ce8a7-83e4-436a-9de4-14818e885b7f', 'proposed', 'human_observation', 'HellHades (human-read) 2026-08-07: A2 75% 50% [Decrease RES] 2t', 'hellhades-capture-2026-08-07', 'aoe', 0
  where not exists (select 1 from champion_tags where champion_id='fbd2dd61-fa58-448d-8949-86bbe2e90a6e' and tag_id='ab6ce8a7-83e4-436a-9de4-14818e885b7f');
insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by, target_type, ascension_required)
select 'fbd2dd61-fa58-448d-8949-86bbe2e90a6e', '8dd046f2-679c-4ff5-9b38-987b7a6af674', 'proposed', 'human_observation', 'HellHades (human-read) 2026-08-07: A2 attacks all enemies 2 times', 'hellhades-capture-2026-08-07', 'aoe', 0
  where not exists (select 1 from champion_tags where champion_id='fbd2dd61-fa58-448d-8949-86bbe2e90a6e' and tag_id='8dd046f2-679c-4ff5-9b38-987b7a6af674');
insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by, target_type, ascension_required)
select 'fbd2dd61-fa58-448d-8949-86bbe2e90a6e', '98bbbae2-6d09-44bf-8a85-85027baddf77', 'proposed', 'human_observation', 'HellHades (human-read) 2026-08-07: A3 Unholy Resilience 60% [Increase DEF] all allies 2t', 'hellhades-capture-2026-08-07', 'aoe', 0
  where not exists (select 1 from champion_tags where champion_id='fbd2dd61-fa58-448d-8949-86bbe2e90a6e' and tag_id='98bbbae2-6d09-44bf-8a85-85027baddf77');
insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by, target_type, ascension_required)
select 'fbd2dd61-fa58-448d-8949-86bbe2e90a6e', '5b1ed025-47ed-463b-9888-508efc3448bc', 'proposed', 'human_observation', 'HellHades (human-read) 2026-08-07: A3 50% [Increase ACC] all allies 2t', 'hellhades-capture-2026-08-07', 'aoe', 0
  where not exists (select 1 from champion_tags where champion_id='fbd2dd61-fa58-448d-8949-86bbe2e90a6e' and tag_id='5b1ed025-47ed-463b-9888-508efc3448bc');
insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by, target_type, ascension_required)
select 'fbd2dd61-fa58-448d-8949-86bbe2e90a6e', 'ea0b3ec8-2c30-4470-a552-f14128558152', 'proposed', 'human_observation', 'HellHades (human-read) 2026-08-07: A3 30% [Reflect Damage] all allies 2t (+ passive enhances + self-reflect)', 'hellhades-capture-2026-08-07', 'aoe', 0
  where not exists (select 1 from champion_tags where champion_id='fbd2dd61-fa58-448d-8949-86bbe2e90a6e' and tag_id='ea0b3ec8-2c30-4470-a552-f14128558152');
insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by, target_type, ascension_required)
select 'fbd2dd61-fa58-448d-8949-86bbe2e90a6e', '69e1a96c-45b6-4f5d-ac8f-ca91d0314265', 'proposed', 'human_observation', 'HellHades (human-read) 2026-08-07: Aura: Ally DEF +30% All Battles', 'hellhades-capture-2026-08-07', 'unknown', 3
  where not exists (select 1 from champion_tags where champion_id='fbd2dd61-fa58-448d-8949-86bbe2e90a6e' and tag_id='69e1a96c-45b6-4f5d-ac8f-ca91d0314265');

commit;
