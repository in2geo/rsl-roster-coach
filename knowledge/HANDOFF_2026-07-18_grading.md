# Session Handoff — 2026-07-18 (grading loop + CB selection) → pick up cold

Cold-start doc. Read this, then **`DEEP_BLUE_STATUS.md` — the ⭐ GRADING SYSTEM section (NEW, and the
rule is USE IT in every test)**, then `insights-ledger.md`. This session was: fix the CB
recommendation, build the automatic **grading loop**, refine CB team-selection in **shadow**, and a
long reader-bug + identity investigation.

All work is on `main`, **NOT pushed** (repo is PUBLIC: `github.com/in2geo/rsl-roster-coach`).

---

## TL;DR — what this session did
1. **Built + automated the GRADING LOOP for Clan Boss.** `run_reconciliations` now grades CB on a
   **chest-tier axis**; `tools/watch-reconcile.mjs` auto-reconciles every capture; documented as a
   standing system in `DEEP_BLUE_STATUS.md` (it had been *forgotten* — recorded as a status line, not
   a rule). **COMMITTED `52791b6`** + migration applied live. Validated: two fresh keys auto-graded.
2. **Fixed the explanation layer's kit hallucinations (B1)** — feed `champion_skills.skill_summary` to
   `explain.js` so it narrates REAL kits (it was inventing Ninja's Decrease-ATK, Duchess's Leech, etc.
   from parametric memory). **UNCOMMITTED (verified).**
3. **Replaced the CB verdict axis (A-real)** — a chest/damage verdict ("one-key the top chest at the
   highest difficulty you can") instead of the nonsensical "40% chance of success." **UNCOMMITTED.**
4. **Refined CB team-selection in SHADOW** — Side-1 goals (`cb-shadow-goals.js`, COMMITTED `b465854`)
   + Side-2 scoring (`team-constructor` qualityFn, COMMITTED `9888f32`). GuapoDonni's *obvious* CB team
   (Ezio/Xeno/Duchess/Donatello/Michelangelo) now falls out **5/5**, shadow-only.
5. **Validated live vs real captures:** Duchess > Thisbe (+2.5M), Donatello > Ninja (+11M); grading
   verdict = one-key Brutal, Nightmare 87% of the Ultimate one-key.

---

## ⭐ STATE YOU MUST KNOW BEFORE DOING ANYTHING
- **THE GRADING SYSTEM IS THE STANDING VALIDATION TOOL — USE IT, don't hand-grade screenshots.**
  Loop: `capture → (watcher) auto-reconcile → graded run_reconciliations row → read the scoreboard`.
  **Scope every read by `account_id`** (the battle log is multi-account). It was built across many
  sessions and got forgotten once — the ⭐ section in `DEEP_BLUE_STATUS.md` exists to stop that.
- **Run the watcher alongside the reader:** `node --env-file=.env.local tools/watch-reconcile.mjs`.
  (One was left running in a prior session's *background*; kill it — `Get-Process node | ? CommandLine
  -like '*watch-reconcile*' | % { Stop-Process -Id $_.ProcessId }` — and run your own so you control it.)
- **`team-constructor.js` is the SELECTION foundation** — marginal-contribution + saturation/carrier-
  protection + ACC land-rate gate + build gate + potential-builds. **NOT** `selectTeam` (the old
  tag-checkbox sort that is STILL LIVE), **NOT** `team-assembler.js` (naive set-cover, fielded fodder),
  **NOT** `lib/model-select.js` (a DEAD END from this session — strip it). See INS-0013: a prior
  contribution-blend of `selectTeam` FAILED — do not repeat; fix the SCORING, use the STRUCTURAL constructor.
- **CB team selection is SHADOW-ONLY.** `MODEL_SELECT_CONTENT` is empty; live CB still uses `selectTeam`.
  The refined CB problem model + scoring live in `lib/cb-shadow-goals.js` + `tools/shadow-cb.mjs`.
- **MECHANIC CORRECTION (Mike, authoritative, NOT YET APPLIED TO CODE):** Warmaster/Giant Slayer damage
  on Clan Boss is **DEF-MITIGATED** (capped %maxHP, but the base is reduced by boss DEF), **not**
  DEF-independent. This CONTRADICTS `CLAUDE.md` damage-mechanics §1 AND the `cb-damage-model.js`
  invariant (`damageSourceIgnoresDef('warmaster')` — it THROWS if warmaster is DEF-dependent). That's a
  real bug: the model under-credits Decrease DEF / Weaken on CB. Also: **Weaken and Decrease DEF boost
  the mastery+attack lane, NOT the DoT ticks.** (The CB damage is two lanes — see cb-shadow-goals.js.)

---

## What changed — commits / files
**COMMITTED (`main`, not pushed):**
- `b465854` — `lib/cb-shadow-goals.js` (refined CB needs: mitigation #1; two-lane damage; Cleanse &
  Mitigation as OWN roles so saturation stops benching the Cleanser; Decrease DEF/Weaken as amps) +
  `tools/shadow-cb.mjs` (CB shadow runner + the GuapoDonni obvious-team anchor). 3/5 → 4/5.
- `9888f32` — `team-constructor.js` optional `qualityFn` (dev+masteries tiebreaker; absent by default so
  the dungeon path is byte-identical) + `shadow-cb` `cbQuality` (dev-dominant, masteries secondary,
  `CB_MAST_W` knob). 4/5 → 5/5 (seats Duchess over an L34 starter).
- `52791b6` — grading loop: `migrations/2026-07-18_cb_reconciliation.sql` (APPLIED live — chest columns
  + CB classifications, additive), `reconcile-runs.mjs` CB branch (chest verdict via `clanBossVerdict`;
  **refuses <5-hero captures**), `tools/watch-reconcile.mjs` (auto-trigger), `DEEP_BLUE_STATUS.md` ⭐ section.

**UNCOMMITTED — working & verified, needs committing (entangled in `match-engine.js` + `explain.js`):**
- **B1** (skill grounding): `api/user-champions.js`, `api/my-roster.js`, `lib/match-engine.js` (mapRoster
  carries `skills`), `lib/explain.js` (describeTeam feeds skill text + a hard "transcribe, don't recall" rule).
- **A-real** (CB chest verdict): `lib/clan-boss.js` (`clanBossRunsFromLog`, `clanBossRecommendation`),
  `api/match.js`, `index.html`, `app.js`, `style.css`, `lib/match-engine.js` (CB path emits
  `clan_boss_verdict`, suppresses the coverage `confidence_pct`), `lib/explain.js` (CB verdict section).

**UNCOMMITTED — DEAD END (strip):** `lib/model-select.js` + its dormant wiring in `match-engine.js`.

---

## OUTSTANDING / NEXT STEPS
1. **Commit hygiene** — strip the `model-select.js` dead end, then commit **B1 + A-real** together.
2. **Apply the Warmaster DEF-mitigation correction** — fix the `cb-damage-model.js` invariant + `CLAUDE.md`
   §1 + a ledger INS. (Real bug; under-credits Decrease DEF/Weaken on CB.)
3. **type_id backfill (identity boundary gap).** 704/944 champions have NULL `type_id`; **72 are OWNED**
   (live "unknown champion" + missing-portrait risk), incl. **Duchess Lilitu (baseTypeId 4420), Donatello
   (9950)** + 70 others. Backfill from Gestal `baseTypeId` (seed-127 approach) as a committed seed, and
   **wire the backfill into `gestal-sync/sync.js`** so it stops drifting (seed 127 was point-in-time).
4. **Piece (c) — the JUDGMENT grade.** Score whether the model *ranks* teams correctly (calibration-free,
   A/B — the Thisbe<Duchess kind). Clean per-account data now sits in `run_reconciliations`.
5. **Wire `team-constructor` into the LIVE path** (after shadow validates). The live selector is STILL the
   old `selectTeam`. This is the real product goal.
6. **A-estimate (CB damage calibration).** `cb-damage-model` is calibrated for Nightmare ONLY + carries the
   Warmaster bug — needed to *predict* chests for un-run difficulties/teams.
7. **Reader bugs (bounded, NOT urgent — grading refuses <5-hero so no bad data):**
   (a) **positional damage-join** — damage is joined to heroes by SLOT INDEX (memory-address order vs
       file order); when they diverge it MISATTRIBUTES (seen on an Ice Golem run). Fix: join by identity
       (heroId/typeId). Real, intermittent.
   (b) **Xenomorph drop** — he's dropped from some CB captures specifically when he contributes ~0 (dies
       early). Couldn't reproduce this session (Brutal + Nightmare both clean). Needs a *bad-run* debug
       capture (`hero-debug.txt` is on) to root-cause; likely fix = build the CB list from the file's 5
       and attach 0 to the missing context rather than dropping him.
8. **Ledger entries owed (retention):** the grading system, the CB two-lane damage model, the Warmaster
   correction, the type_id systemic gap.

---

## Grading verdict on file (GuapoDonni, from `run_reconciliations`)
- **Brutal → ONE-KEYS** (Grandmaster top chest), proven twice. **Nightmare → best 87%** of the Ultimate
  one-key (34.1M; ~5.1M short). **Top difficulty one-keyed = Brutal; next target = Nightmare.** Nightmare
  runs vary wildly (12.3M guardian → 34.1M grandmaster) — the variance is whether Xenomorph gets going.

---

## Traps
- **Use the grading system; don't rebuild it, forget it, or hand-grade screenshots. Scope by account.**
- `team-constructor` = the selection foundation. `model-select.js` = dead. `selectTeam` = the old live path.
- **Warmaster is DEF-mitigated on CB** — fix the invariant before trusting `cb-damage-model`.
- The reader silently drops Xenomorph on ~0-damage CB runs (bounded by the <5-hero refusal — a 4-hero
  capture is a MISS, never grade it).
- **The two sides:** problem-definition (Side 1) vs tool-selection (Side 2). Develop + verify them
  SEPARATELY; when a team is wrong, decide WHICH side failed before fixing.
- **Process (all four slipped this session — the gate to hold):** SURVEY what already exists before
  building; validate in SHADOW before live; don't decide/act without asking; don't claim "done/verified"
  before actually testing. Before building anything, state in one line what you checked and why new-vs-extend.
- repo PUBLIC + committed to `main`, NOT pushed.

## How to resume
```
cd repo
cat knowledge/HANDOFF_2026-07-18_grading.md              # this
cat knowledge/DEEP_BLUE_STATUS.md                        # ⭐ GRADING SYSTEM section (use it)
node --env-file=.env.local tools/watch-reconcile.mjs     # auto-grade every capture (run alongside the reader)
node --env-file=.env.local tools/shadow-cb.mjs           # CB shadow selection (anchor = the obvious team, 5/5)
# grading verdict: query run_reconciliations WHERE display_name=<acct> AND content LIKE 'Clan Boss%'
```
