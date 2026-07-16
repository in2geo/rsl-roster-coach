// tools/assemble-team.mjs — the SELECTION layer in action: assemble a 5-seat team by ROLE for a
// dungeon, then (given a battle result) diagnose the short role and propose a constraint-preserving fix.
//   node tools/assemble-team.mjs fire_knight GuapoDonni [--result loss-waves|loss-boss|grind]
import fs from 'fs';
import { assembleTeam, fixTeam, diagnoseShortRole } from '../lib/team-assembler.js';

const env = {};
for (const l of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, ''); }
const BASE = (env.SUPABASE_URL || '').replace(/\/rest\/v1\/?$/, '');
const H = { apikey: env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}` };
async function all(p) { const o = []; let f = 0; for (;;) { const r = await (await fetch(`${BASE}/rest/v1/${p}`, { headers: { ...H, Range: `${f}-${f + 999}` } })).json(); if (!Array.isArray(r) || !r.length) break; o.push(...r); if (r.length < 1000) break; f += 1000; } return o; }

// ── Fire Knight SEAT roles (span waves + boss; TM-LOCK & SURVIVE both present as separate seats). ──
// Capabilities are approved tags PLUS 'Multi-Hit' derived from skill text (the backfill is still proposed).
const ROLE_DEFS = {
  WAVE:    { label: 'Clear the 2 waves',      tags: ['AoE Damage', 'Enemy Max HP Damage'] },
  SHIELD:  { label: 'Break the Divine Shield', tags: ['Multi-Hit', 'Counterattack', 'Reflect Damage', 'Ally Attack'] },
  TMLOCK:  { label: "Lock Fyro's Turn Meter",  tags: ['Decrease Turn Meter', 'AoE Decrease Turn Meter', 'AoE Decrease Turn Meter (Resistible)'] },
  SURVIVE: { label: 'Keep the team alive',     tags: ['AoE Heal', 'Continuous Heal', 'Healer', 'Shield', 'Unkillable', 'Block Damage', 'Ally Protection', 'Revive'] },
  DAMAGE:  { label: 'Kill Fyro (burst + post-shield DoT)', tags: ['AoE Damage', 'Single Target Damage', 'Enemy Max HP Damage', 'Poison', 'HP Burn', 'Poison Explosion'] },
};
const ORDER = ['WAVE', 'SHIELD', 'TMLOCK', 'SURVIVE', 'DAMAGE'];

const want = process.argv[3] || 'GuapoDonni';
const resultArg = (process.argv.find(a => a.startsWith('--result=')) || '').split('=')[1]
  || (process.argv.includes('--result') ? process.argv[process.argv.indexOf('--result') + 1] : null);

// ── load champ capabilities (approved tags + skill-text multi-hit) ──
const champs = await all('champions?select=type_id,name,rarity,champion_tags(status,tags(name)),champion_skills(slot,skill_summary)&game_id=eq.raid_shadow_legends');
const w2n = { two: 2, three: 3, four: 4 };
const isMultiHit = (skills) => skills.some(s => {
  const re = /attacks?\s+(?:1|an?|the target|the enemy)?\s*(?:enemy\s+)?(2|3|4|two|three|four)\s+times|attacks\s+(2|3|4|two|three|four)\s+times|attacks all enemies\s+(2|3|4|two|three|four)\s+times/i;
  return re.test(s.skill_summary || '');
});
const capsByName = {}, capsByType = {};
for (const c of champs) {
  const caps = new Set((c.champion_tags ?? []).filter(t => t.status === 'approved').map(t => t.tags?.name).filter(Boolean));
  if (isMultiHit(c.champion_skills || [])) caps.add('Multi-Hit');
  capsByName[c.name.toLowerCase()] = caps;
  if (c.type_id != null) capsByType[c.type_id] = caps;
}

// ── build the account roster (owned Rare+, with dev score) ──
const dir = 'gestal-sync/output';
const file = fs.readdirSync(dir).find(f => f.includes(want) && f.endsWith('.json') && !f.startsWith('gear-corpus'));
const snap = JSON.parse(fs.readFileSync(`${dir}/${file}`, 'utf8'));

// IDENTITY RESOLVER. Captures/snapshots use the FULL typeId (base+ascension) and IN-GAME names; the DB
// keys on base type_id and short names. Bridge the ascension offset via this account's snapshot, and
// fall back to a name-prefix match (e.g. "Neldor Rimeblade" → DB "Neldor", whose type_id is null).
const baseOfTypeId = {};
for (const c of snap.champions ?? []) if (c.typeId != null && c.baseTypeId != null) baseOfTypeId[c.typeId] = c.baseTypeId;
const dbNames = Object.keys(capsByName);
const prefixCaps = (nm) => { const l = (nm || '').toLowerCase(); const hit = dbNames.find(d => l === d || l.startsWith(d + ' ')); return hit ? capsByName[hit] : null; };
const capsOf = ({ typeId, baseTypeId, name }) => {
  const base = baseOfTypeId[typeId] ?? baseTypeId ?? typeId;
  return capsByType[base] ?? capsByType[typeId] ?? capsByName[(name || '').toLowerCase()] ?? prefixCaps(name) ?? null;
};
const RANK = { Mythical: 6, Legendary: 5, Epic: 4, Rare: 3 };
const seen = new Map();
for (const c of snap.champions ?? []) {
  if (!RANK[c.rarity]) continue;
  const caps = capsOf({ baseTypeId: c.baseTypeId, name: c.name }); if (!caps) continue;
  const dev = c.level * 1000 + (c.stars || 0) * 100 + (RANK[c.rarity] || 0) * 10;
  const champ = { name: c.name, caps, dev };
  const prev = seen.get(c.name); if (!prev || champ.dev > prev.dev) seen.set(c.name, champ);
}
const roster = [...seen.values()];

// ── ASSEMBLE ──
const { team, gaps } = assembleTeam(roster, ROLE_DEFS, ORDER);
console.log(`\nFIRE KNIGHT — team for ${snap.displayName} (${roster.length} Rare+ champs)\n${'='.repeat(72)}`);
for (const s of team) {
  if (s.depth) {
    console.log(`  ${s.name.padEnd(22)} → LUXURY seat — reinforces: ${s.roles.map(r => r.toLowerCase()).join(', ')}`);
  } else {
    console.log(`  ${s.name.padEnd(22)} → ${ROLE_DEFS[s.primary]?.label || s.primary}`);
    if (s.bonus.length) console.log(`  ${' '.repeat(22)}   also helps: ${s.bonus.map(r => r.toLowerCase()).join(', ')}`);
  }
}
const primaries = team.filter(s => !s.depth).length;
console.log(`\n  roles covered: ${ORDER.filter(r => !gaps.includes(r)).join(', ')}  (${primaries} champs fill all ${ORDER.length} roles → ${5 - primaries} luxury seat${5 - primaries === 1 ? '' : 's'} free)`);
if (gaps.length) console.log(`  ⚠ GAPS (no champ fills these — BUILD guidance): ${gaps.map(r => ROLE_DEFS[r].label).join(' · ')}`);

// ── CLOSE THE LOOP ON A REAL CAPTURE (--capture) ──
const rolesOf = (hero) => { const caps = capsOf(hero) || new Set(); return ORDER.filter(r => ROLE_DEFS[r].tags.some(t => caps.has(t))); };
if (process.argv.includes('--capture')) {
  const log = JSON.parse(fs.readFileSync('gestal-sync/RslBattleReader/output/battle-log.json', 'utf8'));
  const fk = log.filter(e => (e.displayName === snap.displayName) && /fire knight/i.test(e.dungeon || e.stage || ''));
  if (!fk.length) { console.log(`\n(no real Fire Knight capture for ${snap.displayName} in battle-log.json)`); process.exit(0); }
  const cap = fk[fk.length - 1]; // latest
  const heroes = cap.heroes || [];
  const heroSum = heroes.reduce((a, h) => a + (h.damage || 0), 0);
  console.log(`\n${'-'.repeat(72)}\nREAL CAPTURE — ${cap.stage} · ${cap.result} · ${cap.turns} turns · ${cap.durationSeconds}s · auto=${cap.manualSkillUsed === false}`);
  console.log(`  fielded (${heroes.length}${heroes.length < 5 ? ' — INCOMPLETE capture, a hero is missing' : ''}): ${heroes.map(h => h.name).join(', ')}${cap.totalDamageDealt && heroSum < cap.totalDamageDealt * 0.9 ? `  [note: per-hero damage sums to ${Math.round(100 * heroSum / cap.totalDamageDealt)}% of total — CaptureDungeon damage under-read, separate issue]` : ''}`);
  for (const h of heroes) console.log(`     ${h.name.padEnd(22)} ${rolesOf(h).join(', ') || '(no mapped role)'}${h.survived === false ? '  ☠ DIED' : ''}`);
  // dead-seat: a hero who died and was the SOLE provider of a role
  let deadSeatRole = null;
  for (const h of heroes.filter(h => h.survived === false)) {
    const mine = rolesOf(h); const others = new Set(heroes.filter(x => x.name !== h.name).flatMap(x => rolesOf(x)));
    const sole = mine.find(r => !others.has(r)); if (sole) deadSeatRole = sole;
  }
  const dx = diagnoseShortRole(cap, { deadSeatRole });
  console.log(`\n  DIAGNOSIS: ${dx?.why || 'no signal'}`);
  const target = dx?.role || dx?.slowest;
  if (!target) { console.log('  → no change needed.'); process.exit(0); }
  const swaps = fixTeam(heroes.map(h => ({ name: h.name, caps: capsOf(h) || new Set() })), target, roster, ROLE_DEFS, ORDER);
  const label = dx.role ? `reinforce ${target}` : `upgrade the ${target} seat (to clear faster)`;
  if (!swaps.length) console.log(`  → ${label}: no constraint-preserving swap in the roster → BUILD gap.`);
  else console.log(`  → ${label}: swap OUT ${swaps[0].out} → IN ${swaps[0].in} (brings ${swaps[0].inRoles.join('/')}, all roles preserved; ${swaps.length} valid options).`);
  process.exit(0);
}

// ── DIAGNOSE + CONSTRAINED FIX (given a synthetic result) ──
const RESULTS = {
  'loss-waves': { result: 'Defeat', stage: 'Fire Knight wave 2', finishCause: 'wave', turns: 8 },
  'loss-boss':  { result: 'Defeat', stage: 'Fire Knight Stage 16', finishCause: 'Unknown', turns: 20 },
  'grind':      { result: 'Victory', stage: 'Fire Knight Stage 16', finishCause: 'Unknown', turns: 105 },
};
if (resultArg && RESULTS[resultArg]) {
  const cap = RESULTS[resultArg];
  const dx = diagnoseShortRole(cap);
  console.log(`\n${'-'.repeat(72)}\nRESULT: ${cap.result} (${resultArg}) → diagnose`);
  if (!dx) { console.log('  clean win within budget — no change needed.'); }
  else {
    console.log(`  DIAGNOSIS: short role = ${dx.role} — ${dx.why}`);
    const swaps = fixTeam(team.map(s => ({ name: s.name, caps: capsByName[s.name.toLowerCase()] })), dx.role, roster, ROLE_DEFS, ORDER);
    if (!swaps.length) console.log(`  no constraint-preserving swap found — likely a BUILD gap (roster can't reinforce ${dx.role} without dropping a role).`);
    else {
      const best = swaps[0];
      console.log(`  CONSTRAINED FIX: swap OUT ${best.out} → IN ${best.in}`);
      console.log(`     ${best.in} brings [${best.inRoles.join(', ')}]; every currently-covered role is preserved${best.drops.length ? ` (note: ${best.out} was the only ${best.drops.join('/')} — covered by the incoming or another seat)` : ''}.`);
      console.log(`     (${swaps.length} valid constraint-preserving swaps found; showing the best by quality.)`);
    }
  }
}
