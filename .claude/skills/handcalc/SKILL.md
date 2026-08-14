---
name: handcalc
description: Build (or continue) an INDEPENDENT, from-scratch turn-by-turn hand-calc for a dungeon stage — a clean-room re-derivation walked action-by-action against Mike's video, NOT the simulator. Invoke when Mike asks to "hand-calc", "do the real hand calculation", "walk the fight by hand", "dial in <dungeon> <stage> by hand", or run the hand-calc scaffold. Use this instead of touching lib/sim.
---

# Hand-calc — the from-scratch turn-by-turn playbook

**A hand-calc is DONE BY HAND, FROM SCRATCH.** It has nothing to do with the simulator. You are re-deriving the
fight independently and walking it action-by-action against Mike's video. This skill exists because this keeps
getting shortcut — follow it exactly; the shortcuts below are the failure modes, not options.

## HARD BANS (these are why it fails when skipped)
1. **Do NOT touch `lib/sim`** — this is independent of the simulator, both directions.
2. **Do NOT patch an existing hand-calc file** to "extend" it. Generate a NEW file from the scaffold.
3. **Do NOT fill an unknown with a tunable knob and fit it to the totals.** Every `⚙` is a QUESTION FOR MIKE.
4. **Do NOT state an inference as a measured fact.** If you derived it (e.g. "~3 Scorches"), say so; never call it reality until Mike confirms it from the video.
5. **Do NOT substitute recollection for reading** — actually open the reference files below, every time.

## STEP 0 — read the references (open them, don't recall)
- `tools/handcalc/DUNGEON_TEMPLATE.md` (the method) · `tools/handcalc/cb.mjs` + `tools/handcalc/dragon.mjs` (worked instances) · `tools/handcalc/engine.mjs` (the shared engine you build on) · `tools/handcalc/KITS.md` (kit-spec format).
- The dungeon's `*_REVIEW.md` (boss kit / rotation / stat floors) — CLAUDE.md hard rule.
- Memory: `dragon-st20-handcalc-mechanics-2026-08-14`, `cb-handcalc-turn-by-turn-calibration-2026-08-09`, `calibration-needs-confirmed-gear-per-run-2026-08-14`.

## STEP 1 — scaffold (do the setup that must never be approximated)
Run the generator — it pulls the team's kits VERBATIM + enemy stat blocks + affinity and writes a starter on the shared engine:
```bash
node --env-file=.env.local tools/handcalc/scaffold.mjs "<Dungeon>" <stage> "Name1,Name2,Name3,Name4,Name5"
```
It writes `tools/handcalc/KITS-<slug>-<stage>.md` (verbatim kits + open questions) and `tools/handcalc/<slug>-<stage>.mjs` (starter importing `engine.mjs`).

## STEP 2 — confirmed stats (apples-to-apples, per `calibration-needs-confirmed-gear-per-run`)
Fill `ROSTER` with the CONFIRMED CURRENT GEAR, not tier estimates: `node --env-file=.env.local tools/build-from-sync.mjs --memory "Name1,Name2,..."` (extract fresh gear first with RslBattleReader `--roster` + `--gear` if needed). Note each champion's real LEVEL (under-leveled champs matter). A capture can only calibrate if you know the stat block that run used.

## STEP 3 — author the kits VERBATIM (resolve every bracket)
From `KITS-<slug>-<stage>.md`, write one `if (n===...)` block per champion and the boss/mob kits — every clause MODEL or DEFER. Resolve each `[Bracket]` to its real effect (CC inert vs an immune boss; DoT capped on the boss; Decrease-DEF is a team-wide multiplier via `enemyDef`; Warmaster; per-placer DoT credit; poison detonation). Use `engine.mjs`: `hit`, `placePoison`, `detonatePoison`, `dealToAlly`, `runPhase`, `report`.

## STEP 4 — write the spec, get sign-off BEFORE the walk
Put the boss kit + the `⚙` open questions in front of Mike and get sign-off before treating any unknown as settled.

## STEP 5 — WALK it against the video, action-by-action
Mike is the sensor. Line up each boss action + HP% + death/revive against your run. Fix the MECHANIC where it diverges, never a fitted constant. Reconcile turns, per-hero taken/dealt (from the victory screen), Scorch/detonation counts, and the death/revive sequence. Ask for one known hit (value + crit/normal + buffs) to pin the champ→boss DEF curve.

## STEP 6 — retain
Write the confirmed mechanics to memory and (separately) PORT them into `lib/sim` — a finding stuck in the hand-calc is invisible to the stage predictor.

The champion's kit is identical in every dungeon, so each champion is modeled once and reused; only the enemy side is per-dungeon.
