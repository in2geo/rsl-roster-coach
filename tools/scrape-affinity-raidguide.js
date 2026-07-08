#!/usr/bin/env node
/**
 * raid.guide affinity + faction pull — RSL Roster Coach
 *
 * Independent verification baseline for champion AFFINITY (and faction). raid.guide
 * is a Tier-1 allowed source; affinity is factual game data. Validated this session
 * against two in-game sources (Apothecary screenshot, Sacred Order grid) — matched
 * every time. Roster comes from champions_tab.csv (Champions tab export).
 *
 * Extracts per champion page:
 *   affinity  <- /en/shadow-legends/f/element-(magic|void|force|spirit)/
 *   faction   <- <th>Fraction</th><td><a ...>Faction</a>
 *
 * Output (output/):
 *   raidguide_affinity.json          [{stable_id, name, ct_affinity, ct_faction, rg_affinity, rg_faction}]
 *   raidguide_affinity_progress.txt  checkpoint (resumable)
 * Desktop:
 *   raidguide_affinity_missing.txt   champions with no raid.guide page (404) / no data
 *
 * Usage:  node tools/scrape-affinity-raidguide.js [--limit N]
 * Compares nothing itself — a separate analysis diffs rg vs Champions tab vs DB.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname, '..');
const OUT = path.join(REPO, 'output');
const DESK = path.join(REPO, '..');
fs.mkdirSync(OUT, { recursive: true });

const UA = { 'User-Agent': 'Mozilla/5.0 (compatible; RSL-Roster-Coach-Scraper/2.0)' };
const STATS = 'https://raid.guide/en/stats/';
const PAGE = (slug) => `https://raid.guide/en/shadow-legends/${slug}/`;
const DELAY = 1000;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const guessSlug = (n) => n.toLowerCase().replace(/['’.]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

function readRoster() {
  const raw = fs.readFileSync(path.join(DESK, 'champions_tab.csv'), 'utf8').replace(/^﻿/, '');
  const [head, ...lines] = raw.split(/\r?\n/).filter(Boolean);
  const cols = head.split(',');
  const iId = cols.indexOf('Stable Champion ID'), iN = cols.indexOf('Champion'),
        iR = cols.indexOf('Rarity'), iF = cols.indexOf('Faction'), iA = cols.indexOf('Affinity');
  return lines.map(l => { const c = l.split(','); return {
    id: c[iId], name: c[iN], rarity: c[iR], ct_faction: c[iF], ct_affinity: c[iA] }; })
    .filter(r => r.name && !['Common', 'Uncommon'].includes(r.rarity));
}

async function fetchPage(slug) {
  for (let a = 1; a <= 4; a++) {
    await sleep(a === 1 ? 0 : 1500 * a);
    try {
      const res = await fetch(PAGE(slug), { headers: UA });
      if (res.status === 404) return { code: 404 };
      if (!res.ok) { if (a === 4) return { code: res.status }; continue; }
      return { html: await res.text() };
    } catch (e) { if (a === 4) return { err: e.message }; }
  }
  return { err: 'unknown' };
}

const cap = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1) : '';

async function main() {
  const LIMIT = process.argv.includes('--limit') ? +process.argv[process.argv.indexOf('--limit') + 1] : Infinity;
  const roster = readRoster();
  console.log(`Roster (Rare+): ${roster.length}. Fetching raid.guide slug dictionary…`);
  const stats = await (await fetch(STATS, { headers: UA })).text();
  const slugByName = new Map();
  for (const m of stats.matchAll(/href="\/en\/shadow-legends\/([a-z0-9-]+)\/"\s+class="simple-champion-link">([^<]+)</g))
    slugByName.set(m[2].trim().toLowerCase(), m[1]);
  console.log(`  ${slugByName.size} slugs.\n`);

  const progFile = path.join(OUT, 'raidguide_affinity_progress.txt');
  const done = fs.existsSync(progFile)
    ? new Set(fs.readFileSync(progFile, 'utf8').split('\n').map(s => s.trim()).filter(Boolean)) : new Set();
  const jsonFile = path.join(OUT, 'raidguide_affinity.json');
  const rows = [];
  try { rows.push(...(JSON.parse(fs.readFileSync(jsonFile, 'utf8')).rows ?? [])); } catch {}
  const missing = [];

  let n = 0;
  for (const c of roster) {
    if (done.has(c.name)) continue;
    if (n >= LIMIT) break;
    n++;
    await sleep(DELAY);
    const slug = slugByName.get(c.name.toLowerCase()) ?? guessSlug(c.name);
    const r = await fetchPage(slug);
    if (r.html) {
      const aff = cap((r.html.match(/element-(magic|void|force|spirit)\//i) || [])[1] || '');
      const fac = (r.html.match(/Fraction<\/th>\s*<td>\s*<a[^>]*>([^<]+)<\/a>/) || [])[1]?.trim() || '';
      if (aff) rows.push({ stable_id: c.id, name: c.name, ct_affinity: c.ct_affinity, ct_faction: c.ct_faction, rg_affinity: aff, rg_faction: fac });
      else { missing.push(`${c.id} | ${c.name} | page ok, no element`); }
      console.log(`  ${c.name}: ${aff || 'NO-AFF'} / ${fac}`);
    } else {
      missing.push(`${c.id} | ${c.name} | ${r.code ? 'HTTP ' + r.code : 'err ' + r.err} (slug ${slug})`);
      console.log(`  ${c.name}: MISSING (${r.code || r.err})`);
    }
    fs.appendFileSync(progFile, c.name + '\n');
    if (n % 25 === 0) fs.writeFileSync(jsonFile, JSON.stringify({ generated: new Date().toISOString(), rows }, null, 2));
  }
  fs.writeFileSync(jsonFile, JSON.stringify({ generated: new Date().toISOString(), rows }, null, 2));
  if (missing.length) fs.appendFileSync(path.join(DESK, 'raidguide_affinity_missing.txt'), missing.join('\n') + '\n');
  console.log(`\nDone. ${rows.length} champions with raid.guide affinity, ${missing.length} missing/no-data (this run: ${n}).`);
}
main().catch(e => { console.error(e); process.exit(1); });
