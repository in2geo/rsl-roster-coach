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
// ⚠ CB CORRECTION 2026-08-05: on the Demon Lord, Infernal Resilience CAPS each Poison / HP Burn tick
// at an ABSOLUTE per-difficulty value (see CB_POISON_CAPS / CB_HP_BURN_TICK below). The cap ALWAYS binds
// — 2.5% of even Easy's 19M HP is ~475k vs a 10k cap — so `poison`/`hp_burn` as %maxHP OVER-estimates
// hugely at high tiers. estimateCbDamage still uses these coeffs (backward-compat); wiring the caps in
// (thread `difficulty`, replace the poison/hp_burn terms with the absolute tick × ticks, re-fit
// calibration via cb-model-validate) is the measured NEXT step.
// ⚠ Warmaster / Giant Slayer are ALSO capped on the Demon Lord (confirmed 2026-08-05 — NOT exempt): a WM
// proc and a GS proc deal the SAME capped base, so `warmaster` as 4%×60% maxHP is likewise wrong for CB —
// use cbMasteryProcs() (below) × the capped per-proc value, not a %maxHP coefficient.
export const SOURCE_COEFF = {
  poison:      0.025, // ~2.5% MAX HP per stack per turn — CB: superseded by CB_POISON_CAPS (absolute)
  hp_burn:     0.025, //                                   CB: superseded by CB_HP_BURN_TICK  (absolute)
  warmaster:   0.024, // Warmaster / Giant Slayer: 4% MAX HP × 60% proc
  enemy_maxhp: 0.05,  // a skill that deals a % of enemy MAX HP
};

// ── Demon Lord absolute DoT caps (Infernal Resilience) ────────────────────────
// Per-difficulty, per-Poison-STRENGTH absolute cap on each Poison tick. A CB Poison tick equals the cap
// (rarity-INDEPENDENT); a 2.5% poison deals exactly half the 5% value. Poison Sensitivity multiplies
// AFTER the cap: tick = cap × (1 + poisonSensitivity). See cbPoisonTick().
export const CB_POISON_CAPS = {
  Easy:              { '2.5': 10000, '5': 20000 },
  Normal:            { '2.5': 15000, '5': 30000 },
  Hard:              { '2.5': 20000, '5': 40000 },
  Brutal:            { '2.5': 25000, '5': 50000 },
  Nightmare:         { '2.5': 25000, '5': 50000 },
  'Ultra Nightmare': { '2.5': 25000, '5': 50000 },
};
// Provenance — keep the distinction so we never imply Plarium published the whole table:
//   Brutal/NM/UNM (25k/50k) + the 5% progression (20k→30k→40k→50k) = OBSERVED in-game.
//   Easy/Normal/Hard = COMMUNITY_OBSERVED (not officially published).
export const CB_POISON_CAP_PROVENANCE = {
  Easy: 'community_observed', Normal: 'community_observed', Hard: 'community_observed',
  Brutal: 'observed', Nightmare: 'observed', 'Ultra Nightmare': 'observed',
};

// HP Burn tick on the boss is a FLAT absolute by PLACER RARITY, and only ONE HP Burn can exist on the
// boss at a time (not stackable). Source: AyumiLove HP Burn reference.
export const CB_HP_BURN_TICK = { rare: 50000, epicPlus: 75000 };

/** A CB Poison tick = difficulty cap × (1 + poisonSensitivity). strength '2.5' | '5'. Rarity-independent. */
export function cbPoisonTick(difficulty, strength = '2.5', poisonSensitivity = 0) {
  const cap = CB_POISON_CAPS[difficulty]?.[String(strength)];
  return cap == null ? null : cap * (1 + Number(poisonSensitivity || 0));
}

/** A CB HP Burn tick by placer rarity (Rare → 50k; Epic/Legendary/Mythical → 75k). Only one at a time. */
export function cbHpBurnTick(placerRarity) {
  return /^rare$/i.test(String(placerRarity ?? '')) ? CB_HP_BURN_TICK.rare : CB_HP_BURN_TICK.epicPlus;
}

// ── Demon Lord mastery caps (Warmaster / Giant Slayer) ────────────────────────
// The enemy-MAX-HP cap ALSO applies to the mastery procs (confirmed 2026-08-05 — NOT exempt), so
// Warmaster's nominal 4% / Giant Slayer's 3% of boss MaxHP do NOT land: a single WM proc and a single
// GS proc deal the SAME capped base. Weighting is therefore about PROC COUNT, not %maxHP:
//   Warmaster    procs once per SKILL  at ~60%  → 0.60 expected procs/skill (hit-count INDEPENDENT)
//   Giant Slayer procs once per HIT    at ~30%  → hitCount × 0.30 expected procs/skill
// So GS ties WM at a 2-hit A1 and overtakes at 3-4 hits — the basis for the WM(1-2) / GS(3-4) rule.
// ⚠ The absolute capped damage PER PROC per difficulty is not yet in hand (needed for absolute totals; the
// proc counts already settle the WM-vs-GS comparison and the mastery weighting).
export const CB_MASTERY_PROC = { warmasterPerSkill: 0.60, giantSlayerPerHit: 0.30 };
export function cbMasteryProcs(mastery, hitCount = 1) {
  return /giant/i.test(String(mastery ?? ''))
    ? Number(hitCount || 1) * CB_MASTERY_PROC.giantSlayerPerHit
    : CB_MASTERY_PROC.warmasterPerSkill;
}

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
