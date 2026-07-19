// lib/ice-golem-rubric.js — POOL allocation + bucket membership for ICE GOLEM'S PEAK. SHADOW.
//
// Built 2026-07-19 from `ICE_GOLEM_REVIEW.md` (source mechanics, per-tier floors) + Mike's rulings.
// THREE player-choice strategies — the review names all three and the third was deliberately not
// built in the goals model ("Candidate enhancement — a sustain goal").
//
// ── KLYSSUS (review + Mike-confirmed) ───────────────────────────────────────
//   Frigid Vengeance [P]  fires at 80/60/45/30/15% HP. Hits the team, REVIVES dead minions to 100%,
//                         ignores 50% DEF *per alive ally*, Freezes at 20% +40% *per alive ally*.
//                         **DoT (Poison/HP Burn) does NOT trigger it** — that is why IG is a DoT dungeon.
//   Numbing Chill (CD4)   AoE 50% [Decrease ACC] 2 turns — attacks the stat every debuff depends on.
//   2 minions             apply Heal Reduction AND Decrease DEF on you. "The deadlier one carries
//                         Decrease DEF" — target order matters (NOT expressible in a bucket).
//   Almighty Immunity     CC works on the MINIONS, never the boss.
//   21-25 only            Almighty Strength (%MaxHP damage capped at 10% of boss max HP) +
//                         Almighty Persistence (TM reduction -50%).
//
// ── FLOORS (already existed in the review; a survive-gate can run on these today) ──
export const IG_FLOORS = {
  '1-9':   { acc: 80,  hp: 5000 },
  '10-13': { acc: 120, hp: 8000 },
  '14':    { acc: 200, res: 200, hp: 40000 },   // difficulty cliff
  '15-20': { acc: 200, res: 200, hp: 40000 },
  '21-25': { acc: 210, res: 210, hp: 45000 },
};

// ── HARMFUL, not merely dead (review: "avoid Counterattack/Reflect — chain-triggers Frigid Vengeance")
// A `dead` tag contributes nothing. These make the fight WORSE by firing the retaliation more often.
// CURRENT HANDLING: zero delivery (as dead) + an explicit WARNING flag, so a Counterattack champion is
// never credited and the risk is surfaced. A true NEGATIVE term (penalising the grade) is deliberately
// NOT implemented — that is a scoring change with no validation behind it yet.
export const HARMFUL_ON_IG = new Set(['Counterattack', 'Reflect Damage']);

// ── BUCKET MEMBERSHIP ───────────────────────────────────────────────────────
const DOT_RACE = ['Poison', 'HP Burn', 'Poison Cloud', 'Necrosis', 'Poison Explosion',
                  'Enemy Max HP Damage'];

// Block Revive is THE answer and needs NO ACC (seed 198 — the target is already dead, so nothing
// resists). The review adds the condition: the champion "must be built to deal high damage to defeat
// them in 1 hit to enable the Block Revive to take place" — that is a BUILD gate, not a tag.
const REVIVE_CONTROL = { 'Block Revive': 1.0 };

// CC works on the minions. AoE damage clears them. Both are wave tools.
const WAVE_CLEAR = ['AoE Damage', 'Multi-Hit A1', 'Enemy Max HP Damage',
                    'AoE Stun', 'Stun', 'AoE Freeze', 'Freeze', 'AoE Sleep', 'Sleep',
                    'Provoke', 'Fear', 'True Fear', 'Petrification', 'Ensnare', 'Seal', 'Hex',
                    'Decrease Turn Meter', 'AoE Decrease Turn Meter'];

const SURVIVE = ['Healer', 'AoE Heal', 'Continuous Heal', 'Revive', 'Revive on Death',
                 'Shield', 'AoE Shield', 'Block Damage', 'Unkillable', 'Ally Protection',
                 'Total Guard', 'Life Barrier', 'Magma Shield', 'Stone Skin', 'Fortify', 'Immutable'];

// Numbing Chill (50% Decrease ACC) and the minions' Heal Reduction both attack your FUNCTION rather
// than your HP — Heal Reduction switches your sustain off. Its own bucket for that reason.
const CLEANSE = ['Cleanse', 'Block Debuffs', 'Nullify'];

// DoT amps ONLY. `Decrease Defense` is ABSENT deliberately: DEF shred does nothing for DoT
// (damage-mechanics §1), so on the DoT path it is not amplification at all.
const AMP_DOT = ['Increase Debuff Duration', 'Poison Sensitivity', 'Increase ACC', 'ACC Aura'];
// Burst amps — only meaningful on the paths that actually attack.
const AMP_BURST = ['Decrease Defense', 'AoE Decrease Defense', 'Increase Attack',
                   'Increase C.Rate', 'Increase C.DMG', 'Weaken'];

// Frigid Vengeance is an ATTACK (not %MaxHP), so Decrease ATK reduces it. But it ignores 50% DEF PER
// ALIVE ALLY, so `Increase Defense` is worth little while minions live — half weight.
const MITIGATION = { 'Decrease Attack': 1.0, 'Weaken': 1.0, 'Decrease C.Rate': 1.0,
                     'Decrease C.DMG': 1.0, 'Increase RES': 1.0, 'Taunt': 1.0,
                     'Increase Defense': 0.5 };

const DAMAGE_DIRECT = ['AoE Damage', 'Single Target Damage', 'Multi-Hit A1', 'Enemy Max HP Damage'];

export const DEAD_ON_IG = new Set(['Buff Strip', 'Steal Buffs', 'Pain Link', 'Infest', 'Intercept']);

// ── THE THREE STRATEGIES (allocations PROPOSED by Claude, grounded in the review — NOT yet ruled) ──
export const IG_STRATEGIES = [
  {
    key: 'dot_race',
    name: 'DoT race — never trip Frigid Vengeance',
    // The safe kill: DoT walks him through all five thresholds without paying the retaliation.
    // revive_control is ABSENT, not floored: if the passive rarely fires, the minions rarely revive,
    // so Block Revive is not a priority on this path. (Mike's gate ruling: a non-priority dimension is
    // removed, not given a token weight.)
    allocation: { dot_race: 35, survive: 20, wave_clear: 15, amplification: 15, cleanse: 15 },
    buckets: { dot_race: DOT_RACE, survive: SURVIVE, wave_clear: WAVE_CLEAR,
               amplification: AMP_DOT, cleanse: CLEANSE },
    dead: DEAD_ON_IG, harmful: HARMFUL_ON_IG, accFloor: 200,
  },
  {
    key: 'block_revive',
    name: 'Block Revive + one-shot — keep the minions dead',
    // Gate-shaped (Mike: 20-25, "close to a gate mechanic, same as shield_break on FK"). Paired with
    // high damage because Block Revive only lands if you actually kill the minion.
    allocation: { revive_control: 25, damage: 25, survive: 20, wave_clear: 15, cleanse: 15 },
    buckets: { revive_control: REVIVE_CONTROL, damage: [...DAMAGE_DIRECT, ...AMP_BURST],
               survive: SURVIVE, wave_clear: WAVE_CLEAR, cleanse: CLEANSE },
    dead: DEAD_ON_IG, harmful: HARMFUL_ON_IG, accFloor: 200,
  },
  {
    key: 'tank',
    name: 'Out-sustain the retaliations (CC the minions)',
    // The review's third strategy: "heavy sustain (AoE heal / Revive / Remove Debuff / Ally
    // Protection) while Crowd Controlling his minions." Mike, 2026-07-19: "there are plenty of teams
    // that handle Ice Golem fine without revive control either through mitigation or sustain."
    allocation: { survive: 35, mitigation: 20, wave_clear: 15, damage: 15, cleanse: 15 },
    buckets: { survive: SURVIVE, mitigation: MITIGATION, wave_clear: WAVE_CLEAR,
               damage: [...DAMAGE_DIRECT, ...AMP_BURST], cleanse: CLEANSE },
    dead: DEAD_ON_IG, harmful: HARMFUL_ON_IG, accFloor: 200,
  },
];
