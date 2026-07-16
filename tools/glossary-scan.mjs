// tools/glossary-scan.mjs — SCOPE the missing buff/debuff keyword GLOSSARY (Mike 2026-07-16).
// Champion skills are written in [keyword] brackets; to understand a skill you need each keyword's
// game-mechanic definition. We have NO glossary table — only ad-hoc tags.description (incomplete/wrong).
// This pulls EVERY distinct [keyword] across all champion_skills.skill_summary, ranks by frequency, and
// shows what definition (if any) we currently have — so we know exactly how big the dictionary is and
// which entries we're currently guessing at. READ-ONLY, writes a report file. No DB writes.
//   Run: node tools/glossary-scan.mjs
import fs from 'fs';
const env = {};
for (const l of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, ''); }
const BASE = (env.SUPABASE_URL || '').replace(/\/rest\/v1\/?$/, '');
const H = { apikey: env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}` };
async function all(pathBase) {
  const out = []; let from = 0;
  for (;;) { const r = await (await fetch(`${BASE}/rest/v1/${pathBase}`, { headers: { ...H, Range: `${from}-${from + 999}` } })).json();
    if (!Array.isArray(r) || !r.length) break; out.push(...r); if (r.length < 1000) break; from += 1000; }
  return out;
}

const skills = await all('champion_skills?select=skill_summary');
const tags = await all('tags?select=name,description,is_debuff');
const tagByName = new Map(tags.map(t => [t.name.toLowerCase(), t]));

// extract every [bracketed] token
const freq = new Map();
for (const s of skills) {
  const txt = s.skill_summary || '';
  for (const m of txt.matchAll(/\[([^\]]+)\]/g)) {
    const kw = m[1].trim();
    freq.set(kw, (freq.get(kw) || 0) + 1);
  }
}

// structural / effect-type labels that are NOT buff/debuff keywords (still list, but categorize)
const STRUCTURAL = new Set(['Passive Effect', 'Active Effect', 'Instant Turn', 'Extra Turn', 'Bonus Effect', 'Cooldown']);

const rows = [...freq.entries()].sort((a, b) => b[1] - a[1]).map(([kw, n]) => {
  const t = tagByName.get(kw.toLowerCase());
  const desc = t?.description || '';
  const structural = STRUCTURAL.has(kw);
  // "guessing" = no tag/definition at all, OR a suspiciously short description (< 45 chars)
  const status = structural ? 'STRUCTURAL (not a buff/debuff keyword)'
    : !t ? 'NO DEFINITION (no tag, we are guessing)'
    : desc.length < 45 ? 'THIN definition (needs full mechanic)'
    : 'has tag description (verify vs encyclopedia)';
  return { kw, n, hasTag: !!t, structural, status, desc };
});

const buffDebuff = rows.filter(r => !r.structural);
const noDef = buffDebuff.filter(r => r.status.startsWith('NO DEFINITION'));
const thin = buffDebuff.filter(r => r.status.startsWith('THIN'));
const ok = buffDebuff.filter(r => r.status.startsWith('has tag'));

let out = `BUFF/DEBUFF KEYWORD GLOSSARY — SCOPE (from ${skills.length} skill rows)\n`;
out += `${'='.repeat(78)}\n`;
out += `Distinct bracketed keywords total: ${rows.length}\n`;
out += `  • buff/debuff keywords (need a definition): ${buffDebuff.length}\n`;
out += `      - NO DEFINITION at all (guessing): ${noDef.length}\n`;
out += `      - THIN definition (needs full mechanic): ${thin.length}\n`;
out += `      - has a tag description (verify vs encyclopedia): ${ok.length}\n`;
out += `  • structural labels (not keywords): ${rows.length - buffDebuff.length}\n`;
out += `${'='.repeat(78)}\n\n`;
out += `keyword`.padEnd(34) + 'uses'.padStart(5) + '  status\n';
out += '-'.repeat(78) + '\n';
for (const r of buffDebuff) {
  out += `${('[' + r.kw + ']').padEnd(34)}${String(r.n).padStart(5)}  ${r.status}\n`;
  if (r.desc && r.status.startsWith('THIN')) out += `${' '.repeat(41)}ours: "${r.desc}"\n`;
}
out += `\n--- structural labels (skip in glossary) ---\n`;
out += rows.filter(r => r.structural).map(r => `[${r.kw}] (${r.n})`).join(', ') + '\n';

fs.mkdirSync('output', { recursive: true });
fs.writeFileSync('output/glossary-scope.txt', out);
console.log(out.split('\n').slice(0, 12).join('\n'));
console.log(`\n(full report → output/glossary-scope.txt)`);
console.log(`\nNO-DEFINITION keywords (we are currently guessing at these ${noDef.length}):`);
console.log('  ' + noDef.map(r => `[${r.kw}]`).join(', '));
