-- ============================================================================
-- 110 - Tag sweep corrections (2026-07-12). Two systemic failure modes found by
-- reconciling champion_skills.skill_summary vs champion_tags:
--  (FP) ignore-mechanic tokens wrongly APPROVED as placements -> set rejected.
--  (FN) placed debuffs wrongly REJECTED where the only condition was a Veil
--       resistance-bypass clause -> set approved (+ restore Ezio Steal Buffs).
-- Mirrors master worksheet v4.83. See CLAUDE.md new tag policies.
-- ============================================================================
-- FP: reject ignore-mechanic false positives (31)
update champion_tags set status='rejected' where champion_id='83dd5dcc-40cc-4169-9005-6683acf678ea' and tag_id='2cbeed4e-91d5-4048-ad81-eb122986b648' and status='approved';
update champion_tags set status='rejected' where champion_id='970391a3-3264-4db0-bcd3-a3eda6610042' and tag_id='00ff45c2-765e-46d8-993c-218ff7fe9a72' and status='approved';
update champion_tags set status='rejected' where champion_id='1ea363f6-aff2-455f-8b09-c586bc1be715' and tag_id='cf9a9113-7d17-4abf-b851-fd0568282586' and status='approved';
update champion_tags set status='rejected' where champion_id='00404172-1b85-49eb-b353-a0aaaf9cca1f' and tag_id='00ff45c2-765e-46d8-993c-218ff7fe9a72' and status='approved';
update champion_tags set status='rejected' where champion_id='31fbe227-a377-4d1f-bf7d-e9cae67f7a05' and tag_id='2cbeed4e-91d5-4048-ad81-eb122986b648' and status='approved';
update champion_tags set status='rejected' where champion_id='627c3f19-9d78-4c71-a89a-284b1c67d880' and tag_id='cf9a9113-7d17-4abf-b851-fd0568282586' and status='approved';
update champion_tags set status='rejected' where champion_id='a072b00d-beb7-44a0-bbb0-b6587d560bec' and tag_id='cf9a9113-7d17-4abf-b851-fd0568282586' and status='approved';
update champion_tags set status='rejected' where champion_id='a072b00d-beb7-44a0-bbb0-b6587d560bec' and tag_id='98bbbae2-6d09-44bf-8a85-85027baddf77' and status='approved';
update champion_tags set status='rejected' where champion_id='a072b00d-beb7-44a0-bbb0-b6587d560bec' and tag_id='2cbeed4e-91d5-4048-ad81-eb122986b648' and status='approved';
update champion_tags set status='rejected' where champion_id='a072b00d-beb7-44a0-bbb0-b6587d560bec' and tag_id='83f82f06-cd53-4c59-8a83-1cbe8ea3a0f1' and status='approved';
update champion_tags set status='rejected' where champion_id='8284c14d-d0dc-407b-9ddb-7b5ea63ace2e' and tag_id='0529c7bc-cb7a-4d05-ac56-f88939c888ee' and status='approved';
update champion_tags set status='rejected' where champion_id='7930353a-a4e3-4006-8561-ad71df807c55' and tag_id='83f82f06-cd53-4c59-8a83-1cbe8ea3a0f1' and status='approved';
update champion_tags set status='rejected' where champion_id='7930353a-a4e3-4006-8561-ad71df807c55' and tag_id='00ff45c2-765e-46d8-993c-218ff7fe9a72' and status='approved';
update champion_tags set status='rejected' where champion_id='8228db47-444a-498e-92c9-74e7f145bd7e' and tag_id='cf9a9113-7d17-4abf-b851-fd0568282586' and status='approved';
update champion_tags set status='rejected' where champion_id='f73b6bcd-1935-4bd0-9195-a6c41be632cd' and tag_id='cf9a9113-7d17-4abf-b851-fd0568282586' and status='approved';
update champion_tags set status='rejected' where champion_id='d0ec94e3-3d90-4898-99db-92a208ba8ae0' and tag_id='cf9a9113-7d17-4abf-b851-fd0568282586' and status='approved';
update champion_tags set status='rejected' where champion_id='f12dc40e-98fb-4c94-ae5a-9fa00a2d71c2' and tag_id='0529c7bc-cb7a-4d05-ac56-f88939c888ee' and status='approved';
update champion_tags set status='rejected' where champion_id='cd705c45-37b2-4943-9e77-a1d6775a2dc7' and tag_id='83f82f06-cd53-4c59-8a83-1cbe8ea3a0f1' and status='approved';
update champion_tags set status='rejected' where champion_id='cd705c45-37b2-4943-9e77-a1d6775a2dc7' and tag_id='845648cb-ab94-4189-8adc-cf53428cb89a' and status='approved';
update champion_tags set status='rejected' where champion_id='48249fbe-4ff2-4ff5-8770-b0587316fd88' and tag_id='cf9a9113-7d17-4abf-b851-fd0568282586' and status='approved';
update champion_tags set status='rejected' where champion_id='48249fbe-4ff2-4ff5-8770-b0587316fd88' and tag_id='6f547f48-0548-4ce8-bc73-b81f86990dcf' and status='approved';
update champion_tags set status='rejected' where champion_id='48249fbe-4ff2-4ff5-8770-b0587316fd88' and tag_id='845648cb-ab94-4189-8adc-cf53428cb89a' and status='approved';
update champion_tags set status='rejected' where champion_id='94826114-c84b-4adc-b1d4-23ab05eb6672' and tag_id='cf9a9113-7d17-4abf-b851-fd0568282586' and status='approved';
update champion_tags set status='rejected' where champion_id='94826114-c84b-4adc-b1d4-23ab05eb6672' and tag_id='83f82f06-cd53-4c59-8a83-1cbe8ea3a0f1' and status='approved';
update champion_tags set status='rejected' where champion_id='94826114-c84b-4adc-b1d4-23ab05eb6672' and tag_id='845648cb-ab94-4189-8adc-cf53428cb89a' and status='approved';
update champion_tags set status='rejected' where champion_id='d6595122-41cc-467c-b734-5eccc1a7dd6a' and tag_id='cf9a9113-7d17-4abf-b851-fd0568282586' and status='approved';
update champion_tags set status='rejected' where champion_id='d6595122-41cc-467c-b734-5eccc1a7dd6a' and tag_id='6f547f48-0548-4ce8-bc73-b81f86990dcf' and status='approved';
update champion_tags set status='rejected' where champion_id='ea019155-b47d-42a1-923f-728a093e7d77' and tag_id='cf9a9113-7d17-4abf-b851-fd0568282586' and status='approved';
update champion_tags set status='rejected' where champion_id='ea019155-b47d-42a1-923f-728a093e7d77' and tag_id='83f82f06-cd53-4c59-8a83-1cbe8ea3a0f1' and status='approved';
update champion_tags set status='rejected' where champion_id='ea019155-b47d-42a1-923f-728a093e7d77' and tag_id='845648cb-ab94-4189-8adc-cf53428cb89a' and status='approved';
update champion_tags set status='rejected' where champion_id='c923f52d-7e82-46a3-9794-abc62a0abddb' and tag_id='0529c7bc-cb7a-4d05-ac56-f88939c888ee' and status='approved';
-- FN: approve veil-bypass false negatives + restore Ezio Steal Buffs
insert into champion_tags (champion_id,tag_id,status,source_type,source_note,proposed_by,proposed_at,ascension_required,target_type,approved_by,approved_at) values
  ('6d6389f5-dbd3-42e1-ad99-5a81717a59bc','166d9390-dea2-48d8-a294-b519ab3f5164','approved','human_observation','human_observation Passive 2 Keelhaul [P]: [Ensnare] shown chance 50% - unbooked not back-calculated (books not captured). single-target. REJECTED: conditional (only-if specific debuff); passive - ar=3, verify yellow-star','sweep-fix-2026-07-12',now(),3,'single','sweep-fix-2026-07-12',now()),
  ('00404172-1b85-49eb-b353-a0aaaf9cca1f','6546d98c-e887-4597-a4e1-c49398c48a32','approved','human_observation','human_observation A1 Eagle Dive: [Decrease Defense] shown chance 75% - unbooked not back-calculated (books not captured). single-target. REJECTED: conditional (only-if specific debuff)','sweep-fix-2026-07-12',now(),0,'single','sweep-fix-2026-07-12',now()),
  ('00404172-1b85-49eb-b353-a0aaaf9cca1f','568b58ce-56de-4e88-b5a0-6f4478808c90','approved','human_observation','human_observation A2 Da Vinci''s Design: [Poison] shown chance 75% - unbooked not back-calculated (books not captured). AoE (all enemies). REJECTED: conditional (only-if specific debuff)','sweep-fix-2026-07-12',now(),0,'aoe','sweep-fix-2026-07-12',now()),
  ('00404172-1b85-49eb-b353-a0aaaf9cca1f','201e36cb-9709-4c2b-9128-f2ba63a02f71','approved','human_observation','human_observation A2 Da Vinci''s Design: [Poison Sensitivity] shown chance 75% - unbooked not back-calculated (books not captured). AoE (all enemies). REJECTED: conditional (only-if specific debuff)','sweep-fix-2026-07-12',now(),0,'aoe','sweep-fix-2026-07-12',now()),
  ('4c8eaa38-1e82-4e1a-91f7-aad86bbc23b2','22a57e74-2b78-4df0-ba77-f83347ce2317','approved','human_observation','human_observation A2 Infestation: [Stun] no explicit chance in description. single-target. REJECTED: conditional (only-if specific debuff)','sweep-fix-2026-07-12',now(),0,'single','sweep-fix-2026-07-12',now()),
  ('4c8eaa38-1e82-4e1a-91f7-aad86bbc23b2','5dc07f8f-f356-498a-97e7-4f3607545333','approved','human_observation','human_observation A2 Infestation: [Infest] no explicit chance in description. single-target. REJECTED: conditional (only-if specific debuff)','sweep-fix-2026-07-12',now(),0,'single','sweep-fix-2026-07-12',now()),
  ('4c8eaa38-1e82-4e1a-91f7-aad86bbc23b2','cfba716d-ab90-4e08-8d67-bb5b913516bb','approved','human_observation','human_observation A2 Infestation: [True Fear] no explicit chance in description. single-target. REJECTED: conditional (only-if specific debuff)','sweep-fix-2026-07-12',now(),0,'single','sweep-fix-2026-07-12',now()),
  ('00404172-1b85-49eb-b353-a0aaaf9cca1f','c4e01135-5d61-4305-8621-0ac777b5e058','approved','human_observation','A3 Hidden Gun: steals all buffs from the target before attacking. Unresistable under [Veil]/[Perfect Veil]. Sweep-restored (was missing from worksheet).','sweep-fix-2026-07-12',now(),0,'single','sweep-fix-2026-07-12',now())
on conflict (champion_id,tag_id) do update set status='approved', approved_by='sweep-fix-2026-07-12', approved_at=now();
