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
    max_tokens: 2048,
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
                  name:  { type: 'string',  description: 'Champion name as shown on the card' },
                  level: { type: 'integer', description: 'Level number shown on the card' },
                  stars: { type: 'integer', description: 'Star rank 1-6' },
                },
                required: ['name', 'level', 'stars'],
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
            text: 'This is a Raid: Shadow Legends champion roster screenshot. Extract every visible champion — name, level, and star rank.',
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
