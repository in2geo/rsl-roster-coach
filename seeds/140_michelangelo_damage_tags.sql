-- ============================================================================
-- 140 - Michelangelo (Mikey) missing damage tags (2026-07-16). The Dragon's Lair
-- model review found Michelangelo — a KNOWN Dragon-20 solo carrier
-- (champion_solo_profiles) — was invisible to the DAMAGE problem: his approved tags
-- captured only his DEBUFFS (Decrease DEF/ATK, Stun, Taunt, Leech), never his core
-- damage skills. His kit has NO DoT (confirmed w/ Mike) — his solo DoT is the Toxic
-- SET, not a skill — so this adds ONLY his two direct-damage tags:
--   • AoE Damage          — "Shell Cyclone: Attacks all enemies."
--   • Single Target Damage — "Boo-Yah!: Attacks 1 enemy 2 times." / "Express Delivery!: Attacks 1 enemy."
-- (His Multi-Hit A1 is already proposed from seed 139 — approve alongside these.)
-- Likely a TMNT/late-added-collab regen miss; scan the rest of that batch separately.
-- status=proposed → human review before live. Idempotent (skips if already present).
-- ============================================================================
insert into champion_tags
  (champion_id, tag_id, status, source_type, source_note, proposed_by, proposed_at, ascension_required, target_type)
select v.champion_id, v.tag_id, 'proposed', 'human_observation', v.note,
       'mikey-damage-tags-2026-07-16', now(), 0, v.target_type
from (values
  ('fc4ad157-66c8-431a-a925-5ad23cf0db64'::uuid, '8dd046f2-679c-4ff5-9b38-987b7a6af674'::uuid, 'aoe',
   'Shell Cyclone "Attacks all enemies. Has a 75% chance of placing a 50% [Decrease ATK] debuff and a [Leech] debuff..." = an AoE Damage skill, previously untagged (only the debuffs were captured; TMNT-collab regen miss).'),
  ('fc4ad157-66c8-431a-a925-5ad23cf0db64'::uuid, 'fb43fa1d-53aa-4e17-a4e8-982093d54573'::uuid, 'single',
   'Boo-Yah! "Attacks 1 enemy 2 times." + Express Delivery! "Attacks 1 enemy..." = Single Target Damage skills, previously untagged (only the debuffs were captured; TMNT-collab regen miss).')
) as v(champion_id, tag_id, target_type, note)
where not exists (
  select 1 from champion_tags ct
  where ct.champion_id = v.champion_id and ct.tag_id = v.tag_id
);
