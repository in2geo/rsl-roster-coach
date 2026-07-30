# HANDOFF — 2026-07-29 (session 3) — Spider-13 HP-Burn: reactive-duration fix + TM-race localization

> **Session 3 RE-CHARACTERIZED the central claim. Read this block first; sessions 1–2 detail is preserved below (its "~1 burning" framing is now refined).**

**Branch:** `session/qa-rungs-2026-07-23`. **Engine behavior CHANGED this session** (one card-justified fix, below) + 4 new diagnostic tools + records-only telemetry. Gear re-synced from Gestal (snapshot 2026-07-29T11:56Z) → fixture points at `data/observed-builds/2026-07-29-donbambus-current.json`.

## SESSION 3 — the corrected picture (supersedes the session-2 "one-line state")

**"Sim keeps ~1 burning" was a LIFECYCLE-POINT ARTIFACT.** Measured at the right point, the sim BURSTS to a pre-consume peak of ~**8** burning — matching reality's 5–10. The "~1" was the time-average (2.08) / post-consume snapshot. **Burning POPULATION and TAUNT COVERAGE are NOT the divergence.**

**The real wall is the first-tick / ACTIVATION rate: only ~18–23% of placed burns EVER tick; ~56% are CONSUMED before their first tick** (`sim-spider-tmrace`, `sim-spider-burn-ab`). HP Burn lands ~48% of Skavag's MaxHP over a fight vs >100% consume-healing → burn ≈ heal → 0% WR (reality 69%).

**DB-VERIFIED FAITHFUL — stop re-suspecting these:**
- **Taunt** = A3 Victor's Bounty, `cooldown_base = 4 Turns`, Taunt duration 2 → **~43% uptime is CARD-ACCURATE** (AI fires A3 off-cd = maximal). Targeting is perfect: `sim-spider-taunt` shows all 3 invariants PASS (valid-Taunt⇒Pelops picked; counting; burns_placed==attacks_on_Pelops), **new-spawn Taunt receipt 100%**, off-Taunt→lowest-MAX-HP (Vergis). Taunt is NOT the defect.
- **HP Burn** 2t, once-per-enemy-skill, 100%→50% under Decrease DEF; **Petrification** 50%/1t — all match the verbatim card. Consume every-other-Skavag-turn; spawns EVERY Skavag turn (Mike: drop ≠ consume); speeds 150/95.

**FIX APPLIED (engine change): reactive-HP-Burn duration.** `engine.js` same-turn-decrement guard (an effect placed during the holder's own turn survives that turn's end-expiration) was **Petrification-only** → extended to **HP Burn**. A reactive burn now ticks up to TWICE, not once. **A/B (`sim-spider-burn-ab`, 40 seeds):** total ticks 3.7→5.5, twice-ticking **0.0→1.8**, burn splash 160k→236k (**+47%**), **first-tick rate flat 18%→18%** (correct — a duration fix cannot change first-tick incidence), **WR 0%→0% (SECOND-ORDER, as predicted).** KEPT per IMPLEMENT-DON'T-FIT (verified game fact). Gated by `SIM_REACTIVE_BURN_FIX=0` for A/B only; **ON by default.** **Regression CLEAN:** `model-snapshot` no drift, `sim-dragon --stage 16` identical fix-on/off.

**THE WALL, mechanistically (`sim-spider-tmrace`, 20 seeds):** a Spiderling is burned ON its own turn → resets to **TM 0**. At 150 vs 95 it CANNOT out-charge a mid-charged Skavag — **median Skavag TM at burn = 63 for BOTH ticked AND consumed burns**, so it is NOT a TM-magnitude race. She acts first almost always; **consume PARITY (every other turn) then decides fate.** Driver = **speed-ratio × consume-cadence**, not TM. Split: 56% consumed-first, 23% tick-first, 10% our-AoE, 10% survive.

**THE STRATEGIC FORK — one decisive reality observation (needs Mike's footage):** in a WINNING run, of the Spiderlings burned in one consume cycle, what fraction visibly TICK before being eaten? (Sim ≈ 20%.)
- Reality ≫ 20% → sim turn-order is wrong (effectively-faster spiders / Decrease-SPD on Skavag / spawn-TM > 0). Hunt there.
- Reality ≈ 20% → **HP Burn is NOT the win path**; pivot to **Bambus poison redirect (§4: 3.1× under-modeled) + survival**. **← current lean** (every HP-Burn input tests card-faithful yet still ticks ~20%).

**New tools (all `tools/`, DB-gated, `--env-file=.env.local`):**
- `sim-spider-cycle.mjs [seed]` — consume-to-consume ledger (burn@pre-consume, atk→Pel, burns/ticks per cycle).
- `sim-spider-taunt.mjs [seed]` — Taunt-state trace + 3 invariants + new-spawn receipt + Pelops skill/cd log.
- `sim-spider-burn-ab.mjs [N]` — reactive-duration A/B (fix off vs on, per-tick ordinals).
- `sim-spider-tmrace.mjs [N]` — consume-vs-tick TM race (fate split + Skavag TM at burn).
- Telemetry (records-only, golden-safe): `spider.js` emits `spider_pick` per Spiderling turn; `engine.js` emits `burn_tick` with tick ordinal.

---

## SESSION 2 (below — ruled-out suspects, captures, fight-track; central claim refined in Session 3 above)

**One-line state (session 2):** The Spider-13 damage wall is fully localized to **HP Burn not accumulating** — the sim keeps ~1 Spiderling burning where reality shows 5–10. This session **ruled out almost every mechanical suspect** (RNG, affinity, consume cadence, base speeds, turn-meter drain, Pelops dying early). The root cause is **still open** and now hinges on one thing only Mike can observe about the real fight.

---

## 0. Cold-start orientation (READ FIRST)

**The whole fight is HP Burn.** Pelops's passive (Master of Games) places [HP Burn] on any enemy that attacks HIM; a burning Spiderling splashes ~3% of Skavag's MaxHP onto her every tick. Reality nets Skavag DOWN to death (~153–210t) because 5–10 Spiderlings burn at once. The sim keeps ~1 burning, so burn ≈ heal and the team wipes ~139t (0% WR vs reality's 69%).

**CRITICAL PROCESS LESSON — do not repeat my mistake.** I repeatedly INVENTED reality-facts to fit a theory and Mike had to correct each one: "affinity routes Spiderlings to Pelops" (WRONG — stage 13 is **Void**, affinity is inert), "the consume eats half the swarm" (WRONG — it eats all; the ~5 in a screenshot were new spawns dropping), "Pelops dies first" (WRONG — he dies LAST), "Pelops is a permanent aggro sink" (WRONG — Mike: not true). **Reason ONLY from verified data or Mike's first-party observation. When you don't know a reality-fact, ASK — never assert.** This is the CLAUDE.md reasoning-discipline rule (#1 label every claim observed/inherited/inferred), and I violated it all session.

---

## 1. What is VERIFIED (build on these)

- **The gap is the COUNT of Spiderlings burning at once: sim ~1, reality 5–10** (Mike's turn-by-turn screenshots t42–153; `tools/sim-screenshots.mjs`). Everything downstream (boss debuff stack 2–3 vs 5–11, boss HP drifting UP vs netting down) follows from this.
- **HP Burn PLACEMENT is 100% reliable** — every Spiderling that attacks Pelops gets burned. NOT an RNG/placement bug (`placeDebuffs` measured: 28.6 placed, 0 missed, Pelops never under [Decrease DEF]).
- **The burn TICK loses a race to the consume.** Of burned Spiderlings: **75% tick 0×, 25% tick 1×, 0% tick 2×.** A 2-turn burn essentially never ticks twice because the consume eats ALL living Spiderlings every other Skavag turn and no Spiderling survives a consume.
- **Off-Taunt targeting sends the swarm to the SQUISHY, not Pelops.** `chooseSingleTarget` (engine.js:644): Taunt/Provoke forces the target, else **lowest MAX HP**. Pelops has the HIGHEST max HP (28.3k) → he is NEVER chosen off-Taunt; Ezio (15.8k) / Vergis (16.6k) are. So Spiderlings only attack Pelops during his ~38–50% Taunt, then the 2-turn burns expire between windows → burning count collapses to ~1.
- **Ezio dies first (85% of fights, ~t84); Pelops dies LAST (~t133).** The squishy is eaten from the bottom up — same targeting rule. In reality the squishies survive (captures: Ezio ~26–37k taken, alive at win).

## 2. What was RULED OUT this session (don't re-tread — evidence in parens)

| Suspect | Verdict | Evidence |
|---|---|---|
| RNG glitch lowering burn land-rate | **NOT it** | 100% placement, 0 misses |
| Affinity targeting (routes swarm to Pelops) | **NOT it** | Stage 13 = **Void**; affinity is inert. `dungeon_stage_affinities` |
| Consume eats only half the swarm | **NOT it** | Mike: eats all; screenshot caught new spawns dropping |
| Consume cadence too fast | **NOT it** | Every other Skavag turn — Mike confirmed matches reality |
| Base speeds wrong | **NOT it** | Spiderling 150, Skavag 95 — Mike confirmed correct |
| Turn-meter drain (Stupefying Silk) starving Pelops | **NOT it** | ~2 casts/fight, 0 Sleeps, ~1 team-turn of TM lost; Pelops still gets 12.3 turns / 3.2 Taunts |
| Pelops dies early, killing the engine | **NOT it** | Pelops dies LAST (~t133); Ezio dies first (~t84) |

## 3. THE OPEN QUESTION (start here — needs Mike, not more sim runs)

Burns require a Spiderling to attack Pelops. In the sim that only happens during his Taunt (~38–50%), and the burned batch is consumed before it ticks. Reality shows 5–10 burning. **We do not know why**, because Pelops is NOT a permanent aggro sink (Mike) and affinity is inert (Void) and Taunt is cd-capped at ~50%. Two first-party observations settle it:

1. **When do Spiderlings attack Pelops in the real fight** — only in a burst right after his Taunt, or at other times too?
2. **When a Spiderling catches an HP Burn, does it visibly tick (pop a ~7k number) BEFORE the boss eats it, or is it consumed first like the sim?**

- If reality's burned Spiderlings **tick before the consume** → the sim is losing a race it shouldn't; re-examine the tick-vs-consume ORDER/phase (when in Skavag's turn the consume resolves; the taunt-burst-vs-consume alignment) even though cadence+speeds are individually correct.
- If reality also burns **only in Taunt bursts** but keeps more lit → the difference is burn PERSISTENCE/COUNT; look at why the sim's bursts don't survive (spawn floods TM=0 Spiderlings, diluting; burns expire at 2t).

Also unresolved and worth a look: the **purple counter on Skavag** in every screenshot (ticked 4→2→2→4→1→4) — unidentified; could gate the consume.

## 4. The per-hero damage gap (apples-to-apples, Ezio team)

Reality median (11 Ezio-team wins) vs sim — the wall is two exotic engines, vanilla dealers match:
| Champ | Reality | Sim | Gap |
|---|---:|---:|:--|
| Pelops | 1.44M | 572k | **2.5–4× low** (HP-Burn splash + Magma reflection + its lifesteal) |
| Bambus | 1.09M | 356k | **3.1× low** (poison redirect → boss debuff stack 2–3 vs 5–11) |
| Ezio/Tagoar/Vergis | — | — | match ~1.2–1.4× |

Note: Pelops also **under-HEALS 4×** (sim 152/t vs reality 644/t) because his lifesteal rides the under-modeled reflection — a survival consequence of the same damage gap.

## 5. Tools built this session (all in `tools/`, DB-gated, run with `--env-file=.env.local`)

- `sim-capability-matrix.mjs [seeds] [dungeon] [stage]` — the CAPABILITY BENCHMARK: dissects each champ's card (verbatim `champion_skills.skill_summary`) into atomic cells, then scores RECIPE coverage + TRACE firing + realized-duration. Found 57/59 clauses implemented; **Ezio's `Everything Is Permitted` execute passive is MISSING** from recipes (real but Spider-minor). Speed skills (Tagoar/Vergis Increase SPD, Bambus Decrease SPD) confirmed ON the chart + firing.
- `sim-spider-fate.mjs [seeds] [stage]` — Spiderling fate (spawned/killed/consumed) + HP-Burn placed-vs-ticked + killing-blow attribution.
- `sim-spider-turnorder.mjs [seeds]` — turn-order/speed audit (turns ∝ SPD; Skavag slowest at 95).
- `sim-ezio-experiment.mjs [seeds]` — neuters Ezio A2 to single-target; sim does NOT reproduce Mike's Ezio-hurts experiment (consume masks it).
- `sim-screenshots.mjs [seeds]` — sim state at Mike's captured turns (42/63/79/94/114/124/145) vs reality; the frame-by-frame divergence view.
- `knowledge/SPIDER13_FIGHT_TRACK.md` — the reality-vs-sim turn track (has stale bits: it still floats the "targeting/affinity" framing — reconcile with §2 above).

## 6. Data added

`data/manual-captures.json` → **20 Spider-13 captures** (17 Ezio-team, 3 Vallaryn-variant where Ezio was swapped out as an experiment). Ezio team = **69% WR (12W/6L), wins 153–210t (median ~181)**. The tracked live fight (t42→153 VICTORY) is the `energy:646` row.

## 7. Memory

Wrote `memory/spider13-burning-spiderling-placement-2026-07-29.md` (indexed in MEMORY.md). ⚠ It frames the cause as a "PLACEMENT gap via targeting" — TRUE that too few Spiderlings attack Pelops, but UPDATE it with this session's refinements: placement is 100% reliable; affinity is inert (Void); the tick-vs-consume race (75% tick 0×) is the mechanism; the open question is why reality keeps 5–10 burning.
