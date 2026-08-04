# HANDOFF 2026-08-04 — Wave-1 damage model VALIDATED; the only gap left is TURNS

**COLD START:** read this, then `[[unified-speed-model-and-cc-cooldown-2026-08-02]]` + `[[dragon16-donahilvi-pool-calibration-2026-08-02]]`. Continues `HANDOFF_2026-08-03_turn-model-root-cause.md`. Team: **DonaHilvi Dragon-16 pool** (Michelangelo lead / Ninja / Hilve the Rime-called / Iudex Artor / Coldheart). Fixture `test/golden/dragon-donahilvi-pool-current.json`. Branch `session/qa-rungs-2026-07-23` (all this session's work is **committed + pushed**: `7fffee2` → `07db12e` → `b6d9816` → `54d6e01`).

## THE HEADLINE — the damage model is done; only the turn count is off
This session walked Dragon-16 **wave 1 turn-by-turn against Mike's replay** and validated the **entire damage model** — every per-hit number now matches (Mikey A3, Ninja Hailburn, Coldheart A2, Express Delivery, HP Burn, crit vs normal, Freeze reduction). Then the reality anchor was **rebuilt from 40 captures** (was 6). Result: **WR and survivor count now MATCH reality; the ONE remaining discrepancy is TURNS.**

| Metric | **Sim (100 seeds)** | **Reality (40 captures)** |
|---|---|---|
| Win rate | 94% | ~96% |
| **Turns (median)** | **156** | **104** (86–115) ← THE GAP |
| Survivors (median) | 5/5 | 5/5 |

**The gap is phase length / turn economy — NOT damage, NOT counting** (both ruled out; damage is now replay-exact). The sim runs ~50% too long, so the team gets too many turns and out-sustains the fight. Fixing the turn model is the whole remaining job.

## START HERE NEXT SESSION
```
node --env-file=.env.local tools/sim-montecarlo.mjs dragon-donahilvi-pool-current 100
```
Shows sim **94% / 156t / 5-of-5** vs reality **96% / 104t / 5-of-5** (reality line now reads from the rebuilt anchor in the fixture). **Drive median turns 156 → 104.** The boss phase is the dominant overrun (was 106 vs 51 in the original handoff).

### The turn-economy levers = the still-deferred TM mechanics (wire these first)
All have card-exact params (verbatim DB text):
1. **Hilvi A3 "Boost Turn Meter"** — *"if no allies were revived by this skill, fills all allies' TM by 25%"*. Needs a **condition gate on FILL_TURN_METER** (fire only when the same cast revived 0 allies). This is the "Boost Turn Meter" pop visible in Mike's screenshots — the single highest-value lever.
2. **Hilvi A3 revive +30% TM** — *"revives all dead allies with 50% HP and 30% Turn Meter"*. Needs a **revive-TM param** (`doRevive` currently sets TM to 0).
3. **Ninja A1 self-TM +15% vs Bosses** — boss-conditional self FILL_TURN_METER.
4. **Ninja A3 decrease own Hailburn (A2) cd by 1** — own-skill cd reduction (`DECREASE_COOLDOWN` currently skips the actor).

Secondary gap (same root cause): the sim **under-kills the supports** — reality death rates Artor 30% / Hilvi 22% / Coldheart 17% vs the sim's ~6–7% each. Too many turns → too much sustain → nobody dies. Should self-resolve as turns drop; don't tune it directly.

## WHAT LANDED THIS SESSION (all committed, all gates green)

### `07db12e` — Freeze mechanics + Artor TM-fill (Mike first-party, from the in-game Freeze tooltip)
The Freeze tooltip states three things; all now modeled:
- **25% damage reduction** — *"only receives 75% of incoming damage"*. Wired as `frzM = 0.75` in `computeRawHit` (covers BOTH directions; the enemy→ally-only `incomingDamage` path could not). **DoT ticks bypass computeRawHit → HP Burn on frozen mobs stays FULL** (matches replay: frozen attack 2589→1941, HP-Burn tick unchanged).
- **Freeze freezes cooldowns; Stun/Sleep/Petrification tick them** — `CC_PRESERVES_COOLDOWNS = ['Freeze']` (was all-hard-CC, reviewer-inferred, WRONG). A controlled unit **TAKES its turn** (DoTs tick, durations advance, can't cast); only Freeze holds cooldowns.
- **Divine Mission (Hilvi) fires on ALL freezes** — removed the `!wasFrozen` gate (`interpreter.js:~443`). Re-freezing an already-frozen enemy re-triggers her −TM/HP-Burn/steal (screenshot: −TM pop on Ninja's re-freeze turn).
- **Artor A2 `FILL_TURN_METER` pct `15`→`0.15`** — `doFillTurnMeter` ×100, so `15` filled every ally to 100% at the wave-2 opening and flooded it. Same bug class as Hilvi Divine Mission `pct:10`. Fixed the wave-2 turn order (Faceless now goes 6th).

### `b6d9816` — Mikey A3 [Leech] + 40-capture reality anchor
- **[Leech]** (Michelangelo A3): placed on all enemies (75%, 2t) + consumer in `interpreter.dealOneHit` — **any ally hitting a Leeched enemy heals 18% of damage inflicted** (keyword-glossary standard). ~89k team healing in wave 1 alone. Direct attacks only; full incl. overheal; `[Heal Reduction]`-gated. This flipped the pool golden LOSS→WIN.
- **Reality anchor rebuilt** in the fixture's `result` + `reality_notes` from **40 combined captures**.

## THE REALITY ANCHOR (how it was built — reproduce/extend it)
Two capture sources, filtered to THIS pool team at **Dragon's Lair stage 16**:
- **Watcher** `gestal-sync/RslBattleReader/output/battle-log.json` — 2,561 battles total; **24** are the pool team at Dragon-16 (filter: hero-name set ⊇ {Michelangelo, Ninja, Hilve the Rime-called, Iudex Artor, Coldheart}, `dungeon="Dragon's Lair"`, `stageNumber===16`). Gives WR/turns/survival. Per-hero **damage is null on most rows** (known reader bug).
- **Manual** `data/manual-captures.json` (`.captures`) — **16** pool Dragon-16 victory-screen transcriptions (lists Hilvi as `"Hilvi"`). Gives full per-hero **damage / taken / healing**.

**Combined anchor:** ~96% WR (watcher 23W/1L, manual 15W/1L), wins median **104t** (86–115), **median 5/5 survivors**.

Per-hero **DEALT** median (manual wins, n=15): **Ninja 613k · Mikey 301k · Coldheart 223k · Hilvi 48k · Artor 27k**.
Per-hero **TAKEN** med: Mikey 20k / Ninja 31k / Hilvi 37k / Coldheart 42k / Artor 43k.
Per-hero **HEALING** med: Ninja 147k / Artor 80k / Coldheart 24k / Mikey 22k / Hilvi 16k.
**Death rates** (n=23): Ninja 0% / Mikey 4% / Coldheart 17% / Hilvi 22% / Artor 30%.
⚠ The old "83%/92% WR, 2-of-5 survivors" was a **6-battle small-sample artifact** — do not use it. Coldheart DEALT anchor = **223k** (this is the "over-deal" target; the sim's old 356k came purely from the extra ~50 turns).

## WAVE-1 GROUND TRUTH (validated with Mike, keep as regression reference)
- True turn order counts **enemy CC-turns** (every scheduler pick). Wave-1 opening: 5 allies, then **3 controlled-enemy turns (HP-Burn ticking while frozen)** before **Coldheart A3 at turn 12** kills a mob. Mike confirmed the first 12 turns are perfect once enemies "take their turn".
- ⚠ `tools/turn-order-check.mjs` counts **actions only** (via `onAction`), so it hides the enemy CC-turns and shows a false wave-1 "9/10 swap" (Coldheart A3 vs Artor A1). That's a **measurement artifact of the checker, not a sim bug** — the true `onSchedule` sequence matches reality. Wave 2 in that checker PASSES (Faceless 6th).
- The focused/back-left mob takes **~40,308 damage by turn 8** in reality → ~12% (almost dead). Driven by **Mikey's Decrease DEF landing** (68% of seeds — it's all-or-nothing: lands → Debuff-Spread carries it to the whole wave; misses → nothing) which amplifies the turn-8 hit ~3×, PLUS turn economy. On a DD-landed seed the sim reaches ~17% by turn 9 (it lags reality by one turn).
- Decrease ACC on the mobs = **Coldheart A2** (30%, 1t) — already modeled. Artor has NO Decrease ACC (verified vs DB; the earlier suspicion was a false alarm).

## DEFERRED LIST STATUS (pool team)
- **Done:** Mikey A3 [Leech].
- **No-ops accepted (8):** Tormin synergies ×3 (no Tormin), Turtles join-attack (no Turtles), Hilvi "one copy" (single), both Hilvi cd-locks (nothing reduces her cd), Ninja Escalation "multiplicative" reading (already modeled).
- **To wire (4):** the four TM mechanics above (Hilvi A3 ×2, Ninja A1, Ninja A3).
- **Need Mike's call (3):** Hilvi A2 buff-strip (do the mobs/boss carry strippable buffs?), Iudex A3 revive-then-cast-ally-skill (complex chain), Iudex passive reset-cd (depends on that chain).

## GATES (all green at handoff)
`tools/sim-selftest.mjs` 156/0 · `tools/sim-golden.mjs` (3 Bambus Dragon fixtures reproduce; pool fixture now WIN/WIN; the 4 "fails" are Spider fixtures not modelled in lib/sim, pre-existing) · `tools/battle-suite.mjs` 44.2% · `tools/check-champion-identity.mjs` pass.

## FILES TOUCHED
`lib/sim/engine.js` (frzM in computeRawHit; CC_PRESERVES_COOLDOWNS=['Freeze']; CC branch cooldown guard; ally-TM wave reset), `lib/sim/interpreter.js` (Leech consumer in dealOneHit; Divine-Mission !wasFrozen removed), `lib/sim/recipes.js` (Artor A2 pct 0.15; Mikey A3 Leech placement), `test/golden/dragon-donahilvi-pool-current.json` (rebuilt reality anchor). NEW: this handoff. Memory updated: `[[unified-speed-model-and-cc-cooldown-2026-08-02]]` (corrected CC model) + `[[dragon16-donahilvi-pool-calibration-2026-08-02]]` (new anchor).
