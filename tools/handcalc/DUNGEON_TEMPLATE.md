# Dungeon Calibration Template — the repeatable turn-by-turn playbook

The reusable process for calibrating **any** dungeon by walking an independent hand-calc against a real video,
generalised from the CB proof (2026-08-09). This is the *process* template; the *code* template (shared core
extracted from `cb.mjs`) is not built yet — until it is, **clone `cb.mjs` as the reference example.**

Canonical background: `knowledge/NORTH_STAR.md` §7, `HANDOFF_2026-08-09_*`, memory
`cb-handcalc-turn-by-turn-calibration-2026-08-09`.

---

## THE REQUIREMENT (Mike's, non-negotiable)

**The model computes EVERY SINGLE ACTION, in order, at a granular level.** For each action it determines: *who*
acts (turn-meter/speed order), *which* skill (the AI's real priority), *which* target(s), and the *computed
result*. The output is the **complete ordered action list** — nothing sampled, skipped, or collapsed. "Calibrated"
= **every action matches reality**, not that the totals or per-hero bars land.

**Aggregates are DERIVED, never the target.** Per-hero (dealt/taken/healed) and grand total are just **sums of the
actions**. Get every action right → the sums are right automatically. They are a coarser *lens* on the output, and
they can catch *some* errors, but they are NOT what we compute toward. Do not "get the aggregate close."

**Output granularity vs. verification granularity are DIFFERENT things.** The model always emits every action
(non-negotiable). What the unreliable data limits is only how thoroughly we can *inspect* that output: per-action
when a human reads a video, per-hero when only result screens exist. A data limit on *checking* is never a licence
to *compute* at a coarser grain.

## Principle (never violate)

- **Implement the real mechanics, don't fit.** Walk the video **per-action**. Every fix names a *mechanic*, not
  a tuned constant. A total can be right for entirely wrong reasons; a hundred actions can't.
- **The video-walk is the VERIFICATION of the every-action model — not a substitute for it.** The granular
  calculation is the product; the walk is how you confirm each action is right.
- **The human is the sensor** (no reliable automated capture — blobs uncracked, per-hero flaky). Verification is
  bounded, **one-time per mechanic**, and **champions compound across all dungeons**.

## What's reusable vs. what's the per-dungeon work

| Reusable (build once, use everywhere) | Per-dungeon (the actual work) |
|---|---|
| `stats.mjs` — champion effective stats | Enemy stat block (SPD/DEF/HP/RES/ATK) **from data** |
| TM scheduler | Enemy kit + **rotation** |
| **Champion kit library** (grows monotonically) | Wave structure / adds |
| DoT + damage formulas | Dungeon-specific mechanics (Scorch, shield, adds, purple bar…) |
| `TRACE=N` harness + reality-compare report | 1–3 real battle videos (from the player) |

The single biggest fact: **a champion's kit is identical in every dungeon.** Model a champion once and it's done
everywhere. Only the enemy side is per-dungeon.

## The process (per dungeon)

1. **Read the dungeon's `*_REVIEW.md` in full** (hard rule) + its cold-start memory chain.
2. **Ground the enemy stat block from DATA** — SPD/HP/RES from `*_stats` tables, not placeholders. (CB miss:
   guessed SPD 190 / DEF 3000 — both wrong. Build the enemy like you build the champions.)
3. **Model the enemy kit + rotation** — start from `*_REVIEW.md`; **the rotation is confirmed from the video**
   (CB's naive `turn%3` was wrong; the real cycle is Flesh Wither→Dark Nova→Crushing Force).
4. **Wire the team** from the roster snapshot (`gestal-sync/output/<Account>.json`; re-sync fresh first). Reuse the
   champion library; model any **new** champion's kit **verbatim from source** (`seeds/*.sql` / DB), not from memory.
5. **Get 1–3 real videos from the player** (result screen + turn-by-turn frames).
6. **Walk turn-by-turn (`TRACE=N`) against the video:**
   - **Pin boss DEF from direct hits**, NOT a back-calc (CB's DEF back-calc gave 3000; the hits said ≈0 and halved
     everything). A clean crit under known buffs solves for effective DEF directly.
   - Confirm the **rotation** and **DoT constants** (tick values + durations) against per-turn numbers.
   - Reconcile the **per-hero** dealt/taken/healed (catches cross-champion compensating errors).
7. **Fix the IMPLEMENTATION** where it diverges (enemy or a champion kit). Repeat until per-action match.
8. **Harden with a few DELIBERATELY DIVERSE teams** (poison / direct-nuke / control). Different mechanic classes
   exercise different mechanics — a pure-poison team **hid** the CB DEF≈0 bug because poison is DEF-independent.
9. **Retain:** write findings to memory **and PORT into `lib/sim`** (a finding stuck in the hand-calc is invisible).

## Checklist — what to pin per dungeon

- [ ] Enemy SPD (from data) · DEF (from direct hits) · HP · RES · ATK
- [ ] Enemy rotation (confirmed from video) + any Gathering-Fury-style escalation
- [ ] Dungeon mechanics (adds/waves/shield/%MaxHP escalation/etc.)
- [ ] DoT tick values + durations (confirm first-party)
- [ ] Champion kits: verbatim from source, clause-by-clause (`KITS.md` format), deferred clauses marked
- [ ] Leader aura (auras scale **base stat only**; e.g. Ezio +19% base SPD)
- [ ] Turn manipulators (self-TM / team-TM) wired and actually converting to turns

## Gotchas (each cost real time this session)

- **Don't fit** — Mike caught two fits (3-turn poison → it's 2; booked counter-poison → his champ was unbooked).
- **Ground enemies from data** — placeholder boss SPD/DEF was the biggest single error.
- **Verify kit facts from source** before trusting `KITS.md`.
- **Don't over-read screenshots** — ask when something looks off (a stray on-screen number burned an hour).
- **Poison/DoT teams hide direct-damage bugs** — always cross-check with a direct-damage team.
- **Per-hero catches cross-champion errors; only the video catches within-champion** (direct-over + DoT-under
  canceling inside one champ).

## Files

- `tools/handcalc/cb.mjs` — worked reference (clone until the shared core is extracted). Env: `TRACE=N`, `DBG=1`,
  `BOSSDEF=`, `BOSSSPD=`.
- `tools/handcalc/stats.mjs` — reusable effective-stats.
- `tools/handcalc/KITS.md` — kit-spec format.

## Not built yet (the code half of the template)

Extract `cb.mjs`'s **shared core** (stats, scheduler, champion kit library, DoT/damage, TRACE, report) from its
**per-dungeon plug-in** (enemy block, kit, rotation, waves) so a new dungeon is a plug-in, not a rewrite. Do this
during/after Dragon (the second dungeon is where the right seams reveal themselves).
