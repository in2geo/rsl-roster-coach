# Next-session handoff — cold-start runbook

**Purpose:** get a fresh session productive on the agreed tasks in the first 10 minutes.
Pairs with `knowledge/DEEP_BLUE_STATUS.md` (the *what/why*); this is the *how/do-next*.
Written 2026-07-15 at the end of a long session. Nothing below is wired to prod.

---

## 0. Orient (first 5 min)
1. Read `knowledge/DEEP_BLUE_STATUS.md`, then skim `knowledge/insights-ledger.md` INS-0014→0017.
2. One-line state: **the evaluator is real for the KILL side (calibrated to real battles) and
   half-built for SURVIVAL; it is NOT wired into the live recommendation.**
3. Agreed next action: **Track 1 · Step 1 — calibrate the survival side** (below), unless Mike
   redirects. Track 2 + the watchdog ship can run in parallel.

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

### Step 1 — Calibrate the SURVIVAL side  ◀ START HERE
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
- **Automate reconciliation.** Capture is abundant (398 raw, ~87/day) but only 48 reconciled in
  one batch — reconciliation is the bottleneck. Make `tools/reconcile-runs.mjs` run continuously
  / drain the backlog so MEASURE stops starving. (Higher leverage than any capture-friction work.)
- **Extend the reader's per-champ damage decode to dungeons.** Confirmed reader-wiring gap: the
  hero schema has `damage` but it's null for 0/105 dungeon battles, populated only 4/16 Clan Boss
  (reader decodes the CB result dialog, not the dungeon result screen). Passive IL2CPP work,
  inside the read-only boundary. Unblocks kill fine-tuning + sustain calibration.

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

## 6. Definition of done for the next work block
- `tools/calibrate-survival.mjs` exists; survival is on the real-turn scale; the two-sided
  ceiling separates the win/loss boundary captures; INS-0018 recorded.
- (Parallel, if picked up) reconciliation drains the backlog; a reader plan for dungeon damage.
- Nothing wired to prod until shadow confirms. Update `DEEP_BLUE_STATUS.md` state line when done.
