import fs from 'fs';
const env={};
for (const l of fs.readFileSync(new URL('../.env.local', import.meta.url),'utf8').split(/\r?\n/)){
  const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if(m) env[m[1]]=m[2].replace(/^["']|["']$/g,'');
}
const base=env.SUPABASE_URL, key=env.SUPABASE_SERVICE_KEY;
const H={apikey:key,Authorization:`Bearer ${key}`,Prefer:'count=exact'};
async function count(path){
  const r=await fetch(`${base}/rest/v1/${path}`,{method:'HEAD',headers:H});
  const cr=r.headers.get('content-range')||'';
  return cr.split('/')[1]||'?';
}
for (const [label,path] of [
  ['champions','champions?game_id=eq.raid_shadow_legends&select=id'],
  ['champion_tags (all)','champion_tags?select=id'],
  ['champion_tags proposed','champion_tags?status=eq.proposed&select=id'],
  ['champion_tags approved','champion_tags?status=eq.approved&select=id'],
  ['champion_tags rejected','champion_tags?status=eq.rejected&select=id'],
  ['champion_aliases','champion_aliases?select=id'],
  ['tags','tags?select=id'],
]){
  try{ console.log(`  ${label.padEnd(26)} ${await count(path)}`);}catch(e){console.log(`  ${label}: ERR ${e.message}`);}
}
