# NORTH STAR — the goal, the current reality, and the roadmap

**Purpose of this file:** every session keeps re-deriving the project's goal, starting work, and losing
the thread. This is the permanent anchor. `CLAUDE.md` points here as READ-FIRST. If you are about to do
modeling, prediction, or architecture work, read this first and check your work against it. Established
2026-08-08 after a long session that reconstructed the whole picture from scratch.

---

## 1. The app is TWO engines (the vision, in Mike's words)

1. **Team selection engine** — tags/roles pick the best five champions from the player's roster.
2. **Stage prediction = the SIMULATOR** — answers "what stage can this team clear (on auto, within a time
   budget)." **The Simulator IS the intended stage predictor. Building it into that role is the whole point
   of all the Model/Simulator work.**

**Definitions (Mike's):** the **Model** = the turn-by-turn reimplementation of Raid's battle, formulas and
mechanics only, deliberately NO RNG (so you can check every mechanic fires correctly). The **Simulator** =
the Model **+ RNG + masteries + arena bonuses**. Recipes break each champion's skills into individual
mechanics; targeting is another layer.

**History (why the Simulator exists):** we started with a tag-only prediction model with little data. It
did not work — it is **survival-blind** (only asks "can they kill it," never "do they survive"). Mike was
right that a turn-by-turn game needs turn-by-turn measurement, so we built the Model → recipes → RNG →
targeting → Simulator to mimic the real battles.

---

## 2. The uncomfortable current reality (verified in code 2026-08-08)

There are **THREE** prediction systems and they are not the ones you'd assume:

| System | What it is | Where it lives |
|---|---|---|
| **Tag-coverage scan** (`computeVerdictBand`) | **What actually SHIPS** the stage rec. Survival-blind. | live in `match-engine.js` |
| **Contribution model** (`computeContributions`) | Display-only in production; passes `incomingDamagePerTurn: null` (survival-blind) | `lib/contribution-model.js` |
| **The Simulator** | **The INTENDED predictor. NOT in production.** | `lib/sim/` — imported ONLY by `tools/` |

- **Team selection works** and is roughly the vision (`selectTeam` in `match-engine.js`; `team-constructor.js`
  is a built-but-unwired replacement). Reasonable teams come out because **role-matching is forgiving** — you
  don't need a survival model to know a CB team needs a healer. That is why the app "gets results" despite the
  prediction being broken: **composition is fine; the clear/no-clear prediction is not.**
- **The Simulator is not wired to production OR to the metric.** All sim work (including hand-calibrating
  champions from videos) happens outside the graded loop.

## 3. Where the "shadow" (Deep Blue grading) went

The shadow loop still runs: **`reconcile-runs.mjs`** (grades each capture) + **`watch-reconcile.mjs`**
(human-launched auto-trigger) + **`battle-suite.mjs`** (the falsifiable balanced-accuracy scalar). **But it
grades the OLD contribution model (~38–44%), not the Simulator.** The Simulator's own grader
**`tools/sim-suite.mjs`** exists and computes the identical scorecard — but it is **Dragon-only and orphaned**
(not in the watcher, loop, or CI). So the shadow never got re-aimed when the Simulator became the plan. That
is the "fell off." **The project's chronic disease** (`MODEL_AS_REIMPLEMENTATION.md`): *built-but-unwired
artifacts die and get re-derived by hand.* Hand-calibrating a champion is doing the shadow's job manually.

## 4. THE PROOF the direction is right (2026-08-08)

On the **same 269 Dragon captures**, balanced accuracy:

- **Old model (contribution / tag): 38.3%**
- **Simulator (`sim-suite`): 61.0%**  → **+22.7 points**, with only 9 recipes and survival half-calibrated.

Weak spot: **loss recall 29%** (27 false clears) — the Simulator still over-predicts wins (survival not fully
calibrated; v1 gaps = lifesteal sourcing + only 9 recipes, rest on a legacy fallback). **61% is a floor, not a
ceiling.** The turn-by-turn approach decisively beats the tag approach it replaces.

---

## 5. THE ROADMAP — do in order, do not skip step 1

1. **Re-aim the shadow at the Simulator.** Wire `sim-suite` (already scores balanced accuracy) into the auto
   loop (`watch-reconcile.mjs` / `loop.mjs`) with history+delta and a **throttle** (it's slow — thousands of
   battles; can't run per-capture like the instant old metric). Then the Simulator's number is watched next to
   the old 38%. **Prerequisite for everything** — without it, sim gains stay invisible and get re-derived.
2. **Grow sim coverage.** Per-dungeon **enemy tables** (Dragon done; CB has much from 2026-08-08; Spider / Ice
   Golem / Fire Knight need theirs) + **champion recipes** (only ~9 exist; the corpus uses hundreds). This is
   the finite recipe-op / mechanic burndown — the unit of work is the **mechanic**, not the champion (a new
   champion mostly maps its skills onto existing recipe-ops). Now measured by step 1.
3. **Swap the Simulator in as the live stage predictor** (replace the coverage scan in `match-engine.js`) once
   it beats the old number on the shadow. **This is where survival finally reaches production.**
4. **Retire the old systems** — contribution model, coverage scan, and the dead `tools/`-only stack
   (`power-model.js`, `team-constructor.js`, `team-assembler.js`, pool/bucket/archetype/`selection/`) — via git
   (git IS the archive; delete, don't hoard). Only after the Simulator is live. DB cruft → status flags/seeds.

---

## 6. DISCIPLINE for every session (this is why the goal keeps getting lost)

- **The destination is the Simulator as stage predictor, measured by `sim-suite` against captured battles.**
  Do not confuse it with the old contribution-model / coverage-scan systems it REPLACES.
- Before starting work, ask: **"does this move the `sim-suite` number?"** Calibrating one champion by hand, in
  isolation, does NOT unless it flows through the graded loop. A change reports the sim-suite number or it
  isn't evidence (same rule as `battle-suite`, but pointed at the right engine).
- **Do not "improve the old system"** — it is being retired, not augmented. (Earlier this session I wrongly
  proposed bolting survival onto the contribution model; the Simulator already has survival — the job is to
  wire the Simulator in, not patch the corpse.)
- The Simulator is the destination, not a lab toy — but it only counts once it is wired to the shadow and to
  production. Wiring beats fidelity: a partially-built Simulator already scores 61% vs 38%.

**Key files:** live path `api/match.js` → `lib/match-engine.js` (`matchRoster`/`selectTeam`/`computeVerdictBand`);
Simulator `lib/sim/`; sim grader `tools/sim-suite.mjs`; old grader `tools/battle-suite.mjs`; shadow
`tools/reconcile-runs.mjs` + `tools/watch-reconcile.mjs`. See `knowledge/DEEP_BLUE_STATUS.md`,
`knowledge/MODEL_AS_REIMPLEMENTATION.md`.
