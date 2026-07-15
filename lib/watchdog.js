// watchdog.js — Layer 1 SUSTAIN/CONTRIBUTION WATCHDOG.
//
// WHY THIS FILE EXISTS
// The match engine selects a team by tag COVERAGE (does a champ carry a tag some goal
// needs? yes/no). Coverage can't see MAGNITUDE or FIT, so it can bench a champion who
// contributes far more than one it fields — the canonical case: it benched Underpriest
// Brogni (HP Burn damage + a full sustain package) to field a champion whose marquee
// Decrease DEF adds ~nothing to a poison/HP-burn team. The watchdog re-scores the FULL
// roster on a COMPOSITE metric and, if a benched champion out-scores a fielded one,
// raises a WARNING in the explanation. It never changes the pick.
//
// SAFE TO SHIP NOW (Layer 1). It uses RELATIVE ranking (benched vs fielded), not
// absolute prediction — so it needs no gear calibration, no run data, and is NOT tied
// to the Layer 2 contribution model. Magnitudes are nominal; only the ORDER matters.
//
// COMPOSITE (the critical requirement — must NOT be damage-only, which demotes every
// support and would fire on every support-heavy team):
//   composite = damage_contribution
//             + sustain_contribution(mechanism × content_threat)   ← lib/sustain-profiles
//             + debuff-multiplier value this champ GRANTS this team ← lib/damage-mechanics
// Each term is normalized across the roster (0..1) before combining, so a pure support
// and a pure nuker are on the same footing.

import {
  TAG_TO_SOURCE, DEBUFF_DAMAGE_INTERACTIONS, debuffValueForTeam,
  teamDamageSources, auditTeamDebuffs, TURN_MULTIPLIER_TAGS,
} from './damage-mechanics.js';
import { sustainContribution, contentThreatWeight } from './sustain-profiles.js';

// Relative nominal weights for the three composite terms. Damage and sustain are
// deliberately CO-EQUAL (the whole point — sustain must not be demoted); the granted
// debuff-multiplier is a secondary factor. Sustain is additionally scaled by how
// threatening the content is (contentThreatWeight), so it matters more on Ice Golem
// than on Campaign.
const W_DAMAGE = 1.0;
const W_SUSTAIN_BASE = 1.0;
const W_GRANT = 0.6;

// Damage proxy weights. Attack potential comes from the role-relevant multiplier score;
// %maxHP DoT/mastery sources scale off boss HP and are strong flat contributors on the
// high-HP dungeon bosses this app targets. All nominal (relative ranking only).
const ATTACK_SCALE = 0.30;
const DOT_SOURCE_WEIGHT = { poison: 1.0, hp_burn: 1.0, enemy_maxhp: 1.2, warmaster: 0.6 };

// A benched champ must beat a fielded one by BOTH a relative and an absolute margin to
// flag — the absolute one stops two near-worthless champs (0.10 vs 0.06) from tripping a
// meaningless "swap" just because one edges the other. Composites run ~0..2.5.
const FLAG_REL_MARGIN = 0.15;
const FLAG_ABS_MARGIN = 0.25;
const MAX_FLAGS = 3;

const MULTIPLIER_DEBUFFS = new Set(
  Object.entries(DEBUFF_DAMAGE_INTERACTIONS).filter(([, r]) => r.affects.length > 0).map(([t]) => t)
);

/** Raw (un-normalized) damage potential for one champ, from its damage-source tags. */
function rawDamage(champ) {
  const srcs = new Set();
  for (const tag of champ.tags ?? []) { const s = TAG_TO_SOURCE[tag]; if (s) srcs.add(s); }
  // General attack/nuke potential (role-relevant skill coefficient from attachDamageScores).
  let s = (champ.damage_multiplier_score ?? 0) * ATTACK_SCALE;
  // %maxHP DoT sources the champ carries (Poison / HP Burn / Enemy Max HP nuke).
  for (const src of srcs) if (src !== 'attack') s += DOT_SOURCE_WEIGHT[src] ?? 0;
  if (champ.has_boss_mastery) s += DOT_SOURCE_WEIGHT.warmaster; // Warmaster/Giant Slayer %maxHP
  return s;
}

/**
 * Raw granted-multiplier value this champ brings THIS team: damage-debuffs (weighted by
 * whether they match the team's damage type) PLUS team-turn buffs (Increase Speed / Turn
 * Meter), which multiply every per-turn source regardless of damage type (§3b). Without
 * the turn-buff term a pure speed-support scores ~0 and gets benched — the exact blindness
 * this watchdog exists to catch.
 */
function rawGrant(champ, teamSources) {
  let s = 0;
  for (const tag of champ.tags ?? []) {
    if (MULTIPLIER_DEBUFFS.has(tag)) {
      const cls = debuffValueForTeam(tag, teamSources); // 'high'|'medium'|'low'|'none' for THIS team
      s += cls === 'high' ? 0.5 : cls === 'medium' ? 0.25 : cls === 'low' ? 0.1 : 0;
    }
    // Team-turn buffs help any damage type (they buy turns, not a damage-type-specific lift).
    if (TURN_MULTIPLIER_TAGS[tag]) s += TURN_MULTIPLIER_TAGS[tag]; // 0.30 speed / 0.15 TM (nominal)
  }
  return s;
}

const normBy = (v, max) => (max > 0 ? v / max : 0);

/**
 * Composite score every champion in `roster`, relative to `teamSources` and `contentKey`.
 * @returns Array<{name, composite, damage, sustain, grant, sustainMechanisms, champ}>
 *   `damage`/`sustain`/`grant` are the NORMALIZED (0..1) sub-scores; composite is weighted.
 */
export function computeCompositeScores(roster = [], { contentKey, teamSources = [] } = {}) {
  const wSustain = W_SUSTAIN_BASE * (0.5 + contentThreatWeight(contentKey)); // 0.5..1.5
  const raw = roster.map(c => {
    const sc = sustainContribution(c.tags ?? [], contentKey);
    return { champ: c, name: c.name, dmg: rawDamage(c), sus: sc.score, grant: rawGrant(c, teamSources), sustainMechanisms: sc.mechanisms };
  });
  const maxDmg   = Math.max(0, ...raw.map(r => r.dmg));
  const maxSus   = Math.max(0, ...raw.map(r => r.sus));
  const maxGrant = Math.max(0, ...raw.map(r => r.grant));
  return raw.map(r => {
    const damage  = normBy(r.dmg, maxDmg);
    const sustain = normBy(r.sus, maxSus);
    const grant   = normBy(r.grant, maxGrant);
    const composite = W_DAMAGE * damage + wSustain * sustain + W_GRANT * grant;
    return { name: r.name, composite, damage, sustain, grant, sustainMechanisms: r.sustainMechanisms, champ: r.champ };
  });
}

/** The single dominant reason a champ scores well, for narration. */
function dominantRole(score, { teamSources }) {
  const parts = [
    { k: 'damage',  w: W_DAMAGE * score.damage,  label: 'damage output' },
    { k: 'sustain', w: score.sustain, label: score.sustainMechanisms.length ? `sustain (${score.sustainMechanisms.join(' + ')})` : 'sustain' },
    { k: 'grant',   w: W_GRANT * score.grant,    label: 'debuff multipliers it grants the team' },
  ].sort((a, b) => b.w - a.w);
  return parts[0].label;
}

/** Why a FIELDED champ is weak here — a mismatched damage-debuff, else generic. */
function fieldedWeakness(champ, teamSources) {
  for (const tag of champ.tags ?? []) {
    if (MULTIPLIER_DEBUFFS.has(tag) && debuffValueForTeam(tag, teamSources) === 'none') {
      const affects = DEBUFF_DAMAGE_INTERACTIONS[tag].affects.join('/');
      return `${champ.name}'s ${tag} multiplies ${affects} damage, which this ${teamSources.length ? teamSources.join('/') : 'no-tagged-damage'} team doesn't deal — it adds ~nothing here`;
    }
  }
  return `${champ.name} contributes comparatively little to this content`;
}

/**
 * Run the watchdog. Pure; no DB/LLM/async. Compares every BENCHED champion against the
 * FIELDED team on composite score and flags inversions (benched > fielded). Gated on
 * usability so an UNBUILT benched champ (which the engine benches on purpose) can't fire
 * the warning — only a champ at least as fieldable as the one it out-scores.
 *
 * @param {object} p
 * @param {Array}  p.roster      full mapped roster (each: {name, tags[], damage_multiplier_score, has_boss_mastery, ...})
 * @param {Array}  p.team        the 5 fielded champions (subset of roster, by name)
 * @param {string} p.contentKey  e.g. 'ice_golem'
 * @param {(c:object)=>number} p.usabilityTier  same gate the selector uses (built vs fodder)
 * @param {number|null} p.fightTurns for the reliability audit
 * @returns {{ flags:Array, reliability:Array, scores:Array }|null}
 */
export function runWatchdog({ roster = [], team = [], contentKey, usabilityTier = () => 0, fightTurns = null } = {}) {
  if (!roster.length || !team.length) return null;
  const teamSources = teamDamageSources(team);
  const scores = computeCompositeScores(roster, { contentKey, teamSources });
  const byName = new Map(scores.map(s => [s.name, s]));
  const fieldedNames = new Set(team.map(c => c.name));

  const fielded = team.map(c => ({ champ: c, score: byName.get(c.name), tier: usabilityTier(c) }))
    .filter(x => x.score);
  const benched = roster.filter(c => !fieldedNames.has(c.name))
    .map(c => ({ champ: c, score: byName.get(c.name), tier: usabilityTier(c) }))
    .filter(x => x.score);

  // For each benched champ, find the WEAKEST fielded champ it out-scores (usability-gated
  // and past the margin). One flag per benched champ, most-egregious inversion first.
  const flags = [];
  for (const b of benched) {
    let worst = null; // the fielded champ it beats by the most
    for (const f of fielded) {
      if (b.tier < f.tier) continue;                                  // don't promote unbuilt champs
      if (b.score.composite <= f.score.composite * (1 + FLAG_REL_MARGIN)) continue;
      if (b.score.composite - f.score.composite < FLAG_ABS_MARGIN) continue; // ignore trivial edges
      if (!worst || f.score.composite < worst.score.composite) worst = f;
    }
    if (!worst) continue;
    flags.push({
      benched: b.champ.name,
      fielded: worst.champ.name,
      benched_composite: round2(b.score.composite),
      fielded_composite: round2(worst.score.composite),
      benched_role: dominantRole(b.score, { teamSources }),
      detail: `Coverage benched ${b.champ.name} (strong ${dominantRole(b.score, { teamSources })} for this content) `
            + `to field ${worst.champ.name} — ${fieldedWeakness(worst.champ, teamSources)}. `
            + `Consider swapping ${worst.champ.name} → ${b.champ.name}.`,
      margin: b.score.composite - worst.score.composite,
    });
  }
  flags.sort((a, b) => b.margin - a.margin);

  // Reliability: fielded champs whose key debuff is weak on auto (low chance / long
  // cooldown / auto_reliable=false). Reuses the Layer 1 debuff audit; degrades to
  // "reliability unknown" where proc data isn't captured (honest about the data gap).
  const reliability = auditTeamDebuffs(team, { fightTurns })
    .filter(f => f.kind === 'low_reliability' || f.kind === 'reliability_unknown')
    .map(f => ({ champion: f.champion, tag: f.tag, kind: f.kind, detail: f.detail }));

  return {
    flags: flags.slice(0, MAX_FLAGS).map(({ margin, ...rest }) => rest),
    reliability,
    scores: scores
      .map(s => ({ name: s.name, composite: round2(s.composite), damage: round2(s.damage), sustain: round2(s.sustain), grant: round2(s.grant), fielded: fieldedNames.has(s.name) }))
      .sort((a, b) => b.composite - a.composite),
  };
}

const round2 = (n) => Math.round(n * 100) / 100;
