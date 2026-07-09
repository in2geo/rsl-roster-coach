// Read-only live-DB inspector via the Supabase REST API (HTTPS/IPv4).
// WHY: the direct Postgres host (db.<ref>.supabase.co) is IPv6-only and does
// not resolve from many networks, so `pg`-based tools fail with ENOTFOUND.
// The REST endpoint (SUPABASE_URL) is IPv4/Cloudflare and always reachable.
// This tool NEVER writes — it only GETs. Applying seeds still needs the pooler.
//
// Usage:
//   node tools/live_db_read.mjs                      -> default sanity champions
//   node tools/live_db_read.mjs Uugo "Fahrakin the Fat" Gnut
//
// Prints each champion's champion_tags (status, source_type, tag name) and
// flags any source_note still starting with TEST_DATA. Also reports whether a
// small set of vocab tags exist.
import fs from 'fs';

const env = {};
for (const l of fs.readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split(/\r?\n/)) {
  const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const base = env.SUPABASE_URL;
const key = env.SUPABASE_SERVICE_KEY;
if (!base || !key) { console.error('SUPABASE_URL / SUPABASE_SERVICE_KEY missing in .env.local'); process.exit(1); }
const H = { apikey: key, Authorization: `Bearer ${key}` };

async function get(path) {
  const r = await fetch(`${base}/rest/v1/${path}`, { headers: H });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return r.json();
}

const names = process.argv.slice(2);
const target = names.length ? names : ['Gnut', 'Tagoar', 'Uugo', 'Fahrakin the Fat'];

const inList = target.map(n => `"${n}"`).join(',');
const champs = await get(`champions?game_id=eq.raid_shadow_legends&name=in.(${inList})&select=id,name`);
console.log(`LIVE DB reachable via REST. Champions found: ${champs.map(c => c.name).join(', ') || '(none)'}`);

for (const c of champs) {
  const rows = await get(`champion_tags?champion_id=eq.${c.id}&select=status,source_type,source_note,tags(name)&order=status`);
  console.log(`\n=== ${c.name} (${rows.length} tags) ===`);
  for (const r of rows) {
    const flag = /^TEST_DATA/.test(r.source_note || '') ? '  <-- TEST_DATA placeholder' : '';
    console.log(`  [${r.status}] ${r.tags?.name} (${r.source_type})${flag}`);
  }
}

const vocab = await get(`tags?name=in.("Ally Attack","Freeze","Cleanse")&select=name`);
console.log(`\nVOCAB present: ${vocab.map(v => v.name).join(', ') || '(none of the probed set)'}`);
