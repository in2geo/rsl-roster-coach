// lib/sim/spider.js — Spider's Den (Skavag the Spider Queen) content for the ONE engine.
//
// Skavag + her Spiderlings are CONTENT (not player champions; champion_id NULL), so they are SCRIPTED here
// exactly as Hellrazor is in dragon.js. Sourced from the in-game card (Tier-1, Stage-13) + community-
// datamined coefficients (flagged) — full spec in knowledge/SPIDER_SIM_BUILD.md.
//
// Slice B scope: the spawn / consume-snowball mechanic + the always-on factors (lifesteal 35%, 90% Poison
// reduction vs Skavag). The 21-25 boss passives (Almighty Strength / Almighty Persistence) are wired as
// content flags but only bite at stage ≥21 — deferred to Slice C (the anchor is Stage 13).

import { flag, makeCombatant, applyDebuff, landDebuff, dealDamage, computeRawHit, decreaseTurnMeter, chooseAllyTarget, rollChance } from './engine.js';
import { recordTargeting } from './interpreter.js';   // emit the 'target' event so turn-verify can VERIFY Taunt/Veil steer the Spiderlings

// Almighty Immunity — VERBATIM from the in-game card. CC/tempo immunities; the Spiderlings are NOT immune.
// (Heal Reduction is Healing Assured, folded in here so a single `boss.immune` list covers both passives.)
export const SKAVAG_IMMUNE = [
  'Stun', 'Freeze', 'Sleep', 'Provoke', 'Block Active Skills', 'Block Passive Skills', 'Fear', 'True Fear',
  'Petrification', 'Berserk', 'Enfeeble', 'Nullify', 'Ensnare', 'Fatigue', "Hunter's Gaze",
  'Heal Reduction',
];

// datamined coefficients (community, NOT Plarium-published — flagged; see the design doc)
const VENOM_SPRAY_COEFF = 2.5;        // AoE ATK, ×1.15 vs a Poisoned target
const STUPEFYING_SILK_COEFF = 3.0;    // AoE ATK, cd 4, 70% −30% TM, Sleep-on-TM-empty
// ⚠ THE ONE UNRESOLVED UNKNOWN — the Spiderling direct-hit coefficient. Bracketed (SIM override) until
// observed; second-order vs the pinned 2×5% MaxHP Poison per hit (see the design doc).
const SPIDERLING_COEFF = Number(process.env.SIM_SPIDERLING_COEFF ?? 1.0);
// ⚠ ESTIMATE (Mike first-party 2026-07-28, watching battles): the Spiderling attack places each of its two
// 5% Poisons at ~this chance BEFORE the ACC/RES resist — net ~35% on Pelops (RES 57). NOT card-datamined.
const SPIDERLING_POISON_CHANCE = Number(process.env.SIM_SPIDERLING_POISON_CHANCE ?? 0.37);
const SPAWN = { onRoundStart: 6, perAllyTurn: 2, onSkavagTurnEnd: 4, max: 10 };

export function makeSpiderContent({ stageNumber, boss, spawnTemplate, difficulty = 'Normal' }) {
  const endgame = stageNumber >= 21;    // Almighty Strength + Almighty Persistence (21-25) — Slice C
  let consumeEligible = true;           // alternating: flips false ONLY when she ACTUALLY consumes (≥1 alive)
  let silkCd = 0;
  const atk0 = boss.atk;                // BASE ATK — the consume ATK gain is +10% of BASE per Spiderling, additive
  let spidersEaten = 0;                 // cumulative, for the additive-on-base ramp (Mike first-party 2026-07-28)

  const living = (state) => state.enemies.filter((e) => e.role === 'add' && e.alive);
  const spawn = (state, n) => {
    const k = Math.min(n, Math.max(0, SPAWN.max - living(state).length));   // no reserve/queue — cap is hard
    for (let i = 0; i < k; i++) {
      const t = spawnTemplate;
      state.enemies.push(makeCombatant({ name: `Spiderling#${(state.spiderSeq = (state.spiderSeq ?? 0) + 1)}`,
        side: 'enemy', role: 'add', level: t.level, maxHp: t.maxHp, atk: t.atk, def: t.def, spd: t.spd,
        acc: t.acc, res: t.res, critRate: t.critRate, critDmg: t.critDmg, affinity: t.affinity }));
    }
    if (k > 0) state.log?.push({ turn: state.turn, phase: 'skavag', event: `spawn ${k}`, adds: living(state).length });
    return k;
  };

  // one AoE ATK attack (Venom Spray / Stupefying Silk) through the ONE engine's damage math (computeRawHit
  // already routes enemy→ally through the incoming-mitigation stack — no third damage path).
  const aoeStrike = (state, coeff, { poisonBonus = false } = {}) => {
    for (const a of state.allies.filter((x) => x.alive)) {
      const F = { scalingStat: 'ATK', multiplier: coeff, hitCount: 1, flags: { crit: true, affinity: true, variance: true, def_mitigation: true } };
      let { raw } = computeRawHit(state, boss, a, F);
      if (poisonBonus && (a.debuffs ?? []).some((d) => d.type === 'Poison')) raw *= 1.15;   // card: +15% vs a Poisoned target
      const dd = dealDamage(a, raw, 'direct', boss, state.allies);
      state.onDamageTaken?.(state, a, boss, dd.toHp);
    }
  };

  function actSpider(state, unit) {
    if (unit.role === 'add') return spiderlingAct(state, unit);
    // ── SKAVAG ──
    // 1. CONSUME at the start of her turn (alternating; only when ≥1 alive), BEFORE her attack
    const spiders = living(state);
    if (consumeEligible && spiders.length > 0) {
      const n = spiders.length;
      for (const s of spiders) s.alive = false;
      boss.hp = Math.min(boss.maxHp, boss.hp + 0.03 * boss.maxHp * n);
      spidersEaten += n;
      boss.atk = Math.round(atk0 * (1 + 0.10 * spidersEaten));            // PERMANENT +10% of BASE ATK per Spiderling — ADDITIVE stacks (RSL "increase ATK by %"), NOT compounding on current. 10 eaten = +100% = 2x base. (Was boss.atk *= (1+0.1n) → exponential, blew to 6.8x by t107 and wiped the team; reality ramps linearly and survives ~186t.)
      consumeEligible = false;
      state.log?.push({ turn: state.turn, phase: 'skavag', event: `CONSUME ${n}`, heal: `+${3 * n}%`, atkGain: `+${10 * n}%`, atk: boss.atk });
    } else {
      consumeEligible = true;                                              // empty-field / cooldown turn does NOT burn the alternation
    }
    // 2. ACTION — Stupefying Silk if off cooldown, else Venom Spray
    if (silkCd <= 0) {
      silkCd = 4;
      aoeStrike(state, STUPEFYING_SILK_COEFF);
      for (const a of state.allies.filter((x) => x.alive)) {
        if (rollChance(state?.rng?.debuff, 0.70)) {                        // 70% chance of −30% TM per target
          const before = a.turnMeter ?? 0;
          decreaseTurnMeter(a, 30);
          if (before > 0 && (a.turnMeter ?? 0) <= 0) applyDebuff(a, { type: 'Sleep', turns: 1 });   // Sleep if fully depleted
        }
      }
    } else {
      silkCd -= 1;
      aoeStrike(state, VENOM_SPRAY_COEFF, { poisonBonus: true });
    }
    // 3. END OF TURN — spawn 4 (she re-seeds even right after consuming all)
    spawn(state, SPAWN.onSkavagTurnEnd);
  }

  function spiderlingAct(state, sp) {
    const target = chooseAllyTarget(state.allies);                         // single-target (respects Taunt/Veil, like the recipe mobs)
    if (!target) return;
    recordTargeting(state, state.allies, target);                          // MODEL VISIBILITY: emit the 'target' event so turn-verify checks whether Taunt steered this pick onto Pelops (and Veil kept a veiled ally out)
    const F = { scalingStat: 'ATK', multiplier: SPIDERLING_COEFF, hitCount: 1, flags: { crit: true, affinity: true, variance: true, def_mitigation: true } };
    const { raw } = computeRawHit(state, sp, target, F);
    const dd = dealDamage(target, raw, 'direct', sp, state.allies);
    state.onDamageTaken?.(state, target, sp, dd.toHp);
    // Each of the TWO 5% Poisons rolls a PLACEMENT chance FIRST, then the ACC-vs-RES resist. Mike first-party
    // (watching battles 2026-07-28): Poison lands ~35% of the time on Pelops (RES 57). Pure ACC/RES would be
    // ~95%, so the Spiderling attack carries a placement chance the in-game card doesn't state. ⚠ ESTIMATE
    // (SIM override), not datamined: SPIDERLING_POISON_CHANCE × landChance(75,57)=0.955 ≈ 0.35 net → ~0.37.
    for (let i = 0; i < 2; i++) if (rollChance(state?.rng?.debuff, SPIDERLING_POISON_CHANCE)) landDebuff(state, sp, target, { type: 'Poison', pct: 0.05, turns: 2, stacking: true, maxStacks: 10 });
  }

  return {
    name: "Spider's Den", stageNumber,
    clearOnBossDeath: true,                        // win = Skavag dead (Spiderlings die with her)
    lifestealFactor: 0.35,                         // card: lifesteal heals only 35% vs Skavag / Spiderlings
    poisonDamageFactorVsBoss: 0.10,                // Healing Assured: Poison deals 10% of normal to Skavag (−90%)
    maxHpDamageCap: endgame ? 0.10 : null,         // Almighty Strength (21-25) — engine caps ENEMY-MAX-HP SKILL hits (not DoT); Slice C verifies
    tmReductionFactorVsBoss: endgame ? 0.50 : 1,   // Almighty Persistence (21-25) — TM reduction to Skavag halved; wired in Slice C
    phases: [{ name: 'skavag', enemies: [boss], actEnemy: actSpider }],
    onPhaseStart(state) { spawn(state, SPAWN.onRoundStart); },                                   // 6 at the start of the round
    onTurnStart(state, actor) { if (actor.side === 'ally') spawn(state, SPAWN.perAllyTurn); },   // +2 per ally turn (incl. Extra Turns)
  };
}
