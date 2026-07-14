// ── tools/gear-corpus.mjs ────────────────────────────────────────────────────
// GEAR-TIER CALIBRATION CORPUS (feeds the data-driven gear-tier ranges).
//
// For every champion we own (across all synced Gestal accounts) it computes the
// gear metrics + effective stats + current tier classification, and for every
// captured battle it records which champions fought at what gear and how it went
// (stage / result / turns / duration). Two outputs:
//   • output/gear-corpus.json  — the full per-champion + per-battle-hero dataset
//   • stdout summary            — tier distribution + per-tier metric ranges, so we
//     can SEE whether gearTierFromArtifacts' thresholds match reality (start of #3).
//
// Read-only. Re-run any time new accounts sync / battles land. The corpus is the
// instrument; recalibrating gearTierFromArtifacts' ranges is the follow-up (#3),
// which needs volume — with 1-2 accounts this is directional only.
//
// Usage: node tools/gear-corpus.mjs

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { gearTierFromArtifacts } from '../lib/gestal-context.js';
import { effectiveStats } from '../lib/effective-stats.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname, '..');
const OUT_DIR = path.join(REPO, 'gestal-sync', 'output');
const BATTLE_LOG = path.join(REPO, 'gestal-sync', 'RslBattleReader', 'output', 'battle-log.json');

// ── gear metrics for one champion ────────────────────────────────────────────
function gearMetrics(champ) {
  const arts = (champ.equippedArtifacts ?? []).filter(a => a && (a.rank != null || a.level != null));
  const n = arts.length;
  const avg = (f) => n ? arts.reduce((s, a) => s + (f(a) ?? 0), 0) / n : 0;
  const eff = champ.baseStats ? (effectiveStats(champ).effective ?? null) : null;
  return {
    tier:         gearTierFromArtifacts(arts),
    pieces:       n,
    avgRank:      +avg(a => a.rank).toFixed(2),        // stars 1-6
    avgLevel:     +avg(a => a.level).toFixed(2),       // upgrade 0-16
    pieces6star:  arts.filter(a => a.rank >= 6).length,
    piecesMaxed:  arts.filter(a => a.level >= 16).length,
    avgSubRolls:  +avg(a => (a.substats ?? []).reduce((s, ss) => s + (ss.rolls ?? 0), 0)).toFixed(2),
    eff,
  };
}

// ── load accounts ────────────────────────────────────────────────────────────
const accounts = {};
for (const f of fs.readdirSync(OUT_DIR).filter(f => f.endsWith('.json') && !f.startsWith('gear-corpus'))) {
  let j; try { j = JSON.parse(fs.readFileSync(path.join(OUT_DIR, f), 'utf8')); } catch { continue; }
  if (!j.accountId || !Array.isArray(j.champions)) continue;
  accounts[j.accountId] = { displayName: j.displayName, byHeroId: new Map(), byTypeId: new Map() };
  for (const c of j.champions) {
    const rec = { name: c.name, level: c.level, stars: c.stars, rarity: c.rarity, ...gearMetrics(c) };
    accounts[j.accountId].byHeroId.set(c.heroId, rec);
    accounts[j.accountId].byTypeId.set(c.typeId, rec);
  }
}

// ── per-champion population (all owned, Rare+) + per-battle-hero rows ─────────
const RARE_PLUS = new Set(['Rare', 'Epic', 'Legendary', 'Mythical']);
const population = [];
for (const [accId, a] of Object.entries(accounts))
  for (const rec of a.byHeroId.values())
    if (RARE_PLUS.has(rec.rarity)) population.push({ account: a.displayName, ...rec });

const battleRows = [];
if (fs.existsSync(BATTLE_LOG)) {
  const log = JSON.parse(fs.readFileSync(BATTLE_LOG, 'utf8'));
  for (const b of (Array.isArray(log) ? log : [])) {
    const acc = accounts[b.accountId];
    if (!acc) continue;
    for (const h of b.heroes ?? []) {
      const g = acc.byHeroId.get(h.heroId) ?? acc.byTypeId.get(h.typeId);
      if (!g) continue;
      battleRows.push({
        account: b.displayName, dungeon: b.dungeon, stage: b.stageNumber, result: b.result,
        turns: b.turns, durationSeconds: b.durationSeconds ?? null, survived: h.survived ?? null,
        champ: g.name, tier: g.tier, avgRank: g.avgRank, avgLevel: g.avgLevel,
        effHp: g.eff?.hp ?? null, effAtk: g.eff?.atk ?? null, effSpd: g.eff?.spd ?? null,
        effAcc: g.eff?.acc ?? null, effRes: g.eff?.res ?? null,
      });
    }
  }
}

fs.writeFileSync(path.join(OUT_DIR, 'gear-corpus.json'),
  JSON.stringify({ generatedAt: new Date().toISOString(), population, battleRows }, null, 2));

// ── summary: tier distribution + per-tier metric ranges ──────────────────────
const TIERS = ['Starter', 'Dungeon', 'Strong', 'God Tier'];
const stat = (arr) => {
  if (!arr.length) return '—';
  const s = [...arr].sort((x, y) => x - y);
  const q = (p) => s[Math.floor(p * (s.length - 1))];
  return `${q(0)} / ${q(0.5)} / ${q(1)}`; // min / median / max
};
console.log(`accounts: ${Object.keys(accounts).length} | Rare+ champions: ${population.length} | battle-hero rows: ${battleRows.length}\n`);
console.log('TIER      n    avgRank(min/med/max)  avgLevel(min/med/max)  effHP(min/med/max)      effACC(min/med/max)');
for (const t of TIERS) {
  const g = population.filter(p => p.tier === t);
  if (!g.length) { console.log(`${t.padEnd(9)} 0`); continue; }
  console.log(
    `${t.padEnd(9)} ${String(g.length).padEnd(4)} ` +
    `${stat(g.map(p => p.avgRank)).padEnd(21)} ` +
    `${stat(g.map(p => p.avgLevel)).padEnd(22)} ` +
    `${stat(g.map(p => p.eff?.hp ?? 0)).padEnd(23)} ` +
    `${stat(g.map(p => p.eff?.acc ?? 0))}`
  );
}
console.log(`\n→ wrote gestal-sync/output/gear-corpus.json (${population.length} champs, ${battleRows.length} battle-hero rows)`);
