# Handoff — Contribution-Model Layers (as of 2026-07-14)

**Purpose:** let a cold session resume the recommendation-engine rework. Read this, then
`PROJECT_BRIEF.md §5b`, the "Damage mechanics — interaction rules" section of `CLAUDE.md`,
and the session memories linked at the bottom. Then look at "Open next actions".

---

## The thesis (why this work exists)
The match engine scores champions by **tag COVERAGE** (does the champ have a tag that
satisfies a goal? yes/no). Coverage can't express **magnitude, interaction, or tradeoff** —
so it makes structurally wrong picks. We are moving the engine from **coverage-scoring →
contribution-scoring**, where each champion is valued by what it actually adds to *this*
fight (damage by source × debuff multipliers × sustain), judged as a two-sided
confidence: **P(kill-speed beats survival-time within the time budget)**.

The canonical proof case (this session): for Ice Golem the engine **benched Underpriest
Brogni (HP Burn + full sustain package) to field Uugo**, whose marquee Decrease DEF is
*useless* on a poison team. The user swapped Uugo→Brogni (same stage, same gear tier) and
flipped a 103-turn full wipe into a 64-turn flawless clear. Coverage scored Brogni **0** and
Uugo **2**; contribution scores it the opposite. That bench is the bug the whole rework fixes.

---

## Layer status

| Layer | What | Status | Where |
|---|---|---|---|
| **0** | Damage-mechanics rules (facts) | ✅ built, committed, **deployed** | `lib/damage-mechanics.js` + CLAUDE.md section |
| **1** | Guardrail + honest explanation | ✅ built, committed, **deployed** | `lib/battle-gaps.js`, `lib/explain.js`, `lib/cb-damage-model.js` invariant |
| **2** | Contribution model (per-champ) | ⚠️ **built + wired + rendered, but UNCOMMITTED / localhost only** | `lib/contribution-model.js`, `lib/match-engine.js`, `api/match.js`, `app.js`, `style.css` |
| **3** | Selection consumes contribution | ❌ not started — **hard-gated** (see gates) | future `selectTeam` change |

### Layer 0 (done, live)
`lib/damage-mechanics.js` = source⇄debuff interaction matrix + helpers. Key facts encoded:
DEF shred only boosts ATTACK damage (never Poison/HP-Burn/Warmaster %maxHP DoT); debuff
value is conditional on the team's damage type; **sustain is multiplicative**; per-hero
damage understates supports; **Poison Sensitivity** multiplies poison; poison saturates at
10 stacks / HP Burn at 1; `reliabilityFactor = chance × uptime/fight × auto_reliable`.
`cb-damage-model.js` imports `damageSourceIgnoresDef` and asserts the %maxHP invariant at load.

### Layer 1 (done, live)
`auditTeamDebuffs()` in `damage-mechanics.js`, wired into `battle-gaps.js` (emits
`debuff_type_mismatch` / `debuff_low_reliability` / `debuff_reliability` data-missing) and
`explain.js` (coach credits a champ's real role, not a mismatched debuff). **Changes what we
SAY, not who we pick.** Reliability dimension is data-starved (see gaps) so it mostly emits
mismatch + "reliability unknown" today.

### Layer 2 (BUILT but not committed — this is the live edge of the work)
`lib/contribution-model.js` — `computeContributions(team, {bossHp, fightTurns,
incomingDamagePerTurn})`. Splits each champ's output by source, applies team debuff
multipliers (reliability- + saturation-weighted), **attributes debuff lift + granted
survival back to the support that provides them**, produces a two-sided confidence.
Verified: on a real CB recommendation it scored Xenomorph 56% / Ezio +3.8M granted debuff /
Uugo 0% (Dec DEF mismatch). Wired into `match-engine.js` (contribution block on every match,
DISPLAY ONLY), passed through `api/match.js`, and rendered as a **beta panel in the results
screen, test-mode-gated** (`renderContribution` in `app.js`, styles in `style.css`).
**It does NOT drive selection.** Magnitudes are nominal; boss HP is real only for CB (nominal
off-CB); survival side is flagged `estimated` (incoming-damage gap).

**TO COMMIT LAYER 2:** `git add lib/contribution-model.js lib/match-engine.js api/match.js
app.js style.css` (do NOT stage `migrations/2026-07-14_run_reconciliations.sql` — it's a
prior session's uncommitted file, not part of this work). Then `vercel --prod` if deploying
(safe — the panel is test-mode-gated, invisible to real users).

---

## Open next actions (priority order)

1. **[recommended, ready to build] Selection watchdog (Layer 1.5).** Run the (already-built)
   contribution model over the FULL roster at selection time and **flag when a benched champ
   out-contributes a fielded one** (e.g. "coverage benched Brogni (rank #2) to field Uugo
   (~0 on this DoT team)"). It's a WARNING, not a selection change → **no validation gate
   needed**, ships now. Would have caught the Brogni bench. Surfaces in explanation + feeds
   the disagreement log that later justifies Layer 3. *User was about to approve this.*

2. **Sustain quantification.** Add `sustain_rate` (from heal/shield/mitigation kit values —
   needs plumbing heal multipliers) and an `incoming_rate` calibrator to the contribution
   model. "How much sustain is enough" = **net-drain runway (`teamHP / (incoming − sustain)`)
   comfortably exceeds killTurns, within budget** — a per-stage number *calibratable from
   captured win/loss survival* (a loss at turn T bounds incoming). This unlocks the survival
   half of Layer 2 and rule #4 (penalize a thin/absent sustain floor for auto reliability).

3. **Data patches (stopgap, via committed seeds + human approval):** add **HP Burn** as a
   solution to the IG "deal damage" goal (it's Poison's %maxHP twin, currently unlisted →
   why Brogni scored 0); add a **sustain/survival goal** to Ice Golem. Whack-a-mole, but
   fixes the acute IG hole now. **Also audit** how many other dungeons have this "damage type
   not in goal solutions" hole — it's probably not just HP Burn on IG.

4. **Log the IG A/B into `run_reconciliations`** (validation-entry #1 toward the ≥20-run
   Layer 3 gate). Tool: `tools/reconcile-runs.mjs`.

---

## Two data gaps blocking the model (both known, both capturable)
- **Incoming-damage-per-stage** — the survival side of the two-sided calc needs "how hard
  does stage N hit?". Recoverable empirically: back it out of captured win/loss survival
  (Uugo loss 103t + Brogni win 64t at IG-15 already bound IG-15's incoming rate).
- **Per-hero damage for non-CB** — the reader captures per-hero damage only for Clan Boss.
  So on IG we can only infer "HP Burn drove kill speed" from turn count, not measure it.
  Extending `CbDamageReader` to the dungeon result dialog would let the next A/B *measure*
  the damage-vs-sustain split. (Passive-read only — never inject; see CLAUDE.md boundary.)
- (Minor) `battleSpeed` still null on captures (0x40 offset likely stale). `durationSeconds`
  IS now captured (fixed this session).

---

## Hard gates & guardrails (do NOT violate)
- **Layer 3 does not go live** until the contribution model's rankings match observed
  outcomes in **≥20 runs across ≥2 dungeons** (via `run_reconciliations`) **AND** gear tiers
  are calibrated first. (PROJECT_BRIEF §5b — a named gate, not advice.)
- **A single battle changes a tag-of-fact at most, never a model rule** (CLAUDE.md reasoning
  discipline #4). Tonight's IG A/B *corroborates the direction*; it does not by itself relax
  a floor or flip selection. Log it; don't act on N=1.
- **All content changes go through committed `seeds/*.sql` + human approval** — never write
  goals/solutions/thresholds directly to the live DB.
- **Contribution magnitudes are nominal** — the interaction STRUCTURE is authoritative, the
  numbers wait for calibration. Don't tune them off a few runs.
- Battle reader is **passive read only** (anti-cheat boundary).

---

## This session's other work (already committed + deployed)
Bug fixes (commit 344a13f): **Dragon content key** added to `api/match.js` VALID_CONTENT
(frontend offered it, API rejected it → 400 → error screen); **ad-gate infinite loop** fixed
(server gate now honors `ad_views_today`; client caps the post-ad match retry at one).
NOTE: `api/analyse.js` still has a stale allowlist (`campaign/spider/spider_beginner/
clan_boss`) — the failure-diagnosis flow will reject ice_golem/fire_knight/dragon. Not fixed.

---

## Key files
- `lib/damage-mechanics.js` — Layer 0 rules (authoritative)
- `lib/contribution-model.js` — Layer 2 engine (uncommitted)
- `lib/match-engine.js` — `selectTeam` (line ~355, coverage sort — the thing Layer 3 changes);
  contribution block (~line 1227, display only)
- `lib/battle-gaps.js`, `lib/explain.js` — Layer 1 guardrail consumers
- `api/match.js` — gate logic (~line 62) + response shape
- `app.js` — `renderContribution` (beta panel), recommend flow / ad gate
- `CLAUDE.md` — "Damage mechanics — interaction rules" + reasoning discipline
- `PROJECT_BRIEF.md §5b` — full Layer 2/3 spec + the hard gate

## Memories to load (hold detailed provenance)
`damage-mechanics-rules-2026-07-14`, `ig-feedback-donbrogni-2026-07-14` (has tonight's A/B),
`contribution-model-target`, `two-layer-recommendation-model`, `engine-feedback-loop`,
`run-reconciliations-2026-07-14`, `gear-tier-work-2026-07-14`, `floors-are-not-gates`.
