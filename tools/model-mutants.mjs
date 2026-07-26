// tools/model-mutants.mjs — MODEL QA · TEETH (mutation testing for the Action Verification Model).
//
// The Model (recipes + interpreter) is a PIECE of the eventual Simulator, so it gets the LOCAL half of
// the QA protocol (unit / toy / invariants / sensitivity) — and this rung proves those checks have teeth.
// It injects a known BUG into lib/sim/interpreter.js, re-runs the Model's no-DB toy-battle rungs, and
// confirms at least one goes red. A mutant that survives green is a HOLE (expectKill) or a not-yet-pinned
// mechanic (probe). Kill rate = the Model suite's defect-detection power, as a NUMBER (MODEL_AS_REIMPL).
//
// Same discipline as the Simulator's sim-mutants.mjs, pointed at the Model's core + the Model's rungs.
// Source is mutated IN PLACE and restored on every exit path; a `find` matching ≠1× is STALE and fails.
// Run: node tools/model-mutants.mjs   (no DB)

import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const INTERP = path.join(__dirname, '..', 'lib', 'sim', 'interpreter.js');
const ENGINE = path.join(__dirname, '..', 'lib', 'sim', 'engine.js');
const DRAGON = path.join(__dirname, '..', 'lib', 'sim', 'dragon.js');
// The Model's core spans the recipe interpreter, the engine mechanics it calls (damage math, the buff→stat
// consumer), AND the scripted boss (dragon.js — now under the Model via model-boss.mjs). A mutant names its
// file; default is the interpreter. All three are snapshot + restored.
const FILE = (m) => (m.file === 'engine' ? ENGINE : m.file === 'dragon' ? DRAGON : INTERP);

// The Model's no-DB toy-battle rungs = the suite under test. A mutant is KILLED if ANY goes red. model-boss.mjs
// is the boss-sequence rung — the killer for the dragon.js mutants below.
const RUNGS = ['sim-recipe-test.mjs', 'sim-recipe-b-test.mjs', 'sim-recipe-c-test.mjs', 'sim-recipe-d-test.mjs', 'model-invariants.mjs', 'model-sensitivity.mjs', 'model-boss.mjs'];

// expectKill:true — a Model rung MUST catch this; surviving = a SUITE HOLE (blocks).
// expectKill:false — a PROBE; surviving is a reported COVERAGE GAP (a Model mechanic no rung pins yet).
const MUTANTS = [
  { name: 'shield value zeroed (pctOfCasterMaxHp ignored)', expectKill: true,
    find: 'ef.pctOfCasterMaxHp != null ? Math.round(ef.pctOfCasterMaxHp * (actor.maxHp || 0))',
    repl: 'ef.pctOfCasterMaxHp != null ? Math.round(0 * (actor.maxHp || 0))' },
  { name: 'debuff immunity ignored (immune target still gets it)', expectKill: true,
    find: 'if (t.immune?.includes(ef.type)) { E({ kind: \'debuff\'',
    repl: 'if (false) { E({ kind: \'debuff\'' },
  { name: 'revive HP wrong (30% -> 60% of MAX HP)', expectKill: true,
    find: 't.hp = (act.effect?.hpPct ?? 0.30) * t.maxHp;',
    repl: 't.hp = (act.effect?.hpPct ?? 0.30) * t.maxHp * 2;' },
  { name: 'multi-hit collapsed (hitCount forced to 1)', expectKill: true,
    find: 'for (let h = 0; h < (F.hitCount ?? 1); h++) {',
    repl: 'for (let h = 0; h < 1; h++) {' },
  { name: 'conditional AoE broken (always takes the else branch)', expectKill: true,
    find: 'const branch = pass ? act.targetIf.then : act.targetIf.else;',
    repl: 'const branch = act.targetIf.else;' },
  { name: 'heal zeroed (pctOfCasterMaxHp ignored)', expectKill: true,
    find: 'act.effect.pctOfCasterMaxHp != null ? act.effect.pctOfCasterMaxHp * (actor.maxHp || 0)',
    repl: 'act.effect.pctOfCasterMaxHp != null ? 0 * (actor.maxHp || 0)' },
  { name: 'buff-steal moves nothing (splice 0 buffs)', expectKill: true,
    find: 'const stolen = t.buffs.splice(0, t.buffs.length);',
    repl: 'const stolen = t.buffs.splice(0, 0);' },
  { name: 'lowest_hp_ally recipient becomes HIGHEST-HP', expectKill: true,
    find: '(a.hp / a.maxHp <= b.hp / b.maxHp ? a : b))] : [];',
    repl: '(a.hp / a.maxHp >= b.hp / b.maxHp ? a : b))] : [];' },

  // ── formerly coverage gaps — now pinned by sim-recipe-d-test / the exact-damage assertion ──
  { name: 'incoming-damage modifiers neutralised (Aid the Feeble / Pelops -20% / nullify)', expectKill: true, file: 'engine',
    find: 'factor *= mod.factor;', repl: 'factor *= 1;' },
  { name: 'EXTEND_EFFECT no-op (buff durations not extended)', expectKill: true,
    find: 'for (const b of t.buffs) { b.turnsLeft += turns; n++; }',
    repl: 'for (const b of t.buffs) { b.turnsLeft += 0; n++; }' },
  { name: 'crit removed from DEAL_DAMAGE (exact-damage math)', expectKill: true, file: 'engine',
    find: 'const critM = cr.mult;',
    repl: 'const critM = 1;' },
  { name: 'heal uncapped — HP can exceed MAX (only the invariants rung sees this)', expectKill: true,
    find: 'const before = t.hp; t.hp = Math.min(t.maxHp, t.hp + amt * (1 - healReduction(t)));',
    repl: 'const before = t.hp; t.hp = t.hp + amt * (1 - healReduction(t));' },
  { name: 'ignore_shield ignored (shields absorb an ignore-shield hit anyway)', expectKill: true,
    find: "const dd = dealDamage(t, raw, 'direct', actor, opponents, !!fl.ignore_shield, !!fl.ignore_block_damage);",
    repl: "const dd = dealDamage(t, raw, 'direct', actor, opponents, false, !!fl.ignore_block_damage);" },
  { name: 'passive immunities dropped (Pelops no longer immune to HP Burn)', expectKill: true,
    find: 'out.push(...r.immune);', repl: 'out.push();' },
  // ── buff→stat CONSUMER (engine.js statFactor) — the [Increase/Decrease ATK/DEF] damage layer ──
  { name: 'stat buffs ignored ([Increase ATK/DEF] made inert)', expectKill: true, file: 'engine',
    find: 'const up = best(m.up, c.buffs);', repl: 'const up = 0 * best(m.up, c.buffs);' },
  { name: 'stat debuffs ignored ([Decrease Attack/Defense] made inert)', expectKill: true, file: 'engine',
    find: 'const down = Math.min(1, best(m.down, c.debuffs));', repl: 'const down = 0 * Math.min(1, best(m.down, c.debuffs));' },
  // ── SPD turn-order CONSUMER (engine.js nextActor) — [Increase SPD]/[Decrease Speed] shift turn order ──
  { name: 'SPD modifiers ignored by scheduler (nextActor reverts to raw c.spd)', expectKill: true, file: 'engine',
    find: 'const spd = (c) => effectiveSpeed(c);', repl: 'const spd = (c) => (c.spd ?? 0);' },
  // ── Poison Sensitivity CONSUMER (engine.js tickDots) — amplifies each [Poison] tick ──
  { name: 'Poison Sensitivity ignored (tick amplifier dropped)', expectKill: true, file: 'engine',
    find: 'const sens = 1 + poisonSensitivity(c);', repl: 'const sens = 1 + 0 * poisonSensitivity(c);' },
  // ── Reflect Damage CONSUMER (engine.js dealDamage) — attacker takes value% of the inflicted damage ──
  { name: 'Reflect Damage ignored (nothing reflected to the attacker)', expectKill: true, file: 'engine',
    find: 'const reflectBuffDmg = reflectPct > 0 ? Math.round(reflectPct * amount) : 0;',
    repl: 'const reflectBuffDmg = reflectPct > 0 ? Math.round(0 * reflectPct * amount) : 0;' },
  // ── Pelops A2 DYNAMIC SCALER (interpreter.js dynamicScaleFactor) — +10%/debuff-turn on self & target ──
  { name: 'dynamic scaler neutralised (Pelops A2 +10%/debuff-turn ignored)', expectKill: true, file: 'engine',
    find: 'return 1 + Math.min(ds.capBonus ?? Infinity, (ds.pctPer ?? 0) * count);',
    repl: 'return 1 + Math.min(ds.capBonus ?? Infinity, (ds.pctPer ?? 0) * count * 0);' },
  // ── Arbalester A3 per-target-debuff ADDITIVE term (engine.js formulaBase) — +1×ATK per debuff count ──
  { name: 'per-target-debuff term dropped (Arbalester A3 "(2+Total Debuff)" ignored)', expectKill: true, file: 'engine',
    find: 'if (F.perTargetDebuff) base += F.perTargetDebuff.coeff * (target?.debuffs?.length ?? 0)',
    repl: 'if (F.perTargetDebuff) base += 0 * F.perTargetDebuff.coeff * (target?.debuffs?.length ?? 0)' },
  // ── Pelops passive: caster-conditional chance (interpreter.js effectiveChance) — HP Burn/Petri halve under [Decrease DEF] ──
  { name: 'caster-conditional chance ignored (Pelops passive stays 100/50% under [Decrease DEF])', expectKill: true,
    find: '(ef.chanceIfCasterUnder && (actor.debuffs ?? []).some((d) => d.type === ef.chanceIfCasterUnder.debuff))',
    repl: '(false && (actor.debuffs ?? []).some((d) => d.type === ef.chanceIfCasterUnder.debuff))' },
  // ── Pelops A1: target-conditional resistance bypass (interpreter.js isUnresistable) — unresistable if target [HP Burn] ──
  { name: 'target-conditional unresistable ignored (Pelops A1 Decrease ATK still resisted under [HP Burn])', expectKill: true,
    find: '(ef.unresistableIfTargetUnder && (t.debuffs ?? []).some((d) => d.type === ef.unresistableIfTargetUnder))',
    repl: '(false && (t.debuffs ?? []).some((d) => d.type === ef.unresistableIfTargetUnder))' },
  // ── Pelops A2: target-conditional ignore-DEF (engine.js computeRawHit) — ignore 50% DEF if target [HP Burn] ──
  { name: 'target-conditional ignore-DEF ignored (Pelops A2 does not ignore DEF under [HP Burn])', expectKill: true, file: 'engine',
    find: 'if (F.ignoreDefIfTargetUnder && (t.debuffs ?? []).some((d) => d.type === F.ignoreDefIfTargetUnder.debuff))',
    repl: 'if (false && (t.debuffs ?? []).some((d) => d.type === F.ignoreDefIfTargetUnder.debuff))' },
  // ── Lifesteal CONSUMER on the recipe path (interpreter.js dealOneHit) — heal % of damage dealt ──
  { name: 'lifesteal not consumed on the recipe path (heal zeroed)', expectKill: true,
    find: 'const heal = Math.min((actor.maxHp ?? 0) - actor.hp, actor.lifesteal * dealt * (1 - healReduction(actor)));',
    repl: 'const heal = Math.min((actor.maxHp ?? 0) - actor.hp, actor.lifesteal * dealt * (1 - healReduction(actor)) * 0);' },
  // ── ignore_shield must NOT bypass [Magma Shield] (engine.js dealDamage) — Pelops's tank identity ──
  { name: 'ignore_shield wrongly bypasses [Magma Shield] too (kills the tank)', expectKill: true, file: 'engine',
    find: "if (ignoreShield && b.type === 'Shield') continue;",
    repl: 'if (ignoreShield) continue;' },
  // ── Bambus Sleeping Sage: wake must remove [Sleep] before the CC check (else he skips turns) ──
  { name: 'Sleeping Sage wake does not remove [Sleep] (Bambus would skip turns)', expectKill: true,
    find: "owner.debuffs = owner.debuffs.filter((d) => d.type !== 'Sleep');",
    repl: "owner.debuffs = owner.debuffs.filter((d) => d.type !== 'NoSuchDebuff');" },
  // ── Bambus sponge: a debuff on an ally must transfer to the asleep Bambus ──
  { name: 'Sleeping Sage sponge never fires (ally debuffs not absorbed)', expectKill: true,
    find: 'if (!rollChance(state?.rng?.debuff, 0.75)) return;',
    repl: 'if (true) return;' },
  // ── Enemy AI targeting: LOWEST MAX HP rule (engine.chooseSingleTarget), not lowest current HP% ──
  { name: 'AI targeting reverts to lowest current-HP% (ignores the max-HP glass-cannon rule)', expectKill: true, file: 'engine',
    find: 'if ((a.maxHp ?? 0) !== (b.maxHp ?? 0)) return (a.maxHp ?? 0) < (b.maxHp ?? 0) ? a : b;',
    repl: 'if (false && (a.maxHp ?? 0) !== (b.maxHp ?? 0)) return (a.maxHp ?? 0) < (b.maxHp ?? 0) ? a : b;' },
  // ── Enfeeble CONSUMER (engine.js computeRawHit) — an Enfeebled attacker can only land weak hits (×0.70) ──
  { name: 'Enfeeble not consumed (Enfeebled attacker still hits full, not weak)', expectKill: true, file: 'engine',
    find: "const affM = (actor.debuffs ?? []).some((d) => d.type === 'Enfeeble') ? WEAK_HIT_ENFEEBLE :",
    repl: "const affM = (false) ? WEAK_HIT_ENFEEBLE :" },
  // ── Round-based Perfect Veil TIMING (engine.js round boundary) — round_start fires ONCE per round, not per
  // turn; firing every turn re-veils a fast Ezio forever (the old 100%-uptime bug), killing the down>0 check ──
  { name: 'round boundary fires every turn (Perfect Veil never lapses — the old 100%-uptime bug)', expectKill: true, file: 'engine',
    find: 'if (!state.roundActed || livingNow.every(c => state.roundActed.has(c))) {',
    repl: 'if (true) {' },
  // ── Passive-trigger COOLDOWN (interpreter.js fireTriggers) — Vergis Second Wind [Shield] gated at cd 3;
  // ignoring the gate re-procs the shield every hit (the boss-phase over-survival bug) ──
  { name: 'passive-trigger cooldown ignored (Second Wind [Shield] re-procs every hit)', expectKill: true,
    find: 'if ((owner.passiveCd[key] ?? 0) > 0) {',
    repl: 'if (false) {' },

  // ══ BOSS (dragon.js) — Hellrazor's turn-by-turn sequence, now under the Model via model-boss.mjs (P1b) ══
  { name: 'Inhale does not arm the purple bar', expectKill: true, file: 'dragon',
    find: 'state.purpleBarLeft = purpleBarHp ?? 0;', repl: 'state.purpleBarLeft = 0;' },
  { name: 'Inhale does not drain the boss Turn Meter', expectKill: true, file: 'dragon',
    find: 'boss.turnMeter = 0;   // Inhale drains the boss Turn Meter', repl: 'boss.turnMeter = 100;   // Inhale drains the boss Turn Meter' },
  { name: 'team damage does not drain the purple bar (onDamageToBoss no-op)', expectKill: true, file: 'dragon',
    find: 'if (state.purpleBarLeft > 0) state.purpleBarLeft = Math.max(0, state.purpleBarLeft - amount);',
    repl: 'if (state.purpleBarLeft > 0) state.purpleBarLeft = state.purpleBarLeft;' },
  { name: 'Scorch never fires when the bar is up (bar>0 gate broken)', expectKill: true, file: 'dragon',
    find: '} else if (state.purpleBarLeft > 0) {', repl: '} else if (false) {' },
  { name: 'Wall of Fire places no [Poison]', expectKill: true, file: 'dragon',
    find: "for (let i = 0; i < 2; i++) applyDebuff(a, { type: 'Poison', pct: 0.05, turns: 3, stacking: true, maxStacks: 10 });",
    repl: "for (let i = 0; i < 0; i++) applyDebuff(a, { type: 'Poison', pct: 0.05, turns: 3, stacking: true, maxStacks: 10 });" },
  { name: 'Swipe places no [Decrease Attack]', expectKill: true, file: 'dragon',
    find: "applyDebuff(a, { type: 'Decrease Attack', value: 50, turns: 2 });",
    repl: "applyDebuff(a, { type: 'NoSuchDebuff', value: 50, turns: 2 });" },
  { name: 'boss hit bypasses the incoming-mitigation stack (P1a reverted)', expectKill: true, file: 'dragon',
    find: 'incomingDamage(state, a, bossHit(boss, a))', repl: 'bossHit(boss, a)' },
  { name: 'interrupted-Scorch turn is NOT wasted (boss falls through to a normal hit — the old bug)', expectKill: true, file: 'dragon',
    find: "boss.turnMeter = 0; state.log.push({ turn: state.turn, phase: 'boss', event: 'scorch interrupted — turn wasted' }); return;",
    repl: "boss.turnMeter = 0; state.log.push({ turn: state.turn, phase: 'boss', event: 'scorch interrupted — turn wasted' });" },
  // ── Almighty Immunity: [Enfeeble] must NOT be placeable on the boss (Bambus A3 boss-branch) ──
  { name: 'boss no longer immune to [Enfeeble] (Almighty Immunity broken)', expectKill: true, file: 'dragon',
    find: "'Stun', 'Freeze', 'Sleep', 'Petrification', 'Enfeeble', 'Provoke', 'Fear', 'True Fear',",
    repl: "'Stun', 'Freeze', 'Sleep', 'Petrification', 'NoSuchImmunity', 'Provoke', 'Fear', 'True Fear'," },
  // ── is_boss per-target branch (Bambus A3: Decrease ATK on the boss instead of Enfeeble) ──
  { name: 'is_boss condition broken (Bambus A3 boss Decrease-ATK branch never fires)', expectKill: true,
    find: "if (cond.kind === 'is_boss')      return t.role === 'boss';",
    repl: "if (cond.kind === 'is_boss')      return false;" },
  // ── target_has_buffs per-target branch (Renegade A2: Decrease ACC only on a buffed target) ──
  { name: 'target_has_buffs condition broken (Renegade A2 conditional Decrease-ACC never fires)', expectKill: true,
    find: "if (cond.kind === 'target_has_buffs') return (t.buffs ?? []).length > 0;",
    repl: "if (cond.kind === 'target_has_buffs') return false;" },
  // ── [Heal Reduction] consumer (engine.healReduction) — a heal into a Heal-Reduced target must be cut ──
  { name: '[Heal Reduction] not consumed (heals land at full despite the debuff)', expectKill: true, file: 'engine',
    find: '/Heal Reduction/i.test(d.type)', repl: '/NoSuchReduction/i.test(d.type)' },
  // ── ACC modifiers consumer (engine.effectiveAcc) — [Increase/Decrease ACC] must fold into land chance ──
  { name: 'ACC modifiers not consumed (effectiveAcc ignores [Increase/Decrease ACC])', expectKill: true, file: 'engine',
    find: "export const effectiveAcc = (c) => (c.acc ?? 0) * statFactor(c, 'acc');",
    repl: 'export const effectiveAcc = (c) => (c.acc ?? 0);' },
  // ── [Block Damage] consumer (engine.dealDamage) — a [Block Damage] buff must negate a normal direct hit ──
  { name: '[Block Damage] not consumed (a normal hit lands despite the buff)', expectKill: true, file: 'engine',
    find: "if (kind === 'direct' && !ignoreBlockDamage && target.buffs.some((b) => b.type === 'Block Damage')) {",
    repl: "if (false && kind === 'direct' && !ignoreBlockDamage && target.buffs.some((b) => b.type === 'Block Damage')) {" },
  // ── ignore_block_damage bypass (engine.dealDamage) — Faceless/Lua A3 must bypass [Block Damage] ──
  { name: 'ignore_block_damage ignored (Faceless/Lua A3 still blocked by [Block Damage])', expectKill: true, file: 'engine',
    find: "!ignoreBlockDamage && target.buffs.some((b) => b.type === 'Block Damage')",
    repl: "true && target.buffs.some((b) => b.type === 'Block Damage')" },
  // ── extra-hit proc (interpreter DEAL_DAMAGE) — Faceless/Crossbowman A1 must fire a 15% extra hit ──
  { name: 'extra-hit proc dropped (Faceless/Crossbowman A1 never fire the extra hit)', expectKill: true,
    find: 'if (F.extraHitChance && t.alive && rollChance(state?.rng?.proc, F.extraHitChance)) {',
    repl: 'if (false && F.extraHitChance && t.alive && rollChance(state?.rng?.proc, F.extraHitChance)) {' },
  // ── random-target-per-hit (interpreter DEAL_DAMAGE) — Renegade A2 / Apothecary A1 scatter their hits ──
  { name: 'random-target-per-hit dropped (hits revert to the fixed ACQUIRE target)', expectKill: true,
    find: 'if (F.randomTargetPerHit) {                 // "attacks N times at random": each hit re-picks a random living target',
    repl: 'if (false) {                 // "attacks N times at random": each hit re-picks a random living target' },
  // ── SELF_DAMAGE (interpreter) — Renegade A3 must cost the caster 30% of its own MAX HP ──
  { name: 'SELF_DAMAGE neutralised (Renegade A3 self-cost zeroed)', expectKill: true,
    find: 'actor.hp = Math.max(0, actor.hp - dmg);',
    repl: 'actor.hp = Math.max(0, actor.hp - dmg * 0);' },
  // ── REDUCE_EFFECT_DURATION (interpreter) — Bambus A2 must decrease enemy buff durations ──
  { name: 'REDUCE_EFFECT_DURATION no-op (enemy buff durations not decreased)', expectKill: true,
    find: 'for (const b of t.buffs) { b.turnsLeft -= turns; n++; }',
    repl: 'for (const b of t.buffs) { b.turnsLeft -= turns * 0; n++; }' },
  // ── crit-heal rider (interpreter) — Lua A2 must heal 2.5% per critical hit ──
  { name: 'crit-heal rider zeroed (Lua A2 does not heal on crit)', expectKill: true,
    find: 'const heal = Math.min((actor.maxHp ?? 0) - actor.hp, critP * F.critHealPct * (actor.maxHp ?? 0) * (1 - healReduction(actor)));',
    repl: 'const heal = Math.min((actor.maxHp ?? 0) - actor.hp, critP * F.critHealPct * (actor.maxHp ?? 0) * (1 - healReduction(actor)) * 0);' },
  // ── crit-splash rider (interpreter) — Lua A1 must splash 50% of the hit to other enemies on crit ──
  { name: 'crit-splash rider zeroed (Lua A1 does not splash on crit)', expectKill: true,
    find: 'const splash = critP * F.critSplashPct * raw;',
    repl: 'const splash = critP * F.critSplashPct * raw * 0;' },
  // ── DEBUFF_ACTIVATION (interpreter) — Ezio A2 must activate+remove enemy [Poison] at ≥4 debuff slots ──
  { name: 'DEBUFF_ACTIVATION no-op (Ezio A2 does not activate/remove Poison)', expectKill: true,
    find: 'const dealt = activatePoisons(state, t);',
    repl: 'const dealt = 0;' },
  { name: 'DEBUFF_ACTIVATION threshold ignored (activates below the 4-debuff gate)', expectKill: true,
    find: 'if (debuffSlots(t) < minDebuffs) {',
    repl: 'if (false && debuffSlots(t) < minDebuffs) {' },
];

const SNAP = { [INTERP]: fs.readFileSync(INTERP, 'utf8'), [ENGINE]: fs.readFileSync(ENGINE, 'utf8'), [DRAGON]: fs.readFileSync(DRAGON, 'utf8') };
const ORIGINAL = SNAP[INTERP];   // back-compat alias (baseline stale-find checks below still read the interpreter)
const restore = () => { for (const f of [INTERP, ENGINE, DRAGON]) { try { if (fs.readFileSync(f, 'utf8') !== SNAP[f]) fs.writeFileSync(f, SNAP[f]); } catch { fs.writeFileSync(f, SNAP[f]); } } };
process.on('exit', restore);
process.on('SIGINT', () => { restore(); process.exit(130); });
process.on('SIGTERM', () => { restore(); process.exit(143); });

// A rung is RED if it exits non-zero or errors (the recipe rungs exit(fail?1:0)).
function rungRed(script) {
  const r = spawnSync(process.execPath, [path.join(__dirname, script)], { encoding: 'utf8', timeout: 120000, maxBuffer: 64 * 1024 * 1024 });
  return !!(r.error || r.status !== 0);
}

// BASELINE — pristine Model must pass every rung or nothing below means anything.
const baselineRed = RUNGS.filter(rungRed);
if (baselineRed.length) {
  console.log(`\n══ MODEL MUTATION (teeth) ══  ⛔ ABORTED — baseline not green: ${baselineRed.join(', ')} red on pristine interpreter.\n`);
  console.log('QA_JSON ' + JSON.stringify({ rung: 'model-mutation', pass: 0, fail: 1, aborted: true, baselineRed }));
  process.exit(1);
}

const results = [];
for (const m of MUTANTS) {
  const f = FILE(m), src = SNAP[f];
  const occ = src.split(m.find).length - 1;
  if (occ !== 1) { results.push({ ...m, stale: true, occ }); continue; }
  fs.writeFileSync(f, src.replace(m.find, m.repl));
  const killers = RUNGS.filter(rungRed).map(s => s.replace(/^sim-|\.mjs$/g, ''));
  restore();
  results.push({ ...m, killed: killers.length > 0, killers });
}
restore();

const stale = results.filter(r => r.stale);
const applied = results.filter(r => !r.stale);
const killed = applied.filter(r => r.killed);
const holes = applied.filter(r => !r.killed && r.expectKill);
const gaps = applied.filter(r => !r.killed && !r.expectKill);
const killRate = applied.length ? Math.round((killed.length / applied.length) * 100) : 0;

console.log(`\n══ MODEL MUTATION (teeth) ══  ${killed.length}/${applied.length} mutants killed  (kill rate ${killRate}%)\n`);
for (const r of results) {
  if (r.stale) { console.log(`  ⚠ STALE  ${r.name} — find matched ${r.occ}× (need 1)`); continue; }
  const tag = r.killed ? `✓ killed by ${r.killers.join(', ')}` : (r.expectKill ? '✗ SURVIVED — a rung SHOULD catch this (SUITE HOLE)' : '· survived (coverage gap — no Model rung pins this yet)');
  console.log(`  ${r.killed ? '✓' : (r.expectKill ? '✗' : '·')} ${r.name}\n      ${tag}`);
}
if (holes.length) { console.log('\n  ⛔ SUITE HOLES (bugs that slipped past every rung but must be caught):'); for (const r of holes) console.log(`      - ${r.name}`); }
if (gaps.length) { console.log('\n  COVERAGE GAPS (Model mechanics no toy rung pins yet — candidates for a new assertion):'); for (const r of gaps) console.log(`      - ${r.name}`); }

const blocking = holes.length + stale.length;
console.log('\nQA_JSON ' + JSON.stringify({ rung: 'model-mutation', pass: killed.length, fail: blocking, killRate, total: applied.length,
  suiteHoles: holes.map(r => r.name), coverageGaps: gaps.map(r => r.name), stale: stale.map(r => r.name) }));
process.exit(blocking ? 1 : 0);
