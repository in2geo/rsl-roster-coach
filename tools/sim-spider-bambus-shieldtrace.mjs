// tools/sim-spider-bambus-shieldtrace.mjs — TURN-BY-TURN forensic trace of how Bambus's shields get knocked to 0.
//
// Follows a SINGLE fight and prints, each turn: Bambus's three shield pools (Equipment / skill [Shield] /
// [Magma Shield]) + HP, the acting unit, and every hit that landed on Bambus that turn (attacker + HP damage +
// shield absorbed). Read DOWNWARD to watch the pools deplete; read BACKWARD from the first total=0 row to see
// which hits knocked each pool down and whether they refreshed. Observe-only (onTurnStart + onDamageTaken).
//
// Run: SEED=3 TURNS=1-40 node --env-file=.env.local tools/sim-spider-bambus-shieldtrace.mjs

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { makeState, simulate } from '../lib/sim/engine.js';
import { buildBattle, applyBattleLayers } from '../lib/sim/dragon-fixture.js';
import { installRecipeRun } from '../lib/sim/interpreter.js';
import { champKey } from '../lib/sim/recipes.js';

const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SEED = Number(process.env.SEED ?? 3);
const [T0, T1] = (process.env.TURNS ?? '1-45').split('-').map(Number);
if (!process.env.SUPABASE_URL) { console.log('needs the DB. Run with --env-file=.env.local'); process.exit(2); }
const BASE = process.env.SUPABASE_URL.replace(/\/rest\/v1\/?$/, '');
const H = { apikey: process.env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}` };
const _c = new Map();
const rest = async (p) => { if (!_c.has(p)) _c.set(p, await (await fetch(`${BASE}/rest/v1/${p}`, { headers: H })).json()); return _c.get(p); };

const poolByType = (c, re) => (c.buffs || []).reduce((s, b) => s + (re.test(b.type) ? Math.max(0, b.value || 0) : 0), 0);
const durOf = (c, re) => (c.buffs || []).filter((b) => re.test(b.type) && b.value > 0).map((b) => b.turnsLeft).join('/') || '-';
const shields = (c) => ({ equip: poolByType(c, /^Equipment Shield$/), skill: poolByType(c, /^Shield$/), magma: poolByType(c, /^Magma Shield$/),
  dur: `E${durOf(c, /^Equipment Shield$/)} S${durOf(c, /^Shield$/)} M${durOf(c, /^Magma Shield$/)}` });
const bF = (n) => String(Math.round(n)).padStart(6);

const fixture = JSON.parse(fs.readFileSync(path.join(REPO, 'test', 'golden', 'spider13-donbambus-current.json'), 'utf8'));
const built = await buildBattle({ rest, fixture, repoRoot: REPO });
if (built.skip) { console.log('skipped:', built.skip); process.exit(0); }
applyBattleLayers(built.allies);
const bambusKey = built.allies.map((a) => champKey(a.name)).find((k) => /bambus/i.test(k));
const bam = built.allies.find((a) => champKey(a.name) === bambusKey);

const st = makeState({ allies: built.allies, enemies: [], seed: SEED });
installRecipeRun(st);

const rows = [];              // one row per turn: { turn, actor, hp, sh, hits:[{atk,toHp,absorbedBefore}] }
const hitsThisTurn = [];
let lastShieldSnap = shields(bam);

const origTS = st.onTurnStart;
st.onTurnStart = (s, actor) => {
  origTS?.(s, actor);
  const sh = shields(bam);
  // detect a shield INCREASE since last turn (a placement/refresh) per pool
  const dEquip = sh.equip - lastShieldSnap.equip, dSkill = sh.skill - lastShieldSnap.skill, dMagma = sh.magma - lastShieldSnap.magma;
  const placed = [];
  if (dEquip > 1) placed.push(`+equip ${Math.round(dEquip)}`);
  if (dSkill > 1) placed.push(`+skill ${Math.round(dSkill)}`);
  if (dMagma > 1) placed.push(`+magma ${Math.round(dMagma)}`);
  rows.push({ turn: s.turn, round: s.round ?? 0, actor: (actor?.name || '').split(' ')[0], hp: Math.max(0, bam.hp), sh, placed, hits: hitsThisTurn.splice(0) });
  lastShieldSnap = sh;
};
st.onDamageTaken = (s, target, attacker, toHp) => {
  if (champKey(target.name) !== bambusKey) return;
  hitsThisTurn.push({ atk: (attacker?.name || '?').split('#')[0], toHp: Math.max(0, toHp || 0), shAfter: shields(bam) });
};

const res = simulate(st, built.content, { turnCap: 400 });

console.log(`\n═══ BAMBUS SHIELD FORENSICS — Spider's Den 13 · seed ${SEED} · turns ${T0}-${T1} ═══`);
console.log(`  ${res.won ? 'WIN' : 'LOSS'} in ${res.turns}t.  Bambus maxHP ${bam.maxHp}, DEF ${bam.def}.  Pools: Equipment / skill [Shield] / [Magma Shield]\n`);
console.log(`  turn rnd actor      bamHP   equip  skill  magma   TOTAL  durations(turnsLeft)  events`);
console.log(`  ${'─'.repeat(96)}`);
let firstZero = null;
for (const r of rows) {
  if (r.turn < T0 || r.turn > T1) continue;
  const total = r.sh.equip + r.sh.skill + r.sh.magma;
  if (firstZero == null && total <= 0 && r.hp > 0) firstZero = r.turn;
  const ev = [];
  if (r.placed.length) ev.push(r.placed.join(' '));
  for (const h of r.hits) ev.push(`◄ HIT by ${h.atk} (−${Math.round(h.toHp)} HP)`);
  const flag = total <= 0 ? ' ⚠0' : '';
  console.log(`  ${String(r.turn).padStart(4)} ${String(r.round).padStart(3)} ${r.actor.slice(0, 9).padEnd(10)}${bF(r.hp)}  ${bF(r.sh.equip)} ${bF(r.sh.skill)} ${bF(r.sh.magma)}  ${bF(total)}${flag}  ${r.sh.dur.padEnd(20)}  ${ev.join('  ')}`);
}
console.log(`\n  first turn Bambus reached 0 total shield (while alive): ${firstZero ?? 'n/a in window'}`);
console.log(`  ▶ Read backward from that row: which pool emptied first, what hit it, and did equip refresh at round start?`);
