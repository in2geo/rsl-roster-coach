-- ============================================================================
-- 54 — Repair 'Amarantine Skeleton' identity + delete the empty 'Skeleton' shell.
--
-- The DB had two rows: the real, tagged Amarantine Skeleton (id 7fb7e7ab, 6 skill
-- tags incl. Poison/Single Target Damage, correct in-game-Index base stats) but
-- MIS-SEEDED as rarity=Common / affinity=Spirit and role=null; plus an empty
-- 'Skeleton' shell (id cfe1d9fb, Rare/Force, zero tags, zero dependents).
--
-- Amarantine Skeleton is a Rare / Undead Hordes / Void / Defense champion. Only
-- the identity fields were wrong — base stats and tags are already correct and
-- untouched here. The empty 'Skeleton' shell is a non-champion mis-seed (not in
-- the master roster) and is safe to delete (guarded, seeds/27 pattern).
--
-- NOTE (calibration): the empty shell had 0 tags so it was never matchable; the
-- Dragon's Lair acceptance-test team used the tagged row. Affinity was mislabeled
-- Spirit (advantage vs Force) but is really Void (neutral) — re-check any
-- affinity-advantage weighting from that run after this fix.
-- ============================================================================

-- 1. Repair the real Amarantine Skeleton row (identity fields only).
update champions
set rarity   = 'Rare',
    affinity = 'Void',
    role     = 'Defense'
where id = '7fb7e7ab-de3d-4945-b878-8e334f3d4a45'
  and name = 'Amarantine Skeleton'
  and game_id = 'raid_shadow_legends';

-- 2. Guarded delete of the empty 'Skeleton' shell.
delete from champions
where game_id = 'raid_shadow_legends'
  and name = 'Skeleton'
  and faction = 'Undead Hordes'
  and type_id is null
  and not exists (select 1 from champion_tags               t where t.champion_id = champions.id)
  and not exists (select 1 from champion_solo_profiles      s where s.champion_id = champions.id)
  and not exists (select 1 from champion_ai_notes           n where n.champion_id = champions.id)
  and not exists (select 1 from champion_team_requirements  r where r.champion_id = champions.id)
  and not exists (select 1 from champion_strategy_modifiers m where m.champion_id = champions.id)
  and not exists (select 1 from champion_solo_research_log  l where l.champion_id = champions.id)
  and not exists (select 1 from user_champions             u where u.champion_id = champions.id)
  and not exists (select 1 from champion_aliases            a where a.champion_id = champions.id);
