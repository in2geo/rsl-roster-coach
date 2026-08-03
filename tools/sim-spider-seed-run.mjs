// Single-seed Spider-13 run: outcome + per-hero dealt/taken/healing (compare to a victory screen).
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
const REPO = 'C:/Users/in2ge/OneDrive/Desktop/RSL-coach/repo';
const imp = (rel) => import(pathToFileURL(path.join(REPO, rel)).href);
const { buildBattle, applyBattleLayers } = await imp('lib/sim/dragon-fixture.js');
const { makeState, simulate } = await imp('lib/sim/engine.js');
const { installRecipeRun } = await imp('lib/sim/interpreter.js');
const { champKey } = await imp('lib/sim/recipes.js');

const BASE = process.env.SUPABASE_URL.replace(/\/rest\/v1\/?$/, '');
const H = { apikey: process.env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}` };
const _c = new Map();
const rest = async (p) => { if (!_c.has(p)) _c.set(p, await (await fetch(`${BASE}/rest/v1/${p}`, { headers: H })).json()); return _c.get(p); };

const SEED = Number(process.env.SEED || 100);
const fixture = JSON.parse(fs.readFileSync(path.join(REPO, 'test', 'golden', 'spider13-donbambus-current.json'), 'utf8'));
const built = await buildBattle({ rest, fixture, repoRoot: REPO });
applyBattleLayers(built.allies);
const st = makeState({ allies: built.allies, enemies: [], seed: SEED });
installRecipeRun(st);
const res = simulate(st, built.content, { turnCap: 400 });

const DEALT_KINDS = new Set(['damage', 'dot']);   // match tools/sim-per-hero-bands.mjs attribution
const allyKey = new Set(built.allies.map((a) => champKey(a.name)));
const dealt = {}, taken = {}, healing = {};
for (const a of built.allies) taken[champKey(a.name)] = Math.round(a.taken || 0);   // authoritative combatant.taken
for (const e of res.effects || []) {
  const amt = e.amount ?? 0; if (amt <= 0) continue;
  const k = e.source ? champKey(e.source) : null;
  if (k && allyKey.has(k) && DEALT_KINDS.has(e.kind)) dealt[k] = (dealt[k] || 0) + amt;
  if (k && allyKey.has(k) && e.kind === 'heal') healing[k] = (healing[k] || 0) + amt;
}
const deaths = res.deaths || [], revives = res.revives || [];
const cnt = (arr, nm) => arr.filter((e) => e.who === nm).length;
console.log(`\n═══ SPIDER-13 · SEED ${SEED} ═══`);
console.log(`  RESULT: ${res.won ? 'VICTORY' : 'DEFEAT'}   turns: ${res.turns}   survivors: ${(res.survivors||[]).length}/5`);
console.log(`  total deaths: ${deaths.length}   total revives: ${revives.length}`);
console.log(`  ${'champ'.padEnd(16)} ${'maxHP'.padStart(8)} ${'taken'.padStart(9)} ${'bars(taken/maxHP)'.padStart(17)} ${'deaths'.padStart(7)} ${'revives'.padStart(8)}`);
for (const a of built.allies) {
  const k = champKey(a.name);
  const t = taken[k] || 0, d = cnt(deaths, a.name), r = cnt(revives, a.name);
  console.log(`  ${a.name.padEnd(16)} ${String(Math.round(a.maxHp)).padStart(8)} ${String(Math.round(t).toLocaleString()).padStart(9)} ${(t/a.maxHp).toFixed(1).padStart(17)} ${String(d).padStart(7)} ${String(r).padStart(8)}`);
}
console.log(`\n  ${'champ'.padEnd(16)} ${'dealt'.padStart(12)} ${'healing'.padStart(10)}`);
for (const a of built.allies) { const k = champKey(a.name); console.log(`  ${a.name.padEnd(16)} ${String(Math.round(dealt[k]||0).toLocaleString()).padStart(12)} ${String(Math.round(healing[k]||0).toLocaleString()).padStart(10)}`); }
