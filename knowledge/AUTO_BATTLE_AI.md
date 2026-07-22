# Auto-battle AI — the rules the game actually follows

**Source: Mike, 2026-07-22, from in-game knowledge. Tier-1 for our purposes.**
**Status: NOT CAPTURED IN THE DB. Not modelled anywhere.** This document is currently the only
record — do not let it stay that way (see §5).

> ⚠ **WHY THIS MATTERS MORE THAN IT LOOKS.** CLAUDE.md's first architecture principle is
> *"recommend for AUTO-BATTLE"* — ~99% of the audience plays on auto. So these rules are not a
> detail of the simulation, they ARE the thing being predicted. A capability the AI won't fire is
> a capability the player does not have.

---

## 1. Skill priority — furthest-right first

Unless overridden in the Team Setup menu, every champion has a default hierarchy:

1. **A3** — the AI will almost always cast the furthest-right skill first, if off cooldown.
2. **A2** — used if A3 is on cooldown.
3. **A1** — the default attack, used only when all other active skills are on cooldown.

*(Extends naturally to A4 where present — furthest-right first.)*

**This settles a v0 design assumption** and resolves an apparent contradiction: Mike observed that
Pelops "uses his taunt second." He casts A3 **first**; he simply doesn't **move** first — his SPD is
**141** against spiderlings at **150**. Skill order and turn order are two different things and must
not be conflated. See [[SPIDER_TARGETING_MODEL]].

## 2. Condition-based triggers — these OVERRIDE the A3→A2→A1 order

These are the important ones, because they are conditional on battle STATE and therefore
inexpressible as any kind of average or uptime ratio.

| trigger | rule |
|---|---|
| **Revivers** | **Revive skills are strictly LOCKED until a teammate is dead.** The AI completely ignores a revive skill's *secondary buffs* while everyone is alive. |
| **Execution skills** | Bonus-damage-when-low skills (Huntsman, Cruetraxa style) are **skipped** until an enemy is in the executable range. |
| **Healers / Cleansers** | NOT one rule — see §2b. The AI **classifies the skill by its composition**, and the classification decides everything. |

### 2b. Healing is a TAXONOMY, not a threshold (Mike, 2026-07-22)

The trigger depends on **what else is stapled to the heal**:

| class | condition | AI behaviour |
|---|---|---|
| **Pure heal, single-target** | heal only, no buffs | **hoards** until an ally is below **~75%** HP |
| **Pure heal, AoE** | heal only, no buffs | **hoards** until one or two allies are below **~50-60%**. At 80% health it ignores the skill entirely |
| **Heal + secondary BUFF** | also places `[Continuous Heal]`, `[Increase DEF]`, `[Shield]`, or Turn Meter | **reclassified as a BUFF skill — fired on Turn 1 of Round 1 at 100% team HP**, wasting the raw heal (e.g. Bad-el-Kazar, Opardin Clanfather) |
| **Heal + CLEANSE** | also removes debuffs | **triggered by DEBUFF STATUS, not HP.** Held at full health; fires the moment dangerous CC (Stun/Freeze) lands. The heal is a byproduct |

### ⭐ THE GENERAL PRINCIPLE — composite skills get ONE classification, and the other half is wasted

The AI buckets a skill by one component and plays it accordingly. Whichever component did **not**
drive the classification is spent at the wrong moment:

- **revive + buffs → the REVIVE governs.** Held until a death; **the buffs never land proactively.**
- **heal + buffs → the BUFFS govern.** Fired at full health; **the heal is wasted.**

Note the asymmetry — it is not "the strongest effect wins." A revive suppresses its buffs; a buff
suppresses its heal. **Both directions throw away half the skill**, so a champion's real contribution
is not the sum of its clauses. Any model that reads a kit as a list of capabilities will over-credit
composite supports, and the error is always optimistic.

### ⚠ THE CONSEQUENCE THAT INVALIDATES CURRENT MODELLING

**A reviver cannot prevent the first death. It can only recover from it.**

Worked example — Tagoar's A3 *"Rise And Fight"*: revives all dead allies at 30% HP **and** places a
`[Shield]` worth **20% of his MAX HP** on all allies. Because the AI locks revive skills until
someone dies, **that shield never lands proactively.** A sustain estimate that amortises it across
the cooldown (`4,831 ÷ cd 7 ≈ 690 per ally per turn`) is not merely imprecise — **it is zero until a
death occurs**, and wrong in the OPTIMISTIC direction.

This is the mechanical form of Mike's two independent field reports:
- Ice Golem: *"Fahrakin and Ezio die on wave 2, Tagoar revives… they die again half way through the
  boss… revived again and we win."*
- Dragon: *"the wall is Wave 2 because Tagoar can't keep everybody alive through revive and heal."*

He is not underbuilt for prevention. **The AI structurally will not let him prevent.**

### ⚠⚠ TAGOAR IS HIT BY BOTH RULES AT ONCE — his whole sustain kit is mistimed

| skill | text | class | AI behaviour |
|---|---|---|---|
| **A2** *Charge Cant* (cd5) | "Places a 30% `[Increase SPD]` buff on all allies… **then heals all allies by 15% of this Champion's MAX HP**" | **heal + secondary buff** | **fires off cooldown at full HP** — the 3,624 heal lands whenever, not when needed. Overheals |
| **A3** *Rise And Fight* (cd7) | "Revives all dead allies… also places a `[Shield]` = **20% of this Champion's MAX HP** on all allies" | **revive + buff** | **locked until a death** — the 4,831 shield never lands proactively |

**Neither of his two sustain skills arrives when it is needed.** The heal is fired early and wasted;
the shield is held until after the damage. That is the mechanism behind *"Tagoar can't keep everybody
alive"* — and it is a property of the AI's classification, not of his gear.

Correcting an amortised estimate given in conversation 2026-07-22: **A2 at `3,624 ÷ 5 ≈ 725 per ally
per turn is roughly right in VOLUME** (it does fire every cooldown) **but wrong in TIMING** (overheal
at full HP). **A3 at `4,831 ÷ 7 ≈ 690` is simply ZERO** until someone dies.

**What it breaks in code:** `damage-mechanics.js:321`
```js
estimateUptimeTurns = fightTurns * (durationTurns / cooldownTurns)
```
This assumes a skill fires every cooldown. For a reviver it fires ~never; for a hoarded healer it
fires only under a state condition. Our single existing temporal approximation is wrong in exactly
the case that decides fights.

## 3. Target selection (OUR champions choosing enemies)

- **Default focus: the enemy with the LOWEST CURRENT HP PERCENTAGE** — the AI tries to secure a kill.
- **Buff avoidance:** it actively avoids enemies under `[Unkillable]` or `[Block Damage]`, unless
  that enemy is the only target left or the skill removes buffs.

⚠ **Do not confuse this with ENEMY targeting of us**, which is a separate hierarchy — for Spider it
is weak-affinity → taunt → lowest HP% → lowest max HP (see [[SPIDER_TARGETING_MODEL]]).

**Consequence:** single-target damage FUNNELS into whatever is already wounded rather than spreading.
A team can have "enough damage" on paper and still fail to clear a wave in time.

## 4. How this enters a turn loop

```
selectSkill(actor, state):
  for slot of [A4, A3, A2]:                   // furthest-right first
    if onCooldown(slot)                        continue
    if isRevive(slot)  and no ally dead     -> skip      // hard lock
    if isHeal(slot)    and minAllyHpPct > T -> skip      // hoard, T ~= 0.5-0.75
    if isExecute(slot) and no enemy low     -> skip
    return slot
  return A1

selectTarget(actor, enemies):
  candidates = enemies.filter(e => !e.hasAny(['Unkillable','Block Damage'])) || enemies
  return minBy(candidates, e => e.hp / e.maxHp)
```

## 5. WHERE THIS SHOULD LIVE — and the standing defect

`migrations/2026-07-15_skill_ai_configs.sql` defines a table with **exactly these fields**:
`(always_use | never_use | conditional | default)`, `condition`, **`priority`**, `ai_condition_notes`,
`auto_reliable`. Plus `migrations/2026-07-14_champion_skills_auto_reliable.sql`.

**Both were written and NEVER APPLIED.** Verified live 2026-07-22: `champion_skills.auto_reliable`
does not exist; `skill_ai_configs` returns 404. `reliabilityFactor()` consumes `autoReliable`, always
receives null, and that is the origin of the **1,092× top item in the gap backlog** ("debuff
reliability not assessable") — 3.6× larger than anything else.

**So the schema for this was designed a week ago and has been sitting empty. Now there is content to
put in it.** Applying those two migrations and seeding the rules above is the concrete next step.

## 6. Open questions (do NOT guess — ask Mike)

1. ~~Is the healer hoard threshold global or per champion?~~ **ANSWERED 2026-07-22 — see §2b.** It is
   a taxonomy driven by the skill's composition, not a single threshold.
2. **What HP% counts as "executable"** for execution skills?
3. **Do the Team Setup skill overrides matter for our users?** In-game AI settings are
   **unreadable from memory** (see the ai-settings memory) and must be hand-entered — so the
   DEFAULT behaviour above is what we should model, and manual overrides are out of scope until
   there is an entry path.
4. Does the revive lock apply to **any** skill containing a revive clause, or only to skills whose
   primary effect is revive? (Matters for kits where revive rides along with buffs — e.g. Tagoar.)
