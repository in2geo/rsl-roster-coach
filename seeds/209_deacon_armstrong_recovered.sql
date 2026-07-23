-- 209 - Deacon Armstrong multipliers recovered from prior session transcript (2026-07-21).
-- 2 damage skills that were user-captured before but never persisted; found via transcript mining 2026-07-23.
update champion_skills set damage_multiplier='1.8', multiplier_type='ATK', source='recovered from transcript 2026-07-21', verification_status='verified' where id='9222f9e3-a2c8-4bf1-9d5e-111183b9adf8';
update champion_skills set damage_multiplier='4', multiplier_type='ATK', source='recovered from transcript 2026-07-21', verification_status='verified' where id='1d7a22ab-182c-4d49-96a5-dc689ba3b60f';
