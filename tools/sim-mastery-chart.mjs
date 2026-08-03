// tools/sim-mastery-chart.mjs — MASTERY CALIBRATION CHART: sim masteries ON vs OFF vs reality, per fixture.
//
// WHY THIS EXISTS. The app collects GEAR TIER, not exact masteries (mastery entry is optional, defaults None).
// So when it predicts a clear it must GENERALIZE masteries — e.g. "assume Warmaster + Giant Slayer on a
// developed damage dealer." That generalization is a calibration knob: masteries move the KILL SPEED a lot
// (Giant Slayer adds %maxHP boss damage every hit; Warmaster does the same to non-boss waves), so the same
// team predicts very different turn counts / win rates with masteries on vs off. This tool measures that
// spread against captured reality, per fixture, and persists a dated snapshot — the standing signal for
// tuning what the app should assume. It runs the SIM_MASTERY bracket the montecarlo rung already supports
// ('off' = lower bound, no masteries; 'offense' = all damage-dealers carry the boss masteries).
//
// Reality (win rate + median turns) is read from data/manual-captures.json, matched by
// dungeon+stage+account(displayName)+teamVariant — the same scoping the per-hero-bands gate uses.
//
// Run: node --env-file=.env.local tools/sim-mastery-chart.mjs [N]    (default N=100 seeds per bracket)

import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname, '..');
const N = Number(process.argv.find((a, i) => i >= 2 && /^\d+$/.test(a)) ?? 100);

if (!process.env.SUPABASE_URL) { console.log('needs DB — run with --env-file=.env.local'); process.exit(2); }

// Fixtures to chart: Dragon fixtures that (a) the montecarlo Dragon path runs and (b) have captured reality.
// account/teamVariant scope the reality lookup in manual-captures (null = don't filter on it).
const FIXTURES = [
  { id: 'dragon-donahilvi-pool-current', dungeon: "Dragon's Lair", stage: 16, account: 'DonaHilvi', teamVariant: 'Artor (Dragon pool team)' },
  { id: 'dragon16-donbambus-current',    dungeon: "Dragon's Lair", stage: 16, account: 'Don$Bambus', teamVariant: null },
  { id: 'dragon17-donbambus-current',    dungeon: "Dragon's Lair", stage: 17, account: 'Don$Bambus', teamVariant: null },
];
// off = nobody has masteries (lower bound). offense = the app's GENERALIZATION (assume every damage-dealer
// carries a boss mastery) — the thing we're calibrating. real = the per-account TRUTH from Gestal masteryIds
// (needs build-from-sync's has_boss_mastery). Reality (captured battles) is the ground truth all three chase.
const BRACKETS = ['off', 'offense', 'real'];

const caps = JSON.parse(fs.readFileSync(path.join(REPO, 'data', 'manual-captures.json'), 'utf8')).captures;
const median = (arr) => { if (!arr.length) return null; const s = [...arr].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };

function reality(f) {
  const rows = caps.filter((c) => c.dungeon === f.dungeon && c.stageNumber === f.stage
    && (!f.account || c.displayName === f.account) && (!f.teamVariant || c.teamVariant === f.teamVariant));
  const wins = rows.filter((r) => r.result === 'Victory');
  const n = rows.filter((r) => r.result === 'Victory' || r.result === 'Defeat').length;
  return { n, wr: n ? wins.length / n : null, medTurns: median(wins.map((w) => w.turns).filter(Boolean)) };
}

function runMonte(id, mastery) {
  const r = spawnSync(process.execPath, [path.join(REPO, 'tools', 'sim-montecarlo.mjs'), id, String(N)],
    { encoding: 'utf8', env: { ...process.env, SIM_MASTERY: mastery }, maxBuffer: 64 * 1024 * 1024 });
  const line = (r.stdout || '').split(/\r?\n/).find((l) => l.startsWith('QA_JSON '));
  return line ? JSON.parse(line.slice(8)) : null;
}

const pctOff = (sim, real) => (sim != null && real ? Math.round((Math.abs(sim - real) / real) * 100) : null);
const rows = [];

console.log(`\n══ MASTERY CALIBRATION CHART ══  N=${N} seeds/bracket  ·  (app generalizes masteries → this is the spread to calibrate against)\n`);
for (const f of FIXTURES) {
  const real = reality(f);
  const brk = {};
  for (const m of BRACKETS) brk[m] = runMonte(f.id, m);
  rows.push({ fixture: f.id, stage: f.stage, account: f.account, reality: real, brackets: brk });

  console.log(`▶ ${f.id}  (stage ${f.stage}${f.account ? ` · ${f.account}` : ''})`);
  console.log(`    REALITY      WR ${real.wr != null ? Math.round(real.wr * 100) + '%' : '—'}  ·  median turns ${real.medTurns ?? '—'}  (${real.n} captures)`);
  for (const m of BRACKETS) {
    const b = brk[m];
    if (!b) { console.log(`    masteries ${m.padEnd(7)}  (no result)`); continue; }
    const t = b.turns?.median, wr = b.winRate != null ? Math.round(b.winRate * 100) : null;
    const tGap = pctOff(t, real.medTurns), wrGap = wr != null && real.wr != null ? Math.abs(wr - Math.round(real.wr * 100)) : null;
    console.log(`    masteries ${m.padEnd(7)}  WR ${wr}%  ·  median turns ${t}` +
      (tGap != null ? `  → turns ${tGap}% ${t > real.medTurns ? 'over' : 'under'}` : '') +
      (wrGap != null ? `, WR Δ${wrGap}pp` : ''));
  }
  // which bracket fits reality's turns best
  const best = BRACKETS.map((m) => ({ m, gap: pctOff(brk[m]?.turns?.median, real.medTurns) }))
    .filter((x) => x.gap != null).sort((a, b) => a.gap - b.gap)[0];
  if (best) console.log(`    → best turn-fit: masteries ${best.m} (${best.gap}% off reality)`);
  console.log('');
}

// Persist a dated snapshot for tracking calibration over time. Timestamp is passed in (Date.now is unavailable
// in some sandboxes) via env, else omitted — the caller can stamp it.
const stamp = process.env.CHART_STAMP || new Date().toISOString().slice(0, 10);
const chartFile = path.join(REPO, 'data', 'mastery-chart.json');
const prior = fs.existsSync(chartFile) ? JSON.parse(fs.readFileSync(chartFile, 'utf8')) : { _readme: 'Sim masteries ON/OFF vs reality per fixture — calibration signal for the app\'s mastery generalization. Appended by tools/sim-mastery-chart.mjs. Each snapshot: {date, N, rows:[{fixture, reality:{wr,medTurns,n}, brackets:{off,offense}:{winRate,turnsMedian}}]}.', snapshots: [] };
prior.snapshots.push({ date: stamp, N, rows: rows.map((r) => ({ fixture: r.fixture, stage: r.stage, account: r.account, reality: r.reality, brackets: Object.fromEntries(BRACKETS.map((m) => [m, r.brackets[m] ? { winRate: r.brackets[m].winRate, turnsMedian: r.brackets[m].turns?.median } : null])) })) });
fs.writeFileSync(chartFile, JSON.stringify(prior, null, 1));
console.log(`  ✎ snapshot appended to data/mastery-chart.json (${stamp}, ${rows.length} fixtures)\n`);
console.log('QA_JSON ' + JSON.stringify({ rung: 'mastery-chart', N, fixtures: rows.length, date: stamp }));
