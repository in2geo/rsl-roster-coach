import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

/**
 * Send a roster screenshot to Claude vision and get back structured champion data.
 * Returns an array of { name, level, stars } objects.
 * Throws if the image doesn't look like a valid roster screen.
 */
export async function parseRosterScreenshot(imageBase64, mediaType) {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    tools: [
      {
        name: 'extract_champions',
        description: 'Extract champion data from a Raid: Shadow Legends roster screenshot',
        input_schema: {
          type: 'object',
          properties: {
            champions: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name:   { type: 'string',  description: 'Champion name as shown on the card' },
                  level:  { type: 'integer', description: 'Level number shown on the card' },
                  stars:  { type: 'integer', description: 'Star rank 1-6' },
                  rarity: { type: 'string',  description: 'Card frame color: Common (grey), Uncommon (green), Rare (blue), Epic (purple), Legendary (orange), Mythical (red/rainbow)' },
                },
                required: ['name', 'level', 'stars', 'rarity'],
              },
            },
            is_roster_screen: {
              type: 'boolean',
              description: 'Whether this looks like a Raid roster screen',
            },
          },
          required: ['champions', 'is_roster_screen'],
        },
      },
    ],
    tool_choice: { type: 'tool', name: 'extract_champions' },
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mediaType, data: imageBase64 },
          },
          {
            type: 'text',
            text: `This is a Raid: Shadow Legends champion roster screenshot showing a grid of champion portrait cards.

Your task is to identify every champion visible by recognising their portrait artwork — the character's appearance, colours, costume, and design. Champion names are NOT shown as readable text on these cards, so you must identify them visually.

For each card:
- Identify the champion by their portrait art (you know RSL champions well from training)
- Read the frame colour to determine rarity: grey=Common, green=Uncommon, blue=Rare, purple=Epic, orange/gold=Legendary, red/rainbow=Mythical
- Read the star count (1-6 stars shown at the bottom of the card)
- Read the level number if visible

Scan the ENTIRE image from top-left to bottom-right, row by row. Extract every card — there are typically 20-60+ champions visible.

Only name a champion if you are confident you recognise the portrait. If you cannot identify a portrait, still include the card with name="" so the user can fill it in.`,
          },
        ],
      },
    ],
  });

  const toolUse = response.content.find(b => b.type === 'tool_use');
  if (!toolUse) throw new Error('Vision model did not return structured data');

  const { champions, is_roster_screen } = toolUse.input;
  if (!is_roster_screen) throw new Error('not a roster screen');

  const parsed = champions;

  if (parsed.error) throw new Error(parsed.error);
  if (!Array.isArray(parsed)) throw new Error('Unexpected vision output shape');

  const named = parsed.filter(c => c.name);
  if (!named.length && parsed.length > 0) {
    throw new Error('Could not read champion names from the screenshot. Try a clearer, full-screen roster shot.');
  }
  return named;
}
