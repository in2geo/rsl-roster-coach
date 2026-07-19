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
| **3** | **pool / bucket allocation** | a team is a 100% BUDGET across named jobs; champions FILL buckets by measured delivery; grade = fill vs target | `tools/bucket-score.mjs` (CB), `lib/dragon-rubric.js`, `lib/fire-knight-rubric.js` |

---

## Status per content

| content | gen 1 | gen 2 | gen 3 | **PRIMARY** |
|---|---|---|---|---|
| **Clan Boss** | live | — | `bucket-score.mjs` ALLOCATION/BUCKETS + `cb-bucket-taxonomy-DRAFT.md` | **gen 3** (shadow) |
| **Dragon's Lair** | live | yes | `lib/dragon-rubric.js` | **gen 3** (shadow) — 14/19 on `shadow-grade-clears` |
| **Fire Knight** | live | yes | `lib/fire-knight-rubric.js` — TWO strategies | **gen 3** (shadow, 2026-07-19) |
| **Ice Golem** | live | yes | NOT BUILT — design in `dungeon-bucket-taxonomy-DRAFT.md` | gen 1 |
| **Spider's Den** | live (old 1-6 / 7-10 rows; 3-tier rebuild still `proposed`) | yes | NOT BUILT — structure ruled, no allocation | gen 1 |

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
| **stage-determined bands** | Spider | the STAGE selects the allocation; not a player choice |

Fire Knight: `TM-LOCK` and `SURVIVE` are explicit substitutes ("you need one, not both").
Ice Golem: three paths — DoT race / Block Revive / out-sustain.
Spider: 1-14 AoE nuke → 15-20 the wall → 21-25 AoE HP Burn.

---

## Testing one generation against another

`tools/rubric-ab.mjs` runs two criteria sets over the SAME captured battles through the SAME
clear-vs-wipe harness, varying only the rubric.

```
node --env-file=.env.local tools/rubric-ab.mjs          # Dragon rubric vs the generic CB rubric
```

**The standing test of record is `tools/shadow-grade-clears.mjs`** — "given teams actually fielded,
does the model rate the CLEARS above the WIPES?" Calibration-free: no damage model, no stat floors, no
difficulty axis. Baseline 14/19 (2026-07-19).

**Do NOT judge a criteria set by asking it to RANK working teams** (INS-0034). `shadow-grade.mjs` and
`shadow-grade-dragon.mjs` rank by clear SPEED, return ~coin-flip, and get misread as model failure.
Tags PICK; captures DIAGNOSE.

### Known limits of the A/B as it stands
- **One discriminating group.** Only DonBrogni Dragon 20 and Don$Gnut Dragon 20 have both a win and a
  loss. Everything else has no W/L pair, so the harness cannot separate rubrics that both handle those.
  **Losses are the scarce resource** — a stage where you win some and lose some is worth more than a
  dozen comfortable clears.
- **Best-of-N inflates.** `scoreBestStrategy` takes a max over strategies, so grades rise and
  clear-vs-wipe separation can shrink as strategies are added. Watch per content; if discrimination
  drops the fix is FEWER, MORE DISTINCT strategies.

---

## Where the SOURCE MECHANICS live (all generations depend on these)

`FIRE_KNIGHT_REVIEW.md` · `ICE_GOLEM_REVIEW.md` · `SPIDER_REVIEW.md` · `DRAGON_REVIEW.md` (repo root).
Verbatim boss kits, per-tier stat floors, affinity rotations, deferred items, open questions.
**`lib/dungeon-mechanics.js` is a SUMMARY of these, not a substitute — it omits numbers they carry.**
See the hard rule in `CLAUDE.md`.
