// tools/glossary-check.mjs — COVERAGE of data/keyword-glossary.json vs every [bracket] in skill text.
// Classifies each distinct bracketed token: DEFINED (glossary hit) / NOISE (not a keyword — skill name,
// faction-unity passage, conditional clause) / REVIEW (unknown — a genuine missing keyword or a champ
// name to confirm). Answers: is the glossary now complete for the REAL keywords? Run: node tools/glossary-check.mjs
import fs from 'fs';
const env = {};
for (const l of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, ''); }
const BASE = (env.SUPABASE_URL || '').replace(/\/rest\/v1\/?$/, '');
const H = { apikey: env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}` };
async function all(p) { const out = []; let f = 0; for (;;) { const r = await (await fetch(`${BASE}/rest/v1/${p}`, { headers: { ...H, Range: `${f}-${f + 999}` } })).json(); if (!Array.isArray(r) || !r.length) break; out.push(...r); if (r.length < 1000) break; f += 1000; } return out; }

// normalize a keyword for matching: homoglyphs → latin, lowercase, strip punctuation/space, expand abbrevs
const norm = (s) => s
  .replace(/[Сс]/g, 'c')                    // Cyrillic С/с → c
  .toLowerCase().replace(/defence/g, 'defense')
  .replace(/\bc\.?\s*rate\b/g, 'criticalrate').replace(/\bc\.?\s*dmg\b/g, 'criticaldamage')
  .replace(/\bdef\b/g, 'defense').replace(/\batk\b/g, 'attack').replace(/\bspd\b/g, 'speed')
  .replace(/\bacc\b/g, 'accuracy').replace(/\bres\b/g, 'resistance')
  .replace(/[^a-z0-9]/g, '');

const gloss = JSON.parse(fs.readFileSync('data/keyword-glossary.json', 'utf8'));
const defined = new Set();
for (const cat of ['buffs', 'debuffs', 'boss_specific', 'misc']) for (const e of gloss[cat]) {
  defined.add(norm(e.name.replace(/\s*\(.*\)$/, ''))); // drop "(Minotaur)" scope suffix
  for (const a of e.aliases || []) defined.add(norm(a));
}

const skills = await all('champion_skills?select=skill_summary');
const freq = new Map();
for (const s of skills) for (const m of (s.skill_summary || '').matchAll(/\[([^\]]+)\]/g)) { const k = m[1].trim(); freq.set(k, (freq.get(k) || 0) + 1); }

const NOISE = /unity|only available|on the same team|does not|will not|will ignore|will only|will target|cannot be killed|up to \d|stacks up to|activates this skill|this effect|this skill|this champion|when fighting|against bosses|scale off|amount healed|multiple|instead of|except if|per ally/i;
const buckets = { DEFINED: [], NOISE: [], REVIEW: [] };
for (const [kw, n] of [...freq.entries()].sort((a, b) => b[1] - a[1])) {
  if (defined.has(norm(kw))) buckets.DEFINED.push([kw, n]);
  else if (kw === 'P' || kw.split(/\s+/).length > 5 || NOISE.test(kw)) buckets.NOISE.push([kw, n]);
  else buckets.REVIEW.push([kw, n]);
}

console.log(`GLOSSARY COVERAGE — ${freq.size} distinct bracketed tokens across ${skills.length} skill rows\n${'='.repeat(70)}`);
console.log(`  DEFINED by glossary : ${buckets.DEFINED.length}`);
console.log(`  NOISE (not keywords): ${buckets.NOISE.length}  (skill names / faction-unity / conditional clauses)`);
console.log(`  REVIEW (unknown)    : ${buckets.REVIEW.length}\n`);
console.log(`REVIEW — genuine missing keyword, or a champion name to confirm (${buckets.REVIEW.length}):`);
for (const [kw, n] of buckets.REVIEW) console.log(`  [${kw}]  ×${n}`);
console.log(`\nDEFINED (${buckets.DEFINED.length}): ${buckets.DEFINED.map(([k]) => k).join(', ')}`);
