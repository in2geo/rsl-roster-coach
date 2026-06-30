// Validation harness for the Option B roster reader: diffs the memory-read roster
// (gestal-sync/output/roster-memory.json) against a Gestal export, matching by
// heroId. Reports per-champion field mismatches and set differences.
//
// Usage: node tools/diff-roster.mjs <gestal-export.json> [roster-memory.json]
import fs from 'fs';

const exportPath = process.argv[2];
const memPath    = process.argv[3] ?? 'gestal-sync/output/roster-memory.json';
if (!exportPath) { console.error('Usage: node tools/diff-roster.mjs <gestal-export.json> [roster-memory.json]'); process.exit(1); }

const g = JSON.parse(fs.readFileSync(exportPath, 'utf8'));
const gChamps = g.champions ?? g.roster?.champions ?? [];
const mem = JSON.parse(fs.readFileSync(memPath, 'utf8'));

const byG = new Map(gChamps.map(c => [c.heroId, c]));
const byM = new Map(mem.map(c => [c.heroId, c]));

console.log(`Gestal export: ${gChamps.length} champions | memory read: ${mem.length} champions\n`);

// Champions in one set but not the other.
const onlyMem = [...byM.keys()].filter(id => !byG.has(id));
const onlyG   = [...byG.keys()].filter(id => !byM.has(id));
if (onlyMem.length) console.log(`In MEMORY but not Gestal (${onlyMem.length}):`, onlyMem.map(id => `${id}(t${byM.get(id).typeId})`).join(', '));
if (onlyG.length)   console.log(`In GESTAL but not memory (${onlyG.length}):`, onlyG.map(id => `${id}(${byG.get(id).name})`).join(', '));

// Field-by-field on the intersection.
const fields = [['typeId','typeId'], ['stars','stars'], ['level','level'], ['empowerLevel','empowerLevel'], ['inStorage','inStorage']];
let mismatches = 0, compared = 0;
for (const [id, gc] of byG) {
  const mc = byM.get(id);
  if (!mc) continue;
  compared++;
  for (const [mf, gf] of fields) {
    if (mc[mf] !== gc[gf]) {
      mismatches++;
      console.log(`MISMATCH heroId ${id} (${gc.name}) ${mf}: memory=${mc[mf]} gestal=${gc[gf]}`);
    }
  }
}
console.log(`\nCompared ${compared} shared champions across ${fields.length} fields.`);
console.log(mismatches === 0 && onlyMem.length === 0 && onlyG.length === 0
  ? '✅ CLEAN — memory read matches the Gestal export exactly.'
  : `❌ ${mismatches} field mismatch(es), ${onlyMem.length} mem-only, ${onlyG.length} gestal-only.`);
