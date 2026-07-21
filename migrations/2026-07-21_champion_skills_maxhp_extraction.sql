-- ============================================================================
-- 2026-07-21 — champion_skills: per-skill %MAX-HP extraction columns.
--
-- WHY. `lib/cb-damage-model.js` carries SOURCE_COEFF.enemy_maxhp = 0.05, a single
-- flat nominal applied to every champion holding the `Enemy Max HP Damage` tag.
-- The real per-skill values run 1% .. 30% (measured 2026-07-21, seed 201), so the
-- flat nominal is wrong in both directions and — critically — it sits UNDER the
-- 10% boss cap encoded in lib/damage-mechanics.js §6b, which is why that cap is
-- inert. Real percentages have to live somewhere machine-readable before the cap
-- can ever bind. They are a property of the SKILL, not of the champion, so they
-- belong here rather than on champion_tags.
--
-- ⚠ THE DENOMINATOR IS LOAD-BEARING — that is the whole point of `maxhp_pct_basis`.
-- Two different mechanics both print a bare percentage next to the words "MAX HP":
--   • basis='enemy_max_hp'    — "damage equal to 20% of their MAX HP"        (Gamuran)
--   • basis='damage_inflicted' — "destroys MAX HP by 30% of the damage inflicted" (Vlad)
-- Vlad's 30% is 30% of a HIT, not 30% of a health bar; it is not comparable to
-- Gamuran's 20% and must never be summed with it or clamped by the same cap.
-- Conflating those two denominators is the defect seed 201 exists to fix, so the
-- basis is a NOT NULL companion to the number, enforced by a CHECK below.
--
-- maxhp_pct_boss semantics (three distinct states, all text-derived):
--   NULL  — the skill text states no boss-specific value; the base pct applies.
--   0     — the text explicitly disables the effect vs Bosses ("This effect does
--           not work against Bosses" / "Will not decrease Bosses MAX HP"). Three
--           champions say this outright, and today they are credited with boss
--           damage they cannot deal.
--   other — the text states a different boss value (Skull Lord Var-Gall 2.5%,
--           Vitrius 35%, Storm Herald Hekaton 3%, Androc/Kurosa 10%).
--
-- Applied together with seeds/201_maxhp_tag_split_PROPOSED.sql. DDL only — no rows.
-- ============================================================================

alter table champion_skills add column if not exists maxhp_effect_kind text;
alter table champion_skills add column if not exists maxhp_pct          numeric;
alter table champion_skills add column if not exists maxhp_pct_basis    text;
alter table champion_skills add column if not exists maxhp_pct_boss     numeric;
alter table champion_skills add column if not exists maxhp_pct_cap      numeric;
alter table champion_skills add column if not exists maxhp_pct_note     text;

comment on column champion_skills.maxhp_effect_kind is
  'damage = deals damage as a %% of the target MAX HP (the ONLY family lib/damage-mechanics.js §6b caps). '
  'destroy_flat = permanently destroys a flat %% of the target MAX HP. '
  'destroy_proportional = destroys MAX HP equal to a %% of the damage this hit inflicted. '
  'The two destroy_* kinds shrink the pool rather than dealing damage out of it and are NOT an enemy_maxhp damage source.';
comment on column champion_skills.maxhp_pct is
  'The stated percentage as a fraction, per hit / per application. NULL = the skill text states no number (needs the in-game card). Read it WITH maxhp_pct_basis — the number is meaningless alone.';
comment on column champion_skills.maxhp_pct_basis is
  'Denominator of maxhp_pct: enemy_max_hp (fraction of the target health pool) or damage_inflicted (fraction of this hit''s damage). Never compare or sum across bases.';
comment on column champion_skills.maxhp_pct_boss is
  'Boss-specific value where the text states one. NULL = no boss clause, base pct applies. 0 = text explicitly disables the effect against Bosses.';
comment on column champion_skills.maxhp_pct_cap is
  'Stacking / per-battle ceiling stated in the skill text (e.g. "stacks up to 50%"), as a fraction. Distinct from the §6b content-level boss cap.';

do $$ begin
  alter table champion_skills add constraint champion_skills_maxhp_effect_kind_chk
    check (maxhp_effect_kind is null
           or maxhp_effect_kind in ('damage','destroy_flat','destroy_proportional'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table champion_skills add constraint champion_skills_maxhp_pct_basis_chk
    check (maxhp_pct_basis is null
           or maxhp_pct_basis in ('enemy_max_hp','damage_inflicted'));
exception when duplicate_object then null; end $$;

-- A percentage with no denominator is exactly the ambiguity this migration exists
-- to remove. Refuse to store one.
do $$ begin
  alter table champion_skills add constraint champion_skills_maxhp_pct_needs_basis_chk
    check (maxhp_pct is null or maxhp_pct_basis is not null);
exception when duplicate_object then null; end $$;

-- 'damage' is a %-of-health-pool source by definition; it can never be measured
-- against damage inflicted. Structural guard, same spirit as the SOURCE_COEFF
-- DEF-independence invariant in lib/cb-damage-model.js.
do $$ begin
  alter table champion_skills add constraint champion_skills_maxhp_damage_basis_chk
    check (maxhp_effect_kind is distinct from 'damage'
           or maxhp_pct_basis is null
           or maxhp_pct_basis = 'enemy_max_hp');
exception when duplicate_object then null; end $$;

create index if not exists idx_champion_skills_maxhp_kind
  on champion_skills(maxhp_effect_kind) where maxhp_effect_kind is not null;
