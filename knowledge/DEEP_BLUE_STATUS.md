# Deep Blue — canonical status & continuity doc

**This is the START-HERE reference whenever Mike says "the Deep Blue model."** Read this
first, then `knowledge/insights-ledger.md` (INS-0001 … INS-0029) for the detailed thread.
Last updated: 2026-07-15.

> **⚠ PRODUCT DIRECTION UPDATED (2026-07-16) — read `knowledge/team-building-model.md` FIRST.** The
> product is now **role-based mechanic-solving + a result-driven loop** (each content = PROBLEMS × open
> ability-sets; team = 5 role-seats; diagnose the short seat from the battle → constrained re-solve;
> per-account). The power/kill/survival evaluator described below is **NOT the product** — it's just the
> survival half of one problem. Everything below is retained for the evaluator's calibration history;
> the current model + its layers live in team-building-model.md and INS-0026…0029.

---

## What "Deep Blue" means (the vision)

A builder-facing **modeling console**: Mike converses with the app to *improve the
deterministic recommendation engine* — like the AI that beats a chess grandmaster. Not a
chatbot for players. The engine (`lib/match-engine.js`) is deterministic code; an LLM only
writes explanations. Three commitments:
1. **A closed self-improvement loop** — real captured battles flow back and make the model
   measurably better.
2. **Durable retention** — insights are written down (the ledger) so nothing is re-derived.
3. **Validate before trust** — a change is proven against real data (shadow) before it drives
   what players see.

---

## The loop

```
   ┌─> PREDICT ──> CAPTURE ──> RECONCILE ──> MEASURE ──> PROPOSE ─┐
   │    🟡           ✅           ✅            🟡          ✅        │
   └───────────────────────  RETAIN ✅  <───────────────────────────┘
                    (durable ledger feeds back into PREDICT)

   CENTER — RECOMMENDATION ENGINE: the evaluator is REAL for the kill side
   (calibrated to real battles); the survival side is BLOCKED on data (INS-0018,
   not calibratable yet — nominal guardrail); it is NOT yet wired into the live
   recommendation. That amber center is the one structural gap.

   ✅ working    🟡 built but not wired / data-thin
```

| Stage | Status | Reality |
|---|---|---|
| **CAPTURE** | ✅ | RslBattleReader → 398 raw battles (to today), abundant. |
| **RECONCILE** | ✅ | `run_reconciliations` (48 rows), classification, spec-margin. |
| **PROPOSE** | ✅ | Proven this session: real data diagnosed DoT + calibrated the fix. |
| **RETAIN** | ✅ | `insights-ledger.md` INS-0001…0017 + scope docs. A real durable brain. |
| **MEASURE** | 🟡 | Scoreboard built (`tools/loop.mjs`); starved of **on-spec** runs. |
| **PREDICT** | 🟡 | Live engine still = coverage + placeholder floors + (new) soft-ACC + affinity. **The calibrated power model is NOT wired in.** |

**One-sentence state:** *the evaluator's kill side is calibrated to real battles; the survival
side was attempted (INS-0018) and found NOT calibratable on the current data — the loss captures
are kill-limited and enemy ATK isn't the survival wall — so survival stays a nominal diagnostic
guardrail and the evaluator still does not drive the recommendation.*

---

## The chess parallel (where we are on the arc)

Deep Blue's strength was an **evaluation function** that judged positions accurately and drove
its play. This whole work-stretch rebuilt ours — from "guess the stat floor" to a **damage /
survival model calibrated against real battles.** As of now: evaluator is real for kill,
half-built for survival, and **not yet driving the play** (the recommendation still uses the
old logic). We are one evaluator-half + one wiring step from the loop being fully green.

---

## Priority stack (Mike's sequencing, 2026-07-15) — the agreed plan

**Track 1 — close the evaluator and wire it (critical path):**
1. ~~**Calibrate survival** using the *loss* captures as anchors.~~ **ATTEMPTED 2026-07-15 →
   BLOCKED (INS-0018).** The 5 loss captures are KILL-limited, not survival anchors: every loss
   is the calibrated `ttk` OVER-crediting the loser's damage (real kill > realized turns), and on
   an enemy-ATK basis the model INVERTS the per-content wall (IG's wall is the Frigid-Vengeance
   mechanic spike, not ATK). Raw bulk even ranks the boundary backwards (tankier teams lost). Tool
   `tools/calibrate-survival.mjs` + `SURVIVAL_SCALE` (nominal, 1-anchor) exist; survival is a
   **diagnostic guardrail, NOT wire-ready.** REAL unblockers moved to Track 2: **per-champ dungeon
   damage capture** (to separate kill-under-performance from survival-exhaustion) and a
   **content-threat/mechanic-incoming term** (home: `lib/sustain-profiles.js` THREAT_PROFILES) +
   more losses (same-team stage sweeps). Until then, wire the KILL side + budget alone (step 3).
2. **Shadow mode** for a meaningful sample (old logic vs new model in parallel; players see old
   only; understand every significant divergence) BEFORE production. Scaffolding largely exists
   (`tools/shadow-construct.mjs`, team-constructor shadow, model-vs-winning-teams diff).
3. ~~**Wire it** once shadow confirms.~~ **SHADOWED 2026-07-15 → kill-alone is NOT safe (INS-0020,
   `tools/shadow-kill-floor.mjs`).** The kill floor NAILS kill-gated Ice Golem (18=reality) but
   OVER-recommends DoT content (Spider 25 vs won 19; FK 25 vs 12) because a poison/%maxHP team's
   turns-to-kill is STAGE-FLAT (damage scales with boss HP). Wiring it as the stage selector would
   flip Spider/FK from under- to OVER-recommendation (the worse failure). Safe ships now: the honest
   "push ceiling" second number, and/or trusting the kill floor only on demonstrably kill-gated
   content. General safe wiring waits on the survival side.

**Track 2 — fix the data gaps (parallel), REVISED by 2026-07-15 diagnostics:**
- **Per-champ damage = a reader-wiring gap, not friction.** The hero schema has a `damage`
  field but it's null for **0/105 dungeon** battles; populated only for **4/16 Clan Boss**
  (the reader decodes damage from the CB result dialog, not the dungeon result screen). Fix =
  extend the reader's dungeon result-screen damage decode (passive IL2CPP; within the
  read-only boundary). NOT a UI/submission change.
- **Capture is NOT the bottleneck — reconciliation is.** 398 battles captured (~20-90/day,
  87 today) but only 48 reconciled, in a single one-time batch. Fix = **automate reconciliation
  continuously** to drain the ~350 backlog into MEASURE. (Do NOT spend effort reducing capture
  friction — capture is abundant.)

**Near-term ships (no evaluator wiring needed):**
- **Ship the watchdog.** Logic is built + wired (every rec carries a `watchdog` result); the
  ship work is **surfacing it in the player-facing explanation + deploying.** It is *upstream of
  MEASURE*: watchdog → user trust → players field the recommended team → **on-spec captures** →
  feeds the starved scoreboard. A data-flywheel primer, not just a feature.
- **Start the AI-config annotation layer** for top Clan Boss champions — just the annotation
  data model + manual entries (e.g. Xenomorph), NOT the full resolver.

**Frozen until the evaluator is wired** (architecture-in-search-of-validation risk):
Layer 2 contribution model · AI-config resolver · sustain-mechanism weighting.

---

## What this session built (2026-07-15) — the durable deltas

- **Soft ACC floors** (INS-0014): degrade confidence vs hard-cap. Spider 4→7. *Wired, live.*
- **Boss affinity as real scored data** (INS-0015): `dungeon_stage_affinities` + weak-affinity
  confidence penalty. Spider 7→5. *Wired, live.*
- **Real per-stage enemy stats** — `dungeon_stage_enemies` (150 rows, all 4 dungeons; seeds
  131-135, migration 2026-07-15). The "image-locked" difficulty data — now real. *Data only.*
- **`lib/power-model.js`** — two-sided (kill vs survival). Kill side validated + calibrated to
  real turns (INS-0016, INS-0017). Survival: `survivalProxy` moved to team-sum EHP + `SURVIVAL_
  SCALE` anchored to the one clean fixed-team boundary — but found NOT calibratable / wall-inverting
  on current data (INS-0018), so it's a nominal guardrail. *NOT wired.*
- **`tools/calibrate-power.mjs`** — fits damage scale vs captured wins. Proved DoT is
  first-order; `DAMAGE_SCALE = 0.25` validates to median 1.0 (INS-0017).
- **`tools/calibrate-survival.mjs`** — survival fit + classification confusion + per-content
  wall-inversion check. Diagnosed the survival blocker (INS-0018).
- **Affinity in the kill model** (INS-0015 Phase 2): `champDamagePerTurn`/`turnsToKill`/`stagePower`
  take an optional `stageAffinity` and apply weak/strong hit factors to the ATTACK term. Safe (win
  calibration unchanged). Measured second-order on DoT-heavy losses. *NOT wired.*
- **DoT land-rate + uptime** (INS-0019): `champDotPerTurn` now weights Poison/HP Burn by ACC-vs-boss-
  RES land-rate × cooldown uptime — the measured driver of the loss over-prediction. Kill fit
  33→22 turns; `DAMAGE_SCALE` 0.25→0.30; IG-19 loss `ttk` 144→650 (correctly a kill wall). Land-rate
  leans on placeholder-looking boss RES (magnitudes nominal). *NOT wired.*
- Revive-sponge (Sun Wukong) explicitly **deprioritized as niche** (per Mike).

---

## Key artifacts (where things live)

- Engine: `lib/match-engine.js` · Power model: `lib/power-model.js` · Calibration:
  `tools/calibrate-power.mjs` · Loop/scoreboard: `tools/loop.mjs` · Reconcile:
  `tools/reconcile-runs.mjs`.
- Difficulty data: `dungeon_stage_enemies`, `dungeon_stage_affinities` (live; seeds 130-135).
- Captured battles: `gestal-sync/RslBattleReader/output/battle-log.json` (raw) →
  `run_reconciliations` (processed).
- Durable brain: `knowledge/insights-ledger.md` (INS-0001…0017) ·
  `knowledge/POWER_LAYER_SCOPE.md` (power-layer design) · this file.
- The loop diagram (visual): `knowledge/deep-blue-loop.svg`.

---

## How to resume next session

**→ Cold-start runbook with exact commands + first tasks: `knowledge/NEXT_SESSION_HANDOFF.md`.**

1. Read this file, then skim `insights-ledger.md` INS-0014→0017 (this session's arc).
2. The agreed next action is **Track 1 step 1: calibrate the survival side** against the loss
   captures — unless Mike redirects. Track 2 (reconciliation automation, reader damage decode)
   and the watchdog ship can run in parallel.
3. Nothing new is wired into live recommendations beyond soft-ACC + affinity — no prod risk.
