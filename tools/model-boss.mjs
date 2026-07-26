// tools/model-boss.mjs — MODEL QA · the BOSS under the Model (P1b).
//
// Until now the boss (dragon.js Hellrazor) was the ONE combatant with no Model-side verification: its turn-by-
// turn sequence lived only in imperative code + comments, invisible to the QA ladder (root cause R1). This rung
// gives Hellrazor the SAME treatment Bambus's Sleeping Sage has — assert, per turn, that the mechanic that is
// SUPPOSED to fire IS called and its intended effect is APPLIED to world state before the next turn:
//   • Inhale arms the purple bar + drains the boss's own Turn Meter
//   • team damage drains the bar (onDamageToBoss)
//   • Scorch resolves the turn AFTER Inhale — fires (AoE + [Stun]) if the bar is up, is interrupted if cleared
//   • Wall of Fire applies 2×[Poison] + [Weaken]; Swipe applies [Decrease Attack]
//   • P1a: the boss's hit runs through the shared incoming-damage mitigation stack (Pelops −20%)
//   • on-hit reactions fire on the boss's hits (Vergis Second Wind [Shield]) via the onDamageTaken hook
// Deterministic (seed=null), no DB. The teeth for these live in model-mutants.mjs (dragon.js mutants).
// Run: node tools/model-boss.mjs

import { makeCombatant, makeState, incomingDamage } from '../lib/sim/engine.js';
import { makeDragonContent, HELLRAZOR_IMMUNE, bossHit } from '../lib/sim/dragon.js';
import { installRecipeRun } from '../lib/sim/interpreter.js';

let pass = 0, fail = 0;
const catalog = [];   // boss behaviours that are NOT yet verified against the source — surfaced, never silently asserted
const check = (n, c, d = '') => { c ? pass++ : fail++; console.log(`  ${c ? 'PASS' : 'FAIL'}  ${n}${d ? ' — ' + d : ''}`); };

const mkBoss = (over = {}) => { const b = makeCombatant({ name: 'Hellrazor', side: 'enemy', role: 'boss', level: 100, maxHp: 1e7, atk: 5000, def: 2000, spd: 100, acc: 300, res: 0, critRate: 0, critDmg: 0, affinity: 'Void', ...over }); b.immune = HELLRAZOR_IMMUNE; return b; };
const ally = (name = 'Ally', over = {}) => makeCombatant({ name, side: 'ally', maxHp: 20000, def: 1000, spd: 100, affinity: 'Void', ...over });
// Build a fresh boss kit (its cooldowns/scorchArmed are closure state, reset per makeDragonContent call).
const bossKit = (boss, purpleBarHp) => makeDragonContent({ stageNumber: 16, purpleBarHp, boss }).phases.find(p => p.name === 'boss').actEnemy;

console.log('\n=== Hellrazor boss sequence (Model-side fired-and-applied, deterministic) ===\n');

// ── Inhale (turn 1): arms the purple bar + drains the boss Turn Meter ──
{
  const boss = mkBoss(); const act = bossKit(boss, 500000);
  const a = ally(); const s = makeState({ allies: [a], enemies: [boss], seed: null });
  boss.turnMeter = 80;
  act(s, boss);
  check('Inhale arms the purple bar (state.purpleBarLeft set)', s.purpleBarLeft === 500000, `bar ${s.purpleBarLeft}`);
  check('Inhale drains the boss Turn Meter to 0', boss.turnMeter === 0, `tm ${boss.turnMeter}`);
  check('Inhale logs the arming event', s.log.some(e => /INHALE/.test(e.event || '')));
  check('Inhale does NOT strike the team (arm-only turn)', a.hp === a.maxHp);
}

// ── team damage drains the bar (onDamageToBoss) ──
{
  const boss = mkBoss(); const content = makeDragonContent({ stageNumber: 16, purpleBarHp: 500000, boss });
  const act = content.phases.find(p => p.name === 'boss').actEnemy;
  const a = ally(); const s = makeState({ allies: [a], enemies: [boss], seed: null });
  act(s, boss);                          // Inhale → bar = 500000
  content.onDamageToBoss(s, 200000);
  check('team damage drains the purple bar', s.purpleBarLeft === 300000, `bar ${s.purpleBarLeft}`);
}

// ── Scorch (turn 2): FIRES when the bar is not cleared — AoE + [Stun] on the team ──
{
  const boss = mkBoss(); const act = bossKit(boss, 500000);
  const a = ally(); const s = makeState({ allies: [a], enemies: [boss], seed: null });
  act(s, boss);                          // Inhale (bar armed, not drained)
  act(s, boss);                          // Scorch
  check('Scorch strikes the team when the bar is up', a.hp < a.maxHp, `hp ${Math.round(a.hp)}`);
  check('Scorch applies [Stun] to the team', a.debuffs.some(d => d.type === 'Stun'));
  check('Scorch logs the event', s.log.some(e => /SCORCH/i.test(e.event || '')));
}

// ── Scorch INTERRUPTED when the bar is cleared before he acts — no strike, no [Stun] ──
{
  const boss = mkBoss(); const content = makeDragonContent({ stageNumber: 16, purpleBarHp: 500000, boss });
  const act = content.phases.find(p => p.name === 'boss').actEnemy;
  const a = ally(); const s = makeState({ allies: [a], enemies: [boss], seed: null });
  act(s, boss);                          // Inhale
  content.onDamageToBoss(s, 999999);     // team clears the bar
  act(s, boss);                          // Scorch attempt → interrupted → turn WASTED
  check('Scorch interrupted (bar cleared) → no [Stun]', !a.debuffs.some(d => d.type === 'Stun'));   // the DEFINING benefit of clearing the bar (DRAGON_REVIEW.md)
  // VERIFIED (Mike, in-game 2026-07-26): an interrupted-Scorch turn is WASTED — Hellrazor does NOT fall back on a
  // normal skill (no Swipe/Wall of Fire), so the team is NOT struck and gets a fresh window. (Was a catalogued
  // open question last session; now confirmed by Mike and asserted here. The old fall-through was a bug.)
  check('Scorch interrupted → turn WASTED: team not struck, no fall-back skill', a.hp === a.maxHp && a.debuffs.length === 0, `hp ${Math.round(a.hp)} debuffs ${a.debuffs.length}`);
  check('Scorch interrupted → logged as turn wasted', s.log.some(e => /interrupted/i.test(e.event || '')));
}

// ── Wall of Fire (turn 3): AoE + 2×[Poison] + [Weaken] ──
{
  const boss = mkBoss(); const act = bossKit(boss, 500000);
  const a = ally(); const s = makeState({ allies: [a], enemies: [boss], seed: null });
  act(s, boss); act(s, boss); act(s, boss);   // Inhale → Scorch → Wall of Fire
  const poison = a.debuffs.find(d => d.type === 'Poison');
  check('Wall of Fire applies 2 stacks of [Poison]', poison && poison.stacks === 2, `stacks ${poison?.stacks}`);
  check('Wall of Fire applies [Weaken]', a.debuffs.some(d => d.type === 'Weaken'));
}

// ── Swipe (turn 4): AoE + [Decrease Attack] ──
{
  const boss = mkBoss(); const act = bossKit(boss, 500000);
  const a = ally(); const s = makeState({ allies: [a], enemies: [boss], seed: null });
  act(s, boss); act(s, boss); act(s, boss); act(s, boss);   // Inhale → Scorch → Wall of Fire → Swipe
  check('Swipe applies [Decrease Attack]', a.debuffs.some(d => d.type === 'Decrease Attack'));
}

// ── P1a: the boss's incoming damage runs the shared mitigation stack (Pelops −20% team) ──
{
  const boss = mkBoss();
  const pelops = ally('Pelops the Victor');           // a living Pelops → his A3 [-20% team] modifier is active
  const victim = ally('Victim');
  const s = makeState({ allies: [pelops, victim], enemies: [boss], seed: null });
  const raw = bossHit(boss, victim);
  check('P1a: a boss hit is reduced 20% with Pelops present', Math.abs(incomingDamage(s, victim, raw) - raw * 0.80) < 1e-6);
  const sNoPelops = makeState({ allies: [ally('Filler'), victim], enemies: [boss], seed: null });
  check('P1a: no Pelops → the boss hit is unreduced', Math.abs(incomingDamage(sNoPelops, victim, raw) - raw) < 1e-6);
}

// ── P1a via the STRIKE path: the same 20% reduction lands through the boss's actual Scorch hit ──
{
  const run = (allies) => { const boss = mkBoss(); const act = bossKit(boss, 500000); const s = makeState({ allies, enemies: [boss], seed: null }); act(s, boss); act(s, boss); return s; };
  const vP = ally('Victim'); run([ally('Pelops the Victor'), vP]);
  const vN = ally('Victim'); run([ally('Filler'), vN]);
  const lossP = vP.maxHp - vP.hp, lossN = vN.maxHp - vN.hp;
  check('P1a via strike: Pelops-protected victim takes 20% less from the boss', lossN > 0 && Math.abs(lossP - 0.80 * lossN) < 1, `lossP ${Math.round(lossP)} vs lossN ${Math.round(lossN)}`);
}

// ── on-hit reactions fire on the BOSS's hits (Vergis Second Wind [Shield]) via the onDamageTaken hook ──
{
  const boss = mkBoss(); const act = bossKit(boss, 500000);
  const vergis = ally('Vergis', { maxHp: 16000, def: 500 });   // a boss hit here exceeds 10% MAX HP → Second Wind procs
  const s = makeState({ allies: [vergis], enemies: [boss], seed: null });
  installRecipeRun(s);                    // wires state.onDamageTaken = fireDamageReactions
  act(s, boss); act(s, boss);             // Inhale → Scorch strikes Vergis
  check('on-hit reaction fires on the boss path (Vergis Second Wind [Shield])', vergis.buffs.some(b => b.type === 'Shield'));
}

console.log(`\n  ${fail ? '✗' : '✓'} boss sequence: ${pass} passed, ${fail} failed`);
if (catalog.length) { console.log('\n  CATALOG (boss behaviours to verify vs the source — not failures):'); for (const c of catalog) console.log(`    - ${c}`); }
console.log('\nQA_JSON ' + JSON.stringify({ rung: 'model-boss', pass, fail, catalog }));
process.exit(fail ? 1 : 0);
