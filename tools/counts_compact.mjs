import fs from 'fs';
const env={};
for (const l of fs.readFileSync(new URL('../.env.local', import.meta.url),'utf8').split(/\r?\n/)){
  const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if(m) env[m[1]]=m[2].replace(/^["']|["']$/g,'');
}
const base=env.SUPABASE_URL,key=env.SUPABASE_SERVICE_KEY;
const H={apikey:key,Authorization:`Bearer ${key}`,Prefer:'count=exact'};
async function c(p){const r=await fetch(`${base}/rest/v1/${p}`,{method:'HEAD',headers:H});return (r.headers.get('content-range')||'/?').split('/')[1];}
const ct=await c('champion_tags?select=id');
const cta=await c('champion_tags?status=eq.approved&select=id');
const ca=await c('champion_aliases?select=id');
const ch=await c('champions?game_id=eq.raid_shadow_legends&select=id');
const tg=await c('tags?select=id');
console.log(`tags_tbl=${tg} champions=${ch} champion_tags=${ct}(appr ${cta}) aliases=${ca}`);
