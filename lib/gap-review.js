// gap-review.js — the LLM "ask": given the engine's predictions, real battle outcomes, and the
// deterministic gap backlog (lib/battle-gaps.js), reason over the data to surface what we're
// MISSING that the pre-programmed checks can't — novel missing champion tags, miscalibrations,
// and checks worth adding. Grounded strictly in the data passed in; every output is a HYPOTHESIS
// for human review (matches the project's no-auto-merge rule). One focused call per session.
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You are a data/QA analyst improving a Raid: Shadow Legends recommendation engine's self-review system.

The engine predicts a team, a verdict/confidence, per-goal coverage, stat thresholds, and (for Clan Boss) damage attribution + chest tier. We reconcile those predictions against REAL captured battle outcomes. A deterministic checker already finds KNOWN gap types (missing data, refuted assumptions, unbuilt checks). YOUR job is to find what it MISSES.

Focus on:
1. MISSING TAGS — when a team WON a stage the engine said it couldn't cover a goal for, exactly one fielded champion is usually the untagged source. Name the champion and the specific capability, reasoning from its role and the unmet goal.
2. MISCALIBRATION — thresholds/confidence/damage-calibration that real outcomes contradict (cite the numbers).
3. NEW CHECKS or DATA worth capturing, beyond what the deterministic list already flags.

STANDING QUESTIONS — keep these top of mind EVERY session. Address each briefly, even when the honest answer is "not enough data yet — here's what would answer it and the current best guess":
- Do our GEAR-TIER and GREAT-HALL/ARENA stat multipliers make sense vs reality? (measured by tools/check-stat-estimator.mjs against Gestal real stats)
- Given the LIMITED data we collect, how accurate CAN we be — where is estimation error (not the champion pool) the thing dominating a wrong prediction?
- Do we need MORE information from the player — or are we failing to USE what we already collect (e.g. champion level/stars in the stat estimate)?

CRITICAL GUARDRAIL — the audience is NEW / limited-roster players, but the captured data is from a DEVELOPED account. A win does NOT prove a requirement is unnecessary:
- If the team was UNDER the stat floors (or ground it out over many turns) yet won, that's a developed roster surviving forgiving content — it will NOT generalize to a new player at those stats. Do NOT propose relaxing/removing the goal or lowering the threshold from such a win.
- If the team massively EXCEEDED the floors and won while skipping a mechanic, that's raw power overpowering weak early content — it holds only until the boss out-scales it. Do NOT treat it as evidence the mechanic is optional.
- A win only implies a MISSING TAG when the team was roughly ON-SPEC (met the floors, not a long grind). Prefer "goal needs another valid solution / a champion has an untagged capability" over "the requirement is wrong".
- EXCEPTION — ACTIVE SYNERGY: a synergy is an emergent combo effect (e.g. Glorious Pallas + an Argonites ally, Donatello + a TMNT ally, 2+ Ally Attack champions) that DOES generalize to any player owning that combination. When a below-spec win has an active synergy, the combo — not raw account power — is the likely explanation, and it means the stage is genuinely MORE reachable for combo owners. Do NOT dismiss it as account-specific grind; instead flag the synergy as a modeling target (the engine should reward owning the combo) and note if the synergy itself is untracked. A synergy is a relationship between TWO+ owned champions — it is distinct from a single champion's tag (an unconditional ally-attack skill like Fahrakin's is a TAG, not a synergy).

Hard rules:
- Ground EVERY point in the data provided; cite the specific battle, champion, goal, or number as evidence. If the data doesn't support a claim, don't make it.
- Everything you output is a HYPOTHESIS for a human to review — never assert it as fact. Use "likely", "candidate", "worth checking".
- Do NOT just restate the deterministic backlog; add reasoning beyond it.
- Be concise and prioritized. Output at most ~8 items, most actionable first. Each item: the gap, the evidence, and the concrete action (tag X on champion Y / add check Z / recalibrate W / capture V).`;

/**
 * @param {object} input
 *   backlog        — [{category, title, count, suggestion}] from tools/whats-missing.mjs
 *   contradictions — [{content, result, stageLabel, team:[{name,role,tags}], unmetGoals:[...], cbDamage}]
 *   rosterNote     — short string about the account (owned/tagged counts)
 * @returns {Promise<string>} the analyst's prioritized "what are we missing" review.
 */
export async function reviewGaps({ backlog = [], contradictions = [], rosterNote = '' }) {
  const backlogText = backlog.length
    ? backlog.map(b => `- (${b.count}×) [${b.category}] ${b.title} → ${b.suggestion}`).join('\n')
    : '(none)';

  const contraText = contradictions.length
    ? contradictions.map((c, i) => {
        const team = c.team.map(t => `${t.name} [${t.role ?? '?'}; tags: ${(t.tags ?? []).join(', ') || 'none'}]`).join('\n     ');
        const cb = c.cbDamage?.carriers?.length
          ? `\n   CB damage carriers (model): ${c.cbDamage.carriers.map(x => `${x.name} ${x.share}%`).join(', ')}` : '';
        const syn = c.synergies?.length
          ? `\n   ACTIVE SYNERGIES (generalizable combos, not raw account power): ${c.synergies.map(s => `${s.members.join('+')} — ${s.effect}`).join(' | ')}` : '';
        return `#${i + 1} ${c.content} — result: ${c.result}\n   UNMET goal(s) the engine flagged: ${c.unmetGoals.join(' | ')}\n   Team:\n     ${team}${syn}${cb}`;
      }).join('\n\n')
    : '(no contradictions this session)';

  const userPrompt = `ACCOUNT: ${rosterNote || 'unknown'}

DETERMINISTIC GAP BACKLOG (already known — do not just repeat these):
${backlogText}

CONTRADICTIONS — battles whose real outcome disagreed with the engine's prediction (the richest source of missing tags). For each, the engine listed goal(s) it thought were UNMET, yet the team still won:
${contraText}

What are we missing? Give a prioritized list of hypotheses (missing tags, miscalibrations, new checks/data), each grounded in the specific evidence above.`;

  const response = await client.messages.create({
    model: 'claude-sonnet-5',
    max_tokens: 5000, // Sonnet 5 thinking shares this budget — leave ample room for the written review

    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userPrompt }],
  });
  // Sonnet 5 may return a leading `thinking` block — take the text block, not content[0].
  return (response.content.find(b => b.type === 'text')?.text ?? '').trim();
}
