# Session Handoff — 2026-07-22: the turn-based simulator exists and beats the aggregate

**COLD-START DOC. Read this first**, then the three memories starred ⭐⭐⭐⭐⭐/⭐⭐⭐⭐ at the top of
`MEMORY.md` (turn-loop, auto-battle-AI, spider-targeting). Supersedes
`HANDOFF_2026-07-21_reimplementation.md` as the current front.

**All work is on branch `session/turn-loop-2026-07-22`, 6 commits, NOT merged to main, NOT pushed.
Working tree clean. The DB is UNTOUCHED — the migration and seed are files only.**

---

## ⏩ START HERE

1. **Start the stack:** `& 'C:\Users\in2ge\OneDrive\Desktop\RSL-coach\repo\start-stack.ps1'`
   ⚠ It launches the OLD watcher; `-Restart` picks up this session's battle-suite wiring.
2. **Gate 1 — does the sim obey its own spec?** `node tools/sim-selftest.mjs` (no DB, instant).
   **Must be 48/48 before touching anything.** This is Mike's rule: get it "running as intended"
   FIRST, compare to reality SECOND.
3. **Gate 2 — does it match real battles?** `node --env-file=.env.local tools/sim-dragon.mjs`
   and again with `SIM_SCORCH=always`. **Dragon 53.7-60.6% vs the 53.0% aggregate baseline.**
4. **The debugger:** `node --env-file=.env.local tools/sim-dragon.mjs --stage 17 --trace` —
   turn-by-turn actor / action / boss HP / every ally HP bar. **Trace one fight before theorising.**

---

## 1. THE HEADLINE — the reframe finally became code

Mike, verbatim: *"the game is called a turn-based game and we aren't focusing on the turns"*, and
separately he noticed the "reproduce the game" idea from an earlier session *"got folded into
something else and we are now back to it."* **He is right, and this is the correction:**
`MODEL_AS_REIMPLEMENTATION.md` said "build a partial reimplementation," but what got built was
`battle-suite.mjs` — a SCOREBOARD. The reimplementation was never started, so every session since
tried to improve the AGGREGATE against the new metric. **`lib/sim/` is the reimplementation the doc
actually called for.**

**Why the aggregate cannot work (proof, not opinion):** the same team at Spider stage 5 and stage 20
produces BYTE-IDENTICAL output (killTurns 41.805, confidence 0.730) while boss HP grows 38×, add HP
38×, enemy ATK 24.5×. For a %maxHP team `killTurns = bossHp / (teamDamage/turns)` cancels exactly.
**Seven stage-varying quantities sit in `dungeon_stage_enemies` and enter no calculation.** A ratio
cannot express a THRESHOLD, and every wall Mike describes is a threshold or an ordering.

---

## 2. THE NUMBERS

| | balanced acc | note |
|---|---|---|
| aggregate (battle-suite), Dragon | 53.0% | the baseline to beat |
| **turn loop, Dragon, SIM_SCORCH=never** | **53.7%** | optimistic bound (team always clears the purple bar) |
| **turn loop, Dragon, SIM_SCORCH=always** | **60.6%** | pessimistic bound (Scorch always fires) |

**Both ends of the bracket beat the baseline**, so the result does not depend on the one thing we
cannot measure (purple-bar HP). **Loss recall 19.2% → 46.2%** — the half the model has been blind to.
**No constant was tuned**; every gain came from more faithful mechanics.
Suite overall floor unchanged and still the top-level metric: **204/324, 52.9%.**

⚠ **60.6% is NOT stable.** The sim beats the aggregate while getting DAMAGE badly wrong (see §5), so
the number will move again once damage is real. It wins on STRUCTURE (turn order, CC, shields), which
is exactly where cliffs come from.

---

## 3. WHAT WAS BUILT (all committed on the branch)

- **`lib/sim/engine.js`** — the turn loop. Exact turn-meter advance `(100-tm)/spd` (no timestep),
  phase sequencing with HP/buff/**cooldown carryover** between waves and boss, DoT ticks at the start
  of the affected champion's turn (HP-Burn ally-splash emerges, not special-cased), shield-routed
  `dealDamage`, CC-skips-turn.
- **`lib/sim/ai.js`** — the auto-battle rules (`AUTO_BATTLE_AI.md`): furthest-right skill, revive
  LOCKED until a death, heal taxonomy (pure hoards / heal+buff fires at full HP), lowest-HP%
  targeting. Plus kit extraction from verbatim skill text.
- **`lib/sim/dragon.js`** — Hellrazor from `DRAGON_REVIEW.md`; Inhale→Scorch purple bar.
- **`tools/sim-dragon.mjs`** — gate 2 (replays 102 captured Dragon battles) + `--trace` + a QA
  turn-ratio distribution.
- **`tools/sim-selftest.mjs`** — GATE 1, 48 spec assertions, no DB. **Run this first, always.**
- **`battle-suite` + `whats-missing` wired** into watch-reconcile/loop so the number and the gap
  backlog print automatically. `battle-suite-history.jsonl` is a committed changelog of the metric.
- **Three knowledge docs:** `AUTO_BATTLE_AI.md`, `SPIDER_TARGETING_MODEL.md`,
  `INCOMING_DAMAGE_TAXONOMY.md`.
- **`migrations/2026-07-22_dungeon_stage_enemies_waves.sql`** + **`seeds/205_dragon_wave_composition.sql`**
  — Dragon wave composition, all 25 stages, champion_id-linked. **COMMITTED, NOT APPLIED.**

---

## 4. THE TWO BUG SPECIES FOUND TODAY (look for more)

**"Represented but not consumed"** — a mechanic is parsed/stored and then no code reads it. FOUR in
one afternoon: passives cast as actions (slot sort put "PASSIVE" first, no cooldown → won every turn
forever), shields parsed and never absorbing, CC applied and never costing a turn, ignore-clauses
parsed as placements (tag policy #16 reintroduced in new code). This is the CODE twin of the
CAPTURED-but-unused pattern (`spider-targeting-model-2026-07-22`): taunt, veil, ascension, books,
HP-Burn-splash were all already in the DB and consumed by nothing.

**Invisible-escape bugs** — the ignore-clause regex's `\b` became literal BACKSPACE (0x08) via shell
heredocs and silently matched nothing; looked correct in the file, `cat -A` showed `^H`.
**LESSON: edit source files with the Edit tool, not python/sed heredocs.** When a regex "does
nothing," `cat -A` it.

---

## 5. WHAT'S OPEN, RANKED (all measurable via gate 2)

1. **Damage is a placeholder, and it is the dominant remaining error.** `bossHit()` = `atk ×
   defMitigation(def)` with an implicit skill multiplier of 1.0, and `DEF_K = 1500` is a NOMINAL
   curve (real DEF diminishing returns are an unimplemented `formulas.js` TODO). QA turn-ratio:
   median 0.72, spread p10 0.41 → p90 1.34 — **WIDE, so there are SEVERAL structural causes, not one
   scalar.** Do NOT tune a single constant; slice the residual (by coeff-coverage / poison-carrier /
   stage band) and trace outliers.
2. **`damage_multiplier` is 38% populated**, free text in 3 formats, no `hits`/`targeting` columns.
   In the trace, Ezio/Xenomorph/Pelops/Tagoar deal ZERO direct damage. This is the extraction job —
   same LLM pipeline that regenerated the tag layer, lands as `proposed`.
3. **Purple-bar HP unknown** — collapses the 53.7-60.6 bracket to one number and makes Scorch fire on
   real failure instead of never/always. Not readable in-game; needs a source.
4. **Waves are UNMODELLED for combat.** `seeds/205` has composition but NO STATS (enemy stats are NOT
   readable in-game — only the LEVEL is). What IS derivable without applying anything: mob RES/ACC ==
   the BOSS's at that stage (verified identical add-to-boss in Spider AND Ice Golem), and mob kits
   via champion_id. A WAVE THREAT MODEL (which debuffs land on whom) needs no mob stats and targets
   Dragon's actual wall (CC pressure, INS-0021) — a scratchpad prototype already ran; not committed.

---

## 6. DATA FACTS ESTABLISHED TODAY (verified, don't re-derive)

- **Enemy stats are TRANSCRIBED, not synthetic.** seeds/131-135 headers, with cross-checks. A
  2026-07-21 memory wrongly called them a "synthetic ladder" — inherited and restated as fact for a
  day without opening the seed. CORRECTED in memory.
- **`stat = f(entity profile) × h(enemy level, stars)`.** add:boss ratios are EXACT constants across
  stages 1-20 (Spider add = boss ×0.04 HP / ×0.60 ATK / ×0.20 DEF; IG minion ×0.20 / ×0.333 / ×0.50).
  SPD is a per-entity constant that does NOT scale (Spiderling 150, Skavag 95, Hellrazor 100, flat).
  RES/ACC are shared encounter parameters (mob == boss). **⇒ one observation per wave mob
  reconstructs all 25 stages from the boss table we hold.**
- **Enemy LEVEL is the scaling driver and the only in-game-readable enemy stat.** Dragon boss levels:
  st1=7, st10=85, st16=200, st17=220, st18=240. **The DEF plateau at ~level 200-220 is the "something
  turns on at 15-20" the residual work flagged** — above it DEF stops scaling (~25×) while ATK keeps
  climbing ~20%/stage. Stars ALSO scale (1★@st1 → 6★@st16), a second variable not yet isolated.
- **Wave affinity ≠ boss affinity** — agree on only 12/25 Dragon stages, so a team can be strong vs
  the waves and weak vs the boss. Our model carries ONE affinity per stage.
- **Leader auras are applied AFTER `mapRoster`**, so every SPD I quoted this session EXCLUDES the
  aura. Bambus runs Ezio's +19% SPD → Pelops 141→168. **This unsettled the "Pelops SPD ≥ 151" Spider
  floor** — recorded as UNRESOLVED in `SPIDER_TARGETING_MODEL.md`. Always apply the aura before
  reasoning about turn order.

---

## 7. THE METHOD THAT WORKED (and the one that didn't)

- **WORKED: build the simulator, trace one fight, fix what's absurd, re-run gate 2.** Four real bugs
  in ~20 minutes. A turn loop is inspectable; an aggregate emitting 0.730 is not.
- **WORKED: two gates.** Spec-test first (gate 1), reality second (gate 2). Gate 1 caught a bug I had
  already "fixed." Debugging against reality with a broken implementation is what wastes afternoons.
- **DID NOT WORK: mining the corpus to DISCOVER rules.** Four hypotheses died this session (cleanse,
  ACC floor, reviver-affinity, Heal-Reduction-template) — all dissolved under the within-account or
  stage-confound check. The corpus is ~a dozen team configs replayed; ACC takes 11 distinct values
  across 323 battles. **It replays models well and discovers rules badly.** The productive channel is:
  Mike states a mechanic → print the prediction → he red-pens it. Always run the within-account check
  before believing an aggregate split.

---

## 8. RECOMMENDED NEXT SESSION

1. `node tools/sim-selftest.mjs` → 48/48, then gate 2 to confirm 53.7-60.6.
2. **Fix damage** — the dominant error. Slice the QA turn-ratio residual FIRST (don't tune a
   constant); the wide spread says multiple causes. Trace the worst stage bands (st24 0.36, st17/22
   0.51). Real skill multiplier + a real DEF curve are the likely structural fixes.
3. Then the `damage_multiplier` extraction (unblocks §5.2), and/or the wave threat model (§5.4, needs
   no new data).
4. Commit discipline held all session; keep tracing before theorising and gate-1 before gate-2.
