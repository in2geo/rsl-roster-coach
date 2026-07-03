#!/usr/bin/env node
// ── tools/check-patch-notes.js ───────────────────────────────────────────────
// Manual post-patch check. Fetches a Plarium RSL update post, parses the
// "Champion Rebalance" section, lists the champions mentioned, and cross-references
// them against the champions table — flagging any that have APPROVED champion_tags
// or APPROVED champion_solo_profiles. A rebalance changes skill text, and our tags
// come from literal skill text, so those rows need human review against the new kit.
//
// Run this MANUALLY after each patch — NOT on a schedule.
//   node --env-file=.env.local tools/check-patch-notes.js <patch-notes-url>
// Find the latest update post at:
//   https://forum.plarium.com/raid-shadow-legends/843_news/
//
// Output: output/patch-review-<YYYY-MM-DD>.txt  (gitignored review artifact)

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import { loadNameResolver } from '../lib/champion-names.js';

const NEWS_HUB = 'https://forum.plarium.com/raid-shadow-legends/843_news/';
const url = process.argv[2];
if (!url) {
  console.error('Usage: node --env-file=.env.local tools/check-patch-notes.js <patch-notes-url>');
  console.error(`Find the latest update post at: ${NEWS_HUB}`);
  process.exit(1);
}
if (!process.env.SUPABASE_DB_URL) {
  console.error('SUPABASE_DB_URL required — run with: node --env-file=.env.local tools/check-patch-notes.js <url>');
  process.exit(1);
}

const OUT_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'output');

// Strip HTML → text, decoding the few entities that matter for champion names.
function stripTags(s) {
  return s
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#0?39;/g, "'")
    .replace(/&rsquo;/g, "'").replace(/&quot;/g, '"')
    .replace(/[ \t]+/g, ' ').trim();
}

// Fetch the page and isolate the Champion Rebalance section. Headings are marked
// before stripping so we can bound the section to the next heading; falls back to
// the whole page (flagged) if no rebalance heading is found.
async function fetchRebalanceSection(pageUrl) {
  const res = await fetch(pageUrl, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; RSL-Roster-Coach-PatchCheck/1.0)' } });
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${pageUrl}`);
  let html = await res.text();
  html = html.replace(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi, (_, t) => `\n@@SEC@@${stripTags(t)}\n`);
  const text = stripTags(html).replace(/\r/g, '');
  const chunks = text.split('@@SEC@@');
  const isRebalanceHeading = /^\s*(champion\s+rebalanc|champion\s+balance|balance\s+change)/i;
  const section = chunks.find((c, i) => i > 0 && isRebalanceHeading.test(c)) ?? null;
  return { section, fullText: text.replace(/@@SEC@@/g, '\n') };
}

// Which champions are mentioned (word-bounded, case-insensitive) in the text — matching
// canonical names AND aliases (short/community forms), collapsed to the canonical
// champion. Returns [{ id, name }]. Uses the champion_aliases resolver so a rebalance
// post that says "Fahrakin" or "Pallas" still maps to the seeded champion.
function championsMentioned(text, resolver) {
  const hay = text.toLowerCase();
  const found = new Map(); // champion id -> { id, name }
  for (const key of resolver.keys) {
    const esc = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (new RegExp(`(^|[^a-z0-9])${esc}([^a-z0-9]|$)`, 'i').test(hay)) {
      const champ = resolver.resolve(key);
      if (champ) found.set(champ.id, champ);
    }
  }
  return [...found.values()];
}

// ── Main ─────────────────────────────────────────────────────────────────────
const client = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
await client.connect();
try {
  const resolver = await loadNameResolver(client); // champions.name + champion_aliases

  const { section, fullText } = await fetchRebalanceSection(url);
  const mentioned = championsMentioned(section ?? fullText, resolver);

  const results = [];
  for (const champ of mentioned) {
    const { rows } = await client.query(
      `select (select count(*) from champion_tags          where champion_id = $1 and status = 'approved') tags,
              (select count(*) from champion_solo_profiles where champion_id = $1 and status = 'approved') solos`,
      [champ.id],
    );
    const tags = Number(rows[0].tags), solos = Number(rows[0].solos);
    results.push({ name: champ.name, tags, solos, needsReview: tags > 0 || solos > 0 });
  }

  const date = new Date().toISOString().slice(0, 10);
  const review = results.filter((r) => r.needsReview);
  const clean = results.filter((r) => !r.needsReview);
  const out = [];
  out.push(`RSL patch review — ${date}`);
  out.push(`Source: ${url}`);
  out.push(section ? 'Champion Rebalance section: FOUND' : 'Champion Rebalance section: NOT FOUND — scanned the whole page; verify the mentioned list manually.');
  out.push(`Champions mentioned in scope: ${mentioned.length}`);
  out.push('');
  out.push(`⚠ NEEDS HUMAN REVIEW — approved tags/solo profiles vs the new skill text (${review.length}):`);
  if (review.length) for (const r of review) out.push(`  - ${r.name}: ${r.tags} approved tag(s), ${r.solos} approved solo profile(s)`);
  else out.push('  (none — no rebalanced champion has approved content)');
  out.push('');
  out.push(`Rebalanced but no approved content — no action needed (${clean.length}):`);
  if (clean.length) for (const r of clean) out.push(`  - ${r.name}`);
  else if (!mentioned.length) out.push('  (no DB champions matched — check the section manually / champion may not be seeded)');

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const outPath = path.join(OUT_DIR, `patch-review-${date}.txt`);
  fs.writeFileSync(outPath, out.join('\n') + '\n');
  console.log(out.join('\n'));
  console.log(`\n→ wrote ${outPath}`);
} finally {
  await client.end();
}
