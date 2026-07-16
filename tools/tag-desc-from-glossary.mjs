// tools/tag-desc-from-glossary.mjs — regenerate tags.description from the authoritative keyword
// glossary (data/keyword-glossary.json). SAFE: auto-replaces only THIN descriptions (< 55 chars) +
// the known-WRONG ones; anything with a substantial existing description (which may carry TAGGING
// GUIDANCE, e.g. Stun's "don't assign AoE Stun to a single-target champ") is REVIEW-only, never
// clobbered. Emits seeds/138 + a review diff. Run: node tools/tag-desc-from-glossary.mjs
import fs from 'fs';
const env = {};
for (const l of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, ''); }
const BASE = (env.SUPABASE_URL || '').replace(/\/rest\/v1\/?$/, '');
const H = { apikey: env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}` };
const rest = async (p) => (await fetch(`${BASE}/rest/v1/${p}`, { headers: H })).json();

const norm = (s) => s.replace(/[Сс]/g, 'c').toLowerCase().replace(/defence/g, 'defense')
  .replace(/\bc\.?\s*rate\b/g, 'criticalrate').replace(/\bc\.?\s*dmg\b/g, 'criticaldamage')
  .replace(/\bdef\b/g, 'defense').replace(/\batk\b/g, 'attack').replace(/\bspd\b/g, 'speed')
  .replace(/\bacc\b/g, 'accuracy').replace(/\bres\b/g, 'resistance').replace(/[^a-z0-9]/g, '');

const gloss = JSON.parse(fs.readFileSync('data/keyword-glossary.json', 'utf8'));
const defMap = new Map();
for (const cat of ['buffs', 'debuffs', 'boss_specific', 'misc']) for (const e of gloss[cat]) {
  const def = e.def;
  defMap.set(norm(e.name.replace(/\s*\(.*\)$/, '')), def);
  for (const a of e.aliases || []) defMap.set(norm(a), def);
}
// glossary def for a tag name, incl. AoE-variant fallback (base def + all-targets note)
const glossFor = (name) => {
  if (defMap.has(norm(name))) return defMap.get(norm(name));
  if (/^aoe /i.test(name)) { const base = defMap.get(norm(name.replace(/^aoe /i, ''))); if (base) return base.replace(/\.$/, '') + ' — applied to ALL targets.'; }
  return null;
};

// Known-WRONG descriptions to replace regardless of length (the glossary def is correct):
//   Intercept (said "intercepts hits" — blocks CC), Immutable (said "prevents buff removal" — blocks
//   cooldown increases), Shatter (said "reduces MAX HP/shreds shields" — is +Ignore DEF).
const WRONG = new Set(['Intercept', 'Immutable', 'Shatter']);
// SKIP: glossary def is a PLACEHOLDER/weaker than the existing tag description — do not overwrite.
const SKIP = new Set(['Total Guard']);
const tags = await rest('tags?select=name,description&game_id=eq.raid_shadow_legends&order=name');

const updates = [], review = [], nomatch = [];
for (const t of tags) {
  if (SKIP.has(t.name)) { nomatch.push(t.name + ' (skip: placeholder def)'); continue; }
  const def = glossFor(t.name);
  if (!def) { nomatch.push(t.name); continue; }
  const cur = (t.description || '').trim();
  if (norm(cur) === norm(def)) continue;                 // already equivalent
  const thin = cur.length < 55;
  if (thin || WRONG.has(t.name)) updates.push({ name: t.name, old: cur, new: def, why: WRONG.has(t.name) ? 'WRONG' : 'thin' });
  else review.push({ name: t.name, old: cur, new: def }); // substantial desc — don't clobber
}

// ── review output ──
console.log(`AUTO-UPDATE (${updates.length}) — thin/wrong descriptions replaced by glossary def:\n${'='.repeat(80)}`);
for (const u of updates) { console.log(`\n[${u.name}]  (${u.why})`); console.log(`  OLD: ${u.old || '(none)'}`); console.log(`  NEW: ${u.new}`); }
console.log(`\n\nREVIEW-ONLY (${review.length}) — substantial existing desc differs from glossary (NOT changed; may carry tagging guidance):\n${'='.repeat(80)}`);
for (const r of review) { console.log(`\n[${r.name}]`); console.log(`  KEPT: ${r.old}`); console.log(`  gloss: ${r.new}`); }
console.log(`\n\nNO GLOSSARY ENTRY (${nomatch.length}, unchanged — our capability labels / auras): ${nomatch.join(', ')}`);

// ── seed ──
const esc = (s) => s.replace(/'/g, "''");
let sql = `-- ============================================================================
-- 138 - Correct tags.description from the authoritative keyword glossary
-- (data/keyword-glossary.json). Auto-replaced ${updates.length} THIN/WRONG descriptions with the
-- game-encyclopedia definitions (Mike-provided, Tier-1). Substantial existing
-- descriptions that carry TAGGING GUIDANCE were left untouched (review-only).
-- Source: tools/tag-desc-from-glossary.mjs. See INS-0028.
-- ============================================================================
`;
for (const u of updates) sql += `update tags set description = '${esc(u.new)}' where name = '${esc(u.name)}' and game_id = 'raid_shadow_legends';\n`;
fs.writeFileSync('seeds/138_tag_descriptions_from_glossary.sql', sql);
console.log(`\nWROTE seeds/138_tag_descriptions_from_glossary.sql (${updates.length} updates)`);
