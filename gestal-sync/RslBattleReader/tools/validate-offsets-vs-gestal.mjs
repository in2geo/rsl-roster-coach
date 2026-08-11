// DEV-ONLY validation (never shipped): prove the durable field-offset-by-name resolver
// produces the same offsets Gestal's backend publishes for the live build. Gestal's
// offsets_cache.json is used here purely as a one-time oracle — it is NOT a runtime
// dependency of the reader.
//
// Usage: node tools/validate-offsets-vs-gestal.mjs [path-to-fields-dump.txt]
//   fields dump = output of:  RslBattleReader.exe --fields Artifact,Hero,ArtifactBonus,...
//
// Maps our (Class.field) -> Gestal cache key (camelCase class_Field) and reports mismatches.

import fs from 'fs';
import os from 'path';
import path from 'path';

const dumpPath = process.argv[2] ??
  path.join(import.meta.dirname, '..', 'output', 'fields-dump-11.70.0.txt');
const cachePath = path.join(process.env.LOCALAPPDATA ?? '', 'Gestal', 'Desktop', 'offsets_cache.json');

const cache = JSON.parse(fs.readFileSync(cachePath, 'utf8'));

// Parse the --fields dump into { ClassName: { fieldName: offset } }.
const dump = {};
let cur = null;
for (const line of fs.readFileSync(dumpPath, 'utf8').split(/\r?\n/)) {
  const cls = line.match(/\]\s+[\w.]*\.(\w+)\s+class\s*=/);
  if (cls) { cur = cls[1]; dump[cur] = {}; continue; }
  const fld = line.match(/^\s*\+0x[0-9A-Fa-f]+\s+\(\s*(\d+)\)\s+(.+?)\s*$/);
  if (fld && cur) dump[cur][fld[2]] = Number(fld[1]);
}

// lowerCamel first letter, e.g. Artifact -> artifact
const lc = s => s[0].toLowerCase() + s.slice(1);
// Gestal key = <lcClass>_<Field-with-leading-underscore-stripped-and-Capitalized>
// Our fields include leading underscores (_rankId) and PascalCase (ArtifactDataByHeroId).
function gestalKey(cls, field) {
  let f = field.replace(/^_/, '');
  f = f[0].toUpperCase() + f.slice(1);
  return `${lc(cls)}_${f}`;
}

let checked = 0, ok = 0, miss = [], absent = [];
for (const [cls, fields] of Object.entries(dump)) {
  for (const [field, off] of Object.entries(fields)) {
    if (field.includes('k__BackingField')) continue;
    const key = gestalKey(cls, field);
    if (!(key in cache)) { absent.push(`${cls}.${field} -> ${key} (not in cache)`); continue; }
    checked++;
    if (cache[key] === off) ok++;
    else miss.push(`${cls}.${field}: ours=${off} gestal[${key}]=${cache[key]}`);
  }
}

console.log(`Gestal cache gameVersion: ${cache.gameVersion}`);
console.log(`Compared ${checked} fields present in both: ${ok} match, ${miss.length} MISMATCH`);
if (miss.length) { console.log('\nMISMATCHES:'); miss.forEach(m => console.log('  ✗ ' + m)); }
console.log(`\n(${absent.length} of our fields have no cache counterpart — informational)`);
if (process.env.VERBOSE) absent.forEach(a => console.log('  · ' + a));
process.exit(miss.length ? 1 : 0);
