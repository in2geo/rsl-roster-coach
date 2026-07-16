// tools/cb-solver.mjs — CLAN BOSS mechanic solver (5th solver — completes all content).
// CB is NOT a dungeon: no waves/stages, not solo-able, a single Demon Lord, and the objective is
// DAMAGE (chest tiers), not "clear". Two requirement tiers (from the doc):
//   • EASY/NORMAL/HARD — a beginner "Speed team": the debuff/buff kit + Warmaster/Giant Slayer on all 5.
//   • BRUTAL/NM/UNM — "Gathering Fury" ramps boss damage each turn → SURVIVAL is required (tanky /
//     Unkillable / Block Damage / Lifesteal), on top of the kit.
// The DAMAGE amount / chest tier is a separate model (lib/cb-damage-model.js). This solver answers:
// does the roster field a FUNCTIONAL CB comp — the kit + masteries — and can it survive Brutal+?
// Run: node tools/cb-solver.mjs
import fs from 'fs';

const env = {};
for (const l of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, ''); }
const BASE = (env.SUPABASE_URL || '').replace(/\/rest\/v1\/?$/, '');
const H = { apikey: env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}` };
const rest = async (p) => (await fetch(`${BASE}/rest/v1/${p}`, { headers: H })).json();

const WARMASTER = 500161, GIANT_SLAYER = 500162; // the CB damage masteries (lib/masteries.js)
// Beginner CB kit (Easy/Normal/Hard) — the debuff/buff package + speed + sustain.
const KIT = [
  { role: 'DoT damage (Poison / HP Burn — the CB damage engine)', anyTag: ['Poison', 'HP Burn'], min: 1 },
  { role: 'Decrease DEF (amplify)', anyTag: ['Decrease Defense'], min: 1 },
  { role: 'Decrease ATK (cut boss damage — survival)', anyTag: ['Decrease Attack'], min: 1 },
  { role: 'Speed (Increase SPD / TM — more turns)', anyTag: ['Increase Speed', 'Increase Turn Meter'], min: 1 },
  { role: 'Sustain (Heal / Continuous Heal / Shield / Ally Protection)', anyTag: ['Heal', 'Continuous Heal', 'AoE Heal', 'Shield', 'Ally Protection', 'Healer'], min: 1 },
];
// Brutal+ survival (Gathering Fury) — need one of these in addition to the kit.
const SURVIVAL = ['Unkillable', 'Block Damage', 'Ally Protection', 'AoE Heal', 'Continuous Heal', 'Counterattack'];

const champs = await rest('champions?select=type_id,name,rarity,champion_tags(status,tags(name))&game_id=eq.raid_shadow_legends');
const byType = {}, byName = {};
for (const c of champs) {
  const tags = new Set((c.champion_tags ?? []).filter(ct => ct.status === 'approved').map(ct => ct.tags?.name).filter(Boolean));
  const rec = { name: c.name, tags };
  if (c.type_id != null) byType[c.type_id] = rec; byName[c.name.toLowerCase()] = rec;
}
const RANK = { Mythical: 6, Legendary: 5, Epic: 4, Rare: 3 };
const rosterOf = (snap) => {
  const seen = new Map();
  for (const c of snap.champions ?? []) {
    if (!RANK[c.rarity]) continue;
    const rec = byType[c.baseTypeId] ?? byName[c.name?.toLowerCase()] ?? { tags: new Set() };
    const mastery = Array.isArray(c.masteryIds) && (c.masteryIds.includes(WARMASTER) || c.masteryIds.includes(GIANT_SLAYER));
    const dev = c.level * 1000 + (c.stars || 0) * 100 + (RANK[c.rarity] || 0) * 10;
    const champ = { name: c.name, tags: rec.tags, mastery, dev };
    const prev = seen.get(c.name); if (!prev || champ.dev > prev.dev) seen.set(c.name, champ);
  }
  return [...seen.values()];
};
const fillers = (team, tags) => team.filter(c => [...tags].some(t => c.tags.has(t)));
const kitOK = (team) => KIT.every(r => fillers(team, r.anyTag).length >= r.min);
const kitGaps = (team) => KIT.filter(r => fillers(team, r.anyTag).length < r.min).map(r => r.role.split(' ')[0]);

const dir = 'gestal-sync/output';
const snaps = fs.readdirSync(dir).filter(f => f.endsWith('.json') && !f.startsWith('gear-corpus')).map(f => JSON.parse(fs.readFileSync(`${dir}/${f}`, 'utf8')));

console.log('CLAN BOSS SOLVER — beginner kit + Warmaster/Giant Slayer masteries + Brutal+ survival.\n');
console.log('account'.padEnd(14) + 'kit?'.padEnd(6) + 'WM/GS champs'.padEnd(14) + 'Brutal+ survival?  verdict');
for (const snap of snaps.sort((a, b) => (a.displayName || '').localeCompare(b.displayName || ''))) {
  const roster = rosterOf(snap);
  const mastered = roster.filter(c => c.mastery).length;
  const kit = kitOK(roster);
  const survival = fillers(roster, SURVIVAL).length >= 2;
  const verdict = !kit ? `kit gaps: ${kitGaps(roster).join(', ')} → build`
    : mastered < 5 ? `has the kit, but only ${mastered}/5 WM/GS masteries → mastery the rest (the #1 CB gate)`
    : survival ? 'kit + masteries + survival → ready up to Brutal+ (damage/chest tier = cb-damage-model)'
    : 'kit + masteries, but thin survival → Easy/Normal/Hard OK; Brutal+ needs tanky/Unkillable';
  console.log((snap.displayName || '?').padEnd(14) + (kit ? 'YES' : 'no').padEnd(6) + String(mastered).padStart(3).padEnd(14) + (survival ? 'YES' : 'thin').padEnd(19) + verdict);
}
console.log('\nNOTE: CB is a DAMAGE race, not a clear — "kit + masteries" = a functional team; the chest tier per');
console.log('difficulty comes from lib/cb-damage-model.js. Warmaster/Giant Slayer on all 5 is the universal CB gate.');
