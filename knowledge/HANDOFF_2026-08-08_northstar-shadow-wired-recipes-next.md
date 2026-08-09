# HANDOFF 2026-08-08 — North Star locked, shadow re-aimed at the Simulator (Dragon+Spider graded), RECIPES next

Session theme: a strategic reframe that finally names the goal in writing, plus **steps 1–2 of the roadmap**
executed. Branch `session/qa-rungs-2026-07-23`. **5 commits, COMMITTED but NOT pushed.**

## COLD START — read these IN THIS ORDER
1. **`knowledge/NORTH_STAR.md`** — THE GOAL. Read before touching anything modeling/prediction/architecture.
   (Also loaded every session: the ⭐ North Star section at the top of `CLAUDE.md`, and memory
   `north-star-simulator-is-the-stage-predictor-2026-08-08`.)
2. This handoff.
3. For the recipe work: `lib/sim/recipes.js` (recipe format), `lib/sim/interpreter.js` (the op vocabulary),
   `tools/sim-suite.mjs` (the grader that MEASURES recipe impact).
4. Memory `cb-ninja-escalation-hpburn-and-doublecount-2026-08-08` — the ⚠ double-count pitfall + the CB fixes.

## THE ONE-PARAGRAPH FRAME (so the goal is not re-derived — again)
The app = **team selection** (works, `selectTeam`) + **stage prediction = the SIMULATOR** (`lib/sim/` — the
turn-by-turn Model + RNG + masteries + arena). The Simulator IS the intended stage predictor; it is **not yet
wired to production**, and until this session it was **not wired to the shadow grader** either. The shadow
(`battle-suite`) grades the OLD, survival-blind contribution model (~38–44% balanced). **The Simulator beats it
decisively:** Dragon **62% vs 38%**, Spider **56% vs 47%** on identical captures. This session re-aimed the
shadow at the Simulator (step 1) and added Spider to it (step 2). **Next: RECIPES** — the fidelity lever that
lifts the sim-suite number across every graded dungeon.

## WHAT SHIPPED (5 commits, committed NOT pushed)
- `921fa21` **CB/Ninja sim fixes** — Escalation now stacks on CB (removed the per-round hit-set reset),
  per-hit HP-burn activation, A1 self-TM, `CB_WM_PROC_CAP.Normal = 70174`. Validated turn-by-turn from
  first-party CB Normal video. Ninja Normal 63% → ~100% of reality. Golden unchanged 56/10.
- `713827c` **step 1 (shadow re-aim)** — `sim-suite` gets `--brief`/`--no-history`/`--note` + a history+delta
  file; `watch-reconcile` runs it throttled+detached so the Simulator's number prints next to the old model's.
- `bcc73cc` **docs** — `NORTH_STAR.md`, `SYSTEM_INVENTORY.md`, and the `CLAUDE.md` ⭐ anchor.
- `7566fa2` **step 2 (Spider)** — `sim-suite` generalized to grade Spider too (per-dungeon dispatch + scoring).
- (this file) the handoff.

## DURABLE LEARNINGS
- The Simulator beats the old model on both dungeons — the whole turn-by-turn direction is proven with numbers.
- ⚠ **Per-hero effect-sums DOUBLE-COUNT DoT activations** (`creditDot` 'dot' + the 'activate' record). Use
  `state.cbDamageToBoss` / `state.cbLedger` as authoritative; exclude kind `activate`. This bit me hard.
- Warmaster is **~flat across difficulties** (Hard 67912, Normal 70174), not %MaxHP-scaled.
- The codebase "clutter" is mostly **built-but-unwired INTENDED systems**, not deletable junk — only
  `power-model.js` is confidently safe to delete (see `SYSTEM_INVENTORY.md`). Do NOT mass-delete.
- Team selection has TWO built-but-unwired replacements for `selectTeam` (role/problem model + archetype
  selector). Which is the real plan is a STRATEGIC decision (Mike), deferred — separate from stage prediction.

## NEXT SESSION: RECIPES — the plan
- **WHY.** Only ~9 champions have full recipes; every other champion runs the legacy `readSkillKit`/`applySkill`
  fallback (lower fidelity). Spider's weak loss-recall (94 false walls = predicts loss for teams that won) is
  largely this. Each recipe lifts the `sim-suite` number.
- **WHERE.** `lib/sim/recipes.js`: a `F_<NAME>_<slot>` formula (multiplier / multiplier_type / hitCount) + a
  `<NAME>-<slot>` recipe block (an `actions` list of OPS). Ops live in `lib/sim/interpreter.js`
  (ACQUIRE_TARGETS, DEAL_DAMAGE, PLACE_DEBUFF, PLACE_BUFF, FILL_TURN_METER, DEBUFF_ACTIVATION, HEAL, REVIVE,
  CLEANSE, EXTRA_TURN, PLACE_BOMB, …). This is the **finite mechanic vocabulary** — new champions mostly REUSE
  existing ops; only a genuinely new mechanic needs a new op (this session added per-hit HP-burn activation +
  the Escalation fix). Look at the NINJA-A1/A2/A3 + IUDEX + MICHELANGELO blocks as templates.
- **HOW TO ADD ONE.** Pull the champion's VERBATIM `skill_summary` from the DB first (source-of-truth rule —
  never invent; see the bad-bulk-corruption memory). Map each skill → a formula + a recipe block of ops.
- **HOW TO PRIORITIZE.** Query `run_reconciliations.team_fielded` for the champions MOST FREQUENT in captured
  **Spider + Dragon** battles that do NOT yet have recipes — those move the number most. (A quick script over
  the fielded teams, cross-referenced against the recipe registry.)
- **HOW TO MEASURE (the whole point).** `node --env-file=.env.local tools/sim-suite.mjs [--dungeon spider]`.
  It's DETERMINISTIC for a fixed N. Baseline → add a recipe → re-run → the balanced-accuracy / per-dungeon line
  moves. That is the loop working. Start with `sim-suite 10 --dungeon spider` for a stable Spider baseline.

## OPEN THREADS (ranked)
1. **RECIPES** — the step-2 fidelity grind (next session). Prioritize by frequency in captures; measure with
   `sim-suite`. Biggest lever on both Dragon and Spider at once.
2. **Clan Boss grader** — CB is a DAMAGE RACE, not win/loss, so `sim-suite`'s binary oracle doesn't fit. Needs a
   **chest-tier oracle**: run the CB sim (`tools/sim-clan-boss.mjs` machinery) → banked damage → chest tier vs
   the captured chest (reconciler already grades CB on a chest axis). A parallel `cb-suite`.
3. **Ice Golem / Fire Knight** — enemy tables exist but NO sim content modules
   (`makeIceGolemContent`/`makeFireKnightContent` don't exist). Build the boss kits before they can be graded.
4. **Eventually:** step 3 (swap the Simulator in as the live stage predictor, replacing `computeVerdictBand`) →
   step 4 (retire old systems via git).

## GOTCHAS
- Branch `session/qa-rungs-2026-07-23`; **5 commits COMMITTED, NOT PUSHED.**
- `data/qa-history.json` auto-appends on QA runs — leave UNCOMMITTED (telemetry noise).
- `sim-suite`: deterministic per fixed N (seeds 1..N); history appends only on a move. Watcher runs N=10 over
  ALL supported dungeons (~4,700 battles/pass, throttled+detached, `simRunning` guard prevents overlap).
  `--dungeon <substr>` narrows; `--no-history` for read-only. It touches nothing else — safe to iterate.
- CB/Spider sim content modules exist (`clan_boss.js`, `spider.js`). Spiderling **acc = 75** (the DB add-row's
  100 is the in-game "suggested resistance" number, NOT accuracy).
- Skill-data source-of-truth: verbatim `skill_summary` from the DB before any recipe (bad-bulk skill names are a
  known corruption source). raid.guide / AyumiLove for verbatim numbers, human-read only.
