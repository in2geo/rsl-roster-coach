-- ============================================================================
-- Ice Golem's Peak stages 10-13: recalibrate the HP threshold floor 25000 -> 8000.
-- BATTLE-LOG DERIVED (2026-07-01). The 25000 floor was a seeded JUDGMENT CALL with
-- no data. The DonCobb07 battle log shows a 4W/1L clear of Ice Golem 10 whose team
-- MINIMUM HP is 9118 (Kael) — so 25000 was a proven false negative (it called a
-- team that actually clears "not ready"). 8000 is a conservative floor that sits
-- below the observed clearing minimum without excluding it; refine as more
-- battle-log data points accumulate. Stage 14+ (cliff, 40000) is unchanged.
-- ============================================================================

update stat_threshold_checks
   set formula = '8000',
       notes = 'Stage 10-13: HP 8000 floor — BATTLE-LOG DERIVED 2026-07-01 (was 25000, a '
             || 'dataless judgment call). DonCobb07 4W/1L Ice Golem 10 clear has team-min HP '
             || '9118 (Kael), so 25000 was a false negative. 8000 sits below the observed '
             || 'clearing minimum; refine with more data points.'
 where stat = 'hp'
   and phase_id in (
     select p.id from phases p
     join dungeon_stages ds on ds.id = p.dungeon_stage_id
     join dungeons d on d.id = ds.dungeon_id
     where d.name = 'Ice Golem''s Peak'
       and ds.label in ('Stage 10', 'Stage 11', 'Stage 12', 'Stage 13')
   );
