# Recipe Authoring — the agent's guide to decomposing a champion into a sim recipe

You are handed **one champion's verbatim skill text** (`champion_skills.skill_summary`, the source of
truth — never paraphrase from memory) and you produce a **recipe**: a per-skill, executable decomposition
the turn engine runs. This doc is the template, the op vocabulary, and the rules.

A recipe is **not a description like a tag** — it is *code that runs*. A wrong op does not look wrong; it
silently mis-simulates. So the discipline below is not bureaucracy, it is the only thing that keeps 29
champions authored by parallel agents from producing recipes that look right and model 3 of a skill's 5
effects.

---

## THE ONE HARD RULE

> **Every clause of the skill text becomes either an `action` (a modelled op) or a `deferred` entry (with
> a reason). Nothing is silently dropped.**

A skill has multiple parts; each part is a separate mechanic. "Attacks all enemies, places Decrease DEF,
places Poison, heals self, fills own turn meter" is **five** mechanics. Miss one and the sim is wrong in a
way no one sees. The `deferred` array is how a clause you cannot model is *recorded* instead of lost — it
is the "no orphan clauses" check made concrete. This rule is validated: the 51 real `deferred` entries
across the existing recipes are every effect the recipes ever leaked, and all 51 map to a column below.

---

## THE PER-CLAUSE TEMPLATE

For **each skill**, write a header, then decompose the text into **one row per clause**. Every row answers:

1. **Order (`seq`)** — position in the skill. Damage before debuffs; "then"/"instead" clauses are
   order-dependent (a branch replaces earlier clauses).
2. **Action (`op`)** — the verb. Map to an op from the vocabulary below, or → `deferred` if none fits.
3. **Recipient — who receives it** — `self` · one enemy · all enemies · one/all allies · the attack target.
   *The recipient decides the mechanic's identity* — self-revive ≠ ally-revive; self-buff ≠ ally-buff.
4. **Target selection — how enemies are chosen** — `single` · `all_enemies` · random · `lowest_hp_ally` ·
   Taunt · `boss_else_all_enemies`.
5. **Effect payload** — the named effect (`[Decrease DEF]`), **magnitude** (60%), **duration** (turns),
   and **stacking** (stacks? refresh? max? per-hit accumulation?).
6. **Chance** — base % (75%), plus any **scaling** (+5% per alive enemy), on-crit, or guaranteed (100%).
7. **Accuracy check?** — enemy debuffs roll ACC vs RES (`accuracy_check: true`); ally buffs / heals /
   self-effects do NOT. A debuff that "cannot be resisted" skips the check.
8. **⭐ Scaling source** — what the value comes off: **ATK** (attack damage) · **caster MAX HP** ·
   **target MAX HP** (Poison / HP Burn — **DEF-independent**, DEF shred does nothing to it) · flat.
   Getting this wrong is the classic error (Decrease DEF boosts ATK damage, not DoTs).
9. **Restriction / condition** — gating: "if all allies dead" (a *branch*) · "on a critical hit" ·
   "if target under [X]" · "except bosses" · self-prerequisite ("while under [Veil]") · **ally/faction-gated**
   ("with an Argonites ally") · resistance-bypass.
10. **⭐ Consumer / pairing** — for every buff/debuff you PLACE, name what READS it. If the effect is not in
    the Consumer Registry below, **placing it is inert → mark it `deferred`**. This is the single biggest
    historical leak ("`[Fervor]` placed, nothing consumes it"). A placed effect with no consumer does
    nothing but *looks* modelled.
11. **⭐ Trigger / cadence** — for passives and per-hit riders: *what fires it and how often*. "Whenever an
    ally is killed" · "once per enemy skill" (which may re-fire per hit on a multi-hit) · per-hit vs
    per-skill · per-kill count. Cadence bugs (per-hit stacking, re-fire rate) are their own miss class.
12. **Coverage decision** — the row ends in a named **op** (with params) **or** a **`deferred`** reason.

(⭐ = the three columns the history proved non-negotiable and that a naive template forgets:
scaling-source, consumer/pairing, trigger/cadence.)

---

## THE OP VOCABULARY (the shared master list — compose from this, don't invent)

These are the ops the interpreter dispatches. Use an EXISTING op wherever the mechanic fits; only propose a
new op (via `deferred: "needs op: <name> — <what it does>"`) when none does.

| op | what it does |
|---|---|
| `ACQUIRE_TARGETS` | pick the skill's target set (pairs with a `target:` enum) |
| `DEAL_DAMAGE` | an attack hit (ATK-based; needs a `formulaId`) |
| `PLACE_DEBUFF` | put a debuff on enemies (ACC-checked) |
| `PLACE_BUFF` | put a buff on allies/self |
| `HEAL` | heal (pct of caster MAX HP, or flat) |
| `BOOST_SHIELD` | grant/add a Shield |
| `REVIVE` | bring dead allies back |
| `CLEANSE` | remove debuffs from allies (all / N random / by type) |
| `STEAL_BUFF` | take an enemy buff for the caster's side |
| `TRANSFER_DEBUFF` | move debuffs from self/ally to enemies |
| `SPREAD_DEBUFFS` | copy debuffs from the target to other enemies |
| `EXTEND_EFFECT` | lengthen an existing effect's duration |
| `REDUCE_EFFECT_DURATION` | shorten an existing effect (or decrease buffs) |
| `FILL_TURN_METER` | add turn meter (allies/self) |
| `REDUCE_TURN_METER` | drain enemy turn meter |
| `INCREASE_COOLDOWN` / `DECREASE_COOLDOWN` | change enemy / own skill cooldowns |
| `DEBUFF_ACTIVATION` | force existing enemy DoTs to tick now |
| `PLACE_BOMB` | place a [Bomb] (detonates after N turns) |
| `SELF_DAMAGE` | the caster takes damage |
| `SELF_RECOVER_ON_BURN` | caster self-heal tied to HP Burn |

Common mechanics with **no op yet** (recurring — high value to build once): **join-attack** (Glorious
Pallas A1, Mavara A1, Michelangelo A4), **equalize-HP** (Mavara), **damage-based self-heal** (Hordin),
**extra-turn** (exists but several recipes unwired), **buff-strip from enemies** (Hilvi — distinct from
`STEAL_BUFF`), **on-kill / on-resist reactive triggers**. If your champion needs one, defer it with a
`needs op:` note so the gap is counted, not re-solved per champion.

---

## THE CONSUMER REGISTRY (the source of truth for column #10)

**A placed buff/debuff only does something if the engine READS it.** These — and ONLY these — are read
today. Placing anything else is **inert → `deferred`**.

**Buffs the engine consumes:** Increase ATK/DEF/SPD, Increase ACC, Increase C.RATE, Shield, Magma Shield,
Block Damage, Unkillable, Continuous Heal, Reflect Damage, Strengthen, Ally Protection, Taunt/Provoke,
Perfect Veil/Veil.

**Debuffs the engine consumes:** Decrease Attack/Defense/Speed, Decrease ACC, Poison, HP Burn, Leech, Bomb,
Poison Sensitivity, Heal Reduction, Enfeeble, Stun/Freeze/Sleep/Petrification.

Everything else — `[Block Debuffs]`, `[Fervor]`, `[Increase RES]`, `[Weaken]`, `[Block Buffs]`,
`[Counterattack]`, `[Increase C.DMG]`, … — has **no consumer**. You still record it, but as
`deferred: "[X] placed, no engine consumer — inert"`. Do NOT put it in `actions` as if it works.

**Damage-scaling rules (column #8) you must honour:** DEF shred (`Decrease DEF`, `[Ignore DEF]`) boosts
ONLY attack (ATK-vs-DEF) damage. Poison / HP Burn / Warmaster scale off the **target's MAX HP** and are
**DEF-independent** — never credit DEF shred against them.

---

## ENUMS (use these exact strings)

- **`phase`** (when in the skill): `skill_start`, `before_attack`, `per_target`, `after_hit`, `after_skill`.
- **`target`**: `single`, `all_enemies`, `boss_else_all_enemies`, `current_target`, `intended_set`, `self`,
  `allies`, `all_allies`, `all_allies_except_self`, `all_dead_allies`, `dead_ally`, `lowest_hp_ally`, `random_ally`.
- **`repeat`**: `once` | `per_target`.
- **`effect`** object: `{ type, magnitude, duration, chance, accuracy_check }` (+ stacking notes in text).

---

## THE DECOMPOSITION RULESET (how to split clauses correctly — from the Tag Review Policies)

These stop two clauses being conflated or one being mis-identified:

- **Activation ≠ placement.** "Instantly activates [Poison]" is `DEBUFF_ACTIVATION`, NOT a Poison placement.
- **The recipient decides the mechanic.** Self-revive vs ally-revive; self-buff vs ally-buff; damage OUT of
  a MaxHP pool vs *shrinking* MaxHP — different mechanics.
- **Removal ≠ placement.** "Removes all [Increase DEF] from enemies" is a strip, not a placement; "removes
  debuffs from allies" is `CLEANSE`; "steals buffs" is `STEAL_BUFF`.
- **Ignore/bypass ≠ placement.** "ignores [Shield] and [Strengthen]" places neither.
- **Self-condition ≠ placement.** "while this Champion is under [Veil]" is a *condition*, not a Veil she places.
- **Conditional debuff (needs another debuff first):** only its own row if the SAME champion places the
  prerequisite; else note the dependency.
- **Resistance-bypass keeps the placement.** "cannot be resisted if…" modifies the ACC check, not whether
  the debuff is placed — still a normal `PLACE_DEBUFF`, `accuracy_check` off under the condition.
- **Model paired mechanics together.** A Poison placer is worthless if nothing ticks/consumes; a
  Heal-Reduction that enables a partner's Poison is a pair. (This is column #10.)

---

## WORKED EXAMPLES

### Uugo A2 — *"Attacks all enemies. 75% chance of 60% [Decrease DEF] 2t. 50% chance of [Block Buffs] 2t (+5%/alive enemy)."*
```
header: A2 · active · cooldown 4 · single hit · target all_enemies
row 1  ACQUIRE_TARGETS all_enemies ; DEAL_DAMAGE (ATK, formulaId F_UUGO_A2)
row 2  PLACE_DEBUFF  [Decrease Defense] mag 60 dur 2 chance .75 accuracy_check:true   (consumer: statFactor ✓)
row 3  DEFERRED: "[Block Buffs] 50% (+5%/alive enemy) 2t — no engine consumer — inert"
```

### Uugo A3 — the branch case *(5 mechanics, mutually-exclusive on "all allies dead")*
```
row 1  CLEANSE all_allies type=[Heal Reduction] (all)          [else-branch]
row 2  CLEANSE all_allies count=1 random                        [else-branch]
row 3  HEAL   all_allies pct=20 of CASTER MAX HP                [else-branch]  (accuracy_check:false)
row 4  REVIVE all_dead_allies hp=50%                            [if all allies dead → replaces 1–3]
row 5  FILL_TURN_METER revived allies 50%                       [if all allies dead]
```

### Glorious Pallas A1 — *"Attacks 1 enemy with 1 random Argonites ally (ally uses its default skill). Heals all allies 10% of MAX HP."*
```
row 1  ACQUIRE_TARGETS single ; DEAL_DAMAGE (ATK)
row 2  HEAL all_allies pct=10 of CASTER MAX HP                  (consumer: heal ✓)
row 3  DEFERRED: "1 random Argonites ally joins the attack with its default skill — needs op: JOIN_ATTACK
        (recurs: Mavara A1, Michelangelo A4). Restriction: an Argonites ally must be on the team."
```
All three clauses are accounted for — two modelled, one recorded. Nothing leaked.

---

## THE RECIPE OBJECT YOU OUTPUT

Keyed `CHAMPKEY-SLOT` (e.g. `UUGO-A2`), canonical champion name resolved via the registry (never a raw
display name):
```js
{
  champion: 'Uugo', slot: 'A2', name: 'Maelstrom Wrack', type: 'active', cooldown: 4,
  actions: [
    { seq: 10, phase: 'skill_start', op: 'ACQUIRE_TARGETS', target: 'all_enemies', repeat: 'once' },
    { seq: 20, phase: 'per_target',  op: 'DEAL_DAMAGE', target: 'current_target', repeat: 'once', formulaId: 'F_UUGO_A2' },
    { seq: 30, phase: 'after_hit',   op: 'PLACE_DEBUFF', target: 'intended_set', repeat: 'per_target',
      effect: { type: 'Decrease Defense', magnitude: 60, duration: 2, chance: 0.75, accuracy_check: true } },
  ],
  covers: ['60% Decrease DEF 2t @75%'],
  deferred: ['[Block Buffs] 50% (+5%/alive enemy) 2t — no engine consumer — inert'],
}
```

---

## VERIFICATION (the gate — a recipe is not done until it passes)

1. **Completeness:** every sentence of the skill text is in `actions` OR `deferred`. No orphan clauses.
2. **Consumer:** every PLACE_* effect is in the Consumer Registry, else it's in `deferred` as inert.
3. **Scaling:** each damage/heal row names its source (ATK / caster MaxHP / target MaxHP / flat).
4. **Slotting:** active vs passive vs reactive correct — a no-cooldown reactive mis-slotted as A3 makes the
   champion never attack (the INERT-CHAMPION bug).
5. **Metric:** run `node --env-file=.env.local tools/sim-suite.mjs` — the recipe should move balanced
   accuracy (or a per-champion band). **Implement, don't fit:** a verified game fact that doesn't move the
   number stays; speculative tuning that doesn't move gets reverted. `TRACE=N` walks one fight when a row
   looks off. The turn-verify gate blocks a recipe that leaves a mechanic inert.

---

## AGENT WORKFLOW (per champion)

1. Pull the champion's `champion_skills` (verbatim `skill_summary`) from the DB.
2. For each skill: write the header, decompose into per-clause rows using the template.
3. Map each row to an op from the vocabulary, honouring the Consumer Registry + scaling rules + the
   decomposition ruleset. Anything without a fit → `deferred` with a precise reason (prefix `needs op:` if
   it's a missing mechanic, so the gap is tallied across champions).
4. Emit the recipe object(s) + a list of `needs op:` flags.
5. A recipe that can't reach the metric-verification bar is still valuable as a *decomposition* — the rows
   and deferred reasons are the durable output even before every op exists.

The gaps you flag are the input to the next phase: the most-frequent `needs op:` mechanics get built once
as engine ops, then the blocked champions are re-drafted. That is why the shared master list matters —
build a mechanic once, unlock every champion that has it.
