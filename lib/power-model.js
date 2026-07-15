// lib/power-model.js — Layer 0 power sufficiency (the "wall" the engine never measured).
//
// Two-sided (the contribution-model target): KILL-SPEED (team damage/turn vs boss HP →
// turns-to-kill) and SURVIVAL (enemy damage/turn vs team bulk+sustain → turns-survived).
// A stage is power-clearable when turns-to-kill ≤ the time/turn budget AND turns-survived ≥
// turns-to-kill. Uses REAL per-stage enemy stats (dungeon_stage_enemies) and REAL champ stats.
//
// STATUS: v1 — kill-speed is the validated, load-bearing half (matches DonBrogni Spider 13).
// Survival is a FIRST-PASS estimate (flagged). All magnitudes are NOMINAL; the ONE calibration
// that matters is the turn budget, fit from a known reference clear (see calibrateBudget).
// See knowledge/POWER_LAYER_SCOPE.md.

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

// Team damage per turn vs a boss (sum of per-champ). DoT (%maxHP poison/HP-burn) is NOT yet
// added here — flagged: DoT scales off boss HP and is the main path on some content (that is
// the next kill-speed refinement).
export function teamDamagePerTurn(team, boss) {
  return (team ?? []).reduce((sum, c) => sum + champDamagePerTurn(c, boss.def), 0);
}

// Turns to kill the boss = boss HP / team damage per turn. (You win by killing the boss;
// adds/minions are a survival + time factor handled on the survival side, not here.)
export function turnsToKill(team, boss) {
  const dpt = teamDamagePerTurn(team, boss);
  return dpt > 0 ? boss.hp / dpt : Infinity;
}

// FIRST-PASS survival: turns the squishiest fielded champ survives the boss's basic hits.
// team min effective-HP ÷ incoming-per-turn. Sustain (heal/shield/revive) MULTIPLIES this
// (sustain-is-multiplicative). Nominal — the real survival model needs incoming-damage per
// stage (enemy ATK is here; boss skill kits/AoE are not yet modeled). Flagged.
export function turnsSurvived(team, boss, { sustainFactor = 1 } = {}) {
  const bulks = (team ?? []).map(c => {
    const s = c.estimated_stats ?? c;
    return (s.hp ?? 0) / defMitigation(s.def ?? 0); // effective HP: HP scaled up by own DEF
  });
  const minBulk = bulks.length ? Math.min(...bulks) : 0;
  const incoming = (boss.atk ?? 0) * critFactor(boss.crit_rate ?? 15, boss.crit_dmg ?? 50);
  return incoming > 0 ? (minBulk / incoming) * sustainFactor : Infinity;
}

// Calibrate the turn budget from a REFERENCE clear: the team+stage a player reports as the
// slow edge of acceptable (e.g. DonBrogni Spider 13 = "clears but too slow"). budget = the
// turns-to-kill there. Everything else is judged as a fraction of this. Returns { budget }.
export function calibrateBudget(refTeam, refBoss) {
  return { budget: turnsToKill(refTeam, refBoss) };
}

// Verdict for a team at a stage given a calibrated budget. load = turns-to-kill / budget:
// ≤ ~0.5 comfortable, ≤ 1 within budget, > 1 over. survivalOk gates separately.
export function stagePower(team, enemies, budget, opts = {}) {
  const boss = enemies.find(e => e.enemy_role === 'boss') ?? enemies[0];
  const ttk = turnsToKill(team, boss);
  const tsv = turnsSurvived(team, boss, opts);
  const load = budget > 0 ? ttk / budget : Infinity;
  return {
    turns_to_kill: Math.round(ttk),
    turns_survived: Math.round(tsv),
    kill_load: +load.toFixed(2),
    kill_ok: load <= 1,
    survival_ok: tsv >= ttk,
    read: load <= 0.5 ? 'comfortable' : load <= 1 ? 'within budget' : load <= 2 ? 'over budget' : 'far over',
  };
}
