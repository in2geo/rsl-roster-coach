// diff the INDEPENDENT stat engine (stats.mjs, raw gear, no lib imports) vs the MODEL's effectiveStats().
import fs from 'fs';
import { effectiveFromRaw } from './stats.mjs';
import { effectiveStats } from '../../lib/effective-stats.js';   // the MODEL under test
const SNAP = process.argv[2] || 'DonaHilvi_a6261acc35588c94.json';
const TEAM = (process.argv[3] || 'Ezio,Ninja,Michelangelo,Iudex Artor,Xenomorph').split(',');
const snap=JSON.parse(fs.readFileSync(new URL('../../gestal-sync/output/'+SNAP,import.meta.url),'utf8'));
const K=['hp','atk','def','spd','crate','cdmg','res','acc'];
console.log(`INDEPENDENT (stats.mjs, raw gear)  vs  MODEL effectiveStats()  — ${SNAP.replace('.json','')}`);
console.log('(the Model then adds applyAccountBonus on top of this — not included here)\n');
for(const nm of TEAM){
  const raw=(snap.champions||[]).find(c=>c.name===nm||c.name.startsWith(nm.split(' ')[0]));
  if(!raw){console.log(`  ${nm}: not in snapshot`);continue;}
  const mine=effectiveFromRaw(raw);
  let model; try{ model=effectiveStats(raw).effective; }catch(e){ console.log(`  ${nm} (${raw.name}): effectiveStats threw: ${e.message}`); continue; }
  console.log(`  ${nm}  (snapshot: ${raw.name})`);
  for(const k of K){ const mv=model[k]??model[{crate:'crit_rate',cdmg:'crit_dmg'}[k]]; const d=mv!=null?mine[k]-Math.round(mv):null; const pc=mv?(100*d/mv).toFixed(0):'—';
    const flag=(mv!=null&&Math.abs(d)>Math.max(3,0.05*Math.abs(mv)))?'  <-- DIVERGENT':'';
    console.log(`     ${k.padEnd(5)} raw=${String(mine[k]).padStart(7)}  model=${String(mv==null?'?':Math.round(mv)).padStart(7)}  Δ=${d==null?'?':String(d).padStart(6)} (${pc}%)${flag}`); }
}
