import Anthropic from '@anthropic-ai/sdk';
import { auditTeamDebuffs } from './damage-mechanics.js';

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
- DESCRIBE CHAMPIONS ONLY FROM THEIR VERBATIM SKILL TEXT. Each champion is listed with its exact Plarium skill text — that is the ONLY source for what a champion does. Never describe an ability, debuff, buff, heal, or effect from your own memory of the game. If the skill text does not say it, do not claim it. When you credit a champion with an effect, it must be one named in ITS OWN skill text (name the bracketed effect, e.g. [Decrease ATK], [Poison], [Leech]). Do NOT swap effects between champions or invent kits — a champion that places [Decrease DEF] does NOT place [Decrease ATK]; a champion with no heal in its text does NOT heal.
- NEVER contradict the engine's structured output. It is always right; you only explain it.
  • If the engine reports gaps = 0, the team has NO coverage holes. Do NOT mention missing roles, a missing healer/debuffer/tank, holes in coverage, or any composition weakness — there are none. (You may still suggest gear or level investment, but never frame it as a coverage gap.)
  • If the engine reports gaps > 0, name each gap exactly as given — never add gaps it did not report, never soften or skip the ones it did.
  • If the verdict is "ready", do not say or imply the team is not ready, is composition-risky, or needs more pieces.
- Never invent champions, tags, gaps, or advice beyond these two sources.
- Reference real account signals when they add value (e.g. "your recent Spider 3 runs have been clearing" or "Pelops is already at level 50"), but only if present in the data.
- Plain language a new player understands. No filler openers ("Sure", "Certainly").`;

function describeTeam(team = []) {
  return team.map(c => {
    const skillLines = (c.skills ?? []).length
      ? c.skills.map(s => `      • [${s.slot}] ${s.name ? `${s.name}: ` : ''}${s.summary}`).join('\n')
      : '      (no skill text on file — describe this champion ONLY by its tags above, do not guess its kit)';
    return `- ${c.name} (${c.rarity}, Lv ${c.level}, ★${c.stars})\n` +
      `    tags: ${c.tags?.join(', ') || 'none tagged yet'}\n` +
      `    skills (verbatim Plarium text — the ONLY source for what this champion actually does):\n${skillLines}`;
  }).join('\n\n');
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
    cb_damage = null, watchdog = null, clan_boss_verdict = null,
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

  // Clan Boss REAL-CAPTURE verdict (A-real) — CB is graded by DAMAGE → chest tier, never by a
  // "% chance of success". Ground the recommendation in the account's proven one-key + the gap to
  // the next chest. Only present for Clan Boss (null otherwise).
  const M = (n) => n == null ? '?' : `${(n / 1e6).toFixed(1)}M`;
  let cbVerdictSection = '';
  if (clan_boss_verdict?.has_data) {
    const v = clan_boss_verdict;
    const ran = v.per_difficulty.map(p =>
      `• ${p.difficulty}: ${M(p.best_damage)} — ${p.earned_top
        ? `ONE-KEYS the top ${p.top_chest} chest`
        : `earns the ${p.earned_chest ?? 'below-lowest'} chest (${Math.round((p.margin ?? 0) * 100)}% of the top ${p.top_chest})`}`
    ).join('\n');
    const focusLine = !v.focus ? '' : (v.focus.tried
      ? `Push target: ${v.focus.difficulty} — currently the ${v.focus.earned_chest ?? 'below-lowest'} chest, ${Math.round((v.focus.margin ?? 0) * 100)}% of the way to one-keying the top ${v.focus.top_chest} chest (about ${M(v.focus.shortfall)} more damage needed).`
      : `Next tier to try: ${v.focus.difficulty} — its top ${v.focus.top_chest} chest needs about ${M(v.focus.top_threshold)} total damage.`);
    cbVerdictSection = `

CLAN BOSS VERDICT (ground truth — from the player's REAL captured keys; this REPLACES any "chance of success"):
Clan Boss is a DAMAGE RACE, not win-or-lose — a key succeeds by reaching a chest's damage threshold. From this account's real keys:
${ran}
Top difficulty whose TOP chest they already one-key: ${v.top_one_keyable ?? 'none yet'}.
${focusLine}
Frame the recommendation as chest tiers and the damage gap — NEVER as a "% chance of success" or "ready/not ready". Do NOT invent chest names, damage numbers, or thresholds beyond the ones listed here.`;
  } else if (clan_boss_verdict && !clan_boss_verdict.has_data) {
    cbVerdictSection = `

CLAN BOSS VERDICT: No completed Clan Boss keys have been captured for this account yet, so there is no damage-vs-chest result. Do NOT state a "% chance of success" or claim a chest tier as achieved — say we'll grade their chest tier once they run a key, and (using the damage attribution below, if present) describe which champions will carry the damage.`;
  }

  // Debuff-effectiveness carve-out (Layer 1 guardrail). If a fielded champion's
  // damage-debuff can't multiply THIS team's damage type (e.g. Decrease DEF on a
  // poison team), tell the coach to credit the champion's OTHER roles instead of the
  // mismatched debuff — the exact "right tag, wrong reason" honesty fix. Explicitly
  // NOT a coverage gap, so it can't trip the gaps=0 "no weakness" rule.
  const debuffMismatches = auditTeamDebuffs(team, { fightTurns: matchResult.expected_fight_turns ?? null })
    .filter(d => d.kind === 'damage_type_mismatch');
  const debuffSection = debuffMismatches.length
    ? `\n\nDEBUFF EFFECTIVENESS (ground truth — do NOT credit a mismatched debuff as damage):\n${debuffMismatches.map(d => `• ${d.detail}`).join('\n')}\nThese champions still belong on the team for their OTHER roles (sustain, CC, healing, protection) — describe their value by those roles, not the mismatched debuff. This is NOT a coverage gap; do not frame it as a missing role or weakness.`
    : '';

  // Watchdog (Layer 1) — a benched champion may out-CONTRIBUTE a fielded one on this
  // content (coverage can't see magnitude/fit). This is an OPTIONAL optimization tip,
  // explicitly NOT a coverage gap or a weakness of the fielded team — the engine's team
  // is still valid. Also carries auto-reliability caveats for fielded champs.
  let watchdogSection = '';
  // Only the actionable, data-backed reliability findings reach the coach — 'reliability_unknown'
  // (proc data not captured yet) is a feedback-loop signal, not player advice, so it's dropped here.
  const relFindings = (watchdog?.reliability ?? []).filter(r => r.kind === 'low_reliability');
  if (watchdog?.flags?.length || relFindings.length) {
    const swaps = (watchdog.flags ?? []).map(f => `• ${f.detail}`).join('\n');
    const rel   = relFindings.map(r => `• ${r.detail}`).join('\n');
    watchdogSection = `

TEAM OPTIMIZATION NOTES (optional tips — NOT coverage gaps, do NOT frame as a weakness or contradict the verdict):${swaps ? `\nStronger option(s) sitting on the bench for this content:\n${swaps}\nMention as a friendly "you could try swapping…" suggestion the player can experiment with — the fielded team still works.` : ''}${rel ? `\nAuto-reliability caveats for the fielded team (surface as speed/gear tuning advice, not a missing role):\n${rel}` : ''}`;
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

${gapsDesc}${accountSection}${bossSection}${styleSection}${cbVerdictSection}${cbDamageSection}${debuffSection}${watchdogSection}

Write a plain-language explanation (3-6 sentences) addressed directly to the player ("your team", "you want to").
- Say WHY each champion is in the team (what role/tag they cover) — describing each champion's abilities ONLY from its own verbatim skill text listed above, never from memory.${cbVerdictSection ? '\n- Lead with the CLAN BOSS VERDICT: state which difficulty they one-key and the chest/damage gap to the next — as chest tiers, never a "% chance of success" or "ready/not ready".' : ''}${cbDamageSection ? '\n- When you describe where the damage comes from, use ONLY the Clan Boss damage attribution above — never your own guess about who deals damage.' : ''}${debuffSection ? '\n- For any champion in the DEBUFF EFFECTIVENESS list, do NOT credit the mismatched debuff as damage/value — describe them by their other roles (sustain/CC/heal). This is not a coverage gap.' : ''}
${gapInstruction}${watchdogSection ? '\n- If TEAM OPTIMIZATION NOTES are present, add at most ONE friendly sentence about the strongest suggested swap or reliability caveat — as an optional tip, never as a flaw in the fielded team, and never contradicting the verdict.' : ''}
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
