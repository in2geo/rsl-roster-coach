/**
 * cb-model-validate.mjs — validate lib/cb-damage-model.js against the captured CB run(s).
 * For each CB run with per-hero damage, builds the fielded team (stats + tags + has_boss_mastery
 * + skill multiplier), runs the mechanic model, fits the calibration to the observed total, and
 * prints: predicted vs actual per-hero SHARE (attribution), the identified carriers, and the
 * total → chest tier.
 *
 * Read-only. Usage: node --env-file=.env.local tools/cb-model-validate.mjs
 */
import { readBattleHistory, readGestalRoster, buildUserChampions } from '../lib/gestal-context.js';
import { normalizeBattle, chestTierFor } from '../lib/clan-boss.js';
import { estimateStats } from '../lib/estimate-stats.js';
import { estimateCbDamage, fitCalibration, carriers } from '../lib/cb-damage-model.js';
import { parseMultiplier } from '../lib/multiplier-rank.js';
import { createClient } from '@supabase/supabase-js';

const s = createClient(process.env.SUPABASE_URL.replace(/\/rest\/v1\/?$/, ''), process.env.SUPABASE_SERVICE_KEY, { global: { fetch } });
const norm = (x) => String(x ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
const statOf = (uc, k) => { for (const a of ({ crit_rate: ['crit_rate', 'crate'], crit_dmg: ['crit_dmg', 'cdmg'] }[k] ?? [k])) { const v = uc?.effective_stats?.[a] ?? uc?._est?.[a]; if (v != null) return v; } return null; };
const bestMult = (skills) => { let best = null; for (const sk of skills ?? []) { const t = String(sk.multiplier_type ?? '').toUpperCase(); if (!['ATK', 'HP', 'DEF'].includes(t)) continue; const v = parseMultiplier(sk.damage_multiplier, sk.multiplier_type, t); if (v != null && (best == null || v > best)) best = v; } return best; };

const runs = readBattleHistory().map(normalizeBattle)
  .filter(b => b.dungeon === 'Clan Boss' && typeof b.totalDamageDealt === 'number' && (b.heroes ?? []).some(h => typeof h.damage === 'number'))
  .sort((a, b) => (b.capturedAt ?? '').localeCompare(a.capturedAt ?? ''));
if (!runs.length) { console.log('No CB runs with captured damage.'); process.exit(0); }
const accountId = runs[0].accountId;
const roster = readGestalRoster(accountId);

// Champions (tags + base stats) + skills + boss stats.
const typeIds = [...new Set((roster?.champions ?? []).map(c => c.baseTypeId ?? c.typeId).filter(Boolean))];
const { data: champs } = await s.from('champions')
  .select('id,name,type_id,rarity,role,affinity,base_atk,base_spd,base_crit_rate,base_crit_dmg,champion_tags(status,tags(name))')
  .eq('game_id', 'raid_shadow_legends').in('type_id', typeIds);
const { userChampions } = buildUserChampions(roster?.champions ?? [], champs ?? []);
const ids = userChampions.map(u => u.champion?.id).filter(Boolean);
const { data: skillRows } = await s.from('champion_skills').select('champion_id,damage_multiplier,multiplier_type').in('champion_id', ids).not('damage_multiplier', 'is', null);
const skillsBy = {}; for (const r of skillRows ?? []) (skillsBy[r.champion_id] ??= []).push(r);
const { data: cbStats } = await s.from('clan_boss_stats').select('difficulty,boss_hp');
const bossHpByDiff = Object.fromEntries((cbStats ?? []).map(r => [r.difficulty, Number(r.boss_hp)]));

// name → engine-ready champ.
const byName = new Map();
for (const uc of userChampions) {
  uc._est = uc.effective_stats ?? estimateStats(uc.champion, uc, { gearTier: uc.gear_tier });
  const champ = {
    name: uc.champion?.name, role: uc.champion?.role,
    tags: (uc.champion?.champion_tags ?? []).map(t => t.tags?.name).filter(Boolean),
    has_boss_mastery: uc.has_boss_mastery,
    atk: statOf(uc, 'atk'), crit_rate: statOf(uc, 'crit_rate'), crit_dmg: statOf(uc, 'crit_dmg'), spd: statOf(uc, 'spd'),
    damage_multiplier_score: bestMult(skillsBy[uc.champion?.id]),
  };
  for (const k of [uc.display_name, uc.champion?.name]) if (k) byName.set(norm(k), champ);
}

const { data: tierRows } = await s.from('clan_boss_chest_tiers')
  .select('chest_name,sort_order,damage_min,damage_max,dungeon_stages(label,dungeons(name))');
const tiersByDiff = {};
for (const r of tierRows ?? []) { const d = r.dungeon_stages?.label; if (r.dungeon_stages?.dungeons?.name === 'Clan Boss' && d) (tiersByDiff[d] ??= []).push(r); }
for (const d in tiersByDiff) tiersByDiff[d].sort((a, b) => a.sort_order - b.sort_order);

console.log(`\nCB damage MODEL validation — ${roster?.displayName ?? accountId} — ${runs.length} run(s)\n`);
for (const run of runs) {
  const heroes = (run.heroes ?? []).filter(h => typeof h.damage === 'number');
  const team = heroes.map(h => byName.get(norm(h.name))).filter(Boolean);
  const bossHp = bossHpByDiff[run.difficulty] ?? null;
  if (!bossHp || team.length !== heroes.length) { console.log(`skip ${run.difficulty} (bossHp/team unresolved)`); continue; }

  const est = estimateCbDamage(team, { bossHp, totalTurns: run.turns ?? null });
  const cal = fitCalibration(est.rawTotal, run.totalDamageDealt);
  const withAbs = estimateCbDamage(team, { bossHp, totalTurns: run.turns ?? null, calibration: cal });

  const actByName = new Map(heroes.map(h => [norm(h.name), h.damage]));
  const actTotal = heroes.reduce((s2, h) => s2 + h.damage, 0);

  console.log(`${run.difficulty}  boss_hp=${bossHp.toLocaleString()}  turns=${run.turns}  total=${run.totalDamageDealt.toLocaleString()}`);
  console.log('  ' + 'CHAMP'.padEnd(20) + 'SOURCES'.padEnd(32) + 'model%   actual%   Δ');
  for (const r of withAbs.perChampion) {
    const actShare = actTotal ? (actByName.get(norm(r.name)) ?? 0) / actTotal : 0;
    const d = (r.share - actShare) * 100;
    console.log('  ' + String(r.name).padEnd(20) + (r.sources.join('+') || '—').padEnd(32) +
      `${(r.share * 100).toFixed(1).padStart(5)}%   ${(actShare * 100).toFixed(1).padStart(5)}%   ${(d >= 0 ? '+' : '') + d.toFixed(1)}`);
  }
  const modelCarriers = carriers(withAbs.perChampion).map(r => r.name).join(', ') || '(none ≥15%)';
  const actualCarriers = [...heroes].filter(h => h.damage / actTotal >= 0.15).sort((a, b) => b.damage - a.damage).map(h => h.name).join(', ');
  const chest = tiersByDiff[run.difficulty] ? chestTierFor(tiersByDiff[run.difficulty], run.totalDamageDealt) : '?';
  console.log(`  model carriers: ${modelCarriers}`);
  console.log(`  actual carriers: ${actualCarriers}`);
  console.log(`  chest tier (from ${run.totalDamageDealt.toLocaleString()} dmg): ${chest}\n`);
}
