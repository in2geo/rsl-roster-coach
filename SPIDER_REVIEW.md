# Spider's Den — content build for review (full 1-25, strategy tiers)

**What this is:** the recommendation engine models a dungeon as *goals* (what a team must do) satisfied by *solutions* (an AND-set of champion capability *tags*; a goal is met if ANY solution's tags are all present). This packet is the Spider's Den (Normal / "Skavag") model rebuilt into three **strategy tiers** for stages **1-25**, for you to approve or send back.

**Status:** the engine reads only `approved` solutions. Everything here is `proposed` and **staged** — the live Spider scan still uses the old `Stages 1-6` / `7-10` rows, so nothing changes for players until sign-off. Give a per-item decision at the end.

**This already incorporates three rulings** (ACC ×10 + explicit margin; RES advisory; add `Poison Explosion` + `AoE Shield`, defer `AoE HP Burn`).

---

## 1. Source mechanics (Skavag the Spider Queen, Normal)

Hand-read factual data from the AyumiLove Spider guide.

- **Spiderlings** spawn constantly (max 10). Each stacks 5% MaxHP **Poison** — stacked, they wipe even tanky champs. You must **kill or CC them every round**.
- **Skavag snowballs:** at the start of her turn she **consumes** remaining Spiderlings, **healing 3% MaxHP and permanently +10% ATK per Spiderling**. The longer the fight runs, the stronger she gets → deny her turn and kill fast.
- **Enfeeble (CD4):** AoE −30% Turn Meter; Sleep if a target's TM is emptied.
- **Almighty Immunity:** boss immune to Stun / Freeze / Sleep / Provoke / Fear + cooldown-increase. **CC works only on the Spiderlings, never the boss.**
- **Healing Assured:** boss immune to **Heal Reduction**.
- **Lifesteal / heal-on-damage heals only 35%** vs Spider — sustain with direct heals / shields, not lifesteal.
- **Stages 21-25 only:** Almighty Strength (%MaxHP damage capped at 10%) + Almighty Persistence (Turn Meter reduction −50%) — same pair as Fire Knight.

**Affinity rotation:** Void 1/5/9/13/17/21 · Magic 2/6/10/14/18/22/25 · Force 3/7/11/15/19/23 · Spirit 4/8/12/16/20/24.

**Stat floors:**
- **ACC = stage × 10** (Plarium-sourced). Treated as a floor; **apply ~+10% as a separate, deliberate margin** for reliability — not baked into the multiplier. (The doc's ×11 was margin-in-the-multiplier; reconciled to ×10 per your ruling.)
- **RES = advisory** (≈ stage×10 + 100, up to ~300 — resists the Spiderling Poison). **Not a hard requirement** — a Shield/CC/strong-sustain team clears without it. Modeled as informational guidance (same treatment Heal Reduction got for Fire Knight).

---

## 2. The three strategy tiers

| Tier | Strategy | Primary damage |
|---|---|---|
| **Stages 1-14** | AoE **nuke** the Spiderlings + burst Skavag | `AoE Damage` (+ `AoE Decrease DEF`) |
| **Stages 15-20** | the **wall** — raw AoE fails | `Enemy Max HP Damage` / `Poison`+`HP Burn` / `Poison Explosion` |
| **Stages 21-25** | AoE **HP Burn** (%MaxHP capped) | `AoE HP Burn` (+ `Poison`) |

Every tier is single-phase (no wave/boss split). Notation below: solution → `tags` it needs (AND). All `proposed`.

### Stages 1-14 — AoE nuke
- **Control the Spiderlings each round** (before Poison stacks): `AoE Damage (kill them)` · `AoE Stun` · `AoE Freeze` · `AoE Decrease Turn Meter`
- **Burst Skavag with AoE** (she snowballs): `AoE Damage + AoE Decrease DEF` · `AoE Damage`
- **Deny Skavag her turn** (stops her consuming Spiderlings): `Decrease Turn Meter` · `Decrease Turn Meter + Decrease SPD`
- **Survive the Poison + Venom Spray:** `AoE Shield` · `Healer` · `Continuous Heal`
- *(info)* Speed — act before the Spiderlings, keep it short
- *(advisory)* RES ≈ stage×10+100 (low priority here)
- **ACC floor:** stage × 10 (target +10%)

### Stages 15-20 — the wall
- **Control the Spiderlings with AoE CC** (too tanky to nuke now): `AoE Stun` · `AoE Freeze` · `AoE Decrease Turn Meter`
- **Damage her large HP pool:** `Enemy MAX HP Damage` · `Poison + HP Burn` · `AoE HP Burn` · **`Poison Explosion (detonate stacks)`** *(new tag)*
- **Deny her turn:** `Decrease Turn Meter` · `Decrease Turn Meter + Decrease SPD`
- **Survive:** `AoE Shield` · `Healer` · `Continuous Heal`
- *(info)* Speed
- *(advisory)* RES ≈ stage×10+100 up to ~300
- **ACC floor:** stage × 10

### Stages 21-25 — AoE HP Burn (endgame)
- **Control the Spiderlings with AoE CC:** `AoE Stun` · `AoE Freeze` · `AoE Decrease Turn Meter`
- **Damage via HP Burn** (%MaxHP capped by Almighty Strength): `AoE HP Burn` · `Poison`
- **Deny her turn** (Almighty Persistence halves it): `Decrease Turn Meter` · `Decrease Turn Meter + Decrease SPD`
- **Survive:** `AoE Shield` · `Healer` · `Continuous Heal`
- *(info)* Speed
- *(advisory)* RES ~300
- **ACC floor:** stage × 10
- **Boss exceptions:** Almighty Strength (%MaxHP capped 10%), Almighty Persistence (TM reduction −50%)

**Universal boss exceptions (all tiers):** CC works on Spiderlings not the boss · Heal-Reduction-immune · lifesteal cut to 35% · she snowballs by consuming Spiderlings.

---

## 3. New vocabulary tags (your ruling — please confirm)

| Tag | Definition | Used at |
|---|---|---|
| **`Poison Explosion`** | Detonates [Poison] stacks for burst damage (Poison Detonation) — ignores DEF, scales with stack count. Sorath-style. | 15-20 damage |
| **`AoE Shield`** | Places [Shield] on **all** allies (team-wide) — distinct from single-target Shield. Replaces the generic `Shield` tag on every Spider survival solution. | all tiers, survival |

Deferred per your ruling: `AoE HP Burn` (plain `HP Burn` used for now).

---

## 4. Please decide (per item)

**A. Mechanics correct?** Shield-less snowball (consume → heal 3% / +10% ATK each), Almighty Immunity (CC on Spiderlings only), Heal-Reduction-immune, lifesteal-35%, affinity rotation, and the two 21-25 passives.

**B. Tier boundaries + damage paths sound?** 1-14 AoE nuke → 15-20 MaxHP/Poison/Poison-Explosion/HP-Burn → 21-25 HP Burn. Is the wall at 15 right, and are the per-tier damage solutions the correct ones?

**C. ACC = stage × 10 + a separate ~10% margin** — confirm the margin size (10%?) and that it's surfaced as guidance, not folded into the floor.

**D. RES as advisory** (informational, no hard fail) — confirm.

**E. New tags** `Poison Explosion` and `AoE Shield` — confirm definitions; confirm `AoE HP Burn` stays deferred.

**F. Go-live plan** — on approval, one step flips these `proposed → approved`, repoints the engine's Spider scan to the three tiers (and extends it to stage 25), and deletes the old `Stages 1-6` / `7-10` rows. Confirm you want the old rows removed (vs kept).

Counts: 3 tiers · 12 real goals + 6 informational · 33 solutions · new tags `Poison Explosion` / `AoE Shield`. Nothing is live until F.
