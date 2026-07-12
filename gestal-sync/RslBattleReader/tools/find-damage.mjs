// Locate a known value (e.g. Clan Boss total damage from the in-game end screen)
// inside a raw battleResults dump, so we can find WHERE damage lives in the custom
// blob encoding. Searches every plausible integer encoding + a tolerance window
// (for fixed-point / rounding). Usage:
//   node find-damage.mjs <dumpfile.bin> <value> [value2 ...]
// Reports byte offsets + surrounding context for each hit.

import fs from 'fs';

const [file, ...vals] = process.argv.slice(2);
if (!file || !vals.length) {
  console.error('usage: node find-damage.mjs <dumpfile.bin> <value> [value2 ...]');
  process.exit(1);
}
const buf = fs.readFileSync(file);
console.log(`file ${file} (${buf.length} bytes)`);

function ctx(off, span = 12) {
  const a = Math.max(0, off - span), b = Math.min(buf.length, off + span);
  return [...buf.subarray(a, b)].map((x, i) => {
    const o = a + i;
    const hex = x.toString(16).padStart(2, '0');
    return (o === off ? `[${hex}]` : hex);
  }).join(' ');
}

for (const raw of vals) {
  const target = Number(raw);
  console.log(`\n=== searching for ${target.toLocaleString()} ===`);
  let hits = 0;
  const pats = [];
  // plain integer (±3 tolerance)
  for (let d = -3; d <= 3; d++) {
    const v = target + d; if (v < 0) continue;
    const b4 = Buffer.alloc(4), l4 = Buffer.alloc(4), b8 = Buffer.alloc(8), l8 = Buffer.alloc(8);
    b4.writeUInt32BE(v >>> 0); l4.writeUInt32LE(v >>> 0);
    b8.writeBigUInt64BE(BigInt(v)); l8.writeBigUInt64LE(BigInt(v));
    pats.push([`u32BE${d ? `${d>0?'+':''}${d}` : ''}`, b4], [`u32LE`, l4], [`u64BE`, b8], [`u64LE`, l8]);
    if (v < 0x1000000) { // 3-byte int (all per-champ CB damages fit)
      const u3be = Buffer.from([(v>>16)&0xff, (v>>8)&0xff, v&0xff]);
      const u3le = Buffer.from([v&0xff, (v>>8)&0xff, (v>>16)&0xff]);
      pats.push(['u24BE', u3be], ['u24LE', u3le]);
    }
  }
  // fixed-point ×2^k and ×decimal, as u64
  for (const [label, mul] of [['fp×65536', 65536], ['fp×256', 256], ['×1000', 1000], ['×100', 100]]) {
    const v = BigInt(Math.round(target * mul));
    const b8 = Buffer.alloc(8), l8 = Buffer.alloc(8);
    b8.writeBigUInt64BE(v); l8.writeBigUInt64LE(v);
    pats.push([`${label} u64BE`, b8], [`${label} u64LE`, l8]);
  }
  // IEEE floats
  const f8be = Buffer.alloc(8), f8le = Buffer.alloc(8), f4be = Buffer.alloc(4), f4le = Buffer.alloc(4);
  f8be.writeDoubleBE(target); f8le.writeDoubleLE(target);
  f4be.writeFloatBE(target);  f4le.writeFloatLE(target);
  pats.push(['f64BE', f8be], ['f64LE', f8le], ['f32BE', f4be], ['f32LE', f4le]);

  for (const [label, pat] of pats) {
    let i = 0;
    while ((i = buf.indexOf(pat, i)) !== -1) {
      console.log(`  hit ${label} @${i}: ${ctx(i)}`);
      hits++; i++;
    }
  }
  if (!hits) console.log('  no hits (int / fixed-point / float). Value may not be in this blob, or is delta-encoded.');
}
