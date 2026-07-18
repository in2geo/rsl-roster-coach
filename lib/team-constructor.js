// team-constructor.js — SHADOW phase/add-aware marginal team builder (Layer 3, NOT live).
//
// Everything in the insights ledger, made into code: a team is built by MARGINAL contribution
// to the team-so-far, satisfying EVERY phase's needs (wave-clear, boss-add-control, boss-damage,
// survival, turn-denial), shaped 1–2 damage + varied supports (INS-0006), aura-anchored
// (INS-0005). The needs come straight from the DB goals — the content already encodes per-phase
// roles + solution tags (verified 2026-07-15), so we READ them rather than guess.
//
// STATUS: shadow only. It does NOT drive the live recommendation. It logs its team + leader +
// coverage vs the coverage engine and (eventually) reality, to generate the validation the
// Layer 3 gate demands. Magnitudes nominal. See knowledge/insights-ledger.md INS-0004..0007.

import { controlStrength, sustainContribution } from './sustain-profiles.js';
import { TAG_TO_SOURCE, TURN_MULTIPLIER_TAGS, DEBUFF_DAMAGE_INTERACTIONS } from './damage-mechanics.js';
import { detectSynergies } from './synergies.js';

// ── ROLE classification — what KIND of need a goal is, from its solution tags. Drives
//    saturation grouping (INS-0006: utility saturates fast within a role; damage doesn't). ──
const ROLE_BY_TAG = {};
const reg = (role, tags) => tags.forEach(t => (ROLE_BY_TAG[t] = role));
reg('boss_damage', ['Poison', 'HP Burn', 'Enemy Max HP Damage', 'Poison Explosion']);
reg('wave_or_add', ['AoE Damage', 'AoE Stun', 'AoE Freeze', 'AoE Sleep', 'AoE Decrease Turn Meter',
  'AoE Decrease Turn Meter (Resistible)', 'Block Revive', 'AoE Decrease Defense']);
reg('turn_denial', ['Decrease Turn Meter', 'Decrease Speed']);
reg('debuff_amp', ['Decrease Defense', 'Weaken', 'Poison Sensitivity', 'Increase Attack']);
reg('sustain', ['Healer', 'Continuous Heal', 'AoE Heal', 'AoE Shield', 'Shield', 'Ally Protection',
  'Block Debuffs', 'Cleanse', 'Revive', 'Leech', 'Decrease Attack']);

// Damage is the OBJECTIVE (kill-speed), not a saturating utility — its need weight stays high
// for the first 1–2 and only then eases; every other role saturates fast after the first cover.
const DAMAGE_ROLES = new Set(['boss_damage']);

/** Classify a goal by the dominant role across its solution tags. */
function goalRole(solutions) {
  const counts = {};
  for (const sol of solutions) for (const tag of sol) {
    const r = ROLE_BY_TAG[tag]; if (r) counts[r] = (counts[r] ?? 0) + 1;
  }
  let best = 'other', n = 0;
  for (const [r, c] of Object.entries(counts)) if (c > n) { best = r; n = c; }
  return best;
}

/**
 * Turn a stage's phases+goals into structured NEEDS the constructor must satisfy.
 * @param {Array} phaseGoals [{ phase_type, goals:[{ description, is_informational,
 *   goal_solutions:[{status, goal_solution_tags:[{tags:{name}}]}] }] }]
 * @returns {Array} needs [{ phase, role, description, solutions:[[tag]], weight }]
 */
export function deriveNeeds(phaseGoals = []) {
  const needs = [];
  for (const ph of phaseGoals) {
    for (const g of ph.goals ?? []) {
      if (g.is_informational) continue;
      const sols = (g.goal_solutions ?? [])
        .filter(s => s.status === 'approved')
        .map(s => (s.goal_solution_tags ?? []).map(t => t.tags.name).filter(Boolean))
        .filter(a => a.length);
      if (!sols.length) continue; // skeleton goal — not an actionable need
      const role = goalRole(sols);
      // Wave-phase clear + boss survival/damage are the load-bearing needs; weight them up.
      const weight = ph.phase_type === 'wave' ? 1.2 : 1.0;
      needs.push({ phase: ph.phase_type, role, description: g.description, solutions: sols, weight });
    }
  }
  return needs;
}

/** Does a champ satisfy this need (all tags of ANY one solution)? Returns the matched solution or null. */
function matchedSolution(champ, need) {
  const tags = new Set(champ.tags ?? []);
  return need.solutions.find(sol => sol.every(t => tags.has(t))) ?? null;
}
function championCovers(champ, need) { return matchedSolution(champ, need) != null; }

// A solution is ACC-GATED if it relies on a debuff that must LAND (is_debuff and does NOT bypass the
// accuracy check). Raw AoE Damage, heals, shields, and "bypasses ACC" effects always apply → reliability 1.
function solutionAccGated(sol, tagMeta) {
  return sol.some(t => { const m = tagMeta?.[t]; return m && m.is_debuff && !m.bypasses_accuracy_check; });
}

/**
 * How reliably this champ actually DELIVERS its coverage of `need` (INS-0008). For an ACC-gated
 * solution, coverage only counts as much as the debuff LANDS: champ ACC vs the stage ACC floor.
 * `assumeBuilt` (potential layer) treats the champ as reaching the floor — "if you build them".
 */
function accReliability(champ, { accFloor, assumeBuilt = false } = {}) {
  if (!accFloor) return 1;
  if (assumeBuilt) return 1;                            // potential: assume built to the floor
  const acc = champ.estimated_stats?.acc ?? champ.acc ?? 0;
  return Math.max(0.15, Math.min(1, acc / accFloor));  // linear ramp to the floor
}
// Reliability of the champ's BEST covering method for this need (not the first-listed). A champ who
// can clear via raw AoE (always lands) is fully reliable even if they also carry an ACC-gated CC.
function coverageReliability(champ, need, opts = {}) {
  const tags = new Set(champ.tags ?? []);
  const matching = need.solutions.filter(sol => sol.every(t => tags.has(t)));
  if (!matching.length) return 0;
  let best = 0;
  for (const sol of matching) best = Math.max(best, solutionAccGated(sol, opts.tagMeta) ? accReliability(champ, opts) : 1);
  return best;
}

// SYNERGY BONUS (Mike, 2026-07-18): a combo is emergent value that per-champion scoring cannot see —
// `lib/synergies.js` already DETECTS combos, but every call site ran it on the FINISHED team, so it
// only ever narrated a synergy after the fact and never caused one to be seated. This is that wire.
//
// THE RULE: credit a candidate for the synergies their arrival NEWLY ACTIVATES against the champions
// ALREADY SEATED. Deliberately not speculative — we do not credit a combo with someone still in the
// pool who may never take a seat. Mike's framing: once Xenomorph is seated on his own merits, an L50
// Ezio can outrank an L60 nuker, because the poison-activation engine he completes is worth more to
// the TEAM than the raw damage gap between the two individuals.
//
// SCALE (INS-0013 — over-weighting a per-champ term relocates errors rather than fixing them): a
// `high` synergy is worth about one mid-weight role. That is enough to overturn a development/quality
// gap (qualityFn spans ~0.3) — which is the whole point of Mike's example — while staying below fresh
// coverage of a load-bearing role (mitigation 1.5, boss_damage 1.2), so a combo can never leave the
// team without a mitigator.
const SYNERGY_MAGNITUDE = { high: 1.0, medium: 0.6, low: 0.3 };

function synergyBonus(champ, team, opts) {
  if (!opts.synergyWeight) return 0;                     // OFF by default — dungeon path unchanged
  if (!team.length) return 0;                            // nothing seated yet = nothing to combo with
  const before = new Set(detectSynergies(team).map(s => s.id));
  let v = 0;
  for (const s of detectSynergies([...team, champ])) {
    if (!before.has(s.id)) v += SYNERGY_MAGNITUDE[s.magnitude] ?? SYNERGY_MAGNITUDE.medium;
  }
  return opts.synergyWeight * v;
}

/** Small intrinsic contribution magnitude (secondary to need-coverage): DoT/attack + control + sustain. */
function magnitude(champ, contentKey) {
  let m = 0;
  const srcs = new Set((champ.tags ?? []).map(t => TAG_TO_SOURCE[t]).filter(Boolean));
  if (srcs.has('poison') || srcs.has('hp_burn') || srcs.has('enemy_maxhp')) m += 0.6;
  if (srcs.has('attack')) m += 0.2 + 0.1 * (champ.damage_multiplier_score ?? 0);
  m += 0.4 * controlStrength(champ.tags ?? []);
  m += 0.3 * Math.min(1, sustainContribution(champ.tags ?? [], contentKey).score / 4);
  for (const t of (champ.tags ?? [])) if (TURN_MULTIPLIER_TAGS[t]) m += TURN_MULTIPLIER_TAGS[t];
  return m;
}

// Saturation: after a need's role is covered on the team, a further cover is worth this much.
// Utility falls off fast (INS-0006); damage stays valuable for the 2nd, eases after.
function saturationFactor(role, timesCovered) {
  if (DAMAGE_ROLES.has(role)) return timesCovered === 0 ? 1 : timesCovered === 1 ? 0.7 : 0.25;
  return timesCovered === 0 ? 1 : timesCovered === 1 ? 0.25 : 0.05;
}

/**
 * Marginal value of adding `champ` to `team`, given the needs and what roles are already covered.
 * = Σ over needs the champ covers of (weight × saturation for that need's role) + small magnitude.
 */
function marginalValue(champ, team, needs, roleCoverCount, opts) {
  let v = 0;
  for (const need of needs) {
    const rel = coverageReliability(champ, need, opts); // 0 if not covered
    if (rel <= 0) continue;
    v += need.weight * saturationFactor(need.role, roleCoverCount[need.role] ?? 0) * rel;
  }
  v += 0.15 * magnitude(champ, opts.contentKey); // magnitude is a tiebreaker, not the driver
  // Optional, content-supplied QUALITY tiebreaker (build + content-specific investment, e.g. CB
  // masteries). Absent by default, so the dungeon path is unchanged; it only breaks REDUNDANT-
  // coverage ties toward the better-built champ — the fix for a maxed champ losing a seat to an
  // under-built one that merely touches one more already-covered need. Kept tiebreaker-scale so it
  // never overrides fresh coverage (INS-0013: over-weighting a per-champ term relocates errors).
  if (opts.qualityFn) v += opts.qualityFn(champ);
  v += synergyBonus(champ, team, opts); // combos this addition completes with the already-seated
  return v;
}

/**
 * Build a team of `size` by marginal contribution. `eligible(champ)` gates the candidate pool —
 * pass a usability gate for the REALIZED team, or `()=>true` to consider everyone (potential).
 * @returns {{ team, leader, needCoverage, roleCoverCount }}
 */
export function constructTeam(roster = [], needs = [], { contentKey, size = 5, eligible = () => true, tagMeta = {}, accFloor = null, qualityFn = null, synergyWeight = 0 } = {}) {
  const opts = { contentKey, tagMeta, accFloor, qualityFn, synergyWeight }; // built team scored at CURRENT reliability
  const pool = roster.filter(eligible);
  const team = [];
  const roleCoverCount = {};
  while (team.length < size && pool.length) {
    let best = null, bestV = -Infinity;
    for (const c of pool) {
      if (team.includes(c)) continue;
      const v = marginalValue(c, team, needs, roleCoverCount, opts);
      if (v > bestV) { bestV = v; best = c; }
    }
    if (!best) break;
    team.push(best);
    pool.splice(pool.indexOf(best), 1);
    for (const need of needs) if (championCovers(best, need)) roleCoverCount[need.role] = (roleCoverCount[need.role] ?? 0) + 1;
  }
  // Which needs the final team covers, and by whom.
  const needCoverage = needs.map(need => ({
    phase: need.phase, role: need.role, description: need.description,
    covered_by: team.filter(c => championCovers(c, need)).map(c => c.name),
  }));
  const leader = pickLeader(team, contentKey);
  return { team, leader, needCoverage, roleCoverCount };
}

// Aura anchor (INS-0005): best content-relevant aura among the fielded (best-among-fielded / marginal).
// SPD default; ACC would win when below the debuff floor — deferred until floor-reading is wired.
function pickLeader(team, contentKey) {
  const withAura = team.map(c => ({ name: c.name, spd: auraSpd(c) })).filter(a => a.spd > 0);
  if (!withAura.length) return null;
  withAura.sort((a, b) => b.spd - a.spd);
  return { name: withAura[0].name, aura: `${withAura[0].spd}% SPD`, reason: 'best SPD aura among fielded' };
}
const auraSpd = (c) => {
  const a = (c.auras ?? []).find(x => /^SPD/i.test(x.aura_type ?? x) && /all battles|dungeon/i.test(x.aura_area ?? x));
  if (!a) return 0;
  return Number(String(a.aura_value ?? a).replace(/[^0-9.]/g, '')) || 0;
};

// Role-relevant STRENGTH a champ brings to a need — so "covered" can be graded, not binary.
// wave/add needs care about lockdown/clear STRENGTH (a dedicated AoE-CC/AoE champ >> an incidental
// AoE tag); boss_damage cares about DoT/attack magnitude. Other roles saturate binary (INS-0006).
const UPGRADE_ROLES = new Set(['wave_or_add', 'boss_damage']);
// Role-relevant strength × how RELIABLY the champ delivers it (INS-0008). `assumeBuilt` evaluates an
// unbuilt candidate at its potential; built coverers are scored at current reliability.
function needStrength(champ, need, opts) {
  if (coverageReliability(champ, need, opts) <= 0) return 0; // doesn't cover at all
  if (need.role === 'wave_or_add') {
    // Two independent methods; take the champ's best. CLEAR (raw AoE, always lands) vs LOCK
    // (AoE-CC, ACC-gated). A dedicated CC-lock (Criodan) beats incidental AoE once ACC bites.
    const clear = (champ.tags ?? []).includes('AoE Damage') ? 0.5 : 0;
    const lock = controlStrength(champ.tags ?? []) * accReliability(champ, opts);
    return Math.max(clear, lock);
  }
  if (need.role === 'boss_damage') return magnitude(champ, opts.contentKey) * coverageReliability(champ, need, opts);
  return 0.5 * coverageReliability(champ, need, opts); // sustain/debuff/turn — presence, reliability-weighted
}

/**
 * POTENTIAL layer (INS-0007 two-layer): among UNBUILT champs, which would fill a need the built team
 * leaves UNCOVERED, or — the key refinement — cover a load-bearing wave/damage need substantially
 * BETTER than the built team's best coverer (binary "covered" hides the Criodan-vs-incidental-AoE gap).
 * @returns Array<{ name, built:false, fills:[{description, role, phase, kind:'uncovered'|'upgrade', builtBest, strength}] }>
 */
export function potentialBuilds(roster = [], needs = [], builtTeam = [], { isBuilt = () => true, contentKey, upgradeMargin = 1.3, tagMeta = {}, accFloor = null } = {}) {
  const builtOpts = { contentKey, tagMeta, accFloor };                  // built team at CURRENT reliability
  const potOpts = { contentKey, tagMeta, accFloor, assumeBuilt: true }; // candidates at POTENTIAL (if built)
  // Built team's best role-strength per need (current reliability — an unreliable Stun scores low).
  const builtBest = needs.map(need => Math.max(0, ...builtTeam.filter(c => championCovers(c, need)).map(c => needStrength(c, need, builtOpts))));
  const out = [];
  for (const c of roster) {
    if (isBuilt(c)) continue; // only UNBUILT champs are "build next" candidates
    const fills = [];
    needs.forEach((need, i) => {
      if (!championCovers(c, need)) return;
      const s = needStrength(c, need, potOpts);
      if (builtBest[i] === 0) fills.push({ ...needTag(need), kind: 'uncovered', builtBest: 0, strength: round2(s) });
      else if (UPGRADE_ROLES.has(need.role) && s > builtBest[i] * upgradeMargin)
        fills.push({ ...needTag(need), kind: 'upgrade', builtBest: round2(builtBest[i]), strength: round2(s) });
    });
    if (fills.length) out.push({ name: c.name, built: false, fills });
  }
  // Rank by uncovered fills first, then upgrades, then breadth.
  const score = (p) => p.fills.reduce((s, f) => s + (f.kind === 'uncovered' ? 2 : 1), 0);
  out.sort((a, b) => score(b) - score(a));
  return out;
}
const needTag = (n) => ({ description: n.description, role: n.role, phase: n.phase });
const round2 = (x) => Math.round(x * 100) / 100;
