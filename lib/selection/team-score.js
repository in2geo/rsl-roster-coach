// lib/selection/team-score.js — Archetype Selector Stage 6: value champions by their CONTRIBUTION to the
// Clan Boss objective (banked damage + survival), NOT by the archetype's named functions alone.
//
// WHY THIS EXISTS (Mike, 2026-08-06): "I don't want to mandate anything. He should be selected because
// he SHOULD be selected." The archetype (poison-sustain) defines the team's SHAPE — it must have a DoT
// engine, survival, a stun plan (the coherence gate: feasibility + validator). But WITHIN that shape,
// champions must be valued by their FULL contribution to winning, so a dominant multi-role champ surfaces
// on merit rather than being benched because his best capabilities (direct damage, Ally Attack) aren't
// the archetype's named "poison functions." No forced anchors.
//
// CB is a banked-damage race + a survival race. `champValue` credits every capability that moves either:
// DoT and direct damage BOTH bank damage; Ally Attack multiplies the team's procs; survival extends the
// fight (which multiplies every DoT tick). coverage already folds in buildScale, so a maxed multi-role
// champ scores high automatically.
//
// These weights are COARSE and CB-poison-oriented — their ONLY job is to prune to the ~20 finalists and
// order spare-seat fill so the strongest champ isn't invisible. The SIM (lib/sim/clan_boss.js) is the
// real arbiter of value; do NOT over-tune these (MODEL_AS_REIMPLEMENTATION.md: implement, don't fit).

export const CB_VALUE_WEIGHTS = {
  // DAMAGE it banks (DoT dominant; direct still counts via Warmaster/multi-hit %maxHP; Ally Attack
  // multiplies the whole team's hits & procs).
  poison: 1.0, hpBurn: 1.0, poisonCloud: 0.8, necrosis: 0.8, poisonExplosion: 0.7, enemyMaxHpDamage: 0.6,
  directDamage: 0.5, allyAttack: 0.7, reflectDamage: 0.2, counterattack: 0.2,
  // AMPLIFICATION: DoT-amp is valued; attack-amp (Decrease DEF) is nearly worthless on DEF-independent
  // poison, so it is weighted LOW here (damage-mechanics §1).
  poisonSensitivity: 0.8, poisonActivation: 0.8, poisonExtension: 0.6, weaken: 0.4,
  decreaseDef: 0.2, increaseAtk: 0.25, increaseCRate: 0.2, increaseCDmg: 0.2, increaseAcc: 0.3,
  // SURVIVAL: extends the fight → multiplies DoT (damage-mechanics §3).
  healing: 0.7, continuousHeal: 0.7, leech: 0.6, revive: 0.6, allyProtection: 0.6, shield: 0.5,
  increaseDefense: 0.4, blockDamage: 0.4, unkillable: 0.5, decreaseAtk: 0.6, magmaShield: 0.4,
  intercept: 0.3, painLink: 0.3, stoneSkin: 0.3,
  // CONTROL / TEMPO: keeps the team going (more turns = more DoT); stun-plan defends the race.
  cleanse: 0.4, blockDebuffs: 0.4, increaseSpeed: 0.4, increaseTurnMeter: 0.4, fervor: 0.3, taunt: 0.3,
  decreaseSpeed: 0.2, decreaseAcc: 0.2, decreaseCRate: 0.2, decreaseCDmg: 0.2, fatigue: 0.2, increaseRes: 0.2,
};

const DEFAULT_WEIGHT = 0.1;   // any capability contributes a little

/** A champion's coarse contribution value to the CB objective. coverage already folds in buildScale. */
export function champValue(profile, weights = CB_VALUE_WEIGHTS) {
  let v = 0;
  for (const cap in (profile || {})) v += (profile[cap].coverage || 0) * (weights[cap] ?? DEFAULT_WEIGHT);
  return v;
}

/** Coarse team score for pruning to finalists: sum of member contribution values. Coherence (the archetype
 *  functions + survival budget) is already GATED by the generator/validator, so ranking is pure value. */
export function teamValue(memberNames, profileByName, weights = CB_VALUE_WEIGHTS) {
  return memberNames.reduce((s, n) => s + champValue(profileByName[n], weights), 0);
}
