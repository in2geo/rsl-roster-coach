// Read-only verification for the 2026-07-08 tag batch (Task 2). NO writes.
// Connects via SUPABASE_POOLER_URL (aws-1 pooler, IPv4). The direct host in
// SUPABASE_DB_URL is IPv6-only and fails with ENOTFOUND from most networks —
// see the supabase-db-access memory. Falls back to SUPABASE_DB_URL only if the
// pooler var is unset.
const fs = require('fs');
const { Client } = require('pg');

function loadEnv(p) {
  const out = {};
  for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return out;
}

const NEW = [
  ['Krisk','Decrease Defense'],['Riho','Decrease Defense'],
  ['Alaric','Decrease Attack'],['Aox','Decrease Attack'],['Avir','Decrease Attack'],
  ['Balthus','Decrease Attack'],['Baroth','Decrease Attack'],['Dhukk','Decrease Attack'],
  ['Ghrush','Decrease Attack'],['Giscard','Decrease Attack'],['Krisk','Decrease Attack'],
  ['Lodric','Decrease Attack'],['Mighty Ukko','Decrease Attack'],['Nekhret','Decrease Attack'],
  ['Riho','Decrease Attack'],['Sentinel','Decrease Attack'],['Skimfos','Decrease Attack'],
  ['Skull Lord Var-Gall','Decrease Attack'],['Toragi','Decrease Attack'],['Ursala','Decrease Attack'],
  ['Vasal','Decrease Attack'],['Pharsalas','Provoke'],
  ['Cillian','Decrease Speed'],['Fortress Goon','Decrease Speed'],['Grohak','Decrease Speed'],
  ['Krisk','Decrease Speed'],['Kurzad','Decrease Speed'],['Masked Fearmonger','Decrease Speed'],
  ['Skimfos','Decrease Speed'],['Teodor the Savant','Decrease Speed'],['Tuhak','Decrease Speed'],
  ['Yakarl','Decrease Speed'],
];

(async () => {
  const env = loadEnv(__dirname + '/../.env.local');
  const url = env.SUPABASE_POOLER_URL || env.SUPABASE_DB_URL;
  if (!url) { console.error('SUPABASE_POOLER_URL / SUPABASE_DB_URL missing'); process.exit(1); }
  const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await c.connect();
  // THE alias-aware name registry (champions.name + champion_aliases): resolve each NEW name →
  // champions.id, then query BY ID — never a raw `name = any(...)` lookup, which silently misses
  // any short-name whose champions.name differs (e.g. "Pharsalas" → "Pharsalas Gravedirt").
  const { loadNameResolver } = await import('../lib/champion-names.js');
  const resolver = await loadNameResolver(c);
  const names = [...new Set(NEW.map(x => x[0]))];
  const idByName = new Map();
  for (const n of names) { const hit = resolver.resolve(n); if (hit) idByName.set(n, hit.id); }
  const found = new Set([...idByName.keys()]);
  const missing = names.filter(n => !found.has(n));
  console.log('CHAMPIONS present: ' + found.size + '/' + names.length);
  console.log('CHAMPIONS MISSING from live champions table: ' + JSON.stringify(missing));

  const ids = [...new Set([...idByName.values()])];
  const idToName = new Map([...idByName].map(([n, id]) => [id, n]));   // champion_id → original NEW name
  const q = await c.query(
    `select ct.champion_id as cid, t.name as tname
       from champion_tags ct
       join tags t on t.id=ct.tag_id
      where ct.champion_id = any($1)
        and t.name in ('Decrease Defense','Decrease Attack','Decrease Speed','Provoke')`, [ids]);
  const have = new Set(q.rows.map(r => (idToName.get(r.cid) ?? r.cid) + '||' + r.tname));
  const already = NEW.filter(([n,t]) => have.has(n + '||' + t));
  const trulyNew = NEW.filter(([n,t]) => found.has(n) && !have.has(n + '||' + t));
  const blocked = NEW.filter(([n,t]) => !found.has(n));
  console.log('PAIRS already in live champion_tags: ' + already.length + ' -> ' + JSON.stringify(already));
  console.log('PAIRS truly new & insertable: ' + trulyNew.length);
  console.log('PAIRS blocked (champion missing): ' + blocked.length + ' -> ' + JSON.stringify(blocked));
  await c.end();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
