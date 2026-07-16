// tools/dragon-solver.mjs — DRAGON'S LAIR mechanic solver (fourth content solver, from Hellrazor doc).
// Structure like Fire Knight: 2 WAVES then the BOSS. The wave gate is survival (unmodeled — needs
// wave-enemy data, INS-0021). The BOSS gate is the Hellrazor mechanic:
//   • THE core: nuke hard enough to cancel the "purple bar" (Inhale) BEFORE Scorch stuns the team.
//   • The dragon actively CRIPPLES your damage with Decrease ATK (Swipe) → CLEANSE is critical, or
//     you can't clear the purple bar. He also stacks Poison + Weaken + Stun → cleanse + sustain + RES.
//   • You CAN'T slow him (immune to Decrease TM / Decrease SPD) → you speed up YOUR team instead.
// Run: node tools/dragon-solver.mjs
import fs from 'fs';

const env = {};
for (const l of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, ''); }
const BASE = (env.SUPABASE_URL || '').replace(/\/rest\/v1\/?$/, '');
const H = { apikey: env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}` };
const rest = async (p) => (await fetch(`${BASE}/rest/v1/${p}`, { headers: H })).json();

// BOSS gate — the Hellrazor comp. (WAVE gate = survival, not modeled — same as FK.)
const ROLES = [
  { role: 'Nukers to burst the purple bar (cancel Inhale before Scorch)', anyTag: ['AoE Damage', 'Enemy Max HP Damage'], min: 2 },
  { role: 'Cleanse (remove Decrease ATK / Poison / Weaken — CRITICAL)', anyTag: ['Cleanse'], min: 1 },
  { role: 'Decrease DEF (amplify the nukes)', anyTag: ['Decrease Defense'], min: 1 },
  { role: 'Sustain (outlast Poison/Weaken attrition)', anyTag: ['AoE Heal', 'Heal', 'Continuous Heal', 'Revive', 'Ally Protection', 'Healer'], min: 1 },
  { role: "Decrease Attack on boss (cut Hellrazor's nuke)", anyTag: ['Decrease Attack'], min: 1, optional: true },
  { role: 'Block Debuffs (pre-empt his debuffs)', anyTag: ['Block Debuffs'], min: 1, optional: true },
  { role: "Increase Speed (more turns — can't slow the dragon)", anyTag: ['Increase Speed', 'Increase Turn Meter'], min: 1, optional: true },
];

const champs = await rest('champions?select=type_id,name,rarity,role,champion_tags(status,tags(name))&game_id=eq.raid_shadow_legends');
const byType = {}, byName = {};
for (const c of champs) {
  const tags = new Set((c.champion_tags ?? []).filter(ct => ct.status === 'approved').map(ct => ct.tags?.name).filter(Boolean));
  const rec = { name: c.name, role: c.role, tags };
  if (c.type_id != null) byType[c.type_id] = rec; byName[c.name.toLowerCase()] = rec;
}
const RANK = { Mythical: 6, Legendary: 5, Epic: 4, Rare: 3, Uncommon: 2, Common: 1 };
const rosterOf = (snap) => {
  const seen = new Map();
  for (const c of snap.champions ?? []) {
    if (!RANK[c.rarity]) continue;
    const rec = byType[c.baseTypeId] ?? byName[c.name?.toLowerCase()] ?? { role: c.role, tags: new Set() };
    const dev = c.level * 1000 + (c.stars || 0) * 100 + (RANK[c.rarity] || 0) * 10 + (c.equippedArtifacts?.length || 0);
    const champ = { name: c.name, tags: rec.tags, dev };
    const prev = seen.get(c.name); if (!prev || champ.dev > prev.dev) seen.set(c.name, champ);
  }
  return [...seen.values()];
};
const fillers = (team, role) => team.filter(c => [...role.anyTag].some(t => c.tags.has(t)));
const bossPass = (team) => ROLES.filter(r => !r.optional).every(r => fillers(team, r).length >= r.min);
const missing = (team) => ROLES.filter(r => !r.optional && fillers(team, r).length < r.min).map(r => r.role.split(' ')[0]);

const dir = 'gestal-sync/output';
const snaps = fs.readdirSync(dir).filter(f => f.endsWith('.json') && !f.startsWith('gear-corpus')).map(f => JSON.parse(fs.readFileSync(`${dir}/${f}`, 'utf8')));

console.log("DRAGON'S LAIR SOLVER — BOSS gate (Hellrazor). WAVE gate (2 waves) = survival, not modeled (needs wave data).\n");
console.log('account'.padEnd(14) + 'roster solves boss?  best-5 solves boss?  verdict / roster gap');
for (const snap of snaps.sort((a, b) => (a.displayName || '').localeCompare(b.displayName || ''))) {
  const roster = rosterOf(snap).sort((a, b) => b.dev - a.dev);
  const best5 = roster.slice(0, 5);
  const rB = bossPass(roster), bB = bossPass(best5);
  const verdict = bB ? 'best team has the boss comp (lucky here)'
    : rB ? 'roster CAN, best-5 does NOT → APP VALUE'
    : `roster missing: ${missing(roster).join(', ')} → build`;
  console.log((snap.displayName || '?').padEnd(14) + (rB ? 'YES' : 'no ').padEnd(21) + (bB ? 'YES' : 'no ').padEnd(21) + verdict);
}
console.log('\nSTAT GATE: support needs RES ~= stage-ACC + 100 (~300 @ stage 20) to resist Stun/Poison/Weaken; team needs SPEED');
console.log('(the dragon is immune to Decrease TM/SPD — you speed up, not slow him). Computable per team/stage for Gestal.');
