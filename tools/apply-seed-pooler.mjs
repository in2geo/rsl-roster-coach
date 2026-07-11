// Apply ONE .sql file to Supabase via the aws-1 SESSION POOLER (IPv4), in a
// single transaction (rollback on error). The direct host (SUPABASE_DB_URL) is
// IPv6-only and unreachable here; SUPABASE_POOLER_URL is the correct write path.
//
// Usage: node tools/apply-seed-pooler.mjs [--dry-run] <file.sql>
import fs from 'fs';
import path from 'path';
import pg from 'pg';

const env={};
for (const l of fs.readFileSync(new URL('../.env.local', import.meta.url),'utf8').split(/\r?\n/)){
  const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if(m) env[m[1]]=m[2].replace(/^["']|["']$/g,'');
}
const args=process.argv.slice(2);
const dry=args.includes('--dry-run');
const file=args.find(a=>a.endsWith('.sql'));
if(!file){ console.error('need a .sql file'); process.exit(1); }
const sql=fs.readFileSync(path.resolve(file),'utf8');
if(dry){ console.log(`[dry-run] ${file} (${sql.length} chars)`); process.exit(0); }
const cs=env.SUPABASE_POOLER_URL;
if(!cs){ console.error('SUPABASE_POOLER_URL missing in .env.local'); process.exit(1); }
const client=new pg.Client({connectionString:cs, ssl:{rejectUnauthorized:false}});
try{
  await client.connect();
  await client.query('begin');
  const res=await client.query(sql);
  await client.query('commit');
  // pg returns last statement's result; report rowCount when meaningful
  const rc = Array.isArray(res) ? res.map(r=>r.rowCount).join(',') : res.rowCount;
  console.log(`[ok] ${path.basename(file)} committed (last-stmt rowCount=${rc})`);
}catch(e){
  try{await client.query('rollback');}catch{}
  console.error(`[FAIL] ${path.basename(file)} rolled back: ${e.message}`);
  process.exitCode=2;
}finally{ await client.end(); }
