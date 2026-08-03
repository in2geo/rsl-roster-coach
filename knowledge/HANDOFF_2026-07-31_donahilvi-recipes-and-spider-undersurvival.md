# HANDOFF — 2026-07-31 (late) — DonaHilvi team recipes, the affinity climb, and the Spider under-survival frontier

## COLD START — read in this order
1. **This file** (what happened, what's uncommitted, where the frontier is).
2. Memory: `donahilvi-spider-climb-anchor-2026-07-31` (the live calibration target) · `spider13-opening-turn-order-groundtruth-2026-07-31` · `spider13-lapping-chain-diagnosis-2026-07-31` (the Pelops-team root cause).
3. `data/manual-captures.json` — the DonaHilvi capture TABLE (`displayName:"DonaHilvi"`, `teamVariant:"Artor-for-Alice"`) — the reality WR curve.
4. `CLAUDE.md` HARD RULES (implement-don't-fit; MODEL≠SIMULATOR; verify skill data from DB; naming registry).

## TWO THREADS RAN THIS SESSION

### Thread A — Pelops team (Don$Bambus) Spider-13 ROOT CAUSE (earlier in session)
The sim under-wins Spider-13 (sim ~60%, reality 77%, kills 167t). **Root cause FOUND & recorded:** the boss dies too slow because burn never SATURATES — HP-burn splash (3% boss maxHP per burning-spider-tick) is the #1 damage channel but only ~22% of the swarm is ever on fire. Reality gets there because **spiders keep attacking Pelops off-Taunt (he's the shieldless, "easiest to kill" target)** → they catch fire → splash the boss. The sim's `killScore` over-weights DEF (tanky Pelops looks hard-to-kill even shieldless) so the swarm hits squishies instead → burn plateaus. Mike: "shields are a BIG deterrent to targeting." Landed: opening turn-order fix (boss 1st turn t14→**t19**, `SKAVAG_OPENING_TM=30`, spider-open TM 77); `state.shieldDeterrentTargeting` (Spider-gated, targets least-shielded) — helped 4%→12% off-Taunt but the shield-equilibrium isn't reproduced (Pelops's Magma doesn't fully deplete). See `spider13-lapping-chain-diagnosis`.

### Thread B — NEW DonaHilvi account + AoE-nuke team (bulk of the session)
- **Hilvi naming bug FIXED (seed 213, APPLIED to live).** Gestal exports "Hilv**e** the Rime-called"; DB is "Hilv**i**" — one-letter mismatch → she failed name-resolution → **silently dropped from the pool** (Mike's best champ, and the only BUILT champ filling the tempo gap both teams flagged at 0%). Added alias → she's now selected; pool grades jumped Dragon +16 / Spider +10. `devScore` still ignores masteries (separate small gap, noted).
- **Recipes built for all 6:** Michelangelo, Coldheart, Hilvi, Ninja, Alice, **Iudex Artor** (champKey IUDEX). Plus the **deferred DMG/SURV mechanics** as reusable engine ops: Hilvi freeze→HP-burn passive (new `enemy_frozen` event), Michelangelo shield-on-hit (`pctOfCasterAtk`) + Evade (`rollEvade`), Coldheart enemy-max-HP damage (`perTargetMaxHp` term) + crit bonus, Ninja Escalation (`maybeEscalate`), single-target revive w/ TM (`doRevive` count/tmPct). **QA now flags deferred DMG/SURV clauses loudly** (`model-qa.mjs high_impact_deferrals`).
- **Reality climb (captured, first-party):** Alice team clears 11-13, **walls 14**. Mike diagnosed the weak seat (Alice ACC 0, dies) → swapped for **sustain (Iudex Artor: AoE heal every turn + revive)** → **broke the wall, now clears 11-15.** THE RESULT-LOOP WORKING END TO END.
- **AFFINITY is load-bearing at non-Void stages** (`dungeon_stage_affinities`): st13=Void (neutral, why it clears), **st14=Magic** (Spirit tank Mikey WEAK → dies first), st15=Force (Magic Ninja WEAK → "barely holding on"). Sim models it via `stageAff[stage]`.

## THE OPEN FRONTIER (next session) — SPIDER UNDER-SURVIVAL
After all mechanics + fresh Artor gear (re-sync doubled his HP 12k→28k → heal 615→1433/ally): sim Artor-team scan = **11:33% 12:0% 13:7% 14:13% 15:7%** vs reality clearing **11-15**. Went 0%→some-wins, but still SYSTEMATICALLY under-surviving. **HYPOTHESIS to test first: the sim under-credits FREEZE-based swarm suppression** — Hilvi A2 + Ninja A3 freeze the spiderlings (skip turns → team takes far less damage); if freeze uptime / frozen-skip is under-modeled, the squishies die (~t31-38) and the consume-heal out-sustains. This is a `spider.js` swarm/consume/freeze CALIBRATION problem, NOT a recipe gap (champions are now well-modeled). Same class as Thread A's "sim under-survives Spider."

## UNCOMMITTED (branch `session/qa-rungs-2026-07-23`, working-tree only)
- `lib/sim/spider.js` (opening TM, shieldDeterrentTargeting, Evade in aoeStrike/spiderlingAct), `engine.js` (shield-deterrent targeting, pctOfCasterAtk, evadeChanceFor/rollEvade, perTargetMaxHp, critRateBonus), `interpreter.js` (enemy_frozen event, STEAL_BUFF/REDUCE_TURN_METER trigger ops, maybeEscalate, doRevive count/tmPct), `recipes.js` (6 new champions), `tools/model-qa.mjs` (high_impact_deferrals).
- NEW: `tools/sim-recipe-spider-test.mjs` (15/15), `test/fixtures/spider13-donahilvi.json` + `spider-donahilvi-artor.json`, `data/observed-builds/donahilvi-spider{,-artor}.json`.
- APPLIED to live DB: `seeds/213_hilvi_gestal_alias.sql`.
- `data/manual-captures.json` — DonaHilvi table (Alice + Artor variants, 11-15).

## STATE / GUARDRAILS
- **Dragon golden 37/37 clean** throughout (every Spider/champion change gated → Dragon byte-identical). ALWAYS re-check after any sim change.
- `model-qa`: 16/19. REDs: `teeth (mutation)` (pre-existing), `regression snapshot (15)` (= this session's INTENTIONAL Spider opening/targeting changes drifting the baseline — **regenerate the snapshot** to accept, then it clears), `card→recipe coverage (1)` (a deferred clause).
- TODO carried: make `sim-per-hero-bands`/reconcile **account-aware** (scope by `displayName`) — DonaHilvi Spider-13 wins would otherwise blend into Don$Bambus's bands. Regenerate the regression snapshot. `devScore` mastery term.

## LESSONS
1. A one-letter name mismatch silently deletes a champion from selection — the exact failure the naming registry exists to prevent; every "not found" is a bypass or a missing alias.
2. "Recipes built" ≠ "mechanics run" — deferred clauses need ENGINE ops; reality tells you which deferrals are load-bearing (Hilvi's freeze passive was 30% of her damage). Build them BEFORE the first sim run for a team, using the QA's DMG/SURV flag as the build-list.
3. Affinity is load-bearing at non-Void stages — the wall at Spider-14 is largely a Magic-vs-Spirit affinity wall, not raw stats.
4. The product LOOP works: pool selects → reality/sim diagnoses the short seat + wall → re-solve (swap for sustain) → break the wall. Captured live on DonaHilvi.
5. Always confirm CURRENT gear (Mike's "make sure you have current gear" caught a stale sync that halved Artor's sustain).
