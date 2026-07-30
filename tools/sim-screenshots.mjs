// tools/sim-screenshots.mjs — SIM "SCREENSHOTS" vs REALITY, frame by frame.
//
// Mike captured a live Ezio-team Spider-13 fight at turns 42/63/79/94/114/124/145 → VICTORY t153. This
// snapshots the SIM at the SAME turn counts and reports the same observables he can read off his screen —
// boss HP%, Spiderlings alive, how many BURNING, how many PETRIFIED, how many EXPLODED (killed by our damage
// so far), boss debuff-stack — so the divergence from reality is visible turn by turn instead of buried in an
// aggregate win rate.
//
// Averaged over N seeds; late frames also report what % of sim seeds are STILL ALIVE (the sim wipes ~t139,
// so it usually never reaches the turns where reality is still grinding the boss down).
//
// Run: node --env-file=.env.local tools/sim-screenshots.mjs [N]

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { makeState, simulate } from '../lib/sim/engine.js';
import { buildBattle, applyBattleLayers } from '../lib/sim/dragon-fixture.js';
import { installRecipeRun } from '../lib/sim/interpreter.js';
import { champKey } from '../lib/sim/recipes.js';

const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const N = Number(process.argv[2] || 30);
const CKPT = [42, 63, 79, 94, 114, 124, 145];
const isSp = (n) => /Spiderling/i.test(String(n));

// Reality reads from Mike's frames (2026-07-29 live Ezio-team fight → WIN t153). '?' = not legible from frame.
const REAL = {
  42:  { bossPct: '~90', alive: '~10', burn: '~4', petr: '?', boss_deb: '~11' },
  63:  { bossPct: '~100', alive: '~8', burn: '~2', petr: '?', boss_deb: '~5' },
  79:  { bossPct: '~82', alive: '~10', burn: '5+', petr: '?', boss_deb: '~8' },
  94:  { bossPct: '~90', alive: '~10', burn: 'several', petr: '?', boss_deb: '~9' },
  114: { bossPct: '~85', alive: '~9', burn: 'several', petr: '?', boss_deb: '?' },
  124: { bossPct: '~100', alive: '~5', burn: '?', petr: '?', boss_deb: '?' },
  145: { bossPct: '~90', alive: '~10', burn: 'many', petr: '?', boss_deb: '?' },
};

if (!process.env.SUPABASE_URL) { console.log('needs the DB. Run with --env-file=.env.local'); process.exit(2); }
const BASE = process.env.SUPABASE_URL.replace(/\/rest\/v1\/?$/, '');
const H = { apikey: process.env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}` };
const _cache = new Map();
const rest = async (p) => { if (!_cache.has(p)) _cache.set(p, await (await fetch(`${BASE}/rest/v1/${p}`, { headers: H })).json()); return _cache.get(p); };

const fixture = JSON.parse(fs.readFileSync(path.join(REPO, 'test', 'golden', 'spider13-donbambus-current.json'), 'utf8'));
const probe = await buildBattle({ rest, fixture, repoRoot: REPO });
if (probe.skip) { console.log('skipped:', probe.skip); process.exit(0); }

const acc = {}; for (const t of CKPT) acc[t] = { n: 0, bossPct: 0, alive: 0, burn: 0, petr: 0, boss_deb: 0, exploded: 0, teamAliveSeeds: 0 };
let wins = 0, totTurns = 0;

for (let seed = 1; seed <= N; seed++) {
  const built = await buildBattle({ rest, fixture, repoRoot: REPO });
  applyBattleLayers(built.allies);
  const st = makeState({ allies: built.allies, enemies: [], seed });
  installRecipeRun(st);
  const snaps = {}; const orig = st.onTurnStart; const doneT = new Set();
  st.onTurnStart = (s, actor) => {
    orig?.(s, actor);
    for (const T of CKPT) if (!doneT.has(T) && s.turn >= T) {
      doneT.add(T);
      const boss = s.enemies.find(e => e.role === 'boss');
      const sp = s.enemies.filter(e => isSp(e.name) && e.alive);
      const teamAlive = s.allies.some(a => a.alive);
      snaps[T] = {
        bossPct: boss && boss.alive ? Math.round(100 * boss.hp / boss.maxHp) : (boss ? 0 : null),
        alive: sp.length,
        burn: sp.filter(e => (e.debuffs || []).some(d => d.type === 'HP Burn')).length,
        petr: sp.filter(e => (e.debuffs || []).some(d => d.type === 'Petrification')).length,
        boss_deb: (boss?.debuffs || []).length,
        teamAlive,
      };
    }
  };
  const res = simulate(st, built.content, { turnCap: 400 });
  if (res.won) wins++; totTurns += res.turns || 0;
  // cumulative Spiderlings exploded (killed by our damage) up to each checkpoint
  const kills = (res.log || []).filter(l => l.event === 'death' && isSp(l.who)).map(l => l.turn).sort((a, b) => a - b);
  for (const T of CKPT) {
    const s = snaps[T]; if (!s) continue;                 // seed never reached this turn (wiped earlier)
    const a = acc[T]; a.n++;
    a.bossPct += s.bossPct ?? 0; a.alive += s.alive; a.burn += s.burn; a.petr += s.petr; a.boss_deb += s.boss_deb;
    a.exploded += kills.filter(t => t <= T).length;
    if (s.teamAlive) a.teamAliveSeeds++;
  }
}

console.log(`\n═══ SIM "SCREENSHOTS" vs REALITY — Spider's Den 13  (${N} seeds) ═══`);
console.log(`  sim win rate ${(100 * wins / N).toFixed(0)}%  ·  avg fight ${Math.round(totTurns / N)}t (team wipes)   |   reality: WIN at t153`);
console.log(`\n  turn | source | boss HP% | spiders | BURNING | petrified | exploded(cum) | boss debuffs | seeds reached`);
console.log(`  ${'─'.repeat(104)}`);
const f = (x) => x.toFixed(1);
for (const T of CKPT) {
  const a = acc[T]; const r = REAL[T] || {};
  const reachPct = Math.round(100 * a.n / N);
  console.log(`  ${String(T).padStart(4)} | REAL   | ${String(r.bossPct + '%').padStart(7)} | ${String(r.alive).padStart(6)}  | ${String(r.burn).padStart(6)}  | ${String(r.petr).padStart(8)}  | ${'?'.padStart(11)}   | ${String(r.boss_deb).padStart(10)}   |`);
  if (a.n) console.log(`  ${String(T).padStart(4)} | SIM    | ${String(Math.round(a.bossPct / a.n) + '%').padStart(7)} | ${f(a.alive / a.n).padStart(6)}  | ${f(a.burn / a.n).padStart(6)}  | ${f(a.petr / a.n).padStart(8)}  | ${f(a.exploded / a.n).padStart(11)}   | ${f(a.boss_deb / a.n).padStart(10)}   | ${reachPct}% alive`);
  else console.log(`  ${String(T).padStart(4)} | SIM    |   — team already wiped in all seeds —`);
  console.log('');
}
console.log(`  Reads: BURNING = Spiderlings carrying [HP Burn] (each splashes ~3% boss MaxHP/tick). petrified = [Petrification].`);
console.log(`  exploded = Spiderlings killed by OUR damage so far (cumulative). "seeds reached" = % of sim runs still alive at that turn.`);
console.log(`\nQA_JSON ${JSON.stringify({ rung: 'sim-screenshots', seeds: N, winRate: +(100 * wins / N).toFixed(0),
  frames: CKPT.map(T => ({ turn: T, seedsReachedPct: Math.round(100 * acc[T].n / N),
    sim: acc[T].n ? { bossPct: Math.round(acc[T].bossPct / acc[T].n), alive: +f(acc[T].alive / acc[T].n), burning: +f(acc[T].burn / acc[T].n), petrified: +f(acc[T].petr / acc[T].n), explodedCum: +f(acc[T].exploded / acc[T].n), bossDebuffs: +f(acc[T].boss_deb / acc[T].n) } : null,
    reality: REAL[T] || null })) })}`);
