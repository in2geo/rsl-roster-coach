-- ============================================================================
-- champion_skill_tags — the PER-SKILL tag layer (contribution model, CONTRIBUTION_MODEL_SPEC.md §6).
--
-- The existing champion_tags is one row per (champion, tag): binary presence, no magnitude, and the
-- delivering skill lives only in free-text source_note. That flattens a premier poisoner (Xenomorph:
-- A1 5% + 3-on-crit + Passive) and an incidental one (Coldheart: one conditional A2 5% poison) to an
-- equal "Poison" checkbox. This table carries ONE row per (champion, SKILL, tag) WITH the magnitude
-- (%, stacks, duration, condition), FKed to champion_skills (which already owns slot / maxhp_% / caps /
-- cooldowns), so throughput and big-vs-little become first-class.
--
-- ROLLOUT (spec §6, staged — no broken intermediate): this migration only CREATES the table (additive,
-- zero risk to champion_tags). CB champions are populated next (seeds/*), the rest of the roster later,
-- and champion_tags is flipped to a roll-up VIEW only once the corpus is fully migrated. Until then
-- champion_tags stays the live table and every existing reader is untouched.
--
-- Idempotent. Apply via the aws-1 pooler (tools/apply-seed-pooler.mjs).
-- ============================================================================
create table if not exists champion_skill_tags (
  id              uuid primary key default gen_random_uuid(),
  champion_id     uuid not null references champions(id) on delete cascade,
  skill_id        uuid references champion_skills(id) on delete set null,  -- null tolerated (skill row may lag); skill_slot is the stable key
  skill_slot      text not null,             -- 'A1' | 'A2' | 'A3' | 'A4' | 'Passive' | 'Aura'
  tag_id          uuid not null references tags(id),
  -- MAGNITUDE (the big-vs-little + throughput inputs; null = not applicable / not yet parsed)
  magnitude_pct   numeric,                   -- Poison 5 vs 2.5; Decrease DEF 60 vs 30; Heal %maxHP; …
  stacks          int,                       -- debuffs placed per cast (Xeno A1 = 3 on crit)
  duration_turns  int,
  hits            int,                        -- multi-hit count (feeds Warmaster/Giant-Slayer proc cadence)
  condition       text,                      -- 'self-combo' | 'ally-gated' | 'crit' | 'on-attacked' | null
  -- LAND CHANCE (mirrors champion_tags; unbooked/booked)
  chance_unbooked numeric,
  chance_booked   numeric,
  -- WORKFLOW (moves here from champion_tags; per-skill proposals reviewed like the tag corpus)
  status          text not null default 'proposed',
  source_type     text,
  source_note     text,
  proposed_by     text,
  proposed_at     timestamptz default now(),
  approved_by     text,
  approved_at     timestamptz,
  unique (champion_id, tag_id, skill_slot)
);

create index if not exists idx_cst_champion on champion_skill_tags (champion_id);
create index if not exists idx_cst_tag       on champion_skill_tags (tag_id);
create index if not exists idx_cst_status    on champion_skill_tags (status);
