-- ============================================================================
-- Seed 143 — Drexthar Bloodtwin: Spider's Den solo profiles
--
-- WHY: Mike (project owner / domain expert) confirmed 2026-07-16 that the
-- Spider SOLO carriers at the stages that matter are HP-BURN champs — Artak
-- and Drexthar Bloodtwin. Drexthar had NO Spider row at all (only Dragon's
-- Lair Stage 20), so checkSoloCarries could never surface him for Spider.
-- This is a DATA gap, not a modelling one: lib/dungeon-mechanics.js already
-- carries him as a confirmed Spider exemplar.
--
-- SOURCE: Mike, direct statement (2026-07-16) — "up to Stage 20 and
-- occasionally Stage 24-25 with the right gear", set "lifesteal or regen".
-- This is a Tier-1-equivalent primary source (the project owner's own play),
-- NOT community editorial content. His kit text (champion_skills) corroborates
-- the mechanism independently — see the mechanism column below.
--
-- STATUS: proposed. Per the project rule, no auto-merge — these stay inert
-- until an approval pass flips them, because checkSoloCarries reads approved
-- rows only.
--
-- REPLAY-SAFE: guarded with NOT EXISTS on (champion, stage). This table is
-- already known to carry exact duplicate rows (Athel / Kael / Elhain each have
-- two identical Stages 1-14 Lifesteal rows), so an unguarded insert here would
-- make that worse. The existing duplicates are NOT cleaned up by this seed —
-- that is a separate fix.
-- ============================================================================

-- ── Drexthar Bloodtwin (Legendary / Force) — Spider Stage 20 (the reliable clear) ──
insert into champion_solo_profiles
  (champion_id, dungeon_stage_id, required_set, required_stats,
   ai_settings, mechanism, source_note,
   affinity_warning, availability_note, research_confidence, status, proposed_by)
select
  (select id from champions where name = 'Drexthar Bloodtwin'),
  (select ds.id from dungeon_stages ds join dungeons d on d.id = ds.dungeon_id
   where d.name = 'Spider''s Den' and ds.label = 'Stage 20'),
  'Lifesteal or Regeneration',
  '{"note": "Exact thresholds UNVERIFIED (placeholder, per the project stat-floor rule). RES is partly self-solved: Fiery Blood [P] grants +10 RES per enemy under [HP Burn], stacking to +50, against a Spider RES guide of ~300. ACC still needs to clear the stage floor (~stage x 10 + ~10% margin) to land [HP Burn] on Skavag reliably."}',
  null, -- AI skill settings are NOT machine-readable (battle reader cannot see them); ask Mike per run.
  'HP-BURN SOLO — covers three of the five role-seats alone, which is why he needs no team. (1) SPIDERLINGS: Burning Lash places [Provoke] AoE at 40%, rising to 100% against targets already under [HP Burn] — and his own kit places that [HP Burn], so it is a SELF-COMBO (tag policy #1 exception) he delivers unaided. Provoked spiderlings cannot bite the team, and spiderlings are confirmed Provokable (Mike 2026-07-16). (2) DAMAGE: [HP Burn] from Eldritch Flames + the Fiery Blood passive ticks Skavag down; DoT is confirmed undampened on her (her immunity is CC-only). (3) SURVIVE: Eldritch Flames heals him 20% of damage dealt to [HP Burn]-ed targets, and Fiery Blood burns attackers on hit — so the spiderlings burn themselves down by attacking him — while stacking RES, exactly the Spider defensive stat. Lifesteal/Regeneration covers the rest.',
  'Mike (project owner, domain expert) — direct statement 2026-07-16: HP-Burn Spider solo up to Stage 20, set "lifesteal or regen". Kit text in champion_skills corroborates the mechanism independently. NOT sourced from community editorial content.',
  null, -- Affinity interaction at Spider Stage 20 NOT verified — deliberately left null rather than guessed.
  'Free from 3v3 Arena Bazaar — accessible to all accounts.',
  'High',
  'proposed',
  'claude-code-mike-confirmation-2026-07-16'
where not exists (
  select 1 from champion_solo_profiles p
  where p.champion_id = (select id from champions where name = 'Drexthar Bloodtwin')
    and p.dungeon_stage_id = (select ds.id from dungeon_stages ds join dungeons d on d.id = ds.dungeon_id
                              where d.name = 'Spider''s Den' and ds.label = 'Stage 20')
);

-- ── Drexthar Bloodtwin — Spider Stage 25 (CONDITIONAL: "occasionally, with the right gear") ──
-- Mike's wording was "occasionally Stage 24-25 with the right gear" — deliberately seeded at LOWER
-- confidence than Stage 20 and flagged as gear-gated, so the app never promises a Stage 25 solo to an
-- account that cannot gear it. Note this is exactly where HP Burn should pull AHEAD of the Enemy-Max-HP
-- nukers: the stage 21-25 boss passive caps %maxHP-SKILL damage, while HP Burn keeps ticking.
insert into champion_solo_profiles
  (champion_id, dungeon_stage_id, required_set, required_stats,
   ai_settings, mechanism, source_note,
   affinity_warning, availability_note, research_confidence, status, proposed_by)
select
  (select id from champions where name = 'Drexthar Bloodtwin'),
  (select ds.id from dungeon_stages ds join dungeons d on d.id = ds.dungeon_id
   where d.name = 'Spider''s Den' and ds.label = 'Stage 25'),
  'Lifesteal or Regeneration',
  '{"note": "GEAR-GATED and OCCASIONAL, not a reliable clear — Mike: \"occasionally Stage 24-25 with the right gear\". Needs a materially better build than the Stage 20 solo. Exact thresholds UNVERIFIED."}',
  null,
  'Same HP-Burn solo mechanism as his Stage 20 profile (self-comboed AoE Provoke on the spiderlings, [HP Burn] to kill, self-heal + RES stacking to survive). At 21-25 the boss passive caps %maxHP-SKILL damage, which throttles the Enemy-Max-HP nuke strategy but not [HP Burn] — so this is the stage band where the HP-Burn family is expected to be the strategy rather than one option among several. Gear, not kit, is the binding constraint here.',
  'Mike (project owner, domain expert) — direct statement 2026-07-16: "occasionally Stage 24-25 with the right gear". Confidence deliberately set below the Stage 20 row to reflect "occasionally".',
  null,
  'Free from 3v3 Arena Bazaar — accessible to all accounts.',
  'Low',
  'proposed',
  'claude-code-mike-confirmation-2026-07-16'
where not exists (
  select 1 from champion_solo_profiles p
  where p.champion_id = (select id from champions where name = 'Drexthar Bloodtwin')
    and p.dungeon_stage_id = (select ds.id from dungeon_stages ds join dungeons d on d.id = ds.dungeon_id
                              where d.name = 'Spider''s Den' and ds.label = 'Stage 25')
);
