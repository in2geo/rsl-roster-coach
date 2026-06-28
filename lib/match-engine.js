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
  campaign:        { dungeon: 'Campaign',       stage: 'Early (1-12)',  stageNumber: null },
  spider:          { dungeon: "Spider's Den",   stage: 'Stages 7-10',  stageNumber: 9    },
  spider_beginner: { dungeon: "Spider's Den",   stage: 'Stages 1-6',   stageNumber: 3    },
  clan_boss:       { dungeon: 'Clan Boss',      stage: 'Normal',       stageNumber: null },
};

// Only allows 'stage * N' formula pattern — avoids eval() on arbitrary strings.
function evalFormula(formula, stageNumber) {
  if (stageNumber == null) return null;
  const m = formula?.match(/^stage\s*\*\s*(\d+(\.\d+)?)$/);
  if (!m) return null;
  return stageNumber * parseFloat(m[1]);
}

function rarityWeight(r) {
  return { Common: 1, Uncommon: 2, Rare: 3, Epic: 4, Legendary: 5, Mythical: 6 }[r] ?? 0;
}

function gearTierWeight(t) {
  return { Starter: 1, Dungeon: 2, Strong: 3, 'God Tier': 4 }[t] ?? 1;
}

// ── Solo carry check ──────────────────────────────────────────────────────────
// Returns approved solo carry profiles for this stage that the player owns,
// sorted by research_confidence (High → Medium → Low) then rarity.
// Called before team selection so the UI can surface it as a first-class callout.
async function checkSoloCarries(rosterChampionIds, stageId) {
  if (!rosterChampionIds.length) return [];

  const { data, error } = await supabase
    .from('champion_solo_profiles')
    .select(`
      id, required_set, required_stats, ai_settings, notes,
      affinity_warning, availability_note, research_confidence,
      champions ( id, name, rarity, affinity )
    `)
    .eq('dungeon_stage_id', stageId)
    .eq('status', 'approved')
    .in('champion_id', rosterChampionIds);

  if (error || !data?.length) return [];

  const confidenceRank = { High: 0, Medium: 1, Low: 2, Unverified: 3 };

  return data
    .sort((a, b) =>
      (confidenceRank[a.research_confidence] ?? 3) - (confidenceRank[b.research_confidence] ?? 3) ||
      rarityWeight(b.champions?.rarity) - rarityWeight(a.champions?.rarity)
    )
    .map(row => ({
      champion_id:         row.champions?.id,
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
    }));
}

// Tags that indicate a champion is a critical debuffer — should not be the stun target.
const CRITICAL_DEBUFFER_TAGS = ['Decrease DEF', 'Decrease ATK', 'Weaken'];

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
  const contentConfig = CONTENT_MAP[contentKey];
  if (!contentConfig) throw new Error(`Unknown content key: ${contentKey}`);
  const { dungeon: dungeonName, stage: defaultStageLabel, stageNumber } = contentConfig;
  // Clan Boss: difficulty is passed at runtime (Normal, Hard, Brutal, etc.)
  const stageLabel = (contentKey === 'clan_boss' && options.difficulty)
    ? options.difficulty
    : defaultStageLabel;

  // ── 1. Map roster to internal shape ────────────────────────────────────────
  const zero_tag_warnings = [];

  const mapped = roster.map(uc => {
    const ch = uc.champion;
    const approvedTags = (ch.champion_tags ?? [])
      .filter(ct => ct.status === 'approved')
      .map(ct => ct.tags.name);

    if (approvedTags.length === 0) {
      zero_tag_warnings.push(ch.name);
    }

    const estimated_stats = estimateStats(ch, uc);

    return {
      id:              ch.id,
      name:            ch.name,
      rarity:          ch.rarity,
      stars:           uc.stars,
      level:           uc.level,
      gear_tier:       uc.gear_tier ?? 'Starter',
      ascension_level: uc.ascension_level,
      tags:            approvedTags,
      estimated_stats,
    };
  });

  // ── 2. Load dungeon → stage → phase ────────────────────────────────────────
  const { data: dungeon, error: dungeonErr } = await supabase
    .from('dungeons')
    .select('id, name')
    .eq('name', dungeonName)
    .single();

  if (dungeonErr || !dungeon) {
    throw new Error(`Dungeon "${dungeonName}" not found. Run seeds first.`);
  }

  const { data: stage, error: stageErr } = await supabase
    .from('dungeon_stages')
    .select('id, label, stage_number')
    .eq('dungeon_id', dungeon.id)
    .eq('label', stageLabel)
    .single();

  if (stageErr || !stage) {
    throw new Error(`Stage "${stageLabel}" not found for dungeon "${dungeonName}".`);
  }

  const { data: phase, error: phaseErr } = await supabase
    .from('phases')
    .select('id')
    .eq('dungeon_stage_id', stage.id)
    .single();

  if (phaseErr || !phase) {
    throw new Error(`Phase not found for stage "${stageLabel}".`);
  }

  // ── 3. Solo carry check (runs before team recommendation) ──────────────────
  const rosterChampionIds = mapped.map(c => c.id);
  const solo_carries = await checkSoloCarries(rosterChampionIds, stage.id);

  // ── 4. Load goals + solutions for this phase ────────────────────────────────
  const { data: goals, error: goalsErr } = await supabase
    .from('goals')
    .select(`
      id, description, is_informational,
      goal_solutions (
        id, label, status,
        goal_solution_tags ( tag_id, tags ( name ) )
      )
    `)
    .eq('phase_id', phase.id);

  if (goalsErr) throw new Error(`Goals query failed: ${goalsErr.message}`);

  const actionableGoals = (goals ?? []).filter(g => !g.is_informational);
  const data_warning = actionableGoals.length === 0
    ? `No goals seeded for "${stageLabel}" — coverage results are vacuous. Seed goals for this stage before using results.`
    : null;

  // ── 5. Tag-matching loop ────────────────────────────────────────────────────
  const rosterTagSet = new Set(mapped.flatMap(c => c.tags));
  const coverage = {};
  const gaps     = [];

  for (const goal of goals ?? []) {
    if (goal.is_informational) continue;

    const solutions = (goal.goal_solutions ?? []).filter(s => s.status === 'approved');
    let satisfied = false;
    let matchedLabel = null;

    for (const sol of solutions) {
      const required = sol.goal_solution_tags.map(gst => gst.tags.name);
      if (required.every(t => rosterTagSet.has(t))) {
        satisfied = true;
        matchedLabel = sol.label;
        break;
      }
    }

    coverage[goal.id] = {
      description:     goal.description,
      satisfied,
      solution_label:  matchedLabel,
      total_solutions: solutions.length,
    };
    if (!satisfied) gaps.push(goal.description);
  }

  // ── 6. Stat threshold checks ────────────────────────────────────────────────
  const { data: thresholdChecks } = await supabase
    .from('stat_threshold_checks')
    .select('id, stat, comparison, formula, notes, threshold_type')
    .eq('phase_id', phase.id);

  const threshold_results = [];

  for (const check of thresholdChecks ?? []) {
    if (check.comparison === 'formula') {
      const threshold = evalFormula(check.formula, stageNumber);
      if (threshold == null) {
        threshold_results.push({
          stat: check.stat, formula: check.formula,
          threshold_value: null, estimated_value: null,
          passes: null, notes: 'Could not evaluate formula — stage number unknown',
        });
        continue;
      }

      const relevantStats = mapped.map(c => c.estimated_stats[check.stat] ?? 0);
      const minStat = Math.min(...relevantStats);

      threshold_results.push({
        stat:            check.stat,
        formula:         check.formula,
        threshold_type:  check.threshold_type ?? 'raw',
        threshold_value: threshold,
        estimated_value: minStat,
        passes:          minStat >= threshold,
        notes:           check.notes,
      });
    } else {
      threshold_results.push({
        stat:            check.stat,
        formula:         null,
        threshold_type:  check.threshold_type ?? 'raw',
        threshold_value: null,
        estimated_value: null,
        passes:          'needs_review',
        notes:           check.notes ?? 'Relative-to-enemy check — requires enemy stat data to evaluate',
      });
    }
  }

  // ── 7. Team selection ───────────────────────────────────────────────────────
  const scored = mapped.map(champ => {
    let score = 0;
    for (const goal of goals ?? []) {
      if (goal.is_informational) continue;
      if (coverage[goal.id]?.satisfied) continue;
      const solutions = (goal.goal_solutions ?? []).filter(s => s.status === 'approved');
      for (const sol of solutions) {
        const req = sol.goal_solution_tags.map(g => g.tags.name);
        if (req.every(t => champ.tags.includes(t))) { score++; break; }
      }
    }
    return { ...champ, score };
  });

  scored.sort((a, b) =>
    b.score - a.score ||
    b.stars - a.stars ||
    b.level - a.level ||
    gearTierWeight(b.gear_tier) - gearTierWeight(a.gear_tier) ||
    rarityWeight(b.rarity) - rarityWeight(a.rarity)
  );
  const team = scored.slice(0, 5);

  // ── 8. Clan Boss stun matrix ────────────────────────────────────────────────
  // Only runs for Clan Boss content. boss_affinity from options is optional —
  // pass it when the player has selected a difficulty/day with known affinity.
  const stun_matrix = contentKey === 'clan_boss'
    ? buildStunMatrix(team, options.boss_affinity ?? null)
    : null;

  return {
    content_label:     `${dungeonName} — ${stageLabel}`,
    solo_carries,
    team,
    stun_matrix,
    gaps,
    coverage,
    threshold_results,
    zero_tag_warnings,
    data_warning,
  };
}
