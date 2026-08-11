// tools/sim-spider-tmrace.mjs — the CONSUME-vs-TICK Turn-Meter race (Spider-13 first-tick loss).
//
// Mike (2026-07-29): 81% of burns are consumed before their FIRST tick — a duration fix can't touch that; the
// suspect is spawned-Spiderling Turn Meter + where the spawn enters the scheduler relative to Skavag's TM.
// A Spiderling is burned ON its own turn, so it resets to TM 0 and must climb 0→100 to tick. Skavag (SPD 95)
// is mid-climb. At 150 vs 95 the Spiderling only out-races her if her TM was low enough when the burn landed:
// spider needs 100/150≈0.67 time-units; Skavag needs (100−TM)/95 — so Skavag reaches 100 first once TM ≳ 37.
//
// This uses the scheduler hook (engine.nextActor → state.onSchedule, full TM landscape at each pick) to record,
// per burn: Skavag's TM at burn-time, and — observed from the schedule stream — whether the Spiderling reaches
// its NEXT turn (tick) before Skavag's next CONSUME. No engine change; onSchedule/log/effects only.
//
// Run: node --env-file=.env.local tools/sim-spider-tmrace.mjs [N] [stage]

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { makeState, simulate, effectiveSpeed } from '../lib/sim/engine.js';
import { buildBattle, applyBattleLayers } from '../lib/sim/dragon-fixture.js';
import { installRecipeRun } from '../lib/sim/interpreter.js';

const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const N = Number(process.argv[2] || 20);
const STAGE = Number(process.argv[3] || 13);
const FIXTURE = 'spider13-donbambus-current.json';
const isSpiderling = (n) => /Spiderling/i.test(String(n));

if (!process.env.SUPABASE_URL) { console.log('needs the DB. Run with --env-file=.env.local'); process.exit(2); }
const BASE = process.env.SUPABASE_URL.replace(/\/rest\/v1\/?$/, '');
const H = { apikey: process.env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}` };
const _cache = new Map();
const rest = async (p) => { if (!_cache.has(p)) _cache.set(p, await (await fetch(`${BASE}/rest/v1/${p}`, { headers: H })).json()); return _cache.get(p); };

const fixture = JSON.parse(fs.readFileSync(path.join(REPO, 'test', 'golden', FIXTURE), 'utf8'));
const probe = await buildBattle({ rest, fixture, repoRoot: REPO });
if (probe.skip) { console.log('skipped:', probe.skip); process.exit(0); }

const median = (xs) => { if (!xs.length) return NaN; const s = [...xs].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const agg = { ticksFirst: [], consumeFirst: [], killedByUs: [], aliveAtEnd: [] };   // each holds Skavag-TM-at-burn
let totalBurns = 0, bossSpd = 0, spiderSpd = 0;

for (let seed = 1; seed <= N; seed++) {
  const built = await buildBattle({ rest, fixture, repoRoot: REPO });
  applyBattleLayers(built.allies);
  const st = makeState({ allies: built.allies, enemies: [], seed });
  installRecipeRun(st);

  // scheduler landscape at every pick: who acted this turn + Skavag's TM (pre-reset) at that instant
  const sched = new Map();   // turn -> { actor, role, bossTM }
  const prevOnSched = st.onSchedule;
  st.onSchedule = (state, actor, pool) => {
    prevOnSched?.(state, actor, pool);
    const boss = pool.find((c) => c.role === 'boss');
    sched.set(state.turn + 1, { actor: actor?.name, role: actor?.role, bossTM: boss ? boss.turnMeter : null });
    if (boss && !bossSpd) bossSpd = Math.round(effectiveSpeed(boss));
    if (actor?.role === 'add' && !spiderSpd) spiderSpd = Math.round(effectiveSpeed(actor));
  };

  const res = simulate(st, built.content, { turnCap: 400 });
  const log = res.log || [], fx = res.effects || [];

  // event streams
  const consumeTurns = log.filter((l) => /CONSUME/.test(String(l.event))).map((l) => l.turn).sort((a, b) => a - b);
  const deathTurn = new Map();
  for (const l of log) if (l.event === 'death' && isSpiderling(l.who)) deathTurn.set(l.who, l.turn);
  const burns = fx.filter((e) => e.kind === 'debuff' && e.subtype === 'HP Burn' && isSpiderling(e.target) && e.consumed !== false);
  // per-Spiderling ordered list of the turns it ACTED (for "my next turn")
  const actedTurns = new Map();
  for (const [t, s] of sched) if (s.role === 'add' && isSpiderling(s.actor)) { (actedTurns.get(s.actor) ?? actedTurns.set(s.actor, []).get(s.actor)).push(t); }
  for (const arr of actedTurns.values()) arr.sort((a, b) => a - b);

  for (const b of burns) {
    totalBurns++;
    const T = b.turn, X = b.target;
    const skTM = sched.get(T)?.bossTM ?? null;
    const myNext = (actedTurns.get(X) || []).find((t) => t > T) ?? null;       // this Spiderling's next turn = its tick chance
    const skNextConsume = consumeTurns.find((t) => t > T) ?? null;             // Skavag's next consume
    const myDeath = deathTurn.get(X) ?? null;
    let bucket;
    if (myNext != null) bucket = 'ticksFirst';                                 // it acted again → tickDots fired at least once (its tick beat the consume)
    else if (myDeath != null && (skNextConsume == null || myDeath <= skNextConsume)) bucket = 'killedByUs';   // our AoE drove hp<=0 before the next consume
    else if (skNextConsume != null) bucket = 'consumeFirst';                   // eaten by Skavag's consume before it could act (consume sets alive=false, emits no death event)
    else bucket = 'aliveAtEnd';                                               // no next turn / no death / no consume ahead → fight ended while burning
    agg[bucket].push(skTM);
  }
}

const per = (n) => (n / N).toFixed(1);
const pct = (n) => totalBurns ? (100 * n / totalBurns).toFixed(0) + '%' : '—';
const cnt = (k) => agg[k].length;
console.log(`\n═══ CONSUME-vs-TICK TURN-METER RACE — Spider's Den ${STAGE}  (${N} seeds) ═══`);
console.log(`  effective SPD: Spiderling ${spiderSpd}  ·  Skavag ${bossSpd}   →  a TM-0 Spiderling out-races her consume only if her TM ≲ ${Math.round(100 - 100 * bossSpd / spiderSpd)} at burn-time\n`);
console.log(`  BURN RACE OUTCOME (of ${totalBurns} burns over ${N} fights, ${per(totalBurns)}/fight):`);
console.log(`    reaches its TICK first ......... ${pct(cnt('ticksFirst'))}   (${per(cnt('ticksFirst'))}/fight)`);
console.log(`    CONSUMED before its tick ....... ${pct(cnt('consumeFirst'))}   (${per(cnt('consumeFirst'))}/fight)   ← the wall`);
console.log(`    killed by OUR AoE first ........ ${pct(cnt('killedByUs'))}   (${per(cnt('killedByUs'))}/fight)`);
console.log(`    still burning at fight end ..... ${pct(cnt('aliveAtEnd'))}`);
console.log(`\n  SKAVAG TURN-METER AT BURN-TIME (median):`);
console.log(`    burns that TICK first ...... ${median(agg.ticksFirst).toFixed(0)}   (she was far from acting)`);
console.log(`    burns CONSUMED first ....... ${median(agg.consumeFirst).toFixed(0)}   (she was close to acting)`);
console.log(`\n  ▶ If CONSUMED-first burns sit at HIGH Skavag TM and TICK-first at LOW, the loss is the TM race:`);
console.log(`    a Spiderling burned while Skavag is already charged cannot climb 0→100 before her consume.`);
console.log(`    Levers that would change it: spawn/rejoin TM > 0, or a [Decrease SPD] on Skavag (she is NOT immune).\n`);

console.log(`QA_JSON ${JSON.stringify({ rung: 'spider-tmrace', stage: STAGE, seeds: N, spiderSpd, bossSpd, totalBurns,
  ticksFirstPct: +pct(cnt('ticksFirst')).replace('%',''), consumeFirstPct: +pct(cnt('consumeFirst')).replace('%',''),
  killedByUsPct: +pct(cnt('killedByUs')).replace('%',''),
  skavagTM: { ticksFirst: +median(agg.ticksFirst).toFixed(0), consumeFirst: +median(agg.consumeFirst).toFixed(0) } })}`);
