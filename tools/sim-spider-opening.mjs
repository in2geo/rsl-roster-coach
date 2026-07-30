// tools/sim-spider-opening.mjs — trace the OPENING of a Spider-13 fight to see whether the team establishes
// swarm control (taunt / Decrease Speed / Petrification) before the swarm snowballs the turn economy.
// The opening usually picks which of the two equilibria the fight falls into (see memory
// spider-swarm-control-turn-economy-2026-07-30). Observe-only (onTurnStart + onAction).
//
// Each row = one turn: the acting unit + (for allies) the skill cast, plus the live swarm's control state
// (alive / slowed / petrified) and the team's control state (Pelops taunt up? how many allies sped up?).
//
// Run: SEED=3 TURNS=1-24 node --env-file=.env.local tools/sim-spider-opening.mjs

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { makeState, simulate } from '../lib/sim/engine.js';
import { buildBattle, applyBattleLayers } from '../lib/sim/dragon-fixture.js';
import { installRecipeRun } from '../lib/sim/interpreter.js';
import { champKey } from '../lib/sim/recipes.js';

const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SEED = Number(process.env.SEED ?? 3);
const [T0, T1] = (process.env.TURNS ?? '1-24').split('-').map(Number);
if (!process.env.SUPABASE_URL) { console.log('needs the DB. Run with --env-file=.env.local'); process.exit(2); }
const BASE = process.env.SUPABASE_URL.replace(/\/rest\/v1\/?$/, '');
const H = { apikey: process.env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}` };
const _c = new Map();
const rest = async (p) => { if (!_c.has(p)) _c.set(p, await (await fetch(`${BASE}/rest/v1/${p}`, { headers: H })).json()); return _c.get(p); };

const isSlowed = (c) => (c.debuffs || []).some((d) => /Decrease Sp(ee|)d|Decrease SPD/i.test(d.type));
const isPetr = (c) => (c.debuffs || []).some((d) => d.type === 'Petrification');
const hasBuff = (c, t) => (c.buffs || []).some((b) => b.type === t);
const hasSpd = (c) => (c.buffs || []).some((b) => /Increase SP(D|eed)/.test(b.type));
const shortName = (n) => (n || '').split(' ')[0].replace(/#.*/, '');

const built0 = await buildBattle({ rest, fixture: JSON.parse(fs.readFileSync(path.join(REPO, 'test', 'golden', 'spider13-donbambus-current.json'), 'utf8')), repoRoot: REPO });
if (built0.skip) { console.log('skipped:', built0.skip); process.exit(0); }
const fixture = JSON.parse(fs.readFileSync(path.join(REPO, 'test', 'golden', 'spider13-donbambus-current.json'), 'utf8'));
const built = await buildBattle({ rest, fixture, repoRoot: REPO });
applyBattleLayers(built.allies);
const pelKey = champKey('Pelops the Victor');
const st = makeState({ allies: built.allies, enemies: [], seed: SEED });
installRecipeRun(st);

const rows = [];
let lastSkillByActor = null;
st.onAction = (s, actor, skill) => { lastSkillByActor = { turn: s.turn, actor: actor.name, slot: (skill?.slot || skill?.name || '?').toString().match(/A[1-4]|PASSIVE/)?.[0] || (skill?.name || '') }; };
const orig = st.onTurnStart;
st.onTurnStart = (s, actor) => {
  orig?.(s, actor);
  const adds = (s.enemies || []).filter((e) => e.role === 'add' && e.alive);
  const pel = built.allies.find((a) => champKey(a.name) === pelKey);
  const spedAllies = built.allies.filter((a) => a.alive && hasSpd(a)).length;
  rows.push({
    turn: s.turn, actorName: shortName(actor?.name), actorRole: actor?.role || (actor?.side === 'ally' ? 'ally' : '?'),
    adds: adds.length, slowed: adds.filter(isSlowed).length, petr: adds.filter(isPetr).length,
    pelTaunt: !!pel && (hasBuff(pel, 'Taunt') || hasBuff(pel, 'Provoke')), spedAllies,
  });
};

const res = simulate(st, built.content, { turnCap: 400 });
// attach the skill each ally cast on its turn (match by turn)
const skillByTurn = new Map();
const origAction = null;

console.log(`\n═══ SPIDER-13 OPENING — seed ${SEED} · turns ${T0}-${T1} ═══`);
console.log(`  ${res.won ? 'WIN' : 'LOSS'} in ${res.turns}t.  Watch: do taunt/slow/petrify appear before the swarm fills up?\n`);
console.log(`  turn  actor       role    │ swarm: alive slowed petr │ Pelops-taunt  allies-sped`);
console.log(`  ${'─'.repeat(82)}`);
for (const r of rows) {
  if (r.turn < T0 || r.turn > T1) continue;
  const ctrl = `${String(r.adds).padStart(3)}   ${String(r.slowed).padStart(3)}   ${String(r.petr).padStart(3)}`;
  console.log(`  ${String(r.turn).padStart(4)}  ${(r.actorName || '?').slice(0, 10).padEnd(11)} ${(r.actorRole || '').padEnd(7)} │  ${ctrl}  │  ${(r.pelTaunt ? 'TAUNT' : '—').padEnd(6)}      ${r.spedAllies}/5`);
}
// control coverage at the end of the window
const w = rows.filter((r) => r.turn >= T0 && r.turn <= T1);
const avg = (f) => (w.reduce((s, r) => s + f(r), 0) / Math.max(1, w.length));
console.log(`\n  opening averages (turns ${T0}-${T1}): swarm alive ${avg((r) => r.adds).toFixed(1)}  ·  slowed ${avg((r) => r.slowed).toFixed(1)}  ·  petrified ${avg((r) => r.petr).toFixed(1)}  ·  allies-sped ${avg((r) => r.spedAllies).toFixed(1)}/5  ·  taunt-up ${Math.round(100 * avg((r) => r.pelTaunt ? 1 : 0))}%`);
console.log(`  ▶ If slowed/petr stay near 0 while alive climbs to ~10, the team never establishes control → the bad equilibrium locks in.`);
