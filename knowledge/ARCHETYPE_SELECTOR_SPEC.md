# Archetype Selector — Clan Boss team selection (design spec)

**Status:** DESIGN / not yet built. Reviewable before any code.
**Author context:** reviewer proposal (2026-08-06) + codebase-grounded adjustments.
**One line:** replace the general-bucket rubric + repair loop for Clan Boss with an
**architecture-first** selector — "which CB *archetypes* can this roster complete, and which
valid team performs best?" — while preserving the roster, gate, and magnitude layers.

The current pool selector stays FROZEN and operational; this is built alongside it and only
retires the repair loop after the simulator confirms the new path wins on the real metric.

---

## 1. Why replace the center of the pipeline

The current CB path scores a team by summing six weighted "buckets" (`ALLOCATION` in
`tools/bucket-score.mjs`: damage 30 · sustain 20 · mitigation 15 · tempo 15 · amplification 15 ·
cleanse 5) and repairs the single shortest bucket (`tools/pool-select.mjs`). That objective is
**"fill six meters as high as possible,"** which produces over/underfilled, structurally
incoherent teams:

- **Overfill is rewarded** — `CB_OVERFILL = { damage:1 }` makes damage non-decaying, so the
  selector spends seats stacking the abundant role.
- **Underfill is baked in** — the repair loop stops when grade stops rising; a low-weight role
  (cleanse 5) is never fixed if overfilling a high-weight role raises grade more.
- **Weights ≠ counts** — nothing enforces "this role needs exactly N seats."
- **Composition is an afterthought** — `devScore` seeds the 5 most-developed champs, *then*
  repairs; the team never starts from "what does CB require?"

Observed live: DonaHilvi produced amplification 146% / cleanse 0% / tempo 55% and was called
optimal. This is the failure the archetype model fixes.

## 2. This is a RETURN to canon, not a new invention

The archetype/role-slot model **is** the project's documented product model
(`knowledge/team-building-model.md`, INS-0026…0029): content = mechanical PROBLEMS solvable
many ways; a team is 5 SEATS each with a primary role; multi-role champs free seats.

⚠ **`lib/team-assembler.js` + `tools/assemble-team.mjs` already implemented a seat-based
selector and were SHELVED — "naive set-cover that fielded fodder."** Do not greenfield this.
Start from that code and understand its failure mode. The antidote that did not exist when it
was shelved is the **magnitude / `buildScale` layer built 2026-08-01…08-05**. The new selector =
team-assembler's constraint model **+ `buildScale` as the within-role deliverer/tiebreaker +
the factual gate**. Fodder is prevented by magnitude, not by re-adding a development veto.

## 3. Scope boundary — phase archetypes by speed-tune dependency (LOAD-BEARING)

CLAUDE.md: **"Clan Boss precise speed tuning is explicitly out of scope for v1"** — the app
collects gear *tier*, not exact SPD, so it cannot validate a rotation tune. Therefore split the
archetypes:

| Group | Archetypes | Needs exact SPD tune? | Where valid |
|---|---|---|---|
| **Sustain** | poison-sustain, direct-sustain, hybrid-sustain | No | **App-shippable** |
| **Rotation** | unkillable, shield-infinity, block-damage, revive-on-death | Yes | **Sim-only / advanced** until per-champion SPD collection exists |

Every archetype carries `requiresSpeedTune: boolean`. The app only recommends `false` ones; the
sim may evaluate all. Do not let the app promise an unkillable comp it cannot tune.

## 4. Pipeline (adapted from the reviewer's 8 stages)

```
Gestal roster
 → factual usability / build gate            (Stage 2: keep, make factual)
 → tag-based capability profiles             (Stage 3: adapt bucket-magnitude, keyed by capability)
 → feasible CB archetypes                    (Stage 4: NEW — which archetypes can the roster complete?)
 → mechanically valid 5-champ teams          (Stage 5-6: NEW — scarcity-anchored generation + validation)
 → COARSE team coverage score                (Stage 6: pruner only, NOT the arbiter)
 → simulation of finalists                   (Stage 7: lib/sim/clan_boss.js decides — source of truth)
 → explained recommendation                  (Stage 8: why this team, primary weakness)
```

### Stage decisions vs current files

| Current file | Decision | New responsibility |
|---|---|---|
| `lib/gestal-context.js` | **Keep** | Gestal → normalized owned champion instances (one per copy) |
| `lib/match-engine.js` | **Narrow** | Factual gate: ownership, level/rank/ascension, skill-unlock, build-readiness, content eligibility — NOT a universal `usabilityTier>=2` tier |
| `tools/bucket-score.mjs` | **Retain as legacy** | Preliminary relevance score / roster prefilter only; stops defining composition |
| `lib/bucket-magnitude.js` | **Refactor & expand** | Foundation of capability profiles (`buildScale`/`tagDelivery` already separate having-a-tag from delivering it) |
| `tools/pool-select.mjs` | **Replace repair loop** | Superseded by archetype selection for CB; kept until retirement step |
| `lib/cb-shadow-goals.js` | **Convert to encounter config** | Boss ACC/RES/affinity/difficulty/turn rules/immunities/thresholds (source: `CLAN_BOSS_REVIEW.md`) |

## 5. File structure (data-first)

```
lib/
  capability-profile.js          # tagDelivery/buildScale → capability keys (magnitude-aware)
  archetypes/clan-boss.js        # DATA registry: array of archetype specs (+ requiresSpeedTune)
  selection/
    feasibility.js               # which archetypes the roster can complete (+ why not)
    candidate-generator.js       # scarcity-anchored, requirement-keyed lists + multi-role dedup
    team-validator.js            # hard team checks; rotation validators for the speed-tune group
    team-score.js                # COARSE pruner — deliberately NOT tuned
  content/clan-boss.js           # encounter config lifted verbatim from CLAN_BOSS_REVIEW.md
tools/
  cb-team-select.mjs             # orchestrator → finalists → lib/sim/clan_boss.js → ranked, explained
```

⚠ **Archetypes are DATA, not seven code modules.** One registry file; escalate to a JS validator
function ONLY for archetypes that need a rotation check (the speed-tune group). Adding a sustain
archetype must be a data edit.

## 6. Data model

### Capability profile (per champion, magnitude-aware)
Derived from `champion_skill_tags` (per-skill, magnitude-carrying — `CONTRIBUTION_MODEL_SPEC.md
§6`), NOT the flat `champion_tags`. Each capability =
`effect magnitude × placement chance × expected ACC success × affinity success ×
duration/cooldown coverage × expected skill-use frequency × valid-target coverage ×
current unlock/build status`. Most factors already exist in `tagDelivery`; reshape by capability
key instead of by bucket.

```js
{
  decreaseAtk:   { coverage: 0.83, strength: 0.50, accuracyRequired: true },
  allyProtection:{ coverage: 0.50, targetScope: "all_allies" },
  recovery:      { expectedHealing: 12400, coverage: 0.67 },   // absolute values need effective stats (sim path; coarse in app)
  poison:        { expectedPlacementsPerBossTurn: 0.78, poisonStrength: 0.05 },
  cleanse:       { coverage: 0.33, cooldown: 3 },
  directDamage:  { estimatedValue: 18400 }
}
```

### Archetype spec (registry entry)
```js
{
  id: "poison_sustain",
  strategy: "conventional",
  requiresSpeedTune: false,
  hardRequirements: {
    bossDamageSuppression: { anyOf: ["decreaseAtk"], minScore: 0.70 },
    protection:            { anyOf: ["allyProtection","increaseDefense","strengthen","shield"], minScore: 0.60 },
    recovery:              { anyOf: ["leech","healing","continuousHeal"], minScore: 0.50 },
    poisonEngine:          { anyOf: ["poison","poisonActivation","poisonExtension"], minScore: 0.60 },
    stunPlan:              { anyOf: ["blockDebuffs","cleanse","controlledStunTarget"] }
  },
  optional: [...],
  penalties: ["debuffBarPressure","affinityRisk","buildGap"]
}
```

### Factual gate output (per champion instance)
```js
{ usable:true, reasons:[], unlockedTags:[...], disabledTags:[...],
  buildReadiness:{ speed:0.82, accuracy:0.71, survivability:0.65 } }
```
Two modes: `current_build` (usable now) and `development_plan` (qualifies after investment) — this
is the `buildScale` + gate work already built.

## 7. Algorithm

1. **Feasibility** — for each archetype, can the roster meet every `hardRequirement`? Emit
   completable archetypes + reasons for the rest.
2. **Scarcity-anchored candidate generation** — build requirement-keyed candidate lists
   (`championsWithAny(capability)`), then combine starting from the *scarcest* requirement.
   Dedup champions who satisfy multiple requirements (they free a flex slot). This replaces the
   repair loop's "seed then patch shortest bucket."
3. **Validation** — hard team checks: all mandatory functions present; min coverage met; rotation
   valid (speed-tune group); books present for the assumed rotation; debuff-bar (10-cap) pressure
   acceptable; affinity viable; no incompatible TM/extra-turn interaction.
4. **Coarse score** — rank *valid* teams for pruning ONLY. Evaluate redundancy here (a 2nd
   Decrease ATK counts only if it materially adds uptime or a missing function).
5. **Simulate finalists** — top ~N valid teams per archetype → `lib/sim/clan_boss.js`; rank by
   expected damage / chest tier / survival consistency / affinity / build-readiness / manual-setup.
6. **Explain** — per-seat role, mandatory-coverage checklist, primary weakness.

⚠ **No silent caps.** Requirement-keyed lists bound combinatorics, but large rosters
(GuapoDonni 189) can still explode — cap the enumeration and `log()` what was dropped.

## 8. Dependencies & critical path

- **THE blocker is data, not code:** `champion_skill_tags` is populated for only ~6 CB champs
  today. Capability profiles are only as good as this table. Populating it for the CB-relevant
  roster is the real prerequisite (handoff frontier #5).
- Encounter facts come from `CLAN_BOSS_REVIEW.md` (read before coding, per CLAUDE.md hard rule).
- Finalist simulation reuses `lib/sim/clan_boss.js` unchanged.

## 9. Success metric & regression discipline

- The current pool outputs are **known-incorrect**, so freezing them is an **explainability diff**
  ("the pick changed; here's why"), NOT a pass/fail regression.
- The REAL metric is unchanged: `tools/battle-suite.mjs` balanced accuracy on captured battles +
  `tools/sim-golden.mjs`. The archetype selector earns retirement of the repair loop only if
  finalists→sim beats the old path on those. (MODEL_AS_REIMPLEMENTATION.md: implement, don't fit —
  keep `team-score.js` coarse; let the sim decide.)

## 10. Migration sequence

1. Freeze current selector; snapshot output as the explainability baseline.
2. `capability-profile.js` — adapt `bucket-magnitude`, keyed by capability.
3. **Populate `champion_skill_tags` for the CB-relevant roster** (critical path).
4. `archetypes/clan-boss.js` with **poison-sustain only**; `feasibility.js` + `team-validator.js`.
5. `candidate-generator.js` (scarcity-anchored) — do NOT remove `pool-select.mjs`.
6. Diff old vs new on all accounts; wire finalists into `lib/sim/clan_boss.js`.
7. Add direct-sustain + hybrid-sustain.
8. Add the speed-tune group ONLY after a rotation validator exists; flagged sim-only.
9. Retire the repair loop after the sim confirms the new path wins on the real metric.

## 11. Open decisions (need Mike)

1. **poison-sustain requirement thresholds** — the `minScore` values above are placeholders.
2. **Archetype roster & counts** — confirm the sustain templates' exact role slots (e.g. 2 DoT
   carriers + activator + amp + reviver), and the full CB archetype list.
3. **`current_build` vs `development_plan`** default for the app.
4. **Redundancy rule** — quantitative test for when a 2nd same-role champ is worth a seat.
5. **Enumeration cap** — max teams evaluated per archetype before pruning.

---

## Bottom line
Preserve Stages 1, 2, and most of 4. Replace the general rubric (`bucket-score.mjs` stops defining
composition) and the repair loop (`pool-select.mjs` stops patching six meters). Archetype recipes
+ team-level constraints take over. Build it as **team-assembler's constraint model + the new
magnitude layer**, archetypes as data, capabilities from `champion_skill_tags`, a coarse score,
and the simulator as arbiter — phased so the app never recommends a comp it cannot tune.
