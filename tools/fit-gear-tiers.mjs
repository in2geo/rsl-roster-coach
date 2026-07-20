#!/usr/bin/env node
// tools/fit-gear-tiers.mjs — FIT PER-TYPE GEAR-TIER MULTIPLIERS FROM REAL CLEARS.
//
// Emits a GEAR_TIERS table in exactly the shape lib/estimate-stats.js consumes, so the baseline is
// measured rather than hand-picked. Re-run after any sync; the numbers are expected to move.
//
// WHY PER TYPE (Mike, 2026-07-20): one table for every champion is calibrated to an attacker and
// over-credits supports catastrophically — measured error on DonThor's Dragon team was Attack
// ACC -3% / C.RATE -3% but Support ACC +130% / C.RATE +240%. A healer does not buy crit.
//
// WHY THE LOW PERCENTILE, NOT THE MEDIAN: a floor should be what is SUFFICIENT, not what is
// TYPICAL. Half of any clearing population is over-built for the stage it is on, so fitting the
// median bakes in that surplus — which is part of why every hand-set floor came out too high.
// Evidence: Don$Gnut clears Dragon 20 with an attacker at ACC 33 and a support at ACC 0 while
// GuapoDonni's attackers sit at 205. Both cleared. The requirement is nearer 33.
//
// FORMAT MATCHES estimate-stats.js: HP/ATK/DEF are PERCENT bonuses over base (actual/base - 1);
// SPD/ACC/RES are FLAT additions over base; crate/cdmg are FRACTIONS added to the base percent.
//
// ⚠ PROVISIONAL AND EXPECTED TO MOVE. Six accounts, one game, gear that changes weekly. Cells with
// small n are printed with their sample size so a target fitted from two champions is never
// mistaken for a measurement.
import fs from 'fs';
import { effectiveStats } from '../lib/effective-stats.js';

const PCTL = Number(process.env.PCTL ?? 0.25);   // 0.25 = "what was sufficient", not "what was typical"

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
const nameKey = {}; for (const c of champs) nameKey[norm(c.name)] = c.name;
for (const a of aliases) if (idToName[a.champion_id]) nameKey[norm(a.alias)] = idToName[a.champion_id];
const byName = Object.fromEntries(champs.map(c => [norm(c.name), c]));

const DOT = new Set(['Poison', 'HP Burn', 'Necrosis', 'Enemy Max HP Damage']);
const typeOf = (c, st) => {
  const t = (c.champion_tags ?? []).filter(x => x.status === 'approved').map(x => x.tags?.name);
  if (c.role !== 'Attack' && (st?.crate ?? 0) >= 65) return 'hybrid';
  if (t.some(x => DOT.has(x)) && (st?.crate ?? 0) < 65) return 'dot';
  return String(c.role ?? 'support').toLowerCase();
};

const statsByAcct = {};
for (const f of fs.readdirSync('gestal-sync/output').filter(x => x.endsWith('.json') && !/gear-corpus/.test(x))) {
  const s = JSON.parse(fs.readFileSync(`gestal-sync/output/${f}`, 'utf8'));
  const m = {}; for (const c of s.champions ?? []) { const r = effectiveStats(c); if (r?.effective) m[norm(c.name)] = { eff: r.effective, lvl: c.level, stars: c.stars }; }
  statsByAcct[s.displayName] = m;
}
const log = JSON.parse(fs.readFileSync('gestal-sync/RslBattleReader/output/battle-log.json', 'utf8'));
const battles = Array.isArray(log) ? log : (log.battles ?? log.entries ?? []);
const stageNum = b => { const n = b.stageNumber ?? Number(String(b.stage ?? '').match(/Stage (\d+)/)?.[1]); return Number.isFinite(n) ? n : null; };

// existing tier keys kept — the RENAMING/re-anchoring Mike floated is a separate open decision.
const BANDS = [
  { tier: 'starter', lo: 1,  hi: 9 },
  { tier: 'fair',    lo: 10, hi: 14 },
  { tier: 'good',    lo: 15, hi: 19 },
  { tier: 'endgame', lo: 20, hi: 25 },
];
// level scaling: base stats are the 6*/60 ceiling, so an under-levelled champion's HP/ATK/DEF are
// legitimately lower. Comparing raw actual/base would credit gear for level. Mirror the estimator.
const lvlScale = (lvl, stars) => Math.min(1, ((lvl ?? 60) / 60)) * Math.min(1, ((stars ?? 6) / 6));

const acc = {};   // tier -> type -> stat -> []
for (const b of battles) {
  const st = stageNum(b);
  if (b.result !== 'Victory' || st == null || /retreat/i.test(b.finishCause ?? '') || (b.heroes ?? []).length !== 5) continue;
  const band = BANDS.find(x => st >= x.lo && st <= x.hi); if (!band) continue;
  const acctStats = statsByAcct[b.displayName]; if (!acctStats) continue;
  for (const h of b.heroes) {
    const canon = nameKey[norm(h.name)] ?? h.name;
    const rec = acctStats[norm(h.name)] ?? acctStats[norm(canon)];
    const meta = byName[norm(canon)];
    if (!rec || !meta) continue;
    const e = rec.eff, type = typeOf(meta, e);
    const bucket = ((acc[band.tier] ??= {})[type] ??= { _who: new Set() });
    bucket._who.add(`${b.displayName}|${canon}`);
    const sc = lvlScale(rec.lvl, rec.stars) || 1;
    const push = (k, v) => { if (Number.isFinite(v)) (bucket[k] ??= []).push(v); };
    // percent bonuses over level-scaled base
    for (const [k, base] of [['hp', meta.base_hp], ['atk', meta.base_atk], ['def', meta.base_def]])
      if (base > 0) push(k, (e[k] / (base * sc)) - 1);
    push('spd', (e.spd ?? 0) - (meta.base_spd ?? 0));
    push('acc', (e.acc ?? 0) - (meta.base_acc ?? 0));
    push('res', (e.res ?? 0) - (meta.base_res ?? 0));
    push('crate', ((e.crate ?? 0) - (meta.base_crit_rate ?? 15)) / 100);
    push('cdmg', ((e.cdmg ?? 0) - (meta.base_crit_dmg ?? 50)) / 100);
  }
}
const pct = (a, p) => { const v = a.filter(Number.isFinite).sort((x, y) => x - y); return v.length ? v[Math.floor((v.length - 1) * p)] : null; };
const r2 = v => v == null ? null : Math.round(v * 100) / 100;

const KEYS = ['hp', 'atk', 'def', 'spd', 'acc', 'res', 'crate', 'cdmg'];
const MIN_N = 8;   // below this a "type" is one or two champions wearing a tier label, not a sample

/* KEEP ONLY WELL-SAMPLED TYPES. `defense` came out byte-identical across fair/good/endgame because
 * it is Gnut three times; `hp` is n=1 in every band. Emitting those as calibration would dress a
 * single champion up as a measurement. Thin types fall back to the generic row at runtime. */
const typesKept = new Set();
for (const tier of BANDS.map(b => b.tier))
  for (const [type, b] of Object.entries(acc[tier] ?? {}))
    if (b._who.size >= MIN_N) typesKept.add(type);

/* ENFORCE MONOTONICITY ACROSS TIERS. A higher tier must never estimate LOWER than a lower one —
 * endgame gear is not worse than good gear. The raw fit violates this (attack hp 0.73/0.91/0.99/
 * 0.91, attack def 0.30/0.61/0.65/0.43) because the bands are separated by which champions happen
 * to appear in them, not purely by gear. Running maximum going up the tiers is the minimal
 * correction that preserves every measured value as a LOWER bound.
 * ⚠ This masks the underlying sampling problem rather than solving it. The real fix is more clears
 * per band; until then a flattened cell means "no evidence this tier needs more", not "measured". */
const fitted = {};
for (const { tier } of BANDS) {
  fitted[tier] = {};
  for (const type of typesKept) {
    const b = acc[tier]?.[type];
    fitted[tier][type] = { _n: b?._who.size ?? 0 };
    for (const k of KEYS) {
      const raw = b ? pct(b[k] ?? [], PCTL) : null;
      const prevIdx = BANDS.findIndex(x => x.tier === tier) - 1;
      const prev = prevIdx >= 0 ? fitted[BANDS[prevIdx].tier]?.[type]?.[k] : null;
      let v = raw == null ? prev : (prev == null ? raw : Math.max(raw, prev));
      if (v != null && ['spd', 'acc', 'res'].includes(k)) v = Math.round(v);
      else if (v != null) v = r2(v);
      fitted[tier][type][k] = v;
    }
  }
}

console.log(`// FITTED FROM REAL CLEARS — percentile ${PCTL} ("sufficient", not "typical")`);
console.log(`// generated by tools/fit-gear-tiers.mjs — PROVISIONAL, re-run after each sync.`);
console.log(`// Monotonic across tiers by construction; types with n<${MIN_N} omitted (fall back to generic).\n`);
console.log('export const GEAR_TIERS_BY_TYPE = {');
for (const { tier } of BANDS) {
  console.log(`  ${tier}: {`);
  for (const [type, v] of Object.entries(fitted[tier]).sort((a, z) => z[1]._n - a[1]._n)) {
    const f = k => v[k] == null ? 'null' : v[k];
    console.log(`    ${(type + ':').padEnd(9)} { hp: ${f('hp')}, atk: ${f('atk')}, def: ${f('def')}, spd: ${f('spd')}, acc: ${f('acc')}, res: ${f('res')}, crate: ${f('crate')}, cdmg: ${f('cdmg')} },  // n=${v._n}`);
  }
  console.log('  },');
}
console.log('};');
console.log(`\n// types kept: ${[...typesKept].join(', ')}`);
