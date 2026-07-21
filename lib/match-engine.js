import { createClient } from '@supabase/supabase-js';
import { estimateStats, normalizeGearTier, applyAccountBonus } from './estimate-stats.js';
import { bossMasteryDamageModifier, resolveBossMastery } from './masteries.js';
import { estimateCbDamage, carriers } from './cb-damage-model.js';
import { computeContributions } from './contribution-model.js';
import { maxHpCapFor } from './damage-mechanics.js';
import { chestTierFor, clanBossRecommendation } from './clan-boss.js';
import { clanBossStunScore, affinityMatchup } from './formulas.js';
import { attachDamageScores } from './multiplier-rank.js';
import { detectSynergies } from './synergies.js';
import { runWatchdog } from './watchdog.js';

const supabase = createClient(
  (process.env.SUPABASE_URL ?? '').replace(/\/rest\/v1\/?$/, ''),
  process.env.SUPABASE_SERVICE_KEY,
  { global: { fetch } }
);

// Maps the contentKey passed by the UI to a dungeon name + stage label in the DB,
// plus a concrete stageNumber used when evaluating formula-based thresholds.
const CONTENT_MAP = {
  campaign:    { dungeon: 'Campaign',     stage: 'Early (1-12)',   stageNumber: null },
  spider_hard: { dungeon: "Spider's Den", stage: 'Hard Stage 10',  stageNumber: 10   },
  clan_boss:   { dungeon: 'Clan Boss',    stage: 'Normal',         stageNumber: null },
};

// Multi-phase dungeon content scanned for the highest clearable stage (no user-selected
// stage — matchRoster runs scanDungeonStages). Each stage is its own "Stage <n>" DB row
// with wave + boss phases, so the scanner unions goals/thresholds across phases.
const DUNGEON_STAGE_CONTENT = {
  fire_knight: "Fire Knight's Castle",
  ice_golem:   "Ice Golem's Peak",
  dragon:      "Dragon's Lair",
};

// Fire Knight / Ice Golem take NO user-selected stage — matchRoster auto-scans for the
// highest clearable stage (scanDungeonStages), the same UX as Spider's Den. Their seeded
// ranges (Fire Knight 1-25, Ice Golem 10-20) are just whatever stages exist in the DB.

// Spider's Den Normal — scan groups ordered highest-first (three STRATEGY TIERS, seeds 117/118).
// The scanner iterates groups top-down and, within each, stage numbers top-down, returning the
// highest stage where confidence ≥ threshold. Unlike the old model, each tier has DIFFERENT
// goals/solutions (1-14 AoE nuke → 15-20 MaxHP/Poison/HP-Burn → 21-25 HP Burn). The ACC floor
// `stage * 10` is evaluated per stageNumber so it tightens as the scan climbs (apply the ~10%
// margin in the explanation layer, not the floor). Content_label uses the stageNumber → "Stage 17".
const SPIDER_SCAN_GROUPS = [
  { label: 'Stages 21-25', stageNumbers: [25, 24, 23, 22, 21] },
  { label: 'Stages 15-20', stageNumbers: [20, 19, 18, 17, 16, 15] },
  { label: 'Stages 1-14',  stageNumbers: [14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1] },
];

// Resolves a stat-threshold formula to a numeric floor. Two safe shapes only (no
// eval() on arbitrary strings):
//   • a bare numeric constant ("120", "35000") — an absolute floor, stage-independent.
//     These dominate the seeded data (Clan Boss tiers, Fire Knight/Ice Golem stages)
//     and must evaluate even when stageNumber is null.
//   • 'stage * N' — a stage-scaled floor (e.g. Spider's "stage * 10"); needs the stage.
// relative_to_enemy checks never reach here (handled separately as needs_review).
function evalFormula(formula, stageNumber) {
  const f = (formula ?? '').trim();
  if (!f) return null;

  const constMatch = f.match(/^(\d+(?:\.\d+)?)$/);
  if (constMatch) return parseFloat(constMatch[1]);

  if (stageNumber == null) return null;
  // 'stage * N + M' / 'stage * N - M' — a stage-scaled floor with an offset (e.g.
  // Spider's RES floor "stage * 10 + 100" ≈ enemy ACC + 100). Checked before the
  // bare 'stage * N' form since that one is anchored and won't match the offset.
  const mOff = f.match(/^stage\s*\*\s*(\d+(?:\.\d+)?)\s*([+-])\s*(\d+(?:\.\d+)?)$/);
  if (mOff) {
    const base = stageNumber * parseFloat(mOff[1]);
    return mOff[2] === '+' ? base + parseFloat(mOff[3]) : base - parseFloat(mOff[3]);
  }
  const m = f.match(/^stage\s*\*\s*(\d+(?:\.\d+)?)$/);
  if (!m) return null;
  return stageNumber * parseFloat(m[1]);
}

// Maps gear tier label to a numeric weight for min-gear calculation.
// Updated gear-tier system (2026-07-11): starter/fair/good/endgame.
const GEAR_WEIGHT = { starter: 1, fair: 2, good: 3, endgame: 4 };

// CALIBRATION NOTE: These bands are placeholder estimates derived from matching engine logic.
// As recommendation_outcomes data accumulates, replace with empirically-derived success rates
// per content type. Target: recalibrate once 1,000+ outcomes exist for a given dungeon/difficulty.
// See STRATEGY.md for the full data moat roadmap.
const VERDICT_BAND_CONFIG = {
  all_goals_strong_gear:  { min: 85, max: 95 },
  all_goals_dungeon_gear: { min: 70, max: 84 },
  borderline_threshold:   { min: 55, max: 69 },
  stats_failing:          { min: 40, max: 54 },
  one_goal_gap:           { min: 20, max: 39 },
  multi_goal_gap:         { min:  5, max: 19 },
  /* RECOMMENDATION BUDGET, not a gate (Mike, 2026-07-20: "no hard lines — the game just lets you
   * fail"). The scan recommends the HIGHEST stage scoring at/above this; stages above it are still
   * surfaced as `stretch` with their confidence + notes, never hidden. Was a hard 80% cutoff that,
   * fed by soft floors, silently dropped clearable stages — the exact cause of the Dragon
   * under-recommendation (recommended floor 4 for a team that clears 15). NOMINAL; tune to outcomes. */
  recommendBudgetPct: 55,
};

// A coverage gap = a missing capability. It LOWERS confidence and is NAMED in a note
// (buildShortfallNotes), but never gates (see computeVerdictBand). Magnitudes nominal/uncalibrated.
const COVERAGE_SOFT_PER_GAP = 0.25;   // each uncovered goal: -25% confidence (multiplicative)
const COVERAGE_SOFT_FLOOR   = 0.40;   // ...floored so even a multi-gap roster stays attemptable
const STRETCH_MIN_PCT       = 30;     // higher stages scoring >= this surface as "stretch" attempts

// Derives the verdict band slug and display confidence percentage from match output.
// Bands correspond 1-to-1 with the Phase 1 percentage ranges in STRATEGY.md so the
// Phase 2 calibration query can group by band and compare displayed vs actual rates.
//
// Within each band, position is determined by the ratio of evaluable thresholds that pass:
// more passing → higher end of the band. "borderline" means passing but estimated value is
// within 10% above the floor — close enough that real substat variance could tip it either way.
function computeVerdictBand(gaps, thresholdResults, team) {
  /* NO HARD LINES (Mike, 2026-07-20: "the game just lets you fail"). A coverage gap used to CLAMP
   * confidence into the 5-39% gap bands, which — under the scan's confidence cutoff — silently
   * dropped the stage and recommended a lower one. That was a hidden hard line. Now a gap is a SOFT
   * penalty + a NAMED note (buildShortfallNotes / the returned `gaps`), never a cliff. The band
   * LABEL still names the headline issue for telemetry + the UI (and keeps the STRATEGY.md /
   * Phase-2 calibration bands populated), but it no longer decides the confidence NUMBER — that
   * comes from GEAR, then the soft coverage + soft stat penalties below. */
  const minGear  = Math.min(...(team ?? []).map(c => gearTierWeight(c.gear_tier)));
  const gearBand = minGear >= 3 ? 'all_goals_strong_gear' : 'all_goals_dungeon_gear';
  const band = gaps.length >= 2 ? 'multi_goal_gap'
             : gaps.length === 1 ? 'one_goal_gap'
             : gearBand;

  const { min, max } = VERDICT_BAND_CONFIG[gearBand];

  // Scale within the gear band by pass ratio of the HARD-evaluable thresholds (soft floors excluded;
  // they apply their own multiplier below).
  const evaluable  = thresholdResults.filter(t => (t.passes === true || t.passes === false) && !t.soft);
  const passRatio  = evaluable.length
    ? evaluable.filter(t => t.passes === true).length / evaluable.length
    : 1;
  let confidence_pct = min + passRatio * (max - min);

  /* Soft COVERAGE penalty — a missing capability lowers the odds but never zeroes the stage (it is
   * also surfaced by name). Floored so even a multi-gap roster stays attemptable — bring the ability
   * or grind it out, the game never refuses entry. */
  if (gaps.length) confidence_pct *= Math.max(COVERAGE_SOFT_FLOOR, 1 - COVERAGE_SOFT_PER_GAP * gaps.length);

  /* EVERY stat floor degrades confidence continuously — none of them gates. Below a floor the team
   * still plays: a debuff lands less often, the boss's debuffs land more often, you take more hits —
   * a SLOWER, riskier clear (what CLAUDE.md judges by, TIME), never "you may not attempt this stage".
   *
   * WEAKEST LINK across these SURVIVAL floors — and that is NOT the "veto" to remove (tested 2026-07-20,
   * a reliability-weighted blend was tried and REVERTED because it regressed: Bambus IG 13->20, Dragon
   * 19->24). Survival is genuinely a weakest-link property — you die from whichever stat is lowest, and
   * a great ACC cannot rescue a fatally-low HP, so letting it "lift" the number over-recommends. The
   * objectionable veto is combining DIFFERENT AXES (stats vs capability) by min — that would cap a good
   * team on one stat; those are blended elsewhere. This is floored at 0.20 (never 0), so it is not a
   * hard line: it says "your odds track your weakest survival dimension", which is honest, not a gate. */
  const softs = thresholdResults
    .map(t => (t?.soft ? (t.acc_reliability ?? t.reliability) : null))
    .filter(r => typeof r === 'number' && r < 1);
  if (softs.length) {
    const rel = Math.min(...softs);
    confidence_pct *= 0.20 + 0.80 * Math.max(0, Math.min(1, rel));
  }

  return { verdict_band: band, confidence_pct: Math.round(confidence_pct) };
}

/* Human-readable notes for everything the recommended stage falls short on — surfaced WITH the
 * recommendation, never a reason to withhold it (Mike: recommend the team, NAME what's missing).
 * Two kinds: missing CAPABILITIES (coverage gaps — no owned champion supplies the ability) and
 * soft STAT floors the team is materially under (ACC carrier / RES-HP-DEF-SPD team-min). */
function buildShortfallNotes(gaps, thresholdResults) {
  const notes = [];
  for (const g of gaps ?? []) {
    notes.push({ kind: 'missing_capability', goal: g,
      text: `Missing: ${g} — still clearable, but expect a slower/riskier run until you add a champion who can.` });
  }
  for (const t of thresholdResults ?? []) {
    if (!t?.soft) continue;
    const rel = t.acc_reliability ?? t.reliability;
    if (rel == null || rel >= 0.85) continue;   // only flag stats the team is MATERIALLY under
    const stat = String(t.stat ?? '').toUpperCase();
    const have = t.estimated_value != null ? `~${t.estimated_value}` : 'low';
    notes.push({ kind: 'soft_stat', stat: t.stat, have: t.estimated_value ?? null, floor: t.threshold_value ?? null,
      text: `${stat} ${have} vs a recommended ${t.threshold_value} — a soft target, not a wall; strong sustain/cleanse can cover it (you clear slower, you don't get blocked).` });
  }
  return notes;
}

// Higher stages that fell short of the recommend budget — surfaced as attemptable STRETCH options
// (never hidden), NEAREST above the recommendation first (the realistic next pushes), trimmed.
function pickStretch(candidates, aboveStage) {
  return (candidates ?? [])
    .filter(s => s.stageNumber > aboveStage && s.confidence_pct != null && s.confidence_pct >= STRETCH_MIN_PCT)
    .sort((a, b) => a.stageNumber - b.stageNumber)
    .slice(0, 4);
}

// Applies the stage's boss AFFINITY to a computed confidence. A champion WEAK vs the
// boss (Weak Hits — less damage, crits suppressed, and takes extra crits) is a real risk
// the coverage/threshold logic can't see. This is a SOFT factor like the ACC floor: it
// degrades confidence, never hard-fails a stage (the team still clears, just harder/slower —
// confirmed live: DonBrogni Spider 11 Force cleared but nearly lost with 2 weak champs).
//
// ASYMMETRIC BY DESIGN: only WEAK champs penalize; STRONG affinity earns NO confidence bonus.
// Rationale: (a) survival is a floor — three strong damage dealers don't rescue a weak sustain
// backbone (the exact Stage 11 near-loss); (b) the measurement spine already shows confidence
// runs OVER-optimistic, so inflating it for strong affinity is the wrong direction. Void, and
// same-affinity, are neutral. Magnitudes NOMINAL/uncalibrated — tune against known-affinity runs.
function applyAffinityToConfidence(confidence_pct, team, stageAffinity) {
  if (confidence_pct == null || !stageAffinity) return { confidence_pct, affinity: null };
  const per = (team ?? []).map(c => ({ name: c.name, affinity: c.affinity,
    matchup: affinityMatchup(c.affinity, stageAffinity) }));
  const weak   = per.filter(p => p.matchup === 'weak');
  const strong = per.filter(p => p.matchup === 'strong');
  const factor = Math.max(0.55, 1 - 0.10 * weak.length); // -10% per weak champ, floored
  const adjusted = Math.round(confidence_pct * factor);
  const note = weak.length === 0
    ? `Boss affinity ${stageAffinity}: no fielded champion is weak here${strong.length ? ` (${strong.length} strong)` : ''}.`
    : `Boss affinity ${stageAffinity}: ${weak.length} fielded champ(s) WEAK (${weak.map(w => `${w.name}/${w.affinity}`).join(', ')}) — `
      + `they deal less (Weak Hits) and take more. Expect a harder, slower clear; bring Void or same-affinity champs.`;
  return { confidence_pct: adjusted, affinity: { stage_affinity: stageAffinity, weak_count: weak.length,
    strong_count: strong.length, factor, weak: weak.map(w => w.name), note } };
}

function rarityWeight(r) {
  return { Common: 1, Uncommon: 2, Rare: 3, Epic: 4, Legendary: 5, Mythical: 6 }[r] ?? 0;
}

function gearTierWeight(t) {
  return GEAR_WEIGHT[normalizeGearTier(t)] ?? 1;
}

// Maps raw user_champions rows to the engine's internal champion shape (approved
// tags, ascension-gated tags surfaced, estimated stats). Shared by matchRoster
// (which then selects a team) and evaluateTeam (which scores a fixed team).
export function mapRoster(roster, opts = {}) {
  // Account-level gear context (manual rosters only): gear tier + Great Hall/Arena bundle.
  const accountDev = opts.accountDev ?? null;
  const gearTier   = opts.gearTier ?? null;
  const zero_tag_warnings = [];
  const ascension_gaps = []; // tags that exist but are locked behind ascension
  const mapped = (roster ?? []).map(uc => {
    const ch = uc.champion;
    const playerAscension = uc.ascension_level ?? 0;
    const approvedTags = (ch.champion_tags ?? [])
      .filter(ct => {
        if (ct.status !== 'approved') return false;
        const required = ct.ascension_required ?? 0;
        if (required > playerAscension) {
          ascension_gaps.push({
            champion: ch.name, tag: ct.tags.name, has: playerAscension, needs: required,
            message: `${ch.name} can cover ${ct.tags.name} but needs ${required}-star ascension (currently ${playerAscension}-star).`,
          });
          return false;
        }
        return true;
      })
      .map(ct => ct.tags.name);
    if (approvedTags.length === 0) zero_tag_warnings.push(ch.name);
    return {
      id: ch.id, name: ch.name, rarity: ch.rarity, role: ch.role ?? null,
      faction: ch.faction ?? null,   // team-composition synergy detection (lib/synergies.js)
      affinity: ch.affinity ?? null, // leader-aura restriction matching (selectLeader)
      // base stats — used to size %-of-base leader auras (SPD/ATK/DEF/HP) in applyLeaderAura.
      base_hp: ch.base_hp ?? 0, base_atk: ch.base_atk ?? 0, base_def: ch.base_def ?? 0, base_spd: ch.base_spd ?? 0,
      stars: uc.stars, level: uc.level,
      // Gear tier: Gestal rosters carry a REAL per-champion tier (gearTierFromArtifacts) —
      // use it and IGNORE the account-level selector, which would flatten every champ to one
      // tier and throw away the fact that gear varies per champion. Manual rosters have no
      // per-champ gear, so they use the account selector. Normalize to the canonical
      // GEAR_TIERS scale so God Tier / Strong / Dungeon aren't misread as Starter.
      gear_tier: normalizeGearTier(uc.effective_stats ? (uc.gear_tier ?? gearTier) : (gearTier ?? uc.gear_tier)),
      ascension_level: uc.ascension_level,
      // Skill-book assumption (INS-0003): Rare skill books are cheap/abundant, so credit
      // Rares at MAX (booked) skills — booked chances + reduced cooldowns + books-only
      // effects treated as functional. Epic/Legendary respect the player's explicit
      // is_booked (books scarce). Currently a representation-only hook: the engine ignores
      // booking today (all approved tags count regardless), so this changes nothing yet —
      // it is the anchor the reliability layer MUST consult when chance/cooldown get plumbed,
      // so a Rare is never scored at its weaker unbooked values.
      assume_booked: ch.rarity === 'Rare' ? true : (uc.is_booked ?? false),
      tags: approvedTags,
      // Verbatim Plarium skill text (champion_skills), ordered A1→A4→Passive — the
      // ground-truth source for the explanation layer (lib/explain.js). Tags are a lossy
      // index; without the skill text the LLM narrated from memory and fabricated kits
      // (Ninja's Decrease DEF became "Decrease ATK"; Duchess grew a nonexistent Leech +
      // cleanse). Carried here so describeTeam can hand the model the real text.
      skills: (ch.champion_skills ?? [])
        .slice().sort((a, b) => String(a.slot).localeCompare(String(b.slot)))
        .map(s => ({ slot: s.slot, name: s.skill_name, summary: s.skill_summary }))
        .filter(s => s.summary),
      /* REAL %maxHP DAMAGE FRACTION (2026-07-21, seed 202 + its migration). Replaces the flat
       * nominal SOURCE_COEFF.enemy_maxhp = 0.05 for champions where the actual percentage was
       * extracted from verbatim skill text. Only `maxhp_effect_kind = 'damage'` qualifies — the
       * other two kinds are MAX-HP DESTRUCTION (shrinks the pool rather than damaging out of it)
       * and are a different mechanic the damage model must not credit. The DB CHECK already
       * guarantees kind='damage' implies basis='enemy_max_hp', so this is a true fraction of the
       * target's max HP and directly comparable to the §6b cap. Null when unextracted → the
       * contribution model falls back to the nominal, and says which it used. */
      maxhp_damage: maxHpDamageProfile(ch.champion_skills ?? []),
      // Gestal rosters use REAL effective stats (from actual gear) + the Great Hall/Arena
      // ACC/RES estimate on top (Gestal doesn't export Great Hall levels, so it's the
      // account_development bundle — effectiveStats has no account-wide term of its own).
      // Manual rosters use the gear-tier + development estimator.
      estimated_stats: uc.effective_stats
        ? applyAccountBonus(uc.effective_stats, accountDev)
        : estimateStats(ch, uc, { accountDev, gearTier }),
      stats_source: uc.effective_stats ? 'gestal_effective' : 'estimated',
      // Only Warmaster/Giant Slayer meaningfully drive boss damage. Gestal: read from real
      // masteryIds; manual: the level-60-gated answer (or legacy mastery_tier). See masteries.js.
      has_boss_mastery: resolveBossMastery(uc),
    };
  });
  return { mapped, zero_tag_warnings, ascension_gaps };
}

// A tag is ACCURACY-GATED when it is a debuff that must pass an ACC/RES check to
// land: is_debuff AND NOT bypasses_accuracy_check. Buffs/auras/heals/damage/self-
// effects are is_debuff=false (ACC never applies); True Fear etc. bypass the check.
function isAccuracyGated(tag) {
  return !!tag?.is_debuff && !tag?.bypasses_accuracy_check;
}

// ACC threshold — carrier-aware and per-GOAL, NOT team-min. ACC only matters for
// the champions who must land an accuracy-gated debuff that a goal actually depends
// on; a goal covered by a non-ACC solution (e.g. pure AoE Damage) never invokes it.
// LIMITATION: one ACC floor per phase applies to every gated debuff — per-debuff
// floors (e.g. higher-RES enemies) are not implemented; extend here if data demands.
function evaluateAccThreshold(check, floor, team, goals) {
  const teamTagSet = new Set((team ?? []).flatMap(c => c.tags));
  const bestAccFor = (tagName) => {
    const carriers = (team ?? []).filter(c => c.tags.includes(tagName));
    return carriers.length ? Math.max(...carriers.map(c => c.estimated_stats.acc ?? 0)) : null;
  };

  const perGoal = [];
  for (const goal of goals ?? []) {
    if (goal.is_informational) continue;
    const solutions = (goal.goal_solutions ?? [])
      .filter(s => s.status === 'approved' && (s.goal_solution_tags ?? []).length > 0);
    const satisfied = solutions.filter(s =>
      s.goal_solution_tags.every(gst => teamTagSet.has(gst.tags.name)));
    if (!satisfied.length) continue; // (coverage gap — owned by computeTagCoverage, not ACC)

    // (b) any satisfied solution needing no accuracy-gated tag → ACC irrelevant here
    const viaNonAcc = satisfied.find(s => !s.goal_solution_tags.some(gst => isAccuracyGated(gst.tags)));
    if (viaNonAcc) { perGoal.push({ goal: goal.description, acc_relevant: false, passes: true, via: viaNonAcc.label }); continue; }

    // every satisfying path needs a gated debuff to land: pass if SOME solution has
    // ALL its gated tags carried by a champion at/above the floor.
    let via = null; const detail = []; let bestRel = 0;
    for (const sol of satisfied) {
      const accTags = sol.goal_solution_tags.map(g => g.tags).filter(isAccuracyGated);
      let allLandable = true; let solRel = 1;
      for (const t of accTags) {
        const best = bestAccFor(t.name);            // (a) multiple carriers → best ACC wins
        const landable = best != null && best >= floor;
        // ACC is a SOFT floor: below it the debuff still LANDS, just less often
        // (floors-are-not-gates). reliability = how close the carrier sits to the floor
        // (1 = at/above; 0 = no carrier). The solution's reliability is its weakest tag.
        const rel = best == null ? 0 : Math.max(0, Math.min(1, best / floor));
        solRel = Math.min(solRel, rel);
        detail.push({ tag: t.name, bestAcc: best, floor, landable });
        if (!landable) allLandable = false;          // (c) carrier(s) exist but under the floor
      }
      bestRel = Math.max(bestRel, solRel);            // the path the AI can land most reliably
      if (allLandable) { via = sol.label; break; }
    }
    perGoal.push({ goal: goal.description, acc_relevant: true, passes: !!via, via, detail,
                   reliability: via ? 1 : bestRel });
  }

  const relevant = perGoal.filter(r => r.acc_relevant);
  const failing = relevant.filter(r => !r.passes);
  const passes = failing.length === 0;
  // Weakest-link reliability across every ACC-dependent goal (1 when all land).
  const acc_reliability = relevant.length
    ? Math.min(...relevant.map(r => r.reliability ?? 1))
    : 1;
  const limiting = failing.length
    ? Math.min(...failing.flatMap(r => (r.detail ?? []).filter(d => !d.landable).map(d => d.bestAcc ?? 0)))
    : null;
  const notes = relevant.length === 0
    ? `ACC floor ${floor}: no covered goal needs an accuracy-gated debuff to land — ACC not required.`
    : passes
      ? `ACC floor ${floor}: all ${relevant.length} ACC-dependent goal(s) have a carrier at/above the floor.`
      : `ACC floor ${floor}: ${failing.length} ACC-dependent goal(s) below the floor (${Math.round(acc_reliability * 100)}% of floor) — `
        + failing.map(r => `"${(r.goal ?? '').slice(0, 40)}" [`
            + (r.detail ?? []).filter(d => !d.landable).map(d => `${d.tag} best ${d.bestAcc ?? 'none'}`).join(', ') + ']').join('; ')
        + '. Soft floor: the debuff still lands, just less often — expect slower (grindier) clears, not a loss.';
  // ACC is a SOFT floor (soft:true): computeVerdictBand degrades confidence in
  // proportion to acc_reliability instead of hard-failing the stage. Coverage gaps
  // (no carrier at all) remain hard — those are owned by computeTagCoverage.
  return { stat: 'acc', formula: check.formula, threshold_type: check.threshold_type ?? 'raw',
           threshold_value: floor, estimated_value: limiting, passes, soft: true, acc_reliability,
           notes, acc_detail: perGoal };
}

// Evaluates stat threshold checks against the SELECTED TEAM. HP/DEF/SPD/RES stay
// team-min (a survivability / turn-order floor must hold for ALL fielded champions —
// e.g. Ice Golem's Frigid Vengeance is AoE and hits everyone). The FLOOR NUMBERS are
// calibration placeholders (see stat_threshold_checks.notes). ACC is NOT team-min —
// it's carrier-aware (evaluateAccThreshold), since only the debuffers need it.
function evaluateThresholds(thresholdChecks, stageNumber, team, goals) {
  const results = [];
  for (const check of thresholdChecks ?? []) {
    if (check.comparison !== 'formula') {
      results.push({ stat: check.stat, formula: null, threshold_type: check.threshold_type ?? 'raw', threshold_value: null, estimated_value: null, passes: 'needs_review', notes: check.notes ?? 'Relative-to-enemy check — requires enemy stat data to evaluate' });
      continue;
    }
    const threshold = evalFormula(check.formula, stageNumber);
    if (threshold == null) {
      results.push({ stat: check.stat, formula: check.formula, threshold_value: null, estimated_value: null, passes: null, notes: 'Could not evaluate formula — stage number unknown' });
      continue;
    }
    if (check.stat === 'acc') {
      results.push(evaluateAccThreshold(check, threshold, team, goals));
      continue;
    }
    const relevantStats = (team ?? []).map(c => c.estimated_stats[check.stat] ?? 0);
    const minStat = relevantStats.length ? Math.min(...relevantStats) : 0;
    /* EVERY stat floor is SOFT (Mike, 2026-07-20): "all the accuracy and resistance numbers are
     * RECOMMENDATIONS, not hard lines. There is no such thing as a blocker in the game. We don't
     * get to a floor and have the game tell us we can't play it because our accuracy is too low.
     * The game just lets us die because we can't land debuffs."
     *
     * Previously ACC alone was soft (INS-0014) and HP/DEF/SPD/RES hard-failed the stage. That is
     * THE cause of gen-1's largest recorded miss: Dragon declares RES ~200 from stage 7 and 250-300
     * from 10 up, but the highest RES on ANY of six synced accounts is 119 (measured 2026-07-20 on
     * the corrected stat map). So every Dragon stage >= 7 hard-failed, the scan fell to the last
     * stage with no RES floor — stage 6 — while DonThor cleared 17 through 22. A model whose floors
     * gate can never recommend content the floors are wrong about, and these floors ARE wrong.
     *
     * `reliability` is how much of the floor the weakest fielded champion actually has, capped at 1.
     * Below the floor you still play — you just die more or grind (floors-are-not-gates memory:
     * "below the floor you still WIN, just SLOWLY"). `passes` is retained for display/telemetry
     * ONLY; computeVerdictBand no longer branches on it. */
    const reliability = threshold > 0 ? Math.min(1, minStat / threshold) : 1;
    results.push({ stat: check.stat, formula: check.formula, threshold_type: check.threshold_type ?? 'raw',
                   threshold_value: threshold, estimated_value: minStat,
                   passes: minStat >= threshold, soft: true, reliability, notes: check.notes });
  }
  return results;
}

// Evaluates tag coverage against all phase goals for the given roster tag set.
function computeTagCoverage(goals, rosterTagSet) {
  const actionableGoals = (goals ?? []).filter(g => !g.is_informational);
  const coverage = {};
  const gaps = [];
  for (const goal of goals ?? []) {
    if (goal.is_informational) continue;
    const solutions = (goal.goal_solutions ?? []).filter(s => s.status === 'approved');
    let satisfied = false, matchedLabel = null;
    // A solution with NO required tags is a skeleton row (e.g. seeded but never
    // tagged). `[].every()` is vacuously true, which would falsely mark the goal
    // covered for ANY roster — so skip tagless solutions entirely.
    const tagged = solutions.filter(s => (s.goal_solution_tags ?? []).length > 0);
    for (const sol of tagged) {
      const required = sol.goal_solution_tags.map(gst => gst.tags.name);
      if (required.every(t => rosterTagSet.has(t))) { satisfied = true; matchedLabel = sol.label; break; }
    }
    coverage[goal.id] = { description: goal.description, satisfied, solution_label: matchedLabel, total_solutions: tagged.length };
    if (!satisfied) gaps.push(goal.description);
  }
  return { actionableGoals, coverage, gaps };
}

// Coarse usability gate. A champion's LEVEL is the clearest signal of whether it is
// actually built and battle-ready; an unleveled champion contributes almost nothing
// no matter how strong its skill kit reads on paper (a Lv1 with a big nuke multiplier
// still hits like a Lv1). We bucket level into coarse tiers so that:
//   (a) fodder (Lv1/Lv24) can NEVER outrank a built Lv60 carry just because it carries
//       a needed tag or a high intrinsic damage_multiplier_score, while
//   (b) champs that are all clearly built (Lv60 vs Lv50) share the top tier, so tag
//       coverage — not a 10-level gap — decides between them.
export function usabilityTier(champ) {
  const lvl  = champ.level ?? 1;
  const gear = gearTierWeight(champ.gear_tier); // 1 starter … 4 endgame
  // "Effectively built" needs BOTH level AND gear: a Lv60 champ on Starter gear has weak
  // effective stats and must not outrank a properly-geared champion just for being high level.
  if (lvl >= 50 && gear >= 2) return 3; // built: high level AND at least fair gear
  if (lvl >= 30) return 2;              // leveled (incl. high-level under-geared) — usable, still building
  // WELL-GEARED at LOW level is also usable — it was the bug (Kael: Lv27, 5★, GOOD gear, a poisoner,
  // scored tier 1 and was filtered out of the pool, so the model never saw the team that actually
  // cleared). Gear = real effective stats regardless of level; it also carries the ACC a DoT carrier
  // needs to LAND, and Poison/HP-Burn damage is level-insensitive (%maxHP, damage-mechanics.js §1).
  // Ungeared low-level champs stay fodder (Dark Elhain Lv40 / zero artifacts must NOT qualify).
  if (gear >= 3) return 2;              // good/endgame gear at any level → usable
  if (lvl >= 15) return 1;              // early
  return 0;                             // fodder — must never be fielded over a built champ
}

// Scores and sorts the roster then returns the top-5 team.
//
// Ordering, most significant first:
//   1. usability tier         — hard gate so unbuilt champs can't displace built carries
//   2. tag-coverage score     — how many actionable goals this champ can solve on its own
//   3. damage_multiplier_score — Phase 5 tiebreaker among equal coverage (Support last)
//   4. stars / level / gear / rarity
//
// Tag coverage sits BELOW the usability gate on purpose: a needed tag carried only by
// an unbuilt champ will NOT force that champ into the team — the coverage gap is
// surfaced separately (computeTagCoverage/gaps) instead of producing a bad pick.
function selectTeam(mapped, goals) {
  const scored = mapped.map(champ => {
    // How many actionable goals this champ can solve single-handedly (all tags of some
    // approved solution). Counted per-champion (not gated on roster coverage) so it
    // actually differentiates carriers/debuffers from pure filler within a tier.
    let score = 0;
    for (const goal of goals ?? []) {
      if (goal.is_informational) continue;
      const solutions = (goal.goal_solutions ?? []).filter(s => s.status === 'approved');
      for (const sol of solutions) {
        const req = (sol.goal_solution_tags ?? []).map(g => g.tags.name);
        if (req.length === 0) continue; // skeleton solution — no tags is not a real requirement
        if (req.every(t => champ.tags.includes(t))) { score++; break; }
      }
    }
    return { ...champ, score };
  });
  scored.sort((a, b) =>
    usabilityTier(b) - usabilityTier(a) ||
    b.score - a.score ||
    // Investment comes before the intrinsic damage number: a maxed champion (stars →
    // level → gear) beats a lesser-built one regardless of skill coefficient, because
    // damage_multiplier_score does NOT account for level/ATK — a lightly-invested Epic
    // with a big multiplier must not leapfrog a 6★/Lv60 Legendary.
    b.stars - a.stars || b.level - a.level ||
    gearTierWeight(b.gear_tier) - gearTierWeight(a.gear_tier) ||
    // Phase 5: only among champs of EQUAL usability + coverage + investment does the
    // stronger role-relevant damage skill decide. null (Support / no data) sorts last.
    (b.damage_multiplier_score ?? -1) - (a.damage_multiplier_score ?? -1) ||
    rarityWeight(b.rarity) - rarityWeight(a.rarity)
  );
  return scored.slice(0, 5);
}

function deriveVerdict(gaps, totalGoals) {
  if (totalGoals === 0) return null;
  if (gaps.length === 0) return 'ready';
  const covered = totalGoals - gaps.length;
  return covered >= totalGoals / 2 ? 'borderline' : 'not_ready';
}

// Finds the highest Spider's Den Normal stage where confidence meets VERDICT_BAND_CONFIG.confidenceThreshold.
// Iterates groups highest-to-lowest; within each group iterates stage numbers highest-to-lowest.
// Returns on the first stage that clears the bar. Falls back to stage 1 with notReady=true.
// Loads the per-stage boss affinity map (stage_number → 'Magic'|'Force'|'Spirit'|'Void')
// for a dungeon. Empty map (no seeded affinities) → affinity scoring is skipped gracefully.
async function fetchStageAffinities(dungeonId) {
  const { data } = await supabase
    .from('dungeon_stage_affinities').select('stage_number, affinity')
    .eq('dungeon_id', dungeonId);
  const map = {};
  for (const r of data ?? []) map[r.stage_number] = r.affinity;
  return map;
}

/* ── REAL PER-STAGE ENEMY MAGNITUDE (2026-07-21) ────────────────────────────────────────────────
 * `dungeon_stage_enemies` has carried real boss stats for all four dungeons, stages 1-25, since
 * seeds 131-135 (2026-07-15) — hp/atk/def/spd/res/acc/crit, roles boss + minion (IG) / add (Spider).
 * Nothing on the live path ever read it: its only consumer was lib/power-model.js, which is
 * SUPERSEDED and unwired. The contribution model was instead handed a hardcoded 15,000,000, a
 * number LARGER THAN EVERY REAL DUNGEON BOSS and identical at every stage — which is precisely why
 * the confidence curve was flat (Spider 13:77 -> 14:76 where reality has a cliff). Boss HP spans
 * ~15x across a ladder (Dragon 283k@11 -> 4.34M@25), so this is the stage discrimination the model
 * was missing. It is a WIRING gap, not a data gap.
 */

/* The table is BOSS-ONLY for Dragon and Fire Knight (+ IG minions / Spider adds), so boss HP alone
 * under-counts a stage: waves, adds and overkill are real damage the team must also deal. Measured
 * that gap against 82 winning captures (summed per-hero damage / boss HP) and it is a STAGE-INVARIANT
 * PER-DUNGEON CONSTANT, not a per-stage curve:
 *     Dragon 1.75x (n=39; 1.81 @st11 -> 1.69 @st23, most runs within ±0.05)
 *     Ice Golem 2.71x · Spider 2.89x · Fire Knight 2.38x
 * Medians, deliberately: the low outliers (0.13-0.49x) are truncated records from the
 * CbDamageReader stale-heap-context bug, not fast clears.
 * NOMINAL and re-fittable — rerun tools/shadow-contribution.mjs as the corpus grows. */
export const STAGE_EHP_MULTIPLIER = {
  "Dragon's Lair":        1.75,
  "Ice Golem's Peak":     2.71,
  "Spider's Den":         2.89,
  "Fire Knight's Castle": 2.38,
};
const DEFAULT_EHP_MULTIPLIER = 2.0; // unmeasured content (events): mid-range, flagged as such

/**
 * Effective enemy HP the team must chew through at one stage = boss HP x the dungeon's measured
 * wave/add multiplier. Returns nulls (never a guess) when the stage has no seeded enemy row, so
 * callers fall back and SAY they fell back rather than silently inventing magnitude.
 * @returns {{ bossHp:number|null, effectiveHp:number|null, bossAtk:number|null, source:string, multiplier:number }}
 */
async function fetchStageMagnitude(dungeonId, dungeonName, stageNumber) {
  const miss = { bossHp: null, effectiveHp: null, bossAtk: null, source: 'unseeded', multiplier: 1 };
  if (!dungeonId || stageNumber == null) return miss;
  const { data } = await supabase
    .from('dungeon_stage_enemies').select('enemy_role, hp, atk')
    .eq('dungeon_id', dungeonId).eq('stage_number', stageNumber);
  const boss = (data ?? []).find(r => r.enemy_role === 'boss');
  if (!boss?.hp) return miss;
  const multiplier = STAGE_EHP_MULTIPLIER[dungeonName] ?? DEFAULT_EHP_MULTIPLIER;
  return {
    bossHp: Number(boss.hp),
    effectiveHp: Math.round(Number(boss.hp) * multiplier),
    bossAtk: boss.atk != null ? Number(boss.atk) : null,
    source: STAGE_EHP_MULTIPLIER[dungeonName] ? 'dungeon_stage_enemies' : 'dungeon_stage_enemies_default_mult',
    multiplier,
  };
}

/**
 * The champion's best %-of-enemy-MAX-HP DAMAGE skill, from the values seed 202 extracted.
 *
 * Ranked by what would ACTUALLY LAND ON A BOSS, not by the printed headline: a skill may carry
 * its own boss-specific value and/or its own cap, both of which bite before the content cap.
 * Kurosa is the worked example — A1 prints 30% but her own text says 10% against a Boss, so her
 * effective contribution is 0.10, not 0.30.
 *
 * Only `maxhp_effect_kind = 'damage'` is eligible. The other two kinds are MAX-HP DESTRUCTION —
 * `destroy_flat` (a flat % of the pool) and `destroy_proportional` (a % of damage inflicted,
 * whose denominator is not max HP at all) — which SHRINK the pool rather than dealing damage out
 * of it. Crediting them as damage would double-count the same mechanic and is precisely the
 * conflation seed 202 exists to undo.
 *
 * ⚠ NO COOLDOWN/UPTIME TERM YET. This returns the per-ACTIVATION fraction; an A3 on a 4-turn
 * cooldown does not deliver it every turn. `reliabilityFactor` in damage-mechanics.js is where
 * that belongs, and it is not wired here — so this OVERSTATES a long-cooldown nuke. Recorded
 * rather than silently smoothed, because a wrong smoothing is harder to spot than a known gap.
 */
function maxHpDamageProfile(skills = []) {
  const num = (v) => (v == null ? null : Number(v));
  // What a boss actually takes: the boss-specific value if the skill states one, then the
  // skill's own cap. The CONTENT cap (§6b, stage 21+) is applied later, in the damage model.
  const effective = (c) => Math.min(c.boss_pct ?? c.pct, c.skill_cap ?? Infinity);
  let best = null;
  for (const s of skills ?? []) {
    if (s?.maxhp_effect_kind !== 'damage') continue;
    const pct = num(s.maxhp_pct);
    if (pct == null) continue;
    const cand = { pct, boss_pct: num(s.maxhp_pct_boss), skill_cap: num(s.maxhp_pct_cap), slot: s.slot ?? null };
    if (!best || effective(cand) > effective(best)) best = cand;
  }
  return best;
}

/* Placeholder used ONLY when a stage has no seeded enemy row. Kept so the %maxHP-vs-attack damage
 * mix still registers, but it is no longer the normal case for the four core dungeons — and when it
 * IS used, `boss_hp_source: 'nominal'` says so rather than passing a guess off as a measurement. */
const NOMINAL_BOSS_HP = 15_000_000;

/**
 * Layer 2 CONTRIBUTION — DISPLAY ONLY, does NOT drive selection (PROJECT_BRIEF §5b).
 * Extracted so the two stage-SCAN paths get it too: they returned early and skipped the inline
 * block entirely, so for the four scanned dungeons — i.e. the whole product — the contribution
 * model had never actually run. Now every path reports it, on real per-stage magnitude.
 *
 * KILL SIDE ONLY for now. `incomingDamagePerTurn` stays null even though
 * `dungeon_stage_enemies.atk` exists, because the ledger records it OVERSTATING real incoming at
 * high stages — Ice Golem's kill vector is the Frigid Vengeance %-AoE mechanic, not enemy ATK, and
 * an ATK-based survival proxy INVERTS the known per-content wall (INS-0016: Spider = kill wall,
 * IG = survival wall). Boss HP is real and validated; enemy ATK is not yet. Wiring only the half
 * with evidence behind it.
 */
function buildContribution(team, { bossHp, bossHpSource, multiplier = null, realBossHp = null,
                                   stageNumber = null, difficulty = null, contentKey = null }) {
  // Boss-content %maxHP ceiling (damage-mechanics §6b): Normal 21-25 and Hard mode cap an active
  // Enemy-MAX-HP skill at 10% of boss MAX HP per hit. This is the first STAGE-INDEXED
  // discontinuity in the model — a step change at 21, not another gentle ramp.
  const maxHpCap = maxHpCapFor({ stageNumber, difficulty, contentKey });
  const contribTeam = team.map(c => ({
    name: c.name, tags: c.tags, has_boss_mastery: c.has_boss_mastery,
    atk: c.estimated_stats?.atk, spd: c.estimated_stats?.spd, hp: c.estimated_stats?.hp,
    crit_rate: c.estimated_stats?.crit_rate ?? c.estimated_stats?.crate,
    crit_dmg:  c.estimated_stats?.crit_dmg  ?? c.estimated_stats?.cdmg,
    damage_multiplier_score: c.damage_multiplier_score,
    maxhp_damage: c.maxhp_damage ?? null,   // real extracted %maxHP fraction (seed 202); null → nominal
  }));
  const cResult = computeContributions(contribTeam, {
    bossHp,
    incomingDamagePerTurn: null, // see above — kill side only until enemy ATK is modeled
    maxHpCap,
  });
  const measured = bossHpSource !== 'nominal';
  return {
    estimated: true,
    boss_hp_source: bossHpSource,
    boss_hp_used: bossHp,
    boss_hp_raw: realBossHp,          // the seeded boss row, before the wave/add multiplier
    ehp_multiplier: multiplier,
    maxhp_damage_cap: maxHpCap,       // null = uncapped; 0.10 at Normal 21-25 / Hard
    confidence: cResult.confidence,
    kill_turns: isFinite(cResult.killTurns) ? Math.round(cResult.killTurns) : null,
    per_champion: cResult.perChampion.map(r => ({
      name: r.name,
      share: Math.round(r.share * 100),
      own_damage: Math.round(r.ownDamage),
      granted_damage: Math.round(r.grantedDamage),
      granted_survival: Math.round(r.grantedSurvival),
    })),
    note: measured
      ? 'Kill side on REAL per-stage enemy HP; survival side not yet modeled (enemy ATK overstates '
        + 'incoming — INS-0016). Directional; does NOT drive team selection — see PROJECT_BRIEF §5b.'
      : 'Directional only (nominal magnitudes; no seeded enemy row for this stage). '
        + 'Does NOT drive team selection — see PROJECT_BRIEF §5b.',
    data_warning: cResult.dataWarning,
  };
}

async function scanSpiderStages(mapped, dungeonId) {
  const rosterTagSet = new Set(mapped.flatMap(c => c.tags));
  const budget = VERDICT_BAND_CONFIG.recommendBudgetPct;
  const affinityByStage = await fetchStageAffinities(dungeonId);
  let lastResult = null, best = null;
  const attempted = [];   // every computed stage, for stretch surfacing

  for (const group of SPIDER_SCAN_GROUPS) {
    const { data: stageRow } = await supabase
      .from('dungeon_stages').select('id, label, stage_number')
      .eq('dungeon_id', dungeonId).eq('label', group.label).single();
    if (!stageRow) continue;

    const { data: phase } = await supabase
      .from('phases').select('id').eq('dungeon_stage_id', stageRow.id).single();
    if (!phase) continue;

    const { data: goals } = await supabase
      .from('goals')
      .select('id, description, is_informational, goal_solutions(id, label, status, goal_solution_tags(tag_id, tags(name, is_debuff, bypasses_accuracy_check)))')
      .eq('phase_id', phase.id);

    const { data: thresholdChecks } = await supabase
      .from('stat_threshold_checks').select('id, stat, comparison, formula, notes, threshold_type')
      .eq('phase_id', phase.id);

    const { actionableGoals, coverage, gaps } = computeTagCoverage(goals, rosterTagSet);
    const data_warning = actionableGoals.length === 0
      ? `No goals seeded for "${group.label}" — coverage results are vacuous.` : null;

    // All stages in a group share goals/coverage, so the selected team is the same
    // across the group. Pick the leader once, then fold its aura into the stats the
    // thresholds evaluate — a strong leader aura (e.g. Spider ACC) can clear a higher stage.
    const team = selectTeam(mapped, goals);
    const leader = await selectLeader(team, { contentArea: 'dungeon', thresholdStats: [...new Set((thresholdChecks ?? []).map(t => t.stat))] });
    const auraTeam = applyLeaderAura(team, leader);

    for (const stageNumber of group.stageNumbers) {
      const threshold_results = evaluateThresholds(thresholdChecks, stageNumber, auraTeam, goals);
      const band = actionableGoals.length === 0
        ? { verdict_band: null, confidence_pct: null }
        : computeVerdictBand(gaps, threshold_results, auraTeam);
      const { confidence_pct, affinity } = applyAffinityToConfidence(band.confidence_pct, auraTeam, affinityByStage[stageNumber]);
      const verdict_band = band.verdict_band;

      const shortfall_notes = buildShortfallNotes(gaps, threshold_results);
      lastResult = { stageNumber, dungeon_stage_id: stageRow.id, stageLabel: group.label, goals, actionableGoals, gaps, coverage, threshold_results, verdict_band, confidence_pct, affinity, data_warning, team, leader, synergies: detectSynergies(team), shortfall_notes };
      if (confidence_pct != null) {
        attempted.push({ stageNumber, confidence_pct, shortfall_notes });
        if (best == null || confidence_pct > best.confidence_pct) best = lastResult;
      }

      // Recommend the HIGHEST stage that meets the budget; higher stages ride along as `stretch`.
      // No hard cutoff — a shortfall lowers the number and adds a note, never drops the stage.
      if (confidence_pct != null && confidence_pct >= budget) {
        return { ...lastResult, notReady: false, stretch: pickStretch(attempted, stageNumber) };
      }
    }
  }

  // Nothing met the budget — recommend the BEST (highest-confidence) stage, still annotated and
  // attemptable, never a refusal. `notReady` just frames it as "build toward this" in the UI.
  const rec = best ?? lastResult;
  return rec ? { ...rec, notReady: true, stretch: pickStretch(attempted, rec.stageNumber) } : null;
}

// Generalized highest-confidence stage scanner for the individually-seeded dungeons
// (Fire Knight / Ice Golem). Like scanSpiderStages, but there is no group abstraction:
// each stage_number is its own dungeon_stages row with its own wave+boss phases, so we
// load every seeded stage, iterate highest→lowest, and run the same coverage / team /
// leader-aura / threshold / confidence logic per stage (unioning goals+thresholds across
// the stage's phases). Returns the first stage that clears the confidence bar, else the
// lowest seeded stage with notReady:true. No user-selected stage required.
async function scanDungeonStages(mapped, dungeonId, contentKey) {
  const rosterTagSet = new Set(mapped.flatMap(c => c.tags));
  const budget = VERDICT_BAND_CONFIG.recommendBudgetPct;
  const PHASE_ORDER = { wave: 0, boss: 1, single: 2 };

  const { data: stages } = await supabase
    .from('dungeon_stages').select('id, label, stage_number')
    .eq('dungeon_id', dungeonId)
    .not('stage_number', 'is', null)
    .order('stage_number', { ascending: false });

  const affinityByStage = await fetchStageAffinities(dungeonId);
  let lastResult = null, best = null;
  const attempted = [];   // every computed stage, for stretch surfacing

  for (const stageRow of stages ?? []) {
    // Union goals + thresholds across the stage's phases (wave + boss).
    const { data: phases } = await supabase
      .from('phases').select('id, phase_type').eq('dungeon_stage_id', stageRow.id);
    if (!phases?.length) continue;
    phases.sort((a, b) => (PHASE_ORDER[a.phase_type] ?? 9) - (PHASE_ORDER[b.phase_type] ?? 9));

    const goals = [];
    const thresholdChecks = [];
    for (const ph of phases) {
      const { data: pGoals } = await supabase
        .from('goals')
        .select('id, description, is_informational, goal_solutions(id, label, status, goal_solution_tags(tag_id, tags(name, is_debuff, bypasses_accuracy_check)))')
        .eq('phase_id', ph.id);
      for (const g of pGoals ?? []) g.phase_type = ph.phase_type;
      goals.push(...(pGoals ?? []));

      const { data: pThresh } = await supabase
        .from('stat_threshold_checks').select('id, stat, comparison, formula, notes, threshold_type')
        .eq('phase_id', ph.id);
      for (const t of pThresh ?? []) t.phase_type = ph.phase_type;
      thresholdChecks.push(...(pThresh ?? []));
    }

    const { actionableGoals, coverage, gaps } = computeTagCoverage(goals, rosterTagSet);
    const data_warning = actionableGoals.length === 0
      ? `No goals seeded for "${stageRow.label}" — coverage results are vacuous.` : null;

    // Team + leader aura are per-stage (goals differ across tiers/stages), then thresholds.
    const team = selectTeam(mapped, goals);
    const leader = await selectLeader(team, { contentArea: 'dungeon', thresholdStats: [...new Set((thresholdChecks ?? []).map(t => t.stat))] });
    const auraTeam = applyLeaderAura(team, leader);

    const threshold_results = evaluateThresholds(thresholdChecks, stageRow.stage_number, auraTeam, goals);
    const band = actionableGoals.length === 0
      ? { verdict_band: null, confidence_pct: null }
      : computeVerdictBand(gaps, threshold_results, auraTeam);
    const { confidence_pct, affinity } = applyAffinityToConfidence(band.confidence_pct, auraTeam, affinityByStage[stageRow.stage_number]);
    const verdict_band = band.verdict_band;

    const shortfall_notes = buildShortfallNotes(gaps, threshold_results);
    lastResult = { stageNumber: stageRow.stage_number, dungeon_stage_id: stageRow.id, stageLabel: stageRow.label, goals, actionableGoals, gaps, coverage, threshold_results, verdict_band, confidence_pct, affinity, data_warning, team, leader, phases: phases.map(p => p.phase_type), synergies: detectSynergies(team), shortfall_notes };
    if (confidence_pct != null) {
      attempted.push({ stageNumber: stageRow.stage_number, confidence_pct, shortfall_notes });
      if (best == null || confidence_pct > best.confidence_pct) best = lastResult;
    }

    // Recommend the HIGHEST stage that meets the budget; higher stages (already computed, all short
    // of budget) ride along as `stretch`. No hard cutoff — a shortfall lowers the number and adds a
    // note, never drops the stage silently (the old >= 80 cutoff caused the Dragon floor-4 miss).
    if (confidence_pct != null && confidence_pct >= budget) {
      return { ...lastResult, notReady: false, stretch: pickStretch(attempted, stageRow.stage_number) };
    }
  }

  // Nothing met the budget — recommend the BEST (highest-confidence) stage, still annotated and
  // attemptable, never a refusal. `notReady` just frames it as "build toward this" in the UI.
  const rec = best ?? lastResult;
  return rec ? { ...rec, notReady: true, stretch: pickStretch(attempted, rec.stageNumber) } : null;
}

// ── Solo carry check ──────────────────────────────────────────────────────────
// Returns approved solo carry profiles for this stage that the player owns,
// sorted by research_confidence (High → Medium → Low) then rarity.
// Profiles locked behind an ascension floor are returned separately as
// solo_carries_locked so the UI can surface them as near-term goals.
// Called before team selection so the UI can surface it as a first-class callout.
async function checkSoloCarries(mappedRoster, stageId) {
  if (!mappedRoster.length) return { ready: [], locked: [] };

  const rosterChampionIds = mappedRoster.map(c => c.id);
  const ascensionByChampion = Object.fromEntries(mappedRoster.map(c => [c.id, c.ascension_level ?? 0]));

  const { data, error } = await supabase
    .from('champion_solo_profiles')
    .select(`
      id, required_set, required_stats, ai_settings, notes,
      affinity_warning, availability_note, research_confidence,
      ascension_required,
      champions ( id, name, rarity, affinity )
    `)
    .eq('game_id', 'raid_shadow_legends')
    .eq('dungeon_stage_id', stageId)
    .eq('status', 'approved')
    .in('champion_id', rosterChampionIds);

  if (error || !data?.length) return { ready: [], locked: [] };

  const confidenceRank = { High: 0, Medium: 1, Low: 2, Unverified: 3 };

  const sorted = data.sort((a, b) =>
    (confidenceRank[a.research_confidence] ?? 3) - (confidenceRank[b.research_confidence] ?? 3) ||
    rarityWeight(b.champions?.rarity) - rarityWeight(a.champions?.rarity)
  );

  const ready  = [];
  const locked = [];

  for (const row of sorted) {
    const champId        = row.champions?.id;
    const playerAsc      = ascensionByChampion[champId] ?? 0;
    const requiredAsc    = row.ascension_required ?? 0;
    const shaped = {
      champion_id:         champId,
      champion_name:       row.champions?.name,
      champion_rarity:     row.champions?.rarity,
      affinity:            row.champions?.affinity,
      required_set:        row.required_set,
      required_stats:      row.required_stats,
      ai_settings:         row.ai_settings,
      notes:               row.notes,
      affinity_warning:    row.affinity_warning,
      availability_note:   row.availability_note,
      research_confidence: row.research_confidence,
      ascension_required:  requiredAsc,
    };

    if (requiredAsc > playerAsc) {
      locked.push({
        ...shaped,
        lock_message: `${row.champions?.name} can solo this content but needs ${requiredAsc}-star ascension (currently ${playerAsc}-star).`,
      });
    } else {
      ready.push(shaped);
    }
  }

  return { ready, locked };
}

// Tags that indicate a champion is a critical debuffer — should not be the stun target.
const CRITICAL_DEBUFFER_TAGS = ['Decrease Defense', 'Decrease Attack', 'Weaken'];

// ── Clan Boss stun matrix ─────────────────────────────────────────────────────
// Scores each team member for stun likelihood, identifies the predicted target,
// and warns if that target is a critical debuffer.
//
// boss_affinity is optional — pass it when known (player selects boss difficulty/day).
// Without it, affinity scoring is skipped but slot/buff analysis still runs.
// Assumes full HP at fight start (current_hp_pct = 100) — this is a pre-fight plan.
function buildStunMatrix(team, boss_affinity) {
  const scored = team.map((champ, slotIndex) => {
    const champForScoring = {
      affinity:         champ.affinity,
      has_unkillable:   champ.tags.includes('Unkillable'),
      has_block_damage: champ.tags.includes('Block Damage'),
      has_shield:       champ.tags.includes('Shield'),
      current_hp_pct:   100, // pre-fight assumption
    };
    const score = clanBossStunScore(champForScoring, boss_affinity ?? null, slotIndex);
    const is_critical_debuffer = CRITICAL_DEBUFFER_TAGS.some(t => champ.tags.includes(t));
    return { champion_name: champ.name, affinity: champ.affinity, slot: slotIndex + 1, score, is_critical_debuffer };
  });

  scored.sort((a, b) => b.score - a.score);
  const predicted_target = scored[0];

  const reasons = [];
  if (boss_affinity) {
    const AFFINITY_BEATS = { Magic: 'Spirit', Spirit: 'Force', Force: 'Magic' };
    if (AFFINITY_BEATS[boss_affinity] === predicted_target.affinity) {
      reasons.push(`${predicted_target.affinity} affinity is counter to boss ${boss_affinity}`);
    }
  }
  if (!boss_affinity) reasons.push('boss affinity unknown — affinity scoring skipped');

  const stun_warning = predicted_target.is_critical_debuffer
    ? `${predicted_target.champion_name} (slot ${predicted_target.slot}) is predicted to receive the stun but carries critical debuffs. Move them to a later slot or add a buff-protected tank in an earlier slot.`
    : null;

  // Suggest a safer slot if the predicted target is a debuffer and moving them right would help.
  // The simplest fix: swap them with the lowest-scoring non-debuffer.
  let reorder_suggestion = null;
  if (predicted_target.is_critical_debuffer) {
    const safe_target = scored.find(c => !c.is_critical_debuffer);
    if (safe_target) {
      reorder_suggestion = `Place ${safe_target.champion_name} in slot ${predicted_target.slot} and move ${predicted_target.champion_name} to slot ${safe_target.slot} to redirect the stun.`;
    }
  }

  return {
    boss_affinity:    boss_affinity ?? null,
    affinity_known:   boss_affinity != null,
    all_scores:       scored,
    predicted_target: { ...predicted_target, reasons },
    stun_warning,
    reorder_suggestion,
  };
}

// ── Global sustain check ──────────────────────────────────────────────────────
// ASSUMPTION: no player champion runs Lifesteal, Regeneration, or Immortal gear.
// Sustain must come from champion skills. This is explicitly shown to the player on
// the champion detail screen. See champion_team_requirements table for per-champion
// dependencies.
//
// Tag names match the seeded `tags` vocabulary. 'Strengthen' / 'AoE Heal' are listed
// for forward-compatibility (not seeded yet — they simply never match today).
const SUSTAIN_TAGS  = ['Continuous Heal', 'AoE Heal', 'Leech', 'Ally Protection', 'Strengthen', 'Healer'];
const SUSTAIN_ROLES = ['Support']; // champion.role that implies sustain (fallback to tags)

// Runs on every recommendation. Returns a warning when no team member provides
// skill-based sustain (since we assume no Lifesteal gear).
function checkTeamSustain(team) {
  const provider = (team ?? []).find(c =>
    (c.tags ?? []).some(t => SUSTAIN_TAGS.includes(t)) || SUSTAIN_ROLES.includes(c.role));
  return {
    passes:   !!provider,
    provider: provider?.name ?? null,
    warning:  provider ? null
      : 'This team has no sustain champion. Without Lifesteal gear (which we assume '
      + 'players do not have), your team will not recover HP between hits and will die '
      + 'in extended fights. Add a healer, a champion who can apply Leech to the boss, '
      + 'or a champion with Ally Protection.',
  };
}

// ── CC-as-sustain accuracy check ──────────────────────────────────────────────
// When a goal is coverable ONLY via Crowd Control, the ACC check on that CC becomes a
// SURVIVAL check (miss the CC → enemies take turns → unrecoverable damage), distinct
// from a routine "debuff didn't land" ACC note. Only ACC-gated CC counts (AoE Decrease
// Turn Meter bypasses ACC, so it's excluded via isAccuracyGated).
const CC_TAGS = ['AoE Freeze', 'AoE Stun', 'Provoke', 'Fear'];
const isCCTag = (name) => CC_TAGS.includes(name);

function checkCCSustain(team, goals, thresholdResults) {
  const teamTagSet = new Set((team ?? []).flatMap(c => c.tags ?? []));
  const ccOnlyGoals = (goals ?? []).filter(goal => {
    if (goal.is_informational) return false;
    const satisfied = (goal.goal_solutions ?? [])
      .filter(s => s.status === 'approved' && (s.goal_solution_tags ?? []).length > 0)
      .filter(s => s.goal_solution_tags.every(gst => teamTagSet.has(gst.tags.name)));
    if (!satisfied.length) return false;
    // every satisfying path leans on an ACC-gated CC tag
    return satisfied.every(s =>
      s.goal_solution_tags.some(gst => isCCTag(gst.tags.name) && isAccuracyGated(gst.tags)));
  });
  if (!ccOnlyGoals.length) return null;

  const accResult = (thresholdResults ?? []).find(t => t.stat === 'acc' && t.threshold_value != null);
  if (!accResult) return null;

  const carriers = (team ?? [])
    .filter(c => (c.tags ?? []).some(isCCTag))
    .map(c => ({ name: c.name, acc: c.estimated_stats?.acc ?? 0 }));
  if (!carriers.length) return null;
  const best = carriers.reduce((a, b) => (b.acc > a.acc ? b : a));
  if (best.acc >= accResult.threshold_value) return null;

  return {
    type: 'cc_sustain_acc_failure',
    message: `Your team survives by keeping enemies frozen/stunned — but your CC champion's `
      + `ACC (${best.acc}) is below the floor needed to reliably land those debuffs `
      + `(${accResult.threshold_value}). If the CC misses, enemies take their turns and deal `
      + `damage your team cannot recover from. Build more ACC on ${best.name} before attempting `
      + `this content.`,
  };
}

// ── champion_team_requirements check ──────────────────────────────────────────
// Per-champion "needs an ally of role X (for content Y)" rows. Reads APPROVED rows
// only — proposed rows are human-reviewed before the engine acts on them. One query
// for the whole team (dungeon-specific rows + global rows where dungeon_id is null).
const REQUIREMENT_TAGS = {
  healer:          ['Continuous Heal', 'AoE Heal', 'Leech'],
  cleanser:        ['Cleanse'],
  decrease_atk:    ['Decrease Attack'],
  speed_aura:      ['SPD Aura'],
  ally_protection: ['Ally Protection'],
  sustain_any:     ['Continuous Heal', 'AoE Heal', 'Leech', 'Ally Protection', 'Strengthen'],
  // cc_accuracy is handled by checkCCSustain — never reported as a plain coverage gap.
};

function isRequirementCovered(requiredRole, team) {
  if (requiredRole === 'cc_accuracy') return true; // handled by checkCCSustain
  const needed = REQUIREMENT_TAGS[requiredRole];
  if (!needed) return true; // unknown role → don't invent a gap
  const teamTagSet = new Set((team ?? []).flatMap(c => c.tags ?? []));
  return needed.some(t => teamTagSet.has(t));
}

async function checkTeamRequirements(team, dungeonId) {
  const ids = (team ?? []).map(c => c.id).filter(Boolean);
  if (!ids.length) return [];
  let query = supabase.from('champion_team_requirements')
    .select('champion_id, required_role, reason')
    .in('champion_id', ids)
    .eq('status', 'approved');
  query = dungeonId
    ? query.or(`dungeon_id.eq.${dungeonId},dungeon_id.is.null`)
    : query.is('dungeon_id', null);
  const { data: reqs } = await query;
  const nameById = Object.fromEntries((team ?? []).map(c => [c.id, c.name]));
  const gaps = [];
  for (const req of reqs ?? []) {
    if (!isRequirementCovered(req.required_role, team)) {
      gaps.push({ champion: nameById[req.champion_id], required_role: req.required_role, reason: req.reason });
    }
  }
  return gaps;
}

// ── Leader aura selection ─────────────────────────────────────────────────────
// In RSL only the LEADER champion's aura is active for the whole team, so choosing a
// leader = choosing which aura to run. Pick the fielded champion whose aura most helps
// THIS content. champion_auras: aura_type, aura_value ("21%"), aura_area ("All Battles"/
// "Dungeons"/"Arena"/…), aura_restriction ("Magic allies only"). SPD leads for dungeons
// (turn economy); a stat the dungeon actually floors (e.g. Spider ACC) is boosted.
const LEADER_TYPE_WEIGHT = { spd: 1.0, acc: 0.75, atk: 0.6, 'c.rate': 0.6, 'c.dmg': 0.55, res: 0.5, hp: 0.45, def: 0.45 };

/* ── INS-0005 Rule 1: the best aura RELIEVES THE TEAM'S BINDING CONSTRAINT ──────────────────────
 * Mike, 2026-07-15, ratified 2026-07-19: "not a fixed SPD>ACC preference — pick the aura that fixes
 * the tightest bottleneck."
 *   • Turn economy is the usual bottleneck → SPD by default.
 *   • A debuff team that cannot LAND debuffs does nothing, so an ACC aura outranks SPD when the team
 *     is projected BELOW the content's ACC floor. Conditional + SATURATING: worth a lot at the
 *     deficit, ~0 once above the floor.
 *
 * DECAY SHAPE — RULED 2026-07-19: LINEAR to zero at the floor.
 *
 * `accReliefFraction` is the whole of it: how much of the team's ACC shortfall this aura actually
 * removes, as a fraction of the floor. Unit-free, so it is comparable with a SPD aura's fraction
 * WITHOUT the flat-vs-percent bug — an ACC aura is scored by the DEFICIT IT CLOSES, never by its raw
 * point value. Above the floor every deficit is 0, the term vanishes, and SPD wins by default.
 * `min(deficit, value)` is the saturation: an aura cannot relieve more shortfall than exists.
 *
 * REPLACES a fixed `LEADER_PRIORITY` table (spd>acc>hp) that Claude wrote earlier the same day —
 * which was the exact "fixed preference" Rule 1 rules against. It produced the right Clan Boss answer
 * by the wrong mechanism, and would have kept producing right-looking answers until a case where the
 * constraint, not the ordering, decided. The weights/normalisation it sat on were likewise never
 * ruled: they were invented 2026-07-12 when the leader feature was first built. */
function statReliefFraction(team, stat, auraValue, floor) {
  if (!(floor > 0) || !(auraValue > 0) || !team?.length) return 0;
  let relieved = 0;
  for (const c of team) {
    const cur = c?.estimated_stats?.[stat] ?? c?.[stat] ?? 0;
    relieved += Math.min(Math.max(0, floor - cur), auraValue);      // saturating, 0 at/above floor
  }
  return relieved / (team.length * floor);                          // linear in the deficit
}

/* WHICH AURAS ARE FLAT vs PERCENT — the root of the old scoring's incoherence, and it must be handled
 * for ALL of them at once. `applyLeaderAura` (below) already encodes the game's actual units: ACC/RES/
 * C.RATE are FLAT points, SPD/ATK/DEF/HP are %-of-BASE. The ranking function ignored that and divided
 * everything by 100, so a flat "+60 RES" entered the comparison as 0.60 while a genuine 19% entered as
 * 0.19 — 3x the score for being measured in a bigger unit.
 *
 * FIXING ONLY ONE OF THEM IS WORSE THAN FIXING NEITHER (observed 2026-07-19): scoring ACC by relief
 * while RES kept its inflated 0.60 flipped every dungeon to a RES lead, undoing the verified ACC pick.
 *
 * So: a PERCENT aura keeps value/100 (already the true fraction). A FLAT aura is scored by the DEFICIT
 * IT CLOSES against that stat's floor for this content — Rule 1 applied uniformly. A flat aura for
 * which the content declares NO floor relieves NO known constraint and scores 0: that is the whole
 * point of Rule 1, not an oversight. RES is the live case — no content declares a RES floor today, so
 * a RES aura only leads when nothing else applies (see the fallback in pickLeaderFrom). */
const FLAT_AURAS = new Set(['acc', 'res', 'c.rate']);
export const LEADER_AREA_APPLIES = {
  dungeon:    a => a === 'all battles' || a === 'dungeons',
  clan_boss:  a => a === 'all battles', // Clan Boss is NOT a "Dungeons" aura target
  arena:      a => a === 'all battles' || a === 'arena',
  doom_tower: a => a === 'all battles' || a === 'doom tower',
  campaign:   a => a === 'all battles' || a === 'campaign',
};
const LEADER_AFFINITY_RESTRICTION = {
  'magic allies only': 'Magic', 'void allies only': 'Void',
  'force allies only': 'Force', 'spirit allies only': 'Spirit',
};
export function normAuraType(t) {
  const s = String(t ?? '').toLowerCase().trim();
  if (s.startsWith('spd') || s.startsWith('speed')) return 'spd';
  if (s.startsWith('acc') || s.startsWith('accuracy')) return 'acc';
  if (s.startsWith('c.rate') || s.startsWith('c. rate') || s.startsWith('crit rate')) return 'c.rate';
  if (s.startsWith('c.dmg') || s.startsWith('c. dmg') || s.startsWith('crit dmg')) return 'c.dmg';
  if (s.startsWith('atk')) return 'atk';
  if (s.startsWith('def')) return 'def';
  if (s.startsWith('hp')) return 'hp';
  if (s.startsWith('res')) return 'res';
  return null;
}

// Returns the recommended leader { champion_id, name, aura_type, aura_value, aura_area,
// aura_summary, restriction, score } or null if no fielded champion has a useful aura here.
async function selectLeader(team, opts = {}) {
  const ids = (team ?? []).map(c => c.id).filter(Boolean);
  if (!ids.length) return null;
  const { data: auras } = await supabase.from('champion_auras')
    .select('champion_id, aura_type, aura_value, aura_area, aura_restriction, aura_summary')
    .in('champion_id', ids);
  return pickLeaderFrom(team, auras, opts);
}

/**
 * The leader CHOICE, as a pure function — same ranking, no DB. `selectLeader` is this plus a fetch.
 *
 * EXTRACTED 2026-07-19 so the pool/bucket model (gen 3, `tools/pool-select.mjs`) can reuse the exact
 * ranking instead of re-implementing it. A second copy would drift, and the two generations are meant
 * to stay comparable (knowledge/MODEL_REGISTRY.md) — differing only where we INTEND them to differ.
 * Behaviour is unchanged for gen 1; this is a pure lift of the loop that was inline here.
 *
 * `auras` = champion_auras rows for the fielded champions.
 */
export function pickLeaderFrom(team, auras, opts = {}) {
  const { contentArea = 'dungeon', thresholdStats = [], accFloor = 0, floors = null, __legacy = false } = opts;
  if (!auras?.length) return null;

  const applies = LEADER_AREA_APPLIES[contentArea] ?? LEADER_AREA_APPLIES.dungeon;
  const boost = new Set((thresholdStats ?? []).map(s => String(s ?? '').toLowerCase()));
  const byId = Object.fromEntries((team ?? []).map(c => [c.id, c]));
  const statFloors = { acc: accFloor, ...(floors ?? {}) };

  let best = null;
  for (const a of auras) {
    const type = normAuraType(a.aura_type);
    const raw = parseFloat(String(a.aura_value ?? '').replace('%', ''));
    const value = raw / 100;
    if (!type || !(value > 0)) continue;
    const area = String(a.aura_area ?? '').toLowerCase().replace(/^in\s+/, '').trim();
    if (!applies(area)) continue;

    let restrictFactor = 1;
    const restrictAff = LEADER_AFFINITY_RESTRICTION[String(a.aura_restriction ?? '').toLowerCase().trim()];
    if (restrictAff) {
      const benefiting = (team ?? []).filter(c => c.affinity === restrictAff).length;
      restrictFactor = benefiting / Math.max(1, team.length); // aura helps only matching-affinity allies
    }

    /* INS-0005 Rule 1. An ACC aura is scored by the DEFICIT IT CLOSES against this content's floor —
     * not by its raw point value — so it wins exactly where debuffs are missing and decays linearly
     * to nothing once the team is over the floor, leaving SPD to win by default. This is also what
     * makes the comparison unit-honest: `relief` and a SPD aura's `value` are both fractions, whereas
     * the old path compared flat ACC points (80/100 = 0.80) against a real percentage (0.19).
     * No accFloor declared → fall back to the weighted score (unchanged behaviour). */
    let score;
    if (FLAT_AURAS.has(type) && !__legacy) {
      // Flat aura → worth the deficit it closes against this content's floor for that stat. No floor
      // declared → relieves no known constraint → 0 (the fallback below still lets it lead if it is
      // the only thing available).
      score = LEADER_TYPE_WEIGHT[type] * statReliefFraction(team, type, raw, statFloors[type] ?? 0) * restrictFactor;
    } else {
      // Percent aura → value/100 is already the true fraction; the weighted score is unit-correct.
      let w = LEADER_TYPE_WEIGHT[type] ?? 0.4;
      if (boost.has(type)) w *= 1.5; // the content floors this stat → the aura is worth more here
      score = w * value * restrictFactor;
    }

    const champ = byId[a.champion_id];
    if (score > 0 && (!best || score > best.score))
      best = {
        champion_id: a.champion_id, name: champ?.name ?? null,
        aura_type: a.aura_type, aura_value: a.aura_value, aura_area: a.aura_area,
        aura_summary: a.aura_summary, restriction: a.aura_restriction, score: Math.round(score * 1000) / 1000,
      };
  }

  /* FALLBACK — every applicable aura relieved nothing (typical: the only auras are flat ones for
   * stats this content declares no floor for). Rule 1 has no opinion here, so rather than field NO
   * leader — which throws away a live team-wide buff for nothing — fall back to the legacy weighted
   * score to at least name the largest available. Flagged so it is visibly a fallback, not a verdict. */
  if (!best && !__legacy) {
    const legacy = pickLeaderFrom(team, auras, { ...opts, __legacy: true });
    return legacy ? { ...legacy, relieves_no_constraint: true } : null;
  }
  return best;
}

// Returns a COPY of the team with the leader's aura folded into estimated_stats, so threshold
// checks see the in-battle value (the leader aura is live all fight). ACC/RES/C.RATE auras are
// FLAT (+value); SPD/ATK/DEF/HP auras are %-of-BASE (base_stat × value/100). Affinity-restricted
// auras (e.g. "Magic allies only") only boost matching allies. Non-threshold stats are untouched.
export function applyLeaderAura(team, leader) {
  if (!leader) return team;
  const type = normAuraType(leader.aura_type);
  const pct = parseFloat(String(leader.aura_value ?? '').replace('%', '')) || 0;
  if (!type || pct <= 0) return team;
  const restrictAff = LEADER_AFFINITY_RESTRICTION[String(leader.restriction ?? '').toLowerCase().trim()];
  const frac = pct / 100;
  return (team ?? []).map(c => {
    if (restrictAff && c.affinity !== restrictAff) return c;
    const es = { ...(c.estimated_stats ?? {}) };
    const addFlat = (k, v) => { es[k] = Math.round((es[k] ?? 0) + v); };
    switch (type) {
      case 'acc':    addFlat('acc', pct); break;                 // flat +ACC
      case 'res':    addFlat('res', pct); break;                 // flat +RES
      case 'c.rate': { const k = es.crit_rate != null ? 'crit_rate' : 'crate'; es[k] = (es[k] ?? 0) + pct; break; }
      case 'spd':    addFlat('spd', (c.base_spd ?? 0) * frac); break;
      case 'atk':    addFlat('atk', (c.base_atk ?? 0) * frac); break;
      case 'def':    addFlat('def', (c.base_def ?? 0) * frac); break;
      case 'hp':     addFlat('hp',  (c.base_hp  ?? 0) * frac); break;
      default: return c;
    }
    return { ...c, estimated_stats: es };
  });
}

/**
 * Core matching engine.
 *
 * @param {Array}  roster      - Pre-loaded rows from user_champions (with nested champion data).
 *                               Each entry has: { id, level, stars, ascension_level, gear_tier,
 *                               mastery_tier, is_booked, awakening_level,
 *                               champion: { id, name, rarity, faction, affinity,
 *                                 base_hp, base_atk, base_def, base_spd, base_acc, base_res,
 *                                 champion_tags: [{ tag_id, status, tags: { name, bypasses_accuracy_check } }]
 *                               }}
 * @param {string} contentKey  - One of the keys in CONTENT_MAP above.
 * @param {object} [options]   - { boss_affinity?: string } — Clan Boss affinity for stun matrix.
 * @returns {object}           - { content_label, solo_carries, team, stun_matrix, gaps, coverage,
 *                                 threshold_results, zero_tag_warnings, data_warning }
 */
export async function matchRoster(roster, contentKey, options = {}) {
  const isEventDungeon = contentKey === 'event_dungeon';
  const isSpider       = contentKey === 'spider';
  const isDungeonStage = contentKey in DUNGEON_STAGE_CONTENT;

  const contentConfig = (isEventDungeon || isSpider || isDungeonStage) ? null : CONTENT_MAP[contentKey];
  if (!isEventDungeon && !isSpider && !isDungeonStage && !contentConfig) {
    throw new Error(`Unknown content key: ${contentKey}`);
  }

  // Clan Boss: difficulty is passed at runtime (Normal, Hard, Brutal, etc.)
  // Fire Knight / Ice Golem take NO stage input — the scan below auto-picks the stage.
  // For event dungeons these are resolved from the DB below.
  let dungeonName  = contentConfig?.dungeon ?? (isDungeonStage ? DUNGEON_STAGE_CONTENT[contentKey] : null);
  let stageNumber  = contentConfig?.stageNumber ?? null;
  let stageLabel   = (contentKey === 'clan_boss' && options.difficulty)
    ? options.difficulty
    : (contentConfig?.stage ?? null);

  // ── 1. Map roster to internal shape ────────────────────────────────────────
  // Account-level gear context (gear tier + Great Hall/Arena) feeds the manual-
  // roster stat estimator; Gestal rosters use real effective_stats instead.
  const { mapped, zero_tag_warnings, ascension_gaps } =
    mapRoster(roster, { accountDev: options.account_development, gearTier: options.gear_tier });
  // Phase 5: attach role-relevant damage-multiplier scores (tiebreaker in selectTeam).
  await attachDamageScores(mapped, supabase);

  // ── Spider's Den Normal: highest-confidence stage scan ─────────────────────
  if (isSpider) {
    const { data: spiderDungeon, error: spiderErr } = await supabase
      .from('dungeons').select('id, name')
      .eq('game_id', 'raid_shadow_legends').eq('name', "Spider's Den").single();
    if (spiderErr || !spiderDungeon) throw new Error("Dungeon \"Spider's Den\" not found. Run seeds first.");

    const scan = await scanSpiderStages(mapped, spiderDungeon.id);

    const { ready: solo_carries, locked: solo_carries_locked } = await checkSoloCarries(mapped, scan.dungeon_stage_id);
    // Reuse the team the scan already selected — it's the team the returned stage's
    // thresholds were evaluated against, so verdict and threshold_results stay consistent.
    const team = scan.team ?? selectTeam(mapped, scan.goals);
    const totalGoals = scan.actionableGoals.length;
    const verdict = deriveVerdict(scan.gaps, totalGoals);

    const { verdict_band, confidence_pct } = totalGoals === 0
      ? { verdict_band: null, confidence_pct: null }
      : { verdict_band: scan.verdict_band, confidence_pct: scan.confidence_pct };

    const not_ready_note = scan.notReady
      ? "Your roster isn't quite ready for Spider's Den yet — here's what to build first."
      : null;

    // Global sustain / CC-sustain / per-champion team-requirement checks (see §checks).
    const sustain              = checkTeamSustain(team);
    const cc_sustain           = checkCCSustain(team, scan.goals, scan.threshold_results);
    const team_requirement_gaps = await checkTeamRequirements(team, scan.dungeon_stage_id);
    const leader = scan.leader ?? null; // computed inside the scan (its aura already folded into thresholds)
    const watchdog = runWatchdog({ roster: mapped, team, contentKey, usabilityTier });
    // Layer 2 on the REAL Skavag HP for the scanned stage (see fetchStageMagnitude). This path
    // returned early and never computed contribution at all before 2026-07-21.
    const spiderMag = await fetchStageMagnitude(spiderDungeon.id, "Spider's Den", scan.stageNumber);
    const contribution = buildContribution(team, {
      bossHp:       spiderMag.effectiveHp ?? NOMINAL_BOSS_HP,
      bossHpSource: spiderMag.effectiveHp ? spiderMag.source : 'nominal',
      multiplier:   spiderMag.effectiveHp ? spiderMag.multiplier : null,
      realBossHp:   spiderMag.bossHp ?? null,
      stageNumber:  scan.stageNumber, contentKey,
    });

    return {
      content_label:       `Spider's Den — Stage ${scan.stageNumber}`,
      contribution,
      dungeon_stage_id:    scan.dungeon_stage_id,
      stage_number_attempted: scan.stageNumber,
      verdict,
      verdict_band,
      confidence_pct,
      event_fallback:      false,
      not_ready_note,
      solo_carries,
      solo_carries_locked,
      team,
      leader,
      synergies: detectSynergies(team),
      stun_matrix:         null,
      shortfall_notes:     scan.shortfall_notes ?? [],
      stretch:             scan.stretch ?? [],
      gaps:                scan.gaps,
      coverage:            scan.coverage,
      threshold_results:   scan.threshold_results,
      affinity:            scan.affinity ?? null,
      sustain,
      cc_sustain,
      team_requirement_gaps,
      zero_tag_warnings,
      ascension_gaps,
      data_warning:        scan.data_warning,
      watchdog,
    };
  }

  // ── Fire Knight / Ice Golem: highest-confidence stage scan (like Spider) ────
  // No stage picker — the engine finds the highest stage the roster can clear.
  if (isDungeonStage) {
    const { data: dsDungeon, error: dsErr } = await supabase
      .from('dungeons').select('id, name')
      .eq('game_id', 'raid_shadow_legends').eq('name', dungeonName).single();
    if (dsErr || !dsDungeon) throw new Error(`Dungeon "${dungeonName}" not found. Run seeds first.`);

    const scan = await scanDungeonStages(mapped, dsDungeon.id, contentKey);
    if (!scan) throw new Error(`No stages seeded for "${dungeonName}".`);

    const { ready: solo_carries, locked: solo_carries_locked } = await checkSoloCarries(mapped, scan.dungeon_stage_id);
    const team = scan.team ?? selectTeam(mapped, scan.goals);
    const totalGoals = scan.actionableGoals.length;
    const verdict = deriveVerdict(scan.gaps, totalGoals);
    const { verdict_band, confidence_pct } = totalGoals === 0
      ? { verdict_band: null, confidence_pct: null }
      : { verdict_band: scan.verdict_band, confidence_pct: scan.confidence_pct };

    const not_ready_note = scan.notReady
      ? `Your roster isn't quite ready for ${dungeonName} yet — here's what to build first.`
      : null;

    const sustain               = checkTeamSustain(team);
    const cc_sustain            = checkCCSustain(team, scan.goals, scan.threshold_results);
    const team_requirement_gaps = await checkTeamRequirements(team, scan.dungeon_stage_id);

    // Boss exceptions + explanation style notes for the winning stage — parity with the
    // per-stage path so the explanation keeps its mechanic warnings (immunities, etc.).
    const { data: bossExceptionRows } = await supabase
      .from('boss_exceptions').select('description').eq('dungeon_stage_id', scan.dungeon_stage_id);
    const boss_exceptions = (bossExceptionRows ?? []).map(b => b.description);
    const dungeonTopicKey = dungeonName.replace(/'s\b/g, '').split(/\s+/).slice(0, 2).join(' ');
    const { data: styleNoteRows } = await supabase
      .from('explanation_style_notes').select('topic, note').ilike('topic', `%${dungeonTopicKey}%`);
    const style_notes = [...new Map((styleNoteRows ?? []).map(n => [n.note, n])).values()];
    const watchdog = runWatchdog({ roster: mapped, team, contentKey, usabilityTier });
    // Layer 2 on the REAL per-stage boss HP for the scanned stage (see fetchStageMagnitude). This
    // path returned early and never computed contribution at all before 2026-07-21.
    const dsMag = await fetchStageMagnitude(dsDungeon.id, dungeonName, scan.stageNumber);
    const contribution = buildContribution(team, {
      bossHp:       dsMag.effectiveHp ?? NOMINAL_BOSS_HP,
      bossHpSource: dsMag.effectiveHp ? dsMag.source : 'nominal',
      multiplier:   dsMag.effectiveHp ? dsMag.multiplier : null,
      realBossHp:   dsMag.bossHp ?? null,
      stageNumber:  scan.stageNumber, contentKey,
    });

    return {
      content_label:          `${dungeonName} — Stage ${scan.stageNumber}`,
      contribution,
      dungeon_stage_id:       scan.dungeon_stage_id,
      stage_number_attempted: scan.stageNumber,
      verdict,
      verdict_band,
      confidence_pct,
      event_fallback:         false,
      not_ready_note,
      solo_carries,
      solo_carries_locked,
      team,
      leader: scan.leader ?? null,
      synergies: detectSynergies(team),
      stun_matrix:            null,
      shortfall_notes:        scan.shortfall_notes ?? [],
      stretch:                scan.stretch ?? [],
      gaps:                   scan.gaps,
      coverage:               scan.coverage,
      threshold_results:      scan.threshold_results,
      affinity:               scan.affinity ?? null,
      sustain,
      cc_sustain,
      team_requirement_gaps,
      zero_tag_warnings,
      ascension_gaps,
      data_warning:           scan.data_warning,
      boss_exceptions,
      style_notes,
      phases:                 scan.phases,
      watchdog,
    };
  }

  // ── 2. Load dungeon → stage → phase ────────────────────────────────────────
  let dungeon, stage, event_fallback = false;

  if (isEventDungeon) {
    // Dynamic lookup — specific live event first, permanent generic fallback last.
    const today = new Date().toISOString().split('T')[0];
    const { data: events, error: eventsErr } = await supabase
      .from('dungeons')
      .select('id, name')
      .eq('game_id', 'raid_shadow_legends')
      .eq('is_event', true)
      .or(`active_until.is.null,active_until.gte.${today}`)
      .order('active_until', { ascending: false, nullsFirst: false });

    if (eventsErr || !events?.length) {
      throw new Error('No event dungeon currently active.');
    }
    dungeon = events[0];
    event_fallback = dungeon.name === 'Event Dungeon (Generic)';
    dungeonName = dungeon.name;

    // Use the highest-numbered seeded stage as the target farming stage.
    const { data: stages, error: stagesErr } = await supabase
      .from('dungeon_stages')
      .select('id, label, stage_number')
      .eq('dungeon_id', dungeon.id)
      .order('stage_number', { ascending: false })
      .limit(1);

    if (stagesErr || !stages?.length) {
      throw new Error(`No stages seeded for "${dungeon.name}" — seed this event before it goes live.`);
    }
    stage = stages[0];
    stageLabel  = stage.label;
    stageNumber = stage.stage_number ?? null;
  } else {
    const { data: d, error: dungeonErr } = await supabase
      .from('dungeons')
      .select('id, name')
      .eq('game_id', 'raid_shadow_legends')
      .eq('name', dungeonName)
      .single();

    if (dungeonErr || !d) {
      throw new Error(`Dungeon "${dungeonName}" not found. Run seeds first.`);
    }
    dungeon = d;

    const { data: s } = await supabase
      .from('dungeon_stages')
      .select('id, label, stage_number')
      .eq('dungeon_id', dungeon.id)
      .eq('label', stageLabel)
      .maybeSingle();

    if (!s) {
      // In-range request for a stage that isn't seeded yet (e.g. Ice Golem 21-25).
      // Give a clear coverage message rather than a generic "not found".
      throw new Error(`${dungeonName} ${stageLabel} isn't modelled yet — this dungeon is seeded up to a lower stage. Pick a lower stage for now.`);
    }
    stage = s;
  }

  // Stages can have multiple phases (wave + boss). Union goals/thresholds across
  // all phases — the team must cover every phase's goals, and the highest stat
  // floor applies. Single-phase content (Campaign, Clan Boss, Spider Hard) is the
  // degenerate union-of-one case, so this stays backward-compatible.
  const { data: phases, error: phaseErr } = await supabase
    .from('phases')
    .select('id, phase_type')
    .eq('dungeon_stage_id', stage.id);

  if (phaseErr || !phases?.length) {
    throw new Error(`Phase not found for stage "${stageLabel}".`);
  }
  const PHASE_ORDER = { wave: 0, boss: 1, single: 2 };
  phases.sort((a, b) => (PHASE_ORDER[a.phase_type] ?? 9) - (PHASE_ORDER[b.phase_type] ?? 9));

  // ── 3. Solo carry check (runs before team recommendation) ──────────────────
  const { ready: solo_carries, locked: solo_carries_locked } = await checkSoloCarries(mapped, stage.id);

  // ── 4. Load goals + thresholds across ALL phases (tagged by phase_type) ─────
  const goals = [];
  const thresholdChecks = [];
  for (const ph of phases) {
    const { data: pGoals, error: goalsErr } = await supabase
      .from('goals')
      .select(`
        id, description, is_informational,
        goal_solutions (
          id, label, status,
          goal_solution_tags ( tag_id, tags ( name, is_debuff, bypasses_accuracy_check ) )
        )
      `)
      .eq('phase_id', ph.id);
    if (goalsErr) throw new Error(`Goals query failed: ${goalsErr.message}`);
    for (const g of pGoals ?? []) g.phase_type = ph.phase_type;
    goals.push(...(pGoals ?? []));

    const { data: pThresh } = await supabase
      .from('stat_threshold_checks')
      .select('id, stat, comparison, formula, notes, threshold_type')
      .eq('phase_id', ph.id);
    for (const t of pThresh ?? []) t.phase_type = ph.phase_type;
    thresholdChecks.push(...(pThresh ?? []));
  }

  // ── 5. Tag coverage ─────────────────────────────────────────────────────────
  const rosterTagSet = new Set(mapped.flatMap(c => c.tags));
  const { actionableGoals, coverage, gaps } = computeTagCoverage(goals, rosterTagSet);
  const data_warning = actionableGoals.length === 0
    ? `No goals seeded for "${stageLabel}" — coverage results are vacuous. Seed goals for this stage before using results.`
    : null;

  // ── 6. Team selection (before thresholds — floors apply to the fielded team) ─
  // Live selection is still `selectTeam`. The structural replacement is `lib/team-constructor.js`
  // (marginal contribution + saturation + ACC land-rate gate), validated in shadow via
  // tools/shadow-cb.mjs — NOT wired here yet. A previous bridge (lib/model-select.js) was removed
  // 2026-07-18 as a dead end: its opt-in set was permanently empty, so it never ran.
  const team = selectTeam(mapped, goals);
  const team_roles = null; // per-seat primary/bonus roles — populated once the constructor is live

  // ── 6b. Leader aura (pick before thresholds so its stat boost counts) ───────
  const leader = await selectLeader(team, {
    contentArea: contentKey === 'clan_boss' ? 'clan_boss' : 'dungeon',
    thresholdStats: [...new Set((thresholdChecks ?? []).map(t => t.stat))],
  });
  const auraTeam = applyLeaderAura(team, leader);

  // ── 7. Stat threshold checks (against the selected team + its live leader aura) ─
  const threshold_results = evaluateThresholds(thresholdChecks, stageNumber, auraTeam, goals);

  // ── 7b. Boss exceptions + explanation style notes (for the explanation layer) ─
  const { data: bossExceptionRows } = await supabase
    .from('boss_exceptions')
    .select('description, source_citation')
    .eq('dungeon_stage_id', stage.id);
  const boss_exceptions = (bossExceptionRows ?? []).map(b => b.description);

  // explanation_style_notes has no dungeon column, so match on the dungeon's
  // distinctive name fragment ("Ice Golem", "Fire Knight"). Strip the possessive
  // ("Ice Golem's Peak" → "Ice Golem") so it matches topics that drop it. Dedup by
  // note text (the same topic can be seeded more than once).
  const dungeonTopicKey = dungeonName.replace(/'s\b/g, '').split(/\s+/).slice(0, 2).join(' ');
  const { data: styleNoteRows } = await supabase
    .from('explanation_style_notes')
    .select('topic, note')
    .ilike('topic', `%${dungeonTopicKey}%`);
  const style_notes = [...new Map((styleNoteRows ?? []).map(n => [n.note, n])).values()];

  // ── 8. Clan Boss stun matrix ────────────────────────────────────────────────
  // Only runs for Clan Boss content. boss_affinity from options is optional —
  // pass it when the player has selected a difficulty/day with known affinity.
  const stun_matrix = contentKey === 'clan_boss'
    ? buildStunMatrix(team, options.boss_affinity ?? null)
    : null;
  // Clan Boss only: the boss masteries (Warmaster / Giant Slayer) are PER-CHAMPION and add
  // %-max-HP damage, so we attach each carrier's multiplier instead of one account-wide number
  // (the old flat masteryDamageModifier). Consumed by the CB damage estimate; the magnitude in
  // lib/masteries.js is a placeholder to calibrate against captured damage.
  const boss_mastery_damage = contentKey === 'clan_boss'
    ? team.map(c => ({ name: c.name, has_boss_mastery: !!c.has_boss_mastery,
                       cb_damage_multiplier: bossMasteryDamageModifier(c.has_boss_mastery) }))
    : null;

  // Clan Boss damage model: estimate each champion's damage SHARE (who actually carries — the
  // %-max-HP mechanics: Poison / HP Burn / Warmaster, not raw ATK) and, for a calibrated
  // difficulty, an expected total → chest tier. Grounds the explanation's damage attribution and
  // gives an "expected chest" alongside the readiness %. See lib/cb-damage-model.js.
  let cb_damage = null;
  let contribBossHp = null; // real boss HP when we have it (CB); reused by the contribution model
  if (contentKey === 'clan_boss') {
    const { data: cbStat } = await supabase.from('clan_boss_stats')
      .select('boss_hp, damage_calibration').eq('dungeon_stage_id', stage.id).maybeSingle();
    const bossHp = cbStat?.boss_hp ? Number(cbStat.boss_hp) : null;
    contribBossHp = bossHp;
    if (bossHp) {
      const modelTeam = team.map(c => ({
        name: c.name, tags: c.tags, has_boss_mastery: c.has_boss_mastery,
        atk: c.estimated_stats?.atk, spd: c.estimated_stats?.spd,
        crit_rate: c.estimated_stats?.crit_rate ?? c.estimated_stats?.crate,
        crit_dmg:  c.estimated_stats?.crit_dmg  ?? c.estimated_stats?.cdmg,
        damage_multiplier_score: c.damage_multiplier_score,
      }));
      // A calibrated difficulty (damage_calibration ≠ the 1.0 default) yields an absolute total →
      // chest tier; uncalibrated ones still surface carriers from the relative shares.
      const cal = cbStat.damage_calibration && Number(cbStat.damage_calibration) !== 1
        ? Number(cbStat.damage_calibration) : null;
      const est = estimateCbDamage(modelTeam, { bossHp, calibration: cal });
      let expected_chest_tier = null;
      if (est.total != null) {
        const { data: tierRows } = await supabase.from('clan_boss_chest_tiers')
          .select('chest_name, sort_order, damage_min, damage_max')
          .eq('dungeon_stage_id', stage.id).order('sort_order');
        expected_chest_tier = chestTierFor(tierRows ?? [], est.total);
      }
      cb_damage = {
        carriers: carriers(est.perChampion).map(r => ({ name: r.name, share: Math.round(r.share * 100), sources: r.sources })),
        breakdown: est.perChampion.map(r => ({ name: r.name, share: Math.round(r.share * 100), sources: r.sources })),
        expected_total: est.total ?? null,
        expected_chest_tier,
      };
    }
  }

  // Clan Boss REAL-CAPTURE verdict (A-real): the trustworthy axis. CB is graded by damage vs the
  // chest thresholds, never by goal-coverage — so from the account's REAL captured keys
  // (options.clanBossRuns, extracted by the caller via clanBossRunsFromLog; the engine never reads
  // disk) we report the TOP difficulty whose top chest is proven one-keyed + the gap to the next.
  // The damage ESTIMATE (cb_damage) is calibrated for Nightmare only and can't yet scan difficulties
  // (survival-turns gap), so the recommendation stands on real captures. null when no CB captures.
  let clan_boss_verdict = null;
  if (contentKey === 'clan_boss') {
    const { data: allTierRows } = await supabase.from('clan_boss_chest_tiers')
      .select('chest_name, sort_order, damage_min, damage_max, dungeon_stages(label)');
    const tiersByDifficulty = {};
    for (const t of allTierRows ?? []) {
      const d = t.dungeon_stages?.label; if (d) (tiersByDifficulty[d] ??= []).push(t);
    }
    clan_boss_verdict = clanBossRecommendation(options.clanBossRuns ?? [], tiersByDifficulty);
  }

  // ── Layer 2 — CONTRIBUTION MODEL (DISPLAY ONLY; does NOT drive selection). ───
  // Per-champion contribution grounded in the damage-mechanics interaction rules (source-split
  // output, debuff multipliers weighted by reliability + saturation, mismatch → ~0, multiplicative
  // sustain), plus a two-sided confidence. NON-AUTHORITATIVE until the Layer 3 gate (PROJECT_BRIEF
  // §5b). Boss HP is REAL here: clan_boss_stats for CB, dungeon_stage_enemies for a seeded dungeon
  // stage; only an unseeded stage falls back to NOMINAL_BOSS_HP, and says so.
  let contribution = null;
  {
    const mag = contribBossHp
      ? { effectiveHp: contribBossHp, bossHp: contribBossHp, source: 'clan_boss_stats', multiplier: 1 }
      : await fetchStageMagnitude(dungeon?.id, dungeonName, stageNumber);
    contribution = buildContribution(team, {
      bossHp:       mag.effectiveHp ?? NOMINAL_BOSS_HP,
      bossHpSource: mag.effectiveHp ? mag.source : 'nominal',
      multiplier:   mag.effectiveHp ? mag.multiplier : null,
      realBossHp:   mag.bossHp ?? null,
      stageNumber, difficulty: options.difficulty ?? null, contentKey,
    });
  }

  const totalGoals = actionableGoals.length;
  const verdict    = deriveVerdict(gaps, totalGoals);

  let { verdict_band, confidence_pct } = totalGoals === 0
    ? { verdict_band: null, confidence_pct: null }
    : computeVerdictBand(gaps, threshold_results, auraTeam);
  // Clan Boss is NOT graded by goal-coverage. The old coverage-derived % (the misleading "40%
  // chance of success") answers the wrong question for a damage race — suppress it so the UI shows
  // the chest verdict (clan_boss_verdict) instead. Coverage still informs `verdict`/`gaps` (does the
  // team have the kit), just not a headline number.
  if (contentKey === 'clan_boss') { confidence_pct = null; verdict_band = null; }

  // ── 9. Global sustain / CC-sustain / per-champion team-requirement checks ────
  const sustain               = checkTeamSustain(team);
  const cc_sustain            = checkCCSustain(team, goals, threshold_results);
  const team_requirement_gaps = await checkTeamRequirements(team, stage.id);
  const watchdog              = runWatchdog({ roster: mapped, team, contentKey, usabilityTier });

  return {
    content_label:          `${dungeonName} — ${stageLabel}`,
    dungeon_stage_id:       stage.id,
    stage_number_attempted: stageNumber,
    verdict,
    verdict_band,
    confidence_pct,
    event_fallback,
    solo_carries,
    solo_carries_locked,
    team,
    team_roles, // per-seat primary/bonus roles when the model-based selector ran (null on old path)
    leader,
    synergies: detectSynergies(team), // generalizable combos the fielded team unlocks (lib/synergies.js)
    stun_matrix,
    boss_mastery_damage,
    cb_damage,
    clan_boss_verdict,
    contribution,
    gaps,
    coverage,
    threshold_results,
    sustain,
    cc_sustain,
    team_requirement_gaps,
    zero_tag_warnings,
    ascension_gaps,
    data_warning,
    boss_exceptions,
    style_notes,
    phases: phases.map(p => p.phase_type),
    watchdog,
  };
}

/**
 * Resolve (dungeonName, stageNumber, difficulty) → the dungeon_stages row, using
 * the same number-match + difficulty disambiguation as evaluateTeam. Shared by
 * evaluateTeam and the battle-upload pipeline so their stage resolution can't drift.
 * Returns { stage, dungeon } or { stage: null, reason }. Pass a supabase client.
 */
export async function resolveDungeonStage(client, dungeonName, stageNumber, difficulty = null) {
  const { data: dungeon } = await client
    .from('dungeons').select('id, name')
    .eq('game_id', 'raid_shadow_legends').eq('name', dungeonName).maybeSingle();
  if (!dungeon) return { stage: null, reason: `Dungeon "${dungeonName}" not in DB` };

  const { data: stages } = await client
    .from('dungeon_stages').select('id, label, stage_number').eq('dungeon_id', dungeon.id);

  const numRe = stageNumber != null ? new RegExp(`(^|[^0-9])${stageNumber}([^0-9]|$)`) : null;
  const candidates = (stages ?? []).filter(s =>
    s.stage_number === stageNumber || (numRe && numRe.test(s.label ?? '')));
  if (!candidates.length) return { stage: null, reason: `${dungeonName} stage ${stageNumber} not seeded (out of scope)` };

  const isHard = s => /\bhard\b/i.test(s.label ?? '');
  const diff = (difficulty ?? '').toLowerCase();
  const stage = diff === 'hard'   ? candidates.find(isHard)
              : diff === 'normal' ? candidates.find(s => !isHard(s))
              :                     (candidates.find(s => !isHard(s)) ?? candidates[0]);
  if (!stage) return { stage: null, reason: `${dungeonName} ${difficulty} stage ${stageNumber} seeded only at the other difficulty` };
  return { stage, dungeon, reason: null };
}

/**
 * Evaluate a FIXED team against a specific dungeon + stage number (the cross-
 * reference path). Same tag-coverage / threshold / verdict logic as matchRoster,
 * but scores the team you pass instead of selecting one. Returns { seeded:false,
 * reason } when the DB has no goals seeded for that exact stage (e.g. low stages
 * deliberately out of scope), so the caller can report coverage gaps honestly.
 *
 * @param {Array}  rosterTeam  - user_champions rows for the team's champions.
 * @param {string} dungeonName - DB dungeon name, e.g. "Ice Golem's Peak".
 * @param {number} stageNumber - exact stage number, e.g. 8.
 * @param {string} [difficulty]- 'Normal' | 'Hard' — disambiguates same-number stages
 *                               that exist at both difficulties (encoded in the label,
 *                               e.g. "Hard Stage 10" vs the Normal "Stage 10").
 */
export async function evaluateTeam(rosterTeam, dungeonName, stageNumber, difficulty = null) {
  const { mapped } = mapRoster(rosterTeam);
  const rosterTagSet = new Set(mapped.flatMap(c => c.tags));

  const { stage, reason } = await resolveDungeonStage(supabase, dungeonName, stageNumber, difficulty);
  if (!stage) return { seeded: false, reason };

  const { data: phases } = await supabase.from('phases').select('id').eq('dungeon_stage_id', stage.id);
  if (!phases?.length) return { seeded: false, reason: `No phases seeded for ${dungeonName} ${stage.label}` };

  // Union goals + thresholds across the stage's phases (wave + boss).
  let goals = [], thresholdChecks = [];
  for (const p of phases) {
    const { data: g } = await supabase
      .from('goals')
      .select('id, description, is_informational, goal_solutions(id, label, status, goal_solution_tags(tag_id, tags(name, is_debuff, bypasses_accuracy_check)))')
      .eq('phase_id', p.id);
    goals = goals.concat(g ?? []);
    const { data: t } = await supabase
      .from('stat_threshold_checks').select('id, stat, comparison, formula, notes, threshold_type')
      .eq('phase_id', p.id);
    thresholdChecks = thresholdChecks.concat(t ?? []);
  }

  const { actionableGoals, coverage, gaps } = computeTagCoverage(goals, rosterTagSet);
  const leader = await selectLeader(mapped, {
    contentArea: dungeonName === 'Clan Boss' ? 'clan_boss' : 'dungeon',
    thresholdStats: [...new Set((thresholdChecks ?? []).map(t => t.stat))],
  });
  const auraTeam = applyLeaderAura(mapped, leader);
  const threshold_results = evaluateThresholds(thresholdChecks, stageNumber, auraTeam, goals);
  const { verdict_band, confidence_pct } = actionableGoals.length === 0
    ? { verdict_band: null, confidence_pct: null }
    : computeVerdictBand(gaps, threshold_results, auraTeam);

  // Global sustain / CC-sustain / per-champion team-requirement checks (see §checks).
  const sustain               = checkTeamSustain(mapped);
  const cc_sustain            = checkCCSustain(mapped, goals, threshold_results);
  const team_requirement_gaps = await checkTeamRequirements(mapped, stage.id);

  return {
    seeded: true,
    dungeon: dungeonName, dungeon_stage_id: stage.id, stage_label: stage.label, stage_number: stageNumber, difficulty: difficulty ?? null,
    team: mapped.map(c => c.name),
    leader,
    synergies: detectSynergies(mapped), // generalizable combos the fielded team unlocks (lib/synergies.js)
    actionable_goals: actionableGoals.length,
    verdict: deriveVerdict(gaps, actionableGoals.length),
    gaps, coverage, threshold_results, verdict_band, confidence_pct,
    sustain, cc_sustain, team_requirement_gaps,
    data_warning: actionableGoals.length === 0 ? `No actionable goals seeded for ${dungeonName} ${stage.label}.` : null,
  };
}
