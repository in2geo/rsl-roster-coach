# SYSTEM INVENTORY — live vs dead vs built-but-unwired (2026-08-08)

**Purpose:** a safe map before any deletion. Classification = IMPORT-GRAPH closure (transitive from `server.js`
+ every `api/*` endpoint; 34 files reachable) cross-checked with git recency + file headers + memory.

**The key lesson:** "not reachable from the app" is **NOT** the same as "delete." It splits three ways —
abandoned **fossils**, **built-but-unwired INTENDED** systems (recent, on-purpose, same situation as the
Simulator), and legitimate **tool-support** libs. Of 22 lib modules the app doesn't import, only **~1** is
confidently safe to delete. Do NOT mass-delete off the import graph alone.

## LIVE — reachable from the running app (KEEP)
`match-engine.js` (orchestrator: `selectTeam` + the coverage-scan stage predictor `computeVerdictBand`),
`champion-names`, `gestal-context`, `estimate-stats`, `effective-stats`, `masteries`, `formulas`,
`damage-mechanics`, `multiplier-rank`, `synergies`, `watchdog`, `clan-boss`, `cb-damage-model`,
`sustain-profiles`, `explain`, `parse-roster`, `roster-import`.
- ⚠ **`contribution-model.js` = SUPERSEDED-BUT-RUNNING** — live but **display-only** (survival-blind). Retire
  in NORTH_STAR step 4, AFTER the Simulator replaces the coverage scan. **Do NOT delete now** — load-bearing.
- The coverage-scan stage predictor lives INSIDE `match-engine` (`computeVerdictBand`) — same status.

## SIMULATOR — `lib/sim/` (11) — the INTENDED stage predictor (KEEP; the destination)
`engine, interpreter, recipes, ai, dragon, dragon-fixture, clan_boss, spider, gear, operations, recipe-registry`.
`tools/`-only today BY DESIGN (see `NORTH_STAR.md`). This is the future, not clutter.

## BUILT-BUT-UNWIRED — INTENDED team-selection next-gen (KEEP; a STRATEGIC decision, not a cleanup)
All recent (late-Jul → Aug 2026), intended, but not wired into the live `match-engine`. Deleting these throws
away recent on-purpose work — same "built-but-unwired" disease as the Simulator.
- **Problem/role model (the PRODUCT MODEL):** `dungeon-mechanics.js` (08-05), `team-assembler.js` (08-03).
- **Archetype Selector (CB, 08-06, sim-validated):** `capability-profile`, `bucket-magnitude`,
  `archetypes/clan-boss`, `cb-shadow-goals`, `selection/feasibility`, `selection/candidate-generator`,
  `selection/leader`, `selection/team-score`.
- **`team-constructor.js` (07-18):** header says "Layer 3, NOT live" — intended structural replacement for `selectTeam`.
- ❗ **STRATEGIC QUESTION (for Mike, not a delete task):** the live team selector is still `selectTeam`, and there
  are **two** built-but-unwired replacements above (the role/problem model AND the archetype selector). Someone
  must decide which is the real plan, wire ONE, and cut the other. This is separate from the stage-prediction
  (Simulator) roadmap and is lower urgency (team selection "roughly works" today).

## LIKELY-SUPERSEDED pool/bucket rubrics (VERIFY with Mike before delete)
`dragon-rubric`, `ice-golem-rubric`, `fire-knight-rubric` (07-18/19), `spider-rubric` (08-03, "SHADOW"). The
pool/bucket approach appears replaced by the Archetype Selector ("old pool-select FROZEN" per memory). Probably
deletable — but `spider-rubric` is recent and labeled SHADOW, so confirm intent first.

## TOOL-SUPPORT / analysis libs (KEEP — correctly not in the app, NOT clutter)
`assumption-audit`, `battle-gaps`, `battle-pipeline`, `run-analysis`, `gap-review` — helpers for the
shadow/feedback tooling; they SHOULD be `tools/`-only. `gear-tier` — gear logic (verify vs `estimate-stats`).

## ✅ SAFE TO DELETE NOW (git is the archive — deletion loses nothing)
- **`lib/power-model.js`** — SUPERSEDED "power sufficiency / wall" evaluator (CLAUDE.md: "SUPERSEDED as the
  product"), 07-16, imported only by 4 tools (`calibrate-power`, `calibrate-survival`, `scoreboard`,
  `shadow-kill-floor`). Delete it + those 4 tools in one labeled commit.
- **That is essentially the entire confidently-safe delete list.** Everything else is running, the future, an
  intended-but-unwired system, or tooling.

## Database "pool system" (separate, lower risk)
The DB cruft (e.g. `champion_solo_profiles` = PARKED/`proposed`; any pool/bucket tables) is handled via **status
flags + committed seeds**, never ad-hoc deletion (CLAUDE.md hard rule). Not part of this code inventory.

## VERDICT
The clutter is REAL but it is mostly **built-but-unwired INTENDED systems**, not garbage. Confidently deletable:
~1 module. The true cause is the **same disease as the Simulator** — intended systems built and left unwired. The
cure is **wiring + one strategic team-selection decision**, not mass deletion. Method/script: recompute anytime
with an import-graph closure from `server.js` + `api/*`.
