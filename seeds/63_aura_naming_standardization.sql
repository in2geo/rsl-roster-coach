-- ============================================================================
-- 63 — Standardize aura tag names to the abbreviated convention + add C.Rate Aura.
--
-- Renames update the tags.NAME field only; champion_tags reference tag_id (uuid),
-- so every attached champion_tags row is preserved untouched (tag_id unchanged).
-- Idempotent: renames key on the old name (no-op once renamed); C.Rate Aura uses
-- ON CONFLICT DO NOTHING; description updates are self-consistent on re-run.
--
-- Coordinated code change lands in the same commit:
--   * lib/match-engine.js  REQUIREMENT_TAGS.speed_aura  'Speed Aura' -> 'SPD Aura'
--   * tools/test-matching.js  fixture 'Speed Aura' -> 'SPD Aura'
-- (Attack/Defense Aura are not referenced in code — data-only renames.)
--
-- Descriptions encode the flat-vs-percentage distinction: ATK/DEF/HP/SPD auras
-- are a % of each ally's BASE stat; ACC/RES/C.Rate auras are FLAT bonuses.
-- ============================================================================

-- ── Renames (spelled-out -> abbreviated) + description refresh ────────────────
update tags set
  name = 'ATK Aura',
  description = 'Increases Ally Attack by a percentage of each ally''s base ATK '
                'in a specified placement. Only applies when this champion is '
                'team leader. Percentage of base stat — gear multiplies on top.'
where name = 'Attack Aura';

update tags set
  name = 'DEF Aura',
  description = 'Increases Ally Defense by a percentage of each ally''s base DEF '
                'in a specified placement. Only applies when this champion is '
                'team leader. Percentage of base stat.'
where name = 'Defense Aura';

update tags set
  name = 'SPD Aura',
  description = 'Increases Ally Speed by a percentage of each ally''s base SPD in '
                'a specified placement. Only applies when this champion is team '
                'leader. Percentage of base stat. Most impactful aura type — '
                'speed determines turn order.'
where name = 'Speed Aura';

-- ── New: C.Rate Aura (no crit aura existed) ──────────────────────────────────
insert into tags (name, description, is_debuff, bypasses_accuracy_check)
values (
  'C.Rate Aura',
  'Increases Ally Critical Rate by a flat amount in a specified placement. Only '
  'applies when this champion is team leader. Flat bonus — not a percentage of '
  'base stat.',
  false, false
)
on conflict (name) do nothing;

-- ── Already-abbreviated names: refresh descriptions for the flat/% distinction ─
update tags set
  description = 'Increases Ally Accuracy by a flat amount in a specified '
                'placement. Only applies when this champion is team leader. Flat '
                'bonus — not a percentage of base stat.'
where name = 'ACC Aura';

update tags set
  description = 'Increases Ally HP by a percentage of each ally''s base HP in a '
                'specified placement. Only applies when this champion is team '
                'leader. Percentage of base stat.'
where name = 'HP Aura';

update tags set
  description = 'Increases Ally Resistance by a flat amount in a specified '
                'placement. Only applies when this champion is team leader. Flat '
                'bonus — not a percentage of base stat.'
where name = 'RES Aura';
