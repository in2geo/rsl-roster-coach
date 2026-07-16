-- ============================================================================
-- 137 - Multi-Hit A1 backfill (2026-07-16). Three champions whose A1 attacks the
-- same enemy multiple times but were missing the Multi-Hit A1 tag — an INVISIBLE
-- shield-strip path for Fire Knight (the exact class of gap the FK mechanic-model
-- exposed: an untagged ability = a solution the app can't see). A1×N qualifies per
-- the Tagoar/Gnut precedent. Landed status='proposed' for advisor review.
--   • Michelangelo — A1 "Boo-Yah!": Attacks 1 enemy 2 times. (surfaced by GuapoDonni's
--     FK16 clear 2026-07-16 — he was the 46%-damage carry, untagged as a breaker.)
--   • Gnut       — A1: Attacks 1 enemy 3 times. (pending queue item, tag-review-2026-07-13)
--   • Tagoar     — A1: Attacks 1 enemy 2 times. (pending queue item, tag-review-2026-07-13)
-- ============================================================================
insert into champion_tags
  (champion_id, tag_id, status, source_type, source_note, proposed_by, proposed_at,
   ascension_required, target_type, approved_by, approved_at)
values
  ('fc4ad157-66c8-431a-a925-5ad23cf0db64','1e1764cb-4794-4062-9e36-0a6ecc78e804','proposed','human_observation','A1 Boo-Yah! attacks 1 enemy 2 times → A1x2 qualifies (Tagoar/Gnut precedent). Surfaced by GuapoDonni FK16 clear 2026-07-16.','fk-mechanic-model-2026-07-16',now(),0,'single',null,null),
  ('39597945-295c-4ec5-8f2a-67888ab3143e','1e1764cb-4794-4062-9e36-0a6ecc78e804','proposed','human_observation','A1 attacks 1 enemy 3 times → A1x3 qualifies. Pending queue item (tag-review-2026-07-13).','fk-mechanic-model-2026-07-16',now(),0,'single',null,null),
  ('994fc9c9-c99f-4618-b73b-29652b7791e7','1e1764cb-4794-4062-9e36-0a6ecc78e804','proposed','human_observation','A1 attacks 1 enemy 2 times → A1x2 qualifies. Pending queue item (tag-review-2026-07-13).','fk-mechanic-model-2026-07-16',now(),0,'single',null,null)
on conflict (champion_id, tag_id) do nothing;
