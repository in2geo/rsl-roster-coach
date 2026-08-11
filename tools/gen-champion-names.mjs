// DEV-ONLY generator: snapshots a baseTypeId -> champion-name map into
// data/champion-basetype-names.json. Champion names + their game type ids are
// FACTUAL GAME DATA (Plarium-published, allowed per CLAUDE.md data rules), so a
// committed static snapshot is fine — the live reader then stays fully Gestal-free
// at runtime while still resolving champions whose DB row lacks type_id (~75%).
//
// Source: Gestal's champions-catalog.json (`gameId` == the base typeId, a multiple
// of 10; ascension is the ones digit). This reads a Gestal FILE at DEV time only —
// same posture as validate-offsets-vs-gestal.mjs. Re-run when new champions ship.
//
// Usage: node tools/gen-champion-names.mjs [path-to-champions-catalog.json]

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const catalogPath = process.argv[2] ??
  path.join(process.env.LOCALAPPDATA ?? '', 'Gestal', 'Desktop', 'champions-catalog.json');
const outPath = path.join(__dirname, '..', 'data', 'champion-basetype-names.json');

const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
const map = {};
let skipped = 0;
for (const c of catalog) {
  if (c?.gameId == null || !c?.name) { skipped++; continue; }
  map[c.gameId] = c.name; // gameId is the base typeId
}

const sorted = Object.fromEntries(
  Object.entries(map).sort((a, b) => Number(a[0]) - Number(b[0])));
fs.writeFileSync(outPath, JSON.stringify(sorted, null, 0) + '\n', 'utf8');
console.log(`Wrote ${Object.keys(sorted).length} baseTypeId->name entries to ${outPath} (skipped ${skipped}).`);
