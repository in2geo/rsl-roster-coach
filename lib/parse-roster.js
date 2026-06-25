import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

const client   = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const RARITY_FOLDERS = ['mythical', 'legendary', 'epic', 'rare'];
const BATCH_SIZE = 20; // portraits per Claude call

function slugToName(slug) {
  return slug
    .replace(/\.jpg$/i, '')
    .split('_')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

async function getPortraitList(rarity) {
  const { data, error } = await supabase.storage
    .from('portraits')
    .list(rarity, { limit: 500 });
  if (error) throw new Error(`Could not load ${rarity} portraits: ${error.message}`);
  return (data || []).map(f => f.name);
}

// Fetch a portrait from Supabase storage and return base64
async function fetchPortraitAsBase64(rarity, filename) {
  const { data, error } = await supabase.storage
    .from('portraits')
    .download(`${rarity}/${filename}`);
  if (error) throw new Error(`Failed to fetch portrait ${rarity}/${filename}: ${error.message}`);
  const buf = await data.arrayBuffer();
  return Buffer.from(buf).toString('base64');
}

/**
 * Step 1: Detect cards — rarity, level, stars, grid position.
 * No name reading — just structure.
 */
async function detectCards(imageBase64, mediaType) {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    tools: [{
      name: 'detect_cards',
      description: 'Detect each champion card in a Raid: Shadow Legends roster screenshot',
      input_schema: {
        type: 'object',
        properties: {
          is_roster_screen: { type: 'boolean' },
          cards: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                rarity: { type: 'string', enum: ['Mythical','Legendary','Epic','Rare','Uncommon','Common'] },
                level:  { type: 'integer' },
                stars:  { type: 'integer' },
                row:    { type: 'integer' },
                col:    { type: 'integer' },
              },
              required: ['rarity', 'level', 'stars', 'row', 'col'],
            },
          },
        },
        required: ['is_roster_screen', 'cards'],
      },
    }],
    tool_choice: { type: 'tool', name: 'detect_cards' },
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageBase64 } },
        { type: 'text', text: `This is a Raid: Shadow Legends Champions screen sorted By Rank.

Each card shows a portrait, level ("Lvl XX"), and stars (1-6).
Border color = rarity: grey=Common, green=Uncommon, blue=Rare, purple=Epic, orange=Legendary, red/rainbow=Mythical.

Record every card: rarity, level, stars, and grid position (row/col starting at 0).
Do NOT attempt to read champion names — just rarity, level, stars, position.
Scan top-to-bottom, left-to-right. Do not skip any card.` },
      ],
    }],
  });

  const toolUse = response.content.find(b => b.type === 'tool_use');
  if (!toolUse) throw new Error('Vision model did not return card data');
  const { is_roster_screen, cards } = toolUse.input;
  if (!is_roster_screen) throw new Error('not a roster screen');
  return cards || [];
}

/**
 * Step 2: For a single card, match it against a batch of reference portraits.
 * Returns the best matching slug or null.
 */
async function matchCardToBatch(screenshotBase64, mediaType, card, batch, rarity) {
  const content = [
    { type: 'image', source: { type: 'base64', media_type: mediaType, data: screenshotBase64 } },
    { type: 'text', text: `This roster screenshot contains a ${rarity} champion at grid position row=${card.row}, col=${card.col} (0-indexed, top-left is 0,0).

Below are reference portrait images. Identify which reference portrait best matches the champion at that grid position.
Return the slug (filename without .jpg) of the best match, or null if none match.` },
  ];

  for (const { slug, base64 } of batch) {
    content.push({ type: 'text', text: `Reference: ${slug}` });
    content.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: base64 } });
  }

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 256,
    tools: [{
      name: 'portrait_match',
      description: 'Return the best matching portrait slug for the champion card',
      input_schema: {
        type: 'object',
        properties: {
          slug:       { type: 'string', description: 'Matched portrait slug (filename without .jpg), or empty string if no match' },
          confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
        },
        required: ['slug', 'confidence'],
      },
    }],
    tool_choice: { type: 'tool', name: 'portrait_match' },
    messages: [{ role: 'user', content }],
  });

  const toolUse = response.content.find(b => b.type === 'tool_use');
  if (!toolUse) return null;
  const { slug, confidence } = toolUse.input;
  if (!slug || confidence === 'low') return null;
  return slug;
}

/**
 * Step 3: For each rarity group, match cards to portraits in batches.
 */
async function matchCardsToPortraits(imageBase64, mediaType, cards) {
  const groups = {};
  for (const card of cards) {
    const folder = card.rarity.toLowerCase();
    if (!RARITY_FOLDERS.includes(folder)) continue;
    if (!groups[folder]) groups[folder] = [];
    groups[folder].push(card);
  }

  const results = [];

  for (const [rarity, rarityCards] of Object.entries(groups)) {
    const filenames = await getPortraitList(rarity);
    if (!filenames.length) continue;

    // Pre-fetch all portraits for this rarity as base64 (in parallel, capped)
    console.log(`Fetching ${filenames.length} ${rarity} portraits...`);
    const portraitData = [];
    for (let i = 0; i < filenames.length; i += 10) {
      const batch = filenames.slice(i, i + 10);
      const fetched = await Promise.all(batch.map(async filename => ({
        slug: filename.replace('.jpg', ''),
        base64: await fetchPortraitAsBase64(rarity, filename),
      })));
      portraitData.push(...fetched);
    }

    // For each card in this rarity, find the best match across batches
    for (const card of rarityCards) {
      let bestSlug = null;

      for (let i = 0; i < portraitData.length; i += BATCH_SIZE) {
        const batch = portraitData.slice(i, i + BATCH_SIZE);
        const slug = await matchCardToBatch(imageBase64, mediaType, card, batch, rarity);
        if (slug) { bestSlug = slug; break; }
      }

      if (bestSlug) {
        results.push({
          name:   slugToName(bestSlug),
          rarity: card.rarity,
          level:  card.level,
          stars:  card.stars,
        });
      }
    }
  }

  return results;
}

export async function parseRosterScreenshot(imageBase64, mediaType) {
  const cards = await detectCards(imageBase64, mediaType);
  if (!cards.length) {
    throw new Error('Could not detect any champion cards. Try a clearer, full-screen roster shot.');
  }
  console.log(`Detected ${cards.length} cards`);

  const matched = await matchCardsToPortraits(imageBase64, mediaType, cards);
  if (!matched.length) {
    throw new Error('Could not match any champions to the portrait database. Try a clearer screenshot.');
  }

  console.log(`Matched ${matched.length} champions`);
  return matched;
}
