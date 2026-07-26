// lib/sim/engine.js — a TURN-ORDERED battle engine. The scoring core's replacement.
//
// WHY THIS EXISTS (Mike, 2026-07-22): Raid is a turn-based game and our model had no turn axis.
// Demonstrated: the same team at Spider stage 5 and stage 20 produced byte-identical output
// (killTurns 41.805, confidence 0.730) while boss HP grew 38x, add HP 38x and enemy ATK 24.5x —
// because for a %maxHP team `killTurns = bossHp / (teamDamage/turns)` cancels exactly. Seven
// stage-varying quantities sit in `dungeon_stage_enemies` and enter no calculation.
//
// THE ARCHITECTURAL POINT, which is the reason for a loop rather than more terms: a closed-form
// aggregate lets you omit an input SILENTLY. A turn loop cannot resolve a turn without knowing who
// acts, who is targeted, and how hard the hit lands — so omissions become impossible rather than
// invisible. Five temporal mechanics needed five separate approximations in the aggregate and we had
// built zero of five. The loop gets them from one mechanism.
//
// TWO HARD RULES CARRIED IN FROM `MODEL_AS_REIMPLEMENTATION.md`:
//   1. NO NEW FITTED CONSTANTS. This engine must DELETE `STAGE_EHP_MULTIPLIER` (2.89 etc.), not
//      grow a sibling. Where a magnitude is unknown we emit a FLAG, never a plausible number.
//   2. Every unknown is reported per battle. A silent default is how 2.89 and phantom ACC happened.

import { readSkillKit, classifySkill, canUseSkill } from './ai.js';
import { RECIPES } from './recipes.js';   // read-only: incomingDamage() scans champions' `modifiers` (recipes.js imports nothing → no cycle)

// THE recipe dispatch. interpreter.js registers itself into recipe-registry.js at load (triggered by the
// bottom-of-file side-effect import below), making the ONE combat engine — recipeFor(authored) ||
// kitToRecipe(auto-parse) → applyRecipe — available on EVERY path, even tools that never call installRecipeRun,
// which is what lets applySkill be deleted. `dispatchSkill` prefers a per-state hook (installRecipeRun's richer
// recipeAct, which also wires turn/round triggers) and falls back to the registered module default.
import { dispatchViaRegistry } from './recipe-registry.js';
function dispatchSkill(state, actor, skill) {
  return state.recipeAct ? state.recipeAct(state, actor, skill) : dispatchViaRegistry(state, actor, skill);
}

// ── combatant ────────────────────────────────────────────────────────────────
/**
 * @param {object} o real stats — allies from Gestal (true gear), enemies from dungeon_stage_enemies.
 *   `statsTrust` records WHICH of those are real: Dragon boss HP is measured, but ATK/DEF/RES are a
 *   SHARED SYNTHETIC LADDER (identical across all four dungeons) and must never be read as truth.
 */
export function makeCombatant(o) {
  return {
    name: o.name, side: o.side, role: o.role ?? 'champion',
    maxHp: o.maxHp ?? 0, hp: o.maxHp ?? 0,
    level: o.level ?? 60,                 // ATTACKER level drives the DEF-mitigation curve (mobs scale high — Dragon-17 = L220)
    atk: o.atk ?? 0, def: o.def ?? 0, spd: o.spd ?? 0,
    acc: o.acc ?? 0, res: o.res ?? 0,
    critRate: o.critRate ?? 0, critDmg: o.critDmg ?? 0,
    affinity: o.affinity ?? null,
    tags: o.tags ?? [],
    lifesteal: o.lifesteal ?? 0,          // fraction of damage dealt self-healed (Lifesteal 4-set = 0.30)
    bossMastery: o.bossMastery ?? false,  // carries Warmaster/Giant Slayer -> WARMASTER_MAXHP per attacking turn
    gearProcs: o.gearProcs ?? [],         // COMPLETE chance-proc gear sets (lib/sim/gear.js); on-attack GEAR_PROC family
    skills: o.skills ?? [],
    skillOrder: o.skillOrder ?? null,     // CONFIRMED non-default slot order (e.g. Ezio ['A2','A3','A1']); null => default A3>A2>A1
    statsTrust: o.statsTrust ?? {},
    turnMeter: 0, alive: true,
    buffs: [], debuffs: [],
    diedOnTurn: null, diedInPhase: null,
  };
}

// ── damage ───────────────────────────────────────────────────────────────────
// Raid's REAL, source-verified DEF-mitigation curve (replaces the old DEF_K/(DEF_K+def) placeholder). The
// fraction of damage REMOVED is R = 0.85·(1 − e^(−2·D/(50·L))), where D = target's effective DEF and L =
// the ATTACKER's level; the retained multiplier is 1 − R. It asymptotes to 15% retained (the 85% DEF
// ceiling, never reached at finite DEF). LEVEL-DEPENDENT is the whole point: a Dragon-17 mob is L220 and
// penetrates DEF far more than the level-agnostic placeholder assumed. Verified vs the published table
// (L60: DEF 1000→41.35% removed, 3000→73.5%, ∞→85%). Ignore-DEF is applied to DEF BEFORE this curve.
export const defMitigation = (def, level = 60) => 1 - 0.85 * (1 - Math.exp(-2 * Math.max(0, def ?? 0) / (50 * (level || 60))));
// Warmaster / Giant Slayer bonus per attacking turn, as a fraction of the TARGET's max HP (DEF-independent).
// 4% MAX HP × 60% proc = 0.024, taken verbatim from cb-damage-model.js (a game-grounded aggregate, not a
// corpus fit). SIM_WARMASTER overrides for sensitivity. Only champions with a boss mastery apply it.
// WARMASTER_MAXHP is the EXPECTED value (raw × proc). The stochastic path (seeded) rolls the 60% proc and
// applies the RAW magnitude on a hit; the deterministic path (seed=null) applies the EV, unchanged. RAW is
// DERIVED from the EV and the proc (WARMASTER_MAXHP / WARMASTER_PROC) so it stays EV-consistent even when
// SIM_WARMASTER overrides the EV — no new fitted constant, per MASTERY_PROC in knowledge/RNG_REGISTRY.md.
export const WARMASTER_MAXHP = Number(process.env.SIM_WARMASTER ?? 0.024);
export const WARMASTER_PROC = Number(process.env.SIM_WARMASTER_PROC ?? 0.60);
export const WARMASTER_RAW = WARMASTER_PROC > 0 ? WARMASTER_MAXHP / WARMASTER_PROC : 0;
export const critFactor = (cr, cd) => 1 + (Math.min(100, cr ?? 0) / 100) * ((cd ?? 0) / 100);

// ── RNG ────────────────────────────────────────────────────────────────────────
// mulberry32 — a small, well-distributed, SEEDED PRNG. Seeded (never Math.random) so a Monte-Carlo
// run is REPRODUCIBLE and the QA ladder stays deterministic given a seed. The whole reason the engine
// needs this: Raid is stochastic (debuffs land on ACC-vs-RES probability, crits roll, procs roll), and
// a single deterministic pass can only ever show ONE point of a distribution — it cannot reproduce a
// fight that "nearly wiped this run" because Ezio's veil proc'd less. Run N seeds -> a WIN-RATE and a
// turn distribution, which is what reality is. state.rng===null preserves the v0 threshold so the 120
// teeth-tests (which assert exact outcomes) are byte-for-byte unchanged.
export function makeRng(seed) {
  let a = (seed >>> 0) || 1;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// SEPARATE STREAMS, one per mechanic (Mike's spec): changing a damage formula must not shift the
// target-selection or debuff roll sequence, or a code change silently perturbs unrelated rolls and
// two runs at the same seed stop being comparable. Each stream is independently seeded from the master
// seed, so the streams are decorrelated and each mechanic consumes its own roll budget.
// APPEND-ONLY: each stream is seeded by its INDEX, so a new stream at the end never perturbs the earlier
// streams' sequences (a seeded run's damage/crit/debuff rolls stay byte-identical). 'mastery' = MASTERY_PROC
// (Warmaster/Giant Slayer). 'affinity' and 'ai' are reserved (declared, not yet drawn) — see RNG_REGISTRY.md.
export const RNG_STREAMS = ['damage', 'crit', 'affinity', 'debuff', 'target', 'ai', 'mastery', 'gear'];
export function makeRngStreams(seed) {
  const s = (seed >>> 0) || 1;
  const bundle = {};
  RNG_STREAMS.forEach((name, i) => { bundle[name] = makeRng((s ^ Math.imul(0x9E3779B1, i + 1)) >>> 0); });
  return bundle;
}
// Generic Bernoulli against ONE stream. DETERMINISTIC (stream null): the v0 threshold p>0.5. STOCHASTIC:
// a real roll. Used for every land/proc/placement decision so they all share one honest definition.
// Deterministic CHANCE POLICY (no RNG stream): how a %-chance effect resolves in a no-RNG run.
//   'threshold' (default) — land iff chance > 50% (or guaranteed). 'all' — everything lands. 'none' — only
//   guaranteed (100%) effects land. Stated explicitly per Mike: a no-RNG run must declare its chance policy.
export let CHANCE_MODE = 'threshold';
export function setChanceMode(m) { CHANCE_MODE = m; }
// SIM_LAND_P: force EVERY chance (debuff placement, ACC/RES land, procs) to a fixed rate — a diagnostic
// to bracket outcome sensitivity to landing (0 = nothing lands, 0.5 = coin-flip, 1 = all). Null = use the
// real per-event chance. Overrides the stated p; seeded → rolls at SIM_LAND_P, deterministic → threshold on it.
export const FORCE_LAND_P = (process.env.SIM_LAND_P != null && process.env.SIM_LAND_P !== '') ? Number(process.env.SIM_LAND_P) : null;
export function rollChance(stream, p) {
  const pp = FORCE_LAND_P != null ? FORCE_LAND_P : p;
  if (!stream) { if (CHANCE_MODE === 'all') return true; if (CHANCE_MODE === 'none') return pp >= 1; return pp >= 1 || pp > 0.5; }
  return stream() < pp;
}
// A debuff land decision draws from the DEBUFF stream (see rollChance). Kept as a named helper so call
// sites read as intent, not plumbing.
export function rollLand(state, p) { return rollChance(state?.rng?.debuff, p); }
// Crit multiplier. DETERMINISTIC: the EXPECTED value (critFactor — average over many hits). STOCHASTIC:
// roll the CRIT stream once -> full C.DMG on a crit, ×1 otherwise (the real per-hit behaviour + variance).
// SIM_CRIT=ev holds crit at its EXPECTED value (critFactor) even under a seeded stream — a diagnostic to
// remove crit variance while keeping the other RNG (landing/target). Null/unset = normal per-hit crit roll.
export const FORCE_CRIT_EV = /^(1|ev|true|yes)$/i.test(process.env.SIM_CRIT ?? '');
// [Increase C.RATE] buff raises the champion's EFFECTIVE crit rate (non-stacking — take the largest, like
// the other stat buffs). Consumed by feeding effectiveCritRate into critMult at every attack site.
export const critRateBuff = (c) => { const v = (c.buffs ?? []).filter(b => b.type === 'Increase C.RATE').map(b => b.value ?? 0); return v.length ? Math.max(...v) : 0; };
export const effectiveCritRate = (c) => Math.min(100, (c.critRate ?? 0) + critRateBuff(c));
export function critMult(state, cr, cd) {
  if (FORCE_CRIT_EV) return critFactor(cr, cd);
  const stream = state?.rng?.crit;
  if (stream) return stream() < Math.min(100, cr ?? 0) / 100 ? 1 + (cd ?? 0) / 100 : 1;
  return critFactor(cr, cd);
}
// Per-hit damage variance (Raid rolls damage inside a small band around the computed value). The band's
// exact width is NOT a verified number we own, so it defaults to 0 (no variance) and is a FLAGGED
// ASSUMPTION when enabled via SIM_DMG_VAR — never a silently-guessed ±%. Draws from the DAMAGE stream.
export const DMG_VAR = Number(process.env.SIM_DMG_VAR ?? 0);
export function dmgVariance(state) {
  const stream = state?.rng?.damage;
  if (!stream || DMG_VAR <= 0) return 1;
  return 1 + (stream() * 2 - 1) * DMG_VAR;   // uniform in [1-VAR, 1+VAR]
}

// multiplier_type: a coefficient scales off the ATTACKER'S OWN stat, named by skill.coeffStat
// (ai.js parseCoeff). HP-scaling (Pelops 0.4 HP) and DEF-scaling (Vergis 3.9 DEF) heroes deal 0 —
// or the wrong number — until the damage calc multiplies by the RIGHT stat instead of always ATK.
export const scaleStat = (c, stat) => stat === 'hp' ? (c.maxHp ?? 0) : stat === 'def' ? (c.def ?? 0) : stat === 'spd' ? (c.spd ?? 0) : (c.atk ?? 0);
// A skill's base damage = the SUM of its stat terms (multi-term formulas like "2.5 ATK + 0.2 HP"),
// plus an optional per-target-debuff bonus ("(2 + Total Debuff) ATK" adds 1×ATK per debuff on the
// target). Falls back to the single coeff×stat for skills built without coeffTerms (every spec test,
// and any simple skill). One definition so champions and mobs compute damage identically.
export function skillBase(actor, skill, target) {
  if (skill.coeffTerms && skill.coeffTerms.length) {
    let base = skill.coeffTerms.reduce((s, tm) => s + tm.coeff * scaleStat(actor, tm.stat), 0);
    if (skill.perTargetDebuff) base += skill.perTargetDebuff * (target?.debuffs?.length ?? 0) * (actor.atk ?? 0);
    return base;
  }
  return scaleStat(actor, skill.coeffStat) * skill.coeff;
}

// [Decrease Defense] lowers the target's EFFECTIVE DEF, which — per damage-mechanics.js §1/§2 (a GAME
// FACT, not calibration) — boosts ATK-vs-DEF ATTACK damage ONLY. DoT (Poison/HP Burn) scales off maxHp
// and is DEF-independent, so it must NOT be routed through this (tickDots never is). The debuff carries
// its OWN magnitude in `value` (60% strong / 30% weak), so NO constant is introduced — this reads the
// data, it does not fit a number. Multiple Decrease DEF do NOT stack; take the largest present.
// Buff/debuff STAT modifiers, folded into ONE effective multiplier for a stat. Increase X (buff) and
// Decrease X (debuff) each carry their OWN % in `value` — read from data, NO constant introduced. Same-type
// copies do NOT stack: take the largest present (Raid refreshes duration, never stacks magnitude). Note the
// real game naming asymmetry — buffs are abbreviated ('Increase ATK') but debuffs are spelled out
// ('Decrease Attack'); both forms are accepted so a rename never silently drops a modifier. Net = (1+up)(1−down).
const STAT_MODS = {
  atk: { up: ['Increase ATK', 'Increase Attack'],  down: ['Decrease Attack', 'Decrease ATK'] },
  def: { up: ['Increase DEF', 'Increase Defense'], down: ['Decrease Defense', 'Decrease DEF'] },
  spd: { up: ['Increase SPD', 'Increase Speed'],   down: ['Decrease Speed', 'Decrease SPD'] },
};
export function statFactor(c, stat) {
  const m = STAT_MODS[stat]; if (!m) return 1;
  const best = (names, pool) => { const v = (pool ?? []).filter((x) => names.includes(x.type)).map((x) => (x.value ?? 0) / 100); return v.length ? Math.max(...v) : 0; };
  const up = best(m.up, c.buffs);
  const down = Math.min(1, best(m.down, c.debuffs));
  return (1 + up) * (1 - down);
}
// [Increase DEF] / [Decrease Defense] fold into the target's EFFECTIVE DEF. Per damage-mechanics.js §1/§2
// (a GAME FACT, not calibration) this scales ATK-vs-DEF ATTACK damage ONLY — DoT is DEF-independent and is
// never routed here. Multiple Decrease DEF still take the largest (statFactor's non-stack rule preserves the
// prior behaviour); Increase DEF is the newly-consumed half.
export function effectiveDef(target) { return (target.def ?? 0) * statFactor(target, 'def'); }
// The attacker's scaling stat AFTER its OWN stat buffs/debuffs: an ATK-scaler under [Decrease Attack] hits
// softer, and a DEF-scaler (Vergis, 3.9×DEF) under [Increase DEF] hits harder. Used by the recipe damage base.
export const effectiveScaleStat = (c, stat) => scaleStat(c, stat) * statFactor(c, stat);
// [Increase SPD] / [Decrease Speed] fold into EFFECTIVE speed, which the scheduler uses to fill turn meter —
// a faster champion reaches its turn sooner and acts more often. Same non-stacking, data-driven statFactor
// (each effect carries its own % in `value`; NO constant). This is the TURN-ORDER consumer for SPD buffs/
// debuffs that were previously placed-but-inert (the DAMAGE side of SPD scaling already routes via
// effectiveScaleStat). A full 100% [Decrease Speed] folds to 0 → excluded from the pool, never acts.
export const effectiveSpeed = (c) => (c.spd ?? 0) * statFactor(c, 'spd');
// TURN METER MANIPULATION. Turn meter is a 0–100 bar that nextActor fills by effectiveSpeed. Raid's
// "Decrease Turn Meter by X%" removes X POINTS of the FULL bar (not X% of the current value); "Fill /
// Increase Turn Meter by X%" adds X points. Instant effects, not lasting statuses. Filling to 100 makes a
// combatant act next (nextActor's time-to-100 is 0). Return the actual delta so the ledger can record it.
export function decreaseTurnMeter(c, pts) { const b = c.turnMeter ?? 0; c.turnMeter = Math.max(0, b - pts); return b - c.turnMeter; }
export function fillTurnMeter(c, pts) { const b = c.turnMeter ?? 0; c.turnMeter = Math.min(100, b + pts); return c.turnMeter - b; }
// [Poison Sensitivity] amplifies the damage the target takes from each [Poison] tick by its OWN % (Ezio A2
// places 25%). The poison analogue of the stat consumers and the DoT counterpart of Decrease DEF — a NON-DEF
// multiplier on the %maxHP poison source (damage-mechanics.js §Poison Sensitivity). Reads the effect's `value`
// from data → NO constant. Non-stacking: take the largest present, matching statFactor's refresh-not-stack
// rule (a re-applied Poison Sensitivity refreshes, it does not add magnitudes). Consumed in tickDots.
export const poisonSensitivity = (c) => {
  const vals = (c.debuffs ?? []).filter((d) => d.type === 'Poison Sensitivity').map((d) => (d.value ?? 0) / 100);
  return vals.length ? Math.max(...vals) : 0;
};
// [Reflect Damage] buff: an attacker of a champion under this buff takes `value`% of the damage it inflicted
// (glossary: "any attacker of a target with this buff takes 15/30% of the damage they inflicted"). Vergis A1
// places 30%. Read from data → NO constant; non-stacking (max), matching the other consumers. Consumed in
// dealDamage, reflected to the attacker's HP.
export const reflectDamage = (c) => {
  const vals = (c.buffs ?? []).filter((b) => b.type === 'Reflect Damage').map((b) => (b.value ?? 0) / 100);
  return vals.length ? Math.max(...vals) : 0;
};

// Affinity wheel: Magic > Spirit > Force > Magic. Void is neutral both ways.
const BEATS = { Magic: 'Spirit', Spirit: 'Force', Force: 'Magic' };
// v0 DETERMINISTIC reference — the flat 1.30/0.70 the Model has always used. Kept for the seed=null path
// (golden/teeth frozen) and for callers that want the simplification. NOT the real game model (see
// affinityMult). sim-selftest asserts these exact values, so they must not drift.
export function affinityFactor(attacker, defender) {
  if (!attacker || !defender || attacker === 'Void' || defender === 'Void') return 1;
  if (BEATS[attacker] === defender) return 1.30;   // strong hit
  if (BEATS[defender] === attacker) return 0.70;   // weak hit
  return 1;
}
// The REAL two-layer affinity model — Plarium's official affinity guide (screenshots 2026-07-25), the
// WEAK_HIT/STRONG_HIT rows of knowledge/RNG_REGISTRY.md, drawn from the `affinity` stream.
//   RELATIONSHIP layer (from the matchup): ADVANTAGE → STRONG_HIT_CHANCE Strong-hit chance (+15% C.Rate,
//     DEFERRED); DISADVANTAGE → flat -20% damage (DISADVANTAGE_FLAT) + WEAK_HIT_CHANCE Weak-hit chance;
//     NEUTRAL / Void → no roll, ×1.
//   HIT-TYPE layer (ROLLED): Strong = +30% dmg (STRONG_HIT_MULT); Weak = -30% dmg (WEAK_HIT_MULT) and does
//     NOT activate effect placement — Shield/debuffs — EXCEPT Damage & Heal (the placement-block is
//     DEFERRED); Normal = ×1.
// CONFIRMED (Mike, in-game 2026-07-25): advantage = 50% Strong-hit CHANCE, and a Strong hit = +30% DAMAGE.
//   The graph image's "+30% Strong Hit Chance" label conflated the two — the 30% is the damage, the 50% is
//   the chance. STRONG_HIT_CHANCE=0.50, STRONG_HIT_MULT=1.30 (SIM_STRONG_HIT_CHANCE overrides for brackets).
// seed=null returns the v0 flat 1.30/0.70 (deterministic Model reference — golden/teeth unchanged); a
// seeded run rolls the real hit-type. EV(advantage)=0.5·1.30+0.5·1.0=1.15 (< the v0 1.30 → the old flat
// OVERSTATED advantaged damage ~13%); EV(disadvantage)=0.80·(0.35·0.70+0.65·1.0)=0.716 (≈ the v0 0.70).
export const STRONG_HIT_CHANCE = Number(process.env.SIM_STRONG_HIT_CHANCE ?? 0.50);
export const WEAK_HIT_CHANCE   = Number(process.env.SIM_WEAK_HIT_CHANCE ?? 0.35);
export const STRONG_HIT_MULT = 1.30, WEAK_HIT_MULT = 0.70, DISADVANTAGE_FLAT = 0.80;
// [Enfeeble] on the ATTACKER forces a WEAK hit (×0.70), OVERRIDING affinity — "can only land weak hits".
// Bambus keeps Enfeeble on the whole wave, so the Magic mobs (affinity ADVANTAGE into our Spirit champs) are
// forced to weak hits, slashing incoming. Consumed in the SHARED computeRawHit below, so BOTH engines apply
// it identically (it used to live only on the recipe path — the exact drift this merge eliminates).
export const WEAK_HIT_ENFEEBLE = 0.70;
export function affinityMult(state, attacker, defender) {
  if (!attacker || !defender || attacker === 'Void' || defender === 'Void') return 1;
  const advantage = BEATS[attacker] === defender;
  const disadvantage = BEATS[defender] === attacker;
  if (!advantage && !disadvantage) return 1;                 // neutral — no roll consumed
  const stream = state?.rng?.affinity;
  if (!stream) return advantage ? 1.30 : 0.70;               // v0 deterministic reference (unchanged)
  if (advantage) return stream() < STRONG_HIT_CHANCE ? STRONG_HIT_MULT : 1.0;
  return DISADVANTAGE_FLAT * (stream() < WEAK_HIT_CHANCE ? WEAK_HIT_MULT : 1.0);   // -20% flat, then Weak roll
}

// Raid's REAL, source-verified ACC-vs-RES resist curve (replaces the linear placeholder). With
// x = (RES − ACC)/100, the resist probability is a two-branch curve, clamped to a ~3% failure floor and a
// ~97% resist ceiling; land = 1 − P_resist. (Equal ACC/RES ≈ 92.5% land; ACC 25 over RES ≈ 96%.) This is
// STAGE 2 only — kept SEPARATE from the skill's placement-chance roll (P_final = P_proc × land).
export function landChance(acc, res) {
  if (acc == null || res == null) return null;      // unknown -> caller must FLAG, not assume
  const x = (res - acc) / 100;
  const pResist = Math.min(0.97, Math.max(0.03,
    x >= 0.30 ? 0.30 + 0.67 * (1 - Math.exp(3 * (0.30 - x)))
              : 0.03 + 0.27 * Math.exp(6 * (x - 0.30))));
  return 1 - pResist;
}

// ── state ────────────────────────────────────────────────────────────────────
export function makeState({ allies, enemies, flags = [], seed = null, rng = null }) {
  // rng is the STREAM BUNDLE ({damage,crit,affinity,debuff,target,ai}) or null. Pass `seed` (preferred)
  // to build it; `rng` accepts a prebuilt bundle. null => DETERMINISTIC v0 (land iff p>0.5, crit=EV).
  const streams = rng ?? (seed != null ? makeRngStreams(seed) : null);
  const f = new Set(flags);
  if (streams && DMG_VAR > 0) f.add(`ASSUMPTION: damage variance ±${(DMG_VAR * 100).toFixed(0)}% (SIM_DMG_VAR) — unverified range, treat as a bracket`);
  return {
    allies, enemies, turn: 0, phase: 'boss', log: [], effects: [], flags: f,
    rng: streams, seed,
    get combatants() { return [...this.allies, ...this.enemies]; },
  };
}
const alive = (arr) => arr.filter(c => c.alive);
export const CC_SKIPS_TURN = ['Stun', 'Freeze', 'Sleep', 'Petrification', 'Block Active Skills'];
// Defensive ceiling on CONSECUTIVE extra turns for one combatant (real granters are cooldown/kill-bounded).
export const EXTRA_TURN_CAP = Number(process.env.SIM_EXTRA_TURN_CAP ?? 10);
export const flag = (s, msg) => s.flags.add(msg);

// ── THE EFFECT LEDGER — two metrics per attempted effect ───────────────────────
// Every effect records FIRED (the ability activated) and CONSUMED (the intended change landed in
// world state, measured by an ACTUAL state delta — not by trusting the code path). The pair exists
// because `fired=yes, consumed=no` is the "represented but not consumed" bug species that has bitten
// this engine five times (passives-as-actions, shields, CC, purple bar, onDamageToBoss). A rung
// (tools/sim-effects.mjs) asserts they agree, so the sixth instance fails a test instead of waiting
// for a human to spot it in a video. RECORDING IS MEASUREMENT ONLY — it never alters combat.
//
// `note` carries a DOCUMENTED reason when consumed is legitimately false (resisted, immune, overheal
// at full HP, nothing to cleanse, or a DATA gap like a missing coefficient). The rung treats those as
// benign; a fired-but-not-consumed effect with NO documented reason is the real defect.
export function recordEffect(state, rec) { state.effects?.push({ turn: state.turn, phase: state.phase, ...rec }); }
const shieldPool = (c) => c.buffs.reduce((s, b) => s + (/Shield/.test(b.type) ? Math.max(0, b.value || 0) : 0), 0);

// ── the turn loop ────────────────────────────────────────────────────────────
// EXACT advance, not a fixed timestep: compute how long until the next combatant fills its turn
// meter, jump straight there. No drift, no tick-size parameter to tune.
export function nextActor(state) {
  // Turn-meter fill rate uses EFFECTIVE speed (base ± [Increase SPD]/[Decrease Speed]), not raw c.spd, so
  // speed buffs/debuffs actually shift turn order — the SPD consumer. effectiveSpeed folds the modifiers.
  const spd = (c) => effectiveSpeed(c);
  const pool = alive(state.combatants).filter(c => spd(c) > 0);
  if (!pool.length) return null;
  const dt = Math.min(...pool.map(c => (100 - c.turnMeter) / spd(c)));
  for (const c of pool) c.turnMeter += spd(c) * dt;
  const actor = pool.find(c => c.turnMeter >= 99.999);
  if (actor) actor.turnMeter = 0;
  return actor;
}

/**
 * DoTs tick at the START of the affected champion's turn (keyword-glossary.json).
 * HP Burn hits "they AND ALL ALLIES for 3% of their respective MAX HP" — so a burn on one enemy
 * splashes onto every other enemy including the boss. That is the Spider kill vector and it falls
 * out of a faithful implementation rather than needing a special case.
 */
export function tickDots(state, c) {
  let dealt = 0;
  const sens = 1 + poisonSensitivity(c);   // [Poison Sensitivity] amplifies each Poison tick (consumer)
  for (const d of [...c.debuffs]) {
    if (d.type === 'Poison') {
      const dmg = (d.pct ?? 0.05) * c.maxHp * (d.stacks ?? 1) * sens;
      c.hp -= dmg; dealt += dmg;
      recordEffect(state, { source: 'Poison', kind: 'dot', subtype: 'Poison', target: c.name, fired: true, consumed: dmg > 0, amount: dmg });
    } else if (d.type === 'HP Burn') {
      const own = 0.03 * c.maxHp;
      c.hp -= own; dealt += own;
      const side = c.side === 'ally' ? state.allies : state.enemies;
      let splash = 0;
      for (const mate of alive(side)) {
        if (mate === c) continue;
        mate.hp -= 0.03 * mate.maxHp; splash += 0.03 * mate.maxHp;   // "and all allies", respective MAX HP
      }
      recordEffect(state, { source: 'HP Burn', kind: 'dot', subtype: 'HP Burn', target: c.name, fired: true, consumed: own > 0, amount: own, splash });
    }
  }
  return dealt;
}

/**
 * [Continuous Heal] ticks at the START of the buffed champion's turn — heals a % of THEIR OWN max HP
 * (the buff value, e.g. Vergis' 15%). The buff was parsed and APPLIED but never healed anyone — the
 * same "represented but not consumed" species as shields / CC / passives, on the SUSTAIN side. This is
 * the heal-over-time mirror of tickDots. Overheal at full HP is recorded as a benign non-consumption.
 */
function tickHots(state, c) {
  for (const b of c.buffs) {
    if (b.type !== 'Continuous Heal') continue;
    const before = c.hp;
    c.hp = Math.min(c.maxHp, c.hp + ((b.value ?? 15) / 100) * (c.maxHp ?? 0));
    recordEffect(state, { source: 'Continuous Heal', kind: 'heal', subtype: 'Continuous Heal', target: c.name,
      fired: true, consumed: c.hp > before, amount: c.hp - before, note: c.hp > before ? undefined : 'overheal (target at full)' });
  }
}

function expireDurations(c) {
  for (const list of [c.buffs, c.debuffs]) {
    for (const e of [...list]) { e.turnsLeft -= 1; if (e.turnsLeft <= 0) list.splice(list.indexOf(e), 1); }
  }
}
function tickCooldowns(c) { for (const s of c.skills) if (s.cdLeft > 0) s.cdLeft -= 1; }

function checkDeaths(state) {
  for (const c of state.combatants) {
    if (c.alive && c.hp <= 0) {
      c.alive = false; c.hp = 0; c.turnMeter = 0;
      c.diedOnTurn = state.turn; c.diedInPhase = state.phase;
      state.log.push({ turn: state.turn, phase: state.phase, event: 'death', who: c.name });
    }
  }
}

/**
 * Route damage through SHIELDS before HP.
 *
 * `PROTECTION_MECHANICS` (damage-mechanics.js) already records the rules and nothing consumed them:
 *   * Shield / Magma Shield are damageType 'direct' — they do NOT absorb DoT (Poison/HP Burn)
 *   * they 'override' rather than stack — a second shield replaces, it does not add
 * Before this existed the sim parsed shields into the buff list and then ignored them, so Pelops'
 * 8,497-per-ally Magma Shield and Bambus Fourleaf's 7,661 did nothing. Same class of bug as the
 * passives: a mechanic represented but not consumed.
 */
export function dealDamage(target, amount, kind = 'direct', attacker = null, team = null, ignoreShield = false) {
  // [ALLY PROTECTION]: when a protected ally is hit, a `value`% share of the damage is REDISTRIBUTED
  // evenly among the OTHER living protected allies (the Raid rule — it spreads focus-fire, it does NOT
  // reduce the total). Each redistributed portion then hits that ally's OWN shields normally, with no
  // further redirect (team omitted -> no recursion). This is the keystone that stops wave mobs from
  // bursting a single squishy. ⚠ RULE ASSUMPTION: split-among-others; confirm vs the in-game tooltip.
  if (kind === 'direct' && team) {
    const ap = target.buffs.find(b => b.type === 'Ally Protection' && b.value > 0);
    const others = ap ? team.filter(a => a !== target && a.alive && a.buffs.some(x => x.type === 'Ally Protection')) : [];
    if (ap && others.length) {
      const redirected = amount * ap.value / 100;
      for (const o of others) dealDamage(o, redirected / others.length, kind, attacker);
      amount -= redirected;
    }
  }
  let left = amount, magmaAbsorbed = 0;
  if (kind === 'direct') {
    for (const b of target.buffs) {
      if (!/Shield/.test(b.type) || !(b.value > 0)) continue;
      // "ignore [Shield]" (Ezio A3; wave Lua/Faceless A3) bypasses the plain [Shield] buff ONLY. [Magma Shield]
      // is a DISTINCT buff the game names separately and does NOT ignore — verified from the cards ("ignore
      // [Shield] and [Block Damage]", not Magma Shield). It is Pelops's tank identity: his Magma Shield eats the
      // taunted hit, reflects it, and he lifesteals off the reflection. Bypassing it here killed the tank.
      if (ignoreShield && b.type === 'Shield') continue;
      const absorbed = Math.min(b.value, left);
      b.value -= absorbed; left -= absorbed;
      if (b.type === 'Magma Shield') magmaAbsorbed += absorbed;   // Magma Shield REFLECTS what it absorbs
      if (b.value <= 0) b.turnsLeft = 0;              // depleted shields drop off
      if (left <= 0) break;
    }
  }
  target.hp -= left;
  // MAGMA SHIELD reflects an amount EQUAL to what it absorbed back to the ATTACKER (verbatim in-game
  // rule). This is Pelops the Victor's identity — it punishes the wave mobs that hit shielded allies.
  // Applied straight to attacker HP (bypasses the attacker's own shields, so no reflection loop).
  const reflected = (magmaAbsorbed > 0 && attacker && attacker.alive) ? magmaAbsorbed : 0;
  // [REFLECT DAMAGE] buff on the target: the ATTACKER takes `value`% of the damage inflicted on this target
  // (Vergis A1 places 30%). A buff, not a shield — so it is based on the full inflicted `amount` (post-DEF/
  // crit/affinity, post-Ally-Protection redirect), independent of the target's own shields. Reflected
  // straight to attacker HP, bypassing the attacker's shields (no reflection loop), exactly like Magma. It
  // does NOT lifesteal (it is not the champion's own attack). ⚠ RULE ASSUMPTION: reflects the pre-shield
  // inflicted damage — confirm vs the in-game tooltip whether a [Shield] on the target lowers the reflect.
  const reflectPct = (kind === 'direct' && attacker && attacker.alive) ? reflectDamage(target) : 0;
  const reflectBuffDmg = reflectPct > 0 ? Math.round(reflectPct * amount) : 0;
  if (reflected || reflectBuffDmg) {
    attacker.hp -= (reflected + reflectBuffDmg);
    // the reflector LIFESTEALS off the MAGMA reflection only. This is how a Lifesteal tank (Pelops) sustains
    // through a wave he can't out-attack: his damage output IS the Magma Shield reflection, so the heal
    // rides on every hit he absorbs — the mechanism that carries him from wave 1 into wave 2 solo.
    if (reflected && target.lifesteal > 0) target.hp = Math.min(target.maxHp ?? 0, target.hp + target.lifesteal * reflected);
  }
  return { absorbed: amount - left, toHp: left, magmaAbsorbed, reflected, reflectBuffDmg };
}

/**
 * %-of-target-MAX-HP damage. A DISTINCT family from an ATK-vs-DEF hit (damage-mechanics.js §1,
 * `enemy_max_hp`): DEF-INDEPENDENT, and by its nature not crit- or affinity-scaled — it is a flat
 * fraction of the defender's MAX HP. On stage 21-25 / Hard the fraction is CAPPED to 10% per hit
 * (state.maxHpDamageCap), so a big nuke needs ≥2 hits to break the Dragon purple bar. Absorbed by
 * shields like any direct hit. Records the ledger effect (subtype 'maxHP') itself.
 */
export function dealMaxHpDamage(state, target, pct, E, attacker = null) {
  const cap = state.maxHpDamageCap ?? null;
  const eff = cap != null ? Math.min(pct, cap) : pct;
  const before = target.hp + shieldPool(target);
  dealDamage(target, eff * (target.maxHp ?? 0), 'direct', attacker);
  const dealt = before - (target.hp + shieldPool(target));
  E({ kind: 'damage', subtype: 'maxHP', target: target.name, fired: true, consumed: dealt > 0, amount: dealt,
      note: (cap != null && pct > cap) ? `capped ${Math.round(cap * 100)}%/hit` : undefined });
}

export const has = (c, type) => c.buffs.some(b => b.type === type) || c.debuffs.some(d => d.type === type);

// [Perfect Veil] / [Veil] make a champion UNTARGETABLE by single-target skills — the TARGETING half
// of the Ezio one-shot (a battle video shows Ezio taking ~3.5k all fight; the sim one-shot him because
// it picked the veiled 10%-HP ally). Only single-target selection is affected: AoE hits THROUGH a veil.
// If every candidate is veiled the protection lapses — a veil cannot leave an attacker with no legal
// target. (The parser only ever PLACES [Perfect Veil], but [Veil] is listed for correctness/future.)
export const UNTARGETABLE_BUFFS = ['Perfect Veil', 'Veil'];
export const isUntargetable = (c) => UNTARGETABLE_BUFFS.some(t => has(c, t));

/**
 * Pick a SINGLE-TARGET victim by LOWEST CURRENT HP PERCENTAGE (auto-battle rule 3, Mike 2026-07-22).
 * `avoid` is a soft de-prioritisation ([Unkillable] / [Block Damage] for our champs hitting enemies);
 * untargetability (veil) is a HARD skip unless nothing else remains. Shared by both sides so the veil
 * rule cannot be honored in one direction and forgotten in the other.
 */
export function chooseSingleTarget(pool, avoid = []) {
  const live = alive(pool);
  if (!live.length) return null;
  // [Perfect Veil] is ABSOLUTELY untargetable by single-target — even when it is the ONLY champion left
  // (that is how a Perfect-Veil champ SOLOs waves untouched). Plain [Veil] only lapses when everyone is
  // veiled. So: drop Perfect-Veil champs outright; drop plain-[Veil] champs only if others remain.
  let base = live.filter(c => !has(c, 'Perfect Veil'));
  if (!base.length) return null;                                // all Perfect-Veiled -> single-target whiffs
  const unveiled = base.filter(c => !has(c, 'Veil'));
  if (unveiled.length) base = unveiled;
  const forced = base.filter(c => has(c, 'Taunt') || has(c, 'Provoke'));   // [Taunt]/[Provoke] force the
  if (forced.length) base = forced;                                        // attacker onto them, overriding all else
  const preferred = base.filter(c => !avoid.some(t => has(c, t)));
  const finalPool = preferred.length ? preferred : base;
  // Raid enemy AI target priority (community-verified checklist): among targetable champs the AI tunnels the
  // LOWEST MAX HP — the 'glass cannon' rule, a FLAT value not a % — tie-broken by lowest current HP%. This is
  // why, once the true-lowest-max-HP champ is hidden by [Perfect Veil] (Ezio), the AI ruthlessly focuses the
  // NEXT lowest (Vergis), who becomes the death seat. (Rules #1 one-shot-kill and #2 affinity are refinements
  // that need the attacker; max-HP dominates the DonBambus distribution and the Void boss ignores affinity.)
  return finalPool.reduce((a, b) => {
    if ((a.maxHp ?? 0) !== (b.maxHp ?? 0)) return (a.maxHp ?? 0) < (b.maxHp ?? 0) ? a : b;
    return (a.hp / (a.maxHp || 1)) <= (b.hp / (b.maxHp || 1)) ? a : b;
  });
}

/** OUR champions target enemies: lowest HP%, hard-skip a veiled enemy, avoid [Unkillable]/[Block Damage]. */
export function chooseEnemyTarget(enemies) { return chooseSingleTarget(enemies, ['Unkillable', 'Block Damage']); }

/** A single enemy (mob/boss single-target) picks one of our team: lowest HP%, hard-skip a veiled ally. */
export function chooseAllyTarget(allies) { return chooseSingleTarget(allies); }

/**
 * Run one battle as a SEQUENCE OF PHASES — waves then boss.
 *
 * THE POINT OF THE PHASES (Mike, 2026-07-22): "the simulator should tell you if the team is
 * clearing the waves or dying on the boss stage." That phase attribution is the OUTPUT — a
 * win/loss bit is what the aggregate already produced and it is not what a player can act on.
 * "Your reviver dies in wave 2" is advice; "confidence 0.73" is not.
 *
 * CARRY-OVER IS DELIBERATE and is the mechanic a per-phase model cannot see: champion HP, buffs,
 * debuffs AND SKILL COOLDOWNS persist across phases. A champion that burns its A3 on the last enemy
 * of wave 2 enters the boss without it. Tagoar's revive is cd 7 — spent late in a wave, it is gone
 * for the first seven turns of the boss fight.
 *
 * @param {object} content { phases: [{name, enemies, actEnemy}] }
 */
export function simulate(state, content, { turnCap = 400, trace = false } = {}) {
  const phaseResults = [];
  // TRACE — the debugger. A turn loop that produces a wrong answer is inspectable in a way an
  // aggregate never is: you can watch the fight. Prints actor, action and every HP bar per turn.
  const snap = () => state.allies.map(a => `${a.name.split(' ')[0].slice(0, 6)} ${a.alive ? String(Math.round(100 * a.hp / a.maxHp)).padStart(3) + '%' : ' DEAD'}`).join(' ');
  state.trace = trace;
  // %maxHP DAMAGE CAP — stage 21-25 / all-Hard cap %-of-MAX-HP skills to 10% per hit (Dragon
  // purple-bar rule / Almighty Persistence). null = uncapped. Set by content (dragon.makeDragonContent).
  state.maxHpDamageCap = content.maxHpDamageCap ?? null;
  // START-OF-BATTLE passives — allies only (enemy composition changes per wave, so an enemy's
  // start-of-battle passive is a timing question we do not answer at turn 0). Also surface any passive
  // whose trigger we cannot classify, so a missing trigger is VISIBLE rather than silently dropped.
  // PURE-RECIPE mode: when the recipe interpreter drives actions, the OLD parsed-kit passives (firePassives)
  // must NOT also fire — the model is exactly what the recipes say, nothing from the old engine.
  if (!state.recipeAct) for (const a of state.allies) {
    firePassives(state, a, 'startOfBattle');
    firePassives(state, a, 'startOfRound');     // round 1 begins at battle start (Ezio's veil up from t0)
    for (const s of a.skills) if (s.isPassive && !s.passiveTrigger && ((s.buffs?.length) || (s.debuffs?.length)))
      flag(state, `UNMODELLED passive trigger: ${a.name} ${s.name ?? s.slot}`);
  }
  for (const phase of content.phases) {
    if (phase.enemies == null) {                    // no data for this phase — say so, do not invent
      flag(state, `UNMODELLED PHASE: ${phase.name} — no enemy data`);
      phaseResults.push({ phase: phase.name, outcome: 'unmodelled', turns: 0 });
      continue;
    }
    state.phase = phase.name;
    state.enemies = phase.enemies;
    for (const e of state.enemies) e.turnMeter = 0;
    state.roundActed = null;   // a new phase (wave) restarts round tracking → round_start fires on its first turn
    const startTurn = state.turn;

    while (state.turn < turnCap) {
      const actor = nextActor(state);
      if (!actor) break;
      state.turn += 1;
      // EXTRA TURN bookkeeping. An extra turn = the SAME actor acts again immediately (granted by setting
      // its turn meter back to 100 so nextActor re-picks it). Track the CONSECUTIVE-extra-turn chain so a
      // (hypothetical) no-cooldown unconditional granter can't loop forever — a defensive cap, since real
      // granters here are cooldown- or kill-bounded (Crossbowman A2 cd4, Hordin A3 cd6, Hordin A1 on-kill).
      state.grantExtraTurn = false;
      actor.extraTurnChain = (actor === state.lastActor) ? (actor.extraTurnChain ?? 0) + 1 : 0;
      state.lastActor = actor;
      // ROUND boundary: a new Round begins once every currently-living combatant has taken a turn since the
      // last one. `round_start` passives (Ezio's [Perfect Veil], 2 turns) fire HERE — once per round, NOT every
      // turn — so a champion faster than the pack outruns his own 2-turn veil and is EXPOSED in the gap
      // (video-verified: Ezio SPD 155 > mobs ~95-101 → his veil lapses and he gets single-target-focused).
      const livingNow = alive(state.combatants);
      if (!state.roundActed || livingNow.every(c => state.roundActed.has(c))) {
        state.roundActed = new Set();
        state.round = (state.round ?? 0) + 1;
        state.onRoundStart?.(state);
      }
      state.roundActed.add(actor);
      state.onTurnStart?.(state, actor);   // per-turn triggers (e.g. Bambus Sleeping-Sage wake)

      tickDots(state, actor);
      tickHots(state, actor);                       // [Continuous Heal] heals at the start of the turn
      checkDeaths(state);
      if (!actor.alive) continue;                   // died to its own DoT before acting

      // START-OF-TURN passives fire before the action AND before the CC check, so a passive self-buff
      // like [Perfect Veil] still renews on a turn the champion is stunned out of. (The renewal is the
      // start-of-turn trigger; it is independent of whether an active skill gets to fire this turn.)
      if (!state.recipeAct) {   // pure-recipe mode: old parsed-kit passives are off (see battle-start note)
        firePassives(state, actor, 'startOfTurn');
        firePassives(state, actor, 'startOfRound');   // round-start passives re-up each turn (approximation)
      }

      // CC COSTS THE TURN. Stun/Freeze/Sleep/Petrification make the champion skip; cooldowns and
      // durations still tick (Freeze notably does NOT refresh cooldowns, but v0 does not model that
      // distinction — flagged). Before this, CC debuffs were applied and then ignored: a stunned
      // champion acted normally, which on Dragon — whose wall is CC pressure, INS-0021 — erased the
      // dungeon's defining threat. Third instance of "represented but not consumed", after passives
      // and shields.
      if (CC_SKIPS_TURN.some(t => actor.debuffs.some(d => d.type === t))) {
        const cc = actor.debuffs.find(d => CC_SKIPS_TURN.includes(d.type))?.type ?? 'CC';
        recordEffect(state, { source: cc, kind: 'cc', subtype: cc, target: actor.name, fired: true, consumed: true, note: 'turn lost' });
        if (trace) console.log(`  t${String(state.turn).padStart(3)} ${String(actor.name).slice(0,14).padEnd(15)}${'-- CC: turn lost --'.padEnd(22)}`);
        expireDurations(actor); tickCooldowns(actor);
        continue;
      }

      const bossBefore = state.enemies.find(e => e.role === 'boss')?.hp ?? 0;
      const enemyBefore = trace ? state.enemies.reduce((s, e) => s + (e.alive ? Math.max(0, e.hp) : 0), 0) : 0;
      let acted = null;
      if (actor.side === 'enemy') phase.actEnemy(state, actor);
      else acted = actChampion(state, actor);

      // Feed team damage on the boss to the content hook (Dragon's purple bar). Represented but not
      // consumed until 2026-07-22: the hook existed on the content object and the engine never called
      // it, so the bar never drained and Scorch fired every time. No-op unless a bar is armed.
      if (actor.side === 'ally' && content.onDamageToBoss) {
        const bossAfter = state.enemies.find(e => e.role === 'boss')?.hp ?? 0;
        const dealt = Math.max(0, bossBefore - bossAfter);
        if (dealt > 0) content.onDamageToBoss(state, dealt);
      }
      if (trace) {
        const boss = state.enemies.find(e => e.role === 'boss');
        const enemyAfter = state.enemies.reduce((s, e) => s + (e.alive ? Math.max(0, e.hp) : 0), 0);
        const dealt = Math.max(0, enemyBefore - enemyAfter);
        const enemyCol = (boss ? `boss ${String(Math.round(100 * boss.hp / boss.maxHp)).padStart(3)}%`
                               : `${state.phase} ${alive(state.enemies).length}/${state.enemies.length} left`).padEnd(13);
        console.log(`  t${String(state.turn).padStart(3)} ${String(actor.name).slice(0, 14).padEnd(15)}`
          + `${String(acted ?? (actor.side === 'enemy' ? 'ENEMY TURN' : '-')).padEnd(22)}`
          + `${enemyCol}`
          + `${dealt > 0 ? ` (-${Math.round(dealt).toLocaleString()})` : '         '}   ${snap()}`);
      }

      expireDurations(actor);
      tickCooldowns(actor);
      checkDeaths(state);
      // EXTRA TURN grant (set by applySkill for skill.extraTurn / extraTurnOnKill). Re-picks the same actor
      // next iteration by refilling its turn meter — a full extra turn (DoTs, skill, cooldowns all fire).
      if (state.grantExtraTurn && actor.alive) {
        state.grantExtraTurn = false;
        if ((actor.extraTurnChain ?? 0) < EXTRA_TURN_CAP) { actor.turnMeter = 100; recordEffect(state, { source: actor.name, kind: 'extra_turn', target: actor.name, fired: true, consumed: true }); }
        else flag(state, `extra-turn chain capped at ${EXTRA_TURN_CAP}: ${actor.name}`);
      }
      state.onTurn?.(state, actor);   // per-turn snapshot hook (no-op unless set) — for turn-by-turn tracing

      if (!alive(state.allies).length) {
        phaseResults.push({ phase: phase.name, outcome: 'WIPED', turns: state.turn - startTurn });
        return finish(state, false, `wiped in ${phase.name}`, phaseResults);
      }
      if (!alive(state.enemies).length) {
        phaseResults.push({ phase: phase.name, outcome: 'cleared', turns: state.turn - startTurn });
        break;
      }
    }
    if (state.turn >= turnCap) {
      phaseResults.push({ phase: phase.name, outcome: 'TIMED OUT', turns: state.turn - startTurn });
      return finish(state, false, `turn cap ${turnCap} reached in ${phase.name}`, phaseResults);
    }
  }
  return finish(state, true, 'all phases cleared', phaseResults);
}

function finish(state, won, reason, phases = []) {
  return {
    won, reason, turns: state.turn, phases,
    // WHERE it broke — the actionable half
    failedPhase: phases.find(p => p.outcome === 'WIPED' || p.outcome === 'TIMED OUT')?.phase ?? null,
    deaths: state.log.filter(e => e.event === 'death'),
    revives: state.log.filter(e => e.event === 'revive'),
    survivors: alive(state.allies).map(c => c.name),
    // cooldowns still burning as the team entered the boss — the carry-over cost
    enteredBossWith: state.enteredBossWith ?? null,
    flags: [...state.flags],
    log: state.log,
    effects: state.effects ?? [],
  };
}

// ── champion action ──────────────────────────────────────────────────────────
function actChampion(state, c) {
  const skill = pickSkill(state, c);
  if (!skill) return 'no usable skill';
  state.onAction?.(state, c, skill);   // ACTION HOOK (no-op unless set): actor + chosen skill at the decision point
  skill.cdLeft = skill.cooldown ?? 0;
  // THE ONE ENGINE: recipeFor(authored) || kitToRecipe(auto-parse) → applyRecipe. There is no second path.
  if (dispatchSkill(state, c, skill)) return `${skill.slot}`;
  return `${skill.slot} — no recipe (skill did nothing)`;   // only if the recipe engine isn't registered (never in a real run)
}

/** Skill selection (see knowledge/CHAMPION_AI_MODEL.md). DEFAULT = highest slot first (A3>A2>A1, A1 last),
 *  subject to the role condition-locks in ai.canUseSkill (revive-lock, heal-hoard). A champion with a
 *  CONFIRMED non-default order carries `c.skillOrder` (e.g. Ezio ['A2','A3','A1']) and uses that instead.
 *  NOTE: the earlier "prefer AoE" experiment was WRONG — Ezio's A2-first is a per-champion exception, not
 *  a universal rule — so it is reverted to the default plus the per-champion override. */
function pickSkill(state, c) {
  const usable = (s) => !s.isPassive && (s.cdLeft ?? 0) <= 0 && canUseSkill(s, state, c);
  if (c.skillOrder) {                              // confirmed per-champion order
    for (const slot of c.skillOrder) { const s = c.skills.find((x) => String(x.slot).toUpperCase() === slot && usable(x)); if (s) return s; }
    return c.skills.find((s) => !s.isPassive && String(s.slot).toUpperCase() === 'A1') ?? null;
  }
  const ordered = [...c.skills].filter((s) => String(s.slot).toUpperCase() !== 'A1').sort((a, b) => String(b.slot).localeCompare(String(a.slot)));
  for (const s of ordered) if (usable(s)) return s;   // A3 > A2, honouring cooldown + condition locks
  return c.skills.find((s) => !s.isPassive && String(s.slot).toUpperCase() === 'A1') ?? null;   // A1 last
}

// ══ SHARED HIT RESOLUTION — the SINGLE raw-damage computation for BOTH engines ══════════════════════
// The recipe interpreter (interpreter.dealOneHit) and the parsed-kit path (applySkill) both call
// computeRawHit, so the damage multiplier stack can NEVER drift between them again. Every historical
// two-engine divergence lived exactly here: [Enfeeble]→weak-hit, the incoming-damage passive modifiers
// (Pelops −20% / Aid-the-Feeble / Ezio nullify), effectiveScaleStat buff-folding, and DEF mitigation.
// Lives in engine.js (not interpreter.js) because engine.js may import recipes.js (pure data, no cycle),
// whereas the reverse import is the cycle the codebase avoids. Application (dealDamage / lifesteal /
// reflect / reactions) stays in each caller — only the NUMBER is unified.
const cmpRaw = (L, op, R) => op === '>=' ? L >= R : op === '>' ? L > R : op === '<=' ? L <= R : op === '<' ? L < R : op === '==' || op === '=' ? L === R : op === '!=' ? L !== R : false;

// Base damage from a formula's components (attacker's own stat × multiplier, or a sum of terms).
// effectiveScaleStat folds the attacker's OWN [Increase/Decrease ATK/DEF] into the scaling stat.
function formulaBase(actor, F, target) {
  let base = (F.terms && F.terms.length)
    ? F.terms.reduce((s, tm) => s + tm.coeff * effectiveScaleStat(actor, String(tm.stat).toLowerCase()), 0)
    : (F.multiplier ?? 0) * effectiveScaleStat(actor, String(F.scalingStat).toLowerCase());
  // Per-target-debuff ADDITIVE term: "(2 + Total Debuff) × ATK" — +coeff×stat per debuff COUNT on the target.
  if (F.perTargetDebuff) base += F.perTargetDebuff.coeff * (target?.debuffs?.length ?? 0) * effectiveScaleStat(actor, String(F.perTargetDebuff.stat).toLowerCase());
  return base;
}

// A DYNAMIC SCALER multiplies the hit by a battle-state factor described in DATA on the formula (Pelops A2:
// +pctPer per debuff-turn on self & target, capped at capBonus). Unknown source → FLAG and ×1 (never a default).
function dynamicScaleFactor(state, F, actor, target) {
  const ds = F.dynamicScaler; if (!ds) return 1;
  const debuffTurns = (c) => (c?.debuffs ?? []).reduce((s, d) => s + (d.turnsLeft ?? 0), 0);
  let count = null;
  if (ds.source === 'debuff_turns') {
    if (ds.of === 'self_and_target') count = debuffTurns(actor) + debuffTurns(target);
    else if (ds.of === 'target') count = debuffTurns(target);
    else if (ds.of === 'self') count = debuffTurns(actor);
  }
  if (count == null) { flag(state, `UNKNOWN dynamicScaler '${ds.source}/${ds.of}': ${actor.name}`); return 1; }
  return 1 + Math.min(ds.capBonus ?? Infinity, (ds.pctPer ?? 0) * count);
}

// Passive incoming-damage MODIFIERS from the target's side (Aid the Feeble −10% to low allies, Pelops −20%
// team, Ezio 35%-nullify). Consulted when damage is about to land; returns the MODIFIED amount.
function modOperand(name, entity, amount, target, arg) {
  switch (name) {
    case 'hp_frac':           return entity.hp / (entity.maxHp || 1);
    case 'not_under_debuff':  return !entity.debuffs.some((d) => d.type === arg);
    case 'hit_frac_of_maxhp': return amount / (target.maxHp || 1);
    default:                  return undefined;
  }
}
export function incomingDamage(state, target, amount) {
  const side = target.side === 'ally' ? state.allies : state.enemies;
  let factor = 1;
  for (const owner of side.filter((c) => c.alive)) {
    const first = String(owner.name).split(' ')[0].toUpperCase();
    const mods = Object.values(RECIPES).filter((r) => r.modifiers && r.champion.split(' ')[0].toUpperCase() === first).flatMap((r) => r.modifiers);
    for (const mod of mods) {
      if (mod.kind !== 'incoming_damage') continue;
      if (mod.scope === 'self' && owner !== target) continue;                 // self-only vs team-wide
      if (mod.when) {
        const entity = mod.when.on === 'owner' ? owner : target;
        const L = modOperand(mod.when.left, entity, amount, target, mod.when.arg);
        if (L === undefined) { flag(state, `UNKNOWN modifier operand '${mod.when.left}': ${owner.name}`); continue; }
        const ok = mod.when.cmp ? cmpRaw(L, mod.when.cmp, mod.when.right) : Boolean(L);
        if (!ok) continue;
      }
      if (mod.chance != null && !rollChance(state?.rng?.damage, mod.chance)) continue;
      factor *= mod.factor;
    }
  }
  return amount * factor;
}

// THE unified multiplier stack: crit × DEF-mitigation × affinity/[Enfeeble] × variance × ignore-DEF, plus the
// incoming-damage modifiers. Returns { raw, critM, affM, defM } — the pre-application number + the multipliers
// the caller needs for its structured result. Each multiplier is gated by a formula FLAG so a skill can turn
// any of them off (a plain parsed kit turns them all ON via kitFormula).
export function computeRawHit(state, actor, t, F) {
  const fl = F.flags || {};
  const critM = fl.crit ? critMult(state, effectiveCritRate(actor), actor.critDmg) : 1;
  // [Enfeeble] on the ATTACKER forces a WEAK hit (×0.70), overriding a neutral/strong affinity — the same weak
  // multiplier affinityFactor uses (no new constant). This is the consumer for the Bambus A3 [Enfeeble].
  const affM = (actor.debuffs ?? []).some((d) => d.type === 'Enfeeble') ? WEAK_HIT_ENFEEBLE : (fl.affinity ? affinityMult(state, actor.affinity, t.affinity) : 1);
  const varM = fl.variance ? dmgVariance(state) : 1;
  // ignore_def (0..1) strips that fraction of the target's effective DEF for THIS hit; a conditional variant
  // fires when the TARGET is under a named debuff (Pelops A2: ignore 50% DEF if under [HP Burn]).
  let ignoreDef = fl.ignore_def || 0;
  if (F.ignoreDefIfTargetUnder && (t.debuffs ?? []).some((d) => d.type === F.ignoreDefIfTargetUnder.debuff)) ignoreDef = Math.max(ignoreDef, F.ignoreDefIfTargetUnder.ignore);
  const defForHit = effectiveDef(t) * (1 - ignoreDef);
  const defM = fl.def_mitigation ? defMitigation(defForHit, actor.level) : 1;
  let raw = formulaBase(actor, F, t) * dynamicScaleFactor(state, F, actor, t) * critM * defM * affM * varM;
  // INCOMING to one of our champions → run the passive damage modifiers (both engines, one place now).
  if (actor.side === 'enemy' && t.side === 'ally') raw = incomingDamage(state, t, raw);
  return { raw, critM, affM, defM };
}

// applySkill was DELETED 2026-07-25 — the parsed-kit combat engine is gone. Every combatant (authored or
// not) now runs the ONE engine: recipeFor(actor,slot) || kitToRecipe(skill) → interpreter.applyRecipe,
// dispatched via dispatchSkill (recipe-registry.js). The shared per-hit math is engine.computeRawHit;
// on-attack riders (Warmaster/gear) and the on-attacked passive are handled inside the recipe path.

/** Place a buff list on the right recipients, resolving caster-%HP shields. `actor.side` decides the
 *  recipient side, so this serves an ally caster AND an enemy passive. Used by applySkill and firePassives. */
function applyBuffList(state, actor, buffs, slot, E) {
  const ownSide = actor.side === 'ally' ? state.allies : state.enemies;
  for (const b of buffs ?? []) {
    const targets = b.self ? [actor] : alive(ownSide);
    // a shield's pool is a % of the CASTER's max HP — resolved here, not at parse time
    const applied = b.pctOfCasterMaxHp ? { ...b, value: Math.round(b.pctOfCasterMaxHp * actor.maxHp) } : b;
    if (/Shield/.test(b.type) && !b.pctOfCasterMaxHp) flag(state, `UNKNOWN shield size: ${actor.name} ${slot}`);
    for (const t of targets) { upsert(t.buffs, applied); E({ kind: 'buff', subtype: b.type, target: t.name, fired: true, consumed: t.buffs.some(x => x.type === b.type) }); }
  }
}

/**
 * THE PASSIVE-TRIGGER SYSTEM. Passives are not castable actions (pickSkill skips them), but their
 * effects still have to LAND. A passive [Perfect Veil] renewed "at the start of each turn" is the root
 * of the Ezio one-shot, and before this it never entered the buff list at all — the demonstrated blank
 * in sim-effects Part C: a mechanic fully represented in the data and consumed by nothing. This is the
 * sibling failure to passives-cast-as-actions, shields, CC and the purple bar.
 *
 * v0 fires the two triggers we can place faithfully (see ai.classifyPassiveTrigger): startOfTurn and
 * startOfBattle. A passive whose trigger we cannot read is FLAGGED at battle start (readSkillKit marks
 * it `unread: ['passive-trigger']`), never fired at a guessed moment — the engine's rule is to emit a
 * flag, not a plausible default.
 *
 * SCOPE: places the passive's buffs (self / team) and any enemy debuffs it carries (gated on ACC vs
 * RES, exactly like an active skill). Passive heals and revives are not modelled here — rare, and their
 * timing is a separate open question — so they are left for a later pass rather than approximated.
 */
function firePassives(state, actor, trigger) {
  for (const skill of actor.skills) {
    if (!skill.isPassive || skill.passiveTrigger !== trigger) continue;
    const E = (rec) => recordEffect(state, { source: `${actor.name} [P]`, slot: skill.slot, ...rec });
    applyBuffList(state, actor, skill.buffs, skill.slot, E);
    for (const d of skill.debuffs ?? []) {
      for (const t of alive(actor.side === 'ally' ? state.enemies : state.allies)) {
        if (t.immune?.includes(d.type)) { E({ kind: 'debuff', subtype: d.type, target: t.name, fired: true, consumed: false, note: 'immune' }); continue; }
        const p = landChance(actor.acc, t.res);
        if (p == null) { flag(state, `UNKNOWN land chance (passive): ${actor.name} ${d.type}`); E({ kind: 'debuff', subtype: d.type, target: t.name, fired: true, consumed: false, note: 'UNKNOWN land chance' }); continue; }
        if (rollLand(state, p)) { applyDebuff(t, d); E({ kind: 'debuff', subtype: d.type, target: t.name, fired: true, consumed: t.debuffs.some(x => x.type === d.type) }); }
        else { flag(state, `passive debuff resisted (${Math.round(p * 100)}%): ${actor.name} ${d.type}`); E({ kind: 'debuff', subtype: d.type, target: t.name, fired: true, consumed: false, note: `resisted (${Math.round(p * 100)}% land)` }); }
      }
    }
  }
}

/**
 * ON-ATTACKED passive: when `defender` is hit, its onAttacked passive places debuffs ON THE ATTACKER
 * (Pelops the Victor's Master of Games -> [HP Burn] on every mob that attacks him — combined with his
 * A3 [Taunt] that pulls the mobs onto him, this is the wave-kill engine). Fires once per incoming skill.
 * v0 applies deterministically (the passive's own chance is 100% for Pelops's HP Burn); attacker immunity
 * is respected. HP Burn then ticks via tickDots, so the DoT itself needs no special-casing here.
 */
export function fireOnAttacked(state, defender, attacker) {
  for (const skill of defender.skills ?? []) {
    if (!skill.isPassive || skill.passiveTrigger !== 'onAttacked') continue;
    for (const d of skill.debuffs ?? []) {
      if (attacker.immune?.includes(d.type)) { recordEffect(state, { source: `${defender.name} [P]`, kind: 'debuff', subtype: d.type, target: attacker.name, fired: true, consumed: false, note: 'immune' }); continue; }
      // RES-gated like every debuff: the passive's placement chance is 100%, but the mob's RES still
      // resists it (Pelops ACC 70 vs mob RES 100 -> 0.70, above the v0 deterministic >0.5 threshold).
      const p = landChance(defender.acc, attacker.res);
      if (p != null && !rollLand(state, p)) { flag(state, `on-attacked debuff resisted (${Math.round(p * 100)}%): ${defender.name} ${d.type}`); recordEffect(state, { source: `${defender.name} [P]`, kind: 'debuff', subtype: d.type, target: attacker.name, fired: true, consumed: false, note: `resisted (${Math.round(p * 100)}% land)` }); continue; }
      applyDebuff(attacker, d);
      recordEffect(state, { source: `${defender.name} [P]`, slot: skill.slot, kind: 'debuff', subtype: d.type, target: attacker.name, fired: true, consumed: attacker.debuffs.some(x => x.type === d.type), note: 'on-attacked' });
    }
  }
}

/**
 * GEAR_PROC (on-attack family): the ATTACKER's COMPLETE chance-proc gear sets place a debuff/DoT/CC on the
 * target it just hit. Rolls the `gear` stream at the SET's sourced chance (data/gear-set-procs.json) —
 * ONE roll per target, not per hit. Per the game rule (doc §15) a gear-set debuff is INDEPENDENT of skill
 * debuffs and IGNORES ACC/RES, so there is NO landChance gate here — only the set chance and immunity.
 * seed=null → the deterministic threshold (a 75% Toxic lands, an 18% Stun does not); a seeded run rolls.
 * Only the on-attack placement family is wired (gear.js gates it); counters / extra-turns / cooldown /
 * defensive procs are DEFERRED and surfaced as a flag by the fixture builder, never silently dropped.
 */
export function fireGearProcs(state, actor, target) {
  for (const g of actor.gearProcs ?? []) {
    if (g.trigger !== 'on_attack') continue;
    const E = (rec) => recordEffect(state, { source: `${actor.name} [${g.set}]`, kind: 'gear', subtype: g.effect, target: target.name, rolled: !!state?.rng?.gear, ...rec });
    if (!rollChance(state?.rng?.gear, g.chance)) { E({ fired: true, consumed: false, note: `proc missed (${Math.round(g.chance * 100)}%)` }); continue; }
    if (target.immune?.includes(g.effect)) { E({ fired: true, consumed: false, note: 'immune' }); continue; }
    applyDebuff(target, { type: g.effect, pct: g.value ?? undefined, turns: g.turns });   // Toxic Poison carries pct=0.025
    E({ fired: true, consumed: target.debuffs.some(x => x.type === g.effect) });
  }
}

// WARMASTER / GIANT SLAYER (tier-6 Offense mastery): once-per-turn DEF-independent bonus ≈ 0.024 × the PRIMARY
// target's MAX HP (60% proc × ~4%, a cb-damage-model aggregate — not a fit). Shared by applySkill AND applyRecipe
// so a boss-mastery attacker gets it on EITHER engine — the drift-#3 fix (recipe-driven attackers got nothing).
// MASTERY_PROC stream: seeded → roll the 60% proc (RAW on a hit, 0 on a miss); seed=null → apply the EV.
export function applyWarmaster(state, actor, target, opponents, E) {
  if (!actor.bossMastery || !target || WARMASTER_MAXHP <= 0) return;
  const stream = state?.rng?.mastery;
  const wm = stream ? (stream() < WARMASTER_PROC ? WARMASTER_RAW * (target.maxHp ?? 0) : 0) : WARMASTER_MAXHP * (target.maxHp ?? 0);
  if (wm > 0) { dealDamage(target, wm, 'direct', actor, opponents); E({ kind: 'damage', subtype: 'Warmaster', target: target.name, fired: true, consumed: true, amount: wm, rolled: !!stream }); }
  else E({ kind: 'damage', subtype: 'Warmaster', target: target.name, fired: true, consumed: false, rolled: true, note: `proc missed (${Math.round(WARMASTER_PROC * 100)}%)` });
}

/** Mob skill selection — DEFAULT highest-slot-first (A3>A2>A1), same as champions. A mob with a CONFIRMED
 *  non-default order carries `c.skillOrder`. (Enemies have no heal/revive condition locks — no canUseSkill
 *  gate here.) No universal "prefer AoE" rule; deviations are per-champion and confirmed. */
function pickEnemySkill(c) {
  if (c.skillOrder) {
    for (const slot of c.skillOrder) { const s = c.skills.find((x) => String(x.slot).toUpperCase() === slot && !x.isPassive && (x.cdLeft ?? 0) <= 0); if (s) return s; }
  }
  const ordered = [...c.skills].sort((a, b) => String(b.slot).localeCompare(String(a.slot)));
  for (const s of ordered) { if (s.isPassive) continue; if ((s.cdLeft ?? 0) > 0) continue; return s; }
  return c.skills.find((s) => !s.isPassive) ?? null;
}

/**
 * A non-boss enemy (wave mob) takes its turn. A wave mob is a CHAMPION, so it now runs the exact same
 * `applySkill` engine as our team — furthest-right skill off cooldown (pickEnemySkill), executed through
 * the shared side-aware path. Enemy-side buffs / heals / revives, lifesteal, on-attacked, reflect: all
 * work for free because there is one path, not two. Only the boss keeps a scripted kit (dragon.js).
 *
 * v0 SIMPLIFICATION still flagged: skill SELECTION is "furthest-right off cooldown" (no heal/revive
 * condition locks for mobs); real enemy AI varies. Damage still needs the mob's coeff — a coeff-less
 * skill flags MISSING and deals 0 (the same honest gap champions have).
 */
export function actEnemyMob(state, mob) {
  if (!alive(state.allies).length) return;
  const skill = pickEnemySkill(mob);
  if (!skill) return;
  state.onAction?.(state, mob, skill);   // ACTION HOOK (no-op unless set)
  skill.cdLeft = skill.cooldown ?? 0;
  dispatchSkill(state, mob, skill);   // THE ONE ENGINE: recipeFor(authored) || kitToRecipe(auto-parse) → applyRecipe
}

export function applyDebuff(t, d) { upsert(t.debuffs, d); }
export function upsert(list, e) {
  const cur = list.find(x => x.type === e.type);
  if (cur) {
    cur.turnsLeft = Math.max(cur.turnsLeft, e.turns ?? 2);
    if (/Shield/.test(e.type)) { cur.value = e.value ?? cur.value; return; }   // 'override', not additive
    cur.stacks = Math.min((cur.stacks ?? 1) + (e.stacking ? 1 : 0), e.maxStacks ?? 1); return;
  }
  list.push({ type: e.type, value: e.value ?? null, pct: e.pct ?? null, turnsLeft: e.turns ?? 2, stacks: 1 });
}

export { readSkillKit, classifySkill };

// SIDE-EFFECT: load the interpreter so it registers the recipe engine (registerRecipeEngine) — see the note at
// the top. A controlled engine↔interpreter cycle, safe because every cross-call is at RUNTIME (battle time),
// never at module-eval: by the time a skill is dispatched, both modules are fully loaded. This guarantees the
// ONE combat engine is available even for tools that import only engine.js and never call installRecipeRun.
import './interpreter.js';
