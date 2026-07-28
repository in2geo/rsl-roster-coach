// tools/model-recipe-registry.mjs — P3 (2b): registry-anchored recipe-champion guard.
//
// The engine keys recipes by champKey (first name token, uppercased — NO DB; lib/sim/recipes.js). That is
// correct for the no-DB engine, but a first-token key CAN collide when scaling to the full champion set
// (R4: "champion specifics leak into the generic engine via name-string keys … collision risk when scaling
// to all champions"). This rung anchors every recipe champion to a REAL champions.id via the SANCTIONED
// registry (lib/champion-names.js — never a raw name compare, per the CLAUDE.md hard rule) and BLOCKS if:
//   1. a recipe's `champion` does not resolve to a champions.id (typo / stale name);
//   2. champKey is not INJECTIVE over the recipe champions (two recipe champions collide to one key — the
//      engine would mis-resolve their recipes); or
//   3. any OTHER champion (by name OR alias) in the DB shares a recipe champion's champKey but is a
//      DIFFERENT champions.id — a real champion that, if fielded, would silently run a Dragon recipe.
//
// The engine hot path stays champKey/no-DB; the registry lives HERE, at validation. DB rung, wired into
// tools/model-qa.mjs. Run: node --env-file=.env.local tools/model-recipe-registry.mjs

import { RECIPES, champKey } from '../lib/sim/recipes.js';
import { buildNameResolver } from '../lib/champion-names.js';

if (!process.env.SUPABASE_URL) {
  console.log('\n⏳ recipe-registry guard — skipped (needs --env-file=.env.local)\n');
  console.log('QA_JSON ' + JSON.stringify({ rung: 'recipe-registry', pass: 0, fail: 0, skipped: 'no DB' }));
  process.exit(0);
}
const BASE = process.env.SUPABASE_URL.replace(/\/rest\/v1\/?$/, '');
const H = { apikey: process.env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}` };
const rest = async (p) => (await fetch(`${BASE}/rest/v1/${p}`, { headers: H })).json();
const page = async (path) => { const out = []; for (let off = 0; ; off += 1000) { const d = await rest(`${path}&limit=1000&offset=${off}`); if (!Array.isArray(d) || !d.length) break; out.push(...d); if (d.length < 1000) break; } return out; };

const gameId = 'raid_shadow_legends';
const champions = await page(`champions?select=id,name&game_id=eq.${gameId}`);
const aliases   = await page('champion_aliases?select=alias,champion_id');
const resolver = buildNameResolver(champions, aliases);

const failures = [];
const recipeChamps = [...new Set(Object.values(RECIPES).map((r) => r.champion))];

// 1. every recipe champion resolves to a real champions.id (registry, NOT a raw name compare)
const resolved = new Map();   // recipe champion name -> { id, name }
for (const name of recipeChamps) {
  const hit = resolver.resolve(name);
  if (!hit) failures.push(`recipe champion "${name}" does not resolve to any champions.id (typo/stale — add a champion_aliases row or fix recipes.js)`);
  else resolved.set(name, hit);
}

// 2. champKey INJECTIVE over recipe champions: each champKey must map to exactly ONE champions.id
const byKey = new Map();   // champKey -> Map(id -> recipe champion name)
for (const [name, hit] of resolved) {
  const k = champKey(name);
  if (!byKey.has(k)) byKey.set(k, new Map());
  byKey.get(k).set(hit.id, name);
}
for (const [k, idMap] of byKey) if (idMap.size > 1) failures.push(`champKey "${k}" collides across recipe champions: ${[...idMap.values()].map((n) => `"${n}"`).join(' vs ')} (different champions.id — recipeFor would mis-resolve)`);

// 3. SCALING collision: any OTHER champion (name or alias) in the DB sharing a recipe champKey but a
//    DIFFERENT champions.id — a real champion that, if fielded, would silently run a Dragon recipe.
const recipeKeyToId = new Map();   // champKey -> the recipe champion's id (unique after check 2)
for (const [name, hit] of resolved) recipeKeyToId.set(champKey(name), hit.id);
const seen = new Set();
const check = (label, rawName, id) => {
  const k = champKey(rawName);
  if (recipeKeyToId.has(k) && recipeKeyToId.get(k) !== id) {
    const sig = `${k}:${id}`;
    if (!seen.has(sig)) { seen.add(sig); failures.push(`champKey "${k}" (recipe champion id ${recipeKeyToId.get(k)}) also matches ${label} "${rawName}" (champions.id ${id}) — a real champion that would mis-run a recipe`); }
  }
};
for (const c of champions) check('champion', c.name, c.id);
for (const a of aliases) check('alias', a.alias, a.champion_id ?? a.id);

const pass = failures.length === 0;
console.log(`\nRECIPE REGISTRY GUARD — ${recipeChamps.length} recipe champions · ${champions.length} champions · ${aliases.length} aliases`);
if (pass) console.log('  ✓ every recipe champion resolves; champKey is injective over recipe champions AND across the full champion set');
else { console.log(`  ✗ ${failures.length} problem(s):`); for (const f of failures) console.log(`    - ${f}`); }
console.log('QA_JSON ' + JSON.stringify({ rung: 'recipe-registry', pass: pass ? recipeChamps.length : 0, fail: failures.length, failures, recipeChamps: recipeChamps.length, champions: champions.length }));
process.exit(pass ? 0 : 1);
