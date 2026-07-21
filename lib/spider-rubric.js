// lib/spider-rubric.js — POOL allocations for SPIDER'S DEN. SHADOW.
//
// Built 2026-07-19 from `SPIDER_REVIEW.md` + the Skavag skill text (Tier-2 factual) + Mike's rulings.
//
// ── THE DEFINING MECHANIC (Mike): everything flows from ONE gate ─────────────
// **Skavag CONSUMES her remaining Spiderlings at the start of each of her turns**, healing 3% of her
// MAX HP and gaining +10% ATK **PERMANENTLY** per Spiderling eaten. (Confirmed by Mike 2026-07-19
// against the skill text; she does NOT get healed by the Spiderlings attacking.) So every strategy is
// a different answer to the same question: **how do you stop her eating them?**
//   • kill them with DoT before her turn        → Strategy C/D
//   • kill them with AoE before her turn        → Strategy A/B
//   • deny her the turn entirely (TM reduction) → the tm_lock OVERLAY, present in ALL FOUR
// **CC does NOT answer it.** A CC'd Spiderling is still alive and still gets consumed. CC suppresses
// their 5% MaxHP Poison stacks — that is SURVIVE work, not anti-heal work. (Claude initially modelled
// CC-lock as an anti-heal strategy; wrong, corrected here.)
//
// ── TEMPO IS DOUBLE-EDGED HERE, UNIQUELY ────────────────────────────────────
// "Spawns 2 Spiderlings at the start of EACH enemy Champion's turn." Every turn your team takes feeds
// her. You still need turns to clear the spawns, so tempo is not simply bad — it is capped and then
// COSTLY. Expressed via `overfill: { tempo: -1 }` (Mike ruled a true negative, not a lower weight).
//
// ── OTHER FACTS THE MODEL MUST NOT FORGET ───────────────────────────────────
//   • Lifesteal / heal-on-damage heals only 35% vs Skavag and her Spiderlings → sustain must be
//     direct heals + shields, NOT lifesteal.
//   • She is IMMUNE to Heal Reduction ("Healing Assured").
//   • Venom Spray does +15% damage to targets carrying Poison — letting Spiderlings stack Poison on
//     you AMPLIFIES her AoE.
//   • Consumption ALTERNATES: "If Skavag consumes Spiderlings, she will not consume them on the
//     following turn." So the kill window is wider than one turn.
//   • Enfeeble (CD4): 70% chance of -30% Turn Meter; [Sleep] if a target's TM is fully depleted.
//   • 21-25: Almighty Strength (%MaxHP damage capped at 10% of boss MAX HP — this is why the MaxHP
//     nuke path DIES at 21+) and Almighty Persistence (TM reduction -50%, doubling the overlay's price).
//
// ── FLOORS ARE DERIVED, NOT PLACEHOLDERS (Mike ruled the switch, 2026-07-19) ──
// Previously `stage x 10` + a separate margin. Now computed from real per-stage enemy stats in
// `dungeon_stage_enemies`: **ACC = enemy RES + 25**, **RES(advisory) = enemy ACC + 100**.
// Verified against the source's worked example: stage 20 → ACC 225 / RES 300. ✅
// This makes Spider the FIRST content whose floors are derived rather than judgment calls.
// ⚠ NOTE an anomaly in our data: stages 21-23 drop back to RES/ACC 150 before returning to 200 at
// 24-25 (non-monotonic). Unverified — either real, or an error in seeds 130-135.
export function spiderFloors(enemyRow) {
  if (!enemyRow) return null;
  return {
    acc: enemyRow.res != null ? enemyRow.res + 25 : null,   // to LAND debuffs on her / the spawns
    res: enemyRow.acc != null ? enemyRow.acc + 100 : null,  // ADVISORY — to resist hers
  };
}

// ── BUCKET MEMBERSHIP ───────────────────────────────────────────────────────
const AOE_DAMAGE   = ['AoE Damage', 'Multi-Hit A1'];
const MAXHP_DAMAGE = ['Enemy Max HP Damage'];
const BOSS_DAMAGE  = ['Single Target Damage', 'AoE Damage', 'Multi-Hit A1', 'Enemy Max HP Damage'];

// Mike: Poison belongs with HP Burn — both are %MaxHP DoT — "weighted slightly differently since
// HP Burn ticks harder."
const HP_BURN = { 'HP Burn': 1.0, 'Poison': 0.7, 'Poison Cloud': 0.7, 'Necrosis': 0.5 };

// Poison Explosion is split: you must APPLY stacks and you must DETONATE them. A team can do one
// without the other, and neither alone is the strategy.
const POISON_STACKING = { 'Poison': 1.0, 'Poison Cloud': 0.8, 'Necrosis': 0.5 };
const DETONATION      = { 'Poison Explosion': 1.0 };

// Amplification for the ATTACK paths (A, B) — the source pairs nukers with these explicitly.
const AMP_ATTACK = ['Decrease Defense', 'AoE Decrease Defense', 'Weaken',
                    'Increase Attack', 'Increase C.Rate', 'Increase C.DMG', 'Increase ACC'];

// Amplification for POISON EXPLOSION is a DIFFERENT KIND — it grows the STACK COUNT, which is what
// the explosion scales on. `Decrease Defense` and `Weaken` are deliberately ABSENT: Poison Explosion
// "ignores 100% Enemy Defense", so DEF shred and Weaken do nothing for it.
const AMP_STACKS = ['Increase Debuff Duration', 'Poison Sensitivity', 'Increase ACC', 'Debuff Spread'];

// CC = keep the Spiderlings from ATTACKING (their Poison stacks). It does NOT stop consumption.
const CROWD_CONTROL = ['AoE Stun', 'Stun', 'AoE Freeze', 'Freeze', 'AoE Sleep', 'Sleep',
                       'Provoke', 'Fear', 'True Fear', 'Petrification', 'Ensnare', 'Seal', 'Hex',
                       'Decrease Turn Meter', 'AoE Decrease Turn Meter'];

// TM reduction on SKAVAG — the overlay that denies her the turn she would consume on.
const TM_LOCK = ['Decrease Turn Meter', 'AoE Decrease Turn Meter',
                 'AoE Decrease Turn Meter (Resistible)', 'Decrease Speed'];

const TEMPO = ['Increase Speed', 'Increase Turn Meter', 'Fervor', 'Reset Cooldowns'];

// Lifesteal is CUT TO 35% here, so `Leech` is half-credit. Direct heals and shields do the work.
const SURVIVE = { 'Healer': 1.0, 'AoE Heal': 1.0, 'Continuous Heal': 1.0, 'AoE Shield': 1.0,
                  'Shield': 1.0, 'Block Damage': 1.0, 'Unkillable': 1.0, 'Revive': 1.0,
                  'Revive on Death': 1.0, 'Ally Protection': 1.0, 'Cleanse': 1.0,
                  'Block Debuffs': 1.0, 'Total Guard': 1.0, 'Life Barrier': 1.0,
                  'Leech': 0.35 };

// `Heal Reduction` is DEAD — she is immune ("Healing Assured").
export const DEAD_ON_SPIDER = new Set(['Heal Reduction', 'Buff Strip', 'Steal Buffs', 'Infest',
                                       'Pain Link', 'Intercept', 'Block Revive']);

const COMMON = { dead: DEAD_ON_SPIDER, overfill: { tempo: -1 } };

/** Four strategies. `stages` GATES which are viable; the MODEL then picks the best fit for the roster
 *  (scoreBestStrategy) — the player is asking for a recommendation, not choosing a path. */
export const SPIDER_STRATEGIES = [
  { key: 'aoe_nuke', name: 'AoE nuke — kill the spawns before her turn', stages: [1, 14],
    allocation: { aoe_damage: 30, boss_damage: 20, survive: 15, amplification: 15, tempo: 10, tm_lock: 10 },
    buckets: { aoe_damage: AOE_DAMAGE, boss_damage: BOSS_DAMAGE, survive: SURVIVE,
               amplification: AMP_ATTACK, tempo: TEMPO, tm_lock: TM_LOCK }, ...COMMON },

  { key: 'maxhp_nuke', name: 'Enemy MAX HP nuke — damage as a % of her max HP', stages: [15, 20],
    allocation: { max_hp_damage: 30, amplification: 20, boss_damage: 15, survive: 15, tempo: 10, tm_lock: 10 },
    buckets: { max_hp_damage: MAXHP_DAMAGE, amplification: AMP_ATTACK, boss_damage: BOSS_DAMAGE,
               survive: SURVIVE, tempo: TEMPO, tm_lock: TM_LOCK }, ...COMMON },

  { key: 'poison_explosion', name: 'Poison Explosion — ignores 100% enemy DEF', stages: [15, 20],
    allocation: { poison_stacking: 30, amplification: 20, detonation: 15, survive: 15, tempo: 10, tm_lock: 10 },
    buckets: { poison_stacking: POISON_STACKING, amplification: AMP_STACKS, detonation: DETONATION,
               survive: SURVIVE, tempo: TEMPO, tm_lock: TM_LOCK }, ...COMMON },

  { key: 'hp_burn', name: 'AoE HP Burn — %MaxHP damage over time', stages: [15, 25],
    allocation: { hp_burn: 30, crowd_control: 20, boss_damage: 15, survive: 15, tempo: 10, tm_lock: 10 },
    buckets: { hp_burn: HP_BURN, crowd_control: CROWD_CONTROL, boss_damage: BOSS_DAMAGE,
               survive: SURVIVE, tempo: TEMPO, tm_lock: TM_LOCK }, ...COMMON },
];

/* EVERY strategy is evaluated at EVERY stage (Mike, 2026-07-20: "the gates were somebody's opinion,
 * not hard truth"). This used to FILTER on `s.stages`, so stages 1-14 and 21-25 returned exactly ONE
 * strategy — the model's build-a-team-per-strategy-then-compare step had nothing to compare, and the
 * STAGE picked the plan instead of the ROSTER. That mattered: Bambus's whole real ladder (7-13) ran
 * as `aoe_nuke` by decree, so its poison-heavy team (Ezio Poison/Poison Explosion + Kael Poison) was
 * never scored under `poison_explosion`.
 *
 * The boundaries are not verified game truth: SPIDER_REVIEW.md sources them from a hand-read
 * AyumiLove guide and lists them in its OPEN QUESTIONS ("B. Tier boundaries ... Is the wall at 15
 * right?") — never confirmed. CLAUDE.md's sourcing hierarchy puts community dungeon-strategy opinion
 * at Tier 3, explicitly NOT a source of truth. (The ACC = stage x 10 floor IS Plarium-sourced and is
 * unaffected — it lives in stat_threshold_checks, not here.)
 *
 * `s.stages` is KEPT on each strategy as descriptive metadata — where a plan is *expected* to shine —
 * so it can become a SOFT weight if evidence ever supports one. It is no longer a filter.
 * Signature preserved so callers (pool-select.mjs, pool-scan.mjs) are unchanged. */
export const spiderStrategiesForStage = _stage => SPIDER_STRATEGIES;
