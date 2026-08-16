# HANDOFF 2026-08-15 — Dragon st20 DonaHilvi: taken gap → Scorch window → poison-rebuild frontier

**Team:** DonaHilvi Ezio-Xeno (Michelangelo / Xenomorph / Ezio Auditore / Hilvi / Iudex Artor), Dragon's Lair st20.
**Branch:** `session/qa-rungs-2026-07-23`. **Commits this session:** `f266a9a`, `5185e43`, `2289e47` (all pushed to branch).

---

## What shipped (committed, measured, keep)

1. **`f266a9a` — coupled boss-damage corrections (metric-neutral, replaces 2 compensating fits with 3 measured mechanics):**
   - `poisonDamageFactorVsBoss 0.70 → 0.40` — a 5% Poison ticks 46,293 on the st20 boss = 2% maxHP (Mike first-party). The 0.70 was a mis-read "30% reduction" card value.
   - `PURPLE_BAR_PCT 0.15 → 0.20` — Scorch fires at t98 in the video, impossible at 15%.
   - **NEW `BOSS_DEF_FACTOR 0.43`** — the boss's EFFECTIVE DEF vs champ direct hits is ~0.43× its DISPLAYED DEF (~3,992). **MEASURED from 3 confirmed-gear Ezio hits (st19+st20).** Clean anchor: st19 A1 = 4,164 CRIT, **no buffs, no Dec-DEF (full DEF)**, in-battle ATK ~1,698, C.DMG 109% → retention 0.42 → base ~1,725; predicts the st19 Dec-DEF hit (6,864) to <1% and matches st20's 3,103. Displayed DEF is FLAT across stages (3982-4102) → one factor, no curve. Per-boss (CB's ≈0 via cb.mjs), NOT a global formula constant.
   - These three are **coupled**: poison-cap alone regressed Dragon −1.5pp (false-walls 31→44); the DEF fix is the counterweight. Together = metric-neutral (Dragon 68.3→68.1, overall 64.3→64.2). Hidden Gun ignore verified **35%** from source (unchanged).

2. **`5185e43` — boss-hit ledger gap closed.** `dealDamage` updated `combatant.taken` but the boss's Swipe/WoF/Scorch never emitted a `'damage'` effect → `state.effects` was blind to all boss-phase incoming damage (sim-trace integrity 23/200 champ-fights). `dragon.js` strike/scorchStrike now `recordEffect(source=boss, kind='damage', target=ally, amount=Δcombatant.taken)`. Integrity now 150/150. **Note:** this did NOT move the per-hero-bands TAKEN gate — that gate reads the authoritative `combatant.taken`, not the ledger. My earlier "taken is a reporting gap" claim was WRONG; the taken is real.

3. **`2289e47` — `INHALE_TM_AFTER` knob, DORMANT (default 0).** The Scorch-window lever (below). Metric-neutral at default; do NOT activate until the poison-rebuild gap is closed.

---

## The open problem — the Dragon st20 QA (`tools/sim-per-hero-bands.mjs`)

**Outcome gates PASS** (WR 93% vs 91%, turns 141 vs 138). **Per-hero magnitude FAILS**: the sim's team takes **~2-3× LESS** than reality (Xeno 13k vs 38k, Mikey 26k vs 60k, Hilve 12k vs 40k; Iudex 61k≈60k is the only match). This is REAL under-punishment, fully diagnosed:

### The causal chain (all verified this session)
```
taken too low  ←  Scorch never fires  ←  the sim clears the purple bar EVERY cycle
   ←  at the real 8-turn window the bar should be cleared by POISON TICKS
   ←  but the sim carries ~1.3 Xeno-poison stacks at the Inhale vs reality's ~8-9
   ←  poison REBUILD RATE too slow (detonation-consumes is CORRECT — not the cause)
```

### The evidence
- **Scorch fires 0.0×/run** at default (TM=0); the team clears the 463k bar by ~2× every cycle (median 883k boss-dmg in an 11-turn window). Reality fails to clear ≥1×/fight → Scorch fires ~1× (Mike).
- **Ezio's detonation = 462,931 = the entire 20% bar** by itself. In an 11-turn window his A2 (cd4) always lands → auto-clear. Calibrating the window to the video's **8 turns** (`SIM_INHALE_TM≈35`) makes the detonation's timing matter → team sometimes fails → Scorch fires.
- **BUT TM=35 exposes a Scorch death-spiral:** taken fixes (0/5 → 4/5 in band) but WR drops 93%→80% and sim-suite Dragon 68.1%→67.0% (false-walls 32→43). The team fails bar #2, Scorch escalates **25%→50%→75%** and one-shots them (trace: champs 43%→−46% in one hit at t142), killing the revivers → cascade wipe.
- **Hilvi's A3 being on cooldown at the wipe is NOT the bug** — `ai.js:88` deliberately casts it proactively (card grants buffs "even if no allies revived"), "Confirmed Hilvi AI 2026-08-01".
- **Reality doesn't spiral** because "poison stacks knock out the 2nd inhale" (Mike + screenshot: **8-9 stacks** at turn 135). The sim: **avg 1.3 stacks at each Inhale** (peaks at 7.3 mid-fight but empties by the Inhale). 8-9 stacks × 46,293 ≈ 400k → clears the 463k bar; 1.3 × 46,293 ≈ 60k → can't.
- **Detonation-consumes is CONFIRMED correct** (Mike: "he explodes them, they disappear"). So the gap is rebuild rate, not a missing/wrong mechanic. Reactive passive (Caustic Blood, `recipes.js:899-901`, 25%-on-attacked) and poison-clears-bar (`engine.js:1122-1131`) are BOTH modeled.

### THE NEXT STEP (start here)
**Diagnose Xeno's boss-phase poison-placement rate.** His only poison source is **A1 Tail Stab** (1 stack, 3 on crit @87% crit). AI priority is **A3 > A2 > A1**; in the boss phase **A2 Infestation is inert** (Stun/Infest/Fear all boss-immune) and **A3 Rip and Claw places no poison**. Hypothesis: the sim burns most of Xeno's turns on A3/A2 → he rarely casts A1 → poison never rebuilds to 8-9 before the next Inhale. **Count Xeno's A1 vs A3/A2 casts in the boss phase and poison placed per turn** (scaffold: the scratchpad `stacks-trace.mjs` pattern — hook `content.onTurnStart`, read `boss.debuffs` Poison count). If he's starved of A1 turns → the fix is AI/poison-placement (does the real AI skip the inert A2? does Xeno spam A1 vs the boss?). Closing this → poison holds 8-9 → bar #2 poison-clears in the 8-turn window → **activate `SIM_INHALE_TM=35`** → Scorch fires ~1× survivably → taken climbs to band → the whole cluster unlocks. Then re-measure sim-suite (must not regress) + the per-hero bands.

---

## Durable mechanics confirmed this session (first-party, Mike)
- **HP Burn splashes** "they AND all allies take 3% of their INDIVIDUAL max HP" (in-game tooltip — a `[Bracket]` keyword mechanic, NOT on the skill card). Fires **once per burned mob's turn** (the "double" hits Mike saw = two burned mobs — Tayrel + Apothecary — each firing once). **No cascade, no self-double.** The sim (`engine.js:514-518`, tickDots) models this CORRECTLY. ⚠ I twice mis-diagnosed it (claimed the splash was fabricated, then invented a cascade) by checking champion skill_summary instead of the keyword glossary — the exact CLAUDE.md rule I broke. The sim's HP Burn is right; the Hilve dealt over-credit is ATTRIBUTION (her real splash kills reality credits to Xeno poison/Infest), not a wrong mechanic.
- **All damage reduces the purple bar** (direct + DoT + detonation), confirmed. Modeled (`engine.js:1122`).
- **Ezio detonation CONSUMES the poison** (explodes → gone). Confirmed. Model correct.
- **Boss DEF is flat across stages** (st18 4002 / st19 3992 / st20 3982 / st21 4102) — so BOSS_DEF_FACTOR is one constant, no stage curve.

## Process lessons (cost real time)
- **The gear-free two-hit RATIO whipsawed me** on the DEF measurement (hypersensitive to the gun's ignore fraction). The trustworthy anchor is a **clean no-buff / no-debuff / FULL-DEF hit on CONFIRMED gear** (the st19 4,164). Verify the champion's ACTUAL ATK/C.DMG from the screen before any DEF back-calc (confirmed-gear discipline).
- **Verify a `[Bracket]` mechanic from the GLOSSARY/tooltip, not the skill card** — I broke this on HP Burn and it cost several turns.

## Files
- Sim: `lib/sim/dragon.js` (BOSS_DEF_FACTOR, PURPLE_BAR_PCT, poisonDamageFactorVsBoss, INHALE_TM_AFTER, boss-hit ledger), `lib/sim/engine.js` (tickDots HP Burn / purple-bar feed line 1122), `lib/sim/recipes.js` (XENOMORPH-PASSIVE 899, HILVI recipes 1397+), `lib/sim/ai.js:88` (Hilvi proactive-revive).
- QA: `tools/sim-per-hero-bands.mjs` (Dragon 20 fixture `test/golden/dragon-donahilvi-ezio-xeno-st20-current.json`), `tools/sim-suite.mjs` (headline), `tools/sim-dragon.mjs`.
- Hand-calc (independent reference): `tools/handcalc/dragon.mjs` (effDef 1725, reproduces the fight).
