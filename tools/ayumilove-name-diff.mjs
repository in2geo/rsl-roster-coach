#!/usr/bin/env node
// tools/ayumilove-name-diff.mjs — DATA-INTEGRITY validator. Cross-checks the DB's champion SKILL NAMES
// against AyumiLove (an INDEPENDENT Tier-2 factual source) to find the invented names planted by the
// raid.guide-derived "worksheet Skills tab 2026-07-11" bulk source (Keberon/Morag/Staltus class).
//
// WHY AyumiLove and not raid.guide: raid.guide is where the bad data came from — diffing against it is
// bad-vs-bad. AyumiLove is independent, so a name mismatch is a real corruption signal.
//
// READ-ONLY: fetches AyumiLove pages (cached to disk, rate-limited), parses skill names, and DIFFS them
// against the DB. Writes NO DB rows — output is a worklist for Tier-1 re-capture (the normal seed flow).
//
// Usage:
//   node --env-file=.env.local tools/ayumilove-name-diff.mjs                 # full bucket-A sweep
//   node --env-file=.env.local tools/ayumilove-name-diff.mjs "Keberon the Underflame" "Galek"  # test subset
//   AYUMI_DELAY_MS=1200 ... (override the polite delay; default 1000ms)

import fs from 'fs';
import path from 'path';
import { buildNameResolver } from '../lib/champion-names.js';

const BASE = process.env.SUPABASE_URL.replace(/\/rest\/v1\/?$/, '');
const H = { apikey: process.env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}` };
const restPaged = async (pathq) => {
  let out = [], from = 0;
  for (;;) {
    const r = await fetch(`${BASE}/rest/v1/${pathq}`, { headers: { ...H, Range: `${from}-${from + 999}` } });
    const rows = await r.json();
    out.push(...rows);
    if (rows.length < 1000) break;
    from += 1000;
  }
  return out;
};

const CACHE = path.join(process.env.TEMP || '/tmp', 'ayumilove-cache');
fs.mkdirSync(CACHE, { recursive: true });
const DELAY = Number(process.env.AYUMI_DELAY_MS || 1000);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// name → AyumiLove slug: lowercase, drop apostrophes, non-alnum → hyphen, collapse.
const slugify = (name) => name.toLowerCase().replace(/['’.]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const urlFor = (name) => `https://ayumilove.net/raid-shadow-legends-${slugify(name)}-skill-mastery-equip-guide/`;

// decode HTML entities (numeric hex/dec + common named) so "Ancestors&#x27; Power" == "Ancestors' Power".
const decodeEntities = (s) => (s || '')
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
  .replace(/&amp;/g, '&').replace(/&rsquo;|&lsquo;|&#039;/g, "'").replace(/&nbsp;/g, ' ');

// normalize a skill name for comparison: decode entities, strip any (…passive…/…cooldown…) parenthetical
// (AyumiLove uses "(Cooldown: 3 turns)", "(Passive)", and the combined "(Passive, Cooldown: 5 turns)"),
// bracket tags [P]/[Passive], and punctuation.
const norm = (s) => decodeEntities(s || '')
  .replace(/\s*\([^)]*(passive|cooldown)[^)]*\)/i, '')
  .replace(/\[[^\]]*\]/g, '')
  .replace(/['’.]/g, '')
  .replace(/[^a-z0-9]+/gi, ' ')
  .replace(/\s+passive\s*$/i, '')
  .trim().toLowerCase();

// Try the champion's canonical name + all aliases (full names first — AyumiLove uses the official full name).
// Cache the WINNING html by champion id so reruns are free. Returns the matched name for section parsing.
async function fetchAyumi(cid, candidateNames) {
  const cacheFile = path.join(CACHE, cid + '.html');
  const metaFile = path.join(CACHE, cid + '.name');
  if (fs.existsSync(cacheFile)) return { html: fs.readFileSync(cacheFile, 'utf8'), matched: fs.existsSync(metaFile) ? fs.readFileSync(metaFile, 'utf8') : candidateNames[0], cached: true };
  const seen = new Set();
  let lastStatus = '404';
  for (const nm of candidateNames) {
    const slug = slugify(nm);
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);
    try {
      const r = await fetch(`https://ayumilove.net/raid-shadow-legends-${slug}-skill-mastery-equip-guide/`, { headers: { 'User-Agent': 'Mozilla/5.0 (data-integrity validator; contact repo owner)' }, redirect: 'follow' });
      await sleep(DELAY);
      if (r.status === 200) {
        const html = await r.text();
        // guard against AyumiLove's soft-404 (returns 200 with a "not found"/search page)
        if (/-skill-mastery/i.test(r.url) && new RegExp(nm.split(' ')[0], 'i').test(html)) {
          fs.writeFileSync(cacheFile, html); fs.writeFileSync(metaFile, nm);
          return { html, matched: nm, cached: false };
        }
      } else lastStatus = r.status;
    } catch (e) { lastStatus = 'ERR:' + e.message; }
  }
  return { html: null, status: lastStatus };
}

// pull skill names from the "<Name> Skills" section: <p><strong>NAME</strong> ... , skip "Aura".
function parseNames(html, champName) {
  if (!html) return null;
  const startPat = new RegExp(champName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s+Skills\\s*</h2>', 'i');
  const m = startPat.exec(html);
  let sec;
  if (m) { const rest = html.slice(m.index + m[0].length); const end = rest.search(/<h2[ >]/i); sec = end >= 0 ? rest.slice(0, end) : rest; }
  else { const i = html.search(/Skills\s*<\/h2>/i); if (i < 0) return []; const rest = html.slice(i); const end = rest.search(/<h2[ >]/i); sec = end >= 0 ? rest.slice(0, end) : rest.slice(0, 8000); }
  const names = [];
  const re = /<p>\s*<strong>([\s\S]*?)<\/strong>/gi;
  let x;
  while ((x = re.exec(sec))) {
    const raw = x[1].replace(/<[^>]+>/g, '').replace(/&#8217;|&rsquo;/g, "'").trim();
    if (!raw || /^aura\b/i.test(raw) || /^damage multiplier/i.test(raw)) continue;
    names.push(raw.replace(/\s*\([^)]*(cooldown|passive)[^)]*\)/i, '').trim());
  }
  return names;
}

(async () => {
  const argNames = process.argv.slice(2);
  const champs = await restPaged('champions?select=id,name,rarity');
  const aliases = await restPaged('champion_aliases?select=champion_id,alias');
  const R = buildNameResolver(champs, aliases);
  const skills = await restPaged('champion_skills?select=champion_id,slot,skill_name,source,verification_status');
  const isBulk = (s) => (s || '').toLowerCase().includes('worksheet skills tab 2026-07-11');
  const byChamp = {};
  for (const r of skills) (byChamp[r.champion_id] ??= []).push(r);
  const nameById = Object.fromEntries(champs.map((c) => [c.id, c.name]));
  const rarById = Object.fromEntries(champs.map((c) => [c.id, c.rarity]));
  // champion_id → candidate names (canonical + aliases), full names first (AyumiLove uses the official name).
  const aliasByChamp = {};
  for (const a of aliases) { const id = a.champion_id ?? a.id; if (id) (aliasByChamp[id] ??= []).push(a.alias); }
  const candidatesFor = (cid) => [...new Set([nameById[cid], ...(aliasByChamp[cid] || [])].filter(Boolean))]
    .sort((a, b) => b.length - a.length);

  // target set: explicit args, else all champions whose EVERY skill is bad-bulk ("bucket A"), Rare+ in scope.
  let targets;
  if (argNames.length) targets = argNames.map((n) => R.resolveOrThrow(n).id);
  else targets = Object.keys(byChamp).filter((cid) => byChamp[cid].every((r) => isBulk(r.source))
    && ['Legendary', 'Epic', 'Rare', 'Mythical'].includes(rarById[cid]));
  targets = [...new Set(targets)].sort((a, b) => (nameById[a] || '').localeCompare(nameById[b] || ''));

  console.log(`Targets: ${targets.length}  ·  cache: ${CACHE}  ·  delay: ${DELAY}ms\n`);
  const results = [];
  let done = 0;
  for (const cid of targets) {
    const cname = nameById[cid];
    const dbNames = byChamp[cid].filter((r) => !/aura/i.test(r.slot || '')).map((r) => decodeEntities(r.skill_name)).filter(Boolean);
    const { html, status, matched } = await fetchAyumi(cid, candidatesFor(cid));
    const ayumi = parseNames(html, matched || cname);
    let verdict, missing = [];
    if (ayumi == null) verdict = 'NO_PAGE(' + (status || '?') + ')';
    else {
      const aset = new Set(ayumi.map(norm));
      missing = dbNames.filter((n) => !aset.has(norm(n)));
      verdict = missing.length === 0 ? 'MATCH' : (missing.length === dbNames.length ? 'ALL_WRONG' : 'PARTIAL');
    }
    results.push({ champion: cname, rarity: rarById[cid], verdict, dbNames, ayumiNames: ayumi, missing });
    done++;
    if (argNames.length || verdict.startsWith('ALL_WRONG') || verdict === 'PARTIAL' || done % 50 === 0)
      console.log(`[${done}/${targets.length}] ${cname.padEnd(28)} ${verdict}${missing.length ? '  DB-only: ' + missing.join(', ') : ''}`);
  }

  const sum = (v) => results.filter((r) => r.verdict.startsWith(v)).length;
  console.log(`\n===== SUMMARY (${results.length} champions) =====`);
  console.log(`  MATCH     : ${sum('MATCH')}`);
  console.log(`  PARTIAL   : ${sum('PARTIAL')}   (some DB names not on AyumiLove)`);
  console.log(`  ALL_WRONG : ${sum('ALL_WRONG')}   (no DB name matches AyumiLove — strong corruption)`);
  console.log(`  NO_PAGE   : ${sum('NO_PAGE')}   (couldn't fetch/parse — unverified)`);
  const outFile = path.join(CACHE, '_worklist.json');
  fs.writeFileSync(outFile, JSON.stringify(results, null, 2));
  console.log(`\nWorklist (with per-champion DB vs AyumiLove names): ${outFile}`);
})();
