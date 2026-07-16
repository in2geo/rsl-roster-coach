// tools/dungeon-model.mjs — run the mechanical-problem model (lib/dungeon-mechanics.js) against a
// roster: shows, per problem, the FULL breadth of champs that can contribute (the whole point — many
// ways, not a few champs), plus vocab-coverage (did we place every tag?) and, optionally, whether a
// specific fielded team is recognized.
//   node tools/dungeon-model.mjs <fire_knight|ice_golem> [AccountDisplayName=GuapoDonni]
import fs from 'fs';
import { MODELS, evaluateRoster, vocabCoverage } from '../lib/dungeon-mechanics.js';

const env = {};
for (const l of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, ''); }
const BASE = (env.SUPABASE_URL || '').replace(/\/rest\/v1\/?$/, '');
const H = { apikey: env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}` };
const rest = async (p) => (await fetch(`${BASE}/rest/v1/${p}`, { headers: H })).json();

const key = process.argv[2] || 'fire_knight';
const model = MODELS[key];
if (!model) { console.error(`unknown dungeon '${key}'. options: ${Object.keys(MODELS).join(', ')}`); process.exit(1); }
const want = process.argv[3] || 'GuapoDonni';

const VOCAB = new Set((await rest('tags?select=name')).map(t => t.name));
const champs = await rest('champions?select=type_id,name,rarity,champion_tags(status,tags(name))&game_id=eq.raid_shadow_legends');
const byType = {}, byName = {};
for (const c of champs) {
  const tags = new Set((c.champion_tags ?? []).filter(x => x.status === 'approved').map(x => x.tags?.name).filter(Boolean));
  const rec = { name: c.name, tags };
  if (c.type_id != null) byType[c.type_id] = rec; byName[c.name.toLowerCase()] = rec;
}
const dir = 'gestal-sync/output';
const file = fs.readdirSync(dir).find(f => f.includes(want) && f.endsWith('.json') && !f.startsWith('gear-corpus'));
const snap = JSON.parse(fs.readFileSync(`${dir}/${file}`, 'utf8'));
const RANK = { Mythical: 6, Legendary: 5, Epic: 4, Rare: 3 };
const seen = new Map();
for (const c of snap.champions ?? []) {
  if (!RANK[c.rarity]) continue;
  const rec = byType[c.baseTypeId] ?? byName[c.name?.toLowerCase()] ?? { tags: new Set() };
  const dev = c.level * 1000 + (c.stars || 0) * 100 + (RANK[c.rarity] || 0) * 10;
  const champ = { name: c.name, tags: rec.tags, dev };
  const prev = seen.get(c.name); if (!prev || champ.dev > prev.dev) seen.set(c.name, champ);
}
const roster = [...seen.values()];

const cov = vocabCoverage(model, VOCAB);
const ev = evaluateRoster(model, roster);
console.log(`\n${'='.repeat(96)}\n${model.name.toUpperCase()} — mechanical-problem model  ·  ${snap.displayName} (${roster.length} Rare+ champs)\n${'='.repeat(96)}`);
console.log(model.boss + '\n');
console.log(`Vocab coverage: ${cov.placed}/${cov.total} tags placed.` + (cov.ghosts.length ? `  ⚠ NOT-A-TAG: ${cov.ghosts.join(', ')}` : ''));
console.log(`Deliberately unplaced${model.open?.length ? ` (open, review): ${model.open.join(', ')}` : ''}${cov.unplaced.filter(t => !(model.open || []).includes(t)).length ? `  |  UNPLACED: ${cov.unplaced.filter(t => !(model.open || []).includes(t)).join(', ')}` : ''}\n`);
for (const p of ev.problems) {
  console.log(`■ ${p.name}${p.meta ? '  ★META' : ''}  →  ${p.fillers.length} champs can contribute`);
  console.log(`   ${p.why}`);
  for (const e of model.exemplars?.[p.key] || []) console.log(`   ★ cheat code: ${e.champ} [${e.rarity}] — ${e.caveat}`);
  for (const n of p.notes || []) console.log(`   ⚠ ${n}`);
  console.log(`   e.g. ${p.fillers.slice(0, 12).map(c => c.name).join(', ')}${p.fillers.length > 12 ? ` … +${p.fillers.length - 12}` : ''}\n`);
}
console.log(`amplifiers present: ${Object.entries(ev.amplifiers).map(([k, n]) => `${k}=${n}`).join('  ·  ')}`);
if (model.statGate) console.log(`STAT GATE: ${model.statGate}`);
console.log(`\nProblems covered: ${ev.covered.join(', ')}  |  UNCOVERED: ${ev.uncovered.join(', ') || '(none)'}`);
if (model.review?.length) console.log(`\nREVIEW (Mike):\n  - ${model.review.join('\n  - ')}`);

// optional: recognize a specific fielded team (resolve by type_id first, then name/alias)
const TEAM = process.env.TEAM ? process.env.TEAM.split(',').map(s => s.trim()) : null;
if (TEAM) {
  console.log(`\nFielded team check: ${TEAM.join(', ')}`);
  const covered = new Set();
  for (const n of TEAM) {
    const rec = byName[n.toLowerCase()] || { tags: new Set() };
    const roles = ev.problems.filter(p => p.tags.some(t => rec.tags.has(t))).map(p => p.key);
    for (const r of roles) covered.add(r);
    console.log(`  ${n.padEnd(22)} → ${roles.join(', ') || '(unresolved or no matching ability)'}`);
  }
  console.log(`  team covers: ${[...covered].join(', ')}  |  uncovered: ${ev.problems.filter(p => !covered.has(p.key)).map(p => p.key).join(', ') || '(none — recognized)'}`);
}
