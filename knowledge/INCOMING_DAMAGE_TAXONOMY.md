# Incoming-damage taxonomy — design (NOT YET IMPLEMENTED)

**Drafted 2026-07-22. Nothing here is code yet. Awaiting Mike's decisions in §7.**

The mirror of `lib/damage-mechanics.js` §1 (the OUTGOING source taxonomy), for the survival side.
This is the named prerequisite for `incomingDamagePerTurn`, which is the #1 item on both
`MODEL_AS_REIMPLEMENTATION.md` and `GAME_MECHANICS_INVENTORY.md`.

Sourced from the four `*_REVIEW.md` packets (repo root), which CLAUDE.md makes required reading
before touching any dungeon model. **All magnitudes below are quoted from those packets** — see §7
for what that means about their reliability.

---

## 1. Why this is needed — the inversion, explained

The survival half is already built **twice** (`lib/power-model.js` `survivalProxy`/`turnsSurvived`/
`stagePower`, and `lib/contribution-model.js:196-219`) and is switched off in both, for a documented
reason:

> `power-model.js:188` — *"on this ATK-based incoming basis the model INVERTS the per-content wall
> (calls Spider survival-gated / IG kill-gated — the reverse of INS-0016) because IG's real wall is
> the Frigid-Vengeance mechanic spike, not enemy ATK."*

Reading the four packets says exactly why. **Enemy ATK is the primary threat in only ONE of the four
dungeons.** An ATK-only incoming term therefore ranks three of them by a quantity that isn't what
kills you — and worse, it implies "tankier is safer", which is FALSE wherever the damage scales off
*our* max HP rather than the enemy's ATK.

---

## 2. The taxonomy — four damage channels, two modifiers

Structured to mirror `DAMAGE_SOURCES` so the two sides read alike.

| channel | scales off | more HP helps? | more DEF helps? | mitigated by | timing |
|---|---|---|---|---|---|
| `atk_vs_def` | enemy ATK vs our DEF | ✅ yes | ✅ yes | Shield, Ally Protection, Decrease ATK, Increase DEF | per enemy turn |
| `pct_max_hp` | **our** max HP | ❌ **no** | ❌ no | Block Damage, Unkillable, Cleanse / Block Debuffs (it arrives as a debuff) | per turn (DoT) |
| `max_hp_destruction` | **our** max HP, **permanently** | ❌ no | ❌ no | prevention only (Block Debuffs) — cannot be healed back | on trigger |
| `threshold_burst` | event, gated on a CHECK | partial | varies | **passing the check** | not per-turn |

Plus two things that are not damage but decide survival:

| modifier | effect | instances |
|---|---|---|
| `sustain_denial` | multiplies the team's sustain term, sometimes to ~0 | IG minions' Heal Reduction · Spider lifesteal cut to 35% · Spider boss Heal-Reduction-immune |
| `action_denial` | reduces OUR turns → feeds the step-2 speed ratio | Freeze / Stun / Sleep / Decrease SPD / Decrease TM |

**The load-bearing distinction is `pct_max_hp` vs `max_hp_destruction`** — the same split tag policy
#21 already ratified on the outgoing side (`Enemy Max HP Damage` vs `Max HP Destruction`, seed 202).
Damage removes from the pool; destruction **shrinks the pool**, so it compounds across triggers and
cannot be healed back. Different survival math, not pedantry.

---

## 3. Per-dungeon instantiation

### Fire Knight (Fyro) — `max_hp_destruction`, gated on the shield check
- **Shield-start punish** (`FIRE_KNIGHT_REVIEW.md:17`) — if Fyro *starts a turn with the shield still
  up*: AoE that **"reduces MAX HP (up to ~40%)"** AND heals him, **both scaling with the shield's
  remaining strength**. → `max_hp_destruction`, `threshold_burst`-gated.
  **Gate = the hit count, which we already model: 5 (st 1-6) / 7 (7-9) / 10 (10-20) / 12 (21-25).**
- **Searing Storm** (`:19`) — AoE **destroys 15% of MAX HP**, **active from stage 7**.
  → `max_hp_destruction`, unconditional above stage 7. *A stage-indexed discontinuity at 7.*
- **Dazzling Flames CD5** (`:20`) — AoE + 30% Decrease SPD 3t → `atk_vs_def` + `action_denial`.

> Confirms CLAUDE.md's warning: Decrease ATK / Increase DEF do **nothing** here, and a min-HP
> survive-gate is the wrong instrument. FK survival is ~entirely EHP-invariant.

### Ice Golem (Klyssus) — `threshold_burst` keyed to OUR kill progress
- **Frigid Vengeance** (`ICE_GOLEM_REVIEW.md:14`) — fires at **80 / 60 / 45 / 30 / 15% boss HP**
  (five discrete crossings, not per-turn). Hits the whole team, **revives dead minions to 100%**,
  **ignores 50% DEF per alive ally**, and Freezes (20% + **40% per alive minion**).
  **Poison / HP Burn do NOT trigger it.**
- **Numbing Chill CD4** (`:15`) — AoE 50% Decrease ACC 2t. Note this is an **offense** debuff (halves
  our land rate), not incoming damage — it belongs in the ACC path, not here.
- **Minions** (`:13`) — apply **Heal Reduction** (→ `sustain_denial`) + **Decrease DEF** (→ amplifies
  our `atk_vs_def` intake).

> Two consequences worth stating plainly. (a) IG incoming is **event-driven on our own damage
> progress**, so a per-turn ATK model cannot express it at all — which is precisely the inversion.
> (b) DEF-ignore scaling **per alive ally** means a full team takes *more*; that is the opposite
> direction from every intuition the current model encodes.

### Spider (Skavag) — `pct_max_hp`, and a boss that grows
- **Spiderlings** (`SPIDER_REVIEW.md:15`) — spawn constantly, **max 10**, each stacking **5% MaxHP
  Poison**. → `pct_max_hp`, up to ~50%/turn at full stacks. **EHP-invariant: bulk does not help.**
- **Skavag consumes them** (`:16`) — at the start of her turn, heals **3% MaxHP** and gains
  **permanently +10% ATK per Spiderling consumed**. → our `atk_vs_def` intake **grows over the
  fight**; a static per-turn constant cannot represent it.
- **Enfeeble CD4** (`:17`) — AoE −30% TM, Sleep on empty → `action_denial`.
- **Lifesteal / heal-on-damage heals only 35%** (`:20`) → `sustain_denial` ×0.35 on those sources.
- Boss is **Heal-Reduction-immune** (`:19`) → offense-side, not survival.

### Dragon (Hellrazor) — the one dungeon that IS ATK-driven
- **Swipe** (`DRAGON_REVIEW.md:11`) — AoE + 50% Decrease ATK 2t → `atk_vs_def`.
- **Wall of Fire CD3** (`:11`) — AoE + **two 5% Poison** (3t) + 25% Weaken → `atk_vs_def` +
  `pct_max_hp` (~10%/turn while up).
- **Inhale → Scorch** (`:12`), **active from stage 7** — if the purple bar isn't cleared, Scorch
  fires: AoE + **1-turn Stun** → `threshold_burst` gated on a damage race, + `action_denial`.
- **Immune to Decrease TM AND Decrease SPD** (`:13`) — the speed race cannot be won by slowing him,
  only by speeding us up.

---

## 4. The structural payoff — most of this is gated on checks we ALREADY model

This is the finding that changes the scope estimate. Three of the four big threats are not
continuous drains; they are **penalties for failing a check the goal layer already represents**:

| dungeon | burst | fires when | we already model the gate as |
|---|---|---|---|
| Fire Knight | ~40% MAX-HP destruction + boss heal | shield NOT broken this round | hit count 5/7/10/12 vs `Multi-Hit A1` coverage |
| Dragon | Scorch AoE + Stun | purple bar NOT cleared | the "clear the Scorch bar" damage goal |
| Ice Golem | Frigid Vengeance | boss HP crosses a threshold **via non-DoT damage** | `teamDamageSources()` already knows if the team is DoT-based |

So the first version of survival is closer to **`P(fail the check) × burst magnitude`** than to a
turn-by-turn simulation. That is the cheap 80%, and it reuses the goal layer rather than duplicating
it. Only Spider needs a genuine per-turn drain (`pct_max_hp` from spiderling stacks).

---

## 5. Where the step-2 speed ratio is load-bearing

`contribution-model.js:141` computes `turns = fightTurns * c.spd / spdSum` — speed only
**redistributes** a fixed budget among allies, so absolute speed cancels and nothing anywhere
compares our speed to the **enemy's**. `dungeon_stage_enemies.spd` is populated on **150/150 rows,
zero nulls**, and is read by nobody (both consumers select `hp, atk` only).

- **Fire Knight** — the entire mechanic is *land N hits before Fyro's turn*. Speed ratio IS the gate.
- **Spider** — kill spiderlings before stacks accumulate; deny her turn before she consumes them.
- **Dragon** — he is immune to Decrease TM/SPD, so it is a pure speed race by construction.
- **Ice Golem** — least speed-sensitive (threshold-driven).

Minimal form: `enemyTurnsPerTeamTurn = enemySpd / teamSpd`, which converts a per-enemy-turn incoming
figure into the per-team-turn unit `computeContributions` already expects. No new data.

---

## 6. Proposed code shape (for review — not written)

Mirror `damage-mechanics.js` §1 so both sides read alike:

```
INCOMING_SOURCES   = { atk_vs_def, pct_max_hp, max_hp_destruction, threshold_burst }
CONTENT_INCOMING   = { fire_knight: [...], ice_golem: [...], spider: [...], dragon: [...] }
                     // each entry: { source, magnitude, stageFrom?, gatedOn?, note }
incomingPerTeamTurn(team, enemies, { contentKey, stageNumber, gateResults })
                     -> { bySource, total, gatedOn: [...], unmodelled: [...] }
```

`mitigates()` already takes `'direct' | 'dot' | 'self'`; the union extends to carry
`pct_max_hp` / `max_hp_destruction` so `PROTECTION_MECHANICS` keeps working. `Ally Protection`'s
existing note already anticipates this ("Credit vs DIRECT-damage threats… ZERO vs a pure-DoT boss").

**Guardrail:** `SURVIVAL_SCALE = 7.25` in `power-model.js` was anchored on ONE Ice Golem boundary and
is marked "STRONGLY NOMINAL, IG-ONLY". It does **not** get carried over. Wiring it would be *fitting*,
which rule 1 prohibits; the taxonomy goes in first, and that constant is then re-derived or deleted.

---

## 7. DECISIONS NEEDED FROM MIKE (blocking)

1. **Source tier.** All four packets are hand-read from AyumiLove guides — **Tier 2** under
   CLAUDE.md, which permits it for *factual game data*. The mechanic magnitudes (40%, 15%, 5%, 3%,
   +10%, the 80/60/45/30/15 thresholds) come from **skill text**, which is the more reliable half;
   the *stat floors* in the same packets are explicitly image-sourced judgment calls. Is Tier-2
   skill text acceptable as the basis for these constants, or do they need in-game confirmation
   first?
2. **⚠ This exact work was DEFERRED once already.** `FIRE_KNIGHT_REVIEW.md:142` — *"Survival vs
   MAX-HP destruction: add an HP floor / survival goal for the 40%-MAX-HP AoE that can 1-shot
   squishies (needs a judgment number)"* — listed under "Three deferred items — want any of these
   built?". Was that deferred permanently, or pending exactly this?
3. **Damage or destruction?** FK's punish is written as *"reduces MAX HP"* and Searing Storm as
   *"destroys 15% of MAX HP"*. Under tag policy #21 those are a different mechanic from %maxHP
   damage: destruction shrinks the pool permanently and compounds across triggers. Which is it
   in-game? This materially changes the FK survival math.
4. **None of the four packets' "Please decide" sections appear to have been answered** (FK §5 A-F,
   IG §3 A-C, Spider §4 A-F, Dragon §4 A-D). Were they signed off elsewhere, or are they still open?
   I only need §7.1-3 to proceed, but the rest bear on the same content.

---

## 8. Proposed first increment, and how it gets judged

Smallest change that can move the number, deliberately NOT all four dungeons at once:

1. Implement `pct_max_hp` + `max_hp_destruction` (the EHP-invariant channels).
2. Implement the step-2 speed ratio.
3. Wire **Spider and Fire Knight only** — the two where these channels dominate. Ice Golem and
   Dragon keep `incomingDamagePerTurn = null` until their `threshold_burst` gating is built.
4. Run `tools/battle-suite.mjs --by-dungeon` and report.

**Falsifiable expectation, recorded before the fact:** Spider is currently **47.8% balanced — below
chance** — and its wall is spiderling `pct_max_hp`, so Spider loss-recall should move first. Fire
Knight (59.1%, 4 false clears) should move less, since its punish is *gated* and well-built teams
mostly pass the gate. **If Spider does not move, the taxonomy is wrong** and no amount of tuning
should be applied to rescue it.

Baseline to beat: **204/324, balanced 52.9%** — Dragon 53.0% / FK 59.1% / IG 52.4% / Spider 47.8%.
