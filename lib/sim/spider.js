// lib/sim/spider.js — Spider's Den (Skavag the Spider Queen) content for the ONE engine.
//
// Skavag + her Spiderlings are CONTENT (not player champions; champion_id NULL), so they are SCRIPTED here
// exactly as Hellrazor is in dragon.js. Sourced from the in-game card (Tier-1, Stage-13) + community-
// datamined coefficients (flagged) — full spec in knowledge/SPIDER_SIM_BUILD.md.
//
// Slice B scope: the spawn / consume-snowball mechanic + the always-on factors (lifesteal 35%, 90% Poison
// reduction vs Skavag). The 21-25 boss passives (Almighty Strength / Almighty Persistence) are wired as
// content flags but only bite at stage ≥21 — deferred to Slice C (the anchor is Stage 13).

import { flag, makeCombatant, applyDebuff, landDebuff, dealDamage, computeRawHit, decreaseTurnMeter, chooseAllyTarget, rollChance, recordEffect, effectiveSpeed, rollEvade } from './engine.js';
import { recordTargeting } from './interpreter.js';   // emit the 'target' event so turn-verify can VERIFY Taunt/Veil steer the Spiderlings
import { champKey, combatantKey } from './recipes.js';   // records-only: identify Pelops in the Taunt-trace telemetry (combatantKey = identity by id)

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
// Spiderling entry Turn Meter (Mike first-party 2026-07-29, corrected): ONLY the dungeon's OPENING drop
// enters at ~full TM (they get an immediate opening turn); EVERY subsequent drop (per-ally-turn, per-Skavag-
// turn) enters at 0 TM and must ramp from empty. This is load-bearing for turn-order: a flat 66% for all
// spawns let the ever-respawning swarm perpetually crowd out the slow boss (Skavag turn-share 26% low →
// too few consumes → she never ramps → boss dies ~73t vs reality ~181t). Opening-only high-TM lets her
// keep her fair share.
// OPENING TURN ORDER (Mike first-party 2026-07-30, exact recording t1-19): the team ACTS first (Bambus…Ezio),
// THEN the opening spiderlings act (they SPAWN at near-full TM so they act right after the team and reset), and
// Skavag's first turn is t19. Reproduced by: allies open at FULL TM (act first, speed tie-break in nextActor),
// opening spiders at near-full TM (99), and the opening spawn CHARGES Skavag +50% TM (only the opening — later
// spawns add none). Skavag is slow (spd 95 = a spiderling), so that one +50% is her whole turn-share head start.
const SPAWN_SPIDERLING_TM_OPENING = Number(process.env.SIM_SPIDERLING_OPENING_TM ?? 77);   // opening 6 enter at ~77% TM — just below Ezio's opening TM (~78) so ALL 5 allies act first, THEN the 6 spiders (Mike first-party 2026-07-31, exact t1-19); the perAllyTurn spawns enter at 0
// OPENING TURN-METER model (Mike first-party 2026-07-31, verbatim): the battle opens with EVERYONE (team + boss)
// at 0 TM. The opening 6-spawn advances the turn-meter clock ~6 turns' worth, filling every unit BY ITS OWN
// SPEED — so the fastest champs reach full and the slow boss lands at 50%. The observed opening order (Bambus
// 192 = Tagoar 173 full > Vergis 166 > Pelops 159 > Ezio 148 > Skavag 95 = 50%) is EXACTLY the speed ranking.
// After that: normal speed-filling, NO artificial boss charge — Skavag climbs 50% → 100% on her own SPD and
// her first turn lands ~t16-21. K is anchored so the boss (spd 95) → 50% (env-overridable to calibrate).
const OPENING_TM_ADVANCE = Number(process.env.SIM_OPENING_TM_ADVANCE ?? (50 / 95));
// Skavag's opening TM, DECOUPLED from the team's (Mike first-party 2026-07-31: her first turn lands ~t19, AFTER
// the team's 2nd cycle + the first 8 spiderlings — the speed-scaled 50% put her at t14, too early). null → fall
// back to the old speed×advance formula; a number sets her opening TM absolutely (calibrated to hit t19).
const SKAVAG_OPENING_TM = Number(process.env.SIM_SKAVAG_OPENING_TM ?? 30);   // 30 → her 1st turn lands ~t19 (after the team's 2nd cycle + the first 8 spiders). Reality varies t19-21 (boss moves after 8 or all 10 spiders — Mike first-party 2026-07-31); this hits the 8-spider case. Old speed-scaled 50% put her at t14.
const SPAWN_SPIDERLING_TM_SUBSEQUENT = 0; // all later drops: no TM
// Spiderling direct-hit coefficient — the team's PRIMARY wear-down (Mike first-party 2026-07-29: the
// spiderlings' team damage is mainly ATTACK, NOT poison; Bambus's sponge mitigates most of the poison).
// RESOLVED from a first-party per-hit anchor: a spiderling basic hits Tagoar (in-battle def 1130, Magic —
// neutral vs Void, spiderlings have 0 crit) for ~2100; coeff 1.0 gave 937, so 2100/937 ≈ 2.24. Effect
// (spider13, 50 seeds): WR 98%→88% (→reality 71%), death/revive churn emerges. Still SIM-overridable.
const SPIDERLING_COEFF = Number(process.env.SIM_SPIDERLING_COEFF ?? 2.24);
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
  const spawn = (state, n, tm = SPAWN_SPIDERLING_TM_SUBSEQUENT) => {
    const k = Math.min(n, Math.max(0, SPAWN.max - living(state).length));   // no reserve/queue — cap is hard
    for (let i = 0; i < k; i++) {
      const t = spawnTemplate;
      state.enemies.push(makeCombatant({ name: `Spiderling#${(state.spiderSeq = (state.spiderSeq ?? 0) + 1)}`,
        side: 'enemy', role: 'add', level: t.level, maxHp: t.maxHp, atk: t.atk, def: t.def, spd: t.spd,
        acc: t.acc, res: t.res, critRate: t.critRate, critDmg: t.critDmg, affinity: t.affinity,
        turnMeter: tm }));   // opening 6 enter at ~90% TM; all later drops at 0 TM (Mike first-party 2026-07-29/31)
    }
    if (k > 0) state.log?.push({ turn: state.turn, phase: 'skavag', event: `spawn ${k}`, adds: living(state).length });
    return k;
  };

  // one AoE ATK attack (Venom Spray / Stupefying Silk) through the ONE engine's damage math (computeRawHit
  // already routes enemy→ally through the incoming-mitigation stack — no third damage path).
  // Returns the set of ally names that EVADED this skill (Michelangelo A4) — the Silk branch skips them for the
  // accompanying TM-decrease/Sleep effects too, so the WHOLE skill is negated on an evader (card-verified).
  const aoeStrike = (state, coeff, { poisonBonus = false } = {}) => {
    const evaded = new Set();
    for (const a of state.allies.filter((x) => x.alive)) {
      if (rollEvade(state, a, boss, (rec) => recordEffect(state, { source: `${a.name} [P]`, ...rec }))) { evaded.add(a.name); continue; }
      const F = { scalingStat: 'ATK', multiplier: coeff, hitCount: 1, flags: { crit: true, affinity: true, variance: true, def_mitigation: true } };
      let { raw } = computeRawHit(state, boss, a, F);
      if (poisonBonus && (a.debuffs ?? []).some((d) => d.type === 'Poison')) raw *= 1.15;   // card: +15% vs a Poisoned target
      const dd = dealDamage(a, raw, 'direct', boss, state.allies);
      state.onDamageTaken?.(state, a, boss, dd.toHp);
    }
    return evaded;
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
      const evaded = aoeStrike(state, STUPEFYING_SILK_COEFF);
      for (const a of state.allies.filter((x) => x.alive)) {
        if (evaded.has(a.name)) continue;                                  // evaded the whole skill → no TM decrease / Sleep either
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
    // 3. END OF TURN — spawn 4 (she re-seeds even right after consuming all). The drop is a SEPARATE
    //    mechanic from digesting the swarm and fires every Skavag turn, consume or not (Mike first-party 2026-07-29).
    spawn(state, SPAWN.onSkavagTurnEnd);
  }

  function spiderlingAct(state, sp) {
    const target = chooseAllyTarget(state.allies, sp, state);              // single-target, mitigation-aware "easiest to kill" (respects Taunt/Veil)
    if (!target) return;
    recordTargeting(state, state.allies, target);                          // MODEL VISIBILITY: emit the 'target' event so turn-verify checks whether Taunt steered this pick onto Pelops (and Veil kept a veiled ally out)
    // RECORDS-ONLY Taunt-trace telemetry (golden-safe: ledger entry only, no battle-logic change). Logs EVERY
    // Spiderling pick with Pelops's live Taunt state so sim-spider-taunt.mjs can assert the targeting invariants
    // (valid-Taunt ⇒ Pelops picked; attacks_on_Pelops = while_taunted + off_taunt_on_Pelops) NON-circularly.
    const pel = state.allies.find((a) => combatantKey(a) === champKey('Pelops the Victor'));
    const pelTauntable = !!pel && pel.alive && !(pel.buffs ?? []).some((b) => b.type === 'Perfect Veil');
    recordEffect(state, { kind: 'spider_pick', subtype: 'targeting', actor: sp.name, target: target.name,
      reason: (target.buffs ?? []).some((b) => b.type === 'Taunt' || b.type === 'Provoke') ? 'TAUNT' : 'EASIEST_TO_KILL',
      pelTauntable, pelTaunting: pelTauntable && (pel.buffs ?? []).some((b) => b.type === 'Taunt' || b.type === 'Provoke'),
      pelPicked: !!pel && combatantKey(target) === champKey('Pelops the Victor') });
    // EVADE (Michelangelo A4): the picked defender may negate this spiderling's whole attack (damage + poison).
    if (rollEvade(state, target, sp, (rec) => recordEffect(state, { source: `${target.name} [P]`, ...rec }))) return;
    const F = { scalingStat: 'ATK', multiplier: SPIDERLING_COEFF, hitCount: 1, flags: { crit: true, affinity: true, variance: true, def_mitigation: true } };
    const { raw } = computeRawHit(state, sp, target, F);
    const dd = dealDamage(target, raw, 'direct', sp, state.allies);
    state.onDamageTaken?.(state, target, sp, dd.toHp);
    // Each of the TWO 5% Poisons rolls a PLACEMENT chance FIRST, then the ACC-vs-RES resist. Mike first-party
    // (watching battles 2026-07-28): Poison lands ~35% of the time on Pelops (RES 57). Pure ACC/RES would be
    // ~95%, so the Spiderling attack carries a placement chance the in-game card doesn't state. ⚠ ESTIMATE
    // (SIM override), not datamined: SPIDERLING_POISON_CHANCE × landChance(75,57)=0.955 ≈ 0.35 net → ~0.37.
    let placed = 0;
    for (let i = 0; i < 2; i++) if (rollChance(state?.rng?.debuff, SPIDERLING_POISON_CHANCE)) { landDebuff(state, sp, target, { type: 'Poison', pct: 0.05, turns: 2, stacking: true, maxStacks: 10 }); placed++; }
    // Route the ally-poison through Bambus's Sleeping Sage sponge. Scripted landDebuff does NOT auto-sponge
    // (only interpreter PLACE_DEBUFF does, line 398); scripted enemies must call the hook explicitly, exactly as
    // dragon.js:129 does. Its absence here STARVED Bambus's poison-redirect of ALL its Spider fuel (356k vs
    // reality ~1.08M) — the sponge/dump wiring was correct, the spiderling poison just never reached it.
    if (placed) state.onAllyDebuffed?.(state, target, 'Poison');
  }

  return {
    name: "Spider's Den", stageNumber,
    clearOnBossDeath: true,                        // win = Skavag dead (Spiderlings die with her)
    lifestealFactor: 0.35,                         // card: lifesteal heals only 35% vs Skavag / Spiderlings
    poisonDamageFactorVsBoss: 0.10,                // Healing Assured: Poison deals 10% of normal to Skavag (−90%)
    maxHpDamageCap: endgame ? 0.10 : null,         // Almighty Strength (21-25) — engine caps ENEMY-MAX-HP SKILL hits (not DoT); Slice C verifies
    tmReductionFactorVsBoss: endgame ? 0.50 : 1,   // Almighty Persistence (21-25) — TM reduction to Skavag halved; wired in Slice C
    phases: [{ name: 'skavag', enemies: [boss], actEnemy: actSpider }],
    onPhaseStart(state) {
      state.discreteScheduler = true;                                                    // SPIDER-ONLY: discrete-overflow scheduler (Dragon keeps the continuous path)
      state.addsUntargetableBySingle = true;                                              // SPIDER-ONLY: nobody attacks Spiderlings directly — single-target hits the boss, adds die only to AoE/DoT/consume (Mike first-party 2026-07-31)
      state.shieldDeterrentTargeting = true;                                              // SPIDER-ONLY: shields are a BIG targeting deterrent — off-Taunt the swarm focuses the LEAST-shielded champ (shieldless Pelops after his Magma empties), NOT the high-DEF-hidden pick (Mike first-party 2026-07-31)
      // OPENING (Mike first-party 2026-07-31, exact t1-19): the team acts first in pure speed order (Bambus…Ezio),
      // THEN the 6 opening spiders (positions 6-11), THEN the team's 2nd cycle with Sp7/Sp8 overflowing in, and
      // Skavag's 1st turn lands on t19. The opening 6 enter BELOW Ezio's opening TM so all 5 allies precede them;
      // the perAllyTurn +2 spawns (Sp7/Sp8) enter at 0 TM and overflow past Ezio's 2nd turn; Skavag's opening TM
      // is decoupled (SKAVAG_OPENING_TM) so her slow fill lands her at t19 rather than the t14 the 50% pulse gave.
      for (const a of state.allies) if (a.alive) a.turnMeter = 0;
      boss.turnMeter = 0;
      spawn(state, SPAWN.onRoundStart, SPAWN_SPIDERLING_TM_OPENING);                      // opening 6 at ~77% TM (just below Ezio → all 5 allies act first)
      for (const a of state.allies) if (a.alive) a.turnMeter = Math.min(100, effectiveSpeed(a) * OPENING_TM_ADVANCE);
      boss.turnMeter = SKAVAG_OPENING_TM != null                                          // opening-spawn pulse: team fills by speed; Skavag's start is decoupled so her 1st turn lands ~t19 (Mike first-party)
        ? SKAVAG_OPENING_TM
        : Math.min(100, effectiveSpeed(boss) * OPENING_TM_ADVANCE);
    },
    onTurnStart(state, actor) { if (actor.side === 'ally') spawn(state, SPAWN.perAllyTurn); },   // +2 per ally turn (incl. Extra Turns)
  };
}
