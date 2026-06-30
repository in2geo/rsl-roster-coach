/**
 * Downloads one stored portrait and tests dHash + pHash against the stored
 * portrait_hash value to determine which algorithm was used.
 *
 * Usage: node --env-file=.env.local tools/verify-hash.js
 */
import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';

const supabase = createClient(
  (process.env.SUPABASE_URL ?? '').replace(/\/rest\/v1\/?$/, ''),
  process.env.SUPABASE_SERVICE_KEY,
  { global: { fetch } }
);

// --- dHash: 9×8 grayscale, compare adjacent columns → 64 bits ---------------
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

// --- pHash: 32×32 → DCT → top-left 8×8 → 64 bits ---------------------------
async function pHash(buffer) {
  const SIZE = 32;
  const { data } = await sharp(buffer)
    .resize(SIZE, SIZE, { fit: 'fill' })
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  // 2D DCT
  const dct = Array.from({ length: SIZE }, (_, u) =>
    Array.from({ length: SIZE }, (_, v) => {
      let sum = 0;
      for (let x = 0; x < SIZE; x++)
        for (let y = 0; y < SIZE; y++)
          sum += data[x * SIZE + y]
               * Math.cos(((2*x+1) * u * Math.PI) / (2*SIZE))
               * Math.cos(((2*y+1) * v * Math.PI) / (2*SIZE));
      return sum;
    })
  );

  // Top-left 8×8 (skip DC at [0][0])
  const vals = [];
  for (let u = 0; u < 8; u++)
    for (let v = 0; v < 8; v++)
      if (u !== 0 || v !== 0) vals.push(dct[u][v]);

  const med = [...vals].sort((a, b) => a - b)[Math.floor(vals.length / 2)];
  let bits = 0n;
  for (const v of vals) bits = (bits << 1n) | (v > med ? 1n : 0n);
  return bits.toString(16).padStart(16, '0');
}

// Hamming distance between two 16-char hex strings
function hamming(a, b) {
  let dist = 0;
  const xa = BigInt('0x' + a), xb = BigInt('0x' + b);
  let xor = xa ^ xb;
  while (xor) { dist += Number(xor & 1n); xor >>= 1n; }
  return dist;
}

// --- Fetch a few champions with portrait_hash and test ----------------------
const { data: champs } = await supabase
  .from('champions')
  .select('name, portrait_url, portrait_hash')
  .not('portrait_hash', 'is', null)
  .not('portrait_url',  'is', null)
  .limit(3);

console.log(`Testing hash algorithm on ${champs.length} champions...\n`);

for (const c of champs) {
  console.log(`Champion: ${c.name}`);
  console.log(`  Stored hash : ${c.portrait_hash}`);

  // Parse bucket path from public URL: .../object/public/<bucket>/<path>
  const urlPath = new URL(c.portrait_url).pathname;
  const match   = urlPath.match(/\/object\/public\/([^/]+)\/(.+)$/);
  if (!match) { console.log('  Could not parse storage path from URL'); continue; }
  const [, bucket, filePath] = match;

  const { data: blob, error: dlErr } = await supabase.storage.from(bucket).download(filePath);
  if (dlErr) { console.log('  Download error:', dlErr.message); continue; }
  const buf = Buffer.from(await blob.arrayBuffer());
  console.log(`  Downloaded ${buf.length} bytes from ${bucket}/${filePath}`);

  const dh = await dHash(buf);
  const ph = await pHash(buf);

  console.log(`  dHash       : ${dh}  (hamming vs stored: ${hamming(dh, c.portrait_hash)})`);
  console.log(`  pHash       : ${ph}  (hamming vs stored: ${hamming(ph, c.portrait_hash)})`);
  console.log();
}
