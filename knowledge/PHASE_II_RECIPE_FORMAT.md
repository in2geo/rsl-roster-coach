# Phase II — Recipe Format Spec (v0, damage scope)

**Milestone 0, Step 1.** This defines how a skill is written as *data* — an ordered recipe of standard
operations — so the engine can execute it instead of guessing from prose. Scope is deliberately narrow:
**II-A (damage execution) only.** Buffs, debuffs, heals, turn meter, triggers come in later milestones and
extend this format; they are out of scope here.

Companion: `PHASE_II_TRACKER.md` (progress) · `Action Verification Model Phase II.docx` (the design).

---

## 1. The core idea

A skill is **not code**. It is an ordered list of **actions**. Each action is one **operation** from a small
vocabulary, aimed at a **recipient**, optionally gated by a **condition**, using a **formula**. The engine
implements each operation once; every champion reuses them.

```
Skill  ─┬─ identity (id, champion, slot, name, cooldown, type)
        └─ actions [ ordered ]
                     └─ action (seq, phase, operation, target, repeat, condition?, formula?)
```

---

## 2. The vocabulary (v0 — closed lists)

Authoring in Step 2 may use **only** these values. Anything that doesn't fit gets flagged `Review Required`,
never invented — same rule as the rest of the engine (emit a flag, never a silent default).

**Phases** — *when* in the turn an action runs:
`skill_start` · `per_target` · `per_hit` · `after_hit` · `after_skill`

**Operations (damage scope):**
| Operation | What it does | Backed by (existing code) |
|---|---|---|
| `ACQUIRE_TARGETS` | build the set of units this skill hits (may be conditional) | `chooseSingleTarget` / `alive(opponents)` |
| `DEAL_DAMAGE` | resolve one damaging hit against a recipient | `dealDamage` + `skillBase` + crit/affinity/DEF |

*(Later milestones add PLACE_DEBUFF, PLACE_BUFF, HEAL, FILL_TURN_METER, REVIVE, triggers, … — same shape.)*

**Recipients** — *who* an action is aimed at (the doc's key distinction; don't collapse to one `target`):
| Recipient | Meaning |
|---|---|
| `selected` | the unit the targeting rule chose |
| `intended_set` | everyone the skill means to hit (e.g. all enemies) |
| `current_target` | the unit being processed in a `per_target` loop |
| `hit_recipient` | who actually receives a hit after redirect/protection |
| `self` | the acting champion |

**Formula flags** — toggles on a `DEAL_DAMAGE` (default in **bold**):
`crit` (**on**) · `affinity` (**on**) · `def_mitigation` (**on**) · `variance` (**off**) · `ignore_def` (off) ·
`damage_cap` (off) · `hit_count` (**1**)

**Condition operands** — for gating an action or a target choice:
| Operand | Example |
|---|---|
| `enemy_debuff_count` | number of debuffs on the target / enemies |
| `target_hp_pct` | `< 0.50` |
| `hit_was_critical` | `= true` |

---

## 3. The data shape

Each piece is small and typed. (Written here as objects; in Step 2 these live in one fixture file, later in
the workbook.)

**Action**
```
{ seq: 10,                      // resolution order
  phase: "skill_start",         // from the Phases list
  op: "ACQUIRE_TARGETS",        // from the Operations list
  target: "intended_set",       // from the Recipients list
  repeat: "once",               // once | per_hit | per_target
  conditionId: "C_BAMBUS_AOE",  // optional
  formulaId: null }             // optional (DEAL_DAMAGE has one)
```

**Formula** (damage) — stored as *components*, never as engine code:
```
{ id: "F_BAMBUS_A1",
  scalingStat: "ATK",           // attacker's own stat
  multiplier: null,             // [from reference — Step 2]
  terms: null,                  // for multi-term skills: [{coeff, stat}, ...]
  flags: { crit:true, affinity:true, def_mitigation:true, variance:false,
           ignore_def:false, damage_cap:false },
  hitCount: 1 }
```

**Condition** — structured, not prose:
```
{ id: "C_BAMBUS_AOE",
  left: "enemy_debuff_count", comparator: ">=", right: null }  // threshold [from reference — Step 2]
```

---

## 4. Worked example — Bambus A1 (the conditional AoE)

The case Mike flagged: **Bambus's A1 attacks all enemies when enough debuffs are present, otherwise one
enemy.** A static `aoe: true/false` can't express this; a condition on `ACQUIRE_TARGETS` can.

```
Skill  BAMBUS-A1  ("...", slot A1, cooldown 0, active)
  actions:
    ┌ seq 10 · phase skill_start · op ACQUIRE_TARGETS · repeat once
    │     targetIf:
    │        condition C_BAMBUS_AOE  (enemy_debuff_count >= THRESHOLD)
    │        then → intended_set = all enemies
    │        else → intended_set = 1 enemy (lowest HP%)
    │
    └ seq 20 · phase per_target · op DEAL_DAMAGE · target current_target · repeat once
          formula F_BAMBUS_A1  (multiplier × ATK; crit/affinity/DEF-mitigation on; variance off)
          hitCount 1
```

Same fight, same champion — the recipe **branches on battle state at cast time**, which is the whole point.
On the Dragon-16 team the enemies are debuff-loaded, so `C_BAMBUS_AOE` passes and A1 fires AoE, matching
what Mike sees. Two values are marked **[from reference — Step 2]**: the debuff threshold, and the A1
multiplier. The format *shows the holes*; Step 2 fills them from the reference material.

**Contrast — a plain AoE (no condition):** a skill that always hits all enemies just drops the `targetIf`
and sets `target: intended_set = all enemies` directly. The conditional case is the interesting one; the
simple case is a subset of it.

---

## 5. The output of a hit (structured resolution)

When `DEAL_DAMAGE` runs it must produce a *structured result*, not just subtract HP — so "did the target
take the hit?" is never ambiguous. Damage-scope fields (extends later):

```
{ selected: "Vergis", eligible: true, redirected: false, hit_recipient: "Vergis",
  weak_hit: false, critical: true, raw_damage: 42180,
  shield_damage: 12000, hp_damage: 30180, survived: true }
```

This is the same information the current **FIRED / CONSUMED effect ledger** already records — v0 keeps that
ledger as the output, just structured per the fields above. Nothing new to invent; we're naming what's there.

---

## 6. How it reuses the existing engine (migration, not rebuild)

The interpreter (Step 3) walks the actions in `seq` order and, per operation, calls code we already have and
have reality-checked:

| Operation | Calls today's… |
|---|---|
| `ACQUIRE_TARGETS` | `alive(opponents)` for AoE; `chooseSingleTarget(opponents, avoid)` for single (keeps veil/taunt rules) |
| `DEAL_DAMAGE` | `dealDamage(...)` with `skillBase × critMult × defMitigation(effectiveDef) × affinityFactor × dmgVariance` |

RNG is untouched — the same seeded streams (`damage`, `crit`, `affinity`) feed the same rolls. `seed=null`
stays deterministic, so the teeth-tests don't move.

---

## 7. Step 2 hand-off — what authoring must supply per skill

For each of the 5 champions' damaging skills, Step 2 fills:
- [ ] the ordered actions (usually ACQUIRE_TARGETS + DEAL_DAMAGE)
- [ ] the formula (scaling stat, multiplier / terms, hit count, any non-default flags) — **[from reference]**
- [ ] any targeting condition + its threshold — **[from reference]**
- [ ] a `Review Required` mark on anything the reference doesn't cleanly give

Deferred to later milestones (do NOT author now): debuffs Bambus/Ezio place, poison, shields, taunt,
turn-meter, passives, poison explosion. Those are II-B…II-E and extend this format.

---

## 8. Open questions — RESOLVED from the DB (2026-07-23)

These were answerable from `champion_skills`, not from Mike. Verified source: `PHASE_II_SLICE_SKILLS.md`.

1. **Bambus A1 condition** — RESOLVED. **`initial (selected) target is under 2 or more debuffs` → attack all
   enemies** (else 1 enemy). `C_BAMBUS_AOE` = `target_debuff_count >= 2`. Multiplier = **3.8 x ATK**.
2. **Bambus's second AoE** — RESOLVED. **A2 "Grovetender", 5.6 x ATK, cd 4**, always AoE (a support AoE:
   shields all allies first, extends ally buffs, strips enemy buffs after — those clauses defer to II-B/C).
3. **Weak-hit debuff-blocking** — RESOLVED. **Deferred to II-B** with the debuff logic (the damage-side weak
   hit stays in II-A).

**Standing rule this established:** author only from verified DB skill text (`PHASE_II_SLICE_SKILLS.md`), and
read `multiplier_type` for the scaling stat — it is **not always ATK** (Pelops = HP, Vergis = DEF).

---

## 9. II-B extension — PLACE_DEBUFF / PLACE_BUFF (buffs & debuffs)

Two operations added for standard buffs/debuffs. SCOPE = **placement**, not the stat-effect of a placed buff
(a placed effect is only "live" where a consumer already exists — Decrease Defense → damage, Poison → DoT;
others are placed-but-flagged pending a consumer).

**PLACE_DEBUFF** — on each enemy in the intended set. Resolution pipeline (each step verifiable):
`immunity block → STAGE 1 placement chance (debuff stream) → STAGE 2 ACC vs RES (landChance, unless unresistable) → apply(duration, stacking)`.
```
{ seq, phase: 'after_hit', op: 'PLACE_DEBUFF', target: 'intended_set', repeat: 'per_target',
  effect: { type: 'Decrease Defense', magnitude: 60, duration: 2, chance: 0.75,
            accuracy_check: true, unresistable: false, stacking: false, count: 1 } }
```
Required fields (validation flags a missing one): `type`, `duration`, `chance` (or guaranteed), `accuracy_check`.
Use the ENGINE's debuff type names so existing consumers fire: `Decrease Defense`, `Decrease Attack`, `Poison`
(pct + stacking), `Weaken`, `HP Burn`. `count` places N copies (Poison ×2). `unresistable` skips stage 2.

**PLACE_BUFF** — on a resolved RECIPIENT (the design-doc "effect recipient" distinction):
`self · all_allies · lowest_hp_ally · random_ally (target stream) · intended_set`. Optional `chance`.
```
{ seq, phase: 'after_skill', op: 'PLACE_BUFF', target: 'lowest_hp_ally', repeat: 'once',
  effect: { type: 'Increase DEF', magnitude: 60, duration: 2 } }
```

**Verified (`tools/sim-recipe-b-test.mjs`, 8/8):** placement-chance rate ≈ chance; ACC/RES rate ≈ chance ×
landChance; immunity → 0; duration set; Poison stacks; lowest-HP / all-allies / random recipients; buff chance.

**Interpreter reuse:** `landChance` / `rollLand` / `rollChance` / `applyDebuff` / `upsert` from engine.js —
buffs/debuffs behave identically to the old path. RNG untouched (debuff stream for procs, target stream for
random recipient).
