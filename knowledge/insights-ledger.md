# Insights Ledger — the engine's durable "brain"

The accumulating record of what the recommendation engine KNOWS and BELIEVES, and how
each belief got there. This is the Deep-Blue knowledge store: conversation + captured
games surface an insight → it's recorded here as `proposed` → a human approves → it's
`encoded` into the store the deterministic engine reads (`damage-mechanics.js`, seeds,
config) → a later capture `verified` it improved the model. Nothing is load-bearing until
approved; magnitudes stay nominal until calibrated. This file is the audit trail; the
scoreboard (`scoreboard.md`) tracks whether the model is actually getting better.

**Status lifecycle:** `proposed` → `approved` → `encoded` → `verified` (→ `calibrated`).
Every insight cites EVIDENCE (a game mechanic and/or a captured run) — never a hunch.

---

## INS-0040 — GEAR TIER must be anchored to PROGRESSION, and it is ROLE-AWARE (Mike, 2026-07-20)

**Status:** `approved` (design ruling) · implementation BLOCKED on INS-0041.

**Mike:** *"The gear tier should correspond to success at certain levels of progression so it ties
back to the level predictor. The multipliers on 'good' gear should get you past level 20 of the
dungeons (with the right team) and to Brutal clan boss (two key). 'fair' gear should get you through
level 10."* And: *"if your gear is good your attackers are near 100% crit rate and have some crit
damage. Your speed is right around the required amounts... your accuracy is close to the accuracy
gate. It might not be there but it is close."* And: *"supports are built with HP and DEF rather than
ATK and crit. If the support is a debuffer they shoot for the accuracy cap then go HP/DEF."*

**WHY NOT PERCENTILES (rejected):** a distribution-derived tier anchors "good" to whatever the synced
rosters happen to contain — Mike: *"I don't have a lot of good gear, I have much more fair gear."*
The corpus can only say where an account SITS; it cannot define the standard.

**WHY NOT THE DECLARED STAT FLOORS (falsified):** across 96 geared champions on six accounts, ZERO
meet Dragon stage-10's `ACC 150 + RES 250`, and ZERO exceed RES 250 at all (max 214) — yet Dragon 20
is cleared routinely. Anchoring tiers to the floors would bake a broken number in.

**THE ANCHOR THAT WORKS — observed carriers.** Gear on champions that DEMONSTRABLY clear stage 20
(31 of 96 geared): attackers **crit 89 · crit dmg 113 · ACC 142 · HP 33k** (vs a 170-225 ACC gate —
"close but not there", exactly as described). The rest of the geared population sits at crit 31 /
ACC 37 = the "fair" band. 627 of 723 champions have no gear at all.

**ROLE-AWARE IS STRUCTURAL, not a refinement.** Crit separates attackers (carrier median 89) from
supports (median 20); supports measure ATK 1092 / DEF 1300 / CRATE 20 vs attackers ATK 1909 / CRATE 78.
A single per-champion tier label cannot express "good" meaning different stats per role.
⚠ "is a debuffer" as a champion-level boolean is useless — 80 of 96 champions carry SOME debuff tag.
The bucket scorer's per-TAG ACC gate is the right instrument.

**BLOCKED BY [[INS-0041]]:** crit, SPD and ACC are all mis-mapped today, so the benchmark numbers
above must be re-derived before the classifier is built.

**Also open:** ACCOUNT-level vs PER-CHAMPION tier is unruled — the standing design note says
account-level, `mapRoster` uses the per-champion Gestal tier and ignores the account selector.

---

## INS-0041 — TWO stat-ID maps, two different ID SPACES, both wrong (2026-07-20)

**Status:** `proposed` — two entries PROVEN, the rest needs one in-game screenshot. **NOTHING CHANGED**
(Mike: *"just leave it all flagged right now"*). **Blocks all stat-derived work.**

`sync.js STAT_KIND` (artifact main/sub stats) and `lib/effective-stats.js STAT_KIND_ID` (`bonusesV2`
statKindId) disagree on **5 of 8** shared IDs — and they are genuinely two different enumerations,
not one map with a typo.

**PROVEN, via slot restrictions** (C.RATE/C.DMG = Gauntlets only · ACC/RES = Chestplate only ·
SPD = Boots only — no amount of bad gearing can violate these):
- **artifact-space `id7` = SPD** (currently `RES`): appears on **boots ONLY, 70 of 81**, and Mike
  confirms every champion runs speed boots.
- **bonus-space `id7` = CRATE** (currently `res`): Narma wears **Critical Rate ×3**, and the model
  applies **`+12 res`** while her crit rate stays at base 15.
- `effective-stats.js` additionally has **id2/id3 swapped** (id2 = 100% of Shields = DEF;
  id3 = 100% of Weapons = ATK) and `id8` as `acc` though it appears only on Gauntlets.

**CONSEQUENCE — RES inflated, SPD and CRIT under-counted, ACC uncertain, on EVERY Gestal champion.**
Everything stat-shaped must be re-derived after the fix: the ACC gates, "Narma ACC 112 vs the 150
floor", the RES-floor falsification, the carrier crit/SPD benchmark, and the gear tier.

**Verified-good and NOT affected:** win/loss, team composition, turns, duration, and per-hero DAMAGE.
The Pallas synergy measurement ([[INS-0036]]) is damage-based and therefore stands.

**NEEDS:** one in-game stat-panel screenshot to arbitrate id4/id5/id6/id8.

---

## INS-0039 — A champion the model CANNOT SEE: aliases were off in every shadow tool (2026-07-20)

**Status:** `encoded` (fixed in all 13 tools; the parameter now throws on omission).

**Mike:** *"I'm curious why my best champ is not on any of the teams?"*

`buildUserChampions(gestal, db, dbAliases = [])` — the third argument resolves any NAME FORM to the
champion. It **defaulted to `[]`**, and **every shadow/testing tool omitted it** while the live paths
(`api/my-roster.js`, `lib/battle-pipeline.js`) passed it correctly. A champion is invisible whenever
their Gestal display name differs from `champions.name` AND their `type_id` is null.

**"Thor Faehammer" → `champions.name` "Thor", type_id null ⇒ never entered the roster.** He is
usabilityTier 3 with 8 approved tags including **Multi-Hit A1 — the PRIMARY Fire Knight
`shield_break` tag** — plus AoE Stun and Decrease Turn Meter (`tm_lock`). With aliases on he enters
the Dragon and FK teams and **displaces Sun Wukong**, and Mike confirms the resulting Dragon team is
the one he already runs — an independent validation the bug had been masking.

Recovers **5 champions on DonThor, 10 on GuapoDonni, 1 on TicoTholin.**

**THE REAL LESSON — the `= []` default made it SILENT.** No error, just a quietly smaller roster. The
parameter is now REQUIRED (`undefined` throws; an explicit `[]` remains legal for tests). *A default
that silently degrades correctness is worse than no default.*

**NOT a `type_id` problem.** Backfilling `type_id` was proposed and REJECTED (Mike): `type_id` is an
ingestion-BOUNDARY column, `champions.id` is identity — `NAMING_ARCHITECTURE.md` §3b. Name + aliases
→ `champions.id` is the correct layer, which is what was fixed.

---

## INS-0038 — AFFINITY may be FIRST-ORDER on clear time, and gen-3 is blind to it (2026-07-20)

**Status:** `proposed` (n=3, one account, one team) — but the mechanism is a game fact and the
model gap is certain.

Don$Gnut Fire Knight, **the same five champions**, three stages:

| stage | boss | Ezio (ATK carrier, Spirit) | turns |
|---|---|---|---|
| 13 | Force | **STRONG** (crushing) | **96** |
| 16 | Void | neutral | 353 |
| 15 | Magic | **WEAK** (glancing) | **565** |

Clear time tracks the carrier's affinity matchup **monotonically**, and Ezio's ATK (3,135) is roughly
double anyone else's on that team.

**THE MODEL GAP:** `bucket-score.mjs`, `pool-select.mjs` and all five rubrics have **no affinity term**
— they only SELECT the column. Gen-1 has `applyAffinityToConfidence` + `dungeon_stage_affinities`
(150 rows, seeded). This is the **third capability gen-3 lost that gen-1 has** (leader aura — fixed
2026-07-20; affinity; synergy), all with the same cause: built as a first cut, omission logged as
debt, and each turns out to matter.

**METHOD WARNING:** Claude first attributed the 565→353 improvement to a leader-aura change; Mike
caught that stage 16 is affinity-neutral. **Any clear-time comparison ACROSS stages is confounded by
affinity** — hold the stage constant, or model it.

---

## INS-0037 — A WIN can be a FAILURE, and the grading harness cannot see it (2026-07-20)

**Status:** `proposed` (measurement + a structural gap in the test of record).

Don$Gnut cleared **Fire Knight 15 in 565 turns / 26.4 minutes with all five alive.** `CLAUDE.md` judges
auto content by **TIME** (~5 min reference), so that is a functional failure — and
`shadow-grade-clears`, our test of record, scored it as a **clear**.

The FK rubric graded that team **106.7, its highest score of all five contents**, on the path named
*"Survive grind"*, with `survive` filled to **190%**. It optimised for survival, got survival
(nobody died), and could not kill.

**THE GENERAL DEFECT — unconditional credit for DEFENCE whose value is conditional on that constraint
actually binding.** Second sighting the same day: the CB leader picker chose a **RES** aura for a team
that was not dying (RES converts to ~zero damage there). Third: `bucket-score` caps over-fill flat at
100%, so 190% and 100% are indistinguishable.

**COROLLARY (Mike):** *"when the buckets are full, we would want to swap in more damage."* Repair the
gaps first, then spend surplus on DAMAGE rather than on marginal bucket-stuffing. Implementing that
needs a damage MAGNITUDE to rank on — `bucket-magnitude.js` specifies
`effect size × uptime × land rate × build scale` and implements **uptime × land rate only**.

**Related, and shipped:** the BUILD FLOOR (level 50) on repair candidates, because with `build scale`
unimplemented an ungeared L40 filled a bucket exactly as a maxed 6★ would (DonThor: Dark Elhain,
L40, 4★, **zero equipped artifacts**, swapped into the Spider team). Gaps are now NAMED instead of
pretend-filled.

**Also unfixed:** `finishCause: "Retreat"` is captured and unused, so a run abandoned on TIME grades
as a WIPE — currently polluting Fire Knight, the one content that had no losses.

---

## INS-0036 — GRANTED DAMAGE, measured: Glorious Pallas is worth ~10x her damage bar (2026-07-20)

**Status:** `verified` (controlled A/B, replicated across two comparisons) — the first calibration
anchor for the contribution model.

Clan Boss Brutal, Don$Gnut, three runs differing by ONE champion:

| | 5th slot | **Pelops dmg/turn** | turns | team total |
|---|---|---|---|---|
| A | Ezio + **Pallas** | **38.4k** | 217 | 19.99M |
| B | Ezio + Gnut *(no Pallas)* | **28.6k** | 189 | 18.40M |
| C | Gnut + **Pallas** *(no Ezio)* | **37.3k** | 217 | 19.73M |

**Pelops holds ~37-38k/turn WITH Pallas and collapses to 28.6k WITHOUT her — regardless of who fills
the other slot.** Granted damage ≈ **9-10k/turn**, about **10× her own 1.1k/turn damage bar**.

**MECHANISM (already ruled, `lib/synergies.js` `pallas_argonite`, magnitude `high`):** her A1 attacks
with a random **Argonites** ally — Pelops is Argonites — for FREE (no skill slot, no cooldown), and
his mastery procs on each extra attack. **All of it lands in HIS damage bar.**

**THIS IS `CLAUDE.md` §4 MEASURED:** *"per-hero captured damage UNDERSTATES support value… never rank
or judge a support by its raw damage bar."* Claude judged Pallas as "~1% of team damage, close to
nothing" ONE PARAGRAPH after quoting §4; Mike corrected it. Note also she was CONSTANT across all four
earlier CB runs — a variable that never varies carries no information, so her stat line was not weak
evidence, it was **no evidence**.

**TRAP — the top-line number inverts the answer.** Gnut is the better personal damage dealer (13.0k/turn
vs 1.1k) and team damage-per-turn ROSE without Pallas (92.1k → 97.3k) — but total damage FELL 1.59M,
because Pallas bought 28 more turns. On CB, where the verdict is total damage vs the chest threshold,
**judging by per-turn output picks the wrong team.**

**FOR THE CONTRIBUTION MODEL:** champion value = own damage + (turns granted × team per-turn output) +
granted multipliers. This is the first case where all three of mechanism, pair and magnitude are known.

**NOT synergy-modelled in gen-3:** `bucket-score.mjs` has no synergy term; gen-1 calls `detectSynergies`.

---

## INS-0035 — CB team selection is DIFFICULTY-INVARIANT BY DESIGN (Mike, 2026-07-19)

**Status:** approved (design ruling). Closes an open question raised in the first testing session.

**The observation that prompted it:** `pool-select.mjs cb` on Don$Gnut returned near-identical
output across all four difficulties — grade 106.2 (Normal) → 105.8 (Nightmare), one champion
swapped. Claude flagged this as possible UNDER-SENSITIVITY (a defect). **It is not a defect.**

**Mike's ruling: "1 should be designed like that."**

**Why it's correct:** Clan Boss is ONE boss with ONE kit. Difficulty scales the boss's STATS
(HP, ATK), not its mechanics — so the mechanical PROBLEMS the team must solve are identical at
Normal and Nightmare, and the team that solves them is the same team. Nothing in a
selection-layer rubric should move.

**Where difficulty DOES belong — the OTHER axis.** Per the CB feedback model, the CB verdict is
purely damage vs the top-chest threshold of the difficulty run, and the deliverable is
*"suggest the TOP difficulty you can one-key."* Difficulty is therefore an OUTPUT of the
damage/chest axis, not an INPUT to selection. Selection answers "which five?"; the damage model
answers "how far up can these five carry you?" Conflating them would push the selector to
invent per-difficulty team differences that do not exist in the game.

**Generalization (the reusable rule):** *a scaling knob that changes enemy STATS but not enemy
MECHANICS must not move the selection layer.* Flat selection output across such a knob is the
model behaving correctly. This applies beyond CB — do not read stat-only invariance as
under-sensitivity anywhere.

**⚠ Do NOT "fix" this.** Adding difficulty sensitivity to the CB rubric would be a regression.
If a future session sees flat CB selection across difficulties and reads it as a bug, this
entry is the answer.

**Contrast — where flatness IS suspicious:** Spider returns an identical team and identical
bucket fills for stages 17 and 20, but Spider's bands are STAGE-DETERMINED by MECHANICS
(1-14 nuke / 15-20 wall / 21-25 HP Burn), so mechanics genuinely change and flatness is a real
open question. The distinction is stats-only (invariance expected) vs mechanics (variance
expected) — not "flat = bad."

**Consumers:** `tools/bucket-score.mjs`, `tools/pool-select.mjs`, CB rubric work, any future
review of CB selection sensitivity.

---

## INS-0034 — TAGS PICK, RESULTS DIAGNOSE — two layers, two data sources (Mike, 2026-07-18)

**Status:** approved (architecture). Explains and supersedes a whole day of wrong-headed testing.

**Mike:** *"to me, the tags are only for helping pick the team. we definitely need to overcome certain
challenges. The feedback should be all about real results and then refine the selections based on the
real data."*

**THE SPLIT:**
- **TAGS / the pool model → SELECTION.** "Can this team face the challenges this content poses?"
  Capability coverage, computed BEFORE the battle from the roster. Good at it: 14/15 clear-vs-wipe,
  lands on known-good teams on two accounts.
- **CAPTURES → DIAGNOSIS.** "Did it work, and what was actually short?" MEASUREMENT, computed AFTER
  the battle from the reader. Then the diagnosis refines the next selection.

**WHY THIS MATTERS — it is the root cause of a day of misdirected work.** Claude built three tests
(`shadow-grade`, `shadow-grade-dragon`, and the brute-force ranking) that all asked the TAG model to
RANK teams — a diagnosis question. They returned ~coin-flip (56% / 42%) and were reported as the model
failing. The tag layer was never going to answer them. `shadow-grade-clears.mjs` (14/15) asks the
selection question and passes. **Do not judge the tag layer by ranking; judge it by whether the team
it picks can clear.**

**PROOF THE DIAGNOSIS LAYER NEEDS MEASUREMENT, NOT BETTER TAGS.** Mike's own diagnosis of a Dragon 20
run (11:01, VICTORY) was: waves are the bottleneck, sustain is massively over-supplied, swap a healer
for a DPS, and if that wipes then the answer is masteries/gear. Every step came from measured numbers:
  healing 1,276,944  vs  damage taken 252,287  =  **5.1x over-supplied**
The POOL MODEL CANNOT PRODUCE THAT ADVICE — it reads that same team as `damage 207% · mitigation 170%
· poison_management 160%`, i.e. it believes damage is already abundant, so it would never propose
trading sustain for damage. Tag coverage cannot see over-supply of OUTPUT; only the capture can.

**CONSEQUENCE — REPRIORITISATION.** Effect size (per-(champion,tag) values from skill text) improves
PICKING only. The diagnosis path does not need it at all. So **dungeon per-hero capture leapfrogs
effect size**: `CbDamageReader.CaptureDungeon` exists but every dungeon capture records ZEROES for
damage/defense/healing, though the numbers are plainly on the in-game result screen. Fixing that makes
the sustain-surplus ratio compute itself on every run, on all content, with no LLM extraction and no
advisor review.

> **⚠ CORRECTION (2026-07-19, verified against the live battle log).** The claim above — *"every dungeon
> capture records ZEROES for damage/defense/healing"* — was **already false when written.** The reader
> fix had shipped in two stages and nobody noticed: per-hero `damage` from **2026-07-15→16** (100% of
> dungeon captures from 07-16 on; 48/169 overall), `healing` + `defense` from the **07-18 Release
> build** (5/169). Item 1 below is therefore **DONE**, and the sustain-surplus ratio does now compute
> itself on every dungeon run — worked live on Don$Gnut Dragon 20 (2026-07-19): healing 929,294 vs
> damage taken 202,208 = **4.6× over-supplied**, and ~2.8× after discounting Gnut's self-heal per
> INS-0032. ✅ **`defense` = DAMAGE TAKEN — CONFIRMED 2026-07-19** (in-game result-bar legend: red =
> damage dealt, **blue = damage taken**, green = healing). The ratio is measured, not conditional. **The residual constraint is DATA VOLUME (n=5 with healing) and it CANNOT be backfilled** —
> older captures never recorded the fields. Accumulation requires the reader running during play, which
> is also the lesson: the reader was NOT running for the 07-19 Tagoar→Vallaryn Dragon 20 swap, so that
> A/B has no captured baseline and is ungradeable.

**THE DIAGNOSIS BACKLOG, cheapest first:**
1. ~~Dungeon per-hero capture (damage / defense / healing) — currently CB-only.~~ ✅ **DONE** — see the
   correction above. Reprioritise the remainder accordingly.
2. The over-supply rule: `healing > N x damage taken` -> sustain is surplus -> name the seat to convert.
3. PHASE TIMING (wave seconds vs boss seconds). Not captured at all; "the waves are slowing me down"
   is unknowable from the current data — Mike had to say it out loud.
4. **A build-vs-composition verdict — and it is DEVELOPMENT broadly, not just masteries/gear
   (Mike, 2026-07-18): "i have a lot of level 50 5 star champs in the rotation. those need to be
   leveled up to 60. its a big stat increase."** When no swap improves the grade, say so and name the
   SHORT AXIS per champion.

   **THIS IS THE CHEAPEST ITEM ON THIS LIST, NOT THE LAST** — level, stars, gear_tier and
   has_boss_mastery are all already in the roster snapshot. No reader fix, no capture change, no LLM
   extraction. It is a rule over data we have had all along, and `devScore` already computes most of it.

   Measured on Don$Gnut 2026-07-18:
   | champion | state |
   |---|---|
   | Pelops | L60 6* + boss masteries — maxed |
   | Tagoar, Gnut | L60 6*, no masteries |
   | Ezio | **L52** |
   | Glorious Pallas, Narma | **L50 5*** |

   THREE OF THE FIVE FIELDED are under-developed; across the eligible pool it is 12 of 15; and just
   1 of 31 mapped champions has boss masteries. **This reframes the Dragon 20 result (11:01, VICTORY):
   that is not a composition failure, it is what an under-developed roster looks like** — which is
   also why both selectors and Mike independently land on the same five champions. There is nothing
   left to fix in the lineup.

   Order by stat gain: **ascension 5*->6* -> levels to 60 -> masteries -> gear.**

---

## INS-0033 — Book state IS derivable from Gestal, but the model must stay BOOLEAN (audience constraint) (Mike, 2026-07-18)

**Status:** encoded (`lib/gestal-context.js` `fullyBooked()`, commit 89d48f0).

`gestal-context.js` hardcoded `is_booked: false` for every synced champion, commented "Gestal does not
expose skill-book status directly." **That was false.** Every champion in the export carries
`skills: [{skillId, level, maxLevel}, …]`, so book state is fully derivable, per skill. We were asking
users for something we already had and discarding what we had. Now derived, same principle as
`has_boss_mastery`: read it authoritatively, don't ask a question we can answer. 13 champions across 5
accounts flag correctly (was 0).

**THE CONSTRAINT (Mike, load-bearing):** the product targets MOBILE players entering rosters by hand,
and the app's only book input is a single "fully booked" checkbox — partial booking is not expressible
for them. So the MODEL consumes all-or-nothing, and Gestal only gets to LIGHT THE SAME BUTTON UP. Do not
build a richer second code path off Gestal's per-skill detail that the audience can never feed. *This
generalises: build to the data the AUDIENCE can supply, not the data one power user's tooling exposes.*

**Known accepted error:** a partially-booked champion reads as unbooked and is UNDER-rated. Don$Gnut
2026-07-18 — Tagoar 86% booked (4/5 4/5 3/3), Fahrakin 38% (3/5 1/7 1/3); both evaluate false, and that
difference plausibly explains part of why the Tagoar team out-damaged the Fahrakin team. Joins lifesteal
gear and masteries as a reason REALITY CAN BEAT PREDICTION.

**Blocker for using books in scoring:** `cooldown_booked` is only 45% populated (1,573/3,490) and booked
*chances* are near-empty, so `is_booked = true` usually has nothing to switch to and falls back to base.
Capture is the gate, not wiring.

---

## INS-0032 — The CB result dialog carries THREE per-hero bars; HEALING ≠ team sustain contribution (2026-07-18)

**Status:** encoded (capture) · the caveats are `proposed` and BLOCK naive calibration.

`CbDamageReader` always read three per-hero stats — damage (`+0x090`), defense (`+0x098`), healing
(`+0x0A0`) — and `BattleWatcher` discarded two of them at the slot join. Now persisted. Verified
digit-for-digit against a result screenshot (Don$Gnut Brutal 2026-07-18).

✅ **`defense` = DAMAGE TAKEN — CONFIRMED 2026-07-19.** The in-game result-bar legend settles it:
**red = total damage dealt · blue = total damage TAKEN · green = total healing done.** These map in
offset order to `+0x090 / +0x098 / +0x0A0`. The field keeps the VM's name `defense`, but its meaning is
no longer open — over-supply ratios (healing ÷ damage taken) are MEASURED.
*(Superseded reasoning, kept as audit trail: the column was held UNCONFIRMED because values merely
clustered like damage-taken and the Taunt champion often led it — corroborating, not proof. The
inference was right; it just wasn't evidence. Note it would NOT have survived scrutiny: on the
2026-07-19 Dragon 20 run, Fahrakin — who has no Taunt — led the column over Pelops.)*

**WHY IT MATTERS:** per-hero DAMAGE understates supports by design (damage-mechanics §4). Glorious Pallas
showed 228k damage — 1.7% of team output, reads as dead weight — while healing 330k, the most on the team
by 2.4x. Sustain becomes MEASURABLE instead of argued.

**THE TRAP — do not calibrate sustain off the healing column naively:** it mixes TEAM healing, SELF
healing, and GEAR lifesteal. Gnut posted the largest healing of the day (1,392,073) with NO restoration
tag: he is in Lifesteal gear AND his A3 self-heals 30% of damage dealt — and the team died SOONER with
him (177 turns vs 210). A self-healer inflates the column without helping anyone. A cheap audit catches
it (observed healing vs kit restoration capability), and it flagged Gnut, Pelops and Ezio; but that audit
cannot separate "gear lifesteal" from "kit heal we never tagged" — Gnut is BOTH.

---

## INS-0031 — MAGNITUDE is the missing ingredient; coverage-is-binary recurs at EVERY level (2026-07-18)

**Status:** approved (diagnosis) · two candidate scorers BUILT AND REJECTED — record the failures.

Coverage-is-binary (the 2026-07-17 finding) is not one bug at one level. It reappears wherever the model
asks "does anyone have this?" instead of "how much of this gets done?" **Three instances in a single
session:**
1. **Sustain** — a Revive-only champion satisfied the whole sustain seat (fixed by splitting sustain into
   absorption/restoration/recovery roles, `lib/cb-shadow-goals.js`).
2. **Tagoar** — priced at 0.25x as a "redundant" second healer, then MEASURED delivering 479,739 healing,
   28% of the team's total and within 3% of Pallas. He is also the team's second TEMPO carrier; dropping
   him removed half the tempo coverage invisibly.
3. **Gnut** — L60 6★ carrying the top-weighted CB need (Decrease ATK) plus both amps (Decrease DEF,
   Weaken), discarded because Pelops ticked the boxes first. **Claude first blamed his ACC 40; a direct
   test disproved that** — raising him to ACC 200, and even removing the ACC gate entirely, still does not
   seat him. The cause is SATURATION, not the build gate.

**NEGATIVE RESULTS — two bucket-scorer fill rules built and rejected (`tools/bucket-score.mjs`):**
- **(a) "one seat = 20%, split across the buckets a champion covers."** Discriminated (Tagoar 78.7 >
  Gnut 70.1 > Fahrakin 68.7) but ranked the middle team last, and is WRONG IN PRINCIPLE: it makes a
  4-bucket champion contribute a quarter to each, so Pallas "cleanses at 50%" because she also buffs
  speed. It penalises exactly the multi-role champions the model exists to value.
- **(b) "best coverer fills the bucket, extras add 30% bonus"** (Mike's rule: *"you would give ONE spot
  for mitigation. any more is bonus... you wouldn't give 2 seats for mitigation"*). Correct in principle
  and it makes Pallas fill cleanse fully — but **all three captured teams then score 100/100.** Every
  bucket over-fills, so the model cannot tell them apart. It moved the checkbox from "role" to "bucket".
- **Penalising over-fill does NOT rescue (b):** the BEST team (Tagoar) has the MOST waste (58.9 vs 43.4 /
  45.0), so a declining-past-100% rule would rank it LAST. Flat-vs-declining is therefore not the lever
  while fill stays capability-based.

**The conclusion:** a bucket must be filled by HOW MUCH of the job gets done. All three teams "cover"
mitigation; what separates them is Pelops landing his at ACC 214 while Gnut lands his at ACC 20.
Estimated magnitude ≈ `effect size × uptime × land rate × build scale`, where effect size is the
bracket's own value normalised against the corpus range for that tag (Decrease ATK spans 25%–60%), chance
folds into land rate, and duration÷cooldown gives uptime. Selection needs ESTIMATED magnitude (available
pre-battle); captures supply OBSERVED magnitude for CALIBRATION. Cost: effect values must be extracted
from `skill_summary` per (champion, tag) — ~1/3 resist naive regex (conditional, random-pool, multi-debuff
prose), so it is an LLM-extraction + advisor-approval job like the tag regen.

---

## INS-0030 — The POOL model: a team is a 100% BUDGET across six buckets, not a checklist (Mike, 2026-07-18)

**Status:** approved (structure + allocation ruled by Mike) · scorer NOT working yet (see INS-0031).

**Mike:** *"we need to break down the pieces and re-grade them so all the parts make a whole on the
grade... we would have X% of the pool for mitigation, Y% for damage, Z% for healing/sustain."*

Replaces the ORDINAL weights (each need has a weight; a second carrier takes an arbitrary 0.25x haircut;
nothing sums to anything) with a CARDINAL BUDGET. The pool is 100% of what a team can be; champions FILL
buckets; the grade is how well actual fill matches target. Over-supply becomes VISIBLE instead of free.

**Six buckets — Mitigation · Sustain · Damage · Amplification · Cleanse · Tempo.** Mitigation stands alone
(ruled): on CB it is dual-purpose — it cuts incoming damage AND extends the fight, multiplying every other
bucket. Sustain keeps an internal absorption/restoration/recovery split one level down.

**Allocation (Mike, 2026-07-18) — 20% = one seat, sums to exactly 5.0 seats:**
`Mitigation 20 · Damage 20 · Tempo 20 · Sustain 15 · Amplification 15 · Cleanse 10`

- **TEMPO 20% is the headline** (the old weights implied 6.1%). *"speed is the most important stat in the
  game, top to bottom in all content. The first piece of any team should be who handles your tempo...
  which is why High Khatun gets used even for accounts that have 30 legendary champs."* Tempo is solved
  FIRST — an anchor pick, not a greedy outcome.

  > **⚠ CORRECTION (Mike, 2026-07-19).** This insight originally read: *"Don$Gnut owns High Khatun (L25)
  > and Apothecary (L24), both GATED OUT by `usabilityTier`, so the app cannot give the single most
  > valuable advice on that account: level High Khatun."* **That is WRONG.** Mike's actual statement was
  > CONDITIONAL — *"IF the account did not have a turn meter manipulator, THEN High Khatun would be the
  > most important to level."* Don$Gnut **has multiple already-levelled champions covering turn meter**,
  > so High Khatun is NOT a priority there. A conditional was recorded as an unconditional recommendation.
  >
  > **THE RULE THIS ESTABLISHES — an unbuilt champion's value is CONDITIONAL ON THE BUCKET BEING SHORT,
  > never intrinsic.** "Level X" may only fire where that account's bucket is actually unfilled. The model
  > already had the evidence: on Don$Gnut/Dragon the seed showed **tempo 40%**, the repair step seated
  > Glorious Pallas (`swap: Gnut → Glorious Pallas [tempo was 40%]`), and tempo finished at **112%** —
  > covered from the built roster. A correctly-implemented FILLABLE layer would therefore stay SILENT on
  > High Khatun for this account.
  >
  > The GAP itself is still real and still worth building: `pool.filter(usabilityTier >= 2)` makes every
  > unbuilt champion invisible, so the model cannot say "level X" on an account where a bucket IS short.
  > Only the worked example was wrong.
- **SUSTAIN 15%** (old weights implied 30.4%) — 0.75 seats, so ONE good sustain champion fills it and a
  second overflows. Matches the measured 2.7x overheal, and predicts the build-conditional flip on its
  own: under-built, Pallas alone does not fill it and a second sustain earns the seat; built, she does,
  and the seat converts to damage. *This is why the right answer changes with build state.*

**SHARE vs REQUIREMENT are two mechanisms.** The share sets the GRADE penalty; a separate, conditionally
active REQUIREMENT forces a seat in SELECTION (Mike: at fair gear or below a speed booster is mandatory).
Requirements never hard-fail — they degrade into NAMED GAPS, and each bucket tracks FILLED vs FILLABLE, so
an owned-but-unbuilt candidate becomes a "level this next" recommendation rather than silence.

**Boundary rulings** (full list + open questions: `knowledge/cb-bucket-taxonomy-DRAFT.md`):
`Increase ACC`→Amplification (a champion's own ACC STAT is a gate; an ACC BUFF they place is a
capability — stat ≠ buff); `Taunt`, `Increase DEF`, `Increase RES`→Mitigation (mitigation = damage
prevention on EITHER side of the exchange; sustain = a resource spent on what got through — a shield is
healing paid in advance, and stays in Sustain); `Decrease Speed`→Tempo (tempo is two-sided);
`Reflect Damage`→Damage (damage-on-being-hit is a real lane); `Buff Strip`/`Steal Buffs`→DEAD on CB.

**Champion value ≈ BUCKET SPAN.** Five seats is the binding constraint, so a champion collapsing three
jobs into one slot is worth more than the sum — which is *why* Pallas (tempo + all three sustain
mechanisms + cleanse) and Pelops (mitigation + damage + sustain) are coveted. The checkbox model cannot
express this; it sees Pallas ticking four boxes and discounts everyone who overlaps her.

---

## INS-0029 — Team building is ROLE-ASSIGNMENT across 5 seats, and a RESULT-DRIVEN LOOP (Mike, 2026-07-16)

**Status:** approved (principle) · first assembler built (`lib/team-assembler.js` + `tools/assemble-team.mjs`).

**The SELECTION layer, above the problem model (INS-0027):** the problem model says WHO CAN fill each role
(breadth). A team is built by assigning each of 5 SEATS a PRIMARY role (the job it was picked for); a champ's
other capabilities are BONUS. Multi-role champs are efficient — they cover a seat AND free another. For Fire
Knight the seat-roles span WAVES + boss: WAVE / SHIELD / TM-LOCK / SURVIVE / DAMAGE. This reconciles "waves are
separate content" (boss model stays clean) with "one team for the whole run" (WAVE is a team SEAT) — and it's
why Seer earns an FK slot (she's the wave-role pick, not a boss champ). Universal across content.

**It's a LOOP, not a one-shot (Mike):** a team is a hypothesis; the battle RESULT is the test. The result says
which ROLE fell short; then you RE-SOLVE under a hard CONSTRAINT — fix the short role WITHOUT dropping the roles
that already worked. The role MODEL stays stable; only the LINEUP adapts per account/result.
`assembleTeam` (greedy set-cover, multi-role-preferring) → `diagnoseShortRole` (maps captured
result/turns/finishCause/per-hero-survival → the short seat) → `fixTeam` (constrained swap search:
out a redundant seat, in a champ that reinforces the short role while PRESERVING every covered role).

**Diagnostic map (readable from a capture):** died in waves→WAVE; shield never dropped→SHIELD; boss nuked you
dead→TM-LOCK/SURVIVE; won-but-105-turns→DAMAGE (grind); a champ died first→that seat's role.

**Proven (2026-07-16):** GuapoDonni (deep, 161) covers all 5 roles with 2 champs → 3 LUXURY seats, and a grind
result finds 235 constraint-preserving fixes (fluid). TicoTholin (new, 11) covers thinly, and a wave-loss finds
NO valid swap → correctly a **BUILD gap** ("can't reinforce WAVE without dropping a role" = the new-player wall,
stated precisely). This IS the Deep Blue loop applied to team-building; the app's edge is the constrained search
a human finds tedious ("if I add X, what do I lose?").

**WIRED TO REAL CAPTURES (2026-07-16):** `tools/assemble-team.mjs --capture` reads the account's latest FK
battle from `battle-log.json`, resolves the fielded team, diagnoses by TIME (not turns — CLAUDE.md core), and
proposes the constrained fix. Proven on GuapoDonni's real FK17 win (667s > 5-min budget → "too slow, reinforce
DAMAGE" → swap Duchess Lilitu → Sun Wukong, all roles preserved, 168 options). **Identity-resolution fix (matters
pipeline-wide):** captures use FULL typeId (base+ascension) + IN-GAME names; DB keys on base type_id + short
names. Resolve via the account SNAPSHOT's typeId→baseTypeId bridge, then capsByType, then a name-PREFIX fallback
(e.g. "Neldor Rimeblade" → DB "Neldor", whose type_id is null). **5-HERO CAPTURE FIXED & verified live (2026-07-16):** the reader dropped 1 of 5 heroes — the file-parse
identity filter (`BattleWatcher.cs`) rejected any champ whose FILE typeId low-byte was garbage (its own
comment flagged "rejects Seeker/Valerie"; Michelangelo was another). Fix: RECOVER a dropped file-hero whose
heroId is in the roster (trust heroId → correct name/typeId) confirmed as a real ally via the combat-memory
team; then assign TRUE combat slots to ALL heroes (consuming each once) so nothing collides and the
screen-order damage join + survival align. Verified on two live FK16 wins: 5 heroes, unique slots 0-4,
Michelangelo recovered, all survival resolved. **PER-HERO DAMAGE — also FIXED & verified live (2026-07-16):**
the reported "per-hero sums <total" wasn't an under-read — CaptureDungeon matched a PHANTOM 6th context (raw
"6 hero(es)") whose value was exactly **0x120000 = 1,179,648** (a documented SENTINEL for a stale/uninitialised
context), inflating `res.TotalDamage`. Two-part fix: (1) `TotalDamageDealt` = sum of the per-hero damages JOINED
to roster heroes (excludes any non-team context — boss/minion/sentinel), (2) hardened `ValidStat` to reject
0x120000 at the source. Verified: Ice Golem 20 win → totalDamageDealt === heroSum (4,572,978), 5 plausible
per-hero values (Xenomorph 1.75M carry). Capture is now trustworthy on BOTH identity/survival AND per-hero
damage → the reconciliation loop can key on per-hero contribution, not just time.

**Next-iteration refinements (v1 uses capability PRESENCE):** weight by capability STRENGTH not just presence
(bring a champ STRONG in the short role, gear/dev-aware); ensure critical seats (SURVIVE/SHIELD) get a champ
whose MAIN job it is, not just a bonus; the TM-LOCK/SURVIVE substitute pair; fix 5-hero capture completeness.
Multi-hit read from skill text (backfill still proposed).

---

## INS-0028 — The KEYWORD GLOSSARY is the missing SEMANTIC layer; deep-mechanic pages fan out across layers (Mike, 2026-07-16)

**Status:** approved · glossary captured (`data/keyword-glossary.json`, ~79 entries + 88/88 core coverage).

**The gap Mike exposed:** we conflated two different things. `champion_skills.skill_summary` = per-champion
skill WRITEUPS (have, ~92%). The definition of what a `[keyword]` DOES (Infest's 10% boss cap, Intercept's
CC-block) = the game's ENCYCLOPEDIA — which we did NOT have. There was no glossary table; the only
"definitions" were `tags.description`, which were incomplete (Infest missing the cap) and one was **WRONG**
(our Intercept said "intercepts hits" — it blocks CC debuffs). So the model reasoned over keywords whose
MEANINGS were unreliable. **Three data layers, we were missing the middle one:** (1) skill writeups →
(2) **keyword glossary** [MISSING] → (3) tags (labels whose semantics DEPEND on layer 2).

**Built:** `data/keyword-glossary.json` (Tier-1 factual game data, Mike-provided) + `tools/glossary-{scan,check}.mjs`.
Coverage of the 167 distinct `[brackets]` in skill text: 88 DEFINED (all core keywords incl. spelling
variants + the Cyrillic-`С` homoglyph), 49 NOISE (faction-Unity / conditional clauses — not keywords),
30 REVIEW → mostly champion skill-NAMES-in-brackets + parsing artifacts; the **6 genuine missing keywords**
(`Block Revive`, `Debuff Spread`, `Buff Spread`, `Block Passive Skills`, `Evade`, `Polymorph`) are all now
**ADDED (2026-07-16) — core keyword coverage COMPLETE** (94 tokens defined). Decision-relevant facts captured
along the way: Block Active/Passive Skills do NOT work on bosses; Block Revive doesn't expire on dead enemies
(key vs Ice Golem); Polymorph/Sheep are Arena-only (bosses CC-immune). Remaining REVIEW = non-keywords
(champion skill-names, `[Passive/Active Effect]` section markers) + optional turn-economy labels
(`[Instant Turn]`, `[Extra Turn]`, `[Turn Meter]`).

**Applied — `tags.description` corrected from the glossary (seed 138, `tools/tag-desc-from-glossary.mjs`):**
45 updates. Fixed 3 flat-WRONG descriptions (Intercept "intercepts hits"→blocks CC; Immutable "prevents buff
removal"→blocks cooldown increases; Shatter "reduces MAX HP"→+Ignore DEF) + 42 thin stubs → authoritative
mechanics. SAFE: left 32 SUBSTANTIAL descriptions untouched because they carry PROJECT modeling notes the
glossary lacks (Decrease ACC→IG Numbing Chill; Heal Reduction→FK Fyro sustain; Reflect Damage→IG Frigid
Vengeance danger; Block Revive→ACC-check correction). Skipped Total Guard (glossary def was a placeholder).
Feedback ran BOTH ways: the Block Revive tag's ACC-check correction was folded BACK into the glossary.

**Wired — glossary modelFlags now change MODEL BEHAVIOUR (2026-07-16):** each SURVIVE problem carries a
`threat` (`direct`/`dot`/`mixed`); `evaluateRoster` consults `PROTECTION_MECHANICS`/`mitigates()` so
DIRECT-ONLY protection (Ally Protection, Shield) is DROPPED on a pure-DoT threat and FLAGGED partial on a
mixed one. Proven: Fire Knight (direct) credits Ally Protection fully; Spider (mixed) now warns "Shield/Ally
Protection cover only the direct-damage portion — they don't stop the DoT ticks." The semantic layer earns
its keep. (FK/IG SURVIVE threat=direct; Spider=mixed.)

**Skill-vs-tag DEMONSTRATION — the ceiling, proven (2026-07-16):** for Fire Knight, the tag model saw only
**6** of GuapoDonni's shield-breakers; reading the actual A1 skill text found **41 more untagged** — the tag
model was blind to ~87%. Systematized pool-wide: `Multi-Hit A1` was only **15 approved** while **251 Rare+
champs** have "attacks 1 enemy N times" in their A1 text → bulk-backfilled as proposed (seed 139,
`multihit-backfill-2026-07-16`; now 15 approved / 255 proposed, a ~17× lift pending advisor approval). This
is BOTH gaps at once: (1) tag COMPLETENESS is a huge silent hole (an untagged ability = an invisible champ),
and (2) reading text reveals COMBOS no tag set encodes (multi-hit A1 that ALSO Decreases TM each hit → breaks
the shield AND feeds the TM-lock in one skill: Masked Fearmonger/Prosecutor/Kinagashi/Panthera; Lordly
Legionary's conditional extra hit; Duchess Lilitu's A1 is a breaker+shield). #1 is a data fix; #2 is the case
for the skill-text REASONING layer the glossary now enables — the answer to "why the model can't out-create a
YouTuber." Proposed tags don't reach the engine (reads approved) until advisor-approved.

**Deep-mechanic FAN-OUT (the reusable template, worked on the Ally Protection FAQ):** a rich gameplay page is
NOT one datum — route each slice: mechanic rules → glossary entry's `mechanics`; the machine-readable facts the
engine reads → glossary `modelFlags` (e.g. `damageType:'direct-only'`, `stacks:false`); interaction/stacking
rules → `lib/damage-mechanics.js` (§9 `PROTECTION_MECHANICS` + `mitigates()` + `combinedDamageTaken()` +
MITIGATION_STACKS_MULTIPLICATIVELY); value+targeting variants → richer `champion_tags` (`target_type` exists,
a VALUE dim is a schema gap); the champ list → verifies the tag rows; build advice → DERIVED from the mechanics
(not copied — stays clear of the no-editorial rule). **Payoff proven:** `mitigates('Ally Protection','dot')`
returns false → the SURVIVE scorer now knows NOT to credit Ally Protection vs a pure-DoT boss (a flat tag would),
it doesn't stack (2nd protector wasted), and 3× Guardian 10% = 0.729 not 0.70.

**Why it matters (ties to INS-0027 + the tag-lossiness thread):** a tag says "this champ protects allies"; the
glossary says "…but only vs DIRECT damage, raw, and only one counts." THAT difference is what lets the model
out-reason a naive tag-matcher — and it's the semantic foundation the future skill-text reasoning layer needs.

---

## INS-0027 — EVERY dungeon is MULTI-PATH: model it as PROBLEMS × open ability-sets, never a fixed comp (Mike, 2026-07-16)

**Status:** approved (principle) · Fire Knight validated · Ice Golem draft.

**The principle (Mike's framing, verbatim intent):** "None of the dungeons are single-path — that is
the most important thing the model can understand. There are MANY ways to crack the codes. Hundreds of
champions with different abilities. Very few people can remember what each champ does — the app looks at
a roster and sees which specific champs fill which roles. We can NOT be looking for only a few champions
in each dungeon." A dungeon = a set of mechanical PROBLEMS; a champion = a bundle of ABILITIES; the app
finds EVERY champ that can contribute to EACH problem, across the many solution families, and reports
which problems the roster can cover. NEVER gate on a canonical comp.

**What this corrects:** the first-gen solvers (`tools/{ig,fk,spider,dragon,cb}-solver.mjs`, INS-0026)
regressed to hard-coded canonical comps — e.g. fk-solver demanded "3+ Multi-Hit A1." That's "looking for
a few champions," the anti-pattern. The DB schema was ALREADY right (goal-based **OR-of-ANDs**, 973
`goal_solutions`); the solvers narrowed it. The fix widens the problem→ability mapping and lets many
solutions coexist.

**Evidence (the capture that forced it):** GuapoDonni cleared **Fire Knight 16 on auto** (105t / 262s)
with a team carrying essentially ONE multi-hit champ (Michelangelo, A1×2) + sustain/control — the
fk-solver would have called it "stuck." Fire Knight is not single-path: the 3× shield-break comp is the
FAST clear; a strong sustain team GRINDS it within the time budget (same [[floors-are-not-gates]] pattern).

**Encoded:** `lib/dungeon-mechanics.js` (MODELS + `evaluateRoster` + `vocabCoverage`) · CLI
`tools/dungeon-model.mjs`. Fire Knight = 5 problems (SHIELD-HITS / DAMAGE / SURVIVE / MINIONS / TEMPO),
**106/106 vocab tags placed** by walking the WHOLE vocabulary against each problem (not from memory).
Validated: it now recognizes GuapoDonni's real winning team (all problems covered) and shows the BREADTH
— 52 shield-strippers, 36 damage-dealers, 110 sustainers, 107 minion-handlers in that one roster. Ice
Golem drafted (DOT-RACE / MINIONS / SURVIVE).

**FK DoT MECHANIC — took THREE iterations to nail (Mike, 2026-07-16); the final truth:** DoT (Poison/HP
Burn) **DAMAGES Fyro and helps KILL him**, but (a) it does NOT break the shield (not a hit) and (b) you
can't LAND it while the shield is UP (the shield blocks debuffs). So DoT is a real FK **damage** tool,
**gated behind breaking the shield** — apply it in the broken window and the ticks persist. My wrong turns,
recorded as a discipline lesson: ① first assumed DoT ticks THROUGH the shield (a "grind/bypass" path) —
WRONG; ② over-corrected to "DoT is useless / Fyro ignores it" and EXCLUDED the whole DoT family — ALSO
WRONG; ③ truth = post-shield damage tool. Model now: SHIELD-HITS breaks it (hits only), DAMAGE credits
attacks AND DoT (Poison/HP Burn/Poison Explosion), amps include Poison Sensitivity / Increase Debuff
Duration; only Necrosis/Poison-Cloud/Pain-Link stay out (need deaths / are Hydra-specific). **Lesson: a
subtle mechanic can be wrong in BOTH directions — verify the precise interaction, don't just flip the sign.**
(This also reverses my critique of a community guide's Fahrakin/Fenshi DoT picks — their DoT DOES help kill
Fyro post-shield; the Vogoth-Provoke and Seer-is-waves points still stand.)

**REFINEMENT (Mike, 2026-07-16) — the FK meta is TM-LOCK, and problems can be SUBSTITUTES:** the most
common FK strategy is break the shield, then keep Fyro's Turn Meter DOWN so he never takes a turn (his
AoE nuke + heal never fire). So "deny his turn" (TM-LOCK, ★meta) and "survive his turn" (SURVIVE) are
SUBSTITUTE solutions — a roster needs ONE, not both, and TM-lock is much easier. **Coldheart (a RARE!)
and Alure are "cheat codes"** — their TM reduction hard-locks him. Encoded: TM-LOCK is its own ★meta
problem (Decrease TM / AoE Decrease TM / Decrease SPD), TEMPO narrowed to team-speed that ENABLES it, and
models now carry an `exemplars` field (cheat-code champs the app surfaces as build targets). GuapoDonni
owns NEITHER Coldheart/Alure → that's exactly why they ground FK16 for 105 turns via the SURVIVE path;
the app's advice = "get Coldheart (Rare, cheap) to TM-lock instead." Three model concepts this adds:
(1) SUBSTITUTE problems (cover any one of a set), (2) per-problem exemplar/cheat-code champs, (3) each
exemplar carries ACTIVATION CONDITIONS — the app must say HOW to build it, not just name it. Caveats
(Mike): **Coldheart** is very squishy (needs defensive gear / a protector) + must be BOOKED for full TM
(easy, Rare — ties to INS-0003 Rare-default-booked); **Alure**'s TM only fires on a CRIT → needs ~100%
crit rate (crit-conditional, policy #4). Encoded in `exemplars[].caveat`.

**CORRECTION #2 (Mike-led, 2026-07-16) — FK boss is Fyro SOLO; my "minions" was an inherited assumption:**
seed 135 models FK as a single boss per stage ("waves are separate content"). I'd carried a MINIONS
problem ("one-shot squishies") ported from the first-gen `fk-solver.mjs` — WRONG (conflated the separate
wave trash / other dungeons' adds). Removed MINIONS. Consequence: Fyro is CC-IMMUNE (universal dungeon-boss
rule) AND there are no adds → **offensive crowd control is dead weight in FK** (Stun/Freeze/Sleep/Provoke/
Fear/Taunt/… all EXCLUDED). Also resolved the two open tags: **Infest** (death-explosion, capped 10% vs
bosses/minions + needs dying enemies → useless on a lone boss; an Arena tool) and **Intercept** (defensive
anti-CC → irrelevant since Fyro deals no CC; but it's real for IG-Freeze / Dragon-Scorch-Stun SURVIVE).
**Pattern:** TWO FK errors (DoT-through-shield, minions) were both inherited from the first-gen solvers
un-verified → verify each dungeon's real composition/mechanics (against `dungeon_stage_enemies` or Mike)
before it becomes model structure, rather than porting the old solvers' assumptions forward. AMPLIFIERS (Decrease DEF etc.) are kept SEPARATE from problems so the model
never mistakes an amplifier for the wall — and per damage-mechanics §1, Decrease DEF is NOT an amplifier
for a DoT-race (it only boosts ATTACK damage).

**Corollary — tag completeness is existential:** an untagged ability is an INVISIBLE solution path.
Michelangelo's A1×2 was untagged for Multi-Hit A1 → the app couldn't see the champ that carried the clear.
Fixed (seed 137, + Gnut A1×3 / Tagoar A1×2). Breadth of recognized abilities = breadth of paths offered.

**Open / next:** ~~confirm "Poison ticks through the FK Divine Shield"~~ RESOLVED — it does NOT (see
CORRECTION above); `Infest`/`Intercept` still unplaced (Mike unsure); IG's burst-path + whether %maxHP
dodges Frigid Vengeance still need Mike's review; generalize Spider/Dragon/CB to the problem-first shape;
then wire into the live goal/goal_solutions engine (the real product path).

---

## INS-0026 — The product is a per-(account × content) MECHANIC-SOLVER, not a power model — two gates: BOSS (mechanic) + WAVE (survival)
- **Status:** `encoded` (product direction, Mike-driven) — 2026-07-15 · `tools/ig-solver.mjs`, `tools/fk-solver.mjs`
- **Class:** the app's actual architecture — supersedes the generic power/brute-force modeling as the GOAL.
- **The redirect (Mike, repeatedly):** the app's job is NOT "how high can you brute-force" (a new
  account walls at ~8-10 on everything anyway). It is **"which team from your roster SOLVES this
  content's mechanics, and what are you missing."** Brute-force ceiling is a footnote. Tags are "one
  small slice" of the mechanic — the real spec is each content's DESIGN DOC (Klyssus, Fyro, …).
- **The model — per (account, content), evaluate the roster against that content's specific mechanic
  requirements.** The answer VARIES on both axes: "developed account" is NOT global — it's cell-by-cell.
  Whether a roster fits is often LUCK, not skill (GuapoDonni's best-5 happens to solve IG via
  poison/heal champs; the SAME best-5 FAILS Fire Knight — no idea their roster has 6 multi-hit
  shield-breakers). Luck doesn't transfer across content → the app's value is the "stuck cells."
- **TWO GATES in sequence, DIFFERENT kinds of check:**
  - **BOSS gate = the mechanic** (tag/role-solvable — the solver's domain). IG = one of 3 strategies
    (Block Revive / Poison-race / Sustain+minion-CC); FK = shield-break (**3+ Multi-Hit A1** + speed/TM
    + minion CC). Built + working for IG + FK.
  - **WAVE gate = SURVIVAL** (2 waves before the boss) — can the team's BULK survive the wave AoE +
    clear it. This is STATS, not tags (a tag-based wave gate flips always-fail↔always-pass; neither is
    real). **The wall for WEAK accounts** — they die in the waves before the boss (TicoTholin FK stage
    10, Dragon waves). **NOT modeled: needs per-stage wave-enemy difficulty data (INS-0021) — the one
    difficulty input we've never had, and the thing that most gates the NEW-account audience.**
- **Reconciles the two threads:** "solve the mechanics" = BOSS gate (mechanic-solver, done). "The wall
  was the waves" = WAVE gate (survival, needs data). Both real; which one BINDS flips by account power.
- **The app's two outputs:** (1) field the mechanic-correct team (which is usually NOT your strongest 5
  — e.g. FK shield needs multi-hit, and no amount of single-hit power breaks a 10-hit shield);
  (2) the gaps → "acquire a Block Revive champ" / "you need 3+ multi-hit champs" (the what-to-build).
- **Built this session — ALL FIVE content solvers** (`tools/{ig,fk,spider,dragon,cb}-solver.mjs`),
  each carrying that content's SPECIFIC gate (the whole point — a uniform score flattens these):
  - **Ice Golem** — which of 3 strategies (Block Revive / Poison-race / Sustain+minion-CC). VALIDATED
    (48/48 high-IG clears used a strategy; brute walled at 8).
  - **Fire Knight** — HIT-COUNT: 3+ Multi-Hit A1 to break the shield (raw power is *irrelevant*).
  - **Spider** — strategy (AoE/Max-HP/Poison-Explosion/HP-Burn) + a COMPUTABLE ACC floor (stage×11).
  - **Dragon** — burst the Inhale "purple bar" + CLEANSE the Decrease-ATK (or your damage is crippled).
  - **Clan Boss** — the kit is easy; the gate is **Warmaster/Giant Slayer masteries on 5** (a per-champ
    INVESTMENT gate, read from Gestal masteryIds) — a different KIND of gate than the dungeons.
- **The matrix proven varied:** GuapoDonni (215 champs) is lucky/ready on IG+Spider+Dragon+CB but
  hard-STUCK on Fire Knight — "developed" is cell-by-cell, not global.
- **Two gates for wave dungeons (IG/FK/Dragon):** BOSS (solved above) + WAVE (survival — the wall for
  WEAK accounts; TicoTholin dies in the waves). The wave gate is STAT-based, NOT tag-based, and needs
  per-stage wave-enemy data we don't have (INS-0021) — the biggest remaining lever for new players.
- **Tag layer is ~90% adequate** (my "Poison:6/HP-Burn:0" alarm was an unpaginated-query bug — real:
  Poison 85, HP Burn 65). Narrow enrichment **DONE 2026-07-15** (seed 136, `tools/tag-enrich-{scan,seed}.mjs`,
  landed status='proposed' for advisor review):
  - **Poison Explosion** 0→12 (Balar/Ezio/Stokk/Dark Kael/Nell/Talenna/Teodor/Vizug…) — was blocking
    Spider strategy C; the vocab tag existed but had ZERO champs. Once approved, wire Spider strat C.
  - **AoE Decrease Defense** 5→+20 (pure coverage miss; all literally "60% [Decrease DEF] on all enemies").
  - **Reset Cooldowns** 0→28 — **ALLY-cooldown reducers ONLY** (Mike's ruling): self-on-kill resets
    excluded as personal DPS perks. 3 hand-excluded (Iudex Artor/Tribune Herakletes/Vulkanos — their
    "ally" mention is only a trigger; the reset is their own skill).
  - **Increase Debuff Duration** — NEW vocab tag #106 (60 champs). Extends DoT/debuff uptime → boosts
    DoT-team total damage (the survival×output model). Distinct from policy #11 (which rejects tagging
    the EXTENDED debuff as a placement — this tags the extension CAPABILITY).
  - Method note: matched `champion_skills.skill_summary`, keyed on `champions.id` UUID (no name
    ambiguity), false-positives filtered per policy (bomb-vs-poison, removal/immutability, negation).
  - **OPEN:** (a) advisor approval of the 120 proposed rows; (b) worksheet `DB_Champion_Tags`
    reconciliation (policy #18) — deferred: bracket-scraping is deprecated so the overwrite risk that
    motivated #18 is gone, and these are proposed-not-approved; reconcile on approval.
- **Solo carries fall out of this framework** (Mike): a solo = ONE champ whose kit covers the whole
  checklist + self-sustain (Lifesteal/Regen set) — makes solo DERIVATION (POWER_LAYER_SCOPE's "hardest
  piece") tractable; validate against the 45 `champion_solo_profiles`.
- **Supersedes the power-model calibration as the product** ([[POWER_LAYER_SCOPE]] brute-force is now
  just the wave-gate's survival half, not the recommendation).

---

## INS-0025 — The evaluator scoreboard + first VALIDATED term (Dragon wave-defense): the Deep Blue loop, working
- **Status:** `encoded` + `verified` (on the scoreboard) — 2026-07-15 · `tools/scoreboard.mjs`, `lib/power-model.js`
- **Class:** methodology (the evaluation-function test) + the first measured model improvement.
- **The scoreboard (`tools/scoreboard.mjs`):** grades the power-model verdict against every captured
  battle (clears/doesn't vs won/lost); confusion matrix overall + per content; scores KILL-ONLY,
  KILL+WAVE-DEFENSE, and TWO-SIDED side by side. This is the Deep Blue test — the evaluator is only
  as good as its predictions on real games — and the GUARDRAIL: a change is kept only if accuracy
  rises HERE (the fix for the hunch-driven mistakes made all session).
- **What it revealed (114 battles, 95W/19L):**
  - **KILL-ONLY = 85%, and its ONLY error mode is OVER-prediction** (17 FP, **0 FN** — it never tells
    a winner it'll fail). So the kill model is a trustworthy floor that over-promises.
  - **TWO-SIDED (current survival) = 64% — survival HURTS** (FN 0→29, IG 44%). Measured proof of
    [[INS-0018]]: the survival model must be REBUILT, not switched on. The board would stop anyone
    wiring it.
  - Over-prediction is worst on **Dragon (67%)** — the wave/Freeze deaths.
- **First validated term — Dragon wave-defense (`waveDefenseOK`):** the discriminator (across teams,
  since same-team Dragon-11 win/loss is pure Freeze RNG) is **CC/debuff-DEFENSE**: Block Debuffs +
  RES (RES-54/no-Block ~37% at Dragon 11; RES-113/Block ~79% at Dragon 20). Gate: on DRAGON, a team
  lacking Block Debuffs / adequate RES / (AoE+CC) is a sub-50% stage → not a confident clear. Result:
  **overall 85→87%, Dragon 67→74%, ZERO collateral** to IG/Spider/FK.
- **The method self-corrected mid-build (the point):** v1 applied the gate to all wave dungeons →
  scoreboard showed it BROKE Ice Golem (91→81%, flagged IG wins as fails) because **IG's wall is the
  Frigid-Vengeance SPIKE, not CC.** Restricting to Dragon fixed it. The tool caught the over-reach
  before it shipped — exactly what every hunch this session lacked.
- **Honest limit:** Dragon 74% not 100% — Dragon-11 for that roster is a real RNG boundary
  (same team, 5L+3W, identical stats); no deterministic term separates a coin flip ([[INS-0023]]).
- **Next, ranked by the board:** IG over-predictions → a **spike term** (Frigid Vengeance); Spider →
  a **heal/adds term** (Skavag). Same loop each: find the discriminator, add the term, keep iff
  accuracy rises. And the survival side needs REBUILDING (it currently subtracts).

---

## INS-0024 — The live coverage engine is unreliable in BOTH directions on one roster (Spider over +6, Dragon under −7) — the definitive case for the power model
- **Status:** `encoded` (evidence) — 2026-07-15 · TicoTholin live audit
- **Class:** the core Deep-Blue thesis, demonstrated on real captures: coverage ≠ power.
- **Evidence (one account, one session, TicoTholin):**
  - **Spider: engine recommends 13 (84%), real ceiling ~7.** Captures: Stage 6 WIN (35t, 5/5), Stage
    7 WIN (54t, 3/5), Stage **8 DEFEAT** (109t, 0/5, 1.04M dmg dealt but no kill). OVER by ~6. The
    Stage-8 loss is the classic Spider failure — huge damage, no clear, because a Lv40 team can't
    out-damage Skavag's heal before the spiderlings pile up.
  - **Dragon: engine recommends 4, real ceiling ~11** ([[INS-0015]] affinity soft-penalty hard-gates
    to Void-only stages; the team grinds Dragon 11 at ~37% — see the Dragon diagnosis). UNDER by ~7.
- **Root cause (single):** the live engine (`scanSpiderStages`/`scanDungeonStages`) scores **tag
  COVERAGE + placeholder floors + affinity**, never **raw POWER**. It can't distinguish "you have the
  right tools" (Spider tags present → says 13) from "your stats are strong enough to execute them"
  (a Lv40 team loses at 8). So it OVER-credits Spider (coverage present, power absent) and
  UNDER-credits Dragon (affinity gates coverage). Same roster, same session, opposite errors.
- **Over-recommendation is the worse half:** telling a player Spider 13 when they lose at 8 sends
  them to fail ([[INS-0020]] risk #1). The Dragon under-rec merely sandbags.
- **The power model would fix the DRAGON under-rec, but NOT the Spider over-rec — TESTED, my earlier
  "good wiring test case" claim was WRONG (2026-07-15).** Computed the kill floor for TicoTholin's
  actual Spider team: `ttk` = 41 at Stage 8 (they LOSE) and 112 at Stage 13 (≤ budget) — the model
  says BOTH are "kill-OK", i.e. it OVER-recommends Spider 13 too. Two causes: (a) Ezio/Kael carry
  poison → DoT keeps `ttk` stage-flat ([[INS-0020]]); (b) the deeper one — the kill model models a
  STATIC-HP boss with all damage landing on it, but on Spider **Skavag HEALS/grows and damage bleeds
  into the spiderlings** (proof: the team dealt 1.04M at Spider 8 = 3.4× the 307k boss HP and still
  lost). So the Spider over-rec is a blind spot in the power model too, missing everywhere:
  **boss self-heal/regen, damage-split-to-adds, and the (broken) survival side vs spiderlings.**
- **Revised takeaway:** the coverage→power upgrade fixes the DRAGON class of error (affinity gate) but
  NOT the SPIDER class (heal/adds/survival). The two-sided evaluator needs the mechanic terms
  (heal, add-soak, survival) before it's safe to wire on heal/add-heavy content like Spider.
- **Also (from the Dragon affinity audit):** the empirical affinity win-rate is 0-weak 89% / 1-weak
  74% / 2-3 weak ~80% (n=71/34/14/5) — the 1-weak penalty is ~right (don't soften it); the linear
  −10%/weak looks too steep for MULTI-weak but n is too small + difficulty-confounded to recalibrate.
  The real Dragon fix is the **two-number output** (reliable farm + push ceiling, [[POWER_LAYER_SCOPE]]
  step 5): a 1-weak stage the team clears 74% of the time should surface as a PUSH, not be hidden.

---

## INS-0023 — Leader aura on a boundary fight = a WIN-RATE question; calibrate on rates, not single captures
- **Status:** `unresolved` (leader effect, leaning SPD) + `encoded` (the methodological lesson) — 2026-07-15
- **WIN-RATE UPDATE (8 TicoTholin Dragon-11 runs, same team):** Ezio **SPD lead 2/2 (100%)**,
  Tuhanarak **ACC lead 1/4 (25%)**, Tholin lead 0/2. So the initial "it was just RNG" retraction was
  itself too hasty — across more runs the RATE leans back toward **SPD > ACC** (the original
  direction), but n is tiny (2 and 4) so it's SUGGESTIVE, not conclusive. The honest state: neither
  "SPD wins" nor "pure RNG" is settled; the leader effect is a **win-rate difference to be estimated
  over many runs**, exactly the methodology below. (This is the discipline self-correcting twice: one
  pair over-claimed SPD; one re-run over-claimed RNG; the rate is the real signal.)
- **Class:** a false signal caught by replication — the guardrail working — plus a durable
  calibration-methodology insight.
- **What was initially claimed (WRONG):** a single paired A/B on TicoTholin Dragon-11 (same 5 champs,
  leader aura swapped) showed ACC-lead **DEFEAT** → SPD-lead **VICTORY**, which looked like
  `selectLeader` over-weighting ACC vs the SPD tempo→survival→damage chain.
- **Replication KILLED it (Mike, correctly suspecting RNG):** re-running the SAME ACC lead WON, with
  MORE survivors than the SPD win. Three runs, same team, same stage:

  | leader | result | turns | team dmg | survivors |
  |---|---|---|---|---|
  | Tuhanarak (ACC) | DEFEAT | 95 | 421,804 | 0/5 |
  | Ezio (SPD) | Victory | 110 | 511,551 | 1/5 |
  | Tuhanarak (ACC) | Victory | 95 | 510,727 | **3/5** |

  The two IDENTICAL ACC runs span 421,804/0-alive → 510,727/3-alive. There is **no evidence the leader
  aura decided the outcome**; the first loss was variance. `selectLeader`'s ACC pick is NOT indicted.
- **THE DURABLE LESSON (this is the keeper):** Dragon-11 is at this team's **clear boundary**, where
  the outcome is PROBABILISTIC (crit/resist/AI-targeting RNG). A single loss-vs-win cannot separate a
  real team/leader effect from variance, and the per-run spread is huge (0 vs 3 survivors, ±20% team
  damage). **Consequence for the whole survival-calibration plan:** boundary-fight losses are noisy
  single samples — several of our [[INS-0018]] loss anchors are exactly such boundary fights. Calibrate
  on **win-RATES over multiple runs of the same team/stage**, and treat any single capture near the
  boundary as one draw from a distribution, not ground truth. (Reasoning-discipline #3/#4, vindicated.)
- **Still true + valuable:** the per-champ damage capture ([[INS-0018]] unblocker (a)) works and lets
  us watch survival→damage directly (a survivor deals ~2× a champ that dies early) — but that signal
  is RNG-confounded at boundary fights, so it needs replication to read cleanly. The capability stands;
  the single-sample interpretation does not.

---

## INS-0022 — Survival must read the REAL sustain gear set for Gestal rosters (the "assume no Lifesteal" rule is a manual-only fallback)
- **Status:** `proposed` (one captured anchor + architecture observation) — 2026-07-15
- **Class:** model gap on the survival side, surfaced by a captured boss-death loss.
- **Claim:** the engine assumes NO Lifesteal/Regeneration/Immortal gear (CLAUDE.md, enforced in the
  sustain checks) — but that is a MANUAL-roster necessity (we don't know their gear). For a **Gestal
  roster we KNOW the gear sets** (`artifacts.json`), so the survival model is UNDER-crediting real
  sustain. Survival calibration (which already uses Gestal `frozen_effective_stats`) must also read
  the actual sustain SET per champ, not assume it away.
- **Evidence (TicoTholin, IG-10 DEFEAT, 2026-07-15):** the team **reached the boss** (→ a clean
  boss-death anchor, not wave-confounded, cf. [[INS-0021]]) and **Tholin died with the boss on its
  last bar of HP** — a razor's-edge two-sided boundary (kill and survival gave out together).
  **Tholin is in Lifesteal gear**, i.e. his real per-turn sustain is higher than the model's
  no-lifesteal assumption — yet the team STILL just missed. So the model can't both ignore his
  lifesteal AND explain why they nearly won; it must credit the known set. Per-champ damage now
  captured (Tholin 280,955 / total 384,859 — [[INS-0018]] unblocker (a) solved), so this battle is a
  usable anchor: team dealt ~72% of the IG-10 boss HP (~532k) before wiping → `turnsSurvived ≈
  0.72 × turnsToKill` for this team here.
- **Next:** when calibrating survival, add a per-champ sustain-set input for Gestal rosters
  (lifesteal/regen ≈ a per-turn heal fraction; the multiplicative survival term of [[INS-0016]]).
  Keep the no-sustain assumption ONLY for manual rosters. Re-capture more boss-death losses (now
  that damage + set are both readable) to fit the magnitude.
- **CC-BEATS-SUSTAIN caveat (Mike, 2026-07-15, Dragon-11 wave 2):** Tholin (lifesteal) AND Kael were
  **FROZEN on wave 2** and died — a frozen champ can't take a turn, so it can't ATTACK, so it can't
  LIFESTEAL. So the multiplicative sustain credit above is CONDITIONAL on the champ not being
  CC-locked: **crowd control (Freeze/Stun) that disables a champ NULLIFIES active/lifesteal sustain
  for its duration.** Consequences: (1) sustain credit must be DISCOUNTED by the content's CC
  exposure; (2) the Dragon **wave phase's real threat is CC (Freeze), not raw AoE** — wave survival
  is gated by **RES / Block Debuffs / Freeze-immunity**, not bulk or healing; a team with none (like
  this one) risks a wave wipe. (3) This is likely the **wave-death RNG driver** ([[INS-0021]]): which
  champs get frozen varies per run (Freeze land-chance + targeting), which is why the same team's
  wave outcome swings run to run. Ties to the CC-as-survival lever already in `sustain-profiles.js`
  (controlStrength/ccEffectiveness) — but here it's the ENEMY's CC defeating OUR sustain, the mirror.

---

## INS-0021 — A loss is TWO failures: wave-death vs boss-death must be split BEFORE survival calibration
- **Status:** `proposed` (Mike's architectural point) — 2026-07-15
- **Class:** architecture / calibration-prerequisite — reframes what the survival anchors even are.
- **Claim:** a wave→boss dungeon stage is two sequential fights; a wave-death and a boss-death are
  DIFFERENT failure populations with different champ requirements (AoE/speed/wave-survival vs
  single-target damage/boss-sustain). Blending them as survival anchors calibrates "a fight that
  isn't one fight." First reconciliation question for ANY loss = **"wave death or boss death?"** —
  before team/confidence. Applies to Dragon/FK/**IG** (wave+boss); NOT Spider/CB (single fight).
- **IG structure CONFIRMED (Mike, 2026-07-15):** Ice Golem is **Wave 1 → Wave 2 → Boss**, and the
  boss fight is the golem + **2 reviving minions** (the `dungeon_stage_enemies` `minion` role = those
  boss-phase adds, NOT the waves — so still zero wave-enemy stats). IG is a true sequential dungeon
  like Dragon/FK, so its losses ARE wave-confounded (my earlier "maybe one fight" guess was wrong).
- **Trigger / evidence:** draining the reconciliation backlog (48→72 reconciled, losses **5→12**
  across 3 accounts) surfaced **6 DRAGON losses** — Dragon has true sequential waves — so the
  confound is now ACTIVE in the anchor set. Dragon losses span turns 113-245 (a 245t loss clearly
  reached the boss; a 113t loss might be a wave death) — indistinguishable in current data.
- **Two gaps it exposes:** (1) **Capture:** no `furthest_point_reached` field, and NOT capturable
  today — the battle log has no phase-at-death signal (`finishCause` = how it ended, not where) →
  reader-investigation TODO (same class as the per-champ damage decode). (2) **Model+data:** the
  power model treats a stage as one boss fight, and `dungeon_stage_enemies` has **no wave-enemy
  stats** (boss-only, + IG minions / Spider adds) → nothing to score a wave fight against.
- **Impact — SUPERSEDES naive survival calibration on all losses ([[INS-0018]]):** boss deaths
  calibrate boss survival; wave deaths calibrate wave survival. Until `furthest_point_reached`
  exists, survival calibration must at least PARTITION losses by dungeon structure. Of the 12
  reconciled losses, only the **2 Spider** losses are unambiguous boss anchors; the **6 Dragon + 4
  IG** are wave-confounded. INTERIM read: high-turn losses (e.g. IG-19 @195t, Dragon-11 @245t) almost
  certainly reached the boss — two quick waves don't burn 195 turns — so turn-count is a rough proxy
  for boss-death until `furthest_point_reached` is captured; low-turn losses (IG-10 @66t) stay ambiguous.
- **Encoded in:** `PROJECT_BRIEF.md` §4 (wave-death vs boss-death subsection).
- **REFINEMENT (Mike, 2026-07-15, Dragon-11 defeat):** death is **per-champ phased**, not one team
  phase — Kael died in the WAVES while the rest pushed on and took the boss to **35% HP**. So the
  team's `furthest_point_reached` = the deepest any champ got (boss here), but a per-champ death-phase
  is the richer signal. TWO consequences: (1) **captured per-champ damage is BATTLE-TOTAL (waves +
  boss combined), NOT phase-split** — Tholin's 156k mixes wave-clear and boss damage, so damage alone
  can't give the boss kill fraction; (2) the clean kill-progress signal is **the boss's remaining HP
  at defeat** (Dragon-11: 35% left ⇒ team dealt 65% of boss HP to the boss). NEXT READER TARGET:
  capture enemy/boss final HP via the SAME `FinalState → BattleTeam → BattleHero curHP` path the
  reader already uses for ally survival ([[rslbattlereader-status]]) — a direct per-loss "how close to
  the kill" number that decomposes the two-sided boundary without inference.

---

## INS-0020 — Shadow verdict: the KILL floor OVER-recommends on DoT content — kill-alone is NOT safe to wire
- **Status:** `diagnosed` (shadow) — 2026-07-15 · `tools/shadow-kill-floor.mjs`
- **Class:** wiring/validation gate — shadow mode doing exactly its job (understand divergences before wiring).
- **Setup:** shadowed the calibrated KILL floor (highest stage where `turnsToKill ≤ budget`; budget
  fitted from captures = 174 real turns, separates 42/46 win/loss) vs the LIVE old engine vs captured
  reality (DonBrogni roster, per-dungeon push team = the highest-floor captured win).
- **Result:**

  | dungeon | OLD (live) | NEW kill floor | REAL won | REAL lost |
  |---|---|---|---|---|
  | spider | **5** | **25** | 19 | 20 (also an 11 affinity fluke) |
  | ice_golem | **13** | **18** | 18 | — |
  | fire_knight | **6** | **25** | 12 | — |

  - OLD massively **UNDER**-recommends (Spider 5 vs won 19; IG 13 vs won 18; FK 6 vs won 12) — the
    known coverage/placeholder-floor lowball.
  - NEW kill floor **NAILS kill-gated Ice Golem (18 = won 18)** but **OVER-shoots DoT content**
    (Spider 25, FK 25) past the demonstrated ceiling.
- **Root cause (verified by `ttk` sweep):** a DoT/%maxHP team's `turnsToKill` is ~**STAGE-FLAT** —
  the Spider push team (Gnut = %maxHP nuke, land-exempt) holds `ttk` 76→133 while boss HP grows
  146k→7.7M (53×), because poison/enemy-maxHP damage scales WITH boss HP. So kill-speed NEVER
  becomes the binding wall on high-HP content; the real ceiling is SURVIVAL ([[INS-0018]], blocked).
  Kill binds only on attack / normal-HP content (IG) — where the floor was exactly right.
- **VERDICT — do NOT wire the kill side alone as the stage selector:** it would flip Spider/FK from
  UNDER- to OVER-recommendation — the *worse* failure ([[POWER_LAYER_SCOPE]] risk #1: over-promising a
  stage the player loses). The kill floor is trustworthy as THE recommendation only where kill
  demonstrably binds (IG-type). This is the shadow gate catching a real problem before players saw it.
- **Safe ways to ship kill-side value now (no over-recommendation):** (a) the honest **"push ceiling"
  two-number output** ([[POWER_LAYER_SCOPE]] step 5) — "you can out-DAMAGE stage N; whether you survive
  it depends on gear/affinity" — additive, not a safe-clear promise; (b) trust the kill floor as the
  recommendation only on demonstrably kill-gated content. General safe wiring waits on survival.
- **Sample caveat:** one roster (DonBrogni). The structural finding (DoT kill-speed is stage-flat) is
  roster-INDEPENDENT, but calibrating any wiring needs the broader shadow sample + the survival side.

---

## INS-0019 — Poison isn't free: DoT credit needs LAND-RATE (ACC vs boss RES) + UPTIME (cooldown) — kill fit 33→22 turns
- **Status:** `encoded` · magnitude `nominal` — 2026-07-15 · `lib/power-model.js` · `tools/calibrate-power.mjs`
- **Class:** model gap (the INS-0017 DoT residual), surfaced by the loss `ttk` over-prediction and
  verified against captures. The measured driver of the loss-team over-prediction (cf. [[INS-0018]]).
- **Claim:** the flat "each poison tag = 2.5%/turn" over-credited DoT for **on-cooldown** and
  **resisted** placers — it treated an incidental poisoner identically to an every-turn engine. Two
  structural terms fix it, both from data we already have:
  - **LAND-RATE** — a placed DoT only counts to the extent the champ's ACC beats the boss's RES
    (Raid resist ≈ 1%/point of RES over ACC). `champDotPerTurn` now weights Poison/HP Burn by
    `dotLandRate(champ.acc, bossRes)`. Warmaster (a mastery proc) and Enemy Max HP (a direct nuke)
    are excluded — neither is a placed debuff.
  - **UPTIME** — an on-cooldown placer (Ezio A2 cd4/dur2 → 0.5) contributes less than an every-turn
    engine (Xenomorph A1 → 1.0). `dotUptimeFromSkills` precomputes it from the placing skill's
    slot/cooldown/duration; attached as `champ.dot_uptime`.
- **Evidence / decomposition (34 captured wins, mean |pred−actual| turns):** flat **33.2** →
  uptime-only 30.4 → **land-only 22.4** → both **21.9**. LAND-RATE does the heavy lifting; uptime is
  a small clean add. `DAMAGE_SCALE` re-centered 0.25 → **0.30** (model runs less hot once DoT is
  deflated). Loss over-prediction corrected directionally: **IG-19** (same Gnut team, died 195t
  without killing) `ttk` **144 → 650** (now ≫ survived → correctly a kill wall); **IG-18** tanky loss
  `ttk` **77 → 100** (toward the 119 it survived).
- **Verified cause (IG-18 loss):** Ezio ACC 105 < boss RES 150 → ~55% land, and his poison is an A2
  on a 4-turn cooldown — the flat model gave full every-turn credit for both.
- **CAVEAT — magnitude nominal, and land-rate leans on placeholder-looking RES:**
  `dungeon_stage_enemies.res` appears to be an ESTIMATED ladder — Spider and Ice Golem share an
  identical round-number RES-by-stage (75/75/100/150/150/200/200). The STRUCTURE (land-rate falls as
  stage RES rises) is a real mechanic and earns the fit gain, but the exact `ttk` magnitudes are
  nominal until real boss RES + per-champ damage validate them. Also: low-ACC nuke teams (Gnut/Tagoar
  ACC ~40-47) clear Spider 17 via DIRECT %maxHP nukes (`enemy_maxhp`, correctly land-exempt), not
  poison — so crushing their tag-poison happens to track their slow real clears, but flags a
  TAG-ACCURACY dependency: a direct nuker mis-tagged `Poison` would be wrongly crushed (cf. the
  Underpriest Brogni Poison tag with NO poison in his skill text — a data-quality check to run).
- **Interaction (do not wire the two-sided race yet):** raising `ttk` broadly widens the gap vs the
  already-broken survival guardrail ([[INS-0018]]) → more wins fail the naive `surv ≥ ttk` race (FN
  0 → 18 in the survival tool). This is a downstream artifact of the broken SURVIVAL side, NOT harm
  to the kill side (whose fit improved). Keep survival non-wired.
- **Encoded in:** `lib/power-model.js` — `dotLandRate`, `dotUptimeFromSkills`, `champDotPerTurn`
  (Poison/HP Burn × land × uptime), `teamDamagePerTurn` passes `boss.res`, `DAMAGE_SCALE = 0.30`.
  `tools/calibrate-power.mjs` + `tools/calibrate-survival.mjs` attach `dot_uptime` + boss RES.
- **Next:** validate against **real boss RES** and **per-champ damage capture** (still the 0/105
  dungeon gap); fix the flagged mis-tags (Brogni Poison; any direct-nuker mis-tagged Poison).

---

## INS-0018 — Survival can't yet be calibrated: the loss captures are KILL-limited, and enemy ATK ≠ the survival wall
- **Status:** `diagnosed` — 2026-07-15 · `tools/calibrate-survival.mjs` · magnitude `nominal`
- **UPDATE 2026-07-15 (late):** the loss set grew **5→12 across 3 accounts** (reconciliation drain,
  48→72 rows) — but 6 of the new losses are DRAGON (sequential waves), so [[INS-0021]] (split
  wave-death vs boss-death) is now a PREREQUISITE: re-run the survival fit only after partitioning
  losses by dungeon structure / phase-of-death, not on the blended set.
- **UPDATE 2026-07-15 (later, 129-row reconcile, 4 accounts, leader-aura-aware):** re-ran BOTH
  calibrations on the enriched set (114 usable, **19 losses**). Result CONFIRMS the gaps are
  STRUCTURAL, not data-volume: (1) **survival STILL doesn't share a scale and STILL inverts the
  per-content wall** with ~4× the losses — a missing mechanic-incoming term, exactly as diagnosed;
  more anchors can't fix a wrong term. (2) **The kill fit got WORSE** (median 1.00→1.60, mean fit
  22→73 turns) once the data spans 4 accounts + trivial low stages — a single global `DAMAGE_SCALE`
  can't span it. Culprit visible: **Spider 4/6 cleared in 8-13 turns at scale ~8** (overpower runs
  far below the team's ceiling — the team has huge headroom, so implied DPT is a floor, not a
  measurement; they don't constrain the scale). The narrow earlier fit was flattering. FIXES QUEUED:
  prune overpower runs from the kill fit; wave/boss split ([[INS-0021]]); mechanic-incoming term.
  The leader-aura fix landed correctly (ACC lead → +70 team ACC → IG loss `ttk` 353-650, right call).
- **Class:** model gap + calibration-blocker, surfaced by fitting the survival side against real losses.
- **Goal (Track 1 step 1):** put `turnsSurvived` on the same real-turn scale as the calibrated
  `turnsToKill`, using the 5 loss captures as anchors (a loss = realized survival: died at `turns`).
- **What the data actually showed (46 usable captures, 5 losses):**
  1. **The 5 losses are NOT clean survival anchors — they're heterogeneous, and mostly KILL-
     limited.** Spider-20 (`ttk` 159 > died-at 145) = genuine kill wall. Spider-11 (all-support
     team, no damage, died 156t) = kill wall + Force affinity ([[INS-0015]], same roster). IG-10/18/19
     died AFTER their `ttk` (48/77/144 < 66/119/195) → for every one, the calibrated kill model
     said "you had time to kill" yet they lost, i.e. **`ttk` OVER-credits the loss teams' damage**
     (real kill > realized turns). No loss is a clean "squishy team bursted below its kill."
  2. **Raw bulk ranks the win/loss boundary BACKWARDS.** In BOTH boundary pairs the *tankier* team
     lost: IG-18 loss team sumEHP 298k @119t vs win team 211k @197t; Spider-11 loss 314k vs win
     276k. Survival ≠ bulk. (Fix applied: switched `turnsSurvived` from weak-link EHP to team-sum
     EHP — weak-link was strictly worse — but sum still can't separate the boundary because the
     discriminator is the kill/survival RACE + a content spike the tanky team lacked, not EHP.)
  3. **The 3 IG survival "anchors" do NOT share a scale** (turns/proxy = 0.52 / 2.35 / 7.24, CV ~0.8;
     climbs monotonically with stage): real survival grows SLOWER with stage than modeled enemy-ATK
     incoming grows. Root cause — **IG's kill vector is the Frigid-Vengeance %-AoE mechanic, not
     enemy `atk`** — so `dungeon_stage_enemies.atk` overstates real incoming at high stages. This is
     the mirror of INS-0017's DoT gap (a MISSING TERM, not a scale error), but on the survival side
     there aren't enough losses to fit it.
  4. **On an ATK-incoming basis the model INVERTS the per-content wall** ([[INS-0016]] ground truth:
     Spider=kill, IG=survival). The tool computes Spider→kill (correct) but IG→kill (wrong): an
     ATK-based proxy can't place IG's mechanic wall, and Spider's low-burst poison race reads as
     fragile on ATK. Definitive proof the ATK basis is structurally insufficient for survival.
- **The one clean anchor:** the SAME team (Tagoar/Gnut/Pelops/Narma) CLEARS IG-18 (@197t) and FAILS
  IG-19 (@195t) — a fixed-team stage boundary. `SURVIVAL_SCALE` is anchored there (7.24 → 7.25 in
  code), so that team's IG-19 death lands at ~195 real turns. Even this point classifies as a MISS
  under the naive race rule (survived 195 ≥ `ttk` 144 ⇒ "should win") — reconfirming the loss is a
  **kill over-prediction**, not a survival failure.
  - **VERIFIED not confounded by affinity OR speed (Mike prompted the check, 2026-07-15):** IG-18
    boss = **Magic**, IG-19 boss = **Force** (`dungeon_stage_affinities`). The team's two Spirit
    champs (Gnut/Pelops) are **weak** at IG-18 (where they WON) and turn **strong** at IG-19 (where
    they LOST) — affinity got BETTER at the loss, so it points the wrong way and cannot explain the
    boundary. Speed is out too: boss SPD 90, whole team 106-222 → always out-turns the boss. That
    leaves **raw boss stat scaling** (ATK +20% 6965→8337, HP up) as the sole driver. The anchor
    survives — checked, not assumed (reasoning-discipline #2).
- **NEW — affinity now IN the kill model, but MEASURED NEGLIGIBLE on the captured losses (built +
  tested, 2026-07-15):** `champDamagePerTurn` now applies `affinityFactor(champ.affinity,
  stageAffinity,'offense')` to the ATTACK term (DoT untouched — %maxHP ticks can't be weak-hit);
  threaded through `teamDamagePerTurn`/`turnsToKill`/`stagePower` as an optional param ([[INS-0015]]
  Phase-2 gap: affinity was in confidence only, never the power-model damage). It is mechanically
  correct and SAFE — the win calibration is unchanged (median 1.00, fit 33.5t). **BUT my earlier
  hypothesis — that Ezio (Spirit, weak vs the Magic IG-18 boss) explained that team's `ttk`=77
  fiction — was FALSIFIED by measuring it:** the affinity factor lands (Ezio atk 845→591, ×0.70),
  but attack is only **2.2%** of that team's kill DPT (DoT 71,038 vs attack 1,623 — three poison
  carriers), so affinity moves total DPT by **−0.4%** and `ttk` by ~1 turn (77→78). The REAL
  over-prediction driver is **DoT over-crediting** (the flat "each poison tag = 2.5%/turn" nominal,
  no cooldown/chance — INS-0017's own flagged residual), which affinity does not touch. So the
  affinity fix's value is for **attack-dominated / DoT-less teams on off-affinity stages**, NOT
  these DoT-heavy captures. (Reasoning-discipline #3: don't call a single visible cause before
  measuring — the measurement redirected to the DoT term.)
- **NEW — the tempo/speed lever on IG is the MINIONS, not the boss (Mike's speed question,
  2026-07-15):** every fielded champ out-speeds the SPD-90 IG boss, so "too slow vs boss" never
  explains an IG loss. If a tempo term is added it must key on the faster **minions (SPD 105) +
  reviving adds**, not the boss. More broadly, both SPEED (your actions/enemy action) and BOOKS
  (lower cooldown → sustain/CC uptime) feed the SAME hidden variable — effective actions per enemy
  action — which the survival model (`teamSustainMultiplier` = flat per-tag, SPD-blind) does not
  represent. This "tempo/uptime" term is a strong candidate for the missing survival term alongside
  the mechanic-incoming term (finding #3), and is why the booked-vs-unbooked counterfactual is not
  answerable today.
- **Encoded in:** `lib/power-model.js` — new `survivalProxy()` (team-sum EHP × sustain / boss-AoE
  incoming) + `SURVIVAL_SCALE = 7.25`; `turnsSurvived` rewritten on that basis. `tools/calibrate-
  survival.mjs` — reproducible fit + classification confusion + wall-inversion check.
- **VERDICT — survival is NOT wire-ready** (do NOT drive recommendations off it). The kill side +
  turn budget stays the load-bearing half; `turnsSurvived`/`stagePower` are a nominal diagnostic
  guardrail only. Nothing here is wired to the live engine (no `match-engine.js` import).
- **Concrete unblockers (Track-2 backlog):** (a) ~~per-champ damage capture on dungeons (0/105)~~
  **SOLVED + WIRED 2026-07-15** — `CbDamageReader.CaptureDungeon` reads per-champ dungeon damage via
  `BattleFinishDungeonDialogContext` + contiguous `HeroBattleStatsContext` run (stride 0x1A0);
  verified live on an IG-10 **DEFEAT** (exact screen match); wired into `BattleWatcher`
  (`TryAttachBattleDamage`). Now run dungeon battles (esp. losses) → reconcile → calibrate with REAL
  per-champ numbers. See `DUNGEON_DAMAGE_TODO.md`; (b) a **content-threat / mechanic-incoming
  term** (Frigid Vengeance, Scorch, etc.) instead of raw enemy ATK — `lib/sustain-profiles.js`
  THREAT_PROFILES is the natural home; (c) ~~DoT over-crediting~~ **DONE — [[INS-0019]]** added DoT
  land-rate (ACC vs boss RES) + uptime (cooldown), kill fit 33→22 turns, loss `ttk` corrected
  (IG-19 144→650). Affinity-in-`ttk` also built but second-order on DoT-heavy content; (d) a
  **tempo/uptime term** (relative SPD + cooldown uptime, keyed on minions/adds for IG) — the shared
  root of the speed and booking questions; plus **more loss captures**, ideally same-team stage
  sweeps like the IG-18/19 pair that gave the only clean anchor.

---

## INS-0017 — Real captures prove DoT is a FIRST-ORDER damage term, not a footnote
- **Status:** `diagnosed` + `fixed` — 2026-07-15 · `tools/calibrate-power.mjs`
- **RESOLUTION (same day):** added the DoT term to `teamDamagePerTurn` (`champDotPerTurn`,
  reusing cb-damage-model `SOURCE_COEFF`). The scale spread collapsed **90× → 4.6×** (0.17-0.79),
  and a single calibrated `DAMAGE_SCALE = 0.25` (nominal model runs ~4× hot) now validates to
  median **1.00** across 34 captures, mean fit error **~33 turns**. The kill model is now on a
  REAL turn scale — the "386-turn budget" blocker is gone. Residual spread (0.68-3.16) = team/
  gear/turns noise + crude "each DoT tag = 2.5%/turn" (poison cooldowns/chance not modelled).
- **Class:** model gap, surfaced by calibration against real battles (the Deep Blue loop working).
- **Claim:** Calibrating the power model's absolute damage scale against 34 captured dungeon wins
  (`run_reconciliations`: real turns + fielded team + frozen effective stats) does NOT yield a
  single scale — it ranges **0.43 (Ice Golem) → 38.5 (Spider)**, median 3.75. The spread is
  systematic by content, not noise: the attack-only kill model is ~right on IG (attack clears)
  and **~10× too low on Spider** (Skavag 1M+ HP dies in ~78t, but attack-DPT implies ~800t).
- **Root cause:** the kill model omits **DoT (%maxHP Poison / HP-Burn)**, which is the DOMINANT
  kill source on high-HP content (Spider 15-25 = %maxHP/Poison/HP-Burn by design; Dragon too).
  A single scale can never reconcile it because **DoT scales with boss HP; attacks don't** — so
  the required scale climbs with stage/HP exactly as observed.
- **Evidence:** per-capture scale rises with Spider stage (S10 ~5.7 → S17-19 ~20-38) as Skavag's
  HP grows; IG stays ~1. cf. [[cb-damage-estimator-blocked]] (%maxHP/DoT source model) and
  `lib/cb-damage-model.js` `SOURCE_COEFF`, which already model this for Clan Boss.
- **Next:** add a DoT term to `teamDamagePerTurn` — Σ(%maxHP/turn) × bossHP from the team's
  Poison/HP-Burn tags + Warmaster, reusing cb-damage-model's coefficients — THEN re-run
  `calibrate-power.mjs`; the scale should collapse toward one consistent value across content.
- **Caveat:** captured `turns` is a noisy proxy (includes survival/setup; same-stage S17 wins
  span 77-134t across teams/gear). Per-champ damage is NOT captured (0/43), so turns is the only
  signal — good enough to expose a 90× structural gap, not for fine tuning.

---

## INS-0016 — Power model built + validated: dungeons are gated by DIFFERENT walls
- **Status:** `built` (kill-speed) · survival `first-pass` · magnitude `nominal` — 2026-07-15
- **Class:** architecture — the missing Layer 0 (power sufficiency), now real.
- **Claim:** With real per-stage enemy stats (`dungeon_stage_enemies`, 150 rows, all 4 dungeons)
  the engine can finally compute the WALL it never measured: turns-to-kill (team damage/turn vs
  boss HP) and turns-survived (enemy damage vs team bulk+sustain). `lib/power-model.js` does the
  kill-speed half; survival is a flagged first pass.
- **Evidence (first cross-dungeon validation, DonBrogni, budget calibrated on Spider-13 slow clear):**
  - Spider kill-ceiling **13** = real ceiling 13 → Spider is **KILL-gated** (Skavag 1M+ HP).
  - Ice Golem kill-ceiling **17** but real ceiling **14-15** → kill-speed is NOT the wall; IG is
    **SURVIVAL-gated** (Frigid Vengeance + reviving minions + incoming dmg). The model correctly
    localized that IG's binding wall is the OTHER side. Klyssus S13 kill-load 0.23 (trivial).
  - Dragon kill-ceiling 16, FK 17 (no ground truth yet).
- **Why it matters:** a single stat-floor can't express "Spider = kill fast / IG = survive" — this
  two-sided model does, which is the whole contribution-model thesis. Also re-indicts the current
  engine: it sent DonBrogni to Spider 5 (kill-load 0.14, trivial) vs the real kill wall at 13.
- **Encoded in:** `lib/power-model.js` (`turnsToKill`, `turnsSurvived`, `calibrateBudget`,
  `stagePower`); real difficulty in `dungeon_stage_enemies` (seeds/131-135, migration
  2026-07-15). Data provenance: in-game enemy tables (Mike), cross-validated (shared ATK/DEF
  scaling caught the Spider S19 glitch; affinity icons confirmed seed 130).
- **Scoping (Mike 2026-07-15):** the emergent REVIVE-SPONGE case (Sun Wukong dies→revives→re-
  tanks the poison in a loop) is NICHE — do NOT special-case it. The survival model only needs
  to handle NORMAL teams with standard sustain (heal/shield/bounded revive); it is not obligated
  to reproduce an emergent self-revive loop. This removes the hardest, least-general piece.
- **Open / next:** (1) real blocker = ABSOLUTE damage-scale calibration — nominal DPT gave a
  386-turn budget vs survival's realistic tens, so the two sides aren't on a common real-turn
  scale (tsv≥ttk invalid). Calibrate DPT against captured battle damage (real numbers) +/or the
  clear-time anchors (Spider-13 slow ≈ ~40-50 turns; IG-14/15 crossover). Then survival works for
  the mainline. (2) DoT (%maxHP) not yet in kill-speed.
  (3) Wire the power ceiling as the recommendation FLOOR ([[POWER_LAYER_SCOPE]] step 3), which
  replaces the Stage-5 lowball. (4) Damage magnitudes (DEF_K, multiplier proxy) are nominal —
  the turn BUDGET is the one calibrated constant, from a reference clear. (5) FK shield
  hits-to-break is a tactical gate to add on top of its (low) HP wall.

---

## INS-0015 — Boss affinity is a first-order, two-sided factor the engine was blind to
- **Status:** `encoded` (Phase 1: data + confidence) · magnitude `nominal` · selection `TODO` · **power-model damage `encoded` 2026-07-15 (see INS-0018)** — 2026-07-15
- **Phase 2 (power-model damage) — BUILT 2026-07-15 (via [[INS-0018]]):** affinity was wired ONLY
  into the confidence score, not the power model's damage. Now `champDamagePerTurn`/`teamDamagePerTurn`/
  `turnsToKill`/`stagePower` take an optional `stageAffinity` and apply `affinityFactor()`
  (`lib/formulas.js`) to the ATTACK term (DoT untouched — %maxHP ticks can't be weak-hit), keyed on
  `dungeon_stage_affinities`. Safe (win calibration unchanged, median 1.00 / fit 33.5t). **Caveat:
  the initial hypothesis that this explained the IG-18 tanky loss (Ezio Spirit-weak) was FALSIFIED
  by measurement** — attack is ~2% of that DoT-heavy team's kill DPT, so affinity moves `ttk` ~1
  turn. The fix matters for attack-dominated / DoT-less teams on off-affinity stages, not that case.
- **Class:** game-mechanic fact (→ allowed as a model rule) + a content-reconciliation fix.
- **Claim:** A champion WEAK vs the boss's affinity suffers Weak Hits (less damage, crits
  suppressed) AND takes extra crits — so weak affinity hurts BOTH kill-speed and survival.
  The engine ignored it entirely for dungeons: selection and confidence never saw affinity.
- **Root cause (a reconciliation failure, cf. policy #18):** the per-stage affinities WERE
  captured (corrected 2026-07-07 from the in-game list) but stored only as prose — the lead
  phrase of `dungeon_stages.notes` ("Force affinity. …") for Dragon/IG/FK, and a bare SQL
  comment for Spider (whose rows are 3 TIERS, not 25 stages). Queryable to no code = invisible.
- **Evidence:** DonBrogni live Spider run. Stage 11 = **Force** → both Magic champs
  (Brogni + Uugo = the entire sustain/control backbone) weak → **near loss**. Stage 13 =
  **Void** (neutral to all) → the "neutral affinity" the user reported; its slow clear was
  difficulty/ACC, not affinity. The team is affinity-lopsided (sustain-on-Magic /
  damage-on-Spirit, no Void), so it is weak at BOTH Force stages (sustain weak) and Magic
  stages (damage weak) — just in different roles.
- **Encoded in:**
  - `migrations/2026-07-15_dungeon_stage_affinities.sql` + `seeds/130` — new table
    `dungeon_stage_affinities(dungeon_id, stage_number, affinity)`, 100 rows (4×25), keyed by
    stage NUMBER so Spider's per-stage rotation works despite tier-granular goal rows.
  - `lib/formulas.js` — `affinityMatchup()` (strong/weak/neutral; Void & same = neutral) +
    `AFFINITY_FACTORS` (nominal: weak offense ×0.70 / survival ×0.85; strong ×1.20 / ×1.10).
  - `lib/match-engine.js` — `applyAffinityToConfidence()`: a SOFT factor like the ACC floor
    (INS-0014). **Asymmetric: only WEAK champs penalize (−10%/champ, floor 0.55); STRONG earns
    NO confidence bonus** — survival is a floor (strong DPS can't rescue a weak sustain), and
    the measurement spine shows confidence already runs over-optimistic. Wired into both scans;
    surfaced as `result.affinity` for explain.js.
- **Verified (directional):** the scan now DODGES affinity-bad stages — every DonBrogni pick
  (Spider 5 Void, IG 13 Spirit, Dragon 4 Void, FK 6 Spirit) has 0 weak champs. Spider went
  Stage 7→5 because Stage 7 (Force, 2 weak) now scores ~65% and the highest affinity-safe +
  ACC-clean stage is 5 (Void). Matches reality: safe to farm low, risky/slow higher.
- **Calibration target:** the −10%/weak magnitude and the AFFINITY_FACTORS are game-knowledge
  nominals. One datapoint (near-loss at 2 weak champs) suggests they're roughly right. Tune
  against more known-affinity captures. The two soft floors (ACC × affinity) now STACK
  multiplicatively — legitimate (independent effects) but watch for over-penalty as data grows.
- **Open — Phase 2 (the real "better team" lever):** affinity-aware SELECTION. Today affinity
  only adjusts confidence on an already-picked team; it does NOT yet make selectTeam PREFER
  Void / same-affinity / strong champs for the target stage. That is the change the user asked
  for ("better team options") but it is a selectTeam change — per [[INS-0013]] it must go
  through the measurement harness (model-vs-winning-teams diff) and prove it helps before trust.
  Chicken-and-egg: selection needs a target stage to know the affinity; needs a 2-pass or
  affinity-blended approach.

---

## INS-0014 — ACC floors are SOFT (land-chance), not stage gates — degrade, don't hard-cap
- **Status:** `encoded` · magnitude `nominal` (penalty curve uncalibrated) — 2026-07-15
- **Class:** model-rule fix (application of the floors-are-not-gates principle).
- **Claim:** A stage's ACC floor (`stage×10` for Spider, etc.) is the ACC where an
  accuracy-gated debuff lands **reliably** — it is NOT a pass/fail gate. A carrier below
  the floor still lands the debuff, just less often, so the clear is **slower (grindier),
  not lost**. The scan must therefore DEGRADE confidence in proportion to how far below the
  floor the weakest ACC-dependent debuff sits — never hard-fail the stage on ACC alone.
  (Coverage gaps — no carrier at all — stay HARD; that is a real capability hole, not a floor.)
- **Evidence:** DonBrogni Spider scan. Recommended team's only Decrease-TM carrier is Lord
  Entertainer Fabian at ACC 47; the "Deny Skavag her turn" goal is ACC-gated on that debuff.
  Old behavior: floor 40 (Stage 4) passed, floor 50 (Stage 5) hard-failed → `stats_failing`
  band (40-54%) → below the 80% scan threshold → **hard-capped at Stage 4** (95%). The user
  ran the SAME team well past Stage 3/4, proving the floor is not a gate (corroborates the
  [[floors-are-not-gates]] memory: Don$Gnut cleared Spider 17 at 85-96 turns below floor).
- **Encoded in:** `lib/match-engine.js` —
  - `evaluateAccThreshold` now returns `soft: true` + `acc_reliability` (weakest-link
    `bestAcc / floor` across ACC-dependent goals, 1 = at/above floor) and a soft-floor note
    ("the debuff still lands, just less often — expect slower clears, not a loss").
  - `computeVerdictBand` excludes `soft` results from the hard-fail band + pass-ratio, then
    multiplies confidence by `0.55 + 0.45 × acc_reliability` (0.55 floor keeps a far-below
    stage recommendable-but-low, never 0).
- **Verified (N=1, directional):** DonBrogni Spider **Stage 4 (95%, hard cap) → Stage 7
  (81%, "ready")**. Curve: Stage 7 floor 70, Fabian 47 → reliability 0.67 → ×0.85 → 81%;
  Stage 8 drops below the 80% scan threshold. Degrades smoothly instead of cliff-stopping.
- **Calibration target:** the `0.55 + 0.45×rel` penalty curve is a game-knowledge nominal,
  NOT battle-tuned. The user is running the recommended team past its stage right now — that
  ON-SPEC wall (which stage, and *how* it fails: died vs Skavag outgrew vs debuffs whiffing)
  is the calibration signal for how steep the penalty should be. General across all dungeons
  with ACC floors (Spider/Dragon/IG/FK), not Spider-specific.
- **Open:** other floors (HP/RES/SPD survival) are still HARD — likely also partly soft
  (memory: won at 0.44 HP floor), but survival failure is more gate-like (AoE wipe) so it was
  left hard pending its own evidence. Per-debuff ACC floors (higher-RES enemies) still not modeled.

---

## INS-0002 — Speed / Turn-Meter buffs are multiplicative team-turn multipliers
- **Status:** `encoded` (structure) · magnitude `nominal` (uncalibrated) — 2026-07-14
- **Class:** game-mechanic fact (→ allowed to be a model rule, per CLAUDE.md discipline #4)
- **Claim:** A team-wide [Increase SPD] / [Increase Turn Meter] buff gives every ally more
  turns over a time-budgeted fight, multiplying EVERY per-turn source (poison, HP-Burn,
  attack turns). It is the TWIN of the sustain-is-multiplicative rule (§3): sustain adds
  turns by keeping you alive, speed adds them by making them come faster. Its value shows
  up in OTHER champions' damage bars, so a pure speed-support reads ~1% on its own bar
  while contributing far more (the §4 support-understatement trap).
- **Evidence:**
  - Mechanic: speed = turn frequency (core Raid mechanic; same footing as §3).
  - Code audit (2026-07-14): `Increase Speed` was credited ONLY where a goal required it
    (Fire Knight shield-break); earned ZERO on Clan Boss/DoT dungeons; absent from the
    contribution model, synergy layer, and watchdog.
  - Capture: DonBrogni CB key 2026-07-14 (9.94M/134t). Fielded Apothecary (Healer +
    Increase Speed + Increase Turn Meter). Model PREDICTION before the rule scored her
    **0.0% contribution** — structurally blind to the champion the user found pivotal.
- **Encoded in:**
  - `lib/damage-mechanics.js` §3b — `TURN_MULTIPLIER_TAGS`, `TURN_MULTIPLIER_CAP`,
    `teamTurnMultiplier()`, `SPEED_IS_MULTIPLICATIVE`.
  - `lib/contribution-model.js` — team-turn multiplier scales team damage; granted
    throughput attributed back to the buffer(s).
  - `lib/watchdog.js` — `rawGrant` credits team-turn buffs (so a speed-support isn't benched).
- **Verified (N=1, directional):** re-eval of the same CB team moved Apothecary
  **0.0% → 23.1%** contribution; killTurns 45→35; confidence 0.63→0.86. See scoreboard SB-0001.
- **Calibration target:** `TURN_MULTIPLIER_TAGS` magnitudes (Speed 0.20 / TM 0.10, cap 0.35)
  are conservative game-knowledge nominals, NOT battle-tuned. Do not tune off a few runs;
  calibrate against captured DoT-team runs with/without a speed buffer once ≥ several exist.
- **Open:** should Speed + Turn Meter combine additively (current) or by max? Buff uptime /
  reliability weighting (a speed buff that drops is worth less). Speed also aids SURVIVAL
  (act before the boss) — not yet credited on the survival side.

---

## INS-0003 — Credit RARE champions at MAX (booked) skills
- **Status:** `approved` (Mike directive 2026-07-14) · `encoded` (representation hook only)
- **Class:** modeling assumption (rarity-conditional default) — amends a prior CLAUDE.md default.
- **Claim:** Rare skill books are cheap/abundant in-game, so a Rare champion should be
  evaluated at MAX skills: **booked** chances, **reduced** (booked) cooldowns, and books-only
  effects treated as functional. Epic/Legendary/Mythical keep the conservative default
  (respect the player's explicit `is_booked`) because their books are scarce.
  Motivating case: Apothecary (Rare) — her Increase Speed / Turn Meter / Heal should be
  credited at booked reliability, not penalized as unbooked.
- **Evidence:** game economy (Rare books common); code audit 2026-07-14 — engine currently
  DROPS `is_booked` in `mapRoster` and ignores booking in its math, so all approved tags
  already count regardless (rares are effectively booked TODAY for coverage/contribution).
- **Where it bites (why the rule still matters):**
  1. **Reliability layer (future):** when debuff chance/cooldown get plumbed into
     `reliabilityFactor`, a Rare must use `chance_booked` / `cooldown_booked`, never unbooked.
  2. **Books-only tags** (0% unbooked, e.g. Avir Decrease ATK, Pharsalas Provoke): count them
     for Rares. (Most are already `approved` live, so no immediate change.)
  3. **UI / CLAUDE.md default:** the champion sheet "booked defaults to No — never pre-checked"
     should carry a **Rare carve-out** (default Yes, or don't ask). NEEDS confirmation.
- **Encoded in:** `lib/match-engine.js` mapRoster → `assume_booked` (rarity Rare → true).
  Representation-only hook today; the reliability path MUST consult it when plumbed.
- **Open / needs approval:** amend the CLAUDE.md "booked defaults No" rule for Rares; set the
  manual roster UI to default Rares to booked. Not done unilaterally (edits a stated project rule).
- **CORRECTION (Mike, 2026-07-15): LEVEL ≠ BOOKED.** A "book all max-level champs" bulk assumption is
  WRONG — especially for Legendaries: Legendary books are SCARCE, so most Lv60 Legendaries are NOT booked.
  Booking is rarity-conditional: Rare = usually booked (cheap books, safe to bulk), Epic = sometimes,
  Legendary = usually NOT. UI (2026-07-15): per-card 📖 badge on the roster grid (tap to toggle, gold=booked)
  + a rarity-SCOPED bulk "Book all Rares" (NOT level-based); Epics/Legendaries flagged individually.
  is_booked stored via /api/user-champions. NOTE still: the ENGINE does not consume is_booked yet (the
  UI half only) — booked→cooldown→reliability wiring is unbuilt ([[ai-settings-manual-entry]] sibling gap).

---

## INS-0007 — Dungeons have PHASES (waves + boss); champion value is PER-PHASE
- **Status:** `proposed` (Mike, 2026-07-15) — RESHAPES the Layer 3 contribution model; high priority.
- **Claim:** FK / IG / Dragon (and event dungeons) are a WAVE phase (multiple adds) THEN a BOSS phase —
  different enemies, different problems. A champion's value is per-phase: some clear/survive the WAVES,
  some fight the BOSS. Team construction must satisfy EVERY phase — a boss-oriented team dies in the
  waves (and vice-versa). The contribution/watchdog model is PHASE-BLIND: it scores each champ against
  the whole content, averaging away phase-specific value. (The DB already has phases: `phases` tagged
  wave/boss/single + per-phase `goals` — the contribution model collapsed it.)
- **Killer example — Criodan the Blue (Epic, Lv25★4 unbuilt in DonBrogni):** A2 Razor Hail hits ALL
  enemies ×2 at 45% Freeze each + A1 freeze + passive self-TM per freeze = a WAVE freeze-lock/clear;
  A3 gives team +30% SPD + TM. He is worth ~0 vs Hellrazor (boss) and EVERYTHING vs the Dragon-20 waves.
  User's Dragon-20 runs: champs DIE on the way to the boss because the waves hit hard → the binding
  constraint is WAVE SURVIVAL, which the boss-oriented poison team can't do.
- **CRITICAL — this INVERTS the CC-immunity handling (INS-0004 residual, now urgent):** `CC_EFFECTIVENESS.
  dragon=0.40` was going to be LOWERED (~0.15) because the Dragon BOSS is CC-immune. That is BACKWARDS
  for the WAVE phase, where the adds are NOT immune and AoE Freeze is premium. Lowering it would have
  BURIED Criodan — the champ who fixes the problem. Per-content CC isn't just coarse; it's WRONG when a
  champ's value lives in one phase. **DO NOT lower dragon CC_EFFECTIVENESS until CC is scored PER-PHASE.**
- **Fix:** make the contribution model PHASE-AWARE — score each champ's contribution to each phase
  (wave-clear/wave-survival vs boss-DPS/boss-survival) and construct a team that satisfies ALL phases.
  Wave-clear (AoE damage + AoE CC on non-immune adds) becomes a first-class role. Immunity is per-phase
  (boss immune, adds not). This subsumes the INS-0004 residual.
- **GENERALIZATION (Mike, 2026-07-15) — CORRECTED taxonomy: THREE enemy classes across TWO phases, and
  "waves" ≠ "boss-phase adds":**
  | class | phase | problem | examples |
  |---|---|---|---|
  | **Waves** | pre-boss | survive/clear to REACH the boss | Dragon / IG / FK trash |
  | **Boss-phase adds** | boss phase (with the boss) | manage DURING the boss fight; often tied to a boss mechanic | IG's 2 minions, Spider's spiderlings |
  | **Boss** | boss phase | DPS + survive | Hellrazor, Ice Golem, Skavag |
  Per-dungeon shape differs: Spider = boss + boss-adds (NO pre-boss waves); IG = waves → (boss + 2 minions);
  Dragon = waves → solo boss. (Earlier draft wrongly lumped IG's boss-minions with Dragon's waves — they're
  different: IG has BOTH.)
- **"Add-handling" is a UNIVERSAL, TRANSFERABLE role — but split by class + satisfied per-dungeon:**
  Criodan (AoE dmg + AoE Freeze) helps the WAVE role in Dragon/IG/FK and boss-add LOCK in Spider. BUT the
  requirement varies: **kill vs lock**, **revive?**, timing.
  • Dragon waves → survive/burst through (then solo boss).
  • Spider spiderlings (boss-adds) → LOCK with AoE CC (15+; raw AoE stops clearing) → also starves Skavag.
  • IG boss-minions → keep them DEAD (they REVIVE); ALIVE minions make Frigid Vengeance a DEF-ignoring
    team-wipe, so this defuses the BOSS's kill mechanic. Freeze only buys time; killing/Block Revive is the
    real answer → a champ can cover the wave role yet only PARTIALLY cover the boss-minion role.
  ⇒ model needs SEPARATE needs: `wave_clear` + `boss_add_control` (+ boss DPS/survival), each scored by
  (method: damage vs CC) × (revive?) × (immunity) per dungeon — NOT a per-content average. Spider's per-goal
  build already encodes this.
- **Lesson (again):** I was about to make the model WORSE (lower dragon CC); only domain knowledge + a
  concrete champion caught it. Reinforces: the selector runs in SHADOW and is validated, never trusted a priori.

---

## INS-0012 — The calibration blocker is ON-SPEC runs, not data volume (actuator finding)
- **Status:** `proposed` — surfaced by the calibration actuator 2026-07-15; reframes the path to Deep Blue.
- **Finding:** the calibration actuator (loop → `knowledge/calibration-proposals.md`, report-only, guardrailed)
  found only **1 of 76** non-CB runs is ON-SPEC (fielded ≥3 of the recommended 5 AND attempted the recommended
  stage). We have 76 runs across 3 accounts, but players farm THEIR OWN teams at THEIR OWN stages — so ~75/76
  runs test something OTHER than what the model predicts. You cannot calibrate a prediction against runs that
  never made it. (Compounded by gear-tier miscalibration: the engine's recommended STAGE is often off, so even
  a player's "best stage" won't match the engine's number.)
- **CORRECTION (Mike, 2026-07-15):** the divergence between model picks and fielded teams is NOT neutral
  "players farm their own way" — it's that **the model picked BAD teams, so the player fielded their own
  BETTER ones** (coverage benched Brogni, fielded dead-CC Sun Wukong). Consequence: the "agreement with
  winning teams" metric is NOT circular (the player did NOT field the model's picks) — the winning fielded
  teams are INDEPENDENT EXPERT GROUND TRUTH, and the model's low agreement = the model is bad at picking.
  Unflattering read incl. the constructor: coverage agrees with wins 3.68/5, **constructor only 2.59/5** —
  the constructor is currently FURTHER from proven teams, NOT closer. The measurement does not support
  "constructor is better"; possibly the opposite. (Say it plainly — that's what shadow-measurement is for.)
- **REFRAME of the whole Deep Blue data story:** the blocker is NOT volume (corrected from "1 account" → 3)
  and NOT account count — it's model quality measured against the winning human teams we ALREADY have. Those
  ~76 winning teams are a TRAINING TARGET: the model must reproduce (then beat) them. On-spec runs (running
  the model's picks) validate the FIXED picks LATER; they're not needed to start improving.
- **The path to a calibrated/trusted model = DELIBERATE ON-SPEC VALIDATION RUNS:**
  1. the model produces a recommended TEAM + STAGE for a dungeon;
  2. the user runs EXACTLY that (recommended team, recommended stage, auto);
  3. the user reports the outcome (+ AI settings — reader can't capture them, [[ai-settings-manual-entry]]);
  4. the actuator calibrates on those on-spec runs (+ contribution/constructor get validated: their picks
     were actually FIELDED, so agreement→outcome becomes a real signal, not the circular one in model-accuracy).
  Organic version: the app being USED at scale (players run its picks) generates on-spec data for free. To get
  there NOW: deliberate validation runs — high-value, low-volume (a handful per dungeon >> hundreds of farms).
- **This is the last mile:** after all the machinery (knowledge, shadow models, measurement, actuator), what
  promotes the model from shadow→trusted is a simple human-in-the-loop A/B protocol, gated on on-spec runs.

---

## INS-0013 — A contribution-BLEND selectTeam fix FAILED (measured, reverted 2026-07-15)
- **Status:** `proposed` — experiment result; do not retry the naive version.
- **Attempt:** made `selectTeam` value a per-champ `soloContribution` (safe DoT + attack + sustain×threat +
  CC×ccEff + turn-buffs) blended with coverage, to fix the Brogni/support undervaluation (INS-0012).
- **Result (measured against the loop diff):** it RELOCATED errors, didn't reduce them. At full weight it
  fixed the headline bugs (Brogni bench ×24→0, Sun Wukong over-field ×23→0) BUT introduced Gnut ×27 bench +
  Narma ×19 / Glorious Pallas ×17 over-fields (Pallas FLIPPED under→over). Agreement flat-to-worse
  (3.68→3.65), discrimination narrowed. Tuning the weight DOWN un-fixed Brogni (back to ×14, agreement
  3.49). No single weight cleanly wins. **Reverted to baseline.**
- **Diagnosis (why a greedy-sort fix can't do it):** (1) a flat per-champ blend ignores team STRUCTURE
  (1–2 carriers + supports, INS-0006) → boosting supports benched a CARRIER (Gnut); (2) the contribution
  SCORING has its own errors — OVER-credits sustain-stacked champs (Glorious Pallas: Shield/Ally Protection/
  DEF → high sustain score, but NOT in winning teams) and UNDER-credits carriers (Gnut). A selection weight
  can't fix scoring errors or enforce structure.
- **Real path:** (a) fix the contribution SCORING errors the diff now pinpoints (Pallas over-credit, Gnut
  under-credit) — helps BOTH constructor and any blend; (b) use the STRUCTURAL constructor (marginal +
  saturation + carrier protection), not a greedy sort. The constructor uses the same sustain scoring so it
  inherits the Pallas over-credit — fix scoring first.
- **META-WIN:** the measurement infra did its job — it caught a change that FELT like a fix (Brogni back on
  the team!) but was a lateral move. Without the diff we'd have shipped "fixed" while silently benching Gnut.
  This is the discipline that reaches Deep Blue instead of a confident-but-wrong model.

---

## INS-0011 — Ice Golem survival mechanics: Decrease ATK mitigation + trash-wave gap (cross-check)
- **Status:** `proposed` — from a Gemini cross-check 2026-07-15 (mechanical facts extracted; editorial
  champion picks NOT copied). Two VERIFIED content gaps + refinements.
- **VERIFIED GAP 1 — Decrease ATK on the IG BOSS mitigates Frigid Vengeance:** keeping Decrease ATK on
  the boss heavily cuts his DEF-ignoring counterattack damage — a key survival lever. VERIFIED absent:
  ZERO `Decrease Attack` in any IG solution (stages 14-20). Candidate: add a boss-phase "mitigate Frigid
  Vengeance with Decrease ATK" goal (seed + approval). Fits wave-survival's 4 approaches (kill / DECREASE
  ATK / CC / sustain) applied to surviving the BOSS counter, not just waves.
- **VERIFIED GAP 2 — IG pre-boss TRASH WAVES not modeled:** real wave dealers (Seer/Zarala/Terrorbeast)
  precede the boss, distinct from the 2 boss-minions. VERIFIED: every IG "wave phase" goal is about the
  MINIONS ("kill both minions", "kill right minion first") — no trash-wave-clear goal. Confirms the
  content gap flagged in INS-0007: the DB collapses trash waves into the minion need. Candidate: add IG
  trash-wave clear goals (separate from the boss-minion goals).
- **Refinement 3 — Decrease TM UNRELIABLE on the IG boss:** he REGAINS turn meter when minions attack
  (not immune like Dragon, but self-refills). Per-boss caveat → discount AoE Decrease TM on the IG boss
  (it works on adds, not the boss). Model currently would over-credit it.
- **Refinement 4 — Max-HP-Destroy sustain nuance:** the boss permanently shrinks max HP, so SHIELDS +
  continuous-heal + mitigation beat flat/burst heals (flat healing degrades as the pool shrinks). A
  sustain-VALUATION nuance for IG (absorption/continuous > burst-heal), beyond the spike ranking.
- **Refinement 5 — the "babysitter" survival support:** 2-3 of {cleanse/block-debuff, revive, continuous-
  heal/shield, wave-control}, built HIGH RES so they resist the freeze themselves and can cleanse the team,
  + high SPD + tanky. Validates multi-mechanism sustain; RES-for-self-freeze-immunity is the specific.
- **Confirmed already-modeled (cross-check reassurance):** don't-burst, Poison/HP Burn safe damage, Block
  Revive, cleanse freeze, RES advisory, kill-right-minion-first (right minion = Decrease DEF). IG content solid.

---

## INS-0010 — Auto-battle SKILL AI settings (per-skill config + team-level resolver)
- **Status:** `proposed` (Mike design, 2026-07-15) — new feature area; schema can land now, resolver later.
- **Problem:** each skill on a champ+content has an optimal AI setting (always/never/conditional), but the
  optimum is TEAM-DEPENDENT (two Decrease DEF → only one should fire; which depends on speed/reliability/
  cooldown). Team-level problem, not a data lookup. Skill-INTERACTION knowledge (e.g. Xenomorph A2/A3 break
  his Perfect Veil window → never_use) is NOT derivable from tags/reliability — this is where it lives.
- **Layer 1 — `skill_ai_configs` table** (per champion × skill_slot × content_key): recommended_setting
  (always_use|never_use|conditional|default), condition, priority, ai_condition_notes, auto_reliable,
  rationale, validated, confidence_pct. Passives = always `default` (documenting behavior). First data:
  Xenomorph CB — A1 always_use, A2/A3 never_use (Veil window), validated=false until run data.
- **Layer 2 — team resolver** (runs AFTER selection/constructor, BEFORE explanation): resolves conflicts
  → per-champ AI config for THIS team. Conflict types: REDUNDANCY (two same debuff → keep higher
  reliability×uptime, disable other), DEPENDENCY ORDERING (DEF Down before dealers — flag if speed tune
  wrong; can't fix), SATURATION (two poisoners — both needed for stacks?), BUFF-EXTENSION collisions.
- **Layer 3 — validation:** `ai_config_used` (jsonb) on `run_reconciliations` stores the actual settings
  run; compare outcomes across config variants for the same team → promote validated=true. **The battle
  reader CANNOT read in-game AI skill settings (Mike, confirmed 2026-07-15) — so `ai_config_used` is MANUAL
  entry: ASK the user for the AI settings of any run being validated.** Low-volume (only for config-validation
  runs, not every capture), so manual is fine. See [[ai-settings-manual-entry]].
- **Explanation output:** a clean per-champ skill checklist ("Xenomorph: A1 only, disable A2/A3. Kael: all
  enabled, A3 priority 1.").
- **RECONCILIATION with existing work:**
  1. Resolver's "reliability × uptime" = our `reliabilityFactor` + ACC-vs-floor weighting (INS-0008) — reuse.
  2. `auto_reliable`: `champion_skills.auto_reliable` = GLOBAL default (migration written); `skill_ai_configs.
     auto_reliable` = per-content OVERRIDE (null → fall back). No duplication.
  3. `ai_config_used` column is cheap; CAPTURING it (battle reader reading skill-AI toggles) is likely a
     data gap (like durationSeconds was) — confirm feasibility, else can't tell "ran right" from "wrong config".
  4. Loop can DRIVE annotation: flag recommended champs with no `skill_ai_config` for the content = the
     on-demand annotation trigger (same philosophy as the motion surfacing blindness/gaps).
- **Build order (Mike):** (1) schema now [small]; (2) annotate on-demand starting most-used CB champs;
  (3) resolver for the 2 common conflicts (redundant debuffs + skill-disable ≈ 80%); (4) `ai_config_used`.
  Full run-data-backed confidence = 6-12mo data accumulation (data is the long pole, not engineering).

---

## INS-0009 — Ability economy across SEQUENTIAL waves: cooldowns carry over (Mike, 2026-07-15)
- **Status:** `proposed` — refines INS-0007 (waves) + INS-0008 (coverage sufficiency).
- **Claim:** Dragon has ~3 SEQUENTIAL waves before/including the boss, and **cooldowns CARRY OVER between
  waves** — a skill used on Wave 1 is still on cooldown entering Wave 2. So for any role performed EVERY
  wave (add-clear / add-control), "has the tag" ≠ "handles the waves"; a single cooldown-gated AoE covers
  ~1 wave, then a GAP. The role must be REPEATABLE across the sequence.
- **THE structural reason Criodan > Ninja for waves (beyond affinity/ACC):** Ninja's AoE freeze/stun is a
  COOLDOWN skill → ~1 wave of coverage. Criodan's A1 Frostbark freezes with NO cooldown (A1, every turn) +
  passive Snow Dancer fills his own TM per freeze → he freezes AGAIN → locks ALL 3 waves. Repeatable, not
  just reliable.
- **Modeling:** score per-wave-repeated roles by REPEATABILITY = f(source-skill cooldown vs wave cadence,
  # of independent sources on the team, speed-recycling). Satisfy via a low-CD/A1 specialist, OR multiple
  add-control champs, OR enough SPEED to recycle the CD before the next wave. Another reason turn-economy
  is king: speed makes abilities AVAILABLE more often, not just faster.
- **DATA GAPS:** (1) `champion_skills` HAS cooldowns (`cooldown_base`/`cooldown_booked`) but TAGS are
  champion-level and don't carry which skill/slot/cooldown provides them → need a tag→source-skill link to
  know if an AoE Freeze is a no-CD A1 (repeatable) or a long-CD A3 (one-shot). (2) DB models the wave phase
  as ONE, not N sequential sub-waves → the cooldown-cadence isn't represented.

---

## INS-0008 — Coverage must be RELIABILITY-weighted (shadow-constructor finding, 2026-07-15)
- **Status:** `encoded` (ACC-vs-floor dimension) — 2026-07-15; other dimensions still `proposed`.
- **BUILT + VALIDATED:** ACC-reliability weighting in `lib/team-constructor.js` (`accReliability`,
  `coverageReliability` uses the champ's BEST covering method, `needStrength` = max(reliable AoE-clear,
  ACC-gated CC-lock)). Built coverers scored at CURRENT ACC; potential (unbuilt) candidates at built
  potential. RESULT: Criodan the Blue now SURFACES as a wave-control upgrade for Dragon-20 (str 1.2 vs
  built 0.5, because Ninja's AoE Freeze at ACC 48 vs the 225 floor ≈ 21% reliable) AND Spider-18, and
  correctly does NOT surface for Ice Golem (minion need lists AoE Stun/Damage/Block Revive, not Freeze —
  revive → need dead). The 3-dungeon Criodan test passes. `tools/shadow-construct.mjs`.
- **STILL `proposed` (remaining reliability dimensions):** affinity (per-stage enemy affinity — data gap),
  debuff potency by rarity, repeatability across sequential waves (INS-0009, needs tag→skill-cooldown link).
- **Finding:** the shadow constructor (`lib/team-constructor.js` + `tools/shadow-construct.mjs`) builds
  sensible phase-aware teams from DB needs, BUT the Criodan validation exposed that BINARY (and even
  magnitude-based) coverage isn't enough — it must be weighted by RELIABILITY. Concrete: on Dragon-20 the
  built team's wave need reads "covered" because **Ninja (Lv50★5) has AoE Stun (control 1.0)** — yet the
  player keeps DYING in the waves, because at stage 20 Ninja's AoE Stun MISSES (enemy RES > his ACC; the
  mid-game ACC wall). So Criodan (dedicated 45%/hit AoE Freeze specialist) doesn't surface as an upgrade,
  even though he's the real fix — because the model can't see Ninja's coverage is UNRELIABLE.
- **Fix (next):** weight need-coverage strength by reliability. Reliability has FOUR dimensions:
  1. **proc chance** × uptime (booked, INS-0003 for Rares) × `auto_reliable` (migration written).
  2. **ACC vs the stage floor** (`stat_threshold_checks` — already in engine) — does the debuff LAND.
  3. **AFFINITY** (game fact, added 2026-07-15): stage enemy affinity × champion affinity. Off-affinity
     = glancing/weak hits + debuffs resisted → "drastically reduces reliability" (per strategy sources).
     DATA GAP: engine has `champions.affinity` but NO per-stage enemy affinity. Needs the affinity triangle
     (Magic>Spirit>Force>Magic; Void neutral) + per-stage affinity data.
  4. **DEBUFF POTENCY by rarity** (game fact): a Rare's Decrease DEF (~30%) ≠ a Legendary's (~60%). Covering
     a debuff role is NOT binary — the % magnitude matters. We store chance but likely not the debuff VALUE;
     add it (or approximate by rarity) so a weak Rare debuff doesn't read as full coverage.
  A tag "covers" a need only as well as it actually LANDS and how STRONG it is at that stage.
- **VALIDATION (independent strategy source, 2026-07-15 — mechanical facts only, editorial NOT copied):**
  outside guide independently confirms the framework: waves are a distinct escalating challenge (INS-0007);
  strategy shifts with progression — raw damage early, then AoE Decrease ATK OR CC (constraint-responsive);
  team shape 1 damage + 4 support incl. a turn-meter/speed slot (INS-0006 + INS-0005). Wave-survival = FOUR
  alt approaches, stage-dependent: KILL (raw AoE, early) / DECREASE ATK (soften) / CC (deny turns) / SUSTAIN.
- **Good outcome:** the shadow run did its job — instead of forcing the expected answer (Criodan), it
  revealed the missing dimension. Exactly why the constructor runs in SHADOW.

---

## INS-0006 — Team shape: 1–2 damage + 3–4 varied supports (supports multiply, carriers add)
- **Status:** `proposed` (Mike, 2026-07-15) — core calibration for the Layer 3 team-constructor.
- **CORRECTION:** an earlier draft of this concluded "load damage → 3–4 damage + 1–2 utility." That was
  BACKWARDS. The game meta is **1–2 damage dealers + 3–4 supports** (buffs/debuffs/sustain/protection/CC/
  aura). Recorded here as the fix.
- **Claim + why it reconciles with "utility falls off fast":** falloff is fast WITHIN a single role
  (no 2nd healer, no 2nd Decrease DEF) — but there are MANY DISTINCT support roles, each MULTIPLICATIVE
  on the carrier. Key asymmetry: **a support MULTIPLIES the carrier's output (percent, compounds); a 2nd
  carrier only ADDS its own raw output.** With 5 slots, stacking distinct multipliers on 1–2 well-fed
  carriers beats fielding 4 raw carriers who buff nothing and die sooner. So: seat enough damage to KILL,
  then load BREADTH of distinct supports.
- **This is the EMERGENT PROOF of the whole session's thesis:** sustain×turns, speed×turns, debuff×damage,
  Poison Sensitivity×poison, CC×survival — the multiplicative model is *why* the team template is mostly
  supports. The 1–2/3–4 ratio isn't a separate fact; it falls out of the multiplicative structure.
- **Re-frames the "carrier-vs-support distortion":** a support out-ranking a carrier in marginal value is
  often CORRECT (it multiplies; the carrier adds). The real guard is NOT "carriers must outrank supports"
  — it's the **kill-speed constraint** (two-sided confidence): the team must seat ENOUGH damage (≈1–2
  carriers) to kill in budget, then maximize the multiplier stack.
- **Implementation:** constructor ensures ~1–2 damage sources satisfy kill-speed, then fills remaining
  slots by highest-marginal DISTINCT support role. WITHIN-role saturation steep (2nd of a role ≈ ×0.25,
  3rd ≈ ×0.05; DoT via stack-cap `saturationValue`); ACROSS distinct roles, supports keep paying (each a
  new compounding multiplier). Aura best-among-fielded (INS-0005 R2). Nominal — calibrate against outcomes.
- **Lesson:** my a-priori conclusion was wrong and only domain knowledge (or real outcome data) caught it —
  exactly why the selector runs in SHADOW and is validated, not trusted a priori.

---

## INS-0005 — The SPD leader aura is the premier team-turn multiplier; construction must anchor on it
- **Status:** `proposed` (Mike, domain expert, 2026-07-15) — design direction for the Layer 3 selector.
- **Class:** game-mechanic fact + team-construction ordering.
- **Claim:** A SPD leader aura is the best leader skill in the game and the strongest form of the
  turn-economy principle (INS-0002): passive, team-wide, unconditional, active from turn 1, in ALL
  content. Unlike an active [Increase Speed] buff it needs no cast and never drops → a guaranteed
  team-turn multiplier ≈ the aura's SPD%. Team construction should FIRST secure the best SPD aura
  on a content-relevant champion (seat as leader), THEN fill roles (carrier → enablers → sustain → fill).
- **Model gap:** leader is chosen POST-HOC — `selectLeader(team)` runs AFTER `selectTeam` picks the 5,
  so (a) the aura can't influence WHO makes the team, and (b) a strong SPD aura on a champ who misses
  the coverage cut is LOST entirely (silent waste). The contribution composite has no leader-aura term.
- **Fix:** model the team's leader SPD aura as a guaranteed team-turn multiplier (best content-relevant
  SPD aura% among the fielded 5), attributed team-wide; make the Layer 3 team-construction ANCHOR on it
  as step 1 (aura-relevant + contributes), then marginal/saturation-aware role fill.
- **Rule 1 — the best aura relieves the team's BINDING CONSTRAINT for this content+stage (Mike):**
  not a fixed SPD>ACC preference — pick the aura that fixes the tightest bottleneck.
  • Turn economy is the usual bottleneck → **SPD** aura by default (basic dungeons).
  • Mid-game, higher stages: enemy RESIST outpaces gear ACC → debuffs MISS. A debuff/DoT team that
    can't land debuffs does NOTHING, so an **ACC** aura outranks SPD when the team is projected BELOW
    the stage ACC floor. Conditional + saturating: worth a lot at the deficit, ~0 once above the floor.
  • Other auras (CritRate nuke comps, etc.) in specific content.
  DATA IS ALREADY THERE: the aura step reads projected ACC vs `stat_threshold_checks`/`threshold_results`
  (ACC=land YOUR debuffs vs RES=resist boss's, per CLAUDE.md) and switches SPD→ACC on a deficit. Reuse
  `selectLeader`'s `LEADER_TYPE_WEIGHT` as the base, but make the SPD/ACC choice constraint-responsive,
  not static.
- **Rule 2 — aura value is MARGINAL / best-among-fielded / SATURATING (Mike):** only the leader's aura is
  active, so a champ's aura is worth the IMPROVEMENT over the best SPD aura the team already has. Ezio/
  Deacon: with Ezio (SPD aura) already fielded, Deacon's aura adds ~0 here; drop Ezio and Deacon's aura is
  the team's best → he anchors as leader on nearly every team. Same saturation shape as poison stacks / 2nd
  healer, applied to the leader slot. So DON'T add a flat per-champ aura score — score marginal aura vs the
  team-so-far during construction.
- **Deacon Armstrong = the archetype + a Layer-3 validation test case:** strong early/mid BECAUSE his value
  is turn economy — SPD aura (passive) + active turn manipulation (fills ally TM, drains enemy TM, extra
  turn). Post-session the composite ALREADY credits 2 of his 3 turn levers: Increase Turn Meter (INS-0002
  grant) + Decrease TM (INS-0004 control); only the AURA is still uncredited (this insight). TEST: on a
  team lacking a SPD aura the selector should surface Deacon as a strong pick/leader; on a team with Ezio
  it should NOT over-value his aura. Getting both right validates the marginal-aura logic.
- **Evidence:** consistent with INS-0002 (turn economy dominates); corroborated by the current waste —
  a benched best-aura champ contributes nothing. `selectLeader` already weights SPD auras top
  (LEADER_TYPE_WEIGHT spd:1.0) but only AFTER selection — the ordering is the bug.

---

## INS-0004 — Crowd Control is a survival mechanism (the composite is blind to it)
- **Status:** `encoded` (structure + coarse immunity) · magnitude `nominal` — 2026-07-15
- **Class:** game-mechanic fact (survival axis) — twin of §3 (sustain) and §3b (speed).
- **Claim:** Crowd Control (Stun, Freeze, Sleep, Fear/True Fear, Provoke, Petrification, Decrease
  Turn Meter) is survival by DENYING THE ENEMY turns — fewer enemy actions = less incoming
  damage, exactly as sustain extends ally turns and speed buys them faster.
- **IMPORTANT — CC is NOT unhandled by the app; this is a NARROW gap in the NEW composite:**
  The COVERAGE engine handles CC extensively — goal_solutions require AoE Stun (72×), AoE Freeze
  (61×), AoE/Decrease Turn Meter (47+58×), etc.; `checkCCSustain` treats ACC-gated CC as survival;
  the Clan Boss stun matrix models incoming stun. The gap is that the SESSION-NEW contribution/
  watchdog COMPOSITE never got a CC term (CC tags absent from TAG_TO_SOURCE / TAG_TO_MECHANISM /
  MULTIPLIER_DEBUFFS / TURN_MULTIPLIER_TAGS), so it scores a control champ 0 even though coverage
  values them. PLUS a real vocabulary gap: **True Fear and Petrification are required by ZERO
  goal_solutions**, and checkCCSustain only knows 4 CC tags — so Fabian's signature control is
  under-modeled in coverage too.
- **Evidence:** loop flagged **Lord Entertainer Fabian** scoring ~0 in the composite on Ice Golem
  across **11 fielded runs** (mostly wins). Coverage DOES credit his Decrease TM (fielded him);
  the composite zeroes him; reality sides with coverage. On IG he is on-mechanic — his passive
  drops True Fear on REVIVED enemies, countering the minion-revive threat. This is the coverage-vs-
  contribution disagreement of the whole session, with the CONTRIBUTION model in the wrong.
- **BLOCKER before encoding (why not done off the cuff):** CC value is CONDITIONAL on CC-IMMUNITY
  (cf. INS-0001). Many dungeon BOSSES are immune to hard CC (FK "Almighty Immunity" — CC works on
  minions only). A naive "CC = survival" term would over-credit CC vs an immune boss = a NEW error.
  Needs a per-content CC-effectiveness (like sustain THREAT_PROFILES) + structured boss CC-immunity
  (currently only free text in `boss_exceptions`). Also: Decrease TM ≠ hard CC (partial), and CC
  reliability depends on ACC landing (tie to reliabilityFactor).
- **Proposed fix:** add a `control` term to the composite — a CC mechanism set × per-content
  CC-effectiveness (0 where the boss is CC-immune and there are no adds; higher where minions/adds
  matter, e.g. IG). Mirror the sustain-profiles structure. Magnitude nominal until calibrated.
- **Encoded in:** `lib/sustain-profiles.js` §5 — `CC_CONTROL_TAGS` (tag→strength),
  `CC_EFFECTIVENESS` (per-content 0..1, bakes in immunity/adds), `controlStrength()`,
  `ccEffectiveness()`. `lib/watchdog.js` — `control` sub-score in the composite, weighted by
  `W_CONTROL_BASE × ccEffectiveness(content)` (applied as a WEIGHT so immunity survives
  normalization). Narrated via `dominantRole`. Test: `tools/watchdog-test.mjs` §6.
- **Verified:** Fabian-like champ 0 → composite 0.74 on Ice Golem, control sub-score 1.0; only
  0.19 on CC-immune Clan Boss (immunity guardrail holds). Loop re-run: `possible_blindness` items
  went 2 distinct (Fabian ×11, Staltus ×10/×4) → **ZERO** — the whole control-blindness class fixed.
- **Residual (future):** CC_EFFECTIVENESS is per-CONTENT, not per-PHASE — it can't yet distinguish
  "CC the boss" (often immune) from "CC the adds" (works) WITHIN a fight. Structured per-phase boss
  CC-immunity (promote `boss_exceptions` free text to a flag) is the refinement. Magnitudes nominal.
  Also: the coverage vocabulary gap remains (True Fear / Petrification / Sleep required by no goal) —
  a separate content fix (the "fix #2" option), independent of this composite work.

---

## INS-0001 — Debuff value is conditional on the team's damage type
- **Status:** `encoded` · `verified` — 2026-07-14 (pre-existing; recorded here for completeness)
- **Class:** game-mechanic fact.
- **Claim:** Decrease DEF / Ignore DEF / Increase ATK boost ATK-vs-DEF **attack** damage
  ONLY; they do NOTHING for %maxHP DoT (Poison / HP Burn / Warmaster). So on a poison team
  they are near-worthless, while Poison Sensitivity (amplifies poison) and sustain/speed
  (buy turns) are what matter.
- **Evidence:** DonBrogni CB runs (Uugo Decrease DEF ~2% bar on a poison team); the same
  CB key above shows Decrease DEF on 3 champs + Increase ATK on 2 — coverage would credit
  all five as "damage buffs"; the model correctly credits ~0 to them vs poison.
- **Encoded in:** `lib/damage-mechanics.js` §1–§2, §5; enforced at load in `cb-damage-model.js`.
- **Consumers:** contribution model, watchdog (grant term), explain.js (debuff carve-out).
