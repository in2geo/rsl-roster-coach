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
            text: `This is a Raid: Shadow Legends Champions screen, sorted by Rank (or possibly the Champion Index).

**Champions screen (most common):** Shows a grid of champion cards. Each card has:
- A portrait image filling most of the card
- The champion NAME as text at the bottom of the card (e.g. "Kael", "Arbiter", "Lyssandra", "Warmaiden", "Elhain", "Athel")
- Level shown as "Lvl XX" (e.g. "Lvl 60")
- Stars shown as a row of 1–6 stars beneath or above the portrait
- Card border color indicates rarity: grey=Common, green=Uncommon, blue=Rare, purple=Epic, orange=Legendary, red/rainbow=Mythical

**Champion Index screen (alternative):** Groups champions under rarity section headers ("Mythical", "Legendary", "Epic", "Rare", "Uncommon", "Common"). Cards show name and role label but not level or stars — set those to 0.

Your task:
- Read every champion NAME from the text on each card — this is the most important field
- For the Champions screen: read the level number and star count directly from the card
- For the Index screen: set level to 0 and stars to 0, get rarity from the section header
- For the Champions screen: determine rarity from the card border color
- If a name is partially cut off at the edge, include your best guess rather than skipping it
- Scan the entire image top to bottom, left to right — do not skip any champion

Common champion names for reference: Kael, Elhain, Athel, Galek, Spirithost, Warmaiden, Armiger, Coldheart, Frozen Banshee, Apothecary, Bellower, Coffin Smasher, Skullcrusher, Juliana, High Khatun, Martyr, Renegade, Tayrel, Miscreated Monster, Rhazin Scarhide, Zavia, Lyssandra, Arbiter, Siphi the Lost Bride, Bad-el-Kazar, Krisk the Ageless.`,
          },
        ],
      },
    ],
  });

  const toolUse = response.content.find(b => b.type === 'tool_use');
  if (!toolUse) throw new Error('Vision model did not return structured data');

  const { champions, is_roster_screen } = toolUse.input;
  if (!is_roster_screen) throw new Error('not a roster screen');

  const named = champions.filter(c => c.name);
  if (!named.length) {
    throw new Error('Could not read champion names from the screenshot. Try a clearer, full-screen roster shot.');
  }
  return named;
}
