// battle-gaps.js — "what are we missing?" per battle. Turns each logged battle into a source
// of IMPROVEMENTS to the review system, in four kinds:
//   data_missing   — a signal we couldn't capture, so a check couldn't run
//   contradiction  — the battle disagreed with the engine's prediction (miscalibration / bad tag)
//   unused_signal  — data we DO capture but nothing reconciles yet
//   no_check       — an engine assertion with no reconciliation check in the audit registry
// Aggregated across battles (tools/whats-missing.mjs), the gaps become a frequency-ranked
// backlog. Builds on lib/assumption-audit.js. Pure (chestTierFor optional, for CB chest checks).
import { auditBattle, AUDIT_STATUS as S } from './assumption-audit.js';
import { chestTierFor } from './clan-boss.js';
import { detectSynergies } from './synergies.js';

export function findBattleGaps(evaluation, battle, chestTiers = null, team = null) {
  const ev = evaluation ?? {};
  const checks = auditBattle(ev, battle);
  const gaps = [];
  const add = (category, id, title, detail, suggestion) =>
    gaps.push({ category, id, title, detail, suggestion });

  // Active team-composition synergies (Pallas+Argonite, Donatello+TMNT, 2+ Ally Attack, …).
  // A synergy is an emergent combo effect that GENERALIZES to anyone owning it — so it, not raw
  // account power, can explain a below-spec win. See lib/synergies.js + [[engine-feedback-loop]].
  const synergies = detectSynergies(team);
  const synText = synergies.map(s => `${s.id} (${s.members.join('+')})`).join(', ');

  const heroes  = (battle.heroes ?? []).filter(h => h.name);
  const dmg      = battle.totalDamageDealt ?? battle.total_damage_dealt ?? null;
  const isCB     = battle.dungeon === 'Clan Boss' || dmg != null;
  const haveDamage = heroes.some(h => typeof h.damage === 'number');
  const haveSurvival = heroes.some(h => h.survived === true || h.survived === false);

  // ── 1. DATA MISSING ─────────────────────────────────────────────────────────
  for (const c of checks.filter(c => c.status === S.NEEDS_DATA))
    add('data_missing', c.id, `Can't verify: ${c.assumption}`, c.signal,
        'capture the missing per-hero signal');
  if (!haveSurvival)
    add('data_missing', 'survival', 'Per-hero survival not captured for this battle',
        `${battle.dungeon ?? '?'} — was the reader attached with a live result?`, 'ensure FinalState survival read fired');
  if (!haveDamage)
    add('data_missing', 'per_hero_damage', 'No per-hero damage captured',
        `${battle.dungeon ?? '?'} — damage is only read from the Clan Boss result dialog`,
        'extend damage capture to non-CB result dialogs');
  if (isCB && ev.stun_matrix && !ev.boss_affinity)
    add('data_missing', 'boss_affinity', 'Boss affinity / day not captured',
        'CB per-hero damage shares flip by boss affinity — we can’t model day variance',
        'capture the boss affinity (day) at battle time');
  add('data_missing', 'debuffs_landed', 'Debuff landings not captured',
      'Can’t confirm ACC floors or that a tagged debuff actually landed',
      'decode per-hit debuff events (heroRounds blob) — deferred');

  // ── 2. CONTRADICTIONS ───────────────────────────────────────────────────────
  for (const c of checks.filter(c => c.status === S.REFUTED))
    add('contradiction', c.id, c.assumption, c.signal, 'candidate miscalibration / missing tag');
  if (battle.result === 'Victory' && (ev.gaps?.length ?? 0) > 0) {
    // GUARDRAIL: a win only implies a MISSING TAG when the team was otherwise ON-SPEC (met the
    // stat floors, close fight). Off-spec wins are account-specific and DON'T generalize to the
    // new-player audience — a developed roster overpowers weak content (stats ≫ floor) or grinds
    // it out with sustain (stats ≪ floor, many turns). Neither validates dropping the requirement.
    const thr = (ev.threshold_results ?? []).filter(t => t.estimated_value != null && t.threshold_value > 0);
    const margin = thr.length ? Math.min(...thr.map(t => t.estimated_value / t.threshold_value)) : null;
    const many = typeof battle.turns === 'number' && battle.turns > 120;
    if (margin != null && margin < 0.8 && synergies.length)
      // Under-spec BUT a real combo is on the team — the synergy is a generalizable explanation for
      // the win (any player owning it gets the same lift), NOT account-specific grind. This is the
      // "support champs beat content they shouldn't" case: credit the synergy, don't quarantine it.
      add('contradiction', 'won_below_spec_synergy', `Won at ${Math.round(margin * 100)}% of the stat floor with an active synergy despite ${ev.gaps.length} unmet goal(s)`,
          `${ev.gaps.join('; ')} — synergy: ${synText}${many ? ` (${battle.turns}-turn grind)` : ''}`,
          'GENERALIZABLE lift from a combination, not raw account power — credit the synergy in the engine (a combo owner should see this stage as more reachable). Do NOT relax the goal/threshold off this.');
    else if (margin != null && margin < 0.8)
      add('contradiction', 'won_below_spec', `Won at ${Math.round(margin * 100)}% of the stat floor despite ${ev.gaps.length} unmet goal(s)`,
          `${ev.gaps.join('; ')}${many ? ` (${battle.turns}-turn grind)` : ''}`,
          'NOT a missing tag — a developed account grinding under-spec content; does not generalize to a new-player roster. Do NOT relax the goal/threshold.');
    else if (margin != null && margin > 1.5)
      add('contradiction', 'won_by_overpower', `Won at ${Math.round(margin * 100)}% of the stat floor (overpowered) despite ${ev.gaps.length} unmet goal(s)`,
          ev.gaps.join('; '),
          'raw power skipped the mechanic — holds only until the boss out-scales it. Do NOT treat as a missing tag or relax the requirement.');
    else
      add('contradiction', 'won_despite_gap', `Won ON-SPEC despite ${ev.gaps.length} unmet goal(s)`,
          ev.gaps.join('; '), 'genuine signal — a fielded champion likely has an untagged capability, or the goal needs another valid solution');
  }
  if (battle.result === 'Defeat' && !isCB &&
      (ev.verdict === 'ready' || (ev.confidence_pct ?? 0) >= 70))
    add('contradiction', 'lost_despite_ready', 'Lost despite a high-confidence verdict',
        `verdict ${ev.verdict ?? '?'} / ${ev.confidence_pct ?? '?'}%`,
        'a threshold floor or a mechanic is missing from the model');
  if (isCB && ev.cb_damage?.expected_chest_tier && chestTiers && dmg != null) {
    const actual = chestTierFor(chestTiers, dmg);
    if (actual && actual !== ev.cb_damage.expected_chest_tier)
      add('contradiction', 'chest_prediction',
          'Predicted Clan Boss chest tier ≠ actual',
          `predicted ${ev.cb_damage.expected_chest_tier}, actual ${actual} (${dmg.toLocaleString()} dmg)`,
          're-fit clan_boss_stats.damage_calibration from captured damage');
  }

  // ── 3. UNUSED SIGNALS ───────────────────────────────────────────────────────
  const spdChecked = checks.some(c => c.id === 'spd_floor_turns');
  if (typeof battle.turns === 'number' && !spdChecked)
    add('unused_signal', 'turns_no_model', 'Turn count captured but no speed/turn model',
        `${battle.turns} turns went unreconciled`, 'build a true-speed → expected-turns check');

  // ── 4. NO CHECK (engine output asserted, nothing reconciles it) ──────────────
  const uncovered = [];
  if (ev.cc_sustain?.applies || ev.cc_sustain?.message) uncovered.push(['cc_sustain', 'CC-as-survival assumption']);
  if (ev.stun_matrix) uncovered.push(['stun_matrix', 'Clan Boss stun targeting']);
  if ((ev.boss_exceptions?.length ?? 0) > 0) uncovered.push(['boss_exceptions', 'stage/boss mechanic warnings']);
  if ((ev.team_requirement_gaps?.length ?? 0) > 0) uncovered.push(['team_requirement_gaps', 'per-champion dependencies']);
  if ((ev.threshold_results ?? []).some(t => t.stat === 'acc' && t.threshold_value != null))
    uncovered.push(['acc_threshold', 'ACC floor — did the debuffs land?']);
  for (const [id, what] of uncovered)
    add('no_check', id, `No reconciliation check yet for: ${what}`,
        'the engine asserts this but the audit never tests it against reality',
        'add a check to lib/assumption-audit.js');

  return { checks, gaps };
}
