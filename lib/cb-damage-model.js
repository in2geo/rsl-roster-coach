// cb-damage-model.js — first-pass Clan Boss damage model.
//
// CB damage is dominated by mechanics that scale off the BOSS's MAX HP — Poison, HP Burn,
// Warmaster/Giant Slayer, and skill %-max-HP nukes — plus a smaller ATK-scaling skill-nuke
// component. This estimates each champion's damage SHARE (attribution: who actually carries)
// and, with a per-difficulty calibration scalar that absorbs the unpublished boss DEF/mitigation,
// an absolute total → chest tier.
//
// v1 / HEURISTIC. Coefficients are game-informed nominal %-max-HP-per-turn values; the real
// mitigation is folded into `calibration` (fit against captured damage → clan_boss_stats
// .damage_calibration). Per-hero magnitude is approximate and boss-day/affinity dependent — the
// robust output is the carrier RANKING (who deals the bulk), which is what the explanation and
// the "expected chest tier" need. See masteries-boss-model / cb-damage-estimator-blocked.
//
// DEF-INDEPENDENCE: every source in SOURCE_COEFF below scales off the boss's MAX HP, so it is
// DEF-INDEPENDENT — Decrease DEF / [DEF-ignore] can NEVER boost it (see lib/damage-mechanics.js,
// the authoritative source⇄debuff interaction rules). That is why maxhp_score carries no DEF term.
// Only nuke_score (ATK-vs-DEF) is DEF-dependent; applying a Decrease-DEF multiplier to it is
// contribution-model work (needs team-debuff detection) — intentionally NOT done here yet.

import { damageSourceIgnoresDef } from './damage-mechanics.js';

// Nominal fraction of boss MAX HP per attack-turn, pre-mitigation (calibration scales to reality).
export const SOURCE_COEFF = {
  poison:      0.025, // ~2.5% MAX HP per stack per turn
  hp_burn:     0.025,
  warmaster:   0.024, // Warmaster / Giant Slayer: 4% MAX HP × 60% proc
  enemy_maxhp: 0.05,  // a skill that deals a % of enemy MAX HP
};

// Invariant: every coefficient here must be a DEF-independent (%maxHP) source, or the
// "maxhp_score carries no DEF term" assumption silently breaks. Fails loud if the
// authoritative taxonomy in damage-mechanics.js ever reclassifies one.
for (const src of Object.keys(SOURCE_COEFF)) {
  if (!damageSourceIgnoresDef(src)) {
    throw new Error(`cb-damage-model: SOURCE_COEFF['${src}'] is DEF-dependent per damage-mechanics.js — maxhp_score must not include it.`);
  }
}

// champion_tags that map to a boss-HP-scaling damage source.
const TAG_SOURCE = {
  'Poison': 'poison',
  'HP Burn': 'hp_burn',
  'Enemy Max HP Damage': 'enemy_maxhp',
};

const critFactor = (cr, cd) => 1 + (Number(cr ?? 0) / 100) * (Number(cd ?? 0) / 100);

/**
 * Estimate per-champion Clan Boss damage.
 * @param {Array} team - { name, tags[], has_boss_mastery, atk, crit_rate, crit_dmg, spd, damage_multiplier_score }
 * @param {object} opts - { bossHp, totalTurns?, calibration? }
 *   totalTurns: total ally turns (from a captured run) → per-champ turns split by speed. Omit to
 *   score in relative (speed-proportional) units. calibration: scalar to produce absolute damage.
 * @returns { perChampion:[{name, sources[], maxhp_score, nuke_score, raw, share, damage?}], rawTotal, total? }
 */
export function estimateCbDamage(team, { bossHp, totalTurns = null, calibration = null } = {}) {
  const spdSum = (team ?? []).reduce((s, c) => s + (c.spd ?? 0), 0) || 1;
  const rows = (team ?? []).map(c => {
    const turns = totalTurns != null ? totalTurns * (c.spd ?? 0) / spdSum : (c.spd ?? 0);
    const sources = [];
    let maxhpFrac = 0;
    for (const t of (c.tags ?? [])) {
      const src = TAG_SOURCE[t];
      if (src) { maxhpFrac += SOURCE_COEFF[src]; sources.push(t); }
    }
    if (c.has_boss_mastery) { maxhpFrac += SOURCE_COEFF.warmaster; sources.push('Warmaster'); }
    const maxhp_score = maxhpFrac * bossHp * turns;
    const nuke_score  = (c.damage_multiplier_score ?? 0) * (c.atk ?? 0)
                        * critFactor(c.crit_rate, c.crit_dmg) * turns;
    return { name: c.name, sources, maxhp_score, nuke_score, raw: maxhp_score + nuke_score };
  });
  const rawTotal = rows.reduce((s, r) => s + r.raw, 0) || 1;
  for (const r of rows) r.share = r.raw / rawTotal;
  const out = { perChampion: rows, rawTotal };
  if (calibration != null) {
    out.total = calibration * rawTotal;
    for (const r of rows) r.damage = calibration * r.raw;
  }
  return out;
}

/** Fit the per-difficulty calibration scalar so the model total matches an observed total. */
export function fitCalibration(rawTotal, observedTotal) {
  return rawTotal > 0 ? observedTotal / rawTotal : 1;
}

/** The team's damage carriers (share ≥ threshold), highest first — for grounding the explanation. */
export function carriers(perChampion, threshold = 0.15) {
  return [...perChampion].filter(r => r.share >= threshold).sort((a, b) => b.share - a.share);
}
