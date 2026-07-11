-- ============================================================================
-- 101 — Allow 'Mythical' rarity on champions. Mythicals are in project scope
-- (two-form champions) but the original CHECK stopped at Legendary. Extends the
-- domain so Mythical champion rows can be inserted. Idempotent.
-- ============================================================================
alter table champions drop constraint if exists champions_rarity_check;
alter table champions add constraint champions_rarity_check
  check (rarity in ('Common','Uncommon','Rare','Epic','Legendary','Mythical'));
