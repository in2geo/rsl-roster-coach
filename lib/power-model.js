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
import { affinityFactor } from './formulas.js';

// DoT / %maxHP damage per turn — DEF-INDEPENDENT, scales off BOSS HP (the dominant kill source
// on high-HP content: Spider/Dragon). Reuses cb-damage-model's %maxHP-per-turn coefficients.
// INS-0017: calibration vs real captures proved this term is first-order, not a footnote —
// without it the Spider kill wall is ~10× under-modelled.
const DOT_TAG_SOURCE = { 'Poison': 'poison', 'HP Burn': 'hp_burn', 'Enemy Max HP Damage': 'enemy_maxhp' };
// Placed-debuff DoT sources — subject to LAND-RATE (must beat boss RES) and UPTIME (cooldown).
// enemy_maxhp is a DIRECT skill %maxHP nuke (not a placed debuff) → neither applies to it.
const PLACED_DOT = new Set(['poison', 'hp_burn']);

// Land-rate: the fraction of a placed DoT that actually STICKS, from the champ's ACC vs the boss's
// RES. Raid resist ≈ 1% per point of boss RES above the champ's ACC. A champ under the boss's RES
// lands only a fraction of its poisons — the flat model credited them ALL. Same land-chance
// mechanic as the INS-0014 soft ACC floor, applied to the KILL side. VERIFIED: IG-18 boss RES 150,
// Ezio ACC 105 → ~55% land, his A2 poison largely resisted, yet flat model gave full credit.
export function dotLandRate(champAcc, bossRes) {
  if (bossRes == null || champAcc == null) return 1;
  return Math.max(0.05, Math.min(1, 1 - Math.max(0, bossRes - champAcc) / 100));
}

// A champion's DoT UPTIME from its poison/HP-burn-placing skills: 1.0 if placed by an every-turn
// source (A1 or passive), else duration/cooldown for the best on-cooldown placer. Data prep for
// champDotPerTurn's uptime weight (nominal). Differentiates an engine (Xenomorph A1, uptime 1) from
// an incidental on-cooldown placer (Ezio A2 cd4 dur2 → 0.5). skillRows: [{slot,cooldown_base,
// skill_summary}]. Returns 1.0 when the champ has a DoT tag but no matching skill text (could be a
// capture gap — don't zero-credit on absence; flagged as a data-quality check, e.g. Brogni).
export function dotUptimeFromSkills(skillRows = []) {
  let best = 0, any = false;
  for (const s of skillRows) {
    const txt = s.skill_summary || '';
    if (!/\[(Poison|HP Burn)\]/i.test(txt)) continue;
    any = true;
    const slot = String(s.slot || '');
    if (/^A1/i.test(slot) || /passive/i.test(slot) || !s.cooldown_base) return 1; // every-turn engine
    const dur = Number((txt.match(/for (\d+) turns?/) || [])[1]) || 2;
    best = Math.max(best, Math.min(1, dur / s.cooldown_base));
  }
  return any ? (best || 1) : 1;
}

// Per-champion DoT (%maxHP) damage per turn — DEF-independent, scales off boss HP. Placed debuffs
// (Poison/HP Burn) are weighted by LAND-RATE (champ ACC vs bossRes) × UPTIME (champ.dot_uptime),
// both defaulting to 1.0 when data is absent so callers without ACC/RES/uptime are unchanged. This
// differentiates a poison ENGINE from an incidental/resisted placer — the flat model credited them
// identically (INS-0017 residual, verified on the IG-18 loss). Warmaster (a mastery proc, not a
// placed debuff) and enemy_maxhp (a direct nuke) are NOT land/uptime-weighted.
export function champDotPerTurn(champ, bossHp, bossRes = null) {
  const acc = (champ.estimated_stats ?? champ)?.acc;
  const land = dotLandRate(acc, bossRes);
  const uptime = champ.dot_uptime ?? 1;
  let frac = 0;
  for (const t of champ.tags ?? []) {
    const src = DOT_TAG_SOURCE[t]; if (!src) continue;
    frac += PLACED_DOT.has(src) ? SOURCE_COEFF[src] * land * uptime : SOURCE_COEFF[src];
  }
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
// skill multiplier × crit-expected × enemy-DEF mitigation × AFFINITY (weak hits / crit-suppress).
// `damage_multiplier` is the parsed skill coefficient (e.g. 4.2); supports/no-data fall back to a
// small nominal so a pure support contributes little direct damage (its real value is on the
// survival/multiplier side). `stageAffinity` (the boss's affinity for this stage, from
// dungeon_stage_affinities) is OPTIONAL — omitted/null ⇒ neutral (×1), so callers that don't know
// it are unchanged. Applies to ATTACK only: DoT ticks (champDotPerTurn) are %maxHP, not hits, so
// they can't be weak-hit or crit-suppressed — affinity does not touch them. (INS-0018 / INS-0015
// Phase 2: without this, a weak-affinity nuker got full ttk credit and over-predicted the kill —
// verified on the IG-18 tanky loss, Ezio=Spirit weak vs the Magic boss.)
export function champDamagePerTurn(champ, enemyDef, stageAffinity = null) {
  const s = champ.estimated_stats ?? champ;
  const atk = s.atk ?? 0;
  const mult = champ.damage_multiplier != null ? champ.damage_multiplier : 0.4;
  const aff = affinityFactor(champ.affinity, stageAffinity, 'offense'); // 0.70 weak / 1.20 strong / 1.0 neutral
  return atk * mult * critFactor(s.crate ?? s.crit_rate, s.cdmg ?? s.crit_dmg) * defMitigation(enemyDef) * aff;
}

// Calibrated against captured dungeon wins (tools/calibrate-power.mjs): real damage/turn ≈
// DAMAGE_SCALE × model, putting turnsToKill in real (captured) turns. Re-fit 2026-07-15 on the
// enriched 4-account, leader-aura-aware set (95 wins) with trivial OVERPOWER runs pruned (low
// stages cleared in 8-31 turns whose implied DPT is a floor, not a measurement). Trimmed median →
// 0.41. STRONGLY NOMINAL: even trimmed, per-anchor scale spans ~0.5-4.8 (relative fit ~86%) — a
// single global scale captures only the CENTRAL TENDENCY across diverse rosters/RNG; individual
// turn predictions are noisy. The residual is real unmodeled variance (survival-limited slow
// clears, wave phase, gear/RNG), not tunable away — needs the structural fixes, not a better scalar.
export const DAMAGE_SCALE = 0.41;

// Team damage per turn vs a boss = attack (ATK-vs-DEF, affinity-adjusted) + DoT (%maxHP, scales
// off boss HP, affinity-independent), scaled to real captured turns by DAMAGE_SCALE.
// `stageAffinity` (optional) applies weak/strong hit factors to the ATTACK term per champ.
export function teamDamagePerTurn(team, boss, stageAffinity = null) {
  const raw = (team ?? []).reduce((sum, c) =>
    sum + champDamagePerTurn(c, boss.def, stageAffinity) + champDotPerTurn(c, boss.hp, boss.res), 0);
  return raw * DAMAGE_SCALE;
}

// Turns to kill the boss = boss HP / team damage per turn. (You win by killing the boss;
// adds/minions are a survival + time factor handled on the survival side, not here.)
export function turnsToKill(team, boss, stageAffinity = null) {
  const dpt = teamDamagePerTurn(team, boss, stageAffinity);
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

// Per-champ effective HP: HP × (1 + own DEF/K) (DEF makes each HP absorb more).
function champEHP(c) {
  const s = c.estimated_stats ?? c;
  return (s.hp ?? 0) * (1 + (s.def ?? 0) / DEF_K);
}

// SURVIVAL PROXY (unscaled "rounds") — the raw quantity tools/calibrate-survival.mjs fits a
// scale against. Basis = TEAM-SUM EHP (not weak-link): bosses AoE the whole team, so the team
// dies when its total bulk is exhausted, and — critically — calibration showed weak-link EHP
// ranks the win/loss BOUNDARY BACKWARDS (the tankier team lost both boundary pairs; a low-EHP
// but well-sustained team outlasts a high-EHP one). Sustain multiplies (extends rounds). Incoming
// is the boss's AoE hit (minion single-target folded into the calibrated scale).
export function survivalProxy(team, enemies) {
  const sumEHP = (team ?? []).reduce((s, c) => s + champEHP(c), 0);
  const boss = enemies.find(e => e.enemy_role === 'boss') ?? enemies[0];
  const bossHit = (boss?.atk ?? 0) * critFactor(boss?.crit_rate ?? 15, boss?.crit_dmg ?? 50);
  return bossHit > 0 ? (sumEHP * teamSustainMultiplier(team)) / bossHit : Infinity;
}

// Anchored 2026-07-15 to the ONE clean fixed-team survival boundary (Tagoar/Gnut/Pelops/Narma
// clears IG-18 @197t, FAILS IG-19 @195t): scales survivalProxy so that team's IG-19 death lands
// at its ~195 realized turns (tools/calibrate-survival.mjs). STRONGLY NOMINAL + IG-ONLY: the
// survival captures do NOT share a scale, and on this ATK-based incoming basis the model INVERTS
// the per-content wall (calls Spider survival-gated / IG kill-gated — the reverse of INS-0016)
// because IG's real wall is the Frigid-Vengeance mechanic spike, not enemy ATK. turnsSurvived is
// therefore a DIAGNOSTIC GUARDRAIL, NOT wire-ready — do not drive recommendations off it until a
// content-threat/mechanic-incoming term + more loss captures exist. See INS-0018.
export const SURVIVAL_SCALE = 7.25;

// Turns the team survives, in the SAME real-turn unit as turnsToKill (via SURVIVAL_SCALE).
export function turnsSurvived(team, enemies) {
  return SURVIVAL_SCALE * survivalProxy(team, enemies);
}

// Calibrate the turn budget from a REFERENCE clear: the team+stage a player reports as the
// slow edge of acceptable (e.g. DonBrogni Spider 13 = "clears but too slow"). budget = the
// turns-to-kill there. Everything else is judged as a fraction of this. Returns { budget }.
export function calibrateBudget(refTeam, refBoss) {
  return { budget: turnsToKill(refTeam, refBoss) };
}

// ── Wave / CC-debuff survival gate (the "wall" the kill model can't see) ──────────────────────
// Scoreboard finding (2026-07-15): the kill model's ONLY error is OVER-prediction — it says "you
// can kill this" for teams that then die in the WAVES (Dragon Freeze) or to debuff pressure. The
// captures show the discriminator is CC/debuff-DEFENSE, not damage: on Dragon, same-team win/loss is
// pure Freeze RNG, but ACROSS teams, wave-defense (Block Debuffs + RES) tracks win rate hard —
// RES-54/no-Block wins ~37% at Dragon 11, RES-113/Block wins ~79% at Dragon 20. So a team lacking
// wave-defense on a wave/debuff dungeon is a sub-50% stage → the evaluator should NOT call it a
// confident clear. Content with sequential waves + heavy CC/debuff pressure (INS-0021).
// DRAGON only: CC/debuff resistance is Dragon's wall (Hellrazor Freeze/Scorch + wave Freeze). NOT
// Ice Golem (wall = Frigid-Vengeance %-AoE SPIKE — the scoreboard proved requiring CC-defense there
// flags IG WINS as fails) and NOT Fire Knight (shield/attrition). Those need their own terms.
const WAVE_CONTENT = new Set(['dragon']);
// Adequate wave/CC defense if the team can RESIST the debuffs (Block Debuffs, or enough RES) OR
// out-tempo the waves (AoE clear + hard CC to kill/lock the casters before they land Freeze).
export function waveDefenseOK(team, contentKey, { resThreshold = 100 } = {}) {
  if (!WAVE_CONTENT.has(contentKey)) return true; // Spider/CB: single fight, no wave gate
  const tags = new Set((team ?? []).flatMap(c => c.tags ?? []));
  if (tags.has('Block Debuffs')) return true;
  const minRes = Math.min(...(team ?? []).map(c => (c.estimated_stats ?? c)?.res ?? 0));
  if (minRes >= resThreshold) return true;
  const hasAoE = tags.has('AoE Attack');
  const hasCC = ['AoE Stun', 'AoE Freeze', 'AoE Decrease Turn Meter'].some(t => tags.has(t));
  return hasAoE && hasCC; // out-tempo the wave casters
}

// Two-sided verdict for a team at a stage. A stage is power-clearable when it can be killed
// within the turn budget AND survived long enough to land the kill. Reports which side BINDS —
// the whole point: Spider is kill-gated, Ice Golem is survival-gated.
export function stagePower(team, enemies, budget, stageAffinity = null) {
  const boss = enemies.find(e => e.enemy_role === 'boss') ?? enemies[0];
  const ttk = turnsToKill(team, boss, stageAffinity);
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
