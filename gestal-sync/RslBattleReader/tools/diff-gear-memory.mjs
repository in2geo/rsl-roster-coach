// DEV validation (task 5): diff the live-memory gear reader output against Gestal's decoded
// artifacts.json for the same account. Gestal is the oracle ONLY here (dev-time), never shipped.
//
// Usage: node tools/diff-gear-memory.mjs [gestalAccountId]
//   defaults to the active account from %LOCALAPPDATA%\Gestal\active.json
// Reads: output/artifacts-memory.json  vs  %LOCALAPPDATA%\Gestal\accounts\<id>\artifacts.json
//
// NOTE: the Gestal snapshot may be an older gameVersion than live; gear the player changed
// since that snapshot will legitimately differ. The point is to confirm the DECODE is correct
// on the (large) unchanged majority.

import fs from 'fs';
import path from 'path';

const LA = process.env.LOCALAPPDATA;
const acct = process.argv[2] ??
  JSON.parse(fs.readFileSync(path.join(LA, 'Gestal', 'active.json'), 'utf8')).payload.activeAccountKey;

const mem = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, '..', 'output', 'artifacts-memory.json'), 'utf8'));
const gj = JSON.parse(fs.readFileSync(path.join(LA, 'Gestal', 'accounts', acct, 'artifacts.json'), 'utf8'));
const gest = gj.payload.artifacts;

console.log(`account ${acct}  gestal gameVersion ${gj.payload.gameVersion} (${gj.payload.extractedAt})`);
console.log(`memory artifacts: ${mem.length}   gestal artifacts: ${gest.length}`);

const gById = new Map(gest.map(a => [a.id, a]));
const mById = new Map(mem.map(a => [a.id, a]));

const subsKey = s => [...(s ?? [])]
  .map(x => `${x.statId}=${x.value}`).sort().join(',');
const gSubsKey = s => [...(s ?? [])]
  .map(x => `${x.statId}=${x.value}`).sort().join(',');

let compared = 0, clean = 0;
const fieldMiss = {};
const examples = [];
for (const m of mem) {
  const g = gById.get(m.id);
  if (!g) continue;
  compared++;
  const diffs = [];
  const chk = (name, a, b) => { if (a !== b) { diffs.push(`${name}: mem=${a} gestal=${b}`); fieldMiss[name] = (fieldMiss[name] ?? 0) + 1; } };
  chk('slotId', m.slotId, g.slot);
  chk('gearSetId', m.gearSetId ?? null, g.gearSetId ?? null);
  chk('rarityId', m.rarityId, g.rarityId);
  chk('rank', m.rank, g.rank);
  chk('level', m.level, g.level);
  chk('ascensionLevel', m.ascensionLevel, g.ascensionLevel ?? 0);
  chk('mainStatId', m.mainStatId, g.mainStatId);
  chk('mainStatValue', m.mainStatValue, g.mainStatValue);
  chk('substats', subsKey(m.substats), gSubsKey(g.substats));
  chk('equippedOnHeroId', m.equippedOnHeroId ?? null, g.equippedOnHeroId ?? null);
  if (diffs.length === 0) clean++;
  else if (examples.length < 15) examples.push({ id: m.id, slot: m.slotId, diffs });
}

const onlyMem = mem.filter(m => !gById.has(m.id)).map(m => m.id);
const onlyGest = gest.filter(g => !mById.has(g.id)).map(g => g.id);

console.log(`\ncompared (present in both): ${compared}`);
console.log(`  clean (all fields match): ${clean}`);
console.log(`  with >=1 diff:            ${compared - clean}`);
console.log(`only in memory: ${onlyMem.length}   only in gestal: ${onlyGest.length}`);
console.log(`\nper-field mismatch counts:`);
for (const [k, v] of Object.entries(fieldMiss).sort((a, b) => b[1] - a[1])) console.log(`  ${k}: ${v}`);
if (examples.length) {
  console.log(`\nexample diffs (first ${examples.length}):`);
  for (const e of examples) console.log(`  id ${e.id} (slot ${e.slot}): ${e.diffs.join(' | ')}`);
}
