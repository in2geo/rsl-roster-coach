# HANDOFF 2026-07-26 — Stage-16 PERFECTION campaign (+ enforcement gates)

Read this FIRST on a cold start. Prior layer: `HANDOFF_2026-07-25_two-engine-merge-complete.md`.
Working tracker: `knowledge/MODEL_BULLETPROOFING.md`. Branch `session/qa-rungs-2026-07-23`, **NOT pushed**, all green.

## One-line state
The Dragon **Stage-16** Model is being made **PERFECT** (Mike's bar: bulletproof = 0 deferred clauses, every
detail modelled, `mob-coverage` complete:true). Catalog is **18 → 15** clauses remaining. Model QA **15/15**,
teeth **44/44 (100%)**, sim-qa green. Two tooling **gates** now make the process self-enforcing for every wave.

## THE STANDARD (do not soften — Mike, 2026-07-26)
**"bulletproof means PERFECT in every way. everything matters; every detail affects something else."** A
CATALOGUED deferral is still a hole. "inert in this fight" / "edge case" / "accepted deferral" are NOT valid
reasons to skip. A placed effect isn't done when it LANDS — it's done when it has a **CONSUMER** (the
Heal-Reduction trap). Params come from the VERIFIED live-DB `champion_skills.skill_summary`, never invented
(IMPLEMENT-DON'T-FIT). The number is allowed to move (it moved DOWN this session as over-credits were removed).

## The enforced per-clause loop (how to clear a clause)
1. Pull the champion's verbatim `skill_summary` from the live DB (verify the exact %/magnitude/duration/condition).
2. Implement: op (if new) + **consumer** (if the effect needs one) + wire the recipe action. Clear its `deferred[]` entry.
3. Teeth: a `model-boss.mjs` (or toy-test) assertion + a `model-mutants.mjs` mutant that the assertion kills.
4. Golden-safe: run `model-qa`. If `regression snapshot` goes red, confirm the drift is ONLY the recipe(s) you
   changed (`node tools/model-snapshot.mjs`), then re-bless `SNAPSHOT_BLESS=1 node tools/model-snapshot.mjs`.
   (`model-golden` is turns 1–7 of wave 1 — unaffected unless you touch a t1–7 actor.)
5. Ladder green + `mob-coverage <stage>` count drops → commit `Stage-16 perfection N/18: <clause>`.
6. ⚠ Editing a line a mutant's `find` targets makes that mutant STALE (blocking) — re-anchor its `find`/`repl`
   to the new line (happened twice this session; the stale-guard catches it).

## THE TWO GATES (built this session — they enforce the loop for ALL waves)
- **Gate #1 — card→recipe coverage over EVERY combatant** (`tools/sim-validate-recipes.mjs`): derives the champ
  list from the recipes (team + all mobs), so every source clause must be in an action or `deferred[]` — no
  mob clause can be silently dropped. (Caught the `[Increase C. RATE]` vs `Increase C.RATE` naming mismatch.)
- **Gate #2 — consumer registry** (`engine.CONSUMED_EFFECTS`): every PLACE_BUFF/PLACE_DEBUFF effect type must
  have a wired consumer or the rung fails. Keep the Set in lockstep with the consumers in `engine.js`.

## Verify green (headline commands)
- Model QA (defaults coverage to stage 17): `node --env-file=.env.local tools/model-qa.mjs`  → 15/15.
- Stage-16 catalog: `MODEL_QA_STAGE=16 node --env-file=.env.local tools/mob-coverage.mjs 16` → `unimplemented:15`.
- Simulator volume (a Simulator metric, NOT a Model output): `node --env-file=.env.local tools/sim-fixture-volume.mjs 300` → ~36%.

## What this session shipped (commit chain on the branch, NOT pushed)
`8d404ed` cleanup (12 dead files; 244MB top-level scratch → `../_archive/`) · `ff8d017` P0 (single-source op
dispatch + `model-ops-consistency` rung) + P1 (boss under the Model: `model-boss.mjs`; boss damage now runs
`engine.incomingDamage`) · `9c9e236` aura = +19% of BASE speed (True Speed) · `031acc2` arena = +% of BASE
HP/ATK/DEF · `bd91ba8` perfection 1/18 Bambus boss-Enfeeble · `0e93828` perfection 2-4/18 Heal Reduction
consumer + Renegade A1 + Faceless A2 · `c1e12d5` the two gates + `effectiveAcc` consumer.

## Verified GAME FACTS learned this session (authoritative, Mike + live DB)
- **Auras scale BASE stat only** (not geared). Ezio SPD aura = +19% of base SPD. **Arena** = +% of base HP/ATK/DEF
  (Bronze III ≈ +3%), grants **no SPD/ACC/RES**. **Great Hall has no SPD.** ⚠ OPEN: does Classic Arena apply in
  PvE at all? (CLAUDE.md open-Q #7) — if not, remove arena entirely.
- **Base stats:** SPD/ACC/RES/crit are level-INDEPENDENT; only HP/ATK/DEF grow with level. Ascension changes
  multiple stats incl SPD. DB `champions.base_*` = MAX level + MAX ascension. The Gestal sync's per-champ
  `baseStats` = the ACTUAL base at current level+ascension — that is the correct source for the aura (sim uses it).
- **Hellrazor "Almighty Immunity"** includes **Enfeeble + Petrification** (added to `HELLRAZOR_IMMUNE`).
- **Interrupted-Scorch turn is WASTED** — clearing the purple bar → Hellrazor takes NO fall-back skill.
- **Dragon wave composition in `dungeon_stage_enemies` is Mike's first-party capture — TRUSTED** (NOT the old
  Gemini list). All 25 Dragon Normal stages have waves; mobs = ~5 recurring families. Family A (Lua/Faceless/
  Arbalester/Renegade) authored @st16; Family B (Tayrel/Hordin/Crossbowman/Apothecary) @st17; C/D/E unbuilt.

## PRODUCT vs TESTING (load-bearing — don't conflate)
The shipped app does NOT pull raw data: players enter a champion by NAME + attributes and the app ASSIGNS stats.
The Gestal sync is a TESTING instrument (engine ground truth), NOT the production stat source. ⇒ a REQUIRED
product component (does not exist): a name→stats engine with LEVEL + ASCENSION scaling of the max-base DB stats
+ gear-tier estimates. Separate from the Model/sim work; needed before players ever see this.

## NEXT — the 15 remaining Stage-16 clauses (the work-list)
**MOB (8)** — the fastest, and several ops also clear stage-17 clauses:
- Renegade A2: 50% [Decrease SPD] 15% 2t + 25% [Decrease ACC] 2t **if target has buffs** — consumers now exist
  (effectiveAcc/statFactor); needs a `target_has_buffs` condition kind (trivial, like `is_boss`). **Do first.**
- `ignore [Block Damage]` — build [Block Damage] as a buff consumer in `dealDamage` + an `ignore_block_damage`
  formula flag → clears **Faceless A3 + Lua A3** together.
- Faceless A1 / (Crossbowman A1 st17): 15% chance of an extra hit — a `repeat_if`/chance-extra-hit modifier.
- Renegade A2 / (Apothecary A1 st17): "at random N times" — true random-target-per-hit.
- Lua A1: on crit → 50% of the damage to ALL enemies (crit-conditional AoE splash).
- Lua A2: each crit heals Lua 2.5% HP (lifesteal-on-crit).
- Renegade A3: self-damage = 30% own MAX HP even if lethal (self-DESTROY).
**TEAM (7):**
- Ezio P2: 35% counterattack when attacked (event trigger).
- Ezio A2: instantly activate all [Poison] on enemies with 4+ debuffs (debuff-activation — may bear on wave-clear speed).
- Ezio A2: [Stone Skin]→[Bomb] branch (named exception — hardest).
- Bambus passive: [Sleep] also removed by an enemy attack (sleep-break-on-hit).
- Bambus A2: 75% decrease all enemy buff durations 1t (`REDUCE_EFFECT_DURATION` op) + +3% ally [Shield] per buff decreased.
- Pelops A2: if dmg < 50% target MAX HP → steal all buffs + [Stun] 2t (unresistable if target [HP Burn]).

When Stage 16 hits `complete:true` (0 deferred), it is the PERFECT prototype → replicate to the rest of Dragon
Normal (author Families C/D/E from trusted wave data; boss is shared + already under the Model), then other dungeons.

## Where the Simulator number stands (context, not a target)
Stage-16 volume 36% vs reality 88.5%. The gap is NOT broken mechanics or a missing modifier — it's SPEED
(turns→sustain) plus captured-stat inputs; the aura/arena corrections moved it DOWN because they removed
over-credited stats. Don't tune it. Perfect the Model first; the Simulator judges by VOLUME separately.

## Known follow-ups (catalogued, not blocking)
- `sim-invariants` should assert HP ≤ max after a HoT tick (one reported coverage gap; that sim-mutant is a probe until then).
- Tagoar DB `base_spd` = 92 vs actual 98 — a DB data-quality fix.
- Push the branch when ready (7 commits this session, all green).
