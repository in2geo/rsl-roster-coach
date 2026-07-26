// tools/sim-run.mjs — the CONNECTED deterministic run: the model executed end-to-end for Dragon-16.
//
// Everything acts through the RECIPES (state.recipeAct), passives fire on their events, damage modifiers
// apply on incoming hits. Stat layers: Ezio leader aura (SPD +19%, all battles) + Bronze III Arena
// (HP/ATK/DEF +3%). Chance policy: ALL-LAND (stated, deterministic). No RNG. Run:
//   node --env-file=.env.local tools/sim-run.mjs
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { makeState, simulate, setChanceMode } from '../lib/sim/engine.js';
import { buildDragonBattle, applyBattleLayers } from '../lib/sim/dragon-fixture.js';
import { installRecipeRun } from '../lib/sim/interpreter.js';

const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const FIX = path.join(REPO, 'test', 'golden', 'dragon16-donbambus-2026-07-22.json');
if (!process.env.SUPABASE_URL) { console.log('\n⏳ needs DB. node --env-file=.env.local tools/sim-run.mjs\n'); process.exit(0); }
const BASE = process.env.SUPABASE_URL.replace(/\/rest\/v1\/?$/, '');
const H = { apikey: process.env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}` };
const rest = async (p) => (await fetch(`${BASE}/rest/v1/${p}`, { headers: H })).json();

// stat layers — Ezio aura (SPD +19% of BASE, all allies) + Bronze III arena (+3% HP/ATK/DEF, all allies).
// Shared base-only-aura helper (True Speed §4); see dragon-fixture.applyBattleLayers.

async function main() {
  const fixture = JSON.parse(fs.readFileSync(FIX, 'utf8'));
  const built = await buildDragonBattle({ rest, fixture, repoRoot: REPO });
  if (built.skip) { console.log('skipped:', built.skip); return; }
  applyBattleLayers(built.allies);

  setChanceMode('all');   // stated chance policy: everything lands (both sides)
  const state = makeState({ allies: built.allies, enemies: [], seed: null });
  state.purpleBarLeft = 0;
  installRecipeRun(state);   // recipeAct + start-of-turn/round triggers (Ezio Perfect Veil) + battle-start round buffs

  const res = simulate(state, built.content, { turnCap: 400 });

  // per-champ damage taken (from the effect ledger) — the survival signature
  const team = built.allies.map((a) => a.name);
  const taken = Object.fromEntries(team.map((n) => [n, 0]));
  for (const e of res.effects || []) if ((e.kind === 'damage' || e.kind === 'dot') && team.includes(e.target) && (e.amount || 0) > 0) taken[e.target] += e.amount;

  console.log('\n══ CONNECTED RUN — Dragon-16, all-land, Ezio aura + Bronze III, no RNG ══\n');
  console.log('  policy: ALL chances land · SPD ×1.19 (Ezio aura) · HP/ATK/DEF ×1.03 (Bronze III)\n');
  console.log('  RESULT:', res.won ? 'VICTORY' : 'LOSS', `— ${res.reason}  (${res.turns} turns)`);
  console.log('  phases:', res.phases.map((p) => `${p.phase}:${p.outcome}(${p.turns}t)`).join(' · '));
  console.log('  survivors:', res.survivors.length ? res.survivors.join(', ') : 'NONE');
  if (res.deaths.length) console.log('  deaths:', res.deaths.map((d) => `${d.who}@t${d.turn}/${d.phase}`).join(', '));
  console.log('\n  champion   HP now / max        damage taken');
  console.log('  ' + '─'.repeat(48));
  for (const a of built.allies) {
    const hp = a.alive ? `${Math.max(0, Math.round(a.hp)).toLocaleString()} / ${a.maxHp.toLocaleString()}` : 'DEAD';
    console.log(`  ${a.name.padEnd(9)} ${hp.padEnd(20)} ${Math.round(taken[a.name]).toLocaleString()}`);
  }
  const flags = [...new Set((res.flags || []).filter((f) => /MISSING|UNMODELLED|UNKNOWN/.test(f)))];
  if (flags.length) { console.log('\n  model gaps flagged this run:'); for (const f of flags.slice(0, 10)) console.log('    -', f); }
  console.log('');
}
main().catch((e) => { console.error(e); process.exit(1); });
