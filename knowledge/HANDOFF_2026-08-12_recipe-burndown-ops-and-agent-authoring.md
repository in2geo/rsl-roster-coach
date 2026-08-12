# HANDOFF — Recipe Burndown: ops + agent-authoring loop (2026-08-12)

**Branch:** `session/qa-rungs-2026-07-23`  ·  **Tip:** `3291ece`  ·  **Session span:** `80f737d` → `3291ece`

Read `knowledge/NORTH_STAR.md` and the memory `[[ally-attack-op-and-faction-gate-2026-08-12]]` first.
This handoff is the operational detail behind that memory.

---

## 30-SECOND ORIENTATION

We are burning down the **champion recipe** gap for the Simulator (`lib/sim/`). A recipe is a
data entry in `lib/sim/recipes.js` that composes **ops** (primitive mechanics in
`lib/sim/interpreter.js`) to reproduce a champion's skills. The metric is
`tools/sim-suite.mjs` (balanced accuracy on Dragon+Spider captures).

**The loop that works (run it again):**
> build the missing OPS by hand → author a BATCH of champions with AGENTS → integrate
> centrally → measure sim-suite → the batch's `newOpsNeeded` is the next op queue.

Division of labor is load-bearing: **agents write recipe DATA** (parallel-safe, template-driven);
**you build ops + integrate + validate** (shared code, would collide in parallel).

---

## WHAT SHIPPED THIS SESSION (commits, oldest→newest)

| Commit | What |
|---|---|
| `80f737d` | batch-1 clause decompositions (knowledge/recipe-burndown-batch1-drafts.json) |
| `46bd7cf` | **ALLY_ATTACK** op (join-attack) + Fahrakin authored |
| `0840fca` | **faction** plumbed onto combatants → Pallas A1 Argonites gate faithful |
| `7c68fce` | **Uugo** authored + `ifAllAlliesDead` action gate |
| `62864f4` | **BUFF_STRIP** op + Hilvi A2 |
| `df5f796` | **[Fear]/[True Fear] functional CC** (the real "CONSUME_FEAR") |
| `530cb97` | **EQUALIZE_HP** op + Mavara A2 — ⚠ exposed the KEY residual |
| `2a7177f` | **ally_death** reactive trigger (Uugo Final Spite) + Hordin self-heal |
| `2efecc1` | **AGENT batch-2**: 12 corpus champs, +46 recipes → **+1.4pp** |
| `e9f81cd` | **STEAL_TURN_METER + SWAP_HP + BUFF_ACTIVATION** ops + wired 4 champs |
| `3291ece` | **AGENT batch-3**: 12 corpus champs, +46 recipes → neutral (low-freq champs) |

Net: RECIPES **101 → 193**, FORMULAS **64 → 108**, op vocabulary **→ 30 implemented ops**.
24 corpus champions agent-authored across batches 2+3.

---

## sim-suite TRAJECTORY — READ THIS BEFORE JUDGING THE NUMBER

Session start **65.8%** → end **64.6%** (N=25). **The net −1.2pp is NOT a regression — it is a
diagnosis.** Every change was faithful; the dips are faithful mechanics REPLACING lossy auto-parse
and thereby EXPOSING residuals. Do not "fix" the number by reverting real mechanics.

- Biggest DOWN: **EQUALIZE_HP** (Dragon fp 21→23). Mavara's real equalize over-sustains 2
  reality-LOSS teams into false-clears. The sim damages all allies (Scorch is team-wide), so the
  equalize is faithful — it proves **the sim's Dragon survival is ~2 teams too generous**
  (loss-recall is the sim's core weakness). ⭐ **This is the highest-leverage open thread.**
- Biggest UP: **agent batch-2 +1.4pp** (Dragon fp 22→20). Faithful recipes beat auto-parse.
- Everything else ≈ neutral because the **Dragon+Spider corpus can't see it**: both bosses are
  **Fear-immune** (`HELLRAZOR_IMMUNE`/`SKAVAG_IMMUNE`) and carry no strippable buffs, and batch-3
  champs are low-frequency (2–14 runs).

Current per-dungeon: **Dragon 67.4% (fp 20)**, **Spider 60.0% (fp 22)**, loss recall 40/82.

---

## THE 30 OPS (all in `lib/sim/interpreter.js` OP_HANDLERS; registry `lib/sim/operations.js`)

Built this session: `ALLY_ATTACK` (who: all_allies_except_self | random_ally_except_self |
random_faction_ally + faction), `BUFF_STRIP` (types?/count?/effect.chance?), `EQUALIZE_HP`,
`STEAL_TURN_METER` (effect.pct + drains enemy, fills caster), `SWAP_HP` (target current_target),
`BUFF_ACTIVATION` (effect.type, forces ally [Continuous Heal] tick).
Plus the **[Fear]/[True Fear] CC keystone** (turn loop in `engine.js`, not an OP_HANDLERS op — a
Feared enemy misfires; new `fear` RNG stream appended to `RNG_STREAMS`) and the **`ally_death`
trigger event** (fired from `checkDeaths` via `state.onDeath`; operand `living_allies_besides_self`)
and the **`ifAllAlliesDead`** per-action gate in `applyRecipe`.

Supported trigger events: `attacked, hit_taken, hp_below, start_of_turn, round_start, ally_death,
enemy_frozen`. Anything else → defer + newOpsNeeded (do NOT invent trigger events in a recipe).

---

## HOW TO RUN THE NEXT LAP (concrete)

> **This is now committed, push-button tooling** — see `knowledge/RECIPE_AUTHORING_RUNBOOK.md`.
> `tools/recipe-authoring-fetch.mjs` → `Workflow({name:'recipe-authoring', args:[…]})` →
> `tools/recipe-authoring-integrate.mjs` → `tools/recipe-authoring-smoke.mjs` + the ladder.
> The manual detail below is the same thing, expanded, for when you need to reason about a step.

### A) Build the next ops (from batch-3 `newOpsNeeded`, ranked)
Highest-value / cleanest first:
- `HEAL` with `pctOfTargetMaxHp` (Klodd, Stonebound, Bad-el) — extend `doHeal` to read the target's
  max HP, not just caster's.
- `Decrease RES` consumer (Skeletor, Thor) — add RES to `STAT_MODS`/`landChance` so placed
  [Decrease RES] actually helps debuffs land.
- Then the conditional/reactive cluster (stat_compare condition, per-target debuff-count damage,
  the reactive events `enemy_revived`/`enemy_healed`/`ally_turn_veiled`).

Pattern for each op (followed 8× this session, all green):
1. `doXxx(state, actor, act, intended, E)` in interpreter.js + OP_HANDLERS entry.
2. Flip/add in operations.js (`implemented: true` + a `validate`).
3. Write `tools/sim-recipe-<name>-test.mjs` (see the 7 existing ones for the shape).
4. Wire its consumer(s); run the ladder (below); commit.

### B) Author a batch with agents (batch-4: the ~8 remaining low-freq recipe-less corpus champs,
then the wider Rare+ roster)
1. Regenerate the champion data + current op list (adapt the fetch used for batch-3 — it resolves
   corpus names via `champKey`+aliases, EXCLUDES already-authored champion IDs, writes
   `step<N>-champions.json` to BOTH scratchpad and repo root so agents can Read it).
2. Copy the batch-3 workflow (`…/workflows/scripts/recipe-authoring-batch3-wf_90cb1d0e-902.js`),
   update `OPS`/`NEWOPS` to the current vocab + the data filename, launch via `Workflow` with
   `args` = champion names.
3. Integrate (see gotchas). Delete the temp `step<N>-champions.json` from repo root after.

### C) The validation ladder (run ALL, in order)
```bash
node tools/model-ops-consistency.mjs
node --env-file=.env.local tools/model-golden.mjs        # MUST stay 7/7 byte-identical
node --env-file=.env.local tools/sim-selftest.mjs        # 156/156
node --env-file=.env.local tools/sim-validate-recipes.mjs   # new recipes must be 0 REVIEW
# smoke: run every new recipe through applyRecipe, assert no state.flags/throws (see below)
node --env-file=.env.local tools/sim-suite.mjs           # the metric; A/B via git stash
```
A/B a change: `git stash push -- <files>` → run sim-suite → `git stash pop`.

---

## INTEGRATION GOTCHAS (hard-won — you WILL hit these)

1. **Recipe keys = `champKey(canonical name)` = FIRST WORD uppercased.** Fabian → `LORD-*`, Sun
   Wukong → `SUN-*`, Bad-el-Kazar → `BAD-EL-KAZAR-*`. The integration script MUST recompute the key
   prefix — do NOT trust the agent's `recipeKey`. In sim-suite, `allyCombatant` sets no champId, so
   `combatantKey` falls back to `champKey(name)`; a wrong prefix = the recipe silently never resolves.
2. **CRLF.** recipes.js is CRLF. Patch with a regex anchor `/export const RECIPES = \{\r?\n/` and
   join blocks with the file's detected newline, else the anchor won't match.
3. **Null-mult DEAL_DAMAGE.** If a skill's DB `damage_multiplier` is null (Morag, etc.), DROP the
   DEAL_DAMAGE action + defer "damage multiplier not in DB". NEVER fabricate a multiplier.
   (But keep `maxHpPct`/`terms` formulas — only skip when all of mult/maxHpPct/terms are null.)
4. **Slot vs key for passives.** The validator matches recipe `slot` to the DB slot. If the DB calls
   a passive `A4` (e.g. Staltus "Untarnished"), the recipe key must be `<KEY>-A4` and `slot:"A4"` —
   not `-PASSIVE`. Agent slot labels drift from DB slots.
5. **PLACE_DEBUFF needs `chance` or `guaranteed`** or validate flags params. If the card states no %,
   set `guaranteed:true` (still ACC/RES-gated).
6. **Validator bracket tokens.** Plarium sometimes puts a whole sentence in `[…]`; the validator
   treats it as a token to account. Put the LITERAL bracketed string in a `deferred[]` note.
7. **Integrate by re-serializing objects**, not by editing minified JSON by hand: `import { RECIPES }`,
   mutate the object, then replace its line with `  "KEY": ${JSON.stringify(obj)},`.
8. **Commit messages with backticks** → use a heredoc (`git commit -F - <<'EOF'`), or bash command-
   substitution eats the token (happened once: `7c68fce`'s body lost a word).
9. **Engine tolerance** already added so agent field-placement works: `BUFF_STRIP`/`CLEANSE`/
   `REDUCE_TURN_METER` accept `effect.count`/`effect.chance`.

---

## ARTIFACTS

- Drafts (agent output, the record): `knowledge/recipe-burndown-batch1-drafts.json`,
  `recipe-authoring-batch2-drafts.json`, `recipe-authoring-batch3-drafts.json`.
- Authoring doc the agents read: `knowledge/RECIPE_AUTHORING.md`.
- Op tests (7 files, ~40 assertions): `tools/sim-recipe-{ally-attack,buff-strip,fear,uugo,
  equalize-hp,ally-death,tm-swap-buffact}-test.mjs`. Run them after any interpreter change.
- Workflow scripts persisted under `…/workflows/scripts/recipe-authoring-batch{2,3}-*.js` — copy to
  iterate.

---

## OPEN THREADS (ranked by leverage)

1. ⭐ **Dragon survival is ~2 teams too generous** (localized by EQUALIZE_HP). Fixing it makes ALL
   the sustain ops pay off and lifts loss-recall (the sim's weakest axis). Start: trace the 2 Mavara
   Dragon reality-LOSS teams the sim now false-clears; find the survival mechanic the sim overshoots.
2. **Corpus breadth** (North Star #2). Most faithful ops land neutral because Dragon+Spider can't
   exercise them (Fear-immune bosses, no boss buffs, low-freq champs). More dungeons / Fearable
   content / arena would make the authoring work measurable.
3. **Keep the loop turning**: next ops (§A) → batch-4 authoring (§B). Cheap, mechanical, faithful
   coverage — just won't move the headline number much until #1/#2.
4. **Reactive-trigger surface**: several passives (Fabian's re-fear/re-activate, Vallaryn's
   on-hp-loss/on-enemy-healed, Donatello's TMNT join) need new trigger EVENTS. Bespoke firing hooks;
   low corpus impact today but unlocks whole passives.

Durable rule that governed every decision here: **IMPLEMENT, DON'T FIT.** A verified game mechanic
stays even when it moves the metric down — that's how residuals get found.
