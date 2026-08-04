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
import { RECIPES, champKey, combatantKey } from './recipes.js';   // read-only: incomingDamage() scans champions' `modifiers` (recipes.js imports nothing → no cycle). combatantKey = identity-by-id lookup for the combatant side.
import { MASTERY_BY_NAME } from '../masteries.js';  // read-only mastery mech specs (lib/masteries.js imports data only → no cycle)

// Derive the SIM-relevant mastery mechanics from a champion's mastery NAMES. Flat-stat masteries are
// EXCLUDED — those are already folded into the champ's effective stats via Gestal bonusesV2.mastery
// (effective-stats.js), so re-adding them here would double-count. Returns the conditional damage mods,
// Ignore-DEF procs (Helmsmasher), and boss %maxHP bonus (Warmaster / Giant Slayer) the sim DOES model.
function deriveMasteryMech(names) {
  const damageMods = [], ignoreDefProcs = []; let bossBonus = null;
  for (const nm of names ?? []) {
    const rec = MASTERY_BY_NAME.get(nm); const m = rec?.mech; if (!m) continue;
    if (m.sim === 'damage_mult') damageMods.push({ name: nm, ...m });
    else if (m.sim === 'ignore_def_proc') ignoreDefProcs.push({ name: nm, ...m });
    else if (m.sim === 'boss_bonus_damage') bossBonus = { name: nm, ...m };
  }
  return { damageMods, ignoreDefProcs, bossBonus };
}

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
  const mm = deriveMasteryMech(o.masteries);
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
    bossMastery: o.bossMastery ?? false,  // LEGACY boss-mastery flag -> WARMASTER_MAXHP EV per attacking turn (used only when masteryBossBonus is absent)
    masteries: o.masteries ?? [],         // decoded mastery NAMES (data/masteries.json). Flat-stat masteries are NOT re-applied here — they are already in the effective stats via bonusesV2.mastery.
    masteryDamageMods: mm.damageMods,     // conditional damage-inflicted multipliers (Heart of Glory, Bring It Down, Opportunist, …) folded into computeRawHit
    masteryIgnoreDef: mm.ignoreDefProcs,  // Helmsmasher: chance to ignore a DEF fraction on a hit
    masteryBossBonus: mm.bossBonus,       // Warmaster / Giant Slayer %maxHP bonus spec (target-type-aware); preferred over the legacy bossMastery flag
    mCounters: { ambush: new Set() },     // per-battle mastery counters: Ruthless Ambush's already-first-hit enemies
    gearProcs: o.gearProcs ?? [],         // COMPLETE chance-proc gear sets (lib/sim/gear.js); on-attack GEAR_PROC family
    skills: o.skills ?? [],
    skillOrder: o.skillOrder ?? null,     // CONFIRMED non-default slot order (e.g. Ezio ['A2','A3','A1']); null => default A3>A2>A1
    statsTrust: o.statsTrust ?? {},
    turnMeter: o.turnMeter ?? 0, alive: true,   // default 0 (Dragon byte-identical); Spider spawns pass ~2/3 (Mike first-party 2026-07-29)
    taken: 0, healed: 0,                  // results-screen accounting (records only, never read by battle logic → golden-safe). Mirrors the in-game blue (taken) / green (healed) bars — `taken` counts SHIELD-ABSORBED (blue) damage AS WELL AS HP loss (see dealDamage), so a heavily-shielded champ (Pelops) reports high taken even with ~0 HP lost.
    buffs: [], debuffs: [],
    diedOnTurn: null, diedInPhase: null,
    // IDENTITY, resolved once at the fixture-build boundary (via the champion-names registry) and carried on
    // the combatant, so every authored-data lookup keys on the champion ID — never on a re-normalized display
    // name. `champId` = champions.id UUID; `recipeKey` = champKey(canonical name), the offline key the RECIPES
    // registry is authored under (derived from the ID via byId[hit.id].name). combatantKey() reads recipeKey and
    // falls back to champKey(name) only for un-resolved combatants (ad-hoc test fixtures). See combatantKey.
    champId: o.champId ?? null, recipeKey: o.recipeKey ?? null,
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
export const RNG_STREAMS = ['damage', 'crit', 'affinity', 'debuff', 'target', 'ai', 'mastery', 'gear', 'proc'];
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
// Resolve a crit for ONE hit, exposing the OUTCOME (not just the multiplier) so crit-CONDITIONAL riders
// (heal-on-crit, splash-on-crit) can key off it. Seeded → ONE draw from the crit stream (crit iff draw <
// cr/100), mult = full C.DMG on a crit else ×1 — the IDENTICAL roll to critMult, so seeded sequences are
// unchanged. Deterministic (no stream) or FORCE_CRIT_EV → NO discrete crit: mult = critFactor (the EV blend)
// and ev=true, so a rider uses its OWN expected value (cr% × effect) instead of firing on a fake all-or-nothing.
export function rollCrit(state, cr, cd) {
  if (!FORCE_CRIT_EV && state?.rng?.crit) {
    const crit = state.rng.crit() < Math.min(100, cr ?? 0) / 100;
    return { crit, mult: crit ? 1 + (cd ?? 0) / 100 : 1, ev: false };
  }
  return { crit: false, mult: critFactor(cr, cd), ev: true };
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
  acc: { up: ['Increase ACC', 'Increase Accuracy'], down: ['Decrease ACC', 'Decrease Accuracy'] },   // % of ACC — folded into effectiveAcc, the landChance consumer
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
// [Increase ACC] / [Decrease ACC] fold into EFFECTIVE accuracy — the consumer for the ACC modifiers, used at
// every landChance site (a champion's debuffs land more/less as their ACC is buffed/debuffed). Bambus A3 places
// both (Increase ACC on allies, Decrease ACC on enemies); Renegade A2 places Decrease ACC on us. Non-stacking
// (statFactor takes the largest), data-driven (% in the effect's value), NO constant. ⚠ modelling ACC modifiers
// as a % of ACC (consistent with Increase ATK/DEF/SPD); confirm vs the in-game tooltip if a flat form appears.
export const effectiveAcc = (c) => (c.acc ?? 0) * statFactor(c, 'acc');
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
// [Strengthen] buff reduces the DAMAGE the holder RECEIVES by its `value`% (the standard game buff is a flat
// −25%; Iudex Artor A2 places 25). The survival analogue of [Reflect Damage]/[Increase DEF]: read from data →
// NO constant, non-stacking (max, matching the other consumers). Returns the damage MULTIPLIER (0.75 when
// strengthened, 1 when not). Consumed in incomingDamage, folded into the enemy→ally direct-hit multiplier stack.
export const strengthenFactor = (c) => {
  const vals = (c.buffs ?? []).filter((b) => b.type === 'Strengthen').map((b) => (b.value ?? 0) / 100);
  return vals.length ? 1 - Math.min(1, Math.max(...vals)) : 1;
};
// [Heal Reduction] on the RECIPIENT of a heal reduces it by the debuff's % (100% = no heal at all). Consumed at
// EVERY heal site (doHeal / tickHots / both lifesteal paths). Non-stacking: take the largest present. Reads the
// effect's own value → NO constant. Renegade A1 places 100% for 1t — a heal-reduced ally gets no sustain that turn.
export const healReduction = (c) => { const v = (c.debuffs ?? []).filter((d) => /Heal Reduction/i.test(d.type)).map((d) => (d.value ?? 0) / 100); return v.length ? Math.min(1, Math.max(...v)) : 0; };

// GATE #2 — the CONSUMER REGISTRY: every lasting buff/debuff a recipe PLACES must have a wired consumer, or it
// is "represented but not consumed" (it lands and does nothing — the Heal-Reduction / ACC-modifier trap). This
// Set is the authoritative list of effect types that ARE consumed somewhere; tools/sim-validate-recipes.mjs fails
// if a PLACE_BUFF/PLACE_DEBUFF names a type absent here. Keep it in lockstep with the consumers above — adding a
// placed effect without adding it here (and its consumer) turns the ladder red. (Comment = where each is consumed.)
export const CONSUMED_EFFECTS = new Set([
  // buffs
  'Increase ATK', 'Increase Attack', 'Increase DEF', 'Increase Defense', 'Increase SPD', 'Increase Speed',   // statFactor
  'Increase ACC', 'Increase Accuracy',   // effectiveAcc (landChance)
  'Increase C.RATE',                      // critRateBuff → effectiveCritRate
  'Shield', 'Magma Shield',               // dealDamage (shield absorb; Magma reflects + lifesteals)
  'Block Damage',                         // dealDamage (negates direct hits; Faceless/Lua A3 ignore it)
  'Continuous Heal',                      // tickHots
  'Reflect Damage',                       // dealDamage (reflect to attacker)
  'Strengthen',                           // incomingDamage (−25% damage received)
  'Ally Protection',                      // dealDamage (redistribution)
  'Taunt', 'Provoke',                     // chooseSingleTarget (forced target)
  'Perfect Veil', 'Veil',                 // chooseSingleTarget (untargetable)
  // debuffs
  'Decrease Attack', 'Decrease ATK', 'Decrease Defense', 'Decrease DEF', 'Decrease Speed', 'Decrease SPD',   // statFactor
  'Decrease ACC', 'Decrease Accuracy',    // effectiveAcc (landChance)
  'Poison', 'HP Burn',                    // tickDots (DoT)
  'Bomb',                                 // tickBombs (detonates after N turns)
  'Poison Sensitivity',                   // poisonSensitivity (tick amplifier)
  'Heal Reduction',                       // healReduction
  'Enfeeble',                             // computeRawHit (forced weak hit)
  'Stun', 'Freeze', 'Sleep', 'Petrification',   // CC_SKIPS_TURN (turn lost)
]);

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
// Hard CC (Stun/Freeze/Sleep/Petrification) FREEZES skill cooldowns — they do NOT tick down while the unit is
// disabled (reviewer 2026-08-02: on a turn lost to hard CC, "do not refresh skill cooldowns"). Buff/debuff
// DURATIONS still advance (expireDurations); only the cooldown advance is suppressed. Block Active Skills is
// NOT a hard disable (the unit still takes its turn, restricted to A1), so it does NOT preserve cooldowns.
export const CC_PRESERVES_COOLDOWNS = ['Stun', 'Freeze', 'Sleep', 'Petrification'];
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
// DISCRETE-OVERFLOW scheduler — the UNIFIED speed model for ALL content (default; Spider is no longer a
// special case). A single speed model MUST apply everywhere — the game does not use different turn-meter math
// per dungeon (Mike, 2026-08-02). RAID fills turn meter in discrete ticks of SPD/7: several units shoot PAST
// 100 in one tick and the highest RAW meter acts, so a unit sitting at exactly 100 waits behind units that
// overshot it (Mike first-party 2026-07-30: Skavag reaches full when the 3rd spiderling attacks, then waits
// for #4/#5/#6 and Bambus). The actor resets by −100 (keeps its overflow); everyone else retains theirs.
// This is the community-reverse-engineered ΔTM = effectiveSPD / 7 per shared tick (reviewer 2026-08-02).
// A `tmChargeOnly` unit (Skavag) does NOT accumulate on its own SPD here — its meter is charged by swarm
// activity (spawns + spiderling moves), so after a consume, with nothing moving, it barely charges and WAITS.
const DISCRETE_TICK = 1 / 7;   // ΔTM per shared tick = effectiveSPD × (1/7) — the reviewer's SPD÷7 (200 SPD → 28.57%/tick → meaningful overflow, e.g. 4 ticks = 114%)
function nextActorDiscrete(state) {
  const spd = (c) => effectiveSpeed(c);
  const pool = alive(state.combatants);
  if (!pool.length) return null;
  const movers = pool.filter(c => !c.tmChargeOnly && spd(c) > 0);   // charge-only units rise only via external charges
  let guard = 0;
  while (!pool.some(c => c.turnMeter >= 100) && guard++ < 500000) {
    for (const c of movers) c.turnMeter += spd(c) * DISCRETE_TICK;   // uncapped — overflow is preserved
  }
  const ready = pool.filter(c => c.turnMeter >= 100);
  if (!ready.length) return null;
  const actor = ready.reduce((a, b) => (b.turnMeter > a.turnMeter ? b : a));   // highest RAW meter (overflow order)
  if (actor) { state.onSchedule?.(state, actor, pool); actor.turnMeter -= 100; }   // reset ONLY the actor, by 100 → keeps its overflow; everyone else retains theirs
  return actor;
}
export function nextActor(state) {
  // UNIFIED speed model: the discrete-overflow scheduler is the DEFAULT for ALL content (Mike 2026-08-02 —
  // one speed model everywhere, no per-dungeon math). The legacy continuous path below is retained only for
  // an explicit opt-out (state.discreteScheduler === false), e.g. A/B measurement; nothing sets it in prod.
  if (state.discreteScheduler !== false) return nextActorDiscrete(state);
  // Turn-meter fill rate uses EFFECTIVE speed (base ± [Increase SPD]/[Decrease Speed]), not raw c.spd, so
  // speed buffs/debuffs actually shift turn order — the SPD consumer. effectiveSpeed folds the modifiers.
  const spd = (c) => effectiveSpeed(c);
  const pool = alive(state.combatants).filter(c => spd(c) > 0);
  if (!pool.length) return null;
  const dt = Math.min(...pool.map(c => (100 - c.turnMeter) / spd(c)));
  for (const c of pool) c.turnMeter += spd(c) * dt;
  // Among everyone who reached full meter this tick, the FASTEST acts first (RSL breaks a turn-meter tie by
  // speed, not by array position). This matters when several units share full TM — e.g. the Spider opening where
  // the whole team starts at 100: without this, the pick would fall to array order (Ezio first) instead of the
  // fastest (Bambus). Single-crosser case is unchanged (the filter holds one unit).
  const ready = pool.filter(c => c.turnMeter >= 99.999);
  const actor = ready.length ? ready.reduce((a, b) => (spd(b) > spd(a) ? b : a)) : null;
  // TURN-ORDER telemetry (no-op unless set): expose the scheduler's pick + the full turn-meter landscape at
  // the instant of selection, BEFORE the meter is reset, so a verifier can assert the acting unit really held
  // the highest turn meter (correct order by effective speed). See tools/turn-verify.mjs.
  if (actor) { state.onSchedule?.(state, actor, pool); actor.turnMeter = 0; }
  return actor;
}

/**
 * DoTs tick at the START of the affected champion's turn (keyword-glossary.json).
 * HP Burn hits "they AND ALL ALLIES for 3% of their respective MAX HP" — so a burn on one enemy
 * splashes onto every other enemy including the boss. That is the Spider kill vector and it falls
 * out of a faithful implementation rather than needing a special case.
 */
// CREDIT a DoT's damage to the champion(s) who OWN it (placed it), divided by stack ownership — Raid credits
// the POISONER, not whoever triggers it (Ezio's A2 activation) and not the DoT itself. `sources` = {name:stacks}
// carried on the debuff from placement (and re-attributed to Bambus on his sponge/dump redirect). Falls back to
// the DoT type ('Poison') as the ledger source only when unowned. One 'dot' event per owner → per-hero DEALT
// attributes correctly (sim-trace sums 'dot' events sourced to an ally). See recipes: Ezio A2 places+activates.
function creditDot(state, target, subtype, totalDmg, sources) {
  const entries = sources ? Object.entries(sources) : [];
  const sum = entries.reduce((s, [, n]) => s + n, 0);
  if (!sum) { recordEffect(state, { source: subtype, kind: 'dot', subtype, target: target.name, fired: true, consumed: totalDmg > 0, amount: totalDmg }); return; }
  for (const [src, n] of entries) recordEffect(state, { source: src, kind: 'dot', subtype, target: target.name, fired: true, consumed: totalDmg > 0, amount: totalDmg * n / sum });
}
export function tickDots(state, c) {
  let dealt = 0;
  const sens = 1 + poisonSensitivity(c);   // [Poison Sensitivity] amplifies each Poison tick (consumer)
  for (const d of [...c.debuffs]) {
    if (d.type === 'Poison') {
      // Spider "Healing Assured": Poison deals 10% of normal to Skavag (−90%); default 1 elsewhere (Dragon
      // byte-identical). Boss-only, Poison-only — HP Burn and the Spiderlings are unreduced.
      const bossPoisonFactor = (c.role === 'boss' ? (state.poisonDamageFactorVsBoss ?? 1) : 1);
      const dmg = (d.pct ?? 0.05) * c.maxHp * (d.stacks ?? 1) * sens * bossPoisonFactor;
      c.hp -= dmg; dealt += dmg; c.taken += dmg;
      creditDot(state, c, 'Poison', dmg, d.sources);   // credit the placer(s), not 'Poison'
    } else if (d.type === 'HP Burn') {
      const own = 0.03 * c.maxHp;
      c.hp -= own; dealt += own; c.taken += own;
      // ATTRIBUTION (mirror of Poison): credit each HP Burn HP-reduction to the champion that PLACED it
      // (via `sources`), STAMPED ON THE UNIT ACTUALLY HIT. The own tick lands on the burning unit; the
      // "and all allies" splash lands on every other same-side unit at 3% of ITS max HP. On Spider this
      // IS the Pelops engine — his burn on the Spiderlings splashes onto Skavag every tick, and all of it
      // is HIS damage; stamping the splash on SKAVAG (not on the Spiderling that carried the burn) is what
      // lets target-filtered attribution SEE the splash reaching the boss instead of it hiding under the
      // Spiderling. Splitting per-target leaves the DEALT total (own + Σsplash) byte-identical to the old
      // single aggregate. Falls back to 'HP Burn' if unowned. (Healing Assured cuts POISON, not HP Burn.)
      creditDot(state, c, 'HP Burn', own, d.sources);
      const side = c.side === 'ally' ? state.allies : state.enemies;
      let splash = 0;
      for (const mate of alive(side)) {
        if (mate === c) continue;
        const s = 0.03 * mate.maxHp; mate.hp -= s; mate.taken += s; splash += s;   // "and all allies", respective MAX HP
        creditDot(state, mate, 'HP Burn', s, d.sources);   // splash stamped on the unit actually hit (Skavag included)
      }
      d.tickCount = (d.tickCount ?? 0) + 1;   // A/B telemetry (records-only): tick ORDINAL for this placement — tickNo 1 = first activation, 2 = second
      recordEffect(state, { kind: 'burn_tick', subtype: 'HP Burn', target: c.name, tickNo: d.tickCount, splash, fired: true, consumed: true });
      state.onHpBurnActivate?.(state);   // "whenever a [HP Burn] is activated" → Artak's Burning Blood self-destruction (no-op without it)
    }
  }
  return dealt;
}

// DEBUFF-COUNT in SLOTS: each [Poison] STACK occupies its own debuff slot (the rule behind the 10-debuff cap),
// so a stacked Poison counts as `stacks` debuffs, not one. Used by the "under N+ debuffs" activation condition.
export const debuffSlots = (c) => (c.debuffs ?? []).reduce((n, d) => n + (d.stacks ?? 1), 0);
// Force-ACTIVATE all [Poison] on a target: deal ONE tick per Poison NOW (the tickDots formula incl. [Poison
// Sensitivity]) and REMOVE the Poison (Mike-confirmed: poisons are removed when the skill lands). Debuff
// ACTIVATION (tag policy #12) = damage acceleration + slot relief — distinct from a natural tick, which leaves
// the Poison in place. Returns the damage dealt.
export function activatePoisons(state, t) {
  const poisons = (t.debuffs ?? []).filter((d) => d.type === 'Poison');
  if (!poisons.length) return 0;
  const sens = 1 + poisonSensitivity(t);
  // Skavag's "Healing Assured" cuts POISON on the boss to 10% — and it must cut ACTIVATED poison too, exactly
  // like the natural tick (tickDots). This was MISSING → Ezio's A2 detonated the boss's poison at FULL damage,
  // bypassing the 90% reduction (2.33M poison-to-boss AFTER a supposed 90% cut = ~23M pre-cut, impossible).
  // Boss-only, Poison-only; Dragon (factor 1) unchanged. (Bug found 2026-07-30 via boss-damage attribution.)
  const bossPoisonFactor = (t.role === 'boss' ? (state.poisonDamageFactorVsBoss ?? 1) : 1);
  let dealt = 0;
  // Ezio's A2 triggers the full tick NOW, but the damage is CREDITED TO THE POISONER (each Poison's owner),
  // not to Ezio — Raid's results screen attributes it to whoever placed it (e.g. Bambus / Xenomorph).
  for (const d of poisons) { const dmg = (d.pct ?? 0.05) * (t.maxHp ?? 0) * (d.stacks ?? 1) * sens * bossPoisonFactor; t.hp -= dmg; dealt += dmg; t.taken += dmg; creditDot(state, t, 'Poison', dmg, d.sources); }
  t.debuffs = t.debuffs.filter((d) => d.type !== 'Poison');   // removed when the skill lands
  return dealt;
}

/**
 * Force an immediate HP Burn tick (own + "and all allies" splash) on `t` — Artak's A2 "instantly activates
 * one tick of all [HP Burn] on all enemies". On Spider this is the anti-consume DETONATOR: activating the
 * burn on the burning Spiderlings splashes 3% of Skavag's MAX HP per burn onto the boss NOW, BEFORE her
 * consume turn — which is exactly the burn-splash kill vector (mirrors tickDots' HP Burn branch).
 *
 * UNLIKE Poison activation, the burn is NOT removed — the card says "activates ONE TICK", i.e. an EXTRA
 * accelerated tick; the [HP Burn] debuff continues its normal duration (and still ticks on the unit's turn).
 * Credited to the placer(s), stamped on the unit actually hit (the splash → the boss), same as tickDots so
 * target-filtered boss-damage attribution sees it. (Healing Assured cuts POISON, not HP Burn — no factor.)
 */
export function activateHpBurns(state, t) {
  const burns = (t.debuffs ?? []).filter((d) => d.type === 'HP Burn');
  if (!burns.length) return 0;
  const side = t.side === 'ally' ? state.allies : state.enemies;
  let dealt = 0;
  for (const d of burns) {
    const own = 0.03 * (t.maxHp ?? 0); t.hp -= own; dealt += own; t.taken += own; creditDot(state, t, 'HP Burn', own, d.sources);
    for (const mate of alive(side)) {
      if (mate === t) continue;
      const s = 0.03 * (mate.maxHp ?? 0); mate.hp -= s; mate.taken += s; dealt += s; creditDot(state, mate, 'HP Burn', s, d.sources);   // "and all allies", respective MAX HP
    }
    state.onHpBurnActivate?.(state);   // each forced activation → Artak's Burning Blood self-destruction (no-op without it)
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
    const full = ((b.value ?? 15) / 100) * (c.maxHp ?? 0) * (1 - healReduction(c));   // [Heal Reduction] cuts the [Continuous Heal] tick. FULL incl. overheal (mirrors in-game healing stat)
    c.hp = Math.min(c.maxHp, c.hp + full);
    c.healed += full;
    recordEffect(state, { source: 'Continuous Heal', kind: 'heal', subtype: 'Continuous Heal', target: c.name,
      fired: true, consumed: full > 0, amount: full, note: (c.hp - before) < full ? `incl. overheal ${Math.round(full - (c.hp - before))}` : undefined });
  }
}

// [BOMB] detonation (Ezio A2). A [Bomb] debuff carries a stored `value` (detonation damage = multiplier ×
// placer ATK, fixed at placement) and a `countdown`. At the START of the bearer's turn the countdown drops by
// 1; at 0 the bomb DETONATES — deals its value as a direct hit (absorbed by shields; DEF-independent and
// non-crit, the value is fixed) — and is removed. Each [Bomb] is a SEPARATE entry (2 bombs → 2 detonations).
// expireDurations leaves [Bomb] alone (countdown-managed here, not duration-managed).
export function tickBombs(state, c) {
  let dealt = 0;
  for (const b of [...(c.debuffs ?? [])]) {
    if (b.type !== 'Bomb') continue;
    b.countdown = (b.countdown ?? 1) - 1;
    if (b.countdown > 0) continue;
    const dmg = b.value ?? 0;
    dealDamage(c, dmg, 'direct', null);
    dealt += dmg;
    c.debuffs = c.debuffs.filter((d) => d !== b);
    recordEffect(state, { source: 'Bomb', kind: 'detonate', subtype: 'Bomb', target: c.name, fired: true, consumed: dmg > 0, amount: dmg });
  }
  return dealt;
}

// The turn currently being taken — stamped onto every effect at placement (upsert) so expireDurations can
// tell an effect placed DURING this unit's own turn (reactive: Pelops's on-attacked [Petrification] lands on
// the attacking mob mid-turn) from one that has already lived a turn. Raid counts a duration in the affected
// unit's OWN turns, so an effect placed on turn T must survive T's end-expiration and first tick at the unit's
// NEXT turn. Without this, a 1-turn reactive CC placed on the actor was ticked 1→0 at the same turn's end and
// removed before it could skip anything (petrification landed but caused 0 skips — the wave-2 survival bug).
let CURRENT_TURN = 0;
function expireDurations(c) {
  const reactiveBurnFix = process.env.SIM_REACTIVE_BURN_FIX !== '0';   // reactive-HP-Burn lifecycle fix ON by default; SIM_REACTIVE_BURN_FIX=0 disables it for A/B measurement only
  for (const list of [c.buffs, c.debuffs]) {
    for (const e of [...list]) {
      if (e.type === 'Bomb') continue;
      // A reactive [Petrification] OR [HP Burn] lands on the ATTACKING mob mid-turn (Pelops's on-attacked passive,
      // Master of Games). Raid counts duration in the mob's OWN turns, so an effect placed DURING the mob's turn
      // must survive that turn's end-expiration and first-tick at the mob's NEXT turn. Without this guard the fresh
      // debuff is ticked down the same turn: [Petrification] landed but caused 0 skips (the wave-2 survival bug),
      // and a reactive [HP Burn] ticked ONCE instead of twice — halving Pelops's HP-Burn splash onto Skavag (the
      // Spider-13 activation wall, verified 2026-07-29). Both are placed reactively on the HOLDER during its own
      // turn. NORMALLY-placed debuffs are unaffected: expireDurations runs only on the ACTOR, and a debuff placed
      // on a DIFFERENT unit during the attacker's turn has placedTurn===CURRENT_TURN only for that reactive self-case.
      if ((e.type === 'Petrification' || (e.type === 'HP Burn' && reactiveBurnFix)) && e.placedTurn === CURRENT_TURN) continue;
      if (e.stackTurns) {   // STACKING debuff (Poison): age each stack's own timer; drop the expired ones individually
        e.stackTurns = e.stackTurns.map(t => t - 1).filter(t => t > 0);
        e.stacks = e.stackTurns.length;
        if (e.stacks === 0) { list.splice(list.indexOf(e), 1); continue; }
        e.turnsLeft = Math.max(...e.stackTurns);
        continue;
      }
      e.turnsLeft -= 1; if (e.turnsLeft <= 0) list.splice(list.indexOf(e), 1);
    }
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
export function dealDamage(target, amount, kind = 'direct', attacker = null, team = null, ignoreShield = false, ignoreBlockDamage = false) {
  // [BLOCK DAMAGE]: a timed buff that NEGATES all direct damage from hits while active. Unlike a [Shield] it
  // is not a pool — it does not deplete per hit; it blocks every hit until it expires. "ignore [Block Damage]"
  // (Faceless/Lua A3) bypasses it entirely. Fully blocks BEFORE Ally-Protection redirect and shields — nothing
  // is inflicted, so no HP loss, no shield chip, no reflect. DoT scope mirrors [Shield] (direct-only). No
  // stage-16 combatant places [Block Damage], so the ignore flag is the surface under test here.
  if (kind === 'direct' && !ignoreBlockDamage && target.buffs.some((b) => b.type === 'Block Damage')) {
    return { absorbed: 0, toHp: 0, magmaAbsorbed: 0, reflected: 0, reflectBuffDmg: 0, blocked: true };
  }
  // [ALLY PROTECTION]: when a protected ally is hit, a `value`% share of the damage is inflicted on the
  // champion who PLACED the buff (the Raid rule — the protector soaks it for the ally), NOT reduced and NOT
  // spread among co-protected allies. The redirected portion then hits the PLACER's OWN shields normally,
  // with no further redirect (team omitted -> no recursion). This is why Vergis (`placedBy`) shows high taken
  // while the carries he protects show low — matching reality. (Was: split-among-other-AP-holders, which
  // credited zero to Vergis and over-took the carries; corrected + card-verified 2026-07-30 — Aegis places AP
  // "on all allies except this Champion", so the protector is never a holder and only the placer can absorb.)
  let apRedirected = 0;
  if (kind === 'direct' && team) {
    const ap = target.buffs.find(b => b.type === 'Ally Protection' && b.value > 0);
    const placer = ap ? team.find(a => a !== target && a.alive && a.name === ap.placedBy) : null;
    if (ap && placer) {
      const redirected = amount * ap.value / 100;
      dealDamage(placer, redirected, kind, attacker);   // to the protector's own HP/shields; team omitted -> no recursion
      amount -= redirected; apRedirected = redirected;   // surfaced in the return so dealOneHit can log the redirect
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
  // `taken` mirrors the in-game results-screen BLUE bar, which counts SHIELD-ABSORBED (blue) damage as well
  // as HP loss (Mike first-party 2026-07-29: a heavily-shielded Pelops takes ~all-blue hits off his Magma +
  // regular Shield, yet shows the team's HIGHEST taken). `amount` = HP loss (left) + shield-absorbed
  // (amount-left) on this target's own share (post Ally-Protection redirect). Records-only → survival/golden
  // unaffected; only the per-hero reality-band comparison changes (shielded champs no longer undercount).
  target.hp -= left; target.taken += amount;
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
    attacker.hp -= (reflected + reflectBuffDmg); attacker.taken += (reflected + reflectBuffDmg);
    // the reflector LIFESTEALS off the MAGMA reflection only. This is how a Lifesteal tank (Pelops) sustains
    // through a wave he can't out-attack: his damage output IS the Magma Shield reflection, so the heal
    // rides on every hit he absorbs — the mechanism that carries him from wave 1 into wave 2 solo.
    if (reflected && target.lifesteal > 0) { const full = target.lifesteal * reflected * (1 - healReduction(target)); target.hp = Math.min(target.maxHp ?? 0, target.hp + full); target.healed += full; }   // [Heal Reduction] cuts Magma-reflection lifesteal too. FULL incl. overheal (mirrors in-game healing stat); hp still clamps
  }
  return { absorbed: amount - left, toHp: left, magmaAbsorbed, reflected, reflectBuffDmg, apRedirected };
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

// ── EVADE (general, recipe-gated) ──────────────────────────────────────────────────────────────────
// A defender can EVADE an incoming enemy skill and ALL its accompanying effects (Michelangelo A4 [Party Dude]:
// "15% chance to Evade an enemy skill and all of its accompanying effects. If under a [Taunt] buff, 30%.").
// The chance is DECLARED on the champion's passive recipe (`evade: { base, underTaunt }`), so this is general
// and GATED: a champion without the field has evadeChanceFor()===0 and rollEvade() returns WITHOUT drawing RNG,
// leaving Dragon (no evader) byte-identical. Rolled off the PROC stream; seed=null → threshold (both 0.15/0.30
// are <0.5 → never fires deterministically, so the golden is unaffected even if an evader were present).
const EVADE_SPECS = Object.fromEntries(
  Object.values(RECIPES).filter(r => r.type === 'passive' && r.evade).map(r => [champKey(r.champion), r.evade]));
export function evadeChanceFor(defender) {
  const spec = EVADE_SPECS[combatantKey(defender)];
  if (!spec) return 0;
  const underTaunt = (defender.buffs ?? []).some(b => b.type === 'Taunt');
  return (underTaunt ? (spec.underTaunt ?? spec.base) : spec.base) ?? 0;
}
// Roll evade for one incoming hit. Returns true when the defender evades (caller negates damage + effects).
// `record` (optional) logs the FIRED/CONSUMED ledger effect so turn-verify can see the evade actually fired.
export function rollEvade(state, defender, attacker = null, record = null) {
  const chance = evadeChanceFor(defender);
  if (chance <= 0) return false;               // no evade passive → no RNG draw (Dragon byte-identical)
  const evaded = rollChance(state?.rng?.proc, chance);
  if (record) record({ kind: 'evade', target: defender.name, fired: true, consumed: evaded,
    note: evaded ? `evaded (${Math.round(chance * 100)}%)` : `no evade (${Math.round(chance * 100)}%)` });
  return evaded;
}

/**
 * Pick a SINGLE-TARGET victim by LOWEST CURRENT HP PERCENTAGE (auto-battle rule 3, Mike 2026-07-22).
 * `avoid` is a soft de-prioritisation ([Unkillable] / [Block Damage] for our champs hitting enemies);
 * untargetability (veil) is a HARD skip unless nothing else remains. Shared by both sides so the veil
 * rule cannot be honored in one direction and forgotten in the other.
 */
// KILLABILITY — the RSL enemy-AI "easiest to kill" rule = the target that dies in the FEWEST hits, i.e. the
// lowest (effective HP ÷ damage a hit would actually deal AFTER that target's mitigation). Reusing
// computeRawHit (crit + variance OFF → consumes NO RNG) folds in DEF + [Increase DEF] (via effectiveDef),
// affinity, and incoming damage-reduction passives — the whole mitigation stack, one source of truth, no
// parallel formula. A [Shield] already counts through effHP; [Reflect Damage] adds a deterrent (attacking the
// target costs the attacker HP). Mike first-party 2026-07-30: the swarm hits Tagoar over Vergis even though
// Vergis has LESS HP, because Vergis holds [Increase DEF] + [Reflect] + [Shield] and Tagoar only a [Shield] —
// so Vergis needs more hits to kill. The `multiplier` is a COMMON scale across candidates, so it cancels in the
// ordering; 1 is fine. Falls back to raw effHP when no attacker is supplied (our-champ targeting + unit tests).
const REFLECT_DETER = 1.5;   // a [Reflect Damage] target is ~1.5× less attractive (the attacker pays to hit it)
// The affinity REFERENCE — deterministic expected direction (advantage 1.30 / disadvantage 0.70 / neutral 1),
// NOT affinityMult (which draws state.rng.affinity). Void never rolls.
const AFF_REF = (atk, def) => (!atk || !def || atk === 'Void' || def === 'Void') ? 1 : (BEATS[atk] === def ? 1.30 : (BEATS[def] === atk ? 0.70 : 1));
const KILL_F = { scalingStat: 'ATK', multiplier: 1 };
// PURE damage estimate for the target decision — it runs for EVERY candidate on EVERY pick, so it MUST NOT
// consume RNG or mutate state. It deliberately does NOT call computeRawHit (whose incomingDamage path draws
// state.rng.damage via rollChance) — that side effect corrupts the whole fight's RNG stream. It mirrors only
// the deterministic mitigation stack: base ATK hit × DEF-mitigation(effectiveDef, which INCLUDES [Increase
// DEF]) × affinity reference. `multiplier` is a common scale across candidates, so it cancels in the ordering.
function killScore(state, attacker, c) {
  const effHp = Math.max(0, c.hp || 0) + shieldPool(c);
  const dmg = Math.max(1, formulaBase(attacker, KILL_F, c) * defMitigation(effectiveDef(c), attacker.level) * AFF_REF(attacker.affinity, c.affinity));
  let hits = effHp / dmg;
  if (c.buffs.some(b => b.type === 'Reflect Damage')) hits *= REFLECT_DETER;
  return hits;
}
export function chooseSingleTarget(pool, avoid = [], attacker = null, state = null) {
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
  // LOWEST CURRENT HP PERCENTAGE — "most killable at that moment" (Mike first-party 2026-07-29: taunt is a
  // reset; when it drops the swarm re-picks the most-killable champ NOW). Dynamic, so heals/shields/revive
  // rotate the target — the property that lets sustain distribute incoming and the team out-last the boss.
  // (Was primary lowest-MAX-HP, a static seat sustain could not redirect → the wrong champ died on repeat.)
  //
  // EASIEST TO KILL — the hardcoded RSL enemy-AI target rule (Mike first-party 2026-07-30): the attacker picks
  // the champion needing the LEAST damage to drop = lowest EFFECTIVE HP = current HP + total active shield
  // absorb across all 3 pools (Equipment + champion-skill [Shield] + [Magma Shield], summed by shieldPool).
  // SHIELDS COUNT (screenshot: swarm hits Tagoar, not the more-shielded Vergis). Now that the 3-pool shield
  // model is in place (equipment shields at round start), the shields are real & depleting, so the target
  // ROTATES as they wear down — the dynamic reality lacked before. Tie-break by lower MAX HP.
  // (weak-affinity-vs-stage, rule #1, still narrows the pool ABOVE this and is unmodelled — inert at Void.)
  // MITIGATION-AWARE pick (fewest hits to kill) when the attacker is known — the real "easiest to kill" rule.
  if (attacker && state) {
    // SHIELD-DOMINANT deterrent (Mike first-party 2026-07-31, Spider-gated): "shields are a BIG deterrent to
    // targeting" — a SHIELDLESS champ is easiest to kill regardless of DEF, so target the LEAST-shielded champ
    // first, tie-broken by killScore. Fixes the Spider wall where high-DEF Pelops (low damage-per-hit → high
    // hits-to-kill) hid from the off-Taunt swarm even when he was the shieldless one; reality focuses him →
    // burn saturates → boss spirals. Gated so Dragon's tuned killScore path is byte-identical.
    if (state.shieldDeterrentTargeting) {
      return finalPool.reduce((a, b) => {
        const sa = shieldPool(a), sb = shieldPool(b);
        if (Math.abs(sa - sb) > 1) return sa < sb ? a : b;         // least-shielded wins (shield = big deterrent)
        return killScore(state, attacker, a) <= killScore(state, attacker, b) ? a : b;   // tie → easiest to kill
      });
    }
    return finalPool.reduce((a, b) => (killScore(state, attacker, a) <= killScore(state, attacker, b) ? a : b));
  }
  // FALLBACK (no attacker supplied): raw effective HP = current HP + all shields, tie-break lower MAX HP.
  const eff = (c) => Math.max(0, c.hp || 0) + shieldPool(c);
  return finalPool.reduce((a, b) => {
    const ea = eff(a), eb = eff(b);
    if (ea !== eb) return ea < eb ? a : b;
    return (a.maxHp ?? 0) <= (b.maxHp ?? 0) ? a : b;   // tie-break by lower MAX HP
  });
}

/** OUR champions target enemies: lowest HP%, hard-skip a veiled enemy, avoid [Unkillable]/[Block Damage]. */
export function chooseEnemyTarget(enemies) { return chooseSingleTarget(enemies, ['Unkillable', 'Block Damage']); }

/** A single enemy (mob/boss single-target) picks one of our team: mitigation-aware "easiest to kill" when the
 *  attacker is supplied (else raw effHP), hard-skip a veiled ally, honor Taunt/Provoke. */
export function chooseAllyTarget(allies, attacker = null, state = null) { return chooseSingleTarget(allies, [], attacker, state); }

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
// EQUIPMENT-GENERATED SHIELDS (shield pool #2 of 3; Mike first-party 2026-07-30). Re-places each ally's
// combined gear-set shield (Shield/Bolster teamwide + Divine self, pre-summed at build in equipmentShieldFor)
// at the start of every round, as a DISTINCT 'Equipment Shield' buff so it coexists with champion-skill
// [Shield] and [Magma Shield] (upsert REPLACES it each round → refresh). Allies only (enemies carry no
// equipmentShield). Golden-safe for content without shield sets (equipmentShield 0/undefined → no-op).
function applyEquipmentShields(state) {
  for (const a of state.allies) {
    if (!a.alive || !(a.equipmentShield > 0)) continue;
    upsert(a.buffs, { type: 'Equipment Shield', value: a.equipmentShield, turns: 3 });
    recordEffect(state, { source: `${a.name} [gear]`, kind: 'buff', subtype: 'Equipment Shield', target: a.name,
      fired: true, consumed: true, amount: a.equipmentShield, note: 'gear-set shield (round start)' });
  }
}

export function simulate(state, content, { turnCap = 400, trace = false } = {}) {
  const phaseResults = [];
  // TRACE — the debugger. A turn loop that produces a wrong answer is inspectable in a way an
  // aggregate never is: you can watch the fight. Prints actor, action and every HP bar per turn.
  const snap = () => state.allies.map(a => `${a.name.split(' ')[0].slice(0, 6)} ${a.alive ? String(Math.round(100 * a.hp / a.maxHp)).padStart(3) + '%' : ' DEAD'}`).join(' ');
  state.trace = trace;
  // %maxHP DAMAGE CAP — stage 21-25 / all-Hard cap %-of-MAX-HP skills to 10% per hit (Dragon
  // purple-bar rule / Almighty Persistence). null = uncapped. Set by content (dragon.makeDragonContent).
  state.maxHpDamageCap = content.maxHpDamageCap ?? null;
  // Dungeon-wide damage factors (default 1 → Dragon byte-identical). Spider: lifesteal heals 35% (Skavag
  // "Healing Assured") and Poison deals 10% of normal to the boss (−90%). Consumed in the lifesteal heal
  // (interpreter.dealOneHit) and tickDots. tmReductionFactorVsBoss is set by Spider 21-25 (wired in Slice C).
  state.lifestealFactor = content.lifestealFactor ?? 1;
  state.poisonDamageFactorVsBoss = content.poisonDamageFactorVsBoss ?? 1;
  state.tmReductionFactorVsBoss = content.tmReductionFactorVsBoss ?? 1;
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
    // WAVE-BOUNDARY TURN RESET — both sides start a wave phase in a FRESH SPD race from turn meter 0
    // (reality-confirmed for wave 2, Mike: the whole team moves once each in SPD order, then Faceless 6th —
    // see test/turn-order/dragon-pool-wave-order.json). Previously only ENEMY tm was zeroed and ALLY tm
    // carried across the transition (engine kept the discrete-overflow meter), so the team flooded ~13 actions
    // off carried meter before the first mob acted. Zeroing allies too makes wave 2 the SPD race reality shows.
    // No-op for the first phase (allies already start at 0). Fixes the wave-transition turn-economy overrun
    // that let the pool team over-survive and Coldheart over-deal (HANDOFF_2026-08-03_turn-model-root-cause).
    for (const c of state.combatants) c.turnMeter = 0;
    state.roundActed = null;   // a new phase (wave) restarts round tracking → round_start fires on its first turn
    content.onPhaseStart?.(state);   // content hook, no-op for Dragon; Spider seeds the 6-Spiderling opening horde
    const startTurn = state.turn;

    while (state.turn < turnCap) {
      const actor = nextActor(state);
      if (!actor) break;
      state.turn += 1;
      CURRENT_TURN = state.turn;   // stamp for placedTurn (expireDurations same-turn guard)
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
        applyEquipmentShields(state);   // pool #2: Shield/Bolster/Divine gear shields refresh at round start
        state.onRoundStart?.(state);
      }
      state.roundActed.add(actor);
      state.onTurnStart?.(state, actor);   // per-turn triggers (e.g. Bambus Sleeping-Sage wake)
      content.onTurnStart?.(state, actor);   // content hook, no-op for Dragon; Spider spawns +2 on each ally turn (incl. Extra Turns — this fires on every turn iteration)

      const bossHpPreTick = state.enemies.find(e => e.role === 'boss')?.hp ?? 0;
      tickDots(state, actor);
      tickBombs(state, actor);                      // [Bomb] counts down and detonates at the start of the bearer's turn
      // DoT / Bomb damage on the boss ALSO eats the purple bar — DoT COUNTS toward the Scorch check (GAME
      // FACT, Mike first-party 2026-08-02). These tick at the boss's OWN turn, so the ally-turn direct feed
      // below never saw them and the bar had to be broken by direct hits alone — inflating the pool-clear
      // window and forcing avoidable Scorches. Credited HERE, before actEnemy resolves the Scorch, so a tick
      // that clears the bar interrupts it. No double-count: boss HP only changes here on the BOSS's turn, and
      // the direct feed below is gated to ally turns.
      if (content.onDamageToBoss) {
        const bossHpPostTick = state.enemies.find(e => e.role === 'boss')?.hp ?? 0;
        const tickDealt = Math.max(0, bossHpPreTick - bossHpPostTick);
        if (tickDealt > 0) content.onDamageToBoss(state, tickDealt);
      }
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
        // 5b (reviewer 2026-08-02): DURATIONS still advance/expire, but hard CC does NOT refresh skill
        // cooldowns — a Stunned/Frozen/Asleep/Petrified unit keeps its cooldowns frozen until it wakes.
        expireDurations(actor);
        if (!actor.debuffs.some(d => CC_PRESERVES_COOLDOWNS.includes(d.type))) tickCooldowns(actor);
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
      // CLEAR — normally all enemies dead; for a spawner boss (Spider) killing the BOSS wins even with adds
      // alive (the Spiderlings die with Skavag). clearOnBossDeath unset (Dragon) → the plain all-dead check.
      const bossCleared = content.clearOnBossDeath && state.enemies.some(e => e.role === 'boss') && !state.enemies.some(e => e.role === 'boss' && e.alive);
      if (!alive(state.enemies).length || bossCleared) {
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
  // TARGET-STAT term: "+coeff × ENEMY MAX HP" (Coldheart A3 "1.7 ATK + 0.1 ENEMY MAX HP", multiplier_type
  // 'formula'). Reads the TARGET's max HP (the sibling of perTargetDebuff, which already reads the target). This
  // is part of the damage FORMULA base — it flows through crit + DEF-mitigation in computeRawHit like any hit,
  // and is DISTINCT from the DEF-independent %-of-MAX-HP DoT family (dealMaxHpDamage / F.maxHpPct), so the
  // state.maxHpDamageCap (Almighty Strength) does NOT apply to it — that cap gates only the maxHpPct nuke path.
  if (F.perTargetMaxHp) base += F.perTargetMaxHp * (target?.maxHp ?? 0);
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
    const first = combatantKey(owner);
    const mods = Object.values(RECIPES).filter((r) => r.modifiers && champKey(r.champion) === first).flatMap((r) => r.modifiers);
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
  factor *= strengthenFactor(target);   // [Strengthen] on the target: −25% damage received (survival buff consumer)
  return amount * factor;
}

// THE unified multiplier stack: crit × DEF-mitigation × affinity/[Enfeeble] × variance × ignore-DEF, plus the
// incoming-damage modifiers. Returns { raw, critM, affM, defM } — the pre-application number + the multipliers
// the caller needs for its structured result. Each multiplier is gated by a formula FLAG so a skill can turn
// any of them off (a plain parsed kit turns them all ON via kitFormula).
// Hard-control debuffs Opportunist keys on (superset of CC_SKIPS_TURN — includes Fear/True Fear, which
// do not skip a turn but ARE control for the mastery's purposes).
const CONTROL_DEBUFFS = new Set(['Stun', 'Freeze', 'Sleep', 'Fear', 'True Fear', 'Petrification']);

// MASTERY conditional DAMAGE multipliers (data/masteries.json, mech.sim === 'damage_mult'). Each is a
// +fraction gated by a battle-state condition, read from DATA (no fitted constant) and folded
// MULTIPLICATIVELY into the direct hit — the same place Decrease DEF / affinity / crit already stack, and
// the correct scope: these offense-tree nodes modify ATTACK "damage inflicted", not the DEF-independent
// DoT family (tickDots) or the %maxHP nuke family (dealMaxHpDamage). Flat-stat masteries are NOT here.
// v1 models the STATELESS conditions; per-use / per-kill stackers (Methodical, Kill Streak) are DEFERRED
// and FLAGGED so they are visible, never silently counted as zero (MODEL_AS_REIMPLEMENTATION.md rule).
function masteryConditionAdd(state, actor, target, F, m) {
  switch (m.when) {
    case 'self_full_hp':         return actor.hp >= (actor.maxHp ?? 0) ? m.value : 0;
    case 'self_hp_le_50':        return actor.hp <= 0.5 * (actor.maxHp ?? 0) ? m.value : 0;
    case 'target_hp_lt_40':      return target && target.hp < 0.4 * (target.maxHp ?? 0) ? m.value : 0;
    case 'target_higher_maxhp':  return target && (target.maxHp ?? 0) > (actor.maxHp ?? 0) ? m.value : 0;
    case 'target_under_control': return target && (target.debuffs ?? []).some((d) => CONTROL_DEBUFFS.has(d.type)) ? m.value : 0;
    case 'target_under_shield':  return target && (target.buffs ?? []).some((b) => /Shield/.test(b.type) && b.value > 0) ? m.value : 0;
    case 'per_dead_ally': {
      const side = actor.side === 'ally' ? state.allies : state.enemies;
      return Math.min(m.cap ?? Infinity, m.value * side.filter((c) => !c.alive).length);
    }
    case 'per_self_debuff':
      return Math.min(m.cap ?? Infinity, m.value * (actor.debuffs ?? []).length);
    case 'first_hit_vs_enemy':   // Ruthless Ambush: +value on the FIRST hit against each enemy (once per enemy)
      if (!target) return 0;
      if (actor.mCounters?.ambush?.has(target)) return 0;
      actor.mCounters?.ambush?.add(target);
      return m.value;
    case 'per_default_use':      // Methodical — DEFERRED (needs a per-skill-use counter)
    case 'per_kill':             // Kill Streak — DEFERRED (needs a kill-event counter)
      flag(state, `mastery DEFERRED (${m.name}): ${actor.name}`);
      return 0;
    default:
      flag(state, `UNKNOWN mastery condition '${m.when}': ${actor.name}`);
      return 0;
  }
}
export function masteryDamageMult(state, actor, target, F) {
  const mods = actor.masteryDamageMods;
  if (!mods || !mods.length) return 1;
  let mult = 1;
  for (const m of mods) { const add = masteryConditionAdd(state, actor, target, F, m); if (add) mult *= (1 + add); }
  return mult;
}
// Helmsmasher (mastery Ignore-DEF proc): each proc has a chance to strip a DEF fraction on THIS hit,
// ADDITIVE with skill-based Ignore DEF. Seeded → roll the 'mastery' stream; deterministic (seed=null) →
// apply the EV (chance × ignore), mirroring applyWarmaster's stream/EV split.
function masteryIgnoreDef(state, actor) {
  const procs = actor.masteryIgnoreDef;
  if (!procs || !procs.length) return 0;
  const stream = state?.rng?.mastery;
  let ig = 0;
  for (const p of procs) ig += stream ? (stream() < p.chance ? p.ignore : 0) : p.chance * p.ignore;
  return ig;
}

export function computeRawHit(state, actor, t, F) {
  const fl = F.flags || {};
  // A per-skill CRIT-RATE bonus (Coldheart A3 "extra 30% chance of inflicting a critical hit") adds to the
  // caster's effective crit rate for THIS hit only. General formula field (F.critRateBonus, percentage points);
  // omitted → unchanged. Clamped to 100 inside rollCrit/critMult.
  const critRate = effectiveCritRate(actor) + (F.critRateBonus ?? 0);
  const cr = fl.crit ? rollCrit(state, critRate, actor.critDmg) : { crit: false, mult: 1, ev: false };
  const critM = cr.mult;
  // [Enfeeble] on the ATTACKER forces a WEAK hit (×0.70), overriding a neutral/strong affinity — the same weak
  // multiplier affinityFactor uses (no new constant). This is the consumer for the Bambus A3 [Enfeeble].
  const affM = (actor.debuffs ?? []).some((d) => d.type === 'Enfeeble') ? WEAK_HIT_ENFEEBLE : (fl.affinity ? affinityMult(state, actor.affinity, t.affinity) : 1);
  const varM = fl.variance ? dmgVariance(state) : 1;
  // ignore_def (0..1) strips that fraction of the target's effective DEF for THIS hit; a conditional variant
  // fires when the TARGET is under a named debuff (Pelops A2: ignore 50% DEF if under [HP Burn]).
  let ignoreDef = fl.ignore_def || 0;
  if (F.ignoreDefIfTargetUnder && (t.debuffs ?? []).some((d) => d.type === F.ignoreDefIfTargetUnder.debuff)) ignoreDef = Math.max(ignoreDef, F.ignoreDefIfTargetUnder.ignore);
  if (F.ignoreDefIfBoss && t.role === 'boss') ignoreDef = Math.max(ignoreDef, F.ignoreDefIfBoss);   // Ninja A3 vs a Boss: ignore 50% DEF
  ignoreDef = Math.min(1, ignoreDef + masteryIgnoreDef(state, actor));   // Helmsmasher (mastery) — additive with skill Ignore DEF, applied to DEF before the mitigation curve
  const defForHit = effectiveDef(t) * (1 - ignoreDef);
  const defM = fl.def_mitigation ? defMitigation(defForHit, actor.level) : 1;
  // masteryDamageMult — conditional offense-tree "damage inflicted" masteries (Heart of Glory, Bring It Down,
  // Opportunist, Ruthless Ambush, …). ×1 for any combatant with no such masteries (enemies, unwired fixtures).
  let raw = formulaBase(actor, F, t) * dynamicScaleFactor(state, F, actor, t) * critM * defM * affM * varM * (actor.dmgMult ?? 1) * masteryDamageMult(state, actor, t, F);
  // ENEMY-MAX-HP ATTACK CAP (Almighty Strength, stages 21-25 + all Hard): an ATTACK carrying a %-target-MaxHP
  // term (Coldheart A3's 0.1×MaxHP) is still an "Enemy MAX HP attack" and cannot exceed cap×target-MaxHP on the
  // hit — final = min(calculated, maxHp×cap), applied post-crit/DEF per the Plarium ruling. This mirrors the
  // dealMaxHpDamage nuke-path cap, but for the FORMULA-embedded term the old code deliberately skipped. Null cap
  // (stages 1-20) → no-op, so Dragon-16 and the golden are byte-identical.
  if (F.perTargetMaxHp && state?.maxHpDamageCap != null) raw = Math.min(raw, (t.maxHp ?? 0) * state.maxHpDamageCap);
  // INCOMING to one of our champions → run the passive damage modifiers (both engines, one place now).
  if (actor.side === 'enemy' && t.side === 'ally') raw = incomingDamage(state, t, raw);
  return { raw, critM, affM, defM, crit: cr.crit, critEv: cr.ev };
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
    // a shield's pool is a % of the CASTER's max HP (or ATK — Michelangelo A4 [Shield] = 300% ATK) — resolved
    // here, not at parse time.
    const applied = b.pctOfCasterMaxHp ? { ...b, value: Math.round(b.pctOfCasterMaxHp * actor.maxHp) }
      : (b.pctOfCasterAtk != null ? { ...b, value: Math.round(b.pctOfCasterAtk * (actor.atk || 0)) } : b);
    if (/Shield/.test(b.type) && b.pctOfCasterMaxHp == null && b.pctOfCasterAtk == null) flag(state, `UNKNOWN shield size: ${actor.name} ${slot}`);
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
        const p = landChance(effectiveAcc(actor), t.res);
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
      const p = landChance(effectiveAcc(defender), attacker.res);
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
  if (!target) return;
  // PREFERRED path — a per-champion boss-bonus spec (from decoded masteries). Target-type-aware: the
  // %maxHP coefficient differs for a CHAMPION target (wave/add: 10% Warmaster / 7.5% Giant Slayer) vs a
  // BOSS (4% / 3%). Warmaster vs boss = 0.60×0.04 EV = 0.024 — identical to the legacy constant, so a
  // Warmaster champ wired the new way is byte-identical vs the boss and correctly HARDER vs waves.
  // v1 applies once per skill against the primary target (Giant Slayer's per-HIT proc is approximated as
  // per-skill — exact only for single-hit skills; multi-hit under-credits it, flagged as a known bound).
  const bb = actor.masteryBossBonus;
  if (bb) {
    const coeff = target.role === 'boss' ? bb.bossMaxHp : bb.championMaxHp;
    const stream = state?.rng?.mastery;
    const dmg = stream ? (stream() < bb.chance ? coeff * (target.maxHp ?? 0) : 0) : bb.chance * coeff * (target.maxHp ?? 0);
    if (dmg > 0) { dealDamage(target, dmg, 'direct', actor, opponents); E({ kind: 'damage', subtype: bb.name, target: target.name, fired: true, consumed: true, amount: dmg, rolled: !!stream }); }
    else E({ kind: 'damage', subtype: bb.name, target: target.name, fired: true, consumed: false, rolled: true, note: `proc missed (${Math.round(bb.chance * 100)}%)` });
    return;
  }
  // LEGACY path (unchanged) — the boolean flag + single boss-tuned EV constant. Kept byte-identical so the
  // golden fixtures (which set bossMastery, not masteries) do not move.
  if (!actor.bossMastery || WARMASTER_MAXHP <= 0) return;
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
// Land a debuff from `attacker` onto `target` through the SAME ACC-vs-RES gate the recipe path uses
// (placeDebuffs stage 2). Scripted content — the Dragon boss/mobs (dragon.js) and Spider's Spiderlings
// (spider.js) — used to call applyDebuff DIRECTLY, so their debuffs landed at 100% regardless of the
// target's RES. That is the second half of the poison inconsistency (spec claims "ACC-vs-RES debuff land
// chance: implemented", but two paths skipped it). Route every scripted placement here so resistance works
// identically everywhere. Immunity is a hard block; `unresistable` skips the roll. Returns whether it landed.
export function landDebuff(state, attacker, target, spec) {
  if (!target.alive) return false;
  if (target.immune?.includes(spec.type)) return false;
  if (!spec.unresistable) {
    const p = landChance(attacker?.acc ?? 0, target.res ?? 0);
    if (p == null || !rollLand(state, p)) return false;
  }
  applyDebuff(target, spec);
  return true;
}
export function upsert(list, e) {
  const cur = list.find(x => x.type === e.type);
  if (cur) {
    cur.placedTurn = CURRENT_TURN;   // (re)applied this turn — exempt from this turn's expiration (see expireDurations)
    // THREE INDEPENDENT SHIELD POOLS (Mike first-party 2026-07-30, community-tested). Each is a DISTINCT
    // buff `type` (all match /Shield/, so shieldPool/dealDamage sum them; distinct type ⇒ upsert keeps them
    // side-by-side, so a champ can hold one of each):
    //   • 'Equipment Shield' (Shield/Bolster/Divine/Bloodshield sets) — multiple SOURCES SUM. The per-round
    //     total is pre-summed at build (equipmentShieldFor) and REPLACED here each round (not accumulated
    //     across rounds — that would run away).
    //   • 'Shield' (champion-skill) and 'Magma Shield' — REPLACEMENT by REMAINING DURATION: a longer-duration
    //     shield wins even if WEAKER (a weak 3t replaces a strong 2t). Same-category shields never add.
    if (e.type === 'Equipment Shield') { cur.value = e.value ?? cur.value; cur.turnsLeft = e.turns ?? 3; return; }
    if (/Shield/.test(e.type)) { const nd = e.turns ?? 2; if (nd > cur.turnsLeft) { cur.turnsLeft = nd; cur.value = e.value ?? cur.value; } return; }
    if (e.stacking) {
      // STACKING debuff (Poison): each application is an INDEPENDENT instance with its OWN duration. A new
      // application NEVER refreshes the existing stacks (the RSL rule) — they age out one at a time. `stackTurns`
      // holds the per-stack turnsLeft; stacks === stackTurns.length. (Was: ONE shared timer, refreshed to full on
      // every reapply → stacks pinned at max forever = immortal poison — the engine-wide over-poison bug the
      // survival oracle caught on both Spider and Dragon. Poison must act the SAME in every formula.)
      cur.stackTurns ??= Array(cur.stacks ?? 1).fill(cur.turnsLeft ?? (e.turns ?? 2));   // migrate a legacy single-timer object
      const cap = e.maxStacks ?? 1;
      if (cur.stackTurns.length < cap) {
        cur.stackTurns.push(e.turns ?? 2);   // new stack, its OWN timer — does not touch the others
        cur.stacks = cur.stackTurns.length;
        cur.turnsLeft = Math.max(...cur.stackTurns);
        if (e.source) { cur.sources ??= {}; cur.sources[e.source] = (cur.sources[e.source] ?? 0) + 1; }   // DoT ownership: credit the poisoner (creditDot)
      }
      return;
    }
    cur.turnsLeft = Math.max(cur.turnsLeft, e.turns ?? 2);   // non-stacking: a reapply REFRESHES duration (standard RSL)
    if (e.placedBy) cur.placedBy = e.placedBy;   // [Ally Protection]: a re-cast updates the protector (redirect recipient)
    if (e.type === 'HP Burn') cur.tickCount = 0;   // A/B telemetry: a refreshed burn is a fresh accounting unit (tick ordinal restarts)
    return;
  }
  list.push({ type: e.type, value: e.value ?? null, pct: e.pct ?? null, turnsLeft: e.turns ?? 2, stacks: 1,
    stackTurns: e.stacking ? [e.turns ?? 2] : undefined, placedTurn: CURRENT_TURN, sources: e.source ? { [e.source]: 1 } : undefined,
    ...(e.placedBy ? { placedBy: e.placedBy } : {}) });
}

export { readSkillKit, classifySkill };

// SIDE-EFFECT: load the interpreter so it registers the recipe engine (registerRecipeEngine) — see the note at
// the top. A controlled engine↔interpreter cycle, safe because every cross-call is at RUNTIME (battle time),
// never at module-eval: by the time a skill is dispatched, both modules are fully loaded. This guarantees the
// ONE combat engine is available even for tools that import only engine.js and never call installRecipeRun.
import './interpreter.js';
