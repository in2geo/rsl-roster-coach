# The Action Verification Model

**Permanent name (Mike, 2026-07-23) for how the combat sim is built and validated.** Read this before
touching the turn loop, its skill/targeting rules, or its damage/effect resolution.

The model rests on one distinction that the old aggregate battle-suite never made, and that is the whole
reason the turn loop works where the aggregate zig-zagged for months:

> **A turn has two parts. The ACTION is decided by the game mechanics and is deterministic. The
> RESOLUTION of that action is governed by mechanics + RNG. They are true differently, so they are
> verified differently.**

Conflating them makes the sim unfalsifiable (an aggregate win/loss can be argued with forever). Splitting
them gives each half a falsifiable test.

---

## Phase I — Action  ✅ BUILT & VERIFIED (2026-07-23)

**What happens each turn, before any dice roll.** At every decision point the mechanics *fully determine*:

1. **WHO acts** — turn order by SPD (turn-meter fill).
2. **WHICH skill** — the auto-battle AI rule: default highest-slot-first (A4→A3→A2→A1, A1 last), plus
   role-based override rules and confirmed per-champion exceptions. Spec: **`knowledge/CHAMPION_AI_MODEL.md`**.
3. **WHICH target** — the targeting rule (AoE → all; else taunt → veil-skip → lowest current HP%, avoid
   Unkillable/Block-Damage for us).

There is **no guessing and nothing seeded from a recording** — it is what the game says it is. Because it's
deterministic (`seed=null`), the action sequence is byte-repeatable, so we assert it **exactly**.

**Verifier:** `tools/sim-actions.mjs` (a QA rung). It computes the mechanically-correct expected action
*independently of* `engine.pickSkill` and compares, turn by turn; at the FIRST divergence it stops and
prints a resolution checklist (cooldown bug? skill-order rule wrong? targeting?). Current: **127/127
actions match the rules.**

**Two known blind spots (honest limits — see `knowledge/action-verification-review-request.md`):**
- *Circularity.* The oracle checks sim-vs-RULE, not sim-vs-REALITY. If a RULE is wrong, both agree and the
  test stays green. → Every non-default behaviour carries provenance + a `confirmed`/`suspected` status; a
  divergence is a candidate to confirm, not proof. **Live confirmation is inevitable** (both reviewers).
- *Completeness.* It verifies the actions that FIRED; it is blind to an action that should have fired and
  didn't (an untriggered passive). That gap is Phase II's job (the recording-driven completeness check:
  every real action must appear in the sim).

---

## Phase II — Resolution  ▶ NEXT (to build)

**What happens when the action is called.** Given a decided (actor, skill, target), resolve the effect. A
fixed pipeline, each step verifiable:

1. **Hit** — does it connect / land? (damage: always; debuff: ACC vs RES — two-stage roll)
2. **Magnitude** — `coeff × stat × mitigation (DEF / shield) × crit × affinity × variance`
3. **Effects** — buffs/debuffs applied: duration, magnitude, stacking, immunity, cap (10-debuff)
4. **Triggers** — passives that fire *in response*: Second Wind, Aid the Feeble, counterattack, reflect,
   ally-protection, on-hit shields — the layer that keeps the protected champions alive
5. **State commit** — HP, shields, turn meter, cooldowns

**Why it's verified differently from Phase I:** RNG lives here (crits, damage variance, chance-to-land), so
you do **not** assert an exact number. You verify **mechanic-correctness** (does the shield absorb? does HP
Burn tick 3% of max HP? does Second Wind fire at 0 HP?) and **distribution/range** (per-hero `taken` and
`damage` against the recording; Monte-Carlo win-rate + death-rate over N seeds).

**The current gap is entirely Phase II — steps 2–4.** The sim wipes the healers in wave 1 because incoming
damage isn't being mitigated by shields/passives/taunt the way it is in the real fight. Target = the
per-hero `taken` distribution in `test/reviews/` (hits land on tank+sponge; healers barely touched).

**Infra that already exists for Phase II verification (reuse, don't rebuild):**
- `tools/sim-trace.mjs` — reality oracle; per-hero damage/heal/taken vs a recording; `TURNLOG` per-turn ledger.
- `tools/sim-montecarlo.mjs` — seeded N-battle win-rate + turn + per-champ death-rate distributions.
- `tools/sim-effects.mjs` — FIRED-vs-CONSUMED ledger (catches "represented but not consumed" mechanics).
- `tools/sim-sensitivity.mjs` — metamorphic checks (more crit → more damage, etc.).

**Build order for Phase II:** the passive-trigger system first (step 4 — it's the survival gap), then
shield-uptime/absorb (step 2 mitigation), then two-stage debuff landing (step 1), then damage-variance as a
bracket (step 2). Each lands against the `taken` distribution and the Monte-Carlo death-rate, never a fitted
constant (IMPLEMENT, DON'T FIT — `knowledge/MODEL_AS_REIMPLEMENTATION.md`).

---

## The QA gate (`tools/sim-qa.mjs`) — where each phase reports

Only **bucket 1 (spec violations)** blocks. Phase I's action rung reports **non-blocking** (it's a
predictor: sim-vs-rule, not sim-vs-reality — a divergence is a thing to confirm, not a proven bug). Phase
II's reality/Monte-Carlo/effects rungs report as reality-gap findings (buckets 2–4). The ladder:
self-test → property → sensitivity → effects → **actions (Phase I)** → mutation → snapshot →
trace-oracle + Monte-Carlo (Phase II).

**One line to remember:** Phase I says *what should happen* and we prove it exactly; Phase II says *what
results* and we prove it by mechanic + range. Rules predict, reality confirms.
