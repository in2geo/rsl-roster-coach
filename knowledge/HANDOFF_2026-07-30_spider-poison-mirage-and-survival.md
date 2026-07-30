# HANDOFF — 2026-07-30 — Spider-13: the poison-activation mirage, and survival is the wall

> **COLD-START: read this first, then `knowledge/SPIDER13_BASELINE.md` (the frozen baseline + two-tier
> validation + defect queue), then memory `spider-swarm-control-turn-economy-2026-07-30`. Everything below is
> COMMITTED on branch `session/qa-rungs-2026-07-23`. Pushed through `44c6975`; `51e896b` is committed but
> UNPUSHED (push when ready).**

## One-line state
A single confirmed bug — `activatePoisons` bypassed Skavag's 90% poison reduction — was killing the boss ~70t
early and producing a **false 68% win rate**. Fixed it: **WR 68%→2%, median turns 112→~170t (reality ~181t),
poison→boss 1.46M→718k.** The correct boss pace exposes the real problem: **the team can't survive a real-length
Spider fight because the sim doesn't control the swarm or maintain protection.** Turn count now matches reality;
**survival is the WR-critical defect.**

## The bug + fix (the headline)
`lib/sim/engine.js` had TWO poison paths and only ONE applied Skavag's "Healing Assured" 90% reduction:
- `tickDots` (natural tick) — applied `bossPoisonFactor` (0.10) ✓
- `activatePoisons` (Ezio A2 force-detonate) — did NOT ✗ → detonated boss poison at FULL damage.
Since the boss is always under 4+ debuffs, Ezio activated it constantly → ~2× inflated boss-poison, credited to
Bambus (the poisoner). **Fix: add `bossPoisonFactor` to `activatePoisons` (parity with tickDots).** Dragon
factor=1 → byte-identical; golden + snapshot pass. Commit `44c6975`.

## Commits this session
- `8478e03` feat: 3-pool shield model (`Equipment`/`Shield`/`Magma Shield` coexist; equipment=Shield/Bolster/
  Divine gear at round start) + shield-aware "easiest to kill" targeting (`hp+shieldPool`). Dragon WR 70→93.
- `44c6975` fix: the poison-activation bug above + `knowledge/SPIDER13_BASELINE.md` + 10 probes.
- `51e896b` (UNPUSHED) data: detailed-review Stage-13 victory capture into `data/manual-captures.json`.

## THE UNIFICATION — one root, many faces
Reality wins Spider-13 by a **long controlled grind (~181t), protecting the team and denying the swarm's
actions**; the sim was winning by a **fast poison race**. With the poison bug fixed the race is gone and the
sim loses 98%, because it never establishes reality's mechanism. All of these are the SAME swarm-control root:
- **Survival:** sim over-takes EVERY champ 2.6–8.6× (uncontrolled swarm hits everyone). Reality's team takes
  little because the swarm is slowed/petrified and shields are maintained.
- **Boss dies too fast (pre-fix):** the swarm over-fuelled Bambus's poison-dump; plus the activation bug.
- **Boss-damage attribution:** reality Pelops 40% / Ezio 28% / Bambus 25% (HP-Burn-splash + Magma reflect +
  poison); sim over-credits Bambus poison, under-fires Pelops HP-Burn-splash (sim ~5% vs reality's lead vector).
- **Targeting inverted on Bambus:** sim makes Bambus the HIGHEST-taken (80k); reality the LOWEST (4–8k).

## Reality anchors (TRUST — hand-verified)
Detailed Stage-13 WIN (`data/manual-captures.json`, capturedAt 2026-07-30): **164t, 5/5 survive.**
Per-hero TAKEN: **Bambus 4,364 (LEAST) · Ezio 4,439 · Tagoar 24,031 · Vergis 24,016 · Pelops 45,659 (MOST,
44.5%, via Taunt).** DEALT: Pelops 1.43M · Ezio 1.00M · Bambus 879k · Tagoar 207k · Vergis 59k. Boss-damage
split ≈ Pelops 40% / Ezio 28% / Bambus 25%. Mechanics seen: multiple simultaneous shield categories + Ally
Protection + Continuous Heal; **Petrification turning spiderlings grey (action-denial)**; Slow/Poison/HP-Burn
coverage; HP Burns surviving to activate. Reality Spider-13 ≈ **71–73% WR, ~181t median** (16 hand-verified
Victories; Bambus-taken spans 0–30k, median ~8k).

## Two-tier validation (Mike's framework — ADOPTED)
- **Product:** WR within tolerance + no clear/fail classification error. Spider-13 = **FAIL (2% vs ~71%)** —
  the 68% was a bug mirage.
- **Fidelity:** turn count / target distribution / dealt-taken / control-uptime / protection-uptime in band.
  Spider-13 = FAIL, but **turn count now GOOD (163–174t vs 181t)**.
- **Process:** freeze baseline; fix ONE confirmed defect at a time; rerun the SAME seeds (1–60); compare BOTH
  WR and shape; do NOT tune toward 181t via constants — fix mechanisms. Goal: **"win the way reality wins."**

## Defect queue (priority)
1. **SURVIVAL / SWARM-CONTROL (WR-critical, do next).** Per the reality feedback's order:
   a. **Killability targeting** that AVOIDS well-protected champs: `(HP + all shields + projected healing) /
      (expected damage after Ally Protection)`. Must reproduce Bambus/Ezio being skipped, Pelops pressured.
      (We have shield-aware `hp+shieldPool`; still missing the `/expected-damage` divisor, healing term, and
      the effect only bites once shields are actually maintained.)
   b. **Swarm control as TURN-METER denial, not a damage %** — Petrification/Slow must remove spiderling
      actions (Petrification already skips the turn; the gap is COVERAGE: sim ~5% petr / ~7–12% slow vs reality
      ~30% petr / near-all slowed). This cascades into shields surviving + stable targeting.
   c. **HP-Burn-splash coverage** — Pelops's missing ~40% boss-damage share (sim ~5%). Needs spiderlings
      attacking Pelops (taunt) and surviving to tick before consume.
2. **Ally Protection redirect recipient** — the feedback says transferred damage is assigned to VERGIS; the sim
   spreads it among the other AP-holders (Vergis is excluded as caster). Verify vs his card.
3. **Boss-damage attribution gate** — build a check that Pelops 40% / Ezio 28% / Bambus 25% holds.

## CLOSED leads — do NOT re-investigate (verified faithful/dead-end)
- **Protection lifecycle** — mechanics faithful (pickSkill prioritizes A2; Bambus A2 extends AP 2→3t; not a
  death-spiral, Vergis alive 87%). Low AP coverage is turn-starvation, not a bug.
- **Booked cooldowns** — DEAD END: Vergis is an Epic at 4★/L40 (unbooked) → base cds correct; sync has no book
  field.
- **"Round stall"** — NOT a bug: "Round 1 of 1" means Spider is a single round, so "at start of Round" buffs
  (Ezio veil, Shield gear-set) fire ONCE and expire = FAITHFUL. Sustained protection comes only from re-cast
  actives.
- **DoT separation** — CORRECT: Poison ticks target-only (no splash, engine.js:420); HP Burn splashes to all
  allies (427-429). Spiderling poison reaches the boss ONLY via Bambus's dump (transfer), not a splash.
- **Poison in target score** — the sim's targeting does NOT count DoTs (correct). Buff durations tick on each
  recipient's own turns (correct).

## Tools built this session (all observe-only, in `tools/`)
`sim-spider-boss-attribution` (boss damage by source+mechanic — found the poison bug) · `sim-spider-poison-sweep`
(reduction-factor sensitivity) · `sim-spider-control-scorecard` (aggregate WR/control/turn-share, win-vs-loss) ·
`sim-spider-protection-lifecycle` (AP coverage PER INCOMING ATTACK + cadence + extension) ·
`sim-spider-opening` (first-N-turns control establishment) · `sim-spider-a1-aoe` (Bambus A1 AoE-trigger trace) ·
`sim-spider-hp-trace` · `sim-spider-targeting` · `sim-spider-bambus-{picks,mitigation,shieldtrace,casts}`.
Baseline gate: `sim-per-hero-bands.mjs` (now has 16 Spider-13 reality Victories to check against).

## Discipline lessons (durable)
- **A "correct" aggregate WR can be a bug artifact.** The 68%≈71% "match" was produced by the poison bug; it
  masked a broken survival model. Always ask "is the model winning the WAY reality wins?" — see the two tiers.
- **Never conclude from one seed.** Seed-3 forensics (a loss) over-stated swarm control as "THE loss driver";
  the aggregate corrected it — then the poison fix re-corrected THAT. Reconcile vs aggregate + first-party.
  ([[reality-anchors-single-run-trap-2026-07-27]])
- Measure protection coverage PER INCOMING ATTACK, not per global turn (a buff that's up but not up WHEN a hit
  lands does nothing).
