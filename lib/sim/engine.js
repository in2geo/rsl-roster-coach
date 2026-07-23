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
    atk: o.atk ?? 0, def: o.def ?? 0, spd: o.spd ?? 0,
    acc: o.acc ?? 0, res: o.res ?? 0,
    critRate: o.critRate ?? 0, critDmg: o.critDmg ?? 0,
    affinity: o.affinity ?? null,
    tags: o.tags ?? [],
    skills: o.skills ?? [],
    statsTrust: o.statsTrust ?? {},
    turnMeter: 0, alive: true,
    buffs: [], debuffs: [],
    diedOnTurn: null, diedInPhase: null,
  };
}

// ── damage ───────────────────────────────────────────────────────────────────
// NOMINAL and inherited from lib/power-model.js — the ONLY constant in this file, and it is
// flagged on every use rather than silently applied. Real Raid DEF is a diminishing curve we have
// never implemented (CLAUDE.md lists it as a formulas.js TODO).
// Overridable ONLY so its sensitivity can be measured (SIM_DEF_K=… ). This is DIAGNOSIS, not
// fitting: if the outcome swings wildly with K, the error lives here rather than in the inputs.
// It must not be tuned to match the corpus — that would hide the missing formula inside a constant.
export const DEF_K = Number(process.env.SIM_DEF_K ?? 1500);
export const defMitigation = (def) => DEF_K / (DEF_K + (def ?? 0));
export const critFactor = (cr, cd) => 1 + (Math.min(100, cr ?? 0) / 100) * ((cd ?? 0) / 100);

// multiplier_type: a coefficient scales off the ATTACKER'S OWN stat, named by skill.coeffStat
// (ai.js parseCoeff). HP-scaling (Pelops 0.4 HP) and DEF-scaling (Vergis 3.9 DEF) heroes deal 0 —
// or the wrong number — until the damage calc multiplies by the RIGHT stat instead of always ATK.
export const scaleStat = (c, stat) => stat === 'hp' ? (c.maxHp ?? 0) : stat === 'def' ? (c.def ?? 0) : (c.atk ?? 0);

// [Decrease Defense] lowers the target's EFFECTIVE DEF, which — per damage-mechanics.js §1/§2 (a GAME
// FACT, not calibration) — boosts ATK-vs-DEF ATTACK damage ONLY. DoT (Poison/HP Burn) scales off maxHp
// and is DEF-independent, so it must NOT be routed through this (tickDots never is). The debuff carries
// its OWN magnitude in `value` (60% strong / 30% weak), so NO constant is introduced — this reads the
// data, it does not fit a number. Multiple Decrease DEF do NOT stack; take the largest present.
export function effectiveDef(target) {
  const shreds = (target.debuffs ?? []).filter(d => d.type === 'Decrease Defense').map(d => (d.value ?? 0) / 100);
  const pct = shreds.length ? Math.min(1, Math.max(...shreds)) : 0;
  return (target.def ?? 0) * (1 - pct);
}

// Affinity wheel: Magic > Spirit > Force > Magic. Void is neutral both ways.
const BEATS = { Magic: 'Spirit', Spirit: 'Force', Force: 'Magic' };
export function affinityFactor(attacker, defender) {
  if (!attacker || !defender || attacker === 'Void' || defender === 'Void') return 1;
  if (BEATS[attacker] === defender) return 1.30;   // strong hit
  if (BEATS[defender] === attacker) return 0.70;   // weak hit
  return 1;
}

/** Debuff land chance from ACC vs RES. ~1% resisted per point of RES above the attacker's ACC. */
export function landChance(acc, res) {
  if (acc == null || res == null) return null;      // unknown -> caller must FLAG, not assume
  return Math.max(0.05, Math.min(1, 1 - Math.max(0, res - acc) / 100));
}

// ── state ────────────────────────────────────────────────────────────────────
export function makeState({ allies, enemies, flags = [] }) {
  return {
    allies, enemies, turn: 0, phase: 'boss', log: [], effects: [], flags: new Set(flags),
    get combatants() { return [...this.allies, ...this.enemies]; },
  };
}
const alive = (arr) => arr.filter(c => c.alive);
export const CC_SKIPS_TURN = ['Stun', 'Freeze', 'Sleep', 'Petrification', 'Block Active Skills'];
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
function nextActor(state) {
  const pool = alive(state.combatants).filter(c => c.spd > 0);
  if (!pool.length) return null;
  const dt = Math.min(...pool.map(c => (100 - c.turnMeter) / c.spd));
  for (const c of pool) c.turnMeter += c.spd * dt;
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
function tickDots(state, c) {
  let dealt = 0;
  for (const d of [...c.debuffs]) {
    if (d.type === 'Poison') {
      const dmg = (d.pct ?? 0.05) * c.maxHp * (d.stacks ?? 1);
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
export function dealDamage(target, amount, kind = 'direct') {
  let left = amount;
  if (kind === 'direct') {
    for (const b of target.buffs) {
      if (!/Shield/.test(b.type) || !(b.value > 0)) continue;
      const absorbed = Math.min(b.value, left);
      b.value -= absorbed; left -= absorbed;
      if (b.value <= 0) b.turnsLeft = 0;              // depleted shields drop off
      if (left <= 0) break;
    }
  }
  target.hp -= left;
  return { absorbed: amount - left, toHp: left };
}

/**
 * %-of-target-MAX-HP damage. A DISTINCT family from an ATK-vs-DEF hit (damage-mechanics.js §1,
 * `enemy_max_hp`): DEF-INDEPENDENT, and by its nature not crit- or affinity-scaled — it is a flat
 * fraction of the defender's MAX HP. On stage 21-25 / Hard the fraction is CAPPED to 10% per hit
 * (state.maxHpDamageCap), so a big nuke needs ≥2 hits to break the Dragon purple bar. Absorbed by
 * shields like any direct hit. Records the ledger effect (subtype 'maxHP') itself.
 */
export function dealMaxHpDamage(state, target, pct, E) {
  const cap = state.maxHpDamageCap ?? null;
  const eff = cap != null ? Math.min(pct, cap) : pct;
  const before = target.hp + shieldPool(target);
  dealDamage(target, eff * (target.maxHp ?? 0), 'direct');
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
  const targetable = live.filter(c => !isUntargetable(c));
  const base = targetable.length ? targetable : live;            // all veiled -> veil offers no cover
  const preferred = base.filter(c => !avoid.some(t => has(c, t)));
  const finalPool = preferred.length ? preferred : base;
  return finalPool.reduce((a, b) => (a.hp / a.maxHp <= b.hp / b.maxHp ? a : b));
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
  for (const a of state.allies) {
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
    const startTurn = state.turn;

    while (state.turn < turnCap) {
      const actor = nextActor(state);
      if (!actor) break;
      state.turn += 1;

      tickDots(state, actor);
      checkDeaths(state);
      if (!actor.alive) continue;                   // died to its own DoT before acting

      // START-OF-TURN passives fire before the action AND before the CC check, so a passive self-buff
      // like [Perfect Veil] still renews on a turn the champion is stunned out of. (The renewal is the
      // start-of-turn trigger; it is independent of whether an active skill gets to fire this turn.)
      firePassives(state, actor, 'startOfTurn');
      firePassives(state, actor, 'startOfRound');   // round-start passives re-up each turn (approximation)

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
  skill.cdLeft = skill.cooldown ?? 0;
  applySkill(state, c, skill);
  return `${skill.slot}${skill.coeff != null ? ' x' + skill.coeff : ' (no coeff)'}`;
}

/** Furthest-right available skill, subject to the AI's condition locks (see lib/sim/ai.js). */
function pickSkill(state, c) {
  const ordered = [...c.skills].sort((a, b) => String(b.slot).localeCompare(String(a.slot)));
  for (const s of ordered) {
    if (s.isPassive) continue;                     // passives are not actions — see ai.js
    if (String(s.slot).toUpperCase() === 'A1') continue;
    if ((s.cdLeft ?? 0) > 0) continue;
    if (!canUseSkill(s, state, c)) continue;
    return s;
  }
  return c.skills.find(s => !s.isPassive && String(s.slot).toUpperCase() === 'A1') ?? null;
}

function applySkill(state, actor, skill) {
  const E = (rec) => recordEffect(state, { source: actor.name, slot: skill.slot, ...rec });
  // 1. damage
  if (skill.hitsEnemies) {
    const targets = skill.aoe ? alive(state.enemies) : [chooseEnemyTarget(state.enemies)].filter(Boolean);
    for (const t of targets) {
      if (skill.maxHpPct != null) {
        dealMaxHpDamage(state, t, skill.maxHpPct, E);   // DEF-independent %-of-target-MAX-HP nuke (capped on stage 21+/Hard)
      } else if (skill.coeff == null) {
        flag(state, `MISSING damage_multiplier: ${actor.name} ${skill.slot}`);
        E({ kind: 'damage', target: t.name, fired: true, consumed: false, note: 'MISSING coeff' });  // data gap, not a consumption bug
      } else {
        const before = t.hp + shieldPool(t);
        dealDamage(t, scaleStat(actor, skill.coeffStat) * skill.coeff * critFactor(actor.critRate, actor.critDmg)
                    * defMitigation(effectiveDef(t)) * affinityFactor(actor.affinity, t.affinity), 'direct');
        const dealt = before - (t.hp + shieldPool(t));    // consumed = a REAL HP-or-shield delta, not "we called dealDamage"
        E({ kind: 'damage', target: t.name, fired: true, consumed: dealt > 0, amount: dealt });
      }
      // debuffs this skill places, gated on ACC vs RES
      for (const d of skill.debuffs ?? []) {
        if (t.immune?.includes(d.type)) { E({ kind: 'debuff', subtype: d.type, target: t.name, fired: true, consumed: false, note: 'immune' }); continue; }
        const p = landChance(actor.acc, t.res);
        if (p == null) { flag(state, `UNKNOWN land chance: ${actor.name} ${d.type}`); E({ kind: 'debuff', subtype: d.type, target: t.name, fired: true, consumed: false, note: 'UNKNOWN land chance' }); continue; }
        if (p >= 1 || p > 0.5) { applyDebuff(t, d); E({ kind: 'debuff', subtype: d.type, target: t.name, fired: true, consumed: t.debuffs.some(x => x.type === d.type) }); }   // v0 is DETERMINISTIC
        else { flag(state, `debuff likely resisted (${Math.round(p * 100)}%): ${actor.name} ${d.type}`); E({ kind: 'debuff', subtype: d.type, target: t.name, fired: true, consumed: false, note: `resisted ${Math.round(p * 100)}%` }); }
      }
    }
  }
  // 2. ally-side buffs — shared with the passive-trigger system, so a buff placed by a passive lands
  //    through the exact same path (shield %HP resolution, effect ledger) as an active-skill buff.
  applyBuffList(state, actor, skill.buffs, skill.slot, E);
  if (skill.healPct) for (const t of alive(state.allies)) {
    const before = t.hp; t.hp = Math.min(t.maxHp, t.hp + skill.healPct * actor.maxHp);
    E({ kind: 'heal', target: t.name, fired: true, consumed: t.hp > before, amount: t.hp - before, note: t.hp > before ? undefined : 'overheal (target at full)' });
  }
  if (skill.revives) {
    for (const a of state.allies.filter(x => !x.alive)) {
      a.alive = true; a.hp = 0.30 * a.maxHp; a.turnMeter = 0;
      state.log.push({ turn: state.turn, phase: state.phase, event: 'revive', who: a.name, by: actor.name });
      E({ kind: 'revive', target: a.name, fired: true, consumed: a.alive });
    }
  }
  if (skill.cleanses) for (const t of alive(state.allies)) {
    const had = t.debuffs.length; t.debuffs.length = 0;
    E({ kind: 'cleanse', target: t.name, fired: true, consumed: had > 0, note: had > 0 ? undefined : 'no debuffs to cleanse' });
  }
}

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
        if (p >= 1 || p > 0.5) { applyDebuff(t, d); E({ kind: 'debuff', subtype: d.type, target: t.name, fired: true, consumed: t.debuffs.some(x => x.type === d.type) }); }
        else { flag(state, `passive debuff likely resisted (${Math.round(p * 100)}%): ${actor.name} ${d.type}`); E({ kind: 'debuff', subtype: d.type, target: t.name, fired: true, consumed: false, note: `resisted ${Math.round(p * 100)}%` }); }
      }
    }
  }
}

/** Furthest-right castable skill off cooldown. Enemies have no heal/revive condition locks. */
function pickEnemySkill(c) {
  const ordered = [...c.skills].sort((a, b) => String(b.slot).localeCompare(String(a.slot)));
  for (const s of ordered) { if (s.isPassive) continue; if ((s.cdLeft ?? 0) > 0) continue; return s; }
  return c.skills.find(s => !s.isPassive) ?? null;
}

/**
 * A non-boss enemy (wave mob) takes its turn. GENERIC — unlike the boss's scripted kit, a mob acts
 * from its extracted champion kit: furthest-right skill off cooldown, hits our lowest-HP% ally (AoE
 * hits all), and applies that skill's debuffs to the target gated on the mob's ACC vs the ally's RES.
 *
 * v0 SIMPLIFICATIONS, FLAGGED not hidden (do not let these harden into invisible constants):
 *   1. targeting is "lowest ally HP%" — real enemy AI varies and is not modelled here.
 *   2. enemy-side buffs / heals / revives are NOT modelled.
 *   3. mob damage needs the mob's coeff, which shares the damage_multiplier gap — a coeff-less mob
 *      deals 0 direct damage and threatens only via debuffs. That is the RIGHT failure: it localises
 *      "the wave killed us" to damage-we-cannot-see vs debuff-pressure-we-can.
 */
export function actEnemyMob(state, mob) {
  const allies = alive(state.allies);
  if (!allies.length) return;
  const skill = pickEnemySkill(mob);
  if (!skill) return;
  skill.cdLeft = skill.cooldown ?? 0;
  const targets = skill.aoe ? allies : [chooseAllyTarget(allies)].filter(Boolean);   // single-target skips a veiled ally; AoE hits through
  const E = (rec) => recordEffect(state, { source: mob.name, slot: skill.slot, ...rec });
  for (const t of targets) {
    if (skill.maxHpPct != null) { dealMaxHpDamage(state, t, skill.maxHpPct, E); }
    else if (skill.coeff == null) { flag(state, `MISSING damage_multiplier (mob): ${mob.name} ${skill.slot}`); E({ kind: 'damage', target: t.name, fired: true, consumed: false, note: 'MISSING coeff' }); }
    else {
      const before = t.hp + shieldPool(t);
      dealDamage(t, scaleStat(mob, skill.coeffStat) * skill.coeff * critFactor(mob.critRate, mob.critDmg) * defMitigation(effectiveDef(t)) * affinityFactor(mob.affinity, t.affinity), 'direct');
      E({ kind: 'damage', target: t.name, fired: true, consumed: (before - (t.hp + shieldPool(t))) > 0, amount: before - (t.hp + shieldPool(t)) });
    }
    for (const d of skill.debuffs ?? []) {
      if (t.immune?.includes(d.type)) { E({ kind: 'debuff', subtype: d.type, target: t.name, fired: true, consumed: false, note: 'immune' }); continue; }
      const p = landChance(mob.acc, t.res);
      if (p == null) { flag(state, `UNKNOWN land chance (mob): ${mob.name} ${d.type}`); E({ kind: 'debuff', subtype: d.type, target: t.name, fired: true, consumed: false, note: 'UNKNOWN land chance' }); continue; }
      if (p >= 1 || p > 0.5) { applyDebuff(t, d); E({ kind: 'debuff', subtype: d.type, target: t.name, fired: true, consumed: t.debuffs.some(x => x.type === d.type) }); }
      else { flag(state, `mob debuff likely resisted (${Math.round(p * 100)}%): ${mob.name} ${d.type}`); E({ kind: 'debuff', subtype: d.type, target: t.name, fired: true, consumed: false, note: `resisted ${Math.round(p * 100)}%` }); }
    }
  }
}

export function applyDebuff(t, d) { upsert(t.debuffs, d); }
function upsert(list, e) {
  const cur = list.find(x => x.type === e.type);
  if (cur) {
    cur.turnsLeft = Math.max(cur.turnsLeft, e.turns ?? 2);
    if (/Shield/.test(e.type)) { cur.value = e.value ?? cur.value; return; }   // 'override', not additive
    cur.stacks = Math.min((cur.stacks ?? 1) + (e.stacking ? 1 : 0), e.maxStacks ?? 1); return;
  }
  list.push({ type: e.type, value: e.value ?? null, pct: e.pct ?? null, turnsLeft: e.turns ?? 2, stacks: 1 });
}

export { readSkillKit, classifySkill };
