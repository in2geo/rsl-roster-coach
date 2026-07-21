/**
 * check-stat-estimator.mjs — "do our gear + Great Hall multipliers make sense?" Answerable NOW
 * for Gestal accounts, because they carry REAL effective_stats. For every owned champion we know
 * base stats (DB) + real effective stats + the derived gear_tier, so the OBSERVED multiplier
 * (effective/base − 1 for HP/ATK/DEF; effective−base for SPD) can be compared to the estimator's
 * placeholder (GEAR_TIERS gear % + ACCOUNT_DEV Great-Hall/Arena %). This tells us whether the
 * manual-roster estimator (the ONLY stat source for non-Gestal users) is calibrated — and by how
 * much it's off. Gets more accurate as more Gestal accounts are added. Read-only.
 *
 * Usage: node --env-file=.env.local tools/check-stat-estimator.mjs [--account <id>]
 */
import { readGestalRoster, buildUserChampions } from '../lib/gestal-context.js';
import { GEAR_TIER_TABLE, ACCOUNT_DEV_TABLE } from '../lib/estimate-stats.js';
import { createClient } from '@supabase/supabase-js';

const s = createClient(process.env.SUPABASE_URL.replace(/\/rest\/v1\/?$/, ''), process.env.SUPABASE_SERVICE_KEY, { global: { fetch } });
const args = process.argv.slice(2);
const accountArg = (() => { const i = args.indexOf('--account'); return i >= 0 ? args[i + 1] : null; })();

// pick the account
import { readBattleHistory } from '../lib/gestal-context.js';
const acct = accountArg ?? [...readBattleHistory()].sort((a, b) => (b.capturedAt ?? '').localeCompare(a.capturedAt ?? ''))[0]?.accountId ?? null;
const roster = readGestalRoster(acct);
const typeIds = [...new Set((roster?.champions ?? []).map(c => c.baseTypeId ?? c.typeId).filter(Boolean))];
const { data: champs } = await s.from('champions').select('id,name,type_id,rarity,base_hp,base_atk,base_def,base_spd')
  .eq('game_id', 'raid_shadow_legends').in('type_id', typeIds);
// NOTE: `champs` above is filtered by .in('type_id', …), so champions with a NULL type_id are absent
// before aliases can help them. Aliases still matter for name variants that DO carry a type_id.
const { data: aliasRows } = await s.from('champion_aliases').select('alias,champion_id').limit(5000);
const { userChampions } = buildUserChampions(roster?.champions ?? [], champs ?? [], aliasRows ?? []);

const es = (uc) => uc.effective_stats;
const PCT = ['hp', 'atk', 'def'];
// Derived gear-tier vocab (Gestal / champion sheet) → estimator GEAR_TIERS vocab.
const TIER_MAP = { starter: 'starter', dungeon: 'fair', strong: 'good', 'god tier': 'endgame' };
const tierOf = (uc) => { const t = String(uc.gear_tier ?? 'starter').toLowerCase(); return GEAR_TIER_TABLE[t] ? t : (TIER_MAP[t] ?? 'starter'); };
const owned = userChampions.filter(uc => es(uc) && uc.champion?.base_atk > 0 && uc.champion?.base_hp > 0);

// The estimator uses DB base stats (level 60 / 6★ max) × (1 + gear + account) and does NOT scale
// by the champion's level/stars. So effective/base only isolates GEAR for a MAX champ; for an
// under-leveled champ it also folds in the level/stars deficit. Split the two populations.
const isMax = (uc) => (uc.level ?? 0) >= 60 && (uc.stars ?? 0) >= 6;
const maxChamps = owned.filter(isMax);
const under = owned.filter(uc => !isMax(uc));

console.log(`\nStat-estimator check — ${roster?.displayName ?? acct} — ${owned.length} owned w/ real stats`);
console.log(`  clean ground truth (level 60 / 6★, gear isolatable): ${maxChamps.length}   under-leveled: ${under.length}\n`);

if (maxChamps.length) {
  console.log(`Do the gear + Great-Hall multipliers make sense? (level-60/6★ champs only)`);
  let best = null;
  for (const [dev, d] of Object.entries(ACCOUNT_DEV_TABLE)) {
    let err = 0, n = 0;
    for (const uc of maxChamps) { const g = GEAR_TIER_TABLE[tierOf(uc)];
      for (const k of PCT) { const pred = 1 + (g[k] ?? 0) + (d[k] ?? 0); const real = es(uc)[k] / uc.champion[`base_${k}`]; err += Math.abs(pred - real) / real; n++; } }
    const mape = 100 * err / n; if (!best || mape < best.mape) best = { dev, mape };
  }
  for (const uc of maxChamps) { const t = tierOf(uc);
    const o = PCT.map(k => `${k} ${((es(uc)[k] / uc.champion[`base_${k}`] - 1) * 100).toFixed(0)}%`).join('  ');
    console.log(`  ${(uc.champion.name).padEnd(20)} gear=${t.padEnd(8)} observed: ${o}`); }
  console.log(`\n  Best-fit Great Hall level = '${best.dev}', residual mean stat error ~${best.mape.toFixed(0)}% (HP/ATK/DEF).`);
} else {
  console.log('Cannot judge gear/Great-Hall multipliers yet — 0 champions at level 60 / 6★ (base stats are max-level,');
  console.log('so only maxed champs isolate GEAR from level/stars).');
}

// The under-leveled population reveals a separate estimator gap: no level/stars scaling.
if (under.length) {
  let over = 0, n = 0;
  for (const uc of under) for (const k of PCT) { over += (uc.champion[`base_${k}`] / es(uc)[k]); n++; }
  console.log(`\n⚠ Estimator LEVEL-SCALING GAP: estimateStats uses max (60/6★) base stats and never scales by`);
  console.log(`  level/stars. For the ${under.length} under-leveled champs, real stats average ${((over / n)).toFixed(1)}× BELOW`);
  console.log(`  their max base — so a manual roster of under-leveled champs would be badly over-estimated.`);
}

console.log(`\nVERDICT: with ${maxChamps.length} maxed ground-truth champ(s) on 1 account, this is directionally`);
console.log('measurable but not yet conclusive — the answer converges as more Gestal accounts + maxed champs');
console.log('are added. This is a STANDING question: re-run it every session and watch the residual error trend.\n');
