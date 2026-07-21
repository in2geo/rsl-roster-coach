# Session Handoff — 2026-07-21: the model is a REIMPLEMENTATION, and it scores 52.9%

**COLD-START DOC. Read this first**, then `MODEL_AS_REIMPLEMENTATION.md` (the method) and
`GAME_MECHANICS_INVENTORY.md` (the backlog). Supersedes
`HANDOFF_2026-07-21_no-hard-lines.md` from earlier the same day.

**Everything is committed and pushed. `main == origin/main`, working tree clean, nothing pending.**

---

## ⏩ START HERE

1. **Start the stack:** `& 'C:\Users\in2ge\OneDrive\Desktop\RSL-coach\repo\start-stack.ps1'`
   (full path, or `cd` to the repo first). `-Status` / `-Restart` / `-Stop` also work.
   ⚠ `-Status` warns if MULTIPLE reader processes exist — a stray diagnostic will show up there.
2. **Run the scoreboard:** `node --env-file=.env.local tools/battle-suite.mjs --by-dungeon`
   **Current: 204/324, balanced accuracy 52.9%.** Any change you make reports this number or it
   isn't evidence.
3. **Do NOT fit coefficients.** Implement mechanics. See the two hard rules below.

---

## 1. THE HEADLINE — what this session actually changed

Mike's reframe, agreed and now the project's organizing principle:

> **We are not building a recommendation heuristic. We are building a partial REIMPLEMENTATION of
> Raid's combat model, validated by replaying captured battles.**

That gives the project what it never had — a definition of done (reproduce observed battles), a
backlog (unimplemented mechanics), and a falsifiable metric.

**Why it kept zigzagging:** there was never a falsifiable SCALAR. Shadow tools and the reconciler
emit DESCRIPTIONS (rankings, medians, correlations) which can always be argued with, so every model
disagreement was settled by whichever framing was most persuasive that session. The one real scalar
(recommended vs actual stage) is **CENSORED** — 20 of 24 account×dungeon cells never pushed past a
win, so it cannot say "you got worse" in the over-prediction direction where the model is worst.

`tools/battle-suite.mjs` supplies the missing scalar. **This COMPLETES Deep Blue, it does not
replace it** — the loop was right, the MEASURE step was underspecified.

---

## 2. THE NUMBER — and it is bad, which is the point

```
204/324 battles reproduced
accuracy           63.0%   ← BELOW the 77.8% majority baseline
BALANCED ACCURACY  52.9%   ← coin flip = 50.0%
Spider's Den       47.8%   ← below chance
47 FALSE CLEARS (predicted a win, actually lost)
win recall 71.0%   vs   loss recall 34.7%
```

**We predict clears passably and are two-thirds blind to DEATHS.** That asymmetry is the unmodelled
survival side, now a number instead of an argument.

---

## 3. WHAT WE HAVE (built, working)

- **`tools/battle-suite.mjs`** — the metric. Balanced accuracy + majority baseline (so class
  imbalance can't flatter a change) + false-clear/false-wall split.
- **353 graded battles** in `run_reconciliations`, re-graded this session with alias-aware stats.
- **Real per-stage enemy magnitude wired** — `dungeon_stage_enemies` had been live since 2026-07-15
  and unread; `NOMINAL_BOSS_HP = 15M` is gone. Layer 2 now runs on all four scanned dungeons (it had
  NEVER run on them — both scan paths returned early).
- **Alias registry enforced** — `resolveOrThrow` / `resolveAll` / `buildRosterIndex` /
  `loadNameResolverRest`. `reconcile-runs` was writing NULL stats onto graded rows for any hero whose
  display name differed from `champions.name`.
- **Verified game data, verbatim, in `data/`** — `blessing-bonus-stats.json`,
  `great-hall-bonus-stats.json`, `arena-bonus-stats.json`. Tier-1, from in-game screens.
- **Blessing bonus stats IMPLEMENTED** (`lib/effective-stats.js: blessingBonus()`) — the awakening
  term. Correct, verified, and it moved the suite by ZERO (see §6).
- **Seeds 201-204 applied** — Self-Revive split, Enemy Max HP Damage split, Mike's rulings.
- **`GAME_MECHANICS_INVENTORY.md`** — three axes, the backlog.

---

## 4. WHAT NEEDS WIRING (built but disconnected — the chronic disease)

This project's failure mode is **built-but-unwired artifacts that die and get re-derived by hand.**
Five instances found in ONE day. These are still open:

| item | state | why it matters |
|---|---|---|
| **`battle-suite.mjs`** | standalone tool | **Until it prints on every reconcile it becomes the 6th dead artifact.** Wire into `watch-reconcile`/`loop.mjs`. THIS IS #1. |
| **`battle-gaps.js` / `assumption-audit.js`** | never called | Already found the team-min HP defect **10×** while I rediscovered it by hand. `tools/whats-missing.mjs` runs it manually. |
| **Per-round hero capture** | `ReadHeroStat` builds it, always empty | Reads `StatisticsByHero` AFTER the game clears it. This is phase-at-death. |
| **Booked-from-Gestal** | `isFullyBooked()` exists | Engine still uses a rarity GUESS; its own comment says "representation-only". |
| **Awakening / ascension / blessings / empower** | captured 100% | Blessings now implemented; the rest enter no formula. |

---

## 5. WHAT WE NEED TO GET (acquisition — mostly Mike)

**A. ONLY MIKE CAN GET THESE**
1. **Frontier runs at 21-25** — Spider and Fire Knight have NEVER been fought above 20/19.
   Uncensors over-predictions AND is the only way to exercise the %maxHP cap regime.
2. **Push a fixed team until it LOSES** — converts a censored ceiling into a two-sided boundary.
   We have 16 such boundaries; all are gap-1; only ONE touches stage 21+.
3. **Approve the 8 proposed %maxHP champions** — Mina, Cinda, Gamuran, Geomancer, Klaazag, Odin,
   Steel Bowyer, Hekaton.
4. **Fill the ❓ rows in `GAME_MECHANICS_INVENTORY.md`** from the game screens — this is the ONLY
   way to find a mechanic nobody has named (see §7).
5. **Answer: do Arena bonuses apply in PvE, or Arena only?** Decides whether Arena belongs in the
   dungeon model at all.

**B. READER / CAPTURE WORK**
- Per-hero dungeon damage — **BROKEN, not just missing.** The heap-scan contiguity premise fails
  (allies and enemies interleave). Needs the dungeon-dialog hero-list path.
- Debuff LANDINGS (31× in the backlog) · debuff chance/duration/auto_reliable (**76×, top item**).
- Phase-at-death — `--roundstats` probe INCONCLUSIVE. The battle FILE cannot hold it (measured: a
  ~100× increase in turns buys ~21% more bytes). Likely needs IN-BATTLE sampling at the existing
  100 ms poll.

---

## 6. THE TWO HARD RULES (do not skip)

**IMPLEMENT, DON'T FIT.** A fitted coefficient hides an unimplemented mechanic inside a constant and
makes it permanently invisible. ~144 "nominal" constants in `lib/` are unimplemented mechanics
wearing numbers. Fitting the 16 frontier boundaries was proposed and is the WRONG next move — it
would absorb awakening, ascension, blessings and wave composition into one scale factor and look
calibrated.
- VERIFIED GAME FACT that doesn't move the number → **KEEP** (the metric is blind to that axis).
- SPECULATIVE TUNING that doesn't move the number → **REVERT**.

**SURVIVAL IS A PREREQUISITE, not merely the biggest lever.** `incomingDamagePerTurn` is `null`, and
**65% of real losses happen while the kill side calls the fight comfortable.** Blessing bonus stats
were implemented correctly this session and flipped ZERO battles — because the kill side consumes
almost no stats, and blessings are mostly HP/ACC/RES which feed survival and land-rate. **Several
mechanics are unmeasurable until survival exists.** Build it first or you cannot tell success from
no-op. It needs the incoming-damage taxonomy first (%maxHP vs ATK-vs-DEF, the mirror of
`damage-mechanics.js` §1) — raw enemy ATK INVERTS the known per-content walls (INS-0016).

---

## 7. HOW TO FIND WHAT YOU DON'T MODEL

You cannot measure an unknown mechanic directly. Measure the **RESIDUAL** and read its structure —
an unexplained cluster is the shadow of an unmodelled mechanic. **DEMONSTRATED:** of 47 deaths the
kill side called comfortable, ~none are below stage 15 and 11+11 pile up at Dragon/IG 15-20.
*Something turns on at 15* that we cannot yet name. The model LOCALIZES; a human NAMES it.

⚠ **THE HARD LIMIT:** an unknown that affects everything UNIFORMLY creates no residual structure —
it gets absorbed into a calibration constant and becomes permanently invisible. That is why you
expand the DATA RANGE (frontier stages, new accounts, new patches) to make uniform unknowns vary.

⚠ **AND THE INVENTORY IS THE OTHER HALF.** Our only enumerated mechanics list
(`keyword-glossary.json`, 92 entries + 110 tags) covers ONE axis: battle keywords. **Awakening is
not a buff**, so that list was structurally incapable of containing it — along with ascension,
blessings, empower, gear-set effects and the masteries tree. Automated audits only find
known-unknowns. Walking the game screens is the only way to find the rest.

---

## 8. VERIFIED THIS SESSION (game facts, now permanent)

- **Faction Guardians** — per-FACTION × rarity, 5 CUMULATIVE chambers, ordered. Legendary: +10%
  HP/ATK/DEF, **+30 ACC/RES**, +10 SPD. ⚠ **PER-FACTION means it does NOT cancel in a comparison** —
  it can corrupt team SELECTION, the half we believed safe.
- **Blessings** — bonus stats are a pure function of (rarity × awakening level), cumulative, gated on
  a blessing being assigned. **This is the awakening term.** Legendary 6★ = HP +8500, ATK +750,
  DEF +600, C.DMG +38%, RES/ACC +75, SPD +15.
- **Great Hall** — per-AFFINITY, levels 0-10. **HP/ATK/DEF/C.DMG are PERCENT of base; ACC/RES are
  FLAT.** Has a second tab, **"Area Bonuses"**, entirely uncaptured.
- **Arena** — account-wide tier bonus, **HP/ATK/DEF ONLY** (no ACC/RES/SPD/C.DMG).
- **ACCOUNT-BONUS ARITHMETIC — 8/8 stats verified** on a GEARLESS champion (Avenger, Magic, Lvl 1,
  3★, no gear — so the bonus column can ONLY be account-level):
  `hp/atk/def/cdmg = base + base*(arena% + greatHall%[affinity])` ·
  `acc/res = base + greatHallFlat[affinity]` · then gear, blessings, guardians.
- **Gestal `baseStats` are RAW** — account bonuses excluded, flat AND percentage. Verified by a
  CONTROLLED test (Bambus's Great Hall boosts Magic/Force ACC +5 and not Spirit/Void; all 74
  champions export `acc 0`; and 74/74 `baseStats.hp` are multiples of 15 despite Arena's +1%).
  ⚠ Two earlier arguments for this were INVALID and are recorded as such in `estimate-stats.js` —
  "champion X matches the DB exactly" proves nothing unless that account HAS a bonus to bake in.
- **Ascension changes base stats** (Pelops: acc 0→10, res 30→50). Gestal is ascension-adjusted so
  it's free there; **`champions.base_*` holds MAX-ASCENSION values, so the MANUAL path — the
  SHIPPING path — over-credits every unascended champion.**

---

## 9. KNOWN DEFECTS RECORDED, NOT FIXED

1. **PHANTOM ACC.** `applyAccountBonus()` injects flat ACC +20 (fair) / +40 (good). Arena grants 0
   ACC; Great Hall grants ~+5 flat per boosted affinity; Guardians are unassigned on all 7 accounts.
   **Real ≈ 0-5, we inject 20-40** — ~3.7 Spider stages of invented headroom on the stat that gates
   content. Plausible contributor to 14-of-21 over-predicting cells.
   ⚠ Fixing it will NOT move `battle-suite` (the contribution model doesn't consume ACC) — it moves
   the LIVE verdict via `stat_threshold_checks`. That's a blind spot in the suite, not a reason to skip.
2. **Manual path uses max-ascension base stats** (§8) — live product bug.
3. **Team-min survival keys on the DISPOSABLE seat** — Fahrakin 10,027 HP sets the floor comparison
   while Tagoar at 24,157 decides the run. Seeds 199/200's p25 floors were fitted on that same
   statistic, so the defect is the STATISTIC, not the number.
4. **`--roundstats` probe inconclusive**; a per-battle full-heap scan is not viable in production
   anyway — locate once and cache.
5. **Seed 204 committed but NOT applied** (26 immunity/condition tag rejections, awaiting sign-off).
   Worksheet may already reflect them — worksheet/live may disagree on those 26 pairs.

---

## 10. GIT / ARTEFACT STATE

- **`main` == `origin/main` at `b2096d0`. Working tree clean. Nothing uncommitted, nothing unpushed.**
- ~45 commits this session, all pushed. The previous session's work (which had also never been
  pushed) went up too.
- Branch `session/stat-maps-gear-2026-07-20` is fully merged into main — safe to delete, harmless to keep.
- One worktree (the repo itself). The `claude/maxhp-tag-split` worktree was merged and removed.
- Master worksheet updated (policy #18) with backups: `BACKUP-2026-07-21-preSeed201SelfRevive.xlsx`,
  `-preMaxHpSplit.xlsx`, `-preSeed203Rulings.xlsx`.
  ⚠ **Two concurrent `openpyxl` writers nearly clobbered each other** (this session and a background
  agent, 60s apart). The workbook is a SINGLE-WRITER resource with no locking — one writer at a time.
- Live DB: seeds 199-203 applied. Seed 204 committed, NOT applied.

---

## 11. RECOMMENDED ORDER FOR THE NEXT SESSION

1. **Wire `battle-suite` into `watch-reconcile`/`loop.mjs`.** Until the number prints automatically,
   nothing below is measurable and the reframe hasn't taken.
2. **Wire `battle-gaps` into the reconciler.** Stop re-deriving known-unknowns by hand.
3. **Build the SURVIVAL side** — incoming-damage taxonomy first, then `incomingDamagePerTurn`.
   Expect loss-recall to move off 35%. This is the prerequisite for measuring anything else.
4. **Then** the phantom-ACC and max-ascension fixes (they move the live verdict, not the suite).
5. **Never** fit until the mechanics checklist has been worked through.

## 12. THINGS CLAUDE GOT WRONG THIS SESSION (check before repeating)

1. **"The keystone reviver decides the run" — 86W-0L.** A TAUTOLOGY. 99/101 losses are total wipes,
   so end-state `survived` just restates the result; "any champ alive" predicts identically.
2. **"Phase-at-death is in the battle file."** Measured: the file does not scale with battle length.
3. **"Coverage is the binding constraint."** Wrong — the model is wrong at stages we've fought heavily.
4. **"Gestal is raw because champion X matches the DB exactly"** — twice, on accounts whose Great
   Halls I had never seen. Invalid; a null result read as a positive one.
5. **"Great Hall ACC is a useless % of a zero base."** It's FLAT. Read the Help text, ignored the grid.
6. **Wrote a 12-row "mechanics checklist" from the conversation** instead of enumerating from the
   game — the exact circularity I had just described.
7. **Reported correlations as progress four times** without once asking whether more battles were
   reproduced. The suite exists because of this.

**Pattern: measure before claiming, and prefer the case where confounds are structurally ABSENT
(the gearless champion) over trying to control for them.**
