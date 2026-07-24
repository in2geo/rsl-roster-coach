# Phase II Build Tracker — The Action Verification Model

**What this is:** the living checklist for building Phase II (Resolution) of the sim. We tick boxes here
as we go, so progress is visible over time and the work stays finite. Update the **Log** at the bottom
every session.

> Phase II = "what actually happens when a champion takes a swing." Phase I (who acts / which skill / which
> target) is done. See `knowledge/ACTION_VERIFICATION_MODEL.md` and the Phase II design doc
> (`Action Verification Model Phase II.docx`, repo root).

---

## Where we are right now

- **Current milestone:** II-A/B/C/D mechanics built + a **connected deterministic run** exists
  (`tools/sim-run.mjs`, all-land, Ezio aura + Bronze III). **Now building the MODEL QA LADDER** —
  canonical doc `knowledge/MODEL_QA_LADDER.md`. **Teeth (mutation) DONE: `tools/model-mutants.mjs`
  11/11 killed, 100%, 0 holes, 0 gaps** — the Model's toy battles (recipe-test a/b/c/d) provably catch bugs.
  **The Model ≠ the Simulator** (Model = testing ground; plumbing rolls into the Simulator when proven).
  Next Model rungs: snapshot → invariants → sensitivity → 4-bucket orchestrator → DB→recipe fidelity.
  Prediction discipline (Mike): **the interpreter IS the prediction** (deterministic calc from DB facts);
  verify it bottom-up (toy battles + teeth), never LLM-guess the whole fight.
- **Approach (locked):** prove the architecture on ONE fight before authoring all ~900 skills.
- **Last updated:** 2026-07-24.

---

## Decisions locked (don't relitigate)

- [x] **Adopt the doc's architecture** — skills become *data* (ordered recipes of standard operations), engine implements each operation once.
- [x] **Keep the RNG** — seeded, separate per-mechanic streams stay exactly as they are; `seed=null` stays deterministic for the teeth-tests.
- [x] **Reality is the judge, not self-tests** — micro-tests prove a skill *runs*; the video `taken` distribution + Monte-Carlo prove it's *right*.
- [x] **Vertical slice first** — Dragon-16 team only, then scale.
- [x] **Migrate, don't rebuild** — the damage/shield/reflect mechanics already reality-checked get *absorbed* as operation implementations, not thrown away.
- [x] **Workbook authors, JSON runs** — deferred until AFTER the slice proves out (Milestone 6).

---

## The finish line (so it feels finite)

Phase II is five sub-phases from the design doc. We do a vertical slice of each on Dragon-16 first.

- [ ] **II-A — Damage execution** (scaling, multipliers, hit counts, AoE, crits, weak hits, DEF mitigation, ignore-DEF, shields, caps, death)
- [ ] **II-B — Standard buffs & debuffs** (placement chance, ACC/RES, duration, immunity, expiry)
- [ ] **II-C — State manipulation** (heal, turn meter, cooldowns, buff steal/strip, debuff spread, revive, max-HP destroy)
- [ ] **II-D — Reactions & passives** (trigger registry + queue, counters, ally attacks, extra turns, on-hit/on-death, limits)
- [ ] **II-E — Exceptional champions & bosses** (named handlers, Mythicals/forms, scripted bosses)

---

## Milestone 0 — the Dragon-16 vertical slice  ◀ CURRENT

Goal: the new data-driven engine reproduces the current Dragon-16 result, reads its skills from structured
data (not regex-guessed prose), and scores against the real recording exactly as now.
Team: **Ezio · Bambus · Pelops · Tagoar · Vergis** + Hellrazor.

- [x] **Step 1 — Recipe format spec.** ✅ `knowledge/PHASE_II_RECIPE_FORMAT.md` — damage-scope vocabulary + data shape + Bambus conditional-AoE worked example + engine-reuse map. Open questions parked for Step 2.
- [x] **Step 2 — Author the 5 champions as recipes.** Damage scope (II-A) only, `lib/sim/recipes.js`. 10 damaging skills, all validated (formulas + conditions resolve, required fields present).
  - [x] **Source captured & verified** — all 5 champions' verbatim skill text pulled from the LIVE DB → `PHASE_II_SLICE_SKILLS.md` (the audit trail). Open questions resolved from the DB, not asked.
  - [x] Bambus (pilot) — A1 3.8 ATK conditional-AoE (C_BAMBUS_AOE = target ≥2 debuffs), A2 5.6 ATK AoE.
  - [x] Ezio (A1/A2/A3), Pelops (A1/A2, HP-scaled), Tagoar (A1 ×2-hit/A2, ATK), Vergis (A1, DEF-scaled). Every non-damage clause named under `deferred`.
- [x] **Step 3 — Build the interpreter.** ✅ `lib/sim/interpreter.js` — walks a recipe's actions in `seq` order, executes ACQUIRE_TARGETS + DEAL_DAMAGE via the existing engine math (dealDamage, crit/affinity/DEF), RNG untouched. Proof: `tools/sim-recipe-test.mjs` **6/6** — conditional AoE, multi-hit, HP-scaling, DEF-scaling, ignore-DEF all resolve from data; numbers hand-verified; no stray flags.
- [x] **Step 4 — Prove the CODE produces the EXPECTED damage.** ✅ `tools/sim-recipe-fight.mjs`, real Dragon-16 builds + boss. **Two layers, in order:** (1) *math is correct* — recipe == an INDEPENDENT hand-computed value (mult × stat × crit × DEF-mit × ignore-DEF × affinity), **12/12**; (2) *migration fidelity* — recipe == the trusted engine, **9/10** exact, the 10th (Ezio A3) a CORRECT divergence the hand-math adjudicates (engine drops ignore-35%-DEF). Bambus A1 conditional-AoE fires on the real wave. ⚠ boss is Void → affinity/weak-hit ×1, not exercised here. Full-fight per-hero TOTALS deferred (survival-confounded) — that's the SEPARATE "is the setup right?" check vs the recording, done later.
- [x] **Step 5 — Verdict.** ✅ Architecture PROVEN on the real fight: a champion acts from data; conditional AoE, per-skill scaling stat, multi-hit, ignore-DEF all resolve; code matches hand-math (12/12) and the trusted engine (9/10, the 10th a correct fix). **Green-lit to extend.** Mike's call: proceed to II-B (survival road) rather than close II-A's last edges first.

### II-A checklist (design-doc "Damage execution") — where each box stands
| item | status | evidence |
|---|---|---|
| Scaling formulas (ATK/HP/DEF) | ✅ | Pelops HP / Vergis DEF exact parity; SPD + multi-term coded, unused by these 5 |
| Multipliers | ✅ | verified from DB; 9/10 exact to the unit |
| Hit counts | ✅ | Tagoar A1 ×2; multi-hit stops on death |
| AoE vs single-target | ✅ | incl. conditional (Bambus A1) on the real wave |
| Crits | ✅ (parity) | included in parity; per-roll variance → Monte-Carlo later |
| Weak hits | 🟡 | weak/strong DAMAGE (0.70/1.30) wired; weak-hit debuff-block → II-B |
| DEF mitigation | ✅ | exact parity |
| Ignore DEF | ✅ | Ezio A3 4,956 vs engine 3,705 (correct) |
| Shields | 🟡 | recipe routes through `dealDamage` (absorbs), but no shielded target tested here |
| Damage caps | ⬜ | %maxHP cap exists in engine; no recipe op uses it; none of these 5 have %maxHP dmg |
| Death | ✅ | multi-hit halts on death; engine death check each turn |

---

## Milestone II-B — standard buffs & debuffs (Dragon-16 slice)  ◀ CURRENT

Scope = **PLACEMENT** (the design-doc II-B list): placement chance → ACC/RES → immunity → apply with
duration/stacking → expiry, plus the effect RECIPIENT (self / all-allies / lowest-HP ally / random ally /
enemy hit). NOT the stat-effect consumption of each buff — a placed effect is only "live" where a consumer
already exists (Decrease Defense → damage; Poison → DoT). Effects placed-but-not-yet-consumed are FLAGGED,
not hollow. Same two-layer proof: code produces the EXPECTED placement behaviour first; reality later.

The slice's real buffs/debuffs (from `PHASE_II_SLICE_SKILLS.md`, non-shield/heal/revive):
Bambus A1 Decrease SPD 30%@75% · Ezio A1 Decrease DEF 60%@75% · Ezio A2 Poison×2 + Poison Sensitivity 25%@75% ·
Pelops A1 Decrease ATK 50%@75% · Tagoar A1 Increase DEF 60% (lowest-HP ally) · Tagoar A2 Increase SPD 30% (all) ·
Vergis A1 Reflect Damage 30%@40% (random ally). **Self-[Sleep] stays deferred to II-D** (coupled to Bambus's
passive — placing half of it would regress).

- [x] **B1 — Spec extension.** ✅ `PHASE_II_RECIPE_FORMAT.md` §9 — PLACE_DEBUFF / PLACE_BUFF ops, recipient selectors, the placement pipeline, required fields.
- [x] **B2 — Extend the interpreter.** ✅ `interpreter.js` — PLACE_DEBUFF (immunity → chance → ACC/RES → apply w/ duration+stacking) + PLACE_BUFF (recipient resolution + chance). Reuses engine `landChance`/`rollLand`/`applyDebuff`/`upsert` (exported); RNG untouched.
- [x] **B3 — Author the II-B clauses.** ✅ All no-damage skills now have recipes: Bambus A3 (Increase ACC/ATK, Enfeeble, Decrease ACC), Pelops A3 (Increase ATK), Tagoar A3 (all deferred → II-C), Vergis A2 (Increase DEF self). ~13 of 17 II-B effects authored; the rest deferred with reasons (Vergis A2 target-ally SPD/Reflect need the single-ally-target rule; Bambus A3 boss-branch is conditional → II-D).
- [x] **B4 — Prove the code produces expected placement.** ✅ `tools/sim-recipe-b-test.mjs` **8/8**; II-A 6/6 and Step-4 damage 12/12 intact.
- [x] **B5 — Effect inventory pass.** ✅ `PHASE_II_EFFECT_INVENTORY.md` (all 70 effects across all skills) — the master checklist.
- [x] **B6 — Import-pipeline tooling (design-doc steps 3–6).** ✅ `lib/sim/operations.js` (full op vocabulary + per-op required-param validators + `implemented` flags + modifier registry) and `tools/sim-validate-recipes.mjs` (step 3 params · step 4 source-coverage BOTH directions vs live DB · step 5/6 Executable/Partial/Review status). **Now 0 Review Required / 14 Partial / 6 passive-deferred** — every active skill accounted-for against the source; the tool fails the build if a clause is dropped or fabricated.

### II-B checklist (design-doc "Standard buffs and debuffs")
| item | status | note |
|---|---|---|
| Placement chance (stage-1 proc) | ✅ | measured 0.764 vs 0.75; Vergis buff 0.413 vs 0.40 |
| Accuracy / Resistance (stage-2) | ✅ | measured 0.383 vs expected 0.375 (0.75 × landChance 0.5) |
| Duration | ✅ | `turnsLeft = duration = 2` verified; engine `expireDurations` ticks it |
| Immunity | ✅ | immune target → 0.000 land rate |
| Application & expiration | ✅ | `upsert`; Poison ×2 → 2 stacks verified |
| Effect RECIPIENT (self/allies/enemy) | ✅ | lowest-HP / all-allies / random recipients verified |
| Weak-hit restrictions | ⬜ | debuff-block-on-weak-hit — deferred (Void boss, no weak hits to gate on yet) |
| Stat-effect CONSUMED? (not II-B, tracked) | 🟡 | Decrease Defense & Poison consumed; Increase DEF/SPD/ACC/ATK, Decrease Speed/ACC, Reflect, Poison Sensitivity, Enfeeble placed-but-inert pending a consumer |

---

## Milestone II-C — state manipulation (Dragon-16 slice)  ✅ DONE

The survival layer's PLACEMENT/ACTION side. Most CONSUMERS already existed in the engine (shield absorb,
taunt targeting, ally-protection redistribute, magma reflect, continuous-heal tick) — II-C gives the recipe
interpreter the operations that grant/fire them.

- [x] **Ops built (implemented):** `HEAL` (% caster MAX HP), `REVIVE` (% MAX HP), `STEAL_BUFF` (enemy→caster);
  shields/taunt/ally-protection granted via `PLACE_BUFF` (shield value = `effect.pctOfCasterMaxHp`); new
  recipients `all_allies_except_self`, `all_dead_allies`.
- [x] **Authored:** Bambus A2 Shield-all · Pelops A3 Magma-Shield-all + Taunt-self · Tagoar A2 heal-all ·
  Tagoar A3 revive + Shield-all (**first EXECUTABLE skill**) · Vergis A2 Ally-Protection · Ezio A3 buff-steal.
- [x] **Proven** `tools/sim-recipe-c-test.mjs` **7/7** — heal amount, revive HP, shield value, **shield
  absorbs**, **taunt pulls the hit**, **ally-protection redistributes (5000/5000)**, buff-steal moves the buff.
- [x] **Validator caught a real bug** — a duplicate `REVIVE` key (implemented:false overriding true); fixed.
- [ ] Deferred within II-C: `EXTEND_EFFECT` / `REDUCE_EFFECT_DURATION` (Bambus A2 buff-durations), the
  single-ally-target rule (Vergis A2 Continuous Heal/SPD/Reflect on "a target ally"), Pelops A2 conditional steal+Stun.

---

## Coverage scoreboard — what the engine can do

Two kinds of work. **Plumbing** is the genuinely new architecture. **Operations** are mostly code we already
have that just needs to be reachable *from data*. ✅ works · 🟡 partial · ⬜ missing.

### Architecture plumbing (the real new work)
| Piece | Status | Note |
|---|---|---|
| Skills stored as structured, ordered data | 🟡 | slice: 5 champs authored in `recipes.js`; not yet the engine's live path (Step 4 wires it) |
| Data-driven resolution order per skill | 🟡 | slice: interpreter walks `seq` order; not yet wired into `simulate()` |
| Recipient disambiguation (selected/hit/damage/effect) | 🟡 | slice: selected / current_target / all_enemies done; full hit/damage/effect split later |
| Trigger registry + "which triggers fire now?" queue | ⬜ | today: a fixed handful of triggers |
| Conditions as structured data | ⬜ | today: hard-coded AI switch |
| Formulas as stored components | ⬜ | today: hard-coded in the damage function |
| Import → validate → "Review Required" → Executable pipeline | ⬜ | |
| Per-skill auto micro-tests + honest coverage score | ⬜ | |
| Seeded RNG streams preserved | ✅ | already built — must survive the rebuild |

### II-A — Damage operations (the slice needs these)
| Operation | Status | Note |
|---|---|---|
| DEAL_DAMAGE (ATK-scaling, crit, affinity, DEF mitigation) | 🟡 | works; `DEF_K` is a nominal curve, variance off by default |
| Multi-term / stat-scaling formulas (HP/DEF/SPD scaling) | 🟡 | parsed; `DESTROY_MAX_HP`-style still separate |
| %-of-MAX-HP damage (+ 10%/hit cap) | ✅ | `dealMaxHpDamage` |
| AoE vs single-target | ✅ | |
| Weak hit / affinity | ✅ | 1.30 / 0.70 wheel |
| Shields absorb before HP | ✅ | override-not-stack, depletes |
| Ignore-DEF (via Decrease DEF) | 🟡 | Decrease DEF shred only; true `ignore` flag not modelled |
| Damage cap | 🟡 | %maxHP cap only |
| Death | ✅ | |
| Lifesteal / Magma-reflect | ✅ | Pelops wave engine |
| Warmaster / Giant Slayer bonus | ✅ | |

### II-B / II-C / II-D — beyond the slice (for later milestones)
| Operation | Status | Milestone |
|---|---|---|
| PLACE_DEBUFF (ACC/RES two-stage) | ✅ | II-B |
| PLACE_BUFF / CONTINUOUS_HEAL tick | ✅ | II-B |
| Immunity / duration / expiry | 🟡 | II-B |
| HEAL / REVIVE / CLEANSE | ✅ | II-C |
| **TURN METER fill / reduce / steal** | ⬜ | II-C — big Raid mechanic, entirely absent |
| Cooldown increase / decrease / reset | ⬜ | II-C |
| REMOVE_BUFF / STEAL_BUFF | ⬜ | II-C |
| TRANSFER / SPREAD debuff | ⬜ | II-C |
| DESTROY_MAX_HP | ⬜ | II-C |
| Ally Protection redirect | ✅ | II-D (mitigation primitive exists) |
| **Reactive triggers: on-hit shield, Second Wind, Aid the Feeble** | ⬜ | II-D — the survival gap |
| On-death / on-crit / on-kill triggers | ⬜ | II-D |
| ALLY_ATTACK / COUNTERATTACK (buff-driven) | ⬜ | II-D |
| EXTRA_TURN | ⬜ | II-D |
| Poison explosion / detonation (Ezio) | ⬜ | II-D/E |
| TRANSFORM / named exception handlers | ⬜ | II-E |

---

## Field notes — skill intricacies the recipe format must handle

Real cases (from Mike / recordings) that prove why skills must be *data with conditions*, not static flags.
Add to this list freely; each one is a test case for the format.

- [ ] **Bambus — conditional AoE.** He has TWO AoE attacks; his **A1 becomes AoE when enough debuffs are
  present** (single-target otherwise). On the Dragon-16 team the enemies are debuff-loaded, so A1 fires AoE.
  → `ACQUIRE_TARGETS` must carry a condition (`enemies under ≥N debuffs → all, else 1`); targeting is not a
  static flag. *This directly affects the Dragon-16 slice — Bambus's damage shape depends on it.*
- [ ] **Ezio — poison explosion / detonation** (~boss t124) — detonates stacked poisons for burst; distinct
  from "activate" (early tick). Not yet modelled. (II-D/E.)
- [ ] **Scaling stat is per-skill, not always ATK** — Pelops scales off **HP** (A1 0.25 / A2 0.4), Vergis off
  **DEF** (A1 3.9). Authoring must read `multiplier_type`. (VERIFIED 2026-07-23.)
- [ ] **Multi-hit** — Tagoar A1 "attacks 1 enemy **2 times**". `hitCount` is a real field, not always 1. (II-A.)
- [ ] **Self-[Sleep] loop** — Bambus places [Sleep] on himself each active skill; passive sponges ally debuffs
  while asleep, clears at his turn, dumps to highest-RES enemy. His identity + a survival mechanic. (II-D/E.)
- [ ] **Ezio survival stack** — [Perfect Veil] each round (untargetable), 35% nullify a >50%-MAX-HP hit, 35%
  counter. Drives his tiny `taken`. (II-D.)
- [ ] **Vergis Second Wind** — reactive: [Shield] when he loses ≥10% MAX HP from one hit; [Continuous Heal]
  when HP < 50%. On-hit / on-HP-threshold trigger — core survival gap. (II-D.)

## Log

- **2026-07-23** — Tracker created. Reviewed the Phase II design doc against the current engine; confirmed
  the architecture and the vertical-slice approach. Decisions above locked. Milestone 0 defined.
- **2026-07-23** — **Step 1 DONE.** Wrote `PHASE_II_RECIPE_FORMAT.md` (v0, damage scope): closed vocabulary
  (phases / operations / recipients / formula flags / condition operands), the data shape, and Bambus's
  conditional-AoE as the worked example. Confirmed each operation maps to existing reality-checked code
  (migration, not rebuild) and RNG is untouched.
- **2026-07-23** — **Verified all 5 cards from the LIVE DB** (Mike: "verify, don't assume; it's all in the DB").
  Captured verbatim → `PHASE_II_SLICE_SKILLS.md`. Overturned three inherited facts: (1) Bambus is **not DoT** —
  ATK-scaling AoE, coeffs 3.8/3.6→5.6 (golden note stale); (2) scaling stat is per-skill (**Pelops HP, Vergis
  DEF**), not always ATK; (3) DB name is **`Bambus`**, "Fourleaf" is an alias (exact-name lookup returned 0 rows
  — the CLAUDE.md silent-miss trap, hit and corrected). Recipe-format open questions RESOLVED from the DB.
  Next action: author Bambus (pilot) from the verified text, then the other four (damage terms only).
- **2026-07-23** — **Bambus authored** (pilot) → `lib/sim/recipes.js`: normalized CONDITIONS / FORMULAS /
  RECIPES maps; A1 conditional-AoE + A2 AoE, damage scope; every non-damage clause named under `deferred`.
  Proves the format holds the hard case (conditional targeting) as plain data.
- **2026-07-23** — **Step 2 DONE.** Authored the other four from verified text: Ezio A1/A2/A3 (ATK), Pelops
  A1/A2 (**HP**-scaled), Tagoar A1 (**×2 multi-hit**)/A2 (ATK), Vergis A1 (**DEF**-scaled). 10 damaging skills
  total; a validation pass confirms every DEAL_DAMAGE resolves to a real formula, every targetIf to a real
  condition, all required fields present. Non-damage clauses (shields, heals, debuffs, passives, self-Sleep,
  Second Wind…) all named under each skill's `deferred`. Next: **Step 3 — build the interpreter** that walks
  these actions and executes DEAL_DAMAGE / ACQUIRE_TARGETS via the existing engine code (dealDamage, etc.).
- **2026-07-23** — **Step 3 DONE.** `lib/sim/interpreter.js` — `applyRecipe(state, actor, recipe)` walks
  actions in `seq` order; ACQUIRE_TARGETS (incl. conditional `targetIf`) + DEAL_DAMAGE (formula flags:
  crit / affinity / def_mitigation / variance / ignore_def, multi-hit, stops on death) via the existing
  engine math; returns a structured hit resolution + FIRED/CONSUMED ledger; RNG untouched; unknown op/operand
  FLAGs. Proof `tools/sim-recipe-test.mjs` **6/6**, numbers hand-verified. NOT yet wired into `simulate()` —
  that is Step 4 (run the real Dragon-16 fight through recipes and score per-hero damage vs the recording).
- **2026-07-24** — **Step 4 DONE** (un-confounded method). `tools/sim-recipe-fight.mjs` compares recipe vs
  the trusted engine per-hit on the REAL Dragon-16 builds + boss: **11 pass / 0 fail / 1 correct improvement**.
  9 exact-parity (migration fidelity, incl. HP/DEF scaling), Ezio A3 correctly higher (ignore-DEF), Bambus A1
  conditional-AoE fires on the real wave. Full-fight per-hero TOTALS intentionally NOT scored — confounded by
  survival (deferred II-C/D); per-hit-on-real-stats isolates the damage architecture instead. Added the II-A
  design-doc checklist to the tracker (7 done, 2 partial: weak-hit-debuff-block & shields; 1 open: damage caps).
- **2026-07-24** — Hardened Step 4 with an INDEPENDENT oracle (Mike's two-layer framing): the harness now
  checks recipe == hand-computed math FIRST (code correctness, 12/12), THEN recipe == engine (migration
  fidelity, 9/10). The ordering is load-bearing: because the math is proven independently, the one
  recipe≠engine case (Ezio A3) is known to be a recipe FIX, not a regression. Next: **Step 5 verdict**.
- **2026-07-24** — **II-B DONE.** PLACE_DEBUFF/PLACE_BUFF built (placement pipeline: immunity→chance→ACC/RES→
  apply); `sim-recipe-b-test.mjs` 8/8. Effect-inventory pass (`PHASE_II_EFFECT_INVENTORY.md`, 70 effects)
  caught 8 II-B effects on no-damage skills never catalogued → authored Bambus/Pelops A3, Vergis A2, Tagoar A3.
- **2026-07-24** — **Import-pipeline tooling (steps 3–6).** `lib/sim/operations.js` (op registry + per-op
  required-param validators + implemented flags + modifier registry) and `tools/sim-validate-recipes.mjs`
  (step 3 params · step 4 source-coverage both directions vs live DB · step 5/6 status). Fixed 2 tool
  false-positives + 2 real omissions (Ezio veil clauses). Green: 0 Review.
- **2026-07-24** — **II-C DONE.** Ops HEAL/REVIVE/STEAL_BUFF + shield-value (pctOfCasterMaxHp) + recipients
  all_allies_except_self/all_dead_allies. Authored shields/heal/revive/taunt/ally-protection/steal.
  `sim-recipe-c-test.mjs` 7/7 (values + consumers). Validator caught a duplicate-REVIVE-key bug (fixed).
  Full sweep green: IIA 6/6 · IIB 8/8 · IIC 7/7 · damage 12/12 · validator 1 Exec/13 Partial/0 Review.
  Next: **II-D** reactive triggers/passives, then wire the interpreter into the full fight for the survival score.
- **2026-07-24** — **II-D reactive passives — both kinds built & card-verified.** (1) EVENT→response
  (`interpreter.fireTriggers`): Vergis Second Wind — Shield on a ≥10%-MAX-HP hit, Continuous Heal below 50% HP
  (4/4). (2) Continuous incoming-damage MODIFIERS (`interpreter.incomingDamage`): Tagoar Aid the Feeble −10%
  to allies ≤50% HP, Pelops −20% team (off while he's under Decrease DEF), Ezio 35%-nullify of a >50%-MAX-HP
  hit; stacking 0.9×0.8=0.72; verified vs the cards by constructing the event/hit directly (no battle loop,
  no simulator). Passives represented in recipes as `triggers[]` / `modifiers[]`. Remaining II-D: Ezio
  Perfect-Veil(round-start)+counter, Pelops on-attacked HP-Burn/Petrification, Bambus Sleeping-Sage sleep/
  transfer, Ezio execute-bonus. Integration into the live fight = the separate simulator step (not the model).
- **2026-07-24** — **Wave enemies built (damage-scope).** Dragon-16 waves = Lua, Faceless, Arbalester, Renegade
  (verbatim skills pulled from DB; stage-16 stats confirmed from `dungeon_stage_enemies`, first-party, NOT
  generic base). 12 mob skills → recipes; damage verified vs hand-math on stage-16 ATK (7/7): multi-term
  (Renegade A1 1.2ATK+SPD), full DEF-ignore (Faceless A3), ×3 multi-hit, per-debuff static base (Arbalester
  A3), Renegade A3 deals 0 to us (self-sacrifice). `recipeFor` now strips the "#position" fixture suffix.
  Mob UTILITY deferred + introduces NEW ops to build: REDUCE_TURN_METER (Lua A3), INCREASE_COOLDOWN
  (Arbalester A2), DECREASE_COOLDOWN (Renegade A3), TRANSFER_DEBUFF (Arbalester A1). Both sides now have
  damage modeled on correct stage-16 inputs.
- **2026-07-24** — **Enemy utility ops built:** REDUCE_TURN_METER (Lua A3 −100%), INCREASE_COOLDOWN
  (Arbalester A2, skills→cooldown), DECREASE_COOLDOWN (Renegade A3 −2t, excludes self + dupes), TRANSFER_DEBUFF
  (Arbalester A1, caster→target). Card-verified: TM 80→0; skills put on cd; ally cd 4→2/5→3 (self+dupe skipped);
  transfer ~51% (card 50%) and moves the debuff off the caster onto our ally. Mob recipes moved these out of
  `deferred`. The 50% transfer surfaced the chance-policy point live (deterministic ">50%" ⇒ exactly-50% doesn't
  land). Our-side regressions intact (6/6·8/8·7/7).
- **2026-07-24** — **EXTEND_EFFECT built** (Bambus A2 extends all ally buff durations +1t). Predicted "modest";
  actual was DECISIVE — flipped the connected run from a wave-2 wipe to a full clear (Ally Protection now
  persists ~25 turns instead of ~5, halving single-target hits). Lesson: LLM hand-predictions are the wrong
  tool for a deterministic model; **the interpreter is the predictor**.
- **2026-07-24** — **Connected deterministic run** (`tools/sim-run.mjs`): interpreter wired into the turn loop
  (`state.recipeAct`), passive events fire on incoming hits (`fireTriggers` hit_taken/hp_below/attacked),
  damage modifiers apply (`incomingDamage`), `setChanceMode('all')` policy, stat layers (Ezio SPD aura +19%,
  Bronze III +3% HP/ATK/DEF), old parsed-kit passives OFF in recipe mode (pure-recipe). Turn-by-turn
  hand-verification: turns 1–8 matched the code to the unit (Ezio A2 4005/4123/4424/4424/4163, etc.). Also
  built Pelops on-attacked HP-Burn + Vergis A2 Continuous Heal.
- **2026-07-24** — **MODEL QA LADDER started** (`knowledge/MODEL_QA_LADDER.md`). The Model gets the LOCAL half
  of the Simulator QA Protocol (layers 1,2,3, state-5, impl-6, + meta teeth/snapshot/fired-vs-consumed);
  layers 7–10 stay with the Simulator. **Teeth first: `tools/model-mutants.mjs` — 11/11 killed, 100%, 0
  suite holes, 0 coverage gaps.** It found 3 mechanics with no committed check (incoming-damage modifiers,
  EXTEND_EFFECT, exact-damage/crit) — all 3 now closed by `tools/sim-recipe-d-test.mjs` (11/11) + an
  exact-damage-with-crit assertion in `sim-recipe-test.mjs`. Model rungs so far: recipe-test a/b/c/d,
  validate-recipes, model-mutants. Owed: snapshot, invariants, sensitivity, orchestrator, DB→recipe fidelity.
- **2026-07-24** — **Model QA ladder climbed 4 more rungs.** `model-invariants.mjs` (L5, 800 randomised
  scenarios + determinism — proven-teeth via a heal-uncap mutant only it catches); `model-sensitivity.mjs`
  (L6, 9/9 directions + HP-not-ATK carve-outs); `model-mutants.mjs` now 12/12 killed 100% (suite = a/b/c/d +
  invariants + sensitivity); **`model-qa.mjs` orchestrator** — one command, 4-bucket scorecard, VERDICT
  SPEC-CONFORMANT (8 rungs green, 39 deferred clauses tracked as unimplemented, layers 7–10 not-scored /
  Simulator-side). The orchestrator caught that `sim-validate-recipes` couldn't see passive `triggers`/
  `modifiers` → fixed `coverageText` to read them (0 REVIEW again). Owed: snapshot, DB→recipe fidelity.
- **2026-07-24** — **Model QA ladder COMPLETE — 10 rungs, all green, VERDICT SPEC-CONFORMANT.** Added
  `model-snapshot.mjs` (regression: 29 fingerprints frozen in `test/snapshots/model-snapshot.json`, re-bless
  via SNAPSHOT_BLESS=1) and `model-fidelity.mjs` (L1 DB→recipe fidelity: 21 damage recipes reflect
  damage_multiplier + multiplier_type — the check that would've caught Vergis DEF-as-ATK). Full ladder:
  teeth(100%) · toy a/b/c/d · invariants(L5) · sensitivity(L6) · snapshot · coverage(L1) · fidelity(L1),
  all under `tools/model-qa.mjs`. Only optional item left: formalise the scoped hand-calc golden (L4).
- **2026-07-24** — **Model QA ladder FULLY COMPLETE — 11 rungs, all green.** Added `model-golden.mjs` (L4
  scoped hand-calc golden: Dragon-16 turns 1–8, actor·skill·exact-damage hand-derived, reports first
  divergence — catches composition bugs the single-recipe snapshot can't). Every layer of the LOCAL half of
  the Simulator QA Protocol is now built: L1 coverage+fidelity · L2/3 toy a/b/c/d · L4 golden · L5 invariants ·
  L6 sensitivity · meta teeth(100%)+snapshot · orchestrator `model-qa.mjs`. VERDICT SPEC-CONFORMANT.
  Next in order: (b) resume building Model mechanics from the deferred backlog (each now lands into a QA'd
  ladder), or (c) Simulator-side layers 7–10 (reality) once plumbing graduates.
- **2026-07-24** — **(b) mechanics: Ezio Perfect Veil built.** `round_start` trigger places [Perfect Veil]
  on self (untargetable — consumer is engine `chooseSingleTarget`). New `installRecipeRun(state)` wires
  recipeAct + start-of-turn/round triggers + battle-start round buffs (engine gained a `state.onTurnStart`
  hook; harnesses sim-run/model-golden use it). Toy battle in sim-recipe-d-test (veil placed + lowest-HP
  veiled Ezio skipped). Ladder still SPEC-CONFORMANT (golden turns 1–8 unchanged, teeth 100%). ⚠ OBSERVATION
  (Simulator-side, NOT a Model-QA issue): the connected run shifted victory→boss-wipe — veil-skip happens
  BEFORE taunt in chooseSingleTarget, so during taunt gaps Ezio's single-target incoming redistributes onto
  squishier allies. Flag for the reality layer (real Ezio = 3,820 taken, all 5 survive), not to chase now.
- **2026-07-24** — **(b) mechanics: ignore-shield.** `dealDamage` gained an `ignoreShield` param (bypasses
  [Shield]/[Magma Shield] straight to HP); `dealOneHit` passes the formula `ignore_shield` flag. Set on
  F_EZIO_A3, F_FACELESS_A3, F_LUA_A3 — clears 3 deferred clauses. Toy battle in sim-recipe-c-test (Faceless
  A3 bypasses a 5k shield → HP, shield intact; normal skill absorbed). Teeth mutant added → 13/13, 100%.
  The test caught a real interaction: Ezio A3 STEALS buffs before attacking, so no shield remains to ignore.
- **2026-07-24** — **(b) mechanics: Pelops passive immunities** ([Stun]/[HP Burn]/[Petrification]).
  `PELOPS-PASSIVE.immune` list; `installRecipeRun` applies passive immunities per ally (new
  `passiveImmunities()` helper); consumer is the existing `placeDebuffs` immune check. Toy battle in
  sim-recipe-d-test (HP Burn blocked on Pelops, lands on a control ally); teeth mutant → 14/14, 100%.
  Coverage validator `coverageText` now reads the `immune` field (0 REVIEW). Deferred backlog 39→37.
  Three (b) mechanics done this session: Perfect Veil · ignore-shield · immunities — each into the QA'd ladder.
- **2026-07-24** — **(b) mechanics: buff→stat CONSUMER** ([Increase/Decrease ATK/DEF] fold into damage).
  `engine.statFactor(c, stat)` folds same-stat buffs/debuffs into ONE multiplier (non-stacking = max; net
  (1+up)(1−down)); reads each effect's own magnitude → NO constant. `effectiveDef` refactored onto it (adds
  the newly-consumed [Increase DEF] half); new `effectiveScaleStat` routes the ATTACKER's scaling stat, so a
  DEF-scaler (Vergis) under [Increase DEF] hits ×1.6 — offense+defense share ONE consumer, buff inert on neither
  side. Interpreter `formulaBase` uses it. 6 exact toy battles (II-A) + Vergis cross-effect. TEETH generalised
  to mutate engine.js too → 16/16 (100%), both stat mutants killed. GOLDEN re-derived: turns 2/5/6 ×1.5 under
  Bambus A3's team [Increase ATK] 50% — all 15 diffs = exactly round(×1.5), the composed end-to-end proof.
  Highest-leverage build yet: lights up the top-of-frequency brackets game-wide ([Decrease DEF] 237×,
  [Increase ATK] 182×, [Decrease ATK] 168×, [Increase DEF] 155×). Closed Tagoar-A1 deferred; backlog 37→36.
  SPD-on-turn-order is the clean follow-on (scheduler still reads raw c.spd).
- **2026-07-24** — **GRADUATION STEP 1: turn loop + RNG wired into the Simulator (Dragon subset).**
  `tools/sim-suite.mjs` — the same captured-battle WIN/LOSS test as battle-suite, but `predict()` now
  builds BOTH sides as combatants from real modifier-inclusive stats (gestal `effectiveStats`) and runs
  the seeded MONTE-CARLO (`lib/sim/simulate`, N seeds → win-rate; predict WIN iff rate ≥ 0.5, threshold
  PINNED not fitted). Head-to-head on 108 identical Dragon cases, N=25:
    · turn loop  BALANCED 61.7%  · false-clears 7
    · aggregate  BALANCED 49.4%  · false-clears 21   (battle-suite --by-dungeon)
  = +12.3pp, dangerous false-clears cut by 2/3, NO constant tuned. Confirms the turn loop beats the
  aggregate (which can't clear 50% on Dragon — the "Spider st5==st20" blindness). Headroom is the 41
  FALSE WALLS (real wins called losses): the sim is pessimistic because lifesteal gear-set sourcing for
  the roster path isn't wired (Pelops/tanks under-survive) — that's the next lever. Seam = predict();
  Simulator keeps stats+corpus+metric, imports the whole turn engine. Enemy content gates expansion
  beyond Dragon (only dungeon with a full dungeon_stage_enemies table today).
- **2026-07-24** — **(b) mechanics: SPD turn-order CONSUMER.** `engine.effectiveSpeed(c) = c.spd × statFactor(c,'spd')`;
  `nextActor` (the scheduler) now fills turn meter off effective speed, so [Increase SPD]/[Decrease Speed] —
  previously placed-but-inert — shift turn order. NO constant (statFactor reads each effect's own `value`).
  Consumes 2 effects (Bambus A1 Decrease Speed on enemies, Tagoar A2 Increase SPD on allies); deferred 36→35.
  Teeth: new mutant "SPD ignored by scheduler (raw c.spd)" killed by model-sensitivity → 17/17, 100%. New L6
  directions (Increase→more turns, Decrease→fewer) exercise the real `nextActor` (now exported). **Golden
  re-derived turns 7/8** — the team [Increase SPD] 30% (Tagoar A2 @t2) makes ally Tagoar cut in at t7 ahead of
  the enemies (hand-verified from post-t6 turn meters: time-to-100 Tagoar 0.0904 < Faceless#2 0.1139; at raw
  183 Tagoar would lose = the old order); the Faceless#2→Pelops hit is the SAME 5553, merely displaced to t8.
  A pure reorder. Full DB ladder green (11/11), SPEC-CONFORMANT. Next placed-but-inert consumers: Poison
  Sensitivity (amplify), Reflect Damage.
- **2026-07-24** — **(b) mechanics: Poison Sensitivity CONSUMER.** `engine.poisonSensitivity(c)` reads the
  target's [Poison Sensitivity] `value` (Ezio A2 = 25%); `tickDots` now multiplies each [Poison] tick by
  `(1 + sensitivity)` — a NON-DEF %maxHP amplifier (damage-mechanics.js §Poison Sensitivity). NO constant
  (reads data); non-stacking (max), matching statFactor's refresh-not-stack rule. Clears Ezio A2's amplify
  deferred; deferred 35→34; placed-but-inert 2→1 (only Reflect Damage left). Teeth: new mutant "Poison
  Sensitivity ignored (amplifier dropped)" killed by model-sensitivity → 18/18, 100%. New L6 direction
  exercises the real `tickDots` (now exported): 25% → exactly ×1.25 (5000→6250). Golden unaffected (DoT ticks
  are kind:'dot', outside its damage comparison). Full DB ladder green (11/11), SPEC-CONFORMANT. This is the
  2nd of the handoff's top-2 offense levers for the magnitude gap (HP-Burn ally-splash is the other).
- **2026-07-24** — **(b) mechanics: Reflect Damage CONSUMER + ALL placed-but-inert effects now consumed.**
  `engine.reflectDamage(c)` reads the target's [Reflect Damage] `value` (Vergis A1 = 30%); `dealDamage` now
  makes the ATTACKER take value% of the inflicted `amount` (glossary: "any attacker … takes 15/30% of the
  damage they inflicted"), reflected straight to attacker HP bypassing the attacker's shields (no loop),
  mirroring the existing Magma-Shield reflect. Does NOT lifesteal (not the champion's own attack). NO constant
  (value from data); non-stacking (max). Recorded on BOTH damage paths (applySkill + interpreter dealOneHit).
  ⚠ RULE ASSUMPTION flagged: reflects pre-shield inflicted damage (shield-on-target interaction unconfirmed —
  reality layer to adjudicate). Clears Vergis A1's deferred; deferred 34→33. **Placed-but-inert 1→0: every
  effect the slice PLACES now has a consumer.** Teeth: new mutant "Reflect Damage ignored" killed by
  recipe-d-test → 19/19, 100%. Toy test: 30% of a 10000 hit → 3000 back, no-buff control → 0. Golden held
  (Vergis casts A2 not A1 in turns 1–8). Full DB ladder green (11/11), SPEC-CONFORMANT. Remaining slice work
  is the catalogued-only (📝) C+D triggers/conditions/activations/exceptions — the survival/identity mass.
- **2026-07-24** — **(b) mechanics: Pelops A2 DYNAMIC SCALER.** Expressed as recipe DATA on the formula
  (`F_PELOPS_A2.dynamicScaler = {source:'debuff_turns', of:'self_and_target', pctPer:0.10, capBonus:2.0}`),
  consumed by a generic `interpreter.dynamicScaleFactor` that a champion doesn't hardcode: +10% dmg per TURN
  REMAINING (Σ turnsLeft) on debuffs on self & target, bonus capped +200%. Turn-WEIGHTED, not a debuff count.
  Unknown source/of → FLAG + ×1 (no silent default). NO constant. Cleared 1 of Pelops A2's 3 deferred (ignore-
  DEF-if-HP-Burn + steal+Stun still deferred); deferred 33→32. Teeth: new mutant killed by recipe-test →
  20/20, 100%. Exact tests (hp 100k, defMit 0.6): 0 turns→24,000 · 4→×1.4 33,600 · 7 (self+target)→×1.7
  40,800 · 25→CAP ×3.0 72,000. **Snapshot re-blessed** — PELOPS-A2 drifted 6624→9274 = exactly ×1.4 (the
  scene loads enemies with Poison+Weaken = 4 debuff-turns); verified the change is the scaler, not a
  regression, before blessing. Golden held (Pelops casts A3 not A2 in turns 1–8). Full DB ladder green (11/11).
- **2026-07-24 (SESSION WRAP)** — **GRADUATION + the magnitude gap.** Turn loop + RNG wired into the
  Simulator (`tools/sim-suite.mjs`, seam=`battle-suite.predict()`): Dragon subset 61.7% vs aggregate 49.4%.
  Leader aura + lifesteal + recipes now active in the metric. Gear-set-id map FIXED from the game's
  `ArtifactSetKindId` enum (id 9 = Lifesteal). `tools/sim-inputs.mjs` = battle-start stat dump. Diagnostic
  thread: the sim under-survives Dragon-16 (reality: full team 11/11; sim ~50% bimodal). Localized: NOT the
  RNG — the sim models a near-tie (offense 3.3× too LOW, incoming 3–6× too HIGH), so crit swings it. Coeffs
  are KNOWN (Bambus 3.8/5.6 ATK, Pelops 0.25/0.4 HP) → IMPLEMENT missing mechanics (HP-Burn splash, Poison
  Sensitivity, masteries, Perfect-Veil-untargetable, Ally Protection), do NOT tune. Full cold-start:
  `knowledge/HANDOFF_2026-07-24_simulator-graduation-and-magnitude-gap.md`.
