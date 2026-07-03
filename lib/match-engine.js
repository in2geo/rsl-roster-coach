import { createClient } from '@supabase/supabase-js';
import { estimateStats } from './estimate-stats.js';
import { clanBossStunScore } from './formulas.js';

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

// Multi-phase dungeon content where the UI picks a specific stage number at runtime
// (passed as options.stage). The stage label in the DB is "Stage <n>". These dungeons
// have wave + boss phases, so matchRoster unions goals/thresholds across phases.
const DUNGEON_STAGE_CONTENT = {
  fire_knight: "Fire Knight's Castle",
  ice_golem:   "Ice Golem's Peak",
};
const DUNGEON_STAGE_RANGE = { min: 10, max: 20 }; // seeded range for FK/IG

// Spider's Den Normal — scan groups ordered highest-first.
// The scanner iterates stages top-down and returns the highest stage where confidence ≥ threshold.
const SPIDER_SCAN_GROUPS = [
  { label: 'Stages 7-10', stageNumbers: [10, 9, 8, 7] },
  { label: 'Stages 1-6',  stageNumbers: [6, 5, 4, 3, 2, 1] },
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
  const m = f.match(/^stage\s*\*\s*(\d+(?:\.\d+)?)$/);
  if (!m) return null;
  return stageNumber * parseFloat(m[1]);
}

// Maps gear tier label to a numeric weight for min-gear calculation.
const GEAR_WEIGHT = { Starter: 1, Dungeon: 2, Strong: 3, 'God Tier': 4 };

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
  // CALIBRATION NOTE: PLACEHOLDER ESTIMATE — the 80% threshold for "best Spider stage" was chosen
  // as a reasonable success floor. Adjust once outcome data validates the right cutoff.
  confidenceThreshold: 80,
};

// Derives the verdict band slug and display confidence percentage from match output.
// Bands correspond 1-to-1 with the Phase 1 percentage ranges in STRATEGY.md so the
// Phase 2 calibration query can group by band and compare displayed vs actual rates.
//
// Within each band, position is determined by the ratio of evaluable thresholds that pass:
// more passing → higher end of the band. "borderline" means passing but estimated value is
// within 10% above the floor — close enough that real substat variance could tip it either way.
function computeVerdictBand(gaps, thresholdResults, team) {
  const band = (() => {
    if (gaps.length >= 2) return 'multi_goal_gap';
    if (gaps.length === 1) return 'one_goal_gap';

    const failing    = thresholdResults.filter(t => t.passes === false);
    const borderline = thresholdResults.filter(t =>
      t.passes === true &&
      t.estimated_value != null &&
      t.threshold_value != null &&
      t.estimated_value < t.threshold_value * 1.1
    );

    if (failing.length)    return 'stats_failing';
    if (borderline.length) return 'borderline_threshold';

    const minGear = Math.min(...(team ?? []).map(c => GEAR_WEIGHT[c.gear_tier] ?? 1));
    return minGear >= 3 ? 'all_goals_strong_gear' : 'all_goals_dungeon_gear';
  })();

  const { min, max } = VERDICT_BAND_CONFIG[band];

  // Scale within the band by pass ratio — more passing thresholds = higher end.
  const evaluable  = thresholdResults.filter(t => t.passes === true || t.passes === false);
  const passRatio  = evaluable.length
    ? thresholdResults.filter(t => t.passes === true).length / evaluable.length
    : 1;
  const confidence_pct = Math.round(min + passRatio * (max - min));

  return { verdict_band: band, confidence_pct };
}

function rarityWeight(r) {
  return { Common: 1, Uncommon: 2, Rare: 3, Epic: 4, Legendary: 5, Mythical: 6 }[r] ?? 0;
}

function gearTierWeight(t) {
  return { Starter: 1, Dungeon: 2, Strong: 3, 'God Tier': 4 }[t] ?? 1;
}

// Maps raw user_champions rows to the engine's internal champion shape (approved
// tags, ascension-gated tags surfaced, estimated stats). Shared by matchRoster
// (which then selects a team) and evaluateTeam (which scores a fixed team).
export function mapRoster(roster) {
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
      stars: uc.stars, level: uc.level,
      gear_tier: uc.gear_tier ?? 'Starter', ascension_level: uc.ascension_level,
      tags: approvedTags,
      // Prefer real Gestal-sourced effective stats (from actual gear) for threshold
      // comparison; fall back to the gear-tier estimator for manual (non-Gestal) rosters.
      estimated_stats: uc.effective_stats ?? estimateStats(ch, uc),
      stats_source: uc.effective_stats ? 'gestal_effective' : 'estimated',
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
    let via = null; const detail = [];
    for (const sol of satisfied) {
      const accTags = sol.goal_solution_tags.map(g => g.tags).filter(isAccuracyGated);
      let allLandable = true;
      for (const t of accTags) {
        const best = bestAccFor(t.name);            // (a) multiple carriers → best ACC wins
        const landable = best != null && best >= floor;
        detail.push({ tag: t.name, bestAcc: best, floor, landable });
        if (!landable) allLandable = false;          // (c) carrier(s) exist but under the floor
      }
      if (allLandable) { via = sol.label; break; }
    }
    perGoal.push({ goal: goal.description, acc_relevant: true, passes: !!via, via, detail });
  }

  const relevant = perGoal.filter(r => r.acc_relevant);
  const failing = relevant.filter(r => !r.passes);
  const passes = failing.length === 0;
  const limiting = failing.length
    ? Math.min(...failing.flatMap(r => (r.detail ?? []).filter(d => !d.landable).map(d => d.bestAcc ?? 0)))
    : null;
  const notes = relevant.length === 0
    ? `ACC floor ${floor}: no covered goal needs an accuracy-gated debuff to land — ACC not required.`
    : passes
      ? `ACC floor ${floor}: all ${relevant.length} ACC-dependent goal(s) have a carrier at/above the floor.`
      : `ACC floor ${floor}: ${failing.length} ACC-dependent goal(s) lack a carrier at the floor — `
        + failing.map(r => `"${(r.goal ?? '').slice(0, 40)}" [`
            + (r.detail ?? []).filter(d => !d.landable).map(d => `${d.tag} best ${d.bestAcc ?? 'none'}`).join(', ') + ']').join('; ');
  return { stat: 'acc', formula: check.formula, threshold_type: check.threshold_type ?? 'raw',
           threshold_value: floor, estimated_value: limiting, passes, notes, acc_detail: perGoal };
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
    results.push({ stat: check.stat, formula: check.formula, threshold_type: check.threshold_type ?? 'raw', threshold_value: threshold, estimated_value: minStat, passes: minStat >= threshold, notes: check.notes });
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

// Scores and sorts the roster then returns the top-5 team.
function selectTeam(mapped, goals, coverage) {
  const scored = mapped.map(champ => {
    let score = 0;
    for (const goal of goals ?? []) {
      if (goal.is_informational) continue;
      if (coverage[goal.id]?.satisfied) continue;
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
    b.score - a.score || b.stars - a.stars || b.level - a.level ||
    gearTierWeight(b.gear_tier) - gearTierWeight(a.gear_tier) ||
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
async function scanSpiderStages(mapped, dungeonId) {
  const rosterTagSet = new Set(mapped.flatMap(c => c.tags));
  const threshold = VERDICT_BAND_CONFIG.confidenceThreshold;
  let lastResult = null;

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
    // across the group. Thresholds + verdict band evaluate against that fielded team.
    const team = selectTeam(mapped, goals, coverage);

    for (const stageNumber of group.stageNumbers) {
      const threshold_results = evaluateThresholds(thresholdChecks, stageNumber, team, goals);
      const { verdict_band, confidence_pct } = actionableGoals.length === 0
        ? { verdict_band: null, confidence_pct: null }
        : computeVerdictBand(gaps, threshold_results, team);

      lastResult = { stageNumber, dungeon_stage_id: stageRow.id, stageLabel: group.label, goals, actionableGoals, gaps, coverage, threshold_results, verdict_band, confidence_pct, data_warning, team };

      if (confidence_pct != null && confidence_pct >= threshold) {
        return { ...lastResult, notReady: false };
      }
    }
  }

  // No stage cleared the bar — return stage 1 (last computed) with notReady flag.
  return { ...lastResult, notReady: true };
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
  speed_aura:      ['Speed Aura'],
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

  // Dungeon-stage content (Fire Knight / Ice Golem): the UI picks the stage number.
  if (isDungeonStage) {
    const n = Number(options.stage);
    if (!Number.isInteger(n) || n < DUNGEON_STAGE_RANGE.min || n > DUNGEON_STAGE_RANGE.max) {
      throw new Error(`${DUNGEON_STAGE_CONTENT[contentKey]} needs a stage between ${DUNGEON_STAGE_RANGE.min} and ${DUNGEON_STAGE_RANGE.max} (got ${options.stage}).`);
    }
  }

  // Clan Boss: difficulty is passed at runtime (Normal, Hard, Brutal, etc.)
  // For event dungeons these are resolved from the DB below.
  let dungeonName  = contentConfig?.dungeon ?? (isDungeonStage ? DUNGEON_STAGE_CONTENT[contentKey] : null);
  let stageNumber  = contentConfig?.stageNumber ?? (isDungeonStage ? Number(options.stage) : null);
  let stageLabel   = isDungeonStage
    ? `Stage ${stageNumber}`
    : (contentKey === 'clan_boss' && options.difficulty)
      ? options.difficulty
      : (contentConfig?.stage ?? null);

  // ── 1. Map roster to internal shape ────────────────────────────────────────
  const { mapped, zero_tag_warnings, ascension_gaps } = mapRoster(roster);

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
    const team = scan.team ?? selectTeam(mapped, scan.goals, scan.coverage);
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

    return {
      content_label:       `Spider's Den — Stage ${scan.stageNumber}`,
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
      stun_matrix:         null,
      gaps:                scan.gaps,
      coverage:            scan.coverage,
      threshold_results:   scan.threshold_results,
      sustain,
      cc_sustain,
      team_requirement_gaps,
      zero_tag_warnings,
      ascension_gaps,
      data_warning:        scan.data_warning,
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

    const { data: s, error: stageErr } = await supabase
      .from('dungeon_stages')
      .select('id, label, stage_number')
      .eq('dungeon_id', dungeon.id)
      .eq('label', stageLabel)
      .single();

    if (stageErr || !s) {
      throw new Error(`Stage "${stageLabel}" not found for dungeon "${dungeonName}".`);
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
  const team = selectTeam(mapped, goals, coverage);

  // ── 7. Stat threshold checks (against the selected team, not the full roster) ─
  const threshold_results = evaluateThresholds(thresholdChecks, stageNumber, team, goals);

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

  const totalGoals = actionableGoals.length;
  const verdict    = deriveVerdict(gaps, totalGoals);

  const { verdict_band, confidence_pct } = totalGoals === 0
    ? { verdict_band: null, confidence_pct: null }
    : computeVerdictBand(gaps, threshold_results, team);

  // ── 9. Global sustain / CC-sustain / per-champion team-requirement checks ────
  const sustain               = checkTeamSustain(team);
  const cc_sustain            = checkCCSustain(team, goals, threshold_results);
  const team_requirement_gaps = await checkTeamRequirements(team, stage.id);

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
    stun_matrix,
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
  const threshold_results = evaluateThresholds(thresholdChecks, stageNumber, mapped, goals);
  const { verdict_band, confidence_pct } = actionableGoals.length === 0
    ? { verdict_band: null, confidence_pct: null }
    : computeVerdictBand(gaps, threshold_results, mapped);

  // Global sustain / CC-sustain / per-champion team-requirement checks (see §checks).
  const sustain               = checkTeamSustain(mapped);
  const cc_sustain            = checkCCSustain(mapped, goals, threshold_results);
  const team_requirement_gaps = await checkTeamRequirements(mapped, stage.id);

  return {
    seeded: true,
    dungeon: dungeonName, dungeon_stage_id: stage.id, stage_label: stage.label, stage_number: stageNumber, difficulty: difficulty ?? null,
    team: mapped.map(c => c.name),
    actionable_goals: actionableGoals.length,
    verdict: deriveVerdict(gaps, actionableGoals.length),
    gaps, coverage, threshold_results, verdict_band, confidence_pct,
    sustain, cc_sustain, team_requirement_gaps,
    data_warning: actionableGoals.length === 0 ? `No actionable goals seeded for ${dungeonName} ${stage.label}.` : null,
  };
}
