// tools/ig-solver.mjs — ICE GOLEM MECHANIC SOLVER (the actual product piece).
// Not a power model. Answers the question that matters: "does this roster SOLVE Klyssus, which
// strategy, and what's missing?" — straight from the Klyssus design doc's three strategies.
//
// The three IG strategies (each a complete solution; the roster needs to field ONE):
//   A. BLOCK REVIVE   — kill the minions in one hit + Block Revive so they stay dead (no ACC needed).
//   B. POISON-RACE    — drop Klyssus with Poison/HP Burn (his passive does NOT trigger on DoT);
//                       AVOID big direct nukes (bursting the boss triggers Frigid Vengeance).
//   C. SUSTAIN + CC   — outlast Frigid Vengeance with AoE heal/revive/ally-protection while
//                       CC-locking the MINIONS (the boss is CC-immune).
// Run: node tools/ig-solver.mjs
import fs from 'fs';

const env = {};
for (const l of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, ''); }
const BASE = (env.SUPABASE_URL || '').replace(/\/rest\/v1\/?$/, '');
const H = { apikey: env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}` };
const rest = async (p) => (await fetch(`${BASE}/rest/v1/${p}`, { headers: H })).json();

// ── the Klyssus strategy specs (role-based, from the design doc) ───────────────────────────────
const STRATEGIES = [
  {
    key: 'A', name: 'Block Revive',
    idea: "Kill the minions in one hit and Block Revive so they stay dead (Block Revive needs no ACC).",
    roles: [
      { role: 'Block Revive source', anyTag: ['Block Revive'], min: 1 },
      { role: 'Burst minion-killer (one-shots minions)', anyTag: ['AoE Attack', 'Enemy Max HP Damage'], minMultiplier: 3.5, min: 1 },
    ],
  },
  {
    key: 'B', name: 'Poison-race',
    idea: "Drop Klyssus with Poison/HP Burn — his passive doesn't fire on DoT. Do NOT bring big direct nukers.",
    roles: [
      { role: 'Poison / HP Burn (2+ to stack)', anyTag: ['Poison', 'HP Burn'], min: 2 },
    ],
    caution: "Bursting the boss triggers Frigid Vengeance — keep the damage on DoT.",
  },
  {
    key: 'C', name: 'Sustain + minion-CC',
    idea: "Outlast Frigid Vengeance with heavy AoE heal/revive/ally-protection while CC-locking the MINIONS.",
    roles: [
      { role: 'AoE sustain (heal/revive/ally-protect)', anyTag: ['AoE Heal', 'Heal', 'Continuous Heal', 'Revive', 'Ally Protection', 'Healer'], min: 1 },
      { role: 'Minion CC (boss is CC-immune)', anyTag: ['Stun', 'Freeze', 'Provoke', 'Fear', 'True Fear', 'AoE Stun', 'AoE Freeze'], min: 1 },
      { role: 'Cleanse (minions apply Heal Reduction)', anyTag: ['Cleanse'], min: 1, optional: true },
    ],
  },
];

// ── champ catalog (tags + damage multiplier), keyed by type_id + name ──────────────────────────
const champs = await rest('champions?select=type_id,name,rarity,damage_multiplier:champion_skills(damage_multiplier),champion_tags(status,tags(name))&game_id=eq.raid_shadow_legends');
const byType = {}, byName = {};
for (const c of champs) {
  const tags = new Set((c.champion_tags ?? []).filter(ct => ct.status === 'approved').map(ct => ct.tags?.name).filter(Boolean));
  const mults = (c.damage_multiplier ?? []).flatMap(s => (String(s.damage_multiplier).match(/[0-9]+\.?[0-9]*/g) || []).map(Number));
  const rec = { name: c.name, tags, mult: mults.length ? Math.max(...mults) : 0 };
  if (c.type_id != null) byType[c.type_id] = rec;
  byName[c.name.toLowerCase()] = rec;
}
const IN_SCOPE = new Set(['Rare', 'Epic', 'Legendary', 'Mythical']);
const rosterOf = (snap) => {
  const r = [];
  for (const c of snap.champions ?? []) {
    if (!IN_SCOPE.has(c.rarity)) continue;
    const rec = byType[c.baseTypeId] ?? byName[c.name?.toLowerCase()];
    if (rec) r.push({ name: c.name, level: c.level, tags: rec.tags, mult: rec.mult });
  }
  return r;
};
const fillers = (roster, role) => roster.filter(c => [...role.anyTag].some(t => c.tags.has(t)) && (role.minMultiplier ? c.mult >= role.minMultiplier : true));
function evalRoster(roster) {
  const out = { fieldable: [], missing: {} };
  for (const s of STRATEGIES) {
    let ok = true;
    for (const role of s.roles) if (!role.optional && fillers(roster, role).length < role.min) { ok = false; (out.missing[s.key] ??= []).push(role.role); }
    if (ok) out.fieldable.push(s.key);
  }
  return out;
}

// ── run across ALL account snapshots — "which accounts can solve the puzzle?" ───────────────────
const dir = 'gestal-sync/output';
const snaps = fs.readdirSync(dir).filter(f => f.endsWith('.json') && !f.startsWith('gear-corpus')).map(f => JSON.parse(fs.readFileSync(`${dir}/${f}`, 'utf8')));
console.log('ICE GOLEM SOLVER — which accounts can field which strategy (A=BlockRev, B=Poison, C=Sustain+CC)\n');
console.log('account'.padEnd(14) + 'champs  can solve via        cannot (missing)');
for (const snap of snaps.sort((a, b) => (a.displayName || '').localeCompare(b.displayName || ''))) {
  const roster = rosterOf(snap);
  const { fieldable, missing } = evalRoster(roster);
  const can = fieldable.length ? fieldable.join(', ') : 'NONE';
  const cant = Object.keys(missing).filter(k => !fieldable.includes(k)).map(k => k).join(', ') || '—';
  console.log((snap.displayName || '?').padEnd(14) + String(roster.length).padStart(4) + '    ' + can.padEnd(20) + (cant === '—' ? '' : `missing ${cant}`));
}
console.log('\nFor the clean A/B test, use an account that can field a solving strategy AND enough champs for a');
console.log('brute (non-solving) team — then run BOTH at the same IG stage; the strategy team should clear where brute fails.');
