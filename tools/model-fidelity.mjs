// tools/model-fidelity.mjs — MODEL QA · DB→recipe fidelity (protocol layer 1 completion).
//
// "A simulator cannot compensate for bad source data" — and it also cannot compensate for a column it never
// READS. This rung asserts every DEAL_DAMAGE recipe faithfully reflects the DB's authoritative columns:
// `damage_multiplier` (the coefficient) and `multiplier_type` (the scaling stat, ATK/HP/DEF). It is the
// check that would have caught Vergis's `3.9`/`DEF` being read as ATK — a value PRESENT in the DB but not
// consumed. A mismatch is a spec violation (the recipe disagrees with its own source). Needs DB.
// Run: node --env-file=.env.local tools/model-fidelity.mjs

import { RECIPES, FORMULAS } from '../lib/sim/recipes.js';

if (!process.env.SUPABASE_URL) { console.log('\n⏳ DB→recipe fidelity — skipped (needs --env-file=.env.local)\n'); console.log('QA_JSON ' + JSON.stringify({ rung: 'model-fidelity', pass: 0, fail: 0, skipped: 'no DB' })); process.exit(0); }
const BASE = process.env.SUPABASE_URL.replace(/\/rest\/v1\/?$/, '');
const H = { apikey: process.env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}` };
const rest = async (p) => (await fetch(`${BASE}/rest/v1/${p}`, { headers: H })).json();

// resolve each recipe's champion first-name to its DB skills (damage_multiplier + multiplier_type)
const firstNames = [...new Set(Object.values(RECIPES).map(r => r.champion.split(' ')[0]))];
const skillsByChamp = {};
for (const q of firstNames) {
  const cs = await rest(`champions?game_id=eq.raid_shadow_legends&name=ilike.*${encodeURIComponent(q)}*&select=id,name`);
  const c = cs.find(x => x.name.split(' ')[0].toLowerCase() === q.toLowerCase()) || cs[0];
  if (!c) { skillsByChamp[q] = null; continue; }
  const sk = await rest(`champion_skills?champion_id=eq.${c.id}&select=slot,damage_multiplier,multiplier_type`);
  skillsByChamp[q] = Object.fromEntries(sk.map(s => [String(s.slot).toUpperCase(), s]));
}

const SIMPLE = { atk: 'atk', hp: 'hp', def: 'def' };
const fails = [], checked = [];
for (const [key, rec] of Object.entries(RECIPES)) {
  const dd = (rec.actions || []).find(a => a.op === 'DEAL_DAMAGE');
  if (!dd) continue;
  const F = FORMULAS[dd.formulaId];
  const first = rec.champion.split(' ')[0];
  const db = skillsByChamp[first]?.[rec.slot];
  if (!db) { fails.push(`${key}: no DB skill row for ${first} ${rec.slot}`); continue; }
  const mt = String(db.multiplier_type ?? '').trim().toLowerCase();
  const dm = String(db.damage_multiplier ?? '').trim();
  checked.push(key);

  if (SIMPLE[mt]) {
    // simple type → recipe formula must scale off that stat AND carry the DB's numeric coefficient
    if (String(F.scalingStat).toLowerCase() !== SIMPLE[mt]) fails.push(`${key}: scalingStat ${F.scalingStat} ≠ DB multiplier_type ${db.multiplier_type}`);
    const dbNum = parseFloat(dm);
    if (Number.isFinite(dbNum) && F.multiplier != null && Math.abs(dbNum - F.multiplier) > 1e-6) fails.push(`${key}: multiplier ${F.multiplier} ≠ DB damage_multiplier ${dm}`);
  } else {
    // complex/formula type (multi-term, %maxHP…) → recipe must represent it as `terms`, not a single stat guess
    if (!(F.terms && F.terms.length)) fails.push(`${key}: DB multiplier_type "${db.multiplier_type}" is a formula but recipe uses a single ${F.scalingStat} coeff (needs terms)`);
  }
}

const pass = fails.length === 0;
console.log(`\n══ MODEL DB→RECIPE FIDELITY (layer 1) ══  ${checked.length} damage recipes checked vs DB columns — ${pass ? 'all faithful' : fails.length + ' MISMATCH(ES)'}\n`);
for (const f of fails) console.log('  ✗ ' + f);
if (pass) console.log('  ✓ every DEAL_DAMAGE recipe reflects damage_multiplier + multiplier_type from the DB');
console.log('\nQA_JSON ' + JSON.stringify({ rung: 'model-fidelity', pass: pass ? checked.length : checked.length - fails.length, fail: fails.length, checked: checked.length, failures: fails }));
process.exit(pass ? 0 : 1);
