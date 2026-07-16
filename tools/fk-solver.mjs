// tools/fk-solver.mjs — FIRE KNIGHT mechanic solver (second content solver, from the Fyro doc).
// Fyro's mechanic is a DIVINE SHIELD (5/7/10/12 hits to break by stage) that must be broken EVERY
// turn BEFORE Fyro acts — or he heals + AoEs your team's MAX HP down (one-shots squishies). So FK is
// gated by HIT COUNT, not damage type: you need enough MULTI-HIT attacks per turn, moving before him.
// Unlike Ice Golem's three alternative strategies, FK has ONE method with required components.
//
// Per account, answers: can the roster field the shield-break comp, and does its BEST-5 solve it (or
// did the player just get unlucky here)? Run: node tools/fk-solver.mjs
import fs from 'fs';

const env = {};
for (const l of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, ''); }
const BASE = (env.SUPABASE_URL || '').replace(/\/rest\/v1\/?$/, '');
const H = { apikey: env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}` };
const rest = async (p) => (await fetch(`${BASE}/rest/v1/${p}`, { headers: H })).json();

// TWO gates in sequence — a team must pass BOTH to clear a Fire Knight stage.
// WAVE gate = clear the 2 waves first (the wall for weaker accounts; TicoTholin died here, never
// reaching Fyro). BOSS gate = the shield-break comp (the wall for developed accounts).
// CAVEAT: the wave gate's SURVIVAL half is a STAT check (can the team's bulk survive the wave AoE),
// which needs per-stage wave-enemy data we don't have (INS-0021 gap). The tags below check the
// TOOLS for the waves (AoE clear + sustain + CC); surviving them at a given stage is the stat side.
// NOTE: the WAVE gate is NOT modeled here. Clearing the 2 waves is primarily a SURVIVAL check —
// can the team's bulk survive the wave AoE and kill the wave enemies fast — which is STATS, not
// tags (a tag-based wave gate flips between always-fail and always-pass; neither is real). It needs
// per-stage wave-enemy difficulty data we don't have (INS-0021). Weak accounts wall HERE, before the
// boss. This solver evaluates only the BOSS gate (the mechanic). The wave gate is a separate,
// stat-based check pending wave-enemy stats.
const ROLES = [
  // ── BOSS gate (Fyro shield-break) — the mechanic ──
  { gate: 'BOSS', role: 'Multi-hit A1 shield-breakers (~10 hits/turn — THE core)', anyTag: ['Multi-Hit A1'], min: 3 },
  { gate: 'BOSS', role: 'Speed / Turn-Meter support (act before Fyro)', anyTag: ['Increase Speed', 'Increase Turn Meter'], min: 1 },
  { gate: 'BOSS', role: 'Minion CC (Fyro is CC-immune; lock the minions)', anyTag: ['Stun', 'AoE Stun', 'Freeze', 'AoE Freeze', 'Sleep', 'AoE Sleep'], min: 1 },
  { gate: 'BOSS', role: 'Counterattack / Reflect (bonus shield hits)', anyTag: ['Counterattack', 'Reflect Damage'], min: 1, optional: true },
  { gate: 'BOSS', role: "Decrease Turn Meter (delay Fyro's shield turn)", anyTag: ['Decrease Turn Meter', 'AoE Decrease Turn Meter', 'AoE Decrease Turn Meter (Resistible)'], min: 1, optional: true },
  { gate: 'BOSS', role: 'Block Cooldowns (vs minion one-shots)', anyTag: ['Block Cooldowns'], min: 1, optional: true },
];

const champs = await rest('champions?select=type_id,name,rarity,role,champion_tags(status,tags(name))&game_id=eq.raid_shadow_legends');
const byType = {}, byName = {};
for (const c of champs) {
  const tags = new Set((c.champion_tags ?? []).filter(ct => ct.status === 'approved').map(ct => ct.tags?.name).filter(Boolean));
  const rec = { name: c.name, role: c.role, tags };
  if (c.type_id != null) byType[c.type_id] = rec;
  byName[c.name.toLowerCase()] = rec;
}
const RANK = { Mythical: 6, Legendary: 5, Epic: 4, Rare: 3, Uncommon: 2, Common: 1 };
const rosterOf = (snap) => {
  const seen = new Map();
  for (const c of snap.champions ?? []) {
    if (!RANK[c.rarity]) continue;
    const rec = byType[c.baseTypeId] ?? byName[c.name?.toLowerCase()] ?? { role: c.role, tags: new Set() };
    const dev = c.level * 1000 + (c.stars || 0) * 100 + (RANK[c.rarity] || 0) * 10 + (c.equippedArtifacts?.length || 0);
    const champ = { name: c.name, level: c.level, rarity: c.rarity, tags: rec.tags, dev };
    const prev = seen.get(c.name); if (!prev || champ.dev > prev.dev) seen.set(c.name, champ);
  }
  return [...seen.values()];
};
const fillers = (team, role) => team.filter(c => [...role.anyTag].some(t => c.tags.has(t)));
const gatePass = (team, gate) => ROLES.filter(r => !r.optional && r.gate === gate).every(r => fillers(team, r).length >= r.min);

const dir = 'gestal-sync/output';
const snaps = fs.readdirSync(dir).filter(f => f.endsWith('.json') && !f.startsWith('gear-corpus')).map(f => JSON.parse(fs.readFileSync(`${dir}/${f}`, 'utf8')));

console.log('FIRE KNIGHT SOLVER — BOSS gate only (the shield-break mechanic).');
console.log('The WAVE gate (survive + clear the 2 waves) is a SEPARATE survival/stat check, not modeled');
console.log('here — it needs per-stage wave-enemy data (INS-0021). Weak accounts often wall at the waves FIRST.\n');
console.log('account'.padEnd(14) + 'roster solves boss?  best-5 solves boss?  verdict');
for (const snap of snaps.sort((a, b) => (a.displayName || '').localeCompare(b.displayName || ''))) {
  const roster = rosterOf(snap).sort((a, b) => b.dev - a.dev);
  const best5 = roster.slice(0, 5);
  const rB = gatePass(roster, 'BOSS'), bB = gatePass(best5, 'BOSS');
  const verdict = bB ? 'best team has the boss comp (lucky here)'
    : rB ? 'roster CAN field the boss comp, best-5 does NOT → APP VALUE'
    : 'roster lacks the boss comp → build (see multi-hit gap below)';
  console.log((snap.displayName || '?').padEnd(14) + (rB ? 'YES' : 'no ').padEnd(21) + (bB ? 'YES' : 'no ').padEnd(21) + verdict);
}

// detail: what the multi-hit shield-break requirement looks like per account (the FK-defining gap)
console.log('\nThe defining FK gap — Multi-Hit A1 shield-breakers available (need 3+):');
for (const snap of snaps.sort((a, b) => (a.displayName || '').localeCompare(b.displayName || ''))) {
  const roster = rosterOf(snap);
  const mh = roster.filter(c => c.tags.has('Multi-Hit A1'));
  console.log(`  ${(snap.displayName || '?').padEnd(14)} ${mh.length} multi-hit champ(s)${mh.length ? ': ' + mh.slice(0, 6).map(c => c.name).join(', ') : '  *** none — cannot break the shield ***'}`);
}
