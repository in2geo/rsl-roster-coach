# NORTH STAR — the goal, the current reality, and the roadmap

**Purpose of this file:** every session keeps re-deriving the project's goal, starting work, and losing
the thread. This is the permanent anchor. `CLAUDE.md` points here as READ-FIRST. If you are about to do
modeling, prediction, or architecture work, read this first and check your work against it. Established
2026-08-08 after a long session that reconstructed the whole picture from scratch.

> **⚠ AMENDMENT 2026-08-09 — read §7 before acting on §5/§6.** The **destination is unchanged** (Simulator as
> stage predictor). But a turn-by-turn CB session forced a revision to the **measurement and retention** mechanism:
> the win/loss metric is too coarse, and the automated ground truth step #1 depends on **does not reliably exist**.
> §5 step 1 and §6's discipline question are amended in §7.

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

---

## 7. AMENDMENT 2026-08-09 — measurement & retention, forced by the turn-by-turn CB session

A full session building an **independent turn-by-turn CB hand-calc** and walking it against a real DonaHilvi
video ([[cb-handcalc-turn-by-turn-calibration-2026-08-09]]; handoff
`HANDOFF_2026-08-09_cb-turn-by-turn-method-dragon-and-cross-account.md`) advanced the destination but exposed two
false premises under §5's step 1 and §6's discipline. **The destination (§1–4) stands. This amends §5 step 1 and §6.**

**The requirement (Mike's, non-negotiable):** the Model computes **EVERY SINGLE ACTION, in order, at a granular
level** — who acts, which skill, which target, the computed result — and "correct" means **every action matches
reality**. Per-hero and grand total are **DERIVED sums of the actions, never the target**; get every action right
and the sums are right automatically. Do NOT compute toward, or grade primarily by, an aggregate. (`tools/handcalc/DUNGEON_TEMPLATE.md`
states this in full.)

**Why the win/loss metric is too coarse.** `sim-suite`/`battle-suite` grade **balanced accuracy on win/loss** — one
bit per battle. A total is *underdetermined*: many wrong models fit it because per-champion errors cancel. Proof
this session: the model sat at **0.97× on total damage while Xenomorph was 0.64× and the direct-dealers were ~1.4×**
— errors that offset into a "right" total. A win/loss (or total) grader would have called that half-wrong model good.

**Output granularity ≠ verification granularity — do not conflate them.** The Model must ALWAYS emit every action
(the requirement above). What the unreliable data limits is only *inspection* of that output: **per-action** when a
human reads a video (the real bar), **per-hero** dealt/taken/healed when only result screens exist (a fallback that
catches cross-champion cancellation but not within-champion, e.g. Xeno's direct-over + poison-under). A data limit
on checking is never a licence to compute at a coarser grain.

**Why step 1 (wire the automated shadow) rests on a false premise.** Step 1 assumes a working automated
capture→reconcile→measure loop. **That data isn't reliable:** the per-action battle-reader blobs are **uncracked**
(tried many times; the passive-read boundary forbids injection), and the per-hero capture has been **deemed
unreliable** (duplicates; captures only occasionally). You cannot auto-grade against data that isn't there. So the
prerequisite as written is not executable.

**The forced consequence — this is actually the right architecture.** No reliable data ⇒ you **cannot fit** ⇒ you
**must implement the real mechanics** (which is `MODEL_AS_REIMPLEMENTATION.md`'s thesis anyway). An *implemented*
model needs data only to **verify a mechanic once**, then generalises to unseen teams/stages; a *fitted* model
needs data everywhere. So verification becomes a **bounded, human-gated, compounding** activity, not an automated
firehose:
- **Sensor = the human** (Mike reads a real video). Same Deep Blue loop (capture→reconcile→measure→propose→retain),
  just at higher fidelity through the only reliable sensor.
- **Bounded & compounding:** verification is **one-time per mechanic** (pin boss DEF once, a champion kit once);
  **the champion library is dungeon-independent**, so a champ verified anywhere is verified everywhere. Per-dungeon
  cost = the enemy packet + any new champions, and it **shrinks** as the library grows.
- **Generalisation to new teams is the payoff** (and the bridge to the team-selection engine): the enemy
  calibration applies to *every* team; interactions **emerge** from the implementation. Harden each dungeon with a
  **few deliberately DIVERSE teams** (poison / direct-nuke / control) so different mechanic classes get exercised —
  a pure-poison team hid the DEF≈0 bug this session because poison is DEF-independent.
- **Retention (curing the "re-derived by hand" disease):** until a reliable capture exists, persistence = **memory
  + handoff + PORTING the findings into `lib/sim`**. Porting is the real cure — a finding in the hand-calc is still
  "invisible." (Open item: CB's DEF≈0 / rotation / SPD 140 / kits are NOT yet in `lib/sim/clan_boss.js`.)

**Amended step 1:** replace "wire the automated shadow" with **"establish a per-hero/per-action fidelity check
against the battles we CAN reliably verify (human-read videos), and PORT verified findings into `lib/sim`."** If a
reliable automated capture ever lands, revert toward the original automated loop — but do not block on it.

**Amended discipline question (§6):** "does this move the `sim-suite` (win/loss) number?" would score this session
**no** (hand-calc, coarse metric, Dragon-only) even though it clearly advanced the destination — so the question
was measuring the wrong thing. Replace with: **"did it make the Simulator's per-action behaviour match reality on a
verified battle, and is it captured so it persists (memory/handoff, and ported into `lib/sim`)?"** Everything else
in §6 stands (don't patch the old system; wiring beats fidelity; the Simulator is the destination).
