import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

/**
 * Turn a deterministic match result into a plain-language explanation.
 * The AI explains a decision already made — it never invents recommendations.
 */
export async function generateExplanation(matchResult) {
  const { content_label, team, gaps, coverage } = matchResult;

  const teamDesc = team.map(c =>
    `- ${c.name} (${c.rarity}, Lv ${c.level}, ★${c.stars}) — tags: ${c.tags.join(', ') || 'none tagged yet'}`
  ).join('\n');

  const coverageDesc = Object.values(coverage)
    .map(g => `• Goal: "${g.description}" — ${g.satisfied ? `covered by: ${g.solution_label}` : 'NOT COVERED'}`)
    .join('\n');

  const gapsDesc = gaps.length
    ? `The player is MISSING coverage for:\n${gaps.map(g => `• ${g}`).join('\n')}`
    : 'All goals are covered by this team.';

  const prompt = `You are a friendly, concise coach for new Raid: Shadow Legends players.
The player asked for help with: ${content_label}.

The matching engine (not you) selected this team from their roster:
${teamDesc}

Goal coverage analysis:
${coverageDesc}

${gapsDesc}

Write a plain-language explanation (3-6 sentences) addressed directly to the player ("your team", "you want to").
- Say WHY each champion is in the team (what role/tag they cover).
- If there are gaps, name each gap explicitly — never skip or soften them.
- Do not invent advice beyond what the coverage analysis shows.
- Tone: encouraging but honest. No jargon that a new player wouldn't know.
- Do not start with "Sure" or any filler phrase.`;

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 512,
    messages: [{ role: 'user', content: prompt }],
  });

  return response.content[0]?.text?.trim() ?? '';
}
