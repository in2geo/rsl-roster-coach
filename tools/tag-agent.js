/**
 * Tag Agent — batch-tags untagged RSL champions from the Fandom wiki.
 *
 * Usage:
 *   node tools/tag-agent.js
 *   node tools/tag-agent.js --rarity Epic
 *   node tools/tag-agent.js --name "Michelangelo"
 *   node tools/tag-agent.js --limit 20
 *
 * Outputs: tools/output/tags_<timestamp>.sql  (ready to paste into Supabase)
 *
 * Env vars needed (same as the app):
 *   ANTHROPIC_API_KEY
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_KEY
 */

import Anthropic                    from '@anthropic-ai/sdk';
import { createClient }             from '@supabase/supabase-js';
import { writeFileSync, mkdirSync, readFileSync } from 'fs';
import { parseArgs }                from 'util';

// Load .env file if present
try {
  const env = readFileSync('.env', 'utf8');
  for (const line of env.split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
  }
} catch { /* no .env file, env vars must be set externally */ }

// ── Config ─────────────────────────────────────────────────────────────────

const WIKI_BASE   = 'https://raid.fandom.com/wiki';
const DELAY_MS    = 1200;   // be polite to the wiki
const BATCH_SIZE  = 5;      // champions per Claude call

// ── CLI args ───────────────────────────────────────────────────────────────

const { values: args } = parseArgs({
  options: {
    rarity: { type: 'string' },
    name:   { type: 'string' },
    limit:  { type: 'string' },
  },
  strict: false,
});

// ── Clients ────────────────────────────────────────────────────────────────

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const supabase  = createClient(
  (process.env.SUPABASE_URL ?? '').replace(/\/rest\/v1\/?$/, ''),
  process.env.SUPABASE_SERVICE_KEY,
  { global: { fetch } }
);

// ── Supabase helpers ───────────────────────────────────────────────────────

async function getUntaggedChampions() {
  let query = supabase
    .from('champions')
    .select(`id, name, rarity, champion_tags(id, status)`)
    .order('name');

  if (args.name)   query = query.ilike('name', args.name);
  if (args.rarity) query = query.eq('rarity', args.rarity);

  const { data, error } = await query;
  if (error) throw new Error(`Supabase error: ${error.message}`);

  // Keep only champions with no approved tags
  const untagged = data.filter(c =>
    !c.champion_tags.some(t => t.status === 'approved')
  );

  const limit = args.limit ? parseInt(args.limit) : Infinity;
  return untagged.slice(0, limit);
}

async function getAllTags() {
  const { data, error } = await supabase.from('tags').select('id, name, description');
  if (error) throw new Error(`Tags error: ${error.message}`);
  return data;
}

// ── Fandom wiki scraper ────────────────────────────────────────────────────

async function fetchWikiPage(championName) {
  const slug = championName.replace(/ /g, '_');
  const url  = `${WIKI_BASE}/${encodeURIComponent(slug)}`;

  let res;
  try {
    res = await fetch(url, {
      headers: { 'User-Agent': 'RSLRosterCoach-TagAgent/1.0 (educational fan tool; contact b52surfer@gmail.com)' },
    });
  } catch (e) {
    return { url, text: null, error: e.message };
  }

  if (!res.ok) return { url, text: null, error: `HTTP ${res.status}` };

  const html = await res.text();

  // Extract skill descriptions from the wiki HTML.
  // Fandom RSL pages have skill data in <div class="skill-description"> blocks
  // and/or <td> cells with ability text. We grab all readable text sections.
  const text = extractReadableText(html, championName);
  return { url, text, error: null };
}

function extractReadableText(html, championName) {
  // Remove scripts, styles, navbars
  let clean = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<header[\s\S]*?<\/header>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '');

  // Extract text between tags
  clean = clean.replace(/<[^>]+>/g, ' ').replace(/\s{2,}/g, ' ').trim();

  // Find the section that mentions the champion name and skills
  // Take a 6000-char window around first mention of the champion name
  const idx = clean.toLowerCase().indexOf(championName.toLowerCase().split(' ')[0].toLowerCase());
  if (idx === -1) return clean.slice(0, 6000);

  const start = Math.max(0, idx - 200);
  return clean.slice(start, start + 6000);
}

// ── Claude tagger ──────────────────────────────────────────────────────────

async function tagChampions(batch, allTags) {
  const tagList = allTags.map(t => `- "${t.name}": ${t.description}`).join('\n');

  const championsText = batch.map(({ champion, wikiText }) => {
    const text = wikiText || '(no wiki data found)';
    return `CHAMPION: ${champion.name} (${champion.rarity})\nWIKI TEXT:\n${text}`;
  }).join('\n\n---\n\n');

  const prompt = `You are tagging Raid: Shadow Legends champions for a database.

AVAILABLE TAGS (use ONLY these exact names):
${tagList}

For each champion below, list only the tags that clearly apply based on their abilities described in the wiki text.
Be conservative — only tag what is explicitly stated. Do not infer or guess.
A champion that places [Decrease ATK] gets the "Decrease Attack" tag.
A champion with a [HP Burn] skill gets the "HP Burn" tag.
Ignore passive effects that are conditional or very situational.

${championsText}

Respond with a JSON array, one entry per champion:
[
  {
    "name": "Champion Name",
    "tags": ["Tag Name 1", "Tag Name 2"],
    "notes": "brief reason for each tag choice"
  }
]

Respond with ONLY the JSON array, no other text.`;

  const response = await anthropic.messages.create({
    model:      'claude-sonnet-4-6',
    max_tokens: 2048,
    messages:   [{ role: 'user', content: prompt }],
  });

  const text = response.content.find(b => b.type === 'text')?.text ?? '[]';

  try {
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    return JSON.parse(jsonMatch?.[0] ?? '[]');
  } catch {
    console.error('  ⚠ Could not parse Claude response:', text.slice(0, 200));
    return [];
  }
}

// ── SQL generator ──────────────────────────────────────────────────────────

function buildSQL(results, allTags) {
  const tagMap = new Map(allTags.map(t => [t.name, t.id]));
  const lines  = [];

  lines.push('-- Generated by tag-agent.js');
  lines.push('-- Status: proposed — review before approving');
  lines.push('-- Run the approval query after review:');
  lines.push('--   UPDATE champion_tags SET status=\'approved\' WHERE status=\'proposed\' AND id IN (...)');
  lines.push('');

  for (const { championId, championName, rarity, tags, notes, wikiUrl } of results) {
    if (!tags.length) {
      lines.push(`-- ${championName} (${rarity}): no tags identified`);
      continue;
    }

    lines.push(`-- ${championName} (${rarity}) — ${wikiUrl}`);
    if (notes) lines.push(`-- Notes: ${notes}`);

    for (const tagName of tags) {
      const tagId = tagMap.get(tagName);
      if (!tagId) {
        lines.push(`-- UNKNOWN TAG skipped: "${tagName}"`);
        continue;
      }
      lines.push(
        `INSERT INTO champion_tags (champion_id, tag_id, status) ` +
        `VALUES ('${championId}', '${tagId}', 'proposed') ON CONFLICT DO NOTHING;`
      );
    }
    lines.push('');
  }

  return lines.join('\n');
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log('🔍 Fetching untagged champions from Supabase…');
  const [champions, allTags] = await Promise.all([getUntaggedChampions(), getAllTags()]);

  if (!champions.length) {
    console.log('✅ No untagged champions found!');
    return;
  }

  console.log(`Found ${champions.length} untagged champions. Tags available: ${allTags.length}`);
  if (args.rarity) console.log(`  Filtering by rarity: ${args.rarity}`);

  const allResults = [];

  // Process in batches
  for (let i = 0; i < champions.length; i += BATCH_SIZE) {
    const chunk = champions.slice(i, i + BATCH_SIZE);
    console.log(`\nBatch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(champions.length / BATCH_SIZE)}: ${chunk.map(c => c.name).join(', ')}`);

    // Fetch wiki pages
    const wikiData = [];
    for (const champ of chunk) {
      process.stdout.write(`  📖 Fetching wiki: ${champ.name}… `);
      const { url, text, error } = await fetchWikiPage(champ.name);
      if (error) console.log(`⚠ ${error}`);
      else       console.log('✓');
      wikiData.push({ champion: champ, wikiText: text, wikiUrl: url });
      await new Promise(r => setTimeout(r, DELAY_MS));
    }

    // Ask Claude to tag them
    process.stdout.write(`  🤖 Asking Claude to tag ${chunk.length} champions… `);
    const tagged = await tagChampions(wikiData, allTags);
    console.log('✓');

    // Merge results
    for (const { champion, wikiUrl } of wikiData) {
      const found = tagged.find(t => t.name.toLowerCase() === champion.name.toLowerCase());
      allResults.push({
        championId:   champion.id,
        championName: champion.name,
        rarity:       champion.rarity,
        tags:         found?.tags  ?? [],
        notes:        found?.notes ?? '',
        wikiUrl,
      });
    }
  }

  // Write SQL output
  mkdirSync('tools/output', { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const outFile   = `tools/output/tags_${timestamp}.sql`;
  const sql       = buildSQL(allResults, allTags);
  writeFileSync(outFile, sql, 'utf8');

  // Summary
  const total    = allResults.length;
  const tagged   = allResults.filter(r => r.tags.length > 0).length;
  const untagged = total - tagged;

  console.log(`\n✅ Done!`);
  console.log(`   Champions processed : ${total}`);
  console.log(`   Successfully tagged : ${tagged}`);
  console.log(`   No tags found       : ${untagged}`);
  console.log(`   Output written to   : ${outFile}`);
  console.log('\nNext steps:');
  console.log('  1. Review the SQL file');
  console.log('  2. Paste into Supabase SQL editor and run');
  console.log('  3. Spot-check proposed tags then approve the ones that look right');
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
