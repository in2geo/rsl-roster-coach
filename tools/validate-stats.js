/**
 * Validate the effective-stats calculator against known in-game numbers.
 *
 * Runs effectiveStats() on a champion from the Gestal export and compares each output
 * to an expected (screenshot) value, flagging any mismatch. Use it to confirm the
 * formula before wiring it into the matching engine.
 *
 * Usage:
 *   node tools/validate-stats.js                 # built-in Kael ground-truth case
 *   node tools/validate-stats.js --hero 1        # print computed stats for a heroId
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { effectiveStats } from '../lib/effective-stats.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, '..', 'gestal-sync', 'output');

function loadRoster() {
  const f = fs.readdirSync(OUT_DIR).filter(x => x.endsWith('.json'))
    .map(x => ({ x, m: fs.statSync(path.join(OUT_DIR, x)).mtimeMs }))
    .sort((a, b) => b.m - a.m)[0];
  return JSON.parse(fs.readFileSync(path.join(OUT_DIR, f.x), 'utf8'));
}

const STATS = ['hp', 'atk', 'def', 'spd', 'crate', 'cdmg', 'res', 'acc'];
// Ground truth supplied from the in-game stat screen (the screenshot).
const GROUND_TRUTH = {
  1:  { name: 'Kael',   hp: 10087, atk: 1203, def: 637,  spd: 109, crate: 24, cdmg: 70, res: 42, acc: 42 },
  12: { name: 'Pelops', hp: 29938, atk: 789,  def: 1246, spd: 148, crate: 20, cdmg: 60, res: 56, acc: 70 },
};

const args = process.argv.slice(2);
const heroFlag = args.includes('--hero') ? Number(args[args.indexOf('--hero') + 1]) : null;
const roster = loadRoster();
const byHero = new Map(roster.champions.map(c => [c.heroId, c]));

console.log(`roster: ${roster.displayName}  (gear snapshot lastSnapshotAt=${roster.lastSnapshotAt})\n`);

function report(heroId) {
  const champ = byHero.get(heroId);
  if (!champ) { console.log(`heroId ${heroId} not in roster`); return; }
  const { effective, breakdown } = effectiveStats(champ);
  const gt = GROUND_TRUTH[heroId];

  console.log(`${champ.name} (heroId ${heroId}, ${champ.stars}★ lvl${champ.level})`);
  const bonusLine = (breakdown.applied?.length ? breakdown.applied : breakdown.sets.map(s => s.applied).filter(Boolean)).join(', ');
  console.log('  bonuses:', bonusLine || '(none)');
  const head = '  ' + 'STAT'.padEnd(7) + STATS.map(s => s.toUpperCase().padStart(8)).join('');
  console.log(head);
  console.log('  ' + 'calc'.padEnd(7) + STATS.map(s => String(effective[s]).padStart(8)).join(''));
  if (gt) {
    console.log('  ' + 'game'.padEnd(7) + STATS.map(s => String(gt[s]).padStart(8)).join(''));
    console.log('  ' + 'Δ'.padEnd(7) + STATS.map(s => String(effective[s] - gt[s]).padStart(8)).join(''));
    const mism = STATS.filter(s => effective[s] !== gt[s]);
    console.log(mism.length === 0
      ? '  ✓ ALL MATCH'
      : `  ✗ mismatches: ${mism.join(', ')}`);
  }
  console.log('');
}

if (heroFlag != null) report(heroFlag);
else for (const id of Object.keys(GROUND_TRUTH)) report(Number(id));
