# Dungeon BUCKET TAXONOMY — Fire Knight · Ice Golem · Spider (working draft)

**STATUS: IN PROGRESS — being decided live with Mike. Not authoritative, not wired to any code.**
Captured as we go so rulings don't die in conversation (tag policy #18). Sibling of
`cb-bucket-taxonomy-DRAFT.md` (Clan Boss) and `lib/dragon-rubric.js` (Dragon, shipped as code).

Evidence base: `lib/dungeon-mechanics.js` (Mike-confirmed boss mechanics, 2026-07-16) and the live
`goals` / `goal_solutions` content. Dragon is the pattern to follow — Tier-1 boss kit first, then jobs.

---

## Precedent carried from Dragon (do not re-derive)

1. **Waves become a BUCKET, not phase machinery.** Dragon expresses wave-clearing as `crowd_control`
   so no phase engine is needed. FK and IG both have wave gates too (see below) — same treatment.
2. **The boss's immunities do NOT devalue wave tools.** Those tags were never aimed at the boss.
3. **Stat ≠ buff.** A champion's own ACC is a GATE; an ACC buff they place is a capability.
4. **Auras never fill a bucket** — they raise delivery against the binding gate, chosen LAST.

---

## ⚠ CORRECTION LOGGED 2026-07-19 — "CC is dead on Fire Knight" was WRONG

Claude proposed FK with CC ruled dead, reasoning that Fyro is CC-immune and his room has no minions.
**That applies to the BOSS ROOM only.** `dungeon-mechanics.js` states it explicitly: *"SOLO boss (1v5,
NO minions in the boss room; **the trash mobs are the separate WAVE gate**)."* Fire Knight has waves,
and CC is fully alive on them — precisely the error Dragon's rubric was written to prevent. Corrected
below. **Ice Golem also has waves** (Mike, 2026-07-19).

---

## FIRE KNIGHT — Fyro

**Boss facts** (`dungeon-mechanics.js`, Mike-confirmed): Divine Shield 5/7/10/12 stacks by stage,
stripped **one stack per HIT** (not per damage) before he acts, or he heals + AoE-nukes MAX HP.
CC-immune, but **TM reduction WORKS** — that's the lock. Stages 21-25 he gains **Almighty
Persistence**, which HALVES all TM reduction (halved ≠ immune: the strategy survives, its price doubles).

**Structural specials:**
- **HIT COUNT is a currency the Damage bucket cannot measure.** Many small hits beat few big ones; a
  DoT never breaks the shield (not a hit, and the shield blocks debuffs while up). Post-break, DoT IS
  a real damage tool.
- **`TM-LOCK` and `SURVIVE` are SUBSTITUTES** — *"you need one, not both."* A 100% budget assumes
  buckets ADD. **UNRESOLVED — needs a ruling.**

### ✅ RULED (Mike, 2026-07-19) — FK runs TWO STRATEGIES, scored separately

**Strategy A — TM-LOCK** (the meta; Coldheart/Alure trivialise it)
`shield_break 25 · tm_lock 25 · tempo 20 · crowd_control 15 · damage 15`
- **`survive` is NOT a scored dimension here — it is a GATE** (see the gates ruling below).
- Mike: *"if tempo slips the lock breaks and the whole strategy collapses."* He noted CC at 15 is
  "redundancy insurance rather than active requirement" in a true lock run and could drop to 10 with
  tempo at 20; he called 15/15 "defensible as a starting position."
  ⚠ **The tempo 20 above is Claude's arithmetic after removing `survive 5` — CONFIRM.**

**Strategy B — SURVIVE** (the grind; GuapoDonni's 105-turn clear, no Coldheart/Alure)
`shield_break 25 · survive 25 · damage 15 · mitigation 15 · crowd_control 10 · tempo 10`
- Mike: *"In the survive grind you're absorbing hits by design — mitigation is doing real work every
  turn. CC in B is nice-to-have, not structural."*

`shield_break 25` sits in BOTH and is NOT substitutable — no break, no fight, either way.

### ✅ RULED — `shield_break` magnitude: approximate; do NOT add a hit-count source yet
Mike: *"fewer variables with high confidence."* Hit-count-per-ability is not in the schema and would
need a new data source to be accurate. Approximate from tags, **but weight within the bucket:**
**`Multi-Hit A1` PRIMARY, `AoE Damage` SECONDARY at ~half weight** — *"Coldheart's A1 is the reason she
trivialises FK. If both tags score equally under shield_break, the selector can't find her."*
⚠ **NEW MECHANISM:** `championDelivery` takes `max(delivery)` across a bucket's tags today — there is no
per-(bucket, tag) weighting. This ruling requires one.

### ✅ RULED — GATES vs SCORED DIMENSIONS (architectural; generalises beyond FK)
`survive 5` in Strategy A was a half-measure. Mike: *"if you chose Strategy A, survive isn't a design
dimension, it's a precondition."* So a strategy carries TWO things:
- **A scored ALLOCATION** (the buckets that express the strategy's priorities), and
- **GATE CHECKS** — pass/fail preconditions that are confirmed, not scored. For FK Strategy A: can all
  five survive long enough to establish the lock (a minimum HP/DEF threshold)?

This supersedes the proposed "~10% bucket floor" for this case: **a dimension that isn't a strategic
priority should be REMOVED from the allocation and expressed as a gate — not floored at a small number.**
Consistent with the existing "stat = gate, buff = capability" and aura rulings.

---

## ICE GOLEM — Klyssus

**Boss facts** (Mike-confirmed 2026-07-16): **Frigid Vengeance is a PASSIVE on HP THRESHOLDS —
80/60/45/30/15%**, not an action on his turn. **DoT does NOT trip it; burst does.** TM reduction works
(full 1-20, halved 21-25) but does **NOT** stop Frigid Vengeance, so TM-LOCK does **not** substitute
for the DoT race — they are INDEPENDENT (unlike FK). Minions revive and apply **Heal Reduction**.

**Structural specials:**
- **A HARMFUL capability.** Burst damage is not merely dead like CC on CB — it actively triggers up to
  five scripted retaliations. Nothing in the model can currently express "this capability hurts here."
- **`Decrease Defense` is worthless to the DoT path** (DEF shred only boosts ATTACK damage,
  damage-mechanics §1). IG's Amplification = duration, Poison Sensitivity, ACC — NOT DEF shred.

**BOSS SKILL TEXT (Tier-2 factual, AyumiLove human-read 2026-07-19 — the site's *guide/strategy*
section is Tier-3 editorial and is NOT used as a source for any rule below; it merely corroborates
what Mike had already confirmed on 2026-07-16):**
- **Frost Nova** — attacks all enemies.
- **Numbing Chill** (CD 4) — attacks all enemies, **50% [Decrease ACC], 2 turns.**
- **Frigid Vengeance [P]** — attacks all enemies once whenever HP drops below **80/60/45/30/15%**.
  **"This attack will REVIVE any dead allies to 100% HP."** Ignores **50% of each enemy's DEF PER ALIVE
  ALLY.** **20% chance of [Freeze] 1 turn, +40% PER ALIVE ALLY.**
- **Almighty Immunity [P]** — immune to [Stun] [Freeze] [Sleep] [Provoke] [Block Active Skills] [Fear]
  [True Fear]; also HP-exchange, HP-balancing and cooldown-increasing effects. *(Note what is ABSENT:
  Petrification, Sheep, Ensnare, Seal, Hex, Decrease Turn Meter — consistent with TM reduction working.)*
- **Almighty Strength [P]** (stages **21-25**) — damage from skills scaling on **enemy MAX HP cannot
  exceed 10% of the boss's MAX HP.**
- **Almighty Persistence [P]** (stages **21-25**) — all TM reduction **−50%** vs the boss.

**THREE CONSEQUENCES THAT CHANGE THE MODEL:**
1. **Frigid Vengeance IS the revive mechanic** — same threshold trigger, not a separate passive. So
   killing minions is UNDONE at every marker unless Block Revive is up. `wave_clear` and
   `revive_control` are COUPLED to one trigger.
2. **Alive minions SCALE the retaliation's severity** — 2 alive ⇒ ignores **100% DEF** and Freezes at
   **100%**. Minion control is therefore a **MULTIPLIER ON SURVIVE**, not a parallel job. This is a
   stronger argument for the two-bucket ruling than the coverage-gap evidence below.
3. **`Enemy Max HP Damage` is CAPPED at stages 21-25** (Almighty Strength, 10% of boss max HP). That
   lane currently sits inside `dot_race` and must become stage-conditional.

### ✅ RULED (Mike, 2026-07-19) — the Block-Revive/ACC "conflict" was a LAYER confusion, not a conflict
*"These aren't actually in conflict — they're at different layers."*
- **`revive_control` is a CHALLENGE dimension** — the content requires Block Revive to be placed.
- **ACC is a CHAMPION-LEVEL viability requirement** on whoever fills that role (Block Revive is a
  debuff, so it must land against IG's RES).
- **The selector emits TWO OUTPUTS, not one blended score:** pick the champion carrying the tag, AND
  flag whether their ACC tier suffices. *"The ACC dependency doesn't lower the weight; it's a viability
  check on whoever fills the role."*

**`revive_control` weight for IG: 20–25 — close to a GATE mechanic, the same shape as FK's
`shield_break`.** *"Without Block Revive the arms and legs keep coming back and the fight degrades
significantly."*

⚠ **TENSION TO RESOLVE — this cuts against INS-0031 as implemented.** `bucket-magnitude.js` BLENDS land
rate into delivery (`effect × uptime × land rate × build scale`), and that blending is exactly what
separates Pelops landing Decrease ATK at ACC 214 from Gnut at ACC 20 — the discrimination INS-0031 was
written to obtain. Mike's ruling says ACC should be a SEPARATE viability output, not folded into the
score. Both cannot be true as stated. Candidate reconciliation (NOT ruled): blend for RANKING among
candidates for a role, but ALSO surface the gate flag so the user learns the champion needs ACC.
**Ask Mike before changing either.**

### ✅ RESOLVED (Mike, 2026-07-19) — Block Revive does NOT require Accuracy. DB was wrong; FIXED.
Mike supplied the mechanism, not just the outcome: *"Because Block Revive applies immediately after an
enemy champion dies, the target is considered 'dead' at the moment of placement. Dead champions have no
stats and cannot resist anything, rendering the standard Accuracy vs. Resistance check irrelevant."*

Note this is a DIFFERENT reason from tag policy #17 ("cannot be resisted" clauses on a LIVING target) —
here there is no living target for the check to run against. Same scoring consequence, different cause.

**Landed:** `seeds/198_block_revive_bypasses_accuracy.sql`, applied + verified live. `Block Revive` now
joins `AoE Decrease Turn Meter`, `True Fear`, `Pain Link` as `bypasses_accuracy_check = true`.

**CONSEQUENCES:**
- The **ACC viability check does NOT fire** for `revive_control`. Block Revive is build-independent —
  accessible on any roster that owns one. Its 20-25 weight takes no ACC discount.
- ❌ **RETRACTED:** Claude's proposed interaction that Numbing Chill's 50% [Decrease ACC] "attacks your
  ability to stop the boss's own revives." That was inference resting on the wrong flag. **Not real.**
- **SCOPE — do not batch this reasoning.** Whether other effects share the "target is already dead, so
  nothing resists" property is a separate, unasked question. The seed deliberately touches one row.

**✅ RULED (Mike, 2026-07-19): wave-minions and reviving-boss-minions are TWO buckets, not one.**
They need different tools — the wave phase wants AoE clear; the boss phase wants `Block Revive` or
enough burst to keep them down. **Evidence:** `shadow-construct` on DonBrogni IG 20 shows
`[wave/wave_or_add]` covered by Ezio + Uugo while `[boss/wave_or_add]` is `*** UNCOVERED ***` — the
same roster passes one and fails the other. A single bucket would have hidden that gap entirely.

### ⚠ REWRITTEN 2026-07-19 after reading `ICE_GOLEM_REVIEW.md` (which Claude had not opened)

**THE FLOORS ALREADY EXIST — per tier, in the review.** They are flagged judgment calls (the source's
Klyssus stat table is an image), but they are real numbers and a survive-gate can run on them TODAY:

| stages | band | floors |
|---|---|---|
| 1-9 | beginner — Frigid Vengeance forgiving, burst survivable | ACC 80 · HP 5,000 |
| 10-13 | forgiving | ACC 120 · HP 8,000 |
| 14 | **transition — difficulty cliff** | ACC 200 · RES 200 · HP 40,000 |
| 15-20 | dangerous | ACC 200 · RES 200 · HP 40,000 |
| 21-25 | endgame + both passives; DoTs mandatory | ACC 210 · RES 210 · HP 45,000 |

**🔴 HARMFUL CAPABILITIES — NAMED IN THE REVIEW, not merely dead:**
*"avoid Counterattack/Reflect (chain-triggers Frigid Vengeance)."* `Counterattack` and `Reflect Damage`
make the retaliation fire MORE. A `dead` set expresses "contributes nothing"; this needs a NEGATIVE
term. **This is the "harmful capability" gap — it is not hypothetical and the content already documents it.**

**Other review facts the earlier proposal missed:**
- The minions apply **Decrease DEF on YOU** as well as Heal Reduction, and *"the deadlier one carries
  Decrease DEF"* — so wave TARGET ORDER matters. No bucket expresses ordering.
- **CC works on the minions, never the boss** (Almighty Immunity).
- 21-25 adds **Almighty Strength** (%MaxHP damage capped at 10% of boss max HP) — caps the
  `Enemy Max HP Damage` lane — and **Almighty Persistence** (TM reduction −50%).
- The review's own open question **C** already proposes the third strategy: *"heavy sustain (AoE heal /
  Revive / Cleanse / Ally Protection) while CC-ing the minions"* — it was NOT built, deliberately,
  mirroring the live 10-20 model which has no explicit survive goal and leans on the HP floor instead.

**PROPOSED allocation — DoT-race strategy only (NOT ruled; the other two strategies still need drafting):**
`dot_race 25 · survive 20 · wave_clear 15 · revive_control 15 · amplification 10 · cleanse 10 · tm_lock 5`
- `cleanse` is broken out because minion **Heal Reduction** attacks your sustain directly, not your HP.
- `tm_lock` is deliberately LOW: confirmed working, but it buys only turn-denial and prevents no
  retaliation — far less central than on FK.
- ⚠ **`revive_control` should be near-ZERO on the DoT path** — DoT does not trip Frigid Vengeance, so
  the passive rarely fires and the minions rarely revive. It is gate-shaped (20-25) on the burst and
  tank paths. This is exactly what per-strategy allocations exist to express. **NEEDS RULING.**

---

## SPIDER — Skavag

**Boss facts** (Mike-confirmed 2026-07-16): **ONE continuous fight, NO waves** — boss plus endlessly
spawning spiderlings. Spiderlings poison-stack the team AND **Skavag CONSUMES them to HEAL + gain
permanent ATK**, so a long fight snowballs. Boss is CC-immune, but **TM reduction WORKS on her** and
**DoT works on her** (immunity is CC-only). **Spiderlings are Provokable** — Provoke is far more
accessible than hard CC, so a roster with no Stun/Freeze can still cover the seat.

**Structural specials:**
- `SPIDERLINGS` and `SURVIVE` **trade off** — hard control cuts incoming, so a control team barely
  needs sustain and a bulky team can tank looser control. (Softer version of FK's substitution.)
- **OPEN:** does TM-locking Skavag also stop her CONSUMING spiderlings? If yes, TM-LOCK partly
  substitutes for spiderling control.

### ⚠ REWRITTEN 2026-07-19 after reading `SPIDER_REVIEW.md`. **The earlier proposal was STRUCTURALLY WRONG.**

**Spider's tiers are STAGE-DETERMINED, not player-choice.** The review already models three of them,
selected by the stage you are running, not by a path you pick:

| stages | strategy | primary damage |
|---|---|---|
| 1-14 | AoE **nuke** the Spiderlings + burst Skavag | `AoE Damage` (+ `AoE Decrease DEF`) |
| 15-20 | **the wall** — raw AoE fails | `Enemy Max HP Damage` / `Poison`+`HP Burn` / `Poison Explosion` |
| 21-25 | AoE **HP Burn** (%MaxHP capped) | `AoE HP Burn` (+ `Poison`) |

**THIS IS A THIRD STRUCTURAL PATTERN**, and the model now needs all three:
| content | structure |
|---|---|
| Clan Boss, Dragon | ONE allocation |
| Fire Knight, Ice Golem | **PLAYER-CHOICE** substitutable strategies (pick the best fit) |
| **Spider** | **STAGE-DETERMINED** bands (the stage selects the allocation) |

A single Spider allocation — which is what Claude proposed — cannot express any of it.

**Mechanics that break assumptions elsewhere in the model:**
- **Lifesteal / heal-on-damage heals only 35% on Spider.** Sustain must be direct heals + shields.
  Any sustain scoring that credits lifesteal normally is wrong here.
- **Skavag is IMMUNE to Heal Reduction** ("Healing Assured").
- **She SNOWBALLS PERMANENTLY:** at the start of her turn she consumes remaining Spiderlings, healing
  3% MaxHP and gaining **+10% ATK per Spiderling, permanently**. A long fight makes her stronger —
  nothing in the bucket model represents an enemy that scales with elapsed time.
- Spiderlings **cap at 10**, each stacking **5% MaxHP Poison**.
- **Enfeeble (CD4):** AoE −30% Turn Meter, and **Sleep if a target's TM is emptied**.
- **ACC = stage × 10** (Plarium-sourced) **plus a separate ~10% margin** — margin deliberately NOT
  baked into the multiplier. **RES is ADVISORY** (≈ stage×10+100, up to ~300), explicitly NOT a hard
  requirement: *"a Shield/CC/strong-sustain team clears without it."*
- 21-25 adds Almighty Strength + Almighty Persistence, as on FK and IG.

**NO ALLOCATION PROPOSED.** Three stage-band allocations are needed, and Claude has already drafted one
set of Spider numbers blind — a second guess before the structure is ruled would repeat the mistake.

**⚠ WEAKEST VALIDATION of the three dungeons.** FK was checked against a real FK16 clear, IG has the
DonBrogni 14+15 captures; Spider has mechanic confirmations only and **no real-clear validation**. The
Gnut ladder (clean ~15, grind 18-19, wall 20) is the obvious ground truth and is unreconciled — and note
it straddles the review's 15-20 "wall" band exactly.

**⚠ WEAKEST VALIDATION of the three.** FK was checked against a real FK16 clear and IG has the
DonBrogni 14+15 captures; Spider has **mechanic confirmations only, no real-clear validation**. The
Gnut ladder (clean ~15, grind 18-19, wall 20) is the obvious ground truth and has not been reconciled.

---

## STILL OPEN — awaiting Mike

1. **All three allocations** — percentages above are Claude proposals, not rulings.
2. **FK substitution** (`TM-LOCK` ⟷ `SURVIVE`): how does a budget express "you need one, not both"?
3. **IG harmful capability**: how does the model score burst as NEGATIVE rather than merely absent?
4. **FK hit-count currency**: `shield_break` must count HITS, not damage — needs a magnitude source
   (`Multi-Hit A1` multiplicity, AoE hit counts) that `bucket-magnitude.js` does not yet model.
5. **Spider TM-lock vs consumption** (see above).
6. Exemplars/cheat-codes with activation conditions (Coldheart, Alure for FK; Venomage, Corvis, Artak
   for IG) — the pool model has no way to express "this champion trivialises this problem, IF built X."
