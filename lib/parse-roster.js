import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

/**
 * Send a roster screenshot to Claude vision and get back structured champion data.
 * Returns an array of { name, level, stars } objects.
 * Throws if the image doesn't look like a valid roster screen.
 */
export async function parseRosterScreenshot(imageBase64, mediaType) {
  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',  // fast + cheap for structured extraction
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
            text: `This is a screenshot from the mobile game Raid: Shadow Legends.
Extract every visible champion from this roster screen.
Return ONLY a JSON array — no explanation, no markdown fences.
Each element: { "name": string, "level": number, "stars": number }
"stars" is the ascension/star rank (1-6).
If a field is not readable, use null.
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
    throw new Error('Vision model returned unparseable output');
  }

  if (parsed.error) throw new Error(parsed.error);
  if (!Array.isArray(parsed)) throw new Error('Unexpected vision output shape');

  return parsed.filter(c => c.name);
}
