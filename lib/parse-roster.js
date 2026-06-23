import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

/**
 * Send a roster screenshot to Claude vision and get back structured champion data.
 * Returns an array of { name, level, stars } objects.
 * Throws if the image doesn't look like a valid roster screen.
 */
export async function parseRosterScreenshot(imageBase64, mediaType) {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',  // better at reading small text in game UI screenshots
    max_tokens: 1024,
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
            text: `This is a screenshot from the mobile game Raid: Shadow Legends showing the champion roster grid.
Each champion card shows: the champion's name (text label below or on the portrait), their level (number shown on the card), and their star rank (1-6 stars shown at the bottom of the card).

Extract every visible champion. Return ONLY a JSON array — no explanation, no markdown fences, no code blocks.
Each element: { "name": string, "level": number, "stars": number }
- "name": the champion's name as shown on the card (e.g. "Kael", "Warpriest", "Apothecary"). Look carefully at the text on each card.
- "level": the numeric level shown on the card
- "stars": the star rank (count the gold/colored stars, 1-6)
If a specific field is not readable, use null for that field only.
If this does not look like a Raid roster screen, return: { "error": "not a roster screen" }`,
          },
        ],
      },
    ],
  });

  let text = response.content[0]?.text?.trim() ?? '';

  // Strip markdown code fences if the model wrapped the JSON
  text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`Vision model returned unparseable output: ${text.slice(0, 300)}`);
  }

  if (parsed.error) throw new Error(parsed.error);
  if (!Array.isArray(parsed)) throw new Error('Unexpected vision output shape');

  const named = parsed.filter(c => c.name);
  if (!named.length && parsed.length > 0) {
    throw new Error('Could not read champion names from the screenshot. Try a clearer, full-screen roster shot.');
  }
  return named;
}
