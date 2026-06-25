import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

const client   = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

function slugToName(slug) {
  return slug
    .replace(/\.jpg$/i, '')
    .split('_')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

// Load all champion names from the portraits bucket (one list call per rarity)
async function getAllChampionNames() {
  const rarities = ['mythical', 'legendary', 'epic', 'rare'];
  const byRarity = {};

  await Promise.all(rarities.map(async rarity => {
    const { data, error } = await supabase.storage
      .from('portraits')
      .list(rarity, { limit: 500 });
    if (error) { byRarity[rarity] = []; return; }
    byRarity[rarity] = (data || []).map(f => slugToName(f.name));
  }));

  return byRarity;
}

export async function parseRosterScreenshot(imageBase64, mediaType) {
  // Load champion name lists from bucket (just filenames, no image downloads)
  const byRarity = await getAllChampionNames();

  const allNames = Object.entries(byRarity)
    .map(([rarity, names]) => `${rarity.toUpperCase()}:\n${names.join(', ')}`)
    .join('\n\n');

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    tools: [{
      name: 'extract_champions',
      description: 'Extract champion data from a Raid: Shadow Legends roster screenshot',
      input_schema: {
        type: 'object',
        properties: {
          is_roster_screen: { type: 'boolean' },
          champions: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name:   { type: 'string' },
                rarity: { type: 'string', enum: ['Mythical','Legendary','Epic','Rare','Uncommon','Common'] },
                level:  { type: 'integer' },
                stars:  { type: 'integer' },
              },
              required: ['name', 'rarity', 'level', 'stars'],
            },
          },
        },
        required: ['is_roster_screen', 'champions'],
      },
    }],
    tool_choice: { type: 'tool', name: 'extract_champions' },
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageBase64 } },
        { type: 'text', text: `This is a Raid: Shadow Legends Champions screen sorted By Rank.

Each card shows a champion portrait, level ("Lvl XX"), and stars (1-6).
Border color = rarity: grey=Common, green=Uncommon, blue=Rare, purple=Epic, orange=Legendary, red/rainbow=Mythical.

Below is the COMPLETE list of valid champion names organised by rarity.
Identify each champion in the screenshot by their portrait appearance and match them to a name from the list below.
You MUST only return names from this list — do not invent names.

${allNames}

For each champion card:
- Match the portrait to a name from the list above
- Read the level number
- Count the stars
- Determine rarity from border color

Scan every card top-to-bottom, left-to-right. Do not skip any.` },
      ],
    }],
  });

  const toolUse = response.content.find(b => b.type === 'tool_use');
  if (!toolUse) throw new Error('Vision model did not return structured data');

  const { is_roster_screen, champions } = toolUse.input;
  if (!is_roster_screen) throw new Error('not a roster screen');

  const named = champions.filter(c => c.name);
  if (!named.length) {
    throw new Error('Could not identify any champions. Try a clearer, full-screen roster shot.');
  }

  return named;
}
