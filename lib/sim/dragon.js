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

import { flag, applyDebuff, landDebuff, has, defMitigation, defMitLevel, effectiveDef, dealDamage, incomingDamage, affinityMult } from './engine.js';

/** Hellrazor is immune to these — CC and the entire tempo toolkit. */
export const HELLRAZOR_IMMUNE = [
  // "Almighty Immunity" — the hidden boss passive's CC/tempo immunity list. Enfeeble + Petrification ARE in it
  // (Mike, in-game 2026-07-26): so Bambus A3's [Enfeeble] is blocked on the boss (→ it lands its 50% [Decrease
  // ATK] boss-branch instead), and Pelops's on-attacked [Petrification] is likewise blocked on the boss.
  'Stun', 'Freeze', 'Sleep', 'Petrification', 'Enfeeble', 'Provoke', 'Fear', 'True Fear',
  'Decrease Turn Meter', 'Decrease Speed',      // you cannot slow him; speed your own team up
];

/** Scorch is active from stage 7 — stages 1-6 are a simpler fight with no purple-bar race. */
export const SCORCH_FROM_STAGE = 7;

// The Inhale "purple bar" you must out-damage before the boss's next turn to re-lock Scorch, as a
// fraction of the boss's MAX HP. The in-game skill text says only "a portion/chunk of his HP" — no % given.
//
// ⚠ THE EXACT SIZE IS UNCERTAIN AND METRIC-INVISIBLE. Three first-party-ish estimates conflict:
//   • ~10% — st10 solo replay derivation (Mikey's single Boo-Yah ~22,930 clears it; boss 221,775 → 10.3%).
//   • ~15% — Mike's direct st16 read (2026-08-12), watching the purple segment on the boss HP bar.
//   • ~20% — community lore (also the original DRAGON_REVIEW value); Mike cannot confirm/deny.
// A sim-suite A/B across 10 / 15 / 20% (flat AND escalating) returns the BYTE-IDENTICAL Dragon number
// (68.5%, fp 21, fn 18): with masteries wired, no captured case's WIN/LOSS flips on the bar size, so the
// metric cannot adjudicate it. Default = 15% (Mike's direct st16 observation, the central estimate).
// ⚠ POSSIBLE STAGE-SCALING (unmodelled): the 10% anchor is st10, the 15% read is st16 — the bar % may grow
// with stage rather than be constant. Left flat until a per-stage read exists. Resolve properly by walking
// the per-bar clear damage (Coldheart's Heartseeker 0.1×maxHP = exactly 72,725 at st16 is the bar-breaker to
// key on). SIM_PURPLE_BAR_PCT / SIM_PURPLE_BAR_STEP_PCT override for A/Bs (same pattern as SIM_WARMASTER).
//
// NOT ESCALATING per Inhale. Mike's direct st16 walk (2026-08-12): the 2nd bar is ~the same size as the 1st,
// and BOTH clear (Hilvi chips #1; Coldheart's Heartseeker breaks #2). This RETIRES the earlier +5%/Inhale
// ramp, which rested on a single 2026-08-04 replay ("2nd bar bigger, couldn't clear it") that the direct
// walk contradicts. STEP default is now 0 (flat); the knob still allows re-testing a ramp.
export const PURPLE_BAR_PCT = Number(process.env.SIM_PURPLE_BAR_PCT ?? 0.15);
export const PURPLE_BAR_STEP_PCT = Number(process.env.SIM_PURPLE_BAR_STEP_PCT ?? 0.00);

/**
 * @param {object} o
 *   `waves` — array of {name, enemies[]}. **Pass null (the default) when we have no wave data**,
 *   which is currently always for Dragon: the phase is then reported as `unmodelled` rather than
 *   fabricated. The moment real wave composition exists this works with no other change.
 */
export function makeDragonContent({ stageNumber, purpleBarHp = null, waves = null, difficulty = 'Normal', boss }) {
  // Bar escalates per Inhale from the boss's max HP (see PURPLE_BAR_PCT/STEP). Pass the boss maxHp for the
  // per-Inhale computation; an explicit purpleBarHp still overrides it flat (tests / brackets).
  const kit = makeHellrazor({ stageNumber, purpleBarHp, bossMaxHp: boss?.maxHp });
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
    // "Continuous Damage Resistance I" passive (in-game skill card, user-provided 2026-08-04):
    // Poison DoT dealt TO the boss is reduced 30%. Consumed by engine.tickDots vs the boss.
    // ⚠ A sibling HP-Burn resistance may exist (unshown card) — left at 1× until confirmed.
    poisonDamageFactorVsBoss: 0.70,
  };
}

function makeHellrazor({ stageNumber, purpleBarHp = null, bossMaxHp = null }) {
  const scorchActive = stageNumber >= SCORCH_FROM_STAGE;
  // The bar is known when we have either an explicit override or the boss max HP to escalate from.
  const barKnown = purpleBarHp != null || bossMaxHp != null;
  let inhaleCount = 0;   // drives the per-Inhale bar escalation (PURPLE_BAR_PCT + STEP×(N-1))
  // Almighty Strength / Almighty Persistence at 21-25 (boss_exceptions). Recorded so the engine can
  // respect them; %maxHP capping is applied by damage-mechanics upstream.
  const endgame = stageNumber >= 21;

  const cd = { wallOfFire: 0, inhale: 0 };
  let scorchArmed = false;
  // Scorch is a %MAX-HP nuke that ESCALATES: card = "Enemy Max HP × 0.25 × (# of Skills Used + 1)"
  // (in-game skill card, user-provided 2026-08-04). Modeled as the Secret Skill's own fire count:
  // 1st fire = 0.25×maxHP, 2nd = 0.50×, 3rd = 0.75×, 4th = 1.00× (one-shot). This reproduces the
  // reality anchors — st10 you clear the bar most cycles (Scorch rarely fires, survivable when it does)
  // vs st12 solo you can't clear it, so it fires every cycle and ramps to a kill. ⚠ ASSUMPTION: the
  // counter is Scorch's own fires (validated vs anchors); the literal "# of Skills Used" could instead
  // mean the boss's TOTAL skill count — but that one-shots on the first fire, which reality rules out.
  let scorchFires = 0;

  return {
    scorchActive, endgame,

    /** One Hellrazor turn. Skill choice follows the same furthest-right-off-cooldown rule. */
    actEnemy(state, boss) {
      const allies = state.allies.filter(a => a.alive);
      if (!allies.length) return;
      // Every boss hit fires the same reactive events any attacker's hit would (on-attacked, hit_taken,
      // hp_below) so on-hit passives — Vergis Second Wind [Shield], Pelops Master-of-Games — proc on the
      // BOSS too, not only vs recipe-driven wave mobs. Hooked (state.onDamageTaken) to avoid a circular import.
      // P1: the boss's hit runs through the SHARED incoming-damage modifier stack (incomingDamage) — the same
      // Pelops −20% / Aid-the-Feeble −10% / Ezio 35%-nullify modifiers computeRawHit applies to wave-mob hits.
      // Before this, the boss was a THIRD damage path that BYPASSED the team's mitigation entirely (it never
      // called computeRawHit and dealDamage doesn't apply the modifiers), so the boss-phase survival stack was
      // silently inert against the actor that matters most. bossHit still owns the boss's flat-damage model
      // (atk × Decrease-ATK × DEF-mitigation); only the team's incoming modifiers are now applied on top.
      // AFFINITY on the boss's ATK-based hits (Swipe/Wall of Fire) — the same mechanic computeRawHit applies to
      // champion attacks (affM), but the scripted bossHit bypassed it, so the boss ignored the wheel: a Magic
      // Dragon (st20) hit a Force ally at ×1.0 instead of ×0.7 (measured 3× over on Hilve). Enemy attacks obey
      // affinity too (game fact); applied HERE (not in bossHit, which stays the pure ATK×DEF number) and NOT to
      // scorchStrike (Scorch is %MaxHP — affinity-independent, like all %MaxHP damage).
      const strike = (a, mult = 1) => { const dd = dealDamage(a, incomingDamage(state, a, bossHit(boss, a, mult) * affinityMult(state, boss.affinity, a.affinity)), 'direct', boss, state.allies); state.onDamageTaken?.(state, a, boss, dd.toHp); };
      // Scorch's hit is %MAX-HP, DEF-INDEPENDENT (does NOT go through bossHit's ATK×DEF path) and
      // escalates with scorchFires. Team incoming-damage modifiers still apply (via incomingDamage).
      const scorchStrike = (a) => { const raw = a.maxHp * 0.25 * (scorchFires + 1); const dd = dealDamage(a, incomingDamage(state, a, raw), 'direct', boss, state.allies); state.onDamageTaken?.(state, a, boss, dd.toHp); };

      // ── resolve an armed Scorch FIRST: the purple bar had to be cleared before he acts again ──
      if (scorchArmed) {
        scorchArmed = false;
        // The bar's HP is unknown, so the damage check cannot be evaluated. Rather than invent a
        // threshold we BRACKET it: SIM_SCORCH=never (optimistic — the team always clears the bar)
        // vs =always (pessimistic — it never does). Reality must sit between the two, and the gap
        // between them measures how much this one unmodelled mechanic is worth.
        const mode = process.env.SIM_SCORCH ?? 'never';
        if (!barKnown && mode !== 'always') {
          flag(state, 'UNMODELLED: purple-bar HP unknown — Scorch SKIPPED (optimistic bound)');
          boss.turnMeter = 0; state.log.push({ turn: state.turn, phase: 'boss', event: 'scorch interrupted — turn wasted (optimistic bound)' }); return;   // optimistic = team cleared the bar → turn WASTED (see the interrupted branch)
        } else if (!barKnown && mode === 'always') {
          flag(state, 'UNMODELLED: purple-bar HP unknown — Scorch ALWAYS fires (pessimistic bound)');
          for (const a of allies) { scorchStrike(a); applyDebuff(a, { type: 'Stun', turns: 1 }); }
          scorchFires += 1;
          state.log.push({ turn: state.turn, phase: 'boss', event: 'SCORCH (pessimistic bound)' });
          return;
        } else if (state.purpleBarLeft > 0) {
          // SCORCH — %maxHP AoE nuke (escalating) + a 1-turn Stun on the whole team.
          for (const a of allies) {
            scorchStrike(a);
            applyDebuff(a, { type: 'Stun', turns: 1 });
          }
          scorchFires += 1;
          state.log.push({ turn: state.turn, phase: 'boss', event: 'SCORCH', barLeft: Math.round(state.purpleBarLeft), fires: scorchFires });
          return;
        } else {
          // Bar cleared → Scorch re-locked. VERIFIED (Mike, in-game 2026-07-26): the turn is WASTED — Hellrazor
          // does NOT fall back on a normal skill (no Swipe/Wall of Fire); his TM resets to 0 and the team gets a
          // fresh window. (Previously this fell THROUGH to a normal action, over-crediting the boss a free hit on
          // the very turn you clear the bar — the bug the model-boss assertions surfaced.)
          boss.turnMeter = 0; state.log.push({ turn: state.turn, phase: 'boss', event: 'scorch interrupted — turn wasted' }); return;
        }
      }

      // ── Inhale (cd 3): drains his own Turn Meter and arms Scorch ──
      if (scorchActive && cd.inhale <= 0) {
        cd.inhale = 3; scorchArmed = true; inhaleCount += 1;
        // ESCALATING bar: Nth Inhale = maxHP × (PURPLE_BAR_PCT + PURPLE_BAR_STEP_PCT×(N-1)). No reset on clear.
        state.purpleBarLeft = purpleBarHp != null ? purpleBarHp
          : (bossMaxHp != null ? bossMaxHp * (PURPLE_BAR_PCT + PURPLE_BAR_STEP_PCT * (inhaleCount - 1)) : 0);
        boss.turnMeter = 0;   // Inhale drains the boss Turn Meter
        state.log.push({ turn: state.turn, phase: 'boss', event: 'INHALE — purple bar armed' });
        return;
      }

      // ── Wall of Fire (cd 3): AoE + two 5% Poison (3t) + 25% Weaken (2t) ──
      if (cd.wallOfFire <= 0) {
        cd.wallOfFire = 3;
        for (const a of allies) {
          strike(a, 3.4);   // Wall of Fire = 3.4× ATK (in-game skill card, user-provided 2026-08-04)
          for (let i = 0; i < 2; i++) landDebuff(state, boss, a, { type: 'Poison', pct: 0.05, turns: 3, stacking: true, maxStacks: 10 });   // ROLLS boss ACC vs ally RES (was unconditional); at the boss's high ACC this still lands ~always
          applyDebuff(a, { type: 'Weaken', value: 25, turns: 2 });
          state.onAllyDebuffed?.(state, a, 'Poison');    // route through the Sleeping Sage sponge (recipe-run only)
          state.onAllyDebuffed?.(state, a, 'Weaken');
        }
        state.log.push({ turn: state.turn, phase: 'boss', event: 'Wall of Fire' });
        return;
      }

      // ── Swipe: 3× ATK AoE + 50% Decrease ATK (2t) (in-game skill card, user-provided 2026-08-04) ──
      for (const a of allies) {
        strike(a, 3);
        applyDebuff(a, { type: 'Decrease Attack', value: 50, turns: 2 });
        state.onAllyDebuffed?.(state, a, 'Decrease Attack');   // Bambus can sponge it → dumps onto the boss (halves its own hits)
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
function bossHit(boss, target, mult = 1) {
  // ⚠ was `const DEF_K = 1500` here — a DUPLICATE that shadowed the engine's export and silently
  // made a sensitivity test read as "no effect across a 40x range". One constant, one definition.
  // `mult` = the SKILL's ATK multiplier (in-game skill cards, user-provided 2026-08-04): Swipe 3×,
  // Wall of Fire 3.4×. Was hardcoded 1× for every skill — the boss under-hit ~3× and could not kill.
  const bossAtkMod = boss.debuffs.some(d => d.type === 'Decrease Attack') ? 0.5 : 1;
  // DEF mitigation keys on the DEFENDER (target champ) level, not the boss's L280 — see defMitLevel().
  return boss.atk * mult * bossAtkMod * defMitigation(effectiveDef(target), defMitLevel(boss, target));   // a DEF-shred on the ally boosts his hit
}

export { bossHit };
