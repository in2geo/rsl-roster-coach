#!/usr/bin/env node
// tools/estimator-error.mjs — HOW WRONG IS THE GEAR-TIER ESTIMATOR, PER CHAMPION TYPE?
//
// THE TARGET (Mike, 2026-07-20): "if the model recommends the team I am using right now on dragon,
// the 'good' tier should calculate something close to the actual numbers I am running on each champ
// of this team. Attack-based would use different multipliers than support."
//
// The app captures almost nothing — a roster plus ONE gear-tier answer — and must turn that into
// per-champion stats. `lib/estimate-stats.js` currently applies ONE table (GEAR_TIERS) to every
// champion regardless of what they are, so a healer is credited the same +150 ACC and +70 crit as
// a nuker. This measures the error that produces, split by type, which is what a per-type
// multiplier set has to be calibrated against.
//
// GROUND TRUTH = `effectiveStats()` on the real Gestal gear (the corrected stat map, 2026-07-20).
// ⚠ Gestal rosters never call the estimator in production — mapRoster prefers real stats. This is
// deliberately running the estimator on accounts where we HAVE the truth, precisely so the error
// is measurable. The numbers move as gear changes; re-run after any sync.
//
// Usage: node tools/estimator-error.mjs [account=DonThor] [dungeon=Dragon] [tier=good]
import fs from 'fs';
import { effectiveStats } from '../lib/effective-stats.js';
import { estimateStats } from '../lib/estimate-stats.js';

const ACCT = process.argv[2] || 'DonThor';
const DUNGEON = process.argv[3] || 'Dragon';
const TIER = process.argv[4] || 'good';

const env = {};
for (const l of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const H = { apikey: env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}` };
const rest = async p => { const r = await fetch(`${env.SUPABASE_URL}/rest/v1/${p}`, { headers: H }); return r.ok ? r.json() : []; };
const norm = s => String(s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

const champs = await rest('champions?select=id,name,role,base_hp,base_atk,base_def,base_spd,base_acc,base_res,base_crit_rate,base_crit_dmg,champion_tags(status,tags(name,is_debuff,bypasses_accuracy_check))&game_id=eq.raid_shadow_legends&limit=2000');
const aliases = await rest('champion_aliases?select=alias,champion_id&limit=2000');
const idToName = Object.fromEntries(champs.map(c => [c.id, c.name]));
const nameKey = {};
for (const c of champs) nameKey[norm(c.name)] = c.name;
for (const a of aliases) if (idToName[a.champion_id]) nameKey[norm(a.alias)] = idToName[a.champion_id];
const byName = Object.fromEntries(champs.map(c => [norm(c.name), c]));

const DOT = new Set(['Poison', 'HP Burn', 'Necrosis', 'Enemy Max HP Damage']);
const typeOf = (c, st) => {
  const t = (c.champion_tags ?? []).filter(x => x.status === 'approved').map(x => x.tags?.name);
  const dot = t.some(x => DOT.has(x));
  if (c.role !== 'Attack' && (st?.crate ?? 0) >= 65) return `Hybrid(${c.role})`;
  if (dot && (st?.crate ?? 0) < 65) return 'DoT';
  return c.role ?? '?';
};

const file = fs.readdirSync('gestal-sync/output').find(f => norm(f).includes(norm(ACCT)));
const snap = JSON.parse(fs.readFileSync(`gestal-sync/output/${file}`, 'utf8'));

// the team actually being run on this dungeon = most recent 5-hero victory
const log = JSON.parse(fs.readFileSync('gestal-sync/RslBattleReader/output/battle-log.json', 'utf8'));
const battles = (Array.isArray(log) ? log : (log.battles ?? log.entries ?? []))
  .filter(b => b.displayName === snap.displayName && String(b.dungeon ?? '').toLowerCase().includes(DUNGEON.toLowerCase())
    && b.result === 'Victory' && (b.heroes ?? []).length === 5)
  .sort((a, b) => String(b.capturedAt).localeCompare(String(a.capturedAt)));
if (!battles.length) { console.log(`no ${DUNGEON} clears for ${snap.displayName}`); process.exit(0); }
const team = battles[0].heroes.map(h => h.name);
console.log(`\n══ ${snap.displayName} · ${battles[0].stage} · tier="${TIER}" ══`);
console.log(`team: ${team.join(', ')}\n`);

const STATS = [['spd', 'SPD'], ['acc', 'ACC'], ['res', 'RES'], ['crate', 'C.RATE'], ['cdmg', 'C.DMG'], ['hp', 'HP'], ['atk', 'ATK'], ['def', 'DEF']];
const errByType = {};
for (const hName of team) {
  const canon = nameKey[norm(hName)] ?? hName;
  const meta = byName[norm(canon)];
  const uc = (snap.champions ?? []).find(c => norm(c.name) === norm(hName) || norm(c.name) === norm(canon));
  if (!meta || !uc) { console.log(`  ${hName}: unresolved`); continue; }
  const actual = effectiveStats(uc)?.effective; if (!actual) continue;
  const est = estimateStats(meta, { level: uc.level, stars: uc.stars, gear_tier: TIER }, { gearTier: TIER });
  const type = typeOf(meta, actual);
  console.log(`── ${canon}  [${type}]  lvl ${uc.level} ${uc.stars}★`);
  console.log(`   stat      ESTIMATE    ACTUAL     ERROR`);
  for (const [k, label] of STATS) {
    const e = k === 'crate' ? est.crit_rate : k === 'cdmg' ? est.crit_dmg : est[k];
    const a = actual[k];
    if (e == null || a == null) continue;
    const pct = a ? Math.round(((e - a) / a) * 100) : null;
    const flag = pct == null ? '' : Math.abs(pct) >= 50 ? '  <<<' : '';
    console.log(`   ${label.padEnd(8)} ${String(Math.round(e)).padStart(8)} ${String(Math.round(a)).padStart(9)}   ${(pct == null ? '—' : (pct > 0 ? '+' : '') + pct + '%').padStart(7)}${flag}`);
    ((errByType[type] ??= {})[k] ??= []).push(pct);
  }
  console.log('');
}

console.log('══ MEDIAN ERROR BY TYPE (estimate vs actual) ══');
const med = a => { const v = a.filter(x => x != null).sort((x, y) => x - y); return v.length ? v[Math.floor((v.length - 1) / 2)] : null; };
console.log(`   type              ${STATS.map(([, l]) => l.padStart(8)).join('')}`);
for (const [type, m] of Object.entries(errByType))
  console.log(`   ${type.padEnd(17)} ${STATS.map(([k]) => { const v = med(m[k] ?? []); return (v == null ? '—' : (v > 0 ? '+' : '') + v + '%').padStart(8); }).join('')}`);
console.log('\n   POSITIVE = the estimator OVER-credits this type. One table for every champion is');
console.log('   what produces the split; per-type multipliers would be fitted to close these.');
