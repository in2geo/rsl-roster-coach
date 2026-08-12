export const meta = {
  name: 'recipe-authoring',
  description: 'Agents write sim recipe CODE (lib/sim/recipes.js entries) for champions listed in args, from ./recipe-authoring-batch.json + the template, using the current op vocabulary',
  whenToUse: 'STEP B.2 of the recipe-authoring loop (knowledge/RECIPE_AUTHORING_RUNBOOK.md). Run tools/recipe-authoring-fetch.mjs first to write ./recipe-authoring-batch.json, then launch this with args = the champion names it printed.',
  phases: [{ title: 'Author', detail: 'one agent per champion writes its recipe.js code as structured JSON' }],
}

// args = array of champion names (as printed by tools/recipe-authoring-fetch.mjs). Their verbatim
// skills + multipliers + base stats live in ./recipe-authoring-batch.json (agents Read it).
const NAMES = Array.isArray(args) ? args : (typeof args === 'string' ? JSON.parse(args) : [])
if (!NAMES.length) { log('no champion names in args — pass the list tools/recipe-authoring-fetch.mjs printed'); return { error: 'no names' } }

const ACTION_SCHEMA = { type: 'object', additionalProperties: true }
const SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: {
    champion: { type: 'string' }, recipeKey: { type: 'string' },
    formulas: { type: 'array', items: { type: 'object', additionalProperties: true, properties: { id: { type: 'string' } }, required: ['id'] } },
    recipes: { type: 'array', items: {
      type: 'object', additionalProperties: false,
      properties: {
        key: { type: 'string' }, slot: { type: 'string' }, name: { type: 'string' }, type: { type: 'string' }, cooldown: { type: ['integer', 'null'] },
        actions: { type: 'array', items: ACTION_SCHEMA }, triggers: { type: 'array', items: ACTION_SCHEMA },
        covers: { type: 'array', items: { type: 'string' } }, deferred: { type: 'array', items: { type: 'string' } },
      }, required: ['key', 'slot', 'covers', 'deferred'],
    } },
    newOpsNeeded: { type: 'array', items: { type: 'object', additionalProperties: false, properties: { op: { type: 'string' }, why: { type: 'string' } }, required: ['op'] } },
    notes: { type: 'string' },
  }, required: ['champion', 'recipeKey', 'recipes', 'newOpsNeeded'],
}

function prompt(name) {
  return `You are writing SIM RECIPE CODE (entries for lib/sim/recipes.js) for the RAID: Shadow Legends champion "${name}".

STEP 1 — READ THESE FILES IN FULL (they are the AUTHORITY — the op vocabulary and consumer registry GROW over time, so read them fresh, do not rely on any list from memory):
- ./recipe-authoring-batch.json — find the object whose "name" is exactly "${name}"; that is your SOURCE OF TRUTH (verbatim skills, damage multipliers, multiplierType, base stats, affinity/faction). '&#x27;' means an apostrophe.
- lib/sim/operations.js — the OP VOCABULARY. Use ONLY ops with implemented:true. Anything else is a DEFERRED clause + a newOpsNeeded entry.
- lib/sim/engine.js — the CONSUMED_EFFECTS Set is the authoritative CONSUMER REGISTRY: a placed [buff]/[debuff] whose type is NOT in that Set is INERT (lands and does nothing) → DO NOT place it; defer it with reason "no engine consumer (inert)". (Functional turn-denial CC on an enemy: Stun, Freeze, Sleep, Petrification, Fear [50% misfire], True Fear [guaranteed].)
- knowledge/RECIPE_AUTHORING.md — the decomposition method + per-clause template + ruleset.
- lib/sim/recipes.js — study several full entries (e.g. UUGO-*, FAHRAKIN-*, HILVI-*, MAVARA-*, VALLARYN-*, UNDERPRIEST-*) and their F_*_* formulas. COPY THEIR EXACT FIELD SHAPE.

THE ONE HARD RULE: every clause of every skill becomes EITHER a modelled action (an implemented op) OR a deferred entry with a reason. Nothing is silently dropped. A 5-part skill yields 5 accounted clauses.

CRITICAL RULES:
- NEVER fabricate a damage multiplier. Use the DB "multiplier". If it is null but the skill attacks, write the control actions and either omit DEAL_DAMAGE or set formula multiplier:null, and defer "damage multiplier not in DB". If present, write F_<KEY>_<SLOT> with scalingStat = multiplierType, multiplier = DB value, hitCount from the text, flags: DMG_FLAGS.
- recipeKey = the FIRST word of the champion name, uppercased (e.g. "Madame Serris" → prefix "MADAME"; keys look like "MADAME-A1"). The recipe's slot must match the DB slot (a passive stored as slot "A4" → key "<KEY>-A4", not "-PASSIVE").
- A placed buff/debuff NOT in CONSUMED_EFFECTS is INERT → deferred (the single biggest historical miss).
- Poison & HP Burn scale off TARGET MaxHP and are DEF-INDEPENDENT.
- Activation ≠ placement; strip/remove ≠ placement; ignore/bypass ≠ placement; a self-condition is not a placement; duration-extension ≠ placement.
- Prefer the SPECIFIC op (read operations.js for the full list): e.g. BUFF_STRIP (remove enemy buffs), STEAL_BUFF (steal them), STEAL_TURN_METER (steal TM to caster), SWAP_HP (swap HP with target), BUFF_ACTIVATION (force ally [Continuous Heal] tick), EQUALIZE_HP (equalize ally HP), ALLY_ATTACK (ally joins the attack), CLEANSE (remove ally debuffs).
- Reactive passives → a "triggers" array. SUPPORTED events ONLY: attacked, hit_taken, hp_below, start_of_turn, round_start, ally_death, enemy_frozen. Any other reactive event → deferred + a newOpsNeeded entry (do NOT invent a trigger event).

OUTPUT (structured): champion, recipeKey, formulas[], recipes[] (one per skill: key, slot, name, type, cooldown, actions[the op objects], covers[], deferred[]), newOpsNeeded[], notes. Action objects must match the example recipes' field shape EXACTLY.

Work ONLY from the verbatim skill text. Do NOT invent effects. Be exhaustive and precise.`
}

phase('Author')
const drafts = (await parallel(NAMES.map((name) => () =>
  agent(prompt(name), { label: `author:${name}`, phase: 'Author', schema: SCHEMA })
))).filter(Boolean)

const opTally = {}
for (const d of drafts) for (const n of (d.newOpsNeeded || [])) { const k = (n.op || '?').toUpperCase(); (opTally[k] ??= { count: 0, champs: [] }); opTally[k].count++; opTally[k].champs.push(d.champion) }
const newOpsRanked = Object.entries(opTally).sort((a, b) => b[1].count - a[1].count).map(([op, v]) => ({ op, count: v.count, champs: v.champs }))
const def = drafts.reduce((s, d) => s + (d.recipes || []).reduce((t, r) => t + (r.deferred || []).length, 0), 0)
log(`authored ${drafts.length} champions · ${def} deferred clauses · ${newOpsRanked.length} distinct new-ops requested`)
return { count: drafts.length, perChamp: drafts.map((d) => ({ champion: d.champion, recipes: (d.recipes || []).length, deferred: (d.recipes || []).reduce((s, r) => s + (r.deferred || []).length, 0), newOps: (d.newOpsNeeded || []).map((n) => n.op) })), newOpsRanked, drafts }
