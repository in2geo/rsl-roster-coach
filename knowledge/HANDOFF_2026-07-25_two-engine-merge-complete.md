# HANDOFF 2026-07-25 — THE TWO-ENGINE MERGE IS COMPLETE (one combat engine)

Read this FIRST for cold start. Prior layer: `HANDOFF_2026-07-25_boss-phase-loss-driver.md` (the pre-merge state).

## One-line state
The sim had **two combat engines that silently drifted**; they are now **ONE**. `applySkill` (the parsed-kit
engine) is **DELETED**. Every combatant — authored or not — runs `recipeFor(actor,slot) || kitToRecipe(skill)
→ interpreter.applyRecipe`. **Model QA ladder = 13/13 SPEC-CONFORMANT for Dragon stages 16 AND 17.**

## Is the Model bulletproof? — YES for 16/17, with named caveats
- **ONE engine, no drift surface.** The shared per-hit math is `engine.computeRawHit` (crit × DEF-mit ×
  affinity/[Enfeeble] × variance × ignore-DEF + incoming modifiers), called by the recipe path AND (formerly)
  applySkill. The 4 historical drifts — [Enfeeble]→weak-hit, incoming-damage modifiers, Warmaster/gear procs,
  effectiveScaleStat buff-folding — are now impossible (computed in one place).
- **Every stage-16/17 combatant runs an AUTHORED recipe** (mob-coverage tripwire: "no auto-parse fallback").
- **Teeth 100% kill, golden byte-identical, snapshot byte-identical, 4 toys green, census green, invariants
  8845/0, sensitivity green.** The whole ladder is green.
- **Un-authored content is unified too:** `kitToRecipe` synthesizes a recipe from any parsed skill; a parity
  harness proved **573/573 skills (200 champions) produce byte-identical combatant outcomes** vs the old
  applySkill (state parity; ledger diffs benign).
- ⚠ **CAVEATS (honest):** (1) the parity harness ran single-skill under all-land mode; multi-turn `seed=null`
  scenarios were NOT A/B'd BEFORE deletion — verified post-hoc via sim-snapshot (interpreter came out MORE
  correct: right lowest-max-HP targeting). (2) "Bulletproof" = no drift + spec-conformant; the Model is still
  **incomplete BY DESIGN**: 18 stage-17 mob mechanics + 31 deferred card clauses are catalogued-not-silent
  (the backlog, not bugs). (3) kitToRecipe is proven for stages we exercise; new dungeons should re-run parity
  thinking (see below).

## What changed this session (in order)
1. **Restored the green baseline** after the real DEF/RES formulas (implemented last session) cascaded red:
   verified the leaf formulas in isolation (selftest anchors: DEF mitigation pinned to 4 computed points incl.
   L220; ACC/RES to 7), fixed a stale census probe, rebased the 4 toys to COMPUTE expected from `defMitigation`
   (can't go stale again), re-blessed golden (proved pure mitigation-swap via ratio-invariance) + snapshot
   (0 structural change). Method: verify leaves FIRST, then rebaseline; confirm each red is the verified change.
2. **Unified the damage math** → `engine.computeRawHit` (moved formulaBase/dynamicScaleFactor/incomingDamage
   from interpreter to engine; engine imports recipes.js — no cycle). Both engines call it.
3. **Added the missing interpreter ops** (additive, golden-safe): `CLEANSE`, `FILL_TURN_METER`, `EXTRA_TURN`
   (+onKill), conditional `PLACE_DEBUFF`, `%maxHP DEAL_DAMAGE`; shared `applyWarmaster` + `fireGearProcs`.
4. **`kitToRecipe(skill)`** (interpreter.js) — parsed skill → recipe. DEAL_DAMAGE accepts an inline `act.formula`;
   REDUCE_TURN_METER honors `accuracy_check`.
5. **Parity harness** `tools/sim-parity.mjs` (DELETED after use — needed applySkill; result 573/573 recorded).
6. **DELETED applySkill.** Dispatch registered cycle-free via `lib/sim/recipe-registry.js` (engine imports it +
   a bottom-of-file `import './interpreter.js'` side-effect so the dispatch is available even to tools that
   never call installRecipeRun). Passive guard in `dealOneHit`: fire the defender's on-attacked once —
   `fireDamageReactions` if `isRecipeDriven`, else parsed `fireOnAttacked`. mob-coverage tripwire repointed
   `_fallbackFires`→`_kitSynth` (authored content must use authored recipes, not auto-parse).

## Simulator stage-16 volume — the calibration frontier (NOT a merge regression)
`node --env-file=.env.local tools/sim-fixture-volume.mjs 300` → **41.3%** vs reality **88.5%**. This is NOT the
merge (golden/snapshot byte-identical; volume always ran the authored recipe path). It opened when the REAL
DEF/RES formulas landed (team damage ~0.82× → slower waves → more incoming). Loss shape is CORRECT for stage 16
(wave 2 dominates: 116 wave-2 / 60 boss — reality also struggles at wave 2, confirmed by Mike).
- **KEY FINDING:** enabling team **Warmaster** (`SIM_TEAM_MASTERY=1`, env-gated in dragon-fixture, default OFF)
  → **66.7%** (200/300), survivors median 5/5, losses shift toward boss (73 wave-2 / 27 boss). So **missing
  masteries ≈ 25 of the ~47-point gap** — a DATA-CAPTURE fix (build files carry no mastery data), not a mechanic
  bug. Remaining ~22 pts to 88.5% = boss-phase mitigation stack + residual wave-2 magnitude.

## NEXT (in priority order)
1. **Capture team masteries** (has_boss_mastery per champion) into the build files so Warmaster is ON for real —
   worth ~25 pts of win rate. The env flag is a stopgap.
2. **Boss-phase mitigation stack** (the 27–60 boss losses): Aegis/Ally-Protection/Pelops−20%/Aid-the-Feeble/
   shields keeping Vergis's incoming under the 10%-MaxHP shield threshold. Start at the purple-bar/Scorch race
   (`SIM_SCORCH` default=never). DON'T tune win rate down — find the mechanic.
3. **Residual wave-2 magnitude** once masteries are in.
4. (Model hygiene) build the 18 deferred stage-17 mob mechanics using the new ops (EXTRA_TURN/conditional/
   FILL_TURN_METER now exist); re-run mob-coverage.

## Headline tools
- Model QA: `MODEL_QA_STAGE=16 node --env-file=.env.local tools/model-qa.mjs` (or omit for 17).
- Simulator volume (headline): `node --env-file=.env.local tools/sim-fixture-volume.mjs 300`
  (add `SIM_TEAM_MASTERY=1` to include Warmaster).
- Key files: `lib/sim/engine.js` (computeRawHit, dispatchSkill, riders), `lib/sim/interpreter.js`
  (applyRecipe + ops, kitToRecipe, recipeDispatch, passive guard), `lib/sim/recipe-registry.js` (cycle-free
  dispatch), `lib/sim/dragon-fixture.js` (bossMastery flag).

## Branch
`session/qa-rungs-2026-07-23`, NOT pushed. All green. The DEF/RES real-formula change + the merge are both in.
