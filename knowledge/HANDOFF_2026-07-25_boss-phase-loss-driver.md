# HANDOFF 2026-07-25 — the boss-phase loss driver (why the sim wins 100% but reality wins 88.5%)

Cold-start doc for the next session. Read this first, then `knowledge/HANDOFF_2026-07-24_simulator-graduation-and-magnitude-gap.md` for the layer beneath it. This session's memory: `dragon16-reality-winrate-2026-07-25`.

## The one-paragraph state

The Model (recipes + interpreter, the deterministic testing ground) and the Simulator (turn engine + real stats + RNG, judged by volume) are the same code now; Model plumbing rolls into the Simulator. This session closed three mechanic gaps on the **only first-party-validated cell — DonBambus Dragon-16** — and in doing so **localized the remaining gap precisely**: the sim now wins **100% (300/300 seeded)** while reality wins **88.5% (23/26 captured)**, and we have proven the ~11% loss tail is **NOT** any of: gear, targeting, Perfect Veil uptime, or on-hit passives. It is the **mitigation stack never lapsing** on the boss. That is the next investigation.

## What "reality" is (the target, not 100%)

From the RslBattleReader watcher (`gestal-sync/RslBattleReader/output/battle-log.json`, filter `dungeon="Dragon's Lair" && stageNumber===16`): **23 wins / 3 losses = 88.5%** as of 2026-07-25. Excluding one 8-turn fluke (a retreat) → 23/25 = 92%. The two genuine losses have **opposite shapes**: 100t (fast, wave-2-ish) and **213t (the longest run of all 26 — Mike CONFIRMED a boss-stage attrition collapse)**. Length is the wave-vs-boss tell: a wave wipe is short, a boss loss is long.
⚠ The reader's per-hero `heroes` blob on a row can be STALE (byte-identical to the previous battle). On a loss row trust only `result`/`turns`/`durationSeconds`/`survived`; `finishCause` is often `Unknown`, no HP timeline — the reader alone cannot resolve wave-vs-boss.

## What shipped this session (all committed on branch `session/qa-rungs-2026-07-23`, teeth-locked)

1. **`c204798` (prior) enemy AI targeting = lowest-MAX-HP** (glass-cannon rule) + Enfeeble weak-hit consumer.
2. **`b6245bd` round-based Perfect Veil timing.** The veil re-applies once per ROUND, not per turn (the old bug fired `round_start` every turn → 100% veil uptime). A fast Ezio now outruns his 2-turn veil and is exposed in the gap. Uptime 100%→~33%, which spread enemy targeting off Vergis (per-hero taken snapped to reality). Teeth: recipe-d-test veil-lapse test + model-mutants round-boundary mutant.
3. **`3035237` fixture rebuilt from the LIVE Gestal sync.** The old fixture used a frozen 2026-07-22 video capture (partial gear, wrong affinities, +5 phantom ACC). `tools/build-from-sync.mjs` regenerates the build from `gestal-sync/output/DonBambus_*.json` via `effectiveStats` — complete gear, correct affinities, explicit `lifesteal` gated on a COMPLETE Lifesteal 4-set. **Proved gear is NOT the gap**: current-gear win rate 99.0% vs stale-gear 99.3% (identical). Hand-calc golden stays FROZEN on the 07-22 fixture; runtime/volume fixture = `test/golden/dragon16-donbambus-current.json`.
4. **`2a30b3c` on-hit reactive passives — cooldown + fire on every damage path.**
   - **Passive-trigger cooldown** (general): `fireTriggers` consumed no cooldown, so Vergis Second Wind's [Shield] (10% MaxHP on any hit ≥10% MaxHP) re-procced every hit = unkillable. A trigger with `cooldown` now fires at most once per that many OWNER-turns (`tickPassiveCooldowns` at start_of_turn). Vergis [Shield] gated at cd 3 (base — the Model uses `cooldown_base` throughout, cf. `readSkillKit`).
   - **Reactive-event plumbing**: `attacked`/`hit_taken`/`hp_below` fired ONLY in the interpreter's `dealOneHit` (recipe path), so on-hit passives never procced from the BOSS (`dragon.js`→`engine.dealDamage`) or non-recipe mobs. Extracted `fireDamageReactions`; the recipe path calls it directly, the boss (`strike` helper, 4 sites) and `engine.applySkill` call it via a new `state.onDamageTaken` hook (avoids the circular import).

## The key result — the gap is localized, not closed (this is the point)

Volume harness (now permanent): `node --env-file=.env.local tools/sim-fixture-volume.mjs 300`.

| change | win rate | turns med | loss phase |
|---|---|---|---|
| after targeting + veil | 99.3% (stale gear) | 187 | boss 2/2 |
| current gear (fixture rebuild) | 99.0% | 190 | boss 3/3 |
| + Second Wind cooldown only | 99.0% | 190 | boss 3/3 |
| + on-hit event plumbing | **100.0%** | **173** | none |

Reality: **88.5%**, turns med 164. So:
- The cooldown alone did nothing because **Second Wind never procced on the boss** (on-hit events didn't fire there) — that discovery IS what motivated the plumbing.
- The plumbing made kill-speed MORE realistic (173 → reality 164, via Pelops now HP-Burning the boss) but pushed win rate to 100% — it **ruled out on-hit passives as the loss driver** rather than fixing it. Per IMPLEMENT-DON'T-FIT this is a KEEP: verified mechanics that improve the turns axis stay; the 100% is a symptom another mechanic is missing.

## NEXT: the boss-phase loss driver = the mitigation stack never lapses

Turn-by-turn trace (`tools/sim-fixture-volume.mjs` + the effect ledger) shows Second Wind's shield barely procs on the boss because **Vergis's incoming damage is mitigated BELOW the 10%-MaxHP threshold.** The stack — Aegis (Vergis A2: Continuous Heal + Increase SPD + Reflect + Ally Protection + self Increase DEF), Pelops −20%, Aid-the-Feeble, Increase DEF, shields — is placed **deterministically and is always up**, so nobody takes lethal damage. Reality's ~11% losses are the RNG windows where that stack has a gap (buffs not up / stripped / a crit string) → a squishy dies → cascade.

Candidates, in recommended order:
1. **The purple-bar / Scorch damage race (START HERE).** `SIM_SCORCH` defaults to `never` (optimistic — team always clears the purple bar, so the Scorch AoE+Stun never fires). The purple bar is now wired at 20% of boss max HP, so the race is EVALUABLE, not a bracket. `SIM_SCORCH=always` gives the pessimistic bound. The truth is the damage race: sometimes the team fails the check → Scorch → the boss-phase wipe mechanic. This is the single most likely source of a boss-phase loss tail.
2. **Buff placement variance / boss buff-strip.** The mitigation buffs are placed at 100% and never removed. Model placement chance/uptime gaps, or a Hellrazor buff-strip, so the stack occasionally lapses.
3. **Boss damage magnitude.** Verify `bossHit` (dragon.js) — if boss hits are too soft after mitigation, no window is ever lethal regardless of RNG.

DO NOT tune the win rate down. Find the missing mechanic; the volume number is the falsifiable check (implement → re-run `sim-fixture-volume.mjs 300` → is it nearer 88.5%?).

## How to run things (all DB-gated need `--env-file=.env.local`)

- **Volume (the headline number):** `node --env-file=.env.local tools/sim-fixture-volume.mjs 300`
- **Rebuild the fixture after a new Gestal sync:** `node tools/build-from-sync.mjs > data/observed-builds/<date>-donbambus-current.json` then point `test/golden/dragon16-donbambus-current.json` `inputs.*.build` at it.
- **Model QA ladder:** teeth `node tools/model-mutants.mjs` (32/32, 100%); toy `node tools/sim-recipe-d-test.mjs` (32/32); hand-calc golden `node --env-file=.env.local tools/model-golden.mjs` (8/8, FROZEN on the 07-22 fixture).
- **Turn-by-turn trace / effect ledger:** `TURNLOG=1-45 node --env-file=.env.local tools/sim-trace.mjs`; `SEED=N`, `DUMP=Name`.
- **Watcher (reality win rate):** query `battle-log.json` as above; `tools/watch-reconcile.mjs` grades live.

## Standing rules that bind here (don't relearn them the hard way)

- **The Model is a turn-by-turn system so mechanics are validated BEFORE the Simulator. Debug the Model, not the Simulator.** Judge outcomes by VOLUME, never a single battle.
- **IMPLEMENT, DON'T FIT.** Only `DEF_K` is tunable (deferred). A verified mechanic that doesn't move the win/loss metric but improves another axis (e.g. turns) STAYS — the binary metric is blind to that axis.
- **VERIFY DATA FROM THE DB/source before it enters the sim.** Champion coeffs, cooldowns (`cooldown_base`), gear-set ids — pull verbatim, resolve names via `lib/champion-names.js` (never raw `.eq('name',…)`).
- The golden is FROZEN by design; the runtime fixture tracks the live sync.
