-- ============================================================================
-- champion_skills.auto_reliable — AUTO-BATTLE reliability of a skill.
--
-- The game AI does not always fire a skill in a given content context the way a
-- manual player would (e.g. "AI never prioritizes this unless enemy HP > 75%",
-- "A3 on cooldown never triggers in time vs this boss"). This boolean annotates
-- the known problem cases. It is a RANKING MULTIPLIER, not a binary filter — a
-- champion with the right tag but an unreliable auto skill ranks LOWER for that
-- role; it is not excluded unless reliability is near zero.
--
-- Consumers: lib/damage-mechanics.js reliabilityFactor() (applies a nominal auto
-- penalty when false) and the Layer 1 watchdog's reliability flag (lib/watchdog.js),
-- which surfaces "fires on a long cooldown / low chance — may not land on auto".
--
-- DEFAULT true: an unannotated skill is assumed to fire reliably, so this column is
-- inert until specific skills are annotated. Idempotent.
-- ============================================================================
alter table champion_skills
  add column if not exists auto_reliable boolean not null default true;

comment on column champion_skills.auto_reliable is
  'Auto-battle reliability. false = the game AI does not reliably fire this skill in '
  'relevant content (annotate the reason in review_notes). Ranking multiplier, not a '
  'filter. Default true (assume reliable until proven otherwise).';
