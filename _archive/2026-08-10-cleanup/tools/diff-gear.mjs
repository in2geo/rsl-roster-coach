// Validation harness for the Option B artifact reader: diffs the memory-read gear
// (artifacts-memory.json) against a Gestal export, matching by artifact id.
// First pass compares the scalar fields; main stat / substats come later.
//
// Usage: node tools/diff-gear.mjs <gestal-export.json> <artifacts-memory.json>
import fs from 'fs';

const exportPath = process.argv[2];
const memPath    = process.argv[3] ?? 'gestal-sync/RslBattleReader/output/artifacts-memory.json';
if (!exportPath) { console.error('Usage: node tools/diff-gear.mjs <gestal-export.json> <artifacts-memory.json>'); process.exit(1); }

const g = JSON.parse(fs.readFileSync(exportPath, 'utf8'));
const gArts = g.artifacts ?? [];
const mem = JSON.parse(fs.readFileSync(memPath, 'utf8'));

const byG = new Map(gArts.map(a => [a.id, a]));
const byM = new Map(mem.map(a => [a.id, a]));
console.log(`Gestal export: ${gArts.length} artifacts | memory read: ${mem.length} artifacts\n`);

const onlyMem = [...byM.keys()].filter(id => !byG.has(id));
const onlyG   = [...byG.keys()].filter(id => !byM.has(id));
if (onlyMem.length) console.log(`In MEMORY but not Gestal (${onlyMem.length}):`, onlyMem.slice(0, 20).join(', '), onlyMem.length > 20 ? '…' : '');
if (onlyG.length)   console.log(`In GESTAL but not memory (${onlyG.length}):`, onlyG.slice(0, 20).join(', '), onlyG.length > 20 ? '…' : '');

// Map memory fields -> gestal fields. (rank: gestal "rank" vs memory rankId — may be off by one; reported so we can see the mapping.)
const fields = [['slotId','slotId'], ['gearSetId','gearSetId'], ['rarityId','rarityId'], ['level','level'], ['ascensionLevel','ascensionLevel'], ['rankId','rank']];
let mismatches = 0, compared = 0;
const sample = {};
for (const [id, ga] of byG) {
  const ma = byM.get(id);
  if (!ma) continue;
  compared++;
  for (const [mf, gf] of fields) {
    const mv = ma[mf], gv = ga[gf] ?? null;
    if (mv !== gv) {
      mismatches++;
      // collect a few examples per field to reveal systematic offsets (e.g. rank+1)
      (sample[`${mf}!=${gf}`] ??= []).push(`id${id}: mem=${mv} gestal=${gv}`);
    }
  }
}
for (const [k, ex] of Object.entries(sample))
  console.log(`MISMATCH ${k} (${ex.length}): ${ex.slice(0, 5).join(' | ')}`);

console.log(`\nCompared ${compared} shared artifacts across ${fields.length} fields.`);
console.log(mismatches === 0 && onlyMem.length === 0 && onlyG.length === 0
  ? '✅ CLEAN — scalar gear fields match the Gestal export exactly.'
  : `❌ ${mismatches} field mismatch(es), ${onlyMem.length} mem-only, ${onlyG.length} gestal-only.`);
