# HANDOFF 2026-08-03 — Dragon-16 turn-order mechanics, Hilvi/Mikey bugs, and DEFERRED-MECHANIC surfacing

**COLD START for the Dragon thread: read this first.** Continues `HANDOFF_2026-08-02_dragon-pool-calibration-and-engine-mechanics.md`. Memory: `[[mastery-layer-and-dragon-turn-gap-2026-08-02]]` + `[[dragon16-donahilvi-pool-calibration-2026-08-02]]` + `[[unified-speed-model-and-cc-cooldown-2026-08-02]]`.

Team under calibration: **DonaHilvi Dragon-16 pool team** — Michelangelo(Mikey, lead ACC+70 aura) / Ninja / Hilvi (Hilve the Rime-called) / Iudex Artor / Coldheart. Fixture `test/golden/dragon-donahilvi-pool-current.json`, build `data/observed-builds/donahilvi-dragon-pool.json`. Reality: clears St16 ~92% WR, median **104 turns**.

## THE HEADLINE PROCESS FINDING (Mike, most important thing here)
We spent hours hand-diagnosing wave-1 turn-order/damage mismatches by watching the replay frame-by-frame — only to discover the cause was a mechanic the code **already knew it wasn't modelling** (sitting in a recipe `deferred:[]` list). **That is backwards.** TWO changes now enforce this:
1. **`tools/sim-per-hero-bands.mjs` PRINTS every champion's deferred (unmodelled) mechanics at the top of each team block** (`deferredMechanicsFor()` in `lib/sim/recipes.js`).
2. **Deferred mechanics BLOCK the QA** — any deferred mechanic on a gated team is a `deferredMechanics` failure; the rung exits nonzero. A green QA on an incomplete model is a FALSE green (Mike ruling), so the QA can no longer pass while the sim isn't simulating part of the kit. ⚠ every current gated team fails this now (they all carry deferred mechanics) — that is the point; wire the mechanics down. NOTE: some deferred items are genuine no-ops (absent-ally synergy e.g. Tormin, single-copy "only one activates") — a worthwhile refinement is to flag those `noop:true` in the recipe so they don't block; not done yet.

The DonaHilvi pool team has **24 deferred mechanics** (Hilvi 9, Ninja 6, Mikey 5, Artor 3, Coldheart 1). READ THAT LIST before diagnosing any mismatch — the answer is often already on it. Notable un-modelled ones that may skew calibration:
- **Iudex Artor A2 `[Strengthen] −25% incoming damage`** — a SURVIVAL mechanic, unwired (would raise team survival / explain `taken` being low).
- **Ninja A2 HP Burn is per-random-hit (75% each) in the card; sim places ONE** — under-places HP Burn.
- **Ninja A3 boss-conditional: attack ONLY the boss + ignore 50% DEF** — sim does neither → Ninja boss damage off.
- **Ninja passive multiplicative ATK/CDMG scaling** — reading unresolved.
- **Mikey A3 `[Leech]`** (no consumer); **Hilvi A2 enemy buff-strip** (no op).

## THE TURN-GAP ARC THIS SESSION (all fixes measured, golden-safe, battle-suite 43.8% ±0.0pp throughout)
144 (session-2 start) → **136** (masteries) → **131** (booked cooldowns) → **122** (Divine-Mission TM-drain, but OVER-suppressed) → **127** (Divine-Mission fresh-freeze gate — HONEST). Reality 104. **122 was fake-low** (an over-suppression bug barely let enemies act/count); 127 is honest. Remaining 127-vs-104 is now cleanly the **turn-COUNTING convention** (frozen enemy skip-turns) — see OPEN below.

## FIXES LANDED (durable)
1. **MASTERY LAYER** (session-2 build, validated this session): `data/masteries.json` (66 masteries, id-decode confirmed via Ninja screenshots), conditional damage-mods in `engine.js`, Giant Slayer id 500162→**500163** (500162=Helmsmasher). Flat-stat masteries already in `bonusesV2` (not re-added). Mikey opening A3 now in-band.
2. **BOOKED COOLDOWNS** from real Gestal skill levels (`build-from-sync` emits `skill_levels`; `dragon-fixture` applies booked CD when a skill is MAXED). This account: only Coldheart fully booked (A2 4→3, A3 5→4) + Mikey A3 maxed but **booked NULL in DB (data gap → left at base 5, FLAGGED)**. Ninja/Hilvi/Artor unbooked → base correct.
3. **DoT counts toward the purple bar** (`engine.js` turn loop) — Mike-confirmed; correct but ~no turn effect (boss TM drained → few DoT ticks in the window).
4. **Overheal now counted** in `healed`/heal ledger (mirrors in-game healing stat; Ninja 10k→64k). Lifesteal is DIRECT-only, not DoT (Mike-confirmed, sim already correct).
5. **Hilvi Divine Mission BUG 1** — `−10% enemy TM` drained ZERO for the life of the model (`pct:10` on the action vs `doReduceTurnMeter` reads `act.effect.pct`) → fixed `effect:{pct:0.10}`.
6. **Hilvi Divine Mission BUG 2** — reaction fired on a freeze REFRESH; gated `!wasFrozen` (Mike: Ninja re-freezing already-frozen enemies = no TM drop). Now enemies INTERLEAVE with champions like reality. Spider Hilvi damage PRESERVED (swarm churns → freezes mostly fresh).
7. **Michelangelo A2 `[Debuff Spread]`** — new `SPREAD_DEBUFFS` interpreter op (copy ALL of the target's debuffs onto all enemies) + un-deferred in the recipe. ⚠ IMPLEMENTED + safe (selftest 156/0, golden 4/4) but **benefit UNVALIDATED**: on seed 1 Mikey A2's 75% Decrease-DEF roll MISSED so nothing useful spread and wave-1 deaths were byte-identical. RUN THE AGGREGATE to confirm it helps (it spreads Decrease ATK/HP Burn/Freeze/Stun too).

## VALIDATION STATE (100-seed unless noted)
Dragon pool: **WR 100% vs 94% ✅**, median turns 127 vs 104 (❌ gate, = counting convention). Per-hero DEALT in-band: Ninja 594-611k, Mikey 279-288k, Coldheart 247-262k. **Hilvi still over-deals 119-131k vs 48k** (Divine Mission over-fire — frontier). WAVE-1 now matches reality through kill #2: sim deaths t11/t16 = reality's 2-dead-by-t17; sequence Coldheart-A3-kill → Artor-chip → Mikey-A1-softens → Ninja-A1-finish maps 1:1. TAIL still lags: kills 3-5 at t21/t28/t29 (wave clears t29 vs reality ~t25); the un-focused mob (Renegade) only lives on AoE+HP-burn-splash and softens ~10% too slow.

## OPEN / FRONTIER (holding per Mike unless noted)
- **Turn-COUNTING convention = the last big residual, HOLD.** In-game TURN COUNT counts a frozen enemy's skip-turn when its HP-Burn ticks (Mike slow-mo: turns 7 & 9 = HP-burn-tick skips that DO count). Sim `state.turn+=1` counts every scheduler pick. Whether every frozen skip should count is unconfirmed — do NOT change `res.turns` until confirmed in-replay (does the turn-N enemy ATTACK, or just show a burn number?).
- **Validate the Debuff Spread aggregate** (does Renegade reach ≤50% by ~t19 over seeds?).
- **Wire deferred survival mechanics**: Artor A2 [Strengthen] −25% incoming (raises survival, `taken` reads ~half reality now); Ninja A2 per-hit HP Burn; Ninja A3 boss-conditional.
- **Hilvi over-deal** (Divine Mission over-fire on Dragon — inefficient chip).
- **TM model nits**: sim tick `DISCRETE_TICK=1/7` should be `0.07` (2× coarse, immaterial on this team but wrong); `effective-stats.js` rounds SPD (only Mikey has a decimal here, 195.78→196).
- Wave-mob inputs CONFIRMED exact vs stat-screen (HP/ATK/DEF/SPD) EXCEPT sim stores RES/ACC 100 (base) vs effective 125/205, and level (mobs are L200) — survival axis only.
- Mikey A3 booked-cooldown DB capture (currently null → base 5).

## HOW TO RESUME
- `node --env-file=.env.local tools/sim-per-hero-bands.mjs 100` — reads the **DEFERRED call-out** (new) + the DonaHilvi/Artor Dragon pool block. `SIM_NO_MASTERY=1` A/B toggle.
- Golden (must stay 4/4 Dragon REPRODUCED): `node --env-file=.env.local tools/sim-golden.mjs`. Selftest: `tools/sim-selftest.mjs` (156/0). Metric: `tools/battle-suite.mjs` (43.8%).

## FILES TOUCHED THIS SESSION
`lib/masteries.js` · `data/masteries.json` + `tools/build-masteries-data.mjs`+`masteries-rows.json` (NEW) · `lib/sim/engine.js` (mastery mods, DoT-bar, overheal, boss-bonus) · `lib/sim/interpreter.js` (overheal, fresh-freeze gate, **SPREAD_DEBUFFS** op) · `lib/sim/recipes.js` (Divine Mission pct fix, Mikey A2 spread un-defer, **`deferredMechanicsFor`**) · `lib/sim/dragon-fixture.js` (masteries + booked CD + battle_layers) · `lib/sim/ai.js` (cooldownBooked) · `tools/build-from-sync.mjs` (masteries + skill_levels) · `tools/sim-per-hero-bands.mjs` (**deferred call-out**) · `data/observed-builds/donahilvi-dragon-pool.json` (regenerated). Uncommitted working tree (session/qa-rungs-2026-07-23).
