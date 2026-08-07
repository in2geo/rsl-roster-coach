#!/usr/bin/env node
// tools/alias-audit-ayumilove.mjs — NAMING-INTEGRITY audit. Ensures every champion resolves by BOTH its
// long (full official) name and its short name, because the resolver is EXACT normalized-match (no fuzzy
// fallback) — a form resolves ONLY if it is champions.name or an explicit champion_aliases row.
//
// Source of the authoritative full names: AyumiLove champion-guide sitemap (Mike's choice 2026-08-07).
// Enumerated from the WP sitemap (a few XML fetches, cached) — NOT ~1000 page scrapes.
//
// Produces two proposal buckets, collision-guarded:
//   ADD_FULL  — an AyumiLove full name that does NOT resolve in our registry, but whose word(s) map to
//               exactly one of our champions (the Konstantin/Mithrala class: short canonical missing its
//               full-name alias).
//   ADD_SHORT — our multi-word canonical whose first-word short form does not resolve and is unowned
//               (safe to add). Collision guard auto-excludes skins (Dark Kael → "Kael" already owned).
// SAFE = the form is owned by nobody AND maps to exactly one champion → auto-applyable. Everything else
// is AMBIGUOUS/UNMATCHED → review only. READ-ONLY: writes a proposals JSON, no DB writes.
//
// Usage: node --env-file=.env.local tools/alias-audit-ayumilove.mjs

import fs from 'fs';
import path from 'path';
import { buildNameResolver, normalizeName } from '../lib/champion-names.js';

const BASE = process.env.SUPABASE_URL.replace(/\/rest\/v1\/?$/, '');
const H = { apikey: process.env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}` };
const restP = async (t) => { let o = [], f = 0; for (;;) { const r = await fetch(`${BASE}/rest/v1/${t}`, { headers: { ...H, Range: `${f}-${f + 999}` } }); const j = await r.json(); o.push(...j); if (j.length < 1000) break; f += 1000; } return o; };
const CACHE = path.join(process.env.TEMP || '/tmp', 'ayumilove-cache');
fs.mkdirSync(CACHE, { recursive: true });
const UA = { 'User-Agent': 'Mozilla/5.0 (naming-integrity audit; contact repo owner)' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const CONN = new Set(['the', 'of', 'and', 'a', 'an', 'to', 'in', 'at', 'by', 'for', 'from', 'on', 'de']);
const nameFromSlug = (slug) => slug.split('-').map((w, i) => (i > 0 && CONN.has(w)) ? w : w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

async function ayumiSlugs() {
  const cf = path.join(CACHE, '_ayumi_slugs.json');
  if (fs.existsSync(cf)) return JSON.parse(fs.readFileSync(cf, 'utf8'));
  const idx = await (await fetch('https://ayumilove.net/sitemap_index.xml', { headers: UA })).text();
  const subs = [...idx.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]).filter((u) => /post-sitemap/.test(u));
  const slugs = new Set();
  for (const s of subs) {
    const t = await (await fetch(s, { headers: UA })).text();
    for (const m of t.matchAll(/raid-shadow-legends-([a-z0-9-]+?)-skill-mastery-equip-guide/g)) slugs.add(m[1]);
    await sleep(300);
  }
  const arr = [...slugs].sort();
  fs.writeFileSync(cf, JSON.stringify(arr));
  return arr;
}

(async () => {
  const champs = await restP('champions?select=id,name,rarity');
  const aliases = await restP('champion_aliases?select=champion_id,alias');
  const R = buildNameResolver(champs, aliases);
  const nameById = Object.fromEntries(champs.map((c) => [c.id, c.name]));
  const slugs = await ayumiSlugs();
  console.log(`our champions ${champs.length} · alias rows ${aliases.length} · AyumiLove slugs ${slugs.length}\n`);

  const ADD_FULL = [], ADD_SHORT = [], NO_SHORT = [], UNMATCHED = [], AMBIG = [];
  // word → set of champions whose NAME contains it (distinctiveness = appears in exactly one champion)
  const wordChamps = new Map();
  for (const c of champs) for (const w of c.name.toLowerCase().split(/\s+/)) { if (CONN.has(w) || w.length < 2) continue; const s = wordChamps.get(w) || new Set(); s.add(c.id); wordChamps.set(w, s); }
  // ── AyumiLove-driven: full names missing from our registry ──────────────────────
  for (const slug of slugs) {
    const full = nameFromSlug(slug);
    if (R.resolve(full)) continue;                       // already resolves (name or alias) → covered
    // map to our champion by the word(s) that resolve
    const hits = new Map();
    for (const w of full.split(/\s+/)) { const h = R.resolve(w); if (h) hits.set(h.id, h); }
    if (hits.size === 1) {
      const c = [...hits.values()][0];
      ADD_FULL.push({ champId: c.id, champName: c.name, addAlias: full, apostrophe: /'/.test(nameFromSlug(slug)) });
    } else if (hits.size === 0) {
      UNMATCHED.push(full);                              // AyumiLove champ we can't tie to any of ours
    } else {
      AMBIG.push({ addAlias: full, candidates: [...hits.values()].map((h) => h.name) });
    }
  }
  // ── DB-internal: our multi-word canonicals whose SHORT form doesn't resolve ─────
  // Short form = a DISTINCTIVE word (appears in exactly one champion name) — correctly gives the personal
  // name (Lady Noelle→Noelle, Iudex Artor→Artor/Iudex, Rakka Viletide→Rakka), and auto-skips shared titles
  // ("Lady") and skin words ("Kael" appears in Kael/Dark Kael/Supreme Kael → not distinctive → skipped).
  for (const c of champs) {
    const words = c.name.trim().split(/\s+/);
    if (words.length < 2) continue;
    const covered = words.some((w) => { const h = R.resolve(w); return h && h.id === c.id; });  // already resolves by some single word
    if (covered) continue;
    const distinctive = words.filter((w) => { const s = wordChamps.get(w.toLowerCase()); return s && s.size === 1 && !CONN.has(w.toLowerCase()) && w.length >= 2; });
    if (!distinctive.length) { NO_SHORT.push(c.name); continue; }   // pure compound / all words shared → no safe short form
    for (const w of distinctive) if (!R.resolve(w)) ADD_SHORT.push({ champId: c.id, champName: c.name, addAlias: w });
  }

  const out = { generatedFrom: 'ayumilove-sitemap', ADD_FULL, ADD_SHORT, NO_SHORT, UNMATCHED, AMBIG };
  fs.writeFileSync(path.join(CACHE, '_alias_proposals.json'), JSON.stringify(out, null, 2));
  console.log(`ADD_FULL  (AyumiLove full name → our champ, missing alias): ${ADD_FULL.length}`);
  ADD_FULL.slice(0, 20).forEach((x) => console.log(`   + "${x.addAlias}" → ${x.champName}${x.apostrophe ? '  ⚠apostrophe?' : ''}`));
  if (ADD_FULL.length > 20) console.log(`   … +${ADD_FULL.length - 20} more`);
  console.log(`\nADD_SHORT (distinctive-word short form missing, SAFE to add): ${ADD_SHORT.length}`);
  ADD_SHORT.slice(0, 30).forEach((x) => console.log(`   + "${x.addAlias}" → ${x.champName}`));
  if (ADD_SHORT.length > 30) console.log(`   … +${ADD_SHORT.length - 30} more`);
  console.log(`\nNO_SHORT (multi-word, no distinctive word — compound/skin, no safe short form): ${NO_SHORT.length}`);
  console.log('   ' + NO_SHORT.slice(0, 25).join(', ') + (NO_SHORT.length > 25 ? ` … +${NO_SHORT.length - 25}` : ''));
  console.log(`\nAMBIGUOUS (AyumiLove full name maps to >1 of our champs, review): ${AMBIG.length}`);
  AMBIG.slice(0, 12).forEach((x) => console.log(`   ? "${x.addAlias}" → ${x.candidates.join(' / ')}`));
  console.log(`\nUNMATCHED (AyumiLove champ not tied to any of ours — we may lack it or name differs): ${UNMATCHED.length}`);
  console.log('   ' + UNMATCHED.slice(0, 20).join(', ') + (UNMATCHED.length > 20 ? ` … +${UNMATCHED.length - 20}` : ''));
  console.log(`\nproposals → ${path.join(CACHE, '_alias_proposals.json')}`);
})();
