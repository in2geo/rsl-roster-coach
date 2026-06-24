/**
 * Splits a large SQL file into chunks of N INSERT statements each.
 * Usage: node tools/split-sql.js tools/output/tags_2026-06-24T03-07-51.sql
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { basename, dirname, join } from 'path';

const file      = process.argv[2];
const chunkSize = parseInt(process.argv[3] ?? '200');

if (!file) { console.error('Usage: node tools/split-sql.js <file.sql> [chunk-size]'); process.exit(1); }

const content = readFileSync(file, 'utf8');
const lines   = content.split('\n');

// Separate header comments from INSERT lines and champion comment blocks
const header  = [];
const blocks  = [];   // each block = comment lines + their INSERT lines
let   current = [];

for (const line of lines) {
  if (line.startsWith('-- Generated') || line.startsWith('-- Status') || line.startsWith('-- Run')) {
    header.push(line);
    continue;
  }
  current.push(line);
  // Flush block after a blank line following inserts
  if (line.trim() === '' && current.some(l => l.startsWith('INSERT'))) {
    blocks.push(current.join('\n'));
    current = [];
  }
}
if (current.length) blocks.push(current.join('\n'));

// Group blocks into chunks of chunkSize INSERT statements
const chunks    = [];
let   chunk     = [];
let   insertCnt = 0;

for (const block of blocks) {
  const inserts = (block.match(/^INSERT/gm) ?? []).length;
  if (insertCnt + inserts > chunkSize && chunk.length) {
    chunks.push(chunk.join('\n'));
    chunk     = [];
    insertCnt = 0;
  }
  chunk.push(block);
  insertCnt += inserts;
}
if (chunk.length) chunks.push(chunk.join('\n'));

// Write chunk files
const outDir  = join(dirname(file), 'chunks');
const base    = basename(file, '.sql');
mkdirSync(outDir, { recursive: true });

chunks.forEach((c, i) => {
  const outFile = join(outDir, `${base}_part${i + 1}of${chunks.length}.sql`);
  writeFileSync(outFile, header.join('\n') + '\n\n' + c, 'utf8');
  const n = (c.match(/^INSERT/gm) ?? []).length;
  console.log(`Part ${i + 1}/${chunks.length}: ${n} inserts → ${outFile}`);
});

console.log(`\nDone. Run each file in Supabase SQL editor separately.`);
