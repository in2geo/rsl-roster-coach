# RECIPE AUTHORING RUNBOOK

**The repeatable cycle for turning champions into Simulator recipes — run it whenever the game adds
champions (a month or a year from now).** This is the operational how-to; the *why* lives in
`knowledge/RECIPE_AUTHORING.md` (authoring rules) and the latest `HANDOFF_*` (session context).

There are **two processes, chained**. A recipe cannot be written until the champion's skill data is
in the DB, so **Process A precedes Process B**.

---

## PROCESS A — get the new champion's data into the DB (prerequisite)

A recipe reads three things from Supabase: `champion_skills.skill_summary` (verbatim), `.damage_multiplier`
+ `.multiplier_type`, and the champion's base stats. New champions must have these before authoring.

This is the existing **data-sourcing** process — follow `CLAUDE.md` ("Data sourcing — hard rules" +
"Source hierarchy for skill data"):
1. Get verbatim skill text + base stats from a Tier-1 source (in-game Index / Plarium patch notes /
   Fandom / raid.guide). **Never scrape; read as a human.** Never fabricate a damage multiplier.
2. Land it as a **committed `seeds/*.sql`** (all content changes go through committed seeds — hard rule),
   then apply via `tools/apply-seed-pooler.mjs`.
3. Confirm: `base_hp` is a multiple of 15 (the cheap validity check); skills have `skill_summary` +
   `damage_multiplier` where the skill deals damage.

When the champion resolves in the DB with skills, it becomes eligible for Process B automatically
(the fetch tool finds "champions with skills but no recipe").

---

## PROCESS B — the recipe-authoring loop

**One-line map:** `fetch → author (agents) → integrate → validate → commit`, and when agents flag
missing mechanics, a **build-op** side-loop feeds back in.

### B.1 — fetch the next batch
```bash
node --env-file=.env.local tools/recipe-authoring-fetch.mjs --count 12
```
Writes `./recipe-authoring-batch.json` (the agents read it) and prints the champion list + the exact
Workflow launch command. Options: `--names "A,B,C"` for specific champions; `--all-rareplus` to go
beyond battle-captured champions to the whole Rare+ roster; `--out PATH` to relocate the data file.
It resolves names via `champKey` + aliases and excludes already-authored champions, so no duplicates
or phantoms.

### B.2 — author with agents
Launch the saved workflow with the champion names fetch printed:
```
Workflow({ name: 'recipe-authoring', args: ["Champ A", "Champ B", ...] })
```
It runs one agent per champion. Each reads `./recipe-authoring-batch.json`, `lib/sim/operations.js`
(the op authority — grows over time), the `CONSUMED_EFFECTS` Set in `lib/sim/engine.js` (the consumer
authority), `RECIPE_AUTHORING.md`, and example recipes — then returns structured recipe code. It runs
in the background; save its result's `drafts` array to a file (e.g.
`knowledge/recipe-authoring-batch<N>-drafts.json`) — read it from the task output file the notification
names, or from the workflow's `journal.jsonl`.

Keep the batch to ~12 (the "medium" workflow-size guideline). Agents get *better* with more examples
in `recipes.js`, so quality compounds batch over batch.

### B.3 — integrate
```bash
node tools/recipe-authoring-integrate.mjs knowledge/recipe-authoring-batch<N>-drafts.json --dry-run   # preview
node tools/recipe-authoring-integrate.mjs knowledge/recipe-authoring-batch<N>-drafts.json             # patch
```
Recomputes keys via `champKey`, drops null-multiplier `DEAL_DAMAGE` (deferring the damage), keeps only
supported trigger events (deferring the rest), and CRLF-safely patches the FORMULAS + RECIPES blocks
into `lib/sim/recipes.js`. Idempotent (skips already-present recipe/formula keys). Accepts either the
`drafts` array or the raw task-output object.

### B.4 — validate (run ALL, in order; a batch ships only when every one is green)
```bash
node tools/model-ops-consistency.mjs                          # registry ↔ interpreter ↔ deferred agree
node --env-file=.env.local tools/model-golden.mjs             # MUST stay 7/7 byte-identical
node --env-file=.env.local tools/sim-selftest.mjs             # 156/156
node --env-file=.env.local tools/sim-validate-recipes.mjs     # new recipes must be 0 REVIEW
node tools/recipe-authoring-smoke.mjs "Champ A" "Champ B" ... # or no args = full regression; 0 flags/throws
node --env-file=.env.local tools/sim-suite.mjs                # the metric — A/B via git stash
```
A/B a change's metric effect: `git stash push -- lib/sim/recipes.js` → run sim-suite → `git stash pop`.

**Common REVIEW fixes** (from `sim-validate-recipes`): a passive stored as DB slot `A4` needs key
`<KEY>-A4` + `slot:"A4"` (not `-PASSIVE`); a `PLACE_DEBUFF` with no stated % needs `guaranteed:true`;
a `[bracketed sentence]` clause needs the literal token in a `deferred[]` note. Full gotcha list in the
latest `HANDOFF_*`.

### B.5 — commit
Commit `lib/sim/recipes.js` + the drafts JSON. Use a heredoc for the message (`git commit -F - <<'EOF'`)
if it contains backticks. Note the sim-suite delta; **keep faithful mechanics even if the number dips**
(IMPLEMENT, DON'T FIT — a dip usually localizes a residual, not a regression).

---

## THE BUILD-OP SIDE-LOOP (when agents flag `newOpsNeeded`)

The workflow returns a ranked `newOpsRanked`. When a mechanic recurs (or blocks a champion's core),
build the op **centrally** (agents must not — it's shared code):
1. `doXxx(state, actor, act, intended, E)` in `lib/sim/interpreter.js` + an `OP_HANDLERS` entry.
2. Flip/add it in `lib/sim/operations.js` (`implemented: true` + a `validate`).
3. Write `tools/sim-recipe-<name>-test.mjs` (mirror an existing op test).
4. Wire its consumer(s); run the B.4 ladder; commit.
Then re-run B.1–B.5 — the new op is now in `operations.js`, so the next batch's agents use it.

Reactive passives may need a new **trigger event** (e.g. `enemy_revived`): add a firing hook (see
`ally_death` → `state.onDeath` in `engine.js` + `installRecipeRun` in `interpreter.js`) and add the
event name to the workflow's supported-events list + `recipe-authoring-integrate.mjs`'s `SUPPORTED_TRIG`.

---

## TOOLS (all committed under `tools/`)

| Tool | Step | Does |
|---|---|---|
| `recipe-authoring-fetch.mjs` | B.1 | recipe-less champions + skills → `recipe-authoring-batch.json` + op list |
| `.claude/workflows/recipe-authoring.js` | B.2 | the named agent workflow (`Workflow({name:'recipe-authoring', args:[…]})`) |
| `recipe-authoring-integrate.mjs` | B.3 | drafts JSON → keys/null-mult/triggers normalized → patch `recipes.js` |
| `recipe-authoring-smoke.mjs` | B.4 | run every recipe through `applyRecipe`, flag issues |

Ground truth that keeps this durable across game patches: the agents read `operations.js` +
`engine.js` for the CURRENT op + consumer vocabulary, so the loop doesn't rot as those grow. The
temp `recipe-authoring-batch.json` at repo root is disposable — delete it after each batch.
