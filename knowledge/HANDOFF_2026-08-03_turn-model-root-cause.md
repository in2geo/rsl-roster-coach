# HANDOFF 2026-08-03 — Champion-identity unification, deferred mechanics, and the TURN-MODEL root cause

**COLD START:** read this, then `[[champion-identity-unification-2026-08-03]]` + `[[mastery-layer-and-dragon-turn-gap-2026-08-02]]`. Continues `HANDOFF_2026-08-03_dragon-turn-order-mechanics-and-deferred-surfacing.md`. Team under calibration: **DonaHilvi Dragon-16 pool team** (Michelangelo lead / Ninja / Hilvi / Iudex Artor / Coldheart). Fixture `test/golden/dragon-donahilvi-pool-current.json`. Branch `session/qa-rungs-2026-07-23` (uncommitted).

## THE HEADLINE (where the whole session landed)
The pool team's **Coldheart over-deal (sim 356k vs reality 223k)** is NOT a damage-model or deferred-mechanics problem. It is **downstream of the TURN MODEL**: the sim's phases run too long (**wave1/wave2/boss = 36/42/106 vs reality 25/25/51**), which lets the team's cooldowns recharge, which breaks the wave-2 opening, which stops Coldheart from ever dying. Full chain, every link measured:

1. **Waves run long** → the team's A2 boost-skills (cd 4-5) **recharge before wave 2**.
2. → at wave 2 the team **floods ~13 actions before the first mob acts** (ally turn meter carries across the wave transition AND the recharged boost-skills fire). Reality: 5 allies once each, then **Faceless 6th**.
3. → **Faceless (A2 "Lightning", 5.5×ATK ≈ 12k) and Arbalester ("Lucky Shot" ≈ 15k) die before their turn** — the wave mobs act only **3× all fight (39:1 ally:enemy ratio)**.
4. → the 2-shot burst that kills Coldheart in wave 2 never lands. She takes **5 hits / 13.4k all fight, min HP 37%**, and Artor tops her off.
5. → she **never dies (0/20 sims)**; reality she dies in wave 2 AND the boss phase and is **revived by Hilvi almost every fight**.
6. → she enters the boss phase full and **over-casts Heartseeker (~4.7× vs ~2×)** → **over-deals**.

Everything else chased this session (Poison capture, Artor's heal, the MaxHP damage model, cast frequency) is a symptom. **The trunk is the turn model** — the OPEN turn-counting/turn-order convention the prior handoff put on HOLD. It is now UNBLOCKED because Mike confirmed the wave turn order in-replay (see the anchor below).

## THE TURN-ORDER ANCHOR + CHECKER (start here next session)
- **`test/turn-order/dragon-pool-wave-order.json`** — reality-confirmed actor(:skill) sequence per wave phase.
  - **wave 1**: the first ~13 turns, CONFIRMED vs reality (Mike). All allies start TM 0 → SPD order (Mikey 196 > Ninja 167 > Hilvi 165 > Coldheart 159 > Artor 148) → cycle. **Sim MATCHES — keep it green.**
  - **wave 2**: TARGET. Reality = whole team once each (SPD order), then **Faceless 6th** casts Lightning on Coldheart. **Sim FAILS** (floods 13 ally actions off carried TM + recharged boost-skills, no mob until 14th).
- **`node --env-file=.env.local tools/turn-order-check.mjs`** — diffs the sim's wave openings vs the anchor. Today: **wave 1 ✅ PASS, wave 2 ❌ FAIL at position 1.** Report-only (exits 0). **The turn-model job: make wave 2 pass by fixing the wave-transition turn economy — NOT by tuning damage.**

### The two coupled causes of the wave-2 miss (verified at wave-2 start)
1. **Ally turn meter carries across the wave transition** (`engine.js:949` resets ENEMY tm to 0 but leaves ally tm) → Mikey enters wave 2 at TM 98, Coldheart 91, Artor 64 while fresh mobs start ~0.
2. **The A2 boost-skills recharged during a too-long wave 1** → Artor A2 (+15% team TM), Hilvi A2, Mikey A2 all show cd 0 at wave-2 start; they fire and snowball ally TM. Reality: still on cooldown from wave 1.
- **Enemy cooldowns do NOT carry** (verified: fresh wave-2 Faceless has A1/A2/A3 all cd 0 ready) — the mobs *can* burst; they just never get the turn. So this is an ALLY-side turn-economy problem, not an enemy carry-over bug.
- Wave mob SPD ~95-101 vs ally 148-196; wave-1 mobs die t12/20/25/28/33 (clear ~t33 vs reality 25). Waves are ~8-17 turns slow each; **the boss phase (106 vs 51) is the dominant overrun.**

## FIXES LANDED THIS SESSION (durable, all gates green: selftest 156/0, Dragon golden 4/4, battle-suite 44.1%, guardrail ✅)

### A. Champion-identity unification (5 stages + guardrail) — see `[[champion-identity-unification-2026-08-03]]`
ONE protocol everywhere: resolve name/alias → `champions.id` via `lib/champion-names.js`, act on the id. Sim combatants carry `champId`+`recipeKey` (stamped at the fixture-build boundary); ALL ~11 matchers route through `combatantKey()` in `recipes.js` (not `champKey(name)`). Fixed the **Artor bug** (alias `Artor` ≠ recipe key `IUDEX` → his recipes silently didn't run). Also: `build-from-sync`, `cb-model-validate`, 5 solvers, `gestal-context.buildUserChampions` (collapsed onto `buildNameResolver`, byte-identical), lib duplicates, api/frontend, tools tail. **Guardrail `tools/check-champion-identity.mjs`** (wired as a blocking rung in `model-qa.mjs`) fails on any new raw-name champion lookup or combatant `champKey(x.name)`.

### B. Deferred mechanics wired (pool team 24 → 16 deferred)
- **Artor A2 `[Strengthen]` −25% incoming** — `engine.strengthenFactor` consumer in `incomingDamage` (was inert until the identity fix let his recipe run).
- **Ninja A3 boss-conditional** — new `boss_else_all_enemies` target selector + `F.ignoreDefIfBoss` (single-target the boss + ignore 50% DEF).
- **Ninja A2 per-hit HP Burn** — new `F.onHitPlaceDebuff` rider in the DEAL_DAMAGE multi-hit loop (each of 3 random hits rolls its own HP Burn); + boss-gated activation (`effect.bossOnly` in `doActivateDebuff`).
- **Michelangelo A2 Debuff Spread — VALIDATED** via `SIM_NO_SPREAD=1` A/B: +16-17pp Spider WR, −13 Dragon turns. Real benefit, not seed-1 noise.
- **Michelangelo A1/A2/A3 on-crit** — new on-crit infra: `ctx.attackCrit` (EV-aware, set after DEAL_DAMAGE), `ifCrit` on PLACE_BUFF (A1 self Increase ATK), `ignoreResIfCrit` on PLACE_DEBUFF (A2/A3 25% RES-ignore; A2 debuffs moved to after_hit so the crit is known).
- **Coldheart A1 per-hit Heal Reduction** — reuses `onHitPlaceDebuff` (4 hits × 25%).

### C. Coldheart forensic fixes (kept)
- **TM-immunity enforcement** — `doReduceTurnMeter` now honors `[Decrease Turn Meter]` immunity (Hellrazor is immune; his A3 TM-strip was illegally draining him). `DRAGON_REVIEW.md §boss`.
- **MaxHP-attack cap** — `computeRawHit` now applies `state.maxHpDamageCap` to the formula-embedded `perTargetMaxHp` term too (Coldheart A3), not just the `dealMaxHpDamage` nuke path. Stage-16 byte-identical (cap null 1-20); bites only 21-25/Hard.
- **Coldheart A3 MaxHP model CONFIRMED = crit + DEF-mitigated (Model A)** via TWO captured Heartseeker crit anchors: **76,162** (Decrease DEF + Increase ATK) and **68,930** (Decrease DEF only). Both fit `(0.1·MaxHP + 1.7·ATK) × critM × defM` at **defM ≈ 0.55** (effective boss DEF ≈ 1,130). A "Model B" (DEF-independent, non-crit MaxHP) was tried and **REVERTED** — it over-shot the 68,930 anchor. Coldheart kit is otherwise card-exact.
  - ⚠ Residual (NOT fixed, small): sim per-hit is ~16-22% low because the sim's effective boss DEF is ~1,551 (base 3,879 under only 60% Decrease DEF) vs reality ~1,130 → the boss needs MORE DEF reduction / **Weaken** on it. Secondary to the turn model.

## OTHER MEASUREMENTS / ANCHORS (for the turn-model work)
- Coldheart: never dies (0/20) vs reality dies+revived in wave 2 AND boss. Taken sim 6-11k vs reality 42k. Artor heals her 24,827 (5%-MaxHP AoE A1, card-accurate, **17 casts** because he never dies + spams his no-cd A1).
- Boss deals its Wall-of-Fire **Poison = 32,599 to the team in the boss phase (captured OK)**; boss acts only ~6×/fight (SPD 100 + Inhale/Scorch zero its TM); Scorch-Stun lands ~0.8×/fight.
- Wave-2 burst skills: **Faceless A2 "Lightning"** (self +30% C.Rate, then 5.5×ATK), **Arbalester "Lucky Shot"** (~15k). Wave-1 total HP 257k (5 mobs, no self-heal).

## HOW TO RESUME (the turn-model task)
1. `node --env-file=.env.local tools/turn-order-check.mjs` — wave 1 must stay ✅, drive wave 2 to ✅.
2. The wave-2 fix is a wave-transition turn-economy change: likely **reset/decay ally turn meter at the wave boundary** (so wave 2 is a fresh SPD race → 5 allies then Faceless 6th) AND/OR keep the boost-skill cooldowns down (they only recharge because wave 1 runs long). Decide the turn-counting convention here too (does every scheduler-pick count as a turn?).
3. The BIGGER overrun is the **boss phase (106 vs 51)** — same class (team over-acts), separate measurement. `[[mastery-layer-and-dragon-turn-gap-2026-08-02]]` has the boss turn-gap history.
4. Guardrails throughout: `tools/sim-golden.mjs` (Dragon 4/4), `tools/sim-selftest.mjs` (156/0), `tools/battle-suite.mjs` (44.1%), `tools/check-champion-identity.mjs`. Prediction: fixing the turn model resolves the over-survival + Coldheart over-deal **without touching a single damage number**.

## FILES TOUCHED THIS SESSION
Identity: `lib/champion-names.js` consumers across `lib/`, `lib/sim/*`, `api/*`, `app.js`, `tools/*` (see the identity memory). Sim mechanics: `lib/sim/engine.js` (strengthenFactor, combatantKey routing, champId/recipeKey, ignoreDefIfBoss, MaxHP cap, TM-immunity), `lib/sim/interpreter.js` (combatantKey, onHitPlaceDebuff, on-crit infra, bossOnly activation, TM-immunity), `lib/sim/recipes.js` (combatantKey, all the wired recipes/formulas), `lib/sim/dragon-fixture.js` (identity stamping). NEW: `tools/check-champion-identity.mjs`, `test/turn-order/dragon-pool-wave-order.json`, `tools/turn-order-check.mjs`, this handoff, memory `champion-identity-unification-2026-08-03.md`.
