# COLD START — 2026-07-23 (PM, latest) — The Action Verification Model

Read this FIRST. It supersedes `HANDOFF_2026-07-23_wave-engine-and-survival.md` as the entry point.
Then read `knowledge/ACTION_VERIFICATION_MODEL.md` (the canonical spec this handoff summarises).

---

## The one thing to know

Mike **named the model** this session and it is now permanent: **THE ACTION VERIFICATION MODEL.**

> A turn has two parts. The **ACTION** is decided by game mechanics — deterministic. The **RESOLUTION**
> of that action is mechanics + RNG. They are true differently, so they are verified differently.

This split is *why* the turn loop works where the old aggregate battle-suite zig-zagged for months.
Conflating the two made the sim unfalsifiable; splitting them gives each half a falsifiable test.

- **Phase I — Action** — ✅ **BUILT & VERIFIED this session.**
- **Phase II — Resolution** — ▶ **NEXT. Mike explicitly wants to build it. This is where the entire
  survival gap lives.**

---

## Where we are

**Branch `session/qa-rungs-2026-07-23`, 10 commits, NOT merged to main, NOT pushed.** Working tree clean.
Latest commit `f845380` = Action Verification Model Phase I.

**Full QA gate is GREEN:** self-test 120/0 · property 12/12 · sensitivity · effects (0 blanks) ·
**actions 127/127** · mutation 100% (12/12) · snapshot 6/6 · 0 spec violations.
Run it: `node --env-file=.env.local tools/sim-qa.mjs`

---

## Phase I — Action (DONE — don't re-litigate)

At every decision point the mechanics *fully determine* three things, RNG-free, so we assert them EXACTLY:

1. **WHO acts** — SPD / turn-meter order.
2. **WHICH skill** — the auto-battle AI rule (below).
3. **WHICH target** — AoE → all; else taunt → veil-skip → lowest current HP% (avoid Unkillable/Block-Damage
   for our side).

**The skill-AI model (corrected this session — important):** it is **SLOT ORDER**, not skill effects.
Default = **highest slot first, A4→A3→A2→A1** (A1 last, skip anything on cooldown). Per-champion exceptions
live in `CONFIRMED_SKILL_ORDER` (ai.js). The only confirmed exception is **Ezio → A2→A3→A1** (his passive
puts up [Perfect Veil] at round start; the AI opens the AoE in that window). ⚠ The 2026-07-23 morning
"AoE-preference" experiment was the WRONG abstraction and is **reverted** — do not reintroduce it.

**Policy (Mike):** well-established behaviours are **RULES**; community-sourced per-champion claims are a
**CONFIRM QUEUE** (`knowledge/CHAMPION_AI_MODEL.md`), never applied to the sim until a recording backs them.
Confirmed so far: the default rule, the healer-hoard rule, the revive-lock rule, and the **Mythical
form-refuse rule** (Mike confirmed from experience: on auto a Mythical never transforms — use only base-form
kit). The follow-up queue (Kymar, Coldheart, Deacon, etc.) is suspected-only.

**Verifier:** `tools/sim-actions.mjs` — computes the expected action *independently of* `engine.pickSkill`
and compares turn-by-turn; stops at the FIRST divergence with a resolution checklist. Currently 127/127.
Wired into the gate **NON-BLOCKING** (it checks sim-vs-RULE, not sim-vs-reality — a divergence is a thing to
CONFIRM against a recording, not a proven bug).

**Two honest blind spots (both reviewers flagged; do not oversell Phase I):**
- **Circularity** — if a RULE is wrong, the oracle and the sim agree and the test stays green. → live
  confirmation is inevitable; every non-default behaviour carries provenance + `confirmed`/`suspected`.
- **Completeness** — it verifies actions that FIRED; blind to an action that *should* have fired and didn't
  (an untriggered passive). **That gap is exactly Phase II's job.**

---

## Phase II — Resolution (BUILD THIS NEXT)

"What happens when the action is called." Given (actor, skill, target), resolve through a fixed pipeline —
each step separately verifiable:

1. **Hit** — lands? damage always; debuff = ACC vs RES (two-stage roll).
2. **Magnitude** — `coeff × stat × mitigation (DEF / SHIELD) × crit × affinity × variance`.
3. **Effects** — buffs/debuffs applied: duration, stacking, immunity, 10-debuff cap.
4. **Triggers** — passives that fire *in response*: **Second Wind, Aid the Feeble, counterattack, reflect,
   ally-protection, on-hit shields** — the layer that keeps the protected champions alive.
5. **Commit** — HP, shields, turn meter, cooldowns.

**Verified DIFFERENTLY from Phase I** because RNG lives here: do NOT assert exact numbers. Assert
**mechanic-correctness** (does the shield absorb? does Second Wind fire at 0 HP? does HP Burn tick 3% max
HP?) and **distribution/range** (per-hero `taken`/`damage` vs a recording; Monte-Carlo win-rate + per-champ
death-rate over N seeds).

**THE SURVIVAL GAP IS ENTIRELY HERE (steps 2–4).** The sim wipes the healers in wave 1 because incoming
damage isn't mitigated by shields/passives/taunt the way the real fight is. The measuring stick already
exists: the per-hero `taken` table in `test/reviews/dragon16-2026-07-23.md`
(Ezio 3,820 · Bambus 9,226 · Pelops 23,205 · Tagoar 5,778 · Vergis 45,610 — hits on tank+sponge, healers
barely touched). The sim currently INVERTS this and kills the healers first.

**Recommended first build: step 4, the passive-trigger system** — it *is* the survival gap and has zero
infra today (Phase I proved actions fire; nothing yet fires *reactive* passives). Concretely: a trigger bus
where passives subscribe to events (`onAllyBelowHP`, `onAllyDeath`, `onHitTaken`, `onTurnStart`) and
Vergis Second Wind / Tagoar Aid the Feeble / on-hit shields resolve against it. Score every change against
the `taken` distribution + the Monte-Carlo death-rate. **IMPLEMENT, DON'T FIT** — no fitted survival
constants (`knowledge/MODEL_AS_REIMPLEMENTATION.md`).

Then: shield-uptime/absorb (step 2 mitigation) → two-stage debuff landing (step 1) → damage-variance-as-a-
bracket (step 2).

**Open decision Mike left on the table:** start coding the passive-trigger system, OR write the full Phase
II spec doc first (resolution pipeline in CHAMPION_AI_MODEL.md-level detail) before any code. Ask.

**Reuse, don't rebuild — Phase II verifiers already exist:**
- `tools/sim-trace.mjs` — reality oracle; per-hero damage/heal/taken vs a recording; `TURNLOG=lo-hi`
  per-turn ledger; `TRACE=N`, `DUMP=Name`.
- `tools/sim-montecarlo.mjs` — seeded N-battle win-rate + turn + per-champ death-rate distributions.
- `tools/sim-effects.mjs` — FIRED-vs-CONSUMED ledger (catches "represented but not consumed").
- `tools/sim-sensitivity.mjs` — metamorphic checks.

---

## Key files

| File | What |
|---|---|
| `knowledge/ACTION_VERIFICATION_MODEL.md` | **canonical spec** — read after this handoff |
| `knowledge/CHAMPION_AI_MODEL.md` | Phase I which-skill rule + the confirm queue |
| `lib/sim/engine.js` | turn loop; `pickSkill`/`pickEnemySkill` (default + skillOrder); `onAction` hook; unified side-aware `applySkill` |
| `lib/sim/ai.js` | `CONFIRMED_SKILL_ORDER`, `readSkillKit`, `canUseSkill` (heal-hoard, revive-lock), coeff parse |
| `lib/sim/dragon-fixture.js` | builds the real Dragon-16 fight (exact builds + DB waves + boss) |
| `tools/sim-qa.mjs` | the QA gate / orchestrator (4-bucket ledger; only bucket 1 blocks) |
| `tools/sim-actions.mjs` | Phase I action verifier |
| `test/reviews/dragon16-2026-07-23.md` | the recording → the per-hero `taken` target for Phase II |
| `test/golden/dragon16-donbambus-2026-07-22.json` | the golden fixture |

## Pitfalls (learned the hard way this session)

- Wave-mob ACC/RES/stats are **first-party** (Mike hand-loaded per stage, seed 211). Not synthetic. Don't
  claim otherwise.
- Bambus damage **scales off ATK** (AoE over many turns) — **no DoTs, no HP-scaling**. Stop assuming.
- The reality target says survival, not offense: real Dragon-16 = **all 5 alive, ~150t, VICTORY**.
- Video recordings ARE ground truth (`imageio-ffmpeg` → frames → read the VICTORY screen).
- Don't tune a survival constant to close the gap — that hides an unimplemented passive inside a number.

## If Mike says "the turnlog"

`TURNLOG=1-45 node --env-file=.env.local tools/sim-trace.mjs` — per-turn effect ledger vs the recording.

## Housekeeping owed

Branch `session/qa-rungs-2026-07-23` (10 commits) is **not merged to main or pushed** — Mike decides when.
