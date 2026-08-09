// tools/recipe-priority.mjs — RECIPE PRIORITIZATION (North Star step 2 support)
// Counts how often each champion is FIELDED in captured Spider + Dragon battles
// (run_reconciliations.team_fielded), resolved through the name registry so aliases
// collapse, and flags which frequent champions do NOT yet have a sim recipe.
// The ones with the highest count AND no recipe move the sim-suite number most.
//
// Usage: node --env-file=.env.local tools/recipe-priority.mjs
import fs from 'fs';
import { buildNameResolver } from '../lib/champion-names.js';

const env = {};
for (const l of fs.readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split(/\r?\n/)) {
  const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const base = env.SUPABASE_URL, key = env.SUPABASE_SERVICE_KEY;
const H = { apikey: key, Authorization: `Bearer ${key}` };
async function get(path) {
  const r = await fetch(`${base}/rest/v1/${path}`, { headers: H });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return r.json();
}

// --- champions + aliases for the resolver ---
const champs = await get('champions?game_id=eq.raid_shadow_legends&select=id,name');
const aliases = await get('champion_aliases?select=champion_id,alias');
const resolver = buildNameResolver(champs, aliases);
const nameById = new Map(champs.map(c => [c.id, c.name]));

// --- recipe registry: which champions already have a recipe block ---
const recipeSrc = fs.readFileSync(new URL('../lib/sim/recipes.js', import.meta.url), 'utf8');
const recipeKeys = new Set(
  [...recipeSrc.matchAll(/'([A-Z0-9]+)-(?:A[0-9]|PASSIVE|AURA|LEAD)'/g)].map(m => m[1])
);
// heuristic: a champion "has a recipe" if any recipe key equals an UPPERCASE word of its canonical name
function hasRecipe(canonName) {
  const words = canonName.toUpperCase().replace(/[^A-Z0-9 ]/g, '').split(/\s+/).filter(Boolean);
  return words.some(w => recipeKeys.has(w)) || [...recipeKeys].some(k => words.includes(k));
}

// --- pull all Spider + Dragon reconciliations ---
const rows = await get('run_reconciliations?select=content,team_fielded&limit=100000');
const isSpider = c => /spider/i.test(c || '');
const isDragon = c => /dragon/i.test(c || '');

const counts = new Map(); // id -> {spider, dragon, unresolvedName?}
let battlesSpider = 0, battlesDragon = 0;
for (const r of rows) {
  const dungeon = isSpider(r.content) ? 'spider' : isDragon(r.content) ? 'dragon' : null;
  if (!dungeon) continue;
  if (dungeon === 'spider') battlesSpider++; else battlesDragon++;
  const seen = new Set(); // one credit per battle per champion
  for (const h of (r.team_fielded || [])) {
    const res = resolver.resolve(h.name);
    const idKey = res?.id ?? `unresolved:${(h.name || '').toLowerCase().trim()}`;
    if (seen.has(idKey)) continue;
    seen.add(idKey);
    const rec = counts.get(idKey) || { spider: 0, dragon: 0, raw: h.name, resolved: !!res };
    rec[dungeon]++;
    counts.set(idKey, rec);
  }
}

const out = [...counts.entries()].map(([idKey, v]) => {
  const canon = idKey.startsWith('unresolved:') ? `?${v.raw}` : (nameById.get(idKey) || idKey);
  return { canon, total: v.spider + v.dragon, spider: v.spider, dragon: v.dragon,
           recipe: v.resolved ? hasRecipe(canon) : false, resolved: v.resolved };
}).sort((a, b) => b.total - a.total);

console.log(`Battles — Spider: ${battlesSpider}, Dragon: ${battlesDragon}`);
console.log(`Recipe keys found: ${[...recipeKeys].sort().join(', ')}\n`);
const pad = (s, n) => String(s).padEnd(n);
console.log(pad('CHAMPION', 34) + pad('TOT', 5) + pad('SPD', 5) + pad('DRG', 5) + 'RECIPE?');
console.log('-'.repeat(60));
for (const r of out) {
  if (r.total < 2) continue;
  const flag = !r.resolved ? 'UNRESOLVED' : r.recipe ? 'yes' : '*** NO ***';
  console.log(pad(r.canon, 34) + pad(r.total, 5) + pad(r.spider, 5) + pad(r.dragon, 5) + flag);
}

console.log('\n=== TOP TARGETS (fielded >=3, NO recipe) ===');
for (const r of out.filter(r => r.resolved && !r.recipe && r.total >= 3)) {
  console.log(`  ${pad(r.canon, 30)} total=${r.total}  (spider ${r.spider}, dragon ${r.dragon})`);
}
