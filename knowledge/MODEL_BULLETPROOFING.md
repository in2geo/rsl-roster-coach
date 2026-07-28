# MODEL BULLETPROOFING TRACKER

Goal: make the Dragon **Stage 16** Model the trustworthy PROTOTYPE for the whole Model, so we can
scale to more stages AND port to other dungeons without re-plumbing. Forensic audit 2026-07-26
(memory: `model-bulletproofing-forensics-2026-07-26`).

## ⚠ 2026-07-26 pm — "complete:true" was NOT bulletproof (reality-aggregate audit). NEXT: fix Bambus's damage engine
Against the WATCHER's real Dragon-16 aggregate (`gestal-sync/RslBattleReader/output/battle-log.json`, 76 battles,
**90.8% WR**), the sim wins **~36%**. Root cause (100-seed aggregate + isolated tests — see memory
`dragon16-bambus-poison-redirect-rootcause-2026-07-26`): **Bambus's primary damage engine (~368k real) is his
POISON REDIRECT** — Hellrazor's Wall of Fire poisons the team → Bambus (Sleeping Sage) sponges the poisons off
allies → dumps them onto Hellrazor unresistable → Poison is 5% of MAX HP → on the boss's 727k HP that's ~36k per
stack per tick. In the sim this engine is DEAD (Bambus deals 94k not 368k). Three compounding causes, in fix order:

1. **BOSS BARELY CASTS WALL OF FIRE — the poison FUEL (biggest).** `lib/sim/dragon.js act()`: with `SIM_SCORCH=never`
   (optimistic default) every armed Scorch is a "turn wasted" early `return`, and Inhale re-arms it while draining
   the boss TM — so the boss loops Inhale + wasted-Scorch and rarely reaches the Wall-of-Fire branch (the cds only
   decrement after a Swipe, itself seldom reached). Measured: **~2 Wall of Fire casts across 120 boss phases.** No
   Wall of Fire → no team poison → nothing to sponge. FIX: make the rotation cast Wall of Fire at a realistic
   cadence regardless of the Scorch bound (decouple the Scorch-bound wasted turn from the WoF/Swipe cooldown clock).
2. **SPONGE STACK COLLAPSE (~6-10× magnitude, verified).** `interpreter.maybeSponge` (~line 287) moves poison via
   `upsert(bambus.debuffs, {type,value,pct,turns})` with NO stacks/stacking/maxStacks → Bambus's Poison caps at 1
   stack and never accumulates across the 5 poisoned allies. Should hold ~10 stacks (dump ~360k/tick); holds 1
   (36k/tick). FIX: carry + accumulate the source debuff's `stacks` through the sponge (and cap at maxStacks 10).
3. **WAVE-2 WIPES (separate, earlier).** Many runs die in wave 2 before the boss — the shorter losses. Reality
   almost always clears the waves; its losses are long boss-attrition. Distinct from 1–2; needs its own pass.

Wiring is CORRECT (sponge→dump→%MaxHP-on-boss proven in isolation with the roll forced) — it's STARVED (no fuel)
and under-scaled (stack collapse). Ruled out (aggregate-tested, inert): debuff entry-vs-slot count, Bambus AoE
slot-trigger, landChance curve. Damage is realistic on the mob side; per-hero real anchors: Bambus 392k, Pelops
374k, Ezio 332k (same in real wins AND losses). **QA GAP this exposes:** add a reality-CADENCE / per-hero-damage
rung vs the watcher — presence+teeth (`complete:true`) never checks a mechanic FIRES or PRODUCES its damage in a
full fight. Also: `tools/sim-trace.mjs` omits `applyBattleLayers` (runs aura-less) — fix so the oracle matches volume.

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
- **P2 — anchor correctness to the game. ✅ DONE 2026-07-27 (all three parts).** Three sub-parts:
  - **(a) `sim-selftest` (the game-magnitude anchor) is now a BLOCKING ladder rung + teethed. ✅ DONE.**
    `sim-selftest.mjs` — the ONLY rung that pins engine leaf formulas (`landChance` §8 / `defMitigation`
    §12 / affinity §7) to Raid's PUBLISHED tables rather than to the Model's own output — was outside the
    ladder (R3). Added to `model-qa.mjs` RUNGS as an L2 spec rung (**ladder 16 → 17, all green**; a
    magnitude regression now BLOCKS as a spec_violation, not a reality gap) AND to `model-mutants.mjs` RUNGS
    as a killer. Proof it is TEETHED, not merely present: a new mutant (`landChance` 0.67→0.50 resist-curve
    constant) is killed by **`selftest` ALONE** — the deterministic (seed=null) toy battles land debuffs on
    an `iff p>0.5` rule, so a same-side magnitude change is invisible to them; only the anchor's exact-table
    assertions catch it. Teeth **65/65, 100%, no holes/stale**. This is VERIFICATION ADDED — no combat
    behaviour changed (the anchor formulas were already correct; they just weren't in the blocking gate).
  - **(b) teeth on the DATA layer — ✅ DONE.** `model-mutants.mjs` now snapshots/restores all SIX files
    (added `recipes.js`, `operations.js`, `dragon-fixture.js`) and runs `model-ops-consistency.mjs` +
    `model-snapshot.mjs` as no-DB killers. Three data-layer mutants added, each killed by its intended rung:
    a corrupted authored recipe coeff (Ezio A1 mult 4→8) → `model-snapshot`; a flipped op-registry flag
    (`HEAL` implemented:true→false) → `model-ops-consistency` ALONE; a broken fixture scaler (aura SPD no-op)
    → `model-snapshot` ALONE. To teeth the fixture builder no-DB, `model-snapshot.mjs` gained a
    `FIXTURE-LAYERS` fingerprint that runs `applyBattleLayers` on a synthetic team (baseline re-blessed:
    41→42 fingerprints, a deliberate coverage add, no behaviour change). Teeth **68/68, 100%, no holes/stale**;
    ladder still **17/17 green**.
  - **(c) assert the real captured OUTCOME — ✅ DONE (narrow LIVENESS invariant, Mike's call 2026-07-27).**
    The decision (not to block on win-rate — that stays the bucket-4 gap while the sim is incomplete) was to
    block on ONE narrow, always-true-in-reality thing: **a real captured battle ALWAYS resolves decisively**,
    so replaying a golden fixture must reach a WIPE (WIN or LOSS) — never hit the turn cap (TIMED OUT) or
    throw. A timeout/throw on real input is an infinite-stalemate / crash bug, ORTHOGONAL to the win-rate
    incompleteness (and exactly what an over-tuned survival mechanic — e.g. the uncommitted global duration
    fix — could introduce). `sim-golden.mjs` now records `timedOut`/`threw` per fixture (replay wrapped so one
    stuck fixture is a recorded liveness failure, not a rung crash); `sim-qa.mjs` classifies those as bucket-1
    spec_violations (BLOCK) while `outcomeMatch===false` stays bucket-4 (non-blocking). Deliberately NOT a
    per-hero survival assertion — the single-run-anchor trap ([[reality-anchors-single-run-trap-2026-07-27]])
    means per-hero end-state (Ezio dies+revives) is not reliable ground truth. **Teeth:** `SIM_GOLDEN_TURNCAP=5`
    forces the real fixtures to time out → sim-qa BLOCKS (verified); at the real cap all 3 fixtures resolve
    decisively (turns 217/217/333 < 400) and sim-qa is green.
    - **Side repair (pre-existing, surfaced by this work):** `sim-mutants.mjs` "heal overheals past MAX HP"
      probe had gone STALE — its `find` drifted when `* (1 - healReduction(c))` was added to the Continuous
      Heal tick (`engine.js`), so the mutant silently stopped running and BLOCKED sim-qa. Find-string
      refreshed (intent unchanged, still an `expectKill:false` probe). sim-qa: **BLOCKED → SPEC-CONFORMANT**,
      mutation 11/12 (the 1 remaining is that heal-overheal coverage-gap probe, correctly non-blocking).
- **P3 — de-Dragon the harness. 🟡 IN PROGRESS 2026-07-27.** Three welds; slice 1 of 3 done:
  - **(2a) champion-key chokepoint — ✅ DONE (behaviour-preserving).** The `<FIRSTNAME>-<SLOT>` recipe key
    was derived by an inline `name.split(' ')[0]…toUpperCase()` re-implemented in ~8 sites across
    `engine.js`/`interpreter.js` — and INCONSISTENTLY (some stripped the fixture `#`-suffix, some didn't).
    That scatter is the name-string collision risk R4 named. Now ONE exported `champKey(name)` in
    `recipes.js` (strips first token + `#`, uppercases); `recipeFor`, `spongeOwner`, passive
    triggers/immunities, the `incomingDamage` modifiers scan, and `isRecipeDriven` all route through it.
    Byte-identical: model-snapshot no-drift, model-golden 7/7, model-qa 17/17 (teeth 100%), sim-qa
    SPEC-CONFORMANT. The `#`-unifying is safe because mobs (which carry `#`) only resolve via
    `recipeFor`/`isRecipeDriven` (already stripped), while the passive/modifier sites match only team-champ
    recipes (allies, no `#`). This is the ENABLING step: swapping `champKey`'s internals for a champions.id
    registry lookup ([[naming-architecture]] / CLAUDE.md hard rule) is now a single-site change.
  - **(2b) registry-anchored recipe champions — ✅ DONE (guard rung, not hot-path id-keying).** FINDING:
    keying the engine's recipe lookup literally by `champions.id` would DB-couple the engine and BREAK the
    no-DB contract ~10 rungs depend on — combatants (`makeCombatant`) carry only a name, and the alias bridge
    ("Bambus" → canonical "Bambus Fourleaf") needs the DB `champion_aliases` rows. So the hot path stays
    `champKey`/no-DB, and the registry lives at VALIDATION: new DB rung `tools/model-recipe-registry.mjs`
    (in model-qa, **17→18 green**) resolves every recipe `champion` through the sanctioned
    `buildNameResolver` (never a raw compare, per the CLAUDE.md rule) and BLOCKS on (1) a champion that
    doesn't resolve to a champions.id, (2) champKey non-injective over recipe champions, or (3) any other
    champion/alias sharing a recipe's champKey but a different id. **R4 validated by data:** the first-token
    champKey has **19 collisions among the 944 champions** (DARK→Athel/Kael/Elhain, SUPREME×4, LADY×8,
    CRIMSON→Pegason/Slayer/Helm, …); today none overlap the 13 recipe champkeys (green), but authoring a
    recipe for e.g. "Dark Athel" would now be caught. Teeth verified: Vergis→"Crimson Helm" blocks (check 3),
    Vergis→"Vergisxyz" blocks (check 1); reverted → green. All 13 recipe champions (incl. the Dragon "mobs"
    Lua/Faceless/Arbalester/Renegade/Tayrel/Hordin/Crossbowman/Apothecary — which ARE real champions)
    resolve. [[naming-architecture]] / CLAUDE.md registry rule satisfied at the validation layer.
  - **(3) move the Bambus sponge into DATA — TODO.** `SPONGE_EXCLUDE` + the literal `0.75` + `maybeSponge`
    are hardcoded champion-specifics inside the generic interpreter; encode them on Bambus's passive recipe.
  - **(1) `buildDragonBattle` → `buildBattle(dungeon)` adapter — TODO (likely premature).** Hard to validate
    genericity without a second dungeon in `lib/sim`; do after (2b)/(3).
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

## 🎯 STAGE 16 IS PERFECT — `complete:true` (2026-07-26 pm)
`MODEL_QA_STAGE=16 mob-coverage 16` → **COVERAGE COMPLETE: unimplemented:0, hardFails:0, complete:true** — every
Stage-16 combatant's full kit (team + all wave mobs) is modelled and firing. Ladder 15/15, teeth **63/63 (100%)**,
Gates green, no snapshot/golden drift on the no-drift clauses. This is the bulletproof PROTOTYPE — the whole
campaign's target. **NEXT: replicate to the rest of Dragon Normal** (author Families C/D/E from the trusted
first-party wave data; boss is shared + already under the Model), then port the pattern to other dungeons.
Stage-17 catalog is down to ~10 as a side effect (several ops cleared st17 clauses too) — a good next stage.

New primitives built this campaign (all with teeth + verified DB data, never guessed): `SELF_DAMAGE`,
`REDUCE_EFFECT_DURATION`, `DEBUFF_ACTIVATION`, `BOOST_SHIELD`, `COUNTERATTACK`, `PLACE_BOMB` ops · the `proc` RNG
stream (extra-hit) · crit-OUTCOME exposure (`rollCrit`, crit-heal/crit-splash riders) · random-target-per-hit ·
`[Block Damage]` + `[Bomb]` consumers · condition kinds `target_has_buffs`/`under_buff`/`not_under_buff` ·
post-damage `damageGate` · `forceTarget`. Two magnitudes were Mike-confirmed (Bambus shield +3% MaxHP; Ezio
Poison-activation removes on land); [Bomb] = 6×ATK from DB review_notes.

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
- `fe8c122` **12-13/18** — crit-conditional riders (Lua A1 AoE-splash + Lua A2 lifesteal-on-crit). New
  `engine.rollCrit` exposes the crit OUTCOME ({crit,mult,ev}) with the identical single crit-stream draw;
  computeRawHit returns crit+critEv; dealOneHit applies `critHealPct`/`critSplashPct` riders (rolled crit →
  fire; seed=null EV → cr%×effect). Snapshot re-blessed (LUA-A1). LUA-A2 covers:['crit-heal'] for the «heal» kw.
- `ef8abe9` **14/18** — Ezio A2 [Poison] activation. New `DEBUFF_ACTIVATION` op + `activatePoisons`/`debuffSlots`
  helpers. Mike-confirmed: poisons deal damage now and are REMOVED; Poison STACKS count individually toward the
  4+-debuff gate. Snapshot re-blessed.
- `21c476f` **15/18** — Bambus A2 [Shield] boost. New `BOOST_SHIELD` op; REDUCE_EFFECT_DURATION now returns the
  count (ctx.buffsDecreased). Mike-confirmed base: +3% of Bambus MAX HP per buff decreased. **BAMBUS-A2 now
  fully EXECUTABLE.** Snapshot re-blessed. Both Mike-blocked clauses are now cleared.
- Catalog **15 → 4** this session (st17 17 → 12). Ladder 15/15, teeth 56/56 (100%) throughout. **push when ready.**
- **Remaining 4** (all buildable; the last is the hardest):
  - Ezio P2 — 35% counterattack-when-attacked (on-attacked reaction + chance + a follow-up A1 hit; watch the
    cascade — a counter must not re-trigger counters infinitely).
  - Pelops A2 — steal all buffs + [Stun] 2t if a hit dealt <50% of the target's MAX HP (post-damage conditional;
    needs the hit's inflicted damage available to a follow-up action; unresistable if target [HP Burn]).
  - Bambus P — [Sleep]-break-on-enemy-attack (on-attacked removes [Sleep] + fires the existing dump; interacts
    with the Sleeping-Sage sponge — the wake must stop the sponge).
  - **hardest, last:** Ezio A2 [Stone Skin]→[Bomb] branch (a named-exception alternate skill path).

## Discipline (unchanged, load-bearing)
We NEVER tune a magnitude to fit reality. A sim≠reality gap is a MISSING/WRONG mechanic to implement, never a
dial. Verify skill data from the live DB. Golden/snapshot must stay byte-identical across a behavior-preserving
refactor (verify leaves first, then rebaseline; confirm each red is the intended change).
