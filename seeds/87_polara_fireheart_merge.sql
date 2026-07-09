-- ============================================================================
-- 87 — Merge the duplicate Polara Fireheart rows (data repair). CONTAINS A
-- ROW DELETE — review before applying.
--
-- The live DB had TWO rows for the one real champion (Mythical, Sacred Order):
--   • 'Polara'          — CORRECT identity (Sacred Order / Force / Attack) but
--                         EMPTY (no tags, notes, aliases). Kept.
--   • 'Polar Fireheart' — WRONG identity (Sylvan Watchers / Void / Defense),
--                         but holds the real content: 1 proposed Spider AI note
--                         ("AoE Freeze in Control Form locks the spiderling
--                         board...") + a 'Fireheart' alias. Deleted after its
--                         content is migrated off it.
-- Both had type_id NULL and NULL base stats; neither is roster-referenced
-- (user_champions = 0 for both), so the merge is safe. Master worksheet
-- (C000927) + in-game Index screenshot 2026-07-09 (Lvl 60, magenta 6-star,
-- Mythical, role Attack) confirm canonical 'Polara Fireheart' / Sacred Order /
-- Force / Attack — the surviving 'Polara' row already matches on every field
-- except the (incomplete) name.
--
-- Order matters: repoint content OFF the doomed row BEFORE deleting it (FK is
-- ON DELETE CASCADE — deleting first would destroy the AI note + alias).
-- Name-keyed and idempotent (re-run: the 'Polar Fireheart' subqueries return
-- NULL → no-ops; alias inserts are NOT EXISTS-guarded).
-- ============================================================================

-- 1. Move the Spider AI note from the wrong row to the surviving 'Polara' row.
update champion_ai_notes
set champion_id = (select id from champions
                   where game_id='raid_shadow_legends' and name='Polara')
where champion_id = (select id from champions
                     where game_id='raid_shadow_legends' and name='Polar Fireheart');

-- 2. Move the 'Fireheart' alias (and any other) off the wrong row.
update champion_aliases
set champion_id = (select id from champions
                   where game_id='raid_shadow_legends' and name='Polara')
where champion_id = (select id from champions
                     where game_id='raid_shadow_legends' and name='Polar Fireheart');

-- 3. Delete the now-empty wrong-identity duplicate.
delete from champions
where game_id='raid_shadow_legends' and name='Polar Fireheart';

-- 4. Complete the surviving row's name to canonical.
update champions
set name='Polara Fireheart'
where game_id='raid_shadow_legends' and name='Polara';

-- 5. Preserve both prior spellings as searchable aliases.
insert into champion_aliases (game_id, champion_id, alias, source)
select 'raid_shadow_legends', ch.id, v.alias, 'misspelling'
from champions ch
cross join (values ('Polara'), ('Polar Fireheart')) as v(alias)
where ch.game_id='raid_shadow_legends' and ch.name='Polara Fireheart'
  and not exists (
    select 1 from champion_aliases a
    where a.champion_id = ch.id and lower(a.alias) = lower(v.alias));
