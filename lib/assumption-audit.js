// assumption-audit.js — post-battle reconciliation of engine ASSUMPTIONS vs REALITY.
//
// The matching engine asserts many things when it recommends/evaluates a team (sustain
// holds, HP/SPD floors are enough, a specific champ leads damage, a zero-tag champ has no
// capability, the confidence band, …). Each captured battle is a chance to test those
// assertions against what actually happened. auditBattle() emits one SIGNAL per assumption;
// a single battle rarely proves anything (rng), so conclusions come from AGGREGATING signals
// across many battles (see tools/audit-battles.mjs). This is the self-calibration layer that
// tells us WHICH placeholder (gear multipliers, threshold floors, tags, confidence bands) to
// fix, using real data instead of guesses.
//
// Pure: no DB, no network. Inputs are already-computed objects.
//   evaluation — an evaluateTeam() result (verdict, threshold_results, sustain, cc_sustain,
//                team[with role/tags/estimated_stats/stats_source/damage_multiplier_score]).
//   battle     — a battle-log/battle_history row (result, finishCause, turns, heroes[
//                {name, damage, survived, kills}], totalDamageDealt|total_damage_dealt).

const STATUS = /** @type {const} */ ({
  CONFIRMED:    'confirmed',    // reality matched the assumption
  REFUTED:      'refuted',      // reality contradicted it → candidate miscalibration/bad tag
  CONSERVATIVE: 'conservative', // engine warned/failed but reality was fine → maybe too strict
  NEEDS_DATA:   'needs_data',   // the signal we'd need wasn't captured this battle
  AGGREGATE:    'aggregate',    // meaningful only pooled across battles
});

const norm = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
const dmgOf = (b) => b.totalDamageDealt ?? b.total_damage_dealt ?? null;

// Per-hero survival for the fielded team. survived may be null (not captured) → unknown.
function survival(battle) {
  const hs = (battle.heroes ?? []).filter(h => h.name);
  const known = hs.filter(h => h.survived === true || h.survived === false);
  return {
    hasData: known.length > 0,
    deaths:  hs.filter(h => h.survived === false),
    allSurvived: known.length > 0 && known.every(h => h.survived === true),
  };
}

/**
 * @returns {Array<{id,category,assumption,status,signal,detail}>}
 */
export function auditBattle(evaluation, battle) {
  const ev = evaluation ?? {};
  const checks = [];
  const add = (c) => checks.push(c);
  const surv = survival(battle);
  const heroes = (battle.heroes ?? []).filter(h => h.name);
  const thr = (stat) => (ev.threshold_results ?? []).find(t => t.stat === stat);

  // ── A1. Sustain: engine claims the team can self-heal (or warns it can't) ──────
  if (ev.sustain) {
    if (ev.sustain.passes) {
      if (surv.deaths.length) add({ id: 'sustain_holds', category: 'survivability',
        assumption: `sustain via ${ev.sustain.provider ?? 'a team member'} keeps the team alive`,
        status: STATUS.REFUTED,
        signal: `${surv.deaths.length} ally death(s) despite a claimed sustain source`,
        detail: surv.deaths.map(d => d.name) });
      else if (surv.allSurvived) add({ id: 'sustain_holds', category: 'survivability',
        assumption: `sustain via ${ev.sustain.provider ?? 'a team member'} keeps the team alive`,
        status: STATUS.CONFIRMED, signal: 'all allies survived' });
      else add({ id: 'sustain_holds', category: 'survivability', assumption: 'team sustain holds',
        status: STATUS.NEEDS_DATA, signal: 'per-hero survival not captured' });
    } else if (surv.allSurvived) {
      add({ id: 'sustain_warning', category: 'survivability',
        assumption: 'engine warned team has NO sustain → will die in extended fights',
        status: STATUS.CONSERVATIVE, signal: 'team survived with no flagged sustain source' });
    }
  }

  // ── A2. HP floor: threshold passed but someone died (floor or stat estimate too high) ──
  const hp = thr('hp');
  if (hp && hp.passes === true) {
    if (surv.deaths.length) add({ id: 'hp_floor', category: 'thresholds',
      assumption: `HP floor ${hp.threshold_value} is enough (team est ${hp.estimated_value})`,
      status: STATUS.REFUTED, signal: `${surv.deaths.length} death(s) despite passing the HP floor`,
      detail: surv.deaths.map(d => d.name) });
    else if (surv.allSurvived) add({ id: 'hp_floor', category: 'thresholds',
      assumption: `HP floor ${hp.threshold_value} is enough`, status: STATUS.CONFIRMED,
      signal: 'passed the floor and all survived' });
  } else if (hp && hp.passes === false && surv.allSurvived) {
    add({ id: 'hp_floor', category: 'thresholds',
      assumption: `HP floor ${hp.threshold_value} required (team est ${hp.estimated_value})`,
      status: STATUS.CONSERVATIVE, signal: 'survived despite failing the HP floor → floor may be too high' });
  }

  // ── A3. SPD floor vs turns taken (only conclusive in aggregate) ────────────────
  const spd = thr('spd');
  if (spd && spd.threshold_value != null && typeof battle.turns === 'number') {
    add({ id: 'spd_floor_turns', category: 'thresholds',
      assumption: `SPD floor ${spd.threshold_value} (team est ${spd.estimated_value ?? '?'}) yields enough turns`,
      status: STATUS.AGGREGATE, signal: `${battle.turns} turn(s) this run`,
      detail: { passed: spd.passes, turns: battle.turns } });
  }

  // ── B1. Damage attribution: who the engine expects to carry vs who actually did ──
  const haveDamage = heroes.some(h => typeof h.damage === 'number');
  if (haveDamage && (ev.team ?? []).length) {
    // Engine's expected top damage dealer: highest role-relevant multiplier score.
    const ranked = [...ev.team].filter(c => c.damage_multiplier_score != null)
      .sort((a, b) => b.damage_multiplier_score - a.damage_multiplier_score);
    const predictedTop = ranked[0]?.name ?? null;
    const actualTop = [...heroes].sort((a, b) => (b.damage ?? 0) - (a.damage ?? 0))[0];
    if (predictedTop && actualTop) {
      const match = norm(predictedTop) === norm(actualTop.name);
      add({ id: 'damage_attribution', category: 'damage_model',
        assumption: `${predictedTop} is the team's strongest damage skill (role+multiplier)`,
        status: match ? STATUS.CONFIRMED : STATUS.REFUTED,
        signal: match ? `${actualTop.name} led damage as predicted`
          : `actual top damage was ${actualTop.name} (${actualTop.damage?.toLocaleString()}), not ${predictedTop}`,
        detail: { predictedTop, actualTop: actualTop.name } });
    } else if (!predictedTop) {
      add({ id: 'damage_attribution', category: 'damage_model',
        assumption: 'a damage carrier is identifiable from role+multiplier data',
        status: STATUS.REFUTED,
        signal: 'no team member has a seeded damage multiplier — cannot attribute damage',
        detail: { actualTop: [...heroes].sort((a, b) => (b.damage ?? 0) - (a.damage ?? 0))[0]?.name } });
    }
  }

  // ── F1. Zero-tag carrier: a champ we think has no capability actually carried ───
  if (haveDamage) {
    const total = heroes.reduce((s, h) => s + (h.damage ?? 0), 0) || 1;
    const byName = new Map((ev.team ?? []).map(c => [norm(c.name), c]));
    for (const h of heroes) {
      const share = (h.damage ?? 0) / total;
      const champ = byName.get(norm(h.name));
      const noTags = champ && (champ.tags ?? []).length === 0;
      if (share >= 0.15 && noTags) add({ id: 'zero_tag_carrier', category: 'tags',
        assumption: `${h.name} has no tagged capabilities`,
        status: STATUS.REFUTED,
        signal: `${h.name} dealt ${(share * 100).toFixed(0)}% of team damage while untagged → missing tags`,
        detail: { name: h.name, damage: h.damage } });
    }
  }

  // ── E1. Confidence calibration (headline; conclusive only in aggregate) ─────────
  if (ev.confidence_pct != null) {
    const isCB = dmgOf(battle) != null;
    add({ id: 'confidence_calibration', category: 'calibration',
      assumption: `${ev.confidence_pct}% confidence (${ev.verdict_band ?? ev.verdict ?? '?'})`,
      status: STATUS.AGGREGATE,
      signal: isCB ? `CB total damage ${dmgOf(battle).toLocaleString()}`
        : `outcome ${battle.result}`,
      detail: { confidence_pct: ev.confidence_pct, verdict_band: ev.verdict_band,
        result: battle.result, damage: dmgOf(battle) } });
  }

  return checks;
}

export const AUDIT_STATUS = STATUS;
