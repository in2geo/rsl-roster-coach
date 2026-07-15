// lib/power-model.js — Layer 0 power sufficiency (the "wall" the engine never measured).
//
// Two-sided (the contribution-model target): KILL-SPEED (team damage/turn vs boss HP →
// turns-to-kill) and SURVIVAL (enemy damage/turn vs team bulk+sustain → turns-survived).
// A stage is power-clearable when turns-to-kill ≤ the time/turn budget AND turns-survived ≥
// turns-to-kill. Uses REAL per-stage enemy stats (dungeon_stage_enemies) and REAL champ stats.
//
// STATUS: v1 — kill-speed is the validated, load-bearing half (matches DonBrogni Spider 13).
// Survival is a SECOND-PASS estimate: incoming from real enemy ATK (boss + minions) vs team
// bulk × a sustain multiplier (heal/shield/REVIVE — where the Sun Wukong revive-sponge lives).
// All magnitudes are NOMINAL; the ONE kill calibration is the turn budget (see calibrateBudget).
// See knowledge/POWER_LAYER_SCOPE.md.

import { TAG_TO_MECHANISM } from './sustain-profiles.js';
import { SOURCE_COEFF } from './cb-damage-model.js';

// DoT / %maxHP damage per turn — DEF-INDEPENDENT, scales off BOSS HP (the dominant kill source
// on high-HP content: Spider/Dragon). Reuses cb-damage-model's %maxHP-per-turn coefficients.
// INS-0017: calibration vs real captures proved this term is first-order, not a footnote —
// without it the Spider kill wall is ~10× under-modelled.
const DOT_TAG_SOURCE = { 'Poison': 'poison', 'HP Burn': 'hp_burn', 'Enemy Max HP Damage': 'enemy_maxhp' };
export function champDotPerTurn(champ, bossHp) {
  let frac = 0;
  for (const t of champ.tags ?? []) { const src = DOT_TAG_SOURCE[t]; if (src) frac += SOURCE_COEFF[src]; }
  if (champ.has_boss_mastery) frac += SOURCE_COEFF.warmaster;
  return frac * (bossHp ?? 0);
}

// How many extra turns of survival each sustain MECHANISM buys (nominal, uncalibrated).
// recovery (Revive) is the strongest per-source because a revived champ resets to full — this
// is the multiplicative sustain that carries a team past its raw-bulk wall (Sun Wukong on Spider).
const SUSTAIN_TURN_GAIN = { prevention: 0.3, absorption: 0.5, restoration: 0.8, removal: 0.2, recovery: 1.0 };
const SUSTAIN_MULT_CAP = 4; // a team can't survive indefinitely on sustain alone

// Team sustain multiplier on turns-survived: 1 + Σ (distinct sustain tags' mechanism gain).
// Sustain is MULTIPLICATIVE — it extends how many turns the team lives, multiplying total output.
export function teamSustainMultiplier(team) {
  let gain = 0; const seen = new Set();
  for (const c of team ?? []) for (const t of c.tags ?? []) {
    const mech = TAG_TO_MECHANISM[t];
    if (mech && !seen.has(t)) { seen.add(t); gain += SUSTAIN_TURN_GAIN[mech] ?? 0; }
  }
  return 1 + Math.min(gain, SUSTAIN_MULT_CAP);
}

// Nominal Raid-style DEF mitigation: your attack damage is scaled by K/(K+enemyDEF).
// K is a nominal constant (uncalibrated). Boss DEF grows only ~mildly across stages, so this
// term matters far less than boss HP growth — the kill wall is dominated by HP.
export const DEF_K = 1500;
export function defMitigation(enemyDef, k = DEF_K) {
  return k / (k + (enemyDef ?? 0));
}

// Crit-expected damage multiplier from a champ's crit rate/dmg (gear stats). crate/cdmg are
// percents (e.g. 60 / 120). Expected = 1 + p(crit) × (critDmg). Capped crit rate at 100%.
export function critFactor(crate, cdmg) {
  const p = Math.min(100, crate ?? 0) / 100;
  const cd = (cdmg ?? 0) / 100;
  return 1 + p * cd;
}

// Per-champion attack damage per turn (nominal absolute). Real ATK × the champ's best damage
// skill multiplier × crit-expected × enemy-DEF mitigation. `damage_multiplier` is the parsed
// skill coefficient (e.g. 4.2); supports/no-data fall back to a small nominal so a pure support
// contributes little direct damage (its real value is on the survival/multiplier side).
export function champDamagePerTurn(champ, enemyDef) {
  const s = champ.estimated_stats ?? champ;
  const atk = s.atk ?? 0;
  const mult = champ.damage_multiplier != null ? champ.damage_multiplier : 0.4;
  return atk * mult * critFactor(s.crate ?? s.crit_rate, s.cdmg ?? s.crit_dmg) * defMitigation(enemyDef);
}

// Calibrated 2026-07-15 against 34 captured dungeon wins (tools/calibrate-power.mjs): the
// nominal attack+DoT model runs ~4× hot (nominal DoT over-credits — not every poison tag stacks
// every turn), so real damage/turn ≈ DAMAGE_SCALE × model. This puts turnsToKill in real
// (captured) turns; mean fit error ≈ 33 turns. Re-fit as more captures accumulate.
export const DAMAGE_SCALE = 0.25;

// Team damage per turn vs a boss = attack (ATK-vs-DEF) + DoT (%maxHP, scales off boss HP),
// scaled to real captured turns by DAMAGE_SCALE.
export function teamDamagePerTurn(team, boss) {
  const raw = (team ?? []).reduce((sum, c) =>
    sum + champDamagePerTurn(c, boss.def) + champDotPerTurn(c, boss.hp), 0);
  return raw * DAMAGE_SCALE;
}

// Turns to kill the boss = boss HP / team damage per turn. (You win by killing the boss;
// adds/minions are a survival + time factor handled on the survival side, not here.)
export function turnsToKill(team, boss) {
  const dpt = teamDamagePerTurn(team, boss);
  return dpt > 0 ? boss.hp / dpt : Infinity;
}

// Incoming damage per round to the WEAK LINK (min-EHP champ). Bosses AoE the whole team,
// so the squishiest champ eats the boss hit every round, plus a minion's share. Nominal:
// boss ATK × crit + one minion's ATK × crit (adds/minions add pressure — Spider spiderlings,
// IG Klyssus Ally). Does NOT yet model %maxHP AoE bursts (Frigid Vengeance / Searing Storm) —
// flagged: those are the mechanics that make IG/FK survival harder than raw ATK implies.
export function incomingPerRound(enemies) {
  const boss = enemies.find(e => e.enemy_role === 'boss') ?? enemies[0];
  const minion = enemies.find(e => e.enemy_role === 'minion' || e.enemy_role === 'add');
  const bossHit = (boss?.atk ?? 0) * critFactor(boss?.crit_rate ?? 15, boss?.crit_dmg ?? 50);
  const minionHit = minion ? (minion.atk ?? 0) * critFactor(minion.crit_rate ?? 15, minion.crit_dmg ?? 50) : 0;
  return bossHit + minionHit;
}

// Turns the team survives = weak-link effective-HP × sustain multiplier ÷ incoming per round.
// EHP = HP × (1 + own DEF/K) (DEF makes each HP absorb more). Sustain (heal/shield/REVIVE)
// multiplies survival turns — this is where a revive-sponge carries a team past its raw wall.
export function turnsSurvived(team, enemies) {
  const bulks = (team ?? []).map(c => {
    const s = c.estimated_stats ?? c;
    return (s.hp ?? 0) * (1 + (s.def ?? 0) / DEF_K); // effective HP
  });
  const minBulk = bulks.length ? Math.min(...bulks) : 0;
  const incoming = incomingPerRound(enemies);
  return incoming > 0 ? (minBulk * teamSustainMultiplier(team)) / incoming : Infinity;
}

// Calibrate the turn budget from a REFERENCE clear: the team+stage a player reports as the
// slow edge of acceptable (e.g. DonBrogni Spider 13 = "clears but too slow"). budget = the
// turns-to-kill there. Everything else is judged as a fraction of this. Returns { budget }.
export function calibrateBudget(refTeam, refBoss) {
  return { budget: turnsToKill(refTeam, refBoss) };
}

// Two-sided verdict for a team at a stage. A stage is power-clearable when it can be killed
// within the turn budget AND survived long enough to land the kill. Reports which side BINDS —
// the whole point: Spider is kill-gated, Ice Golem is survival-gated.
export function stagePower(team, enemies, budget) {
  const boss = enemies.find(e => e.enemy_role === 'boss') ?? enemies[0];
  const ttk = turnsToKill(team, boss);
  const tsv = turnsSurvived(team, enemies);
  const kill_load = budget > 0 ? ttk / budget : Infinity;
  const kill_ok = kill_load <= 1;
  const survival_ok = tsv >= ttk;
  const clears = kill_ok && survival_ok;
  // Which wall stops it: dying (survival) takes precedence over being merely slow (kill).
  const binds = clears ? null : (!survival_ok ? 'survival' : 'kill');
  return {
    turns_to_kill: Math.round(ttk),
    turns_survived: Math.round(tsv),
    kill_load: +kill_load.toFixed(2),
    kill_ok, survival_ok, clears,
    binds, // 'kill' | 'survival' | null — which wall stops this stage
    read: clears ? (kill_load <= 0.5 ? 'comfortable' : 'within budget')
                 : (binds === 'survival' ? 'dies (survival wall)' : 'too slow (kill wall)'),
  };
}
