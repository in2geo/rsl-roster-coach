// contribution-model.js — Layer 2. Per-champion CONTRIBUTION for any content,
// generalizing cb-damage-model.js with the damage-mechanics interaction rules.
//
// The current match engine scores by tag COVERAGE (has the tag? yes/no). This scores
// by CONTRIBUTION: how much each champion actually adds, given the team's damage type,
// debuff multipliers (reliability- and saturation-weighted), and multiplicative sustain.
// Its headline output is a TWO-SIDED confidence — P(kill-speed beats survival-time within
// the time budget) — and, critically, it attributes debuff multipliers and granted
// survival back to the SUPPORT that provides them (so Uugo/Bad-el-Kazar stop reading as
// ~2% contributors). See PROJECT_BRIEF.md §5b and lib/damage-mechanics.js.
//
// STATUS: runs ALONGSIDE coverage (rank/explain/validate) — it does NOT drive selection.
// Layer 3 (selection consumes this) is gated: ≥20 reconciled runs across ≥2 dungeons AND
// gear-tier calibration first. Magnitudes here are NOMINAL; the STRUCTURE is the point.

import { SOURCE_COEFF } from './cb-damage-model.js';
import {
  TAG_TO_SOURCE, DEBUFF_DAMAGE_INTERACTIONS, saturationValue,
  reliabilityFactor, SUSTAIN_IS_MULTIPLICATIVE, teamTurnMultiplier, TURN_MULTIPLIER_TAGS,
} from './damage-mechanics.js';

const critFactor = (cr, cd) => 1 + (Number(cr ?? 0) / 100) * (Number(cd ?? 0) / 100);
const NOMINAL_MULT = { high: 1.5, medium: 1.25, low: 1.1, none: 1.0 };
const DEFAULT_BUDGET_TURNS = 50; // ~5-min auto clear proxy; calibrate per content later

// Debuff tags that carry a damage-multiplier role (Decrease DEF, Poison Sensitivity, …).
const MULTIPLIER_DEBUFFS = new Set(
  Object.entries(DEBUFF_DAMAGE_INTERACTIONS).filter(([, r]) => r.affects.length > 0).map(([t]) => t)
);

/**
 * A champion's own per-turn damage, split by source. %maxHP sources (poison/hp_burn/
 * warmaster) scale off boss HP and IGNORE DEF; attack scales off ATK×crit and is the
 * only DEF-dependent family. `saturationValue` caps stacking DoT (poison→10, HP Burn→1).
 */
export function championPerTurnBySource(champ, { bossHp = 0 } = {}) {
  const out = {};
  const add = (s, v) => { out[s] = (out[s] ?? 0) + v; };
  for (const tag of (champ.tags ?? [])) {
    const src = TAG_TO_SOURCE[tag];
    if (!src) continue;
    if (src === 'attack') {
      add('attack', (champ.damage_multiplier_score ?? 0) * (champ.atk ?? 0) * critFactor(champ.crit_rate, champ.crit_dmg));
    } else {
      // %maxHP source: coefficient × bossHp, damped by how saturated that source is on the team.
      add(src, (SOURCE_COEFF[src] ?? 0) * bossHp * saturationValue(src, champ._activeStacks?.[src] ?? 0));
    }
  }
  if (champ.has_boss_mastery) add('warmaster', (SOURCE_COEFF.warmaster ?? 0) * bossHp);
  return out;
}

/** Team debuffs that multiply damage, with their owner and reliability inputs. */
export function teamMultiplierDebuffs(team = []) {
  const list = [];
  for (const c of team) {
    for (const tag of (c.tags ?? [])) {
      if (MULTIPLIER_DEBUFFS.has(tag)) list.push({ tag, owner: c.name, meta: c.debuffMeta?.[tag] ?? {} });
    }
  }
  return list;
}

/**
 * Effective multiplier applied to ONE damage source by the team's debuffs, reliability-
 * weighted, with per-owner attribution of the marginal lift. A debuff only affects the
 * sources in its `affects` list (so DEF shred never touches %maxHP — enforced upstream).
 * @returns {{ multiplier:number, attribution:Array<{owner,tag,lift}> }}
 *   `lift` values are shares of (multiplier-1) so extra damage can be credited to supports.
 */
export function sourceMultiplier(source, debuffs, { fightTurns = null } = {}) {
  let multiplier = 1;
  const marginals = [];
  for (const d of debuffs) {
    const rule = DEBUFF_DAMAGE_INTERACTIONS[d.tag];
    if (!rule || !rule.affects.includes(source)) continue;
    const nominal = NOMINAL_MULT[rule.magnitude] ?? 1;
    // Reliability scales the lift toward 1× when a debuff lands rarely / briefly. Unknown
    // reliability → damped to a conservative 0.5 rather than full credit (never overvalue).
    const rel = reliabilityFactor({ ...d.meta, fightTurns });
    const relFactor = rel.factor != null ? rel.factor : 0.5;
    const effLift = (nominal - 1) * relFactor;        // e.g. 0.5 lift × 0.6 reliable = 0.3
    multiplier *= (1 + effLift);
    marginals.push({ owner: d.owner, tag: d.tag, effLift, reliabilityConfidence: rel.confidence });
  }
  // Distribute (multiplier-1) across contributors proportional to their marginal lift.
  const totalLift = multiplier - 1;
  const sumEff = marginals.reduce((s, m) => s + m.effLift, 0) || 1;
  const attribution = marginals.map(m => ({ owner: m.owner, tag: m.tag, lift: totalLift * (m.effLift / sumEff), reliabilityConfidence: m.reliabilityConfidence }));
  return { multiplier, attribution };
}

/**
 * Full contribution pass. Attributes debuff-multiplier lift and granted survival back to
 * the supports that provide them.
 * @param {Array} team champions with { name, tags[], atk, crit_rate, crit_dmg, spd,
 *   damage_multiplier_score, has_boss_mastery, debuffMeta?, sustainPerTurn? }
 * @param {object} opts { bossHp, fightTurns?, incomingDamagePerTurn?, budgetTurns? }
 * @returns per-champion contribution + team kill/survival/confidence.
 */
export function computeContributions(team = [], opts = {}) {
  const {
    bossHp = 0,
    incomingDamagePerTurn = null,
    budgetTurns = DEFAULT_BUDGET_TURNS,
  } = opts;

  const spdSum = team.reduce((s, c) => s + (c.spd ?? 0), 0) || 1;
  const fightTurns = opts.fightTurns ?? budgetTurns;
  const debuffs = teamMultiplierDebuffs(team);

  // Per-source effective multiplier + attribution, computed once for the team.
  const SOURCES = ['attack', 'poison', 'hp_burn', 'warmaster', 'enemy_maxhp'];
  const srcMult = {};
  for (const s of SOURCES) srcMult[s] = sourceMultiplier(s, debuffs, { fightTurns });

  // Own damage per champion (carrier credit = base output at 1×), plus the team total of
  // each source's BASE output so we can attribute the multiplier lift proportionally.
  const rows = team.map(c => {
    const turns = fightTurns * (c.spd ?? 0) / spdSum;
    const perTurn = championPerTurnBySource(c, { bossHp });
    const bySource = {};
    let ownDamage = 0;
    for (const [s, v] of Object.entries(perTurn)) {
      const base = v * turns;                 // this champ's own output at 1× (no team debuffs)
      bySource[s] = base;
      ownDamage += base;
    }
    return { name: c.name, turns, bySource, ownDamage, grantedDamage: 0, grantedSurvival: 0, notes: [] };
  });

  // Team base output per source (for proportional attribution of the multiplier lift).
  const baseBySource = {};
  for (const r of rows) for (const [s, base] of Object.entries(r.bySource)) baseBySource[s] = (baseBySource[s] ?? 0) + base;

  // Amplified team damage + credit the multiplier lift to the debuff owners.
  let teamDamage = 0;
  for (const s of SOURCES) {
    const base = baseBySource[s] ?? 0;
    if (base <= 0) continue;
    const { multiplier, attribution } = srcMult[s];
    teamDamage += base * multiplier;
    const lift = base * (multiplier - 1); // extra damage created by team debuffs on this source
    for (const a of attribution) {
      const owner = rows.find(r => r.name === a.owner);
      if (owner) owner.grantedDamage += lift * (a.lift / ((multiplier - 1) || 1));
    }
  }
  // Carriers keep their own base; supports get the granted lift. (Carriers' own output is
  // already in teamDamage via base; the lift above is the added multiplier portion.)

  // ── TEAM-TURN MULTIPLIER (§3b) — speed / turn-meter buffs give the whole team more
  //    turns → multiply EVERY per-turn source, exactly like survival extension (§3). The
  //    granted throughput is attributed back to the buffer(s), so a pure speed-support
  //    (own damage ~0) stops reading as a ~0 contributor. Presence-based (buffs refresh). ──
  const turn = teamTurnMultiplier(team);
  if (turn.lift > 0 && teamDamage > 0) {
    const liftDamage = teamDamage * turn.lift;   // extra output unlocked by the added turns
    teamDamage += liftDamage;
    // Split liftDamage across the turn-buff tags (proportional to their nominal lift),
    // then equally among each tag's providers.
    const liftSum = Object.keys(turn.providers).reduce((s, t) => s + (TURN_MULTIPLIER_TAGS[t] ?? 0), 0) || 1;
    for (const [tag, owners] of Object.entries(turn.providers)) {
      const tagShare = ((TURN_MULTIPLIER_TAGS[tag] ?? 0) / liftSum) * liftDamage;
      for (const owner of owners) {
        const row = rows.find(r => r.name === owner);
        if (row) { row.grantedDamage += tagShare / owners.length; row.notes.push(`+turns via ${tag}`); }
      }
    }
  }

  // ── Survival side (two-sided confidence). Needs incoming damage per stage — a KNOWN
  //    data gap. When absent, survival is unmeasured and the confidence is kill-speed-only
  //    with a data warning; supports still get granted-survival credit from any estimate. ──
  const teamSustainPerTurn = team.reduce((s, c) => s + (c.sustainPerTurn ?? 0), 0);
  let survivalTurns = null, dataWarning = null;
  if (incomingDamagePerTurn != null && incomingDamagePerTurn > 0) {
    const teamPool = team.reduce((s, c) => s + (c.hp ?? 0), 0);
    const netDrain = Math.max(1e-6, incomingDamagePerTurn - teamSustainPerTurn);
    survivalTurns = teamPool / netDrain;
    // Credit each sustainer for the survival turns they add (multiplicative sustain, §3):
    // Δturns from their heal × team per-turn output = damage they unlock. BUT surviving
    // PAST the kill point (or the time budget) unlocks no extra damage, so cap the useful
    // turns at when the boss dies. A sustainer that only prolongs an already-won fight adds
    // little; one that gets a too-fragile team to the kill is critical.
    const teamPerTurn = teamDamage / fightTurns;
    const cap = Math.min(teamPerTurn > 0 ? bossHp / teamPerTurn : Infinity, budgetTurns);
    for (const c of team) {
      if (!(c.sustainPerTurn > 0)) continue;
      const withoutDrain = Math.max(1e-6, incomingDamagePerTurn - (teamSustainPerTurn - c.sustainPerTurn));
      const survWithout = teamPool / withoutDrain;
      const usefulDelta = Math.max(0, Math.min(survivalTurns, cap) - Math.min(survWithout, cap));
      const row = rows.find(r => r.name === c.name);
      if (row && SUSTAIN_IS_MULTIPLICATIVE) row.grantedSurvival += usefulDelta * teamPerTurn;
    }
  } else {
    dataWarning = 'incoming-damage-per-stage not available — survival side estimated; confidence is kill-speed-only.';
  }

  // Two-sided confidence: kill the boss before you die, within the time budget.
  const killTurns = teamDamage > 0 ? bossHp / (teamDamage / fightTurns) : Infinity;
  const confidence = twoSidedConfidence({ killTurns, survivalTurns, budgetTurns });

  // Final per-champ contribution + shares.
  for (const r of rows) r.contribution = r.ownDamage + r.grantedDamage + r.grantedSurvival;
  const contribTotal = rows.reduce((s, r) => s + r.contribution, 0) || 1;
  for (const r of rows) r.share = r.contribution / contribTotal;
  rows.sort((a, b) => b.contribution - a.contribution);

  return {
    perChampion: rows,
    teamDamage,
    killTurns,
    survivalTurns,
    budgetTurns,
    confidence,
    dataWarning,
  };
}

/**
 * P(clear) ≈ kill before death AND within the time budget. Nominal logistic on the
 * margin between when you kill and the earlier of (death, budget). Calibrate later.
 */
export function twoSidedConfidence({ killTurns, survivalTurns, budgetTurns = DEFAULT_BUDGET_TURNS }) {
  if (!isFinite(killTurns)) return 0;
  const deadline = survivalTurns != null ? Math.min(survivalTurns, budgetTurns) : budgetTurns;
  const margin = (deadline - killTurns) / Math.max(1, deadline); // >0 = clears with room
  const p = 1 / (1 + Math.exp(-6 * margin));                      // nominal slope
  return Math.round(Math.max(0, Math.min(1, p)) * 100) / 100;
}
