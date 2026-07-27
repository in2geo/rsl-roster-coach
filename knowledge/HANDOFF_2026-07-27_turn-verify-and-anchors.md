# HANDOFF 2026-07-27 — Turn-by-turn outcome verifier, the Petrification fix, the bad-anchor trap, poison attribution

Branch `session/qa-rungs-2026-07-23` — **pushed / in sync**, latest `78be580`.
Model QA ladder **16/16 green**. This session's commits: `97d9e13`, `285f47b`, `2e76625`, `d9ce06b`, `78be580`.

## One-line state
The sim was losing wave-2 far too often (~40% WR vs reality's ~90%). Root cause found and fixed:
**[Petrification] was landing but doing nothing** (0 skips). That was ONE real engine bug. The rest of the
session built the **turn-by-turn outcome verifier** Mike has asked for repeatedly — a gate that catches
"placed but silently inert" mechanics — and used it to (a) confirm 11 mechanics actually work, (b) expose that
a key "reality" number we'd been chasing was a **bad single-run anchor**.

## What shipped (committed + pushed)
1. **Petrification fix** (`97d9e13`, `lib/sim/engine.js` `expireDurations`): a reactive 1-turn CC placed on the
   attacking mob mid-turn was ticked 1→0 at that same turn's end and removed before it could skip. Guard:
   `if (e.type === 'Petrification' && e.placedTurn === CURRENT_TURN) continue;` — scoped to Petrification.
   Moved sim ~40% → **58.3%** WR. 8 regression tests in `tools/model-petrification-test.mjs`.
2. **Turn-by-turn outcome verifier**:
   - `tools/turn-verify.mjs` — CLI, one battle: per-turn ledger + turn-order check + outcome scorecard.
     Run: `node --env-file=.env.local tools/turn-verify.mjs [seed]` (`QUIET=1`, `TURNS=lo-hi`).
   - `tools/verify-core.mjs` — shared contracts (single source of truth).
   - `tools/model-turn-verify.mjs` — **QA rung**, 20 seeds, in the `model-qa` ladder. BLOCKS on a turn-order
     violation or a **systematically-inert mechanic** (placed with a live target/opportunity, 0 consequence
     across all 20 battles). Cross-seed aggregation avoids single-battle flukes.
   - Scheduler `state.onSchedule` hook in `nextActor` (verifies the max-turn-meter unit always acts — 0 violations).
3. **Outcome contracts — 11 mechanics now verified** (CC→skip · DoT→damage[tick/activate/explode] ·
   Continuous Heal→heal · Shield/Magma Shield→absorb · Reflect Damage→reflect · Ally Protection→redirect ·
   Taunt/Perfect Veil→targeting). Required new ledger events: `absorb`, `redirect`, `target`, and a `source`
   field on debuff placements (for the **self-applied-CC exception**: Bambus's self-[Sleep] is owner-controlled,
   0 skips is CORRECT, documented in `verify-core.mjs`).
4. **Bad-anchor fix** (`2e76625`): see the trap below.
5. **Poison attribution — credited to the POISONER** (`78be580`, `engine.js`/`interpreter.js`/`sim-trace.mjs`):
   Raid credits DoT to whoever PLACED the poison, not whoever triggers it (Ezio's A2 activation) and not
   'Poison'. Poison debuffs now carry `sources:{champion:stacks}`; `tickDots` + `activatePoisons` credit the
   owner(s) via `engine.creditDot`; Bambus's sponge/dump re-stamps ownership to Bambus (his redirect is HIS
   damage); per-hero DEALT sums `dot` events sourced to a champ. **Effect: Bambus 102k→477k (real 506k), Ezio
   110k→388k (real 333k), unattributed DoT 319k→86k.** PURE attribution — combat unchanged (hand-calc golden
   green, outcomes WIN 5/5). Snapshot re-blessed (EZIO-A2 ledger source), stale sponge mutant repointed.
   ⇒ **The sim's per-hero DEALT is now meaningful** (it WAS understating Bambus by ~5×), so it's no longer
   evidence the sim is "wrong on Bambus." Remaining 86k unattributed = **HP Burn** (Pelops's passive) — the
   identical `sources` fix is the obvious next step (would lift Pelops 123k→~259k).

## ‼️ THE TRAP (read this — it's the recurring trust failure)
The golden fixtures' `expected.per_hero` `taken`/`dealt`/`healing` are **ONE 2026-07-22 recording copied across
fixtures** — identical Ezio `taken:3509` / `dealt:332966` appear in a stage-16 AND a stage-17 fixture (the tell).
That run was atypical (Ezio's veil held all fight). **Mike, first-party: Ezio commonly DIES and is revived** →
he takes 16k+ regularly. The sim's Ezio (~21k, dies+revives) MATCHES reality; the 3,509 does not.
I chased a phantom "Perfect Veil is broken" bug against that number for most of a sub-thread before Mike caught it.
- Fix: `per_hero_representative:false` on all 3 fixtures + trace-oracle gates the "Perfect Veil NOT protecting
  him" verdict on it. Outcome/survivors stay the check.
- **Rule: trust the AGGREGATE (89.9% WR over 79 watcher battles) + first-party observation. NEVER a single-run
  per-hero copy.** Perfect Veil and Ezio's full passive (veil + 35% damage-nullify + 35% counter) are all modeled.

## Honesty note on "fixed"
Of the 11 mechanics touched, **only Petrification was actually broken.** The other 10 were already working — I
added verification (and for shields/reflect/AP/taunt/veil, the ledger events needed to *observe* them). Adding
a ledger event is closing an **observability** gap, not fixing behavior. Don't overstate this in future notes.

## Numbers
- Sim (committed, Petrification-only guard): **58.3%** WR (300 battles). Reality: **89.9%** (n=79).
- Loss shape still off: sim losses median ~83t (wave-2 wipes) vs reality ~140t (boss attrition).

## OPEN THREADS / next steps
1. **The duration fix (global) — the biggest lever, NOT committed.** Widening the guard from Petrification-only
   to `if (e.placedTurn === CURRENT_TURN) continue;` (any effect placed on a unit during its OWN turn — really
   just self-placed buffs + reactive debuffs) reaches **91.3% WR (matches reality)**. It is Raid-correct
   (durations count in the affected unit's own turns). BUT it regresses the QA suite: drifts the `shielded`
   snapshot + ~5 mutants, and flips the deterministic trace-oracle WIN→LOSS on `dragon16-current`. That flip
   is NOT a duration bug — it's the fix *correctly* extending Ezio's Perfect Veil (→ Vergis becomes the
   single-target death seat) surfacing on top of the pessimistic deterministic mode. To take it: re-run each
   mutant/snapshot shift, confirm it's a correctness improvement, re-bless deliberately (never fit-and-bless).
   Decision was left to Mike.
2. **HP Burn attribution** — the poison fix (#5) left ~86k of DoT still unattributed: it's HP Burn, placed by
   Pelops's passive on attackers. Apply the identical `sources` treatment in `tickDots`'s HP-Burn branch
   (credit Pelops incl. the splash) → lifts Pelops 123k→~259k. Small, mirrors the poison fix exactly.
3. **Batch 3 — the 14 remaining placement-only mechanics** (Increase/Decrease ATK/DEF/SPD/ACC/C.RATE, Enfeeble,
   Poison Sensitivity). These are pure stat modifiers with no discrete consequence event — they need a
   **consumed-at-point-of-use** instrument (assert the modifier is READ in effectiveScaleStat / statFactor /
   effectiveSpeed / effectiveAcc / landChance when its calc runs). Different tool than batches 1–2.
4. The turn-verify rung reports the `placement-only` count every run — that IS the honest coverage gap. "Green"
   means turn-order holds + the 11 outcome-verified mechanics aren't inert; it does NOT mean everything is verified.

## How to drive the verifier
- One battle, full detail: `node --env-file=.env.local tools/turn-verify.mjs 7`
- The gate (20 seeds): `node --env-file=.env.local tools/model-turn-verify.mjs`
- Full ladder: `node --env-file=.env.local tools/model-qa.mjs`
- Reality WR baseline: watcher `gestal-sync/RslBattleReader/output/battle-log.json` — Dragon-16 DonBambus = 89.9%.
