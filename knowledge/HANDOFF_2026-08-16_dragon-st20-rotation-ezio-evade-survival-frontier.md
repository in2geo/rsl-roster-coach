# HANDOFF 2026-08-16 — Dragon st20: rotation + Ezio explosion + evade fixed; frontier = boss dies too slow

**Team / content:** Dragon's Lair Stage 20, DonaHilvi Ezio-Xeno — Michelangelo / Xenomorph / Ezio Auditore / Hilve the Rime-called / Iudex Artor. Fully-booked account.
**Branch:** `session/qa-rungs-2026-07-23`. **Commits today:** `f32c5ef` (rotation + Ezio), `5925c97` (boss evade). Tree clean.
**Where it stands:** st20 sim **~68% WR** (67.7%, 300 seeds, CI [62,73]) vs **reality ~91%**. `sim-suite` **65.6%** balanced (Dragon 66.1, Spider 60.5), loss-recall 0.67.

## Cold start — read these first
1. This file.
2. Memory `dragon-st20-rotation-ezio-evade-fixes-2026-08-16` (the committed fixes + corrected oracle).
3. `DRAGON_REVIEW.md` §1 (updated today: fixed cycle + cleared-bar→WoF).
4. ⚠ Prior memories `hp-burn-splash-...-2026-08-15` and `dragon-st20-handcalc-mechanics-2026-08-14` **predate the corrected oracle below** — treat their "Mikey dies" / death-count claims as SUPERSEDED.

## What got fixed today (all committed)
1. **Boss rotation = FIXED CYCLE** `Inhale → Scorch → Wall of Fire → Swipe` (was a cooldown ladder firing 3 Swipes/Inhale). Centralized cooldowns (tick once per boss turn); **Inhale cd 4** (card CD3 + the inserted Scorch turn). `lib/sim/dragon.js`.
2. **Cleared purple bar is NOT a wasted turn** (retired the 2026-07-26 note). Boss drops Scorch and takes a normal skill THAT turn — Wall of Fire if available, else Swipe. Clearing only saves the %maxHP Scorch nuke + its Stun. Asserted in `tools/model-boss.mjs` (26/0).
3. **Ezio A2 explosion = FULL REMAINING DURATION per stack**, not one tick. `engine.activatePoisons` sums `perTick × turnsLeft` over `stackList`, per-owner attribution preserved. **Anchor: 5 fresh 5% stacks × 2 turns × 2%/tick × 1.25 [Poison Sensitivity] = 578,666 = 25% of boss maxHP (100%→75%).** Old 1-tick model = exactly half (12.5%). Regression in `tools/sim-poison-ownership-tests.mjs` (22/0). CB capped resolver deliberately left single-tick.
4. **Boss now rolls Michelangelo's Evade.** The scripted Hellrazor strike bypassed `rollEvade` (interpreter/Spider paths already call it). Wired into boss strike / WoF / Swipe / Scorch (one roll per ally per skill; evade negates hit + accompanying debuffs). **[Party Dude]** = 15% evade, **30% under his A3 self-[Taunt]**. Gated on the `evade` field → non-evader teams byte-identical. st20 WR 63→67.7%, Mikey deaths 1.27→1.09, boss evades 0→0.51.

## ⚠ CORRECTED ORACLE (load-bearing — prior docs are WRONG)
Reality st20 (Mike first-party 2026-08-16): **only Ezio + Iudex Artor die** (to the ~t119 Swipe), **both revived by Hilve's ONE Ward mass-cast**. **Michelangelo, Xenomorph, Hilve SURVIVE.** So reality = **2 deaths / 2 champs revived** (revives are counted per-champ-revived, not per skill cast — Ward is a mass revive). Boss dies from Poison ~t143. The hand-calc `REAL` table is corrected (`Michelangelo died:false`).

Boss-HP checkpoints (single oracle, treat as soft): 1st Ezio explosion → ~75% before 1st Inhale (t91); Scorch t98; WoF ~50% t109; 2nd Inhale ~25% t131; 2nd bar CLEARED by ~7 natural poisons → WoF t137; death t143.

## Validated DEAD ENDS — do not re-investigate
- **Waves are faithful.** Sim wave duration ~80t ≈ reality ~84t. Mobs are CC-locked (Mike: wave 1 = ZERO enemy turns, wave 2 = a few each; sim ~7.8 mob attacks/run — matches). Little to evade there. **All st20 losses are boss wipes, none in waves.**
- **Booked cooldowns already applied.** `dragon-fixture.js:223` overrides recipe cd with DB `cooldown_booked` for maxed skills (Mikey A3=4, A2=3 already correct). The recipe `cooldown` field is irrelevant for DB-sourced skills — do NOT "fix" it.
- **Revive throughput matches reality** (~1.86 champs revived/run vs ~2). Iudex barely revives (~0.25) but reality's revives are all-Hilve too — fine.
- Ezio detonating on the last wave = correct game AI (off-cooldown, slot order); boss-entry A2 readiness is RNG-spread (24.5% ready turn 1) — emergent, not a bug.

## FRONTIER — the ~68% → 91% gap
All 41/112 losses are **boss-phase wipes** at ~143t; win and loss turn-counts are nearly identical (~142). The fight is a near dead-heat around turn 140–160 and RNG decides who dies first.
- **Root symptom: the boss dies ~20 turns too slow** (sim win median ~143 vs reality ~121). The overrun keeps the team in the attrition zone.
- **Survival residual:** the sim **over-kills champions reality keeps alive** — on wins Mikey 0.69, Xeno 0.36, Hilve 0.13 deaths/run, vs reality losing ONLY Ezio + Iudex. Revives match reality, so it's excess incoming death, not a revive shortfall.

### Next levers (in rough priority)
1. **Boss time-to-die.** Compare sim total damage-to-boss BY SOURCE (per-hero, aggregate over ~100 seeds) against reality per-hero dealt (fixture `reality_notes` / `michelangelo_a1_anchor`). Find which source under-produces over the full fight. Xeno poison is the engine — check its boss-phase stack count / uptime.
2. **Why Xeno/Hilve die at all** (reality never loses them) — likely an incoming-damage or sustain-uptime under-model on those seats (Block Damage window, Leech, Artor's small heal). Trace a losing seed's death sequence for Xeno/Hilve.
3. Poison-rebuild curve into the Inhale windows (older thread, `hp-burn-splash-...` memory) — reality's 2nd bar clears; measure whether the sim's stack distribution at the 2nd Inhale reaches it.

## Tooling notes
- Gate: `node tools/sim-selftest.mjs` (156/0), `tools/sim-poison-ownership-tests.mjs` (22/0), `node --env-file=.env.local tools/model-boss.mjs` (26/0), `node --env-file=.env.local tools/sim-suite.mjs` (headline).
- Ad-hoc measurements this session were throwaway scripts in the repo root (`_measure-*.mjs`, deleted). Pattern: `import {makeState,simulate} from './lib/sim/engine.js'` + `buildBattle/applyBattleLayers` from `dragon-fixture.js`, loop seeds, read `res.effects` (kind: damage/dot/activate/evade, with `phase`) and `res.log` (death/revive/INHALE/SCORCH/... events). `state.onAction=(st,actor,skill)=>{}` hook (engine.js:1321) for per-decision instrumentation. Fixture: `test/golden/dragon-donahilvi-ezio-xeno-st20-current.json`.
- ⚠ The `effects` ledger stamps `phase`; a boss "death" event is the BOSS dying (the win) — exclude Hellrazor when counting ally deaths.

## Process reminders that bit this session
- **One capture ≠ the distribution.** The oracle is one run; lean on the SIM in aggregate for RNG-heavy questions (revives, poison stacks, evades). Mike corrected me twice on this.
- **Label claim status.** I laundered "reality = 3 revives" (inherited) as fact; it was 2. Verify death/revive baselines against Mike before building on them.
- Separate systematic bias (mean gap) from RNG variance — the fixable part is the mean.
