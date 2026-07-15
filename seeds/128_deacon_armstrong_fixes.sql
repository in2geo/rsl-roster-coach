-- ============================================================================
-- 128 — Deacon Armstrong (Epic, Sacred Order, type_id 3870) data fixes.
--
-- Source: player-provided in-game skill text 2026-07-14 (Tier-1/2 factual game data).
-- Motivation: a Dragon 20 capture logged the hero as "Deacon" but the DB champ is
-- "Deacon Armstrong" → reconciliation couldn't match him (looked "untagged"). He is in
-- fact tagged, but some rows were TEST_DATA and the A1 chance was inverted. This seed:
--   (1) adds the "Deacon" short-form ALIAS (fixes the reconciliation blindness);
--   (2) corrects the A1 Leech chance (was 10/30; real is 30 unbooked / 50 booked);
--   (3) corrects the A2 Decrease DEF chance + AoE Damage source_note (were TEST_DATA);
--   (4) adds his 19% all-battles SPD AURA to champion_auras (leader-selection consumes it);
--   (5) proposes Multi-Hit A1 (his A1 hits twice) — status='proposed' per no-auto-merge.
--
-- Idempotent. NEW tag lands 'proposed' (advisor approval required before it goes live).
-- FOLLOW-UP (policy #18): reconcile these to the master worksheet DB_Champion_Tags / Auras.
-- ============================================================================

-- (1) Short-form alias so captures naming him "Deacon" resolve to "Deacon Armstrong".
insert into champion_aliases (champion_id, alias, source)
select id, 'Deacon', 'shortform' from champions
where game_id = 'raid_shadow_legends' and name = 'Deacon Armstrong'
on conflict do nothing;

-- (2) A1 Mace of Contempt — Leech: base 30% + books (+5 L3, +5 L5, +10 L7) = 50% booked.
--     (DB had it inverted as 10 unbooked / 30 booked.)
update champion_tags ct set
  chance_unbooked = 30, chance_booked = 50,
  source_note = 'A1 Mace of Contempt: attacks 1 enemy 2 times, each hit 30% chance of '
    || '[Leech] for 2 turns. Books +5% (L3) +5% (L5) +10% (L7) = 50% booked. '
    || 'Player-provided skill text 2026-07-14.'
from champions ch, tags t
where ct.champion_id = ch.id and ct.tag_id = t.id
  and ch.name = 'Deacon Armstrong' and ch.game_id = 'raid_shadow_legends'
  and t.name = 'Leech';

-- (3a) A2 Sweeping Retribution — Decrease DEF: 80% unbooked + books (+5 L3, +15 L5) = 100% booked.
update champion_tags ct set
  chance_unbooked = 80, chance_booked = 100,
  source_note = 'A2 Sweeping Retribution (CD4, -1 booked): attacks all enemies, 80% chance '
    || 'of 60% [Decrease DEF] for 2 turns. Books +5% (L3) +15% (L5) = 100% booked. '
    || 'Player-provided skill text 2026-07-14.'
from champions ch, tags t
where ct.champion_id = ch.id and ct.tag_id = t.id
  and ch.name = 'Deacon Armstrong' and ch.game_id = 'raid_shadow_legends'
  and t.name = 'Decrease Defense';

-- (3b) A2 AoE Damage source_note (was TEST_DATA).
update champion_tags ct set
  source_note = 'A2 Sweeping Retribution: attacks ALL enemies (4 ATK). '
    || 'Player-provided skill text 2026-07-14.'
from champions ch, tags t
where ct.champion_id = ch.id and ct.tag_id = t.id
  and ch.name = 'Deacon Armstrong' and ch.game_id = 'raid_shadow_legends'
  and t.name = 'AoE Damage';

-- (4) Aura: Increases Ally SPD in all Battles by 19% (leader-selection reads champion_auras).
--     NOTE: the 'SPD Aura' champion_tags row is TEST_DATA-rejected; left as-is (the aura VALUE
--     lives here, which is what applyLeaderAura/selectLeader actually consume).
insert into champion_auras
  (champion_id, aura_id, aura_type, aura_value, aura_area, aura_restriction, aura_summary, verification_status, source)
select ch.id, '3870-AURA', 'SPD', '19%', 'All Battles', null,
  'Increases Ally SPD in all Battles by 19%.', 'verified', 'player skill text 2026-07-14'
from champions ch
where ch.name = 'Deacon Armstrong' and ch.game_id = 'raid_shadow_legends'
  and not exists (
    select 1 from champion_auras a where a.champion_id = ch.id and a.aura_type = 'SPD');

-- (5) A1 hits twice → Multi-Hit A1 (proposed; matters for Fire Knight shield-break).
insert into champion_tags
  (champion_id, tag_id, status, source_type, source_note, proposed_by, proposed_at, ascension_required)
select ch.id, t.id, 'proposed', 'human_observation',
  'A1 Mace of Contempt attacks 1 enemy 2 times → Multi-Hit A1. Player-provided skill '
    || 'text 2026-07-14. Policy: A1x2 qualifies (cf. Tagoar A1x2).',
  'player-skill-text-2026-07-14', now(), 0
from champions ch join tags t on t.name = 'Multi-Hit A1'
where ch.name = 'Deacon Armstrong' and ch.game_id = 'raid_shadow_legends'
  and not exists (select 1 from champion_tags x where x.champion_id = ch.id and x.tag_id = t.id);
