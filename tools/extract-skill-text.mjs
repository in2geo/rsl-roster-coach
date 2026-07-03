// ── tools/extract-skill-text.mjs ─────────────────────────────────────────────
// SPIKE / RESEARCH TOOL — not production code. Kept for the finding, not daily use.
//
// WHAT IT PROVED: Raid's local static-data cache IS a viable, compliant passive source
// for champion skill text. Descriptions are keyed by l10n:skill/description?id={SkillType.Id}
// — the SAME SkillTypeId used elsewhere — so this extractor recovered SkillTypeId ->
// {name, description} for the champions in the cache (observed ~20-50 partial descriptions
// + ~330 skill names from a lightly-browsed cache), e.g. #30101 "Attacks 1 enemy. Places a
// 7.5% Continuous Heal...", #230003 "...Bommal the Dreadhorn summons two bombs...".
//
// LIMITATION (why it's a spike, not the answer): descriptions are Plarium's custom RICH-TEXT
// format — readable prose interleaved with embedded binary tokens (dynamic values, buff/
// debuff sprite refs). The readable() pass recovers a FRAGMENTARY, gist-readable version
// (e.g. "Attacks 1 enemy. Ha·50% chance of placing a·Stun·..."), NOT clean prose. Clean
// id->prose needs a decoder for that token DSL — a separate, larger effort. Also the cache
// is INCREMENTAL (only viewed champions).
//
// READ-ONLY passive extractor for champion skill text.
//
// Source: Raid's LOCAL static-data localization cache
//   %LOCALAPPDATA%Low\Plarium\Raid_ Shadow Legends\static-data\<version>\<hash>
// The in-game Champion Index resolves skill text via the localization key
//   l10n:skill/description?id={SkillType.Id}#static   (and .../name?id=...)
// and that text is cached in this file. Reading it is a PASSIVE read of a local
// cache file (CLAUDE.md passive-read boundary) of the in-game Index skill text (an
// APPROVED CLAUDE.md source). No network, no process memory, no injection.
//
// This tool ONLY reads the cache and writes a JSON dump for HUMAN REVIEW. It does
// NOT touch the DB and does NOT auto-tag anything — tags from literal skill text are
// still source_type='raid_guide'-equivalent, status='proposed', human-reviewed first.
//
// CAVEAT: the cache is INCREMENTAL — it holds only skills whose text has been loaded
// in-game (viewed). Expect a partial set that grows as more champions are browsed.
//
// Usage:  node tools/extract-skill-text.mjs

import fs from 'fs';
import path from 'path';
import os from 'os';

const baseDir = path.join(os.homedir(), 'AppData', 'LocalLow', 'Plarium',
  'Raid_ Shadow Legends', 'static-data');

if (!fs.existsSync(baseDir)) {
  console.error(`static-data folder not found: ${baseDir}`);
  process.exit(1);
}

// Newest version folder (e.g. "11.65.0"), then the largest file in it (the blob).
const version = fs.readdirSync(baseDir).filter(d => /^\d+\.\d+/.test(d)).sort().at(-1);
const vdir = path.join(baseDir, version);
const blobFile = fs.readdirSync(vdir)
  .map(f => ({ f, size: fs.statSync(path.join(vdir, f)).size }))
  .sort((a, b) => b.size - a.size)[0]?.f;
if (!blobFile) { console.error(`no static-data blob in ${vdir}`); process.exit(1); }

const buf = fs.readFileSync(path.join(vdir, blobFile));
console.log(`Reading static-data ${version}/${blobFile} (${(buf.length / 1e6).toFixed(1)} MB)`);

// MessagePack-style string read at `off`: fixstr / str8 / str16 / str32.
// Returns the raw value bytes (the value is a Plarium rich-text blob: printable prose
// runs interleaved with binary tokens for dynamic values / buff-debuff sprite refs).
function readStrBytes(off) {
  const m = buf[off];
  let len, dataOff;
  if (m >= 0xa0 && m <= 0xbf) { len = m & 0x1f; dataOff = off + 1; }
  else if (m === 0xd9) { len = buf[off + 1]; dataOff = off + 2; }
  else if (m === 0xda) { len = buf.readUInt16BE(off + 1); dataOff = off + 2; }
  else if (m === 0xdb) { len = buf.readUInt32BE(off + 1); dataOff = off + 4; }
  else return null;
  if (dataOff + len > buf.length) return null;
  return buf.subarray(dataOff, dataOff + len);
}

// Reduce the rich-text blob to reviewable text: keep printable ASCII runs (≥2 chars),
// join binary gaps with "·". Preserves the [Buff]/[Debuff] tokens and prose; loses the
// exact embedded numeric/sprite token values (that needs a full rich-text decode).
function readable(bytes) {
  return [...bytes.toString('latin1').matchAll(/[\x20-\x7e]{2,}/g)].map(m => m[0]).join('·').trim();
}

// Extract id → best value for every full-text l10n key of a given kind. The same key
// appears in an interned key-table (junk value) AND the data section (real value), so
// keep the LONGEST value seen per id.
function extract(kind, minLen) {
  const marker = `l10n:skill/${kind}?id=`;
  const out = new Map();
  let i = 0;
  while ((i = buf.indexOf(marker, i)) >= 0) {
    let j = i + marker.length, id = '';
    while (j < buf.length && buf[j] >= 0x30 && buf[j] <= 0x39) { id += String.fromCharCode(buf[j]); j++; }
    i = j;
    if (!id) continue;
    if (buf.subarray(j, j + 7).toString('latin1') !== '#static') continue;
    const bytes = readStrBytes(j + 7); // value marker is immediately after "#static"
    if (!bytes) continue;
    const text = readable(bytes);
    if (text.length < minLen) continue;
    const key = Number(id);
    if (!out.has(key) || text.length > out.get(key).length) out.set(key, text);
  }
  return out;
}

const descs = extract('description', 20); // real descriptions are long
const names = extract('name', 2);
console.log(`Extracted: ${descs.size} descriptions, ${names.size} names`);

const skills = [...new Set([...descs.keys(), ...names.keys()])].sort((a, b) => a - b)
  .map(id => ({ skill_type_id: id, name: names.get(id) ?? null, description: descs.get(id) ?? null }));

const outPath = path.join(process.cwd(), 'output', `skill-text-static-${version}.json`);
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify({
  source: `static-data/${version}/${blobFile}`,
  extracted_at: new Date().toISOString(),
  note: 'PARTIAL local cache — only skills whose text was loaded/viewed in-game. ' +
        'Proposed source for tagging; MUST be human-reviewed before any tag goes live. ' +
        'Descriptions retain raw <color=…> markup and value-placeholder tokens.',
  count: skills.length,
  skills,
}, null, 2));
console.log(`Wrote ${skills.length} skills → ${outPath}`);

// Show a few clean samples.
for (const r of skills.filter(r => r.description).slice(0, 3)) {
  console.log(`\n#${r.skill_type_id}  ${r.name ?? '(no name)'}`);
  console.log(`  ${(r.description ?? '').replace(/\s+/g, ' ').slice(0, 180)}`);
}
