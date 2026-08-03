# HANDOFF — 2026-07-31 — Spider-13 opening TM model, the honest 64%, and the visual replay

## COLD START — read in this order
1. **This file** (the what-changed-and-why).
2. Memory: `spider-adds-untargetable-winrate-root-2026-07-31` (the WR root cause + this session's model).
3. `knowledge/model_table_spider13.txt` — turn-by-turn table (boss HP + per-hero HP + shields, threshold mode).
4. Open the **visual replay** (below) and watch a fight before touching anything.
5. `SPIDER_REVIEW.md` (repo root) for the boss kit; `CLAUDE.md` HARD RULES (implement-don't-fit).

## THE HEADLINE
Two Mike-first-party mechanics landed this session, and they matter more than the WR number:

1. **NOBODY ATTACKS SPIDERLINGS DIRECTLY** (the WR root cause). The team's single-target skills can only hit
   the **boss**; Spiderlings are untargetable by direct attack (die only to AoE / DoT / consume). Implemented as
   `state.addsUntargetableBySingle` (Spider `onPhaseStart`) → `interpreter.js acquireTargets` filters `role==='add'`
   out of the ally single-target pool. This is why Bambus A1's conditional-AoE fires (boss has 2+ debuffs 94% of
   the time), which blankets the swarm with [Decrease SPD], which lets the team survive. **0% → the honest 64%.**

2. **THE OPENING TURN-METER MODEL (verbatim from Mike, replaces a fitted charge hack).** Battle opens with
   EVERYONE at 0 TM. The **opening 6-spawn is a one-time turn-meter PULSE**: it advances team + boss BY THEIR
   OWN SPEED — `turnMeter = min(100, effectiveSpeed × (50/95))`. That lands the boss at **50%** and the team in
   pure speed order (Bambus 192→full, Tagoar 173→91, Vergis 166→87, Pelops 159→84, Ezio 148→78 — matches Mike's
   off-screen read exactly). The 6 opening spiders enter at **~90% TM**. **Every later spawn** (the 7th/8th on
   Bambus's turn-start, +2/ally-turn, +4 after her AoE) enters at **0 TM and moves nobody's meter** — normal
   ramp. After the opening she fills on her own SPD 95, no artificial charge.
   Code: `lib/sim/spider.js` `onPhaseStart` + `OPENING_TM_ADVANCE` (env `SIM_OPENING_TM_ADVANCE`, dflt 50/95),
   `SPAWN_SPIDERLING_TM_OPENING` (env `SIM_SPIDERLING_OPENING_TM`, dflt 90). Discrete-overflow scheduler in
   `engine.js nextActorDiscrete` (gated `state.discreteScheduler`).

## THE HONEST NUMBER: 64% (was a fitted 72%)
The earlier per-move/per-spawn "charge" was a **fitted constant** — it propped WR to 72% by hand-charging
Skavag's meter. Implementing Mike's real opening drops WR to **64%** (reality 77%, Δ13pp). **That is progress,
not regression** (CLAUDE.md: implement-don't-fit): the 72% was partly a charge-hack artifact masking an
unmodelled mid-fight mechanic. The charge code is DELETED. Do NOT re-introduce it to chase the number.
- REJECTED experiments (don't repeat): per-spawn TM pulse on EVERY spawn (over-boosts fast swarm → WR 24%);
  persistent charge (over-charges → 92t).
- Dragon golden **37/37** throughout (every Spider change is Spider-gated).

## VALIDATED-FAITHFUL (Mike captures — do NOT re-tune these)
- Consume heal = **3% × maxHP × n** → 10 eaten = **319,293** (his 319,292). ATK ramp **×2.0** at 10 eaten.
- Boss AoE (Stupefying Silk) per-champ hit sizes within ~25% (Bambus 0.94×, Ezio 0.70, Tagoar 0.76).
- **Ally Protection redirect is REAL** — Vergis Aegis = 50% [Ally Protection] on all-but-self; the boss AoE
  redirects ~50% of each ally's hit onto Vergis, absorbed by his shields (Mike confirmed the blue scrolling
  numbers). Per-hit right-sized; NOT a bug.
- Poison **sponge→dump chain WORKS** (team poison = 0 by her turn — all dumped to boss). HP Burn = **2t** (Pelops
  passive card, verbatim — his "4-turn" read was a refresh/misread).
- Bambus / Ezio / Pelops buff sets match reality.

## THE OPEN PROBLEM — the ~13pp gap lives MID-TO-LATE FIGHT, not the opening
Sim loses ~36% of runs; reality loses ~23%. Median turns ~210 vs reality **167** (boss dies too slowly —
consume heal-back restores 30% of her HP per consume, which is faithful, so the residual is elsewhere).
**Next move: pull a handful of the sim's LOSING runs, find what actually wipes the team, and check against how
reality survives those same moments.** (Reality victories: 26 captures, median 167t, range 131–211t.)
Minor known opening nuance NOT reproduced (small, ~2 poison stacks): reality has 2 of the late 4 spiders
overflow PAST the boss (she reaches full first but waits); sim has her act after only 6 spiders.

## OPEN QUESTIONS FOR MIKE
1. **Does the victory-screen blue "damage taken" bar count shield-absorbed damage, or only HP actually lost?**
   Resolves the Vergis "124k vs 25k" puzzle. Sim currently counts shield-absorbed in `combatant.taken`; that
   makes 3/5 champs match his screen but blows up Vergis (90k of his 124k is shield-absorbed AP redirects; his
   real HP loss is 34k ≈ reality). If the blue bar is HP-only, the sim over-counts taken.
2. **Gear is STALE** — Don$Bambus's Gestal export is ~2 days old. A true current-gear re-sync needs Mike to open
   Gestal → make Don$Bambus active → **Refresh** → then re-run `gestal-sync/sync.js` + `tools/build-from-sync.mjs`.

## ARTIFACTS / TOOLS (all persisted in-repo now)
- **Turn-by-turn table:** `knowledge/model_table_spider13.txt` — regenerate: `node --env-file=.env.local tools/sim-spider-hp-table.mjs`
- **Visual replay (interactive, self-contained HTML):** `knowledge/spider13_replay.html`
  - Live Artifact (current model, seed 2, VICTORY 216t): https://claude.ai/code/artifact/3f1548d8-9548-40df-8fe6-65e4fc457e1a
  - (older charge-model victory: https://claude.ai/code/artifact/1327cdef-8c26-4ba1-bd3e-996d2ee08db5)
  - Regenerate: `SEED=<n> node --env-file=.env.local tools/sim-spider-replay-export.mjs` → writes
    `knowledge/spider13_replay_seed<n>.json`; then inject into `knowledge/spider13_replay.template.html`
    (replace the `<script>\nconst DATA` marker with a `<script id="battledata" type="application/json">…</script>`)
    → `knowledge/spider13_replay.html` → Artifact publish.
- **Single-seed result:** `SEED=<n> node --env-file=.env.local tools/sim-spider-seed-run.mjs` (outcome + per-hero
  dealt/taken/HP-loss/deaths/revives).
- Probes (scratchpad copies, re-create as needed): slow-uptime, boss-debuffs, bambus-a1-target.

## QA STATE
- `node --env-file=.env.local tools/model-qa.mjs` → 18/19 green; only RED is `teeth (mutation)` (pre-existing
  test-coverage gap, 3 mutants uncaught — NOT a behavior regression).
- `tools/sim-golden.mjs` → 37/37, all Dragon fixtures WIN.
- `tools/sim-per-hero-bands.mjs 50` → Spider WR 64% / median 210t; Dragon WR 100% / 154t.
- Branch `session/qa-rungs-2026-07-23`, **uncommitted** (this whole session's spider.js/interpreter.js/engine.js
  changes are working-tree only).

## LESSONS
1. A "survival wall" can be a **targeting artifact** — verify WHO the team attacks before tuning mitigation.
2. A fitted charge can make WR look right for the wrong reason — implementing the real mechanic that LOWERS the
   number is the honest win. The gap it exposes is the actual next problem.
3. Single-screenshot reality reads are moments-in-time — reconcile against the aggregate + the mechanic.
