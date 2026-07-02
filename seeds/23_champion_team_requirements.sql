-- 23 — champion_team_requirements initial rows (Criodan, Heinrich, Fahrakin)
--
-- All status='proposed' (no-auto-merge — the engine reads only 'approved' rows).
-- Written as INSERT ... SELECT FROM champions so a champion that isn't seeded yet
-- simply inserts 0 rows instead of failing the whole transaction on a NULL FK.
--   NOTE (2026-07-02): "Heinrich Demondoom" is NOT in the champions table yet, so its
--   row no-ops today and will seed automatically once that champion is added.
-- Each insert is guarded (NOT EXISTS) so re-running the seed doesn't duplicate.
-- game_id defaults to 'raid_shadow_legends'.

-- Criodan the Blue — needs a healer (Speed/Relentless gear = no self-sustain), all content.
insert into champion_team_requirements
  (champion_id, dungeon_id, required_role, reason, source_note, status, proposed_by)
select ch.id, null, 'healer',
  'Criodan is built for Speed or Relentless gear to maximize his AoE Freeze cycling — '
  'neither set provides self-healing. Without a healer or Leech champion on the team, '
  'Criodan will die in extended fights before his Freeze cycling can close them out. '
  'For Creator Link accounts, pair him with Uugo, Doompriest, or Mausoleum Mage.',
  'Kit analysis: no self-sustain in any skill. Speed/Relentless gear requirement from '
  'community guides (project notes). General community consensus.',
  'proposed', 'kit-analysis-july-2026'
from champions ch
where ch.name = 'Criodan the Blue'
  and not exists (
    select 1 from champion_team_requirements ctr
    where ctr.champion_id = ch.id and ctr.required_role = 'healer' and ctr.dungeon_id is null);

-- Heinrich Demondoom — base-form Stun must land (ACC) before the alt-form debuff bypass.
-- (No-ops until the champion exists — see note above.)
insert into champion_team_requirements
  (champion_id, dungeon_id, required_role, reason, source_note, status, proposed_by)
select ch.id, null, 'cc_accuracy',
  'Heinrich''s alternate form A2 (Whatever It Takes) places Decrease DEF and Decrease ATK '
  'on all enemies — but these debuffs can only bypass resistance if the target is already '
  'under a CC debuff (Stun, Fear, etc.). His base form A2 (Evil Begone!) provides the Stun, '
  'but it has a base ACC check. If his ACC is below the dungeon floor, the Stun does not land, '
  'the bypass does not activate, and his Decrease DEF/ATK are no longer reliable. His entire '
  'damage/survival chain depends on the ACC check passing first.',
  'Patch 11.65 card image — conditional bypass mechanic confirmed from skill text. Logical '
  'chain: Stun landing -> bypass activates -> debuffs unresistable.',
  'proposed', 'patch-11-65-card-analysis-july-2026'
from champions ch
where ch.name = 'Heinrich Demondoom'
  and not exists (
    select 1 from champion_team_requirements ctr
    where ctr.champion_id = ch.id and ctr.required_role = 'cc_accuracy' and ctr.dungeon_id is null);

-- Fahrakin the Fat — Ally Attack build (Clan Boss) needs a sustain champion.
insert into champion_team_requirements
  (champion_id, dungeon_id, required_role, reason, source_note, status, proposed_by)
select ch.id, d.id, 'sustain_any',
  'Fahrakin''s Ally Attack shifts the team damage profile from poison-stacking to '
  'ally-attack bursting. In an ally attack composition, champions are likely NOT running '
  'Lifesteal (they need stat-heavy sets for C.Rate/C.DMG). The team must include a sustain '
  'champion — Leech maintainer, passive healer, or shield provider — or the team dies before '
  'the ally attack burst pays off.',
  'Cobb account takeover video confirmed ally attack composition requires non-Lifesteal gear. '
  'Sustain dependency follows from the gear set change.',
  'proposed', 'cobb-video-june-2026'
from champions ch
cross join dungeons d
where ch.name = 'Fahrakin the Fat' and d.name = 'Clan Boss'
  and not exists (
    select 1 from champion_team_requirements ctr
    where ctr.champion_id = ch.id and ctr.required_role = 'sustain_any' and ctr.dungeon_id = d.id);
