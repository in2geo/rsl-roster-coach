// lib/fire-knight-rubric.js — the POOL allocation + bucket membership for FIRE KNIGHT'S CASTLE. SHADOW.
//
// Mike's rulings, 2026-07-19. FIRST content modelled as TWO STRATEGIES rather than one allocation,
// because `dungeon-mechanics.js` states the substitution outright: "TM-LOCK and SURVIVE are
// SUBSTITUTES — you need one, not both." A single flat budget cannot express that: any weight given
// to survive is wrong for a lock team and any weight given to tm_lock is wrong for a grind team.
//
// ── WHAT FYRO ACTUALLY DOES (dungeon-mechanics.js, Mike-confirmed) ───────────
//   Divine Shield  5/7/10/12 stacks by stage. Loses ONE STACK PER HIT (not per damage) and must be
//                  stripped before he acts, or he heals + AoE-nukes on MAX HP.
//   CC-IMMUNE      (universal dungeon-boss rule) — but TM REDUCTION WORKS. That is the lock.
//   Stages 21-25   ALMIGHTY PERSISTENCE halves all TM reduction. Halved is NOT immune (contrast
//                  Dragon/CB where TM does nothing): the strategy survives, its PRICE DOUBLES.
//
// ── WAVES ARE A SEPARATE FIGHT (correction, 2026-07-19) ─────────────────────
// Claude first ruled CC dead on FK, reasoning that Fyro is CC-immune and his room has no minions.
// That is true of the BOSS ROOM ONLY — "the trash mobs are the separate WAVE gate". CC is fully alive
// on the waves. Same principle Dragon's rubric encodes: the boss's immunity list does NOT devalue
// wave tools, because those tags were never aimed at him.

// ── STRATEGY A — TM-LOCK (the meta) ─────────────────────────────────────────
// Coldheart (Rare!) and Alure are cheat codes here. Lock Fyro and he never acts.
// TEMPO 20 (Mike): "if tempo slips the lock breaks and the whole strategy collapses."
// NOTE Mike flagged CC 15 as "redundancy insurance rather than active requirement" in a true lock run
// and floated CC 10 / tempo 20; he called 15/15 "defensible as a starting position". Tempo carries the
// 5 freed by removing `survive` (see the gate below). Confirmed by Mike 2026-07-19: "fine for now".
export const FK_TMLOCK_ALLOCATION = {
  shield_break: 25, tm_lock: 25, tempo: 20, crowd_control: 15, damage: 15,
};

// ── STRATEGY B — SURVIVE (the grind) ────────────────────────────────────────
// GuapoDonni's real 105-turn clear took this path precisely because they own no Coldheart/Alure.
// Mike: "In the survive grind you're absorbing hits by design — mitigation is doing real work every
// turn. CC in B is nice-to-have, not structural."
//
// ⚠ CORRECTED 2026-07-19 (Claude) AFTER READING `FIRE_KNIGHT_REVIEW.md` — CONFIRM WITH MIKE.
// Mike ruled `mitigation 15` here, and Claude built that bucket without reading the review. The review
// says Fyro's punish "reduces MAX HP (up to ~40%)" and Searing Storm "destroys 15% of MAX HP" from
// stage 7. **%MAX-HP damage is not reduced by ATK-side or DEF-side mitigation** — the defensive mirror
// of damage-mechanics §1 (DEF shred cannot boost DoT). So `Decrease Attack`, `Weaken`, `Decrease
// C.Rate` and `Decrease C.DMG` do NOTHING against the thing that kills you here, and a `mitigation`
// bucket would be permanently unfillable-by-anything-useful — it would drag the grade while measuring
// nothing. Its 15 is folded into `survive`, which holds the tools that DO answer %MaxHP: shields,
// Unkillable, Block Damage and healing between hits.
// `Increase RES` still does real work (vs debuffs, not vs the nuke) and moves into `survive` with it.
export const FK_SURVIVE_ALLOCATION = {
  shield_break: 25, survive: 40, damage: 15, crowd_control: 10, tempo: 10,
};

// ── BUCKET MEMBERSHIP ───────────────────────────────────────────────────────
// SHIELD_BREAK is WEIGHTED, not a flat list (Mike, 2026-07-19). The shield loses a stack per HIT, so
// many small hits beat few big ones. Multi-Hit A1 is PRIMARY; AoE Damage is SECONDARY at half weight.
// Ruled AGAINST a real hit-count data source for now — "fewer variables with high confidence".
// A DoT can NEVER break the shield (not a hit, and the shield blocks debuffs while up), so no DoT tag
// appears here — but DoT IS a real FK damage tool once the shield is down (see `damage`).
const SHIELD_BREAK = {
  'Multi-Hit A1': 1.0, 'Ally Attack': 1.0, 'Counterattack': 1.0, 'Reflect Damage': 1.0,
  'AoE Damage': 0.5, 'Single Target Damage': 0.5,
};

// Post-break damage. DoT is included DELIBERATELY: Mike's 2026-07-16 correction — the shield blocks
// debuffs while UP so a DoT cannot be landed early, but once broken the ticks PERSIST and help kill.
const DAMAGE = ['AoE Damage', 'Single Target Damage', 'Enemy Max HP Damage',
                'Poison', 'HP Burn', 'Poison Explosion', 'Multi-Hit A1'];

// The lock. `Decrease Speed` belongs here (not tempo): it works on Fyro and slows his TM refill,
// which is how the lock is held between reducer cooldowns.
const TM_LOCK = ['Decrease Turn Meter', 'AoE Decrease Turn Meter',
                 'AoE Decrease Turn Meter (Resistible)', 'Decrease Speed'];

// YOUR turn economy — enables both the shield-break cycle and the lock re-application.
// Auras are NOT here: an aura is a stat, and stats are gates, not buckets (ruled on the CB taxonomy).
const TEMPO = ['Increase Speed', 'Increase Turn Meter', 'Fervor', 'Reset Cooldowns'];

// WAVE MANAGEMENT — dead on Fyro, alive on the trash waves. This is the bucket that exists because
// waves are a separate fight.
const CROWD_CONTROL = ['Freeze', 'AoE Freeze', 'Stun', 'AoE Stun', 'Sleep', 'AoE Sleep', 'Provoke',
                       'Fear', 'True Fear', 'Sheep', 'Petrification', 'Ensnare', 'Seal', 'Master Seal',
                       'Hex', 'Decrease Turn Meter', 'AoE Decrease Turn Meter', 'Block Active Skills',
                       'Block Passive Skills', 'Increase Enemy Cooldowns', 'Fatigue'];

// Absorb/repair what lands — Strategy B's core, absent from Strategy A entirely (it is a GATE there).
// Absorb/repair what lands — Strategy B's core, absent from Strategy A entirely (it is a GATE there).
// Weighted: against %MAX-HP destruction, flat absorption and revival answer it; `Leech` does not
// (heal-on-damage scales with damage dealt, not with the % of your bar being removed).
const SURVIVE = {
  'Unkillable': 1.0, 'Block Damage': 1.0, 'AoE Shield': 1.0, 'Shield': 1.0, 'Revive': 1.0,
  'Revive on Death': 1.0, 'AoE Heal': 1.0, 'Healer': 1.0, 'Continuous Heal': 1.0,
  'Ally Protection': 1.0, 'Total Guard': 1.0, 'Life Barrier': 1.0, 'Magma Shield': 1.0,
  'Stone Skin': 1.0, 'Fortify': 1.0, 'Immutable': 1.0,
  'Cleanse': 1.0, 'Block Debuffs': 1.0, 'Nullify': 1.0,
  'Increase RES': 0.5,   // works vs his DEBUFFS, not vs the %MaxHP nuke — half credit
  'Leech': 0.5,          // heal-on-damage, weak against a bar being removed by percentage
};

// Prevent damage rather than repair it. Shields stay in SURVIVE (a shield is healing paid in advance —
// the CB ruling), so mitigation here is strictly output-reduction + resilience.
// ⚠ OPEN: Fyro's punish is described as an AoE MAX-HP nuke. If it scales on max HP then Decrease ATK
// and Increase DEF do NOTHING against it (damage-mechanics §1 logic, defensive side), which would make
// this bucket near-worthless and argue its 15 belongs in `survive`. NEEDS Tier-1 confirmation.
// MITIGATION IS NOT A BUCKET ON FIRE KNIGHT (corrected 2026-07-19 from FIRE_KNIGHT_REVIEW.md).
// Fyro's punish destroys a PERCENTAGE OF MAX HP (~40%, plus Searing Storm's 15% from stage 7). Nothing
// on the ATK side (`Decrease Attack`, `Weaken`) or the DEF side (`Increase Defense`) reduces %MaxHP
// damage, and `Taunt` cannot redirect an AoE. The only real answers are absorption and repair, which
// live in SURVIVE. Retained as a comment rather than deleted so nobody re-adds it from intuition.
//   dead here: Decrease Attack · Weaken · Decrease C.Rate · Decrease C.DMG · Increase Defense · Taunt
//   moved to SURVIVE: Increase RES (works against his DEBUFFS, just not against the nuke)

const AMPLIFICATION_INTO_DAMAGE = ['Decrease Defense', 'AoE Decrease Defense', 'Increase Attack',
                                   'Increase C.Rate', 'Increase C.DMG', 'Increase ACC',
                                   'Poison Sensitivity', 'Increase Debuff Duration', 'Debuff Activation'];

export const FK_TMLOCK_BUCKETS = {
  shield_break: SHIELD_BREAK,
  tm_lock: TM_LOCK,
  tempo: TEMPO,
  crowd_control: CROWD_CONTROL,
  damage: [...DAMAGE, ...AMPLIFICATION_INTO_DAMAGE],
};

export const FK_SURVIVE_BUCKETS = {
  shield_break: SHIELD_BREAK,
  survive: SURVIVE,
  damage: [...DAMAGE, ...AMPLIFICATION_INTO_DAMAGE],
  crowd_control: CROWD_CONTROL,
  tempo: TEMPO,
};

// DEAD ON FIRE KNIGHT — with reasons, because a wrong entry silently zeroes a real capability.
// NOTE: CC is NOT here. It is dead on the BOSS and alive on the WAVES (see the correction above).
//   • Infest / Necrosis — need enemy DEATHS to stack; the boss room is a lone boss. (Waves do die, so
//     these are borderline — flagged rather than confidently dead. REVIEW.)
//   • Intercept — defensive anti-CC; Fyro deals no CC to your team, so there is nothing to intercept.
//   • Poison Cloud / Pain Link — Hydra-specific boss mechanics, not a player FK tool.
//   • Buff Strip / Steal Buffs — Fyro carries no buffs worth removing.
export const DEAD_ON_FK = new Set([
  'Infest', 'Intercept', 'Poison Cloud', 'Pain Link', 'Buff Strip', 'Steal Buffs',
]);

/** The two strategies, scored separately; the team is graded against its BEST FIT.
 *  `gates` are PRECONDITIONS, confirmed not scored (Mike: "if you chose Strategy A, survive isn't a
 *  design dimension, it's a precondition"). Gate evaluation is NOT yet implemented — declared here so
 *  the shape is recorded and the scorer can pick it up. */
export const FK_STRATEGIES = [
  { key: 'tm_lock', name: 'TM-lock — Fyro never acts (Coldheart/Alure)',
    allocation: FK_TMLOCK_ALLOCATION, buckets: FK_TMLOCK_BUCKETS, dead: DEAD_ON_FK, accFloor: 170,
    gates: [{ key: 'survive_to_lock', why: 'all five must survive long enough to establish the lock',
              check: 'min HP/DEF threshold — NOT IMPLEMENTED' }] },
  { key: 'survive', name: 'Survive grind — outlast the nuke (no TM reducer)',
    allocation: FK_SURVIVE_ALLOCATION, buckets: FK_SURVIVE_BUCKETS, dead: DEAD_ON_FK, accFloor: 170 },
];
