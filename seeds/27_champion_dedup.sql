-- 27 — Champion dedup: remove empty truncated mis-seed rows.
--
-- Audit (2026-07-02) found 20 "short name is a prefix of a full name" pairs. 19 of the
-- short rows are empty mis-seeds (null type_id, zero references across ALL 7 FK tables
-- that point at champions.id) — safe to delete.
--
-- The 20th prefix pair, "Elder" / "Elder Skarg", is NOT a truncation: they are TWO
-- DIFFERENT champions (Rare Magic "Elder", type_id 2030, vs Legendary "Elder Skarg").
-- An earlier version of this seed wrongly merged them; that was reverted and repaired in
-- seed 30. "Elder" is intentionally NOT in the delete list below.
--
-- The deletes are GUARDED (type_id is null AND no rows in any child table) so re-running
-- is safe and a row that gained data since the audit is left untouched.

delete from champions
where game_id = 'raid_shadow_legends'
  and name in ('Corvis','Criodan','Drexthar','Fahrakin','Fodbor','Folan','Gnishak',
               'Lanakis','Marius','Mavara','Morag','Pelops','Quargan','Richtoff',
               'Sabrael','Scyl','Staltus','Teodor','Tholin')
  and type_id is null
  and not exists (select 1 from champion_tags               t where t.champion_id = champions.id)
  and not exists (select 1 from champion_solo_profiles      s where s.champion_id = champions.id)
  and not exists (select 1 from champion_ai_notes           n where n.champion_id = champions.id)
  and not exists (select 1 from champion_team_requirements  r where r.champion_id = champions.id)
  and not exists (select 1 from champion_strategy_modifiers m where m.champion_id = champions.id)
  and not exists (select 1 from champion_solo_research_log  l where l.champion_id = champions.id)
  and not exists (select 1 from user_champions             u where u.champion_id = champions.id);
