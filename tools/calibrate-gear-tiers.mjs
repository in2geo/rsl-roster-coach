// ── tools/calibrate-gear-tiers.mjs ───────────────────────────────────────────
// STEP 1 of the contribution-model roadmap: calibrate GEAR_TIERS (the manual stat
// estimator's per-tier multipliers) against REAL gear. For every Lv60 geared champ
// across synced Gestal accounts, derive the actual gear contribution per stat
// (effective vs base — % for HP/ATK/DEF, flat for SPD/ACC/RES/crit), bucket by the
// champ's classified tier, and compare the empirical median to the current placeholder.
//
// Lv60 only, so Gestal baseStats == the Lv60 ceiling the manual estimator applies to.
// Read-only; prints a comparison table. Thin sample today (few accounts) → directional.
//
// Usage: node tools/calibrate-gear-tiers.mjs

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { gearTierFromArtifacts } from '../lib/gestal-context.js';
import { effectiveStats } from '../lib/effective-stats.js';
import { normalizeGearTier } from '../lib/estimate-stats.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, '..', 'gestal-sync', 'output');

// current placeholders (from estimate-stats.js) for side-by-side
const CURRENT = {
  starter: { hp: 0.30, atk: 0.30, def: 0.30, spd: 15,  acc: 30,  res: 20,  crate: 0.20, cdmg: 0.20 },
  fair:    { hp: 0.60, atk: 0.60, def: 0.60, spd: 35,  acc: 80,  res: 50,  crate: 0.45, cdmg: 0.50 },
  good:    { hp: 1.00, atk: 1.00, def: 1.00, spd: 60,  acc: 150, res: 80,  crate: 0.70, cdmg: 0.80 },
  endgame: { hp: 2.00, atk: 2.00, def: 2.00, spd: 100, acc: 220, res: 120, crate: 0.90, cdmg: 1.30 },
};
const PCT = new Set(['hp', 'atk', 'def']);       // gear = % of base
const FLAT = ['spd', 'acc', 'res', 'crate', 'cdmg']; // gear = flat add
const RARE_PLUS = new Set(['Rare', 'Epic', 'Legendary', 'Mythical']);

// samples[tier][stat] = [values]
const samples = {};
let champCount = 0;
for (const f of fs.readdirSync(OUT_DIR).filter(f => f.endsWith('.json') && !f.startsWith('gear-corpus'))) {
  let j; try { j = JSON.parse(fs.readFileSync(path.join(OUT_DIR, f), 'utf8')); } catch { continue; }
  for (const c of j.champions ?? []) {
    if (c.level !== 60 || !RARE_PLUS.has(c.rarity) || !c.baseStats) continue;
    const arts = (c.equippedArtifacts ?? []).filter(a => a && (a.rank != null || a.level != null));
    if (arts.length < 6) continue; // fully geared only
    const tier = normalizeGearTier(gearTierFromArtifacts(arts));
    const base = c.baseStats;
    const eff = effectiveStats(c).effective;
    if (!eff) continue;
    champCount++;
    (samples[tier] ??= {});
    for (const s of PCT)  if (base[s]) (samples[tier][s] ??= []).push(eff[s] / base[s] - 1);
    for (const s of FLAT) (samples[tier][s] ??= []).push((eff[s] ?? 0) - (base[s] ?? 0));
  }
}

const median = (a) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const fmt = (v, pct) => v == null ? '—' : (pct ? (v >= 0 ? '+' : '') + (v * 100).toFixed(0) + '%' : (v >= 0 ? '+' : '') + Math.round(v));

console.log(`Lv60 fully-geared Rare+ champs sampled: ${champCount}\n`);
for (const tier of ['starter', 'fair', 'good', 'endgame']) {
  const s = samples[tier] ?? {};
  const n = (s.hp ?? []).length;
  console.log(`── ${tier.toUpperCase()}  (n=${n}) ──`);
  console.log('  stat   empirical(median)   current placeholder');
  for (const stat of ['hp', 'atk', 'def', 'spd', 'acc', 'res', 'crate', 'cdmg']) {
    const pct = PCT.has(stat);
    const emp = median(s[stat] ?? []);
    console.log(`  ${stat.padEnd(6)} ${String(fmt(emp, pct)).padEnd(18)} ${fmt(CURRENT[tier][stat], pct)}`);
  }
  console.log('');
}
