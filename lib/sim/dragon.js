// lib/sim/dragon.js — Hellrazor's kit and the Dragon's Lair phase structure.
//
// Mechanics are quoted from DRAGON_REVIEW.md (repo root), which CLAUDE.md makes required reading
// before touching this dungeon's model. Hand-read factual game data (Tier 2 under the source
// hierarchy — skill text, not editorial).
//
// ⚠⚠ TWO THINGS ARE NOT MODELLED AND MUST NOT BE INVENTED:
//   1. THE WAVES. `dungeon_stage_enemies` holds 25 rows for Dragon and every one is enemy_role
//      'boss' (Hellrazor). There are NO wave enemies in the database at all — while Mike reports
//      the wall for Don$Bambus is WAVE 2. So this module simulates the BOSS phase and reports the
//      wave phase as unmodelled. That silence is deliberate: if the boss sim says "comfortable" and
//      reality is a loss, the residual localises to the waves and CONFIRMS the claim, where a
//      fabricated wave would merely absorb it.
//   2. THE PURPLE BAR'S SIZE. Inhale arms Scorch and creates a damage check, but the bar's HP is
//      not in any table we own. `purpleBarHp` is a required input; when null the Scorch check is
//      skipped and flagged rather than guessed.

import { flag, applyDebuff, has, defMitigation, effectiveDef, dealDamage } from './engine.js';

/** Hellrazor is immune to these — CC and the entire tempo toolkit. */
export const HELLRAZOR_IMMUNE = [
  'Stun', 'Freeze', 'Sleep', 'Provoke', 'Fear', 'True Fear',
  'Decrease Turn Meter', 'Decrease Speed',      // you cannot slow him; speed your own team up
];

/** Scorch is active from stage 7 — stages 1-6 are a simpler fight with no purple-bar race. */
export const SCORCH_FROM_STAGE = 7;

/**
 * @param {object} o
 *   `waves` — array of {name, enemies[]}. **Pass null (the default) when we have no wave data**,
 *   which is currently always for Dragon: the phase is then reported as `unmodelled` rather than
 *   fabricated. The moment real wave composition exists this works with no other change.
 */
export function makeDragonContent({ stageNumber, purpleBarHp = null, waves = null, difficulty = 'Normal', boss }) {
  const kit = makeHellrazor({ stageNumber, purpleBarHp });
  const wavePhases = waves
    ? waves.map((w, i) => ({ name: `wave ${i + 1}`, enemies: w.enemies, actEnemy: w.actEnemy }))
    : [{ name: 'wave 1', enemies: null }, { name: 'wave 2', enemies: null }];
  return {
    name: "Dragon's Lair", stageNumber,
    phases: [...wavePhases, { name: 'boss', enemies: [boss], actEnemy: kit.actEnemy }],
    onDamageToBoss: kit.onDamageToBoss,
    // Stage 21-25 (and all Hard) cap %maxHP damage skills to 10% of MAX HP per hit — Almighty
    // Persistence (boss_exceptions). null elsewhere = uncapped. Consumed by engine.dealMaxHpDamage.
    maxHpDamageCap: (stageNumber >= 21 || /hard/i.test(difficulty)) ? 0.10 : null,
  };
}

function makeHellrazor({ stageNumber, purpleBarHp = null }) {
  const scorchActive = stageNumber >= SCORCH_FROM_STAGE;
  // Almighty Strength / Almighty Persistence at 21-25 (boss_exceptions). Recorded so the engine can
  // respect them; %maxHP capping is applied by damage-mechanics upstream.
  const endgame = stageNumber >= 21;

  const cd = { wallOfFire: 0, inhale: 0 };
  let scorchArmed = false;

  return {
    scorchActive, endgame,

    /** One Hellrazor turn. Skill choice follows the same furthest-right-off-cooldown rule. */
    actEnemy(state, boss) {
      const allies = state.allies.filter(a => a.alive);
      if (!allies.length) return;

      // ── resolve an armed Scorch FIRST: the purple bar had to be cleared before he acts again ──
      if (scorchArmed) {
        scorchArmed = false;
        // The bar's HP is unknown, so the damage check cannot be evaluated. Rather than invent a
        // threshold we BRACKET it: SIM_SCORCH=never (optimistic — the team always clears the bar)
        // vs =always (pessimistic — it never does). Reality must sit between the two, and the gap
        // between them measures how much this one unmodelled mechanic is worth.
        const mode = process.env.SIM_SCORCH ?? 'never';
        if (purpleBarHp == null && mode !== 'always') {
          flag(state, 'UNMODELLED: purple-bar HP unknown — Scorch SKIPPED (optimistic bound)');
        } else if (purpleBarHp == null && mode === 'always') {
          flag(state, 'UNMODELLED: purple-bar HP unknown — Scorch ALWAYS fires (pessimistic bound)');
          for (const a of allies) { dealDamage(a, bossHit(boss, a), 'direct', boss); applyDebuff(a, { type: 'Stun', turns: 1 }); }
          state.log.push({ turn: state.turn, phase: 'boss', event: 'SCORCH (pessimistic bound)' });
          return;
        } else if (state.purpleBarLeft > 0) {
          // SCORCH — AoE + a 1-turn Stun on the whole team.
          for (const a of allies) {
            dealDamage(a, bossHit(boss, a), 'direct', boss);
            applyDebuff(a, { type: 'Stun', turns: 1 });
          }
          state.log.push({ turn: state.turn, phase: 'boss', event: 'SCORCH', barLeft: Math.round(state.purpleBarLeft) });
          return;
        } else {
          state.log.push({ turn: state.turn, phase: 'boss', event: 'scorch interrupted' });
        }
      }

      // ── Inhale (cd 3): drains his own Turn Meter and arms Scorch ──
      if (scorchActive && cd.inhale <= 0) {
        cd.inhale = 3; scorchArmed = true;
        state.purpleBarLeft = purpleBarHp ?? 0;
        boss.turnMeter = 0;                       // "depletes Hellrazor's Turn Meter"
        state.log.push({ turn: state.turn, phase: 'boss', event: 'INHALE — purple bar armed' });
        return;
      }

      // ── Wall of Fire (cd 3): AoE + two 5% Poison (3t) + 25% Weaken (2t) ──
      if (cd.wallOfFire <= 0) {
        cd.wallOfFire = 3;
        for (const a of allies) {
          dealDamage(a, bossHit(boss, a), 'direct', boss);
          for (let i = 0; i < 2; i++) applyDebuff(a, { type: 'Poison', pct: 0.05, turns: 3, stacking: true, maxStacks: 10 });
          applyDebuff(a, { type: 'Weaken', value: 25, turns: 2 });
        }
        state.log.push({ turn: state.turn, phase: 'boss', event: 'Wall of Fire' });
        return;
      }

      // ── Swipe: AoE + 50% Decrease ATK (2t) ──
      for (const a of allies) {
        dealDamage(a, bossHit(boss, a), 'direct', boss);
        applyDebuff(a, { type: 'Decrease Attack', value: 50, turns: 2 });
      }
      state.log.push({ turn: state.turn, phase: 'boss', event: 'Swipe' });
      cd.wallOfFire -= 1; cd.inhale -= 1;
    },

    /** Damage the team puts into the boss also eats the purple bar while it is up. */
    onDamageToBoss(state, amount) {
      if (state.purpleBarLeft > 0) state.purpleBarLeft = Math.max(0, state.purpleBarLeft - amount);
    },
  };
}

/**
 * Hellrazor's hit on one champion.
 *
 * His ATK is REAL — transcribed from an in-game/stat-site enemy table (seeds/131-135, 2026-07-15)
 * with documented cross-checks. It is identical to Skavag's/Klyssus's/Fyro's at every stage because
 * same-level enemies genuinely SHARE ATK/DEF scaling; HP is the per-dungeon variable. (A 2026-07-21
 * memory called this a "synthetic ladder" — that was wrong and is corrected.)
 *
 * ⚠ SO IF THE SIM OVER-KILLS THE TEAM, THE INPUT IS NOT THE SUSPECT. Look at `DEF_K = 1500` in
 * engine.js — a NOMINAL mitigation curve, never calibrated, and CLAUDE.md lists real DEF diminishing
 * returns as an unimplemented formulas.js TODO. That constant is the one unvalidated number in the
 * damage path.
 */
function bossHit(boss, target) {
  // ⚠ was `const DEF_K = 1500` here — a DUPLICATE that shadowed the engine's export and silently
  // made a sensitivity test read as "no effect across a 40x range". One constant, one definition.
  const bossAtkMod = boss.debuffs.some(d => d.type === 'Decrease Attack') ? 0.5 : 1;
  return boss.atk * bossAtkMod * defMitigation(effectiveDef(target));   // a DEF-shred on the ally boosts his hit
}

export { bossHit };
