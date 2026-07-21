# Session Handoff — 2026-07-21: no hard lines, p25 floors, and the first Spider ground truth

**COLD-START DOC. Read this first**, then `HANDOFF_2026-07-20_stat-maps-and-gear.md` for the stat-map /
gear-tier work this builds on. Nothing here is committed or deployed; the working tree also carries a
large PRIOR uncommitted delta (pool-select, ledger, gestal-context) that is NOT this session's work.

---

## ⏩ START HERE

1. **Start the stack before anything else:** `& 'C:\Users\in2ge\OneDrive\Desktop\RSL-coach\repo\start-stack.ps1'`
   (app :3000 · reader · watch-reconcile · auto-profile-sync). `-Status` / `-Restart` / `-Stop` also work.
   ⚠ Run it by FULL PATH or `cd` to the repo first. **Confirm the account stamp** (`RslBattleReader.exe --whoami`)
   after any in-game account switch, or captures land on the wrong account.
2. **The single blocker is now unambiguous: the ABSOLUTE MAGNITUDE / contribution model** (INS-0031).
   Three independent routes proved it this session (§4). Everything else is downstream of it.
3. Do **not** re-try the two things in §6 — both were tested and reverted.

---

## 1. THE HEADLINE — no hard lines, anywhere

Mike's ruling, applied end-to-end: *"the game doesn't have any stat hard lines... the game just lets us
fail. We can't have any hard lines either."* Landed in `lib/match-engine.js`:

- **Killed the `confidenceThreshold: 80` cutoff** → `recommendBudgetPct: 55`, a soft *recommendation
  budget*. The scan returns the highest stage within budget; higher stages ride along as **`stretch`**
  with their confidence instead of being silently dropped. That cutoff was the real hard line — softening
  the stat floors last session just fed a lower number into a gate that still gated.
- **Coverage gaps are now SOFT.** They no longer clamp confidence into the 5-39% `one_goal_gap` /
  `multi_goal_gap` bands (which sat below the cutoff and silently lowered the stage). The band LABEL is
  kept for telemetry; confidence comes from gear + soft penalties. `COVERAGE_SOFT_PER_GAP = 0.25`, floor `0.40`.
- **`buildShortfallNotes()`** — every shortfall is surfaced by name: missing capabilities AND soft stat
  floors materially under. This is the "recommend the team + NAME what's missing" pattern.
- Soft-penalty ceiling **0.55 → 0.20** (a team at 22% of a *correct* floor must read as very unlikely).
- `shortfall_notes` + `stretch` plumbed through `matchRoster` → `api/match.js`.
  **⚠ `app.js` does NOT render them yet — they are API-only.**

**Boundary that matters (settled, §6):** *within* survival stats the combination stays **weakest-link** —
that is physics (you die from your lowest stat), not a veto. The veto to avoid is combining *different
axes* (stats vs capability) by `min`.

---

## 2. p25 FLOORS FROM REALITY — seeded and applied

`seeds/199_dragon_ig_p25_floors_from_reality.sql` + `seeds/200_spider_p25_hp_floor.sql` (both APPLIED).
Guessed floors replaced with the **25th percentile of teams that actually cleared** (`floor-from-reality.mjs`).
p25, not median, because half of any clearing population is over-built — fitting the median bakes in surplus.

| floor | was (guess) | now (p25 of real clears) |
|---|---|---|
| Dragon RES (all) | 250-300 | **40** |
| Dragon ACC 10-14 / 15-19 / 20-25 | 150 / 225 / 250 | **50 / 125 / 195** (best-carrier) |
| Dragon HP | *(none existed)* | **8k / 10k / 19k — ADDED** |
| IG HP 14-20 / 21-25 | 40,000 / 45,000 | **21,000 / 30,000** |
| IG RES | 200-210 | **40** |
| Spider HP 1-14 / 15-20 / 21-25 | *(none existed)* | **8k / 14k / 20k — ADDED** |

Notes: Dragon needed an **HP floor added** — it had none, so relaxing RES left nothing bounding a low-HP
team. IG ACC was deliberately left alone (p25 best-carrier was 273 > the declared 200 — not the problem).
Data strength: Dragon 20-25 n=49 and IG 14-20 n=57 are solid; **Dragon 15-19 (n=11, Bambus-heavy) and
IG 21-25 (n=2) are THIN**; Spider 21-25 has **zero clears in the corpus** and is extrapolated (a guess).

---

## 3. ⭐ FIRST SPIDER GROUND TRUTH — and the grade was VALIDATED

Don$Bambus climbed Spider on auto: **stages 7-13 all cleared, stage 14 DEFEAT. Ceiling 13, wall 14.**

Three 5th seats were run at **stage 13** with the same core four (Ezio/Tagoar/Bambus Fourleaf/Pelops):

| 5th seat | pool grade | reality |
|---|---|---|
| **Vergis** | **76.2** | WIN **289s** (fastest) |
| **Kael** | 71.9 | WIN 296s / 446s (slower, inconsistent) |
| **Fahrakin the Fat** | 71.3 | **LOSS** |

**Rank correlation is exact.** This is the most important measurement of the session: judged by **TIME**
(what CLAUDE.md actually judges by), a ~4-point grade gap tracked fastest-win → slower-win → loss.
**It partially supersedes the INS-0034 "the grade can't discriminate / coin-flip" framing** — that holds
for win/lose, but the grade *does* carry signal against clear time.

**Prediction vs reality is still bad on Spider:** model says **20-22**, reality is **13** (7-9 over).

---

## 4. THE BLOCKER, PROVEN THREE WAYS: no absolute magnitude model

Every proxy we have declines too gently, because none measures *output vs the stage*:

1. **Stat floors** — even p25-correct, they ramp softly. Bambus Dragon: model 24, reality ~15-16.
2. **Pool grade** — measures capability *fit*, not output. It sits at **~75-98% for every tier** on the
   same roster, so it cannot rank stages. (`pool-scan.mjs` over-recommends *because* of this.)
3. **The Spider tier gate** (removed, §5) — was accidentally supplying stage discrimination. Without it
   the curve is `13:77 → 14:76` — a **1-point drop where reality has a hard cliff**, ~1pt/stage overall.

**Nothing in the model knows "this team does X damage/turn vs the boss's Y HP and Z incoming damage."**
That is the contribution/magnitude model (see the `contribution-model-target` memory + INS-0031). Selection
layer, floors, and strategy gating are all now reasonable; **the magnitude gap is what's left.**

---

## 5. OTHER CHANGES LANDED

- **Spider strategy STAGE-GATE REMOVED** (`lib/spider-rubric.js`). `spiderStrategiesForStage` filtered on
  `s.stages`, so stages 1-14 and 21-25 returned exactly ONE strategy — the build-a-team-per-strategy-then-
  compare step had nothing to compare and the STAGE picked the plan, not the roster. **Justified:**
  `SPIDER_REVIEW.md` sources the tiers from a hand-read **AyumiLove** guide and lists them in its OPEN
  QUESTIONS ("Is the wall at 15 right?") — never confirmed; CLAUDE.md puts community dungeon-strategy
  opinion at **Tier 3, not a source of truth**. Now returns ALL strategies at every stage; `s.stages` is
  inert metadata for a possible future SOFT weight. **ACC = stage×10 is Plarium-sourced and untouched.**
  Result: team unchanged (still the fastest real clear), poison_explosion correctly ranks low (its team
  fields Fahrakin, who lost), curve became monotonic — but the generated stage drifted 20→22.
- **Strategy names de-opinionated** — "mandatory 21-25" and "the wall (AoE stops working)" removed; names
  now describe the plan, not when to use it.
- **`usabilityTier` is gear-aware** (`lib/match-engine.js`): `gear >= 3` → tier 2 at any level. Kael
  (Lv27, 5★, GOOD gear, poisoner) scored tier 1 and was **filtered out of the pool entirely** — invisible,
  though he demonstrably clears. Gear = real effective stats; Poison is level-insensitive (%maxHP).
- **Repair BUILD FLOOR is gear-aware** (`tools/pool-select.mjs`): `level>=50 OR gear>=2` (**fair**, not
  good — a good-only bar blocked Vergis (Lv40/fair) from being repaired back in and stranded the model on
  the worse team). Still excludes the zero-artifact case (Dark Elhain Lv40).
- **`tools/pool-scan.mjs` (NEW, prototype)** — stage-generating scan over the pool model: pool team + tier
  bucket coverage × per-stage stat floors → generates a stage with stretch + binding constraint. Works
  structurally; over-recommends for the §4 reason.
- **`tools/pool-select.mjs` CLI is now guarded** (`import.meta.url` check) so it can be imported.
- **Dev infrastructure:** `start-stack.ps1` (single-instance-safe launcher for all 4 services) ·
  `tools/auto-profile-sync.mjs` (daemon: Gestal → Supabase profiles, no terminal) · `lib/roster-import.js`
  (shared upsert, used by the daemon AND `api/import.js`) · `api/sync.js` + a "🔄 Re-sync Gestal" button
  (localhost-only). **7 accounts synced, 7 Supabase profiles** (DonThor + Don$Bambus were created).

---

## 6. TESTED AND REVERTED — do not re-try

1. **Reliability-weighted BLEND replacing weakest-link on survival floors.** Philosophically cleaner ("no
   veto inside a confidence number") but it **regressed**: Bambus IG 13→20, Dragon 19→24. **Survival IS a
   weakest-link property** — a great ACC cannot rescue fatally-low HP, and letting it lift the number
   over-recommends. It is floored at 0.20, so it is not a hard line. **Reverted.**
2. **Vetoing on the pool model's low/unfillable buckets.** `boss_damage` reads a **false 0%** from the
   known single-target-damage tag under-population, which cratered good stages. Use the **weighted grade**
   as the capability signal, never a raw bucket %. (Fixing the tag gap would make bucket-level signals
   trustworthy — see the `damage-tag-underpopulation` memory.)

---

## 7. WHERE PREDICTION STANDS (measured, end of session)

| account | content | model | reality |
|---|---|---|---|
| Don$Bambus | Dragon | 24 | cleared 15 (grindy, 5.7min); wall ~15-16 |
| Don$Bambus | Ice Golem | 13 | unknown |
| Don$Bambus | **Spider** | **20-22** | **clears 13, walls 14** |
| DonThor | Dragon | 25 | frontier ~23 (9W-4L at 23) |
| DonThor | Spider | 25 | **walls 17** |
| GuapoDonni | Spider | 13 | **cleared 20** |

Spider is wrong in **both directions across accounts** (DonThor over by 8, GuapoDonni under by 7) — the
signature of a missing mechanical/magnitude model, not a floor-number problem.

---

## 8. OPEN DECISIONS

1. **`usabilityTier` is SHARED with gen-1 `selectTeam`.** The gear-aware change moved Bambus gen-1 Dragon
   **19→24 (worse)** and Spider **24→20 (better)**. Keep it shared, or scope the gear relaxation to the
   pool model only? *(unresolved — Mike's call)*
2. **`TIE_BAND = 5`** in cross-strategy selection treats a <5-point grade gap as noise and defers to
   development. §3 showed a **4.3-point gap was real signal** — but that was *within* one strategy, where
   grades are directly comparable; across strategies (different bucket sets) the original rationale still
   holds. Worth re-checking against more data before touching.
3. **UI does not render `shortfall_notes` / `stretch`** — available in the API response only.
4. **Spider 21-25 floors are a guess** (zero clears in corpus). Spider generally needs the mechanical model.

---

## 9. NEXT STEPS (recommended order)

1. **Build the absolute MAGNITUDE / contribution model** (§4). Everything else is blocked behind it. Start
   from `lib/cb-damage-model.js` + `damage-mechanics.js`; the target is per-champion contribution →
   two-sided confidence (kill speed vs survival within the time budget).
2. **Resolve the `usabilityTier` scoping** (§8.1) — it is a live correctness question.
3. **Render `shortfall_notes` + `stretch` in `app.js`** so the "recommend + name what's missing" pattern
   actually reaches the player.
4. **Keep playing frontier stages** (near-loss), not farms — fast farms drop the 5th hero and don't feed
   the fits. Thin cells that most need data: DoT carriers at Dragon/IG 15-25, and **any** Spider 21+.
5. Gear-SET id map is still shifted (carried over from the previous session, unfixed).

---

## 10. Claude got these WRONG this session — check before repeating

1. **"The 4-point grade gap is noise."** Wrong — judged by TIME it tracked reality exactly (§3).
2. **"Kael worked instead of Vergis, so the model mis-picked."** Both won; **Vergis is faster**. The model
   was right; my "fix" briefly made it worse.
3. **Proposed dropping the Spider stage gate as my own idea** before reading `SPIDER_REVIEW.md` — CLAUDE.md
   has a HARD RULE to read the review first. (Mike independently called the gate opinion; the review then
   confirmed it. Right answer, wrong process.)
4. **Proposed "build one strategy-agnostic team"** — the pool model *already* builds a team per strategy
   and compares (`pool-select.mjs:364`). Mike corrected this.
5. **The blend** (§6.1) and **bucket vetoes** (§6.2) — both reverted.
6. Ran `.\start-stack.ps1` guidance without noting it needs the full path from outside the repo.

**Pattern: check whether it is already ruled/written down, and measure before "fixing" — twice this
session a change was made on a premise reality then contradicted.**
