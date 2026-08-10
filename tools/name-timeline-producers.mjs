// tools/name-timeline-producers.mjs — print the named per-kind (per-producer) boss debuff timeline
// from a battle-log.json. Maps producer typeIds → champion names via each entry's own heroes[].
//
// Usage: node tools/name-timeline-producers.mjs [path-to-battle-log.json] [--all]
//   default path: gestal-sync/output/battle-log.json ; --all shows every entry with a timeline

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { namedBossDebuffTimeline } from '../lib/timeline-producers.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const all = args.includes('--all');
const logPath = args.find((a) => !a.startsWith('--'))
  ?? path.join(__dirname, '..', 'gestal-sync', 'output', 'battle-log.json');

if (!fs.existsSync(logPath)) { console.error(`not found: ${logPath}`); process.exit(1); }
const log = JSON.parse(fs.readFileSync(logPath, 'utf8'));
const withTl = log.filter((e) => e?.timeline?.boss);
if (withTl.length === 0) { console.log('no entries with a boss timeline'); process.exit(0); }

for (const e of all ? withTl : [withTl[withTl.length - 1]]) {
  const tl = e.timeline, b = tl.boss, div = tl.fixedDivisor || 1;
  console.log(`\n=== ${e.displayName ?? e.accountId} — ${e.stage ?? '?'} — ${e.result} (turns ${e.turns}) ===`);
  console.log(`boss ${b.typeId}: maxHP ${Math.round(b.maxHp / div)}  ${Math.round(b.startHp / div)} → 0`);
  for (const pt of namedBossDebuffTimeline(e)) {
    const kinds = Object.entries(pt.byName).map(([n, c]) => `${n}:${c}`).join('  ');
    console.log(`  ${String(pt.tSec.toFixed(0)).padStart(4)}s  hp=${String(pt.hp).padStart(8)}  deb=${pt.debuffs}   ${kinds || '-'}`);
  }
}
