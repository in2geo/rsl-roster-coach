import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

const client   = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const MATCH_RARITIES = ['mythical', 'legendary', 'epic', 'rare'];

function slugToName(slug) {
  return slug.replace(/\.jpg$/i, '').split('_')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function nameToSlug(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

// Get all portrait slugs for a rarity (just filenames, no download)
async function getPortraitSlugs(rarity) {
  const { data, error } = await supabase.storage
    .from('portraits')
    .list(rarity, { limit: 500 });
  if (error) return [];
  return (data || []).map(f => f.name.replace(/\.jpg$/i, ''));
}

// Download a single portrait as base64
async function fetchPortrait(rarity, slug) {
  const { data, error } = await supabase.storage
    .from('portraits')
    .download(`${rarity}/${slug}.jpg`);
  if (error) return null;
  const buf = await data.arrayBuffer();
  return Buffer.from(buf).toString('base64');
}

/**
 * Step 1: Read the screenshot and extract as much as possible — rarity,
 * level, stars, and a best-guess name from the text on each card.
 * Names may be wrong/partial but give us candidates to look up.
 */
async function readCards(imageBase64, mediaType, allSlugsByRarity) {
  const slugList = Object.entries(allSlugsByRarity)
    .map(([r, slugs]) => `${r.toUpperCase()}: ${slugs.join(', ')}`)
    .join('\n');

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    tools: [{
      name: 'read_cards',
      description: 'Read champion cards from a Raid: Shadow Legends screenshot',
      input_schema: {
        type: 'object',
        properties: {
          is_roster_screen: { type: 'boolean' },
          cards: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                rarity:          { type: 'string', enum: ['Mythical','Legendary','Epic','Rare','Uncommon','Common'] },
                level:           { type: 'integer' },
                stars:           { type: 'integer' },
                index:           { type: 'integer' },
                name_candidates: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Up to 3 slugs from the provided list that best match what you see on this card',
                },
              },
              required: ['rarity', 'level', 'stars', 'index', 'name_candidates'],
            },
          },
        },
        required: ['is_roster_screen', 'cards'],
      },
    }],
    tool_choice: { type: 'tool', name: 'read_cards' },
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageBase64 } },
        { type: 'text', text: `This is a Raid: Shadow Legends Champions screen sorted By Rank.

Each card shows: a portrait, level ("Lvl XX"), stars (1-6), and the champion name as text.
Border color = rarity: grey=Common, green=Uncommon, blue=Rare, purple=Epic, orange=Legendary, red/rainbow=Mythical.

IMPORTANT: Focus ONLY on the small champion card thumbnails in the grid on the left side of the screen.
Ignore any large detail panel, champion info panel, or large portrait on the right side — those are not cards to identify.
Ignore Common (grey border) and Uncommon (green border) cards entirely.

For each Rare/Epic/Legendary/Mythical card in the grid:
- Record rarity (from border color), level, stars, index (0-based, left-to-right top-to-bottom)
- Read the name text printed on the card thumbnail itself
- Match it to 1-3 slugs from the list below that best match what you can read or see
- If you cannot read the name clearly, return your best 3 visual matches from the list
- Only return slugs from the list below — never invent names

VALID SLUGS:
${slugList}` },
      ],
    }],
  });

  const toolUse = response.content.find(b => b.type === 'tool_use');
  if (!toolUse) throw new Error('Vision model did not return card data');
  const { is_roster_screen, cards } = toolUse.input;
  if (!is_roster_screen) throw new Error('not a roster screen');
  return (cards || []).filter(c => MATCH_RARITIES.includes(c.rarity.toLowerCase()));
}

/**
 * Step 2: For cards with multiple candidates, download just those portraits
 * and ask Claude to pick the best visual match.
 */
async function resolveAmbiguous(screenshotBase64, mediaType, card, candidates, rarity) {
  // Download only the candidate portraits (2-3 images max)
  const portraits = (await Promise.all(
    candidates.map(async slug => {
      const base64 = await fetchPortrait(rarity, slug);
      return base64 ? { slug, base64 } : null;
    })
  )).filter(Boolean);

  if (!portraits.length) return candidates[0]; // fallback to first candidate
  if (portraits.length === 1) return portraits[0].slug;

  const content = [
    { type: 'text', text: `The next image is a roster screenshot. Focus on the champion card at position ${card.index} (0-indexed, left-to-right top-to-bottom). Which of the following reference portraits matches it best?` },
    { type: 'image', source: { type: 'base64', media_type: mediaType, data: screenshotBase64 } },
  ];
  for (const { slug, base64 } of portraits) {
    content.push({ type: 'text', text: slug });
    content.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: base64 } });
  }

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 128,
    tools: [{
      name: 'pick_match',
      description: 'Pick the best matching portrait slug',
      input_schema: {
        type: 'object',
        properties: { slug: { type: 'string' } },
        required: ['slug'],
      },
    }],
    tool_choice: { type: 'tool', name: 'pick_match' },
    messages: [{ role: 'user', content }],
  });

  const toolUse = response.content.find(b => b.type === 'tool_use');
  return toolUse?.input?.slug || candidates[0];
}

export async function parseRosterScreenshot(imageBase64, mediaType) {
  // Load slug lists for all rarities (4 fast Supabase list calls, no downloads)
  console.log('Loading portrait slug lists...');
  const allSlugsByRarity = {};
  await Promise.all(MATCH_RARITIES.map(async rarity => {
    allSlugsByRarity[rarity] = await getPortraitSlugs(rarity);
  }));

  const totalSlugs = Object.values(allSlugsByRarity).reduce((s, a) => s + a.length, 0);
  console.log(`Loaded ${totalSlugs} slugs across ${MATCH_RARITIES.length} rarities`);

  // Step 1: read all cards + get name candidates from text/visual in one call
  const cards = await readCards(imageBase64, mediaType, allSlugsByRarity);
  console.log(`Read ${cards.length} matchable cards`);

  if (!cards.length) {
    throw new Error('No Rare or higher champions found. Try a clearer screenshot.');
  }

  // Step 2: resolve each card — if 1 candidate use it directly, if 2-3 do visual match
  const results = [];
  for (const card of cards) {
    const candidates = card.name_candidates || [];
    if (!candidates.length) {
      console.log(`  Card ${card.index}: no candidates, skipping`);
      continue;
    }

    let slug;
    if (candidates.length === 1) {
      slug = candidates[0];
      console.log(`  Card ${card.index} (${card.rarity}): direct match "${slug}"`);
    } else {
      slug = await resolveAmbiguous(imageBase64, mediaType, card, candidates, card.rarity.toLowerCase());
      console.log(`  Card ${card.index} (${card.rarity}): resolved to "${slug}" from ${candidates.length} candidates`);
    }

    results.push({
      name:   slugToName(slug),
      rarity: card.rarity,
      level:  card.level,
      stars:  card.stars,
    });
  }

  if (!results.length) {
    throw new Error('Could not identify any champions. Try a clearer screenshot.');
  }

  console.log(`Matched ${results.length}/${cards.length} champions`);
  return results;
}
