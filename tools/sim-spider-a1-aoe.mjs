// tools/sim-spider-a1-aoe.mjs — why does Bambus's A1 (Bamboo Splinter) stay single-target instead of AoE?
//
// A1 flips to ALL enemies when the picked target has >=2 debuffs (C_BAMBUS_AOE = target_debuff_count >= 2).
// The AoE slow is what would blanket the swarm with Decrease Speed (reality). This traces EACH A1 cast: the
// picked target (lowest-effHP enemy), its debuff count, whether it flipped to AoE, how many enemies actually
// took damage that turn (AoE detector), and how many Decrease-Speed debuffs landed. Also shows the swarm's
// debuff landscape so we can see whether the team is keeping spiderlings at 2+ debuffs at all.
//
// Run: SEED=3 node --env-file=.env.local tools/sim-spider-a1-aoe.mjs

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { makeState, simulate } from '../lib/sim/engine.js';
import { buildBattle, applyBattleLayers } from '../lib/sim/dragon-fixture.js';
import { installRecipeRun } from '../lib/sim/interpreter.js';
import { champKey } from '../lib/sim/recipes.js';

const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SEED = Number(process.env.SEED ?? 3);
if (!process.env.SUPABASE_URL) { console.log('needs the DB. Run with --env-file=.env.local'); process.exit(2); }
const BASE = process.env.SUPABASE_URL.replace(/\/rest\/v1\/?$/, '');
const H = { apikey: process.env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}` };
const _c = new Map();
const rest = async (p) => { if (!_c.has(p)) _c.set(p, await (await fetch(`${BASE}/rest/v1/${p}`, { headers: H })).json()); return _c.get(p); };

const shieldPool = (c) => (c.buffs || []).reduce((s, b) => s + (/Shield/.test(b.type) ? Math.max(0, b.value || 0) : 0), 0);
const debCount = (c) => (c.debuffs || []).length;

const fixture = JSON.parse(fs.readFileSync(path.join(REPO, 'test', 'golden', 'spider13-donbambus-current.json'), 'utf8'));
const built = await buildBattle({ rest, fixture, repoRoot: REPO });
if (built.skip) { console.log('skipped:', built.skip); process.exit(0); }
applyBattleLayers(built.allies);
const bambusKey = built.allies.map((a) => champKey(a.name)).find((k) => /bambus/i.test(k));
const st = makeState({ allies: built.allies, enemies: [], seed: SEED });
installRecipeRun(st);

const casts = [];
st.onAction = (s, actor, skill) => {
  if (champKey(actor.name) !== bambusKey) return;
  const slot = (skill?.slot || '').toString().match(/A[1-4]/)?.[0];
  if (slot !== 'A1') return;
  // predict the picked target = lowest effective HP enemy (chooseEnemyTarget), as the interpreter will do
  const enemies = (s.enemies || []).filter((e) => e.alive);
  const eff = (e) => Math.max(0, e.hp || 0) + shieldPool(e);
  const target = enemies.slice().sort((a, b) => eff(a) - eff(b))[0];
  const debCounts = enemies.map(debCount).sort((a, b) => b - a);
  casts.push({
    turn: s.turn, enemies: enemies.length,
    targetDebuffs: target ? debCount(target) : 0,
    predictAoe: target ? debCount(target) >= 2 : false,
    swarmDebuffHisto: debCounts,               // debuff counts across the swarm (how many have 2+?)
    enemiesWith2plus: debCounts.filter((n) => n >= 2).length,
  });
};

const res = simulate(st, built.content, { turnCap: 400 });

// join actual outcome per A1 turn from the ledger: distinct enemies Bambus damaged (AoE if >1) + Decrease-SPD lands
const dmgTargetsByTurn = {}, dspdByTurn = {};
for (const e of (res.effects || [])) {
  if (e.kind === 'damage' && champKey(e.source || '') === bambusKey) (dmgTargetsByTurn[e.turn] ??= new Set()).add(e.target);
  if (e.kind === 'debuff' && /Decrease Sp(ee|)d|Decrease SPD/i.test(e.subtype || '') && e.consumed) dspdByTurn[e.turn] = (dspdByTurn[e.turn] || 0) + 1;
}

console.log(`\n═══ BAMBUS A1 AoE TRIGGER — Spider-13 · seed ${SEED} ═══`);
console.log(`  ${res.won ? 'WIN' : 'LOSS'} in ${res.turns}t.  A1 flips to ALL enemies iff the picked target has >=2 debuffs.\n`);
console.log(`  turn  enemies  targetDebuffs  predict  enemiesHit  slowsLanded  swarmDebuffCounts`);
console.log(`  ${'─'.repeat(86)}`);
for (const c of casts) {
  const hit = (dmgTargetsByTurn[c.turn]?.size) || 0;
  const slows = dspdByTurn[c.turn] || 0;
  console.log(`  ${String(c.turn).padStart(4)}  ${String(c.enemies).padStart(6)}   ${String(c.targetDebuffs).padStart(11)}   ${(c.predictAoe ? 'AoE' : 'single').padEnd(7)}  ${String(hit).padStart(9)}  ${String(slows).padStart(11)}   [${c.swarmDebuffHisto.join(',')}]`);
}
const aoe = casts.filter((c) => c.predictAoe).length;
const avg2plus = (casts.reduce((s, c) => s + c.enemiesWith2plus, 0) / Math.max(1, casts.length)).toFixed(1);
console.log(`\n  A1 casts: ${casts.length}  ·  predicted AoE: ${aoe} (${Math.round(100 * aoe / Math.max(1, casts.length))}%)  ·  avg swarm w/ 2+ debuffs at cast: ${avg2plus} of ~10`);
console.log(`  ▶ If targetDebuffs is usually <2, the picked target (lowest-effHP) is a fresh/near-clean spiderling → A1 never AoEs → slow can't blanket the swarm.`);
