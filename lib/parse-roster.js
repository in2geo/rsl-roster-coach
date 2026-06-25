import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

const client   = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const RARITY_FOLDERS = ['mythical', 'legendary', 'epic', 'rare'];

// Convert filename slug to display name: "ambassador_lethelin" → "Ambassador Lethelin"
function slugToName(slug) {
  return slug
    .replace(/\.jpg$/i, '')
    .split('_')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

// Fetch the list of portrait filenames for a given rarity folder
async function getPortraitList(rarity) {
  const { data, error } = await supabase.storage
    .from('portraits')
    .list(rarity, { limit: 500 });
  if (error) throw new Error(`Could not load ${rarity} portraits: ${error.message}`);
  return (data || []).map(f => f.name);
}

// Build a public URL for a portrait
function portraitUrl(rarity, filename) {
  const base = process.env.SUPABASE_URL.replace(/\/rest\/v1\/?$/, '');
  return `${base}/storage/v1/object/public/portraits/${rarity}/${filename}`;
}

/**
 * Step 1: Send the roster screenshot to Claude and get back a list of
 * { rarity, level, stars, position } for each visible champion card.
 * Position is a rough grid index (row, col) used for debugging only.
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
                rarity:   { type: 'string', enum: ['Mythical','Legendary','Epic','Rare','Uncommon','Common'] },
                level:    { type: 'integer' },
                stars:    { type: 'integer' },
                row:      { type: 'integer' },
                col:      { type: 'integer' },
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
        { type: 'text', text: `This is a Raid: Shadow Legends Champions screen (sorted By Rank).

Each champion card shows:
- A portrait image
- Level as "Lvl XX"
- Stars (1-6 shown as star icons)
- Border color indicates rarity: grey=Common, green=Uncommon, blue=Rare, purple=Epic, orange=Legendary, red/rainbow=Mythical

For EVERY card visible, record:
- rarity (from border color)
- level (number)
- stars (count of stars)
- row and col (grid position, starting at 0)

Do NOT try to read champion names — just rarity, level, stars, and position.
Scan every card top-to-bottom, left-to-right. Do not skip any.` },
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
 * Step 2: For each rarity group, send all cards of that rarity + all portrait
 * reference images for that rarity to Claude, and ask it to match each card
 * to a portrait filename.
 */
async function matchCardsToPortraits(imageBase64, mediaType, cards) {
  // Group cards by rarity folder
  const groups = {};
  for (const card of cards) {
    const folder = card.rarity.toLowerCase();
    if (!RARITY_FOLDERS.includes(folder)) continue; // skip Common/Uncommon — no portraits
    if (!groups[folder]) groups[folder] = [];
    groups[folder].push(card);
  }

  const results = [];

  for (const [rarity, rarityCards] of Object.entries(groups)) {
    const portraits = await getPortraitList(rarity);
    if (!portraits.length) continue;

    // Build content blocks: screenshot first, then all reference portraits
    const content = [
      { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageBase64 } },
      { type: 'text', text: `The first image is a Raid: Shadow Legends roster screenshot.
The following images are reference portraits for ${rarity} champions, each labelled with their filename.

For each ${rarity} champion card visible in the roster screenshot (identified by their ${rarity === 'legendary' ? 'orange' : rarity === 'epic' ? 'purple' : rarity === 'mythical' ? 'red/rainbow' : 'blue'} border), match it to one of the reference portraits below.

Return the filename (without .jpg) for each match, in grid order (top-to-bottom, left-to-right).` },
    ];

    // Add reference portrait images (URL-based to avoid huge payloads)
    for (const filename of portraits) {
      const url = portraitUrl(rarity, filename);
      content.push({ type: 'text', text: `Reference: ${filename.replace('.jpg', '')}` });
      content.push({ type: 'image', source: { type: 'url', url } });
    }

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      tools: [{
        name: 'match_portraits',
        description: `Match ${rarity} champion cards in the screenshot to reference portrait filenames`,
        input_schema: {
          type: 'object',
          properties: {
            matches: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  slug:  { type: 'string', description: 'Portrait filename without .jpg extension' },
                  row:   { type: 'integer' },
                  col:   { type: 'integer' },
                },
                required: ['slug', 'row', 'col'],
              },
            },
          },
          required: ['matches'],
        },
      }],
      tool_choice: { type: 'tool', name: 'match_portraits' },
      messages: [{ role: 'user', content }],
    });

    const toolUse = response.content.find(b => b.type === 'tool_use');
    if (!toolUse) continue;

    for (const match of toolUse.input.matches || []) {
      const card = rarityCards.find(c => c.row === match.row && c.col === match.col);
      if (!card) continue;
      results.push({
        name:   slugToName(match.slug),
        rarity: card.rarity,
        level:  card.level,
        stars:  card.stars,
      });
    }
  }

  return results;
}

/**
 * Main export: parse a roster screenshot and return champion data.
 */
export async function parseRosterScreenshot(imageBase64, mediaType) {
  // Step 1: detect all cards (rarity, level, stars, position)
  const cards = await detectCards(imageBase64, mediaType);
  if (!cards.length) {
    throw new Error('Could not detect any champion cards in the screenshot. Try a clearer, full-screen roster shot.');
  }

  // Step 2: match portraits for Mythical/Legendary/Epic/Rare
  const matched = await matchCardsToPortraits(imageBase64, mediaType, cards);

  // Also include Common/Uncommon from step 1 — no portrait matching, name will be blank
  // (match engine only needs Rare+ for meaningful recommendations anyway)
  if (!matched.length) {
    throw new Error('Could not match any champions to the portrait database. Try a clearer screenshot.');
  }

  return matched;
}
