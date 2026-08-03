# HANDOFF 2026-08-02 — Dragon-16 DonaHilvi pool team: calibration + engine-mechanics pass

**COLD START for the Dragon thread: read this. (Separate thread from the Spider `HANDOFF_2026-08-02_spider-ai-fixes-...`.)**

Pick-up target: the **DonaHilvi Dragon's Lair pool team** — Michelangelo (Mikey, lead) / Ninja / Hilve the Rime-called (Hilvi) / Iudex Artor (Artor) / Coldheart. Reality clears St16 at **~92% WR (15W/1L captured), median 104t**. This session took the sim from **14% WR → 98% WR** and got 3 of 5 champs' per-hero damage in-band, via REAL inputs (not fitting).

## The team & fixture
- Fixture: `test/golden/dragon-donahilvi-pool-current.json` (id `dragon-donahilvi-pool-current`). Build: `data/observed-builds/donahilvi-dragon-pool.json` (fresh Gestal sync 15:44, via build-from-sync).
- CONTENTS entry added to `tools/sim-per-hero-bands.mjs` (DonaHilvi Dragon-16). Also in the golden set (reproduces WIN).
- ⚠ **Ninja & Ezio SHARE one gear set** — Mike moves it between them. The pool team needs Ninja geared; the Ezio+Xeno Dragon variant needs Ezio geared. Re-sync with the right champ geared before building either.

## What this session changed (engine + data — all durable)
1. **UNIFIED SPEED MODEL** (`lib/sim/engine.js`) — the discrete-overflow scheduler `nextActorDiscrete` is now the **default for ALL content** (was Spider-only via `state.discreteScheduler`). Gate is now `if (state.discreteScheduler !== false)`. Tick set to **`DISCRETE_TICK = 1/7`** — the reviewer's ΔTM = effectiveSPD/7 per shared tick, uncapped overflow, highest-raw-meter acts, actor resets by −100 (keeps overflow). Mike's ruling: ONE speed model, no per-dungeon math. Result: Dragon golden safe; Spider Don$Bambus WR 78%/77%; **did NOT change Dragon turn counts** (confirming the turn gap is damage, not speed).
2. **5b — HARD CC FREEZES SKILL COOLDOWNS** (`engine.js`) — new `CC_PRESERVES_COOLDOWNS = ['Stun','Freeze','Sleep','Petrification']`; on a turn lost to hard CC, `expireDurations` still runs (durations advance) but `tickCooldowns` is SKIPPED (cooldowns frozen). Block Active Skills still ticks (not a true disable). Spec-correct (reviewer); golden-safe; **metric-neutral on current fixtures** (these swarms A1-spam / die fast) — kept per "verified fact that doesn't move the number → keep it."
3. **REAL MASTERIES WIRED** — `build-from-sync.mjs` now emits `has_boss_mastery` (via `lib/masteries.hasBossMastery`, Warmaster 500161 / Giant Slayer 500162) + `mastery_count`. montecarlo gained `SIM_MASTERY=real` (reads `has_boss_mastery`). **Only NINJA has a boss mastery (Warmaster)** on this team; Mikey/Hilvi/Artor/Coldheart do NOT (Artor & Coldheart have ZERO masteries). Wiring the REAL mastery fixed Ninja's under-damage AND Coldheart's over-damage (faster kill → fewer Coldheart A3 %maxHP shots).
4. **ARENA + ACC AURA via fixture `battle_layers`** — `applyBattleLayers` gained an `accAura` param; per-hero-bands + montecarlo now honor `fixture.battle_layers`. The pool fixture declares `{ auraSpdPct: 0, accAura: 70, arenaPct: 0.06 }` = Michelangelo's ACC-70 All-Battles aura + the **measured +6%-of-base HP/ATK/DEF Arena** (screen vs base+gear = exactly +6%, HP/ATK/DEF only → Arena; Great Hall ~0 on these affinities). NOTE: the in-game **stat screen already bakes in Arena**; build-from-sync (base+gear) omits it, so battle_layers re-adds it.
5. **NINJA A2-OPEN** (`lib/sim/ai.js` `CONFIRMED_SKILL_ORDER`) — added `'Ninja': ['A2','A3','A1']` (A2 Hailburn = HP-Burn engine, opens FIRST — confirmed Mike first-party + reviewer AI table). Fixed his under-damage: **522k → 595k** (reality 613k, in-band). He was defaulting to A3 (a minor AoE), delaying his DoT engine.
6. **MASTERY CALIBRATION CHART** — `tools/sim-mastery-chart.mjs` + `data/mastery-chart.json`. Runs each fixture off / **offense (generalized)** / **real** vs reality, persists dated snapshots. Purpose: the app GENERALIZES masteries (collects gear tier, not masteries), so we must calibrate that generalization. KEY FINDING: the "offense" generalization fit reality's turns best (118t) but for the WRONG reason (compensating errors — it over-credits maskless champs); the honest **real** bracket (155t) exposes the true residual.

## Current calibration state (per-hero-bands, pool team, ~40-60 seeds)
- **WIN RATE: sim 98% vs reality 94% (Δ4pp)** ✅
- **Ninja 595k ✅ / Coldheart ~275k ✅ / Mikey ~260k ✅** dealt (in-band). **Hilvi ~165k ❌** (reality 53k — over).
- **MEDIAN TURNS: sim 144 vs reality 104 (38% over)** ❌ — the top residual.
- Taken: Ninja/Coldheart in-band; **Mikey/Hilvi taken too high** (the systemic engine-wide `taken` over-application — blocks the QA gate across ALL teams, not just this one).

## The turn gap — fully diagnosed (NOT speed, NOT counting)
Reality phase timing (Mike first-party): **wave1 dies t25, wave2 t50, boss t101** (durations 25/25/51). Sim: **36/39/74 ≈ 148t**, slow in EVERY phase ~1.45×. Ruled out:
- **Speed model** — unifying to discrete-overflow SPD/7 did NOT change Dragon turns (147→148).
- **Turn counting** — Mike's turn-count rules (confirmed vs the reviewer's 8-step sequence): a turn counts if the actor **casts a skill OR a DoT ticks** on them (frozen+burning enemies DO count); only a frozen enemy with **no DoT** is a true non-turn (~8 phantom turns, small). Our `state.turn += 1` is unconditional — the reviewer's step-8 says frozen turns DO count, so our counting is essentially correct; the ~8 phantoms are minor.
- **ROOT = per-turn DAMAGE deficit** — the boss self-heals 0, total damage is correct (~1.25M = waves 527k + boss 727k), the allies take 119 of ~130 turns (enemies barely act — boss acts ~5×), so the fight is long purely because **each ally-turn under-delivers** (~10.4k vs reality ~13.7k). Uniform across phases.

## FRONTIER — two levers to close turns 144→104
1. **HILVI over-deals on Dragon** (165k vs 53k). Her passive **Divine Mission** (on enemy Freeze → steal buff + HP Burn + −10% TM) is her SPIDER damage engine (freeze-all → blanket HP-Burn splash). On Dragon it over-fires — she freezes waves (A2) every cycle and her passive HP-Burns them, so her damage is inefficient CHIP that pads turns instead of killing. Reining this in fixes her over-damage AND trims turns.
2. **OFFENSE-TREE DAMAGE MASTERIES UNMODELLED** — the sim models ONLY the boss mastery (Warmaster/Giant Slayer). The other offense-tree nodes (Keen Strike, Deadly Precision, Cruelty, etc. — flat/conditional damage) are NOT modeled. Mikey has 11 offense masteries → his opening A3 is ~13% LOW (reality-verified: Mikey A3 crits 7669/8247/7370, non-crits 4896/5300). This is the honest "implement the mechanic" fix that lifts per-hit damage team-wide. ⚠ NOTE Ninja/Coldheart opening hits run ~30% HIGH (multiplier-ish, opposite direction) — so it's NOT purely masteries; per-skill multipliers may also be off (all opening hits are NEUTRAL affinity — waves all Void, our champs Spirit/Magic/Void neutral-to-Void, so affinity is ruled out).

## Reality opening-damage captures (Mike first-party 2026-08-02, all NEUTRAL affinity)
- **Mikey A3 (Shell Cyclone):** crits 7669/8247/7370, non-crits 4896/5300 → sim ~13% LOW.
- **Ninja A3 (Cyan Slash):** crits 2880/3273 → sim ~30% HIGH (but his A3 is minor; his engine is A2 Hailburn).
- **Coldheart A2 (Art of Pain):** crits 3660/3532/3364, non-crits 1935/1850 → sim ~30% HIGH.
- Coldheart A3 Heartseeker = **1.7 ATK + 0.1 ENEMY MAX HP** — %maxHP is LEGIT at St16 (no %maxHP reduction until St21, Mike). Her earlier over-credit was fight-length (3-4 boss A3 shots vs reality 1-2), fixed by the faster kill from real masteries.

## Dragon-16 EHP constant (durable)
Team-total dealt converges on **~1,226,226** across ALL wins (both rosters), = waves (~527k) + boss (727k). The 1 pool loss dealt 1.179M = ~96% of the threshold (died just short). So win/loss = a SURVIVAL RACE to deliver the fixed ~1.226M before wiping.

## How to resume
- Per-hero gate: `node --env-file=.env.local tools/sim-per-hero-bands.mjs 40` → read the "DonaHilvi/Artor (Dragon pool team)" block.
- Mastery chart: `node --env-file=.env.local tools/sim-mastery-chart.mjs 100`.
- Dragon golden (must stay 4/4 REPRODUCED): `node --env-file=.env.local tools/sim-golden.mjs`.
- Captures: `data/manual-captures.json` now has **89 entries** (the Dragon pool St16 set = captures #68-89, 15W/1L, incl. phase-timing + survival-timeline rows).

## Files touched
`lib/sim/engine.js` (speed model, 5b, CC_PRESERVES_COOLDOWNS) · `lib/sim/ai.js` (Ninja A2-open) · `lib/sim/dragon-fixture.js` (applyBattleLayers accAura) · `tools/sim-montecarlo.mjs` (battle_layers on Dragon path, SIM_MASTERY=real, revive census) · `tools/sim-per-hero-bands.mjs` (battle_layers, Dragon pool CONTENTS) · `tools/build-from-sync.mjs` (has_boss_mastery/mastery_count) · `tools/sim-mastery-chart.mjs` (NEW) · `data/observed-builds/donahilvi-dragon-pool.json` + `donahilvi-dragon-ezio-xeno.json` (NEW) · `test/golden/dragon-donahilvi-pool-current.json` (NEW) · `data/manual-captures.json` (Dragon captures 68-89) · `data/mastery-chart.json` (NEW).
