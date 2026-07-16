// tools/spider-solver.mjs — SPIDER'S DEN mechanic solver (third content solver, from the Skavag doc).
// Spider is a SINGLE continuous fight (NO waves) — the boss + endlessly-spawning Spiderlings. Two
// intertwined problems: (1) handle the Spiderlings (they poison-stack your team; Skavag CONSUMES
// them to heal + permanently gain ATK, so a dragged-out fight = she snowballs and wipes you), and
// (2) actually kill Skavag. The doc gives FIVE damage strategies, stage-tiered. Plus a hard STAT
// gate: you need ACC ~= stage x 11 (up to 225) to land your debuffs at all.
// Run: node tools/spider-solver.mjs
import fs from 'fs';

const env = {};
for (const l of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, ''); }
const BASE = (env.SUPABASE_URL || '').replace(/\/rest\/v1\/?$/, '');
const H = { apikey: env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}` };
const rest = async (p) => (await fetch(`${BASE}/rest/v1/${p}`, { headers: H })).json();

// Spiderling control — EVERY strategy needs one of these (kill them with AoE, CC them, or deny
// Skavag her turn so she can't consume/spawn). Boss is CC-immune; the Spiderlings are NOT.
const CONTROL = ['AoE Damage', 'Stun', 'AoE Stun', 'Freeze', 'AoE Freeze', 'Decrease Turn Meter', 'AoE Decrease Turn Meter'];
const STRATEGIES = [
  {
    key: 'A', name: 'AoE Nuke', tier: 'best 1-14',
    idea: 'AoE damage clears the Spiderlings before they act; Decrease DEF amplifies it.',
    roles: [{ role: 'AoE damage (clears Spiderlings)', anyTag: ['AoE Damage'], min: 2 }, { role: 'Decrease DEF (amplify)', anyTag: ['Decrease Defense'], min: 1 }],
  },
  {
    key: 'B', name: 'Enemy Max HP Nuke', tier: '15-20',
    idea: '%enemy-MAX-HP damage (Spiderlings/Skavag have too much HP for raw AoE); pair with Decrease DEF + Weaken.',
    roles: [{ role: '%Enemy MAX HP damage', anyTag: ['Enemy Max HP Damage'], min: 1 }, { role: 'Decrease DEF / Weaken', anyTag: ['Decrease Defense', 'Weaken'], min: 1 }, { role: 'Spiderling control', anyTag: CONTROL, min: 1 }],
  },
  {
    key: 'C', name: 'Poison Explosion', tier: '15-25',
    idea: 'Detonate stacked Poisons for %enemy-MAX-HP damage (ignores DEF). Needs AoE Poison + a detonator.',
    roles: [{ role: 'Poison appliers (stack them)', anyTag: ['Poison'], min: 2 }, { role: 'Spiderling control', anyTag: CONTROL, min: 1 }],
    caution: 'Needs a Poison-DETONATION champ (Karam/Zavia/Elenaril) — that capability is not tag-covered yet.',
  },
  {
    key: 'D', name: 'AoE HP Burn', tier: '15-25 (esp. 21+, where %MAX-HP is capped)',
    idea: 'HP Burn (a %MAX-HP DoT not capped like nukes at 21-25); Stun/Freeze the Spiderlings.',
    roles: [{ role: 'HP Burn', anyTag: ['HP Burn'], min: 1 }, { role: 'CC the Spiderlings', anyTag: ['Stun', 'AoE Stun', 'Freeze', 'AoE Freeze'], min: 1 }],
  },
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
const strategiesFor = (team) => STRATEGIES.filter(s => s.roles.every(r => fillers(team, r).length >= r.min)).map(s => s.key);

const dir = 'gestal-sync/output';
const snaps = fs.readdirSync(dir).filter(f => f.endsWith('.json') && !f.startsWith('gear-corpus')).map(f => JSON.parse(fs.readFileSync(`${dir}/${f}`, 'utf8')));

console.log("SPIDER'S DEN SOLVER — single fight (no waves). Strategies A=AoE Nuke, B=Max-HP, C=Poison-Explosion, D=HP-Burn.\n");
console.log('account'.padEnd(14) + 'roster can field   best-5 fields      verdict');
for (const snap of snaps.sort((a, b) => (a.displayName || '').localeCompare(b.displayName || ''))) {
  const roster = rosterOf(snap).sort((a, b) => b.dev - a.dev);
  const best5 = roster.slice(0, 5);
  const rS = strategiesFor(roster), bS = strategiesFor(best5);
  const verdict = bS.length ? 'best team already fields a strategy (lucky here)'
    : rS.length ? 'roster CAN, best-5 does NOT → APP VALUE (field the right team)'
    : 'roster fields no complete strategy → build';
  console.log((snap.displayName || '?').padEnd(14) + (rS.length ? rS.join(',') : 'NONE').padEnd(19) + (bS.length ? bS.join(',') : 'none').padEnd(18) + verdict);
}
console.log('\nSTAT GATE (all strategies, every stage): you must LAND your debuffs — need ACC >= stage x 11 (cap ~225),');
console.log('and RES >= stage-ACC + 100 (cap ~300) to resist Skavag. This is a per-team, per-stage check on effective');
console.log('stats (computable for Gestal rosters) — a fielded strategy still fails if its debuffers are under the ACC floor.');
console.log('NOTE: Poison-Explosion (C) also needs a poison-DETONATION champ — a capability not yet in the tag vocab.');
