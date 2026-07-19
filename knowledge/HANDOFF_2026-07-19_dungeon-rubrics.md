# Session Handoff — 2026-07-19: rubrics for ALL FIVE contents + the testing loop

**Cold-start doc. SUPERSEDES `HANDOFF_2026-07-18_pool-model.md`** (still correct on the pool model
itself; this adds four more contents and three new scorer mechanisms).

**Read order:** this → `knowledge/MODEL_REGISTRY.md` → `knowledge/dungeon-bucket-taxonomy-DRAFT.md`
→ ledger INS-0030…0034.

---

## ⏩ MIKE'S GOAL NEXT SESSION: test on every dungeon. Here is exactly how.

### 1. START THE READER FIRST. Non-negotiable.
```
gestal-sync/RslBattleReader/bin/Release/net10.0-windows/win-x64/RslBattleReader.exe --whoami   # verify account
gestal-sync/RslBattleReader/bin/Release/net10.0-windows/win-x64/RslBattleReader.exe            # leave running
node --env-file=.env.local tools/watch-reconcile.mjs                                            # leave running
```
**If the reader is not running, the run is UNGRADEABLE and cannot be recovered** — the per-hero data
is live-memory only. This cost us the Tagoar→Vallaryn Dragon 20 A/B today; the run happened, the
comparison is gone. **Re-run `--whoami` after switching accounts** — the stamp can go stale.
Also: **do not use QUICK BATTLE** (no result dialog ⇒ no damage/healing capture).

### 2. Get a recommendation
```
node --env-file=.env.local tools/pool-select.mjs dragon
node --env-file=.env.local tools/pool-select.mjs cb Brutal
node --env-file=.env.local tools/pool-select.mjs fire_knight
node --env-file=.env.local tools/pool-select.mjs ice_golem
node --env-file=.env.local tools/pool-select.mjs spider 17     # spider takes a STAGE (strategies are stage-gated)
```
Multi-strategy contents build a team per strategy, then pick — **grade filters, development chooses**
(within a 5-point tie band). Alternates are printed so you can see what the other path would field.

### 3. Play it. 4. Score the rubric
```
node --env-file=.env.local tools/shadow-grade-clears.mjs [dragon|cb|ice_golem|fire_knight|spider]
```

**THE MOST VALUABLE RUN IS A LOSS.** Only a handful of groups in the whole log have BOTH a win and a
loss, and a rubric can only be judged where both exist. Comfortable clears add almost nothing. Losses
at your frontier are the scarce resource.

---

## STATE — five rubrics exist, ONE is validated

| content | rubric | score | note |
|---|---|---|---|
| **Dragon** | `lib/dragon-rubric.js` | **17/23 (74%)** | the only one that works |
| Clan Boss | `tools/bucket-score.mjs` | 0/2 | n=2 |
| Ice Golem | `lib/ice-golem-rubric.js` | 2/7 (29%) | 4 W/L groups — the BEST test bed |
| Spider | `lib/spider-rubric.js` | 1/3 (33%) | n=3, all in the 1-14 band |
| Fire Knight | `lib/fire-knight-rubric.js` | 0/0 | **no losses exist in the log** |

**Everything is SHADOW.** The live path imports only `lib/match-engine.js` (gen-1 goals+solutions).
Nothing is wired, nothing is deployed.

### THE BLOCKER — it is not the allocations
All three Ice Golem strategies scored **identically (2/7)**, which proves the error is UPSTREAM of any
budget split. Sun Wukong carries binary `Revive` + `AoE Damage`, so the model rates him well; reality
has him dying (the 2026-07-17 finding, resurfacing). **No re-weighting fixes a champion-value error.**
That is INS-0031's magnitude problem, and Ice Golem's 4 W/L groups are now the place to attack it.

**Two candidate causes, not yet separated:** (a) the magnitude defect, (b) iteration count — Dragon got
a full session with Mike and four structural corrections; FK/IG/Spider were built in hours.

---

## NEW MECHANISMS BUILT TODAY (all in `tools/bucket-score.mjs`)

1. **`scoreBestStrategy`** — multi-strategy contents score each path, best fit wins. Single-allocation
   content passes a one-element list and reduces exactly to `scoreTeam` (the regression guarantee).
2. **Per-(bucket, tag) weighting** — a bucket may be `{tag: weight}` instead of a flat array.
   Ruled for FK `shield_break`: `Multi-Hit A1` PRIMARY, `AoE Damage` half — "Coldheart's A1 is the
   reason she trivialises FK; if both score equally the selector can't find her."
3. **`overfill`** — a bucket whose surplus ACTIVELY COSTS (`{tempo: -1}`). Built for Spider, where
   2 Spiderlings spawn per champion turn, so tempo is genuinely double-edged. Mike ruled a true
   negative, not a lower weight.
4. **`harmfulPenalty`** — harmful tags dock the grade instead of merely contributing zero. Ice Golem:
   `Counterattack`/`Reflect Damage` chain-trigger Frigid Vengeance.
5. **ACC viability as a SECOND OUTPUT** — `gates[]`, deliberately NOT folded into the grade. Mike:
   the bucket is a challenge dimension; ACC is a champion-level viability check on whoever fills it.
   Blend for ranking, surface the flag separately.
6. **`cfg.accFloor` BUG FIXED** — it was destructured then ignored, so EVERY content scored at Clan
   Boss's floor (150). Dragon's 130 and CB's per-difficulty floors were computed and discarded.

---

## CORRECTIONS LANDED TODAY (expensive to rediscover)

- **`defense` = DAMAGE TAKEN — CONFIRMED** (in-game bar legend: red dealt / blue taken / green healed).
  Over-supply ratios are now measured, not assumed. INS-0032 updated.
- **`Block Revive` does NOT need ACC** — the target is already dead and cannot resist.
  `seeds/198_block_revive_bypasses_accuracy.sql`, applied + verified live.
- **Dungeon per-hero capture already worked** — the "records ZEROES" claim was false when written;
  damage since 07-16, healing/defense since 07-18. Residual limit is DATA VOLUME, not capability.
- **`survived` means "alive at the end", NOT "never died."** Champions die and are revived repeatedly
  (Mike, observed). Every "0 deaths" reading is wrong, and it undercuts the "4.6x over-supplied"
  margin — a revive is healing that arrives AFTER the failure.
- **High Khatun was a CONDITIONAL, recorded as a fact.** An unbuilt champion's value is conditional on
  the bucket being SHORT, never intrinsic. INS-0030 corrected.
- **HARD RULE added to `CLAUDE.md`: read the dungeon's `*_REVIEW.md` before touching its model.**
  Claude built FK/IG/Spider rubrics from `dungeon-mechanics.js` alone and missed six documented facts.

---

## OPEN — rulings owed by Mike

1. **`TIE_BAND = 5`** (cross-strategy development tiebreak) — nominal, Claude's number.
2. **FK Strategy A tempo 20** — Claude's arithmetic after removing `survive 5`. Mike said "fine for
   now"; not formally ruled.
3. **FK `mitigation` removed** — Fyro's punish is %MAX-HP, so ATK/DEF-side mitigation does nothing.
   Its 15 folded into `survive` (now 40). Claude's correction, needs confirmation.
4. **IG allocations** — all three are Claude proposals, not rulings. Do NOT tune them while the
   champion-value defect stands.
5. **IG `revive_control` near-zero on the DoT path** — DoT doesn't trip Frigid Vengeance, so minions
   rarely revive. Gate-shaped (20-25) on the burst/tank paths.
6. **FK survive-gate** — declared in the rubric, NOT implemented, and FK has **no HP/DEF thresholds**
   (25 ACC + 25 SPD only). IG's floors DO exist per tier.
7. **`shadow-grade-clears` still picks a strategy on GRADE ALONE** — `pool-select` now uses the
   development tiebreak. That asymmetry is a real inconsistency; decide which is right.

---

## TRAPS

- **Reader running BEFORE testing, or the run is lost.** Scope every read by `account_id`.
- **Do NOT judge the tag layer by asking it to RANK working teams** (INS-0034). `shadow-grade.mjs` and
  `shadow-grade-dragon.mjs` rank by SPEED, return coin-flips, and get misread as model failure.
- **Best-of-N inflates.** More strategies ⇒ higher grades and possibly less separation.
- **Cross-strategy grades are only loosely comparable** — different bucket sets, different fillability.
- **`dungeon-mechanics.js` is a SUMMARY**, not a substitute for the `*_REVIEW.md` packets.
- **Spider stages 21-23 drop to RES/ACC 150** before returning to 200 at 24-25 (non-monotonic in our
  data). Unverified — real, or an error in seeds 130-135.
- **Content with NO model at all:** Minotaur's Labyrinth (58 captures), Event Dungeon (40), the four
  Keeps (94), Doom Tower (24 stages, zero goals), Faction Wars, Campaign.
