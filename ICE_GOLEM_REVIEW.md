# Ice Golem's Peak — content build for review (Stages 1-9 & 21-25)

**What this is:** the engine models a stage as *goals* (what a team must do) met by *solutions* (an AND-set of champion *tags*; a goal is met if ANY solution's tags are all present). This packet extends Ice Golem's Peak (Normal / "Klyssus") to the full 1-25 ladder — the same treatment we gave Fire Knight. For you to approve or send back.

**Status:** new rows are `proposed` (the engine reads only `approved`, so nothing is live until sign-off). Ice Golem already auto-scans for the best stage (same as Fire Knight/Spider), so no UI work is needed.

---

## 1. Source mechanics (Klyssus, Normal)

Hand-read from the AyumiLove Ice Golem guide.

- **2 minions** apply **Heal Reduction** (blocks your healing) + **Decrease DEF** (you take more boss AoE). Kill them first; the deadlier one carries Decrease DEF.
- **Frigid Vengeance (passive):** at **80 / 60 / 45 / 30 / 15% HP** Klyssus hits the whole team, **revives dead minions to 100%**, ignores **50% DEF per alive ally**, and **Freezes** (20% + 40% per alive minion). **Poison / HP Burn do NOT trigger it** — the core strategy is to erode his HP with DoTs, not burst, and keep minions dead.
- **Numbing Chill (CD4):** AoE **50% Decrease ACC** for 2 turns — cleanse it or run high base ACC.
- **Almighty Immunity:** boss immune to Stun/Freeze/Sleep/Provoke/Fear + cooldown-increase. **CC works only on the minions, never the boss.**
- **Stages 21-25 only:** Almighty Strength (%MaxHP damage capped at 10%) + Almighty Persistence (Turn Meter reduction −50%) — same pair as Fire Knight / Spider.

**Affinity rotation:** Spirit 1/5/9/13/17/20/24 · Magic 2/6/10/14/18/21/25 · Force 3/7/11/15/19/23 · Void 4/8/12/16/22.

---

## 2. The full ladder (tiers)

| Stages | Band | Status | Floors |
|---|---|---|---|
| **1-9** | beginner — Frigid Vengeance forgiving, burst survivable | **new** | ACC 80 · HP 5,000 |
| 10-13 | forgiving | live | ACC 120 · HP 8,000 |
| 14 | transition (difficulty cliff) | live | ACC 200 · RES 200 · HP 40,000 |
| 15-20 | dangerous | live | ACC 200 · RES 200 · HP 40,000 |
| **21-25** | endgame + 2 passives; DoTs mandatory | **new** | ACC 210 · RES 210 · HP 45,000 |

Every stage is wave (minions) + boss (Klyssus). The 1-9 tier extends the live "forgiving" band down; 21-25 extends the "dangerous" band up and adds the two passives. All floors are **judgment calls** (the doc's Klyssus stat table is an image).

### Stages 1-9 — beginner (new, proposed)
**Wave — kill the minions:** `Block Revive` · `AoE Stun` · `AoE Freeze` · `AoE Damage` · *(info)* kill the Decrease-DEF minion first
**Boss — clear Klyssus (burst survivable here):** `Direct AoE damage` · `Poison` (forward-compatible habit) · *(info)* avoid Counterattack/Reflect (chain-triggers Frigid Vengeance)
**Floors:** ACC 80 · HP 5,000

### Stages 21-25 — endgame (new, proposed)
**Wave — kill the minions (they revive to 100%):** `Block Revive` · `AoE Damage + Decrease DEF` · `AoE Stun` · `AoE Freeze` · *(info)* kill the deadlier minion first
**Boss:**
- Erode HP without triggering Frigid Vengeance (%MaxHP burst is capped): `Poison stacking` · `HP Burn`
- Keep minions dead: `Block Revive`
- Resist/cleanse Numbing Chill (50% Decrease ACC): `Cleanse`
- *(info)* avoid Counterattack/Reflect · *(info)* build RES vs the Frigid Vengeance Freeze
**Floors:** ACC 210 · RES 210 · HP 45,000
**Boss exceptions:** Almighty Strength, Almighty Persistence, Frigid Vengeance, Almighty Immunity

---

## 3. Please decide (per item)

**A. Mechanics correct?** Frigid Vengeance (5 HP thresholds, revive minions, DEF-ignore per ally, Freeze), Poison/HP-Burn-don't-trigger-it, Numbing Chill, Almighty Immunity (CC on minions only), the 21-25 passives, affinity rotation.

**B. Tier boundaries + floors?** 1-9 as an extension of the forgiving 10-13 band; 21-25 as the hardest band + passives. Are the estimated floors (ACC 80 / HP 5,000 at 1-9; ACC 210 / RES 210 / HP 45,000 at 21-25) acceptable as starting values, or supply real numbers?

**C. Candidate enhancement — a sustain goal.** The doc's third strategy is heavy sustain (AoE heal / Revive / Cleanse / Ally Protection) while CC-ing the minions. I **mirrored the existing 10-20 model**, which has no explicit "survive" goal (it relies on the HP floor + minion control). Want me to add a sustain goal (using `AoE Heal` / `Revive` / `Ally Protection` / `Continuous Heal`) across the tiers?

---

## 4. Two pre-existing Ice Golem cleanups (separate from this build — flagging)

These were here before this pass; worth resolving while Ice Golem is in focus:

1. **The live 10-20 base content is ORPHANED** — no committed seed creates it (only modifier seeds 17/19 exist). If the DB were rebuilt from seeds, Ice Golem 10-20 would vanish. Needs a reconstruction seed. *(The same is quietly true of Fire Knight's 10-20.)*
2. **~3 proposed skeleton solutions per 10-20 stage** were never approved (e.g. untagged "Avoid Counterattack entirely", "Kill revived minions immediately", "High base ACC", and an untagged "AoE Stun or Freeze" at Stage 20). They should be tagged-and-approved or rejected — right now they're dead weight the engine ignores.

Counts (new content): 14 stages · 71 goals (49 real + 22 informational) · 94 solutions · **0 tagless** · floors + boss exceptions per tier. Nothing is live until you approve; on sign-off I flip `proposed → approved` (Ice Golem already auto-scans, so no other wiring).
