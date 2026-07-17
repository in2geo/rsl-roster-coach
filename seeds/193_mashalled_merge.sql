-- ============================================================================
-- 193 — Merge the Ma'Shalled / MaShalled duplicate (data repair). ROW DELETE.
--
-- The normalized-name collision scan (2026-07-18) found exactly ONE collision that
-- would block the champions normalized-unique constraint: `ma'shalled` maps to two
-- rows. Gracchos pattern again — correct NAME on one row, DATA on the other:
--   • 'Ma'Shalled' (90fff61e, Magic) — CORRECT apostrophized name but EMPTY
--     (0 skills/0 tags/0 auras); carries only 1 champion_strategy_modifiers row.
--   • 'MaShalled'  (300db846, Spirit) — garbled name but holds the real kit
--     (4 skills / 8 tags / 1 aura). KEPT.
-- Both Undead Hordes Legendary, hp 17835, type_id NULL, 0 roster refs.
--
-- Keep the payload row, move the strat-modifier onto it, rename it to the correct
-- 'Ma'Shalled', add 'MaShalled' as a spelling alias, delete the empty row. The
-- keeper's affinity (Spirit) is retained as it carries the real kit; if a Tier-1
-- check later shows Magic, that is a separate one-field fix.
-- Order: repoint the RESTRICT-FK strat row before the delete. UUID-keyed, idempotent.
-- ============================================================================

-- 1. move the strategy modifier off the empty row onto the payload keeper
update champion_strategy_modifiers set champion_id = '300db846-f7c2-471d-9565-9eaf4a9aaba8'
where champion_id = '90fff61e-b36f-4091-840e-8990191a4a1f';

-- 2. preserve the garbled spelling as an alias on the keeper
insert into champion_aliases (game_id, champion_id, alias, source)
select 'raid_shadow_legends','300db846-f7c2-471d-9565-9eaf4a9aaba8','MaShalled','spelling'
where not exists (select 1 from champion_aliases a where a.champion_id='300db846-f7c2-471d-9565-9eaf4a9aaba8' and lower(a.alias)=lower('MaShalled'));

-- 3. delete the empty correct-named row (its name is applied to the keeper next)
delete from champions where id = '90fff61e-b36f-4091-840e-8990191a4a1f' and game_id='raid_shadow_legends';

-- 4. rename the keeper to the correct apostrophized name
update champions set name = 'Ma''Shalled', updated_at = now()
where id = '300db846-f7c2-471d-9565-9eaf4a9aaba8' and game_id='raid_shadow_legends';
