# Next-session handoff — cold-start runbook

> # ⚠ STALE TASK LIST — DO NOT COLD-START FROM THIS DOC (flagged 2026-07-19)
> Written 2026-07-15. It **predates the POOL MODEL** (2026-07-16 → 07-18) entirely, and its §2 Step 1
> still carries a `◀ START HERE` on **survival calibration — a task §0 of this same file says is no
> longer the plan and INS-0018 records as BLOCKED.**
>
> **Cold start from `knowledge/HANDOFF_2026-07-18_pool-model.md`** → `cb-bucket-taxonomy-DRAFT.md` →
> ledger **INS-0030…0034**.
>
> **What is still good here: §1, the environment cheat-sheet** (env vars, REST read pattern, seed
> apply path, engine-on-a-roster recipe). That is why this file is kept. Treat §§0, 2, 3, 6 as history.

**Purpose:** get a fresh session productive on the agreed tasks in the first 10 minutes.
Pairs with `knowledge/DEEP_BLUE_STATUS.md` (the *what/why*); this is the *how/do-next*.
Written 2026-07-15 at the end of a long session. Nothing below is wired to prod.

---

## 0. Orient (first 5 min)
1. Read `knowledge/DEEP_BLUE_STATUS.md`, then skim `knowledge/insights-ledger.md` INS-0014→**0018**.
2. One-line state: **the evaluator is real for the KILL side (calibrated to real battles). The
   SURVIVAL side was attempted 2026-07-15 and is BLOCKED on data (INS-0018) — it's a nominal
   guardrail, not wire-ready. The evaluator is NOT wired into the live recommendation.**
3. Agreed next action is NO LONGER "calibrate survival" — that ran and hit a data wall (INS-0018:
   the loss captures are kill-limited, and enemy ATK isn't the survival wall / it inverts the
   per-content wall). The live options now, in order:
   - **Track 1 · Step 3 — wire the KILL side + budget ALONE** (survival waits). Shadow first.
   - **Track 2 — the two survival unblockers**: per-champ dungeon damage capture (reader) + a
     content-threat/mechanic-incoming term (in `lib/sustain-profiles.js` THREAT_PROFILES) + more
     loss captures (same-team stage sweeps like the IG-18/19 pair). Also: automate reconciliation.
   - **Ship the watchdog** (surface `result.watchdog` in `lib/explain.js`). All parallel.
   Confirm direction with Mike.

---

## 1. Environment cheat-sheet (avoid fumbling)
- **Env**: secrets in `repo/.env.local` (`SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `SUPABASE_POOLER_URL`).
- **Read live DB (REST)** — the direct host is IPv6-only and fails; use REST. Pattern used all
  session (inline): load `.env.local`, `BASE = SUPABASE_URL without /rest/v1`, then
  `fetch(BASE+'/rest/v1/<table>?select=...', {headers:{apikey, Authorization:Bearer}})`.
  Helper: `tools/live_db_read.mjs`.
- **Apply a seed/migration**: `node tools/apply-seed-pooler.mjs <path>` (uses the aws-1 pooler).
  Hard rule: all content changes go through a committed `seeds/*.sql` — never write live directly.
- **Captured battles**: raw = `gestal-sync/RslBattleReader/output/battle-log.json` (398 rows,
  fields incl. `capturedAt, stage, result, turns, durationSeconds, heroes[]{name,damage,survived}`);
  processed = `run_reconciliations` table (48 rows, incl. `team_fielded`, `frozen_effective_stats`,
  `turns`, `successful`, `actual_floor`, `content`).
- **Run the engine on a real roster**: load snapshot `gestal-sync/output/DonBrogni_768ae0d91391eff5.json`
  → `gestal-context.buildUserChampions(snap.champions, db)` → `matchRoster(userChampions, '<key>', {supabase, accountDev:'fair'})`.
  Content keys: `spider | dragon | ice_golem | fire_knight`.
- **Recompute the kill calibration**: `node tools/calibrate-power.mjs` (should report scale
  median ~1.0, fit error ~33 turns — that's the current baseline).
- **Difficulty data (live)**: `dungeon_stage_enemies` (150 rows), `dungeon_stage_affinities` (100).

---

## 2. TRACK 1 — close the evaluator and wire it (critical path)

### Step 1 — Calibrate the SURVIVAL side  ⛔ BLOCKED — DO NOT START (was mislabelled "◀ START HERE")
**This ran on 2026-07-15 and hit a data wall — see INS-0018 and §6 below.** The loss captures are
kill-limited, raw bulk ranks the boundary backwards, and an enemy-ATK incoming basis INVERTS the
per-content wall. Method retained below for whoever unblocks it; the unblocker is **per-champ dungeon
damage capture** (§3), not another fit attempt.
**Goal:** make `turnsSurvived` land in the SAME real-turn units as `turnsToKill` (already
calibrated via `DAMAGE_SCALE`), so the two-sided `stagePower` verdict is valid.

**Why it's broken now:** survival is nominal + pessimistic (predicts Spider dies ~stage 9,
reality clears higher) and on a different scale (see INS-0016 "open"). `lib/power-model.js`
functions: `turnsSurvived`, `incomingPerRound`, `teamSustainMultiplier`.

**Anchors — the LOSS captures (deaths tell you where survival gives out):**
| content | outcome | turns |
|---|---|---|
| Spider Stage 11 | WIN 46 · **LOSS 156** | boundary pair |
| Spider Stage 20 | **LOSS** | 145 |
| Ice Golem Stage 18 | WIN 197 · **LOSS 119** | boundary pair |
| Ice Golem Stage 19 | **LOSS** | 195 |

The same-stage **win+loss pairs** (Spider-11, IG-18) are the decision boundary — the survival
model must explain why one lived and one died at the same wall. Work inward from deaths to the
boundary; don't over-fit the extreme losses.

**Method (mirror `tools/calibrate-power.mjs`):**
1. Pull losses from `run_reconciliations` (successful=false) with team_fielded +
   frozen_effective_stats + turns + content + actual_floor.
2. For each loss at stage S: the team survived ~`turns` rounds then died → model
   `turnsSurvived(team, enemies@S)` should ≈ `turns` (in the same captured-turn unit the kill
   side uses). Fit the survival scale / incoming / `SUSTAIN_TURN_GAIN` so this holds.
3. **Acceptance test (do NOT tune past this):** with survival calibrated, re-run the two-sided
   ceiling per capture — for WINS, `turnsSurvived ≥ turnsToKill` must hold at the stage they
   won; for LOSSES it must fail. And the binding wall should be **survival for IG, kill for
   Spider** (INS-0016). Report the confusion (wins predicted to die / losses predicted to live).
4. Keep magnitudes flagged nominal; commit the tool (`tools/calibrate-survival.mjs`) + an
   insight (INS-0018) like the kill calibration.

**Watch for:** unit consistency (captured `turns` = ally-turns, not rounds — the kill side
already absorbed this into DAMAGE_SCALE; keep survival in the same unit). Per-champ damage is
NOT captured (0/105 dungeons), so `turns` is the only signal — good for structure, not fine tuning.

### Step 2 — Shadow mode (before any wiring)
Run old-logic vs new power-model recommendations in parallel over a meaningful sample; players
see old only. Scaffolding exists: `tools/shadow-construct.mjs`, team-constructor shadow runner,
the model-vs-winning-teams diff in `tools/loop.mjs`. Understand every significant divergence
before committing. Expect ~2-3 weeks of sample; this protects against a hidden survival error.

### Step 3 — Wire it
Only after shadow confirms: route the two-sided power ceiling into `matchRoster` as the
recommendation FLOOR (see `POWER_LAYER_SCOPE.md` step 3) — tactical/ACC/affinity refine ABOVE
it, never below. Result: Spider moves off Stage 5 → PREDICT goes green. Re-validate every
captured clear first.

---

## 3. TRACK 2 — data fixes (parallel, no wiring needed)
- ~~**Automate reconciliation.**~~ ✅ **DONE 2026-07-18** — `tools/watch-reconcile.mjs` watches the
  battle log and reconciles each new capture. Run it alongside the reader. No backlog remains
  (621 captured / 190 graded as of 2026-07-19 — counts move with play, re-read rather than quote).
- ~~**Extend the reader's per-champ damage decode to dungeons.**~~ ✅ **DONE — verified against the
  live battle log 2026-07-19.** It landed in TWO stages and no doc caught either:
  | field | landed | coverage (169 dungeon captures) |
  |---|---|---|
  | per-hero `damage` | 2026-07-15→16 | 48 total, **100% of captures from 07-16 onward** |
  | `healing` + `defense` | 2026-07-18 (Release build 10:17) | **5** — 07-18 and 07-19 runs only |

  The "null for 0/105 dungeon battles" line was true when written on 07-15 and was overtaken within a
  day. **The remaining constraint is DATA VOLUME, not reader capability** — and it cannot be
  backfilled, since older captures never recorded these fields. Every new run adds to n.
  Worked example (Don$Gnut Dragon 20, 2026-07-19): team healing 929,294 vs damage taken 202,208 =
  **4.6× over-supplied** — the sustain-surplus ratio now computes straight off the capture.
  ✅ **`defense` = DAMAGE TAKEN, CONFIRMED 2026-07-19** (in-game bar legend: red dealt / blue taken /
  green healed), so the ratio is measured, not assumed.

## 4. NEAR-TERM SHIPS (no evaluator needed)
- **Ship the watchdog.** Logic built + wired (`result.watchdog` on every rec); ship work =
  surface it in the player-facing explanation (`lib/explain.js`) + deploy. Upstream of MEASURE:
  trust → players field the recommended team → on-spec captures.
- **Start the AI-config annotation layer** for top CB champs — data-model annotations + manual
  entries (e.g. Xenomorph). NOT the full resolver. (Reader can't read in-game AI settings — ask
  Mike for the settings of any run being validated; see the `ai-settings-manual-entry` memory.)

## 5. FROZEN until the evaluator is wired
Layer 2 contribution model · AI-config resolver · sustain-mechanism weighting.
(Building these now = architecture in search of validation. Wait for calibrated data.)

---

## 6. Definition of done — survival calibration block (DONE 2026-07-15)
- ✅ `tools/calibrate-survival.mjs` exists (reproducible fit + classification + wall-inversion check).
- ✅ INS-0018 recorded; `DEEP_BLUE_STATUS.md` + CLAUDE.md state lines updated.
- ✅ OUTCOME: survival is NOT calibratable on current data — the 5 loss captures are kill-limited
  (`ttk` over-credits the losers), raw bulk ranks the boundary backwards, and an enemy-ATK
  incoming basis INVERTS the per-content wall (IG's wall is the Frigid-Vengeance mechanic, not
  ATK). `SURVIVAL_SCALE` (7.25) is anchored to the one clean fixed-team boundary but is a nominal
  guardrail only. `survivalProxy` moved weak-link → team-sum EHP.

### Next work block (pick with Mike — see §0):
- Wire the KILL side + budget alone (shadow first) → Spider moves off Stage 5, PREDICT green.
- Survival unblockers: per-champ dungeon damage capture; mechanic-incoming term in
  `sustain-profiles.js`; more loss captures. Automate reconciliation. Ship the watchdog.
- Nothing wired to prod until shadow confirms. Update `DEEP_BLUE_STATUS.md` state line when done.
