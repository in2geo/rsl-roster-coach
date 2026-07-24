# HANDOFF — 2026-07-24 — Simulator graduation + the magnitude gap

**Read this first for a cold start.** Branch `session/qa-rungs-2026-07-23` (NOT merged/pushed, ~20 commits,
clean tree). Gates green (`model-qa.mjs` and `sim-qa.mjs` both SPEC-CONFORMANT).

---

## 0. THE MODEL ≠ THE SIMULATOR (internalize this before touching anything)

Two different systems. Mike stressed this repeatedly; conflating them is the #1 way to go wrong.

| | **THE MODEL** | **THE SIMULATOR** |
|---|---|---|
| What | recipes + interpreter (`lib/sim/recipes.js`, `interpreter.js`) | the final product: the turn engine (`engine.js simulate`) + recipes + RNG, fed REAL stats |
| Role | the **testing ground** — "the interpreter IS the prediction" | the thing that must **mimic a real battle** |
| Inputs | clean/controlled toy numbers | REAL modifier-inclusive stats (Gestal `effectiveStats`) |
| Validated by | `model-qa.mjs` (11 rungs, deterministic, teeth 100%) | the captured-battle corpus + **balanced-accuracy metric** |
| Reality-comparable? | **NO, by design** (no peripheral stat modifiers) | **YES** — that's its whole job |

Rule: **Model plumbing "rolls into" the Simulator once proven.** That is literally what happened this
session — the turn loop graduated into the metric (see §1). When you change the Model, re-run `model-qa`.
When you change the Simulator/metric, re-run `sim-suite` / `battle-suite` / `sim-qa`.

**Peripheral stat modifiers (GH / Arena / masteries / blessing / faction):** we settled this. Gestal's
`baseStats` == the in-game build-screen BASE (verified: Pelops 22,140 exact), so those bonuses are already
baked into the base the Simulator inherits. **Gear is the ONLY layer the sim adds itself** — and it's where
the bug was (now fixed, §3). Do NOT try to re-add GH/Arena as a separate layer; they ride in via `baseStats`.

---

## 1. WHAT SHIPPED: the turn loop + RNG is now the Simulator's metric

Before: `battle-suite.mjs` scored every captured battle with an AGGREGATE heuristic (`computeContributions`)
that simulates NO turns for either side (the "Spider st5 == st20" blindness). Now:

- **`tools/sim-suite.mjs`** — the graduation. Same captured-battle WIN/LOSS test, but `predict()` builds BOTH
  sides as combatants from real stats and runs the **seeded Monte-Carlo** (`simulate`, N seeds → win-rate;
  predict WIN iff rate ≥ 0.5, threshold PINNED not fitted). The seam is a single function; the Simulator
  keeps only its **stat pipeline + corpus + metric**, and imports the whole turn engine.
- Head-to-head on **108 identical Dragon cases (N=25): turn loop 61.7% balanced vs aggregate 49.4%,
  false-clears 21→7, no constant tuned.** The turn loop beats the aggregate (which can't clear 50% on Dragon).
- It applies the **leader aura** (reuse product `pickLeaderFrom`/`applyLeaderAura`, %-of-base, all 5 champs),
  **lifesteal** (from gear), and **installs recipes** (Perfect Veil / immunities / Second Wind / incoming mods).

⚠ **Path gotcha:** `sim-run.mjs`, `model-golden.mjs`, `sim-suite.mjs` INSTALL recipes.
`sim-montecarlo.mjs` and (until this session) `sim-trace.mjs` run the **legacy `applySkill` path — NO recipes**.
If a tool's survival looks wrong, check whether it installs recipes.

---

## 2. THE HEADLINE FINDING: the RNG is a red herring; the sim's fight is a broken near-tie

Real Dragon-16 (Don$Bambus): the full 5-champ team wins **11/11** — the *only* loss in the whole corpus is
a **Pelops SOLO run** (`1 champ · 8t`). Reality's variation ≈ 0: they ALWAYS win.

The sim's Monte-Carlo says ~50% win, median 0 survivors — **bimodal (cruise 5/5 or wipe 0)**. We chased it:

- **Land-rate bracket** (`SIM_LAND_P=0/0.5/1`): win 50%/50%/65%, p10 survivors=0 at every rate → **debuff
  landing barely matters.** Not the cause.
- **Crit sweep** (`SIM_CRIT=ev`): holding crit at EV made it WORSE (35% vs 53%) → the team *relies* on crits;
  crit isn't punishing, the fight is a **knife's-edge race**.
- **Losing-seed trace** (recipe path): **Pelops dies at ~t67 in EVERY losing seed**, then the team cascades.
  Reality's Pelops always tanks wave 2 fine (it's Vergis who dies+revives) → the sim kills the WRONG champ.
- **Per-hero sim-vs-real** (`sim-trace.mjs`, the trace-oracle): **offense 3–9× too LOW** (Bambus 77k/506k,
  Pelops 30k/259k) and **incoming 3–6× too HIGH** (Pelops 78k/26k, Tagoar 27k/4.4k, Ezio 10k/3.5k — Perfect
  Veil not protecting him). Totalled with the 103k of **unattributed DoT**, real offense gap is ~3.3×.

**Conclusion:** the sim models the fight as a near-tie, so a coin (crit) decides it. Reality is a blowout
(Bambus alone does 506k), so no roll loses it. **The fix is NOT to tune RNG or "modify magnitudes."**

---

## 3. IMPLEMENT, DON'T FIT — the numbers are known; MECHANICS are missing

Mike's key challenge: *"why aren't these numbers fixed and known? how is it we need to modify them?"* — RIGHT.
They ARE known. The coeffs are in the DB: Bambus A1 `3.8×ATK` / A2 `5.6×ATK`; Pelops A1 `0.25×HP` / A2 `0.4×HP`.
We do NOT tune these. The 3.3× offense gap is:
  1. **Attribution artifact** — 103k of DoT is dealt but "unattributed to caster" (a reporting issue, not lost damage).
  2. **UNIMPLEMENTED MECHANICS** that compound the known coeffs into reality's totals — all readable off the cards:
     **HP-Burn ally-splash** (burn on an add splashes % of the BOSS's max HP), **Poison Sensitivity** amp
     (Ezio places it; consumer is *deferred*), **Bambus A1-becomes-AoE-when-debuffed**, **Warmaster masteries**,
     **dynamic scalers** (Pelops A2 `+10%/debuff`, Arbalester `+1×ATK/debuff`).
  Incoming side: implement the missing MITIGATION mechanics (Perfect Veil untargetable — not firing; Ally
  Protection redistribution; Decrease ATK on enemies; shields). The ONLY tunable constant is `DEF_K`, and it
  stays untouched until every mechanic is enumerated.

**So the next work is building mechanics from the cards, not dialing numbers.** Highest-leverage offense
mechanics here: **HP-Burn splash + Poison Sensitivity**. Highest-leverage survival: **Perfect Veil actually
making Ezio untargetable** in the (roster/legacy AND recipe) targeting path.

---

## 4. THE GEAR-SET FIX (input-pipeline root cause, now RESOLVED)

`sync.js`'s gear-set-id→name map was hand-guessed and WRONG (id 9 = "Perception" when the game says
**LifeDrain = Lifesteal**) — that mislabel hid every lifesteal build from the sim. Fixed from the game's own
`ArtifactSetKindId` enum (`C:\Users\in2ge\Downloads\raid-dump-current\dump.cs`, Il2CppDumper v6.7.46;
human names from `RSL-coach/Artifact Set Guide.docx`). Verified via **`tools/sim-inputs.mjs`** (battle-start
stat dump — diff sim inputs vs the game build screen): Pelops now reads `Lifesteal×4 / 30%`, all `unknown(N)`
cleared. See memory `gear-set-id-map-authoritative-2026-07-24`. **Re-grep the enum only if Plarium adds a set
past the mapped ids.** Also owed: `applyAccountBonus` still injects a phantom flat ACC/RES (double-counts what
`baseStats` carries — Pelops sim ACC 85 vs real 70); drop it (task #4, deferred).

---

## 5. TOOLBOX (what to run)

- `node --env-file=.env.local tools/sim-suite.mjs [N]` — the graduated metric (turn loop, Dragon subset).
- `node --env-file=.env.local tools/battle-suite.mjs --by-dungeon` — the aggregate baseline to compare against.
- `node --env-file=.env.local tools/sim-inputs.mjs Bambus 16` — battle-start stat dump vs the game screen.
- `SEED=12 SIM_MASTERY=offense node --env-file=.env.local tools/sim-trace.mjs` — trace a losing seed (recipe path);
  `TURNLOG=lo-hi`, `TRACE=N`, `DUMP=Name` variants.
- `SIM_LAND_P=0|0.5|1` and `SIM_CRIT=ev` — engine RNG-bracket diagnostics (null = no-op).
- `node --env-file=.env.local tools/model-qa.mjs` (Model ladder) and `tools/sim-qa.mjs` (Simulator protocol).
- Reality anchors: `test/reviews/dragon16-donbambus-reality-anchors.md` (2 real runs + Pelops live build).

## 6. RECOMMENDED NEXT MOVE

Build the two biggest **offense** mechanics — **HP-Burn ally-splash** and the **Poison Sensitivity consumer**
— from the cards (Model first, teeth, then it's live in the Simulator since sim-suite installs recipes), then
re-trace the losing seed and watch the near-tie become the comfortable win reality shows. Do NOT touch DEF_K
or any coeff. Keep the two-system discipline: change the Model → `model-qa`; read the Simulator number →
`sim-suite`. Everything is committed; nothing is pushed.
