-- ============================================================================
-- 75 — Warlord champion_tags from prior-session mechanic review (advisor).
--      status='proposed', source_type='fandom_wiki', ascension_required=0.
--      Idempotent. Keyed on DB champion name 'Warlord'.
--      NOTE: Block Debuffs + Shield already exist (raid.guide seeds) and are
--      intentionally NOT repeated here. Only the 3 new tags below.
--        A2 Protection of Gods -> Healer (25% AoE heal)
--        A3 Orcish Rituals     -> Block Cooldowns (70%), AoE Decrease Turn Meter (30%)
-- ============================================================================
insert into champion_tags (champion_id, tag_id, status, source_type, source_note, proposed_by, proposed_at, ascension_required)
select ch.id, t.id, 'proposed', 'fandom_wiki', v.note, 'batch-review-2026-07-08', now(), 0
from (values
  ('Healer', 'fandom_wiki A2 Protection of Gods: restores all allies HP by 25%. AoE heal.'),
  ('Block Cooldowns', 'fandom_wiki A3 Orcish Rituals: 70% chance to put each enemy Skills on cooldown. AoE. Books +5/+5/+10/+10.'),
  ('AoE Decrease Turn Meter', 'fandom_wiki A3 Orcish Rituals: 30% chance to fully deplete each enemy Turn Meter. AoE. Books +5/+5/+10/+10.')
) as v(tag, note)
join champions ch on ch.name = 'Warlord' and ch.game_id = 'raid_shadow_legends'
join tags t on t.name = v.tag
where not exists (select 1 from champion_tags x where x.champion_id = ch.id and x.tag_id = t.id);
