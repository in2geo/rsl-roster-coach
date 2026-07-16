// ── lib/gear-tier.js ─────────────────────────────────────────────────────────
// GEAR-TIER RECONCILIATION — the stat-side twin of run_reconciliations.
//
// THE PRINCIPLE (Mike, 2026-07-16): gear tier is an ACCOUNT-level property. Gear
// swaps between champions for free, so "good gear" means the account OWNS ~5 sets
// at that level and can put them on WHICHEVER champions the model recommends. The
// engine therefore applies a tier multiplier to the recommended champs' BASE stats
// (see estimate-stats.js GEAR_TIERS) rather than reading each champ's current gear.
//
// THIS MODULE is the post-battle CHECK that keeps that model honest. From a Gestal
// snapshot it does three things:
//   1. GRADE every champ's actual equipped gear → a tier (starter/fair/good/endgame),
//      derived from the artifacts' rank (stars) + enhance level. No manual labeling.
//   2. Derive the ACCOUNT CEILING tier = the highest tier at which the account owns a
//      full team's worth (~5) of gear. That is the tier the model should assume.
//   3. When a battle names the champs that actually FOUGHT, flag any fielded champ
//      whose current gear is BELOW the account ceiling — i.e. the recommendation's
//      promise ("field this in your good gear") wasn't met, so the prediction was
//      optimistic. This is the exact mechanism behind the "FK Stage 1" bug: Ninja
//      fought in starter-grade gear while the account tier is good.
//
// It also emits CALIBRATION samples: each graded champ is a labeled measurement of
// what its tier's gear actually adds (base → effective, via effectiveStats). Fitting
// these replaces the placeholder GEAR_TIERS numbers with real, continuously-updated
// per-tier multipliers.
//
// Anchors (Mike): 5★ +16 = good · 6★ +16 = endgame · 5★ +12 = fair.

import { effectiveStats } from './effective-stats.js';

export const TIER_ORDER = ['starter', 'fair', 'good', 'endgame'];
const tierRank = (t) => TIER_ORDER.indexOf(t);

// A champ's gear grade = the first tier whose (rank, level) floor it meets, tested
// high→low. rank = median artifact star level (1-6); level = median enhance (+0..+16).
// Tunable — pass a custom list to gradeChampGear() to re-anchor.
export const GRADE_THRESHOLDS = [
  { tier: 'endgame', minRank: 6, minLevel: 16 },
  { tier: 'good',    minRank: 5, minLevel: 16 },
  { tier: 'fair',    minRank: 5, minLevel: 12 },
  { tier: 'starter', minRank: 0, minLevel: 0  },
];

const median = (arr) => {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};
const pctile = (arr, p) => {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(s.length * p))];
};

/**
 * Grade one champion's currently-equipped gear.
 * @returns {{tier:string|null, rank:number, level:number, pieces:number, partial:boolean}}
 *   tier=null when the champ has too little gear to grade (<4 pieces).
 */
export function gradeChampGear(champ, thresholds = GRADE_THRESHOLDS) {
  const arts = (champ?.equippedArtifacts ?? []).filter(a => a && (a.rank != null || a.level != null));
  if (arts.length < 4) return { tier: null, rank: 0, level: 0, pieces: arts.length, partial: true };

  const rank  = median(arts.map(a => a.rank  ?? 0));
  const level = median(arts.map(a => a.level ?? 0));
  const tier  = (thresholds.find(t => rank >= t.minRank && level >= t.minLevel) ?? thresholds.at(-1)).tier;
  return { tier, rank, level, pieces: arts.length, partial: arts.length < 6 };
}

/**
 * The account CEILING tier: the highest tier at which the account owns a full team's
 * worth (teamSize) of gear — i.e. can field 5 champs geared at that tier. This is the
 * tier the recommendation engine should assume for a Gestal account.
 * @returns {{tier:string, counts:object, graded:number}}
 *   counts[tier] = # of owned champs graded at that tier OR ABOVE.
 */
export function accountCeilingTier(champions = [], { teamSize = 5, thresholds = GRADE_THRESHOLDS } = {}) {
  const grades = champions
    .filter(c => !c?.inStorage)
    .map(c => gradeChampGear(c, thresholds))
    .filter(g => g.tier);

  const counts = {};
  for (const t of TIER_ORDER) counts[t] = grades.filter(g => tierRank(g.tier) >= tierRank(t)).length;

  let tier = 'starter';
  for (const t of TIER_ORDER) if (counts[t] >= teamSize) tier = t; // highest tier meeting the team floor
  return { tier, counts, graded: grades.length };
}

/**
 * The gear a champ's CURRENT equipment actually contributes, split the way the tier
 * table is: % gain for HP/ATK/DEF, flat points for SPD/ACC/RES, fraction for crit.
 * (base → effective via effectiveStats — real artifact + set + bonusesV2 math.)
 */
export function gearContribution(champ) {
  const base = champ?.baseStats ?? {};
  const { effective } = effectiveStats(champ);
  const pct  = (k) => (base[k] > 0 ? effective[k] / base[k] - 1 : null); // fraction, e.g. 1.0 = +100%
  const flat = (k) => (effective[k] ?? 0) - (base[k] ?? 0);
  return {
    hp: pct('hp'), atk: pct('atk'), def: pct('def'),
    spd: flat('spd'), acc: flat('acc'), res: flat('res'),
    crate: flat('crate') / 100, cdmg: flat('cdmg') / 100, // match GEAR_TIERS fraction units
  };
}

/**
 * Run the full reconciliation over a Gestal snapshot's champion list.
 * @param {object[]} champions - snapshot.champions
 * @param {object}   opts
 *   fieldedHeroIds : ids of the champs that actually fought (from a battle capture) →
 *                    enables the drift check. Accepts numbers or strings.
 *   designations   : optional { heroId: tier } manual overrides of a champ's graded tier.
 *   teamSize       : sets required to call a tier the account ceiling (default 5).
 * @returns {{account, perChamp, samples, fieldedDrift}}
 */
export function reconcileGearTiers(champions = [], { fieldedHeroIds = null, designations = null, teamSize = 5, thresholds = GRADE_THRESHOLDS } = {}) {
  const owned = champions.filter(c => !c?.inStorage);
  const account = accountCeilingTier(owned, { teamSize, thresholds });

  const perChamp = owned
    .map(c => {
      const g = gradeChampGear(c, thresholds);
      return g.tier ? { heroId: c.heroId, name: c.name, ...g } : null;
    })
    .filter(Boolean)
    .sort((a, b) => tierRank(b.tier) - tierRank(a.tier) || b.rank - a.rank || b.level - a.level);

  // Calibration samples: gear contribution grouped by the champ's (designated|graded) tier.
  // Each sample carries the game's own `role` so calibration can be role-aware — gear is
  // role-specific (attackers wear crit/ATK, defenders wear DEF, supports wear HP/SPD/ACC),
  // so a tier's HP/ATK/DEF row is only meaningful measured from champs geared FOR that stat.
  // Skip partially-geared champs — an incomplete set understates the tier.
  const samples = {};
  for (const c of owned) {
    const g = gradeChampGear(c, thresholds);
    if (!g.tier || g.partial) continue;
    const tier = designations?.[c.heroId] ?? g.tier;
    (samples[tier] ??= []).push({ name: c.name, role: c.role ?? null, ...gearContribution(c) });
  }

  // Fielded-drift check: which champs that actually fought are geared below the ceiling?
  let fieldedDrift = null;
  if (fieldedHeroIds?.length) {
    fieldedDrift = [];
    for (const hid of fieldedHeroIds) {
      const c = owned.find(x => String(x.heroId) === String(hid));
      if (!c) continue;
      const g = gradeChampGear(c, thresholds);
      if (g.tier && tierRank(g.tier) < tierRank(account.tier)) {
        fieldedDrift.push({ heroId: hid, name: c.name, fieldedTier: g.tier, accountTier: account.tier, rank: g.rank, level: g.level });
      }
    }
  }

  return { account, perChamp, samples, fieldedDrift };
}

/**
 * Collapse calibration samples into per-tier empirical multipliers. HP/ATK/DEF use the
 * median (representative of any geared champ); the flat point-stats report median AND a
 * high-percentile "role" value, because gear isn't uniform — debuffers carry the ACC,
 * leads carry the SPD. The tier row for the engine should use the role-appropriate value
 * (what a champ has when geared FOR its role), which the account can supply on demand.
 */
export function summarizeCalibration(samples) {
  const roll = (rows) => {
    const col = (k) => rows.map(r => r[k]).filter(v => v != null && Number.isFinite(v));
    return {
      n: rows.length,
      hp:  median(col('hp')),  atk: median(col('atk')), def: median(col('def')),
      spd:   { median: median(col('spd')), role: pctile(col('spd'), 0.9) },
      acc:   { median: median(col('acc')), role: pctile(col('acc'), 0.9) },
      res:   { median: median(col('res')), role: pctile(col('res'), 0.9) },
      crate: median(col('crate')), cdmg: median(col('cdmg')),
    };
  };
  const out = {};
  for (const [tier, rows] of Object.entries(samples)) {
    // byRole: the same rollup split on the game's role, so DEF is read from Defense champs,
    // ATK from Attack champs, etc. — the un-skewed numbers the tier table should actually use.
    const byRole = {};
    for (const r of rows) (byRole[r.role ?? 'Unknown'] ??= []).push(r);
    out[tier] = { ...roll(rows), byRole: Object.fromEntries(Object.entries(byRole).map(([role, rs]) => [role, roll(rs)])) };
  }
  return out;
}
