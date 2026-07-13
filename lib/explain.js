import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// The system prompt fixes the AI's role and its two grounded knowledge sources:
//   1. Tag-based RSL knowledge — encoded in the deterministic match result the
//      engine produces (goal coverage, gaps, thresholds). The AI explains this;
//      it never re-decides the team.
//   2. Real account data — the player's actual roster + battle history, passed in
//      the `context` block. The AI may reference what the player owns and how
//      their recent runs went, but must not contradict the match result.
const SYSTEM_PROMPT = `You are a friendly, concise coach for new Raid: Shadow Legends players.

THE ENGINE'S STRUCTURED OUTPUT IS GROUND TRUTH. A separate deterministic matching engine has already chosen the team and computed its verdict, goal coverage, and number of gaps. Your only job is to EXPLAIN and CONTEXTUALIZE that decision in plain language. You never re-decide it, override it, or second-guess it.

You have two grounded sources of truth and MUST stay within them:
1. The engine's structured output: the chosen team, the verdict (ready / not ready), the gap COUNT, and per-goal coverage. This is authoritative.
2. The player's real account data: their actual roster (levels, stars, ascension, gear) and recent battle history.

Hard rules — never break these:
- NEVER contradict the engine's structured output. It is always right; you only explain it.
  • If the engine reports gaps = 0, the team has NO coverage holes. Do NOT mention missing roles, a missing healer/debuffer/tank, holes in coverage, or any composition weakness — there are none. (You may still suggest gear or level investment, but never frame it as a coverage gap.)
  • If the engine reports gaps > 0, name each gap exactly as given — never add gaps it did not report, never soften or skip the ones it did.
  • If the verdict is "ready", do not say or imply the team is not ready, is composition-risky, or needs more pieces.
- Never invent champions, tags, gaps, or advice beyond these two sources.
- Reference real account signals when they add value (e.g. "your recent Spider 3 runs have been clearing" or "Pelops is already at level 50"), but only if present in the data.
- Plain language a new player understands. No filler openers ("Sure", "Certainly").`;

function describeTeam(team = []) {
  return team.map(c =>
    `- ${c.name} (${c.rarity}, Lv ${c.level}, ★${c.stars}) — tags: ${c.tags?.join(', ') || 'none tagged yet'}`
  ).join('\n');
}

function describeCoverage(coverage = {}) {
  return Object.values(coverage)
    .map(g => `• Goal: "${g.description}" — ${g.satisfied ? `covered by: ${g.solution_label}` : 'NOT COVERED'}`)
    .join('\n');
}

function describeBattleHistory(history = []) {
  if (!history.length) return 'No recorded battle history yet.';
  return history.map(s => {
    const wl = `${s.victories}W/${s.defeats}L`;
    const best = s.bestTurns != null ? `, best ${s.bestTurns} turns` : '';
    const retreats = s.retreats ? `, ${s.retreats} retreat(s)` : '';
    return `• ${s.stage}: ${s.attempts} attempt(s) (${wl}${best}${retreats}), last result ${s.lastResult ?? 'n/a'}`;
  }).join('\n');
}

/**
 * Turn a deterministic match result into a plain-language explanation, grounded
 * in both the tag-based analysis and the player's real account data.
 *
 * @param {object} matchResult - output of matchRoster()
 * @param {object} [context]   - { account, roster, battleHistory } from buildContext()
 */
export async function generateExplanation(matchResult, context = null) {
  const {
    content_label, team, gaps = [], coverage = {}, verdict = null,
    boss_exceptions = [], style_notes = [], stage_number_attempted = null,
    cb_damage = null,
  } = matchResult;

  const gapCount = gaps.length;
  const isReady  = verdict ? verdict === 'ready' : gapCount === 0;

  // Mechanic carve-outs the player must respect at this stage (e.g. Frigid
  // Vengeance, Max-HP-damage caps). Weave the relevant ones into the explanation.
  const bossSection = boss_exceptions.length
    ? `\n\nSTAGE / BOSS EXCEPTIONS (mechanic warnings — surface the relevant ones):\n${boss_exceptions.map(b => `• ${b}`).join('\n')}`
    : '';

  // Human-authored guidance on HOW to phrase this dungeon's advice. Some notes are
  // stage-banded (e.g. Ice Golem 10-13 relaxed vs 14+ cautious), so the actual stage
  // number is passed in so the model applies the right band.
  const styleSection = style_notes.length
    ? `\n\nEXPLANATION STYLE GUIDANCE (author's intent — follow it; do not over- or under-warn):\n${style_notes.map(n => `• ${n.topic}: ${n.note}`).join('\n')}${stage_number_attempted != null ? `\n(This recommendation is for stage ${stage_number_attempted} — apply any stage-banded tone above to THIS stage specifically.)` : ''}`
    : '';

  const gapsDesc = gapCount
    ? `The player is MISSING coverage for:\n${gaps.map(g => `• ${g}`).join('\n')}`
    : 'All goals are covered by this team. There are NO coverage holes.';

  // Clan Boss damage attribution — grounds "where the damage comes from" in the engine's damage
  // model (%-max-HP mechanics: Poison / HP Burn / Warmaster), so the AI stops inventing damage
  // sources champions don't have. Only present for Clan Boss.
  let cbDamageSection = '';
  if (cb_damage?.carriers?.length) {
    const carrierText = cb_damage.carriers
      .map(c => `${c.name} (~${c.share}% — ${c.sources.join(' + ') || 'skill damage'})`).join(', ');
    const chest = cb_damage.expected_chest_tier
      ? ` On current gear this team is on track for roughly the ${cb_damage.expected_chest_tier} chest.` : '';
    const support = (cb_damage.breakdown ?? []).filter(c => c.share < 15).map(c => c.name);
    const supportText = support.length
      ? `\nThe other champions (${support.join(', ')}) deal little or NO direct damage — describe them as support/utility only. Never call them damage dealers or poison/DoT sources.` : '';
    cbDamageSection = `

CLAN BOSS DAMAGE ATTRIBUTION (ground truth — the engine's damage model, NOT your guess):
The bulk of this team's damage comes from: ${carrierText}.${chest}${supportText}
Attribute damage ONLY to the champions listed above as carriers, and ONLY to the sources listed for each. Do NOT credit any other champion with dealing damage, and do NOT invent damage sources (e.g. poisons, nukes) a champion is not listed with here.`;
  }

  // Real-account section — only included when context is available.
  let accountSection = '';
  if (context) {
    const r = context.roster ?? {};
    const untagged = r.untagged?.length
      ? `\nChampions they own that aren't tagged yet (do NOT assume capabilities for these): ${r.untagged.join(', ')}`
      : '';
    accountSection = `

REAL ACCOUNT DATA
Player: ${context.account?.displayName ?? 'unknown'} — owns ${r.total ?? 0} champions (${r.tagged ?? 0} tagged).${untagged}

Recent battle history:
${describeBattleHistory(context.battleHistory)}`;
  }

  const gapInstruction = gapCount === 0
    ? `- The engine found 0 gaps, so this team has NO coverage holes. Do NOT mention any missing role, missing healer/debuffer/tank, or composition weakness — there are none. (Gear/level tips are fine; framing them as coverage gaps is not.)`
    : `- Name each of the ${gapCount} gap(s) listed above explicitly — do not add others, do not soften them.`;

  const userPrompt = `The player asked for help with: ${content_label}.

ENGINE VERDICT (ground truth — do not contradict):
- Verdict: ${verdict ?? (isReady ? 'ready' : 'not ready')}
- Gaps found: ${gapCount}${gapCount === 0 ? ' — the team has NO coverage holes; do not invent any' : ''}

The matching engine (not you) selected this team from their roster:
${describeTeam(team)}

Goal coverage analysis:
${describeCoverage(coverage)}

${gapsDesc}${accountSection}${bossSection}${styleSection}${cbDamageSection}

Write a plain-language explanation (3-6 sentences) addressed directly to the player ("your team", "you want to").
- Say WHY each champion is in the team (what role/tag they cover).${cbDamageSection ? '\n- When you describe where the damage comes from, use ONLY the Clan Boss damage attribution above — never your own guess about who deals damage.' : ''}
${gapInstruction}
- Where the real account data adds something useful (recent results, what they own), weave it in — but never contradict the engine verdict above.${boss_exceptions.length ? '\n- Surface the relevant stage/boss exception(s) above so the player does not trigger them.' : ''}${style_notes.length ? '\n- Follow the explanation style guidance above for tone — match the warning level to THIS stage; do not over-warn about mechanics the guidance says are forgiving here.' : ''}
- Encouraging but honest.`;

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 512,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userPrompt }],
  });

  return response.content[0]?.text?.trim() ?? '';
}
