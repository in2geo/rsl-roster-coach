/**
 * Upload a champion portrait to Supabase storage and link it in the DB.
 *
 * This is the previously-missing "upload" half of the portrait pipeline (the repo
 * only had cropping via lib/detect-grid.js and post-upload hashing via
 * rehash-portraits.js). Given a champion's card crop or headshot, it:
 *   1. (optional) crops the headshot out of a full card (--headshot) — drops the
 *      name banner + frame to roughly match the existing clean-headshot style.
 *   2. uploads it to portraits/<rarity>/<file>.jpg (upsert).
 *   3. sets champions.portrait_url to that public URL (handles the short-name vs
 *      full-name mismatch: it writes whatever path it actually uploaded to).
 *   4. computes + stores the dHash (same algo as rehash-portraits.js).
 *
 * Usage:
 *   node --env-file=.env.local tools/upload-portrait.js <image> --name "Fayne" [--headshot]
 *   node --env-file=.env.local tools/upload-portrait.js card.jpg --name "Basher" --rarity epic --headshot
 *
 * --name      DB champion name (required; matched case-insensitively)
 * --rarity    override the bucket folder (defaults to the champion's DB rarity)
 * --headshot  crop the top square of the card (face) before upload
 * --dry-run   process + report, but don't upload or write the DB
 */
import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const args = process.argv.slice(2);
const flag = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
const has  = (k) => args.includes(k);

const imagePath = args.find(a => !a.startsWith('--') && /\.(jpe?g|png|webp)$/i.test(a));
const name      = flag('--name');
const rarityOverride = flag('--rarity');
const headshot  = has('--headshot');
const dryRun    = has('--dry-run');

if (!imagePath || !name) {
  console.error('Usage: node --env-file=.env.local tools/upload-portrait.js <image> --name "Champion" [--rarity epic] [--headshot] [--dry-run]');
  process.exit(1);
}
if (!fs.existsSync(imagePath)) { console.error(`Image not found: ${imagePath}`); process.exit(1); }

const supabase = createClient(
  (process.env.SUPABASE_URL ?? '').replace(/\/rest\/v1\/?$/, ''),
  process.env.SUPABASE_SERVICE_KEY,
  { global: { fetch } }
);
const PUBLIC_BASE = (process.env.SUPABASE_URL ?? '').replace(/\/rest\/v1\/?$/, '') +
  '/storage/v1/object/public/portraits/';

// dHash — identical to rehash-portraits.js so hashes stay comparable.
async function dHash(buffer) {
  const { data } = await sharp(buffer).resize(9, 8, { fit: 'fill' }).grayscale().raw().toBuffer({ resolveWithObject: true });
  let bits = 0n;
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    bits = (bits << 1n) | (data[r * 9 + c] < data[r * 9 + c + 1] ? 1n : 0n);
  }
  return bits.toString(16).padStart(16, '0');
}

// ── 1. Resolve the champion in the DB ──────────────────────────────────────────
const { data: matches, error: qErr } = await supabase
  .from('champions')
  .select('id, name, rarity, portrait_url')
  .eq('game_id', 'raid_shadow_legends')
  .ilike('name', name);
if (qErr) { console.error('DB error:', qErr.message); process.exit(1); }
if (!matches?.length) { console.error(`No champion named "${name}" in the DB.`); process.exit(1); }
if (matches.length > 1) { console.error(`Ambiguous name "${name}": ${matches.map(m => m.name).join(', ')}`); process.exit(1); }
const champ = matches[0];

const rarity = (rarityOverride ?? champ.rarity ?? '').toLowerCase();
if (!['rare', 'epic', 'legendary', 'mythical'].includes(rarity)) {
  console.error(`Unsupported rarity "${rarity}" (Common/Uncommon have no portrait folder).`);
  process.exit(1);
}

// Target path: reuse the champion's existing portrait_url path if set (fills the
// exact 404), else <rarity>/<first-word-lowercased>.jpg (the existing convention).
const existingPath = champ.portrait_url?.split('/portraits/')[1];
const slug = champ.name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(' ')[0];
const targetPath = existingPath ?? `${rarity}/${slug}.jpg`;

// ── 2. Process the image (optional headshot crop) ──────────────────────────────
let img = sharp(fs.readFileSync(imagePath));
if (headshot) {
  const meta = await img.metadata();
  // Drop the name banner: keep the top square (face sits in the upper portion of
  // the card). Square side = image width, clamped to height.
  const side = Math.min(meta.width, meta.height);
  img = sharp(fs.readFileSync(imagePath)).extract({ left: 0, top: 0, width: side, height: side });
}
const outBuf = await img.jpeg({ quality: 90 }).toBuffer();
const hash = await dHash(outBuf);

console.log(`champion : ${champ.name} (${champ.rarity})`);
console.log(`source   : ${path.basename(imagePath)}${headshot ? ' (headshot-cropped)' : ''}`);
console.log(`target   : portraits/${targetPath}`);
console.log(`dHash    : ${hash}`);

if (dryRun) {
  console.log('\n[dry-run] no upload / no DB write.');
} else {
  // ── 3. Upload + 4. link + hash ───────────────────────────────────────────────
  const { error: upErr } = await supabase.storage
    .from('portraits')
    .upload(targetPath, outBuf, { contentType: 'image/jpeg', upsert: true });
  if (upErr) { console.error('Upload failed:', upErr.message); process.exitCode = 1; }
  else {
    const portrait_url = PUBLIC_BASE + targetPath;
    const { error: dbErr } = await supabase
      .from('champions')
      .update({ portrait_url, portrait_hash: hash })
      .eq('id', champ.id);
    if (dbErr) { console.error('DB link failed:', dbErr.message); process.exitCode = 1; }
    else console.log(`\n✓ uploaded + linked: ${portrait_url}`);
  }
}
// Let the process end naturally (avoids a sharp/libuv teardown assertion on Windows).
