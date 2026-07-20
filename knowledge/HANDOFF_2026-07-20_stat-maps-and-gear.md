# Session Handoff — 2026-07-20 (session 2): stat-map fix + measured gear tiers

**COLD-START DOC.** Read this after `HANDOFF_2026-07-20.md` (the "first live testing session"),
which this continues on the same day. That doc's **§4.1 stat-ID blocker is now CLOSED** — the
single fix that unblocked everything below.

Nothing here is committed or deployed. The working tree also carries a large PRIOR uncommitted delta
(pool-select, the CB contiguous-run guard, the ledger, gestal-context) that is NOT this session's
work — do not attribute it here.

---

## ⏩ THE HEADLINE: both stat-ID maps were WRONG and are now fixed

The prior handoff flagged (§4.1) that two stat-ID enumerations disagreed and blocked "everything
stat-shaped." **Resolved against ground truth** — an in-game Ezio Auditore (DonThor, Lvl 60 6★) stat
panel plus per-artifact tooltips, matched piece-by-piece to his snapshot, and brute-forced against the
panel totals.

### Artifact space (`gestal-sync/sync.js` `STAT_KIND`) — 5 of 11 ids were wrong
| id | was | **is** | proof |
|---|---|---|---|
| 4 | SPD | **HP%** | Boots sub tooltip "HP(1) 10%" = id4 |
| 5 | CDMG | **DEF%** | Boots sub "DEF(1) 11%" = id5 |
| 7 | RES | **SPD** | Boots main "SPD 40" = id7; **135 pieces, boots-only** |
| 9 | HP% | **CDMG** | Chestplate sub "C.DMG(1) 10%" = id9 |
| 11 | DEF% | **RES** | Gauntlets sub "RES(1) 15" = id11 |

### Bonus space (`lib/effective-stats.js` `STAT_KIND_ID`) — ids 5-8 shifted
Was `crate/cdmg/res/acc`, **is `res/acc/crate/cdmg`**. Decoded directly from the Perception tooltip
("2 Set: ACC +40. SPD +5%") against Ezio's `bonusesV2.sets`.

**⚠ THE TWO MAPS ARE DIFFERENT ENUMERATIONS AND MUST STAY SEPARATE.** Bonus id7 = C.RATE while
artifact id7 = SPD. Do not "reconcile" them — treating them as one map was the original bug.

### Verification (the corrected code reproduces the panel)
`effectiveStats(Ezio)` → **C.RATE 83 ✓ · C.DMG 117 ✓ · RES 86 ✓ · SPD 203 (panel 204)**. HP/ATK/DEF/
ACC read low by 2884/269/182/6 because **Great Hall + Arena bonuses are absent from the Gestal
snapshot entirely** — a separate, still-open gap.

### Consequence — re-derive anything from before this fix
§3.7's "RES barely moves / max 214 / zero exceed 250" was **never RES** — it was SPD (id7), with real
RES discarded as DEF% (id11). Real max RES across six accounts is **119**. SPD did not exist as a
usable stat before this (id7 was labelled RES); it is now median 163, and it is the cleanest
progression signal we have.

**Operational:** `sync.js` bakes the LABEL into snapshots, so a re-sync was required and DONE
(`node gestal-sync/sync.js`). All six accounts now label boots id7 = SPD.

**Still open — gear-SET ids look shifted the same way.** Ezio's gauntlets report set "Divine Speed"
but the game shows **Retaliation**; boots "Daze" → **Regeneration**. Confirmed anchors from tooltips:
`gearSetId 24 = Retaliation, 15 = Regeneration, 2 = Offense`. ~14 `unknown(NN)` sets, ~617 pieces,
and Xenomorph's missing Regeneration bonus are all probably this. NOT fixed.

---

## GEAR TIERS — the main thread, now measured not guessed

### The principle (worked out on Fahrakin): SPD → ACC → CRIT
You fund **preconditions before multipliers**, ordered by how much each gates: SPD gates whether the
turn happens usefully → ACC gates whether the effect lands → CRIT only scales what already landed.
This is build-independent and needs no champion classification.

The measured tier ladder confirms it independently (`tools/gear-tiers.mjs`, 344 clears):
**SPD saturates** (109→145→166→plateau), **ACC keeps climbing** (24→33→41→48, the only stat still
buying stages at the top), **CRIT doesn't ladder at all** (goes down at endgame). The stat that gates
most shows the cleanest ladder; the stat that gates nothing shows none.

### "Good gear = 5★ substats at +16" — TESTED, and stage 20 is too low a bar
`tools/gear-quality.mjs`: only **9 of 83** geared champions meet the full bar (Mike's self-assessment
"very few" is accurate), yet stage-20 clearers median **3.1 of 6** pieces. Tagoar/Madame/Stag clear
Dragon 20 on **2 of 6**. So stage 20 ≈ fair/good boundary, not "good". The fully-geared 9 have never
been run to a wall, so the TOP tier is UNANCHORED, not mis-anchored.

### Per-type multipliers — LANDED in `lib/estimate-stats.js`
One table (`GEAR_TIERS`) was calibrated to an attacker and over-credited supports catastrophically
(measured on DonThor's real team: Support ACC +130%, C.RATE **+240%** — Mavara credited 85% crit vs a
real 25%). Fix: **`GEAR_TIERS_BY_TYPE`** — `attack`/`support`/`dot` rows fitted from real clears via
`tools/fit-gear-tiers.mjs`, monotonic across tiers, thin types (defense/hp/hybrid) fall back to the
generic table. `championGearType()` selects the row. Result: Support C.RATE +240% → **0%**, ACC +130%
→ **+9%**; SPD and ACC now within 10% on both fitted types.

**Load-bearing distinction discovered:** the ESTIMATOR is fitted at the **MEDIAN** ("what does a
player who says 'good' probably have"); THRESHOLDS/floors want **p25** ("what does the content
require"). Same tool, different `PCTL`. Do not reuse the estimator table as floors —
`PCTL=0.25 node tools/fit-gear-tiers.mjs` for that.

### `endgame` SPD is RULED, not fitted
Mike: "endgame speed should be 200." Stored as a bonus over base (~100), so `spd: 100` = ~200 total,
across all three types. The fitted value was 74 because the `endgame` band is stages 20-25 NORMAL,
which the gear test showed is "good" territory — true endgame (Hard mode / CB Nightmare / Doom Tower)
has NO captures. `fit-gear-tiers.mjs` will NOT reproduce this; it is hand-set.

### Classification dead-ends (recorded so they're not re-tried)
Splitting DoT carriers from attackers was attempted three ways and all failed: **crit proxy** is
fragile (Ninja sat 2 points from flipping); **kit tags** can't discriminate (AoE Damage is
near-universal, 3/5 wrong); **curated labels** break on Fahrakin, who is genuinely attacker + DoT +
amplifier + debuffer at once. The lesson (Fahrakin): don't classify the champion — read the kit's
dependency chain (SPD>ACC>CRIT), which needs no category. The proper DoT-vs-attack split needs the
magnitude/damage-source model gen-3 lacks (INS-0031).

---

## FLOORS ARE NOT GATES — implemented in `lib/match-engine.js`

Mike: "there are no gates in the game... the game just lets us die." Previously only ACC was soft
(INS-0014); HP/DEF/SPD/RES hard-failed a stage. **Now EVERY stat floor is soft** — degrades
confidence continuously (weakest-link), never selects a band. Coverage GAPS stay hard (a real
capability absence, unfixable by grinding). This was THE cause of gen-1's Dragon miss: it demanded
RES 250-300 that no account has (ceiling 119), so the scan fell to stage 6.

**But softening alone did NOT fix prediction** — it moved the gate one layer up to
`confidenceThreshold: 80`. Dragon 20 still scores 59 < 80 because the RES floor is 4-8× too high, so
the stage is still rejected. **The floors themselves are wrong numbers**, and that's the next fix:

### Floors from reality (`tools/floor-from-reality.mjs`) — the replacement, ROLE + FUNCTION aware
Fitted from teams that cleared. Dragon 20, per function (median per champion, deduped by
account+champion; roles ruled: crit split, DoT carrier as its own category built "like supports with
accuracy"):

| category | n | SPD | ACC | notable |
|---|---|---|---|---|
| Attack | 10 | 169 | 142 | crit 88 |
| Support | 10 | 175 | 26 | crit 25 |
| DoT carrier | 5 | 175 | 92 | crit 32 — least-invested on the team |

Declared vs reality: RES **300 vs 37 team-min (8.1×)**, ACC **225 vs ~136 carrier (1.65×)**, IG HP
**40,000 vs 28,000 (1.4×)**. Two bugs stack: wrong STATISTIC (RES applied as team-min, but a champion
with no RES just gets debuffed — it isn't a team property) and wrong NUMBER. Don$Gnut clears Dragon 20
with an attacker at ACC 33 and a support at ACC 0 → fit to the MINIMUM that cleared, not the median.

**End-to-end proof (`tools/predict-from-tier.mjs`):** from base stats + one tier word, SPD lands
within 2-4% per champion, attacker crit within 1% — estimator works. Prediction still says stage 4 vs
actual 23, and the ENTIRE remaining error is the thresholds, not estimation.

---

## AFFINITY — landed in gen-3 (shadow only)

Placement channel implemented in `lib/bucket-magnitude.js` and plumbed through
`tools/bucket-score.mjs` + `pool-select.mjs` + `shadow-grade-clears.mjs`.

**The mechanic (Mike-supplied, exact):** vs a stronger affinity, every strike takes ×0.80 damage AND
35% are Weak Hits (×0.70 more, and **cannot place active-skill debuffs**). So affinity's biggest
effect here is DEBUFF PLACEMENT, not damage — `AFFINITY_PLACEMENT_WEAK = 0.65`, applied as a sibling
of `landRate`. Passive-placed debuffs (Narma's poisons) are EXEMPT. Weak-only; strong earns nothing on
placement because debuffs that could land already do.
- Narma/Xenomorph are MIXED (active A-skill + passive) — penalised as active (conservative), reported
  separately from `unknown`.
- Damage channel (crit-dependent 0.57-0.72) deliberately NOT implemented — it depends on crit, one of
  the stats §4.1 had wrong; ships after, if ever.
- `TAG_BRACKET` extended with 26 CC tags (derived from corpus, not memory) so attribution covers Stun/
  Fear/etc.
- **Cannot be validated by `shadow-grade-clears`** — that harness compares teams WITHIN a stage, and
  affinity is a cross-stage effect, so it moves both sides equally. Needs a different harness (one team
  across stages of differing affinity, the FK 96-vs-565-turn shape).
- Spawned background task `task_7c0398a1`: audit tags derived from immunity clauses (Atur carries
  Stun/Freeze/Sleep from an "immune to" passive — a policy #10 violation that now also grants a false
  affinity exemption).

---

## READER — one fix landed, one limitation diagnosed & parked

**FIXED (BattleWatcher.cs): phantom 6th hero.** `HeroIdentity.Extract` byte-scans the whole file and
`SameChamp` validates on only the low byte of typeId (±6), so ~5% of coincidental matches that resolve
to a roster heroId slip through. 5 six-hero captures in 771. Cost was severe: every tool filters to
exactly 5 heroes, so a phantom **deleted the whole run**. Fix = hard cap at 5 after validation, logged
unconditionally. Compiled into the running binary.

**DIAGNOSED, PARKED: dungeon per-hero damage fails on fast/farmed battles.** Duration predicts it
(<60s = 0/35 captured; 240s+ = 71%). Root cause CONFIRMED via `--dungeoninspect` on a SUCCESSFUL
capture: the dungeon result dialog exposes **no walkable hero list** (CB has one at +0x160; dungeon
doesn't), so it heap-scans and relies on the 5 contexts being CONTIGUOUS at stride 0x1A0. Fast farming
fragments the heap (`found runs: 1,2,2,1,1,2,1`) → the guard correctly returns null rather than guess.
**Not worth fixing now:** the failures are OUR limit-testing runs; on all 157 damage-less captures,
result/turns/duration/team/stage survive 100%, and the frontier protocol uses only those. Per-hero
damage matters for the contribution model, calibrated from normal-paced play which captures fine.
Identity-matching by typeId is the theoretical fix but CAN'T solve the dominant same-team-farming case
(stale contexts share the team's typeIds).

**⚠ The reader is on a DIAGNOSTIC launch** (PowerShell, pid was 39836, stdout → `reader-stdout.log`,
`RSL_DEBUG_HEROES=1`). Restore to the normal launch.

---

## NEW TOOLS (all this session)
- `frontier.mjs` — find the failure boundary per (account, content, team): climb to first loss, then
  sample 10 at the frontier + 10 at the control below. **DonThor Dragon 23 = 9W-4L (69%), first
  measured frontier in the corpus; wall at 24.**
- `rec-vs-reality.mjs` — model recommendation vs actual clear, per account × dungeon, with the binding
  reason. (Shows gen-1 under-recommends Dragon by up to 18 stages.)
- `floor-from-reality.mjs` — stat floors from clears, role+function aware.
- `gear-tiers.mjs` / `gear-quality.mjs` — the priority-ladder tier table / the 5★+16 test.
- `fit-gear-tiers.mjs` — fits `GEAR_TIERS_BY_TYPE` (PCTL selects estimator=median vs floor=p25).
- `estimator-error.mjs` — per-type estimate-vs-actual error.
- `predict-from-tier.mjs` — end-to-end: base stats + tier word → predicted stage.

## NEXT STEPS (recommended order)
1. **Replace the `stat_threshold_checks` floors** with `PCTL=0.25` fits from `floor-from-reality.mjs`
   — via a committed seed (CLAUDE.md hard rule), and fix the STATISTIC (RES/ACC carrier-aware, not
   team-min). This is what actually fixes stage prediction; the estimator is already accurate.
2. **`confidenceThreshold: 80` is itself a hard gate** — reconsider as "highest stage inside the time
   budget," per the floors-are-not-gates ruling applied to the scan.
3. **Gear-SET id map** — same shift as the stat map; anchors captured above.
4. **Hybrid crit gap** — crit-built supports (Stag Knight) get the support row, under-credited 64%.
5. Great Hall / Arena not in the snapshot — biases every HP-based estimate low.
6. Restore the reader to its normal launch.

## Verified numbers to trust (measured this session, corrected map)
- Max RES across 6 accounts: **119** (declared floors 250-300)
- Dragon 20 by type: Attack SPD 169 / ACC 142 / crit 88 · Support SPD 175 / ACC 26 / crit 25
- Estimator error after per-type fix: Support ACC +9%, C.RATE 0% (was +130% / +240%)
- Ezio effective (corrected): C.RATE 83, C.DMG 117, RES 86, SPD 203 — matches panel
