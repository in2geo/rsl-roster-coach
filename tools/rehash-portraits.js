/**
 * Re-hashes all stored champion portraits using dHash and updates portrait_hash in the DB.
 * Run once to establish a known, reproducible hash baseline.
 *
 * Usage: node --env-file=.env.local tools/rehash-portraits.js
 */
import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';

const supabase = createClient(
  (process.env.SUPABASE_URL ?? '').replace(/\/rest\/v1\/?$/, ''),
  process.env.SUPABASE_SERVICE_KEY,
  { global: { fetch } }
);

// dHash: resize to 9×8 grayscale, compare each pixel to its right neighbour → 64 bits
async function dHash(buffer) {
  const { data } = await sharp(buffer)
    .resize(9, 8, { fit: 'fill' })
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  let bits = 0n;
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const left  = data[row * 9 + col];
      const right = data[row * 9 + col + 1];
      bits = (bits << 1n) | (left < right ? 1n : 0n);
    }
  }
  return bits.toString(16).padStart(16, '0');
}

// Fetch all champions that have a portrait_url
const { data: champs, error } = await supabase
  .from('champions')
  .select('id, name, rarity, portrait_url')
  .not('portrait_url', 'is', null)
  .order('name');

if (error) { console.error('DB error:', error.message); process.exit(1); }
console.log(`Found ${champs.length} champions with portrait URLs\n`);

let updated = 0, failed = 0;

for (const c of champs) {
  const urlPath = new URL(c.portrait_url).pathname;
  const match   = urlPath.match(/\/object\/public\/([^/]+)\/(.+)$/);
  if (!match) { console.log(`  SKIP ${c.name} — can't parse URL`); failed++; continue; }
  const [, bucket, filePath] = match;

  const { data: blob, error: dlErr } = await supabase.storage.from(bucket).download(filePath);
  if (dlErr) {
    console.log(`  FAIL ${c.name} — ${dlErr.message}`);
    failed++;
    continue;
  }

  const buf  = Buffer.from(await blob.arrayBuffer());
  const hash = await dHash(buf);

  const { error: upErr } = await supabase
    .from('champions')
    .update({ portrait_hash: hash })
    .eq('id', c.id);

  if (upErr) {
    console.log(`  FAIL ${c.name} — update error: ${upErr.message}`);
    failed++;
  } else {
    console.log(`  OK   ${c.name.padEnd(35)} ${hash}`);
    updated++;
  }
}

console.log(`\nDone. Updated: ${updated}  Failed: ${failed}`);
