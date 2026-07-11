import fs from 'fs';
const env={};
for (const l of fs.readFileSync(new URL('../.env.local', import.meta.url),'utf8').split(/\r?\n/)){
  const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if(m) env[m[1]]=m[2].replace(/^["']|["']$/g,'');
}
const base=env.SUPABASE_URL,key=env.SUPABASE_SERVICE_KEY;
const H={apikey:key,Authorization:`Bearer ${key}`};
async function all(path){
  let out=[],from=0,step=1000;
  while(true){
    const r=await fetch(`${base}/rest/v1/${path}`,{headers:{...H,Range:`${from}-${from+step-1}`,Prefer:'count=exact'}});
    const j=await r.json(); out=out.concat(j);
    if(j.length<step) break; from+=step;
  }
  return out;
}
const champions=await all('champions?game_id=eq.raid_shadow_legends&select=id,name');
const aliases=await all('champion_aliases?select=alias,champion_id');
const tags=await all('tags?select=id,name');
const ct=await all('champion_tags?select=champion_id,tag_id');
const out=process.argv[2];
fs.writeFileSync(out, JSON.stringify({champions,aliases,tags,champion_tags:ct}));
console.log(`champions=${champions.length} aliases=${aliases.length} tags=${tags.length} existing champion_tags=${ct.length} -> ${out}`);
