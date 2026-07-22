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
    allies, enemies, turn: 0, phase: 'boss', log: [], flags: new Set(flags),
    get combatants() { return [...this.allies, ...this.enemies]; },
  };
}
const alive = (arr) => arr.filter(c => c.alive);
export const CC_SKIPS_TURN = ['Stun', 'Freeze', 'Sleep', 'Petrification', 'Block Active Skills'];
export const flag = (s, msg) => s.flags.add(msg);

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
    } else if (d.type === 'HP Burn') {
      const own = 0.03 * c.maxHp;
      c.hp -= own; dealt += own;
      const side = c.side === 'ally' ? state.allies : state.enemies;
      for (const mate of alive(side)) {
        if (mate === c) continue;
        mate.hp -= 0.03 * mate.maxHp;                       // "and all allies", respective MAX HP
      }
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

export const has = (c, type) => c.buffs.some(b => b.type === type) || c.debuffs.some(d => d.type === type);

/**
 * OUR champions pick targets by LOWEST CURRENT HP PERCENTAGE (auto-battle rule 3, Mike 2026-07-22),
 * avoiding [Unkillable] / [Block Damage] unless nothing else is left.
 */
export function chooseEnemyTarget(enemies) {
  const live = alive(enemies);
  if (!live.length) return null;
  const pickable = live.filter(e => !has(e, 'Unkillable') && !has(e, 'Block Damage'));
  const pool = pickable.length ? pickable : live;
  return pool.reduce((a, b) => (a.hp / a.maxHp <= b.hp / b.maxHp ? a : b));
}

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

      // CC COSTS THE TURN. Stun/Freeze/Sleep/Petrification make the champion skip; cooldowns and
      // durations still tick (Freeze notably does NOT refresh cooldowns, but v0 does not model that
      // distinction — flagged). Before this, CC debuffs were applied and then ignored: a stunned
      // champion acted normally, which on Dragon — whose wall is CC pressure, INS-0021 — erased the
      // dungeon's defining threat. Third instance of "represented but not consumed", after passives
      // and shields.
      if (CC_SKIPS_TURN.some(t => actor.debuffs.some(d => d.type === t))) {
        if (trace) console.log(`  t${String(state.turn).padStart(3)} ${String(actor.name).slice(0,14).padEnd(15)}${'-- CC: turn lost --'.padEnd(22)}`);
        expireDurations(actor); tickCooldowns(actor);
        continue;
      }

      const bossBefore = state.enemies.find(e => e.role === 'boss')?.hp ?? 0;
      let acted = null;
      if (actor.side === 'enemy') phase.actEnemy(state, actor);
      else acted = actChampion(state, actor);
      if (trace) {
        const boss = state.enemies.find(e => e.role === 'boss');
        const dealt = Math.max(0, bossBefore - (boss?.hp ?? 0));
        console.log(`  t${String(state.turn).padStart(3)} ${String(actor.name).slice(0, 14).padEnd(15)}`
          + `${String(acted ?? (actor.side === 'enemy' ? 'ENEMY TURN' : '-')).padEnd(22)}`
          + `boss ${String(boss ? Math.round(100 * boss.hp / boss.maxHp) : 0).padStart(3)}%`
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
  // 1. damage
  if (skill.hitsEnemies) {
    const targets = skill.aoe ? alive(state.enemies) : [chooseEnemyTarget(state.enemies)].filter(Boolean);
    for (const t of targets) {
      if (skill.coeff == null) { flag(state, `MISSING damage_multiplier: ${actor.name} ${skill.slot}`); }
      else {
        dealDamage(t, actor.atk * skill.coeff * critFactor(actor.critRate, actor.critDmg)
                    * defMitigation(t.def) * affinityFactor(actor.affinity, t.affinity), 'direct');
      }
      // debuffs this skill places, gated on ACC vs RES
      for (const d of skill.debuffs ?? []) {
        if (t.immune?.includes(d.type)) continue;
        const p = landChance(actor.acc, t.res);
        if (p == null) { flag(state, `UNKNOWN land chance: ${actor.name} ${d.type}`); continue; }
        if (p >= 1 || p > 0.5) applyDebuff(t, d);     // v0 is DETERMINISTIC — see the flag below
        else flag(state, `debuff likely resisted (${Math.round(p * 100)}%): ${actor.name} ${d.type}`);
      }
    }
  }
  // 2. ally-side effects
  for (const b of skill.buffs ?? []) {
    const targets = b.self ? [actor] : alive(state.allies);
    // a shield's pool is a % of the CASTER's max HP — resolved here, not at parse time
    const applied = b.pctOfCasterMaxHp ? { ...b, value: Math.round(b.pctOfCasterMaxHp * actor.maxHp) } : b;
    if (/Shield/.test(b.type) && !b.pctOfCasterMaxHp) flag(state, `UNKNOWN shield size: ${actor.name} ${skill.slot}`);
    for (const t of targets) upsert(t.buffs, applied);
  }
  if (skill.healPct) for (const t of alive(state.allies)) t.hp = Math.min(t.maxHp, t.hp + skill.healPct * actor.maxHp);
  if (skill.revives) {
    for (const a of state.allies.filter(x => !x.alive)) {
      a.alive = true; a.hp = 0.30 * a.maxHp; a.turnMeter = 0;
      state.log.push({ turn: state.turn, phase: state.phase, event: 'revive', who: a.name, by: actor.name });
    }
  }
  if (skill.cleanses) for (const t of alive(state.allies)) t.debuffs.length = 0;
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
