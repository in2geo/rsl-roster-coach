/**
 * Diagnostic: find where champion images are stored in Supabase.
 * Usage: node --env-file=.env.local tools/check-images.js
 */
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  (process.env.SUPABASE_URL ?? '').replace(/\/rest\/v1\/?$/, ''),
  process.env.SUPABASE_SERVICE_KEY,
  { global: { fetch } }
);

// 1. List all storage buckets
console.log('=== Storage Buckets ===');
const { data: buckets, error: bErr } = await supabase.storage.listBuckets();
if (bErr) console.error('Buckets error:', bErr.message);
else buckets.forEach(b => console.log(' -', b.name, `(public: ${b.public})`));

// 2. Check champions table columns that might hold image data
console.log('\n=== Sample champion rows (all columns) ===');
const { data: champs, error: cErr } = await supabase
  .from('champions')
  .select('*')
  .limit(3);
if (cErr) console.error('Champions error:', cErr.message);
else {
  if (champs.length) console.log('Columns:', Object.keys(champs[0]).join(', '));
  for (const c of champs) {
    // Only print non-null values to keep output readable
    const nonNull = Object.fromEntries(Object.entries(c).filter(([, v]) => v !== null));
    console.log(JSON.stringify(nonNull));
  }
}

// 3. If any bucket exists, list a few files from each
if (buckets?.length) {
  console.log('\n=== Files in each bucket (first 10) ===');
  for (const bucket of buckets) {
    const { data: files, error: fErr } = await supabase.storage.from(bucket.name).list('', { limit: 10 });
    if (fErr) { console.log(`  ${bucket.name}: error - ${fErr.message}`); continue; }
    console.log(`  ${bucket.name}: ${files.length} items`);
    files.forEach(f => console.log(`    ${f.name}`));
  }
}
