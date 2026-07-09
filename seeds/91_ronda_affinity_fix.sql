-- seeds/43_ronda_affinity_fix.sql
-- Correct Ronda's (Ronda the Rowdy) affinity. The DB had 'Spirit' from an earlier
-- seed; confirmed 'Magic' in-game (2026-07-06). Banner Lords / Legendary unchanged.
update champions
   set affinity = 'Magic'
 where name = 'Ronda'
   and game_id = 'raid_shadow_legends';
