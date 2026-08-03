// Turn-by-turn Spider-13 table (threshold mode, seed=null) with BOTH boss HP and per-hero team HP.
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
const REPO = 'C:/Users/in2ge/OneDrive/Desktop/RSL-coach/repo';
const imp = (rel) => import(pathToFileURL(path.join(REPO, rel)).href);
const { buildBattle, applyBattleLayers } = await imp('lib/sim/dragon-fixture.js');
const { makeState, simulate, setChanceMode } = await imp('lib/sim/engine.js');
const { installRecipeRun } = await imp('lib/sim/interpreter.js');

const BASE = process.env.SUPABASE_URL.replace(/\/rest\/v1\/?$/, '');
const H = { apikey: process.env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}` };
const _c = new Map();
const rest = async (p) => { if (!_c.has(p)) _c.set(p, await (await fetch(`${BASE}/rest/v1/${p}`, { headers: H })).json()); return _c.get(p); };

const fixture = JSON.parse(fs.readFileSync(path.join(REPO, 'test', 'golden', 'spider13-donbambus-current.json'), 'utf8'));
const built = await buildBattle({ rest, fixture, repoRoot: REPO });
applyBattleLayers(built.allies);
setChanceMode('threshold');
const st = makeState({ allies: built.allies, enemies: [], seed: null });
installRecipeRun(st);

const TEAM = built.allies.map(a => a.name);
const short = (n) => ({ 'Ezio Auditore': 'Ezio', 'Pelops the Victor': 'Pelops', 'Bambus Fourleaf': 'Bambus' }[n] || n);
const maxhp = Object.fromEntries(built.allies.map(a => [a.name, a.maxHp]));

let pendingSkill = null;
st.onAction = (state, c, skill) => { pendingSkill = `${skill.slot}${skill.skill_name ? ' ' + skill.skill_name : ''}`; };

const rows = [];
st.onTurn = (state, actor) => {
  const boss = state.enemies.find(e => e.role === 'boss');
  const bossHp = boss ? boss.hp : 0;
  const spiders = state.enemies.filter(e => e.role === 'add' && e.alive).length;
  const hp = built.allies.map(a => {
    const live = a.alive;
    const v = Math.max(0, Math.round(a.hp));
    return live ? (v >= 1000 ? (v / 1000).toFixed(1) + 'k' : String(v)) : 'DEAD';
  });
  let actorName = short(actor.name);
  let skill = '';
  if (actor.side === 'ally') { skill = pendingSkill || '-'; pendingSkill = null; }
  else if (actor.role === 'boss') { actorName = 'Skavag'; skill = '(boss turn)'; }
  else { actorName = actor.name.replace('Spiderling#', 'Sp'); skill = 'basic attack'; }
  rows.push({ t: state.turn, actor: actorName, skill, bossHp, spiders, hp });
};

const res = simulate(st, built.content, { turnCap: 400 });

// ── render ──
const hdrHeroes = built.allies.map(a => short(a.name).slice(0, 7).padStart(7)).join(' ');
const sep = '='.repeat(132);
const out = [];
out.push(`MODEL turn-by-turn — Spider-13 — threshold mode (>50% lands), seed=null — ${res.won ? 'WIN' : 'LOSS'} in ${res.turns}t`);
out.push(`team maxHP:  ${built.allies.map(a => short(a.name) + '=' + (a.maxHp / 1000).toFixed(1) + 'k').join('  ')}`);
out.push(sep);
out.push(`Turn | Actor  | Skill                          | bossHP | spdr | ${hdrHeroes}`);
out.push('-'.repeat(132));
for (const r of rows) {
  out.push(
    `${String(r.t).padStart(4)} | ${r.actor.slice(0, 6).padEnd(6)} | ${r.skill.slice(0, 30).padEnd(30)} | ` +
    `${(Math.round(r.bossHp / 1000) + 'k').padStart(6)} | ${String(r.spiders).padStart(4)} | ` +
    r.hp.map(h => h.padStart(7)).join(' ')
  );
}
const text = out.join('\n') + '\n';
fs.writeFileSync(path.join(REPO, 'knowledge', 'model_table_spider13.txt'), text);
console.log(out.slice(0, 55).join('\n'));
console.log('\n...(' + rows.length + ' rows total; full table written to knowledge/model_table_spider13.txt)');
console.log('RESULT:', res.won ? 'WIN' : 'LOSS', 'in', res.turns, 't');
