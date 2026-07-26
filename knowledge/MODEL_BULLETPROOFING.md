# MODEL BULLETPROOFING TRACKER

Goal: make the Dragon **Stage 16** Model the trustworthy PROTOTYPE for the whole Model, so we can
scale to more stages AND port to other dungeons without re-plumbing. Forensic audit 2026-07-26
(memory: `model-bulletproofing-forensics-2026-07-26`).

## What "bulletproof" must mean (the reframe)
"13/13 SPEC-CONFORMANT" today = the Model agrees with its own design and is internally stable. That is
NOT the same as: matches the real game, or is complete. A stage is **bulletproof** when:
1. Every combatant **including the boss** runs the ONE engine (`recipeFor||kitToRecipe→applyRecipe`, math via `computeRawHit`).
2. Every source clause is either executed or in the **single enforced** deferred catalog — no stale notes, no comment-only boss gaps.
3. Leaf formulas are anchored to the **real game tables** by a BLOCKING rung (not the Model's own output).
4. The **data layer** (recipes, operations, fixture builder) has teeth, not just the interpreter.
5. The harness runs the **real captured fixture** and reports the residual vs reality.

## The 5 root causes (verified from source)
- **R1 — the boss is an unmerged THIRD engine.** `dragon.js bossHit` never calls `computeRawHit` → boss
  hits bypass the incoming-mitigation stack (Pelops −20%, Tagoar −10%, Ezio nullify) + crit/affinity/variance;
  the boss is outside `recipes.js`/`mob-coverage` entirely (gaps live in code comments).
- **R2 — op status lives in 3–5 drifted sources.** registry (`operations.js`) vs the `applyRecipe` if/else vs
  `do*` fns vs recipe `deferred[]` prose vs `PHASE_II_EFFECT_INVENTORY`. Confirmed drift: `EXTRA_TURN`/
  `FILL_TURN_METER` marked not-built + no `CLEANSE`, yet all three run.
- **R3 — the QA ladder proves consistency+stability, not reality-correctness, on ONE Dragon fixture.**
  golden/snapshot are self-referential; the game-magnitude anchor (`sim-selftest`) is OUTSIDE the ladder;
  teeth bite only `interpreter.js`/`engine.js`.
- **R4 — champion specifics leak into the generic engine via name-string keys.** Bambus sponge hardcoded
  (literal 0.75); first-name keys (`BAMBUS-A1`) in ~6 sites bypass the champion registry.
- **R5 — stage-17 coverage was built in the deleted engine.** 28 open recipe clauses (10 st-17 mob, 10 st-16
  mob, 8 team); ~half only need re-WIRING to already-built ops.

## Plan (sequenced) — status
- **P0 — one source of truth for ops. ✅ DONE 2026-07-26.** Both dispatch surfaces are now table-driven —
  active recipes (`interpreter.OP_HANDLERS`) and passive triggers (`TRIGGER_OP_HANDLERS`) — with `IMPLEMENTED_OPS`
  = their union as the single authoritative list. `operations.js` flags reconciled (FILL_TURN_METER/EXTRA_TURN
  flipped, CLEANSE added). New BLOCKING rung `tools/model-ops-consistency.mjs` (wired into model-qa as an L1)
  fails if registry ↔ interpreter ↔ recipe `deferred[]` ever disagree; it immediately caught a hidden 2nd
  dispatch surface (WAKE_FROM_SLEEP). Stale "op not built" notes corrected to "op exists; not yet wired (P4)".
  **Ladder 14/14 green; snapshot byte-identical (refactor behaviour-preserving); teeth 100%.**
- **P1a — boss damage runs the shared mitigation stack. ✅ DONE 2026-07-26.** `dragon.js` `strike` now wraps
  `bossHit` in `incomingDamage(state, target, …)` — the same Pelops −20% / Aid-the-Feeble −10% / Ezio
  35%-nullify modifiers `computeRawHit` applies to wave/mob hits. (Deliberately NOT full `computeRawHit`: the
  boss's flat-damage model — atk × Decrease-ATK × DEF-mit — doesn't fit the coeff×stat shape, and full routing
  would wrongly add boss crit; only the verified-bypassed piece, the incoming modifiers, is applied.)
  CONFIRMATION (Model-appropriate): the boss's hit now CALLS `incomingDamage` and the reduction is APPLIED to
  world state before the next turn (fired-and-applied, deterministic) — that is the proof the mechanic is right,
  NOT any win rate. SIMULATOR OBSERVATION (separate lens, downstream): stage-16 volume 41.3%→42.3% over 300
  seeds; the change flips ONLY boss-phase runs (boss losses 60→57, wave-2 116→116 unchanged) — used to LOCATE
  the residual, never to validate the fix. Conclusion: the mitigation bypass was real but MINOR; the boss deaths
  and the dominant wave-2 wall are OTHER mechanics. Model ladder 14/14 green; sim-qa green (no re-bless).
  ⚠ NOTE (do not conflate): win-rate % is a SIMULATOR/volume metric (vs reality), NOT a Model output. The Model
  is not a predictor — it verifies per-turn that the right skill is called+fired and its effects land before the
  next turn. Never validate a Model/mechanic fix by a win-rate movement.
  Follow-up: one Simulator mutant went stale (`def-mitigation-noop`, source drifted) — repair to keep teeth sharp.
- **P1b — bring the boss under the Model (assertions + teeth). ✅ DONE 2026-07-26.** New rung `tools/model-boss.mjs`
  (in the ladder + in `model-mutants`' suite) asserts Hellrazor's turn-by-turn called→fired→applied sequence —
  Inhale arms the bar + drains his TM · team damage drains the bar · Scorch fires (AoE+[Stun]) if the bar is up
  and is interrupted if cleared · Wall of Fire → 2×[Poison]+[Weaken] · Swipe → [Decrease Attack] · P1a mitigation
  lands (direct + via the strike path) · on-hit reactions fire on the boss's hits. `model-mutants` extended to
  `dragon.js` with 7 boss mutants, all killed by model-boss → **kill rate 100% (39/39); ladder 15/15 green.**
  The boss's unverified behaviour is CATALOGUED (model-boss `catalog[]`), not comment-only.
  ✅ **RESOLVED (Mike verified in-game 2026-07-26):** on an INTERRUPTED-Scorch turn (team cleared the bar) the
  turn is WASTED — Hellrazor does NOT fall back on a normal skill; his TM resets and the team gets a fresh
  window. The old fall-through-to-Wall-of-Fire was a BUG (over-credited the boss a free hit) — now fixed in
  `dragon.js`, ASSERTED in model-boss (18/18), and TEETHED (mutant "interrupted turn not wasted", 40/40 killed).
  NOTE: this fix left the stage-16 SIMULATOR volume unchanged (42.3%) — because in these runs the team rarely
  CLEARS the 20%-MaxHP bar, so Scorch fires rather than being interrupted, and the wasted-turn branch is seldom
  hit. Whether the team should be clearing the bar (and whether bar-drain is fully credited) is a downstream
  thread for the wave-2/boss investigation, NOT this fix.
- **P2 — anchor correctness to the game.** Pull `sim-selftest` into the ladder as blocking; add teeth on the
  data layer; assert the real captured outcome. → TODO.
- **P3 — de-Dragon the harness.** `buildDragonBattle`→`buildBattle(dungeon)` adapter; registry-based recipe keys;
  move the Bambus sponge into data. → TODO.
- **P4 — finish the backlog through the reconciled system.** Re-wire the ~half that need existing ops (recovers
  the lost stage-17 coverage); build the genuinely-missing primitives (damage-based self-heal, repeat-if extra
  hit, heal-crit, random-target) golden-safety first. → TODO.

## Fidelity fixes landed
- **Leader SPD aura scales BASE speed only** (2026-07-26) — auras never scale geared/gear speed (True Speed §4).
  Centralized in `dragon-fixture.applyBattleLayers` (shared by sim-fixture-volume / sim-run / model-golden);
  base SPD sourced from the Gestal sync's ACTUAL `baseStats.spd` (build-from-sync → build file), DB max-ascension
  as fallback. Corrected stage-16 volume 42.3% → 38.0% (team is genuinely slower — implement-don't-fit, number
  moved DOWN). `model-golden` re-derived to turns 1-7 (Tagoar no longer cuts in at t7).
- **Arena bonus scales BASE HP/ATK/DEF only** (2026-07-26) — same fix as the aura, in `applyBattleLayers`; base
  HP/ATK/DEF sourced from the sync (`build-from-sync` → build file), SYNC-ONLY (no DB fallback — DB base
  HP/ATK/DEF are max-LEVEL and would over-credit an under-leveled champ; a build without them falls back to the
  old total-based arena, which keeps the frozen `model-golden` fixture unchanged). Volume 38.0% → 36.0%.
  ⚠ OPEN (CLAUDE.md #7): whether Classic Arena bonuses apply in PvE AT ALL is unverified — if not, arena should
  be removed entirely, a bigger call than base-vs-total.
- Remaining follow-up: the PRODUCT path needs a name→stats engine with LEVEL + ASCENSION scaling (the sync is a
  testing instrument, not the shipped stat source) — see memory `app-assigns-stats-sync-is-testing-only-2026-07-26`.

## Stage-16 catalog burn-down (session 2026-07-26 pm)
- `7fe1d64` **5/18** — Renegade A2 conditional Decrease SPD/ACC. New `target_has_buffs` condition kind +
  two wired placements (Decrease Speed 50% / Decrease ACC guaranteed-if-buffed). Consumers pre-existed.
- `9bec488` **6-7/18** — [Block Damage] consumer built in `engine.dealDamage` (negates a direct hit; not a
  pool) + `ignore_block_damage` flag → cleared Faceless A3 + Lua A3 together. Registered in CONSUMED_EFFECTS.
- `b3841fa` **8/18** — extra-hit proc (RNG roll type #12). New append-only `proc` stream + `extraHitChance`
  flag rolled in interpreter DEAL_DAMAGE → cleared Faceless A1 AND st17 Crossbowman A1. No golden drift (15% <
  seed=null threshold). RNG_REGISTRY row 12 + stream table updated.
- `448d006` **9/18** — random-target-per-hit (Renegade A2 + st17 Apothecary A1). New `pickRandomLiving` +
  `randomTargetPerHit` flag; non-random path byte-identical → NO drift (fixtures collapse to index 0).
- `7397f3a` **10/18** — Renegade A3 self-destroy. New `SELF_DAMAGE` op (30% own MaxHP, lethal). Snapshot re-blessed.
- `df9f70e` **11/18** — Bambus A2 buff-duration decrease. `REDUCE_EFFECT_DURATION` op (mirror of EXTEND_EFFECT).
  Snapshot re-blessed; "no buffs to reduce/extend" added to the benign fired/consumed whitelist.
- Catalog **15 → 8** this session (st17 17 → 14). Ladder 15/15, teeth 51/51 (100%) throughout. **9 unpushed commits.**
- **Remaining 8** (2 are BLOCKED/hardest):
  - ⛔ **BLOCKED on Mike** — Bambus A2 "+3% ally [Shield] value per enemy buff decreased": base (%shield-value vs
    %Bambus-MaxHP) is UNVERIFIED in the skill text. IMPLEMENT-DON'T-FIT forbids guessing. Ask before building.
  - **crit-conditional family** (Lua A1 AoE-on-crit, Lua A2 lifesteal-on-crit) — one core refactor: expose the crit
    OUTCOME from computeRawHit (critM>1 is unreliable at critDmg=0) + an EV path for seed=null. WILL drift golden+snapshot.
  - counterattack event (Ezio P2), debuff-activation (Ezio A2), sleep-break-on-hit (Bambus P), steal+Stun-on-low-dmg
    (Pelops A2), and the Ezio A2 Stone-Skin→Bomb named exception (the hardest — a branch, last).

## Discipline (unchanged, load-bearing)
We NEVER tune a magnitude to fit reality. A sim≠reality gap is a MISSING/WRONG mechanic to implement, never a
dial. Verify skill data from the live DB. Golden/snapshot must stay byte-identical across a behavior-preserving
refactor (verify leaves first, then rebaseline; confirm each red is the intended change).
