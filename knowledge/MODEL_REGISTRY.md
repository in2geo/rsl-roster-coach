# MODEL REGISTRY — the competing criteria, per content

**Purpose:** we have run several rounds of modelling on each dungeon and each round produced a
DIFFERENT set of criteria. They are deliberately **kept separate so they can be tested against each
other** (Mike, 2026-07-19), not merged. This file is the index: what generations exist, where each
lives, which is PRIMARY, and how to run one against another.

**Rule: nothing here is merged or deleted.** A superseded generation is still a testable alternative.
If a generation is retired, mark it retired and say why — do not remove it.

---

## The generations

| gen | criteria | how it decides | lives in |
|---|---|---|---|
| **1** | **goals × solutions** | each stage has GOALS; a goal is met if ANY solution's AND-set of tags is present; plus stat floors | DB: `goals`, `goal_solutions`, `stat_threshold_checks`, `boss_exceptions`. Sourced from the `*_REVIEW.md` packets → committed `seeds/*.sql` |
| **2** | **problem model** | each content = mechanical PROBLEMS × open ability-sets; `meta` flags the dominant path; exemplars carry activation conditions | `lib/dungeon-mechanics.js` |
| **3** | **pool / bucket allocation** | a team is a 100% BUDGET across named jobs; champions FILL buckets by measured delivery; grade = fill vs target | `tools/bucket-score.mjs` (CB), `lib/dragon-rubric.js`, `lib/fire-knight-rubric.js`, `lib/ice-golem-rubric.js`, `lib/spider-rubric.js`; recommended via `tools/pool-select.mjs` |

---

## Status per content

**Status refreshed 2026-07-20** from the first live play-testing session
(`HANDOFF_2026-07-20.md` §6). All five contents now have a gen-3 rubric and are testable
end-to-end: `pool-select.mjs` recommends → play → `watch-reconcile` grades →
`shadow-grade-clears.mjs` scores.

| content | gen 1 | gen 2 | gen 3 | **PRIMARY** |
|---|---|---|---|---|
| **Clan Boss** | live | — | `bucket-score.mjs` ALLOCATION/BUCKETS + `cb-bucket-taxonomy-DRAFT.md` | **gen 3** (shadow) |
| **Dragon's Lair** | live | yes | `lib/dragon-rubric.js` | **gen 3** (shadow) — the only content that VALIDATES |
| **Fire Knight** | live | yes | `lib/fire-knight-rubric.js` — TWO strategies | **gen 3** (shadow, 2026-07-19) |
| **Ice Golem** | live | yes | `lib/ice-golem-rubric.js` — THREE strategies (allocations PROPOSED, not yet ruled) | **gen 3** (shadow, 2026-07-20) |
| **Spider's Den** | live (old 1-6 / 7-10 rows; 3-tier rebuild still `proposed`) | yes | `lib/spider-rubric.js` — FOUR stage-gated strategies | **gen 3** (shadow, 2026-07-20) |

**⚠ "PRIMARY" means "our current best model", NOT "what users get."** Every gen-3 rubric is SHADOW.
The live recommendation path imports only `lib/match-engine.js`, which reads **gen 1**. Nothing from
gen 2 or gen 3 is wired, and nothing is deployed.

---

## Structural patterns (they are NOT all the same shape)

Discovered while building FK/IG/Spider — a gen-3 rubric takes one of three forms:

| form | contents | meaning |
|---|---|---|
| single allocation | Clan Boss, Dragon | one budget for the content |
| **player-choice strategies** | Fire Knight, Ice Golem | substitutable paths; score each, take the BEST FIT (`scoreBestStrategy`) |
| **stage-GATED strategies** | Spider | the STAGE gates which strategies are VIABLE; the model then takes the best fit among the survivors |

Fire Knight: `TM-LOCK` and `SURVIVE` are explicit substitutes ("you need one, not both").
Ice Golem: three paths — DoT race / Block Revive / out-sustain.
Spider: four strategies gated by `stages` via `spiderStrategiesForStage` — aoe_nuke (1-14),
maxhp_nuke (15-20), poison_explosion (15-20), hp_burn (15-25).

**⚠ CORRECTED 2026-07-20.** Spider was previously described here as "stage-determined bands — the
STAGE selects the allocation; not a player choice." **That is not what `spider-rubric.js` does.** The
stage GATES the candidate set and the model picks best-fit among what is left, so at **stages 15-20
THREE strategies are simultaneously viable** and `scoreBestStrategy` chooses. Spider is therefore
subject to the best-of-N inflation caveat below, which the "bands" framing implied it was exempt from.

---

## Testing one generation against another

`tools/rubric-ab.mjs` runs two criteria sets over the SAME captured battles through the SAME
clear-vs-wipe harness, varying only the rubric.

```
node --env-file=.env.local tools/rubric-ab.mjs          # Dragon rubric vs the generic CB rubric
```

**The standing test of record is `tools/shadow-grade-clears.mjs`** — "given teams actually fielded,
does the model rate the CLEARS above the WIPES?" Calibration-free: no damage model, no stat floors, no
difficulty axis.

**Baseline as of 2026-07-20** (was 14/19 on 07-19):

| content | score | |
|---|---|---|
| Dragon | **17/23 (74%)** | the only content that validates |
| Spider | 5/7 (71%) | improved from 1/3 by PLAY VOLUME, not by any fix |
| Ice Golem | 2/7 (29%) | |
| Clan Boss | 0/2 | |
| Fire Knight | 0/0 | untestable — no losses (and see the retreat bug) |

Read these as thin, not as rankings — several are 2-7 battles, and **losses are the scarce resource**
(below). Two caveats on the 07-20 numbers: one W/L pair is EXCLUDED (a retreat graded as a defeat —
`finishCause: "Retreat"` is captured but unused), and grades taken before the level-50 build floor
landed are NOT comparable with later ones, having been inflated by ungeared champions "filling"
buckets.

**The blocker these numbers point at is champion-VALUE / MAGNITUDE, not the allocations** — all three
Ice Golem strategies scored identically, and on Clan Boss the whole grade spread was 2 points across a
16% measured-damage spread (INS-0031).

**Do NOT judge a criteria set by asking it to RANK working teams** (INS-0034). `shadow-grade.mjs` and
`shadow-grade-dragon.mjs` rank by clear SPEED, return ~coin-flip, and get misread as model failure.
Tags PICK; captures DIAGNOSE.

### Known limits of the A/B as it stands
- **Few discriminating groups.** As of 07-19 there were only two (DonBrogni Dragon 20, Don$Gnut
  Dragon 20). The 07-20 session added more — notably **DonThor Spider 15 (a W/L pair) and Spider 17
  (the wall)** — which is where Spider's 1/3 → 5/7 came from. Still thin: contents with no W/L pair
  cannot separate rubrics that both handle them.
  **Losses are the scarce resource** — a stage where you win some and lose some is worth more than a
  dozen comfortable clears.
- **Gen 3 is missing terms gen 1 has, so the A/B is not yet apples-to-apples.** Gen 3 has **no
  affinity term** (gen 1 has `applyAffinityToConfidence` + `dungeon_stage_affinities`) and **no synergy
  term** (gen 1 reads `lib/synergies.js`). Leader aura WAS missing and was ported 2026-07-20 via the
  shared `pickLeaderFrom()`. Affinity looks first-order on clear time — same five champions on Fire
  Knight ran 96 turns at strong affinity vs 565 at weak — so **any cross-stage clear-time comparison is
  unreliable until it is modelled**, in either direction.
- **Best-of-N inflates.** `scoreBestStrategy` takes a max over strategies, so grades rise and
  clear-vs-wipe separation can shrink as strategies are added. Watch per content; if discrimination
  drops the fix is FEWER, MORE DISTINCT strategies.

---

## Where the SOURCE MECHANICS live (all generations depend on these)

`FIRE_KNIGHT_REVIEW.md` · `ICE_GOLEM_REVIEW.md` · `SPIDER_REVIEW.md` · `DRAGON_REVIEW.md` (repo root).
Verbatim boss kits, per-tier stat floors, affinity rotations, deferred items, open questions.
**`lib/dungeon-mechanics.js` is a SUMMARY of these, not a substitute — it omits numbers they carry.**
See the hard rule in `CLAUDE.md`.
