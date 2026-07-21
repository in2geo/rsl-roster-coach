# The model is a partial REIMPLEMENTATION of Raid's combat, tested against captured battles

**Established 2026-07-21 (Mike).** This reframes what the engine *is*, which fixes why the project has
zigzagged. Read this before proposing any change to the scoring/prediction layer.

## The reframe

We are not building a recommendation heuristic. We are building a **partial reimplementation of
Raid's combat model**, and validating it by replaying battles we captured and checking it reproduces
what happened. A reimplementation has a definition of done (reproduce observed reality), a backlog
(the mechanics still unimplemented), and a metric (how many battles it reproduces). A heuristic has
none of those — which is why six months of heuristic tuning produced argument instead of progress.

## Why it kept zigzagging (the diagnosis)

Until 2026-07-21 there was no **falsifiable scalar** a change had to beat. The shadow tools and the
reconciler existed and were used, but they emit *descriptions* — rankings, medians, correlations —
which can always be argued with. So every model disagreement was settled by whichever framing was
most persuasive that session. The stage-recommendation number WAS falsifiable, but it is **censored**
(20 of 24 account×dungeon cells never pushed past a win, so "actual ceiling" is unknown) and so it
could not clearly say "you got worse" in the over-prediction direction where the model is worst.

## The test — `tools/battle-suite.mjs`

Every captured battle is a test case: known team, known stage, known outcome → predict WIN/LOSS →
pass or fail. **The headline is BALANCED ACCURACY** (mean of win-recall and loss-recall); a constant
predictor scores exactly 50%, so class imbalance (78% of battles are wins) cannot flatter it.

**First measured state (2026-07-21): 204/324 reproduced, balanced accuracy 52.9%** — barely above a
coin flip; Spider below chance. Win-recall 71% vs **loss-recall 35%**: we predict clears, we are
two-thirds blind to deaths. This is the floor we build up from.

## The method — how you find what you don't model

You cannot measure an unknown mechanic directly. You measure the **residual** (model vs reality),
which is fully observable, and read its **structure**:

1. **Slice the residual** many ways (by dungeon, stage band, champion, mechanic-present).
2. **An unexplained cluster is the shadow of an unmodelled mechanic.** Demonstrated 2026-07-21: of 47
   deaths our kill-side called comfortable, ~none are below stage 15 and 11+11 pile up at Dragon/IG
   15-20 — *something turns on at 15* even though we cannot yet name it.
3. **Domain knowledge names the cluster.** The model localizes; the human identifies. (This is how
   the %maxHP cap *should* have been found — as an over-prediction spike at 21+ — instead of via a
   forum thread.)
4. **Implement the mechanic, re-run the suite.** ⚠ AMENDED 2026-07-21, same day, after the first
   real trial: "keep it only if the number moves" is TOO CRUDE. Distinguish:
   - a **VERIFIED GAME FACT** (published table, in-game screenshot) that doesn't move the number →
     **KEEP IT.** It means the METRIC is blind to that axis, not that the mechanic is wrong.
   - a **SPECULATIVE TUNING** (a coefficient, a weight, a threshold) that doesn't move the number →
     **REVERT IT.** That is the case the rule was written for.
   Worked example: blessing bonus stats (verified Plarium table) were implemented correctly and
   flipped ZERO battles — because the kill-side model consumes almost no stats. The bonus is mostly
   HP/ACC/RES, which feed SURVIVAL and LAND RATE, and neither axis exists yet.
   **COROLLARY — survival is a PREREQUISITE, not merely the biggest lever.** Several mechanics can
   only express themselves through it, so implementing them is UNMEASURABLE until it exists. Build
   survival before any further stat-mechanic work, or you cannot tell success from no-op.

### THE HARD LIMIT — and the two rules that follow from it
An unknown that affects **everything uniformly** creates no residual structure: it gets absorbed
into a calibration constant and becomes permanently invisible, looking like a tuned parameter.
Therefore:
- **IMPLEMENT, DON'T FIT.** Fitting free coefficients (e.g. against the 16 frontier boundaries)
  *launders unknown-unknowns into false knowledge* — it hides a missing term inside `SOURCE_COEFF`
  and the suite then looks calibrated while being structurally wrong. Fit only AFTER the mechanics
  are enumerated, so a residual means something.
- **EXPAND THE DATA RANGE to make uniform unknowns vary.** Frontier stages (new regime — the cap
  turns on at 21), new accounts (new rosters), new game versions (mechanics change per patch). A
  uniform unknown at stage 13 stops being uniform the moment you play 22. This is the real reason
  frontier play matters — it *uncensors* over-predictions AND flushes uniform unknowns.

## The mechanics checklist (living — this is the "clear list")

> ⚠ **THE CANONICAL LIST IS `knowledge/GAME_MECHANICS_INVENTORY.md`.** The table below is a summary
> of what the 2026-07-21 session happened to surface; it is NOT an enumeration of the game. The
> inventory doc enumerates three axes (battle keywords · character-power systems · combat-resolution
> systems) and is the one to add rows to.

One row per game system: **captured?** (do we have the input) · **modelled?** (does it enter a
formula) · verdict. Ranked by battles-flipped when implemented (measurable via the suite). Seeded
from what 2026-07-21 established — mention in code ≠ modelled, so every "modelled" needs evidence.

| mechanic | captured | modelled | note |
|---|---|---|---|
| **Survival / incoming damage** | enemy ATK ✅ | ❌ `incomingDamagePerTurn=null` | **top lever: 65% of losses are here** (kill-side blind) |
| Incoming-damage taxonomy (%maxHP vs ATK-vs-DEF) | — | ❌ | prerequisite for survival; raw ATK inverts known walls (INS-0016) |
| Awakening | ✅ 100% | ❌ | transported through 5 files, enters no formula |
| Ascension | ✅ 100% | ❌ | same |
| Blessings (`blessingId`) | ✅ | ❌ | never read |
| Empower (`empowerLevel`) | ✅ | ❌ | never read |
| Masteries | ✅ 48% geared | ⚠️ partial | only `has_boss_mastery`; rest of tree ignored |
| Booked skills | ✅ (`isFullyBooked` exists) | ❌ | engine uses a rarity GUESS; its own comment says "representation-only" |
| Gear SET effects | sets ✅ | ⚠️ | pieces captured; set bonuses not modelled |
| %maxHP boss cap (stage 21+) | ✅ (`maxhp_pct`, 47 skills) | ✅ (2026-07-21) | UNVALIDATED — 0 corpus runs field a cap-affected champ at 21+ |
| Affinity | ✅ | ✅ | INS-0015 |
| Boss HP / stage magnitude | ✅ | ✅ | wired 2026-07-21; note DoT kill-time is HP-invariant |

Not yet on the list and probably belong: buff/debuff stacking caps, Great Hall, faction guardians,
glyphs, speed/turn-order (captured as turns, **no turn model** — audit flags this 29×).

## What is NOT in question (do not throw these away)

- **Team SELECTION works** — the Spider 5th-seat ordering (Vergis > Kael > Fahrakin) matched reality
  by clear time. The selection half of the product is real and untouched by any of this.
- **The data layer is the asset** — 4,525 tags, real Gestal gear, 353 graded battles, the capture
  loop. It accretes across every pivot; the scoring layer is what kept getting rebuilt. This reframe
  changes the scoring layer's METHOD, not the data.

## The chronic disease this must not repeat

Built-but-unwired artifacts die and get re-derived by hand. On 2026-07-21 alone: the alias resolver
(complete, bypassed), per-round capture (reads the dict after it's cleared), the contribution model
(fed a constant), `battle-gaps`/assumption-audit (never called), and now the suite itself. **The
suite is only real when it prints on every reconcile** (`watch-reconcile` / `loop.mjs`) and a change
that lowers it is rejected on that basis. If it stays a tool in `tools/` run once and forgotten, this
was zigzag #6.

## Honest caveats (so this doesn't become the thing it's replacing)
- The suite tests the **contribution path** (kill-side), not the live `matchRoster` verdict (which
  scans for a best stage, not score-a-team-at-a-stage). Extending it to the verdict is follow-up.
- The suite **could be the wrong metric** — binary win/loss at a fielded stage is not identical to
  "which stage should you attempt." If it starts driving decisions it hasn't earned, that's the next
  zigzag.
- "Reimplementation" is the organizing principle; the suite is the **stopping rule**. Implement the
  minimum mechanic that moves the number. Mark things "deliberately excluded" — we need enough
  fidelity to RANK teams and PLACE a stage, not Plarium's exact damage numbers.

## DATA WE ARE MISSING — the acquisition list (what to GO GET)

Distinct from the checklist above. The checklist mixes "captured but unmodelled" (needs CODE, we
already have the data) with "not captured" (needs ACQUISITION). This is only the acquisition half,
split by who can get it — because most of it is play/review only a human can do.

### A. ONLY MIKE CAN GET THIS (play / review / tell us) — highest value, blocks the most
- **Frontier runs at 21-25**, especially **Spider and Fire Knight (never fought there)** and
  **Dragon 25 / IG 23-25**. Uncensors over-predictions AND is the only way to exercise the %maxHP cap
  regime (0 corpus runs currently field a cap-affected champ at 21+). One run at Spider 21 is worth
  more than the hundredth at Spider 13.
- **Push a fixed team until it LOSES** on any dungeon. Turns a censored ceiling (20/24 cells) into a
  two-sided boundary. We have 16 such boundaries; every new one is a hard calibration constraint.
- **Approve or reject the 8 proposed %maxHP champions** (seed 202 found them, unapproved): Blood
  Marchioness Mina, Cinda, Gamuran, Geomancer, Klaazag, Odin, Steel Bowyer, Storm Herald Hekaton.
- **Per-champion AI skill settings** — confirmed UN-readable from memory (see ai-settings memory);
  must be entered by hand. Affects whether a tagged skill actually fires on auto.

### B. READER / CAPTURE WORK (code, passive-read boundary)
- **Per-hero dungeon damage** — currently BROKEN, not just missing: the heap-scan contiguity premise
  fails (allies+enemies interleave). 21× in the gap backlog. Needs the dungeon-dialog hero-list path,
  not the current scan.
- **Debuff LANDINGS** (did a tagged debuff actually land?) — needed to verify ACC floors. 31× in the
  backlog. In the heroRounds blob; deferred.
- **Phase-at-death / per-round HP** — `--roundstats` probe INCONCLUSIVE (post-battle dict may be
  cleared); likely needs IN-BATTLE sampling at the existing 100ms poll, not file parsing (the file
  cannot hold a per-round timeline — measured).
- **Gear-set REQUIRED-PIECE-COUNTS** — we capture set pieces but not whether a bonus is ACTIVE
  (needs the count threshold per set). Blocks crediting Lifesteal/set effects correctly.

### C. INPUTS NOT CAPTURED (mostly in the game, need a capture path)
- **Debuff chance / duration / auto_reliable** per skill — 76× the top backlog item; without it
  reliability×uptime cannot be scored. Some derivable from skill text, some needs game data.
- **Masteries for the other ~52% of geared champions** — masteryIds present on only ~48% of geared
  champs; the rest can't be credited masteries at all.
- **Battle speed** — reads null (unguarded assumption; constant across corpus today, but a silent
  break if it ever changes). Verify the offset or add a guard.

### D. ALREADY CAPTURED — needs MODELLING not acquisition (see the checklist)
Awakening, ascension, blessings, empower, booked-from-Gestal, gear-set effects, turn/speed model.
**Do not go "get" these — we have them. They need code.**

## Immediate next steps (ranked)
1. **Wire `battle-suite.mjs` into `watch-reconcile`/`loop.mjs`** — make the number unavoidable. Until
   this, everything below is unmeasurable and the reframe hasn't taken.
2. **Wire `battle-gaps.js` into the reconciler** — stop re-deriving known-unknowns by hand.
3. **Build the survival side** — `incomingDamagePerTurn` from the incoming-damage taxonomy. Biggest
   single lever (65% of losses). Re-run the suite; it should move loss-recall off 35%.
4. **Then** consider fitting — never before the checklist is worked through.
