# HANDOFF 2026-08-10 — In-battle timeline capture + the sim-calibration loop (and its first finding)

## TL;DR

We built a **live capture → simulator-calibration loop** and it works end to end. Every battle now
auto-captures an **in-battle timeline** (per-champ HP course, boss HP-over-time, per-kind debuff counts),
and `sim-suite --timeline` grades the **sim's boss-damage CURVE against captured reality** — the continuous
fight-SHAPE signal beside binary win/loss. On its first real run it found a genuine fidelity gap (Dragon-16
sim damage is **back-loaded**). ⚠ **The root cause is still OPEN** — my first attribution ("legacy applySkill
drops the aoe flag") was WRONG and retracted; see below. **Next session: keep calibrating with the loop —
find the real reason the sim's Dragon-16 wave phase runs ~2× too slow.**

Durable memory: [[in-battle-hp-sampler-built-2026-08-10]] (the pipeline + the finding + the retraction),
[[battlehero-live-object-offset-map-2026-08-10]] (the reverse-engineered offsets), and the North Star
[[north-star-simulator-is-the-stage-predictor-2026-08-08]].

---

## The calibration loop — how to keep going (this is the point)

1. **Capture** — run the reader in default (watcher) mode with the sampler now wired in; every battle
   auto-attaches a `timeline` to its `battle-log.json` entry. Longer, boss-heavy content (Dragon/CB) gives
   the richest curves. Space battles out (single sampler thread — back-to-back battles make the 2nd acquire late).
2. **Grade fight-shape** — `node --env-file=.env.local tools/sim-suite.mjs --timeline [--timeline-path <log>]`.
   For each captured timeline it runs the DETERMINISTIC sim (seed=null, EV) with a per-turn boss-HP recorder
   and prints the **boss-HP-curve MAE** (sim vs reality), the **wave→boss transition** point for both, and a
   DB-vs-captured **boss maxHP** sanity check. `--trace` adds the full turn log for the matched battle(s).
3. **Localize** — a high MAE + a mismatched wave→boss transition or curve shape points at a specific phase /
   mechanic. This is the CB hand-calc method, automated: the curve is OVERDETERMINED, so it localizes the error.
4. **Fix the mechanic, IMPLEMENT don't fit, re-grade.** The win/loss suite (`sim-suite` no-flag) stays the
   outcome metric; `--timeline` is the new SHAPE metric beside it.

Why this matters: win/loss balanced accuracy is UNDERDETERMINED (a sim can win with the wrong damage
rate/timing — errors cancel). The timeline loop grades the shape, catching rate/timing/mechanic errors
win/loss structurally cannot. That's the whole reason to keep using it.

---

## THE OPEN FRONTIER — the back-loaded Dragon-16 damage (start here)

`--timeline` on the captured DonaHilvi Dragon-16 win:
- Boss maxHP **727,245 == DB** (✓ both calibrated — the sampler's BattleStats read AND the enemy table agree).
- **Boss-HP curve MAE 18.1%; sim damage back-loaded.** Real boss at 66% HP by 60% progress; sim still at 97%.
- **Wave→boss transition: real @45% progress, sim @66%** (sim spends ~2× the turns clearing waves; 90t vs real 68t).
- Wave HP data is **correct** (516k total, reconciles with reality's ~513k wave damage). Once the boss phase
  starts, both curves drop at a similar rate — so the BOSS damage is fine; the WAVE phase is the problem.

⚠ **ROOT CAUSE UNVERIFIED — do NOT trust my retracted claim.** I said the legacy `applySkill` path "drops the
aoe flag." That is WRONG: **`applySkill` is DELETED** (0 call sites) and the sim is **already ONE path** —
`dispatchSkill → recipeFor(authored) || kitToRecipe(auto-parse) → applyRecipe`. `kitToRecipe`
(interpreter.js L43–66) DOES translate `aoe → all_enemies`, `healPct → HEAL`, TM, cleanse, conditional
debuffs for every auto-parse champ. My grep `aoe:0 in engine.js` just meant the handling lives in
interpreter.js (correct), not that it's dropped. **Lesson burned in: verify the ACTIVE path before diagnosing
— a zero in dead code is not a finding.**

**The verifiable next question:** do the wave-clearers actually resolve to AoE targeting?
- Non-recipe champs (e.g. Hilve, Iudex Artor): does `skill.aoe` parse `true`? It comes from
  `/attacks all enemies/i.test(skill_summary)` (ai.js:133) — check their real `champion_skills.skill_summary`
  text against that regex (a likely DATA/PARSING miss → single-target).
- Recipe champs (Ezio, Michelangelo, Xenomorph): does their hand-authored recipe `ACQUIRE_TARGETS` use
  `all_enemies` on the wave-clearing skills? (recipes.js).
- Method: instrument the sim to log actual targets-per-skill on this battle (or read kitToRecipe/recipe output),
  and confirm against the `--trace`. Verify before concluding — the timeline finding is real, the cause isn't known.

---

## What was built this session (the pipeline)

- **In-battle HP sampler** — `gestal-sync/RslBattleReader/BattleSampler.cs`, cmd `--samplebattle [maxSec]`.
  IL2CPP GC is non-moving → scan once, re-read HP cheaply each ~150ms; a bg thread re-scans for spawned
  boss/waves. Trust only units whose HP MOVED (kills the stale-object duplicate bug). Live source:
  `SharedModel.Battle.Core.Hero.BattleHero` (typeId@0x18, slot@0x1C, curHp@0x58, ÷2^32; slots 0-4=allies).
- **Wired into the watcher** — `BattleWatcher.SamplingLoopAsync` runs `BattleSampler.SampleOneBattle(...)` and
  attaches the compact `Models.BattleTimeline` RETROACTIVELY to the just-logged entry (`AttachTimeline`, under
  `_captureLock`, then `Flush()`) — the sampler finishes ~12s after the result is emitted.
- **Per-kind debuff counting** — boss trace carries `byProducer:{typeId:count}` (each AppliedEffect's producer
  = effect+0x18 → BattleHero typeId). Validated: Xeno poison stacks cycle 3↔6 as HP falls fastest.
- **Downstream naming** — `lib/timeline-producers.js` `namedBossDebuffTimeline(entry)` (typeId→name from the
  entry's own `heroes[]`); viewer `tools/name-timeline-producers.mjs`.
- **sim-suite --timeline** — the grader (`tools/sim-suite.mjs`, `--timeline`/`--timeline-path`/`--trace`).
- **Reverse-engineering diagnostics** (RslBattleReader): `--livehp`, `--inspecthero`, `--inspecteffect`,
  `--readstr <hex>`; resolver `Il2CppClassResolver.ResolveByNameAny`. Full offset map in memory.

Also earlier in the session (separate thread): **PC-import / saved-accounts is already built + live** —
[[saved-accounts-pc-import-built-and-live-2026-08-09]] (the blocker was a missing `SUPABASE_ANON_KEY`, fixed).

---

## Tools cheat-sheet

```bash
# capture: run the watcher (sampler auto-attaches timelines). Point at a scratch log to avoid the real one:
RslBattleReader.exe "C:/path/to/scratch-battle-log.json"

# grade the sim's damage curve vs captured timelines:
node --env-file=.env.local tools/sim-suite.mjs --timeline --timeline-path <battle-log.json>
node --env-file=.env.local tools/sim-suite.mjs --timeline --trace --timeline-path <log>   # + full turn log
node --env-file=.env.local tools/sim-suite.mjs                                            # win/loss balanced acc (unchanged)

# view named per-kind boss debuff timeline:
node tools/name-timeline-producers.mjs <battle-log.json> [--all]

# live RE diagnostics (pause a battle first):
RslBattleReader.exe --livehp | --inspecthero [slots] | --inspecteffect | --readstr <hexaddr>
```
Build the reader: `cd gestal-sync/RslBattleReader && dotnet build -c Release` (stop any running .exe first — it locks the dll).

---

## Data plumbing — the one real gap for scaling this

Timelines live in the **local `battle-log.json`** (fresh; the production log has none yet — they predate the
sampler wiring). `sim-suite --timeline` reads the local log directly (self-contained: each entry carries
account + stage + heroes + timeline). To scale calibration: (a) run the sampler-wired watcher so timelines
ACCUMULATE, and/or (b) upload timelines to the DB and have `--timeline` (or the shadow loop) read them there.
Until then, grade against whatever local captures you have.

---

## Follow-ups (all incremental)

- **Sim:** verify the wave-AoE-targeting question above (the open frontier); consider adding a poison-stack
  CURVE comparison (`--timeline` records boss poison count per turn already) and folding the curve MAE into
  `sim-suite-history.jsonl`.
- **Reader:** Turn Meter offset (likely in `BattleContext`, not HeroState); effect-KIND enum (kind lives in
  EffectType, no plain-text label — see offset-map memory); exact HP divisor (BattleStats maxHP gives it);
  gate the idle heap-scan on a cheap "battle active" flag (~1 core idle cost today).

---

## Working agreements to keep (this session's, hard-won)

- **Verify the ACTIVE path/fact BEFORE diagnosing.** A grep-0 in a deleted function is not a finding; a name
  miss returning zero rows is not a fact. This session I built a whole (wrong) audit on an unverified premise —
  don't repeat it.
- **Grade fight-SHAPE, not just outcome.** Win/loss is underdetermined; the timeline curve is overdetermined.
- **IMPLEMENT, DON'T FIT** — find the mechanic behind a divergence, don't tune a constant to close the number.
- **The sim is ONE engine** (`recipeFor || kitToRecipe → applyRecipe`) — there is no legacy `applySkill`.
