-- ============================================================================
-- 51 — Split AoE Turn-Meter-decrease vocabulary + fix Androc's alt A2 tag.
--
-- Background: the DB had exactly two TM-decrease tags —
--   * 'AoE Decrease Turn Meter'  (is_debuff=true, bypasses_accuracy_check=TRUE)
--       — the "cannot be resisted" / bypass variant.
--   * 'Decrease Turn Meter'      (is_debuff=true, bypasses_accuracy_check=false)
--       — single-target, resistible.
-- There was NO resistible AoE variant, so Androc's alt A2 (a landed, resistible
-- 15% AoE TM decrease with no "cannot be resisted" clause) was mis-tagged with
-- the bypass variant. Joan's alt A2 ("cannot be resisted") is correctly on the
-- bypass variant and is left unchanged.
--
-- This seed adds the resistible AoE variant and moves Androc onto it.
-- status='proposed' — human review required. Idempotent.
-- ============================================================================

-- ── New vocabulary: resistible AoE TM decrease ───────────────────────────────
insert into tags (name, description, is_debuff, bypasses_accuracy_check)
values (
  'AoE Decrease Turn Meter (Resistible)',
  'Reduces ALL enemies'' Turn Meter as a landed debuff — subject to the ACC/RES '
  'check. Distinct from [AoE Decrease Turn Meter], which bypasses the accuracy '
  'check entirely. Use this tag when the skill text has NO explicit "cannot be '
  'resisted" clause.',
  true, false
)
on conflict (name) do nothing;

-- ── Remove Androc's incorrect bypass-variant tag (alt A2 is resistible) ───────
delete from champion_tags ct
using champions c, tags t
where ct.champion_id = c.id and ct.tag_id = t.id
  and c.name = 'Androc' and c.game_id = 'raid_shadow_legends'
  and t.name = 'AoE Decrease Turn Meter'
  and ct.champion_form = 'alternate';

-- ── Add the correct resistible-variant tag ───────────────────────────────────
insert into champion_tags
  (champion_id, tag_id, status, source_type, source_note,
   proposed_by, proposed_at, ascension_required, champion_form)
select c.id, t.id, 'proposed', 'human_observation',
  'Alt A2 Palisade Breaker: decreases TM of all enemies by 15%. Landed debuff — '
  'subject to ACC/RES check; skill text has no "cannot be resisted" clause. '
  'Retagged from [AoE Decrease Turn Meter] (bypass variant) to the resistible '
  'variant. AyumiLove (human read).',
  'ayumilove-human-read-july-2026', now(), 0, 'alternate'
from champions c
join tags t on t.name = 'AoE Decrease Turn Meter (Resistible)'
where c.name = 'Androc' and c.game_id = 'raid_shadow_legends'
  and not exists (
    select 1 from champion_tags x where x.champion_id = c.id and x.tag_id = t.id
  );
