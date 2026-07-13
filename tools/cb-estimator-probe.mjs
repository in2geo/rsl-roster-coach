/**
 * cb-estimator-probe.mjs — validate the Clan Boss damage-model SHAPE against the real
 * per-hero damage the reader now captures. For each CB run in the battle log with
 * total_damage_dealt + per-hero damage, it computes each champion's stat-based raw score
 *
 *     raw = multiplier × effATK × critFactor × trueSpeed
 *     critFactor = 1 + (crit_rate/100) × (crit_dmg/100)
 *
 * and compares its SHARE of the team raw to its SHARE of the actual damage. If the shares
 * line up, the model shape is sound and only a per-difficulty scalar (damage_calibration)
 * is missing. Where they diverge — especially if the SAME team's shares move between
 * difficulties — that's the signal for an extra factor (affinity, turns, debuffs).
 *
 * Read-only. Usage:
 *   node --env-file=.env.local tools/cb-estimator-probe.mjs [--account <id>]
 */
import { readBattleHistory, readGestalRoster, buildUserChampions } from '../lib/gestal-context.js';
import { normalizeBattle } from '../lib/clan-boss.js';
import { estimateStats } from '../lib/estimate-stats.js';
import { parseMultiplier } from '../lib/multiplier-rank.js';
import { createClient } from '@supabase/supabase-js';

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
  console.error('Needs DB. Run: node --env-file=.env.local tools/cb-estimator-probe.mjs');
  process.exit(1);
}
const supabase = createClient(
  process.env.SUPABASE_URL.replace(/\/rest\/v1\/?$/, ''),
  process.env.SUPABASE_SERVICE_KEY, { global: { fetch } });

const args = process.argv.slice(2);
const accountArg = (() => { const i = args.indexOf('--account'); return i >= 0 ? args[i + 1] : null; })();

const norm = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
const critFactor = (cr, cd) => 1 + (Number(cr ?? 0) / 100) * (Number(cd ?? 0) / 100);
// Gestal effective_stats keys differ from estimateStats (crate/cdmg vs crit_rate/crit_dmg);
// read either.
const STAT_ALIAS = { crit_rate: ['crit_rate', 'crate'], crit_dmg: ['crit_dmg', 'cdmg'] };
const statOf = (uc, key) => {
  for (const k of (STAT_ALIAS[key] ?? [key])) {
    const v = uc?.effective_stats?.[k] ?? uc?._est?.[k];
    if (v != null) return v;
  }
  return null;
};
// Best damage skill regardless of ROLE (Support-tagged champs like Narma are real CB
// carriers), using each skill's OWN multiplier_type to pick the scaling stat.
const STAT_FOR = { ATK: 'atk', HP: 'hp', DEF: 'def' };
function bestMultiplier(skills) {
  let best = null;
  for (const sk of skills ?? []) {
    const t = String(sk.multiplier_type ?? '').toUpperCase();
    const statKey = STAT_FOR[t];
    if (!statKey) continue;
    const v = parseMultiplier(sk.damage_multiplier, sk.multiplier_type, t);
    if (v != null && (best == null || v > best.coeff)) best = { coeff: v, statKey };
  }
  return best;
}

// CB runs only, newest first, with damage + per-hero damage captured.
const all = readBattleHistory().map(normalizeBattle);
const cbRuns = all.filter(b =>
  b.dungeon === 'Clan Boss' &&
  typeof b.totalDamageDealt === 'number' &&
  (b.heroes ?? []).some(h => typeof h.damage === 'number'));
if (!cbRuns.length) { console.log('No CB runs with captured damage in the log.'); process.exit(0); }

const accountId = accountArg ?? cbRuns[0].accountId ?? null;
const runs = cbRuns.filter(b => !accountId || b.accountId === accountId)
  .sort((a, b) => (b.capturedAt ?? '').localeCompare(a.capturedAt ?? ''));
const roster = readGestalRoster(accountId);

// Resolve the roster → champion rows (affinity/role/base stats) + effective stats.
const names   = [...new Set(runs.flatMap(r => (r.heroes ?? []).map(h => h.name)).filter(Boolean))];
const typeIds = [...new Set((roster?.champions ?? []).map(c => c.baseTypeId ?? c.typeId).filter(t => t != null))];
const SELECT = 'id, name, type_id, rarity, role, affinity, base_hp, base_atk, base_def, base_spd, base_acc, base_res, base_crit_rate, base_crit_dmg';
const byId = new Map();
for (const [col, vals] of [['type_id', typeIds], ['name', names]]) {
  if (!vals.length) continue;
  const { data, error } = await supabase.from('champions').select(SELECT)
    .eq('game_id', 'raid_shadow_legends').in(col, vals);
  if (error) { console.error('champions query failed:', error.message); process.exit(1); }
  for (const c of data ?? []) byId.set(c.id, c);
}
const { userChampions } = buildUserChampions(roster?.champions ?? [], [...byId.values()]);

// Multipliers: champion_skills → best role-relevant damage multiplier per champion.
const ids = userChampions.map(u => u.champion?.id).filter(Boolean);
const skillsByChamp = {};
if (ids.length) {
  const { data } = await supabase.from('champion_skills')
    .select('champion_id, damage_multiplier, multiplier_type').in('champion_id', ids)
    .not('damage_multiplier', 'is', null);
  for (const r of data ?? []) (skillsByChamp[r.champion_id] ??= []).push(r);
}

// name → userChampion (with a fallback estimated-stats block when Gestal stats are absent).
const ucByName = new Map();
for (const uc of userChampions) {
  uc._est = uc.effective_stats ?? estimateStats(uc.champion, uc, { gearTier: uc.gear_tier });
  uc._best = bestMultiplier(skillsByChamp[uc.champion?.id]);
  for (const k of [uc.display_name, uc.champion?.name]) if (k) ucByName.set(norm(k), uc);
}

console.log(`\nCB damage model probe — ${roster?.displayName ?? accountId ?? 'unknown'} — ${runs.length} run(s)\n`);
for (const run of runs) {
  const heroes = (run.heroes ?? []).filter(h => typeof h.damage === 'number');
  const rows = heroes.map(h => {
    const uc = ucByName.get(norm(h.name));
    const cr = statOf(uc, 'crit_rate'), cd = statOf(uc, 'crit_dmg'), spd = statOf(uc, 'spd');
    const best = uc?._best ?? null;
    const scaleStat = best ? statOf(uc, best.statKey) : null;
    const mult = best ? best.coeff : null;
    const raw = (mult != null && scaleStat != null && spd != null) ? mult * scaleStat * critFactor(cr, cd) * spd : null;
    return { name: h.name, affinity: uc?.champion?.affinity ?? '?', role: uc?.champion?.role ?? '?',
             atk: statOf(uc, 'atk'), cr, cd, spd, mult: mult != null ? `${mult}${best.statKey}` : null, raw, actual: h.damage };
  });
  const rawTotal = rows.reduce((s, r) => s + (r.raw ?? 0), 0);
  const actTotal = rows.reduce((s, r) => s + r.actual, 0);

  const diff = run.difficulty ?? '?';
  console.log(`${diff}  ${run.capturedAt?.slice(0, 16) ?? ''}  total=${run.totalDamageDealt.toLocaleString()}  (Σhero=${actTotal.toLocaleString()})`);
  console.log('  ' + 'CHAMP'.padEnd(20) + 'AFF'.padEnd(7) + 'ROLE'.padEnd(8) +
              'ATK'.padStart(7) + 'CR'.padStart(5) + 'CD'.padStart(5) + 'SPD'.padStart(5) +
              'MULT'.padStart(7) + '  rawShare  actShare  Δ');
  for (const r of rows) {
    const rawShare = rawTotal ? (100 * (r.raw ?? 0) / rawTotal) : 0;
    const actShare = actTotal ? (100 * r.actual / actTotal) : 0;
    console.log('  ' + String(r.name).padEnd(20) + String(r.affinity).padEnd(7) + String(r.role).padEnd(8) +
      String(r.atk ?? '-').padStart(7) + String(Math.round(r.cr ?? 0)).padStart(5) + String(Math.round(r.cd ?? 0)).padStart(5) +
      String(Math.round(r.spd ?? 0)).padStart(5) + String(r.mult ?? '-').padStart(7) +
      `  ${rawShare.toFixed(1).padStart(6)}%  ${actShare.toFixed(1).padStart(6)}%  ${(actShare - rawShare >= 0 ? '+' : '') + (actShare - rawShare).toFixed(1)}`);
  }
  const impliedCal = rawTotal ? (run.totalDamageDealt / rawTotal) : null;
  console.log(`  implied calibration (actualTotal / rawTotal) = ${impliedCal != null ? impliedCal.toExponential(3) : 'n/a'}\n`);
}
