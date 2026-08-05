// lib/cb-shadow-goals.js — refined Clan Boss problem/needs definition (SHADOW-ONLY, Side 1).
//
// This is the CB "goals" as we re-derived them from Mike's mechanics (this session), fed to the
// team-constructor's `needs` input INSTEAD of the DB goals — which are the old coarse encoding that
// (a) mislabels Decrease DEF + Weaken as boss_damage, (b) has no generic team-healing need (so
// Duchess is invisible), and (c) lumps Decrease ATK / heals / Cleanse into one `sustain` role that
// the constructor then saturates against itself (benching the Cleanser). NOTHING here touches the
// live DB or the live engine — it's a shadow input only.
//
// Key mechanics encoded (see the CB damage two-lane model):
//   • MITIGATION (Decrease ATK on the boss) is the #1 problem — his AoEs scale off his ATK, and
//     surviving longer multiplies ALL damage. Given its OWN role so it never saturates vs healing.
//   • DAMAGE is two lanes: Lane A = DoT (Poison/HP Burn, DEF-independent, ACC-gated to land);
//     Lane B (mastery + attack) is amplified by Decrease DEF / Weaken — those are AMPS, not damage.
//   • CLEANSE gets its OWN role so the constructor's role-saturation stops treating it as redundant
//     sustain (the bug that benched Donatello). Distinct-role = a goals-layer fix, no engine change.
//   • EXTRA HITS (Counterattack / Ally Attack) multiply Lane B via more Warmaster/GS procs.
//   • AFFINITY (Mike first-party CONFIRMED 2026-08-05):
//     the boss opens each day on VOID (team neutral, easiest to steer his hits); once the clan crosses 50%
//     daily HP it becomes a random Force/Magic/Spirit for the NEXT battle (not mid-fight), so each KEY is a
//     single affinity — SPIRIT (Decrease SPD on your team) is the toughest. These roles are affinity-INDEPENDENT
//     (you build for the affinity you may face); the `cleanse` role carries the affinity-key debuff. WM vs GS
//     is per-champ: A1 hits 1–2× → Warmaster, 3–4× → Giant Slayer.
//
// NOT yet represented (scoring-layer / Side-2 work, deliberately deferred): the Warmaster
// DEF-mitigation magnitude, the masteries build-gate, the Ally-Attack vs Counterattack proc-cadence
// split, and the ~200-220 Brutal+ ACC floor calibration. Those belong in the constructor's scoring.

// One CB needs set (the kit is difficulty-independent; difficulty moves the ACC floor + thresholds,
// passed separately). Each need: { phase, role, description, solutions:[[tag,…], …], weight }.
export const CB_NEEDS = [
  { phase: 'single', role: 'mitigation', weight: 1.5,
    description: 'Land Decrease ATK on the boss — cut his ATK-scaling AoEs (top survival + damage-extender)',
    solutions: [['Decrease Attack']] },

  { phase: 'single', role: 'boss_damage', weight: 1.2,
    description: 'Lane A — stack DoT on the boss (Poison / HP Burn: DEF-independent, the core damage engine)',
    solutions: [['Poison'], ['HP Burn'], ['Poison Explosion'], ['Enemy Max HP Damage']] },

  // SUSTAIN IS NOT ONE ROLE — it is three MECHANISMS with materially different value, and the flat
  // OR-list this replaced made them interchangeable. Under role-saturation a single Revive (the
  // WEAKEST mechanism) fully covered `sustain`, and a shield/heal champ was then scored at 0.25×
  // as "redundant" — the same coverage-is-binary defect that benched the Cleanser (see above) and,
  // on the engine side, benched Xenomorph. Splitting by mechanism is the goals-layer fix: distinct
  // roles stop saturating against each other, so shield + heal STACK (they answer different threats)
  // while Revive is correctly cheap. Weights are DERIVED, not hand-picked — lib/sustain-profiles.js
  // scored against the clan_boss threat profile {spike 2, debuff 2, sustained 3}, normalized to
  // restoration = 1.0 (the weight the old flat role carried, so total sustain pressure is preserved):
  //   absorption 4.50 → 1.10   restoration 4.10 → 1.00   recovery 1.60 → 0.39
  // Absorption edges restoration because it soaks the AoE spikes at full value and still answers
  // attrition; recovery is a third of either because it only acts once a champion is ALREADY dead —
  // and on CB a dead champion is lost turns, which is lost damage.
  { phase: 'single', role: 'sustain_absorb', weight: 1.1,
    description: 'Absorb damage before it lands — shields / Ally Protection (best vs the boss AoE spikes)',
    solutions: [['Shield'], ['AoE Shield'], ['Ally Protection'], ['Block Damage'], ['Unkillable']] },

  { phase: 'single', role: 'sustain_heal', weight: 1.0,
    description: 'Restore HP through the attrition — heals (the answer to sustained Gathering Fury damage)',
    solutions: [['Continuous Heal'], ['AoE Heal'], ['Healer'], ['Heal'], ['Leech']] },

  { phase: 'single', role: 'sustain_revive', weight: 0.39,
    description: 'Recover a dead ally — insurance only; the turns lost before the revive are lost damage',
    solutions: [['Revive'], ['Revive on Death']] },

  { phase: 'single', role: 'cleanse', weight: 0.9,
    description: 'Cleanse the boss debuffs off your team (esp. the affinity Decrease SPD / Decrease ATK)',
    solutions: [['Cleanse'], ['Block Debuffs']] },

  { phase: 'single', role: 'debuff_amp', weight: 0.6,
    description: 'Lane B amp — Decrease DEF / Weaken (boosts mastery + attack damage, NOT the DoT)',
    solutions: [['Decrease Defense'], ['Weaken']] },

  { phase: 'single', role: 'extra_hits', weight: 0.6,
    description: 'Extra hits for more Warmaster / Giant Slayer procs (Counterattack / Ally Attack)',
    solutions: [['Counterattack'], ['Ally Attack']] },

  { phase: 'single', role: 'tempo', weight: 0.5,
    description: 'Team speed / turn meter — more turns before the ~50-turn wall = more banked damage',
    solutions: [['Increase Speed'], ['Increase Turn Meter'], ['Fervor']] },

  { phase: 'single', role: 'debuff_ext', weight: 0.4,
    description: 'Extend DoT / debuff duration (more Lane-A uptime)',
    solutions: [['Increase Debuff Duration'], ['Poison Sensitivity']] },
];

// Boss RESISTANCE per difficulty (community "Master Clan Boss Stat Chart", 2026-08-05). This is the REAL
// input to the debuff-landing MATH — lib/formulas.js `debuffLandChance(acc, res)` = clamp((acc-res)/100+1,
// 0.03, 1.0). There is NO hard ACC gate: 0 ACC is playable, you just land few debuffs (see the
// no-hard-lines / floors-are-not-gates principle). Let the formula compute landing frequency; never lock.
export const CB_BOSS_RES = { Easy: 30, Normal: 60, Hard: 90, Brutal: 130, Nightmare: 170, 'Ultra Nightmare': 225 };

// ADVISORY recommendation only — the ACC at which debuffLandChance reaches ~100% for the difficulty
// (= boss RES per the formula above). Surface as "target ~X ACC to land debuffs reliably", NEVER as
// pass/fail. Below it, debuffs STILL land at debuffLandChance(acc, CB_BOSS_RES[diff]) — the scoring layer
// should prefer that probability over any threshold. This constant is only the soft reference the ACC-aura
// deficit score reads (INS-0005 Rule 1). CB_ACC_FLOOR kept as a back-compat alias for the shadow tools
// (bucket-score / pool-select / shadow-cb) — rename to CB_RECOMMENDED_ACC when they're next touched.
export const CB_RECOMMENDED_ACC = { ...CB_BOSS_RES };
export const CB_ACC_FLOOR = CB_RECOMMENDED_ACC;
