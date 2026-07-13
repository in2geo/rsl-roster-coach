/**
 * calibrate-engine.mjs — the FEEDBACK ACTUATOR. Reads recommendation_outcomes (the engine's
 * prediction vs the real result, per battle) and computes data-driven adjustments to the engine's
 * numeric knobs, so predictions get more accurate over time. Currently calibrates:
 *   • verdict-band confidence — actual clear rate per band vs the displayed confidence range.
 * GUARDRAILS (a bad auto-calibration makes recommendations WORSE, so):
 *   • only suggests a change for a band with ≥ MIN_SAMPLES outcomes;
 *   • STRUCTURAL errors must be fixed first — a band that clears far above its displayed range is
 *     usually a coverage/tag bug (goals falsely unmet), NOT a miscalibration. Calibrating over that
 *     bakes the bug in. So this reports; it does not auto-apply.
 * Read-only. Usage: node --env-file=.env.local tools/calibrate-engine.mjs
 */
import { createClient } from '@supabase/supabase-js';

const MIN_SAMPLES = 20; // below this, per-band clear rate is noise — do not calibrate.

const s = createClient(process.env.SUPABASE_URL.replace(/\/rest\/v1\/?$/, ''), process.env.SUPABASE_SERVICE_KEY, { global: { fetch } });

// The engine's current displayed confidence ranges (lib/match-engine.js VERDICT_BAND_CONFIG).
const BANDS = {
  all_goals_strong_gear:  [85, 95],
  all_goals_dungeon_gear: [70, 84],
  borderline_threshold:   [55, 69],
  stats_failing:          [40, 54],
  one_goal_gap:           [20, 39],
  multi_goal_gap:         [5, 19],
};
const mid = ([lo, hi]) => (lo + hi) / 2;

const { data: outcomes } = await s.from('recommendation_outcomes')
  .select('verdict_band, confidence_pct, outcome');

// Only binary cleared/failed outcomes calibrate a confidence %. CB chest tiers are a different
// scale (they calibrate clan_boss_stats.damage_calibration instead — separate loop).
const binary = (outcomes ?? []).filter(o => o.outcome === 'cleared' || o.outcome === 'failed');
const byBand = {};
for (const o of binary) {
  const b = o.verdict_band ?? '(null)';
  (byBand[b] ??= { n: 0, cleared: 0 });
  byBand[b].n++;
  if (o.outcome === 'cleared') byBand[b].cleared++;
}

console.log(`\nEngine calibration — verdict-band confidence (from ${binary.length} cleared/failed outcomes)\n`);
console.log('  ' + 'BAND'.padEnd(24) + 'N'.padStart(4) + '  DISPLAYED   ACTUAL   VERDICT');
const suggestions = [];
for (const [band, range] of Object.entries(BANDS)) {
  const v = byBand[band];
  const n = v?.n ?? 0;
  const shown = `${range[0]}-${range[1]}%`;
  if (!n) { console.log('  ' + band.padEnd(24) + '0'.padStart(4) + `  ${shown.padEnd(10)}  —        no data`); continue; }
  const actual = Math.round(100 * v.cleared / n);
  let verdict;
  if (n < MIN_SAMPLES) verdict = `need ${MIN_SAMPLES}+ (have ${n}) — hold`;
  else if (actual >= range[0] && actual <= range[1]) verdict = '✓ calibrated';
  else {
    // A band clearing FAR above its range is almost always a structural bug, not miscalibration.
    verdict = actual > range[1] + 25
      ? '⚠ likely STRUCTURAL (coverage bug) — fix logic, do NOT calibrate'
      : `↳ suggest → ~${actual}%`;
    if (n >= MIN_SAMPLES && actual <= range[1] + 25) suggestions.push({ band, from: range, to: actual, n });
  }
  console.log('  ' + band.padEnd(24) + String(n).padStart(4) + `  ${shown.padEnd(10)}  ${(actual + '%').padEnd(7)}  ${verdict}`);
}

console.log('\n' + '─'.repeat(70));
if (suggestions.length) {
  console.log('CALIBRATED SUGGESTIONS (≥ MIN_SAMPLES, not structural) — for review before applying:');
  for (const s2 of suggestions) console.log(`  ${s2.band}: ${s2.from[0]}-${s2.from[1]}%  →  centered ~${s2.to}%  (n=${s2.n})`);
  console.log('  These require moving VERDICT_BAND_CONFIG (lib/match-engine.js) into DB config so the');
  console.log('  actuator can write them — currently a code constant (see the loop-closure notes).');
} else {
  console.log('No band has enough NON-STRUCTURAL evidence to calibrate yet.');
  console.log('Biggest signal: a band clearing far above its displayed range = a COVERAGE bug to fix in');
  console.log('logic first (e.g. the goal-solution skeleton fix), NOT a number to calibrate. Fix structure,');
  console.log('re-run upload-battles to regenerate outcomes on the corrected engine, THEN calibrate.');
}
console.log(`\nData volume: ${binary.length} binary outcomes total. Real calibration needs ~${MIN_SAMPLES}+ per band`);
console.log('per dungeon/difficulty — keep syncing battles. This job is safe to run after every session.\n');
