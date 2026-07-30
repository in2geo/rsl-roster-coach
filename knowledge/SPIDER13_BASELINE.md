# Spider-13 — FROZEN OUTCOME BASELINE + two-tier validation (2026-07-30)

**Process (Mike 2026-07-30): freeze this baseline, fix confirmed lifecycle/targeting defects ONE AT A TIME,
and after every change rerun the SAME seeds and compare BOTH win rate AND battle shape. Do NOT tune directly
toward 181 turns until boss-damage attribution explains why the simulated boss dies ~70 turns early. Goal =
"win the way reality wins" — a correct WR reached the wrong way fails when roster/gear/stage changes.**

## ⚡ CHECKPOINT UPDATE 2026-07-30 — POISON-ACTIVATION FIX (the 68% was a MIRAGE)
`activatePoisons` (engine.js) was NOT applying Skavag's 90% poison reduction (only the natural `tickDots` was),
so Ezio's A2 detonated the boss's poison at FULL damage — inflating boss-poison ~2× and killing her ~70t early.
Fixed (add `bossPoisonFactor` to activatePoisons, parity with tickDots; Dragon factor=1 → unchanged, golden +
snapshot pass). **Before/after on seeds 1–60:**
| metric | BEFORE (buggy) | AFTER (fix) | reality |
|---|---|---|---|
| Win rate | 68% | **2%** | ~71% |
| median turns | 112t | **174t** | ~181t |
| poison→boss | 1.46M | 718k | — |
| Bambus→boss | 1.14M | 400k | — |
**The 68% WR was a false positive — the sim only "won" by racing (bug killed the boss too fast before survival
gave out).** Correct boss pace (174t≈181t) EXPOSES that the team can't survive the real fight → WR 2%. So
**swarm control / survival is now the WR-CRITICAL defect, not just fidelity.** Fix KEPT (verified bug; reverting
would re-hide a broken survival model behind a false WR).

## Frozen build
- Commit `8478e03` + the poison-activation fix (this checkpoint).
- Fixture `test/golden/spider13-donbambus-current.json`. **Seed set: 1–60** (fixed — always rerun these).
- Regenerate with `node --env-file=.env.local tools/sim-spider-control-scorecard.mjs 60` +
  `tools/sim-spider-boss-attribution.mjs 60` + `tools/sim-per-hero-bands.mjs`.

## Two validation tiers
| Tier | Required result | Spider-13 status (post-fix) |
|---|---|---|
| **Product** | Win rate within tolerance + no major clear/fail classification error | ❌ **FAIL (2% vs ~71%)** — was a mirage |
| **Fidelity** | Turn count, target distribution, damage dealt/taken, control uptime, protection uptime all within tolerance | ❌ FAIL (turn count now GOOD: 174t≈181t) |

Spider-13 now FAILS both tiers honestly. The fix converted a false Product pass into a true failure that
correctly localizes the survival/swarm-control defect. Do not depend on Spider predictions until survival is fixed.

## Baseline numbers (60 seeds, post-fix)
**Product tier**
- Win rate **2%** (reality ~71%) — FAIL. (Pre-fix 68% was the poison-activation mirage.)

**Fidelity tier** (all currently FAIL vs reality)
- Median turns (wins) **111t** vs reality **181t** — sim wins ~70t too fast (boss dies too early). ⚠ do NOT
  tune to 181 until boss-damage attribution explains the gap.
- Per-hero DAMAGE TAKEN overshoots (per-hero-bands): Bambus ~53k / Vergis ~87k / Pelops ~74–78k / Ezio ~41k /
  Tagoar ~39k — squishies over-taken (reality spreads far lower; Bambus reality ~8k).
- Swarm CONTROL uptime: Decrease Speed **~12%**, Petrification **~6%** of the swarm vs reality **~near-all
  slowed + ~30% petrified** (3 of ~10 in the t66 screenshot).
- Swarm turn-share **~53%** (avg 9.3 live spiderlings) vs reality team-dominant.
- PROTECTION uptime (Ally Protection / shields): measured next — see the lifecycle investigation.
- A1-AoE fires on **43%** of Bambus's A1 casts (only when the picked target has ≥2 debuffs); Bambus casts A2
  ~**3×/fight** → shields lapse rather than compound to reality's 4 bars.

## KEY CORRECTION (why this baseline exists)
Aggregate (60 seeds) REFUTED the single-run (seed 3) narrative that swarm control drives the LOSSES: control is
uniformly LOW in both wins (12%/6%) and losses (10%/6%); the win/loss swing is FIGHT LENGTH (wins 111t / losses
149t). So swarm control is a **fidelity/per-hero-distribution** gap, not the WR root. See memory
`spider-swarm-control-turn-economy-2026-07-30`.

## Open defect queue (fix one at a time, rerun seeds 1–60, compare WR + shape)
1. ~~**Vergis/Bambus PROTECTION LIFECYCLE**~~ — **INVESTIGATED 2026-07-30, NO isolatable defect (CLOSED).**
   Aggregate (40 seeds, `tools/sim-spider-protection-lifecycle.mjs`): AP coverage PER-INCOMING-ATTACK is
   Ezio 29% / Bambus 28% / Tagoar 37% / Pelops 65% / Vergis 0% (caster, self-excluded). But the mechanics are
   FAITHFUL: pickSkill prioritizes A2 (furthest-right off-cd); Bambus A2 EXTEND_EFFECT stretches AP 2→3t
   (works); NOT a death-spiral (Vergis alive 87%, 0.6 revives/fight, acts 9.5×). Booked-cd is a DEAD END —
   Vergis is an **Epic at 4★/L40 (unbooked)** so base cd4(A2)/cd3(passive) is correct; sync carries no book
   status. Low coverage = Vergis turn-starved (acts 9.5×, A2 cd4 counts HIS turns → 2.5 casts/fight); reality's
   unbooked Vergis at the same cadence would cover ~the same. **The real divergence is TARGETING: sim aims 3×
   the hits at Vergis (87k vs reality 29k taken).** → not a protection bug; it's defect #3.
2. **Boss-damage attribution** — **DONE 2026-07-30 (`tools/sim-spider-boss-attribution.mjs`, 60 seeds).**
   Boss killed **96% by poison / 75% by Bambus's dump** (direct only 4%); kill rate **1.40× reality**; sim Bambus
   deals 1.14M to the boss alone (1.6M total vs reality 1.08M → OVER). Skavag's 90% poison-reduction IS applied.
   ROOT: the poison is FUELLED by spiderling hits on allies (sponged by Bambus) → **uncontrolled fast swarm →
   more hits → more sponged poison → more dumped on boss → boss dies ~70t early.** NOT a boss/poison-scaling
   bug. **⇒ Do NOT tune boss HP / poison factor / turns. Fix swarm control; boss timing follows.**
3. ~~**TARGETING over-focus on Vergis**~~ — same root as #2. Sim tunnels lowest-effHP (Vergis, 3× reality's
   hits); reality spreads because the swarm is slowed/petrified.

## THE UNIFICATION (2026-07-30)
Defects #2 (boss dies 70t early) and #3 (per-hero over-taken: Vergis 87k/reality 29k, Bambus over-deal 1.6M/1.08M)
share ONE root: **the sim under-controls the swarm** (slow ~12% / petr ~6% vs reality ~near-all / ~30%). The fast
uncontrolled swarm both (a) hits the team more → over-taken + over-fuels Bambus's poison → boss dies fast, and
(b) makes the team turn-starved → low control → stays fast. Fix the swarm control to reality levels and BOTH
fidelity gaps should close together. **DECISIVE TEST: the basin-flip** — force the swarm slowed/petrified for
the opening (or throughout) and check whether fight length → ~181t, per-hero taken → reality bands, and Bambus
dealt → ~1.08M, WITHOUT touching boss/poison/turn constants. If yes, swarm control is the confirmed master lever
for Spider fidelity (WR is already fine at 68%≈71%).
