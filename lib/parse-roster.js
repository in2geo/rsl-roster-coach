import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

const client   = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const MATCH_RARITIES = ['mythical', 'legendary', 'epic', 'rare'];
const BATCH_SIZE = 25;

function slugToName(slug) {
  return slug
    .replace(/\.jpg$/i, '')
    .split('_')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

// Download a portrait from Supabase storage as base64
async function fetchPortrait(rarity, filename) {
  const { data, error } = await supabase.storage
    .from('portraits')
    .download(`${rarity}/${filename}`);
  if (error) throw new Error(`Failed to fetch ${rarity}/${filename}: ${error.message}`);
  const buf = await data.arrayBuffer();
  return Buffer.from(buf).toString('base64');
}

// Get portrait filenames for a rarity folder
async function getPortraitList(rarity) {
  const { data, error } = await supabase.storage
    .from('portraits')
    .list(rarity, { limit: 500 });
  if (error) return [];
  return (data || []).map(f => f.name);
}

/**
 * Step 1: Send the screenshot to Claude to detect which cards are visible
 * and their rarity. Skip Common/Uncommon entirely.
 */
async function detectCards(imageBase64, mediaType) {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    tools: [{
      name: 'detect_cards',
      description: 'Detect champion cards in a Raid: Shadow Legends roster screenshot',
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
                index:  { type: 'integer', description: 'Card position 0-indexed left-to-right, top-to-bottom' },
              },
              required: ['rarity', 'level', 'stars', 'index'],
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
        { type: 'text', text: `This is a Raid: Shadow Legends Champions screen.

For every champion card visible, record:
- rarity from border color: grey=Common, green=Uncommon, blue=Rare, purple=Epic, orange=Legendary, red/rainbow=Mythical
- level (the number shown as "Lvl XX")
- stars (count of star icons, 1-6)
- index (position counting left-to-right, top-to-bottom starting at 0)

Ignore Common (grey border) and Uncommon (green border) cards entirely — do not include them.
Record every Rare, Epic, Legendary, and Mythical card.` },
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
 * Step 2: For a single card, find its match by sending the screenshot +
 * a batch of reference portraits to Claude.
 * Returns the matched slug or null.
 */
async function matchCard(screenshotBase64, mediaType, card, portraits) {
  // Try each batch until we get a confident match
  for (let i = 0; i < portraits.length; i += BATCH_SIZE) {
    const batch = portraits.slice(i, i + BATCH_SIZE);

    const content = [
      {
        type: 'text',
        text: `The next image is a Raid: Shadow Legends roster screenshot.
Focus on the champion card at position ${card.index} (0-indexed, left-to-right top-to-bottom).
It is a ${card.rarity} champion (level ${card.level}, ${card.stars} stars).

The images after it are reference portraits, each preceded by their name.
Identify which reference portrait matches the champion at position ${card.index}.
Return the slug of the match, or empty string if none in this batch match.`,
      },
      { type: 'image', source: { type: 'base64', media_type: mediaType, data: screenshotBase64 } },
    ];

    for (const { slug, base64 } of batch) {
      content.push({ type: 'text', text: slug });
      content.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: base64 } });
    }

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 256,
      tools: [{
        name: 'portrait_match',
        description: 'Return the matching portrait slug for this champion card',
        input_schema: {
          type: 'object',
          properties: {
            slug:       { type: 'string', description: 'Matched slug, or empty string if no match in this batch' },
            confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
          },
          required: ['slug', 'confidence'],
        },
      }],
      tool_choice: { type: 'tool', name: 'portrait_match' },
      messages: [{ role: 'user', content }],
    });

    const toolUse = response.content.find(b => b.type === 'tool_use');
    if (!toolUse) continue;
    const { slug, confidence } = toolUse.input;
    if (slug && confidence !== 'low') {
      console.log(`  Card ${card.index} (${card.rarity}): matched "${slug}" [${confidence}]`);
      return slug;
    }
  }

  console.log(`  Card ${card.index} (${card.rarity}): no match found`);
  return null;
}

export async function parseRosterScreenshot(imageBase64, mediaType) {
  // Step 1: detect cards (rarity, level, stars, position)
  const cards = await detectCards(imageBase64, mediaType);
  console.log(`Detected ${cards.length} matchable cards (Rare+)`);

  if (!cards.length) {
    throw new Error('No Rare or higher champions found in screenshot.');
  }

  // Step 2: group cards by rarity and load portraits for each rarity present
  const raritiesNeeded = [...new Set(cards.map(c => c.rarity.toLowerCase()))];
  console.log(`Rarities needed: ${raritiesNeeded.join(', ')}`);

  const portraitsByRarity = {};
  for (const rarity of raritiesNeeded) {
    const filenames = await getPortraitList(rarity);
    console.log(`Fetching ${filenames.length} ${rarity} portraits...`);
    // Fetch all portraits for this rarity in parallel batches of 10
    const portraits = [];
    for (let i = 0; i < filenames.length; i += 10) {
      const batch = filenames.slice(i, i + 10);
      const fetched = await Promise.all(
        batch.map(async filename => ({
          slug:   filename.replace(/\.jpg$/i, ''),
          base64: await fetchPortrait(rarity, filename),
        }))
      );
      portraits.push(...fetched);
    }
    portraitsByRarity[rarity] = portraits;
    console.log(`Loaded ${portraits.length} ${rarity} portraits`);
  }

  // Step 3: match each card against its rarity's portraits
  const results = [];
  for (const card of cards) {
    const portraits = portraitsByRarity[card.rarity.toLowerCase()] || [];
    const slug = await matchCard(imageBase64, mediaType, card, portraits);
    if (slug) {
      results.push({
        name:   slugToName(slug),
        rarity: card.rarity,
        level:  card.level,
        stars:  card.stars,
      });
    }
  }

  if (!results.length) {
    throw new Error('Could not match any champions. Try a clearer screenshot.');
  }

  console.log(`Matched ${results.length}/${cards.length} champions`);
  return results;
}
