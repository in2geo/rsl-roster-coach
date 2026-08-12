// tools/recipe-authoring-fetch.mjs — STEP B.1 of the recipe-authoring loop (see
// knowledge/RECIPE_AUTHORING_RUNBOOK.md). Finds champions that HAVE DB skills but NO sim recipe,
// ranks them by how often they appear in captured battles, and writes their verbatim skills + base
// stats to a JSON file the authoring agents read. Also prints the CURRENT implemented-op vocabulary.
//
// Names are resolved to canonical champions.id via champKey + champion_aliases (NEVER by raw name —
// CLAUDE.md naming rule), so name variants (e.g. "Hilve the Rime-called" -> Hilvi) don't create
// phantom "recipe-less" entries or collide with an already-authored champion.
//
// Usage (needs Supabase creds):
//   node --env-file=.env.local tools/recipe-authoring-fetch.mjs [--count 12] [--out ./recipe-authoring-batch.json]
//                                                               [--names "Champ A,Champ B"] [--all-rareplus]
//   --count N       how many recipe-less corpus champions to fetch (default 12)
//   --names "..."   author these SPECIFIC champions instead of the frequency ranking
//   --all-rareplus  rank by the whole Rare+ roster, not just champions seen in captured battles
//   --out PATH      where to write the champion data (default ./recipe-authoring-batch.json — the
//                   path the named `recipe-authoring` workflow reads)
import fs from 'fs';
import { RECIPES, champKey } from '../lib/sim/recipes.js';
import { OPERATIONS } from '../lib/sim/operations.js';

const arg = (k, d) => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : d; };
const has = (k) => process.argv.includes(k);
const COUNT = parseInt(arg('--count', '12'), 10);
const OUT = arg('--out', './recipe-authoring-batch.json');
const NAMES = arg('--names', null);
const ALL_RAREPLUS = has('--all-rareplus');

const BASE = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/rest\/v1\/?$/, '');
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!BASE || !KEY) { console.error('Missing SUPABASE_URL / key in env. Run with --env-file=.env.local'); process.exit(1); }
const H = { apikey: KEY, Authorization: `Bearer ${KEY}` };
const rest = async (p) => (await fetch(`${BASE}/rest/v1/${p}`, { headers: H })).json();
const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');

const SKILL_SEL = 'champion_skills(slot,skill_name,skill_summary,cooldown_base,damage_multiplier,multiplier_type)';
const CH_SEL = `id,name,affinity,rarity,role,faction,base_hp,base_atk,base_def,base_spd,base_res,base_acc,base_crit_rate,base_crit_dmg,${SKILL_SEL}`;

// full champion table (paged) + aliases → name→id resolver
const champs = [];
for (let o = 0; ; o += 1000) { const d = await rest(`champions?select=${encodeURIComponent(CH_SEL)}&limit=1000&offset=${o}`); if (!Array.isArray(d) || !d.length) break; champs.push(...d); if (d.length < 1000) break; }
const aliases = await rest('champion_aliases?select=alias,champion_id&limit=5000');
const byId = Object.fromEntries(champs.map((c) => [c.id, c]));
const n2id = {}; for (const c of champs) n2id[norm(c.name)] = c.id; for (const a of (aliases || [])) n2id[norm(a.alias)] ??= a.champion_id;
const resolve = (n) => byId[n2id[norm(n)]] || null;

// champions that already have a recipe (by canonical id)
const authoredIds = new Set(); for (const r of Object.values(RECIPES)) { const c = resolve(r.champion); if (c) authoredIds.add(c.id); }

// build the target list
let targets;
if (NAMES) {
  targets = NAMES.split(',').map((s) => s.trim()).filter(Boolean).map((n) => {
    const c = resolve(n); if (!c) console.error(`⚠ could not resolve "${n}"`); return c;
  }).filter(Boolean);
} else {
  const freq = {};
  if (ALL_RAREPLUS) {
    for (const c of champs) if (['Rare', 'Epic', 'Legendary', 'Mythical'].includes(c.rarity)) freq[c.id] = (freq[c.id] || 0) + 1;   // uniform — ranks by nothing, just the whole roster
  } else {
    const runs = await rest('run_reconciliations?select=team_fielded&limit=2000');
    for (const r of (runs || [])) for (const x of (r.team_fielded || [])) { const c = resolve(x.name || x); if (c) freq[c.id] = (freq[c.id] || 0) + 1; }
  }
  targets = Object.entries(freq).filter(([id]) => !authoredIds.has(id)).sort((a, b) => b[1] - a[1]).slice(0, COUNT).map(([id]) => byId[id]);
}

const out = targets.map((c) => ({
  name: c.name, affinity: c.affinity, rarity: c.rarity, role: c.role, faction: c.faction,
  baseStats: { hp: c.base_hp, atk: c.base_atk, def: c.base_def, spd: c.base_spd, res: c.base_res, acc: c.base_acc, crit_rate: c.base_crit_rate, crit_dmg: c.base_crit_dmg },
  skills: (c.champion_skills || []).sort((a, b) => a.slot.localeCompare(b.slot)).map((s) => ({ slot: s.slot, name: s.skill_name, cooldown: s.cooldown_base, multiplier: s.damage_multiplier, multiplierType: s.multiplier_type, summary: s.skill_summary })),
}));
fs.writeFileSync(OUT, JSON.stringify(out, null, 1));

const impl = Object.entries(OPERATIONS).filter(([, v]) => v.implemented).map(([k]) => k);
console.log(`\nWrote ${out.length} champion(s) → ${OUT}`);
for (const c of out) console.log(`   ${c.name}  (${c.rarity}/${c.affinity})  ${(c.skills || []).length} skills`);
console.log(`\nCurrent implemented ops (${impl.length}) — the workflow's agents read lib/sim/operations.js for the authority, this is a cross-check:`);
console.log('   ' + impl.join(', '));
console.log(`\nNext: launch the authoring workflow on these champions (see RECIPE_AUTHORING_RUNBOOK.md §B.2), e.g.`);
console.log(`   Workflow({ name: 'recipe-authoring', args: ${JSON.stringify(out.map((c) => c.name))} })`);
