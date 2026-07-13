# Fire Knight's Castle — content build for review

**What this is:** the recommendation engine models each dungeon stage as *goals* (what a team must accomplish) satisfied by *solutions* (an AND-set of champion capability *tags*; a goal is met if ANY solution's tags are all present). This packet is the Fire Knight (Normal / "Fyro") model for stages **1-25**, for you to approve or send back.

**Status rule:** the engine only reads solutions marked `approved`. Everything new here is `proposed` and does nothing live until a human approves it. Please review and give a per-item decision at the end.

**Two batches to review:**
1. **New stages 1-9 and 21-25** — freshly built (all `proposed`).
2. **Four fixes to the existing 10-20** — mechanics the live model never captured, now added (`proposed`; staged so they don't affect live 10-20 until approved).

---

## 1. Source mechanics (Fyro, Normal difficulty)

All hand-read factual game data (shield counts, skill text, affinities, passives) from the AyumiLove Fire Knight guide — not opinion/tier-list content.

- **Divine Shield (Cloak of Fire, passive):** Fyro starts each turn with a shield that absorbs 80% of incoming damage and makes him immune to all debuffs while up. Each hit weakens it; it breaks after **enough hits in a round**, and **regenerates every turn**. If he *starts a turn with the shield still up*, he hits the whole team with an AoE that **reduces MAX HP (up to ~40%)** and **heals himself** — both scaling with the shield's remaining strength. Hits to break, by tier:
  - Stages **1-6 = 5** · **7-9 = 7** · **10-20 = 10** · **21-25 = 12**
- **Searing Storm:** AoE that destroys 15% of MAX HP. **Active from Stage 7** onward (so 1-6 don't have it).
- **Dazzling Flames (cooldown 5):** AoE + 30% [Decrease SPD] for 3 turns. **Base skill — active at every stage.**
- **Almighty Immunity (passive):** immune to [Stun], [Freeze], [Sleep], [Provoke], [Block Active Skills], [Block Passive Skills], [Fear], [True Fear], plus HP-exchange / HP-balance / cooldown-increase effects. (Hard CC only works on the **minions**, never the boss.)
- **Almighty Strength (passive, Stages 21-25 only):** damage that scales on enemy MAX HP is capped at 10% of Fyro's MAX HP (%HP nukes fall off hard).
- **Almighty Persistence (passive, Stages 21-25 only):** all Turn Meter reduction against Fyro is reduced by 50%.
- **Affinity rotation:** Force 1/5/9/13/17/20/24 · Spirit 2/6/10/14/18/21/25 · Magic 3/7/11/15/19/22 · Void 4/8/12/16/23.

**Core strategy the guide prescribes:** ≥3 multi-hit-A1 champions (to reach the hit count), a Speed champion with Increase Speed **and** Increase Turn Meter (extra turns = more hits), Counterattack or Reflect Damage (extra hits), Decrease Turn Meter (delay Fyro's turn), AoE hard-CC for the minions, and Block Cooldowns for dangerous minion skills.

---

## 2. Full 1-25 ladder (as currently in the database)

| Stage | Affinity | Shield hits | Boss goals | Boss solutions | Status |
|------:|----------|:-----------:|:----------:|:--------------:|--------|
| 1-6   | F/Sp/M/V/F/Sp | 5  | 2 (+1 staged) | 5 | **new — proposed** |
| 7-9   | M/V/F     | 7  | 4 (+1 staged) | 10 | **new — proposed** |
| 10-14 | Sp/M/V/F/Sp | 10 | 3 actionable (+2 staged) | 7 approved + additions | **live — approved** |
| 15-20 | M/V/F/Sp/M/F | 10 | 4 actionable (+1 staged) | 10 approved + additions | **live — approved** |
| 21-25 | Sp/M/V/F/Sp | 12 | 4 (+1 staged) | 12 | **new — proposed** |

"Staged" = an informational goal that the engine ignores until it's promoted at approval (so it can't penalise live stages early). Every stage also has a wave phase (clear the wave with AoE CC) and per-stage affinity/shield boss-exceptions.

---

## 3. The model, tier by tier

Notation: a solution lists the tags it needs (AND). `[NEW]` = added in this build. `[FIX]` = added by the 10-20 gap fixes (batch 2). Everything without a live marker is `proposed`.

### Stages 1-6 — shield 5, beginner (all proposed)
**Boss goals**
- Break the shield each round (5 hits): `Multi-Hit A1` · `Multi-Hit A1 + Counterattack` · `Multi-Hit A1 + Ally Attack` · `Multi-Hit A1 + Increase Turn Meter` [FIX]
- Speed the kill once shield is down: `Decrease Defense + Weaken` · `Decrease Turn Meter`
- *(staged)* Deny Fyro's self-heal: `Heal Reduction` [FIX]

**Wave goals**
- Clear the wave with AoE CC: `AoE Stun` · `AoE Freeze` · `AoE Decrease Turn Meter`
- *(informational)* Preserve HP & buffs into the boss phase

**Thresholds:** ACC ≥ 60 · SPD ~110+  *(both estimated — see decisions)*

### Stages 7-9 — shield 7, Searing Storm now active (all proposed)
**Boss goals**
- *(informational)* Counter Dazzling Flames: `Cleanse` · `Increase Speed` [FIX]
- Break the shield (7 hits): `Multi-Hit A1` · `+ Counterattack` · `+ Ally Attack` · `+ Increase Turn Meter` [FIX]
- Post-shield damage window: `Decrease Defense + Weaken` · `Decrease Turn Meter + Decrease Speed` · `Decrease Turn Meter`
- Control Fyro's Turn Meter: `Decrease Turn Meter`
- *(staged)* Deny Fyro's self-heal: `Heal Reduction` [FIX]

**Wave:** `AoE Stun` · `AoE Freeze` · `AoE Decrease Turn Meter` · *(info)* preserve HP/buffs
**Thresholds:** ACC ≥ 90 · SPD ~130+  *(estimated)*

### Stages 10-14 — shield 10 (LIVE / approved, plus proposed fixes)
**Boss goals**
- Break the shield (10 hits): `Multi-Hit A1` · `Multi-Hit A1 + Counterattack` · `Multi-Hit A1 + Increase Turn Meter` [FIX]
- Post-shield damage window: `Decrease Defense + Weaken` · `Decrease Turn Meter + Decrease Speed` · `Decrease Turn Meter`
- Control Fyro's Turn Meter: `Decrease Turn Meter`
- Counter Dazzling Flames [FIX — was informational "confirm whether active"; corrected + given `Cleanse` · `Increase Speed`, staged]
- *(staged)* Deny Fyro's self-heal: `Heal Reduction` [FIX]

**Wave:** `AoE Stun` · `AoE Freeze` · `AoE Decrease Turn Meter` · *(info)* preserve
**Thresholds:** ACC ≥ 120 · SPD ~140+

### Stages 15-20 — shield 10 (LIVE / approved, plus proposed fixes)
**Boss goals**
- *(informational)* Speed: fast enough to land 10 hits + cycle debuffs before Fyro acts
- Break the shield (10 hits): `Multi-Hit A1` · `+ Counterattack` · `+ Ally Attack` · `+ Increase Turn Meter` [FIX]
- Post-shield damage window: `Decrease Defense + Weaken`
- Counter Dazzling Flames: `Cleanse` · `Increase Speed`
- Control Fyro's Turn Meter: `Decrease Turn Meter` · `Decrease Turn Meter + Decrease Speed`
- *(staged)* Deny Fyro's self-heal: `Heal Reduction` [FIX]

**Wave:** `AoE Stun` · `AoE Freeze` · `AoE Decrease Turn Meter` · `Block Cooldowns` · *(info)* preserve
**Thresholds:** ACC ≥ 170 · SPD ~170+

### Stages 21-25 — shield 12, +2 endgame passives (all proposed)
**Boss goals**
- *(informational)* Speed (Almighty Persistence halves TM control, so raw SPD matters more)
- Break the shield (12 hits): `Multi-Hit A1` · `+ Counterattack` · `+ Ally Attack` · `+ Increase Turn Meter` [FIX]
- Post-shield damage window: `Decrease Defense + Weaken`
- Counter Dazzling Flames: `Cleanse` · `Increase Speed`
- Control Fyro's Turn Meter (halved by Almighty Persistence): `Decrease Turn Meter` · `Decrease Turn Meter + Decrease Speed`
- *(staged)* Deny Fyro's self-heal: `Heal Reduction` [FIX]

**Wave:** `AoE Stun` · `AoE Freeze` · `AoE Decrease Turn Meter` · `Block Cooldowns` · *(info)* preserve
**Thresholds:** ACC ≥ 210 · SPD ~200+  *(estimated)*
**Boss exceptions:** Almighty Strength (%MAX-HP damage capped at 10%); Almighty Persistence (TM reduction −50%).

---

## 4. Batch 2 — the four fixes to the existing 10-20

Audit of the live 10-20 against the source doc found four mechanics it never modelled (every tag already existed in the vocabulary — it just was never wired in):

| Fix | What the doc says | Existing 10-20 | Added (proposed) |
|-----|-------------------|----------------|------------------|
| **Increase Turn Meter** shield-break enabler | Names a Speed champ with Increase Speed *and* Increase Turn Meter as core | `Increase Turn Meter` tag existed, **never used** | `Multi-Hit A1 + Increase Turn Meter` on every shield-break goal |
| **Deny Fyro's self-heal** | Fyro heals every turn (scales with shield) | 15-20 ACC note referenced "Heal Reduction" but **no goal/solution used it** | A goal solved by `Heal Reduction` (staged informational) |
| **Dazzling Flames at 10-14** | It's a base skill, active at all stages | 10-14 goal stuck as informational "confirm whether active" | Corrected + `Cleanse`/`Increase Speed`, staged to match 15-20 |
| **Almighty Immunity** | Boss immune to Stun/Freeze/Sleep/Provoke/Block/Fear | Correctly avoided, but **never documented** | Boss-exception on all stages so explanations never imply CC works on the boss |

**Safety note:** the two new *goals* (Heal Reduction, Dazzling-at-10-14) are staged as *informational* so the engine ignores them — the live 10-20 stages' actionable-goal counts are unchanged (10-14 = 3, 15-20 = 4). They become real coverage goals only when approved.

---

## 5. Please decide (per item)

**A. Mechanics correct?** Confirm the shield counts (5/7/10/12), Searing-Storm-from-7, Dazzling-Flames-every-stage, the affinity rotation, and the two 21-25 passives read right.

**B. Goal → solution logic sound?** Confirm each tier's solutions are the right ways to meet each goal (e.g. Increase Turn Meter / Counterattack / Ally Attack pairing with Multi-Hit A1 for shield-breaking).

**C. Estimated thresholds — accept or replace?** ACC/SPD floors for stages 1-9 & 21-25 (ACC 60/90/210; SPD ~110/130/200) are estimates extrapolated from the live 10-14 (120) / 15-20 (170) curve, because the doc's Fyro stat table was an image. Accept as starting floors, or provide in-game numbers?

**D. Heal Reduction — hard goal or informational?** Should lacking Heal Reduction count against a team's confidence (hard coverage goal), or stay guidance-only (informational)? It's currently staged informational to avoid over-penalising teams that win purely by breaking the shield.

**E. Five new-stage calls:**
1. Estimated thresholds acceptable (same as C)?
2. Keep Decrease Turn Meter at 21-25 despite Almighty Persistence halving it (flagged, paired with Decrease Speed)?
3. 7-9 has an extra `Multi-Hit A1 + Ally Attack` shield solution that 10-14 lacks — level 10-14 up to match, or remove from 7-9?
4. Stages 1-6 use a slimmer 2-goal beginner boss set (no TM-control / Dazzling goals) — appropriate?
5. Tainted Fyro (Hard mode) left out of scope — confirm.

**F. Three deferred items — want any of these built?**
1. **Survival vs MAX-HP destruction:** add an HP floor / survival goal for the 40%-MAX-HP AoE that can 1-shot squishies (needs a judgment number).
2. **Reflect Damage** as a shield-break alternative to Counterattack (needs an in-game check: do reflect procs count as shield hits?).
3. **Credit Increase Speed toward shield-breaking** (more SPD = more turns = more hits), not just as a Dazzling counter.

On sign-off, one approval step flips all of the above from `proposed` to live in a single pass.
