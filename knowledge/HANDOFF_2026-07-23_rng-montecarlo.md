# Session Handoff — 2026-07-23 (PM): seeded RNG, separate streams, and the Monte-Carlo reality check

**COLD-START DOC — read this FIRST** (latest front). Then, in order:
`HANDOFF_2026-07-23_multipliers-and-persistence.md` (the AM session: multiplier capture + the
write-back lesson + DB posture), then `HANDOFF_2026-07-22_qa-ladder.md` (QA protocol / sim details
both build on), then the ⭐⭐/⭐⭐⭐ memories at the top of `MEMORY.md`.

**Branch/DB posture:** `session/turn-loop-2026-07-22` was **MERGED to `main` (fast-forward) and pushed**
— all 31 commits are on `main`, working tree clean, `main` in sync with origin. DB has seeds 206–211
applied (verified live). Only seed 205 remains file-only (superseded by 211 anyway).

---

## 0. THE ONE-LINE STATE

The sim is now **STOCHASTIC and reality-comparable**. It was deterministic (a debuff landed iff
land-chance > 0.5, crit was applied as its expected value) — which **cannot** reproduce a fight that
"nearly wiped because Ezio's [Perfect Veil] proc'd less this run," the exact thing Mike watched. Now:
seeded RNG + a Monte-Carlo rung that runs N battles and reports a **win-rate + turn distribution**.
Running it immediately **quantified the survival gap**: the sim kills the HEALERS at ~t30.

**THE DELIVERABLE IS STILL THE QA TOOL, NOT A FINISHED SIMULATOR.** RNG is additive: `seed=null`
keeps the exact v0 thresholds, so the 120 spec teeth-tests are byte-for-byte unchanged (verified).

---

## 1. WHAT CHANGED — the RNG layer (commit 6019730 + masteries 52ad247)

Built to Mike's written spec (pasted mid-session; it's the target architecture — re-read it in the
transcript). Implemented in `lib/sim/engine.js`:

- **Seeded mulberry32 PRNG, SEPARATE streams per mechanic** — `makeRngStreams(seed)` →
  `{damage, crit, affinity, debuff, target, ai}`, each independently seeded. Mike's load-bearing
  requirement: **a damage-formula change must not perturb the target-selection roll sequence.** Same
  team+stage+seed reproduces the exact battle (verified: two runs identical → bugs are traceable).
- **`makeState({seed})`** builds the bundle; `seed=null` → deterministic v0. `rng` also accepts a
  prebuilt bundle.
- Helpers: `rollChance(stream, p)` (generic Bernoulli, or v0 threshold when stream null) ·
  `rollLand(state,p)` (debuff stream) · `critMult(state,cr,cd)` (crit stream — real per-hit crit, not
  the old expected-value average) · `dmgVariance(state)` (damage stream).
- **Two-stage debuff** (spec step 6→7): placement-chance roll → ACC-vs-RES roll. **Inert until
  per-debuff `chance` data exists** (guarded by `d.chance != null`, so zero behavior change today).
- **Damage variance** is a **FLAGGED ASSUMPTION, default OFF** (`SIM_DMG_VAR=0`). Do NOT enable it
  until Raid's verified damage range is known — honoring Mike's "test as ranges, don't silently guess."
- **Masteries** (earlier commit): `WARMASTER_MAXHP=0.024` (verbatim from `cb-damage-model.js`, not a
  new fit), applied once per attacking turn when `actor.bossMastery`. Bracketed, not captured per-champ.

## 2. THE NEW TOOL — Monte-Carlo rung 7

`node --env-file=.env.local tools/sim-montecarlo.mjs [fixtureId] [N=100]`
- Runs N seeded battles on the golden fixture (reuses `sim-golden`'s DB build path), reports
  **WIN RATE + turn dist (p10/median/p90) + per-champion death rate + median death turn**.
- `SIM_MASTERY=off|offense` brackets the uncaptured boss masteries.
- **Compare the RATE to reality, not one run** — a single real WIN is one draw from the distribution.

---

## 3. WHAT IT MEASURED (Dragon-16 golden — the survival gap, quantified)

| run | win rate | healers die | turns |
|---|---|---|---|
| masteries **off** | **2%** | Tagoar t30, Vergis t32 | median 126 / p90 144 |
| masteries **offense** | **11%** | Tagoar t76, Vergis t64 | p90 **150 = reality** |
| **reality** (VICTORY screen) | won, but "nearly wiped" wave 2 (so ~60–80%, not 99%) | survived to 150 | 143–170 |

**THE DOMINANT ERROR: the sim kills the HEALERS early.** Tagoar/Vergis did **110k/70k healing** in the
real fight and survived to t150; in the sim they're dead by ~t30 → team loses all sustain → collapses.
This confirms the standing finding (`[[video-recordings-are-ground-truth-2026-07-22]]`) that **survival
is the bigger error, not offense** — now as a distribution, not one run. The masteries bracket also
proved offense and survival are **coupled through incoming**: faster clears → less incoming → healers
live longer. Full detail: `[[rng-montecarlo-and-healer-death-gap-2026-07-23]]`.

---

## 4. RECOMMENDED NEXT (in priority order)

1. **THE HEALER SURVIVAL QUESTION** (highest leverage). Why do Tagoar/Vergis die at t30? Instrument
   per-champion **healing-throughput** (vs the screen's 110k/70k) and **incoming-per-turn**. Candidates:
   (a) heals not firing often/large enough to keep the healers themselves up; (b) incoming too high —
   `DEF_K=1500` is the one unvalidated damage constant (`SIM_DEF_K` overrides for sensitivity); (c)
   healer builds under-captured — **masteries are absent and their gear is "not confirmed from the
   frame"** in `data/observed-builds/2026-07-22-demon-lord.json`. Capturing real masteries/gear from
   Gestal is likely part of the fix.
2. **Still owed from Mike's RNG spec** (flagged TODOs, NOT silently done): per-hit **multi-hit**
   resolution; **weak-hit roll before crit** (affinity is still deterministic 1.3/0.7/1.0); **speed-tie**
   roll; enemy-AI **weighted** choices where genuinely random (currently deterministic lowest-HP%).
3. **Wire the Monte-Carlo rung into the QA orchestrator** (`sim-qa.mjs`) as rung 7, and consider a
   teeth-check (a known-survivable fixture must show a non-zero win rate).
4. **Boss debuffs are still applied unconditionally** in `dragon.js` (Wall of Fire poison/weaken etc. do
   not roll ACC-vs-RES). Fine for now, but a real RES build should reduce them — a future stream hookup.

**Method reminder (`[[test-like-deep-blue]]`):** a change reports the new NUMBER (win rate / death
turn) or it isn't evidence. IMPLEMENT verified game facts, DON'T FIT constants; flag unknowns as ranges.
