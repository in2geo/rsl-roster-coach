# Battle-Simulator QA / Testing / Validation — Complete Inventory

**Purpose:** a single, honest picture of everything we have built to test and validate the battle simulator,
so it can be handed to an outside reviewer to find what's missing. Assembled 2026-07-29 by reading the actual
source; code excerpts are verbatim. Companion to `MODEL_QA_LADDER.md` (the canonical ladder) — this doc adds
the code and plain-language explanations.

---

## 0. The two systems (read first)

- **The Model** = the Action Verification Model: `lib/sim/recipes.js` (champion skills as DATA) +
  `lib/sim/interpreter.js` (executes them) + `lib/sim/operations.js` (the op vocabulary). It is the
  *testing ground* where each mechanic's math is proven correct in isolation.
- **The Simulator** = the final product: `lib/sim/engine.js` runs a whole battle turn-by-turn.

**The rule for which checks apply where:** a check applies to the Model iff its correct answer is **LOCAL**
(computable from the mechanics implemented, without a whole-fight outcome). So the Model gets protocol layers
1 (input), 2 (unit), 3 (toy), state-level 5 (invariants), implemented-mechanic 6 (sensitivity), scoped 4
(golden), plus the meta-disciplines (teeth, snapshot, censuses). Layers 7–10 (reality replay, outcome scoring,
adversarial, calibration) are **Simulator-side**. This split is why several tools "report but don't block."

**A turn, conceptually (the Action Verification Model):** Phase I — *Action* (WHO acts by SPD, WHICH skill by
AI rule, WHICH target) — is RNG-free and asserted EXACTLY. Phase II — *Resolution* (hit/miss, magnitude,
effects, triggers) — has RNG and is verified by *mechanic + range*, not exact numbers. Two documented blind
spots of this model: **circularity** (checks sim-vs-rule, not sim-vs-reality) and **completeness** (blind to
an action that *should* have fired but didn't). The second is the root of the 2026-07-29 Bambus-sponge miss.

---

## 1. How a battle is recorded — the effect ledger + turn loop

Everything downstream verifies against one data structure: `state.effects`, an append-only **ledger** of what
happened. Every mechanic writes a record via `recordEffect` (aliased `E(...)` inside skill code):

```js
// lib/sim/engine.js:372
export function recordEffect(state, rec) { state.effects?.push({ turn: state.turn, phase: state.phase, ...rec }); }
// inside a skill: E = (rec) => recordEffect(state, { source: `${actor.name} [P]`, slot: skill.slot, ...rec });
```

An effect record's fields: `turn`, `phase`, `kind` (`damage`/`debuff`/`buff`/`dot`/`cc`/`heal`/`absorb`/
`reflect`/`redirect`/`revive`/`target`/`gear`/`passive-cd`…), `subtype` (the effect name, e.g. `Poison`),
`target`, `source` (who caused it), `fired` (did the code path run), `consumed` (did it actually change
world state), `amount`, and `note` (e.g. `resisted`, `overheal`, `sponged from X`). **`fired` vs `consumed`
is the workhorse distinction** — a mechanic can fire (appear to run) yet consume nothing (no real delta);
catching that gap is an entire rung (§6).

**The scheduler** picks the actor holding the highest turn meter and fires an observe-only hook:

```js
// lib/sim/engine.js:378
export function nextActor(state) { /* … pick max turnMeter … */
  if (actor) { state.onSchedule?.(state, actor, pool); actor.turnMeter = 0; }
```

**The turn loop** (`simulate`, engine.js:700) fires a series of **observe-only hooks** that verifiers subscribe
to WITHOUT changing behaviour (setting a hook mutates nothing; it just reports). The core:

```js
// engine.js ~756-806 (abridged)
if (!state.roundActed || livingNow.every(c => state.roundActed.has(c))) {
  state.roundActed = new Set(); state.round = (state.round ?? 0) + 1;
  state.onRoundStart?.(state);                 // round-start passives (Ezio Perfect Veil) fire here — ONCE per round
}
state.roundActed.add(actor);
state.onTurnStart?.(state, actor);             // per-turn triggers (Bambus Sleeping-Sage wake)
content.onTurnStart?.(state, actor);           // content hook (Spider spawns +2 on each ally turn)
tickDots(state, actor); tickBombs(...); tickHots(...); checkDeaths(state);
if (CC_SKIPS_TURN.some(t => actor.debuffs.some(d => d.type === t))) { /* record 'cc' turn-lost, skip */ }
if (actor.side === 'enemy') phase.actEnemy(state, actor); else acted = actChampion(state, actor);
if (actor.side === 'ally' && content.onDamageToBoss) { /* feed team damage to Dragon purple bar */ }
```

The observe-only hooks the engine actually fires: **`onSchedule`, `onRoundStart`, `onTurnStart` (both
`state.` and `content.`), `onAction`, `onDamageToBoss`.** (There is no `onDamageTaken`.) The verifiers in §3
install these to record turn order, who-acted-when, and the decision point.

> Note the comment at engine.js:752-754 is load-bearing for the Spider work: `round_start` passives fire once
> per round, so a champion faster than the pack **outruns his own 2-turn [Perfect Veil]** and is exposed in the
> gap — video-verified for Ezio.

---

## 2. The action oracle / decision verifier

Two files, one shared core. This is "does each turn do what it should, turn by turn."

### `lib/sim/verify-core.mjs` — the shared outcome-verification core
Runs one battle with the hooks installed, then scores the ledger into per-mechanic **contract** rows. Each
placeable effect has a DOWNSTREAM CONTRACT — the observable that proves it did its job:

```js
// verify-core.mjs:17-26 — the contract taxonomy
const DOT = ['Poison','HP Burn','Necrosis','Bomb'];  const HEAL = ['Continuous Heal'];
const REACTIVE = ['Shield','Magma Shield','Reflect Damage','Ally Protection'];
const TARGETING = ['Taunt','Provoke','Perfect Veil','Veil'];
export const contractFor = (subtype) =>
  CC_SKIPS_TURN.includes(subtype) ? 'skip' : DOT.includes(subtype) ? 'tick' :
  HEAL.includes(subtype) ? 'heal' : REACTIVE.includes(subtype) ? 'reactive' :
  TARGETING.includes(subtype) ? 'targeting' : 'placed';
```

The heart is the **opportunity-aware inert test** — it fails a mechanic only when it *had a chance and did
nothing*, which is what avoids false positives:

```js
// verify-core.mjs:82-89
if (c === 'targeting')      opps = attackOpp[m] ?? 0;
else if (c === 'reactive')  opps = plist.filter(p => hitAfter(clean(p.target), p.turn)).length;
else                        opps = plist.filter(p => !selfApplied(p) && actedAfter(clean(p.target), p.turn)).length;
const consequence = c === 'placed' ? null : (conseq[m] ?? 0);
const inert = c !== 'placed' && opps > 0 && consequence === 0;   // had the chance, produced nothing
```

`setChanceMode('all')` on `seed==null` makes every chance land, so a mechanic that fails to fire is a BUG,
never bad luck. **What it does NOT cover:** the taxonomy is only those 5 contract types — **revive and the
Bambus sponge are not modelled as contracts**, and there is no card→recipe coverage here.

### `tools/model-turn-verify.mjs` — the QA rung (blocking)
Runs verify-core across many seeds **and across every built content** (Spider-13 + Dragon-16, 20 seeds each,
as of 2026-07-29 — it was Dragon-only before, which is why Spider-side inertness went unseen). Blocks on a
broken turn order or any inert mechanic in any content.

```
node --env-file=.env.local tools/model-turn-verify.mjs
```
Output per content: `turn order: ✅/❌`, `inert mechanics: ✅ none / ❌ N` (+ each inert line),
`outcome-verified: <list>`, `placement-only: N (coverage gap, non-blocking)`; then a cross-content pass/fail
and `QA_JSON {"rung":"turn-verify","pass":0|1,"fail":N,"failures":[...],"contents":[...]}`. Exits non-zero on
any failure. This is the guard that caught the Petrification "placed, 0 skips" bug.

### CLI sibling — `tools/turn-verify.mjs`
Same core, one battle, human per-turn verdicts (`✅ WORKS` / `❌ INERT` / `· n/a`). `node --env-file=.env.local
tools/turn-verify.mjs '' <fixture>`.

---

## 3. How you run a full verification pass — `tools/model-qa.mjs`

The orchestrator. `node --env-file=.env.local tools/model-qa.mjs` (add nothing → no-DB rungs only). It spawns
each rung as a subprocess, parses its `QA_JSON` line, and prints a scorecard + a **4-bucket defect ledger**:
`spec_violation` (BLOCKS), `unimplemented` (backlog, from recipes' `deferred[]`), `missing_data`, `not_scored`
(DB-skipped / Simulator-side). **Only `spec_violation` blocks** — the Model is incomplete by design.

Rungs invoked, in order (teeth first, so every green below is trustworthy):

1. `model-mutants` (teeth) · 2. `model-ops-consistency` · 3. `sim-selftest` (game-magnitude anchor) ·
4–7. `sim-recipe-test/-b/-c/-d` (toy battles) · 8. `model-boss` · 9. `model-spider` · 10. `model-invariants` ·
11. `model-sensitivity` · 12. `model-snapshot` · 13. `sim-rolls` · **[DB]** 14. `sim-validate-recipes` ·
15. `model-fidelity` · 16. `model-recipe-registry` · 17. `model-golden` · 18. `model-turn-verify` ·
19. `mob-coverage`.

Scorecard line examples:
```
  ✓ [Lmeta] teeth (mutation)                 green  (kill rate 96%)
  ✗ [L2] game-magnitude anchor (Raid tables) RED (3)
  · [L1] DB→recipe fidelity                  SKIPPED (no DB)
```
Verdict: `✅ SPEC-CONFORMANT` or `⛔ BLOCKED — N spec violation(s)`. Final `QA_JSON {"rung":"model-qa",
"pass":<#green>,"fail":<#spec_violations>,"scorecard":[...],"ledger":{...}}`; exits non-zero only if a
spec_violation exists.

---

## 4. Input & data-validation rungs (layer 1)

### `tools/model-fidelity.mjs` (DB)
Asserts every `DEAL_DAMAGE` recipe reflects the DB's `damage_multiplier` (coeff) + `multiplier_type` (ATK/HP/
DEF). Catches a value present in the DB but mis-read in the recipe (the Vergis `3.9/DEF` case).
```js
if (String(F.scalingStat).toLowerCase() !== SIMPLE[mt]) fails.push(`${key}: scalingStat ${F.scalingStat} ≠ DB ${db.multiplier_type}`);
if (Math.abs(parseFloat(dm) - F.multiplier) > 1e-6) fails.push(`${key}: multiplier ${F.multiplier} ≠ DB ${dm}`);
```
`QA_JSON {"rung":"model-fidelity",...}`. **NOT checked:** only DEAL_DAMAGE ops; for formula-type multipliers
it only asserts `terms` exists, not the term values; champion resolved by `ilike` first-name (not the registry).

### `tools/sim-validate-recipes.mjs` (DB)
Two-way diff of each recipe against the DB `skill_summary`: **omission** (every source bracket/keyword is
accounted for in an action or `deferred[]`) and **fabrication** (every recipe effect traces to a source word).
Enforces GATE #1 (every champion incl. all wave mobs authored) and GATE #2 (every placed lasting buff/debuff
has a wired engine consumer — the Heal-Reduction trap). Prints a status table (`✓ EXECUTABLE / ~ PARTIAL /
✗ REVIEW / ⏸ DEFERRED`), exits non-zero if any REVIEW. **NOT checked:** it confirms a clause was *noticed*, not
that its interpretation is correct; tokenizer is concept/regex-based.

### `tools/model-ops-consistency.mjs`
Reconciles three drifting sources of "which ops exist/are implemented": the `operations.js` registry, the
interpreter's actual dispatch, and recipes' `deferred[]` prose. Fails on any disagreement or a recipe using an
unknown op. **NOT checked:** op *correctness* — only that the three lists agree.

### `tools/model-recipe-registry.mjs` (DB)
Anchors every recipe champion to a real `champions.id` via the sanctioned name registry, and blocks if
`champKey` (first-name token) collides — e.g. a real champion that would silently run the Dragon recipe.
**NOT checked:** recipe mechanics; assumes the aliases table is complete.

---

## 5. Unit & toy-battle rungs (layers 2–3) — mechanics in isolation

All four are `node tools/sim-recipe-*.mjs` (no DB), print `=== N passed, M failed ===`, exit non-zero on fail
(no `QA_JSON`).

- **`sim-recipe-test.mjs` (II-A, 7 cases):** damage-math composition — coeff × eff-ATK × crit × DEF-mit, buff/
  debuff folding, non-stacking, dynamic scalers, caps. DEF-mit expected value is *computed* from the same
  verified function so it can't drift on a constant.
- **`sim-recipe-b-test.mjs` (II-B, 8 cases):** placement is probabilistic → the expected value is a
  DISTRIBUTION over thousands of seeded trials: measured land rate must match `chance × landChance(acc,res)`
  from Raid's real two-branch resist curve. Plus immunity hard-block, duration, correct recipient, stacking.
- **`sim-recipe-c-test.mjs` (II-C, 7 cases):** state manipulation, checking BOTH that the recipe places the
  right value AND the engine consumer fires — heal, revive, shield absorb, taunt pull, ally-protection
  redistribution, buff-steal, ignore-Shield (with negative controls), lifesteal, duration reduction.
- **`sim-recipe-d-test.mjs` (II-D, 11 cases):** reactive passives + damage modifiers — Second Wind shield +
  its passive-trigger cooldown, Ezio Perfect-Veil round timing (a fast Ezio's veil LAPSES — uptime ≠ 100%),
  Pelops immunities/on-attacked chances, Reflect, Bambus sponge stack ACCUMULATION, Enfeeble ×0.70.

**NOT checked (all four):** magnitudes vs *reality* (these prove mechanics fire correctly in isolation, not
that the number matches the game); only the authored champion set; no full turn loop.

---

## 6. Golden, invariants, sensitivity, censuses

### `tools/model-golden.mjs` (DB, layer 4) — validation vs hand-calc
Re-proves the deterministic engine reproduces a **hand-calculated** battle for turns 1–8 of the Dragon-16
fixture: for each turn, expected actor+slot and *exact* damage to each target were derived by hand from the
cards. Checks actor+slot match, each target's exact damage, and that no *unexpected* damage was dealt.
```js
for (const g of GOLDEN) {
  const a = acts[g.turn] || {};
  if (a.actor !== g.actor || String(a.slot) !== g.slot) { diffs.push(`t${g.turn}: actor/slot …`); continue; }
  for (const [tgt, exp] of Object.entries(g.dmg)) if ((dmgByTurn[g.turn]||{})[tgt] !== exp) diffs.push(`t${g.turn} … golden ${exp}, sim …`);
}
```
`QA_JSON {"rung":"model-golden","pass":<n>,"fail":<n>,"firstDivergence":...}`. **NOT checked:** only turns 1–8
of one fixture; deterministic (no RNG); the golden values are human-derived (could themselves be wrong).

### `tools/model-invariants.mjs` (no-DB, layer 5) — property-based
800 randomised seeded scenarios; asserts state-level invariants that must hold after *any* recipe:
`HP ≤ max`, immune target never gets an immune debuff, durations ≥ 1, no negative damage/shields, applyRecipe
never throws, and determinism (same seed → same result). **NOT checked:** magnitude correctness (a wrong-but-
in-bounds number passes); no turn loop / DoT / boss.

### `tools/model-sensitivity.mjs` (no-DB, layer 6) — metamorphic
Outputs move in sensible directions when one input changes, and DON'T where the game says they shouldn't
(carve-outs: heals/shields scale off HP, not ATK). +ATK→+dmg, +DEF→−dmg, +ACC→+land, +SPD→more turns (drives
the *real* scheduler), Poison Sensitivity ×1.25 exactly, Pelops −20% exactly, heal unchanged when ATK changes.
**NOT checked:** absolute magnitudes; each direction tested at a single perturbation pair.

### `tools/sim-rolls.mjs` (no-DB) — RNG roll census
Instruments the RNG stream bundle and asserts every LIVE mechanic *draws its stream at its stated probability*
(Warmaster 60%, crit at C.Rate, debuff at the land curve) via boundary probes (0.59 lands / 0.61 misses),
that reserved streams stay dead, and that streams are decorrelated. `QA_JSON {"rung":"rolls",...}`.
**NOT checked:** distribution/uniformity (boundary probes only); several streams are classified as
intentionally-dead (damage variance off, AI RNG unmodelled).

### `tools/sim-effects.mjs` (no-DB) — FIRED vs CONSUMED census
The automated detector for "represented but not consumed." Flags any `fired && !consumed` effect lacking a
benign reason:
```js
export function unexplainedDrops(effects) {
  return effects.filter(e => e.fired && !e.consumed && !isBenign(e) && !isDataGap(e));
}
```
Reports unimplemented "blanks" (e.g. veil-ignoring targeting) WITHOUT blocking. **NOT checked:** `consumed`
means *a* delta happened, not the *right* delta; benign allowlist is regex-on-note.

---

## 7. Boss / content outcome verifiers

### `tools/model-boss.mjs` (no-DB) — Hellrazor (Dragon)
Drives the boss's action closure turn by turn and asserts called→fired→applied: Inhale arms the purple bar +
drains its own TM; team damage drains the bar; **Scorch fires if the bar is up but is INTERRUPTED (turn
wasted) if the bar was cleared**; Wall of Fire applies 2×Poison+Weaken; Swipe applies Decrease ATK. Plus the
mitigation stack and on-hit reactions. **NOT checked:** magnitudes (asserts `hp < maxHp`, not the number);
deterministic; synthetic combatants; stage-16 only.

### `tools/model-spider.mjs` (no-DB) — Skavag (Spider) [currently 39/42]
Mirror of model-boss for `makeSpiderContent`: event-driven Spiderling spawn cadence + cap 10; alternating
consume with permanent +10%-ATK-per-Spiderling snowball + 3%-MaxHP heal; 2×5% Poison per Spiderling hit;
Venom Spray +15% vs Poisoned; the Almighty-Immunity list; Healing Assured 90% Poison reduction; a liveness
check; and a targeting-observability guard. **The 3 currently-failing assertions** encode the consume ATK-ramp
constants (`1000→1600`, `1600→2880`) and spawn cadence — they went stale when spawn-TM was set to 66 this
session, and need verify-then-rebless, not auto-pass. **NOT checked:** first-tick/TM-race dynamics (separate
`sim-spider-*` tools); real DB kits; exact Venom Spray magnitude.

### `tools/model-petrification-test.mjs` (no-DB)
Focused regression for the "placed but silently inert" [Petrification] bug: a reactive 1-turn petrif landed
mid-turn must survive the placement turn's expiration and cause exactly ONE skip next turn. Asserts the `cc`
skip count. **NOT checked:** placement chance (forced to land); durations > 1; no `QA_JSON` line.

---

## 8. Regression + teeth (the meta-disciplines)

### `tools/model-snapshot.mjs` (no-DB) — regression / golden-master
Pins the Model's own current deterministic output (fixed scenarios, `seed:null`) as fingerprints in
`test/snapshots/model-snapshot.json`; any drift blocks until a human re-blesses with `SNAPSHOT_BLESS=1`. This
caught nothing wrong this session (Dragon path byte-identical after the targeting change) — its niche is an
*unintended* change. **NOT checked:** correctness — it says *whether* behaviour changed, never *whether it's
right*; a wrong number, once blessed, passes forever.

### `tools/model-mutants.mjs` (no-DB) — mutation testing = "the teeth"
Injects ~70 known bugs one at a time into the source, re-runs the no-DB rungs, confirms ≥1 goes red, and
reports the **kill rate**. A mutant tagged `expectKill:true` that survives is a SUITE HOLE (blocks); a probe
that survives is a coverage gap (backlog). Source is restored on every exit path.
```js
for (const m of MUTANTS) {
  fs.writeFileSync(f, src.replace(m.find, m.repl));
  const killers = RUNGS.filter(rungRed);   // does any rung now fail?
  restore();
  results.push({ ...m, killed: killers.length > 0, killers });
}
```
**NOT checked:** only *no-DB* rungs act as killers (DB rungs — golden, turn-verify, fidelity, coverage —
provide no teeth here); mutants are a hand-authored enumerated set, so kill rate measures detection over that
set, not the whole source; a STALE find (code moved) silently drops coverage.

---

## 9. Coverage / completeness — "what are we missing?"

### `tools/mob-coverage.mjs [stage]` (DB) — ENEMY wave completeness gate
Diffs the model vs EXTERNAL ground truth (not the sim). **L1** composition: the wave roster equals the
verified in-game table (`data/dragon-wave-data.json`). **L2** recipes: every mob skill must be a COMPLETE
authored recipe, not the auto-parse fallback — a recipe-less active skill is a hard fail; open non-ACCEPTED
`deferred[]` become the unimplemented catalog. **L3** firing: every active fires+consumes in a deterministic
battle. Verdict `✅ COMPLETE / ⛔ BROKEN / ⏳ INCOMPLETE`. **NOT checked:** it covers **enemy mobs, not our team
champions**; Dragon-specific; a never-fired active is a soft note, not a fail; L1 only where the wave table
exists.

> **This is the team-side analog of the gap that bit us.** `mob-coverage` gates *enemy* kit firing; there is
> no equivalent blocking gate for the *team's* champions. The report-only `sim-capability-matrix` (below) is
> the closest thing.

### `tools/sim-capability-matrix.mjs [N] [dungeon] [stage]` (DB) — team benchmark, REPORT-ONLY
An independent, hand-dissected denominator of the team's card clauses (built from the DB cards, NOT from the
recipes — so it can reveal a missing capability). Reports, per clause: RECIPE coverage (IMPL/DEFER/MISS),
TRACE firing (% of seeds it appeared in), and realized-vs-declared duration. It found Ezio's execute passive
MISSING and Tagoar's revive silent. **It is not a gate** — a wrapper (`model-firing-census`) was built and
then removed 2026-07-29 because, lacking the opps discriminator, it false-positived (flagged a revive that
simply had 0 deaths to act on). Turning this into an opps-aware team-side gate is an open design item.

---

## 10. Reality comparison (Simulator-side, layers 7–8)

These compare sim output to captured real battles. Orchestrated by **`tools/sim-qa.mjs`** (the Simulator-side
counterpart to `model-qa.mjs`): it runs the Simulator rungs and sorts findings into 4 buckets where only
`spec_violation` blocks; reality-magnitude gaps surface as bucket 4. They mostly **report** rather than block
(a mismatch on a known-incomplete sim is expected) — with the survival oracle the exception that blocks.

### `tools/sim-per-hero-bands.mjs` [N=50] (DB) — PER-HERO REALITY BANDS ★ the whole-fight magnitude gate
Runs Spider-13 + Dragon-16 N times and aggregates, per champion, DAMAGE DEALT (from `state.effects` by
source: `damage`+`dot`), DAMAGE TAKEN (from the authoritative `combatant.taken` — scripted enemies don't
ledger their hits), and HEALING done (heal events by source). Compares the sim median to the captured
**p10/median/p90** band from BOTH capture sources — `data/manual-captures.json` (Spider, hand-verified) and
the reader/watcher `battle-log.json` (Dragon-16 = 25+ wins, and other content). Flags any champion outside
the band; **exits non-zero if a gated metric's sim median is >20% off the captured median.** Gates DEALT +
TAKEN; HEALING is **report-only** (Continuous-Heal + magma-lifesteal aren't source-attributed to the caster).
Two documented seams surfaced in the output: DEALT excludes reflect (~42k/fight on Dragon, unattributed);
`state.effects` is incomplete for incoming damage (scripted enemies bypass the ledger → taken uses the field).
```
node --env-file=.env.local tools/sim-per-hero-bands.mjs
```
It found: Bambus dealt in band on both dungeons (validates the poison-redirect fix), the Spider over-survival
(taken ~0 vs reality 20–38k) localized as Spider-specific (Dragon taken all in band), and Pelops under-dealing
cross-content. **This is now the SINGLE per-hero reality gate** — the old `sim-survival-oracle.mjs` (per-hero
*taken* only) was **folded into it and retired** (2026-07-29). Wired into `sim-qa.mjs`, its failures route by
metric to preserve the oracle's teeth while respecting the completeness rule: **TAKEN outside the band →
`spec_violation` (BLOCKS)** — a broken-mechanic signature (over-survival / over-hot DoT / missing mitigation),
the immortal-poison class; **DEALT outside the band → reality gap** (damage-model incompleteness, surfaced not
blocked); **HEALING → report-only** (attribution seam). The standalone tool keeps a hard ±20% exit gate on
DEALT+TAKEN.

### `tools/sim-trace.mjs` (DB) — the reality oracle

### `tools/sim-trace.mjs` (DB) — the reality oracle
Runs the sim on a golden fixture's exact builds + real waves and lines its event log (phase clears, deaths,
revives, survivors) against the hand-verified recording timeline, reporting **where the two first diverge**
("sim wipes wave 1 t34; reality clears wave 1 by t46, all 5 alive"). Env `SEED=` for stochastic;
`TURNLOG=1-45` / `TRACE=N` / `DUMP=Name` for per-turn ledger detail. **NOT checked:** it's a localizer, not a
gate; single recorded timeline.

### `tools/sim-montecarlo.mjs [fixtureId] [N]` (DB) — win-rate distribution
Runs the same fixture N times with fresh seeds → win-rate, turn p10/median/p90, per-champion death rate +
median death turn. The honest comparison to reality is "what fraction of runs win," not "did the one run win."
Sets **no pass/fail threshold** (always exits 0). `SIM_MASTERY=off|offense` brackets uncaptured boss masteries.
**NOT checked:** it never asserts the win-rate matches reality; Dragon-only; boss masteries are a bracket.

### `tools/reconcile-runs.mjs` (DB) — prediction vs every captured battle
Re-runs the engine against the account roster (PREDICTION), reads each capture (REALITY), and writes a
classification (`on_spec` / `grind_above_rec` / `overpower` / `under_recommended` / `loss`) into
`run_reconciliations`. `--all` reprocesses. **NOT checked:** it records rows for downstream grading — a
systematically wrong engine still "reconciles fine"; spec_margin is computed at the recommended stage, not the
actual; Clan Boss prediction is calibration-blocked.

---

## 11. Test fixtures & captured reality data

- **`test/golden/*.json`** — the scenarios: `spider13-donbambus-current.json`,
  `dragon16-donbambus-current.json`, `dragon16-donbambus-2026-07-22.json`, `dragon17-donbambus-current.json`.
  A fixture holds: `content` (dungeon/difficulty/stage/mode/speed), `team` + `roster` (display→DB names),
  `inputs` (pointer to the build source), and a `result` reality anchor. The Spider fixture is explicit that
  it's an **aggregate** anchor, not a single run:
  ```json
  "result": { "outcome": "WIN", "survivors": 5, "turns": 175,
    "_note": "REPRESENTATIVE reality outcome — Spider-13 ~79% WR (n=48+); wins ~157-210t (median ~175).
              Per-hero NOT asserted here (reader can't capture Spider per-hero); a WIN/LOSS mismatch is an
              expected bucket-4 reality gap, never a Model failure.", "per_hero_representative": false }
  ```
- **`test/snapshots/`** — `model-snapshot.json` (Model fingerprints) + `engine-behavior.json`.
- **`test/reviews/`** — hand-verified battle-review notes + `dragon16-donbambus-reality-anchors.md`.
- **`data/qa-history.json`** + **`tools/qa-history.mjs`** — the MEASUREMENT BACKBONE (added 2026-07-29). Every
  run of `sim-per-hero-bands` and `model-qa` appends one timestamped, commit-stamped row via
  `appendQaHistory()`: per-hero-bands rows carry each champion's per-metric sim median + `inBand`/`devPct`
  verdict per content; model-qa rows carry pass/fail counts + the full scorecard + bucket sizes. Chronological,
  append-only, and a pure side-effect (never used in a verdict → golden/snapshot-safe). Read it over time to
  see whether the simulator is getting better or worse.
- **`data/manual-captures.json`** — the hand-transcribed ground truth: **21 captures**, all Don$Bambus /
  Spider's Den 13 / Normal — **14 Victories, 7 Defeats**, each with a full 5-hero dealt/taken/healed
  breakdown. Wins ~150–211 turns. This is what the Spider ~79%-WR aggregate and the per-hero damage bands
  come from (the RslBattleReader can't read Spider per-hero, so these are transcribed from victory screens).

---

## 12. Known coverage gaps — the "what's missing" list for the reviewer

Consolidated honestly from every tool above:

1. **No team-side firing/coverage GATE.** `mob-coverage` blocks on enemy-kit firing; nothing blocks on the
   *team's* champions. `sim-capability-matrix` reports it but doesn't block. This is exactly the seam the
   Bambus-sponge miss lived in (a modelled mechanic never wired to fire in a content).
2. **The outcome verifier's contract taxonomy is incomplete.** `verify-core` models CC-skip / DoT-tick /
   heal / reactive / targeting. It does **not** model **`revive`** or the **Bambus `sponge`/dump** — the two
   mechanics at the center of the current investigation. Adding them (with proper opportunity definitions) is
   the real regression-guard for the bug class we hit, and is not yet built.
3. **The completeness blind spot is structural.** A mechanic that never fires because it had *no opportunity*
   is indistinguishable, to every current rung, from a mechanic that's *unwired* — unless opportunities are
   counted. Only `verify-core`'s 5 contracts count opportunities today.
4. **Reality comparison is thin.** `sim-trace` uses a single recorded timeline; `sim-montecarlo` sets no
   pass/fail threshold and is Dragon-only; there is no automated gate that "sim win-rate must be within X of
   the captured aggregate." The reality anchor for Spider is 21 hand-transcribed captures (one account, one
   stage).
5. **Magnitude vs reality at the whole-fight level — ADDRESSED 2026-07-29** by `tools/sim-per-hero-bands.mjs`
   (§10), which gates per-hero DEALT + TAKEN against the captured p10–p90 bands for Spider-13 and Dragon-16.
   Remaining: HEALING is still report-only (attribution seam), and DEALT under-counts reflect — both close
   cleanly by adding per-champion `dealt`/`healingDone` accounting fields (mirroring `taken`/`healed`).
6. **Statistical checks use fixed tolerance bands, not confidence intervals** (`sim-recipe-b`, `sim-rolls`,
   `sim-recipe-d`), so a small persistent bias can pass.
7. **Mutation teeth run only over an enumerated mutant set and only the no-DB rungs** — DB-gated rungs
   (golden, turn-verify, fidelity, coverage) have no teeth proving *they* can fail.
8. **Snapshot can enshrine a wrong value** — it detects change, not correctness; a wrong number blessed into
   the baseline passes forever.
9. **Champion resolution inconsistency** — a few tools (`model-fidelity`, `sim-validate-recipes`) resolve
   champions by `ilike` first-name with a `|| cs[0]` fallback rather than the sanctioned name registry.
10. **Coverage is Dragon-centric.** `mob-coverage`, `model-golden`, `sim-montecarlo`, `sim-trace`,
    `model-boss` are all Dragon-first; Spider support is newer and thinner; Fire Knight / Ice Golem / Doom
    Tower are not wired into these at all.
