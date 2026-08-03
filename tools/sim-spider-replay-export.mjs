// Export a full Spider-13 battle as a turn-by-turn JSON log for the visual replay.
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
const REPO = 'C:/Users/in2ge/OneDrive/Desktop/RSL-coach/repo';
const imp = (rel) => import(pathToFileURL(path.join(REPO, rel)).href);
const { buildBattle, applyBattleLayers } = await imp('lib/sim/dragon-fixture.js');
const eng = await imp('lib/sim/engine.js');
const { makeState, simulate } = eng;
const { installRecipeRun } = await imp('lib/sim/interpreter.js');
// shieldPool isn't exported from engine.js — replicate it (sum every /Shield/ buff's .value)
const shieldPool = (c) => (c.buffs || []).reduce((s, b) => s + (/Shield/.test(b.type) ? Math.max(0, b.value || 0) : 0), 0);

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
const short = (n) => ({ 'Ezio Auditore': 'Ezio', 'Pelops the Victor': 'Pelops', 'Bambus Fourleaf': 'Bambus' }[n] || n);

const frames = [];
let skill = null, effLen = 0, logLen = 0;
st.onAction = (state, c, sk) => { skill = `${sk.slot}${sk.skill_name ? ' ' + sk.skill_name : ''}`; };
st.onTurn = (state, actor) => {
  const boss = state.enemies.find((e) => e.role === 'boss');
  const spiders = state.enemies.filter((e) => e.role === 'add' && e.alive);
  // events since last frame (damage/heal from effects, deaths/consume/spawn from log)
  const newEff = (state.effects || []).slice(effLen); effLen = (state.effects || []).length;
  const newLog = (state.log || []).slice(logLen); logLen = (state.log || []).length;
  const dmgToEnemies = newEff.filter((e) => (e.kind === 'damage' || e.kind === 'dot') && e.amount > 0 && built.allies.every((a) => a.name !== e.target))
    .reduce((s, e) => s + e.amount, 0);
  const consume = newLog.find((l) => l.event && String(l.event).startsWith('CONSUME'));
  frames.push({
    t: state.turn,
    actor: short(actor.name === boss?.name ? 'Skavag' : (actor.role === 'add' ? actor.name.replace('Spiderling#', 'Sp') : actor.name)),
    side: actor.side, isBoss: actor === boss, isAdd: actor.role === 'add',
    skill: actor.side === 'ally' ? (skill || '-') : (actor === boss ? '(boss turn)' : 'attack'),
    allies: built.allies.map((a) => ({
      name: short(a.name), hp: Math.max(0, Math.round(a.hp)), maxHp: Math.round(a.maxHp),
      shield: Math.round(shieldPool(a) || 0), alive: a.alive,
      debuffs: [...new Set((a.debuffs ?? []).map((d) => d.type))],
      buffs: [...new Set((a.buffs ?? []).map((b) => b.type))],
    })),
    boss: { hp: Math.max(0, Math.round(boss?.hp ?? 0)), maxHp: Math.round(boss?.maxHp ?? 1), tm: Math.round(boss?.turnMeter ?? 0),
            atk: Math.round(boss?.atk ?? 0), debuffs: [...new Set((boss?.debuffs ?? []).map((d) => d.type))] },
    swarm: { alive: spiders.length, slowed: spiders.filter((s) => (s.debuffs ?? []).some((d) => d.type === 'Decrease Speed')).length },
    dmgToBoss: Math.round(dmgToEnemies),
    consume: consume ? consume.event : null,
  });
  skill = null;
};
const res = simulate(st, built.content, { turnCap: 400 });

const out = {
  meta: { stage: "Spider's Den 13", seed: SEED, result: res.won ? 'VICTORY' : 'DEFEAT', turns: res.turns,
          survivors: (res.survivors || []).length, atk0: Math.round(built.content ? 0 : 0),
          allies: built.allies.map((a) => ({ name: short(a.name), maxHp: Math.round(a.maxHp), level: a.level })),
          bossMaxHp: Math.round(built.allies.length ? (frames[0]?.boss.maxHp ?? 0) : 0) },
  frames,
};
const outPath = path.join(REPO, 'knowledge', `spider13_replay_seed${SEED}.json`);
fs.writeFileSync(outPath, JSON.stringify(out));
console.log(`wrote ${frames.length} frames → ${outPath}  (${res.won ? 'VICTORY' : 'DEFEAT'} ${res.turns}t)`);
