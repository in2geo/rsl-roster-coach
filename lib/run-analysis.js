// run-analysis.js — the ⑤ layer of the feedback loop. Given ONE reconciled run
// (prediction vs reality + derived classification), draft answers to the fixed
// feedback questions as STRUCTURED output for human confirmation. Hypothesis-only
// (status='candidate'); grounded strictly in the run's data.
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You analyze ONE captured Raid: Shadow Legends battle to answer a fixed set of feedback questions about a recommendation engine. You are given the engine's PREDICTION, the captured REALITY, and a derived CLASSIFICATION. Answer ONLY from the data provided — every claim must cite a number/champion/field from the run. Everything is a HYPOTHESIS for a human to confirm; never assert as fact.

CLASSIFICATION drives the reasoning (it is already computed — respect it):
- grind_above_rec = won a stage above the recommendation but SLOWLY (over the ~5-min budget / high turns). This is a developed/geared roster OUT-SUSTAINING forgiving content — it does NOT generalize to a new player, and is NOT evidence a floor is too high. Do NOT propose relaxing floors/goals from a grind. feedback_layer is almost always "none". evidence for "it was a grind" = "time".
- under_recommended = won ABOVE the recommendation FAST (within budget). The engine was too conservative — a REAL signal. Interrogate predicted_limiting_factor: which floor/goal/carrier capped it, and did reality beat it cleanly? Likely feedback_layer "structural" (a floor/goal is wrong or mis-modeled) or "numeric" (a threshold is miscalibrated).
- overpower = fast clear far above rec with big margin. Raw power overpowered the stage; holds only until the boss out-scales. Not evidence a mechanic is optional.
- on_spec = matched the prediction. Confirms the model — record confirmed_capabilities.
- loss = failed. What was the binding constraint (a floor, a death, a missing mechanic)?

CRITICAL GUARDRAILS:
- off_spec=true (team_match < 3) means the player fielded a DIFFERENT team than recommended, so the outcome CANNOT validate the recommendation. Say so, keep confidence low, feedback_layer usually "none".
- durationSeconds=0 means TIME WAS NOT CAPTURED (historical run) — you may NOT cite "time" as evidence; fall back to turns as a weak proxy or use "none".
- account_maturity matters: a win on a developed account is an upper bound, not proof the audience (new players) can reproduce it.

Output STRICT JSON ONLY (no prose, no markdown fences), with EXACTLY these keys:
{
  "result_summary": "1-2 sentences: what does this run tell us?",
  "confirmed_capabilities": ["what worked well — champion/tag + why, grounded"],
  "evidence": one of "time" | "survival" | "damage_attribution" | "aggregate_proxy" | "none",
  "refuted_assumptions": ["what did NOT work as intended — which engine assumption the run contradicts"],
  "feedback_layer": one of "structural" | "numeric" | "data_quality" | "none",
  "proposed_change": "concrete candidate fix, or 'none'"
}
"evidence" = can we CONFIRM the why? "time" (duration proves fast/slow), "survival" (who lived/died), "damage_attribution" (per-hero damage), "aggregate_proxy" (strong indirect signal e.g. cleared high fast with all alive, without per-champ attribution), or "none" (can't confirm — it's a hunch).
"feedback_layer" = "structural" (model logic: tags/goals/floor-model wrong), "numeric" (calibration: a threshold/multiplier value off), "data_quality" (null base stats / wrong tags / missing skill data), "none" (no action — e.g. a grind, or an off-spec run).`;

/**
 * @param {object} run — the reconciled run (① –④ fields from run_reconciliations)
 * @returns {Promise<object|null>} { result_summary, confirmed_capabilities, evidence,
 *   refuted_assumptions, feedback_layer, proposed_change } — or null if unparseable.
 */
export async function analyzeRun(run) {
  const resp = await client.messages.create({
    model: 'claude-sonnet-5',
    max_tokens: 2500, // Sonnet 5 thinking shares this budget
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: `RUN:\n${JSON.stringify(run, null, 2)}\n\nAnswer the questions as strict JSON.` }],
  });
  const text = (resp.content.find(b => b.type === 'text')?.text ?? '').trim();
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try { return JSON.parse(m[0]); } catch { return null; }
}
