# HANDOFF 2026-08-05 — Dragon boss model REBUILT + QA path unified; turns now MATCH reality; the ONE open gap is POOL SURVIVAL (team healing under-fires)

**COLD START:** read this, then `[[dragon-boss-model-correction-2026-08-04]]`, `[[montecarlo-dragon-path-unified-2026-08-04]]`, `[[mikey-gear-swap-solo-vs-team-2026-08-04]]`. Branch `session/qa-rungs-2026-07-23`, all committed + tests green. Account = **DonaHilvi** (`a6261acc35588c94`); teams = the **Dragon-16 pool** (Michelangelo/Ninja/Hilvi/Iudex Artor/Coldheart) and the **DonBambus** poison team (Ezio/Vergis/Bambus/Pelops/Tagoar).

## THE HEADLINE — turns are SOLVED; survival is the last gap
The whole session was driven by Mike's turn-by-turn replays. The "sim runs ~50% too long" turned out to be **THREE stacked bugs**, all now fixed. The pool team's turns now match reality almost exactly (**sim 112t vs a fresh capture of 109t**). WR/survivors are still low (**59% / 3-of-5** vs reality **96% / 5-of-5**) and the residual is now cleanly **SURVIVAL — the team's healing under-fires in the boss phase.**

## THIS SESSION'S COMMITS (all on `session/qa-rungs-2026-07-23`)
1. **`549817d`** — Dragon boss model, from Mike's in-game skill cards (Tier-1):
   - **Swipe = 3× ATK**, **Wall of Fire = 3.4× ATK** (were 1× — `bossHit` had NO skill multiplier; boss dealt ~⅓ real damage).
   - **Scorch = Enemy MaxHP × 0.25 × (fires+1)** — a **%maxHP, DEF-independent, ESCALATING** nuke + 1-turn Stun (was modeled as a flat 1× ATK poke). `scorchStrike` in `dragon.js`.
   - **Continuous Damage Resistance I = Poison −30%** on the boss (`poisonDamageFactorVsBoss: 0.70`). ⚠ a sibling HP-Burn resistance may exist (unshown card).
   - **Purple bar = 10% of maxHP on the 1st Inhale, +5%/Inhale (ESCALATES), no reset on clear** — CORRECTS the old "exactly 20%" (was 2× too big → every team failed the Scorch race → turn inflation). `PURPLE_BAR_PCT=0.10` / `PURPLE_BAR_STEP_PCT=0.05` in `dragon.js`.
2. **`f5ba92e`** — Ninja-solo Dragon-9 fixture. Validated his base kit (sim 51t vs reality 47t) and **FALSIFIED the "Ninja carry under-modeled / Escalation" hypothesis** — his Escalation passive correctly fires ~0× (at SPD 167 he takes 1 turn/round, can't land 3 skills in a Round; reality doesn't ramp either). **Do NOT touch Escalation's per-round reading.**
3. **`2f8e12f`** — **Montecarlo Dragon-path UNIFICATION** (the big one; see `[[montecarlo-dragon-path-unified-2026-08-04]]`). The montecarlo (QA rung 7) had a **bespoke Dragon path that skipped `installRecipeRun`** → recipe trigger/passive machinery never ran → Bambus's poison redirect never fired (304t vs 150) and the pool's revives under-fired. Now ALL dungeons go through `buildBattle` + `installRecipeRun`, matching `sim-per-hero-bands`. **`SIM_MASTERY` off/real/offense is RETIRED** — masteries come from the build (per-account real). Result: **Bambus 304→162t (≈150), pool 148→112t (≈104).**
4. **`025fa77`** — Hilvi A3 TM mechanics: **+30% revive TM** (`tmPct:0.30` on her REVIVE) + **no-revive 25% TM fill** (`skipIfRevived` gate; `doRevive` now returns count → `ctx.revivedCount`). Pool WR 46→59%, survivors 0/5→3/5.

## ⭐ THE OPEN GAP — POOL TEAM SURVIVAL (team healing under-fires)
**Start here.** A fresh pool-team Dragon-16 victory capture (Mike, 2026-08-05): **109 turns, all 5 survived**, per-hero **dealt / taken / healed**:
| | Mikey | Coldheart | Ninja | Hilvi | Artor |
|---|---|---|---|---|---|
| dealt | 215,988 | 304,366 | 593,272 | 87,208 | 43,024 |
| taken | 20,159 | 41,128 | 28,052 | 36,921 | 36,071 |
| **healed** | 7,702 | 20,652 | **135,643** | 13,962 | **103,871** |

**Reality team heals ~282k; the sim heals ~0 in the boss phase.** A traced pool LOSS (seed 3): the boss's normal AoE rotation grinds the team down with **no recovery between hits** — t71 Scorch (~5-8k) → t83 WoF (~11-12k) → t92 Swipe (~13-14k) → **all 5 die at once → no revive possible**. Michelangelo sat at 16,481 HP for 12 turns (t71→t83) with zero heal.

The three sustain sources (all **modeled** but **under-firing** — this is the job):
- **Ninja lifesteal 135k** = Lifesteal×4 gear (0.3 in the build; Ninja does NOT gear-swap, unlike Mikey). Should self-heal ~30% of his direct hits (~178k of his 593k) but the traced Ninja wasn't recovering. **Check lifesteal is applied on his boss hits.**
- **Artor A1 "Censer Whirl" team-heal 104k** = "Heals all allies by 5% of THIS champion's MAX HP" — modeled as `IUDEX-A1` seq-30 `HEAL all_allies pctOfCasterMaxHp:0.05`. This is the team's main heal for the non-lifesteal members (Mikey/Hilvi/Coldheart). **Check it fires often enough** (AI is A3>A2>A1, so A1 only when A2/A3 on cd — is Artor casting A1 in the boss phase?).
- **Mikey A4 "Party Dude" passive = evade + [Shield]-on-hit** — `MICHELANGELO-A4`, comment says "both wired". **Check the shield actually procs and absorbs boss AoE.**

**NEXT ACTION (was mid-flight):** trace the pool team's per-champion HEALING in the boss phase (sum `res.effects` kind `heal` by source, plus track HP recovery per champ) and compare to the capture above. Find which of the three is under-firing and why. ⚠ NOTE: `sim-per-hero-bands` "healing" is REPORT-ONLY and **excludes lifesteal** (not ledgered) — so measure HP recovery directly, not just the healing ledger.

## LOAD-BEARING MECHANIC FACTS (Mike first-party this session — don't re-derive)
- **Purple bar ≈ 10% maxHP, ESCALATES per Inhale** (~5 HP-bars 1st, ~7 2nd; Mikey dealt MORE the 2nd time and still couldn't clear). **Only ~3 Inhales per fight** → the escalation is NATURALLY BOUNDED (Scorch maxes ~0.75 maxHP); **no Scorch cap needed** (a dead-end I chased). The sim's pool fight has only ~1 Inhale — Scorch is NOT the pool wipe cause.
- **Poison teams do NOT clear the bar** — they EAT every Scorch and win by out-sustaining (Bambus: Tagoar 2.2 revives/fight). Poison's job on the boss is DAMAGE, not bar-clear. The bar-clear-via-poison-tick timing IS modeled correctly (`tickDots` before `actEnemy`), but for Bambus the poison stacking needed `installRecipeRun` (fixed by the unification).
- **Mikey gear-swaps**: Lifesteal×4 SOLO, Perception×4/Speed×2 on the TEAM (the pool build's Perception/Speed is CORRECT — do not "fix" it to Lifesteal). **Ninja does NOT swap** — Lifesteal always.
- Boss ATK is real (5,818 at St16); per-hit numbers validated against Mike's replay (WoF 2,650 ≈ 3.4×ATK into a shielded Mikey; Swipe 1,158 = 3×ATK with the boss's own Decrease ATK from a teammate).

## REALITY ANCHORS CAPTURED THIS SESSION (fixtures added)
- `test/golden/dragon10-mikey-solo.json` — WIN ~31-41t (varies w/ a Scorch stun), 1/1. `dragon11-mikey-solo` — WIN 70t. `dragon12-mikey-solo` — **LOSS** (Scorch escalates to a kill; 2/2 real losses). `dragon9-ninja-solo` — WIN 47t/299k. Builds: `data/observed-builds/donahilvi-mikey-solo.json` (Lifesteal), `donahilvi-ninja-solo.json` (Lifesteal), `donahilvi-dragon-pool.json` (team gear).
- ⚠ `dragon11-mikey-solo` golden is a bucket-4 mismatch (sim LOSS/real WIN) — the deterministic all-land golden gets wiped by the escalating Scorch; the STOCHASTIC montecarlo is 39-74%. Known-incomplete, not a rung failure.

## TOOLING
- `node --env-file=.env.local tools/sim-montecarlo.mjs <fixtureId> 100` — NOW unified (buildBattle + installRecipeRun, real masteries). Rung 7.
- `tools/sim-per-hero-bands.mjs` (per-hero dealt/taken/healed vs captures), `tools/sim-golden.mjs`, `tools/sim-selftest.mjs` (156/0), `tools/check-champion-identity.mjs` (guardrail — GREEN; run before any champion lookup).
- Scratchpad traces (this session's, in the temp scratchpad dir): `pool-death.mjs` (death-cause trace), `pool-inhale.mjs` (Inhale count), `boss-turnlog.mjs`, `scorch-tally.mjs`, `solo-bands.mjs`. All build via `buildBattle`/`makeDragonContent`; adapt for the healing trace.

## DO NOT RE-CHASE (dead ends this session)
- Scorch escalation cap (only 3 inhales → naturally bounded).
- Ninja Escalation passive (correctly ~0×; his base kit reproduces reality).
- "Bambus poison regression" (was the harness bespoke-path bug, fixed by unification).
- Kill speed / turns (they MATCH now — pool 112 vs 109). The gap is SURVIVAL only.
