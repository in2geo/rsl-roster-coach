# The Model QA Ladder — applying the Simulator QA Protocol to the Action Verification Model

**Canonical doc for how the Model is QA'd.** Read with `Simulator QA Protocol.docx` (the authoritative
spec) and `PHASE_II_TRACKER.md` (progress). Established 2026-07-24 with Mike.

## Two systems (do not conflate)

- **The Model** = the Action Verification Model: `lib/sim/recipes.js` (skills as data) + `lib/sim/interpreter.js`
  (executes them) + `lib/sim/operations.js` (the vocabulary). It is the **testing ground** — where each
  mechanic's math is proven correct in isolation, before the whole exists.
- **The Simulator** = the final product (`lib/sim/engine.js` + the `tools/sim-qa.mjs` protocol). When a
  Model mechanic's plumbing is **proven correct**, it **rolls into the Simulator**.

The Model is a **piece** of the eventual Simulator, so it gets the **local half** of the QA protocol.

## Which protocol layers apply to a piece (the rule)

**A check applies to the Model iff its correct answer is LOCAL** — computable from the mechanics the Model
implements, without needing the whole fight's outcome or an unbuilt mechanic. By that rule:

| Protocol layer | Applies to the Model? |
|---|---|
| 1 Validate input data | ✅ fully |
| 2 Rules in isolation (unit) | ✅ fully |
| 3 Toy teams | ✅ fully |
| 4 Golden battles | 🟡 **scoped** — short hand-calc sequences using only built mechanics (a full-fight golden includes deferred mechanics, so the Model would "fail" by being incomplete, not wrong) |
| 5 Behavioural invariants | 🟡 **state-level only** (HP≤max, dead don't act, cooldowns≥0, same-seed-same-result). Outcome-level invariants need a finished battle → wait |
| 6 Sensitivity | 🟡 **implemented-mechanic directions only** (the protocol already says this) |
| 7 Compare vs real runs | ❌ Simulator's job (Layer B) — on a piece you can't tell missing-mechanic from bug |
| 8 Outcome scoring | ❌ needs the whole battle |
| 9 Adversarial teams | ❌ tests the recommendation layer; a resolver makes no recommendations |
| 10 Confidence calibration | ❌ product-level |
| **meta: teeth (mutation)** | ✅ fully — tests the *quality of the checks*, independent of completeness |
| **meta: snapshot (regression)** | ✅ fully |
| **meta: fired-vs-consumed** | ✅ fully |

So the **Model QA ladder = layers 1, 2, 3, state-level 5, implemented-mechanic 6, scoped 4, + the three
meta-disciplines.** Layers 7–10 stay with the Simulator.

## The rungs (built + planned)

| rung | layer | file | status |
|---|---|---|---|
| card→recipe coverage | 1 | `tools/sim-validate-recipes.mjs` | ✅ built (steps 3–6 of the import pipeline) |
| DB→recipe fidelity (every populated column read + round-trips) | 1 | — | ⬜ TODO |
| II-A damage toy battles (+ exact-damage-with-crit) | 2/3 | `tools/sim-recipe-test.mjs` | ✅ 7/7 |
| II-B placement toy battles | 2/3 | `tools/sim-recipe-b-test.mjs` | ✅ 8/8 |
| II-C state toy battles | 2/3 | `tools/sim-recipe-c-test.mjs` | ✅ 7/7 |
| II-D passives/modifiers/EXTEND toy battles | 2/3 | `tools/sim-recipe-d-test.mjs` | ✅ 11/11 |
| scoped hand-calc golden (turn-by-turn) | 4 | done ad-hoc (turns 1–8 hand-verified) | ⬜ formalize |
| behavioural invariants (property-based) | 5 | `tools/model-invariants.mjs` | ✅ 800 scenarios + determinism; proven-teeth (heal-uncap mutant) |
| sensitivity (metamorphic + carve-outs) | 6 | `tools/model-sensitivity.mjs` | ✅ 9/9 directions + HP-not-ATK carve-outs |
| **teeth (mutation)** | meta | `tools/model-mutants.mjs` | ✅ **12/12 killed, 100%, 0 holes, 0 gaps** (suite = a/b/c/d + invariants + sensitivity) |
| **Model QA orchestrator (4-bucket ledger)** | — | `tools/model-qa.mjs` | ✅ one scorecard; SPEC-CONFORMANT |
| snapshot (regression) | meta | — | ⬜ TODO |
| DB→recipe fidelity (every column read + round-trips) | 1 | — | ⬜ TODO |

The exact-damage / connected-run comparison against reality (`sim-recipe-fight.mjs`, `sim-run.mjs`) is
**Layer-B / Simulator-side** — kept out of the Model ladder on purpose.

## Disciplines carried over from the protocol

- **4 buckets; only `spec_violation` blocks.** Deferred mechanics = `unimplemented` (the `deferred` lists +
  effect inventory ARE this catalog). Completeness is the output, not a gate.
- **Teeth first, and always.** "A rung that cannot fail is worthless." `model-mutants.mjs` proves the suite
  catches injected bugs; a survivor that should die is a SUITE HOLE (blocks), a probe survivor is a coverage
  gap (backlog). This rung is what makes every green check above trustworthy.
- **Data-first, label verified/estimated/missing.**
- **Don't reactively fix the Model when QA finds a gap** — log it, keep climbing.
- **Seeds for reproducibility;** `seed=null` is deterministic v0.

## The graduation rule (Model → Simulator)

A mechanic's plumbing rolls from the Model into the Simulator when its Model QA passes: layer-2/3 toy
battles green **and killed by the teeth rung**, layer-5/6 where applicable. Then the Simulator's
`sim-qa.mjs` picks it up for layers 7–10 against reality.

## How to run the Model QA today

**One command — the orchestrator runs every rung and prints a 4-bucket scorecard:**
```
node --env-file=.env.local tools/model-qa.mjs      # full ladder incl. the DB coverage rung
node tools/model-qa.mjs                              # no-DB rungs only
```
Individual rungs (each standalone, emits a QA_JSON line): `sim-recipe-test/-b/-c/-d-test.mjs` (toy),
`model-invariants.mjs` (L5), `model-sensitivity.mjs` (L6), `model-mutants.mjs` (teeth — must be 0 suite
holes), `sim-validate-recipes.mjs` (L1 coverage, DB).

Next build order: **snapshot (regression)** → **DB→recipe fidelity** → formalise the scoped hand-calc golden.
